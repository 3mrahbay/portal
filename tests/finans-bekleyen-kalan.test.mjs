import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('window.bekleyenOdemeleriRender = function()'), html.indexOf('// Ödendi işaretle →'));
function render(payments, settings = {}) {
  const el = {innerHTML:''};
  const ayarListesi = {fixture:{aidatAyarlari:{baslangicAyi:'2026-09',iDonemAylik:31500,...settings},aylikOdemeler:payments}};
  const before = JSON.stringify(ayarListesi);
  const ctx = vm.createContext({window:{},document:{getElementById:id=>id==='bekleyenOdemelerIcerik'?el:null},ogrenciList:[{id:'fixture',ogrenciAdSoyad:'Test Öğrenci'}],ayarListesi,getOgrenciDurum:()=> 'aktif',getAyListesi:()=>[{ayKod:'2026-09',tam:'Eylül 2026'},{ayKod:'2099-01',tam:'Ocak 2099'}],Date:class extends Date {constructor(...args){super(...(args.length?args:['2026-10-14T12:00:00Z']));}}});
  vm.runInContext(source,ctx);ctx.window.bekleyenOdemeleriRender();
  assert.equal(JSON.stringify(ayarListesi),before,'Rendering must not mutate payments');
  return el.innerHTML;
}
test('partial monthly balance is used for row, total and reminder, preserving full settlement target',()=>{
 const out=render({'2026-09':{beklenenTutar:31500,odenenTutar:12000,odendi:false}});
 assert.equal((out.match(/19\.500 ₺/g)||[]).length,2);
 assert.match(out,/bekleyenHatirlat\('fixture','Eylül 2026',19500\)/);
 assert.match(out,/bekleyenOdendiYap\('fixture','2026-09',31500\)/);
 assert.doesNotMatch(out,/2099/);
});
test('partial advance and per-cell expected amount are respected',()=>{
 const out=render({__onOdeme:{beklenenTutar:28000,odenenTutar:10000},'2026-09':{odendi:true}},{onOdeme:37000});
 assert.equal((out.match(/18\.000 ₺/g)||[]).length,2);
});
test('fully paid, overpaid and explicitly zero expected balances are excluded',()=>{
 for(const cell of [{beklenenTutar:31500,odenenTutar:31500},{beklenenTutar:31500,odenenTutar:35000},{beklenenTutar:0},{odendi:true}]) assert.match(render({'2026-09':cell}),/Bekleyen ödeme yok/);
});
test('unpaid legacy installment retains expected amount',()=>{
 assert.equal((render({}).match(/31\.500 ₺/g)||[]).length,2);
});
