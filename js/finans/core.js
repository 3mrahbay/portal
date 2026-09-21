// Portal and ZEKY share this exact module. Money is calculated in integer kuruş.
export const AY = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
export const KALEM = {egitimMateryali:'Kırtasiye',okulKiyafeti:'Okul kıyafeti',ormanKiyafeti:'Orman kıyafeti',servis1:'Servis · I. dönem',servis2:'Servis · II. dönem',yemek:'Yemek',kirtasiye:'Kırtasiye',kiyafet:'Kıyafet'};
export const kurus = v => Math.round((Number.isFinite(Number(v)) ? Number(v) : 0)*100);
export const para = v => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(v)||0);
export const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bugun(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function vade(ayKod,record={},ayar={}){
  const explicit=record.sonOdemeTarihi||record.vadeTarihi;
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit||'')) return explicit;
  if (!/^\d{4}-\d{2}$/.test(ayKod)) return '';
  const [y,m]=ayKod.split('-').map(Number);
  // Existing portal grace policy is retained until a due day is configured.
  const gun=Number(ayar.sonOdemeGunu||ayar.odemeGunu);
  return gun>0 ? `${ayKod}-${String(Math.min(gun,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}` : new Date(Date.UTC(y,m,15)).toISOString().slice(0,10);
}
export function satir(id,ad,beklenen,record={},sonTarih='',now=new Date()){
  const b=Math.max(0,kurus(beklenen));
  const explicit=record.odenenTutar!==undefined && record.odenenTutar!==null;
  const o=Math.max(0,explicit ? kurus(record.odenenTutar) : record.odendi===true ? b : 0);
  const k=Math.max(0,b-o), gecikmis=k>0 && !!sonTarih && sonTarih<bugun(now);
  const durum=b===0?'tanimsiz':k===0?'odendi':o>0?'kismi':gecikmis?'gecikmis':'bekliyor';
  return {id,ad,beklenen:b/100,odenen:o/100,kalan:k/100,fazla:Math.max(0,o-b)/100,durum,gecikmis,vade:sonTarih,record};
}
export function odemePlani(veri,now=new Date()){
  if(!veri) return {satirlar:[],toplam:0,odenen:0,kalan:0,fazla:0,geciken:0,plansiz:true};
  const a=veri.aidatAyarlari||{}, od=veri.aylikOdemeler||{}, rows=[];
  if(Number(a.onOdeme)>0) rows.push(satir('__onOdeme','Kayıt ön ödemesi',a.onOdeme,od.__onOdeme,a.onOdemeTarihi||'',now));
  const n=Number(a.gercekAySayisi||a.taksitSayisi);
  if(/^\d{4}-(0[1-9]|1[0-2])$/.test(a.baslangicAyi||'') && Number.isInteger(n) && n>0 && n<=36){
    const [y,m]=a.baslangicAyi.split('-').map(Number);
    for(let i=0;i<n;i++){
      const d=new Date(Date.UTC(y,m-1+i,1)), mm=d.getUTCMonth()+1, code=d.toISOString().slice(0,7), r=od[code]||{};
      const expected=r.beklenenTutar ?? ((mm>=9||mm<=1)?(a.iDonemAylik??a.aylikAidat):(a.iiDonemAylik??a.aylikAidat));
      rows.push(satir(code,`${AY[mm-1]} ${d.getUTCFullYear()}`,expected,r,vade(code,r,a),now));
    }
  }
  const ek=veri.digerOdemeler||a.digerOdemeler||{};
  for(const [key,r] of Object.entries(ek)) rows.push(satir('diger-'+key,KALEM[key]||key,r.tutar,r,vade('',r,a),now));
  const uyarilar=rows.flatMap(r=>{const notes=[];if(r.record.hareketler?.length&&r.record.hareketler.reduce((s,h)=>s+kurus(h.tutar),0)!==kurus(r.odenen))notes.push(r.ad+': hareket toplamı ile ödenen tutar uyuşmuyor.');if(r.record.odendi===true&&r.kalan>0)notes.push(r.ad+': ödendi işareti ile kalan tutar uyuşmuyor.');return notes;});
  const sum=k=>rows.reduce((s,r)=>s+kurus(r[k]),0)/100;
  return {uyarilar,satirlar:rows,toplam:sum('beklenen'),odenen:sum('odenen'),kalan:sum('kalan'),fazla:sum('fazla'),geciken:rows.filter(r=>r.gecikmis).reduce((s,r)=>s+kurus(r.kalan),0)/100,plansiz:rows.length===0};
}
export function kartOzeti(veri,now=new Date()){
  const p=odemePlani(veri,now), ay=bugun(now).slice(0,7), open=p.satirlar.filter(r=>r.kalan>0);
  const older=open.find(r=>r.gecikmis || r.id==='__onOdeme' || (/^\d{4}-\d{2}$/.test(r.id)&&r.id<ay));
  const r=older||p.satirlar.find(r=>r.id===ay)||open[0];
  const gecikmis=p.geciken>0;
  return {...p,secilen:r,renk:gecikmis?'turuncu':r?.durum==='odendi'?'yesil':'normal',baslik:p.plansiz?'Ödeme planı henüz oluşturulmadı':r?`${r.ad} · ${r.durum==='odendi'?'Ödendi':r.durum==='kismi'?'Kısmen ödendi':r.gecikmis?'Ödemesi gecikti':'Ödemesi bekleniyor'}`:'Ödemeler tamamlandı',ekler:p.satirlar.filter(r=>r.id.startsWith('diger-'))};
}
export function sirala(rows,key,yon='asc'){
  const collator=new Intl.Collator('tr',{numeric:true,sensitivity:'base'});
  return [...rows].sort((a,b)=>{const x=a[key],y=b[key];if(x==null)return y==null?0:1;if(y==null)return -1;return (typeof x==='number'&&typeof y==='number'?x-y:collator.compare(String(x),String(y)))*(yon==='desc'?-1:1);});
}
export function basabas({sabit,degisken,ogrenci,aylikGelir,kapasite}){
  if(![sabit,degisken,ogrenci,aylikGelir].every(Number.isFinite)||ogrenci<=0||aylikGelir<=0) return {hazir:false,neden:'Öğrenci, gelir ve sınıflandırılmış gider verisi gerekli.'};
  const katki=(aylikGelir-degisken)/ogrenci;
  if(katki<=0) return {hazir:false,neden:'Öğrenci başına katkı sıfır veya negatif; bu ücret ve giderlerle başabaş oluşmuyor.'};
  const adet=Math.ceil(sabit/katki);
  return {hazir:true,adet,katki,net:aylikGelir-sabit-degisken,kapasiteAsimi:Number.isFinite(kapasite)&&adet>kapasite};
}
export function bildirimKalemi(b){return b.kalemTipi==='onOdeme'?'__onOdeme':b.kalemTipi?.startsWith('aidat-')?b.kalemTipi.slice(6):b.kalemTipi?.startsWith('diger-')?b.kalemTipi:b.ayKod||b.kalemTipi;}
export function tahsilatUygula(veri,b,id,email,now=new Date()){
  if(!['bekliyor','beklemede'].includes(b.durum)) throw Error('Bu bildirim daha önce işlenmiş.');
  const key=bildirimKalemi(b),p=odemePlani(veri,now),r=p.satirlar.find(x=>x.id===key);
  if(!r) throw Error('Ödeme kalemi planla eşleşmiyor. Dönem ve kalemi kontrol edin.');
  if(r.record.hareketler?.length&&r.record.hareketler.reduce((s,h)=>s+kurus(h.tutar),0)!==kurus(r.odenen))throw Error('Hareket toplamı ile bakiye uyuşmuyor; önce mutabakat gerekli.');
  const amount=kurus(b.bildirilenTutar??b.tutar);
  if(amount<=0||amount>kurus(r.kalan)) throw Error('Bildirilen tutar kalan borcu aşıyor veya geçersiz.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.odemeTarihi||'')) throw Error('Ödeme tarihi gerekli.');
  const updated=structuredClone(veri),isEk=key.startsWith('diger-'),field=isEk?'digerOdemeler':'aylikOdemeler',rid=isEk?key.slice(6):key;
  updated[field]=updated[field]||(isEk?structuredClone(veri.aidatAyarlari?.digerOdemeler||{}):{});
  const record={...r.record},movements=[...(record.hareketler||[])];
  if(!movements.length&&r.odenen>0) movements.push({id:'devir',tutar:r.odenen,tarih:record.odemeTarihi||'',yontem:record.odemeYontemi||record.yontem||'',eskiKayit:true});
  movements.push({id,tutar:amount/100,tarih:b.odemeTarihi,yontem:b.odemeYontemi||b.yontem||'diger',zaman:now.toISOString()});
  updated[field][rid]={...record,odenenTutar:(kurus(r.odenen)+amount)/100,odendi:kurus(r.odenen)+amount>=kurus(r.beklenen),odemeTarihi:b.odemeTarihi,hareketler:movements,...(!isEk?{beklenenTutar:r.beklenen}:{})};
  return {field,values:updated[field],plan:odemePlani(updated,now)};
}
export async function bildirimOnayla({fb,db,id,email,donem,sonuc='onayli'}){
  const ref=fb.doc(db,'odemeBildirimleri',id);
  return fb.runTransaction(db,async tx=>{
    const snap=await tx.get(ref);if(!snap.exists())throw Error('Bildirim bulunamadı.');
    const b=snap.data();
    if(['onayli','onaylandi','ret','reddedildi'].includes(b.durum))throw Error('Bildirim zaten işlenmiş.');
    const period=b.donem;
    if(!period||!b.ogrenciId)throw Error('Dönem ve öğrenci bilgisi gerekli.');
    if(sonuc==='ret'){tx.update(ref,{durum:'reddedildi',onaylayan:'Muhasebe',onayZamani:fb.serverTimestamp()});return;}
    const dr=fb.doc(db,'ogrenciler',b.ogrenciId,'donemler',period),ds=await tx.get(dr);
    if(!ds.exists())throw Error('Öğrencinin dönem ödeme planı bulunamadı.');
    const u=tahsilatUygula(ds.data(),b,id,email);
    tx.update(dr,{[u.field]:u.values});
    tx.set(fb.doc(db,'odemeler','bildirim_'+id),{tur:'tahsilat_onayi',bildirimId:id,ogrenciId:b.ogrenciId,donem:period,kalem:bildirimKalemi(b),tutar:Number(b.bildirilenTutar??b.tutar),odemeTarihi:b.odemeTarihi,onaylayan:email,olusturuldu:fb.serverTimestamp()});
    tx.update(ref,{durum:'onaylandi',tahsilatIslendi:true,donem:period,onaylayan:'Muhasebe',onayZamani:fb.serverTimestamp()});
  });
}
