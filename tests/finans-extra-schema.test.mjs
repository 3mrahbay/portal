import test from 'node:test';
import assert from 'node:assert/strict';
import {odemePlani,kartOzeti,tahsilatUygula,tersKayitUygula} from '../js/finans/core.js';
const now=new Date('2026-09-22T12:00:00Z');
const row=(v,key)=>odemePlani(v,now).satirlar.find(r=>r.id==='diger-'+key);
test('portal fee definitions exist even before collection records',()=>{
 const v={aidatAyarlari:{digerUcretler:{egitimMateryali:36000,okulKiyafeti:14700}},digerOdemeler:{}};
 assert.equal(row(v,'egitimMateryali').beklenen,36000);
 assert.equal(row(v,'okulKiyafeti').durum,'bekliyor');
 assert.equal(odemePlani(v,now).toplam,50700);
});
test('portal paid buttons and partial payments use agreed extra fees',()=>{
 const v={aidatAyarlari:{digerUcretler:{egitimMateryali:36000,okulKiyafeti:14700}},digerOdemeler:{egitimMateryali:{tutar:0,beklenenTutar:36000,odenenTutar:36000,odendi:true},okulKiyafeti:{odenenTutar:'7000'}}};
 assert.equal(row(v,'egitimMateryali').durum,'odendi');
 assert.equal(row(v,'okulKiyafeti').kalan,7700);
 assert.equal(kartOzeti(v,now).ekler[0].durum,'odendi');
 assert.equal(odemePlani(v,now).odenen,43000);
});
test('explicit zero fees and payments never fall back to old positive amounts',()=>{
 const v={aidatAyarlari:{digerUcretler:{okulKiyafeti:0,egitimMateryali:100}},digerOdemeler:{okulKiyafeti:{tutar:500,beklenenTutar:600},egitimMateryali:{odendi:true,odenenTutar:0}}};
 assert.equal(row(v,'okulKiyafeti').beklenen,0);
 assert.equal(row(v,'egitimMateryali').odenen,0);
});
test('legacy extra records retain both supported amount fields and paid flags',()=>{
 const v={digerOdemeler:{a:{beklenenTutar:250,tutar:0,odendi:true},b:{tutar:100,odendi:true}}};
 assert.equal(odemePlani(v,now).odenen,350);
 assert.equal(odemePlani({aidatAyarlari:{digerOdemeler:v.digerOdemeler}},now).odenen,350);
});
test('approval and reversal work for a defined fee without an existing collection',()=>{
 const v={aidatAyarlari:{digerUcretler:{okulKiyafeti:1000,egitimMateryali:2000}},digerOdemeler:{}};
 const original=structuredClone(v);
 const b={durum:'bekliyor',kalemTipi:'diger-okulKiyafeti',tutar:1000,odemeTarihi:'2026-09-22'};
 const u=tahsilatUygula(v,b,'payment','staff',now);
 const updated={...v,[u.field]:u.values};
 assert.equal(row(updated,'okulKiyafeti').durum,'odendi');
 assert.equal(row(updated,'egitimMateryali').kalan,2000);
 const r=tersKayitUygula(updated,{...b,durum:'onaylandi',tahsilatIslendi:true},'payment',{tur:'iade',tarih:'2026-09-22',neden:'Kısmi iade',tutar:250,islemId:'ters_test'},now);
 assert.equal(row({...updated,[r.field]:r.values},'okulKiyafeti').kalan,250);
 assert.deepEqual(v,original);
});
