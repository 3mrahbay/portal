import {kurus,gecerliTarih} from '../core.js';
const copy = x => structuredClone(x);
export const sourceKey = m => JSON.stringify([m.donem,m.ogrenciId,m.kalemId,m.hareketId]);
const amountOK = n => typeof n==='number' && Number.isFinite(n) && n>0 && Number.isSafeInteger(Math.round(n*100)) && Math.abs(n*100-Math.round(n*100))<0.00001;
// Only explicit student fields are admitted. Parent/payer objects are never fallbacks.
export function studentRecipient(student) {
 const period=student?.veri?.ogrenci||{}, main=student?.ogrenciKimlik||{};
 const name=String(period.adSoyad ?? main.adSoyad ?? '').trim();
 const tckn=String(period.tcKimlik ?? main.tcKimlik ?? '').trim();
 const conflict=!!(period.tcKimlik && main.tcKimlik && String(period.tcKimlik).trim()!==String(main.tcKimlik).trim());
 return {kind:'student',studentId:student?.id||'',name,tckn,conflict};
}
export const maskedTckn = value => /^\d{11}$/.test(String(value||'')) ? '•••••••••'+String(value).slice(-2) : 'Eksik / kontrol gerekli';
const sameName=(a,b)=>String(a||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('tr')===String(b||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('tr');
export function studentCustomer(d) {
 const r=d.recipient, c=d.customer;
 if(r?.kind!=='student'||r.studentId!==d.source.ogrenciId||!r.name||!/[\s]/.test(r.name)||!/^\d{11}$/.test(r.tckn)||r.tckn[0]==='0'||r.conflict)throw Error('Öğrencinin adı ve T.C. kimlik bilgisi doğrulanmalı');
 if(!c?.id||c.ownerType!=='student'||c.studentId!==r.studentId||c.tckn!==r.tckn||!sameName(c.name,r.name))throw Error('İşbaşı carisi öğrencinin adı ve T.C. kimliğiyle eşleşmeli');
 const parts=r.name.split(/\s+/); const lastName=parts.pop();
 return {code:c.id,isPerson:true,firstName:parts.join(' '),lastName,tcknVkn:r.tckn};
}
export function candidates(data, now=new Date()) {
 const moves=data.gelirler||[], counts=new Map();
 for(const m of moves) counts.set(sourceKey(m),(counts.get(sourceKey(m))||0)+1);
 return moves.filter(m=>Number(m.tutar)>0).map(m=>{
  const key=sourceKey(m), blockers=[];
  if(!m.ogrenciId||!m.donem||!m.kalemId||!m.hareketId||m.hareketId==='devir'||m.eskiKayit)blockers.push('Tekil tahsilat kimliği doğrulanmalı');
  if(!amountOK(m.tutar))blockers.push('Tutar kuruş hassasiyetinde doğrulanmalı');
  if(!gecerliTarih(m.tarih,now))blockers.push('Banka tarihi doğrulanmalı');
  if(counts.get(key)>1)blockers.push('Aynı tahsilat birden fazla kez görünüyor');
  if(m.tur==='duzeltme'||moves.some(r=>r.ogrenciId===m.ogrenciId&&r.donem===m.donem&&r.kalemId===m.kalemId&&(r.tersKayitId===m.hareketId||Number(r.tutar)<0)))blockers.push('İade / düzeltme mutabakatı gerekli');
  const student=data.ogrenciler?.find(o=>o.id===m.ogrenciId);
  if(student?.plan?.uyarilar?.length)blockers.push('Öğrenci hareket toplamları uyuşmuyor');
  const recipient=studentRecipient(student);
  const customers=(data.invoiceCustomers||[]).filter(c=>c.ownerType==='student'&&c.studentId===recipient.studentId&&c.tckn===recipient.tckn&&sameName(c.name,recipient.name));
  const customer=customers.length===1?copy(customers[0]):null;
  const matches=(data.mutabakatlar||[]).filter(r=>sourceKey(r)===key);
  if(matches.length!==1||!matches[0].bankaReferans||kurus(matches[0].tahsilatTutar)!==kurus(m.tutar)||!Number.isFinite(matches[0].komisyon)||matches[0].komisyon<0||kurus(matches[0].bankaTutar)+kurus(matches[0].komisyon)!==kurus(m.tutar))blockers.push('Banka hareketi ile eşleşme doğrulanmalı');
  return {key,source:{donem:m.donem||'',ogrenciId:m.ogrenciId||'',kalemId:m.kalemId||'',hareketId:m.hareketId||''},name:recipient.name||m.ogrenci||'',recipient,customer,customerId:customer?.id||'',item:m.kalem||'',date:m.tarih||'',amountMinor:kurus(m.tutar),currency:'TRY',blockers,requirement:'review',status:'draft'};
 });
}
export function readyIssues(d) {
 const issues=[...d.blockers];
 if(d.requirement!=='required')issues.push('Fatura gerekliliği belirlenmeli');
 try{studentCustomer(d);}catch(e){issues.push(e.message);}
 if(!['efatura','earsiv'].includes(d.documentType))issues.push('Alıcının GİB durumu doğrulanmalı');
 if(d.documentType==='efatura'&&!d.recipientAlias)issues.push('e-Fatura alıcı etiketi gerekli');
 if(!d.taxApproved||!Number.isInteger(d.taxRateBps)||d.taxRateBps<0||d.taxRateBps>10000)issues.push('Hizmet ve KDV kararı doğrulanmalı');
 if(!d.servicePeriod||!d.productCode)issues.push('Hizmet dönemi ve ürün kodu gerekli');
 if(d.existingInvoiceCheck!=='clear')issues.push('Mevcut İşbaşı faturalarıyla mükerrer kontrolü gerekli');
 return issues;
}
// This is a simulation, never a server authorisation boundary or durable ledger.
// All data is private to this instance, cloned on entry/exit, with no network/storage.
export class MockInvoiceService {
 #rows=new Map(); #events=[]; #documents=new Map(); #next=0;
 constructor({mode='mock',now=()=>new Date().toISOString()}={}) {
  if(mode!=='mock')throw Error('Yalnızca mock modu desteklenir'); this.now=now;
 }
 #actor(actor,roles) {if(!actor?.id||!roles.includes(actor.role))throw Error('Bu işlem için yetkiniz yok');}
 #event(d,actor,action,reason='') {this.#events.push({sequence:this.#events.length+1,key:d.key,version:d.version,actor:actor.id,action,reason,at:this.now()});}
 #row(key,version) {const d=this.#rows.get(key);if(!d)throw Error('Taslak bulunamadı');if(version!==undefined&&version!==d.version)throw Error('Kayıt değişti; yeniden inceleyin');return d;}
 ingest(rows,actor) {
  this.#actor(actor,['preparer','approver']);
  for(const r of rows){
   if(!r.key||!Array.isArray(r.blockers)||!Number.isSafeInteger(r.amountMinor)||r.amountMinor<=0)throw Error('Geçersiz tahsilat adayı');
   const snapshot=JSON.stringify([r.source,r.amountMinor,r.currency,r.date,r.blockers,r.recipient,r.customer]);
   const old=this.#rows.get(r.key);
   if(old){
    if(old.sourceSnapshot!==snapshot){old.version++;old.status='source_changed';old.approvedBy=null;old.approvedVersion=null;this.#event(old,actor,'source_changed');}
    continue;
   }
   const d={key:r.key,source:copy(r.source),name:r.name,recipient:copy(r.recipient),customer:copy(r.customer),customerId:r.customer?.id||'',item:r.item,date:r.date,amountMinor:r.amountMinor,currency:r.currency,blockers:copy(r.blockers),requirement:'review',status:'draft',version:1,preparedBy:actor.id,sourceSnapshot:snapshot};
   this.#rows.set(r.key,d);this.#event(d,actor,'draft_created');
  }
  return this.list();
 }
 list(){return copy([...this.#rows.values()]);}
 audit(){return copy(this.#events);}
 revise(key,version,patch,actor) {
  this.#actor(actor,['preparer','approver']);const d=this.#row(key,version);
  if(!['draft','ready','approved','excluded'].includes(d.status))throw Error('Gönderimden sonra düzenleme kapalı');
  const allowed=['requirement','reason','documentType','recipientAlias','taxApproved','taxRateBps','servicePeriod','productCode','existingInvoiceCheck'];
  if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('Değiştirilemeyen alan');
  const next={...d,...copy(patch)};
  if(!['review','required','excluded'].includes(next.requirement))throw Error('Geçersiz fatura kararı');
  if(next.requirement==='excluded'&&String(next.reason||'').trim().length<5)throw Error('İstisna gerekçesi gerekli');
  if(!['unchecked','clear','possible'].includes(next.existingInvoiceCheck||'unchecked'))throw Error('Geçersiz mükerrer kontrolü');
  next.version++;next.approvedBy=null;next.approvedVersion=null;next.preparedBy=actor.id;
  next.status=next.requirement==='excluded'?'excluded':readyIssues(next).length?'draft':'ready';
  this.#rows.set(key,next);this.#event(next,actor,'revised',String(next.reason||''));return copy(next);
 }
 approve(key,version,actor) {
  this.#actor(actor,['approver']);const d=this.#row(key,version);
  if(d.preparedBy===actor.id)throw Error('Hazırlayan ve onaylayan ayrı kişiler olmalı');
  if(d.status!=='ready'||readyIssues(d).length)throw Error('Eksikleri tamamlamadan onaylanamaz');
  d.version++;d.status='approved';d.approvedBy=actor.id;d.approvedVersion=d.version;this.#event(d,actor,'approved');return copy(d);
 }
 async simulateIssue(key,version,actor,{outcome='accepted'}={}) {
  this.#actor(actor,['approver']);const d=this.#row(key,version);
  if(!['accepted','timeout','rejected'].includes(outcome))throw Error('Geçersiz test senaryosu');
  if(d.status!=='approved'||d.approvedVersion!==d.version||d.approvedBy!==actor.id)throw Error('Güncel manuel onay gerekli');
  studentCustomer(d);
  // Claim before yielding: concurrent calls cannot issue twice in this instance.
  d.status='sending';d.version++;d.operationId='mock-'+(++this.#next);this.#event(d,actor,'send_started');
  await Promise.resolve();
  if(outcome!=='rejected')this.#documents.set(d.operationId,{id:'TEST-'+d.operationId,operationId:d.operationId,amountMinor:d.amountMinor,currency:d.currency,customerId:d.customerId,status:'accepted'});
  d.status=outcome==='timeout'?'unknown':outcome==='rejected'?'rejected':'submitted';
  if(outcome==='accepted')d.documentId=this.#documents.get(d.operationId).id;
  d.version++;this.#event(d,actor,'send_'+outcome);return copy(d);
 }
 reconcile(key,version,actor) {
  this.#actor(actor,['approver','auditor']);const d=this.#row(key,version);
  if(!['unknown','submitted'].includes(d.status))throw Error('Durum sorgusu bekleyen belge yok');
  const doc=this.#documents.get(d.operationId);
  if(!doc||doc.amountMinor!==d.amountMinor||doc.currency!==d.currency||doc.customerId!==d.customerId)throw Error('Belge doğrulanamadı; yeniden gönderim kapalı');
  d.status='issued';d.documentId=doc.id;d.version++;this.#event(d,actor,'reconciled');return copy(d);
 }
}
