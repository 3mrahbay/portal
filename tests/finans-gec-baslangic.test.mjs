import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
for(const [start,duration,count,last] of [['2026-11',8,8,'2027-06'],['2026-10',9,9,'2027-06'],['2026-09',10,10,'2027-06'],['2026-11',10,10,'2027-08'],['2027-01',1,1,'2027-01']]){
 test(`monthly cards agree with actual plan: ${start}, attendance duration ${duration}`,()=>{
  const elements={aylikGrid:{},ayarAidat:{value:'37000'},ayarTaksit:{value:String(duration)},ayarBaslangic:{value:start},ayarPesin:{checked:false},ayarOnOdeme:{value:'0'}};
  let summary;
  const ctx=vm.createContext({AY_ISIMLERI:['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],document:{getElementById:id=>elements[id]},AKTIF_DONEM:'2026-2027',currentOgrenci:{id:'student'},ayarListesi:{student:{aidatAyarlari:{},aylikOdemeler:{}}},getOdemeDurumu:()=> 'bekliyor',finansTarihGoster:()=>'',updateAylikOzet:(...v)=>summary=v});
  vm.runInContext(slice('function getAyListesi(', 'function getOdemeDurumu(')+slice('function getDonemSonu(', '// Ay adı yazdırma')+slice('function renderAylikOdeme()', 'function updateAylikOzet('),ctx);
  vm.runInContext('renderAylikOdeme()',ctx);
  const codes=[...elements.aylikGrid.innerHTML.matchAll(/data-ay-kod="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(codes.length,count);assert.equal(codes[0],start);assert.equal(codes.at(-1),last);assert.equal(summary[1],37000*count);
 });
}

 test('legacy plans round-trip without changing duration or end month',()=>{
  const ctx=vm.createContext({AKTIF_DONEM:'2026-2027'});
  vm.runInContext(slice('function getDonemSonu(', '// Ay adı yazdırma'),ctx);
  for(const [start,stored,actual] of [['2026-09',10,10],['2026-10',10,9],['2026-11',10,8],['2026-11',12,10],['2027-01',5,1]]){
   assert.equal(ctx.getGercekOdemeSayisi(start,stored),actual);
   assert.equal(ctx.getKayitDonemUzunlugu(start,actual),stored);
  }
 });
