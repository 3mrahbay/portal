import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { bildirimKazaniminiBul, gorulmeDeposu, RAPOR_KAPALI_MESAJI } from '../js/veli-egitim-gorunum.js';
import { donemRaporuAc } from '../js/zeky-veli-donem-raporu.js';
import { notificationPresentation, createTitleResolver } from '../js/portal-bildirim-basliklari.js';
import { render } from '../moduller/veli-egitim-gelisim.js';

const sunum={program:'montessori',anahtar:'yasam__Aktarma__Su aktarma',durum:'S',tarih:'2026-11-07',galeriId:'foto-1'};
test('direct, gallery and historic child-notice links resolve only the exact shared presentation',()=>{
  for(const b of [{program:sunum.program,kazanimAnahtari:sunum.anahtar},{kaynakId:'foto-1'},{kaynakId:'egitim_foto-1'}])
    assert.equal(bildirimKazaniminiBul({...b,ogrenciId:'child'},[sunum],'child'),sunum);
  assert.equal(bildirimKazaniminiBul({kaynakId:'foto-1',ogrenciId:'other'},[sunum],'child'),null);
  assert.equal(bildirimKazaniminiBul({kaynakId:'removed'},[sunum],'child'),null);
  assert.equal(bildirimKazaniminiBul({tip:'rozet',kaynakId:'foto-1'},[sunum],'child'),null);
});
test('viewing is persisted independently of notification read flags and scoped to parent, child and period',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const scope={storage,hesap:'parent',ogrenciId:'child',donem:'2026-2027'};
  let seen=gorulmeDeposu(scope);
  assert.equal(seen.yeni({...sunum,okundu:true}),true);
  seen.goruldu([sunum]);seen=gorulmeDeposu(scope);assert.equal(seen.yeni(sunum),false);
  for(const other of [{hesap:'other'},{ogrenciId:'sibling'},{donem:'2027-2028'}]) assert.equal(gorulmeDeposu({...scope,...other}).yeni(sunum),true);
  for(const next of [{durum:'T'},{galeriId:'foto-2'},{tarih:'2026-11-08'}]) assert.equal(seen.yeni({...sunum,...next}),true);
});
test('unavailable or malformed browser storage cannot break education; notes and photos are never stored',()=>{
  for(const storage of [undefined,{getItem:()=>'{bad',setItem:()=>{throw Error('quota');}},{getItem:()=>{throw Error('denied');}}]) {
    const seen=gorulmeDeposu({storage});seen.goruldu([sunum]);assert.equal(seen.yeni(sunum),false);
  }
  let saved='';gorulmeDeposu({storage:{setItem:(_,v)=>saved=v}}).goruldu([{...sunum,not:'PRIVATE NOTE',fotoUrl:'PRIVATE PHOTO'}]);
  assert(!saved.includes('PRIVATE'));
});
test('report entry point cannot render a draft, including direct callers',()=>{
  const alerts=[];globalThis.window={alert:x=>alerts.push(x)};
  try{assert.equal(donemRaporuAc({programlar:[]}),false);assert.deepEqual(alerts,[RAPOR_KAPALI_MESAJI]);}finally{delete globalThis.window;}
});
test('badge title explains the achievement without pretending it is a single curriculum outcome',()=>{
  const b={tip:'rozet',baslik:'Yeni gelişim rozeti',metin:'Çocuğunuz İlk Adım rozetini kazandı.'};
  assert.deepEqual(notificationPresentation(b),{title:b.metin,label:'Rozet'});
});
test('education title resolves approved gallery source for an authorized child',async()=>{
  const state={currentUser:{email:'parent@test.invalid'},veliOgrenciler:[{id:'child',veliEmail:'parent@test.invalid'}]};
  const resolver=createTitleResolver({email:'parent@test.invalid',db:{},getState:()=>state,fb:{doc:(_, ...p)=>p.join('/'),getDoc:async path=>{
    assert.equal(path,'galeri/foto-1');return{exists:()=>true,data:()=>({durum:'onaylandi',ogrenciId:'child',baslik:'Su aktarma'})};
  }}});
  const r=await resolver.resolve({tip:'egitim_gelisim',baslik:'Yeni eğitim güncellemesi',kaynakId:'foto-1',ogrenciId:'child',aliciEmail:'parent@test.invalid'});
  assert.equal(r.title,'Su aktarma');
});

function routeFixture(){
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=html.slice(html.indexOf('async function portalBildirimGit(b) {'),html.indexOf('// Bu köprü yalnız kullanıcının yeni kaydettiği/yayınladığı olaydan çağrılır.'));
  const calls=[],a={id:'a'},b={id:'b'};
  const ctx=vm.createContext({isAdmin:false,aktifPersonel:null,veliOgrenciler:[a,b],veliAktifOgrenci:a,window:{veliSwitchTab:x=>calls.push(['tab',x]),caGo:x=>calls.push(['go',x]),alert:x=>calls.push(['alert',x])},setAktifVeliOgrenci:async c=>{ctx.veliAktifOgrenci=c;calls.push(['child',c.id]);}});
  vm.runInContext(source,ctx);return{ctx,calls};
}
test('notification route selects the linked sibling before requesting its exact presentation',async()=>{
  const {ctx,calls}=routeFixture();await ctx.portalBildirimGit({tip:'egitim_gelisim',ogrenciId:'b',kaynakId:'foto-1'});
  assert.deepEqual(calls,[['child','b'],['tab','yeniapp'],['go','egitim']]);
  assert.equal(ctx.window.__zekyEgitimBaslangic.kaynakId,'foto-1');
  await assert.rejects(()=>ctx.portalBildirimGit({tip:'egitim_gelisim',ogrenciId:'stranger'}));
});
test('badge notification shows its own description and clears any stale curriculum target',async()=>{
  const {ctx,calls}=routeFixture();ctx.window.__zekyEgitimBaslangic={kaynakId:'old'};
  await ctx.portalBildirimGit({tip:'rozet',ogrenciId:'a',metin:'İlk Adım rozeti kazanıldı.'});
  assert(calls.some(x=>x[0]==='alert'&&x[1]==='İlk Adım rozeti kazanıldı.'));assert.equal(ctx.window.__zekyEgitimBaslangic,null);
});

test('rendered cards stay new until detail opens; report remains locked and old links fall back safely',async()=>{
  const alerts=[],notices=[],saved=new Map(),nodes=new Map();
  const root={innerHTML:'',querySelectorAll:()=>[]};nodes.set('cicekAppRoot',root);
  const child={id:'child',adSoyad:'Örnek Öğrenci'};
  const key='yasam__Aktarma__Su aktarma';
  const state={currentUser:{uid:'parent'},veliAktifOgrenci:child,aktifDonem:'2026-2027'};
  globalThis.document={getElementById:id=>nodes.get(id),createElement:()=>({}),head:{appendChild:n=>nodes.set(n.id,n)}};
  globalThis.window={localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},alert:x=>alerts.push(x),PortalAPI:{state,db:{},toast:x=>notices.push(x),fb:{collection:()=>null,where:()=>null,query:()=>null,getDocs:async()=>({forEach:()=>{}})}},PortalData:{
    ogrenciGelisimTumGetir:async()=>({montessori:{kayitlar:{[key]:'S'},detay:{[key]:{asamalar:{S:{durum:'S',tarih:'2026-11-07',not:'Paylaşılan gözlem',paylas:true}}}}}}),
    mufredatAlanlariGetir:async p=>p==='montessori'?[{id:'yasam',ad:'Günlük Yaşam',gruplar:[{ad:'Aktarma',dersler:['Su aktarma']}]}]:[],
    mufredatAciklamalariGetir:async()=>({})
  }};
  try{
    await render();assert.match(root.innerHTML,/class="veg-yeni">Yeni/);assert.match(root.innerHTML,/aria-disabled="true"/);assert.equal(saved.size,0);
    window.__zekyEgitimBaslangic={program:'montessori',anahtar:key,ogrenciId:'child'};
    await render();assert.match(root.innerHTML,/Paylaşılan gözlem/);assert.match(root.innerHTML,/GÜNCEL DURUM/);assert.equal(saved.size,1);
    await render();assert.doesNotMatch(root.innerHTML,/class="veg-yeni">Yeni/);
    window.__zekyEgitimBaslangic={kaynakId:'deleted-photo'};await render();assert.match(root.innerHTML,/Eğitim Gelişimi/);assert.equal(notices.length,1);
    // A pending response must not replace the selected sibling's screen.
    let release;window.PortalData.ogrenciGelisimTumGetir=()=>new Promise(r=>release=r);
    const pending=render();state.veliAktifOgrenci={id:'other'};root.innerHTML='Sibling screen';release({});await pending;assert.equal(root.innerHTML,'Sibling screen');
  }finally{delete globalThis.window;delete globalThis.document;}
});
