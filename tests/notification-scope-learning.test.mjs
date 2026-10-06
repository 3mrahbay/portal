import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { bildirimKaydetVePush, hedefVeliEmailleri } from '../js/zeky-bildirim-koprusu.js';
import { egitimOnayiniEsitle, onayFonksiyonlariniSar } from '../js/zeky-galeri-onay-egitim.js';

const donem='2026-2027', anahtar='alan__Grup__Çocuğa özel kazanım';
const gallery={durum:'beklemede',egitimKaydi:true,program:'montessori',ogrenciId:'child',
  kazanimAnahtari:anahtar,gozlemDurum:'S',baslik:'Çocuğa özel kazanım',aciklama:'Özel gözlem notu',
  hedefOgrenciAd:'Çocuğun adı',yukleyenAd:'Öğretmen adı',url:'https://private.example/photo',
  donem,tarih:'2026-09-01T10:00:00Z',onayTarihi:'2026-09-20T10:00:00Z'};
function fixture(t,{students,settings,failWrite=false,pushFail=false,transaction=false}={}){
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch;
  const docs=new Map(),writes=[],reads=[],pushes=[],warnings=[];
  let seq=0;
  const doc=(base,...parts)=>{
    if(typeof base==='string') return parts.length?[base,...parts].join('/'):`${base}/generated-${++seq}`;
    return parts.join('/');
  };
  const fb={doc,collection:(_db,...parts)=>parts.join('/'),
    getDoc:async path=>{reads.push(path);assert.ok(!path.startsWith('bildirimler/'),'Sender must never read recipient root records');
      return {exists:()=>docs.has(path),data:()=>structuredClone(docs.get(path))};},
    setDoc:async(path,data)=>{writes.push({path,data:structuredClone(data)});docs.set(path,{...(docs.get(path)||{}),...structuredClone(data)});},
    addDoc:async(path,data)=>{if(failWrite===true||failWrite===data.aliciEmail)throw Error('permission-denied');
      const ref={id:`root-${++seq}`};writes.push({path:`${path}/${ref.id}`,data:structuredClone(data)});return ref;},
    serverTimestamp:()=>({seconds:1})};
  if(transaction)fb.runTransaction=async(_db,callback)=>callback({get:fb.getDoc,set:fb.setDoc});
  globalThis.window={PortalAPI:{db:{},fb,state:{isAdmin:true,rol:'mudur',aktifDonem:donem,currentUser:{uid:'sender'},
    ogrenciList:students??[{id:'child',aktifDonem:donem,aktifDonemDurum:'aktif',sinif:'A',veli1Eposta:'parent@example.test'}],
    ayarListesi:settings??{}},toast:(...args)=>warnings.push(args)}};
  globalThis.fetch=async(_url,request)=>{pushes.push(JSON.parse(request.body));return {ok:!pushFail,status:pushFail?500:200,
    text:async()=>JSON.stringify(pushFail?{ok:false,hata:'push-failed'}:{ok:true,gonderilen:1,sonuclar:[{ok:true}]})};};
  t.after(()=>{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;globalThis.fetch=oldFetch;});
  return {fb,docs,writes,reads,pushes,warnings,root:()=>writes.filter(x=>x.path.startsWith('bildirimler/'))};
}

test('current settings override legacy BCK and cover every parent source only for eligible student',t=>{
  fixture(t,{students:[{id:'child',durum:'arsiv',sinif:'Old',veliler:[{email:'Array@Example.test'}],
    veli1Eposta:'One@example.test',veli2Eposta:'two@example.test',veli1Email:'three@example.test',
    veli2Email:'four@example.test',veliEposta:'five@example.test',veliEmail:'six@example.test',anne:{email:'master@example.test'}}],
    settings:{child:{durum:'aktif',kayit:{sinif:'Current'},anne:{eposta:'mother@example.test'},baba:{email:'father@example.test'},
      vasi:{email:'guardian@example.test'},veli:{email:'ONE@example.test'},veliler:[{eposta:'period@example.test'}]}}});
  window.BCK={ogrenciler:()=>[{id:'wrong',veliEmail:'unrelated@example.test'}],ayarlar:()=>({})};
  const actual=hedefVeliEmailleri({hedefTur:'sinif',hedefDeger:'Current'});
  assert.deepEqual(actual.sort(),['array','one','two','three','four','five','six','master','mother','father','guardian','period'].map(x=>`${x}@example.test`).sort());
  assert.deepEqual(hedefVeliEmailleri({hedefTur:'sinif',hedefDeger:'Old'}),[]);
});

test('only active current-period records or current settings are eligible; unknown targets fail closed',t=>{
  const students=[
    {id:'active',aktifDonem:donem,aktifDonemDurum:'aktif'},
    {id:'past',aktifDonem:'2025-2026',aktifDonemDurum:'aktif'},
    {id:'missing',durum:'aktif'},
    {id:'archived',aktifDonem:donem,aktifDonemDurum:'arsiv'},
    {id:'candidate',aktifDonem:donem,aktifDonemDurum:'beklemede'},
    {id:'returning',durum:'arsiv'},
    {id:'paused',durum:'aktif'}
  ].map(o=>({...o,sinif:'A',veliEmail:`${o.id}@example.test`}));
  fixture(t,{students,settings:{returning:{durum:' AKTİF ',kayit:{sinif:'B'}},paused:{durum:'pasif'}}});
  assert.deepEqual(hedefVeliEmailleri().sort(),['active@example.test','returning@example.test']);
  assert.deepEqual(hedefVeliEmailleri({hedefTur:'ogrenci',hedefDeger:'active'}),['active@example.test']);
  for(const options of [{hedefTur:''},{hedefTur:'wrong'},{hedefTur:'ogrenci',hedefDeger:''},{hedefTur:'sinif',hedefDeger:''}])assert.deepEqual(hedefVeliEmailleri(options),[]);
  assert.deepEqual(hedefVeliEmailleri({hedefTur:'sinif',hedefDeger:'B'}),['returning@example.test']);
});

test('legacy-only BCK and explicit class matcher retain exact eligibility',t=>{
  fixture(t);delete window.PortalAPI;
  window.BCK={ogrenciler:()=>[{id:'a',sinif:'Çiçek',veli1Email:'a@example.test'},{id:'b',sinif:'Other',veliEmail:'b@example.test'}],
    ayarlar:()=>({a:{durum:'aktif'},b:{durum:'aktif'}}),getOgrenciDurum:(_o,a)=>a.durum,donem:()=>donem};
  assert.deepEqual(hedefVeliEmailleri({hedefTur:'sinif',hedefDeger:'cicek',sinifEsle:(a,b)=>a==='Çiçek'&&b==='cicek'}),['a@example.test']);
});

test('root writes and push are independent, report partial failures, and use PortalAPI without BCK',async t=>{
  const f=fixture(t,{failWrite:'fail@example.test'});
  const r=await bildirimKaydetVePush(['Good@Example.test','good@example.test','fail@example.test'],{tip:'duyuru',kaynakId:'source',olayAnahtari:'duyuru:source',sessizUyari:true});
  assert.equal(r.ok,false);assert.equal(r.adet,1);assert.equal(r.istenen,2);assert.equal(r.kayitHatalari.length,1);
  assert.equal(r.push.ok,true);assert.deepEqual(f.pushes[0].aliciEmailler,['good@example.test','fail@example.test']);
  assert.equal(f.root()[0].data.sessizUyari,true);assert.equal(f.root()[0].data.olayAnahtari,'duyuru:source');
  assert.equal(f.reads.length,0);
});

test('push failure does not erase stored notice or claim delivery',async t=>{
  const f=fixture(t,{pushFail:true});
  const r=await bildirimKaydetVePush(['parent@example.test'],{olayAnahtari:'failed-push'});
  assert.equal(r.ok,true);assert.equal(r.adet,1);assert.equal(r.push.ok,false);assert.equal(f.root().length,1);
});

test('same source merges concurrent/repeated recipients but never conflates different sources',async t=>{
  const f=fixture(t),opts={tip:'egitim_gelisim',kaynakId:'source',olayAnahtari:'event'};
  const [a,b]=await Promise.all([bildirimKaydetVePush(['a@example.test'],opts),bildirimKaydetVePush(['a@example.test','b@example.test'],opts)]);
  assert.equal(a.adet,1);assert.equal(b.adet,2);assert.equal(f.root().length,2);
  assert.equal(f.pushes.flatMap(x=>x.aliciEmailler).filter(x=>x==='a@example.test').length,1);
  await bildirimKaydetVePush(['a@example.test'],opts);assert.equal(f.root().length,2);
  await bildirimKaydetVePush(['a@example.test'],{...opts,olayAnahtari:'other-event'});assert.equal(f.root().length,3);
});

for(const transaction of [false,true])test(`historical repair preserves read state/time and never sends root/push (transaction=${transaction})`,async t=>{
  const f=fixture(t,{transaction});f.docs.set('galeri/history',{...gallery,durum:'onaylandi'});
  f.docs.set('ogrenciler/child/bildirimler/egitim_history',{okundu:true,olusturuldu:'2026-09-21T10:00:00Z'});
  await egitimOnayiniEsitle('history','onaylandi');
  await egitimOnayiniEsitle('history','onaylandi');
  const child=f.docs.get('ogrenciler/child/bildirimler/egitim_history');
  assert.equal(child.okundu,true);assert.equal(child.olusturuldu,'2026-09-21T10:00:00Z');
  assert.equal(f.root().length,0);assert.equal(f.pushes.length,0);
});

test('missing historical child notice uses historical approval time without audible fanout',async t=>{
  const f=fixture(t);f.docs.set('galeri/history',{...gallery,durum:'onaylandi'});
  await egitimOnayiniEsitle('history','onaylandi');
  assert.equal(f.docs.get('ogrenciler/child/bildirimler/egitim_history').olusturuldu,gallery.onayTarihi);
  assert.equal(f.root().length,0);assert.equal(f.pushes.length,0);
});

test('successful pending approval notifies only exact parent once with generic push',async t=>{
  const f=fixture(t);f.docs.set('galeri/new',structuredClone(gallery));let actions=0;
  window.galeriOnayla=async id=>{actions++;await f.fb.setDoc(`galeri/${id}`,{durum:'onaylandi'});return true;};
  window.galeriReddet=async()=>false;
  onayFonksiyonlariniSar();
  await Promise.all([window.galeriOnayla('new'),window.galeriOnayla('new')]);
  await window.galeriOnayla('new');
  assert.equal(actions,2);assert.equal(f.root().length,1);assert.equal(f.pushes.length,1);
  const root=f.root()[0].data;assert.equal(root.kaynakId,'egitim_new');assert.equal(root.olayAnahtari,'egitim_new');assert.equal(root.ogrenciId,'child');
  assert.deepEqual(f.pushes[0].aliciEmailler,['parent@example.test']);assert.equal(f.pushes[0].hedefSayfa,'veli-egitim.html');
  const payload=JSON.stringify(f.pushes[0]);for(const value of [gallery.baslik,gallery.aciklama,gallery.hedefOgrenciAd,gallery.yukleyenAd,gallery.url,'egitim_new','child'])assert.ok(!payload.includes(value),value);
});

for(const outcome of ['cancel','swallowed-error','throw','unchanged','rejected','previously-approved'])test(`${outcome} approval never fans out`,async t=>{
  const f=fixture(t);f.docs.set('galeri/no',{...gallery,durum:outcome==='previously-approved'?'onaylandi':'beklemede'});
  window.galeriOnayla=async()=>{
    if(outcome==='throw')throw Error('failed');
    if(outcome==='cancel')return false;
    if(outcome==='swallowed-error')return undefined;
    if(outcome==='rejected')await f.fb.setDoc('galeri/no',{durum:'reddedildi'});
    return true;
  };
  window.galeriReddet=async()=>false;onayFonksiyonlariniSar();
  await window.galeriOnayla('no').catch(()=>{});
  assert.equal(f.root().length,0);assert.equal(f.pushes.length,0);
});

test('failed child permission read never overwrites read state or fans out',async t=>{
  const f=fixture(t);f.docs.set('galeri/denied',structuredClone(gallery));
  const original=f.fb.getDoc;f.fb.getDoc=path=>path.startsWith('ogrenciler/')?Promise.reject(Error('permission-denied')):original(path);
  window.galeriOnayla=async()=>{await f.fb.setDoc('galeri/denied',{durum:'onaylandi'});return true;};
  window.galeriReddet=async()=>false;onayFonksiyonlariniSar();await window.galeriOnayla('denied');
  assert.equal(f.writes.filter(x=>x.path.startsWith('ogrenciler/')).length,0);assert.equal(f.pushes.length,0);
});

const teacherSource=await readFile(new URL('../moduller/ogretmen-egitim-gozlem.js',import.meta.url),'utf8');
function teacherHarness(f){
  window.__zekyGelismisGozlemV1=true;
  window.BCK={db:window.PortalAPI.db,...f.fb,personel:()=>({ad:'Öğretmen adı'}),kullanici:()=>({})};
  const context={window,console,bildirimKaydetVePush,hedefVeliEmailleri};
  const source=teacherSource.replace(/^import .*;\n/gm,'').replace(/export /g,'')+'\nthis.harness={bildirimOlustur,kaydet,kapat,gozlemAc,setState:value=>S=value};';
  vm.runInNewContext(source,context);
  context.harness.setState({ogrId:'child',program:'montessori',durum:'S',not:gallery.aciklama});
  return context.harness;
}
for(const foto of [null,{id:'direct',durum:'onaylandi'},{id:'pending',durum:'beklemede'},{id:'pending2',durum:'onayBekliyor'},{id:'rejected',durum:'reddedildi'}])test(`teacher saved notice respects photo moderation (${foto?.durum||'no photo'})`,async t=>{
  const f=fixture(t),h=teacherHarness(f);
  await h.bildirimOlustur(anahtar,gallery.baslik,{id:'area',ad:'Area'},{ad:'Group'},foto);
  const allowed=!foto||foto.durum==='onaylandi';
  assert.equal(f.root().length,allowed?1:0);assert.equal(f.pushes.length,allowed?1:0);
  assert.equal(f.writes.filter(x=>x.path.startsWith('ogrenciler/')).length,allowed?1:0);
  if(foto?.id==='direct')assert.equal(f.root()[0].data.olayAnahtari,'egitim_direct');
  if(allowed){assert.equal(f.pushes[0].hedefSayfa,'veli-egitim.html');const payload=JSON.stringify(f.pushes[0]);assert.ok(!payload.includes(gallery.baslik));assert.ok(!payload.includes(gallery.aciklama));}
});

test('in-flight observation blocks duplicate save and close',async t=>{
  const f=fixture(t),h=teacherHarness(f);
  h.setState({kaydediliyor:true});await h.kaydet();h.kapat();await h.gozlemAc('another-child','Other','B');assert.equal(f.writes.length,0);assert.equal(f.pushes.length,0);
});
