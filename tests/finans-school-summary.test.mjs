import test from 'node:test';
import assert from 'node:assert/strict';
import {okulFinansOzeti,sonAyKodlari} from '../js/finans/school-summary.js';
const NOW=new Date('2026-10-08T12:00:00Z');
const mkStudent = (id,veri)=>({id,veri});

test('one July bank transfer allocated to ten school months is not October cash',()=>{
  const monthly={};
  for (const month of sonAyKodlari('2027-06',10)) monthly[month]={beklenenTutar:31500,odenenTutar:31500,odendi:true,odemeTarihi:'2026-07-23',kaynakTahsilatId:'havale-20260723'};
  const data=okulFinansOzeti([mkStudent('student1',{aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:10,aylikAidat:31500},aylikOdemeler:monthly})],NOW);
  assert.equal(data.toplamBeklenen,315000);
  assert.equal(data.toplamOdenen,315000);
  assert.equal(data.buAyAidataIslenen,31500);
  assert.equal(data.buAyAidatBeklenen,31500);
  assert.equal(data.buAyOdeyen,1);
  assert.equal(data.buAyNakit,0);
  assert.equal(data.nakitAylar['2026-07'],315000);
  assert.equal(data.aidatOdenen['2027-06'],31500);
  assert.equal(data.toplamKalan,0);
});

test('do not assume date was corrected if legacy record still says October',()=>{
  const v={aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:1,aylikAidat:31500},aylikOdemeler:{'2026-09':{odenenTutar:31500,odemeTarihi:'2026-10-08'}}};
  const data=okulFinansOzeti([mkStudent('s',v)],NOW);
  assert.equal(data.nakitAylar['2026-10'],31500);
  assert.equal(data.nakitAylar['2026-07']||0,0);
  assert.equal(data.aidatOdenen['2026-09'],31500);
});

test('explicit zero installment and missing months have correct plan and overdue',()=>{
  const v={aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:3,aylikAidat:100},aylikOdemeler:{'2026-09':{beklenenTutar:0},'2026-10':{odenenTutar:40,odemeTarihi:'2026-10-07'}}};
  const data=okulFinansOzeti([mkStudent('s',v)],new Date('2026-11-20T12:00:00Z'));
  assert.equal(data.aidatBeklenen['2026-09'],0);
  assert.equal(data.aidatBeklenen['2026-10'],100);
  assert.equal(data.aidatBeklenen['2026-11'],100);
  assert.equal(data.toplamBeklenen,200);
  assert.equal(data.toplamKalan,160);
  assert.equal(data.gecikenTutar,60); // existing grace policy: November due on 15 December
});

test('movement reversals are not counted twice and undated legacies are quarantined',()=>{
  const v={aidatAyarlari:{baslangicAyi:'2026-10',gercekAySayisi:1,aylikAidat:100,onOdeme:20},aylikOdemeler:{
    '2026-10':{odenenTutar:75,hareketler:[{id:'a',tutar:100,tarih:'2026-10-05'},{id:'b',tutar:-25,tarih:'2026-10-06'}]},
    '__onOdeme':{odenenTutar:20,odendi:true}
  }};
  const data=okulFinansOzeti([mkStudent('s',v)],NOW);
  assert.equal(data.toplamBeklenen,120);
  assert.equal(data.toplamOdenen,95);
  assert.equal(data.nakitAylar['2026-10'],75);
  assert.equal(data.tarihsizTahsilat,20);
  assert.equal(data.hareketler.length,3);
  assert.deepEqual(data.uyarilar,[]);
});

test('cash dates are validated and installment counts do not extend beyond agreed schedule',()=>{
  const v={aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:2,aylikAidat:100},aylikOdemeler:{'2026-09':{odenenTutar:100,odemeTarihi:'2026-13-32'}}};
  const data=okulFinansOzeti([mkStudent('s',v)],NOW);
  assert.equal(data.aidatBeklenen['2026-11'],undefined);
  assert.equal(data.tarihsizTahsilat,100);
  assert.deepEqual(sonAyKodlari('2026-10',7),['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']);
});
