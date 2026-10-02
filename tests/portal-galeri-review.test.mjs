import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { targetChild, createInteractionService } from '../js/portal-galeri-etkilesim.js';
import { downloadMedia, downloadAlbum, galleryProgram, installLiveGallery } from '../js/portal-galeri-canli.js';

// Synthetic media only. No Firebase, external requests, or real browser saves.
const child = { id:'synthetic-child', sinif:'Mimoza Çiçekleri Sınıfı' };
const photo = (id, extra = {}) => ({ id, durum:'onaylandi', dosyaTipi:'foto',
  hedefTur:'ogrenci', hedefDeger:child.id, etkinlikBaslik:'Synthetic album',
  etkinlikTarih:'2026-09-30', bunnyUrl:`https://example.invalid/${id}.jpg`,
  orjinalAd:'same-photo.jpg', ...extra });

test('modern gallery class aliases and consistent supported student ID fields remain openable', () => {
  for (const alias of ['Mimoza','Papatyalar Sınıfı','Montessori 1','Toddler',child.sinif]) {
    assert.equal(targetChild(photo('m',{hedefTur:'sinif',hedefDeger:alias}), [child]), child, alias);
  }
  assert.equal(targetChild(photo('m',{hedefTur:'sinif',hedefDeger:'Yasemin'}), [child]), null);
  assert.equal(targetChild(photo('m',{hedefDeger:undefined,hedefOgrenciId:child.id}), [child]), child);
  assert.equal(targetChild(photo('m',{hedefDeger:'legacy-value',hedefOgrenciId:child.id}), [child]), null);
  assert.equal(targetChild(photo('m',{hedefDeger:undefined,ogrenciId:child.id}), [child]), child);
  assert.equal(targetChild(photo('m',{hedefDeger:'legacy-value',ogrenciId:child.id}), [child]), null);
  assert.equal(targetChild(photo('m',{durum:'beklemede'}), [child]), null);
});

test('class audience uses the current period setting before the base class', () => {
  const state = { ayarListesi:{[child.id]:{kayit:{sinif:'Yasemin Çiçekleri Sınıfı'}}} };
  assert.equal(targetChild(photo('m',{hedefTur:'sinif',hedefDeger:'Kardelenler Sınıfı'}), [child], state), child);
  assert.equal(targetChild(photo('m',{hedefTur:'sinif',hedefDeger:'Mimoza'}), [child], state), null);
});

test('education ZIP classification preserves canonical, localized, and title-derived groups', () => {
  for (const [media, expected] of [
    [{program:'degerlerPlus'},'degerlerPlus'], [{kategori:'Değerler+'},'degerlerPlus'],
    [{kategori:'Orman Okulu'},'orman'], [{etkinlikBaslik:'İngilizce Eğitimi'},'ingilizce'],
    [{program:'montessori'},'montessori'], [{etkinlikBaslik:'Synthetic picnic'},'']
  ]) assert.equal(galleryProgram(media), expected);
});

function fixture(media = []) {
  let state = { rol:'veli', currentUser:{uid:'parent-one',email:'one@example.invalid'},
    veliOgrenciler:[child], ogrenciList:[child], ayarListesi:{} };
  const writes = [], fetched = [], toasts = [], archives = [], clicks = [];
  const fb = {
    doc:(_db,...parts) => parts.join('/'), collection:(_db,...parts) => parts.join('/'),
    runTransaction:async (_db, callback) => callback({
      get:async () => ({exists:() => false,data:() => ({})}),
      set:(ref,data) => writes.push({ref,data})
    })
  };
  const api = { db:{}, fb, get state(){return state;}, toast:(...args) => toasts.push(args) };
  const win = { PortalAPI:api, veliGaleriVerisi:media, galeriListesiVerisi:media,
    confirm:() => true, portalAracYukle:async () => {},
    fetch:async url => { fetched.push(url); return {ok:true,blob:async () => new Blob(['synthetic'],{type:'image/jpeg'})}; },
    URL:{createObjectURL:() => 'blob:synthetic',revokeObjectURL(){}}, setTimeout(){},
    document:{body:{append(){}}, createElement:() => ({remove(){}, click(){clicks.push(this.download);}})},
    JSZip:class {
      constructor(){this.entries=[];archives.push(this);}
      file(name,blob){this.entries.push({name,blob});}
      async generateAsync(){return new Blob(['synthetic zip'],{type:'application/zip'});}
    }
  };
  return { win, api, fb, writes, fetched, toasts, archives, clicks, setState:value => {state=value;},
    changeParent:() => {state={...state,currentUser:{uid:'parent-two',email:'two@example.invalid'}};} };
}
async function useWindow(f, fn) {
  const previous = globalThis.window;
  globalThis.window=f.win;
  try { return await fn(); } finally {
    if (previous === undefined) delete globalThis.window; else globalThis.window=previous;
  }
}
const albumArgs = ['Synthetic album','2026-09-30','ogrenci',child.id];

test('partial ZIP failure records only included media, with unique filenames and honest browser status', async () => {
  const f=fixture([photo('good-one'),photo('bad'),photo('good-two')]);
  const fetch=f.win.fetch;
  f.win.fetch=async url => url.includes('/bad.') ? {ok:false} : fetch(url);
  await useWindow(f,async () => assert.equal(await downloadAlbum(...albumArgs),true));
  assert.equal(f.archives[0].entries.length,2);
  assert.deepEqual(f.archives[0].entries.map(x=>x.name),['001_same-photo.jpg','002_same-photo.jpg']);
  assert.deepEqual(f.writes.map(x=>x.ref).sort(),['galeri/good-one/etkilesimler/parent-one','galeri/good-two/etkilesimler/parent-one']);
  assert.ok(f.writes.every(x=>x.data.indirmeBaslatildi===true && x.data.indirildi===false));
  assert.match(f.toasts.at(-1)[0],/2 dosya, 1 alınamadı/);
  assert.equal(f.clicks.length,1);
});

test('canonical degerlerPlus album actually reaches ZIP creation', async () => {
  const f=fixture([photo('plus',{program:'degerlerPlus'})]);
  await useWindow(f,async () => assert.equal(await downloadAlbum('Değerler+','','__egitim__','degerlerPlus'),true));
  assert.equal(f.archives[0].entries.length,1);
  assert.equal(f.writes.length,1);
});

test('ZIP picker cancellation performs no fetch/write and releases the busy guard for retry', async () => {
  const f=fixture([photo('one')]);
  f.win.showSaveFilePicker=async () => {throw Object.assign(new Error('cancel'),{name:'AbortError'});};
  await useWindow(f,async () => {
    assert.equal(await downloadAlbum(...albumArgs),false);
    assert.equal(f.fetched.length,0);assert.equal(f.writes.length,0);assert.equal(f.toasts.length,0);
    delete f.win.showSaveFilePicker;
    assert.equal(await downloadAlbum(...albumArgs),true);
  });
  assert.equal(f.writes.length,1);
});

test('ZIP save failure never records a download or claims completion', async () => {
  const f=fixture([photo('one')]);let aborted=false;
  f.win.showSaveFilePicker=async () => ({createWritable:async () => ({write:async()=>{},
    close:async()=>{throw new Error('Synthetic disk full');},abort:async()=>{aborted=true;}})});
  await useWindow(f,async () => assert.equal(await downloadAlbum(...albumArgs),false));
  assert.equal(aborted,true);assert.equal(f.writes.length,0);assert.equal(f.clicks.length,0);
  assert.match(f.toasts.at(-1)[0],/disk full/);
});

test('individual download and ZIP are cancelled before save when another account signs in mid-fetch', async () => {
  for (const album of [false,true]) {
    const f=fixture([photo('one')]), fetch=f.win.fetch;
    f.win.fetch=async url => {f.changeParent();return fetch(url);};
    await useWindow(f,async () => assert.equal(await (album?downloadAlbum(...albumArgs):downloadMedia(photo('one'))),false));
    assert.equal(f.clicks.length,0);assert.equal(f.writes.length,0,album?'ZIP':'individual');
  }
});

test('parent report with a changed management session fails instead of exposing the stale result', async () => {
  const f=fixture();f.setState({rol:'mudur',currentUser:{uid:'manager'},ogrenciList:[child]});
  f.fb.getDocs=async () => {f.setState({rol:'veli',currentUser:{uid:'parent-two'}});return {docs:[]};};
  await assert.rejects(createInteractionService(()=>f.api).report(photo('one')),/Oturum değişti/);
});

function educationWrapper(source) {
  const start=source.indexOf('function fonksiyonlariSar()'), end=source.indexOf('\nfunction api()',start);
  assert.ok(start>=0 && end>start,'real education wrapper must be available');
  const timers=[],enriched=[],removed=[];let open=false;
  const content={classList:{remove:cls=>removed.push(cls)},style:{}};
  const modal={classList:{contains:cls=>cls==='active'&&open}};
  const win={acGaleriLightbox:id=>{open=true;return id;},closeGaleriLightbox:()=>{open=false;}};
  const context=vm.createContext({window:win,document:{getElementById:id=>id==='galeriLightbox'?modal:content},
    setTimeout:fn=>timers.push(fn),lightboxZenginlestir:id=>enriched.push(id)});
  vm.runInContext(`let lightboxTicket=0;\n${source.slice(start,end)}\nfonksiyonlariSar();`,context);
  return {win,enriched,removed,content,flush(){while(timers.length)timers.shift()();}};
}
const educationSource=await readFile(new URL('../js/zeky-galeri-onay-egitim.js',import.meta.url),'utf8');

test('rapid education opens enrich only the newest item and restore neutral layout before rendering', () => {
  const f=educationWrapper(educationSource);
  f.win.acGaleriLightbox('education-A');f.win.acGaleriLightbox('education-B');f.flush();
  assert.deepEqual(f.enriched,['education-B']);
  assert.deepEqual(f.removed,['zgo-grid','zgo-grid']);assert.match(f.content.style.cssText,/display:flex/);
});

test('closing before education enrichment leaves no stale pane; reopening gets only the new item', () => {
  const f=educationWrapper(educationSource);
  f.win.acGaleriLightbox('education-A');f.win.closeGaleriLightbox();f.flush();assert.deepEqual(f.enriched,[]);
  f.win.acGaleriLightbox('education-B');f.flush();assert.deepEqual(f.enriched,['education-B']);
  f.win.acGaleriLightbox('education-C');f.win.closeGaleriLightbox();f.win.acGaleriLightbox('education-D');f.flush();
  assert.deepEqual(f.enriched,['education-B','education-D']);
});

class MediaElement {
  constructor(tag, document) {
    this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];
    this.dataset={};this.style={};this.events={};this.hidden=false;
  }
  get childNodes(){return this.children;}
  get parentNode(){return this.parent;}
  append(...children){for(const child of children){child.remove();child.parent=this;this.children.push(child);}}
  prepend(child){child.remove();child.parent=this;this.children.unshift(child);}
  replaceChildren(...children){for(const child of this.children)child.parent=null;this.children=[];this.append(...children);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  setAttribute(name,value){this[name]=value;}
  removeAttribute(name){delete this[name];}
  addEventListener(name,fn){(this.events[name] ||= []).push(fn);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  querySelectorAll(selector){
    return this.children.flatMap(child=>[
      ...((selector==='[data-pg-media]'&&child.dataset.pgMedia)||
        (selector==='.zgo-medya'&&child.className==='zgo-medya')||
        (selector==='video'&&child.tagName==='VIDEO') ? [child]:[]),
      ...child.querySelectorAll(selector)
    ]);
  }
  pause(){this.paused=true;}
  load(){this.reloadCount=(this.reloadCount||0)+1;}
}

test('installed live wrapper preserves media lifecycle across close, same-ID reopen, and education node moves', () => {
  const previousWindow=globalThis.window, previousDocument=globalThis.document;
  const timers=[], list=[photo('video',{dosyaTipi:'video',bunnyUrl:'https://example.invalid/synthetic.mp4'})];
  const document={createElement:tag=>new MediaElement(tag,document),querySelectorAll:()=>[],body:{}};
  const content=new MediaElement('div',document);
  document.getElementById=id=>id==='galeriLightboxIcerik'?content:null;
  const win={PortalAPI:{state:{rol:'mudur',currentUser:{uid:'manager'}}},
    galeriListesiVerisi:list,veliGaleriVerisi:list,setTimeout:fn=>timers.push(fn),
    MutationObserver:class {observe(){}},
    acGaleriLightbox(){
      content.replaceChildren(document.createElement('iframe'));
      // Models the existing education wrapper: it moves actual player nodes asynchronously.
      timers.push(()=>{const nodes=[...content.childNodes],host=document.createElement('div');
        host.className='zgo-medya';content.replaceChildren(host);host.append(...nodes);});
    },
    veliAcGaleriLightbox(){content.replaceChildren(document.createElement('iframe'));},
    closeGaleriLightbox(){content.replaceChildren();}
  };
  globalThis.window=win;globalThis.document=document;
  const flush=()=>{while(timers.length)timers.shift()();};
  try {
    assert.equal(installLiveGallery(win),true);
    win.acGaleriLightbox('video');flush();
    const first=content.querySelector('video');
    assert.ok(first);assert.equal(first.controls,true);assert.equal(first.src,list[0].bunnyUrl);
    win.closeGaleriLightbox();assert.equal(first.paused,true);assert.equal(first.src,undefined);
    assert.equal(content.children.length,0);assert.equal(content.dataset.pgMedia,undefined);
    win.acGaleriLightbox('video');flush();
    const reopened=content.querySelector('video');
    assert.ok(reopened);assert.notEqual(reopened,first);assert.equal(reopened.src,list[0].bunnyUrl);
    win.closeGaleriLightbox();
    assert.equal(reopened.paused,true);assert.equal(reopened.src,undefined);
  } finally {
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
});

test('topic ZIP includes only the same program, normalized topic, exact audience and period',async()=>{
 const {galleryFolderKey}=await import('../js/galeri-klasorleri.js');
 const base={program:'kodlama',konuBaslik:'Robot Köprüsü',donem:'2026-2027'};
 const selected=photo('first',base);
 const f=fixture([selected,photo('second',{...base,konuBaslik:' ROBOT   KÖPRÜSÜ ',etkinlikTarih:'2026-10-02'}),photo('other-topic',{...base,konuBaslik:'Başka Konu'}),photo('other-program',{...base,program:'drama'}),photo('other-period',{...base,donem:'2025-2026'}),photo('school',{...base,hedefTur:'tumOkul',hedefDeger:''}),photo('pending',{...base,durum:'beklemede'}),photo('rejected',{...base,durum:'reddedildi'})]);
 await useWindow(f,async()=>assert.equal(await downloadAlbum('Robot Köprüsü','','','',{program:'kodlama',folderKey:galleryFolderKey(selected)}),true));
 assert.equal(f.archives[0].entries.length,2);assert.deepEqual(f.writes.map(x=>x.ref).sort(),['galeri/first/etkilesimler/parent-one','galeri/second/etkilesimler/parent-one']);
});
