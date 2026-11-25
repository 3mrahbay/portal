import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {educationReadScope,createEducationReader,watchEducationRecords} from '../js/egitim-gelisim-okuma.mjs';
const base=()=>({currentUser:{uid:'teacher',email:'t@example.test'},rol:'ogretmen',personel:{sinifAtamalari:['Class A']},ogrenciVerileriHazirMi:true,galeriOturumSurumu:1,aktifDonem:'2026-2027',ogrenciList:[{id:'a',sinif:'Class A'},{id:'b',sinif:'Class B'},{id:'period',sinif:''}],ayarListesi:{period:{kayit:{sinif:'Class A'}}}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
test('teacher and branch scope uses exact main/period class and preserves document IDs',()=>{
 for(const rol of ['ogretmen','yardimci_ogretmen','ingilizce_ogretmeni','brans_ogretmeni']) assert.deepEqual(educationReadScope({...base(),rol}).ids,['a','period']);
 assert.deepEqual(educationReadScope({...base(),rol:'mudur'}).ids,['a','b','period']);
 const s=base();s.personel.sinifAtamalari=['Class'];assert.equal(educationReadScope(s).ids.length,0);
 s.personel.sinifAtamalari=[];s.personel.siniflar=['Class A'];assert.throws(()=>educationReadScope(s));
});
test('missing session, unready students and unsupported role fail closed',()=>{
 for(const extra of [{currentUser:null},{ogrenciVerileriHazirMi:false},{rol:'muhasebe'}])assert.throws(()=>educationReadScope({...base(),...extra}));
});
test('teacher reads individual documents and preserves STU keys; no collection query',async()=>{
 const reads=[];const reader=createEducationReader({scope:()=>educationReadScope(base()),readAll:()=>assert.fail('collection'),readOne:async id=>{reads.push(id);return id==='a'?{montessori:{kayitlar:{'practical__Ön Çalışmalar__Kaşıklama 1':'U'}}}:null}});
 const result=await reader.read();assert.equal(result.a.montessori.kayitlar['practical__Ön Çalışmalar__Kaşıklama 1'],'U');assert.deepEqual(reads.sort(),['a','period']);assert.equal(result.period,undefined);
});
test('concurrent reads share one request, cache expires and invalidation forces new read',async()=>{
 let calls=0,time=0;const d=deferred(),s={...base(),rol:'mudur'};
 const reader=createEducationReader({scope:()=>educationReadScope(s),readAll:async()=>{calls++;return d.promise},now:()=>time});
 const a=reader.read(),b=reader.read();d.resolve({a:{}});await Promise.all([a,b]);assert.equal(calls,1);
 await reader.read();assert.equal(calls,1);time=300001;await reader.read();assert.equal(calls,2);reader.invalidate();await reader.read();assert.equal(calls,3);
});
test('permission/offline failures propagate even with a previous good cache; retry recovers',async()=>{
 let fail=false;const reader=createEducationReader({scope:()=>educationReadScope({...base(),rol:'mudur'}),readAll:async()=>{if(fail)throw Object.assign(Error('denied'),{code:'permission-denied'});return {a:{S:true}}}});
 await reader.read();fail=true;await assert.rejects(reader.read(true),/denied/);fail=false;assert.deepEqual(await reader.read(true),{a:{S:true}});
});
test('account or class change and invalidation discard in-flight data',async()=>{
 for(const change of ['account','class','invalidate']){
 let s=base();const d=deferred();const reader=createEducationReader({scope:()=>educationReadScope(s),readOne:()=>d.promise});const p=reader.read();
 if(change==='account')s={...s,currentUser:{uid:'new'}};if(change==='class')s.personel={sinifAtamalari:['Class B']};if(change==='invalidate')reader.invalidate();
 d.resolve({montessori:{}});await assert.rejects(p,{name:'AbortError'});
 }
});
test('listener publishes only complete scoped snapshots, stops on error and ignores late events',()=>{
 const callbacks={},values=[],errors=[];let stops=0,active=true;
 const stop=watchEducationRecords({target:educationReadScope(base()),current:()=>active,listenAll:()=>assert.fail(),listenOne:(id,next,error)=>{callbacks[id]={next,error};return()=>stops++},update:x=>values.push(x),error:e=>errors.push(e)});
 callbacks.a.next({S:1});assert.equal(values.length,0);callbacks.period.next(null);assert.deepEqual(values,[{a:{S:1}}]);
 callbacks.a.error(Error('denied'));assert.equal(stops,2);callbacks.a.next({S:2});assert.equal(values.length,1);assert.equal(errors.length,1);stop();assert.equal(stops,2);
});
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function functionSource(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))}
test('matrix click cannot write while loading/error, with stale scope, or as branch teacher',async()=>{
 const code=functionSource('const egitimBekleyenHucreler','// ============ ÖĞRENCİ FOTOĞRAF YÖNETİMİ');
 for(const ready of [false,true]){
 const ctx={window:{PortalAPI:{state:{rol:'brans_ogretmeni'}}},Set,egitimOkumaHazirMi:()=>ready,egitimMatrixVerisi:{ogrenciler:[{id:'a'}]},showToast(){},gelisimDersGuncelle(){assert.fail('write')}};
 vm.createContext(ctx);vm.runInContext(code,ctx);await ctx.window.matrixHucreTikla('a','area','group','lesson',null);
 }
});
test('failed matrix load shows retry and no zero percent',()=>{
 const elements={egitimMatrixWrap:{},egitimSeciciBilgi:{}};
 const ctx={document:{getElementById:id=>elements[id]}};vm.createContext(ctx);
 vm.runInContext(functionSource('function egitimOkumaMesaji','function egitimOkumaHatasi')+';egitimOkumaMesaji(true)',ctx);
 assert.match(elements.egitimMatrixWrap.innerHTML,/role="alert"/);assert.match(elements.egitimMatrixWrap.innerHTML,/Yeniden dene/);assert.doesNotMatch(elements.egitimSeciciBilgi.textContent,/%0/);
});
test('transaction refuses stale STU cycle before writes and preserves other keys',async()=>{
 const code=functionSource('async function gelisimDersGuncelle','// Disipline özel öğretmen notu');let writes=0;
 const ctx={portalOturumSurumu:1,currentUser:{uid:'x',email:'x@test'},db:{},doc:()=>({}),serverTimestamp:()=>0,console:{error(){}},tumGelisimOnbelleginiTemizle(){},runTransaction:async(db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>({montessori:{kayitlar:{'a__g__d':'U',other:'T'}}})}),set:()=>writes++})};
 vm.createContext(ctx);vm.runInContext(code,ctx);assert.equal(await ctx.gelisimDersGuncelle('a','montessori','a','g','d','S',''),false);assert.equal(writes,0);
});
