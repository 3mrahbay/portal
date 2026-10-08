#!/usr/bin/env node
'use strict';
// Hedefe kilitli, varsayilan salt okunur; yazma icin --apply gerekir.
// Yedek dosyasi KISISEL VERI ICERIR: paylasmayin.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {initializeApp,getApps,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const PROJECT='bcka-site',PERIOD='2026-2027',STUDENT='TrGASITwumtHdLp8iZKu';
const EXPECTED=37000,INVALID='0006-08-10';
const apply=process.argv.includes('--apply');
const ack=process.argv.includes('--ack-false-prepayment');
const target=path.join('ogrenciler',STUDENT,'donemler',PERIOD);
const clone=x=>structuredClone(x);
function verify(v){
 if(!v||typeof v!=='object')throw Error('Donem belgesi bulunamadi.');
 const a=v.aidatAyarlari||{},r=v.aylikOdemeler?.__onOdeme||{};
 const expected=Number(a.onOdeme),paid=Number(r.odenenTutar);
 const moves=r.hareketler;
 if(expected!==EXPECTED||paid!==EXPECTED||r.odendi!==true)throw Error('On odeme tutarlari beklenenden farkli; iptal.');
 if(Array.isArray(moves)&&moves.length)throw Error('Gercek hareket dizisi var; manuel inceleme gerekli.');
 if(r.odemeTarihi!==INVALID)throw Error('Yanlis tarih eslesmedi; iptal.');
 if(a.onOdemeTarihi&&a.onOdemeTarihi!==INVALID)throw Error('On odeme ayar tarihi farkli; manuel inceleme gerekli.');
 return {a,r};
}
(async()=>{
 if(apply&&!ack)throw Error('Yazma icin --apply --ack-false-prepayment birlikte gerekir.');
 if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:PROJECT});
 const db=getFirestore(),ref=db.doc(target),studentRef=db.doc('ogrenciler/'+STUDENT);
 const [snap,profile]=await Promise.all([ref.get(),studentRef.get()]);
 if(!snap.exists)throw Error('Hedef kayit yok.');
 const name=String(profile.data()?.ogrenciAdSoyad||profile.data()?.ad||'').toLocaleLowerCase('tr-TR');
 if(!name.includes('mustafa')||!name.includes('giray')||!name.includes('macit'))throw Error('Ogrenci adi beklenenden farkli; iptal.');
 const before=snap.data();verify(before);
 const {odemePlani}=await import('../js/finans/core.js');
 const b=odemePlani(before);
 const updated=clone(before);
 updated.aidatAyarlari.onOdeme=0;
 delete updated.aidatAyarlari.onOdemeTarihi;
 delete updated.aylikOdemeler.__onOdeme;
 const after=odemePlani(updated);
 if(b.toplam-after.toplam!==EXPECTED||b.odenen-after.odenen!==EXPECTED||b.kalan!==after.kalan)throw Error('Bakiye degisimi beklenen disinda; iptal.');
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify({a:before.aidatAyarlari,r:before.aylikOdemeler?.__onOdeme})).digest('hex');
 console.log(JSON.stringify({mod:apply?'UYGULAMA':'ONIZLEME',ogrenci:'Mustafa Giray Macit',hedefKalem:'__onOdeme',tarih:INVALID,iptalEdilecekGercekteOlmayanTahsilat:EXPECTED,once:{plan:b.toplam,odenen:b.odenen,kalan:b.kalan},sonra:{plan:after.toplam,odenen:after.odenen,kalan:after.kalan},kayitParmakIzi:fingerprint},null,2));
 if(!apply)return;
 const backupDir=path.join(process.env.HOME||'.','finans-yedekleri');
 fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
 const backupPath=path.join(backupDir,'mustafa-giray-onodeme-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
 fs.writeFileSync(backupPath,JSON.stringify({path:target,data:before},null,2),{mode:0o600,flag:'wx'});
 console.log('Yedek yerel diske yazildi. Dosya yolunu paylasmayin.');
 await db.runTransaction(async tx=>{
  const fresh=await tx.get(ref);
  if(!fresh.exists)throw Error('Kayit silinmis; iptal.');
  const current=fresh.data();verify(current);
  const latest=crypto.createHash('sha256').update(JSON.stringify({a:current.aidatAyarlari,r:current.aylikOdemeler?.__onOdeme})).digest('hex');
  if(latest!==fingerprint)throw Error('Kayit degisti; iptal.');
  const freshPlan=odemePlani(current);
  if(freshPlan.toplam!==b.toplam||freshPlan.odenen!==b.odenen||freshPlan.kalan!==b.kalan)throw Error('Bakiye degisti; iptal.');
  const nextA={...current.aidatAyarlari,onOdeme:0};
  delete nextA.onOdemeTarihi;
  const nextO={...current.aylikOdemeler};
  delete nextO.__onOdeme;
  tx.update(ref,{aidatAyarlari:nextA,aylikOdemeler:nextO});
 });
 const confirmed=await ref.get();
 const final=odemePlani(confirmed.data());
 if(final.toplam!==after.toplam||final.odenen!==after.odenen||final.kalan!==after.kalan)throw Error('YAZMA YAPILDI ancak son dogrulama eslesmedi; yedegi koruyun.');
 console.log(JSON.stringify({sonuc:'DOG RULANDI'.replace(' ',''),toplam:final.toplam,odenen:final.odenen,kalan:final.kalan},null,2));
})().catch(e=>{console.error('ISLEM DURDU: '+e.message);process.exitCode=1;});
