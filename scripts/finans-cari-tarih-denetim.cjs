#!/usr/bin/env node
'use strict';
// Sadece okuma: Finans belgelerine yazmaz, ogrenci kimligi raporlamaz.
const {initializeApp,getApps,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const arg=(flag,def='')=>{const n=process.argv.indexOf(flag);return n>=0?process.argv[n+1]||def:def;};
const validDate=s=>{
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const year=Number(s.slice(0,4));if(year<2000||year>2100)return false;
 const d=new Date(s+'T12:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
};
const normalize=s=>String(s||'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();
(async()=>{
 const project=arg('--project','bcka-site'),period=arg('--period','2026-2027'),focus=arg('--focus','');
 if(!/^[a-zA-Z0-9._~-]+$/.test(project)||!/^\d{4}-\d{4}$/.test(period))throw Error('Proje veya donem parametresi gecersiz.');
 if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:project});
 const {odemePlani}=await import('../js/finans/core.js');
 const {aktifDonemKaydi}=await import('../js/finans/data.js');
 const db=getFirestore(),students=await db.collection('ogrenciler').get();
 const showSensitive=process.argv.includes('--show-sensitive');
 const suspect={},focused=[];let active=0,periodCount=0,checkedMovements=0;
 for(const d of students.docs){
  const ds=await db.doc('ogrenciler/'+d.id+'/donemler/'+period).get();
  if(!ds.exists)continue;periodCount++;
  const v=ds.data(),p=d.data(),isActive=aktifDonemKaydi(v,p);
  if(isActive)active++;
  const plan=odemePlani(v),name=p.ogrenciAdSoyad||p.ad||'';
  if(focus&&normalize(name).includes(normalize(focus))){
   focused.push({aktif:isActive,toplam:plan.toplam,odenen:plan.odenen,kalan:plan.kalan,acikKalemler:plan.satirlar.filter(r=>r.kalan>0).map(r=>({kod:r.id,ad:r.ad,beklenen:r.beklenen,odenen:r.odenen,kalan:r.kalan,vade:r.vade}))});
  }
  for(const r of plan.satirlar){
   const h=Array.isArray(r.record?.hareketler)&&r.record.hareketler.length?r.record.hareketler:r.odenen>0?[{tutar:r.odenen,tarih:r.record?.odemeTarihi||'',eskiKayit:true}]:[];
   for(const m of h){
    checkedMovements++;
    const date=m.tarih||'';
    if(validDate(date))continue;
    const label=String(date||'(bos)');
    const key=label+' | '+r.id;
    if(!suspect[key])suspect[key]={tarih:label,kalem:r.id,hareketSayisi:0,toplamTutar:0,eskiKayitSayisi:0,...(showSensitive?{ogrenciKayitlari:[]}:{} )};
    if(showSensitive&&!suspect[key].ogrenciKayitlari.some(x=>x.id===d.id))suspect[key].ogrenciKayitlari.push({id:d.id,ad:name,aktif:isActive});
    suspect[key].hareketSayisi++;
    suspect[key].toplamTutar=Math.round((suspect[key].toplamTutar+(Number(m.tutar)||0))*100)/100;
    if(m.eskiKayit)suspect[key].eskiKayitSayisi++;
   }
  }
 }
 console.log(JSON.stringify({kontrol:'SALT_OKUNUR_CARI_VE_TARIH_DENETIMI',project,period,ogrenciBelgesi:students.size,donemKaydi:periodCount,aktifKayit:active,incelenenHareket:checkedMovements,odakEslesme:focused.length,odak:focused,supheliHareketler:Object.values(suspect)},null,2));
})().catch(e=>{console.error('KONTROL DURDU: '+e.message);process.exitCode=1;});
