import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createMessageNoticeTracker } from '../js/portal-mesaj-bildirim.js';
const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function section(start, end) {
 const at = source.indexOf(start); assert.notEqual(at, -1, start);
 const to = source.indexOf(end, at); assert.ok(to > at, end);
 return source.slice(at, to);
}
const states = section('let mesajAktifThread = null;', '// İki e-postadan deterministik');
const globalListener = section('function mesajBildirimBaslat()', '// Yardımcı: bir butona rozet');
const readAction = section('async function mesajOkunduIsaretle(', '// Tarih formatla');
const stop = section('function mesajlasmaDurdur()', '// Thread listesini render et');
const openChat = section('window.mesajThreadAc = async function', '// Mesaj balonlarını render et');
const closeChat = section('window.mesajSohbetKapat = function', '// === YENİ SOHBET');
const navigation = section('document.querySelectorAll(".tab").forEach(tab => {', '// Etkinlik & Takvim iç alt-sekme');
const teacher = 'teacher@example.invalid', parent = 'parent@example.invalid';
function thread(n = 1, extra = {}) { return { id:'thread-a', katilimcilar:[teacher,parent], sonMesajGonderen:parent,
 sonMesajTarihi:{seconds:n,nanoseconds:0}, okunmamis:{[teacher]:1}, katilimciBilgi:{[parent]:{rol:'veli'}}, ...extra }; }
function classes(...initial) { const set = new Set(initial);return {add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k),toggle(k,v){if(v===undefined)v=!set.has(k); v?set.add(k):set.delete(k);}}; }
function environment() {
 const elements = new Map(), listeners = {}, windowListeners = {}, subscriptions = [], writes = [], notices = [], badges = [];
 let nextTimer=0;const timers=new Map();
 const element = id => { if(!elements.has(id))elements.set(id,{id,style:{display:''},classList:classes(),textContent:'',innerHTML:'',querySelector:()=>null});return elements.get(id);};
 const tabs = ['anasayfa','mesajlasma','egitim'].map(name=>({...element(`button-${name}`),dataset:{tab:name},addEventListener:(_,fn)=>listeners[name]=fn}));
 const doc = {visibilityState:'visible',getElementById:element,addEventListener:(name,fn)=>listeners[name]=fn,
 querySelector:q=>element(q),querySelectorAll:q=>q==='.tab'?tabs:q==='.tab-panel'?['anasayfa','mesajlasma','egitim'].map(x=>element('tab-'+x)):[]};
 element('dashboard').classList.add('active');element('tab-anasayfa').classList.add('active');element('mesajSohbetAktif').style.display='none';
 const ctx = vm.createContext({document:doc,currentUser:{email:teacher},isAdmin:false,aktifPersonel:{durum:'aktif'},aktifKullaniciRol:'ogretmen',db:{},
 window:{addEventListener:(name,fn)=>windowListeners[name]=fn},console:{warn(){},error(){}},
 createMessageNoticeTracker,setupMessageSound(){},showMessageNotice:(t,o)=>notices.push({t,o}),clearMessageNotices:()=>notices.splice(0),
 setTimeout:(fn)=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
 collection:(_db,...p)=>p.join('/'),query:(...parts)=>parts,where:(...p)=>p,orderBy:(...p)=>p,doc:(_db,...p)=>p.join('/'),
 FieldPath:class {constructor(...parts){this.parts=parts;}},updateDoc:async(...args)=>writes.push(args),
 onSnapshot:(q,...args)=>{const fns=args.filter(x=>typeof x==='function');const s={q,next:fns[0],error:fns[1],stopped:false};subscriptions.push(s);return()=>s.stopped=true;},
 danismaRolMu:()=>false,mesajThreadKategoriBelirle:()=> 'veli',mesajGorunenAd:()=> 'Veli',ROL_ETIKETLERI:{},
 mesajThreadleriListele(){},mesajBalonlariRender(){},rozetYerlestir:(_b,total)=>badges.push(total),
 sekmeyeErisim:()=>true,egitimArkaPlanCalismasiniDurdur(){},adminHomeArkaPlanCalismasiniDurdur(){},renderAdminHome(){}});
 vm.runInContext(states+readAction+globalListener+stop+openChat+closeChat+navigation,ctx);
 vm.runInContext('portalBildirimTercihleri={}',ctx);
 const run = code=>vm.runInContext(code,ctx);
 run('var starts = 0; function mesajlasmaBaslat(){ starts++; }');
 const feed=(s,items,{fromCache=false}={})=>s.next({metadata:{fromCache},forEach:fn=>items.forEach(t=>fn({id:t.id,data:()=>t}))});
 const open=async(t=thread())=>{ctx.testThread=t;run('mesajThreadListesi=[testThread]');listeners.mesajlasma();await ctx.window.mesajThreadAc(t.id);return subscriptions.at(-1);};
 const flush=()=>{const list=[...timers.values()];timers.clear();list.forEach(fn=>fn());};
 return {ctx,doc,element,run,listeners,windowListeners,subscriptions,writes,notices,badges,feed,open,flush,timers};
}
test('home incoming reply keeps unread badge and produces one generic alert without marking read',()=>{
 const e=environment();e.run('mesajBildirimBaslat()');const s=e.subscriptions[0];e.feed(s,[]);e.feed(s,[thread()]);
 assert.equal(e.run('mesajBildirimToplam'),1);assert.equal(e.badges.at(-1),1);assert.equal(e.notices.length,1);assert.equal(e.writes.length,0);
 e.feed(s,[thread()]);assert.equal(e.notices.length,1);
});
test('a visible loaded active chat is read; its new incoming message is not alerted',async()=>{
 const e=environment();e.run('mesajBildirimBaslat()');const global=e.subscriptions[0];e.feed(global,[]);
 const conversation=await e.open();e.feed(conversation,[{id:'m1'}]);assert.equal(e.writes.length,1);
 e.feed(global,[thread()]);assert.equal(e.notices.length,0);assert.equal(e.run('mesajSohbetGorunurMu("thread-a")'),true);
});
test('chat → home stops local subscriptions, leaves global alive, and rejects queued old callbacks',async()=>{
 const e=environment();e.run('mesajBildirimBaslat()');const global=e.subscriptions[0];e.feed(global,[]);
 const conversation=await e.open();e.feed(conversation,[{id:'m1'}]);const before=e.writes.length;
 e.listeners.anasayfa();assert.equal(conversation.stopped,true);assert.equal(global.stopped,false);
 e.feed(conversation,[{id:'m2'}]);assert.equal(e.writes.length,before);
 e.feed(global,[thread(2)]);assert.equal(e.run('mesajBildirimToplam'),1);assert.equal(e.notices.length,1);
});
test('hidden tab does not mark read; visibility return marks the loaded current chat',async()=>{
 const e=environment();const s=await e.open();e.doc.visibilityState='hidden';e.feed(s,[{id:'m1'}]);assert.equal(e.writes.length,0);
 e.doc.visibilityState='visible';e.listeners.visibilitychange();assert.equal(e.writes.length,1);
});
test('focus before loading, cache-only snapshot, or snapshot failure cannot mark unseen content read',async()=>{
 const e=environment();const s=await e.open();e.windowListeners.focus();assert.equal(e.writes.length,0);
 e.feed(s,[{id:'cached'}],{fromCache:true});e.windowListeners.focus();assert.equal(e.writes.length,0);
 e.feed(s,[{id:'server'}]);assert.equal(e.writes.length,1);s.error(Error('synthetic'));e.windowListeners.focus();assert.equal(e.writes.length,1);
});
test('old chat callback and error cannot affect a newly opened chat',async()=>{
 const e=environment();const a=await e.open();const b=await e.open(thread(2,{id:'thread-b'}));e.feed(b,[{id:'b'}]);const before=e.writes.length;
 e.feed(a,[{id:'a'}]);a.error(Error('late'));assert.equal(e.writes.length,before);assert.equal(e.run('mesajSohbetGorunurMu("thread-b")'),true);
});
test('rapid message → home navigation cancels delayed startup and resets the view',()=>{
 const e=environment();e.listeners.mesajlasma();e.listeners.anasayfa();e.flush();assert.equal(e.run('starts'),0);assert.equal(e.run('mesajAktifThread'),null);
 e.listeners.mesajlasma();e.flush();assert.equal(e.run('starts'),1);
});
test('delayed startup ignores account changes and hidden message panel',()=>{
 const e=environment();e.listeners.mesajlasma();e.ctx.currentUser={email:'other@example.invalid'};e.flush();assert.equal(e.run('starts'),0);
});
test('logout clears alerts, counter and stale global callbacks',()=>{
 const e=environment();e.run('mesajBildirimBaslat()');const s=e.subscriptions[0];e.feed(s,[]);e.feed(s,[thread()]);e.run('mesajBildirimDurdur()');
 assert.equal(e.notices.length,0);assert.equal(e.run('mesajBildirimToplam'),0);e.feed(s,[thread(2)]);assert.equal(e.notices.length,0);
});
test('popup title never falls back to student names, parent labels or email addresses',()=>{
 const e=environment();e.ctx.testThread=thread(1,{ogrenciAd:'Synthetic Child',katilimciBilgi:{[parent]:{rol:'veli',ad:'Synthetic Child velisi'}}});
 assert.equal(e.run('mesajUyariGonderenAdi(testThread)'),'Veli');
});
test('main import, service worker precache and version agree for the new helper',async()=>{
 const worker=await readFile(new URL('../serviceworker.js',import.meta.url),'utf8');
 assert.match(source,/portal-mesaj-bildirim\.js\?v=164/);assert.match(worker,/portal-mesaj-bildirim\.js\?v=164/);
 assert.match(source,/window\.PORTAL_SURUM = "v164"/);assert.match(worker,/v167-galeri-etkilesim-detay/);
});

test('parent Portal uses the same incoming-message alert owner and respects message opt-out',()=>{
 const e=environment();e.ctx.currentUser={email:parent};e.ctx.aktifPersonel=null;
 e.element('dashboard').classList.remove('active');e.element('veliPanel').classList.add('active');
 e.run('mesajBildirimBaslat()');const s=e.subscriptions[0];e.feed(s,[]);
 const incoming=thread(1,{sonMesajGonderen:teacher,okunmamis:{[parent]:1}});e.feed(s,[incoming]);
 assert.equal(e.notices.length,1);assert.equal(e.run('mesajBildirimToplam'),1);
 e.run('portalBildirimTercihleri={mesaj:false}');e.feed(s,[{...incoming,sonMesajTarihi:{seconds:2,nanoseconds:0}}]);
 assert.equal(e.notices.length,1);assert.equal(e.run('mesajBildirimToplam'),1);
});

test('parent modern chat read requires actual selected rendered view and visibility',()=>{
 const e=environment();e.ctx.currentUser={email:parent};e.ctx.aktifPersonel=null;
 e.element('dashboard').classList.remove('active');e.element('veliPanel').classList.add('active');
 e.element('veliPanel-yeniapp').classList.add('active');e.element('caMsgSohbetGorunum').style.display='block';
 e.ctx.caMsgAktif=thread();e.ctx.caEkran='mesajlar';e.run('portalVeliGoruntulenenThreadId="thread-a"');
 e.doc.visibilityState='hidden';e.run('portalVeliGorunenSohbetiOkunduIsaretle()');assert.equal(e.writes.length,0);
 e.doc.visibilityState='visible';e.listeners.visibilitychange();assert.equal(e.writes.length,1);
 e.ctx.caEkran='home';e.listeners.visibilitychange();assert.equal(e.writes.length,1);
});

test('unknown preferences and explicit category opt-outs never suppress counts or enable alerts',()=>{
 const e=environment();e.run('portalBildirimTercihleri=null');assert.equal(e.run('portalBildirimUyariAcikMi("mesaj")'),false);
 e.run('portalBildirimTercihleri={duyuru:false,galeri:false}');
 for(const tip of ['duyuru','etkinlik','galeri'])assert.equal(e.run(`portalBildirimUyariAcikMi(${JSON.stringify(tip)})`),false);
 for(const tip of ['sabah-yeni','pickup-hazir','kazanim','rozet'])assert.equal(e.run(`portalBildirimUyariAcikMi(${JSON.stringify(tip)})`),true);
});
