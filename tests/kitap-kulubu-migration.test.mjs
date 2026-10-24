import test from 'node:test';
import assert from 'node:assert/strict';
import {migrationWrites,main} from '../scripts/kitap-kulubu-second-reading.mjs';
import {INITIAL_ID,INITIAL_BOOK,SECOND_ID,SECOND_BOOK} from '../js/kitap-kulubu/core.mjs';
const doc=(id,data)=>({name:`projects/bcka-site/databases/(default)/documents/kitapKulubu/${id}`,updateTime:'2026-10-24T12:00:00Z',fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{stringValue:v}]))});
test('atomic rollover creates exactly one book and only patches first status',()=>{
  const first=doc(INITIAL_ID,INITIAL_BOOK),before=structuredClone(first);
  const writes=migrationWrites(first,null);
  assert.equal(writes.length,2);
  assert.deepEqual(writes[0].currentDocument,{exists:false});
  assert.equal(writes[0].update.name,doc(SECOND_ID,SECOND_BOOK).name);
  assert.deepEqual(writes[1].updateMask,{fieldPaths:['status']});
  assert.deepEqual(writes[1].currentDocument,{updateTime:first.updateTime});
  assert.deepEqual(Object.keys(writes[1].update.fields),['status']);
  assert.deepEqual(first,before);
  assert(writes.every(w=>!w.delete&&!w.update.name.includes('paylasimlar')));
});
test('reruns are no-ops and conflicting or missing records fail closed',()=>{
  const first=doc(INITIAL_ID,{...INITIAL_BOOK,status:'archived'}), second=doc(SECOND_ID,SECOND_BOOK);
  assert.deepEqual(migrationWrites(first,second),[]);
  assert.equal(migrationWrites(first,null).length,1);
  assert.throws(()=>migrationWrites(null,null));
  assert.throws(()=>migrationWrites(doc(INITIAL_ID,{...INITIAL_BOOK,title:'Changed'}),null));
  assert.throws(()=>migrationWrites(first,doc(SECOND_ID,{...SECOND_BOOK,purpose:'Edited'})));
});
test('default plan never accesses the network and invalid apply cannot write',async()=>{
  const oldFetch=globalThis.fetch,oldLog=console.log;let calls=0;
  globalThis.fetch=()=>{calls++;throw Error('network prohibited');};console.log=()=>{};
  try {await main([]);assert.equal(calls,0);await assert.rejects(()=>main(['--apply']),/Kullanım/);}
  finally {globalThis.fetch=oldFetch;console.log=oldLog;}
});
