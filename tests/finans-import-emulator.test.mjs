import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createApprovalService,adminAdapter} from '../server/finance/approval-service.mjs';
import {OWNER_EMAIL} from '../js/finans/import-approval.js';
const endpoint=process.env.FIRESTORE_EMULATOR_HOST||'';
if(!/^127\.0\.0\.1:\d+$/.test(endpoint))throw Error('Local Firestore emulator required; production prohibited.');
const require=createRequire((process.env.FINANCE_TEST_DEPS||'/tmp/portal-finance-tests/node_modules')+'/package.json');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const app=initializeApp({projectId:'demo-finance-import'},'test-'+randomUUID());
const db=getFirestore(app),fb=adminAdapter(FieldValue),service=createApprovalService({db,fb,ownerUid:'synthetic-owner'});
const req=data=>({auth:{uid:'synthetic-owner',token:{email:OWNER_EMAIL,email_verified:true}},app:{appId:'synthetic'},data});
test('real Firestore transaction: concurrent server approvals yield exactly one ledger and movement',async()=>{
 const studentId='synthetic-'+randomUUID();
 try{
 await db.doc('ogrenciler/'+studentId).set({ogrenciAdSoyad:'Synthetic Student'});
 const path='ogrenciler/'+studentId+'/donemler/2026-2027';
 await db.doc(path).set({aidatAyarlari:{baslangicAyi:'2026-09',taksitSayisi:10,iDonemAylik:1000,iiDonemAylik:1100},aylikOdemeler:{}});
 const candidate={kind:'payment',revision:1,source:{mailbox:'synthetic@example.invalid',messageId:randomUUID()},studentId,period:'2026-2027',item:'2026-10',amountMinor:40000,currency:'TRY',paymentDate:'2026-10-01',paymentMethod:'havale',paymentStatus:'paid',paymentEvidence:'synthetic proof'};
 const {id}=await service.stage(req({candidate}));const r=await service.review(req({queueId:id,duplicateReview:true}));
 const outcomes=await Promise.all([service.approve(req({reviewId:r.reviewId,action:'approve'})),service.approve(req({reviewId:r.reviewId,action:'approve'}))]);
 assert.deepEqual(outcomes.map(x=>x.alreadyProcessed).sort(),[false,true]);
 const row=(await db.doc(path).get()).data().aylikOdemeler['2026-10'];assert.equal(row.odenenTutar,400);assert.equal(row.hareketler.length,1);assert.equal(row.odendi,false);
 assert.equal((await db.doc('finansOnayIncelemeleri/'+r.reviewId).get()).data().status,'consumed');
 assert.equal((await db.doc('odemeler/import_'+id).get()).data().tutar,400);
 // Same source updated after a review is rejected before any accounting write.
 const second={...candidate,source:{...candidate.source,messageId:randomUUID()}};
 const staged=await service.stage(req({candidate:second})),r2=await service.review(req({queueId:staged.id,duplicateReview:true}));
 await db.doc('finansIceriAktarimlari/'+staged.id).update({'candidate.amountMinor':41000});
 await assert.rejects(service.approve(req({reviewId:r2.reviewId,action:'approve'})),/değişmiş/);
 assert.equal((await db.doc('odemeler/import_'+staged.id).get()).exists,false);
 }finally{await db.terminate();await deleteApp(app);}
});
