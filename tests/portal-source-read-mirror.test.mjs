import test from 'node:test';
import assert from 'node:assert/strict';
import { startNotificationCenter } from '../js/portal-bildirim-merkezi.js';

const account='reader@example.invalid';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({rootFails=false,sourceFails=false}={}){
  let snapshot,center;const writes=[],sourceReads=[];
  const fb={collection:(_db,...p)=>p.join('/'),query:(...p)=>p,where:(...p)=>p,doc:(_db,...p)=>p.join('/'),
    onSnapshot:(_q,...args)=>{snapshot=args.find(x=>typeof x==='function');return()=>{};},
    updateDoc:async(path,data)=>{writes.push({path,data});if(rootFails)throw Error('synthetic-root-write-failed');}};
  center=startNotificationCenter({fb,db:{},email:account,mounts:[],excludeFromCount:r=>center?.ownedTypes.has(r.tip)});
  center.ownedTypes.add('gorusme_notu');center.ownedTypes.add('pickup-yeni');
  const root=(id,event='note-event',extra={})=>({id,tip:'gorusme_notu',aliciEmail:account,okundu:false,olayAnahtari:event,...extra});
  const source=(id='source-1',event='note-event',extra={})=>({id,tip:'gorusme_notu',okundu:false,olayAnahtari:event,
    onRead:async()=>{sourceReads.push(id);if(sourceFails)throw Error('synthetic-source-write-failed');return true;},...extra});
  const feed=records=>snapshot({metadata:{fromCache:false},forEach:callback=>records.forEach(record=>callback({
    id:record.id,data:()=>record,metadata:{hasPendingWrites:false}}))});
  const publish=records=>center.setExternalItems('source-adapter',records,{initial:true});
  return {center,writes,sourceReads,feed,publish,root,source};
}

test('reading a source joins only exact hidden root mirrors, leaving unrelated records untouched',async t=>{
  const f=fixture();t.after(()=>f.center.stop());
  f.feed([f.root('exact'),f.root('unrelated','another-event'),f.root('visible','visible-event',{tip:'galeri'}),
    f.root('other-account','note-event',{aliciEmail:'other@example.invalid'})]);
  f.publish([f.source()]);assert.equal(f.center.getState().unreadCount,2);
  assert.equal(await f.center.markRead('source-1'),true);
  assert.deepEqual(f.sourceReads,['source-1']);assert.deepEqual(f.writes.map(x=>x.path),['bildirimler/exact']);
  assert.equal(f.center.getState().unreadCount,1);assert.equal(f.center.getState().error,'');
});

test('failed hidden mirror write keeps source group unread and reports failure',async t=>{
  const f=fixture({rootFails:true});t.after(()=>f.center.stop());
  f.feed([f.root('exact')]);f.publish([f.source()]);
  assert.equal(await f.center.markRead('source-1'),false);
  assert.deepEqual(f.sourceReads,['source-1']);assert.equal(f.writes.length,1);
  assert.equal(f.center.getState().unreadCount,1);assert.match(f.center.getState().error,/kaydedilemedi/);
  await tick();assert.equal(f.writes.length,1,'failed writes must not spin in automatic retries');
});

test('failed source write keeps joined group unread even if root mirror write succeeds',async t=>{
  const f=fixture({sourceFails:true});t.after(()=>f.center.stop());
  f.feed([f.root('exact')]);f.publish([f.source()]);
  assert.equal(await f.center.markRead('source-1'),false);
  assert.equal(f.center.getState().unreadCount,1);assert.match(f.center.getState().error,/kaydedilemedi/);
});

test('operation source timestamp event joins its exact backend root identity',async t=>{
  const f=fixture();t.after(()=>f.center.stop());
  f.feed([f.root('pickup-root','pickup-yeni:pickup-id',{tip:'pickup-yeni'}),f.root('other-pickup','pickup-yeni:other',{tip:'pickup-yeni'})]);
  f.publish([f.source('pickup-source','zil:pickup-id:2026-09-30T10:00:00Z',{
    tip:'pickup-yeni',rootOlayAnahtari:'pickup-yeni:pickup-id'})]);
  assert.equal(f.center.getState().itemCount,1);assert.equal(f.center.getState().unreadCount,1);
  assert.equal(await f.center.markRead('pickup-source'),true);
  assert.deepEqual(f.writes.map(x=>x.path),['bildirimler/pickup-root']);assert.equal(f.center.getState().unreadCount,0);
});

test('a root arriving after an explicit source read is mirrored once for that exact event',async t=>{
  const f=fixture();t.after(()=>f.center.stop());f.feed([]);f.publish([f.source()]);
  assert.equal(await f.center.markRead('source-1'),true);assert.equal(f.writes.length,0);
  f.feed([f.root('late'),f.root('unrelated','another-event')]);await tick();
  assert.deepEqual(f.writes.map(x=>x.path),['bildirimler/late']);
  f.feed([f.root('late','note-event',{okundu:true}),f.root('unrelated','another-event')]);await tick();
  assert.equal(f.writes.length,1);assert.equal(f.center.getState().unreadCount,0);
});

test('historically read source snapshot does not authorize automatic root read backfill',async t=>{
  const f=fixture();t.after(()=>f.center.stop());f.feed([]);f.publish([f.source('historical','old-event',{okundu:true})]);
  f.feed([f.root('old-root','old-event')]);await tick();assert.equal(f.writes.length,0);assert.equal(f.sourceReads.length,0);
});

test('failed late-root mirroring remains unread and is not repeatedly retried on snapshots',async t=>{
  const f=fixture({rootFails:true});t.after(()=>f.center.stop());f.feed([]);f.publish([f.source()]);
  assert.equal(await f.center.markRead('source-1'),true);
  f.feed([f.root('late')]);await tick();assert.equal(f.writes.length,1);
  assert.equal(f.center.getState().unreadCount,1);assert.match(f.center.getState().error,/kaydedilemedi/);
  f.feed([f.root('late')]);await tick();assert.equal(f.writes.length,1);
});

test('read-filtered source removal cannot hide a failed unread root mirror',async t=>{
  const f=fixture({rootFails:true});t.after(()=>f.center.stop());f.feed([f.root('exact')]);
  f.publish([f.source('source-1','note-event',{onRead:async()=>{f.publish([]);return true;}})]);
  assert.equal(await f.center.markRead('source-1'),false);
  assert.equal(f.writes.length,1);assert.equal(f.center.getState().unreadCount,1);
  assert.match(f.center.getState().error,/kaydedilemedi/);
});

test('failed operation mirror stays in one source row while source is still present',async t=>{
  const f=fixture({rootFails:true});t.after(()=>f.center.stop());
  f.feed([f.root('pickup-root','pickup-yeni:pickup-id',{tip:'pickup-yeni'})]);
  f.publish([f.source('pickup-source','zil:pickup-id:2026-09-30T10:00:00Z',{
    tip:'pickup-yeni',rootOlayAnahtari:'pickup-yeni:pickup-id'})]);
  assert.equal(await f.center.markRead('pickup-source'),false);
  assert.equal(f.center.getState().unreadCount,1);assert.equal(f.center.getState().itemCount,1);
});
