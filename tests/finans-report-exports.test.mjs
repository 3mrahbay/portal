import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {odemePlani} from '../js/finans/core.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const take=(start,end)=>{const i=html.indexOf(start),j=html.indexOf(end,i+start.length);if(i<0||j<0)throw Error('Function not found: '+start);return html.slice(i,j);};
const names=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const data={
  aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:2,aylikAidat:100},
  aylikOdemeler:{
    '2026-09':{odenenTutar:50,odemeTarihi:'2026-07-23'},
    '2026-10':{beklenenTutar:80,odenenTutar:80,odemeTarihi:'2026-07-23'}
  }
};
const reports=[];
const ctx={
  window:{
    XLSX:{utils:{
      json_to_sheet:rows=>({rows}),aoa_to_sheet:rows=>({rows}),book_new:()=>({sheets:[]}),
      book_append_sheet:(wb,ws,n)=>wb.sheets.push({ws,n})
    },writeFile:(wb,name)=>reports.push({name,rows:wb.sheets[0].ws.rows})}
  },
  xlsxHazirla:async()=>true,showToast:()=>{},Date,Math,AKTIF_DONEM:'2026-2027',
  AY_ISIMLERI:names,getOgrenciDurum:()=> 'aktif',
  ogrenciList:[{id:'A',ogrenciAdSoyad:'Test Çiçek',sinif:'Mimoza'}],
  ayarListesi:{A:data},ortakOdemePlani:odemePlani
};
vm.runInNewContext(take('window.raporIndirAylikTahsilat = ','// Rapor: Gelir-Gider (3 sayfalı rapor)'),ctx);
vm.runInNewContext(take('window.raporExcelOdemeDetay = ','// SheetJS dinamik yükleyici (yedek kaynaklı)'),ctx);

test('the monthly report separates contract month from cash transaction date',async()=>{
 await ctx.window.raporIndirAylikTahsilat();
 const sheet=reports.at(-1);
 const eyl=sheet.rows.find(r=>r['Aidat Ayı']==='Eylül 2026');
 const eki=sheet.rows.find(r=>r['Aidat Ayı']==='Ekim 2026');
 assert.equal(eyl['Planlanan Aidat (TL)'],100);
 assert.equal(eyl['Aidat Ayına İşlenen (TL)'],50);
 assert.equal(eki['Planlanan Aidat (TL)'],80);
 assert.equal(eki['Aidat Ayına İşlenen (TL)'],80);
 assert.equal(eki['Açık Aidatı Olan Öğrenci'],0);
 assert.equal(sheet.rows.find(r=>r['Aidat Ayı']==='Kasım 2026')['Planlanan Aidat (TL)'],0);
});

test('payment detail exporter shows partial dues, exact plan months and correct balances',async()=>{
 await ctx.window.raporIndirOdemeDetayi();
 const row=reports.at(-1).rows[0];
 assert.equal(row['Dönem Beklenen'],180);
 assert.equal(row['Dönem Ödenen'],130);
 assert.equal(row['Dönem Kalan'],50);
 assert.match(row['Eylül 2026'],/Kısmi: 50/);
 assert.match(row['Ekim 2026'],/Ödendi: 80/);
 assert.equal(row['Kasım 2026'],'Plan dışı');
});

test('full period payment report never assumes monthly fee times 10',async()=>{
 await ctx.window.raporExcelOdemeDetay();
 const row=reports.at(-1).rows[1];
 assert.equal(row[3],2);
 assert.equal(row[4],180);
 assert.equal(row[5],130);
 assert.equal(row[6],50);
});

test('monthly payout Excel has a real month label rather than undefined',()=>{
 const fragment=take('window.raporExcelAylikTahsilat = ','window.raporExcelGeciken = ');
 assert.match(fragment,/a\.ay\.isim\+" "\+a\.ay\.yil/);
 assert.doesNotMatch(fragment,/a\.ay\.tam/);
});
