import test from 'node:test';
import assert from 'node:assert/strict';
import {planlaTahsilatTarihDuzeltmesi} from '../js/finans/date-correction.js';
import {okulFinansOzeti,sonAyKodlari} from '../js/finans/school-summary.js';
const aylar=sonAyKodlari('2027-06',10);
const parameters={aylar,eskiTarih:'2026-10-08',yeniTarih:'2026-07-23',aylikTutar:31500,toplamTutar:315000,bankaReferans:'havale-unique-20260723'};
function source(){return {aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:10,aylikAidat:31500},aylikOdemeler:Object.fromEntries(aylar.map(k=>[k,{beklenenTutar:31500,odenenTutar:31500,odendi:true,odemeTarihi:'2026-10-08'}])),digerOdemeler:{okulKiyafeti:{odenenTutar:100,tutar:100,odemeTarihi:'2026-10-08'}}};}
test('ten allocations share one bank reference and preserve tuition balances and extra fees',()=>{
 const v=source(),before=structuredClone(v);
 const out=planlaTahsilatTarihDuzeltmesi(v,parameters);
 assert.equal(out.tutar,315000);
 assert.equal(out.aySayisi,10);
 assert.deepEqual(v,before);
 assert.deepEqual(out.yeniAylikOdemeler['2026-09'].odemeTarihi,'2026-07-23');
 assert.deepEqual(v.digerOdemeler,before.digerOdemeler);
 const totals=okulFinansOzeti([{id:'s',veri:{...v,aylikOdemeler:out.yeniAylikOdemeler}}],new Date('2026-10-08T12:00:00Z'));
 assert.equal(totals.nakitAylar['2026-07'],315000);
 assert.equal(totals.buAyNakit,100);
 assert.equal(totals.toplamOdenen,315100);
 assert.equal(totals.toplamKalan,0);
});
test('reject conflicting payment date, amount, reversals, duplicate replay',()=>{
 const bad=source();bad.aylikOdemeler['2026-09'].odemeTarihi='2026-10-07';
 assert.throws(()=>planlaTahsilatTarihDuzeltmesi(bad,parameters),/tarihi uyuşmuyor/);
 bad.aylikOdemeler['2026-09'].odemeTarihi='2026-10-08';bad.aylikOdemeler['2026-09'].odenenTutar=30000;
 assert.throws(()=>planlaTahsilatTarihDuzeltmesi(bad,parameters),/tam ödenmiş/);
 bad.aylikOdemeler['2026-09'].odenenTutar=31500;bad.aylikOdemeler['2026-09'].hareketler=[{tutar:32000,tarih:'2026-10-08'},{tutar:-500,tarih:'2026-10-08'}];
 assert.throws(()=>planlaTahsilatTarihDuzeltmesi(bad,parameters),/uyuşmazlık/);
 const first=planlaTahsilatTarihDuzeltmesi(source(),parameters);
 assert.throws(()=>planlaTahsilatTarihDuzeltmesi({...source(),aylikOdemeler:first.yeniAylikOdemeler},parameters),/tarihi uyuşmuyor/);
});
