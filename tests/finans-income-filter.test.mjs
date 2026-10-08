import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const s=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=(a,b)=>{
  const x=s.indexOf(a);const y=s.indexOf(b,x+a.length);
  if(x<0||y<0)throw Error('Gelir filtre fonksiyonu eksik: '+a);
  return s.slice(x,y);
};
const code=extract('function finansFiltreleByView(','window.finansSetView = ')+'\n'+extract('function seciliFinansGelirleri()','function renderFinansGelirler()')+'\nthis.runFilter=seciliFinansGelirleri;';
class FakeDate extends Date {constructor(...args){super(...(args.length?args:['2026-10-08T12:00:00Z']));}}
const context={Date:FakeDate,aktifFinansView:'buAy',aktifGelirFilter:'aylik',finansalGelirler:[
 {tur:'aylik',odemeTarihi:'2026-10-08',odenen:31500},
 {tur:'diger',odemeTarihi:'2026-10-08',odenen:9555},
 {tur:'aylik',odemeTarihi:'2026-07-23',odenen:31500}
]};
vm.runInNewContext(code,context);
test('October income category filter removes extras and July cash',()=>{
 const a=context.runFilter();
 assert.equal(a.length,1);
 assert.equal(a[0].odenen,31500);
 context.aktifFinansView='tumu';
 assert.equal(context.runFilter().length,2);
 context.aktifGelirFilter='hepsi';
 assert.equal(context.runFilter().length,3);
});
test('the same filter is used for on-screen list and Excel export',()=>{
 const table=extract('function renderFinansGelirler()','window.gelirlerExcel = ');
 const excel=extract('window.gelirlerExcel = ','window.giderFilter = ');
 assert.match(table,/const liste = seciliFinansGelirleri\(\)/);
 assert.match(excel,/const liste = seciliFinansGelirleri\(\)/);
 assert.match(excel,/Aidatın Ait Olduğu Ay/);
 assert.match(excel,/Gerçek Tahsilat Tarihi/);
 assert.match(excel,/Banka\/Havale Referansı/);
});
