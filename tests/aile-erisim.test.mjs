import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = {};
vm.runInNewContext(fs.readFileSync(new URL('../moduller/veli-katilim.js', import.meta.url), 'utf8').replace(/export\s+/g, ''), context);
const child = id => ({id, ad:'Aynı Soyad', sinif:'A'});
const parent = (ids, extra={}) => ({cocuklar:ids.map(child), eposta:'test@example.invalid', aktifOgrenci:true, ...extra});
const run = (children, parents) => context.aileErisimKayitlari(children.map(child), parents);
test('one active parent prevents a false inactive family; siblings remain separate',()=>{
 const result=run(['a','b'],[parent(['a','b'],{sonGorulme:new Date()}),parent(['a'])]);
 assert.equal(result.length,2); assert.ok(result.every(r=>r.durum==='hareket'));
});
test('missing email and missing telemetry remain distinct, including children without parents',()=>{
 const result=run(['a','b','c'],[parent(['a']),parent(['b'],{eposta:''})]);
 assert.equal(result[0].durum,'kayityok'); assert.equal(result[1].durum,'epostaeksik'); assert.equal(result[2].durum,'epostaeksik');
});
test('alternate email activity is retained and flagged instead of falsely counting no access',()=>{
 const result=run(['a'],[parent(['a'],{aktifOgrenci:false,zeky:2})])[0];
 assert.equal(result.durum,'hareket');assert.equal(result.eslesmeKontrol,true);assert.equal(result.zeky,true);assert.equal(result.portal,false);
});
test('same names do not merge students and old counters count as positive evidence',()=>{
 const result=run(['a','b'],[parent(['a'],{oz:{girisSayisi:2}})]);
 assert.equal(result[0].durum,'hareket');assert.equal(result[1].durum,'epostaeksik');
});
test('last login alone is evidence without inventing a platform',()=>{
 const result=run(['a'],[parent(['a'],{sonGiris:new Date()})])[0];
 assert.equal(result.durum,'hareket');assert.equal(result.portal,false);assert.equal(result.zeky,false);
});

test('family scope requires a current period record even if missing records default to active',()=>{
 const state={ogrenciList:[child('current'),child('old'),child('inactive')],ayarListesi:{current:{},inactive:{durum:'pasif'}}};
 const result=context.aileErisimOgrencileri(state,(_,settings)=>settings?.durum || 'aktif');
 assert.equal(result.length,1);assert.equal(result[0].id,'current');
});
