import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as folders from '../js/galeri-klasorleri.js';
const source=readFileSync(new URL('../js/portal-galeri-klasor-ui.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export function ','function ');
const row=(id,more={})=>({id,program:'drama',etkinlikBaslik:'Kukla Masalı',hedefTur:'sinif',hedefDeger:'Test Sınıfı',donem:'2026-2027',dosyaTipi:'foto',durum:'onaylandi',...more});
function runtime(items){
 class Host{constructor(){this._html='';this.nodes=null;}set innerHTML(v){this._html=v;this.nodes=null;}get innerHTML(){return this._html;}insertAdjacentHTML(_where,html){this.innerHTML+=html;}querySelectorAll(selector){if(!this.nodes){this.nodes=[...this._html.matchAll(/<[^>]+\s(data-[\w-]+)(?:="([^"]*)")?[^>]*>/g)].map(m=>({key:m[1],dataset:{[m[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:m[2]||''},style:{}}));}return this.nodes.filter(n=>selector==='['+n.key+']');}querySelector(s){return this.querySelectorAll(s)[0]||null;}}
 const host=new Host(),calls={mount:[],zip:[],add:[],approve:[],reject:[],deleted:[],dispose:[]};
 const ctx=vm.createContext({...folders,console,window:{silGaleriOge:id=>calls.deleted.push(id),galeriOnayla:id=>calls.approve.push(id),galeriReddet:id=>calls.reject.push(id)},mountMedia:(el,m,opts)=>calls.mount.push({id:m.id,opts}),disposeMedia:h=>calls.dispose.push(h),refreshGalleryCards(){},downloadAlbum:(...a)=>calls.zip.push(a)});
 vm.runInContext(source+'\nglobalThis.createView=createGalleryFolderView;',ctx);const view=ctx.createView();const options={management:true,activePeriod:'2026-2027',addProgram:p=>calls.add.push(p),addTopic:m=>calls.add.push(m)};view.render(host,items,options);
 return {host,view,calls,options,click:(attr,index=0)=>{const el=host.querySelectorAll('['+attr+']')[index];assert.ok(el,attr);el.onclick();},render:rows=>view.render(host,rows,options)};
}
test('management program/topic navigation keeps audience and period groups, renders mixed media, and back resets',()=>{
 const rows=[row('photo'),row('video',{dosyaTipi:'video',durum:'beklemede'}),row('other-class',{hedefDeger:'Other'}),row('old-period',{donem:'2025-2026'})];
 const r=runtime(rows);assert.equal(r.host.querySelectorAll('[data-program-index]').length,8);r.click('data-program-index',6);assert.equal(r.host.querySelectorAll('[data-folder-index]').length,3);r.click('data-folder-index');
 assert.equal(r.host.querySelectorAll('[data-folder-media]').length,2);assert.deepEqual(r.calls.mount.map(x=>x.id),['photo','video']);r.click('data-approve');assert.deepEqual(r.calls.approve,['video']);r.click('data-reject');assert.deepEqual(r.calls.reject,['video']);
 r.click('data-folder-delete');assert.deepEqual(r.calls.deleted,['photo']);r.click('data-folder-add');assert.equal(r.calls.add[0].id,'photo');r.click('data-folder-download');assert.equal(r.calls.zip[0][4].folderKey,folders.galleryFolderKey(rows[0]));assert.equal(r.calls.zip[0][4].program,'drama');
 r.click('data-folder-back');assert.equal(r.host.querySelectorAll('[data-folder-index]').length,3);r.click('data-folder-back');assert.equal(r.host.querySelectorAll('[data-program-index]').length,8);assert.ok(r.calls.dispose.length>=5);
});
test('hostile topic text and IDs stay escaped; program creation has no stale topic; removed folder returns safely',()=>{
 const evil=row('id"/><img src=x>',{etkinlikBaslik:`Kukla ' " <img src=x onerror=alert(1)> \\ 🧩`});const r=runtime([evil]);r.click('data-program-index',6);assert.ok(r.host.innerHTML.includes('&lt;img src=x'));assert.ok(!r.host.innerHTML.includes('<img src=x'));r.click('data-folder-index');assert.ok(!r.host.innerHTML.includes('<img src=x'));
 r.render([]);assert.equal(r.host.querySelectorAll('[data-folder-media]').length,0);r.click('data-folder-add');assert.equal(r.calls.add[0],'drama');r.view.reset();r.render([evil]);assert.equal(r.host.querySelectorAll('[data-program-index]').length,8);
});
test('folder refresh keeps rejected/draft status visible and removes approval controls after approved',()=>{
 const rows=[row('pending',{durum:'beklemede'})];const r=runtime(rows);r.click('data-program-index',6);r.click('data-folder-index');assert.equal(r.host.querySelectorAll('[data-approve]').length,1);
 rows[0].durum='reddedildi';r.render(rows);assert.match(r.host.innerHTML,/Reddedildi/);assert.equal(r.host.querySelectorAll('[data-approve]').length,0);
 rows[0].durum='taslak';r.render(rows);assert.match(r.host.innerHTML,/taslak/);rows[0].durum='onaylandi';r.render(rows);assert.doesNotMatch(r.host.innerHTML,/Reddedildi|Onay bekliyor/);
});


test('old or missing period folders do not pretend to append to the selected topic',()=>{
 for(const donem of ['', '2025-2026']){const r=runtime([row('past',{donem})]);r.click('data-program-index',6);r.click('data-folder-index');assert.equal(r.host.querySelectorAll('[data-folder-add]').length,0);assert.match(r.host.innerHTML,/dönemi seçili dönemle eşleşmiyor/);r.click('data-folder-back');r.click('data-folder-add');assert.equal(r.calls.add[0],'drama');}
});


test('education overlay resolves new escaped JSON-action cards through their exact data ID',()=>{
 const overlay=readFileSync(new URL('../js/zeky-galeri-onay-egitim.js',import.meta.url),'utf8');const start=overlay.indexOf('function kartId('),end=overlay.indexOf('function tarih(',start);const ctx=vm.createContext({});vm.runInContext(overlay.slice(start,end),ctx);
 const id='synthetic-1';assert.equal(ctx.kartId({dataset:{galleryMediaId:id},getAttribute:()=>`acGaleriLightbox("${id}")`}),id);assert.equal(ctx.kartId({getAttribute:()=>`acGaleriLightbox('${id}')`}),id);
});
