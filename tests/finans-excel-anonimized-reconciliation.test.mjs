import test from 'node:test';
import assert from 'node:assert/strict';
import {okulFinansOzeti,sonAyKodlari} from '../js/finans/school-summary.js';

// Anonymized reproduction of the 19-row income Excel dated 2026-10-08.
// This fixture intentionally contains NO real student names, IDs or bank details.
const day = '2026-10-08T12:00:00Z';
const paid=(tutar,tarih)=>({odenenTutar:tutar,beklenenTutar:tutar,odendi:true,odemeTarihi:tarih});
const one=(id,month,fee,date,extras={})=>({id,veri:{
  aidatAyarlari:{baslangicAyi:month,gercekAySayisi:1,aylikAidat:fee,...(extras.advance?{onOdeme:extras.advance}:{})},
  aylikOdemeler:{[month]:paid(fee,date),...(extras.advance?{'__onOdeme':paid(extras.advance,date)}:{})},
  ...(extras.items?{digerOdemeler:Object.fromEntries(extras.items.map(([key,amount])=>[key,paid(amount,date)]))}:{})
}});
function fixture(prepayDate){
  const months=sonAyKodlari('2027-06',10);
  const monthsMap=Object.fromEntries(months.map(k=>[k,paid(31500,prepayDate)]));
  return [
    {id:'anon-A',veri:{
      aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:10,aylikAidat:31500},
      aylikOdemeler:monthsMap,
      digerOdemeler:{okulKiyafeti:paid(9555,'2026-10-08')}
    }},
    one('anon-B','2026-09',13522,'2026-10-07',{advance:37000,items:[['ormanKiyafeti',5600]]}),
    one('anon-C','2026-10',32500,'2026-10-06'),
    one('anon-D','2026-09',31500,'2026-10-06'),
    {id:'anon-E',veri:{digerOdemeler:{okulKiyafeti:paid(9555,'2026-10-06')}}},
    one('anon-F','2026-10',31500,'2026-10-01',{items:[['okulKiyafeti',9555]]})
  ];
}

test('as-entered 19 Excel allocations total 495287 TL and 424022 TL in tuition',()=>{
 const result=okulFinansOzeti(fixture('2026-10-08'),new Date(day));
 assert.equal(result.hareketler.length,19);
 assert.equal(result.toplamOdenen,495287);
 assert.equal(result.buAyNakit,495287);
 assert.equal(result.aidatOdenen['2026-10'],95500);
 const allTuition=Object.values(result.aidatOdenen).reduce((a,b)=>a+b,0);
 assert.equal(allTuition,424022);
});

test('after date-only correction July has 315000 and October has 180287 while tuition remains identical',()=>{
 const result=okulFinansOzeti(fixture('2026-07-23'),new Date(day));
 assert.equal(result.nakitAylar['2026-07'],315000);
 assert.equal(result.nakitAylar['2026-10'],180287);
 assert.equal(result.aidatOdenen['2026-10'],95500);
 assert.equal(Object.values(result.aidatOdenen).reduce((a,b)=>a+b,0),424022);
 assert.equal(result.toplamOdenen,495287);
 assert.equal(result.hareketler.length,19);
});
