#!/usr/bin/env node
'use strict';
// Sadece okuma: Firestore öğrenci veya finans verilerini değiştirmez.
const params=args=>{
 const a={};for(let i=0;i<args.length;i++){
  if(!args[i].startsWith('--')||!args[i+1]||args[i+1].startsWith('--'))throw Error('Parametre eksik: '+args[i]);
  a[args[i].slice(2)]=args[++i];
 }return a;
};
function limitMap(items,fn,n=6){
 let next=0;const arr=Array(items.length);
 return Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;arr[i]=await fn(items[i],i);}})).then(()=>arr);
}
const normalize=s=>String(s||'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();
(async()=>{
 const a=params(process.argv.slice(2));
 if(!/^[A-Za-z0-9._~-]+$/.test(a.project||''))throw Error('Firebase proje ID gerekli: --project ...');
 if(!/^\d{4}-\d{4}$/.test(a.period||''))throw Error('Dönem --period 2026-2027 olmalı.');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(a.month||''))throw Error('Kontrol ayı --month 2026-10 olmalı.');
 let admin;try{admin=require('firebase-admin');}catch{throw Error('firebase-admin modülünü kuruluma ekleyin: npm install --no-save firebase-admin');}
 if(!admin.apps.length)admin.initializeApp({credential:admin.credential.applicationDefault(),projectId:a.project});
 const {okulFinansOzeti,sonAyKodlari}=await import('../js/finans/school-summary.js');
 const {aktifDonemKaydi}=await import('../js/finans/data.js');
 const {odemePlani}=await import('../js/finans/core.js');
 const db=admin.firestore();
 const students=await db.collection('ogrenciler').get();
 const docs=await limitMap(students.docs,async d=>{
  const snap=await db.doc('ogrenciler/'+d.id+'/donemler/'+a.period).get();
  return snap.exists ? {id:d.id,profil:d.data(),veri:snap.data()} : null;
 });
 const donemDocs=docs.filter(Boolean);
 const active=donemDocs.filter(o=>aktifDonemKaydi(o.veri,o.profil));
 const past=donemDocs.filter(o=>!aktifDonemKaydi(o.veri,o.profil));
 const now=new Date();
 const finansAktif=okulFinansOzeti(active,now);
 const finansDonem=okulFinansOzeti(donemDocs,now);
 const months=[...new Set([...sonAyKodlari(a.month,7),
  ...Object.keys(finansAktif.aidatBeklenen),...Object.keys(finansAktif.aidatOdenen),
  ...Object.keys(finansAktif.nakitAylar)])].sort();
 const money=n=>Math.round((n||0)*100)/100;
 const sliceMonth=(o)=>o.nakitAylar[a.month]||0;
 const paymentCount=o=>o.hareketler.filter(m=>m.nakitAy===a.month).length;
 const warnings=[];
 for(const o of donemDocs){
  const p=odemePlani(o.veri,now);
  for(const w of p.uyarilar||[])warnings.push({ogrenciId:o.id,tur:'bakiye_uyusmazligi',aciklama:w});
  for(const r of p.satirlar){
   if(r.odenen>0 && !r.record?.hareketler?.length && !r.record?.odemeTarihi)
    warnings.push({ogrenciId:o.id,kalem:r.id,tur:'tahsilat_tarihi_eksik'});
   if(r.record?.hareketler?.some(m=>m.tutar&&(!m.tarih||!/^\d{4}-\d{2}-\d{2}$/.test(m.tarih))))
    warnings.push({ogrenciId:o.id,kalem:r.id,tur:'tarihsiz_hareket'});
  }
 }
 const focus=(a.focus||'').trim();
 const matches=focus?donemDocs.filter(o=>normalize(o.profil.ogrenciAdSoyad||o.profil.ad).includes(normalize(focus))):[];
 const candidates=matches.map(o=>{
  const p=odemePlani(o.veri,now);
  return {ogrenciId:o.id,ogrenciAd:o.profil.ogrenciAdSoyad||o.profil.ad||'',aktif:aktifDonemKaydi(o.veri,o.profil),
    donemBeklenen:p.toplam,donemOdenen:p.odenen,donemKalan:p.kalan,
    odemeler:p.satirlar.filter(r=>r.odenen>0).map(r=>({ayKalem:r.id,beklenen:r.beklenen,odenen:r.odenen,tarih:r.record.odemeTarihi||'',kaynakTahsilatId:r.record.kaynakTahsilatId||''}))};
 });
 const out={
  kontrol:'SALT_OKUNUR_FIRESTORE_MUTABAKATI',project:a.project,period:a.period,ay:a.month,
  counts:{ogrenciBelgesi:students.size,buDonemde:donemDocs.length,aktif:active.length,aktifOlmayan:past.length},
  selectedMonth:{
   aktifAylikAidatPlan:finansAktif.aidatBeklenen[a.month]||0,
   aktifAylikAidataIslenen:finansAktif.aidatOdenen[a.month]||0,
   aktifNetNakitTahsilat:money(sliceMonth(finansAktif)),
   tumDonemNetNakitTahsilat:money(sliceMonth(finansDonem)),
   aktifNakitHareketSatiri:paymentCount(finansAktif),
   tumDonemNakitHareketSatiri:paymentCount(finansDonem)
  },
  periodTotals:{
   aktifBeklenen:finansAktif.toplamBeklenen,
   aktifOdenen:finansAktif.toplamOdenen,
   aktifKalan:finansAktif.toplamKalan,
   aktifGeciken:finansAktif.gecikenTutar,
   tumDonemOdenen:finansDonem.toplamOdenen,
   aktifTarihsizTahsilat:finansAktif.tarihsizTahsilat
  },
  months:months.map(m=>({ay:m,plan:finansAktif.aidatBeklenen[m]||0,
    aidataIslenen:finansAktif.aidatOdenen[m]||0,
    nakitAktif:finansAktif.nakitAylar[m]||0,nakitTumDonem:finansDonem.nakitAylar[m]||0})),
  uyariSayisi:warnings.length,uyarilar:warnings.slice(0,50),
  ...(focus?{arananOgrenci:focus,eslesenOgrenci:matches.length,eslesenKayitlar:candidates}:{})
 };
 console.log(JSON.stringify(out,null,2));
 if(warnings.length>50)console.error(warnings.length-50+' uyarı daha var. Bu çıktı ilk 50 tanesini gösterir.');
})().catch(e=>{console.error('KONTROL DURDU: '+e.message);process.exitCode=1;});
