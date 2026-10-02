import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eventTime, interactionSummary} from '../js/portal-galeri-etkilesim.js';
import {interactionRowHtml, reportTime} from '../js/portal-galeri-canli.js';

test('report combines first/last opening and counts across verified records for the same parent',()=>{
 const summary=interactionSummary([
  {ilkAcma:'2026-09-30T08:00:00Z',sonAcma:'2026-09-30T12:00:00Z',acmaSayisi:2},
  {ilkAcma:'2026-09-29T10:00:00Z',sonAcma:'2026-09-30T15:30:00Z',acmaSayisi:3}
 ]);
 assert.equal(summary.firstOpen,'2026-09-29T10:00:00.000Z');
 assert.equal(summary.lastOpen,'2026-09-30T15:30:00.000Z');assert.equal(summary.openCount,5);
 assert.equal(summary.opened,true);assert.equal(summary.started,false);
});
test('latest download initiation stays distinct from a previously completed save',()=>{
 const summary=interactionSummary([
  {indirmeBaslatildi:true,indirildi:true,sonIndirme:'2026-09-29T10:00:00Z',sonIndirmeDurumu:'tamamlandi',indirmeSayisi:1},
  {indirmeBaslatildi:true,indirildi:true,sonIndirme:'2026-09-30T11:00:00Z',sonIndirmeDurumu:'baslatildi',indirmeSayisi:2}
 ]);
 assert.equal(summary.downloaded,true);assert.equal(summary.lastDownloadStatus,'baslatildi');assert.equal(summary.downloadCount,3);
 const html=interactionRowHtml({name:'Synthetic Parent',children:['Synthetic Child'],...summary});
 assert.match(html,/İndirme başlatıldı/);assert.doesNotMatch(html,/Kaydetme doğrulandı/);
});
test('old sparse records remain counts with unknown dates, not fabricated exact viewing time',()=>{
 const summary=interactionSummary([{acmaSayisi:4,indirmeBaslatildi:true}]);
 assert.equal(summary.openCount,4);assert.equal(summary.firstOpen,'');assert.equal(summary.lastOpen,'');
 assert.equal(summary.downloadCount,1);assert.equal(summary.lastDownload,'');
 const html=interactionRowHtml({name:'Synthetic Parent',children:[],...summary});assert.match(html,/Zaman kaydı yok/);
});
test('stored timestamp variants normalize and invalid dates do not leak Invalid Date',()=>{
 assert.equal(eventTime({seconds:0}),'1970-01-01T00:00:00.000Z');
 assert.equal(eventTime({toDate:()=>new Date('2026-09-30T12:00:00Z')}),'2026-09-30T12:00:00.000Z');
 assert.equal(eventTime('invalid'),'');assert.equal(reportTime('invalid'),'Zaman kaydı yok');
 assert.match(reportTime('2026-09-30T12:00:00Z'),/15:00:00/);
});
test('report rows explicitly label first, last, count and last download with escaped names',()=>{
 const html=interactionRowHtml({name:'<Synthetic>',children:['<Child>'],...interactionSummary([{ilkAcma:'2026-09-30T12:00:00Z',sonAcma:'2026-09-30T13:00:00Z',acmaSayisi:2,sonIndirme:'2026-09-30T14:00:00Z',indirmeSayisi:1,indirmeBaslatildi:true,indirildi:true,sonIndirmeDurumu:'tamamlandi'}])});
 for(const label of ['İlk açılış:','Son açılış:','Açılış sayısı: 2','Son indirme:','Kaydetme doğrulandı'])assert.ok(html.includes(label));
 assert.match(html,/&lt;Synthetic&gt;/);assert.doesNotMatch(html,/<Synthetic>/);
});
test('empty records and malformed negative counts do not fabricate activity',()=>{
 const empty=interactionSummary([]);assert.equal(empty.openCount,0);assert.equal(empty.opened,false);assert.equal(empty.started,false);
 const malformed=interactionSummary([{acmaSayisi:-8,indirmeSayisi:'wrong'}]);assert.equal(malformed.opened,false);assert.equal(malformed.started,false);
});
test('active management lightbox exposes report entry only after approval',async()=>{
 const src=await readFile(new URL('../js/portal-galeri-canli.js',import.meta.url),'utf8');
 assert.match(src,/Kim açtı\? · Veli etkileşimleri/);assert.match(src,/button.hidden = !\(active\?\.durum === 'onaylandi' && management/);
 assert.match(src,/Tarih ve saatler Türkiye saatidir/);
 assert.match(src,/const rowHtml = interactionRowHtml/);
});
