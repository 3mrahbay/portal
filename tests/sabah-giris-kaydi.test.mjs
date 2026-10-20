import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sabahGirisKaydet } from '../js/sabah-giris-kaydi.js';
const fail=code=>Object.assign(new Error(code),{code});
function fixture(t, {existing=null, primaryReadError=null, primaryWriteError=null, projectionReadError=null, projectionExists=false, projectionWriteError=null}={}) {
 const calls=[],writes=[],user={uid:'test-uid',email:'parent@example.test'};
 // Scope the stub to this test so the real push bridge never reaches the network.
 const push=t.mock.method(globalThis,'fetch',async (_url,options)=>{
  calls.push(['push',JSON.parse(options.body).kayitId]);
  return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,sonuclar:[{ok:true}]})};
 });
 const api={auth:{currentUser:user},state:{currentUser:user,veliAktifOgrenci:{id:'child-A',ogrenciAdSoyad:'Child A',sinif:'New Class'},ayarListesi:{}},db:{},bugun:()=> '2026-09-21'};
 const projection=p=>p.startsWith('danismaSabahGirisleri/');
 api.fb={doc:(_,c,id)=>c+'/'+id,serverTimestamp:()=> 'SERVER_TIMESTAMP',
  async getDoc(p){calls.push(['get',p]);const error=projection(p)?projectionReadError:primaryReadError;if(error)throw fail(error);const data=projection(p)?(projectionExists?{ogrenciId:'child-A'}:null):existing;return {exists:()=>data!==null,data:()=>data};},
  async setDoc(p,d,o){calls.push(['set',p]);if(!projection(p)&&primaryWriteError)throw fail(primaryWriteError);if(projection(p)&&projectionWriteError)throw fail(projectionWriteError);writes.push({method:'set',path:p,data:d,options:o});},
  async updateDoc(p,d){calls.push(['update',p]);if(!projection(p)&&primaryWriteError)throw fail(primaryWriteError);writes.push({method:'update',path:p,data:d});}
 };
 return {api,calls,writes,push};
}
function assertPushAfterWrites(x) {
 assert.equal(x.push.mock.callCount(),1);
 const [,options]=x.push.mock.calls[0].arguments;
 assert.equal(options.method,'POST');
 assert.deepEqual(JSON.parse(options.body),{olay:'sabah-yeni',kayitId:'child-A__2026-09-21',idToken:''});
 assert.deepEqual(x.calls.at(-1),['push','child-A__2026-09-21']);
 assert.ok(x.calls.slice(0,-1).some(c=>['set','update'].includes(c[0])&&c[1].startsWith('sabahGirisleri/')));
}
test('Parent never reads the staff-only reception copy; the copy is written blind with merge',async t=>{
 // Live rules deny every parent GET on danismaSabahGirisleri. The old flow read
 // first, was always denied and never wrote the copy (reception saw no name).
 const x=fixture(t, {primaryReadError:'permission-denied',projectionReadError:'permission-denied'});
 const r=await sabahGirisKaydet(x.api);
 assert.equal(r.anaKayitKaydedildi,true);assert.equal(r.danismaAktarildi,true);assert.equal(r.danismaHataKodu,'');
 assert.equal(x.calls.some(c=>c[0]==='get'&&c[1].startsWith('danisma')),false);
 assert.equal(x.writes.length,2);assert.equal(x.writes[0].path,'sabahGirisleri/child-A__2026-09-21');
 assert.equal(x.writes[1].path,'danismaSabahGirisleri/child-A__2026-09-21');assert.deepEqual(x.writes[1].options,{merge:true});
 assert.equal(x.writes[1].data.ogrenciAd,'Child A');assert.equal(x.writes[1].data.sinif,'New Class');
 assert.ok(x.calls.findIndex(c=>c[0]==='set')<x.calls.findIndex(c=>c[1].startsWith('danisma')));
 assertPushAfterWrites(x);
});
test('A denied reception write is reported separately and never undoes the primary notice',async t=>{
 const x=fixture(t, {projectionWriteError:'permission-denied'});
 const r=await sabahGirisKaydet(x.api);
 assert.equal(r.anaKayitKaydedildi,true);assert.equal(r.danismaAktarildi,false);assert.equal(r.danismaHataKodu,'permission-denied');
 assert.equal(x.writes.length,1);assertPushAfterWrites(x);
});
test('Existing day updates only four parent fields and retains class metadata',async t=>{
 const x=fixture(t, {existing:{ogrenciId:'child-A',ogrenciAd:'Original',sinif:'Original Class',tarih:'2026-09-21'}});
 await sabahGirisKaydet(x.api);assert.equal(x.writes[0].method,'update');
 assert.deepEqual(Object.keys(x.writes[0].data).sort(),['guncellendi','veliBildirdi','veliBildirimSaati','veliBildirenEmail'].sort());
 assertPushAfterWrites(x);
});
test('Primary write denial never produces success or touches reception',async t=>{
 const x=fixture(t, {primaryWriteError:'permission-denied'});
 await assert.rejects(()=>sabahGirisKaydet(x.api),e=>e.code==='permission-denied');assert.equal(x.calls.some(c=>c[1]?.startsWith('danisma')),false);assert.equal(x.push.mock.callCount(),0);
});
test('Unknown/offline primary read is not silently treated as a missing document',async t=>{
 const x=fixture(t, {primaryReadError:'unavailable'});await assert.rejects(()=>sabahGirisKaydet(x.api),e=>e.code==='unavailable');assert.equal(x.writes.length,0);assert.equal(x.push.mock.callCount(),0);
});
test('Successful projection excludes parent e-mail and staff confirmation fields',async t=>{
 const x=fixture(t);const r=await sabahGirisKaydet(x.api);assert.equal(r.danismaAktarildi,true);
 const d=x.writes[1].data;assert.equal('veliBildirenEmail' in d,false);assert.equal('sinifaGirisOnayi' in d,false);assert.equal('onaylayan' in d,false);
 assertPushAfterWrites(x);
});
test('Reception copy carries only parent-permitted fields; staff fields are left to merge',async t=>{
 const x=fixture(t, {projectionExists:true});await sabahGirisKaydet(x.api);assert.equal(x.writes[1].method,'set');
 assert.deepEqual(x.writes[1].options,{merge:true});
 assert.deepEqual(Object.keys(x.writes[1].data).sort(),['guncellendi','ogrenciAd','ogrenciId','sinif','tarih','veliBildirdi','veliBildirimSaati'].sort());
 assertPushAfterWrites(x);
});
test('Empty name or class is never sent, so an existing reception value is not erased',async t=>{
 const x=fixture(t, {existing:{ogrenciId:'child-A',ogrenciAd:'',sinif:'',tarih:'2026-09-21'}});
 x.api.state.veliAktifOgrenci={id:'child-A'};
 await sabahGirisKaydet(x.api);
 assert.equal('ogrenciAd' in x.writes[1].data,false);assert.equal('sinif' in x.writes[1].data,false);
});
test('Existing primary name is preferred for the reception copy',async t=>{
 const x=fixture(t, {existing:{ogrenciId:'child-A',ogrenciAd:'Original',sinif:'Original Class',tarih:'2026-09-21'}});
 await sabahGirisKaydet(x.api);
 assert.equal(x.writes[1].data.ogrenciAd,'Original');assert.equal(x.writes[1].data.sinif,'Original Class');
});
test('Missing or mismatched Firebase session performs no writes',async t=>{
 for(const mode of ['missing','mismatch']){const x=fixture(t);if(mode==='missing')x.api.auth.currentUser=null;else x.api.auth.currentUser={uid:'other',email:'other@example.test'};await assert.rejects(()=>sabahGirisKaydet(x.api));assert.equal(x.calls.length,0);assert.equal(x.push.mock.callCount(),0);}
});
test('Changing selected student during read aborts before write',async t=>{
 const x=fixture(t);const read=x.api.fb.getDoc;x.api.fb.getDoc=async p=>{const r=await read(p);x.api.state.veliAktifOgrenci={id:'child-B'};return r;};
 await assert.rejects(()=>sabahGirisKaydet(x.api),e=>e.code==='sabah/session-changed');assert.equal(x.writes.length,0);assert.equal(x.push.mock.callCount(),0);
});
test('Existing document for a different child cannot be rewritten',async t=>{
 const x=fixture(t, {existing:{ogrenciId:'child-B'}});await assert.rejects(()=>sabahGirisKaydet(x.api),e=>e.code==='sabah/student-mismatch');assert.equal(x.writes.length,0);assert.equal(x.push.mock.callCount(),0);
});
test('A completed admission is not announced again or reset',async t=>{
 const x=fixture(t, {existing:{ogrenciId:'child-A',sinifaGirisOnayi:'2026-09-21T06:00:00Z'}});const r=await sabahGirisKaydet(x.api);assert.equal(r.zatenTeslimAlindi,true);assert.equal(x.writes.length,0);assert.equal(x.push.mock.callCount(),0);
});
