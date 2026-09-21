import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../js/okul-zili-tani.js', import.meta.url), 'utf8');
const {tanila,SURUM} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const fail = code => Object.assign(new Error('PRIVATE RAW SERVER ERROR'),{code});
function fixture(extra={}) {
  const parentEmail = 'private-parent@example.test';
  const user={uid:'private-uid', email:parentEmail, getIdTokenResult:async()=>({claims:{email:parentEmail,email_verified:true,aud:'bcka-site'},token:'PRIVATE-TOKEN'})};
  const child={id:'child-1',ogrenciAdSoyad:'PRIVATE CHILD NAME'};
  const records=new Map(Object.entries({
    'ayarlar/donem':{aktif:'2026-2027'},
    ['veliler/'+parentEmail]:{onaylandi:true,ogrenciIds:['child-1']},
    'ogrenciler/child-1':{ogrenciAdSoyad:'PRIVATE CHILD NAME'},
    ...extra
  }));
  const calls=[];
  const api={app:{options:{projectId:'bcka-site'}},db:{_databaseId:{database:'(default)'}},auth:{currentUser:user},state:{currentUser:user,veliAktifOgrenci:child,aktifDonem:'2026-2027'},fb:{doc:(_,collection,id)=>collection+'/'+id}};
  const read=async path=>{ calls.push(path);const x=records.get(path);if(x instanceof Error) throw x;return {id:path.split('/').at(-1),exists:()=>x!==undefined,data:()=>x};};
  return {api,read,calls,records,user};
}
test('No identity grants are made; only scoped read functions exist',()=>{
 assert.doesNotMatch(source,/\b(setDoc|updateDoc|deleteDoc|writeBatch|runTransaction|signInWithCustomToken)\s*\(/);
 assert.doesNotMatch(source,/console\.(log|warn|error)\s*\(/);
});
test('Successful diagnostic reports current session and linked student without PII',async()=>{
 const x=fixture();const r=await tanila(x.api,x.read,{handler:'Gönderilemedi — ana çıkış kaydı:'});
 assert.equal(r.surum,SURUM);assert.equal(r.seciliKimlikVeliListesinde,true);assert.equal(r.kontroller.ogrenci,'ok');assert.equal(r.calisanGonderici,'module-v140');
 assert.doesNotMatch(JSON.stringify(r),/private-parent|PRIVATE CHILD|private-uid|PRIVATE-TOKEN|PRIVATE RAW/);
});
test('Unauthenticated session performs no reads',async()=>{
 const x=fixture();x.api.auth.currentUser=null;const r=await tanila(x.api,x.read);assert.equal(r.firebaseOturumuVar,false);assert.equal(x.calls.length,0);
});
test('Invalid student ID performs no reads',async()=>{
 const x=fixture();x.api.state.veliAktifOgrenci.id='child/unsafe';await tanila(x.api,x.read);assert.equal(x.calls.length,0);
});
test('Permission denied remains distinct from missing documents and raw errors never leak',async()=>{
 const x=fixture({'ogrenciler/child-1':fail('permission-denied')});const r=await tanila(x.api,x.read);
 assert.equal(r.kontroller.ogrenci,'permission-denied');assert.equal(r.kontroller.kimlik,'missing');assert.equal(r.anaCikisOgrenciEslesiyor,null);assert.doesNotMatch(JSON.stringify(r),/PRIVATE RAW/);
});
test('Can identify a document data.id overriding canonical document ID without modifying it',async()=>{
 const x=fixture({'veliler/private-parent@example.test':{onaylandi:true,ogrenciIds:['canonical']},'ogrenciler/canonical':{id:'child-1',ogrenciAdSoyad:'PRIVATE CHILD NAME'}});
 const r=await tanila(x.api,x.read);assert.equal(r.seciliKimlikVeliListesinde,false);assert.equal(r.idAlaniKaynakKimligiEzmis,true);assert.equal(x.api.state.veliAktifOgrenci.id,'child-1');
});
test('Inactive or conflicting identity is reported but not used to read mapped profile',async()=>{
 const x=fixture({'kullaniciKimlikleri/private-uid':{aktif:false,primaryProfile:'veli',refEmail:'another@example.test'}});
 const r=await tanila(x.api,x.read);assert.equal(r.kimlikPasif,true);assert.equal(x.calls.includes('veliler/another@example.test'),false);
 const y=fixture({'kullaniciKimlikleri/private-uid':{primaryProfile:'veli',refEmail:'another@example.test',profiles:{veli:{refEmail:'different@example.test'}}}});
 const rr=await tanila(y.api,y.read);assert.equal(rr.kimlikEpostaCeliskisi,true);assert.equal(y.calls.includes('veliler/another@example.test'),false);
});
test('Student follow-up reads are capped at eight authorized IDs',async()=>{
 const x=fixture({'veliler/private-parent@example.test':{ogrenciIds:Array.from({length:100},(_,i)=>'child-'+(i+2))}});
 const r=await tanila(x.api,x.read);assert.equal(r.bagliOgrenciKontroluSinirli,true);assert.equal(x.calls.filter(p=>p.startsWith('ogrenciler/')).length,9);
});
test('Session changes abort the report instead of returning another account information',async()=>{
 const x=fixture();const read=async p=>{x.api.auth.currentUser={uid:'other'};return x.read(p);};
 await assert.rejects(()=>tanila(x.api,read),e=>e.code==='diagnostic/session-changed');
});
test('Offline checks time out without retries or writes',async()=>{
 const x=fixture();const r=await tanila(x.api,()=>new Promise(()=>{}),{timeoutMs:10});
 assert.equal(r.kontroller.ogrenci,'diagnostic/timeout');assert.equal(r.kontroller.genelOkuma,'diagnostic/timeout');
});
