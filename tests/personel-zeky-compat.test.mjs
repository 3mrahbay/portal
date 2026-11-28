// ZEKY_REPO_PATH points to the companion checkout. No Firebase/production access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {gunuHesapla,okulGunu} from '../js/personel-puantaj-core.js';
const repo=process.env.ZEKY_REPO_PATH;
const read=p=>readFileSync(path.join(repo,p),'utf8');
const moduleFrom=s=>import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
test('Portal–ZEKY shared decision and attendance modules are identical',{skip:!repo},()=>{
 for(const name of ['personel-izin-karar.js','personel-puantaj-core.js'])assert.equal(read('www/js/'+name),readFileSync(new URL('../js/'+name,import.meta.url),'utf8'));
});
test('ZEKY raw daily totals agree with Portal before monthly rounding',{skip:!repo},()=>{
 const source=read('www/js/zeky-data.js'),start=source.indexOf('export function gunlukNetHesapla');
 const code=source.slice(start,source.indexOf('\n}\n',start)+2).replace('export ','');
 const calc=new Function('gunuHesapla','okulGunu',code+';return gunlukNetHesapla;')(gunuHesapla,okulGunu);
 const records=['01','02','03'].flatMap(day=>[{tarih:`2026-10-${day}`,tip:'giris',zaman:`2026-10-${day}T05:00:00Z`},{tarih:`2026-10-${day}`,tip:'cikis',zaman:`2026-10-${day}T06:00:25Z`}]);
 const days=Object.values(calc(records));assert.equal(Math.round(days.reduce((n,d)=>n+d.netDk,0)),181);
 assert.equal(days[0].netDk,gunuHesapla(records.slice(0,2),false).net);
});
test('ZEKY rejection dialog validates, preserves failed reason and retries',{skip:!repo},async()=>{
 const dom=new JSDOM('<button id="origin">Aç</button>');globalThis.document=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const {izinRetDialogu}=await moduleFrom(read('www/js/personel-izin-ui.js'));
 let tries=0;const done=izinRetDialogu(async note=>{assert.equal(note,'Geçerli gerekçe');if(++tries===1)throw Error('Çevrimdışı');});
 const form=document.querySelector('form'),area=document.querySelector('textarea');
 area.value='a';await form.onsubmit({preventDefault(){}});assert.equal(tries,0);
 area.value='Geçerli gerekçe';await form.onsubmit({preventDefault(){}});
 assert.match(document.querySelector('[role=alert]').textContent,/Çevrimdışı/);assert.equal(area.value,'Geçerli gerekçe');assert.equal(area.disabled,false);
 await form.onsubmit({preventDefault(){}});assert.equal(await done,true);assert.equal(document.querySelector('dialog'),null);
 const cancel=izinRetDialogu(async()=>assert.fail('Cancelled dialog must not write'));document.querySelector('[data-vazgec]').click();assert.equal(await cancel,false);dom.window.close();
});
test('ZEKY confirmation keeps malicious document IDs out of executable attributes',{skip:!repo},()=>{
 const dom=new JSDOM('<body></body>'),{window}=dom,{document}=window;
 const source=read('www/yonetim-izin-onay.html');const start=source.indexOf('window.onaySheetAc =');const code=source.slice(start,source.indexOf('window.kararUygula =',start));
 const escaped=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 new Function('window','document','htmlGuvenli',code)(window,document,escaped);
 const hostile="id');alert('injected');//";let received;
 window.kararUygula=(...args)=>{received=args;};window.onaySheetAc(hostile,{personelAd:'<img src=x onerror=alert(1)>',etkiMetin:'<script>alert(1)</script>'});
 assert.equal(document.querySelector('img,script'),null);
 for(const el of document.querySelectorAll('[onclick]'))assert.doesNotMatch(el.getAttribute('onclick'),/injected/);
 document.querySelector('[data-onay-etki=false]').click();assert.deepEqual(received,[hostile,'onaylandi',false]);dom.window.close();
});
