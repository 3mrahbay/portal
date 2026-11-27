const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const fb=require('firebase/firestore'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8086'||!process.env.INVOICE_RULES_FILE)throw Error('Local rules test only');
 const env=await initializeTestEnvironment({projectId:'demo-invoice-drafts',firestore:{host:'127.0.0.1',port:8086,rules:fs.readFileSync(process.env.INVOICE_RULES_FILE,'utf8')}});
 let count=0; const ok=async p=>{await assertSucceeds(p);count++;},no=async p=>{await assertFails(p);count++;};
 const db=role=>env.authenticatedContext(role,{email:role+'@example.test'}).firestore();
 const id='a'.repeat(64),ref=d=>fb.doc(d,'faturaHazirlik',id);
 const decision={requirement:'required',servicePeriod:'2026-11',productCode:'EGITIM',reason:'',taxRateBps:1000,taxApproved:true,reviewed:false};
 const row=(actor='muhasebe')=>({schemaVersion:1,donem:'2026-2027',source:{donem:'2026-2027',ogrenciId:'student',kalemId:'2026-11',hareketId:'payment'},sourceKey:'test-source',recipientKind:'student',fingerprint:'b'.repeat(64),decision,version:1,createdBy:actor,createdAt:fb.serverTimestamp(),updatedBy:actor,updatedAt:fb.serverTimestamp()});
 function write(d,r){const b=fb.writeBatch(d);b.set(ref(d),r);b.set(fb.doc(ref(d),'history',String(r.version)),{version:r.version,actor:r.updatedBy,at:fb.serverTimestamp(),decision:r.decision,fingerprint:r.fingerprint});return b.commit();}
 try{
 await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();for(const role of ['muhasebe','mudur','ogretmen','danisma'])await fb.setDoc(fb.doc(d,'personeller',role+'@example.test'),{rol:role});await fb.setDoc(fb.doc(d,'ogrenciler','student'),{ogrenciAdSoyad:'Test Öğrenci',tcKimlik:'11111111110'});await fb.setDoc(fb.doc(d,'ogrenciler','student','donemler','2026-2027'),{anne:{adSoyad:'Anne Test',tcKimlik:'22222222220'}});});
 const d=db('muhasebe');
 await no(fb.setDoc(ref(d),row())); // history mandatory
 for(const role of ['ogretmen','danisma','veli'])await no(write(db(role),row(role)));
 await no(write(d,{...row(),recipientKind:'parent'}));
 await no(write(d,{...row(),invoiceNumber:'ABC2026000000001'}));
 await no(write(d,{...row(),status:'issued'}));
 await no(write(d,{...row(),decision:{...decision,recipient:{tckn:'22222222220'}}}));
 await no(write(d,{...row(),updatedBy:'other'}));
 await no(write(d,{...row(),decision:{...decision,reason:'x'.repeat(501)}}));
 await ok(write(d,row()));
 for(const role of ['muhasebe','mudur'])await ok(fb.getDocs(fb.query(fb.collection(db(role),'faturaHazirlik'),fb.where('donem','==','2026-2027'))));
 for(const role of ['ogretmen','danisma','veli'])await no(fb.getDoc(ref(db(role))));
 await no(fb.getDoc(ref(env.unauthenticatedContext().firestore())));
 const original=(await fb.getDoc(ref(d))).data();
 await ok(write(d,{...original,version:2,decision:{...decision,reviewed:true},updatedAt:fb.serverTimestamp()}));
 await no(write(d,{...original,version:2,updatedAt:fb.serverTimestamp()}));
 await no(fb.deleteDoc(ref(d)));await no(fb.updateDoc(fb.doc(ref(d),'history','1'),{actor:'forged'}));
 await no(write(d,{...original,version:3,source:{...original.source,ogrenciId:'other'},updatedAt:fb.serverTimestamp()}));
 await env.withSecurityRulesDisabled(c=>fb.updateDoc(fb.doc(c.firestore(),'ogrenciler','student'),{tcKimlik:''}));
 await no(write(d,{...original,version:3,decision:{...decision,reviewed:true},updatedAt:fb.serverTimestamp()}));
 await ok(write(d,{...original,version:3,decision:{...decision,reviewed:false},updatedAt:fb.serverTimestamp()}));
 const history=await fb.getDocs(fb.collection(ref(d),'history'));assert.equal(history.size,3);count++;
 await env.withSecurityRulesDisabled(async c=>{const x=c.firestore();await fb.updateDoc(fb.doc(x,'ogrenciler','student'),{tcKimlik:'11111111110'});await fb.setDoc(fb.doc(x,'ogrenciler','student','donemler','2026-2027'),{aidatAyarlari:{baslangicAyi:'2026-11',taksitSayisi:1,aylikAidat:100},aylikOdemeler:{'2026-11':{odendi:true,odenenTutar:100,hareketler:[{id:'payment',tutar:100,tarih:'2026-11-20'}]}}});await fb.setDoc(fb.doc(x,'odemeler','bank'),{tur:'banka_mutabakati',donem:'2026-2027',ogrenciId:'student',kalemId:'2026-11',hareketId:'payment',bankaReferans:'TEST',tahsilatTutar:100,bankaTutar:100,komisyon:0});});
 const {okulVerisi}=await import('../js/finans/data.js');const {draftRows,saveDraft,readDrafts}=await import('../js/finans/invoices/drafts.js');
 const context={fb,db:d,uid:'muhasebe',donem:'2026-2027'};const data=await okulVerisi(context);const [candidate]=await draftRows(data);
 assert.ok(candidate);await ok(saveDraft(context,candidate,{...decision,reviewed:false}));
 let loaded=await draftRows(data,await readDrafts(context));let saved=loaded.find(r=>r.id===candidate.id);assert.equal(saved.version,1);count++;
 await assert.rejects(saveDraft(context,candidate,decision),/başka bir kullanıcı/);count++;
 await ok(saveDraft(context,saved,decision));
 await env.withSecurityRulesDisabled(c=>fb.updateDoc(fb.doc(c.firestore(),'ogrenciler','student'),{tcKimlik:'22222222220'}));
 loaded=await draftRows(data,await readDrafts(context));saved=loaded.find(r=>r.id===candidate.id);
 await assert.rejects(saveDraft(context,saved,decision),/değişti/);count++;
 console.log(`Invoice rules: ${count} checks passed`);
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
