import { galleryLightboxStyles, galleryLightboxIcons, lightboxDownload } from '../js/portal-galeri-lightbox-ui.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as folders from '../js/galeri-klasorleri.js';
import {isGalleryParent,targetChild,childTargetMatches,createInteractionService,galleryChildClass,galleryParentKey} from '../js/portal-galeri-etkilesim.js';
import {saveBlob,downloadMedia} from '../js/portal-galeri-canli.js';
import {galleryMediaType,galleryDisplayUrl,downloadSource,isPlayerUrl} from '../js/portal-galeri-medya.js';
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../moduller/veli-galeri.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export async function render','async function render');
const child={id:'child-a',sinif:'Mimoza'},user={uid:'parent-a',email:'synthetic@example.invalid',providerData:[]};
const getter=index.match(/get state\(\) \{([\s\S]*?)\n  \},/)[1];
function authState(overrides={}){
 const c={currentUser:user,aktifKullaniciRol:null,isAdmin:false,aktifPersonel:null,veliOgrenciler:[child],veliAktifOgrenci:child,ayarListesi:{},AKTIF_DONEM:'2026-2027',galeriVeliUid:user.uid,portalOturumSurumu:3,...overrides};
 const boundUser=c.currentUser; c.binding={uid:c.currentUser?.uid,oturum:c.portalOturumSurumu,surum:1,donem:c.AKTIF_DONEM,ogrenciId:c.veliAktifOgrenci?.id,sinif:c.veliAktifOgrenci?.sinif||'',durum:'hazir'};
 c.veliGaleriSinifBaglamiOku=()=>c.currentUser===boundUser&&c.binding?.oturum===c.portalOturumSurumu&&c.binding?.donem===c.AKTIF_DONEM&&c.binding?.ogrenciId===c.veliAktifOgrenci?.id?c.binding:null;
 c.veliGaleriSinifSifirla=()=>{c.binding=null;};
 vm.runInNewContext('globalThis.api={get state(){'+getter+'}}',c);return c;
}
const photo=(id,extra={})=>({id,durum:'onaylandi',hedefTur:'sinif',hedefDeger:'Mimoza',bunnyUrl:`https://example.invalid/${id}.jpg`,dosyaTipi:'foto',etkinlikBaslik:id,...extra});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fixture(rows,overrides={}){
 const auth=authState(overrides),nodes=new Map(),events=new Map(),calls={mount:[],open:[],dispose:[],download:[],queries:[]};let document;
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={};this.dataset={};this.attributes={};this._html='';this.controls=[];this.isConnected=true;}
  set innerHTML(s){this._html=s;this.controls=[...s.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{const e=new Element('button');e.parent=this;e.text=m[2].replace(/<[^>]*>/g,'');e.action=Number(m[1].match(/eylem\((\d+),this\)/)?.[1]);e.label=m[1].match(/aria-label="([^"]*)"/)?.[1];return e;});}
  get innerHTML(){return this._html;}
  setAttribute(k,v){this.attributes[k]=v;}
  focus(){document.activeElement=this;}
  remove(){nodes.delete(this.id);this.isConnected=false;}
  querySelector(s){if(s==='[data-vg-media]')return this.mediaHost||(this.mediaHost=new Element());if(s==='[aria-label="Kapat"]')return this.controls.find(e=>e.label==='Kapat');return null;}
  querySelectorAll(s){if(s==='[data-vg-thumbnail]')return [...this._html.matchAll(/data-vg-thumbnail="([^"]*)"/g)].map(m=>{const e=new Element();e.dataset.vgThumbnail=m[1];return e;});if(s.startsWith('button:'))return this.controls;return [];}
 }
 const root=new Element();nodes.set('gallery',root);const body=new Element('body');body.style.overflow='auto';body.appendChild=e=>nodes.set(e.id,e);document={body,activeElement:null,getElementById:id=>nodes.get(id)||null,createElement:t=>new Element(t)};
 const stack=[{route:'gallery'}];let at=0,backQueued=false,backCalls=0;
 const emit=(name,event={})=>{for(const f of events.get(name)||[])f(event);};
 const history={get state(){return stack[at]},pushState(s){stack.splice(++at);stack[at]=s;},replaceState(s){stack[at]=s;},back(){backCalls++;backQueued=true;}};
 const window={PortalAPI:{get state(){return auth.api.state},esc,lucide(){},db:{},fb:{collection:()=> 'galeri',where:(field,op,value)=>({field,value}),query:(collection,...where)=>({collection,where}),getDocs:async q=>{calls.queries.push(q);return{forEach:f=>rows.forEach(r=>f({id:r.id,data:()=>r}))};}}},history,addEventListener:(n,f)=>events.set(n,[...events.get(n)||[],f])};
 const ctx={galleryLightboxStyles,galleryLightboxIcons,lightboxDownload,...folders,window,document,console,isGalleryParent,targetChild,childTargetMatches,galleryChildClass,galleryParentKey,galleryMediaType,galleryDisplayUrl,mountMedia:(h,m,o)=>calls.mount.push({id:m.id,opts:o}),disposeMedia:d=>calls.dispose.push(d),recordOpen:m=>calls.open.push(m.id),downloadMedia:m=>calls.download.push(m.id)};
 vm.runInNewContext(source+';globalThis.render=render;',ctx);
 return {auth,window,root,nodes,calls,document,history,emit,get backCalls(){return backCalls},
  render:()=>ctx.render('gallery'),html:()=>root.innerHTML,lightbox:()=>nodes.get('vgLightbox'),
  click(text){const e=root.controls.find(e=>e.text.includes(text));assert.ok(e,`missing synthetic control ${text}`);return window._vg.eylem(e.action,e);},
  card(id){const m=root.innerHTML.match(new RegExp('data-vg-thumbnail="'+id+'" onclick="window\\._vg\\.eylem\\((\\d+),this\\)'));assert.ok(m,'synthetic card is present');const origin=new Element('button');origin.focus();window._vg.eylem(Number(m[1]),origin);return origin;},
  flushBack(){if(backQueued){backQueued=false;at=Math.max(0,at-1);emit('popstate',{state:history.state});}},
  browserBack(){at=Math.max(0,at-1);emit('popstate',{state:history.state});},
  ids:()=>[...root.innerHTML.matchAll(/data-vg-thumbnail="([^"]*)"/g)].map(m=>m[1])};
}

test('actual Portal getter keeps null parent role; verified synthetic photo click opens the real module',async()=>{
 const r=fixture([photo('photo')]);assert.equal(r.auth.api.state.rol,null);assert.equal(isGalleryParent(r.auth.api.state),true);
 await r.render();const origin=r.card('photo');assert.ok(r.lightbox());assert.equal(r.lightbox().attributes.role,'dialog');assert.equal(r.document.activeElement.label,'Kapat');assert.equal(r.document.body.style.overflow,'hidden');assert.deepEqual(r.calls.open,['photo']);
 r.window._vg.kapat();assert.equal(r.lightbox(),undefined);assert.equal(r.document.activeElement,origin);assert.equal(r.document.body.style.overflow,'auto');r.flushBack();assert.deepEqual(r.history.state,{route:'gallery'});
});
test('null role with unverified, different UID, absent children, foreign active child or staff context is denied before query',async()=>{
 for(const override of [{galeriVeliUid:''},{galeriVeliUid:'other'},{veliOgrenciler:[]},{veliAktifOgrenci:{id:'foreign'}},{aktifKullaniciRol:'ogretmen'},{isAdmin:true},{aktifPersonel:{rol:'ogretmen'}},{currentUser:null}]){
  const r=fixture([photo('photo')],override);await r.render();assert.equal(r.calls.queries.length,0);r.window._vg.buyut('photo','gallery');assert.equal(r.lightbox(),undefined);assert.equal(r.calls.open.length,0);
 }
});
test('same-session approval/audience checks remain intact for null-role parents',async()=>{
 const r=fixture([photo('yes'),photo('no',{durum:'beklemede'}),photo('foreign',{hedefDeger:'Yasemin'}),photo('sibling',{hedefTur:'ogrenci',hedefDeger:'child-b'})]);await r.render();assert.deepEqual(r.ids(),['yes']);
});
test('Back, Escape, repeated open and rapid close/open keep one dialog and one history entry',async()=>{
 const r=fixture([photo('photo')]);await r.render();r.card('photo');r.card('photo');assert.equal(r.nodes.size,2);assert.equal(r.backCalls,0);
 r.emit('keydown',{key:'Escape',preventDefault(){}});assert.equal(r.backCalls,1);assert.equal(r.lightbox(),undefined);r.card('photo');assert.equal(r.lightbox(),undefined);r.flushBack();r.card('photo');assert.ok(r.lightbox());r.browserBack();assert.equal(r.lightbox(),undefined);assert.equal(r.document.body.style.overflow,'auto');
});
test('dialog Tab wraps focus and backdrop close restores card focus',async()=>{
 const r=fixture([photo('photo')]);await r.render();const origin=r.card('photo'),d=r.lightbox(),first=d.controls[0],last=d.controls.at(-1);last.focus();let prevented=false;r.emit('keydown',{key:'Tab',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(r.document.activeElement,first);
 r.emit('keydown',{key:'Tab',shiftKey:true,preventDefault(){}});assert.equal(r.document.activeElement,last);d.onclick({target:d});assert.equal(r.lightbox(),undefined);assert.equal(r.document.activeElement,origin);r.flushBack();
});
test('synchronous context invalidation closes media, clears cards and makes saved handlers inert',async()=>{
 const r=fixture([photo('photo')]);await r.render();r.card('photo');const download=r.lightbox().controls.find(e=>e.text==='İndir');r.auth.galeriVeliUid='';r.window._vg.invalidate();assert.equal(r.lightbox(),undefined);assert.equal(r.html(),'');r.window._vg.eylem(download.action,download);assert.equal(r.calls.download.length,0);r.flushBack();
});
test('child, period and same-UID auth-epoch changes reject stale open and download actions',async()=>{
 for(const update of [a=>a.veliAktifOgrenci={id:'other'},a=>a.AKTIF_DONEM='2027-2028',a=>a.portalOturumSurumu++]){
  const r=fixture([photo('photo')]);await r.render();r.card('photo');update(r.auth);r.window._vg.buyut('photo','gallery');r.window._vg.indir('photo',{});assert.equal(r.calls.open.length,1);assert.equal(r.calls.download.length,0);
 }
});
test('all/photo/video tabs classify accepted and legacy shapes, preserve folders and never enlarge audience',async()=>{
 const rows=[photo('photo',{program:'jimnastik',konuBaslik:'Denge'}),photo('video',{program:'jimnastik',konuBaslik:'Denge',dosyaTipi:'video',bunnyUrl:'https://example.invalid/v.mp4'}),photo('tip',{program:'drama',konuBaslik:'Sahne',dosyaTipi:undefined,tip:'video',bunnyUrl:'https://example.invalid/raw'}),photo('mp4',{dosyaTipi:undefined,bunnyUrl:undefined,mp4Url:'https://example.invalid/only.mp4'}),photo('foreign-video',{hedefDeger:'Yasemin',dosyaTipi:'video'})];
 const r=fixture(rows);await r.render();assert.match(r.html(),/Medya türü/);await r.click('Videolar');assert.ok(!r.html().includes('foreign-video'));assert.ok(r.html().includes('Jimnastik'));assert.ok(r.html().includes('Drama'));assert.deepEqual(r.ids(),['mp4']);assert.ok(r.calls.mount.some(x=>x.id==='mp4'&&x.opts?.thumbnail));
 await r.click('Jimnastik');await r.click('Denge');assert.deepEqual(r.ids(),['video']);r.card('video');assert.match(r.lightbox().innerHTML,/1\/1/);assert.equal(r.calls.mount.at(-1).id,'video');r.window._vg.kapat();r.flushBack();
 await r.click('Fotoğraflar');assert.deepEqual(r.ids(),['photo']);await r.click('Tümü');assert.deepEqual(r.ids(),['photo','video']);
});
test('zero video tab remains selectable with an honest empty state',async()=>{const r=fixture([photo('photo')]);await r.render();await r.click('Videolar');assert.deepEqual(r.ids(),[]);assert.match(r.html(),/seçilen türde içerik yok/);assert.match(r.html(),/Videolar/);});
test('metadata precedence, safe legacy URL classification and stream/download separation',()=>{
 for(const m of [{tip:'video'},{mimeType:'video/mp4'},{dosyaTipi:'video/mp4'},{mp4Url:'https://example.invalid/raw'},{url:'https://example.invalid/a.mp4?x=1'},{url:'https://firebasestorage.googleapis.com/v0/b/example/o/folder%2Fmovie.mp4?alt=media&token=synthetic'},{url:'https://iframe.mediadelivery.net/embed/1/2'}])assert.equal(galleryMediaType(m),'video');
 for(const m of [{},{tip:'unknown'},{url:'javascript:x.mp4'},{url:'https://iframe.mediadelivery.net.evil.invalid/embed/1/2'},{dosyaTipi:'foto',url:'https://example.invalid/a.mp4'}])assert.equal(galleryMediaType(m),'foto');
 const player={tip:'video',url:'https://iframe.mediadelivery.net/embed/1/2?token=synthetic'};assert.equal(galleryDisplayUrl(player),player.url);assert.equal(downloadSource(player),'');assert.equal(isPlayerUrl('https://example.invalid/embed/1/2'),false);assert.equal(downloadSource({tip:'video',url:'https://example.invalid/playlist.m3u8'}),'');
});
const loadSource=index.slice(index.indexOf('async function loadVeliPanel(user) {'),index.indexOf('// Veli adını dönem kaydındaki'));
function loadFixture(){
 let release;const a=authState({galeriVeliUid:'old'});Object.assign(a,{window:{},document:{getElementById:()=>({style:{}})},console,findOgrenciForVeli:()=>new Promise(r=>release=r),modulYukle:async()=>null,renderVeliOgrenciSecici(){},setAktifVeliOgrenci:async()=>{},veliSwitchTab(){},ozellikBayraklariYukle:async()=>{},ozellikleriArayuzeUygula(){},showVeliNotAuthorized(){},showToast(){},setTimeout(){}});vm.runInNewContext(loadSource,a);return{a,run:()=>a.loadVeliPanel(user),release:rows=>release(rows)};
}
test('actual child loader issues marker only for current-user completed assigned-child result',async()=>{const f=loadFixture(),p=f.run();assert.equal(f.a.galeriVeliUid,'');f.release([child]);await p;assert.equal(f.a.galeriVeliUid,user.uid);assert.equal(f.a.aktifKullaniciRol,null);});
test('delayed child load cannot authenticate user B or a newer same-UID epoch',async()=>{
 for(const change of [a=>{a.currentUser={...user,uid:'parent-b'};a.portalOturumSurumu++;},a=>{a.portalOturumSurumu++;},a=>{a.aktifKullaniciRol='ogretmen';},a=>{a.AKTIF_DONEM='2027-2028';}]){const f=loadFixture(),p=f.run();change(f.a);f.release([child]);await p;assert.equal(f.a.galeriVeliUid,'');}
});
test('actual logout start invalidates before signOut waits, and auth callback invalidates before first await',async()=>{
 const logout=index.match(/window.signOut = async function\(\) \{([\s\S]*?)\n\};/)[1];let release;const a=authState();a.auth={};a.window={_vg:{invalidate(){a.invalidated=true;}}};a.fbSignOut=()=>new Promise(r=>release=r);a.showToast=()=>{};a.setTimeout=()=>{};vm.runInNewContext('globalThis.logout=async function(){'+logout+'}',a);const p=a.logout();assert.equal(a.galeriVeliUid,'');assert.equal(a.invalidated,true);release();await p;
 const authStart=index.slice(index.indexOf('onAuthStateChanged(auth, async (user) => {'),index.indexOf('// Aktif dönemi ayarlar/donem'));assert.ok(authStart.indexOf('galeriVeliUid = ""')<authStart.indexOf('if (user)'));assert.ok(authStart.includes('window._vg?.invalidate?.()'));
});
test('tracking uses verified null-role context and rejects a same-UID epoch change during transaction',async()=>{
 const a=authState(),writes=[];let release;const api={get state(){return a.api.state},db:{},fb:{doc:()=>'',runTransaction:async(_,fn)=>fn({get:()=>new Promise(r=>release=r),set:(_,v)=>writes.push(v)})}};
 const p=createInteractionService(()=>api).record(photo('photo'),'acma');while(!release)await new Promise(r=>setTimeout(r,0));a.portalOturumSurumu++;release({exists:()=>false});assert.equal(await p,false);assert.equal(writes.length,0);
 a.binding.oturum=a.portalOturumSurumu;api.fb.runTransaction=async(_,fn)=>fn({get:async()=>({exists:()=>false}),set:(_,v)=>writes.push(v)});assert.equal(await createInteractionService(()=>api).record(photo('photo'),'acma'),true);assert.equal(writes.length,1);assert.equal(writes[0].veliUid,user.uid);
});

test('download guard aborts a writer before close on a context change and never starts a stale save',async()=>{
 let current=true,writes=0,closes=0,aborts=0,creates=0;
 const handle={createWritable:async()=>{creates++;return{write:async()=>{writes++;current=false;},close:async()=>{closes++;},abort:async()=>{aborts++;}}}};
 await assert.rejects(saveBlob(new Blob(['synthetic']),'synthetic.jpg',{win:{},handle,guard:()=>current}),{name:'AbortError'});assert.equal(writes,1);assert.equal(closes,0);assert.equal(aborts,1);
 await assert.rejects(saveBlob(new Blob(['synthetic']),'synthetic.jpg',{win:{},handle,guard:()=>false}),{name:'AbortError'});assert.equal(creates,1);
});
test('unscoped and class-only legacy documents are not broadened into school audience',async()=>{
 const r=fixture([photo('yes'),photo('class-only',{hedefTur:undefined,hedefDeger:undefined,sinif:'Mimoza',tip:'video'}),photo('missing-scope',{hedefTur:undefined,hedefDeger:undefined}),photo('unknown-scope',{hedefTur:'legacy',sinif:'Mimoza'}),photo('conflicting-child',{hedefTur:'ogrenci',hedefDeger:'other',sinif:'Mimoza'})]);
 await r.render();assert.deepEqual(r.ids(),['yes']);for(const q of r.calls.queries){assert.ok(q.where.some(w=>['hedefTur','hedefOgrenciId','ogrenciId'].includes(w.field)));assert.ok(q.where.some(w=>w.field==='durum'&&w.value==='onaylandi'));}
});

test('approved school-wide tracking follows selected sibling B, not the first child',async()=>{
 const second={id:'child-b',sinif:'Yasemin'},a=authState({veliOgrenciler:[child,second],veliAktifOgrenci:second}),writes=[];
 const api={get state(){return a.api.state},db:{},fb:{doc:()=>'',runTransaction:async(_,fn)=>fn({get:async()=>({exists:()=>false}),set:(_,v)=>writes.push(v)})}};
 assert.equal(await createInteractionService(()=>api).record(photo('school',{hedefTur:'tumOkul'}),'acma'),true);assert.equal(writes[0].ogrenciId,'child-b');
 assert.equal(await createInteractionService(()=>api).record(photo('only-a',{hedefTur:'ogrenci',hedefDeger:child.id}),'acma'),false);assert.equal(writes.length,1);
});
test('safe historical gorselUrl and trusted embedUrl aliases are admitted, arbitrary embed URL is not',async()=>{
 const embed='https://iframe.mediadelivery.net/embed/1/2?token=synthetic',gorsel='https://example.invalid/legacy.mov?x=1';
 assert.equal(galleryDisplayUrl({embedUrl:embed}),embed);assert.equal(galleryMediaType({embedUrl:embed}),'video');assert.equal(downloadSource({embedUrl:embed}),'');
 assert.equal(galleryDisplayUrl({embedUrl:'https://example.invalid/embed/1/2'}),'');assert.equal(galleryDisplayUrl({gorselUrl:gorsel}),gorsel);
 const r=fixture([photo('alias',{bunnyUrl:undefined,dosyaTipi:undefined,gorselUrl:gorsel}),photo('embed',{bunnyUrl:undefined,dosyaTipi:undefined,embedUrl:embed})]);await r.render();await r.click('Videolar');assert.deepEqual(r.ids(),['alias','embed']);
});

test('another route push during pending close popstate cannot permanently lock gallery opens',async()=>{
 const r=fixture([photo('photo')]);await r.render();r.card('photo');r.window._vg.kapat();r.history.pushState({route:'another-panel'});r.flushBack();assert.equal(r.lightbox(),undefined);assert.equal(r.history.state.__portalGalleryDialog,undefined);r.card('photo');assert.ok(r.lightbox());
});
test('selected class mutation during a pending tracking write aborts the stale attribution',async()=>{
 const a=authState(),writes=[];let release;const api={get state(){return a.api.state},db:{},fb:{doc:()=>'',runTransaction:async(_,fn)=>fn({get:()=>new Promise(r=>release=r),set:(_,v)=>writes.push(v)})}};
 const p=createInteractionService(()=>api).record(photo('school',{hedefTur:'tumOkul'}),'acma');while(!release)await new Promise(r=>setTimeout(r,0));a.binding={...a.binding,sinif:'Yasemin',surum:2};release({exists:()=>false});assert.equal(await p,false);assert.equal(writes.length,0);
});

test('context change during pending download tracking suppresses stale success toast',async()=>{
 const a=authState(),writes=[],toasts=[];let release,clicks=0;
 const win={PortalAPI:{get state(){return a.api.state},toast:(...v)=>toasts.push(v),db:{},fb:{doc:()=>'',runTransaction:async(_,fn)=>fn({get:()=>new Promise(r=>release=r),set:(_,v)=>writes.push(v)})}},
 fetch:async()=>({ok:true,blob:async()=>new Blob(['synthetic'],{type:'image/jpeg'})}),URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}},setTimeout(){},document:{body:{append(){}},createElement:()=>({remove(){},click(){clicks++;}})}};
 const old=globalThis.window;globalThis.window=win;
 try{const p=downloadMedia(photo('photo'));while(!release)await new Promise(r=>setTimeout(r,0));a.portalOturumSurumu++;release({exists:()=>false});assert.equal(await p,false);assert.equal(clicks,1);assert.equal(writes.length,0);assert.deepEqual(toasts,[]);}finally{if(old===undefined)delete globalThis.window;else globalThis.window=old;}
});

test('discarded transaction attempt cannot report success when the final retry skips a changed context',async()=>{
 const a=authState();let staged=0,committed=0;
 const api={get state(){return a.api.state},db:{},fb:{doc:()=>'',runTransaction:async(_,fn)=>{await fn({get:async()=>({exists:()=>false}),set:()=>staged++});a.portalOturumSurumu++;return fn({get:async()=>({exists:()=>false}),set:()=>committed++});}}};
 assert.equal(await createInteractionService(()=>api).record(photo('photo'),'acma'),false);assert.equal(staged,1);assert.equal(committed,0);
});

test('contradictory explicit child target IDs fail closed in listing, open and tracking eligibility',async()=>{
 const conflicting=photo('conflict',{hedefTur:'ogrenci',hedefDeger:'child-b',hedefOgrenciId:'child-a'}),consistent=photo('consistent',{hedefTur:'ogrenci',hedefDeger:'child-a',hedefOgrenciId:'child-a',ogrenciId:'child-a'});
 const r=fixture([conflicting,consistent]);await r.render();assert.deepEqual(r.ids(),['consistent']);r.window._vg.buyut('conflict','gallery');assert.equal(r.lightbox(),undefined);
 assert.equal(targetChild(conflicting,[child,{id:'child-b'}]),null);assert.equal(targetChild(consistent,[child]).id,'child-a');
 const reverse={...conflicting,hedefDeger:'child-a',hedefOgrenciId:'child-b'};assert.equal(targetChild(reverse,[child,{id:'child-b'}]),null);
});
