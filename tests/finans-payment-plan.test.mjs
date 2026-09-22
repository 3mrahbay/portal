import test from 'node:test';
import assert from 'node:assert/strict';
import {odemePlani} from '../js/finans/core.js';
import {planGruplari,planTablosu,planDurumu} from '../js/finans/payment-plan.js';
test('parent plan groups advance, months and extras with correct paid states',()=>{
 const plan=odemePlani({aidatAyarlari:{onOdeme:100,baslangicAyi:'2026-09',taksitSayisi:2,aylikAidat:300,digerUcretler:{okulKiyafeti:50}},aylikOdemeler:{__onOdeme:{odenenTutar:100},'2026-09':{odenenTutar:50}},digerOdemeler:{okulKiyafeti:{odenenTutar:50}}},new Date('2026-09-22T12:00:00Z'));
 assert.deepEqual(planGruplari(plan).map(([name])=>name),['Ön ödeme','Aylık ödemeler','Diğer ödemeler']);
 assert.deepEqual(plan.satirlar.map(planDurumu),['Ödendi','Kısmen ödendi','Bekliyor','Ödendi']);
 assert.equal(plan.toplam,750);assert.equal(plan.odenen,200);assert.equal(plan.kalan,550);
 const html=planTablosu(plan);assert.match(html,/<tfoot>/);assert.match(html,/TOPLAM/);
 const custom={...plan,satirlar:[{...plan.satirlar[0],ad:'<img src=x onerror=alert(1)>'}]};
 assert.ok(!planTablosu(custom).includes('<img'));
});
