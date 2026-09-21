import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../js/sabah-giris-kaydi.js',import.meta.url),'utf8');
const {sabahGirisKaydet}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const fail=code=>Object.assign(new Error(code),{code});
function fixture({existing=null, primaryReadError=null, primaryWriteError=null, projectionReadError=null, projectionExists=false}={}) {
 const calls=[],writes=[],user={uid:'test-uid',email:'parent@example.test'};
 const api={auth:{currentUser:user},state:{currentUser:user,veliAktifOgrenci:{id:'child-A',ogrenciAdSoyad:'Child A',sinif:'New Class'},ayarListesi:{}},db:{},bugun:()=> '2026-09-21'};
 const projection=p=>p.startsWith('danismaSabahGirisleri/');
 api.fb={doc:(_,c,id)=>c+'/'+id,serverTimestamp:()=> 'SERVER_TIMESTAMP',
  async getDoc(p){calls.push(['get',p]);const error=projection(p)?projectionReadError:primaryReadError;if(error)throw fail(error);const data=projection(p)?(projectionExists?{ogrenciId:'child-A'}:null):existing;return {exists:()=>data!==null,data:()=>data};},
  async setDoc(p,d,o){calls.push(['set',p]);if(!projection(p)&&primaryWriteError)throw fail(primaryWriteError);writes.push({method:'set',path:p,data:d,options:o});},
  async updateDoc(p,d){calls.push(['update',p]);if(!projection(p)&&primaryWriteError)throw fail(primaryWriteError);writes.push({method:'update',path:p,data:d});}
 };
 return {api,calls,writes};
}
test('Morning first write is acknowledged even when reception GET is denied',async()=>{
 const x=fixture({primaryReadError:'permission-denied',projectionReadError:'permission-denied'});
 const r=await sabahGirisKaydet(x.api);
 assert.equal(r.anaKayitKaydedildi,true);assert.equal(r.danismaAktarildi,false);assert.equal(r.danismaHataKodu,'permission-denied');
 assert.equal(x.writes.length,1);assert.equal(x.writes[0].path,'sabahGirisleri/child-A__2026-09-21');
 assert.ok(x.calls.findIndex(c=>c[0]==='set')<x.calls.findIndex(c=>c[1].startsWith('danisma')));
});
test('Existing day updates only four parent fields and retains class metadata',async()=>{
 const x=fixture({existing:{ogrenciId:'child-A',ogrenciAd:'Original',sinif:'Original Class',tarih:'2026-09-21'}});
 await sabahGirisKaydet(x.api);assert.equal(x.writes[0].method,'update');
 assert.deepEqual(Object.keys(x.writes[0].data).sort(),['guncellendi','veliBildirdi','veliBildirimSaati','veliBildirenEmail'].sort());
});
test('Primary write denial never produces success or touches reception',async()=>{
 const x=fixture({primaryWriteError:'permission-denied'});
 await assert.rejects(()=>sabahGirisKaydet(x.api),e=>e.code==='permission-denied');assert.equal(x.calls.some(c=>c[1]?.startsWith('danisma')),false);
});
test('Unknown/offline primary read is not silently treated as a missing document',async()=>{
 const x=fixture({primaryReadError:'unavailable'});await assert.rejects(()=>sabahGirisKaydet(x.api),e=>e.code==='unavailable');assert.equal(x.writes.length,0);
});
test('Successful projection excludes parent e-mail and staff confirmation fields',async()=>{
 const x=fixture();const r=await sabahGirisKaydet(x.api);assert.equal(r.danismaAktarildi,true);
 const d=x.writes[1].data;assert.equal('veliBildirenEmail' in d,false);assert.equal('sinifaGirisOnayi' in d,false);assert.equal('onaylayan' in d,false);
});
test('Existing projection changes only notice fields, not admission confirmation',async()=>{
 const x=fixture({projectionExists:true});await sabahGirisKaydet(x.api);assert.equal(x.writes[1].method,'update');
 assert.deepEqual(Object.keys(x.writes[1].data).sort(),['veliBildirdi','veliBildirimSaati','guncellendi'].sort());
});
test('Missing or mismatched Firebase session performs no writes',async()=>{
 for(const mode of ['missing','mismatch']){const x=fixture();if(mode==='missing')x.api.auth.currentUser=null;else x.api.auth.currentUser={uid:'other',email:'other@example.test'};await assert.rejects(()=>sabahGirisKaydet(x.api));assert.equal(x.calls.length,0);}
});
test('Changing selected student during read aborts before write',async()=>{
 const x=fixture();const read=x.api.fb.getDoc;x.api.fb.getDoc=async p=>{const r=await read(p);x.api.state.veliAktifOgrenci={id:'child-B'};return r;};
 await assert.rejects(()=>sabahGirisKaydet(x.api),e=>e.code==='sabah/session-changed');assert.equal(x.writes.length,0);
});
test('Existing document for a different child cannot be rewritten',async()=>{
 const x=fixture({existing:{ogrenciId:'child-B'}});await assert.rejects(()=>sabahGirisKaydet(x.api),e=>e.code==='sabah/student-mismatch');assert.equal(x.writes.length,0);
});
test('A completed admission is not announced again or reset',async()=>{
 const x=fixture({existing:{ogrenciId:'child-A',sinifaGirisOnayi:'2026-09-21T06:00:00Z'}});const r=await sabahGirisKaydet(x.api);assert.equal(r.zatenTeslimAlindi,true);assert.equal(x.writes.length,0);
});
