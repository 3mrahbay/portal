import test from 'node:test';
import assert from 'node:assert/strict';
import {gecerliTarih} from '../js/finans/core.js';
import {okulFinansOzeti} from '../js/finans/school-summary.js';

const now=new Date('2026-10-09T10:00:00Z');
function student(date){
 return [{
  id:'test',
  veri:{
   aidatAyarlari:{onOdeme:37000},
   aylikOdemeler:{__onOdeme:{odenenTutar:37000,odendi:true,odemeTarihi:date}}
  }
 }];
}
test('gecersiz 0006 yilini yeni gercek tahsilat tarihi olarak kabul etmez',()=>{
 assert.equal(gecerliTarih('0006-08-10',now),false);
 assert.equal(gecerliTarih('2026-08-10',now),true);
});
test('gecersiz tarihi aylik nakit tahsilata yazmaz, tahsilati silmez',()=>{
 const report=okulFinansOzeti(student('0006-08-10'),now);
 assert.equal(report.nakitAylar['0006-08'],undefined);
 assert.equal(report.tarihsizTahsilat,37000);
 assert.equal(report.toplamOdenen,37000);
 assert.equal(report.toplamBeklenen,37000);
 assert.equal(report.toplamKalan,0);
});
test('gercek tarih duzeltildiginde sadece nakit ayi degisir, bakiye korunur',()=>{
 const report=okulFinansOzeti(student('2026-08-10'),now);
 assert.equal(report.nakitAylar['2026-08'],37000);
 assert.equal(report.tarihsizTahsilat,0);
 assert.equal(report.toplamOdenen,37000);
 assert.equal(report.toplamKalan,0);
});
