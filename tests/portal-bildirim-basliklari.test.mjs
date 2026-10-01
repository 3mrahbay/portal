import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationPresentation, createTitleResolver } from '../js/portal-bildirim-basliklari.js';

const email = 'parent@example.test';
const child = {id:'own-child',sinif:'Papatya',veli1Eposta:email};
const baseState = () => ({currentUser:{email},veliOgrenciler:[child],ayarListesi:{}});
const note = (tip, extra={}) => ({tip,aliciEmail:email,kaynakId:'source',baslik:tip === 'mesaj' ? 'Yeni mesaj' : 'Yeni okul etkinliği',...extra});
const thread = (extra={}) => ({katilimcilar:[email,'sender@example.test'],katilimciBilgi:{[email]:{ad:'Parent Name',rol:'veli'},'sender@example.test':{ad:'Aylin Yılmaz',rol:'ogretmen'}},...extra});
function fixture({state=baseState(),docs={},getDoc}={}) {
  const reads=[]; let active=true, current=state;
  const fb={doc:(_db,...path)=>path.join('/'),getDoc:async path=>{reads.push(path);if(getDoc)return getDoc(path);const data=docs[path];if(data instanceof Error)throw data;return {exists:()=>!!data,data:()=>data};}};
  const resolver=createTitleResolver({fb,db:{},email,isActive:()=>active,getState:()=>current});
  return {resolver,reads,set active(value){active=value;},set state(value){current=value;}};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('message list title is the known sender name, never the message body or contact fallback',()=>{
  for(const baslik of ['Yeni mesaj · Aylin Yılmaz','💬 Yeni mesaj · Aylin Yılmaz']) {
    assert.deepEqual(notificationPresentation(note('mesaj',{baslik,metin:'SECRET BODY'})),{title:'Aylin Yılmaz',label:'Mesaj'});
  }
  for(const value of ['parent@example.test','+90 555 123 45 67','PRIVATE CHILD velisi','Okul','Öğretmen','Öğretmen 1','Veli 1','Veli 2','Sınıf Öğretmeni','<img src=x onerror=alert(1)>']) {
    assert.equal(notificationPresentation(note('mesaj',{baslik:'Yeni mesaj · '+value,gonderenAd:value})).title,'Mesaj');
  }
  assert.equal(notificationPresentation(note('mesaj',{baslik:'PRIVATE MESSAGE CONTENT'})).title,'Mesaj');
  assert.equal(notificationPresentation(note('mesaj'),{senderName:'Deniz Kaya'}).title,'Deniz Kaya');
});

test('full event, announcement, gallery and source titles remain untruncated plain strings',()=>{
  const title='Yeni etkinlik · '+('Uzun Etkinlik Başlığı '.repeat(35)).trim();
  assert.equal(notificationPresentation(note('etkinlik',{baslik:title})).title,title);
  assert.equal(notificationPresentation(note('etkinlik'),{sourceTitle:'Tam Etkinlik Başlığı'}).title,'Tam Etkinlik Başlığı');
  const html='<img src=x onerror=alert(1)> Bir başlık';
  assert.equal(notificationPresentation(note('duyuru',{baslik:html})).title,html);
  assert.equal(notificationPresentation(note('galeri',{baslik:'Sonbahar albümü güncellendi'})).title,'Sonbahar albümü güncellendi');
});

test('existing meaningful root title requires no source reads',async()=>{
  const f=fixture();
  assert.equal((await f.resolver.resolve(note('mesaj',{baslik:'Yeni mesaj · Aylin Yılmaz'}))).title,'Aylin Yılmaz');
  assert.equal((await f.resolver.resolve(note('etkinlik',{baslik:'Sonbahar şenliği'}))).title,'Sonbahar şenliği');
  assert.equal(f.reads.length,0);
});

test('historic app message exact thread resolves the other named participant, never latest sender',async()=>{
  const f=fixture({docs:{'mesajlar/source':thread({sonMesajGonderen:email,sonMesaj:'SECRET BODY'})}});
  assert.equal(f.resolver.peek(note('mesaj')).title,'Mesaj');
  assert.equal((await f.resolver.resolve(note('mesaj'))).title,'Aylin Yılmaz');
  assert.equal(f.resolver.peek(note('mesaj')).title,'Aylin Yılmaz');
  assert.deepEqual(f.reads,['mesajlar/source']);
});

test('already-authorized participant and event caches require no extra reads',async()=>{
  const state={...baseState(),threads:[{id:'source',...thread()}],events:[{id:'event',kaynak:'etkinlikler',hedefTur:'sinif',hedefDeger:'Papatya',baslik:'Sınıf gezisi'}]};
  const f=fixture({state});
  assert.equal((await f.resolver.resolve(note('mesaj'))).title,'Aylin Yılmaz');
  assert.equal((await f.resolver.resolve(note('etkinlik',{kaynakId:'event'}))).title,'Sınıf gezisi');
  assert.equal(f.reads.length,0);
});

test('thread non-members, ambiguous groups, contacts and child fallback do not yield names',async()=>{
  for(const data of [thread({katilimcilar:['other@example.test','sender@example.test']}),thread({katilimcilar:[email,'sender@example.test','third@example.test']}),thread({katilimciBilgi:{'sender@example.test':{ad:'PRIVATE CHILD velisi'}}}),thread({katilimciBilgi:{'sender@example.test':{ad:'sender@example.test'}}})]) {
    const f=fixture({docs:{'mesajlar/source':data}});
    assert.equal((await f.resolver.resolve(note('mesaj'))).title,'Mesaj');
  }
});

test('validated historic sohbet route supports one exact thread parameter, not arbitrary URLs or paths',async()=>{
  const f=fixture({docs:{'mesajlar/safe':thread()}});
  assert.equal((await f.resolver.resolve(note('mesaj',{kaynakId:'',hedefSayfa:'sohbet.html?thread=safe'}))).title,'Aylin Yılmaz');
  for(const value of ['https://evil.test/sohbet.html?thread=other','sohbet.html?thread=a&thread=b','sohbet.html?thread=a%2Fb','javascript:alert(1)','other.html?thread=a']) {
    await f.resolver.resolve(note('mesaj',{kaynakId:'',hedefSayfa:value}));
  }
  for(const id of ['a/b','a\\b','../other','bad\npath'])await f.resolver.resolve(note('mesaj',{kaynakId:id}));
  assert.deepEqual(f.reads,['mesajlar/safe']);
});

test('old generic event title hydrates one exact source within parent audience',async()=>{
  const f=fixture({docs:{'etkinlikler/source':{baslik:'Papatya Sınıfı Sonbahar Gezisi',hedefTur:'sinif',hedefDeger:'Papatya'}}});
  assert.equal((await f.resolver.resolve(note('etkinlik'))).title,'Papatya Sınıfı Sonbahar Gezisi');
  assert.deepEqual(f.reads,['etkinlikler/source']);
});

test('wrong class, unrelated child, unknown target and archived sources stay generic',async()=>{
  for(const source of [{hedefTur:'sinif',hedefDeger:'Lale'},{hedefTur:'ogrenci',hedefDeger:'unrelated'},{hedefTur:'sinif',hedefDeger:''},{hedefTur:'unknown'},{hedefTur:'tumOkul',arsiv:true}]) {
    const f=fixture({docs:{'etkinlikler/source':{baslik:'PRIVATE TITLE',...source}}});
    assert.equal((await f.resolver.resolve(note('etkinlik'))).title,'Yeni okul etkinliği');
  }
});

test('no verified child relationship means no new event read, including stale previous-account arrays',async()=>{
  for(const children of [[],[{id:'own-child',sinif:'Papatya'}],[{...child,veli1Eposta:'other@example.test'}]]) {
    const f=fixture({state:{...baseState(),veliOgrenciler:children},docs:{'etkinlikler/source':{baslik:'PRIVATE TITLE',hedefTur:'tumOkul'}}});
    assert.equal((await f.resolver.resolve(note('etkinlik'))).title,'Yeni okul etkinliği');
    assert.equal(f.reads.length,0);
  }
});

test('verified child email may come from that child period record, but never unrelated period records',async()=>{
  const state={...baseState(),veliOgrenciler:[{id:'own-child',sinif:'Papatya'}],ayarListesi:{'own-child':{anne:{eposta:email}}}};
  const f=fixture({state,docs:{'etkinlikler/source':{baslik:'Family event',hedefTur:'ogrenci',hedefDeger:'own-child'}}});
  assert.equal((await f.resolver.resolve(note('etkinlik'))).title,'Family event');
});

test('teachers cannot hydrate another class or unverified student even from broad caches',async()=>{
  const state={currentUser:{email},rol:'ogretmen',personel:{durum:'aktif'},siniflar:['Papatya'],events:[{id:'source',baslik:'PRIVATE TITLE',hedefTur:'sinif',hedefDeger:'Lale'}]};
  const f=fixture({state});
  assert.equal((await f.resolver.resolve(note('etkinlik'))).title,'Yeni okul etkinliği');
  assert.equal(f.reads.length,0);
  f.state={...state,events:[{id:'source',baslik:'Own class',hedefTur:'sinif',hedefDeger:'Papatya'}]};
  assert.equal(f.resolver.peek(note('etkinlik')).title,'Own class');
});

test('simultaneous same-source reads dedupe; missing and denied documents are not retried',async()=>{
  const wait=deferred();const f=fixture({getDoc:()=>wait.promise});
  const a=f.resolver.resolve(note('mesaj')), b=f.resolver.resolve(note('mesaj',{id:'duplicate'}));
  await Promise.resolve();assert.equal(f.reads.length,1);
  wait.resolve({exists:()=>true,data:()=>thread()});
  assert.equal((await a).title,'Aylin Yılmaz');assert.equal((await b).title,'Aylin Yılmaz');
  for(const data of [undefined,new Error('permission-denied')]) {
    const g=fixture({docs:{'mesajlar/source':data}});
    await g.resolver.resolve(note('mesaj'));await g.resolver.resolve(note('mesaj'));
    assert.deepEqual(g.reads,['mesajlar/source']);
  }
});

test('account switch, stop, clear and mismatched recipient cannot expose late private titles',async()=>{
  for(const cancel of ['switch','stop','clear']) {
    const wait=deferred();const f=fixture({getDoc:()=>wait.promise});
    const result=f.resolver.resolve(note('mesaj'));await Promise.resolve();
    if(cancel==='switch')f.state={currentUser:{email:'other@example.test'}};
    if(cancel==='stop')f.active=false;
    if(cancel==='clear')f.resolver.clear();
    wait.resolve({exists:()=>true,data:()=>thread()});
    assert.equal((await result).title,'Mesaj');assert.equal(f.resolver.peek(note('mesaj')).title,'Mesaj');
  }
  const f=fixture();assert.equal((await f.resolver.resolve(note('mesaj',{aliciEmail:'other@example.test',gonderenAd:'PRIVATE NAME'}))).title,'Mesaj');assert.equal(f.reads.length,0);
});

test('approved targeted gallery and own child learning titles hydrate narrowly',async()=>{
  const f=fixture({docs:{'galeri/source':{baslik:'Orman Albümü',durum:'onaylandi',hedefTur:'sinif',hedefDeger:'Papatya'},'ogrenciler/own-child/bildirimler/egitim_1':{baslik:'Boncuk dizme · Uygulandı'}}});
  assert.equal((await f.resolver.resolve(note('galeri',{baslik:'Yeni galeri içeriği',olayAnahtari:'galeri-onay:source'}))).title,'Orman Albümü');
  assert.equal((await f.resolver.resolve(note('egitim_gelisim',{baslik:'Yeni eğitim güncellemesi',kaynakId:'egitim_1',ogrenciId:'own-child'}))).title,'Boncuk dizme · Uygulandı');
  await f.resolver.resolve(note('egitim_gelisim',{baslik:'Yeni eğitim güncellemesi',kaynakId:'egitim_1',ogrenciId:'other-child'}));
  assert.deepEqual(f.reads,['galeri/source','ogrenciler/own-child/bildirimler/egitim_1']);
});


test('source urgency is exposed only with the same allowed audience as its resolved title',async()=>{
  const allowed=fixture({docs:{'duyurular/source':{baslik:'Yetkili başlık',aciliyet:'acil',hedefTur:'sinif',hedefDeger:'Papatya'}}});
  const request=note('duyuru',{baslik:'Yeni okul duyurusu'});
  assert.equal((await allowed.resolver.resolve(request)).urgent,true);
  assert.deepEqual(allowed.reads,['duyurular/source']);
  const denied=fixture({docs:{'duyurular/source':{baslik:'PRIVATE TITLE',aciliyet:'acil',hedefTur:'sinif',hedefDeger:'Lale'}}});
  const result=await denied.resolver.resolve(request);assert.equal(result.urgent,undefined);assert.equal(result.title,'Yeni okul duyurusu');
  const ordinary=fixture({docs:{'duyurular/source':{baslik:'Acil kelimesi var',simsek:true,aciliyet:'normal',hedefTur:'tumOkul'}}});
  assert.equal((await ordinary.resolver.resolve(request)).urgent,undefined);
});
