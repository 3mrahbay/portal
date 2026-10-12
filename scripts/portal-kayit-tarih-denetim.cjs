#!/usr/bin/env node
'use strict';
// Salt-okunur: Kayit ve tarih alanlarini anonim ozetler, yazma yapmaz.
const {initializeApp,getApps,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const option=(k,d='')=>{const i=process.argv.indexOf(k);return i<0?d:String(process.argv[i+1]||'');};
const project=option('--project','bcka-site');
const period=option('--period','2026-2027');
const focus=option('--focus','');
const lower=s=>String(s||'').toLocaleLowerCase('tr-TR').trim().replace(/\s+/g,' ');
(async()=>{
 if(!focus.trim())throw Error('Ogrenci adi icin --focus gerekli.');
 if(!/^[\w.-]+$/.test(project) || !/^\d{4}-\d{4}$/.test(period))throw Error('Proje veya donem gecersiz.');
 if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:project});
 const db=getFirestore(),list=await db.collection('ogrenciler').get();
 const matches=list.docs.filter(d=>lower(d.data().ogrenciAdSoyad||d.data().ad)===lower(focus));
 const result=[];
 for(const d of matches){
  const snap=await db.doc('ogrenciler/'+d.id+'/donemler/'+period).get();
  const v=snap.exists?snap.data():{};
  const kayit=v.kayit||{},root=d.data();
  result.push({
   donemBelgesi:snap.exists,
   kayitAlaniVar:!!v.kayit,
   ilkKayitTarihiDonem:kayit.ilkKayitTarihi||'',
   ilkKayitTarihiAna:root.okulaKayitTarihi||'',
   donemBaslangic:kayit.donemBaslangic||'',
   sinifDolu:!!kayit.sinif,programDolu:!!kayit.program,
   oncekiOkulDolu:!!kayit.oncekiOkul,
   servisAlaniVar:Object.hasOwn(kayit,'servisKullanim'),
   kaynakAlaniVar:Object.hasOwn(kayit,'kaynak')
  });
 }
 console.log(JSON.stringify({kontrol:'SALT_OKUNUR_KAYIT_ALANI',period,eslesme:matches.length,kayitlar:result},null,2));
})().catch(e=>{console.error('DENETIM DURDU: '+e.message);process.exitCode=1;});
