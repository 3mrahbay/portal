import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
import {mountGroups} from '../js/egitim-gruplari-ui.mjs';import {groupFixture} from '../qa/egitim-gruplari-fixture.mjs';
test('management UI filters, bulk assigns, moves and removes existing pupils without changing headcount',async()=>{
 const dom=new JSDOM('<div id="host"></div>');globalThis.document=dom.window.document;globalThis.confirm=()=>true;
 const host=document.getElementById('host'),f=groupFixture();await mountGroups(host,f.api,{students:f.students});
 const get=k=>host.querySelector('[data-'+k+']');assert.match(host.textContent,/4 öğrenci/);assert.equal(host.querySelectorAll('[data-child]').length,4);
 get('birth').value='2022';get('birth').onchange({target:get('birth')});assert.equal(host.querySelectorAll('[data-child]').length,2);
 get('select').onclick();get('target').value='g4';get('target').onchange({target:get('target')});await get('assign').onclick();
 assert.match(get('status').textContent,/1 atama güncellendi, 1 atama zaten aynıydı/);assert.equal([...f.records.keys()].filter(k=>k.startsWith('ogrenciler/')).length,4);
 assert.equal(f.writes.some(k=>k.startsWith('ogrenciler/')),false);assert.equal(f.records.get('ogrenciler/ege').sinif,'Papatyalar');
 get('select').onclick();get('target').value='g5';get('target').onchange({target:get('target')});await get('assign').onclick();
 assert.equal(f.records.get('egitimGrupUyelikleri/2026-2027__ingilizce__ege').grupId,'g5');
 get('select').onclick();await get('remove').onclick();assert.equal(f.records.get('egitimGrupUyelikleri/2026-2027__ingilizce__ege').grupId,'');
 assert.match(host.textContent,/4 öğrenci/);dom.window.close();
});
test('teacher cannot mount assignment controls',async()=>{
 const dom=new JSDOM('<div id="host"></div>');globalThis.document=dom.window.document;const f=groupFixture();f.api.state.rol='ingilizce_ogretmeni';
 const host=document.getElementById('host');await mountGroups(host,f.api,{students:f.students});assert.equal(host.querySelector('button'),null);assert.match(host.textContent,/yalnız okul yönetimi/);dom.window.close();
});
