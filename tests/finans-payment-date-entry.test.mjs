import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {odemePlani,gecerliTarih} from '../js/finans/core.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const part=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x+a.length);if(x<0||y<0)throw Error('Bulunamayan fonksiyon: '+a);return html.slice(x,y);};
const code=part('window.aylikOdendiIsaretle = ','window.aylikSifirla = ')+
 part('window.aylikToplu = ','window.togglePesin = ');

function setup(promptAnswers=[]){
 const p=[...promptAnswers],messages=[];
 const controls={
   ayarAidat:{value:'31500'},
   ayarTaksit:{value:'10'},
   ayarBaslangic:{value:'2026-09'}
 };
 const context={
  window:{},currentOgrenci:{id:'stu'},ayarListesi:{stu:{aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:10,aylikAidat:31500},aylikOdemeler:{}}},
  prompt:(...args)=>p.shift()??null,confirm:()=>true,renderAylikOdeme:()=>{},showToast:(...args)=>messages.push(args),
  document:{getElementById:id=>controls[id]||null},
  ayBeklenenTutar:()=>31500,ortakOdemePlani:odemePlani,ortakBugun:()=> '2026-10-08',
  ortakGecerliTarih:d=>gecerliTarih(d,new Date('2026-10-08T12:00:00Z')),
  Number,Math
 };
 vm.runInNewContext(code,context);
 return {context,messages,p};
}

test('bulk marks all ten schedule months with the true July payment date, not entry date',()=>{
 const {context}=setup(['2026-07-23','Havale/EFT','BANK-REF-2026']);
 context.window.aylikToplu('tumu');
 const payments=context.ayarListesi.stu.aylikOdemeler;
 const months=Object.keys(payments);
 assert.equal(months.length,10);
 assert.ok(months.every(k=>payments[k].odemeTarihi==='2026-07-23'));
 assert.ok(months.every(k=>payments[k].sistemeGirisTarihi==='2026-10-08'));
 assert.ok(months.every(k=>payments[k].kaynakTahsilatId==='BANK-REF-2026'));
 assert.equal(months.reduce((t,k)=>t+payments[k].odenenTutar,0),315000);
});

test('bulk must not silently overwrite already posted collections',()=>{
 const {context,messages}=setup([]);
 context.ayarListesi.stu.aylikOdemeler['2026-09']={odenenTutar:100,odemeTarihi:'2026-10-01'};
 context.window.aylikToplu('tumu');
 assert.equal(Object.keys(context.ayarListesi.stu.aylikOdemeler).length,1);
 assert.match(messages.at(-1)[0],/mevcut tahsilat/);
});

test('single-month paid mark refuses missing date or existing payment',()=>{
 const {context,messages}=setup(['2026-07-23']);
 context.window.aylikOdendiIsaretle('2026-09');
 assert.equal(context.ayarListesi.stu.aylikOdemeler['2026-09'].odemeTarihi,'2026-07-23');
 context.window.aylikOdendiIsaretle('2026-09');
 assert.match(messages.at(-1)[0],/önceden ödeme/);
});

test('invalid date aborts bulk without changing payment records',()=>{
 const {context,messages}=setup(['2026-99-11']);
 context.window.aylikToplu('tumu');
 assert.equal(Object.keys(context.ayarListesi.stu.aylikOdemeler).length,0);
 assert.match(messages.at(-1)[0],/Geçerli ödeme tarihi/);
});
