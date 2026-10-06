// Offline release delivery checks: no production requests or browser/account use.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { installedPwa, assertPwaBootstrap, assertPrecachedImport, readPortal } from './helpers/portal-pwa.mjs';
const origin='https://portal.example.invalid/';
const edges=[
 ['index.html','js/bunny-stream-upload.js'],
 ['index.html','js/portal-galeri-klasor-ui.js'],
 ['index.html','js/zeky-randevu-modal-koprusu.js'],
 ['js/zeky-randevu-modal-koprusu.js','js/zeky-galeri-filigran-koprusu.js'],
 ['js/zeky-galeri-filigran-koprusu.js','js/portal-galeri-canli.js'],
 ['js/portal-galeri-klasor-ui.js','js/portal-galeri-canli.js'],
 ['js/portal-galeri-canli.js','js/portal-galeri-medya.js'],
 ['moduller/veli-galeri.js','js/portal-galeri-canli.js'],
 ['moduller/veli-galeri.js','js/portal-galeri-medya.js'],
];
for(const [importer,target] of edges) test(`media release installs exact v188 edge ${importer} -> ${target}`,async()=>{
 const pwa=await installedPwa(),url=assertPrecachedImport(pwa,importer,target);
 assert.equal(url.search,'?v=188');
});
test('media release runtime, service worker registration, reload guard and cache generation agree',async()=>{
 const pwa=await installedPwa();await assertPwaBootstrap(pwa);
 assert.equal(pwa.cacheVersion,'v188-media-delivery');
 assert.ok(readPortal('index.html').includes('window.PORTAL_SURUM = "v188";'));
});
test('actual parent gallery dynamic loader matches the one installed parent-gallery URL',async()=>{
 const html=readPortal('index.html'),start=html.indexOf('const _yuklenenModuller = {}'),end=html.indexOf('\n};',start)+3;
 assert.ok(start>=0&&end>start);
 const requests=[],window={PORTAL_SURUM:'v188'};
 vm.runInNewContext(html.slice(start,end).replace('await import(', 'await captureImport('),{window,console,captureImport:async url=>{requests.push(url);return {synthetic:true};}});
 await window.modulYukle('veli-galeri');await window.modulYukle('veli-galeri');
 assert.deepEqual(requests,['./moduller/veli-galeri.js?v=v188']);
 const urls=(await installedPwa()).precache.filter(url=>new URL(url,origin).pathname==='/moduller/veli-galeri.js');
 assert.deepEqual(urls,requests);
});
test('every service-worker precache path exists and each changed media asset has one exact URL',async()=>{
 const {precache}=await installedPwa();
 for(const specifier of precache){
  const url=new URL(specifier,origin);assert.equal(url.origin,new URL(origin).origin);
  const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
  assert.ok(fs.statSync(new URL('../'+path,import.meta.url)).isFile(),`missing local precache asset ${path}`);
 }
 for(const target of new Set(edges.map(x=>x[1]).concat('moduller/veli-galeri.js'))){
  assert.equal(precache.filter(url=>new URL(url,origin).pathname==='/'+target).length,1,`duplicate or absent ${target}`);
 }
});
