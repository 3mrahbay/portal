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
test('group draft, target and hidden selections survive search, filters and selection actions',async()=>{
 const dom=new JSDOM('<div id="host"></div>');globalThis.document=dom.window.document;
 const host=document.getElementById('host'),f=groupFixture();await mountGroups(host,f.api,{students:f.students});
 const get=k=>host.querySelector('[data-'+k+']');
 get('edit').value='g4';get('edit').onchange();
 get('name').value='Taslak grup';get('name').oninput({target:get('name')});
 get('active').checked=false;get('active').onchange({target:get('active')});
 get('target').value='g5';get('target').onchange({target:get('target')});
 get('select').onclick();
 get('search').value='Ada';get('search').oninput({target:get('search')});
 assert.equal(get('name').value,'Taslak grup');assert.equal(get('edit').value,'g4');assert.equal(get('active').checked,false);
 assert.equal(get('teacher').value,'english@example.test');assert.equal(get('target').value,'g5');
 assert.match(get('selected').textContent,/4 öğrenci seçili · 3 seçim filtre dışında/);
 get('birth').value='2021';get('birth').onchange({target:get('birth')});
 assert.match(host.textContent,/uygun öğrenci bulunamadı/);assert.equal(get('name').value,'Taslak grup');
 get('clear').onclick();assert.equal(get('assign').disabled,true);assert.equal(get('name').value,'Taslak grup');
 assert.equal(f.writes.length,0);dom.window.close();
});
test('closing and reopening retains draft; clearing and session changes remount safely',async()=>{
 const dom=new JSDOM('<button id="egitimGruplariAc"></button><div id="egitimGruplariPanel" hidden></div>');globalThis.document=dom.window.document;globalThis.window=dom.window;
 const f=groupFixture();f.api.state.ogrenciList=f.students;f.api.state.ayarListesi=Object.fromEntries(f.students.map(s=>[s.id,{}]));f.api.ogrenciDurum=()=> 'aktif';window.PortalAPI=f.api;
 const {open,clear}=await import('../moduller/egitim-gruplari.js');
 await Promise.all([open(),open()]);const host=document.getElementById('egitimGruplariPanel');
 const input=host.querySelector('[data-name]');input.value='Korunacak taslak';input.oninput({target:input});
 host.querySelector('[data-close]').click();assert.equal(host.hidden,true);
 await open();assert.equal(host.hidden,false);assert.equal(host.querySelector('[data-name]'),input);
 await open();assert.equal(host.hidden,true);await open();assert.equal(host.querySelector('[data-name]').value,'Korunacak taslak');
 clear();await open();assert.equal(host.querySelector('[data-name]').value,'');
 f.api.state.aktifDonem='2027-2028';await open();assert.match(host.textContent,/2027-2028/);
 dom.window.close();delete globalThis.window;
});
test('clearing during loading prevents late responses from reopening the panel',async()=>{
 const dom=new JSDOM('<button id="egitimGruplariAc"></button><div id="egitimGruplariPanel" hidden></div>');globalThis.document=dom.window.document;globalThis.window=dom.window;
 const f=groupFixture();f.api.state.ogrenciList=f.students;f.api.state.ayarListesi=Object.fromEntries(f.students.map(s=>[s.id,{}]));f.api.ogrenciDurum=()=> 'aktif';window.PortalAPI=f.api;
 const original=f.api.fb.getDocs;let release;f.api.fb.getDocs=async q=>{await new Promise(resolve=>release=resolve);return original(q);};
 const {open,clear}=await import('../moduller/egitim-gruplari.js');const loading=open();clear();release();await loading;
 const host=document.getElementById('egitimGruplariPanel');assert.equal(host.hidden,true);assert.equal(host.children.length,0);dom.window.close();delete globalThis.window;
});
