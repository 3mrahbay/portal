import {odemePlani,tahsilatUygula,bildirimKalemi,kurus,bugun,para,esc} from './core.js';

export const bekleyen = b => ['bekliyor','beklemede'].includes(b?.durum);
export function gecerliDonem(s){return typeof s==='string'&&/^\d{4}-\d{4}$/.test(s)&&Number(s.slice(5))===Number(s.slice(0,4))+1;}
function kimlik(s){if(typeof s!=='string'||!s.trim()||s.includes('/')||s.length>500)throw Error('Kayıt kimliği geçersiz.');return s;}
// The approval form signs only the values the operator actually reviewed.
export function bildirimImzasi(b){return JSON.stringify([b.ogrenciId,b.donem||'',bildirimKalemi(b),Number(b.bildirilenTutar??b.tutar),b.odemeTarihi||'',b.veliEmail||'',b.odemeYontemi||b.yontem||'',b.not||'']);}
export const planSatiriImzasi = r => r ? JSON.stringify([r.id,r.beklenen,r.odenen,r.kalan,r.vade]) : '';
export async function hesapOku({fb,db},ogrenciId,donem){
 kimlik(ogrenciId);if(!gecerliDonem(donem))throw Error('Geçerli bir eğitim dönemi seçin.');
 const [o,ds,ns]=await Promise.all([
  fb.getDoc(fb.doc(db,'ogrenciler',ogrenciId)),
  fb.getDocs(fb.collection(db,'ogrenciler',ogrenciId,'donemler')),
  fb.getDocs(fb.query(fb.collection(db,'odemeBildirimleri'),fb.where('ogrenciId','==',ogrenciId)))
 ]);
 if(!o.exists())throw Error('Öğrenci kaydı bulunamadı.');
 const periods=ds.docs.filter(d=>gecerliDonem(d.id)).map(d=>({id:d.id,veri:d.data()})).sort((a,b)=>b.id.localeCompare(a.id));
 const veri=periods.find(p=>p.id===donem)?.veri||null;
 const notes=ns.docs.map(d=>({...d.data(),id:d.id})).filter(b=>b.ogrenciId===ogrenciId&&(b.donem===donem||!b.donem));
 return {id:ogrenciId,ogrenci:o.data(),donem,periods,veri,plan:odemePlani(veri),bildirimler:notes};
}
export async function bildirimiIsle({fb,db,email},{id,ogrenciId,donem,donemDogrulandi=false,imza,planImza,sonuc='onayli'}){
 kimlik(id);kimlik(ogrenciId);if(!email||!imza)throw Error('Oturum ve kontrol bilgisi gerekli.');
 if(!['onayli','ret'].includes(sonuc))throw Error('Geçersiz işlem.');
 return fb.runTransaction(db,async tx=>{
  const nr=fb.doc(db,'odemeBildirimleri',id),ns=await tx.get(nr);
  if(!ns.exists())throw Error('Bildirim bulunamadı.');
  const b=ns.data();
  if(b.ogrenciId!==ogrenciId||bildirimImzasi(b)!==imza)throw Error('Bildirim siz kontrol ederken değişmiş. Yenileyip tekrar kontrol edin.');
  if(!bekleyen(b)||b.tahsilatIslendi===true)throw Error('Bildirim daha önce işlenmiş. Listeyi yenileyin.');
  const auditRef=fb.doc(db,'odemeler','bildirim_'+id),audit=await tx.get(auditRef);
  if(audit.exists())throw Error('Bu bildirimin tahsilat kaydı zaten var. Yeniden işlem yapılmadı.');
  // Rejection never needs an invented period and never changes a balance.
  if(sonuc==='ret'){tx.update(nr,{durum:'reddedildi',onaylayan:'Muhasebe',onayZamani:fb.serverTimestamp()});return {sonuc:'ret'};}
  if(!gecerliDonem(donem))throw Error('Öğrencinin kayıtlı eğitim dönemini seçin.');
  if(b.donem&&b.donem!==donem)throw Error('Bildirimin kayıtlı dönemi farklı; başka döneme işlenemez.');
  if(!b.donem&&donemDogrulandi!==true)throw Error('Dönemi ve ödeme kalemini kontrol ettiğinizi işaretleyin.');
  const dr=fb.doc(db,'ogrenciler',ogrenciId,'donemler',donem),ds=await tx.get(dr);
  if(!ds.exists())throw Error('Öğrencinin seçili dönemde ödeme planı bulunamadı.');
  const veri=ds.data(),p=odemePlani(veri);
  const currentRow=p.satirlar.find(r=>r.id===bildirimKalemi(b));
  if(!currentRow||!planImza||planSatiriImzasi(currentRow)!==planImza)throw Error('Ödeme planı veya bakiye değişmiş. Hesabı yenileyip tekrar kontrol edin.');
  if(p.satirlar.some(r=>(r.record.hareketler||[]).some(h=>h.id===id)))throw Error('Bu bildirim ödeme hareketlerine daha önce işlenmiş.');
  const u=tahsilatUygula(veri,{...b,donem},id,email);
  // All reads precede writes. Period repair, payment and audit are atomic.
  tx.update(dr,{[u.field]:u.values});
  tx.set(auditRef,{tur:'tahsilat_onayi',bildirimId:id,ogrenciId,donem,kalem:bildirimKalemi(b),tutar:Number(b.bildirilenTutar??b.tutar),odemeTarihi:b.odemeTarihi,onaylayan:email,olusturuldu:fb.serverTimestamp(),...(!b.donem?{donemDogrulandi:true,donemDogrulamaKaynagi:'muhasebe_acik_onay'}:{})});
  tx.update(nr,{durum:'onaylandi',tahsilatIslendi:true,donem,onaylayan:'Muhasebe',onayZamani:fb.serverTimestamp()});
  return {sonuc:'onayli',donem};
 });
}
export function veliAlicilari(veri){
 const result=new Map();
 for(const key of ['anne','baba','veli','vasi']){
  const p=veri?.[key]||{},email=String(p.eposta||p.email||'').trim().toLowerCase();
  if(/^[^\s<>;,]+@[^\s<>;,]+\.[^\s<>;,]+$/.test(email))result.set(email,{email,ad:p.adSoyad||'Değerli velimiz'});
 }
 return [...result.values()];
}
export function hatirlatmaTaslagi(hesap,kalem='',now=new Date()){
 if(!hesap.veri)throw Error('Ödeme planı bulunamadı.');
 const p=odemePlani(hesap.veri,now),today=bugun(now);
 const rows=p.satirlar.filter(r=>r.kalan>0&&(kalem?r.id===kalem:!!r.vade&&r.vade<=today));
 if(!rows.length)throw Error(kalem?'Bu kalemde açık borç yok.':'Vadesi gelmiş açık ödeme bulunmuyor. Gelecek vadeler için kalem satırını kullanın.');
 const keys=new Set(rows.map(r=>r.id));
 if(hesap.bildirimler.some(b=>bekleyen(b)&&(!b.donem||keys.has(bildirimKalemi(b))||!p.satirlar.some(r=>r.id===bildirimKalemi(b)))))throw Error('Önce velinin bekleyen ödeme bildirimini kontrol edin. Hatırlatma hazırlanmadı.');
 const alicilar=veliAlicilari(hesap.veri);if(!alicilar.length)throw Error('Bu dönem kaydında geçerli veli e-posta adresi bulunmuyor.');
 const ad=hesap.ogrenci.ogrenciAdSoyad||hesap.ogrenci.adSoyad||hesap.ogrenci.ad||'Öğrenci';
 const toplam=rows.reduce((s,r)=>s+kurus(r.kalan),0)/100;
 const subject=`Ödeme hatırlatması · ${ad} · ${hesap.donem}`;
 const htmlContent=`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#20382a"><h2>Bir Çiçek Koleji · Ödeme bilgilendirmesi</h2><p>Değerli velimiz,</p><p>${esc(ad)} için ${esc(hesap.donem)} dönemine ait aşağıdaki ödeme kalemleri kayıtlarımızda açık görünmektedir.</p><ul>${rows.map(r=>`<li>${esc(r.ad)}: ${para(r.kalan)}${r.vade?' · Vade: '+esc(r.vade):''}</li>`).join('')}</ul><p>Bu hatırlatmaya konu kalan tutar: <b>${para(toplam)}</b>.</p><p>Ödemenizi yaptıysanız Portal veya Zeky üzerinden ödeme bildirimi iletebilirsiniz. Bilgi farklılığı varsa bizimle iletişime geçmenizi rica ederiz.</p><p>İlginiz için teşekkür ederiz.<br>Bir Çiçek Koleji Anaokulu</p></div>`;
 const imza=JSON.stringify([hesap.id,hesap.donem,alicilar,rows.map(r=>[r.id,r.beklenen,r.odenen,r.kalan,r.vade])]);
 return {ogrenciId:hesap.id,ogrenciAd:ad,donem:hesap.donem,kalem,alicilar,rows,toplam,subject,htmlContent,imza};
}
// Uses the school's existing mail proxy; no provider API key is shipped.
export async function okulMailGonder(opts){
 const response=await fetch('https://script.google.com/macros/s/AKfycbwUNvVhTCvxUKOMtbFJ4_UASBo8-sgT13qT_9tWeYKZR3IYaYKUhGdSaGgGaaqMaZLf/exec',{
  method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},
  body:JSON.stringify({origin:globalThis.location?.hostname||'',...opts,replyTo:'eposta@bircicekkoleji.com',senderName:'Bir Çiçek Koleji Anaokulu',senderEmail:'eposta@bircicekkoleji.com'})
 });
 if(!response.ok)throw Error('Gönderim sonucu doğrulanamadı. Yeniden göndermeden önce gönderim kayıtlarını kontrol edin.');
 return response.json();
}
export async function hatirlatmaGonder(ctx,taslak,onay){
 if(onay!==true)throw Error('Alıcıları ve içeriği kontrol ederek gönderimi onaylayın.');
 if(!ctx.email)throw Error('Oturum bilgisi gerekli.');
 const latest=await hesapOku(ctx,taslak.ogrenciId,taslak.donem),fresh=hatirlatmaTaslagi(latest,taslak.kalem);
 if(fresh.imza!==taslak.imza)throw Error('Bakiye veya veli bilgisi değişti. Güncel önizlemeyi açın.');
 let result;
 try{result=await (ctx.brevoMail||okulMailGonder)({to:fresh.alicilar.map(a=>a.email).join(','),toName:fresh.alicilar.map(a=>a.ad).join(' & '),subject:fresh.subject,htmlContent:fresh.htmlContent});}
 catch(_){throw Error('Gönderim sonucu doğrulanamadı. Aynı mesajı yeniden göndermeden önce gönderim kayıtlarını kontrol edin.');}
 if(!result?.success)throw Error(result?.error||'Gönderim servisi işlemi onaylamadı. Tekrar göndermeden önce kayıtları kontrol edin.');
 let logKaydedildi=true;
 try{await ctx.fb.addDoc(ctx.fb.collection(ctx.db,'mailLoglari'),{ogrenciId:fresh.ogrenciId,ogrenciAd:fresh.ogrenciAd,donem:fresh.donem,tur:'hatirlatma',gonderimTuru:'muhasebe_hesap',aliciMailler:fresh.alicilar.map(a=>a.email),aliciAdlari:fresh.alicilar.map(a=>a.ad),toplamBorc:fresh.toplam,kalemler:fresh.rows.map(r=>r.id),gonderen:ctx.email,gonderildiTarih:new Date().toISOString(),messageId:result.messageId||''});}catch(_){logKaydedildi=false;}
 return {success:true,logKaydedildi};
}
