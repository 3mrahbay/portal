import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {panelRender,panelDurdur} from '../moduller/personel-puantaj.js';
function setup(role='mudur',getDocs=async()=>({docs:[]})) {
 const dom=new JSDOM('<!doctype html><div id="ozlukAraclar"></div><div id="content"></div>');
 globalThis.window=dom.window;globalThis.document=dom.window.document;
 window.PortalAPI={state:{rol:role},db:{},fb:{collection:()=>({}),query:()=>({}),where:()=>({}),getDocs}};
 return dom;
}
test('yetkisiz rol sorgu başlatamaz',async()=>{let reads=0;const d=setup('ogretmen',()=>{reads++;});await panelRender('content',[],'2026-11');assert.equal(reads,0);assert.match(document.body.textContent,/yetkiniz yok/);d.window.close();});
test('okuma hatası sıfır sonuç gibi sunulmaz',async()=>{const d=setup('mudur',async()=>{throw Error('denied')});await panelRender('content',[],'2026-11');assert.match(document.querySelector('[role=alert]').textContent,/Eksik veriyle rapor üretilmedi/);assert.equal(document.querySelector('[data-export]'),null);d.window.close();});
test('eski sorgu yeni sekmenin içeriğini ezmez',async()=>{let done;const d=setup('mudur',()=>new Promise(r=>done=r));const p=panelRender('content',[],'2026-11');panelDurdur();document.getElementById('content').textContent='Diğer sekme';done({docs:[]});await p;assert.equal(document.getElementById('content').textContent,'Diğer sekme');d.window.close();});
test('isim HTML olarak yürütülmez ve arama filtreyi korur',async()=>{const d=setup();await panelRender('content',[{email:'a@test',adSoyad:'<img src=x onerror=alert(1)>'},{email:'b@test',adSoyad:'Örnek'}],'2026-11');assert.equal(document.querySelector('img'),null);const input=document.querySelector('input[type=search]');input.value='Örnek';input.dispatchEvent(new window.Event('input'));assert.equal(document.querySelectorAll('article').length,1);d.window.close();});
