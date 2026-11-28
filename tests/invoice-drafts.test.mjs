import test from 'node:test';import assert from 'node:assert/strict';
import {draftRows,draftDecision,draftIssues,hashText} from '../js/finans/invoices/drafts.js';
import {liveIssue,INVOICE_PREVIEW_ENABLED} from '../js/finans/invoices/config.js';
const m={ogrenciId:'s',donem:'2026-2027',kalemId:'2026-11',hareketId:'p',tarih:'2026-11-20',tutar:100,kalem:'Eğitim'};
const data={gelirler:[m],ogrenciler:[{id:'s',ogrenciKimlik:{adSoyad:'Test Öğrenci',tcKimlik:'11111111110'}}],mutabakatlar:[{...m,bankaReferans:'ref',tahsilatTutar:100,bankaTutar:100,komisyon:0}]};
const decision={requirement:'required',reason:'',servicePeriod:'2026-11',productCode:'EGITIM',taxRateBps:1000,taxApproved:true,reviewed:true};
test('drafts enabled but issuance always rejects',()=>{assert.equal(INVOICE_PREVIEW_ENABLED,true);assert.throws(liveIssue);});
test('draft decisions cannot set identity, number, or send state',()=>{for(const key of ['recipient','customer','invoiceNumber','status','approvedBy'])assert.throws(()=>draftDecision({...decision,[key]:'x'}));});
test('typed bounded decisions and reason mandatory',()=>{for(const p of [{taxRateBps:-1},{reason:'x'.repeat(501)},{taxApproved:'true'},{requirement:'excluded',reason:''}])assert.throws(()=>draftDecision({...decision,...p}));});
test('same source is stable, identity changes invalidate reviewed draft',async()=>{const [r]=await draftRows(data);const saved={id:r.id,source:r.source,sourceKey:r.key,fingerprint:r.fingerprint,version:1,decision};assert.equal((await draftRows(data,[saved]))[0].status,'reviewed');const changed=structuredClone(data);changed.ogrenciler[0].ogrenciKimlik.tcKimlik='22222222220';const [next]=await draftRows(changed,[saved]);assert.equal(next.id,r.id);assert.equal(next.status,'source_changed');});
test('missing source remains visible',async()=>{const [r]=await draftRows(data);const [lost]=await draftRows({...data,gelirler:[]},[{id:r.id,source:r.source,sourceKey:r.key,version:1,decision}]);assert.equal(lost.unavailable,true);assert.equal(lost.status,'source_changed');});
test('student identity mandatory for completion, never parent fallback',async()=>{const missing=structuredClone(data);missing.ogrenciler[0].ogrenciKimlik.tcKimlik='';missing.ogrenciler[0].veri={anne:{adSoyad:'Anne Adı',tcKimlik:'11111111110'}};const [r]=await draftRows(missing);assert.ok(draftIssues(r,decision).some(x=>x.includes('T.C.')));});
test('API absence does not prevent preparation review',async()=>{const [r]=await draftRows(data);assert.deepEqual(draftIssues(r,decision),[]);assert.equal((await hashText(r.key)).length,64);});

test('legacy summary is stable, never reviewable, changes invalidate and payment stays untouched',async()=>{
 const x=structuredClone(data);x.gelirler=[{...m,hareketId:'',eskiKayit:true}];const before=JSON.stringify(x);
 const [r]=await draftRows(x);assert.equal(r.source.hareketId,'legacy-summary');assert.ok(draftIssues(r,decision).some(x=>x.includes('Tekil')));assert.equal(JSON.stringify(x),before);
 const saved={id:r.id,source:r.source,sourceKey:r.key,fingerprint:r.fingerprint,version:1,decision:{...decision,reviewed:false}};
 assert.equal((await draftRows(x,[saved]))[0].status,'draft');x.gelirler[0].tutar=99;const [changed]=await draftRows(x,[saved]);assert.equal(changed.id,r.id);assert.equal(changed.status,'source_changed');
});
test('VAT inclusive breakdown conserves every cent at all offered rates',async()=>{const {taxBreakdown}=await import('../js/finans/invoices/drafts.js');assert.deepEqual(taxBreakdown(3250000,1000),{net:2954545,tax:295455,gross:3250000});for(const rate of [0,100,800,1000,1800,2000])for(const gross of [1,2,99,3250000]){const t=taxBreakdown(gross,rate);assert.equal(t.net+t.tax,gross);}assert.throws(()=>taxBreakdown(1,-1));});
