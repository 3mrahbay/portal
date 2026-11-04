import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {bindGallerySwipe} from '../js/gallery-navigation.js';
import * as media from '../js/portal-galeri-medya.js';
import * as folders from '../js/galeri-klasorleri.js';
import * as metadata from '../js/galeri-gozlem-metadata.js';
import * as interactions from '../js/portal-galeri-etkilesim.js';
import * as ui from '../js/portal-galeri-lightbox-ui.js';
import {installLiveGallery,fetchMediaBlob} from '../js/portal-galeri-canli.js';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const stream=()=>({id:'video',dosyaTipi:'video',streamLibraryId:'123',streamVideoId:'abcdefgh-1234',bunnyUrl:'https://iframe.mediadelivery.net/embed/123/abcdefgh-1234'});
test('player-only video remains disabled and download performs no URL probing, even with CDN metadata',async()=>{
 const m={...stream(),streamCdnHost:'sample.b-cdn.net',kucukResim:'https://sample.b-cdn.net/abcdefgh-1234/thumbnail.jpg',availableResolutions:'720p,480p'};
 assert.equal(media.canDownloadMedia(m),false);assert.equal(media.downloadSource(m),'');
 let requests=0;await assert.rejects(fetchMediaBlob(m,{fetch:()=>{requests++;throw Error('must not request');}}),/güvenli indirme henüz kullanılamıyor/);assert.equal(requests,0);
 const source=readFileSync(new URL('../js/portal-galeri-medya.js',import.meta.url),'utf8');assert.doesNotMatch(source,/play_.*mp4|verifiedDownloads|resolveDownloadSource/);
 const direct={...m,mp4Url:'https://example.test/authorized.mp4?token=synthetic'};
 assert.equal(media.downloadSource(direct),direct.mp4Url);
});
function swipe(win,host,from,to,{multi=false}={}){
 const start=new win.Event('touchstart',{bubbles:true});start.touches=multi?[{clientX:from[0],clientY:from[1]},{}]:[{clientX:from[0],clientY:from[1]}];host.dispatchEvent(start);
 const end=new win.Event('touchend',{bubbles:true});end.touches=[];end.changedTouches=[{clientX:to[0],clientY:to[1]}];host.dispatchEvent(end);
}
test('swipe recognizes horizontal single-finger gesture and ignores vertical scroll, pinch and video controls',()=>{
 const dom=new JSDOM('<div id="host"><img><video></video></div>'),host=dom.window.document.getElementById('host'),steps=[];const dispose=bindGallerySwipe(host,x=>steps.push(x));
 swipe(dom.window,host,[200,100],[50,110]);swipe(dom.window,host,[50,100],[200,110]);swipe(dom.window,host,[100,100],[80,250]);swipe(dom.window,host,[200,100],[50,110],{multi:true});swipe(dom.window,host.querySelector('video'),[200,100],[50,110]);assert.deepEqual(steps,[1,-1]);dispose();swipe(dom.window,host,[200,100],[50,110]);assert.equal(steps.length,2);dom.window.close();
});
test('management keeps original visible queue after approval removes current item; changed session cannot navigate',async()=>{
 const dom=new JSDOM('<div id="galeriListesi"><div data-gallery-media-id="a"></div><div data-gallery-media-id="b"></div></div><div id="galeriLightbox"><div><div id="galeriLightboxIcerik"></div></div></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;
 const state={rol:'mudur',currentUser:{uid:'manager'},aktifDonem:'2026-2027'},opened=[];window.PortalAPI={state};window.galeriListesiVerisi=['a','b','hidden'].map(id=>({id,dosyaTipi:'foto',bunnyUrl:'https://example.test/'+id+'.jpg'}));
 window.acGaleriLightbox=id=>{opened.push(id);document.getElementById('galeriLightbox').classList.add('active');document.getElementById('galeriLightboxIcerik').innerHTML='';};window.veliAcGaleriLightbox=()=>{};window.closeGaleriLightbox=()=>document.getElementById('galeriLightbox').classList.remove('active');
 installLiveGallery(window);window.acGaleriLightbox('a');window.galeriListesiVerisi=window.galeriListesiVerisi.filter(x=>x.id!=='a');swipe(window,document.getElementById('galeriLightboxIcerik'),[200,100],[20,100]);assert.deepEqual(opened,['a','b']);window.galeriLightboxGezin(1);assert.deepEqual(opened,['a','b']);state.currentUser={uid:'other'};window.galeriLightboxGezin(-1);assert.equal(opened.length,2);window.closeGaleriLightbox();await new Promise(r=>setTimeout(r,0));dom.window.close();await new Promise(r=>setTimeout(r,0));delete globalThis.window;delete globalThis.document;
});
test('parent gallery shows curriculum guidance as text and swipes within authorized visible media',async()=>{
 const dom=new JSDOM('<div id="gallery"></div>'),win=dom.window,reads=[];
 const state={rol:'veli',currentUser:{uid:'parent'},aktifDonem:'2026-2027',veliAktifOgrenci:{id:'child',sinif:'Mimoza'}};
 state.currentUser.email='parent@example.test';state.veliOgrenciler=[state.veliAktifOgrenci];
 state.galeriSinifBaglami={uid:'parent',oturum:0,surum:1,donem:state.aktifDonem,ogrenciId:'child',sinif:'Mimoza',durum:'hazir'};
 const rows=['a','b'].map(id=>({id,durum:'onaylandi',hedefTur:'ogrenci',hedefDeger:'child',program:'montessori',kazanimAnahtari:'alan__grup__ders',dosyaTipi:'foto',bunnyUrl:'https://example.test/'+id+'.jpg'}));
 const fb={collection:()=>'',where:()=>'',query:()=>'',getDocs:async()=>({forEach:fn=>rows.forEach(row=>fn({id:row.id,data:()=>row}))}),doc:(_,collection,id)=>{reads.push(collection+'/'+id);return id;},getDoc:async()=>({exists:()=>true,data:()=>({kazanimAciklamalari:{'alan__grup__ders':'Dikkat gelişimi <script>unsafe</script>'}})})};
 win.PortalAPI={state,fb,db:{},esc:s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),lucide(){}};
 const source=readFileSync(new URL('../moduller/veli-galeri.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const context={window:win,document:win.document,console,...media,...folders,...metadata,...interactions,...ui,bindGallerySwipe,mountMedia:()=>{},disposeMedia:()=>{},recordOpen:()=>{},downloadMedia:()=>{},readMediaFavorite:async()=>false,setMediaFavorite:async()=>true};
 vm.runInNewContext(source+'\nglobalThis.renderGallery=render;',context);await context.renderGallery('gallery');win._vg.buyut('a','gallery');await new Promise(r=>setTimeout(r,0));
 assert.match(win.document.querySelector('[data-vg-guidance]').textContent,/Dikkat gelişimi <script>/);assert.equal(win.document.querySelector('[data-vg-guidance] script'),null);assert.deepEqual(reads,['mufredatlar/montessori']);
 swipe(win,win.document.querySelector('[data-vg-media]'),[200,100],[10,100]);assert.match(win.document.querySelector('.vg-lb-position').textContent,/2\/2/);win._vg.invalidate();dom.window.close();
});
test('education approval keeps dialog open only after explicit success and enables retry after failure',async()=>{
 const source=readFileSync(new URL('../js/zeky-galeri-onay-egitim.js',import.meta.url),'utf8');const start=source.indexOf('const eylemleriBagla=()=>{');const end=source.indexOf('  eylemleriBagla();',start);
 for(const result of [true,false]){
  const handlers={},button={disabled:false,textContent:'Onayla'},actions={textContent:'',setAttribute(){}},m={durum:'beklemede'};let closed=0;
  const c={m,id:'a',halaAcik:()=>true,icerik:{querySelector:s=>s==='.zgo-actions'?actions:{addEventListener:(name,fn)=>handlers[s]=fn}},window:{closeGaleriLightbox:()=>closed++,galeriOnayla:async()=>result}};
  vm.runInNewContext(source.slice(start,end)+'eylemleriBagla();',c);await handlers['[data-zgo-onay]']({currentTarget:button});assert.equal(closed,0);assert.equal(m.durum,result?'onaylandi':'beklemede');if(result)assert.match(actions.textContent,/Onaylandı/);else assert.equal(button.disabled,false);
 }
});
test('likes use the existing mobile preferences, remain idempotent, and preserve other favorites/settings',async()=>{
 let data={galeriFavoriler:['older'],notification:'keep'},writes=[],events=[];
 const state={rol:'veli',currentUser:{uid:'u',email:'Parent@Example.test'},veliOgrenciler:[{id:'child'}],veliAktifOgrenci:{id:'child'}};
 const m={id:'photo',durum:'onaylandi',hedefTur:'ogrenci',hedefDeger:'child'};
 const snapshot=()=>({exists:()=>true,data:()=>({...data})});
 const fb={doc:(_, ...path)=>path.join('/'),getDoc:async ref=>{assert.equal(ref,'kullaniciTercihleri/parent@example.test');return snapshot();},runTransaction:async(_,fn)=>fn({get:async()=>snapshot(),set:(ref,patch,opts)=>{assert.equal(opts.merge,true);if(ref==='galeri/photo/etkilesimler/u'){events.push(patch);return;}assert.equal(ref,'kullaniciTercihleri/parent@example.test');writes.push(patch);data={...data,...patch};}})};
 const service=interactions.createInteractionService(()=>({state,fb,db:{}}));assert.equal(await service.favorite(m),false);
 await service.setFavorite(m,true);await service.setFavorite(m,true);assert.deepEqual(data.galeriFavoriler,['older','photo']);assert.equal(data.notification,'keep');assert.equal(await service.favorite(m),true);
 await service.setFavorite(m,false);assert.deepEqual(data.galeriFavoriler,['older']);
 for(const blocked of [{...m,durum:'beklemede'},{...m,hedefDeger:'another-child'}])await assert.rejects(service.setFavorite(blocked,true),/bağlamı/);
 state.rol='ogretmen';await assert.rejects(service.favorite(m),/bağlamı/);assert.equal(writes.length,3);assert.deepEqual(events.map(x=>x.favori),[true,true,false]);assert(events.every(x=>x.veliUid==='u'&&x.ogrenciId==='child'&&x.veliEmailHash.length===64));
});
test('account/child switch while a like transaction is reading prevents the write',async()=>{
 const state={rol:'veli',currentUser:{uid:'u',email:'p@example.test'},veliOgrenciler:[{id:'child'}],veliAktifOgrenci:{id:'child'}};let writes=0;
 const fb={doc:()=>'',runTransaction:async(_,fn)=>fn({get:async()=>{state.currentUser={uid:'other',email:'other@example.test'};return{exists:()=>false};},set:()=>writes++})};
 const service=interactions.createInteractionService(()=>({state,fb,db:{}}));await assert.rejects(service.setFavorite({id:'photo',durum:'onaylandi',hedefTur:'ogrenci',hedefDeger:'child'},true),/bağlamı/);assert.equal(writes,0);
});
test('like UI coalesces rapid clicks and does not show success when persistence fails',async()=>{
 const dom=new JSDOM('<div id="dialog"><button data-vg-like></button></div>'),dialog=dom.window.document.getElementById('dialog'),button=dialog.querySelector('button');
 const source=readFileSync(new URL('../moduller/veli-galeri.js',import.meta.url),'utf8'),start=source.indexOf('async function parentLike('),end=source.indexOf('// Parent guidance reads',start);let writes=0,reject,notices=[];
 const c={_dialog:dialog,erisebilir:()=>true,P:()=>({toast:msg=>notices.push(msg)}),readMediaFavorite:async()=>false,setMediaFavorite:()=>{writes++;return new Promise((_,no)=>reject=no);}};
 vm.runInNewContext(source.slice(start,end)+'globalThis.mountLike=parentLike;',c);await c.mountLike({id:'photo'},dialog);
 const pending=button.onclick();await button.onclick();assert.equal(writes,1);assert.equal(button.disabled,true);reject(Error('denied'));await pending;assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.disabled,false);assert.match(notices[0],/kaydedilemedi/);dom.window.close();
});
test('two-device transactions retry conflicts and retain both favorites with matching interaction flags',async()=>{
 const store=new Map([['kullaniciTercihleri/parent@example.test',{galeriFavoriler:['existing']}]]);let version=0,firstReads=0,retries=0,release;const gate=new Promise(r=>release=r);
 const state=()=>({rol:'veli',currentUser:{uid:'u',email:'parent@example.test'},veliOgrenciler:[{id:'child'}],veliAktifOgrenci:{id:'child'}});
 const fb={doc:(_, ...parts)=>parts.join('/'),runTransaction:async(_,fn)=>{
  for(;;){let readVersion,staged=[];const result=await fn({get:async ref=>{readVersion=version;const value=structuredClone(store.get(ref));if(firstReads<2){firstReads++;if(firstReads===2)release();await gate;}return{exists:()=>!!value,data:()=>value};},set:(ref,patch)=>staged.push([ref,patch])});
   if(readVersion!==version){retries++;continue;}for(const [ref,patch] of staged)store.set(ref,{...store.get(ref),...patch});version++;return result;
  }
 }};
 const services=[state(),state()].map(s=>interactions.createInteractionService(()=>({state:s,fb,db:{}})));
 const item=id=>({id,durum:'onaylandi',hedefTur:'ogrenci',hedefDeger:'child'});
 await Promise.all([services[0].setFavorite(item('a'),true),services[1].setFavorite(item('b'),true)]);
 assert.deepEqual(new Set(store.get('kullaniciTercihleri/parent@example.test').galeriFavoriler),new Set(['existing','a','b']));assert(retries>=1);
 assert.equal(store.get('galeri/a/etkilesimler/u').favori,true);assert.equal(store.get('galeri/b/etkilesimler/u').favori,true);
});
test('denying the interaction write leaves neither half of the atomic like committed',async()=>{
 const committed=[],state={rol:'veli',currentUser:{uid:'u',email:'parent@example.test'},veliOgrenciler:[{id:'child'}],veliAktifOgrenci:{id:'child'}};
 const fb={doc:(_, ...parts)=>parts.join('/'),runTransaction:async(_,fn)=>{const staged=[];await fn({get:async()=>({exists:()=>false}),set:(ref,patch)=>staged.push([ref,patch])});if(staged.some(([ref])=>ref.startsWith('galeri/')))throw Error('permission-denied');committed.push(...staged);}};
 const service=interactions.createInteractionService(()=>({state,fb,db:{}}));await assert.rejects(service.setFavorite({id:'a',durum:'onaylandi',hedefTur:'ogrenci',hedefDeger:'child'},true),/permission-denied/);assert.deepEqual(committed,[]);
});
