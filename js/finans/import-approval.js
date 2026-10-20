// Dormant first-stage adapter: no mailbox reader, automatic posting or UI registration.
// Authentication/authorization must ALSO be enforced by the eventual trusted host/rules.
import {odemePlani, tahsilatUygula, gecerliTarih} from './core.js';
import {gecerliDonem, planSatiriImzasi} from './payment-actions.js';

export const OWNER_EMAIL = 'emrahby@gmail.com';
export const EXPENSE_CATEGORIES = Object.freeze({
  personel_ogretmen:'Öğretmen Maaşı', personel_yonetici:'Yönetici/İdari',
  personel_temizlik:'Temizlik Görevlisi', personel_guvenlik:'Güvenlik',
  personel_sgk:'SGK Primleri', personel_egitim:'Öğretmen Eğitimi',
  sabit_kira:'Kira', sabit_elektrik:'Elektrik', sabit_su:'Su',
  sabit_dogalgaz:'Doğalgaz', sabit_internet:'İnternet/Telefon', sabit_vergi:'Vergiler',
  isletme_yemek:'Yemek/Gıda', isletme_temizlik:'Temizlik Malzemesi',
  isletme_kirtasiye:'Kırtasiye/Sarf', isletme_bakim:'Bakım/Onarım',
  diger_reklam:'Reklam/Pazarlama', diger_muhasebe:'Muhasebe/Danışmanlık',
  diger_sigorta:'Sigorta', diger_genel:'Genel/Diğer'
});
const fail = message => {throw Error(message);};
const owner = ctx => {
  if(ctx.email !== OWNER_EMAIL) fail('Yalnız hesap sahibi onaylayabilir.');
};
function text(value, label) {
  if(typeof value !== 'string' || !value.trim() || value.length > 1000) fail(label+' gerekli.');
  return value.trim();
}
function id(value) {
  const s=text(value,'Kimlik');
  if(s.includes('/') || s.length>200) fail('Geçersiz kimlik.');
  return s;
}
function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(
    Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
export const reviewSignature = value => JSON.stringify(canonical(value));
async function hash(value) {
  const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(reviewSignature(value)));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function validate(candidate) {
  if(!['payment','expense'].includes(candidate.kind)) fail('Kayıt türü gerekli.');
  if(!Number.isSafeInteger(candidate.amountMinor) || candidate.amountMinor<=0) fail('Tutar pozitif tam kuruş olmalı.');
  if(!/^[A-Z]{3}$/.test(candidate.currency||'')) fail('Para birimi açıkça belirtilmeli.');
  if(!Number.isSafeInteger(candidate.revision) || candidate.revision<1) fail('Kaynak sürümü gerekli.');
  const s=candidate.source||{};
  text(s.mailbox,'Posta hesabı'); text(s.messageId,'İleti kimliği');
  if(s.attachmentHash && !/^[a-f0-9]{64}$/.test(s.attachmentHash)) fail('Ek özeti SHA-256 olmalı.');
  if(candidate.kind==='payment') {
    id(candidate.studentId);
    if(!gecerliDonem(candidate.period)) fail('Eğitim dönemi gerekli.');
    text(candidate.item,'Ödeme kalemi');
  }
  // Optional evidence is stored as supplied, never guessed from an email date.
  if(candidate.eventKey) {
    const e=candidate.eventKey;
    if(!['bank_reference','invoice_ettn'].includes(e.type)) fail('Güvenilir işlem anahtarı türü gerekli.');
    text(e.issuer,'İşlem anahtarı kurumu'); text(e.account,'İşlem anahtarı hesabı'); text(e.value,'İşlem referansı');
  }
}
export async function sourceKey(candidate) {
  validate(candidate);
  const s=candidate.source;
  return hash([s.mailbox.trim().toLowerCase(),s.messageId.trim(),s.attachmentHash||'']);
}
async function eventKey(candidate) {
  if(!candidate.eventKey) return null;
  const e=candidate.eventKey;
  return hash({type:e.type,issuer:e.issuer.trim().toLowerCase(),
    account:e.account.trim(),value:e.type==='invoice_ettn'?e.value.trim().toLowerCase():e.value.trim()});
}
// Creation changes only the queue. Exact source repeats are no-ops; changed content
// cannot silently replace a record an operator may already be reviewing.
export async function stageCandidate(ctx, candidate) {
  owner(ctx); validate(candidate);
  const key=await sourceKey(candidate), {fb,db}=ctx;
  return fb.runTransaction(db,async tx=>{
    const ref=fb.doc(db,'finansIceriAktarimlari',key), snap=await tx.get(ref);
    if(snap.exists()) {
      if(reviewSignature(snap.data().candidate)!==reviewSignature(candidate)) fail('Kaynak değişmiş; yeniden inceleme gerekli.');
      return {id:key,existing:true};
    }
    tx.set(ref,{candidate:structuredClone(candidate),status:'onay_bekliyor',createdAt:fb.serverTimestamp()});
    return {id:key,existing:false};
  });
}
// The caller shows this complete snapshot and choices before requesting approval.
// Missing bank references require explicit review of possible cross-mailbox copies.
export function prepareReview(candidate, {category=null, duplicateReview=false}={}, periodData=null) {
  validate(candidate);
  const row=candidate.kind==='payment'
    ? odemePlani(periodData).satirlar.find(r=>r.id===candidate.item) : null;
  return {
    candidate:structuredClone(candidate), category, duplicateReview,
    signature:reviewSignature(candidate),
    planSignature:row ? planSatiriImzasi(row) : null
  };
}
export async function approveCandidate(ctx, {queueId, review, confirmed=false}) {
  owner(ctx);
  if(confirmed!==true) fail('Açık onay gerekli; otomatik kayıt kapalı.');
  id(queueId);
  validate(review?.candidate||{});
  if(review.signature!==reviewSignature(review.candidate)) fail('Onay önizlemesi değişmiş.');
  const {fb,db}=ctx, expectedSource=await sourceKey(review.candidate);
  if(expectedSource!==queueId) fail('Kaynak kimliği uyuşmuyor.');
  const event=await eventKey(review.candidate);
  return fb.runTransaction(db,async tx=>{
    const qr=fb.doc(db,'finansIceriAktarimlari',queueId), qs=await tx.get(qr);
    if(!qs.exists()) fail('Onay kuyruğu kaydı bulunamadı.');
    const q=qs.data(), c=q.candidate;
    if(reviewSignature(c)!==review.signature) fail('Kaynak sürümü veya tutarı değişmiş; yeniden inceleyin.');
    const approval=reviewSignature(review);
    const ledgerId='import_'+queueId;
    const ledger=fb.doc(db,c.kind==='payment'?'odemeler':'giderler',ledgerId);
    const ls=await tx.get(ledger);
    if(q.status==='islendi') {
      if(!ls.exists() || q.approvalSignature!==approval) fail('Önceki işlem sonucu uyuşmuyor.');
      return {id:ledgerId,alreadyProcessed:true};
    }
    if(q.status!=='onay_bekliyor' || ls.exists()) fail('Kayıt beklemiyor veya muhasebe kaydı zaten var.');
    const lock=event ? fb.doc(db,'finansKaynakKilitleri',event) : null;
    if(lock && (await tx.get(lock)).exists()) fail('Aynı banka/fatura referansı daha önce işlendi.');
    // Legacy accounting rows have no source locks, even when new evidence has a
    // bank reference. Human review remains mandatory for both legacy and cross-mail copies.
    if(review.duplicateReview!==true) fail('Mevcut kayıtlar ve hesaplar arası mükerrer kontrolünü onaylayın.');
    if(c.currency!=='TRY') fail('Döviz otomatik çevrilmez; ayrı kur ve muhasebe incelemesi gerekli.');
    if(!gecerliTarih(c.paymentDate)) fail('Kanıtlanmış ödeme tarihi gerekli.');
    text(c.paymentMethod,'Ödeme yöntemi');
    text(c.paymentEvidence,'Ödeme kanıtı');
    if(c.paymentStatus!=='paid') fail('Fatura tek başına ödeme kanıtı değildir.');
    let periodRef, applied;
    if(c.kind==='payment') {
      periodRef=fb.doc(db,'ogrenciler',c.studentId,'donemler',c.period);
      const ps=await tx.get(periodRef);
      if(!ps.exists()) fail('Dönem kaydı bulunamadı.');
      const plan=odemePlani(ps.data()), row=plan.satirlar.find(r=>r.id===c.item);
      if(!row || !review.planSignature || planSatiriImzasi(row)!==review.planSignature) fail('Plan veya bakiye değişmiş; yeniden inceleyin.');
      if(plan.satirlar.some(r=>(r.record.hareketler||[]).some(h=>h.id===ledgerId))) fail('Tahsilat hareketi zaten var.');
      applied=tahsilatUygula(ps.data(),{
        durum:'bekliyor',kalemTipi:c.item,tutar:c.amountMinor/100,
        odemeTarihi:c.paymentDate,yontem:c.paymentMethod
      },ledgerId,ctx.email);
    } else if(!Object.hasOwn(EXPENSE_CATEGORIES,review.category)) {
      fail('Geçerli gider kategorisini açıkça seçin.');
    }
    const timestamp=fb.serverTimestamp();
    const common={tutar:c.amountMinor/100,paraBirimi:c.currency,odemeTarihi:c.paymentDate,
      odemeYontemi:c.paymentMethod,kaynakId:queueId,kaynak:c.source,
      odemeKaniti:c.paymentEvidence,onaylayan:ctx.email,olusturuldu:timestamp};
    // All reads precede writes; queue, source lock, accounting and notification
    // succeed or fail together. Deterministic IDs make unknown-outcome retries safe.
    if(periodRef) tx.update(periodRef,{[applied.field]:applied.values});
    tx.set(ledger,c.kind==='payment'
      ? {...common,tur:'tahsilat_onayi',ogrenciId:c.studentId,donem:c.period,kalem:c.item}
      : {...common,kategori:review.category,tarih:c.paymentDate,aciklama:c.description||'',
          faturaNo:c.invoiceNumber||null,faturaTarihi:c.invoiceDate||null,odendi:true});
    if(lock) tx.set(lock,{queueId,ledgerId,createdAt:timestamp});
    tx.update(qr,{status:'islendi',approvalSignature:approval,ledgerId,processedAt:timestamp});
    tx.set(fb.doc(db,'bildirimler',ledgerId),{
      aliciEmail:OWNER_EMAIL,tip:'finans_onay',baslik:'Onaylanan kayıt işlendi',
      metin:'İncelediğiniz finans kaydı muhasebeye işlendi.',hedefSayfa:'finans',
      kaynakId:queueId,okundu:false,olusturuldu:timestamp
    });
    return {id:ledgerId,alreadyProcessed:false};
  });
}

// No inferred category and no preselected approval; host owns the final review UI.
export function categoryOptions() {
  return [{value:'',label:'Gider kategorisi seçin'},...Object.entries(EXPENSE_CATEGORIES)
    .map(([value,label])=>({value,label}))];
}
