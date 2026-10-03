import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as scope from '../js/portal-galeri-etkilesim.js';
import * as folders from '../js/galeri-klasorleri.js';
import * as media from '../js/portal-galeri-medya.js';
import {downloadMedia} from '../js/portal-galeri-canli.js';
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const getter=index.match(/get state\(\) \{([\s\S]*?)\n  \},/)[1];
const helpers=index.slice(index.indexOf('// Gallery-only proof from'),index.indexOf('async function loadVeliPanel'));
const loader=index.slice(index.indexOf('async function setAktifVeliOgrenci'),index.indexOf('\nfunction hesaplaYas'));
const moduleSource=fs.readFileSync(new URL('../moduller/veli-galeri.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export async function render','async function render');
const childA={id:'a',sinif:'Mimoza',_donemVeri:{kayit:{sinif:'UNBOUND'}}},childB={id:'b',sinif:'Mimoza'};
const user={uid:'parent',email:'synthetic@example.invalid'};
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}};
const snap=data=>({exists:()=>data!==null,data:()=>data});
function fixture(){
 const calls={reads:[],invalidations:0,tabs:[],welcome:[]},pending=[];
 const c={currentUser:user,aktifKullaniciRol:null,isAdmin:false,aktifPersonel:null,portalOturumSurumu:5,galeriVeliUid:user.uid,AKTIF_DONEM:'2026-2027',veliOgrenciler:[childA,childB],veliAktifOgrenci:null,veliAktifDonemVeri:null,ayarListesi:{a:{kayit:{sinif:'STALE SETTINGS'}}},db:{},console:{warn(){}},window:{_vg:{invalidate(){calls.invalidations++}}},document:{getElementById:()=>null,querySelector:()=>null},doc:(_, ...path)=>path.join('/'),getDoc:ref=>{calls.reads.push(ref);const d=deferred();pending.push(d);return d.promise;},updateVeliWelcome:(_,v)=>calls.welcome.push(v),veliRenderTab:tab=>calls.tabs.push(tab)};
 vm.runInNewContext(helpers+loader+';globalThis.api={get state(){'+getter+'}}',c);
 return{c,calls,pending,state:()=>c.api.state,run:child=>c.setAktifVeliOgrenci(child),resolve:(n,data)=>pending[n].resolve(snap(data))};
}
async function hydrated(data={durum:'aktif',kayit:{sinif:'Yasemin'}}){const f=fixture(),p=f.run(childA);f.resolve(0,data);await p;return f;}
function reader(f,rows){
 const root={innerHTML:'',querySelectorAll:()=>[]},calls=[],opened=[],downloads=[];let failure=()=>false;
 const fb={collection:(_,n)=>n,where:(field,operator,value)=>({field,operator,value}),query:(collection,...filters)=>({collection,filters}),getDocs:async q=>{calls.push(q);if(failure(q))throw Object.assign(Error('private provider detail'),{code:'permission-denied'});const chosen=rows.filter(r=>q.filters.every(w=>r[w.field]===w.value));return{forEach:fn=>chosen.forEach(r=>fn({id:r.id,data:()=>r}))}}};
 const window={PortalAPI:{get state(){return f.state()},fb,db:{},esc:v=>String(v??''),lucide(){},galeriSinifYenile:()=>f.run(f.c.veliAktifOgrenci)},addEventListener(){}};
 const c={...scope,...folders,...media,window,console,document:{getElementById:id=>id==='g'?root:null},disposeMedia(){},mountMedia(){},recordOpen:m=>opened.push(m),downloadMedia:m=>downloads.push(m)};
 vm.runInNewContext(moduleSource+';globalThis.renderGallery=render;',c);
 return{root,calls,opened,downloads,window,render:()=>c.renderGallery('g'),fail:fn=>failure=fn,ids:()=>[...root.innerHTML.matchAll(/data-vg-thumbnail="([^"]+)"/g)].map(m=>m[1])};
}
const photo=(id,extra={})=>({id,durum:'onaylandi',hedefTur:'sinif',hedefDeger:'Yasemin',donem:'2026-2027',bunnyUrl:'https://example.invalid/'+id+'.jpg',etkinlikBaslik:id,...extra});

test('actual getter and selected-child loader hydrate the verified period class, not master/settings/unbound cache',async()=>{
 const f=await hydrated();assert.deepEqual(f.calls.reads,['ogrenciler/a/donemler/2026-2027']);assert.equal(scope.galleryChildClass(childA,f.state()),'Yasemin');
 const proof=f.state().galeriSinifBaglami;assert.equal(proof.ogrenciId,'a');assert.equal(proof.donem,'2026-2027');assert.equal('user' in proof,false);assert.equal('kayit' in proof,false);assert.equal(Object.isFrozen(proof),true);
 const r=reader(f,[photo('period'),photo('master',{hedefDeger:'Mimoza'})]);await r.render();assert.deepEqual(r.ids(),['period']);assert.ok(r.calls.some(q=>q.filters.some(w=>w.field==='hedefDeger'&&w.value==='Yasemin')));assert.ok(!r.calls.some(q=>q.filters.some(w=>w.field==='hedefDeger'&&w.value==='Mimoza')));
 assert.equal(scope.targetChild(photo('p'),[childA],f.state()),childA);assert.equal(scope.targetChild(photo('m',{hedefDeger:'Mimoza'}),[childA],f.state()),null);
});
test('overlapping child A and B reads cannot attach the late A class or update B view',async()=>{
 const f=fixture(),a=f.run(childA),b=f.run(childB);assert.equal(f.state().galeriSinifBaglami.durum,'yukleniyor');f.resolve(1,{kayit:{sinif:'Lavanta'}});await b;f.resolve(0,{kayit:{sinif:'Yasemin'}});await a;
 assert.equal(f.state().galeriSinifBaglami.ogrenciId,'b');assert.equal(scope.galleryChildClass(childB,f.state()),'Lavanta');assert.equal(f.calls.tabs.length,1);assert.equal(f.c.veliAktifDonemVeri.kayit.sinif,'Lavanta');
});
test('same-child overlapping refresh only allows the latest read to bind',async()=>{const f=fixture(),a=f.run(childB),b=f.run(childB);f.resolve(1,{kayit:{sinif:'Yasemin'}});await b;f.resolve(0,{kayit:{sinif:'Lavanta'}});await a;assert.equal(scope.galleryChildClass(childB,f.state()),'Yasemin');assert.equal(f.calls.tabs.length,1)});
test('UID, same-UID auth epoch, user-object restart and period switches discard delayed hydration',async()=>{
 for(const change of [c=>c.currentUser={...user,uid:'other'},c=>c.portalOturumSurumu++,c=>c.currentUser={...user},c=>c.AKTIF_DONEM='2027-2028']){const f=fixture(),p=f.run(childA);change(f.c);f.resolve(0,{kayit:{sinif:'Yasemin'}});await p;assert.equal(f.state().galeriSinifBaglami,null);assert.equal(scope.galleryChildClass(childA,f.state()),'');assert.equal(f.calls.tabs.length,0);}
});
test('binding clears synchronously before read; a missing, inactive or unclassified period never inherits master class',async()=>{
 for(const data of [null,{}, {aktif:false,kayit:{sinif:'Yasemin'}},{durum:'arsiv',kayit:{sinif:'Yasemin'}},{kayit:{sinif:''}}]){const f=await hydrated(),p=f.run(childA);assert.equal(scope.galleryChildClass(childA,f.state()),'');f.resolve(1,data);await p;assert.equal(scope.galleryChildClass(childA,f.state()),'');assert.equal(f.state().galeriSinifBaglami.durum,'eksik');}
});
test('read failure is explicit; retry can recover without querying an unverified class',async()=>{
 const f=fixture(),p=f.run(childB);f.pending[0].reject(Error('private URL/token'));await p;assert.equal(f.state().galeriSinifBaglami.durum,'hata');const r=reader(f,[photo('yes')]);await r.render();assert.equal(r.calls.length,4);assert.match(r.root.innerHTML,/sınıfı doğrulanamadı/);assert.doesNotMatch(r.root.innerHTML,/Henüz paylaşılan anı yok|private/);
 const retry=r.window._vg.tekrar('g');f.resolve(1,{kayit:{sinif:'Yasemin'}});await retry;assert.deepEqual(r.ids(),['yes']);assert.doesNotMatch(r.root.innerHTML,/eksik olabilir/);
});
test('foreign selected child cannot hydrate and stale bindings cannot authorize class actions',async()=>{
 const f=await hydrated();await f.run({id:'foreign',sinif:'Yasemin'});assert.equal(f.calls.reads.length,1);assert.equal(f.state().galeriSinifBaglami,null);assert.equal(scope.isGalleryParent(f.state()),false);
});
test('query-faithful class aliases stay within approved audience and exact active period',async()=>{
 const f=await hydrated(),r=reader(f,[photo('alias',{hedefDeger:'Kardelenler Sınıfı'}),photo('current'),photo('legacy-period',{donem:undefined}),photo('old',{donem:'2025-2026'}),photo('pending',{durum:'beklemede'}),photo('class-only',{hedefTur:undefined,hedefDeger:undefined,sinif:'Yasemin'}),photo('wrong',{hedefDeger:'Mimoza'}),photo('conflict',{hedefTur:'ogrenci',hedefDeger:'a',ogrenciId:'b'})]);await r.render();assert.deepEqual(r.ids().sort(),['alias','current','legacy-period']);assert.equal(scope.targetChild(photo('old',{donem:'2025-2026'}),[childA],f.state()),null);
 for(const q of r.calls){assert.equal(q.collection,'galeri');assert.ok(q.filters.some(w=>w.field==='durum'&&w.value==='onaylandi'));assert.ok(q.filters.some(w=>['hedefTur','hedefOgrenciId','ogrenciId'].includes(w.field)));assert.ok(!q.filters.some(w=>w.field==='sinif'));}
});
test('partial and all query failures show incomplete state; retry replaces counts with complete results',async()=>{
 const f=await hydrated(),r=reader(f,[photo('class'),photo('school',{hedefTur:'tumOkul'}),photo('child',{hedefTur:'ogrenci',hedefDeger:'a'})]);r.fail(q=>q.filters.some(w=>w.field==='hedefTur'&&w.value==='sinif'));await r.render();assert.deepEqual(r.ids().sort(),['child','school']);assert.match(r.root.innerHTML,/sorguları tamamlanamadı/);assert.doesNotMatch(r.root.innerHTML,/private/);assert.doesNotMatch(r.root.innerHTML.split('<pre hidden')[0],/permission-denied/);
 r.fail(()=>true);await r.render();assert.deepEqual(r.ids(),[]);assert.match(r.root.innerHTML,/Tekrar dene/);assert.doesNotMatch(r.root.innerHTML,/Henüz paylaşılan anı yok/);
 r.fail(()=>false);await r.window._vg.tekrar('g');assert.deepEqual(r.ids().sort(),['child','class','school']);assert.doesNotMatch(r.root.innerHTML,/eksik olabilir/);
});
test('targeted reader does not truncate or add pagination: 501 synthetic rows all survive',async()=>{const f=await hydrated(),r=reader(f,Array.from({length:501},(_,i)=>photo('item-'+i)));await r.render();assert.equal(r.ids().length,501);assert.doesNotMatch(moduleSource,/fb\.(?:limit|startAfter|orderBy)\(/)});
test('tracking and download use the bound class, and never fetch a master-class item',async()=>{
 const f=await hydrated(),writes=[],fetched=[];const api={get state(){return f.state()},db:{},toast(){},fb:{doc:()=>'',runTransaction:async(_,fn)=>fn({get:async()=>({exists:()=>false}),set:(_,v)=>writes.push(v)})}};
 assert.equal(await scope.createInteractionService(()=>api).record(photo('period'),'acma'),true);assert.equal(await scope.createInteractionService(()=>api).record(photo('wrong',{hedefDeger:'Mimoza'}),'acma'),false);assert.equal(writes.length,1);
 const old=globalThis.window;globalThis.window={PortalAPI:api,fetch:async u=>{fetched.push(u);throw Error('synthetic')} };try{assert.equal(await downloadMedia(photo('wrong',{hedefDeger:'Mimoza'})),false);assert.equal(fetched.length,0)}finally{if(old===undefined)delete globalThis.window;else globalThis.window=old}
});
test('logout and all period assignment paths explicitly invalidate the gallery class binding',()=>{
 const logout=index.slice(index.indexOf('window.signOut = async function'),index.indexOf('let portalOturumSurumu'));
 assert.ok(logout.indexOf('veliGaleriSinifSifirla()')<logout.indexOf('await fbSignOut'));
 for(const text of ['AKTIF_DONEM = snap.data().aktif;','AKTIF_DONEM = donem;','AKTIF_DONEM = yeniDonem;']){const at=index.indexOf(text);assert.match(index.slice(at-110,at),/veliGaleriSinifSifirla\(\)/)}
});

test('gallery proof read failure preserves the existing period cache for unrelated parent modules',async()=>{
 const f=fixture(),p=f.run(childA);f.pending[0].reject(Error('synthetic failure'));await p;
 assert.equal(f.state().galeriSinifBaglami.durum,'hata');assert.equal(scope.galleryChildClass(childA,f.state()),'');
 assert.equal(f.c.veliAktifDonemVeri,childA._donemVeri);assert.equal(f.calls.welcome[0],childA._donemVeri);assert.equal(f.calls.tabs.length,1);
});
test('absent verified class cannot match a punctuation-only media target',async()=>{
 const f=await hydrated({});assert.equal(scope.targetChild(photo('malformed',{hedefDeger:'!!!'}),[childA],f.state()),null);
});
function diagnostic(r){const text=r.root.innerHTML.match(/<pre hidden data-vg-diagnostic[^>]*>([^<]*)<\/pre>/)?.[1];assert.ok(text);return JSON.parse(text)}
test('collapsed technical panel uses only selected-scope aggregates and toggles with zero extra queries',async()=>{
 const f=await hydrated(),r=reader(f,[photo('private-id',{etkinlikBaslik:'PRIVATE TITLE',program:'PRIVATE PROGRAM',konuBaslik:'PRIVATE TOPIC',email:'PRIVATE EMAIL'}),photo('old',{donem:'2025-2026'}),photo('unknown-period',{donem:undefined}),photo('foreign-child',{hedefTur:'ogrenci',hedefDeger:'b'}),photo('foreign-class',{hedefDeger:'Lavanta'})]);await r.render();const d=diagnostic(r),serialized=JSON.stringify(d);
 assert.equal(d.sinifDogrulandi,true);assert.deepEqual(d.donem,{ayni:1,belirsiz:1,farkli:1});assert.equal(d.gorunen.toplam,2);assert.equal(d.programlar.diger,2);
 for(const privateText of ['PRIVATE','private-id','Yasemin','Mimoza','example.invalid','2026-2027','parent','foreign-child'])assert.ok(!serialized.includes(privateText),privateText);
 const count=r.calls.length,panel={hidden:true,hasAttribute:n=>n==='data-vg-diagnostic'},button={nextElementSibling:panel,setAttribute(k,v){this[k]=v}};
 r.window._vg.teknik(button);assert.equal(panel.hidden,false);assert.equal(button['aria-expanded'],'true');r.window._vg.teknik(button);assert.equal(panel.hidden,true);assert.equal(r.calls.length,count);
});
test('technical errors use an allowlist, and context invalidation clears diagnostics and disables an old toggle',async()=>{
 const f=await hydrated(),r=reader(f,[photo('class')]);r.fail(()=>true);await r.render();assert.deepEqual(diagnostic(r).sorgular.hataKodlari,['permission-denied']);
 r.window.PortalAPI.fb.getDocs=async()=>{throw Object.assign(Error('PRIVATE URL'),{code:'PRIVATE CODE'})};await r.render();assert.deepEqual(diagnostic(r).sorgular.hataKodlari,['unknown']);assert.doesNotMatch(r.root.innerHTML,/PRIVATE/);
 const panel={hidden:true,hasAttribute:()=>true},button={nextElementSibling:panel,setAttribute(){}};f.c.portalOturumSurumu++;r.window._vg.invalidate();r.window._vg.teknik(button);assert.equal(r.root.innerHTML,'');assert.equal(panel.hidden,true);
});
