import test from 'node:test';
import assert from 'node:assert/strict';
import {OWNER_EMAIL,stageCandidate,prepareReview,approveCandidate,categoryOptions} from '../js/finans/import-approval.js';

// Synthetic-only transactional store. Writes are committed only if callback
// completes; serial execution models Firestore retrying a concurrent loser.
function store() {
  const data=new Map(); let serial=Promise.resolve(), failCommit=false;
  const fb={
    doc:(_db,...parts)=>parts.join('/'),serverTimestamp:()=> 'synthetic-timestamp',
    runTransaction(_db,fn) {
      const result=serial.then(async()=>{
        const pending=new Map(); let wrote=false;
        const tx={
          async get(ref){assert.equal(wrote,false,'Firestore reads must precede writes');const v=data.get(ref);return {exists:()=>v!==undefined,data:()=>structuredClone(v)};},
          set(ref,value){wrote=true;pending.set(ref,structuredClone(value));},
          update(ref,value){wrote=true;assert.ok(data.has(ref));pending.set(ref,{...structuredClone(data.get(ref)),...structuredClone(value)});}
        };
        const output=await fn(tx);
        if(failCommit) throw Error('synthetic commit failure');
        for(const [key,value] of pending) data.set(key,value);
        return output;
      });
      serial=result.catch(()=>{}); return result;
    }
  };
  return {data,ctx:{fb,db:{},email:OWNER_EMAIL},failCommit:value=>{failCommit=value;}};
}
const payment=(overrides={})=>({
  kind:'payment',revision:1,source:{mailbox:'owner@example.invalid',messageId:'synthetic-message'},
  amountMinor:40000,currency:'TRY',studentId:'synthetic-student',period:'2026-2027',
  item:'2026-10',paymentDate:'2026-10-01',paymentMethod:'havale',
  paymentStatus:'paid',paymentEvidence:'synthetic verified bank notice',...overrides
});
const period=()=>({aidatAyarlari:{baslangicAyi:'2026-09',taksitSayisi:10,iDonemAylik:1000,iiDonemAylik:1100},aylikOdemeler:{}});
const expense=(overrides={})=>payment({kind:'expense',invoiceDate:'2026-09-30',invoiceNumber:'SYNTHETIC-1',...overrides});
async function setup(c=payment()) {
  const s=store(), p=period();
  s.data.set('ogrenciler/synthetic-student/donemler/2026-2027',p);
  const {id}=await stageCandidate(s.ctx,c);
  return {...s,c,id,p,review:prepareReview(c,{duplicateReview:true},p)};
}
const approve=s=>approveCandidate(s.ctx,{queueId:s.id,review:s.review,confirmed:true});

test('staging is source-idempotent, changes no balances and never auto approves',async()=>{
  const s=await setup();
  assert.deepEqual(await stageCandidate(s.ctx,s.c),{id:s.id,existing:true});
  assert.equal(s.data.size,2);
  await assert.rejects(approveCandidate(s.ctx,{queueId:s.id,review:s.review}),/Açık onay/);
  await assert.rejects(stageCandidate(s.ctx,{...s.c,amountMinor:40100}),/Kaynak değişmiş/);
  assert.deepEqual(s.data.get('ogrenciler/synthetic-student/donemler/2026-2027'),s.p);
});
test('partial payment, queue, ledger and owner-only notification commit once, including concurrent retry',async()=>{
  const s=await setup();
  const outcomes=await Promise.all([approve(s),approve(s)]);
  assert.deepEqual(outcomes.map(x=>x.alreadyProcessed),[false,true]);
  const row=s.data.get('ogrenciler/synthetic-student/donemler/2026-2027').aylikOdemeler['2026-10'];
  assert.equal(row.odenenTutar,400);assert.equal(row.odendi,false);assert.equal(row.hareketler.length,1);
  assert.equal(s.data.get('finansIceriAktarimlari/'+s.id).status,'islendi');
  const notifications=[...s.data].filter(([k])=>k.startsWith('bildirimler/'));
  assert.equal(notifications.length,1);assert.equal(notifications[0][1].aliciEmail,OWNER_EMAIL);
  assert.equal([...s.data.keys()].filter(k=>k.startsWith('odemeler/')).length,1);
});
test('commit failure rolls everything back and a retry succeeds',async()=>{
  const s=await setup(),before=structuredClone([...s.data]);
  s.failCommit(true);await assert.rejects(approve(s),/commit failure/);
  assert.deepEqual([...s.data],before);
  s.failCommit(false);assert.equal((await approve(s)).alreadyProcessed,false);
});
test('changed source revision or amount invalidates approval',async()=>{
  for(const changes of [{revision:2},{amountMinor:41000}]) {
    const s=await setup();
    s.data.get('finansIceriAktarimlari/'+s.id).candidate={...s.c,...changes};
    await assert.rejects(approve(s),/sürümü veya tutarı değişmiş/);
    assert.equal(s.data.size,2);
  }
});
test('changed plan/balance and overpayment are rejected without writes',async()=>{
  const s=await setup();
  s.data.get('ogrenciler/synthetic-student/donemler/2026-2027').aidatAyarlari.iDonemAylik=900;
  await assert.rejects(approve(s),/Plan veya bakiye değişmiş/);
  const over=await setup(payment({amountMinor:100001}));
  await assert.rejects(approve(over),/kalan borcu aşıyor/);
  assert.equal(over.data.size,2);
});
test('same bank event in another mailbox cannot be posted twice',async()=>{
  const eventKey={type:'bank_reference',issuer:'synthetic-bank',account:'synthetic-account',value:'synthetic-reference'};
  const s=await setup(payment({eventKey}));
  await approve(s);
  const second={...s.c,source:{mailbox:'second@example.invalid',messageId:'another-message'}};
  const {id}=await stageCandidate(s.ctx,second);
  await assert.rejects(approveCandidate(s.ctx,{queueId:id,review:prepareReview(second,{},s.p),confirmed:true}),/referansı daha önce/);
  assert.equal([...s.data.keys()].filter(k=>k.startsWith('odemeler/')).length,1);
});
test('amount/date similarity alone never becomes a strong dedupe key',async()=>{
  const s=await setup();
  s.review=prepareReview(s.c,{},s.p);
  await assert.rejects(approve(s),/hesaplar arası mükerrer/);
});
test('expense needs explicit category; invoice date is preserved separately',async()=>{
  const s=await setup(expense());
  await assert.rejects(approve(s),/gider kategorisini/);
  s.review=prepareReview(s.c,{category:'isletme_kirtasiye',duplicateReview:true});
  await approve(s);
  const e=s.data.get('giderler/import_'+s.id);
  assert.equal(e.kategori,'isletme_kirtasiye');assert.equal(e.tarih,'2026-10-01');
  assert.equal(e.faturaTarihi,'2026-09-30');assert.equal(e.odendi,true);
  assert.equal(categoryOptions()[0].value,'');
  const changed={...s,review:{...s.review,category:'diger_genel'}};
  await assert.rejects(approve(changed),/Önceki işlem sonucu uyuşmuyor/);
});
test('foreign currency, unknown payment and missing proof are never inferred',async()=>{
  for(const [changes,pattern] of [
    [{currency:'USD'},/Döviz/],
    [{paymentStatus:'unknown'},/tek başına/],
    [{paymentEvidence:''},/Ödeme kanıtı/],
    [{paymentDate:undefined},/ödeme tarihi/]
  ]) {
    const s=await setup(expense(changes));
    s.review=prepareReview(s.c,{category:'sabit_internet',duplicateReview:true});
    await assert.rejects(approve(s),pattern);assert.equal(s.data.size,2);
  }
});
test('non-owner and forged category fail; no caller-controlled recipients',async()=>{
  const s=await setup(expense());
  await assert.rejects(stageCandidate({...s.ctx,email:'staff@example.invalid'},s.c),/hesap sahibi/);
  await assert.rejects(approveCandidate({...s.ctx,email:'staff@example.invalid'},{queueId:s.id,review:s.review,confirmed:true}),/hesap sahibi/);
  s.review=prepareReview(s.c,{category:'__proto__',duplicateReview:true});
  await assert.rejects(approve(s),/gider kategorisini/);
});
test('fractional minor units and absent currency fail before staging',async()=>{
  const s=store();
  await assert.rejects(stageCandidate(s.ctx,payment({amountMinor:4.2})),/tam kuruş/);
  await assert.rejects(stageCandidate(s.ctx,payment({currency:undefined})),/Para birimi/);
  assert.equal(s.data.size,0);
});
