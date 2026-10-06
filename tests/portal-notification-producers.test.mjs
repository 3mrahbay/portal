// Execute the real inline handlers against a synthetic DOM/Firestore adapter.
// No real accounts, writes, uploads, messages, or network requests are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {gallerySession,galleryApprovalTarget} from '../js/galeri-onay-canli.js';
import { galleryText, galleryProgram } from '../js/galeri-klasorleri.js';
import { hedefVeliEmailleri } from '../js/zeky-bildirim-koprusu.js';

const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
function section(start,end){
  const at=source.indexOf(start),to=source.indexOf(end,at+start.length);
  assert.ok(at>=0&&to>at,`Active inline section missing: ${start}`);
  return source.slice(at,to);
}
const production=[
  section('function getOgrenciDurum(o, ayar)', '// Öğretmen ve finans dışı roller'),
  section('function veliAktifDonemOgrencisiMi(o)', 'window.veliListesiYukle'),
  section('async function portalBildirimGit(', '// Bu köprü yalnız'),
  section('async function portalHedefBildir(', 'function mesajBildirimSohbetAc(')
    .replace(/const m = await import\([^;]+\);/, 'const m = bridge;'),
  section('async function caGozlemDetayKaydet(', 'function caGozlemEgitimGorunumunuGuncelle('),
  section('window.kaydetDuyuru = async function()', '// Hedef velilere mail gönder'),
  section('window.kaydetEtkinlik = async function()', 'async function etkinlikMailGonder('),
  section('function galeriBekliyorMu(', 'async function galeriGozlemOnayiEsitle('),
  section('window.galeriOnayla = async function(', '// Onay bekleyen medya sayısı'),
  section('window.galeriYukle = async function()', '// Lightbox'),
  section('async function galeriGuncellemeBildirimi(', 'async function galeriBildirimMailGonder(')
].join('\n');
const donem='2026-2027';
function environment(t,{role='mudur'}={}){
  const oldWindow=globalThis.window,elements=new Map(),docs=new Map(),writes=[],notices=[],approvalNotices=[],toasts=[],mails=[],trace=[];
  let sequence=0,ctx;
  const controls={fail:path=>false,uploadFail:false,confirmed:true};
  const element=id=>{
    if(!elements.has(id))elements.set(id,{id,value:'',checked:false,disabled:false,style:{},textContent:'',innerHTML:'',
      options:[{dataset:{ad:'Synthetic Child'}}],selectedIndex:0,classList:{add(){},remove(){},contains(){return true;}},
      querySelector:()=>null,querySelectorAll:()=>[]});
    return elements.get(id);
  };
  const students=[
    {id:'a1',sinif:'A',aktifDonem:donem,aktifDonemDurum:'aktif',veliEmail:'a1@example.invalid'},
    {id:'a2',sinif:'A',aktifDonem:donem,aktifDonemDurum:'aktif',veliler:[{eposta:'a2@example.invalid'}]},
    {id:'b',sinif:'B',aktifDonem:donem,aktifDonemDurum:'aktif',veli1Email:'b@example.invalid'},
    {id:'past',sinif:'A',aktifDonem:'2025-2026',aktifDonemDurum:'aktif',durum:'aktif',veliEmail:'past@example.invalid'},
    {id:'archived',sinif:'A',aktifDonem:donem,aktifDonemDurum:'arsiv',durum:'arsiv',veliEmail:'archived@example.invalid'}
  ];
  const settings={a1:{durum:'aktif',kayit:{sinif:'A'}},a2:{durum:'aktif',kayit:{sinif:'A'}},b:{durum:'aktif',kayit:{sinif:'B'}}};
  const collection=(_db,...parts)=>({path:parts.join('/')});
  const doc=(base,...parts)=>{
    const path=parts.length?parts.join('/'):`${base.path}/generated-${++sequence}`;
    return {id:path.split('/').at(-1),path};
  };
  const save=async(kind,ref,data)=>{
    trace.push(`${kind}:${ref.path}`);
    if(controls.fail(ref.path,data))throw Error('synthetic-permission-denied');
    writes.push({kind,path:ref.path,data:structuredClone(data)});
    docs.set(ref.path,{...(docs.get(ref.path)||{}),...structuredClone(data)});
  };
  const window={veliSwitchTab:tab=>trace.push(`tab:${tab}`),caGo:page=>trace.push(`page:${page}`),PortalAPI:{db:{},get state(){return {currentUser:ctx.currentUser,aktifDonem:donem,ogrenciList:ctx.ogrenciList,ayarListesi:ctx.ayarListesi};}}};
  globalThis.window=window;
  t.after(()=>{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;});
  const bridge={hedefVeliEmailleri,bildirimKaydetVePush:async(emails,notice)=>{
    trace.push(`notify:${notice.tip}`);notices.push({emails:[...emails],notice:structuredClone(notice)});
    return {ok:true,adet:emails.length,push:{ok:true}};
  }};
  const quiet={warn(){},error(){},log(){}};
  const attachment={yuklemeSuruyor:()=>false,formEkleri:()=>[],kayitTamamlandi(){}};
  ctx=vm.createContext({window,bridge,gallerySession,galleryApprovalTarget,notifyGalleryApproval:async media=>{approvalNotices.push(media);return{ok:true};},galleryText,galleryProgram,console:quiet,document:{getElementById:element,querySelector:element,querySelectorAll:()=>[]},
    currentUser:{uid:'sender',email:'staff@example.invalid'},aktifPersonel:{adSoyad:'Private Teacher Name'},isAdmin:role==='mudur',aktifKullaniciRol:role,aktifKullaniciSiniflari:['A'],
    AKTIF_DONEM:donem,ogrenciList:students,ayarListesi:settings,db:window.PortalAPI.db,
    veliOgrenciler:students.slice(0,3),veliAktifOgrenci:students[0],
    setAktifVeliOgrenci:async student=>{trace.push(`child:${student.id}`);ctx.veliAktifOgrenci=student;},
    portalDuyuruKaydediliyor:false,portalEtkinlikKaydediliyor:false,
    collection,doc,setDoc:(r,d)=>save('set',r,d),updateDoc:(r,d)=>save('update',r,d),
    getDoc:async ref=>({id:ref.id,exists:()=>docs.has(ref.path),data:()=>structuredClone(docs.get(ref.path))}),
    serverTimestamp:()=>({seconds:1,nanoseconds:0}),tumGelisimOnbelleginiTemizle(){},
    runTransaction:async(_db,callback)=>{
      let pending=[];
      for(let i=0;i<(controls.transactionAttempts||1);i++){
        pending=[];trace.push('transaction-attempt');
        await callback({get:ref=>ctx.getDoc(ref),set:(ref,data)=>pending.push({ref,data})});
      }
      for(const {ref,data} of pending)await save('transaction',ref,data);
      trace.push('transaction-commit');
    },
    showToast:(...args)=>toasts.push(args),danismaSaltOkunurEngelle:()=>false,ogretmenRolMu:()=>ctx.aktifKullaniciRol==='ogretmen',
    modulYukle:async()=>attachment,closeDuyuruModal(){},renderDuyurular(){},closeEtkinlikModal(){},renderEtkinlikler(){},
    duyuruMailGonder:data=>mails.push(data),etkinlikMailGonder:data=>mails.push(data),galeriBildirimMailGonder:async data=>mails.push(data),
    galeriGozlemOnayiEsitle:async()=>{},renderGaleri:async()=>{},confirm:()=>controls.confirmed,
    galeriSecilenDosyalar:[{name:'one.jpg',type:'image/jpeg',size:100}],albumEkleMod:null,
    GALERI_EGITIM_PROGRAMLARI:{montessori:'Montessori',orman:'Orman Okulu'},
    isoTarih:()=> '2026-09-30',resimSikistir:async file=>file,
    medyaYukle:async file=>{if(controls.uploadFail===true||controls.uploadFail===file.name)throw Error('synthetic-upload-failed');return {url:'https://synthetic.invalid/image',yol:'synthetic/path'};},
    galeriVideoYukle:async(file,{onProgress}={})=>{if(controls.uploadFail===true||controls.uploadFail===file.name)throw Error('synthetic-upload-failed');onProgress?.({percent:100});return{embedUrl:'https://iframe.mediadelivery.net/embed/lib/video',videoId:'video',libraryId:'lib',thumbnailUrl:''};},
    closeGaleriYuklemeModal(){},setTimeout,clearTimeout});
  vm.runInContext(production,ctx);
  Object.assign(element('duyuruBaslik'),{value:'Private announcement title'});
  element('duyuruIcerik').value='Private announcement body';element('duyuruAciliyet').value='normal';
  element('duyuruHedefTur').value='sinif';element('duyuruHedefSinif').value='A';element('duyuruHedefOgrenci').value='b';
  element('etkinlikBaslik').value='Private event title';element('etkinlikTarih').value='2026-10-02';
  element('etkinlikHedefTur').value='sinif';element('etkinlikHedefSinif').value='A';element('etkinlikKategori').value='diger';
  element('galeriEtkinlik').value='Private album title';element('galeriEtkinlikTarih').value='2026-09-30';
  element('galeriHedefTur').value='sinif';element('galeriHedefSinif').value='A';element('galeriHedefOgrenci').value='b';
  const childWrites=()=>writes.filter(x=>/^ogrenciler\/[^/]+\/bildirimler\//.test(x.path));
  const seeds=(id,extra={})=>docs.set(`galeri/${id}`,{durum:'beklemede',hedefTur:'sinif',hedefDeger:'A',etkinlikBaslik:'Private album title',...extra});
  return {ctx,window,element,docs,writes,notices,approvalNotices,toasts,mails,trace,controls,childWrites,seeds,
    run:code=>vm.runInContext(code,ctx),sources:kind=>writes.filter(x=>new RegExp(`^${kind}/[^/]+$`).test(x.path))};
}
function assertGeneric(notice,forbidden){
  const n=notice.notice;
  const content=JSON.stringify({baslik:n.pushBaslik??n.baslik,metin:n.pushMetin??n.metin,hedefSayfa:n.hedefSayfa});
  for(const value of forbidden)assert.ok(!content.includes(value),`Private detail in notification: ${value}`);
}

test('actual new announcement handler saves then notifies only current active class parents',async t=>{
  const e=environment(t);await e.window.kaydetDuyuru();
  assert.equal(e.sources('duyurular').length,1);assert.equal(e.notices.length,1);
  assert.deepEqual(e.notices[0].emails,['a1@example.invalid','a2@example.invalid']);
  const record=e.sources('duyurular')[0],n=e.notices[0].notice;
  assert.equal(n.kaynakId,record.path.split('/')[1]);assert.equal(n.olayAnahtari,`duyuru:${n.kaynakId}`);
  assert.ok(e.trace.indexOf(`set:${record.path}`)<e.trace.indexOf('notify:duyuru'));
  assertGeneric(e.notices[0],['Private announcement title','Private announcement body']);
});

test('actual announcement exact-student target and urgent flag reach bridge unchanged',async t=>{
  const e=environment(t);e.element('duyuruHedefTur').value='ogrenci';e.element('duyuruSimsek').checked=true;
  await e.window.kaydetDuyuru();assert.deepEqual(e.notices[0].emails,['b@example.invalid']);
  assert.equal(e.notices[0].notice.sessizUyari,true);
});

test('actual new event handler uses saved source identity and current active class scope',async t=>{
  const e=environment(t);await e.window.kaydetEtkinlik();
  assert.equal(e.sources('etkinlikler').length,1);assert.equal(e.notices.length,1);
  assert.deepEqual(e.notices[0].emails,['a1@example.invalid','a2@example.invalid']);
  const n=e.notices[0].notice;assert.equal(n.tip,'etkinlik');assert.equal(n.olayAnahtari,`etkinlik:${n.kaynakId}`);
  assert.equal(n.hedefSayfa,'veli-program.html');assertGeneric(e.notices[0],['Private event title']);
});

for(const [kind,handler,idField] of [['duyurular','kaydetDuyuru','duyuruDuzenleId'],['etkinlikler','kaydetEtkinlik','etkinlikDuzenleId']]){
  test(`actual ${kind} edit is silent`,async t=>{
    const e=environment(t);e.element(idField).value='existing';await e.window[handler]();
    assert.equal(e.sources(kind).length,1);assert.equal(e.sources(kind)[0].kind,'update');assert.equal(e.notices.length,0);
  });
  test(`actual ${kind} concurrent double save coalesces to one source event`,async t=>{
    const e=environment(t);await Promise.all([e.window[handler](),e.window[handler]()]);
    assert.equal(e.sources(kind).length,1);assert.equal(e.notices.length,1);
  });
  test(`actual ${kind} failed save stays silent and releases the save guard`,async t=>{
    const e=environment(t);e.controls.fail=path=>path.startsWith(`${kind}/`);await e.window[handler]();
    assert.equal(e.notices.length,0);e.controls.fail=()=>false;await e.window[handler]();assert.equal(e.notices.length,1);
  });
}

test('teacher pending photo upload sends approval notice without child/parent notices or mail',async t=>{
  const e=environment(t,{role:'ogretmen'});e.element('galeriMailGonder').checked=true;
  await e.window.galeriYukle();assert.equal(e.sources('galeri').length,1);
  assert.equal(e.sources('galeri')[0].data.durum,'beklemede');assert.equal(e.childWrites().length,0);
  assert.equal(e.notices.length,0);assert.equal(e.mails.length,0);assert.equal(e.approvalNotices.length,1);
});

test('admin mixed gallery upload notifies only successfully published photo and video',async t=>{
  const e=environment(t);e.ctx.galeriSecilenDosyalar=[{name:'one.jpg',type:'image/jpeg',size:100},{name:'failed.jpg',type:'image/jpeg',size:100},{name:'video.mp4',type:'video/mp4',size:100}];
  e.controls.uploadFail='failed.jpg';await e.window.galeriYukle();
  const published=e.sources('galeri');
  assert.equal(published.length,2);assert.equal(e.notices.length,1);
  assert.equal(published.filter(x=>x.data.dosyaTipi==='foto').length,1);
  assert.equal(published.filter(x=>x.data.dosyaTipi==='video').length,1);
  assert.ok(e.childWrites().every(w=>w.data.fotoSayisi===1&&w.data.videoSayisi===1));
  assert.deepEqual(e.notices[0].emails,['a1@example.invalid','a2@example.invalid']);
  const ids=published.map(x=>x.path.split('/')[1]).sort();
  assert.equal(e.notices[0].notice.olayAnahtari,`galeri-yayin:${ids.join(':')}`);
});

test('actual pending gallery approval notifies after approved write, while repeated approval is silent',async t=>{
  const e=environment(t);e.seeds('photo');
  assert.equal(await e.window.galeriOnayla('photo'),true);
  assert.equal(e.docs.get('galeri/photo').durum,'onaylandi');assert.equal(e.notices.length,1);
  assert.ok(e.trace.indexOf('update:galeri/photo')<e.trace.indexOf('notify:galeri'));
  assert.deepEqual(e.notices[0].emails,['a1@example.invalid','a2@example.invalid']);
  assert.equal(await e.window.galeriOnayla('photo'),false);assert.equal(e.notices.length,1);
});

test('gallery approval failure and canceled rejection produce no parent notices',async t=>{
  const e=environment(t);e.seeds('photo');e.controls.fail=path=>path==='galeri/photo';
  assert.equal(await e.window.galeriOnayla('photo'),false);assert.equal(e.notices.length,0);
  e.controls.fail=()=>false;e.controls.confirmed=false;assert.equal(await e.window.galeriReddet('photo'),false);
  assert.equal(e.docs.get('galeri/photo').durum,'beklemede');assert.equal(e.notices.length,0);
});

test('ordinary program-labelled album approval still receives generic gallery notification',async t=>{
  const e=environment(t);e.seeds('album',{program:'montessori',egitimKaydi:true,albumTuru:'egitim'});
  await e.window.galeriOnayla('album');assert.equal(e.notices.length,1);assert.equal(e.notices[0].notice.tip,'galeri');
});

test('class-target metadata is not mistaken for a child-specific learning observation',async t=>{
  const e=environment(t);e.seeds('album',{program:'montessori',kazanimAnahtari:'legacy-key',hedefTur:'sinif',hedefDeger:'A'});
  await e.window.galeriOnayla('album');assert.equal(e.notices.length,1);
});

test('child learning approval delegates fanout to learning bridge without generic gallery duplicate',async t=>{
  const e=environment(t);e.seeds('learning',{program:'montessori',egitimKaydi:true,kazanimAnahtari:'learning-key',ogrenciId:'a1',hedefTur:'ogrenci',hedefDeger:'a1'});
  assert.equal(await e.window.galeriOnayla('learning'),true);assert.equal(e.notices.length,0);assert.equal(e.childWrites().length,0);
});

test('gallery child notices exclude old-period master-active and archived students',async t=>{
  const e=environment(t);e.seeds('photo');await e.window.galeriOnayla('photo');
  assert.deepEqual(e.childWrites().map(w=>w.path.split('/')[1]).sort(),['a1','a2']);
});

test('one failed gallery child notice does not block other children or scoped root/push bridge',async t=>{
  const e=environment(t);e.seeds('photo');e.controls.fail=path=>path.startsWith('ogrenciler/a1/bildirimler/');
  assert.equal(await e.window.galeriOnayla('photo'),true);
  assert.deepEqual(e.childWrites().map(w=>w.path.split('/')[1]),['a2']);
  assert.equal(e.notices.length,1);assert.deepEqual(e.notices[0].emails,['a1@example.invalid','a2@example.invalid']);
  assert.ok(e.toasts.some(([message])=>/bazı|eksik|tamamlanamad|oluşturulamad/.test(message)),'Partial child failure must remain visible');
});


for(const photo of [null,{id:'learning-photo',durum:'onaylandi',url:'https://synthetic.invalid/private-photo'},
  {id:'pending-photo',durum:'beklemede',url:'https://synthetic.invalid/private-photo'},
  {id:'pending-photo2',durum:'onayBekliyor',url:'https://synthetic.invalid/private-photo'}]){
  test(`active inline learning transaction only fans out after permitted save (${photo?.durum||'no photo'})`,async t=>{
    const e=environment(t);e.ctx.learningPhoto=photo;
    await e.run(`caGozlemDetayKaydet({ogrId:'a1',disiplin:'montessori',seviye:'S'},
      {id:'area',ad:'Private Area'},{ad:'Private Group'},'Private Learning Title','Private Learning Note',learningPhoto)`);
    assert.equal(e.docs.get('ogrenciGelisim/a1').sonGozlem.durum,'S');
    const allowed=!photo||photo.durum==='onaylandi';assert.equal(e.notices.length,allowed?1:0);
    if(allowed){
      const n=e.notices[0].notice;assert.equal(n.tip,'egitim_gelisim');assert.equal(n.ogrenciId,'a1');
      assert.equal(n.hedefSayfa,'veli-egitim.html');assert.ok(n.olayAnahtari);
      if(photo)assert.equal(n.olayAnahtari,'egitim_learning-photo');
      assert.deepEqual(e.notices[0].emails,['a1@example.invalid']);
      assert.ok(e.trace.indexOf('transaction-commit')<e.trace.indexOf('notify:egitim_gelisim'));
      assertGeneric(e.notices[0],['Private Learning Title','Private Learning Note','Private Area','Private Group','Private Teacher Name','https://synthetic.invalid/private-photo']);
    }
  });
}

test('active inline learning failed transaction produces no root/push',async t=>{
  const e=environment(t);e.controls.fail=path=>path==='ogrenciGelisim/a1';
  await assert.rejects(e.run(`caGozlemDetayKaydet({ogrId:'a1',disiplin:'montessori',seviye:'S'},
    {id:'area'},{ad:'Group'},'Learning','Note',null)`),/synthetic-permission-denied/);
  assert.equal(e.notices.length,0);
});

test('active inline learning transaction retry still creates one notification after final commit',async t=>{
  const e=environment(t);e.controls.transactionAttempts=2;
  await e.run(`caGozlemDetayKaydet({ogrId:'a1',disiplin:'montessori',seviye:'S'},
    {id:'area'},{ad:'Group'},'Learning','Note',null)`);
  assert.equal(e.trace.filter(x=>x==='transaction-attempt').length,2);assert.equal(e.notices.length,1);
  assert.ok(e.trace.indexOf('transaction-commit')<e.trace.indexOf('notify:egitim_gelisim'));
});


test('parent learning click selects only the authorized sibling before opening the learning screen',async t=>{
  const e=environment(t,{role:'veli'});
  await e.run(`portalBildirimGit({tip:'egitim_gelisim',ogrenciId:'b',hedefSayfa:'https://untrusted.invalid/'})`);
  assert.equal(e.ctx.veliAktifOgrenci.id,'b');assert.deepEqual(e.trace,['child:b','tab:yeniapp','page:egitim']);
  assert.equal(e.writes.length,0);
});

test('parent learning click fails closed for a child outside the existing authorized sibling list',async t=>{
  const e=environment(t,{role:'veli'});
  await assert.rejects(e.run(`portalBildirimGit({tip:'egitim_gelisim',ogrenciId:'not-authorized'})`),/erişilemiyor/);
  assert.equal(e.ctx.veliAktifOgrenci.id,'a1');assert.equal(e.trace.length,0);assert.equal(e.writes.length,0);
});

test('parent legacy learning click without child identity keeps selected child and uses allowlisted screen',async t=>{
  const e=environment(t,{role:'veli'});await e.run(`portalBildirimGit({tip:'egitim_gelisim'})`);
  assert.equal(e.ctx.veliAktifOgrenci.id,'a1');assert.deepEqual(e.trace,['tab:yeniapp','page:egitim']);
});
