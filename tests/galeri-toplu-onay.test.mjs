import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewGalleryItem, approveGalleryItem, notifyGalleryPublication, GALLERY_NOTICE_INTERVAL } from '../js/galeri-toplu-onay.js';
import { galleryRuntime, media, defer } from '../qa/galeri-onay-fixture.mjs';

function database() {
  const docs = new Map(), writes = [], pushes = [], reads = [];
  let time = Date.parse('2026-11-03T12:00:00Z'), counter = 0, tail = Promise.resolve();
  const state = { currentUser: { uid:'manager', email:'manager@example.test' }, rol:'mudur', personel:{durum:'aktif'}, aktifDonem:'2026-2027' };
  const fb = {
    collection:(_db,...parts)=>({path:parts.join('/')}),
    doc:(...args)=>{const path=args.length===1?`${args[0].path}/notice-${++counter}`:args.slice(1).join('/');return{path,id:path.split('/').at(-1)};},
    serverTimestamp:()=>new Date(time).toISOString(),
    runTransaction:async(_db,fn)=>{
      const execute=async()=>{
        const staged=[];
        const tx={get:async ref=>{reads.push(ref.path);const value=docs.get(ref.path);return{exists:()=>!!value,data:()=>value};},set:(ref,data)=>staged.push([ref.path,data]),update:(ref,data)=>staged.push([ref.path,{...docs.get(ref.path),...data}])};
        // Also exercise a callback retry; writes from the first callback are discarded.
        await fn(tx); staged.length=0;
        const result=await fn(tx);
        if(fb.rejectCommit)throw Error('transaction failed');
        for(const [path,data] of staged){docs.set(path,data);writes.push([path,data]);}
        return result;
      };
      const pending=tail.then(execute);tail=pending.catch(()=>{});return pending;
    }
  };
  const api={state,fb,db:{}};
  const options={recipients:['parent@example.test','PARENT@example.test'],now:()=>time,sendPush:async(emails,content)=>{pushes.push({emails,content});return{ok:true};}};
  return {api,fb,docs,writes,pushes,reads,options,advance:n=>time+=n,notice:(m,extra={})=>notifyGalleryPublication(m,api,{...options,...extra})};
}
test('five separate approvals for a class persist one notice and attempt one push',async()=>{
  const d=database();
  for(let i=0;i<5;i++){const result=await d.notice(media(`photo-${i}`));assert.equal(result.ok,true);d.advance(15000);}
  assert.equal(d.pushes.length,1);assert.equal(d.writes.filter(([p])=>p.startsWith('bildirimler/')).length,1);
  assert(d.reads.every(p=>p.startsWith('ayarlar/')),'never read recipient notices');
  const marker=d.writes.find(([p])=>p.startsWith('ayarlar/'));
  assert.deepEqual(Object.keys(marker[1]),['sonBildirim']);assert(!marker[0].includes('Sentetik'));
});
test('cooldown is shared across simultaneous managers and reloads; other targets and later batches notify',async()=>{
  const d=database(),m=media('photo');
  const other={...d.api,state:{...d.api.state,currentUser:{uid:'other',email:'other@example.test'}}};
  await Promise.all([d.notice(m),notifyGalleryPublication(media('second'),other,d.options)]);
  assert.equal(d.pushes.length,1);
  await notifyGalleryPublication(media('reload'),{...d.api,state:{...d.api.state}},d.options);assert.equal(d.pushes.length,1);
  await d.notice(media('other-class',{hedefDeger:'Other Class'}));assert.equal(d.pushes.length,2);
  d.advance(GALLERY_NOTICE_INTERVAL);await d.notice(media('new-batch'));assert.equal(d.pushes.length,3);
});
test('a transaction failure writes neither cooldown nor notices and permits a safe retry',async()=>{
  const d=database();d.fb.rejectCommit=true;assert.equal((await d.notice(media('x'))).ok,false);
  assert.equal(d.docs.size,0);assert.equal(d.pushes.length,0);
  d.fb.rejectCommit=false;assert.equal((await d.notice(media('x'))).ok,true);assert.equal(d.pushes.length,1);
});
test('uncertain push is not repeated; root notice remains available',async()=>{
  const d=database();const result=await d.notice(media('x'),{sendPush:async()=>{d.pushes.push({});return{ok:false};}});
  assert.equal(result.ok,true);assert.equal(result.push.ok,false);
  await d.notice(media('y'));assert.equal(d.pushes.length,1);assert.equal([...d.docs.keys()].filter(p=>p.startsWith('bildirimler/')).length,1);
});
test('missing target, teacher, inactive manager, and missing recipients cannot create or widen notices',async()=>{
  for(const extra of [{hedefTur:'',hedefDeger:''},{hedefTur:'sinif',hedefDeger:''}]){const d=database();assert.equal((await d.notice(media('x',extra))).ok,false);assert.equal(d.docs.size,0);}
  for(const change of [{rol:'ogretmen'},{personel:{durum:'pasif'}}]){const d=database();Object.assign(d.api.state,change);assert.equal((await d.notice(media('x'))).ok,false);assert.equal(d.docs.size,0);}
  const d=database();assert.equal((await d.notice(media('x'),{recipients:[]})).ok,false);assert.equal(d.docs.size,0);
});
test('education updates are grouped by child and keep their destination',async()=>{
  const d=database();for(let i=0;i<5;i++)await d.notice(media(String(i),{hedefTur:'ogrenci',hedefDeger:'child'}),{education:true});
  assert.equal(d.pushes.length,1);assert.equal(d.pushes[0].content.hedefSayfa,'veli-egitim.html');
  await d.notice(media('other',{hedefTur:'ogrenci',hedefDeger:'other-child'}),{education:true});assert.equal(d.pushes.length,2);
});
test('atomic approval publishes once even with concurrent clicks; processed or missing records are skipped',async()=>{
  const d=database();d.docs.set('galeri/x',media('spoofed-id'));
  const results=await Promise.all([approveGalleryItem('x',d.api),approveGalleryItem('x',d.api)]);
  assert.equal(results.filter(Boolean).length,1);assert.equal(results.find(Boolean).id,'x');assert.equal(d.docs.get('galeri/x').durum,'onaylandi');
  assert.equal(await approveGalleryItem('missing',d.api),null);
});
test('bulk approves only visible target, both pending statuses, and excludes later arrivals',async()=>{
  const rows=[media('a'),media('b',{durum:'onayBekliyor'}),media('other',{hedefDeger:'Other'}),media('done',{durum:'onaylandi'})];
  const r=galleryRuntime({rows});r.window.galeriFilter('onayBekliyor');r.emit(rows);
  r.window.galeriOnayHedefSec(JSON.stringify(['sinif','Sentetik Sınıf']));
  assert.equal(r.nodes.get('galeriTopluOnayBtn').textContent,'Görünenleri toplu onayla (2)');
  await r.window.galeriTopluOnayla();assert.deepEqual(r.calls.writes.map(x=>x.ref.id),['a','b']);assert.equal(r.calls.notices.length,2);
});
test('bulk cancellation, cache-only state, error state and unauthorized roles never write',async()=>{
  for(const mode of ['cancel','cache','error','teacher']){
    const rows=[media('a')],r=galleryRuntime({rows,confirm:()=>mode!=='cancel',...(mode==='teacher'?{state:{rol:'ogretmen'}}:{})});
    r.window.galeriFilter('onayBekliyor');if(mode!=='teacher'){r.emit(rows,mode==='cache');if(mode==='error')r.fail();}
    await r.window.galeriTopluOnayla();assert.equal(r.calls.writes.length,0,mode);
  }
});
test('bulk continues after a failed item and prevents double submission',async()=>{
  const gate=defer();let reached;const entered=new Promise(r=>reached=r);
  const rows=[media('bad'),media('good')];
  const r=galleryRuntime({rows,beforeCommit:async staged=>{if(staged[0]?.ref.id==='bad'){reached();await gate.promise;throw Error('denied');}}});
  r.window.galeriFilter('onayBekliyor');r.emit(rows);const first=r.window.galeriTopluOnayla();await entered;
  await r.window.galeriTopluOnayla();gate.resolve();await first;
  assert.deepEqual(r.calls.writes.map(x=>x.ref.id),['good']);assert.match(r.calls.toasts.at(-1).message,/1 içerik onaylandı; 1/);
});
test('account switch during approval discards delayed write and stops the remaining bulk items',async()=>{
  const gate=defer();let reached;const entered=new Promise(r=>reached=r);
  const r=galleryRuntime({rows:[media('a'),media('b')],getMedia:async id=>{reached();await gate.promise;return media(id);}});
  r.window.galeriFilter('onayBekliyor');r.emit([media('a'),media('b')]);const task=r.window.galeriTopluOnayla();await entered;r.switchAccount();gate.resolve();await task;
  assert.equal(r.calls.writes.length,0);assert.equal(r.calls.notices.length,0);
});

test('concurrent approve and reject cannot overwrite the winning decision',async()=>{
 const d=database();d.docs.set('galeri/x',media('x'));
 const result=await Promise.all([reviewGalleryItem('x','reddedildi',d.api),approveGalleryItem('x',d.api)]);
 assert.equal(result.filter(Boolean).length,1);assert.equal(d.docs.get('galeri/x').durum,'reddedildi');
});
test('media arriving after bulk confirmation remain pending',async()=>{
 const rows=[media('initial')];let r;
 r=galleryRuntime({rows,beforeCommit:()=>{rows.push(media('later'));r.emit(rows);}});
 r.window.galeriFilter('onayBekliyor');r.emit(rows);await r.window.galeriTopluOnayla();
 assert.deepEqual(r.calls.writes.map(x=>x.ref.id),['initial']);assert.equal(rows.find(x=>x.id==='later').durum,'beklemede');
});
