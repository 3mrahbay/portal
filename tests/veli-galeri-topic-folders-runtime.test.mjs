import { galleryLightboxStyles, galleryLightboxIcons, lightboxDownload } from '../js/portal-galeri-lightbox-ui.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { galleryMediaType, galleryDisplayUrl, downloadSource } from '../js/portal-galeri-medya.js';
import * as folders from '../js/galeri-klasorleri.js';
import { targetChild, isGalleryParent, childTargetMatches, galleryChildClass, galleryParentKey } from '../js/portal-galeri-etkilesim.js';

const source = (await readFile(new URL('../moduller/veli-galeri.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('export async function render(', 'async function render(');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const decode = value => value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const media = (id, overrides = {}) => ({ id, durum:'onaylandi', hedefTur:'sinif', hedefDeger:'Mimoza', program:'jimnastik', konuBaslik:'Denge', etkinlikBaslik:'Denge', bunnyUrl:`https://example.invalid/${id}.jpg`, dosyaTipi:'foto', etkinlikTarih:'2026-10-01', ...overrides });

function runtime(rows, options = {}) {
  const nodes = new Map(), calls = { queries:[], mount:[], opens:[], downloads:[], disposed:[] };
  class Element {
    constructor(){this.innerHTML='';this.style={};this.dataset={};}
    querySelectorAll(selector){
      if(selector!=='[data-vg-thumbnail]')return[];
      return [...this.innerHTML.matchAll(/data-vg-thumbnail="([^"]*)"/g)].map(match=>({dataset:{vgThumbnail:decode(match[1])},style:{}}));
    }
    querySelector(selector){return selector==='[data-vg-media]'?{element:this}:null;}
    remove(){nodes.delete(this.id);}
  }
  const root = new Element();nodes.set('gallery',root);
  const state = {rol:'veli',currentUser:{uid:'parent'},veliAktifOgrenci:{id:'child-a',sinif:'Mimoza'},veliOgrenciler:[{id:'child-a',sinif:'Mimoza'},{id:'child-b',sinif:'Yasemin'}],ayarListesi:{}};
  state.aktifDonem='2026-2027';state.galeriSinifBaglami={uid:'parent',oturum:0,surum:1,donem:state.aktifDonem,ogrenciId:'child-a',sinif:'Mimoza',durum:'hazir'};
  const fb={collection:(_db,name)=>name,where:(field,operator,value)=>({field,operator,value}),query:(collection,...where)=>({collection,where}),getDocs:async query=>{
    calls.queries.push(query);
    const chosen=options.getRows?await options.getRows(query,rows):rows;
    return{forEach:fn=>chosen.forEach(row=>fn({id:row.id,data:()=>row}))};
  }};
  const window={PortalAPI:{fb,db:{},state,esc,lucide(){}},...options.window};
  const context={galleryLightboxStyles,galleryLightboxIcons,lightboxDownload,...folders,window,console,document:{getElementById:id=>nodes.get(id)||null,createElement:()=>new Element(),body:{appendChild:el=>nodes.set(el.id,el)}},targetChild,isGalleryParent,childTargetMatches,galleryChildClass,galleryParentKey,galleryMediaType,galleryDisplayUrl,downloadSource,
    mountMedia:(host,m,opts)=>calls.mount.push({host,id:m.id,opts}),disposeMedia:el=>calls.disposed.push(el),recordOpen:m=>calls.opens.push(m.id),downloadMedia:(m,button)=>calls.downloads.push({id:m.id,button})};
  vm.runInNewContext(source+'\nglobalThis.renderGallery=render;',context);
  const actions = html => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match=>({attributes:match[1],text:decode(match[2].replace(/<[^>]*>/g,'')),id:Number(match[1].match(/window\._vg\.eylem\((\d+),this\)/)?.[1])}));
  return {root,state,calls,window,nodes,actions,
    render:()=>context.renderGallery('gallery'),
    async click(text,index=0){const matches=actions(root.innerHTML).filter(a=>a.text.includes(text));assert.ok(matches[index],`button ${text} (${index}) missing: ${root.innerHTML}`);return window._vg.eylem(matches[index].id,{});},
    ids:()=>[...root.innerHTML.matchAll(/data-vg-thumbnail="([^"]*)"/g)].map(match=>decode(match[1])),
    html:()=>root.innerHTML,
    lightbox:()=>nodes.get('vgLightbox')
  };
}

test('program cards expose all eight programs, then repeated title uploads merge across dates', async()=>{
  const rows=Object.keys(folders.GALLERY_PROGRAMS).map((program,i)=>media(`program-${i}`,{program}));
  rows.push(media('second',{etkinlikTarih:'2026-09-01',konuBaslik:'  DENGE  '}));
  const r=runtime(rows);await r.render();
  for(const name of Object.values(folders.GALLERY_PROGRAMS))assert.ok(r.html().includes(name));
  assert.match(r.html(),/repeat\(2,minmax\(0,1fr\)\)/);
  await r.click('Jimnastik');
  assert.equal(r.actions(r.html()).filter(a=>a.text.includes('Denge')).length,1);
  assert.match(r.html(),/2 içerik/);assert.match(r.html(),/1 Eylül 2026/);assert.match(r.html(),/1 Ekim 2026/);
  await r.click('Denge');assert.deepEqual(r.ids(),['program-5','second']);
});

test('topic folders preserve exact class, child, program, and period boundaries without trusting stored keys',async()=>{
  const shared={konuBaslik:'Aynı Konu',konuAnahtari:'forged-common',albumId:'same-album'};
  const r=runtime([
    media('class-now',{...shared,donem:'2026-2027'}),
    media('class-before',{...shared,donem:'2025-2026'}),
    media('class-alias',{...shared,hedefDeger:'Mimoza Çiçekleri Sınıfı',donem:'2026-2027'}),
    media('school',{...shared,hedefTur:'tumOkul',hedefDeger:'',donem:'2026-2027'}),
    media('child',{...shared,hedefTur:'ogrenci',hedefDeger:'child-a',donem:'2026-2027'}),
    media('sibling',{...shared,hedefTur:'ogrenci',hedefDeger:'child-b',donem:'2026-2027'}),
    media('other-class',{...shared,hedefDeger:'Yasemin',donem:'2026-2027'}),
    media('drama',{...shared,program:'drama',donem:'2026-2027'})
  ]);
  await r.render();await r.click('Jimnastik');
  assert.equal(r.actions(r.html()).filter(a=>a.text.includes('Aynı Konu')).length,4);
  assert.doesNotMatch(r.html(),/2025-2026/);
  const folderIds=r.actions(r.html()).filter(a=>a.text.includes('Aynı Konu')).map(a=>a.id);
  await r.window._vg.eylem(folderIds[0],{});assert.equal(r.ids().length,1);
  assert.ok(!r.html().includes('sibling'));assert.ok(!r.html().includes('other-class'));
  await r.window._vg.egitimGeri('gallery');await r.window._vg.egitimGeri('gallery');
  await r.click('Drama');await r.click('Aynı Konu');assert.deepEqual(r.ids(),['drama']);
});

test('manual historical titles and untitled media remain topics while observations retain development areas',async()=>{
  const r=runtime([
    media('observation',{program:'montessori',konuBaslik:undefined,baslik:'Boncuk',kazanimAnahtari:'matematik__sayma',alanId:'matematik',alanAd:'Matematik',egitimKaydi:true}),
    media('observation2',{program:'montessori',konuBaslik:undefined,baslik:'Sayılar',kazanimAnahtari:'matematik__sayilar',alanId:'matematik',alanAd:'Matematik'}),
    media('manual',{program:'montessori',konuBaslik:undefined,baslik:'Matematik',etkinlikBaslik:'Montessori',egitimKaydi:true}),
    media('general',{program:'montessori',konuBaslik:undefined,etkinlikBaslik:'',baslik:''})
  ]);
  await r.render();await r.click('Montessori');
  assert.equal(r.actions(r.html()).filter(a=>a.text.includes('Matematik')).length,2);
  assert.match(r.html(),/2 aşama kaydı/);assert.match(r.html(),/1 içerik/);assert.match(r.html(),/Genel/);
  await r.click('2 aşama kaydı');assert.deepEqual(r.ids(),['observation','observation2']);
  await r.window._vg.egitimGeri('gallery');await r.click('1 içerik');assert.deepEqual(r.ids(),['manual']);
});

test('quotes, backslashes, Unicode and markup in titles remain escaped and navigable',async()=>{
  const title='O\'nun "İ" \\ <img src=x onerror=alert(1)> 🧩';
  const r=runtime([media('quoted',{konuBaslik:title}),media('normalized',{konuBaslik:'  '+title.normalize('NFD')+'  '})]);
  await r.render();await r.click('Jimnastik');
  assert.ok(!r.html().includes('<img src=x'));assert.ok(r.html().includes('&lt;img src=x'));
  for(const match of r.html().matchAll(/onclick="([^"]*)"/g))assert.match(match[1],/^window\._vg\.eylem\(\d+,this\)$/);
  await r.click(title);assert.deepEqual(r.ids(),['quoted','normalized']);
  r.window._vg.buyut('quoted','gallery');assert.ok(r.lightbox());assert.ok(r.lightbox().innerHTML.includes('&lt;img src=x'));
});

test('approved targeted reads retain post-query audience checks and deduplicate results',async()=>{
  const r=runtime([
    media('yes'),media('pending',{durum:'beklemede'}),media('no-url',{bunnyUrl:''}),
    media('wrong-class',{hedefDeger:'Yasemin'}),media('wrong-child',{hedefTur:'ogrenci',hedefDeger:'child-b'}),
    media('school',{hedefTur:'tumOkul'}),media('child',{hedefTur:'ogrenci',hedefDeger:'child-a'})
  ]);
  await r.render();await r.click('Jimnastik');
  for(const q of r.calls.queries){assert.equal(q.collection,'galeri');assert.ok(q.where.some(w=>w.field==='durum'&&w.value==='onaylandi'));assert.ok(q.where.some(w=>['hedefTur','hedefOgrenciId','ogrenciId'].includes(w.field)));}
  assert.equal(r.actions(r.html()).filter(a=>a.text.includes('Denge')).length,3);
  assert.ok(!r.html().includes('wrong'));assert.ok(!r.html().includes('pending'));
  await r.click('Denge');assert.deepEqual(r.ids(),['yes']);
});

test('video thumbnail, player, open and download tracking are retained inside topics',async()=>{
  const r=runtime([media('video',{dosyaTipi:'video',bunnyUrl:'https://example.invalid/clip.mp4',kucukResim:'https://example.invalid/cover.jpg'}),media('photo')]);
  await r.render();await r.click('Jimnastik');await r.click('Denge');
  assert.ok(r.calls.mount.some(c=>c.id==='video'&&c.opts?.thumbnail));
  r.window._vg.buyut('video','gallery');assert.deepEqual(r.calls.opens,['video']);
  assert.ok(r.calls.mount.some(c=>c.id==='video'&&!c.opts));
  const button={};r.window._vg.indir('video',button);assert.deepEqual(r.calls.downloads,[{id:'video',button}]);
  r.window._vg.kapat();assert.equal(r.lightbox(),undefined);
  r.window._vg.buyut('photo','gallery');await r.window._vg.egitimGeri('gallery');assert.equal(r.lightbox(),undefined);
});

test('category filtering keeps a one-item album and lightbox navigation stays within the filter',async()=>{
  const r=runtime([
    media('art',{program:'',kategori:'sanat',albumId:'quoted \' " \\ album',etkinlikBaslik:'Paylaşım',aciklama:'Resim'}),
    media('game',{program:'',kategori:'oyun',albumId:'quoted \' " \\ album',etkinlikBaslik:'Paylaşım',aciklama:'Oyun'})
  ]);
  await r.render();await r.click('Sanat');assert.match(r.html(),/1 klasör/);
  await r.click('Paylaşım');assert.deepEqual(r.ids(),['art']);
  r.window._vg.buyut('art','gallery');assert.match(r.lightbox().innerHTML,/1\/1/);assert.ok(!r.lightbox().innerHTML.includes('Sonraki'));
  await r.window._vg.albumKapat('gallery');assert.match(r.html(),/1 klasör/);
});

test('back and filter changes reset deeper selections and missing topics recover to folder list',async()=>{
  const rows=[media('gym'),media('drama',{program:'drama',konuBaslik:'Sahne'})];
  const r=runtime(rows);await r.render();await r.click('Jimnastik');await r.click('Denge');
  await r.window._vg.egitimGeri('gallery');assert.match(r.html(),/1 içerik/);
  await r.window._vg.egitimGeri('gallery');assert.ok(r.html().includes('Drama'));
  await r.click('Drama');await r.click('Sahne');
  await r.window._vg.filtre('tumu','gallery');await r.click('Jimnastik');assert.match(r.html(),/1 içerik/);
  await r.click('Denge');rows[0].konuBaslik='Yeni';await r.render();assert.match(r.html(),/Yeni/);assert.match(r.html(),/1 içerik/);
});

test('switching active child resets folders, closes the player and blocks stale actions',async()=>{
  const rows=[media('child-a-only',{hedefTur:'ogrenci',hedefDeger:'child-a'}),media('child-b-only',{hedefTur:'ogrenci',hedefDeger:'child-b',konuBaslik:'Yeni Çocuk'})];
  const r=runtime(rows);await r.render();await r.click('Jimnastik');await r.click('Denge');r.window._vg.buyut('child-a-only','gallery');
  r.state.veliAktifOgrenci=r.state.veliOgrenciler[1];
  r.window._vg.indir('child-a-only',{});r.window._vg.buyut('child-a-only','gallery');assert.equal(r.calls.downloads.length,0);assert.equal(r.calls.opens.length,1);
  await r.render();assert.equal(r.lightbox(),undefined);assert.ok(r.html().includes('Jimnastik'));assert.ok(!r.html().includes('Denge'));
  await r.click('Jimnastik');await r.click('Yeni Çocuk');assert.deepEqual(r.ids(),['child-b-only']);
});

test('a slow previous-child read cannot overwrite a newer render or expose sibling media',async()=>{
  let release,blocked=false;const wait=new Promise(resolve=>{release=resolve;});
  const r=runtime([media('a',{hedefTur:'ogrenci',hedefDeger:'child-a'}),media('b',{hedefTur:'ogrenci',hedefDeger:'child-b'})],{getRows:async(_q,rows)=>{if(!blocked)await wait;return rows;}});
  const old=r.render();blocked=true;r.state.veliAktifOgrenci=r.state.veliOgrenciler[1];
  await r.render();await r.click('Jimnastik');await r.click('Denge');assert.deepEqual(r.ids(),['b']);
  release();await old;assert.deepEqual(r.ids(),['b']);
});

test('active-period filtering retains undated legacy records and switching periods blocks stale folders and actions',async()=>{
  const r=runtime([
    media('current',{donem:'2026-2027'}),media('previous',{donem:'2025-2026'}),media('legacy',{donem:''}),
    media('pending-old',{donem:'2025-2026',durum:'beklemede'})
  ]);
  r.state.aktifDonem='2026-2027';await r.render();await r.click('Jimnastik');
  assert.equal(r.actions(r.html()).filter(a=>a.text.includes('Denge')).length,2);assert.ok(!r.html().includes('2025-2026'));
  await r.click('2026-2027');assert.deepEqual(r.ids(),['current']);r.window._vg.buyut('current','gallery');
  const staleActions=r.actions(r.lightbox().innerHTML);
  r.state.aktifDonem='2025-2026';
  r.window._vg.indir('current',{});r.window._vg.buyut('current','gallery');
  for(const a of staleActions)await r.window._vg.eylem(a.id,{});
  assert.equal(r.calls.downloads.length,0);assert.equal(r.calls.opens.length,1);
  r.state.galeriSinifBaglami={...r.state.galeriSinifBaglami,donem:r.state.aktifDonem,surum:2};
  await r.render();assert.equal(r.lightbox(),undefined);await r.click('Jimnastik');
  assert.equal(r.actions(r.html()).filter(a=>a.text.includes('Denge')).length,2);assert.ok(!r.html().includes('2026-2027'));
  await r.click('2025-2026');assert.deepEqual(r.ids(),['previous']);
  await r.window._vg.egitimGeri('gallery');await r.click('Denge',1);assert.deepEqual(r.ids(),['legacy']);
});

test('a slow previous-period read cannot overwrite the active-period view',async()=>{
  let release,blocked=false;const wait=new Promise(resolve=>{release=resolve;});
  const r=runtime([media('old',{donem:'2025-2026'}),media('new',{donem:'2026-2027'})],{getRows:async(_q,rows)=>{if(!blocked)await wait;return rows;}});
  r.state.aktifDonem='2025-2026';const old=r.render();
  blocked=true;r.state.aktifDonem='2026-2027';await r.render();await r.click('Jimnastik');await r.click('Denge');
  assert.deepEqual(r.ids(),['new']);release();await old;assert.deepEqual(r.ids(),['new']);
});
