import test from 'node:test';
import assert from 'node:assert/strict';
import {cariOzetleri} from '../js/finans/dashboard.js';
import {odemePlani} from '../js/finans/core.js';
test('student ledger includes overdue partial debt and dated extra items once',()=>{
 const plan=odemePlani({aidatAyarlari:{baslangicAyi:'2026-09',taksitSayisi:2,aylikAidat:100,sonOdemeGunu:10},aylikOdemeler:{'2026-09':{odenenTutar:40}},digerOdemeler:{kirtasiye:{tutar:25,vadeTarihi:'2026-09-15'}}},new Date('2026-09-21T12:00:00Z'));
 const rows=cariOzetleri({ogrenciler:[{id:'s1',ad:'Öğrenci',veli:'Veli',sinif:'A',plan}]},'2026-09');
 assert.equal(rows.length,1);assert.equal(rows[0].beklenen,225);assert.equal(rows[0].odenen,40);assert.equal(rows[0].kalan,185);assert.equal(rows[0].buay,85);assert.equal(rows[0].geciken,85);assert.equal(rows[0].durum,'kismi');assert.equal(rows[0].gecikmis,true);
});
test('empty plan is distinct from paid and numeric balances preserve cents',()=>{
 const paid=odemePlani({digerOdemeler:{kiyafet:{tutar:10.25,odenenTutar:10.25}}});
 const rows=cariOzetleri({ogrenciler:[{id:'empty',plan:odemePlani({})},{id:'paid',plan:paid}]},'2026-09');
 assert.equal(rows[0].durum,'tanimsiz');assert.equal(rows[1].durum,'odendi');assert.equal(rows[1].odenen,10.25);assert.equal(rows[1].kalan,0);
});
