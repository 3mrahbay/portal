#!/usr/bin/env node
'use strict';
// SADECE Mustafa Giray Macit'in dogrulanmis 37.000 TL on odeme TARIHINI duzeltir.
// Varsayilan ONIZLEME; yazma icin --apply --confirm-2026-08-10 gerekir.
// Gercek tahsilati, odeme tutarini, yillik aidati veya baska kalemleri SILMEZ.
const fs=require('node:fs');
const path=require('node:path');
const {initializeApp,getApps,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');

const PROJECT='bcka-site',PERIOD='2026-2027',STUDENT='TrGASITwumtHdLp8iZKu';
const BEFORE_DATE='0006-08-10',AFTER_DATE='2026-08-10',AMOUNT=37000;
const APPLY=process.argv.includes('--apply');
const ACK=process.argv.includes('--confirm-2026-08-10');
const REF_PATH='ogrenciler/'+STUDENT+'/donemler/'+PERIOD;
const normalize=s=>String(s||'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();

(async()=>{
 if(APPLY&&!ACK)throw Error('Yazma icin --apply --confirm-2026-08-10 birlikte gerekli.');
 if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:PROJECT});
 const db=getFirestore(),ref=db.doc(REF_PATH);
 const [profileSnap,snap]=await Promise.all([db.doc('ogrenciler/'+STUDENT).get(),ref.get()]);
 const p=normalize(profileSnap.data()?.ogrenciAdSoyad||profileSnap.data()?.ad);
 if(p!=='mustafa giray macit')throw Error('Ogrenci adi beklenenden farkli; islem durdu.');
 if(!snap.exists)throw Error('Donem belgesi bulunamadi.');
 const {odemePlani}=await import('../js/finans/core.js');
 const validate=v=>{
  const pre=v?.aylikOdemeler?.__onOdeme||{};
  const row=odemePlani(v).satirlar.find(r=>r.id==='__onOdeme');
  if(!row||row.beklenen!==AMOUNT||row.odenen!==AMOUNT)
   throw Error('On odeme miktari beklenenden farkli; islem durdu.');
  if(pre.odemeTarihi!==BEFORE_DATE)throw Error('Eski tarih beklenenden farkli; islem durdu.');
  if(Array.isArray(pre.hareketler)&&pre.hareketler.length)
   throw Error('On odemede hareket dizisi var; tarih tek alandan guvenle duzeltilemiyor.');
  return odemePlani(v);
 };
 const before=snap.data(),oldTotals=validate(before);
 // Firestore Timestamp gibi ozel nesneleri klonlamadan sadece ilgili alani onizle.
 const copy={...before,aylikOdemeler:{...before.aylikOdemeler,__onOdeme:{...before.aylikOdemeler.__onOdeme,odemeTarihi:AFTER_DATE}}};
 const nextTotals=odemePlani(copy);
 for(const field of ['toplam','odenen','kalan','geciken']){
  if(oldTotals[field]!==nextTotals[field])throw Error('Beklenmeyen bakiye degisimi: '+field);
 }
 console.log(JSON.stringify({mod:APPLY?'UYGULAMA':'ONIZLEME',ogrenci:'Mustafa Giray Macit',kalem:'__onOdeme',tutar:AMOUNT,eskiTarih:BEFORE_DATE,yeniTarih:AFTER_DATE,eski:{toplam:oldTotals.toplam,odenen:oldTotals.odenen,kalan:oldTotals.kalan},yeni:{toplam:nextTotals.toplam,odenen:nextTotals.odenen,kalan:nextTotals.kalan}},null,2));
 if(!APPLY)return;
 const backupDir=path.join(process.env.HOME||'.','finans-yedekleri');
 fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
 const backupFile=path.join(backupDir,'mustafa-giray-onodeme-tarih-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
 fs.writeFileSync(backupFile,JSON.stringify({path:REF_PATH,data:before},null,2),{mode:0o600,flag:'wx'});
 console.log('Yerel yedek alindi. Yedek icerigini veya dosya yolunu paylasmayin.');
 await db.runTransaction(async transaction=>{
  const latest=await transaction.get(ref);
  if(!latest.exists)throw Error('Donem belgesi artik yok.');
  const current=latest.data(),totals=validate(current);
  for(const field of ['toplam','odenen','kalan','geciken']){
   if(totals[field]!==oldTotals[field])throw Error('Bakiye islem sirasinda degisti; durduruldu.');
  }
  transaction.update(ref,{'aylikOdemeler.__onOdeme.odemeTarihi':AFTER_DATE});
 });
 const finalSnap=await ref.get(),finalPlan=odemePlani(finalSnap.data());
 if(finalSnap.data()?.aylikOdemeler?.__onOdeme?.odemeTarihi!==AFTER_DATE)throw Error('Yazma tamamlandi fakat tarih dogrulanamadi.');
 for(const field of ['toplam','odenen','kalan','geciken']){
  if(finalPlan[field]!==oldTotals[field])throw Error('Yazma sonrasi finans toplaminda beklenmeyen degisim: '+field);
 }
 console.log('DOG RULANDI'.replace(' ','')+': Tarih 2026-08-10, on odeme 37.000 TL korundu; finans bakiyeleri degismedi.');
})().catch(e=>{console.error('ISLEM DURDU: '+e.message);process.exitCode=1;});
