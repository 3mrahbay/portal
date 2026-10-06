import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Actual inline function, synthetic files/state only. No storage or Firestore calls.
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('const profilFotoYuklemeIslemleri ='), html.indexOf('// Fotoğrafı kaldır', html.indexOf('async function profilFotoYukle(')));
const file = {name:'synthetic.jpg',type:'image/jpeg',size:1024};
const deferred = () => {let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function fixture(overrides={}) {
  const calls=[], records=new Map([['ogrenciler/child',{fotoUrl:'https://firebasestorage.googleapis.com/v0/b/synthetic/o/old?alt=media&token=synthetic',fotoYol:'old.jpg'}]]);
  const c={Map,Date,Boolean,Error,Object,console:{warn(){}},db:{},portalOturumSurumu:1,currentUser:{uid:'parent',email:'parent@example.invalid'},
    doc:(_db,col,id)=>`${col}/${id}`,
    resimSikistir:async x=>x,
    medyaYukle:async()=>{calls.push('upload');return {url:'https://example.invalid/new.jpg',yol:'new.jpg'};},
    medyaSil:async path=>{calls.push(`delete:${path}`);},
    runTransaction:async(_db,fn)=>{
      let pending;
      await fn({get:async ref=>{calls.push(`read:${ref}`);return {exists:()=>records.has(ref),data:()=>({...records.get(ref)})};},
        set:(ref,value,options)=>{assert.equal(options.merge,true);pending={ref,value};}});
      calls.push(`save:${pending.ref}`);
      records.set(pending.ref,{...records.get(pending.ref),...pending.value});
    },...overrides};
  vm.runInNewContext(source+';this.upload=profilFotoYukle;',c);
  return {c,calls,records,upload:()=>c.upload(file,'ogrenciler','child','ogrenci-foto')};
}
const isCancelled=e=>e.code==='profil-foto-iptal';

test('failed metadata persistence retains old photo reference and never deletes storage',async()=>{
  const f=fixture({runTransaction:async()=>{throw Error('synthetic permission-denied');}});
  const before={...f.records.get('ogrenciler/child')};
  await assert.rejects(f.upload(),/permission-denied/);
  assert.deepEqual(f.records.get('ogrenciler/child'),before);
  assert.deepEqual(f.calls,['upload']);
});
test('new profile metadata commits before old asset cleanup',async()=>{
  const f=fixture();assert.equal(await f.upload(),'https://example.invalid/new.jpg');
  assert.deepEqual(f.calls,['upload','read:ogrenciler/child','save:ogrenciler/child','delete:old.jpg']);
  assert.equal(f.records.get('ogrenciler/child').fotoYol,'new.jpg');
});
test('cleanup failure does not undo the successfully saved profile',async()=>{
  const f=fixture({medyaSil:async()=>{throw Error('synthetic cleanup offline');}});
  assert.equal(await f.upload(),'https://example.invalid/new.jpg');
  assert.equal(f.records.get('ogrenciler/child').fotoYol,'new.jpg');
});
test('same asset path and absent old path never trigger storage deletion',async()=>{
  for(const prior of [{fotoYol:'new.jpg'},{fotoUrl:'https://firebasestorage.googleapis.com/v0/b/synthetic/o/legacy?alt=media&token=synthetic'}]){
    const f=fixture();f.records.set('ogrenciler/child',prior);await f.upload();
    assert.equal(f.calls.some(x=>x.startsWith('delete:')),false);
  }
});
test('no signed-in user causes no compression, upload, persistence or cleanup',async()=>{
  const f=fixture({currentUser:null,resimSikistir:async()=>{throw Error('must not compress');}});
  await assert.rejects(f.upload(),isCancelled);assert.deepEqual(f.calls,[]);
});
test('auth epoch change during compression stops before upload',async()=>{
  const gate=deferred();const f=fixture({resimSikistir:()=>gate.promise});const pending=f.upload();
  f.c.portalOturumSurumu++;gate.resolve(file);await assert.rejects(pending,isCancelled);assert.deepEqual(f.calls,[]);
});
test('account replacement during upload prevents any metadata write or deletion',async()=>{
  const gate=deferred();const f=fixture({medyaYukle:()=>gate.promise});const pending=f.upload();
  await Promise.resolve();f.c.currentUser={uid:'other',email:'other@example.invalid'};
  gate.resolve({url:'https://example.invalid/new.jpg',yol:'new.jpg'});
  await assert.rejects(pending,isCancelled);assert.deepEqual(f.calls,[]);
});
test('auth change while transaction reads prevents its write and cleanup',async()=>{
  const f=fixture();f.c.runTransaction=async(_db,fn)=>fn({get:async()=>{
    f.c.portalOturumSurumu++;return {exists:()=>true,data:()=>({fotoYol:'old.jpg'})};
  },set:()=>{throw Error('must not write');}});
  await assert.rejects(f.upload(),isCancelled);assert.deepEqual(f.calls,['upload']);
});
test('newer replacement of the same target wins over an older pending upload',async()=>{
  const gate=deferred();const f=fixture();let n=0;
  f.c.medyaYukle=async()=>++n===1?gate.promise:{url:'https://example.invalid/second.jpg',yol:'second.jpg'};
  const older=f.upload();const cancelled=assert.rejects(older,isCancelled);await new Promise(setImmediate);const newer=f.upload();
  assert.equal(await newer,'https://example.invalid/second.jpg');
  gate.resolve({url:'https://example.invalid/first.jpg',yol:'first.jpg'});
  await cancelled;
  assert.equal(f.records.get('ogrenciler/child').fotoYol,'second.jpg');
  assert.deepEqual(f.calls,['read:ogrenciler/child','save:ogrenciler/child','delete:old.jpg']);
});
test('independent profile targets do not cancel each other or change the captured target',async()=>{
  const gate=deferred();const f=fixture();let n=0;
  f.c.medyaYukle=async()=>++n===1?gate.promise:{url:'https://example.invalid/other.jpg',yol:'other.jpg'};
  const first=f.upload();await Promise.resolve();
  await f.c.upload(file,'ogrenciler','other','ogrenci-foto');
  gate.resolve({url:'https://example.invalid/new.jpg',yol:'new.jpg'});await first;
  assert.equal(f.records.get('ogrenciler/child').fotoYol,'new.jpg');
  assert.equal(f.records.get('ogrenciler/other').fotoYol,'other.jpg');
});
test('transaction retry cleans up only the old path from the successful read',async()=>{
  const f=fixture();const transaction=f.c.runTransaction;
  f.c.runTransaction=async(db,fn)=>{
    await fn({get:async()=>({exists:()=>true,data:()=>({fotoYol:'stale.jpg'})}),set(){}});
    f.records.set('ogrenciler/child',{fotoYol:'concurrent.jpg'});
    return transaction(db,fn);
  };
  await f.upload();assert.equal(f.calls.at(-1),'delete:concurrent.jpg');
  assert.equal(f.calls.includes('delete:stale.jpg'),false);
});
test('auth change after commit stops old cleanup and suppresses stale caller success',async()=>{
  const f=fixture();const transaction=f.c.runTransaction;
  f.c.runTransaction=async(...args)=>{await transaction(...args);f.c.portalOturumSurumu++;};
  await assert.rejects(f.upload(),isCancelled);
  assert.equal(f.calls.some(x=>x.startsWith('delete:')),false);
  assert.equal(f.records.get('ogrenciler/child').fotoYol,'new.jpg');
});
test('canceled profile operations cannot show errors in a newer account UI',()=>{
  for(const marker of ['öğrenci fotoğrafı','veli fotoğrafı','çocuk fotoğrafı'])
    assert.ok(html.includes(`if (e?.code === "profil-foto-iptal") return;\n      console.error("${marker}"`));
});

const callers=[['ogrenciFotoDegistir','window.ogrenciFotoKaldir'],['veliFotoDegistir','window.veliFotoKaldir'],['veliCocukFotoDegistir','function caProfilHTML']];
function callerFixture(name,end,upload) {
  let callback;const events=[];
  const c={window:{},currentUser:{email:'synthetic@example.invalid'},portalOturumSurumu:1,
    fotoSecicAc:fn=>{callback=fn;},profilFotoYukle:upload,
    showToast:()=>events.push('toast'),document:{querySelectorAll:()=>{events.push('ui');return[];}},
    console:{error:()=>events.push('error')},alert:()=>events.push('alert')};
  const start=html.indexOf(`window.${name} =`);
  vm.runInNewContext(html.slice(start,html.indexOf(end,start)),c);c.window[name]('child');
  return {c,events,select:()=>callback(file)};
}
test('auth change while any profile file picker is open cancels the captured-target action',async()=>{
  for(const [name,end] of callers){let uploads=0;const f=callerFixture(name,end,async()=>{uploads++;});
    f.c.portalOturumSurumu++;await f.select();assert.equal(uploads,0);assert.deepEqual(f.events,[]);}
});
test('profile caller does not update a newer account UI if auth changes before its await resumes',async()=>{
  for(const [name,end] of callers){const gate=deferred();const f=callerFixture(name,end,()=>gate.promise);
    const pending=f.select();f.c.portalOturumSurumu++;gate.resolve('https://example.invalid/new.jpg');await pending;
    assert.deepEqual(f.events,['toast']);assert.equal(f.c.window._veliFotoUrl,undefined);}
});

// Independent-review regression cases exercise actual caller error handling.
{
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
for(const stage of ['compress','upload','transaction']) test(`a newer same-target selection suppresses the older rejected ${stage}`,async()=>{
  const gate=deferred(),f=fixture(stage,gate),older=f.select();await new Promise(setImmediate);
  f.c.resimSikistir=async x=>x;
  f.c.runTransaction=async(_db,fn)=>{let pending;await fn({get:async ref=>({exists:()=>f.records.has(ref),data:()=>({...f.records.get(ref)})}),set:(ref,value)=>{pending={ref,value};}});f.records.set(pending.ref,pending.value);};
  f.c.medyaYukle=async()=>({url:'https://example.invalid/newest.jpg',yol:'newest.jpg'});
  f.c.window.veliFotoDegistir();await f.select();
  gate.reject(Error('synthetic obsolete upload failure'));await older;
  assert.equal(f.events.includes('alert'),false);
  assert.equal(f.events.includes('error'),false);
  assert.equal(f.c.window._veliFotoUrl,'https://example.invalid/newest.jpg');
});

test('current-session rejected upload still reports its real error and retains the old photo',async()=>{
  const gate=deferred(),f=fixture('upload',gate),pending=f.select();await new Promise(setImmediate);
  gate.reject(Error('synthetic current-session upload failure'));await pending;
  assert.equal(f.events.includes('alert'),true);assert.equal(f.events.includes('error'),true);
  assert.equal(f.records.get('veliler/first@example.invalid').fotoYol,'old.jpg');
});
}
