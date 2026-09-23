import {esc,para,bugun,bildirimKalemi,odemePlani,sirala,gecerliTarih,kurus} from './core.js';
import {dekontIndir} from './receipts.js';
import {odemePlaniAc} from './payment-plan.js';
import {bekleyen,hesapOku,bildirimImzasi,planSatiriImzasi,bildirimiIsle,hatirlatmaTaslagi,hatirlatmaGonder} from './payment-actions.js';

const labels={bekliyor:'Kontrol bekliyor',beklemede:'Kontrol bekliyor',onayli:'Onaylandı',onaylandi:'Onaylandı',reddedildi:'Reddedildi',ret:'Reddedildi',iade_edildi:'İade edildi',kismi_iade:'Kısmen iade',geri_alindi:'Onay geri alındı'};
const ogrAd=h=>h.ogrenci.ogrenciAdSoyad||h.ogrenci.adSoyad||h.ogrenci.ad||'Öğrenci';
const veliAd=h=>[h.veri?.anne?.adSoyad,h.veri?.baba?.adSoyad,h.veri?.veli?.adSoyad,h.veri?.vasi?.adSoyad].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||'Veli adı belirtilmemiş';
function css(){if(document.getElementById('financeWorkspaceCss'))return;const l=document.createElement('link');l.id='financeWorkspaceCss';l.rel='stylesheet';l.href=new URL('./payment-workspace.css',import.meta.url).href;document.head.append(l);}
function pencere(root,title,cls=''){
 css();const opener=document.activeElement,d=document.createElement('dialog');d.className='finance-detail finance-workspace '+cls;d.setAttribute('aria-label',title);
 d.innerHTML=`<header class="detail-heading"><h2>${esc(title)}</h2><button type="button" data-close>Kapat</button></header><div class="detail-body"></div>`;
 root.append(d);d.showModal();d.querySelector('[data-close]').onclick=()=>{if(!d._busy)d.close();};
 d.addEventListener('cancel',e=>{if(d._busy)e.preventDefault();});
 d.addEventListener('close',()=>{d._closed=true;d.remove();if(opener?.isConnected)opener.focus();});return d;
}
function hata(node,text){node.textContent=text;node.hidden=false;}
function kilit(d,busy){d._busy=busy;d.querySelectorAll('button,input,select').forEach(b=>b.disabled=busy);}
// Aynı öğrenci, dönem ve ödeme kalemi için başka etkin bildirim var mı? (Veliler birbirinin bildirimini göremez;
// iki veli aynı ödemeyi ayrı ayrı bildirebilir. Muhasebe tüm bildirimleri gördüğü için kontrol burada yapılır.)
const ETKIN_BILDIRIM=['bekliyor','beklemede','onayli','onaylandi'];
export function benzerBildirimler(b,list){
 if(!b)return [];const kalem=bildirimKalemi(b),tutar=kurus(b.bildirilenTutar??b.tutar),veli=String(b.veliEmail||'').toLowerCase();
 return (list||[]).filter(n=>n&&n.id!==b.id&&String(n.ogrenciId||'')===String(b.ogrenciId||'')&&ETKIN_BILDIRIM.includes(n.durum)&&bildirimKalemi(n)===kalem&&(!n.donem||!b.donem||n.donem===b.donem))
  .map(n=>({bildirim:n,ayniTutar:kurus(n.bildirilenTutar??n.tutar)===tutar,farkliVeli:String(n.veliEmail||'').toLowerCase()!==veli,onayli:['onayli','onaylandi'].includes(n.durum)}));
}
export function benzerBildirimUyarisi(benzer){
 if(!benzer?.length)return '';
 return (benzer.some(x=>x.ayniTutar)?'Muhtemel mükerrer bildirim':'Aynı kalem için başka bildirim de var')+(benzer.some(x=>x.farkliVeli)?' · diğer veliden':'')+' · birlikte kontrol edin.';
}
function bildirimKartlari(notes,tum=notes){return sirala(notes,'odemeTarihi','desc').map(b=>`<article class="card payment"><div><b>${esc(b.kalemAd||b.ayAd||bildirimKalemi(b)||'Ödeme bildirimi')}</b><small>${para(b.bildirilenTutar??b.tutar)} · ${esc(b.odemeTarihi||'Tarih eksik')} · ${esc(labels[b.durum]||b.durum)}</small>${!b.donem?'<small class="finance-warning">Dönem bilgisi eksik; onaydan önce seçip doğrulayın.</small>':''}${b.tekrarBildirim?'<small class="finance-warning">Tekrar bildirim · Önceki bildirimle birlikte kontrol edin.</small>':''}${benzerBildirimler(b,tum).length?`<small class="finance-warning" data-benzer-uyari>${esc(benzerBildirimUyarisi(benzerBildirimler(b,tum)))}</small>`:''}</div><div class="toolbar">${bekleyen(b)?`<button type="button" data-review="${esc(b.id)}">${b.donem?'Kontrol et / Onayla':'Dönemi doğrula / Onayla'}</button>`:''}${b.dekontVar?`<button type="button" data-receipt="${esc(b.id)}">Dekont</button>`:''}</div></article>`).join('')||'<p>Bu döneme ait bildirim yok.</p>';}

export async function odemeKontrolAc(root,ctx,{bildirim,donem,onDone=()=>{},onAccount}){
 const d=pencere(root,'Ödeme kontrolü','finance-review'),body=d.querySelector('.detail-body');body.textContent='Bildirim ve kayıtlı dönemler okunuyor…';
 let b,h,selected='',row,request=0;
 try{
  const snap=await ctx.fb.getDoc(ctx.fb.doc(ctx.db,'odemeBildirimleri',bildirim.id));
  if(!snap.exists())throw Error('Bildirim bulunamadı.');
  b={...snap.data(),id:bildirim.id};
  if(b.ogrenciId!==bildirim.ogrenciId)throw Error('Bildirimin öğrenci bağlantısı değişmiş. Listeyi yenileyin.');
  h=await hesapOku(ctx,b.ogrenciId,b.donem||donem);
  if(d._closed)return;selected=b.donem||'';draw();
 }catch(e){if(!d._closed)body.textContent='Bildirim okunamadı: '+e.message;}
 function draw(){
  const v=h.periods.find(p=>p.id===selected)?.veri,plan=odemePlani(v);row=plan.satirlar.find(r=>r.id===bildirimKalemi(b));
  const benzer=benzerBildirimler(b,h.bildirimler);
  const amount=Number(b.bildirilenTutar??b.tutar),canApprove=bekleyen(b)&&!!row&&Number.isFinite(amount)&&amount>0&&amount<=row.kalan&&gecerliTarih(b.odemeTarihi);
  const problem=!selected?'Eğitim dönemini seçin. Ödeme tarihi tek başına eğitim dönemini belirlemez.':!row?'Seçilen dönemin planında aynı ödeme kalemi yok. İşlem yapılmayacak.':!gecerliTarih(b.odemeTarihi)?'Bildirimde geçerli ödeme tarihi bulunmuyor; kaydı kontrol edin.':!Number.isFinite(amount)||amount<=0?'Bildirilen tutar geçersiz.':amount>row.kalan?'Bildirilen tutar kalan borcu aşıyor. Mevcut tahsilatları kontrol edin.':'';
  body.innerHTML=`<p class="finance-person">${onAccount?`<button type="button" class="finance-person-link" data-account>${esc(ogrAd(h))} · Ödeme hesabını aç →</button>`:`<b>${esc(ogrAd(h))}</b>`}<small>${esc(veliAd({...h,veri:v||h.veri}))}</small></p><div class="card"><strong>${para(amount)}</strong><p>${esc(b.kalemAd||b.ayAd||bildirimKalemi(b)||'Kalem eksik')}</p><p>${esc(b.odemeTarihi||'Ödeme tarihi eksik')} · ${esc(b.odemeYontemi||b.yontem||'Yöntem belirtilmemiş')}</p><p class="finance-note">${esc(b.not||'Not bulunmuyor.')}</p>${b.dekontVar?'<button type="button" data-receipt>Dekontu aç / indir</button>':''}</div>
  ${b.tekrarBildirim?`<section class="card turuncu"><b>Tekrar ödeme bildirimi</b><p>Veli bu kaydı önceki bir bildirimden sonra yeniden gönderdi. İki bildirimi birlikte kontrol edin.</p><p><b>Neden:</b> ${esc(b.tekrarNedeni==='onceki_bildirimde_hata'?'Önceki bildirimde yanlışlık olduğunu düşünüyor':b.tekrarNedeni==='ayri_odeme'?'Aynı kalem için ayrı / yeni bir ödeme yaptığını belirtiyor':'Diğer')}</p></section>`:''}
  ${benzer.length?`<section class="card turuncu" data-benzer><b>${benzer.some(x=>x.ayniTutar)?'Muhtemel mükerrer ödeme bildirimi':'Bu ödeme kalemi için başka bildirim de var'}</b><p>Onaylamadan önce, aşağıdaki kayıtların ayrı ödemeler mi yoksa aynı ödemenin tekrarı mı olduğunu banka hareketinden kontrol edin.</p>${benzer.map(x=>`<p>${para(x.bildirim.bildirilenTutar??x.bildirim.tutar)} · ${esc(x.bildirim.odemeTarihi||'Tarih eksik')} · ${esc(labels[x.bildirim.durum]||x.bildirim.durum)} · ${x.farkliVeli?`diğer veli (${esc(x.bildirim.veliEmail||'e-posta yok')})`:'aynı veli'}</p>`).join('')}</section>`:''}
  ${!b.donem?`<section class="card turuncu"><b>Bu eski bildirimin dönem bilgisi eksik.</b><p>Dönem, yalnız aşağıdaki seçiminizi onayladığınızda tahsilatla birlikte kaydedilecek. Hiçbir ödeme otomatik onaylanmaz.</p><label>Eğitim dönemi<select data-period><option value="">Dönem seçin…</option>${h.periods.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.id)}</option>`).join('')}</select></label></section>`:`<p><b>Eğitim dönemi:</b> ${esc(selected)}</p>`}
  ${row?`<section class="card"><b>${esc(selected)} · ${esc(row.ad)}</b><p>Plandaki borç: ${para(row.beklenen)} · Ödenen: ${para(row.odenen)} · Kalan: ${para(row.kalan)}</p><p>Onaylanacak tutar: <b>${para(amount)}</b> · Onay sonrası kalan: ${para(Math.max(0,row.kalan-amount))}</p></section>`:''}
  ${problem?`<p class="error" role="status">${esc(problem)}</p>`:''}${!bekleyen(b)?`<p class="status">Bu bildirim işlenmiş: ${esc(labels[b.durum]||b.durum)}.</p>`:''}
  <label class="finance-confirm"><input type="checkbox" data-confirm ${canApprove?'':'disabled'}><span>${esc(selected||'Seçilecek dönem')} dönemini, öğrenciyi, ödeme kalemini ve tahsil edilen tutarı kontrol ettim.${benzer.length?' Bu kalemdeki diğer bildirimlerle mükerrer olmadığını doğruladım.':''}</span></label><p class="error" data-error role="alert" hidden></p><div class="toolbar"><button type="button" class="primary" data-approve disabled>${b.donem?'Tahsilatı onayla':'Dönemi doğrula ve tahsilatı onayla'}</button><button type="button" data-reject ${bekleyen(b)?'':'disabled'}>Bildirimi reddet</button></div>`;
  body.querySelector('[data-period]')?.addEventListener('change',e=>{selected=e.target.value;draw();});
  body.querySelector('[data-confirm]').onchange=e=>body.querySelector('[data-approve]').disabled=!canApprove||!e.target.checked;
  body.querySelector('[data-account]')?.addEventListener('click',()=>{d.close();onAccount(b.ogrenciId);});
  body.querySelector('[data-receipt]')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await dekontIndir(ctx,b.id);}catch(err){hata(body.querySelector('[data-error]'),err.message);}finally{body.querySelector('[data-receipt]')?.removeAttribute('disabled');}});
  body.querySelector('[data-approve]').onclick=()=>act('onayli');
  body.querySelector('[data-reject]').onclick=()=>{if(globalThis.confirm('Bu ödeme bildirimini reddetmek istiyor musunuz? Öğrencinin borcu ve ödeme planı değişmeyecek.'))act('ret');};
 }
 async function act(sonuc){
  if(d._busy)return;const checked=body.querySelector('[data-confirm]').checked;
  if(sonuc==='onayli'&&!checked)return;
  const token=++request;kilit(d,true);
  try{await bildirimiIsle(ctx,{id:b.id,ogrenciId:b.ogrenciId,donem:selected,donemDogrulandi:!b.donem&&checked,imza:bildirimImzasi(b),planImza:planSatiriImzasi(row),sonuc});d._busy=false;d.close();await onDone();}
  catch(e){if(!d._closed&&token===request){kilit(d,false);draw();hata(body.querySelector('[data-error]'),e.message);}}
 }
 return d;
}

export async function hesapAc(root,ctx,{ogrenciId,donem,onDirtyClose=()=>{}}){
 const d=pencere(root,'Öğrenci / veli ödeme hesabı','finance-account'),body=d.querySelector('.detail-body');let h,period=donem,version=0,dirty=false;
 d.addEventListener('close',()=>{if(dirty)Promise.resolve(onDirtyClose()).catch(()=>{});});
 async function load(){
  const token=++version;h=null;body.textContent='Ödeme hesabı yükleniyor…';d.setAttribute('aria-busy','true');
  try{const result=await hesapOku(ctx,ogrenciId,period);if(d._closed||token!==version)return;h=result;draw();}
  catch(e){if(!d._closed&&token===version){body.innerHTML='<p class="error" role="alert"></p><button type="button" data-retry>Yeniden dene</button>';body.querySelector('.error').textContent='Hesap okunamadı: '+e.message;body.querySelector('[data-retry]').onclick=load;}}
  finally{if(token===version)d.removeAttribute('aria-busy');}
 }
 function draw(){
  const p=h.plan,pending=h.bildirimler.filter(bekleyen),rows=p.satirlar;
  body.innerHTML=`<div class="finance-person"><h3>${esc(ogrAd(h))}</h3><p>${esc(veliAd(h))}</p><small>${esc(h.veri?.kayit?.sinif||h.ogrenci.sinif||'')} · Öğrenciye ait muhasebe hesabı</small></div><div class="toolbar"><label>Eğitim dönemi<select data-period>${[...new Set([period,...h.periods.map(x=>x.id)])].sort().reverse().map(x=>`<option ${x===period?'selected':''}>${esc(x)}</option>`).join('')}</select></label><button type="button" data-refresh>Yenile</button><button type="button" data-plan ${h.veri?'':'disabled'}>Ödeme planı / PDF</button><button type="button" data-remind-all ${h.veri?'':'disabled'}>Vadesi gelenleri hatırlat</button></div>
  ${!h.veri?'<p class="error">Bu döneme ait kayıt bulunmuyor. Başka bir kayıtlı dönem seçin.</p>':`<div class="cards">${[['Toplam plan',p.toplam],['Ödenen',p.odenen],['Kalan',p.kalan],['Vadesi geçen',p.geciken]].map(([label,value])=>`<div class="card"><small>${label}</small><strong>${para(value)}</strong></div>`).join('')}</div>`}
  <p class="muted">Onay bekleyen bildirimler ödenen toplama dahil değildir. Geçmiş dönem hesapları dönem seçiciden açılır.</p>
  <section class="section"><h3>Kontrol bekleyen bildirimler (${pending.length})</h3><div data-notes>${bildirimKartlari(pending,h.bildirimler)}</div></section>
  <section class="section"><h3>Ödeme planı ve işlemler</h3><div class="scroll"><table><thead><tr><th>Kalem / ay</th><th>Vade</th><th>Plan</th><th>Ödenen</th><th>Kalan</th><th>İşlem</th></tr></thead><tbody>${rows.map(r=>{const ns=pending.filter(b=>bildirimKalemi(b)===r.id);return `<tr><td>${esc(r.ad)}</td><td>${esc(r.vade||'Belirtilmemiş')}</td><td>${para(r.beklenen)}</td><td>${para(r.odenen)}</td><td>${para(r.kalan)}</td><td>${ns.map(b=>`<button type="button" data-review="${esc(b.id)}">Bildirimi kontrol et</button>`).join('')}${r.kalan>0?`<button type="button" data-remind="${esc(r.id)}">Hatırlat</button>`:'<span class="badge yesil">Açık borç yok</span>'}</td></tr>`;}).join('')||'<tr><td colspan="6">Ödeme planı tanımlanmamış.</td></tr>'}</tbody></table></div></section>
  <section class="section"><h3>Tahsilat ve iade hareketleri</h3><div class="scroll"><table><thead><tr><th>Kalem</th><th>Tarih</th><th>Tutar</th><th>Yöntem / işlem</th></tr></thead><tbody>${rows.flatMap(r=>{let moves=r.record.hareketler||[];if(!moves.length&&r.odenen>0)moves=[{tutar:r.odenen,tarih:r.record.odemeTarihi||'',yontem:'Eski kayıt'}];return moves.map(m=>`<tr><td>${esc(r.ad)}</td><td>${esc(m.tarih||'Tarih eksik')}</td><td>${para(m.tutar)}</td><td>${esc(m.tur||m.yontem||'Belirtilmemiş')}</td></tr>`);}).join('')||'<tr><td colspan="4">Tahsilat hareketi bulunmuyor.</td></tr>'}</tbody></table></div></section><section class="section"><h3>İşlenmiş bildirimler</h3>${bildirimKartlari(h.bildirimler.filter(b=>!bekleyen(b)),h.bildirimler)}</section><p class="error" data-error hidden role="status"></p>`;
  body.querySelector('[data-period]').onchange=e=>{period=e.target.value;load();};body.querySelector('[data-refresh]').onclick=load;
  body.querySelector('[data-plan]').onclick=()=>odemePlaniAc(d,{plan:p,student:ogrAd(h),period});
  body.querySelectorAll('[data-review]').forEach(btn=>btn.onclick=()=>odemeKontrolAc(d,ctx,{bildirim:h.bildirimler.find(b=>b.id===btn.dataset.review),donem:period,onDone:async()=>{dirty=true;await load();}}));
  body.querySelectorAll('[data-receipt]').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await dekontIndir(ctx,btn.dataset.receipt);}catch(e){hata(body.querySelector('[data-error]'),e.message);}finally{btn.disabled=false;}});
  body.querySelector('[data-remind-all]').onclick=()=>remind('');body.querySelectorAll('[data-remind]').forEach(btn=>btn.onclick=()=>remind(btn.dataset.remind));
 }
 async function remind(kalem){try{await hatirlatmaAc(d,ctx,{ogrenciId,donem:period,kalem});}catch(e){if(!d._closed)hata(body.querySelector('[data-error]'),e.message);}}
 await load();return d;
}

export async function hatirlatmaAc(root,ctx,{ogrenciId,donem,kalem=''}){
 const d=pencere(root,'Ödeme hatırlatması · Önizleme','finance-reminder'),body=d.querySelector('.detail-body');body.textContent='Güncel bakiye ve veli bilgileri kontrol ediliyor…';
 try{
  const h=await hesapOku(ctx,ogrenciId,donem),t=hatirlatmaTaslagi(h,kalem);if(d._closed)return d;
  body.innerHTML=`<p><b>${esc(t.ogrenciAd)}</b> · ${esc(donem)}</p><p>Alıcı: ${t.alicilar.map(a=>`${esc(a.ad)} &lt;${esc(a.email)}&gt;`).join(' · ')}</p><div class="card finance-mail-preview">${t.htmlContent}</div><label class="finance-confirm"><input type="checkbox" data-confirm><span>Alıcıları ve tutarları kontrol ettim; bu hatırlatmanın gönderilmesini onaylıyorum.</span></label><p data-status role="status"></p><button type="button" class="primary" data-send disabled>Hatırlatmayı gönder</button>`;
  const send=body.querySelector('[data-send]'),check=body.querySelector('[data-confirm]');let attempted=false;
  check.onchange=()=>send.disabled=attempted||!check.checked;
  send.onclick=async()=>{
   if(d._busy||attempted||!check.checked)return;attempted=true;kilit(d,true);
   try{const result=await hatirlatmaGonder(ctx,t,true);body.querySelector('[data-status]').textContent=result.logKaydedildi?'Hatırlatma gönderim servisi tarafından kabul edildi.':'Hatırlatma gönderime alındı; işlem günlüğü kaydedilemedi. Aynı mesajı tekrar göndermeyin.';}
   catch(e){body.querySelector('[data-status]').textContent=e.message;}
   finally{d._busy=false;d.querySelector('[data-close]').disabled=false;send.disabled=true;check.disabled=true;}
  };
 }catch(e){if(!d._closed){body.innerHTML='<p class="error" role="status"></p>';body.querySelector('.error').textContent=e.message;}}
 return d;
}

if(typeof document!=='undefined')css();
