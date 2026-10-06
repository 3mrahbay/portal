import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Offline reviewer regressions: execute actual inline helpers and caller, synthetic data only.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const profilFotoYuklemeIslemleri =');
const helper=html.slice(start,html.indexOf('// Fotoğrafı kaldır',start));
const callerStart=html.indexOf('window.veliFotoDegistir =');
const caller=html.slice(callerStart,html.indexOf('window.veliFotoKaldir',callerStart));
const file={name:'synthetic.jpg',type:'image/jpeg',size:1024};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(stage,gate) {
  let select;const events=[];const records=new Map([['veliler/first@example.invalid',{fotoYol:'old.jpg'}]]);
  const c={window:{},Map,Date,Boolean,Error,Object,db:{},portalOturumSurumu:1,currentUser:{uid:'first',email:'first@example.invalid'},
    console:{warn(){},error(){events.push('error');}},
    doc:(_db,col,id)=>`${col}/${id}`,
    resimSikistir:async x=>stage==='compress'?gate.promise:x,
    medyaYukle:async()=>stage==='upload'?gate.promise:{url:'https://example.invalid/new.jpg',yol:'new.jpg'},
    runTransaction:async(_db,fn)=>{if(stage==='transaction')return gate.promise;let pending;await fn({get:async ref=>({exists:()=>records.has(ref),data:()=>({...records.get(ref)})}),set:(ref,value)=>{pending={ref,value};}});records.set(pending.ref,pending.value);},
    medyaSil:async()=>{},fotoSecicAc:fn=>{select=fn;},showToast:msg=>events.push(msg),
    document:{querySelectorAll:()=>[]},alert:()=>events.push('alert')};
  vm.runInNewContext(helper+'\n'+caller,c);
  c.window.veliFotoDegistir();
  return {c,events,records,select:()=>select(file)};
}
for(const stage of ['compress','upload','transaction']) {
  test(`auth switch suppresses late rejected ${stage} without touching newer account UI`,async()=>{
    const gate=deferred(),f=fixture(stage,gate),pending=f.select();
    await new Promise(setImmediate);
    f.c.portalOturumSurumu++;f.c.currentUser={uid:'second',email:'second@example.invalid'};
    gate.reject(Error('synthetic obsolete operation failure'));
    await pending;
    assert.deepEqual(f.events,['Fotoğraf yükleniyor…']);
  });
}
test('a newer same-target selection suppresses the older rejected upload',async()=>{
  const gate=deferred(),f=fixture('upload',gate),older=f.select();await new Promise(setImmediate);
  f.c.medyaYukle=async()=>({url:'https://example.invalid/newest.jpg',yol:'newest.jpg'});
  f.c.window.veliFotoDegistir();await f.select();
  gate.reject(Error('synthetic obsolete upload failure'));await older;
  assert.equal(f.events.includes('alert'),false);
  assert.equal(f.events.includes('error'),false);
  assert.equal(f.c.window._veliFotoUrl,'https://example.invalid/newest.jpg');
});

test('newer selection during old cleanup keeps newest metadata and never deletes its asset',async()=>{
  const gate=deferred(),f=fixture('',gate),deleted=[];
  f.c.medyaSil=async path=>{deleted.push(path);if(path==='old.jpg')await gate.promise;};
  const older=f.select();await new Promise(setImmediate);
  f.c.medyaYukle=async()=>({url:'https://example.invalid/newest.jpg',yol:'newest.jpg'});
  f.c.window.veliFotoDegistir();await f.select();gate.resolve();await older;
  assert.equal(f.records.get('veliler/first@example.invalid').fotoYol,'newest.jpg');
  assert.deepEqual(deleted,['old.jpg','new.jpg']);
  assert.equal(f.c.window._veliFotoUrl,'https://example.invalid/newest.jpg');
  assert.equal(f.events.includes('alert'),false);
});

test('auth switch while issued cleanup is pending does not update the new account UI',async()=>{
  const gate=deferred(),f=fixture('',gate),deleted=[];
  f.c.medyaSil=async path=>{deleted.push(path);await gate.promise;};
  const pending=f.select();await new Promise(setImmediate);
  f.c.portalOturumSurumu++;f.c.currentUser={uid:'second',email:'second@example.invalid'};
  gate.resolve();await pending;
  assert.deepEqual(deleted,['old.jpg']);
  assert.deepEqual(f.events,['Fotoğraf yükleniyor…']);
  assert.equal(f.c.window._veliFotoUrl,undefined);
});

test('a superseded transaction retry cannot overwrite or delete the newly committed replacement',async()=>{
  const gate=deferred(),f=fixture('',gate),deleted=[];let calls=0,version=0;
  f.c.medyaSil=async path=>{deleted.push(path);};
  f.c.runTransaction=async(_db,fn)=>{
    const readVersion=version;let pending;
    const tx={get:async ref=>({exists:()=>f.records.has(ref),data:()=>({...f.records.get(ref)})}),set:(ref,value)=>{pending={ref,value};}};
    await fn(tx);
    if(++calls===1){await gate.promise;if(readVersion!==version)await fn(tx);}
    f.records.set(pending.ref,pending.value);version++;
  };
  const older=f.select();await new Promise(setImmediate);
  f.c.medyaYukle=async()=>({url:'https://example.invalid/newest.jpg',yol:'newest.jpg'});
  f.c.window.veliFotoDegistir();await f.select();gate.resolve();await older;
  assert.equal(f.records.get('veliler/first@example.invalid').fotoYol,'newest.jpg');
  assert.deepEqual(deleted,['old.jpg']);
  assert.equal(f.c.window._veliFotoUrl,'https://example.invalid/newest.jpg');
  assert.equal(f.events.includes('alert'),false);
});
