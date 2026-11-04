import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('let aktifLightboxOge = null;');
const end=source.indexOf('window.galeriLightboxIndir =',start);
const handler=source.match(/onclick="([^"]+)" id="galeriLightboxDuzenleBtn"/)[1];
function setup(role='mudur') {
 const elements=new Map(), writes=[], notices=[], sync=[];
 const items=[{id:'pending-A',durum:'beklemede',dosyaTipi:'foto',bunnyUrl:'https://example.invalid/a.jpg',etkinlikBaslik:'A',aciklama:'old'},
 {id:'pending-B',durum:'onayBekliyor',dosyaTipi:'foto',bunnyUrl:'https://example.invalid/b.jpg'}];
 const context=vm.createContext({console,setTimeout:()=>{},galeriListesiVerisi:items,galeriOnayGezinmeSurumu:0,
 isAdmin:false,aktifKullaniciRol:role,db:{},escapeHtml:x=>x,galleryText:x=>x.trim(),galeriProgramKodu:m=>m.program||'',
 document:{getElementById(id){if(!elements.has(id))elements.set(id,{style:{},classList:{add(){},remove(){}},innerHTML:''});return elements.get(id);}},
 showToast:(...args)=>notices.push(args),prompt:()=>{throw Error('unexpected editor prompt');},
 doc:(_db,_collection,id)=>({id}),updateDoc:async(ref,data)=>writes.push({ref,data}),
 galeriGozlemOnayiEsitle:async(...args)=>sync.push(args),renderGaleri:async()=>{}});
 context.window=context;
 // IIFE reproduces module-private state without exposing it to inline handlers.
 vm.runInContext('(function(){'+source.slice(start,end)+'})()',context);
 return {context,items,elements,writes,notices,sync,click:()=>vm.runInContext(handler,context)};
}
test('inline edit opens the currently selected pending item and clears on close',async()=>{
 const s=setup(),ids=[];s.context.galeriGonderiDuzenle=id=>ids.push(id);
 assert.equal(s.context.aktifLightboxOge,undefined);
 s.context.acGaleriLightbox('pending-A');s.click();
 s.context.acGaleriLightbox('pending-B');s.click();
 s.context.closeGaleriLightbox();s.click();
 assert.deepEqual(ids,['pending-A','pending-B']);
});
test('teacher and parent cannot edit through direct invocation',async()=>{
 for(const role of ['ogretmen','veli']){
  const s=setup(role);s.context.acGaleriLightbox('pending-A');await s.click();
  assert.equal(s.elements.get('galeriLightboxDuzenleBtn').style.display,'none');
  assert.equal(s.writes.length,0);assert.match(s.notices[0][0],/yetkiniz yok/);
 }
});
test('management edit saves text while preserving pending approval',async()=>{
 const s=setup();const answers=['Updated title','Updated description',''];
 s.context.prompt=()=>answers.shift();
 s.context.acGaleriLightbox('pending-A');await s.click();
 assert.equal(s.writes.length,1);
 assert.equal(s.writes[0].ref.id,'pending-A');
 assert.equal(s.writes[0].data.aciklama,'Updated description');
 assert.equal('durum' in s.writes[0].data,false);
 assert.equal(s.items[0].durum,'beklemede');
 assert.equal(s.sync[0][1],'beklemede');
});
