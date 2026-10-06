import test from 'node:test';
import assert from 'node:assert/strict';
import {galleryRuntime,media,defer,settle} from '../qa/galeri-onay-fixture.mjs';
const ids=r=>Array.from(r.read().items,x=>x.id);
const notice=id=>({tip:'galeri_onay',kaynakId:id});

test('active Portal pending handler renders both historical statuses, then removes approved rows without writes',async()=>{
 const r=galleryRuntime();r.window.galeriFilter('onayBekliyor');assert.match(r.html(),/yükleniyor/);assert.equal(r.calls.listeners.length,1);
 const query=r.calls.listeners[0].query;assert.equal(query.collection,'galeri');assert.deepEqual(query.constraints,[{field:'durum',op:'in',value:['beklemede','onayBekliyor']}]);
 r.emit([media('portal'),media('zeky',{durum:'onayBekliyor'}),media('approved',{durum:'onaylandi'})]);await settle();
 assert.deepEqual(ids(r),['portal','zeky']);assert.match(r.html(),/acGaleriLightbox\('portal'\)/);assert.match(r.html(),/acGaleriLightbox\('zeky'\)/);assert.doesNotMatch(r.html(),/'approved'/);
 assert.equal(r.nodes.get('galeriOnayBekleyenRozet').textContent,'2');assert.equal(r.nodes.get('galeriMenuOnayRozet').textContent,'2');
 r.emit([media('zeky',{durum:'onayBekliyor'})]);assert.deepEqual(ids(r),['zeky']);assert.equal(r.nodes.get('galeriOnayBekleyenRozet').textContent,'1');assert.deepEqual(r.calls.writes,[]);assert.deepEqual(r.calls.reads,[]);
});
test('pending error and cache state remain distinct from confirmed empty; retry starts a fresh listener',async()=>{
 const r=galleryRuntime();r.window.galeriFilter('onayBekliyor');r.emit([media('cached')],true);assert.match(r.nodes.get('galeriOnayCanliDurum').textContent,/Önbellek/);
 r.fail();assert.match(r.html(),/Onay listesi yüklenemedi/);assert.doesNotMatch(r.html(),/Henüz içerik yok|Galeri boş/);assert.equal(r.nodes.get('galeriOnayBekleyenRozet').textContent,'!');
 const retry=r.nodes.get('galeriOnayCanliDurum').children.find(x=>typeof x!=='string');assert.equal(retry.textContent,'Yeniden dene');retry.click();assert.equal(r.calls.listeners.length,2);assert.equal(r.calls.listeners[0].stopped,true);assert.match(r.html(),/yükleniyor/);
 r.emit([]);assert.match(r.html(),/Henüz içerik yok/);assert.equal(r.nodes.get('galeriOnayBekleyenRozet').style.display,'none');assert.equal(r.nodes.get('galeriOnayCanliDurum').textContent,'');assert.deepEqual(r.calls.writes,[]);
});
test('general gallery denied read has an actionable retry and never pretends the gallery is empty',async()=>{
 let failing=true;const r=galleryRuntime({getRows:()=>failing?Promise.reject({code:'permission-denied'}):[media('recovered')]});await r.render();assert.match(r.html(),/Galeri yüklenemedi/);assert.doesNotMatch(r.html(),/Henüz içerik yok/);
 failing=false;await r.nodes.get('galeriListesi').querySelector('[data-gallery-retry]').click();assert.deepEqual(ids(r),['recovered']);assert.deepEqual(r.calls.writes,[]);
});
test('late general getDocs cannot overwrite a newer pending-filter render',async()=>{
 const delayed=defer();const r=galleryRuntime({getRows:()=>delayed.promise});const old=r.render();r.window.galeriFilter('onayBekliyor');r.emit([media('current-pending')]);delayed.resolve([media('old-approved',{durum:'onaylandi'})]);await old;
 assert.deepEqual(ids(r),['current-pending']);assert.doesNotMatch(r.html(),/old-approved/);
});
test('logout clears gallery and lightbox, unsubscribes, and discards old getDocs/snapshot/error completions',async()=>{
 const delayed=defer();const r=galleryRuntime({getRows:()=>delayed.promise});r.window.galeriFilter('onayBekliyor');r.emit([media('old')]);r.window.acGaleriLightbox('old');assert(r.isOpen());r.window.galeriFilter('tumu');
 r.state.currentUser=null;r.stop();delayed.resolve([media('late')]);r.emit([media('late')],false,0);r.fail('permission-denied',0);await settle();
 assert.deepEqual(ids(r),[]);assert.equal(r.html(),'');assert.equal(r.isOpen(),false);assert.equal(r.nodes.get('galeriLightboxIcerik').innerHTML,'');assert.equal(r.calls.listeners[0].stopped,true);assert.equal(r.nodes.get('galeriOnayBekleyenRozet').style.display,'none');
});
test('account switch discards old list response even when both users are approvers',async()=>{
 const delayed=defer();let first=true;const r=galleryRuntime({getRows:()=>first?delayed.promise:[media('new-account')]});const old=r.render();r.switchAccount();r.stop();first=false;await r.render();delayed.resolve([media('old-account')]);await old;assert.deepEqual(ids(r),['new-account']);assert.doesNotMatch(r.html(),/old-account/);
});
test('known pending notice opens its media before the feed snapshot and performs only reads',async()=>{
 for(const durum of ['beklemede','onayBekliyor']){const r=galleryRuntime({rows:[media('target',{durum})]});await r.notice(notice('target'));assert.deepEqual(r.calls.modules,['galeri']);assert.equal(r.read().filter,'onayBekliyor');assert.equal(r.read().active.id,'target');assert(r.isOpen());assert.match(r.nodes.get('galeriLightboxIcerik').innerHTML,/target\.svg/);assert.deepEqual(r.calls.writes,[]);}
});
test('legacy ZEKY notice opens pending queue without invented media reads or writes',async()=>{
 const r=galleryRuntime();await r.notice({tip:'galeri',hedefSayfa:'galeri-onay.html'});assert.equal(r.read().filter,'onayBekliyor');assert.equal(r.isOpen(),false);assert.deepEqual(r.calls.reads,[]);assert.deepEqual(r.calls.writes,[]);
});
test('already processed and deleted notice targets show a toast without opening or mutating media',async()=>{
 for(const row of [media('target',{durum:'onaylandi'}),media('target',{durum:'reddedildi'}),null]){const r=galleryRuntime({rows:row?[row]:[]});await r.notice(notice('target'));assert.equal(r.isOpen(),false);assert.equal(r.calls.toasts.length,1);assert.match(r.calls.toasts[0].message,row?/tamamlanmış/:/bulunamıyor/);assert.deepEqual(r.calls.writes,[]);}
});
for(const transition of ['close','new card','new filter','new module','logout','account switch'])test(`a delayed notice cannot reopen or replace media after ${transition}`,async()=>{
 const delayed=defer();const r=galleryRuntime({rows:[media('current')],getMedia:()=>delayed.promise});r.window.galeriFilter('onayBekliyor');r.emit([media('current')]);const opening=r.notice(notice('delayed'));
 if(transition==='close')r.window.closeGaleriLightbox();
 if(transition==='new card')r.window.acGaleriLightbox('current');
 if(transition==='new filter')r.window.galeriFilter('foto');
 if(transition==='new module')r.nodes.get('tab-galeri').classList.remove('active');
 if(transition==='logout'){r.state.currentUser=null;r.stop();}
 if(transition==='account switch'){r.switchAccount();r.stop();}
 delayed.resolve(media('delayed'));await opening;await settle();
 assert.equal(r.isOpen(),transition==='new card');assert.notEqual(r.read().active?.id,'delayed');assert(!ids(r).includes('delayed'));assert.deepEqual(r.calls.writes,[]);
});
test('newer notification wins over a delayed earlier notification',async()=>{
 const delayed=defer();const r=galleryRuntime({getMedia:id=>id==='old'?delayed.promise:media('new')});const old=r.notice(notice('old'));await r.notice(notice('new'));delayed.resolve(media('old'));await old;assert.equal(r.read().active.id,'new');assert(!ids(r).includes('old'));
});
test('approved and deleted media cannot be changed by stale approve/reject handlers',async()=>{
 for(const row of [media('target',{durum:'onaylandi'}),null])for(const action of ['galeriOnayla','galeriReddet']){const r=galleryRuntime({rows:row?[row]:[]});assert.equal(await r.window[action]('target'),false);assert.deepEqual(r.calls.writes,[]);}
});

for(const method of ['module','tab'])test(`delayed notice stays dismissed after leaving and returning through actual ${method} navigation`,async()=>{
 const delayed=defer();const r=galleryRuntime({getMedia:()=>delayed.promise});const pending=r.notice(notice('old'));
 if(method==='module'){r.window.modulSec('profilim');r.window.modulSec('galeri');}
 else{r.tabs.find(t=>t.dataset.tab==='profilim').click();r.tabs.find(t=>t.dataset.tab==='galeri').click();}
 assert.equal(r.read().filter,'onayBekliyor');assert(r.nodes.get('tab-galeri').classList.contains('active'));delayed.resolve(media('old'));await pending;assert.equal(r.isOpen(),false);assert(!ids(r).includes('old'));
});
