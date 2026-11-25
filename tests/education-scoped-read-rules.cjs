// Synthetic data only; refuses all non-loopback emulator endpoints.
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const fb=require('firebase/firestore');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const endpoint=process.env.FIRESTORE_EMULATOR_HOST;
 if(!/^127\.0\.0\.1:\d+$/.test(endpoint||'')||!process.env.EDUCATION_RULES_FILE)throw Error('Local emulator and released rules snapshot required');
 const [host,port]=endpoint.split(':');
 const {educationReadScope,createEducationReader}=await import('../js/egitim-gelisim-okuma.mjs');
 const env=await initializeTestEnvironment({projectId:'demo-education-read',firestore:{host,port:+port,rules:fs.readFileSync(process.env.EDUCATION_RULES_FILE,'utf8')}});
 const roles=['ogretmen','yardimci_ogretmen','ingilizce_ogretmeni','degerler_ogretmeni','orman_ogretmeni','brans_ogretmeni','mudur','kurucu_mudur','egitim_koordinator','pdr'];
 const key='practical__Ön Çalışmalar__Kaşıklama 1';
 try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c=>{
   const db=c.firestore();
   await fb.setDoc(fb.doc(db,'ayarlar','donem'),{aktif:'2026-2027'});
   for(const rol of roles){
    await fb.setDoc(fb.doc(db,'personeller',rol+'@example.test'),{rol,sinifAtamalari:['Class A'],durum:'aktif'});
    await fb.setDoc(fb.doc(db,'kullaniciKimlikleri','uid-'+rol),{aktif:true,primaryProfile:'personel',refEmail:rol+'@example.test'});
   }
   for(const [id,sinif] of [['a','Class A'],['period',''],['missing','Class A'],['outside','Class B']]){
    await fb.setDoc(fb.doc(db,'ogrenciler',id),{sinif});
    if(id==='period')await fb.setDoc(fb.doc(db,'ogrenciler',id,'donemler','2026-2027'),{sinif:'Class A'});
    if(id!=='missing')await fb.setDoc(fb.doc(db,'ogrenciGelisim',id),{montessori:{kayitlar:{[key]:'U'},detay:{[key]:{not:'preserved'}}},ingilizce:{kayitlar:{lesson:'T'}}});
   }
  });
  for(const uidProfile of [false,true])for(const rol of roles){
   const uid=(uidProfile?'uid-':'legacy-')+rol;
   const db=env.authenticatedContext(uid,{email:rol+'@example.test'}).firestore();
   const global=['mudur','kurucu_mudur','egitim_koordinator','pdr'].includes(rol);
   const state={currentUser:{uid,email:rol+'@example.test'},rol,personel:{sinifAtamalari:['Class A']},ogrenciVerileriHazirMi:true,aktifDonem:'2026-2027',ogrenciList:[{id:'a',sinif:'Class A'},{id:'period',sinif:''},{id:'missing',sinif:'Class A'},{id:'outside',sinif:'Class B'}],ayarListesi:{period:{kayit:{sinif:'Class A'}}}};
   if(global)await assertSucceeds(fb.getDocs(fb.collection(db,'ogrenciGelisim')));
   else {
    await assertFails(fb.getDocs(fb.collection(db,'ogrenciGelisim')));
    await assertFails(fb.getDoc(fb.doc(db,'ogrenciGelisim','outside')));
   }
   const reader=createEducationReader({scope:()=>educationReadScope(state),readAll:async()=>Object.fromEntries((await fb.getDocsFromServer(fb.collection(db,'ogrenciGelisim'))).docs.map(d=>[d.id,d.data()])),readOne:async id=>{const snap=await fb.getDocFromServer(fb.doc(db,'ogrenciGelisim',id));return snap.exists()?snap.data():null}});
   const result=await reader.read();assert.equal(result.a.montessori.kayitlar[key],'U');assert.equal(result.period.montessori.kayitlar[key],'U');assert.equal(result.missing,undefined);assert.equal(!!result.outside,global);
   // Server-confirmed document listener works with the same unchanged rules.
   await new Promise((resolve,reject)=>{const off=fb.onSnapshot(fb.doc(db,'ogrenciGelisim','a'),snap=>{if(snap.metadata.fromCache)return;off();try{assert.equal(snap.data().montessori.kayitlar[key],'U');resolve()}catch(e){reject(e)}},reject)});
   if(rol==='brans_ogretmeni'||rol==='pdr')await assertFails(fb.updateDoc(fb.doc(db,'ogrenciGelisim','a'),{'montessori.kayitlar.test':'S'}));
   if(rol==='ingilizce_ogretmeni')await assertFails(fb.updateDoc(fb.doc(db,'ogrenciGelisim','a'),{'montessori.kayitlar.test':'S'}));
   console.log('PASS',uidProfile?'UID':'email',rol);
  }
  for(const db of [env.unauthenticatedContext().firestore(),env.authenticatedContext('outsider',{email:'outsider@example.test'}).firestore()])await assertFails(fb.getDoc(fb.doc(db,'ogrenciGelisim','a')));
  console.log('PASS: unchanged production rules, 20 role/identity cases, old collection denial, scoped reads, period fallback, missing docs, listeners, write boundaries');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
