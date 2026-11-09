import test from 'node:test';
import assert from 'node:assert/strict';
import {maliKayitImzasi,maliKayitYamasi} from '../js/aidat-mali-kayit.js';
test('financial save retains off-plan collections, fee history and metadata without parent or contract writes',()=>{
 const old={aidatAyarlari:{egitimUcreti:177600},anne:{eposta:'private'},sozlesme:{imza:true}};
 const aylik={'2026-09':{odenenTutar:35000,odemeTarihi:'2026-09-01',hareketler:[{tutar:35000}]},'2026-11':{odenenTutar:37000,odemeTarihi:'2026-11-09'}};
 const diger={egitimMateryali:{odenenTutar:30000,odemeTarihi:'2026-11-09'}};
 const result=maliKayitYamasi(old,{toplamBeklenen:341355},aylik,diger,'bank record');
 assert.deepEqual(Object.keys(result).sort(),['aidatAyarlari','aylikOdemeler','digerOdemeler','notlar']);
 assert.deepEqual(result.aylikOdemeler,aylik);assert.deepEqual(result.digerOdemeler,diger);
 assert.equal(result.aidatAyarlari.egitimUcreti,177600);
 assert.equal(result.aidatAyarlari.toplamOdenen,102000);assert.equal(result.aidatAyarlari.kalan,239355);
});
test('concurrent financial changes are detectable regardless of Firestore key ordering',()=>{
 assert.equal(maliKayitImzasi({aidatAyarlari:{a:1,b:2}}),maliKayitImzasi({aidatAyarlari:{b:2,a:1}}));
 assert.notEqual(maliKayitImzasi({aylikOdemeler:{}}),maliKayitImzasi({aylikOdemeler:{'2026-11':{odenenTutar:37000}}}));
});

import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  if (sadeceAidat === true) {');
const branch=html.slice(start,html.indexOf('  const mevcutDonemDurumu =',start));
for(const mode of ['success','stale','readback']) test(`financial save transaction: ${mode}`,async()=>{
 const old={aidatAyarlari:{aylikAidat:37000},aylikOdemeler:{},digerOdemeler:{}};
 let writes=[],closed=false,message='';
 const ctx=vm.createContext({sadeceAidat:true,currentOgrenci:{id:'student'},AKTIF_DONEM:'2026-2027',db:{},
  aidatIlkImza:maliKayitImzasi(old),maliKayitImzasi,maliKayitYamasi,aidatAyarlari:{toplamBeklenen:296000},
  mevcutAylikOdemeler:{'2026-11':{odenenTutar:37000,odemeTarihi:'2026-11-09'}},mevcutDigerOdemeler:{},notlar:'bank record',
  doc:(_, ...parts)=>parts.join('/'),ayarListesi:{},
  runTransaction:async(_,fn)=>fn({get:async()=>({exists:()=>true,data:()=>mode==='stale'?{...old,notlar:'concurrent'}:old}),update:(ref,data)=>writes.push({ref,data})}),
  getDocFromServer:async()=>({data:()=>mode==='readback'?old:writes[0].data}),
  showToast:m=>message=m,closeAyarModal:()=>closed=true,renderTable:()=>{},updateStats:()=>{}
 });
 await vm.runInContext(`(async()=>{${branch}})()`,ctx);
 assert.equal(writes.length,mode==='stale'?0:1);
 assert.equal(closed,mode==='success');
 if(writes.length){assert.equal(writes[0].ref,'ogrenciler/student/donemler/2026-2027');assert.deepEqual(Object.keys(writes[0].data).sort(),['aidatAyarlari','aylikOdemeler','digerOdemeler','guncellendi','notlar']);}
 assert.match(message,mode==='success'?/sunucuda doğrulandı/:/doğrulanamadı/);
});
