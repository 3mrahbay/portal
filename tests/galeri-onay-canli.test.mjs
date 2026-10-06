import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingGallery,galleryApprover,galleryApprovalTarget,startGalleryApprovalFeed} from '../js/galeri-onay-canli.js';
const owner = () => ({currentUser:{uid:'fixture-owner',email:'emrahby@gmail.com'},galeriOturumSurumu:1});
function fixture(initial=owner()) {
 let state=initial, next, fail, stopped=0, calls=0;
 const updates=[], writes=[];
 const fb={collection:(_db,name)=>name,where:(...x)=>x,query:(...x)=>x,
  onSnapshot(q,opts,n,e){calls++;assert.deepEqual(q,['galeri',['durum','in',['beklemede','onayBekliyor']]]);next=n;fail=e;return()=>{stopped++;};},
  setDoc(){writes.push('unexpected');},updateDoc(){writes.push('unexpected');}};
 const controller=startGalleryApprovalFeed({fb,db:{},getState:()=>state,onChange:x=>updates.push(x)});
 return {controller,updates,writes,setState:x=>{state=x;},count:()=>calls,stopped:()=>stopped,
  fail:()=>fail?.({code:'permission-denied'}),emit:(items,fromCache=false)=>next?.({docs:items.map(x=>({id:x.id,data:()=>x})),metadata:{fromCache}})};
}
test('only active canonical approvers and owner may subscribe; coordinator policy unchanged',()=>{
 for (const role of ['ogretmen','egitim_koordinator','veli','admin','mudur_yardimcisi']) assert.equal(galleryApprover({currentUser:{uid:'x',email:'x@example.test'},rol:role,personel:{durum:'aktif'}}),false);
 for (const role of ['kurucu_mudur','mudur']) {
  assert(galleryApprover({currentUser:{uid:'x'},rol:role,personel:{durum:'aktif'}}));
  assert.equal(galleryApprover({currentUser:{uid:'x'},rol:role,personel:{durum:'pasif'}}),false);
 }
 assert(galleryApprover(owner()));assert.equal(fixture({currentUser:{uid:'teacher'},rol:'ogretmen'}).count(),0);
});
test('existing Portal and ZEKY pending items appear on first snapshot without writes/backfill',()=>{
 const f=fixture();f.emit([{id:'portal',durum:'beklemede'},{id:'legacy-zeky',durum:'onayBekliyor'},{id:'approved',durum:'onaylandi'}]);
 assert.equal(f.controller.getState().status,'ready');assert.deepEqual(f.controller.getState().items.map(x=>x.id),['portal','legacy-zeky']);assert.deepEqual(f.writes,[]);
 f.emit([{id:'legacy-zeky',durum:'onayBekliyor'}]);assert.equal(f.controller.getState().items.length,1);
 f.emit([]);assert.equal(f.controller.getState().items.length,0);assert.deepEqual(f.writes,[]);
});
test('cached state and denied reads are distinct from an empty confirmed queue',()=>{
 const f=fixture();f.emit([{id:'cached',durum:'beklemede'}],true);assert.equal(f.controller.getState().status,'cached');f.fail();
 assert.equal(f.controller.getState().status,'error');assert.equal(f.controller.getState().error,'permission-denied');assert.equal(f.controller.getState().items.length,1);
 const g=fixture();g.emit([]);assert.equal(g.controller.getState().status,'ready');assert.equal(g.controller.getState().items.length,0);
});
test('logout, account switch and same-account new session discard delayed snapshots; stop unsubscribes',()=>{
 for (const next of [{}, {...owner(),currentUser:{uid:'different',email:'emrahby@gmail.com'}},{...owner(),galeriOturumSurumu:2}]) {
  const f=fixture();const count=f.updates.length;f.setState(next);f.emit([{id:'late',durum:'beklemede'}]);f.fail();assert.equal(f.updates.length,count);f.controller.stop();assert.equal(f.stopped(),1);assert.deepEqual(f.controller.getState().items,[]);
 }
 const f=fixture();f.controller.stop();f.emit([{id:'late',durum:'beklemede'}]);assert.equal(f.updates.length,1);
});
test('new stable-source links and legacy ZEKY links route only to safe pending targets',()=>{
 assert.deepEqual(galleryApprovalTarget({tip:'galeri_onay',kaynakId:'fixture-media'}),{id:'fixture-media'});
 assert.deepEqual(galleryApprovalTarget({tip:'galeri',hedefSayfa:'galeri-onay.html?medya=fixture%20media'}),{id:'fixture media'});
 assert.deepEqual(galleryApprovalTarget({tip:'galeri',hedefSayfa:'galeri-onay.html'}),{id:''});
 for(const x of ['https://evil.test/galeri-onay.html','//evil.test/galeri-onay.html','galeri.html'])assert.equal(galleryApprovalTarget({tip:'galeri',hedefSayfa:x}),null);
 assert.deepEqual(galleryApprovalTarget({tip:'galeri_onay',kaynakId:'path/escape'}),{id:''});
 assert.deepEqual(galleryApprovalTarget({tip:'galeri',hedefSayfa:'galeri-onay.html?medya=a&medya=b'}),{id:''});
 assert(pendingGallery('beklemede'));assert(pendingGallery('onayBekliyor'));assert.equal(pendingGallery('onaylandi'),false);
});
