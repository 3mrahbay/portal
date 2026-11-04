import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import * as media from '../js/portal-galeri-medya.js';import * as folders from '../js/galeri-klasorleri.js';import * as metadata from '../js/galeri-gozlem-metadata.js';import * as interactions from '../js/portal-galeri-etkilesim.js';import * as ui from '../js/portal-galeri-lightbox-ui.js';import {bindGallerySwipe} from '../js/gallery-navigation.js';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const source=readFileSync(new URL('../moduller/veli-galeri.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const photo=(id,child='a',extra={})=>({id,durum:'onaylandi',hedefTur:'ogrenci',hedefDeger:child,dosyaTipi:'foto',bunnyUrl:'https://example.test/'+id+'.jpg',...extra});
function fixture(){
 const dom=new JSDOM('<div id="gallery"></div>'),win=dom.window,state={rol:'veli',currentUser:{uid:'u',email:'p@example.test'},aktifDonem:'2026-2027',veliOgrenciler:[{id:'a'},{id:'b'}],veliAktifOgrenci:{id:'a'}};
 const f={rows:[photo('a1'),photo('a2'),photo('b1','b'),photo('rejected','a',{durum:'reddedildi'})],favorites:['a1','b1','missing','rejected'],read:async()=>f.favorites,record:async id=>f.rows.find(x=>x.id===id),writes:[]};
 const fb={collection:()=>'',where:()=>'',query:()=>'',getDocs:async()=>({forEach:fn=>f.rows.forEach(row=>fn({id:row.id,data:()=>row}))}),doc:(_,collection,id)=>({collection,id}),getDoc:async ref=>{const row=await f.record(ref.id);return{exists:()=>!!row,data:()=>row};}};
 win.PortalAPI={state,fb,db:{},esc:s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),lucide(){},toast(){}};
 const ctx={window:win,document:win.document,console,...media,...folders,...metadata,...interactions,...ui,bindGallerySwipe,mountMedia:()=>{},disposeMedia:()=>{},recordOpen:()=>{},downloadMedia:()=>{},readFavoriteIds:()=>f.read(),readMediaFavorite:async m=>f.favorites.includes(m.id),setMediaFavorite:async(m,value)=>{f.writes.push([m.id,value]);f.favorites=value?[...new Set([...f.favorites,m.id])]:f.favorites.filter(id=>id!==m.id);return true;}};
 vm.runInNewContext(source,ctx);
 return Object.assign(f,{win,state,dom,show:()=>win._vg.filtre('favoriler','gallery'),ids:()=>[...win.document.querySelectorAll('[data-vg-thumbnail]')].map(el=>el.dataset.vgThumbnail),close:()=>dom.window.close()});
}
test('Favorites shows only readable approved selected-child media; unlike removes it without changing other favorites',async()=>{
 const f=fixture();await f.show();assert.deepEqual(f.ids(),['a1']);assert.match(f.win.document.body.textContent,/Favorilerim/);
 await f.win._vg.buyut('a1','gallery');await new Promise(r=>setTimeout(r,0));await f.win.document.querySelector('[data-vg-like]').onclick();
 assert.deepEqual(f.ids(),[]);assert.equal(f.win.document.getElementById('vgLightbox'),null);assert.deepEqual(f.favorites,['b1','missing','rejected']);assert.deepEqual(f.writes,[['a1',false]]);f.close();
});
test('revoked media cannot open from cached favorite cards and no preference is deleted',async()=>{
 const f=fixture();await f.show();f.record=async()=>{throw Error('permission-denied');};await f.win._vg.buyut('a1','gallery');assert.equal(f.win.document.getElementById('vgLightbox'),null);assert.deepEqual(f.ids(),[]);assert.equal(f.writes.length,0);f.close();
});
test('late old-child favorites read cannot replace new-child view; denied preferences never show cached cards',async()=>{
 const f=fixture();let release,entered;const started=new Promise(r=>entered=r);f.read=()=>{entered();return new Promise(r=>release=r);};const old=f.show();await started;
 f.state.veliAktifOgrenci={id:'b'};f.read=async()=>['b1'];await f.show();release(['a1']);await old;assert.deepEqual(f.ids(),['b1']);
 f.read=async()=>{throw Error('permission-denied');};await f.show();assert.deepEqual(f.ids(),[]);assert.match(f.win.document.body.textContent,/Favorileriniz yüklenemedi/);f.win._vg.invalidate();assert.equal(f.win.document.getElementById('gallery').innerHTML,'');f.close();
});
test('session change during favorite item verification cannot open old media',async()=>{
 const f=fixture();await f.show();let release;f.record=()=>new Promise(r=>release=r);const pending=f.win._vg.buyut('a1','gallery');f.state.currentUser={uid:'other',email:'other@example.test'};f.win._vg.invalidate();release(photo('a1'));await pending;assert.equal(f.win.document.getElementById('vgLightbox'),null);assert.deepEqual(f.ids(),[]);f.close();
});
