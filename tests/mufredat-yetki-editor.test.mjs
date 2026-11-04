import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const source=fs.readFileSync(new URL('../portal-mufredat.js',import.meta.url),'utf8').replace(/^import .*\n/,'').replace('export async function ac()', 'async function ac()');
const base=[{id:'stable',ad:'Alan',ikon:'🌱',renk:'#123456',gruplar:[{ad:'Grup',dersler:['Eski']}]}];
function fixture(){
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;let allowed=false;const calls=[],messages=[];
 w.BCK={escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),DISIPLINLER:()=>[{id:'montessori',ad:'Montessori'}],mufredatCacheAta:()=>{}};
 w.confirm=()=>true;w.showToast=(...x)=>messages.push(x);w.mufredatIslem=async data=>{
  calls.push(JSON.parse(JSON.stringify(data)));
  if(data.action==='status')return {allowed};
  if(!allowed)throw Error('Yetki kapalı');
  if(data.action==='load')return {alanlar:structuredClone(base)};
  return {saved:true};
 };
 vm.runInContext(source+'\nwindow.openEditor=ac;',dom.getInternalVMContext());
 return {w,dom,calls,messages,setAllowed:v=>allowed=v};
}
test('closed permission blocks opening; granted teacher can add, edit and remove, preserving baseline',async()=>{
 const f=fixture();await assert.rejects(f.w.openEditor(),/yetkiniz kapalı/);assert.equal(f.w.document.getElementById('mufredatEditorModal'),null);
 f.setAllowed(true);await f.w.openEditor();
 f.w.mufredatAdDegistir('alan',0,-1,-1,'Yeni Alan');f.w.mufredatAdDegistir('ders',0,0,0,'Yeni');
 f.w.mufredatEkle('ders',0,0);f.w.mufredatSil('ders',0,0,1);
 await f.w.mufredatKaydetVeKapat();
 const payload=f.calls.find(x=>x.action==='save').changes[0];assert.deepEqual(payload.base,base);assert.equal(payload.alanlar[0].id,'stable');assert.equal(payload.alanlar[0].ad,'Yeni Alan');assert.deepEqual(payload.alanlar[0].gruplar[0].dersler,['Yeni']);assert.equal(payload.tasimalar.length,1);
 assert.equal(f.w.document.getElementById('mufredatEditorModal').style.display,'none');f.dom.window.close();
});
test('revocation after opening keeps edits visible and reports save failure',async()=>{
 const f=fixture();f.setAllowed(true);await f.w.openEditor();f.w.mufredatAdDegistir('ders',0,0,0,'Yeni');f.setAllowed(false);
 await f.w.mufredatKaydetVeKapat();assert.notEqual(f.w.document.getElementById('mufredatEditorModal').style.display,'none');assert.match(f.messages.at(-1)[0],/Yetki kapalı/);f.dom.window.close();
});
test('permission switch writes only the flag and rolls back on denied writes',async()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const start=html.indexOf('window.personelMufredatYetkiKaydet =');const code=html.slice(start,html.indexOf('\n};',start)+3);
 const writes=[];let denied=false;const input={checked:true,disabled:false};
 const ctx={window:{},document:{getElementById:()=>({value:'t@example.test'})},db:{},doc:(_,...path)=>path,personelListesi:[{id:'t@example.test',rol:'ogretmen'}],showToast:()=>{},runTransaction:async(_db,fn)=>{if(denied)throw Error('denied');await fn({get:async()=>({exists:()=>true,data:()=>({rol:'ogretmen'})}),update:(ref,data)=>writes.push({ref,data})});}};
 vm.runInNewContext(code,ctx);await ctx.window.personelMufredatYetkiKaydet(input);assert.deepEqual(JSON.parse(JSON.stringify(writes)),[{ref:['personeller','t@example.test'],data:{mufredatDuzenleme:true}}]);
 denied=true;input.checked=false;await ctx.window.personelMufredatYetkiKaydet(input);assert.equal(input.checked,true);assert.equal(input.disabled,false);
});
