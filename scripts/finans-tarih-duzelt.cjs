#!/usr/bin/env node
'use strict';
// Firestore admin-only, dry-run by default. Requires ADC + firebase-admin.
const readArgs=argv=>{
 const args={};for(let i=0;i<argv.length;i++){
  const k=argv[i];if(k==='--apply'){args.apply=true;continue;}
  if(!k.startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Eksik parametre: '+k);
  args[k.slice(2)]=argv[++i];
 }return args;
};
(async()=>{
 const a=readArgs(process.argv.slice(2));
 const fields=['project','student-id','period','from','to','start-month','count','monthly','total','bank-ref'];
 for(const key of fields)if(!a[key])throw Error('Gerekli parametre eksik: --'+key);
 if(!/^[A-Za-z0-9._~-]+$/.test(a.project)||!/^[A-Za-z0-9_-]+$/.test(a['student-id'])||!/^[0-9]{4}-[0-9]{4}$/.test(a.period))throw Error('Proje, öğrenci veya dönem kodu geçersiz.');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(a['start-month']))throw Error('Başlangıç ayı geçersiz.');
 const count=Number(a.count);
 if(!Number.isInteger(count)||count<1||count>36)throw Error('Ay sayısı geçersiz.');
 const [y,m]=a['start-month'].split('-').map(Number);
 const aylar=Array.from({length:count},(_,i)=>new Date(Date.UTC(y,m-1+i,1)).toISOString().slice(0,7));
 const opts={aylar,eskiTarih:a.from,yeniTarih:a.to,aylikTutar:Number(a.monthly),toplamTutar:Number(a.total),bankaReferans:a['bank-ref']};
 const {planlaTahsilatTarihDuzeltmesi}=await import('../js/finans/date-correction.js');
 let admin;
 try{admin=require('firebase-admin');}catch(e){throw Error('firebase-admin gerekli. Korumalı Cloud Shell ortamında npm install --no-save firebase-admin çalıştırın.');}
 if(!admin.apps.length)admin.initializeApp({credential:admin.credential.applicationDefault(),projectId:a.project});
 const db=admin.firestore(),id=a['student-id'];
 const docRef=db.doc('ogrenciler/'+id+'/donemler/'+a.period);
 const auditId='tarih_'+a['bank-ref'];
 const audit=db.doc('finansTarihDuzeltmeleri/'+auditId);
 if(!a.apply){
  const [d,already]=await Promise.all([docRef.get(),audit.get()]);
  if(already.exists)throw Error('Daha önce aynı banka referansıyla işlem yapılmış.');
  if(!d.exists)throw Error('Dönem dokümanı bulunamadı.');
  const result=planlaTahsilatTarihDuzeltmesi(d.data(),opts);
  console.log(JSON.stringify({durum:'DRY_RUN_YAZMA_YOK',proje:a.project,donem:a.period,ogrenciId:id,
   aylar,eskiTarih:result.eskiTarih,yeniTarih:result.yeniTarih,tutar:result.tutar,aySayisi:result.aySayisi,
   hareketTarihleri:result.degisiklikler,bankaReferansi:result.referans},null,2));
  console.log('Kaydetmek için aynı komuta --apply eklenmelidir.');
  return;
 }
 const done=await db.runTransaction(async tx=>{
  const [d,already]=await Promise.all([tx.get(docRef),tx.get(audit)]);
  if(!d.exists)throw Error('Dönem kaydı bulunamadı.');
  if(already.exists)throw Error('Bu banka referansı için düzeltme önceden yapıldı.');
  const result=planlaTahsilatTarihDuzeltmesi(d.data(),opts);
  tx.update(docRef,{aylikOdemeler:result.yeniAylikOdemeler});
  tx.create(audit,{tur:'gecmis_tahsilat_tarihi_duzeltmesi',donem:a.period,ogrenciId:id,
   onceki:result.eskiKayitlar,yeniTarih:result.yeniTarih,eskiTarih:result.eskiTarih,aylar,
   bankaReferansi:result.referans,tutar:result.tutar,
   not:'Toplu banka havalesi tek tahsilattır, on aylık aidata mahsup edilmiştir.',
   olusturuldu:admin.firestore.FieldValue.serverTimestamp()});
  return {durum:'UYGULANDI',donem:a.period,ogrenciId:id,aySayisi:result.aySayisi,tutar:result.tutar,eskiTarih:result.eskiTarih,yeniTarih:result.yeniTarih,denetimKaydi:audit.path};
 });
 console.log(JSON.stringify(done,null,2));
})().catch(err=>{console.error('DURDURULDU:',err.message);process.exitCode=1;});
