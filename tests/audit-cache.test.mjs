import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../serviceworker.js',import.meta.url),'utf8');
function worker({cacheMatch=async()=>undefined,fetcher=async()=>{throw Error('offline')},keys=[]}={}) {
 const listeners={},deleted=[],puts=[];
 const ctx={URL,Response,console,fetch:fetcher,self:{location:{origin:'https://portal.example.invalid'},addEventListener:(name,fn)=>listeners[name]=fn,skipWaiting(){},clients:{claim(){}}},caches:{match:cacheMatch,keys:async()=>keys,delete:async key=>{deleted.push(key);return true},open:async()=>({put:async(...args)=>puts.push(args),addAll:async()=>{}})}};
 vm.runInNewContext(source,ctx);return {listeners,deleted,puts};
}
const request=(path,extra={})=>({url:new URL(path,'https://portal.example.invalid').href,method:'GET',mode:'cors',destination:'script',...extra});
test('service worker never intercepts remote photos, attachments or API responses',()=>{
 const w=worker();for(const url of ['https://cdn.example.invalid/private.jpg','https://api.example.invalid/export.pdf','https://www.gstatic.com/firebasejs/a.js']) {
  let intercepted=false;w.listeners.fetch({request:request(url),respondWith(){intercepted=true}});assert.equal(intercepted,false);
 }
});
test('same-origin private media is not cached',()=>{
 const w=worker();let intercepted=false;w.listeners.fetch({request:request('/uploads/student.jpg',{destination:'image'}),respondWith(){intercepted=true}});assert.equal(intercepted,false);
});
test('offline missing JavaScript returns 503, never HTML',async()=>{
 const w=worker({cacheMatch:async key=>key==='./index.html'?new Response('<html>shell</html>'):undefined});let pending;
 w.listeners.fetch({request:request('/missing.js'),respondWith(p){pending=p}});const r=await pending;assert.equal(r.status,503);assert.ok(!(await r.text()).includes('<html>'));
});
test('offline navigation can still use the app shell',async()=>{
 const w=worker({cacheMatch:async key=>key==='./index.html'?new Response('<html>shell</html>'):undefined});let pending;
 w.listeners.fetch({request:request('/page.html',{mode:'navigate',destination:'document'}),respondWith(p){pending=p}});assert.equal(await (await pending).text(),'<html>shell</html>');
});
test('stylesheets use the current network response',async()=>{
 const w=worker({cacheMatch:async()=>new Response('old'),fetcher:async()=>new Response('new')});let pending;
 w.listeners.fetch({request:request('/portal-stil.css',{destination:'style'}),respondWith(p){pending=p}});assert.equal(await (await pending).text(),'new');
});
test('activation only removes obsolete Portal caches',async()=>{
 const w=worker({keys:['unrelated-app','bircicek-portal-old','bircicek-portal-v162-audit-cache']});let pending;
 w.listeners.activate({waitUntil(p){pending=p}});await pending;assert.deepEqual(w.deleted,['bircicek-portal-old']);
});
