import test from 'node:test';
import assert from 'node:assert/strict';
import {createApprovalService,financeCallables} from '../server/finance/approval-service.mjs';
import {OWNER_EMAIL} from '../js/finans/import-approval.js';
import {store} from './finance-import-store.mjs';
const request=data=>({auth:{uid:'synthetic-owner',token:{email:OWNER_EMAIL,email_verified:true}},app:{appId:'synthetic-app'},data});
const candidate=()=>({kind:'payment',revision:1,source:{mailbox:'synthetic@example.invalid',messageId:'one'},amountMinor:40000,currency:'TRY',studentId:'child',period:'2026-2027',item:'2026-10',paymentDate:'2026-10-01',paymentMethod:'havale',paymentStatus:'paid',paymentEvidence:'Synthetic bank proof'});
async function setup(){const s=store();let time=1000;const service=createApprovalService({...s.ctx,ownerUid:'synthetic-owner',now:()=>time});s.data.set('ogrenciler/child',{ogrenciAdSoyad:'Synthetic Child'});s.data.set('ogrenciler/child/donemler/2026-2027',{aidatAyarlari:{baslangicAyi:'2026-09',taksitSayisi:10,iDonemAylik:1000,iiDonemAylik:1100},aylikOdemeler:{}});const {id}=await service.stage(request({candidate:candidate()}));return {...s,service,id,setTime:t=>time=t};}
const review=s=>s.service.review(request({queueId:s.id,duplicateReview:true}));
const approve=(s,id)=>s.service.approve(request({reviewId:id,action:'approve'}));
test('every endpoint rejects forged identity and missing/consumed App Check',async()=>{
 const s=await setup();for(const patch of [{auth:undefined},{auth:{uid:'attacker',token:{email:OWNER_EMAIL,email_verified:true}}},{auth:{uid:'synthetic-owner',token:{email:OWNER_EMAIL,email_verified:false}}},{app:undefined},{app:{appId:'x',alreadyConsumed:true}}]){
  for(const method of ['stage','list','review','approve'])await assert.rejects(s.service[method]({...request({candidate:candidate(),email:OWNER_EMAIL,confirmed:true}),...patch}),/authentication|App Check/);
 }assert.equal(s.data.size,3);
});
test('server review binds current data; forged client snapshot cannot change posting',async()=>{
 const s=await setup(),r=await review(s);assert.equal(r.studentName,'Synthetic Child');
 const result=await s.service.approve(request({reviewId:r.reviewId,action:'approve',candidate:{amountMinor:1},email:'attacker',review:{}}));
 assert.equal(s.data.get('odemeler/'+result.id).tutar,400);
 assert.equal(s.data.get('finansOnayIncelemeleri/'+r.reviewId).status,'consumed');
 assert.equal((await approve(s,r.reviewId)).alreadyProcessed,true);
});
test('expired or unknown review cannot write; consumed expired retry reconciles',async()=>{
 const s=await setup(),r=await review(s);s.setTime(r.expiresAt);await assert.rejects(approve(s,r.reviewId),/expired/);
 await assert.rejects(approve(s,'unknown'),/unavailable/);s.setTime(1000);await approve(s,r.reviewId);s.setTime(r.expiresAt+1);assert.equal((await approve(s,r.reviewId)).alreadyProcessed,true);
});
test('queue and balance changes require new server review',async()=>{
 for(const mode of ['queue','balance']){const s=await setup(),r=await review(s);
 if(mode==='queue')s.data.get('finansIceriAktarimlari/'+s.id).candidate.amountMinor++;
 else s.data.get('ogrenciler/child/donemler/2026-2027').aidatAyarlari.iDonemAylik=900;
 await assert.rejects(approve(s,r.reviewId),/değişmiş/);assert.equal([...s.data.keys()].some(k=>k.startsWith('odemeler/')),false);}
});
test('atomic failure retains ready review; concurrent approvals post once',async()=>{
 const s=await setup(),r=await review(s);s.failCommit(true);await assert.rejects(approve(s,r.reviewId),/commit failure/);assert.equal(s.data.get('finansOnayIncelemeleri/'+r.reviewId).status,'ready');s.failCommit(false);
 const out=await Promise.all([approve(s,r.reviewId),approve(s,r.reviewId)]);assert.deepEqual(out.map(x=>x.alreadyProcessed).sort(),[false,true]);
});
test('callable factory enforces App Check and server configuration',()=>{
 assert.throws(()=>createApprovalService({}),/UID/);const opts=[];
 const calls=financeCallables({onCall:(o,f)=>{opts.push(o);return f;},HttpsError:Error,db:{},FieldValue:{},ownerUid:'synthetic-owner',region:'europe-west1'});
 assert.equal(Object.keys(calls).length,4);assert.ok(opts.every(o=>o.enforceAppCheck&&o.consumeAppCheckToken));
});
