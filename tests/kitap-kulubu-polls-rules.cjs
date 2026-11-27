const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const f=require('firebase/firestore'),fs=require('node:fs');
(async()=>{
 if(!process.env.BOOK_RULES||!/^127\.0\.0\.1:/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
 const env=await initializeTestEnvironment({projectId:'demo-club-polls-rules',firestore:{host:'127.0.0.1',port:Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]),rules:fs.readFileSync(process.env.BOOK_RULES,'utf8')}});
 let checks=0;const ok=async p=>{await assertSucceeds(p);checks++},no=async p=>{await assertFails(p);checks++};
 const db=uid=>env.authenticatedContext(uid,{email:uid==='admin'?'emrahby@gmail.com':uid+'@example.test'}).firestore();
 const poll=uid=>f.doc(db(uid),'kitapKulubuOylamalar','poll-test');
 const ballot=(uid,owner=uid)=>f.doc(db(uid),'kitapKulubuOylamalar','poll-test','oylar',owner);
 try{
 await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();
  for(const uid of ['member','other','pending','blocked','father']){await f.setDoc(f.doc(d,'veliler',uid+'@example.test'),{yakinlik:uid==='father'?'Baba':'Anne',onaylandi:true});await f.setDoc(f.doc(d,'kitapKulubuUyeler',uid),{uid,status:['pending','blocked'].includes(uid)?uid:'approved'});}
  for(const [uid,rol,durum] of [['pdr','pdr','aktif'],['teacher','ogretmen','aktif'],['inactive','pdr','pasif']])await f.setDoc(f.doc(d,'personeller',uid+'@example.test'),{rol,durum});
  await f.setDoc(f.doc(d,'kitapKulubuOylamalar','poll-test'),{title:'Test',status:'open',createdAt:f.Timestamp.now(),counts:{o0:1,o1:0},total:1});
  for(const uid of ['member','other'])await f.setDoc(f.doc(d,'kitapKulubuOylamalar','poll-test','oylar',uid),{optionId:'o0',revision:1,requestId:'test-id1'});
  await f.setDoc(f.doc(d,'kitapKulubuOylamalar','poll-test','yonetim','kayit'),{createdBy:'pdr'});
 });
 for(const uid of ['member','teacher','pdr','admin']){await ok(f.getDoc(poll(uid)));await ok(f.getDocs(f.query(f.collection(db(uid),'kitapKulubuOylamalar'),f.orderBy('createdAt','desc'),f.limit(20))));}
 await ok(f.getDoc(ballot('member')));
 for(const uid of ['other','teacher','pdr','admin'])await no(f.getDoc(ballot(uid,'member')));
 for(const uid of ['member','pdr','admin']){
  await no(f.getDocs(f.collection(db(uid),'kitapKulubuOylamalar','poll-test','oylar')));
  await no(f.getDoc(f.doc(db(uid),'kitapKulubuOylamalar','poll-test','yonetim','kayit')));
  await no(f.setDoc(f.doc(db(uid),'kitapKulubuOylamalar','new-poll'),{title:'spoof',counts:{o0:999}}));
  await no(f.updateDoc(poll(uid),{total:999}));await no(f.updateDoc(poll(uid),{status:'open',title:'changed'}));await no(f.deleteDoc(poll(uid)));
  await no(f.setDoc(ballot(uid),{optionId:'o1'}));await no(f.updateDoc(ballot(uid,'member'),{optionId:'o1'}));await no(f.deleteDoc(ballot(uid,'member')));
 }
 for(const uid of ['pending','blocked','father','inactive','stranger']){await no(f.getDoc(poll(uid)));await no(f.getDoc(ballot(uid)));}
 await no(f.getDoc(f.doc(env.unauthenticatedContext().firestore(),'kitapKulubuOylamalar','poll-test')));
 await no(f.getDocs(f.collection(db('member'),'kitapKulubuOylamalar')));await no(f.getDocs(f.query(f.collection(db('member'),'kitapKulubuOylamalar'),f.limit(21))));
 await no(f.getDoc(f.doc(db('member'),'kitapKulubuOylamalar','missing','oylar','member')));
 await env.withSecurityRulesDisabled(c=>f.updateDoc(f.doc(c.firestore(),'kitapKulubuUyeler','member'),{status:'blocked'}));await no(f.getDoc(ballot('member')));
 console.log('PASS '+checks+' poll rules checks: access, privacy, wildcard exclusion, counts/options tampering, own vote, orphan and revocation');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
