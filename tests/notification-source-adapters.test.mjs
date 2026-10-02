import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const personnelSource = await readFile(new URL('../moduller/personel-anlik-bildirim.js',import.meta.url),'utf8');
const meetingSource = await readFile(new URL('../moduller/gorusme-notlari.js',import.meta.url),'utf8');
const parentSource = await readFile(new URL('../js/zeky-veli-ogrenme-deneyimi.js',import.meta.url),'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(source,{role='ogretmen',classes=['Papatya'],settings=null,appointments=[],center=true}={}) {
  const storage = new Map(), publications=[], snapshots=[], writes=[], timers=new Map(), intervals=new Map(), events=new Map(), pushCalls=[], batches=[], reads=[];
  let sequence=0,unsubscribed=0,removed=0,storageFails=false,writeFails=false;
  const state={rol:role,isAdmin:role==='kurucu_mudur',personel:{adSoyad:'Private sender'},currentUser:{email:'staff@example.test',uid:'u1'},siniflar:classes,ogrenciList:[],ayarListesi:{}};
  const central={status:'ready',ownedTypes:new Set(['unrelated']),refresh(){},setExternalItems:(name,items,options)=>publications.push({name,items,options})};
  const listeners = new Map();
  const document={visibilityState:'visible',title:'Portal',getElementById:()=>({remove(){removed++;}}),querySelectorAll:()=>[],
    addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},
    removeEventListener:(name,fn)=>events.get(name)?.delete(fn),head:{appendChild(){}},body:{appendChild(){}},createElement(){throw Error('UNEXPECTED LEGACY POPUP');}};
  const fb={
    collection:(_,name)=>({collection:name}),where:(field,operator,value)=>({field,operator,value}),query:(collection,...where)=>({collection:collection.collection,where}),
    doc:(...args)=>({path:args.length===1 ? args[0].collection+'/auto-'+(++sequence) : args.slice(1).join('/')}),
    getDoc:async ref=>{reads.push(ref);return {exists:()=>settings!==null,data:()=>settings};},
    onSnapshot:(query,options,next,error)=>{if(typeof options==='function'){error=next;next=options;options={};}snapshots.push({query,options,next,error});return()=>{unsubscribed++;};},
    updateDoc:async (ref,data)=>{if(writeFails)throw Error('permission-denied');writes.push({ref,data:copy(data)});},serverTimestamp:()=> 'SERVER',
    writeBatch:()=>({set:(ref,data,options)=>batches.push({ref,data:copy(data),options}),commit:async()=>{}}),
    addDoc:async(ref,data)=>writes.push({ref,data:copy(data)}),arrayUnion:(...values)=>values
  };
  const runtime={callableCutoverAcikMi:()=>true,randevuServisiGetir:()=>({
    personelKutusu:async()=>({randevular:appointments}),yonetimKutusu:async()=>({kapsam:'okul',randevular:appointments})
  })};
  const window={PortalAPI:{state,fb,db:{},bugun:()=> '2026-09-30'},portalBildirimMerkezi:center?central:null,portalBildirimUyariAcikMi:()=>true,
    __randevuRuntime:runtime,__pushRuntime:{genelPushGonder:async(...args)=>pushCalls.push(copy(args))},addEventListener(){},removeEventListener(){}};
  const context=vm.createContext({window,document,location:{href:''},console:{warn(){}},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(storageFails)throw Error('storage denied');storage.set(key,value);}},
    setInterval:(fn)=>{const id=++sequence;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
    setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    MutationObserver:class{observe(){}disconnect(){}},navigator:{}});
  const transformed=source.replace(/\bexport /g,'')
    .replace('import("../js/zeky-randevu-cutover-runtime.js")','Promise.resolve(window.__randevuRuntime)')
    .replace('import("../js/zeky-operasyon-push.js")','Promise.resolve(window.__pushRuntime)');
  vm.runInContext(transformed,context);
  return {context,window,state,fb,central,publications,snapshots,storage,writes,pushCalls,batches,intervals,events,timers,reads,appointments,
    set storageFails(value){storageFails=value;},set writeFails(value){writeFails=value;},get unsubscribed(){return unsubscribed;},get removed(){return removed;}};
}
function snapshot(rows,{fromCache=false}={}) {
  const docs=rows.map(([id,data])=>({id,ref:{path:'own/'+id},data:()=>copy(data)}));
  return {docs,metadata:{fromCache},docChanges:()=>docs.map(doc=>({type:'added',doc}))};
}
function morning(extra={}) {return {veliBildirdi:true,ogrenciAd:'PRIVATE CHILD',sinif:'Papatya',veliBildirimSaati:new Date().toISOString(),...extra};}
const latest=(x,name)=>x.publications.filter(p=>p.name===name).at(-1);

test('personel merkezi ilk cache/sunucu sessiz, sonraki olay canlı; metadata dinlenir',async()=>{
  const x=fixture(personnelSource); await x.context.baslat();
  assert.equal(x.snapshots.length,2);
  const sub=x.snapshots[0]; assert.equal(sub.options.includeMetadataChanges,true);
  assert.deepEqual(copy(sub.query.where),[{field:'tarih',operator:'==',value:'2026-09-30'}]);
  sub.next(snapshot([['one',morning()]],{fromCache:true}));
  let p=latest(x,'personel-anlik-sabah');assert.equal(p.options.initial,true);assert.equal(p.options.fromCache,true);
  sub.next(snapshot([['one',morning()]]));assert.equal(latest(x,'personel-anlik-sabah').options.initial,true);
  sub.next(snapshot([['one',morning()],['two',morning()]]));p=latest(x,'personel-anlik-sabah');assert.equal(p.options.initial,false);
  assert.equal(p.items.length,2);assert.equal(x.storage.size,0);assert.equal(x.writes.length,0);
  assert.ok(x.central.ownedTypes.has('sabah-yeni'));assert.ok(!JSON.stringify(p.items).includes('PRIVATE CHILD'));
  x.context.durdur();
});

test('sabah/zil yalnız bekleyen kendi sınıfı ve izinli rol kapsamından yayınlanır',async()=>{
  const x=fixture(personnelSource);await x.context.baslat();
  x.snapshots[0].next(snapshot([['yes',morning()],['other',morning({sinif:'Lale'})],['done',morning({sinifaGirisOnayi:'now'})],['no',morning({veliBildirdi:false})]]));
  assert.deepEqual(latest(x,'personel-anlik-sabah').items.map(i=>i.id),['sabah:yes']);
  x.snapshots[1].next(snapshot([['pickup',{durum:'yolda',sinif:'Papatya',olusturuldu:new Date().toISOString()}],['done',{durum:'hazir',sinif:'Papatya'}]]));
  assert.equal(latest(x,'personel-anlik-zil').items.length,1);assert.ok(x.central.ownedTypes.has('pickup-yeni'));
  x.context.durdur();
  for(const options of [{classes:[]},{role:'muhasebe'},{settings:{acik:false}}]){
    const y=fixture(personnelSource,options);await y.context.baslat();assert.equal(y.snapshots.length,0);assert.equal(y.central.ownedTypes.size,1);y.context.durdur();
  }
  const reception=fixture(personnelSource,{role:'danisma'});await reception.context.baslat();
  assert.deepEqual(reception.snapshots.map(s=>s.query.collection),['danismaSabahGirisleri','danismaPickupBildirimleri']);reception.context.durdur();
});

test('personel onRead kullanıcıya özel görülene ancak açık eylemde yazar; depolama hatası false',async()=>{
  const x=fixture(personnelSource);await x.context.baslat();const row=['one',morning()];x.snapshots[0].next(snapshot([row]));
  let item=latest(x,'personel-anlik-sabah').items[0];assert.equal(item.okundu,false);assert.equal(x.storage.size,0);
  x.storageFails=true;assert.equal(await item.onRead(),false);assert.equal(x.storage.size,0);
  x.storageFails=false;assert.equal(await item.onRead(),true);assert.ok(x.storage.has('pab-gorulen:staff@example.test'));
  x.snapshots[0].next(snapshot([row]));assert.equal(latest(x,'personel-anlik-sabah').items[0].okundu,true);
  assert.equal(x.writes.length,0);x.context.durdur();assert.equal(await item.onRead(),false);
});

test('personel stop/hesap değişimi eski callbackleri ve gecikmiş ayar yüklemesini etkisiz yapar',async()=>{
  const x=fixture(personnelSource);await x.context.baslat();const old=x.snapshots[0];old.next(snapshot([['one',morning()]]));
  x.context.durdur();assert.equal(x.unsubscribed,2);assert.equal(x.intervals.size,0);
  assert.equal(x.central.ownedTypes.has('sabah-yeni'),false);assert.ok(x.central.ownedTypes.has('unrelated'));
  const before=x.publications.length;old.next(snapshot([['late',morning()]]));assert.equal(x.publications.length,before);
  x.state.currentUser={email:'other@example.test',uid:'u2'};await x.context.baslat();old.next(snapshot([['late2',morning()]]));assert.equal(x.publications.length,before);
  x.context.durdur();
  const y=fixture(personnelSource);let resolve;y.fb.getDoc=()=>new Promise(r=>resolve=r);
  const start=y.context.baslat();y.context.durdur();resolve({exists:()=>false});assert.equal(await start,false);assert.equal(y.snapshots.length,0);
});

test('personel izin hatası kök sahipliğini geri verir; sessiz tercih sayacı saklamaz',async()=>{
  const x=fixture(personnelSource);x.window.portalBildirimUyariAcikMi=()=>false;await x.context.baslat();
  x.snapshots[0].next(snapshot([['one',morning()]]));const p=latest(x,'personel-anlik-sabah');assert.equal(p.items.length,1);assert.equal(p.items[0].sessizUyari,true);
  x.snapshots[0].error({code:'permission-denied'});assert.equal(x.central.ownedTypes.has('sabah-yeni'),false);assert.equal(latest(x,'personel-anlik-sabah').items.length,0);x.context.durdur();
});

const appointment=(id='r1')=>({id,durum:'talep',baslangicMillis:Date.now()+3600000,ogrenciAd:'PRIVATE CHILD',veliNotu:'PRIVATE NOTE'});
const notice=(extra={})=>({aliciEmail:'staff@example.test',tip:'gorusme_notu',okundu:false,olusturuldu:new Date().toISOString(),kaynakId:'note-A',baslik:'PRIVATE TITLE',metin:'PRIVATE BODY',...extra});

test('görüşme merkezi iki kaynağı sessiz başlatır; gösterim hiçbir belgeyi okunmuş yapmaz',async()=>{
  const x=fixture(meetingSource,{appointments:[appointment()]});x.context.bildirimBaslat();await flush();
  assert.equal(x.intervals.size,1);assert.equal(x.events.get('visibilitychange').size,1);
  assert.equal(latest(x,'gn-randevu').options.initial,true);assert.equal(latest(x,'gn-randevu').items.length,1);
  const sub=x.snapshots[0];assert.equal(sub.options.includeMetadataChanges,true);
  assert.deepEqual(copy(sub.query.where),[{field:'aliciEmail',operator:'==',value:'staff@example.test'},{field:'okundu',operator:'==',value:false}]);
  sub.next(snapshot([['n1',notice()],['other',notice({aliciEmail:'other@example.test'})]],{fromCache:true}));
  assert.equal(latest(x,'gn-personel').options.initial,true);assert.equal(latest(x,'gn-personel').items.length,1);
  sub.next(snapshot([['n1',notice()]]));assert.equal(latest(x,'gn-personel').options.initial,true);
  sub.next(snapshot([['n1',notice()],['n2',notice()]]));assert.equal(latest(x,'gn-personel').options.initial,false);
  assert.equal(x.writes.length,0);assert.equal(x.storage.size,0);
  assert.ok(!JSON.stringify(latest(x,'gn-personel').items).includes('PRIVATE'));
  assert.ok(!JSON.stringify(latest(x,'gn-randevu').items).includes('PRIVATE'));
  x.context.bildirimDurdur();
});

test('görüşme açık okuma yalnız kendi source belgesini yazar; hata yayılır',async()=>{
  const x=fixture(meetingSource);x.context.bildirimBaslat();await flush();x.snapshots[0].next(snapshot([['n1',notice()]]));
  const item=latest(x,'gn-personel').items[0];x.writeFails=true;await assert.rejects(item.onRead(),/permission-denied/);assert.equal(x.writes.length,0);
  x.writeFails=false;assert.equal(await item.onRead(),true);assert.equal(x.writes.length,1);
  assert.equal(x.writes[0].ref.path,'own/n1');assert.deepEqual(x.writes[0].data,{okundu:true,okunduZaman:'SERVER'});
  x.context.bildirimDurdur();assert.equal(await item.onRead(),false);assert.equal(x.writes.length,1);
});

test('randevu okuma kişi bazında lokaldir; sonraki anket yeniyi sessiz saymaz',async()=>{
  const rows=[appointment()];const x=fixture(meetingSource,{appointments:rows});x.context.bildirimBaslat();await flush();
  const item=latest(x,'gn-randevu').items[0];x.storageFails=true;assert.equal(await item.onRead(),false);
  x.storageFails=false;assert.equal(await item.onRead(),true);assert.ok(x.storage.has('gn-randevu-gorulen:staff@example.test'));assert.equal(x.writes.length,0);
  rows.push(appointment('r2'));await x.context.randevuYokla();assert.equal(latest(x,'gn-randevu').options.initial,false);
  assert.equal(latest(x,'gn-randevu').items.find(i=>i.id==='r1').okundu,true);assert.equal(latest(x,'gn-randevu').items.find(i=>i.id==='r2').okundu,false);x.context.bildirimDurdur();
});

test('görüşme tekrar başlatma/stop eski hesap dinleyici, anket ve sahipliği temizler',async()=>{
  const x=fixture(meetingSource,{appointments:[appointment()]});x.context.bildirimBaslat();x.context.bildirimBaslat();await flush();
  assert.equal(x.snapshots.length,1);assert.equal(x.intervals.size,1);assert.equal(x.window.gorusmeNotlariBildirimDurdur,x.context.bildirimDurdur);
  const old=x.snapshots[0];old.next(snapshot([['n1',notice()]]));const item=latest(x,'gn-personel').items[0];
  x.context.bildirimDurdur();assert.equal(x.unsubscribed,1);assert.equal(x.intervals.size,0);assert.equal(x.events.get('visibilitychange').size,0);
  assert.deepEqual([...x.central.ownedTypes],['unrelated']);const before=x.publications.length;
  old.next(snapshot([['late',notice()]]));assert.equal(x.publications.length,before);assert.equal(await item.onRead(),false);
  x.state.currentUser={email:'other@example.test',uid:'u2'};x.context.bildirimBaslat();await flush();assert.equal(x.snapshots.length,2);assert.equal(x.snapshots[1].query.where[0].value,'other@example.test');
  const next=x.publications.length;old.next(snapshot([['late2',notice()]]));assert.equal(x.publications.length,next);x.context.bildirimDurdur();
});

test('görüşme kaynak hatası sahipliği kaldırır; gecikmiş hesap cevabı yayınlanmaz',async()=>{
  const x=fixture(meetingSource);x.context.bildirimBaslat();await flush();x.snapshots[0].next(snapshot([['n1',notice()]]));
  x.snapshots[0].error({code:'permission-denied'});assert.equal(x.central.ownedTypes.has('gorusme_notu'),false);assert.equal(latest(x,'gn-personel').items.length,0);x.context.bildirimDurdur();
  const y=fixture(meetingSource);let resolve;y.window.__randevuRuntime.randevuServisiGetir=()=>({personelKutusu:()=>new Promise(r=>resolve=r)});
  y.context.bildirimBaslat();await flush();y.context.bildirimDurdur();y.state.currentUser={email:'other@example.test',uid:'u2'};resolve({randevular:[appointment()]});await flush();
  assert.equal(y.publications.length,0);assert.equal(y.central.ownedTypes.has('randevu_talep'),false);
});

test('görüşme gönderiminde root/source olay kimliği eşleşir, push özel metin taşımaz',async()=>{
  const x=fixture(meetingSource);await x.context.bildirimGonder({id:'note-A',ogrenciAd:'PRIVATE CHILD',konular:['PRIVATE TOPIC'],randevuMillis:Date.now()},['target@example.test']);await flush();
  const source=x.batches.find(w=>w.ref.path.startsWith('personelBildirimleri/')).data;
  const root=x.writes.find(w=>w.ref.collection==='bildirimler').data;
  assert.equal(root.kaynakId,'note-A');assert.equal(root.olayAnahtari,source.olayAnahtari);
  assert.equal(x.pushCalls.length,1);assert.deepEqual(x.pushCalls[0][0],['target@example.test']);
  assert.equal(x.pushCalls[0][1].baslik,'Görüşme notu');assert.ok(!JSON.stringify(x.pushCalls).includes('PRIVATE'));
});

test('veli sıradan popup merkezi görünce okumaz/göstermez; simsek ve geçmiş yolu korunur',async()=>{
  const trimmed=parentSource.replace(/^import .*;\n/,'').replace("if(typeof window!=='undefined')kur();",'');
  const x=fixture(trimmed);let queried=0;x.window.PortalAPI.fb.getDocs=async()=>{queried++;throw Error('must not query');};
  x.state.veliAktifOgrenci={id:'child'};await x.context.popupKontrol();assert.equal(queried,0);
  x.context.popupGoster([{id:'one'}],0,{id:'child'},new Set());assert.equal(x.removed,1);
  assert.match(parentSource,/function bildirimleriZenginlestir/);assert.match(parentSource,/document.getElementById\('simsekOverlay'\)/);
});

test('eski personel penceresi yalnız merkez yokken çalışır ve merkez gelince çift uyarı vermez',async()=>{
  const x=fixture(personnelSource,{center:false});const popups=[];x.context.goster=(...args)=>popups.push(args);
  await x.context.baslat();x.snapshots[0].next(snapshot([['legacy',morning()]]));x.context.bosalt('sabah');assert.equal(popups.length,1);
  x.window.portalBildirimMerkezi=x.central;
  x.snapshots[0].next(snapshot([['new',morning()]]));x.context.bosalt('sabah');assert.equal(popups.length,1);assert.equal(latest(x,'personel-anlik-sabah').items.length,1);x.context.durdur();
});

test('eski görüşme fallback gösterimi de okuma yazmaz; açık kapatma okur',async()=>{
  const x=fixture(meetingSource,{center:false,appointments:[appointment()]});const popups=[];x.context.acilirGoster=options=>popups.push(options);
  x.context.bildirimBaslat();await flush();assert.equal(popups.length,1);assert.equal(x.storage.size,0);
  popups[0].kapaninca();assert.ok(x.storage.has('gn-randevu-gorulen:staff@example.test'));
  x.snapshots[0].next(snapshot([['legacy-note',notice()]]));assert.equal(popups.length,2);assert.equal(x.writes.length,0);
  await popups[1].kapaninca();assert.equal(x.writes.length,1);
  x.window.portalBildirimMerkezi=x.central;x.snapshots[0].next(snapshot([['new-note',notice()]]));assert.equal(popups.length,2);x.context.bildirimDurdur();
});

test('görüşme bekleyen okuma hesabı değişince yeni hesapta yerel onay üretmez',async()=>{
  const x=fixture(meetingSource);x.context.bildirimBaslat();await flush();x.snapshots[0].next(snapshot([['n1',notice()]]));
  const item=latest(x,'gn-personel').items[0];let resolve;x.fb.updateDoc=()=>new Promise(r=>resolve=r);
  const reading=item.onRead();x.context.bildirimDurdur();x.state.currentUser={email:'other@example.test',uid:'u2'};resolve();
  assert.equal(await reading,false);assert.equal(x.storage.size,0);
});
