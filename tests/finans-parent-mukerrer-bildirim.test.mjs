import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {odemeBildirimEslesir,mukerrerOdemeBildirimiBul} from '../js/finans/parent.js';

const base={id:'n1',ogrenciId:'ogr-1',donem:'2026-2027',kalemTipi:'aidat-2026-09',ayKod:'2026-09',bildirilenTutar:32500,odemeTarihi:'2026-09-22',durum:'bekliyor'};
const candidate={ogrenciId:'ogr-1',donem:'2026-2027',kalemTipi:'aidat-2026-09',ayKod:'2026-09',tutar:32500,odemeTarihi:'2026-09-22'};

test('aynı öğrenci dönem kalem tutar ve tarih aynı ödemedir',()=>{
 assert.equal(odemeBildirimEslesir(base,candidate),true);
 assert.equal(odemeBildirimEslesir({...base,bildirilenTutar:32500.004},candidate),true);
});

test('aynı taksitte farklı tutar veya tarih ayrı ödeme olabilir',()=>{
 assert.equal(odemeBildirimEslesir({...base,bildirilenTutar:10000},candidate),false);
 assert.equal(odemeBildirimEslesir({...base,odemeTarihi:'2026-09-23'},candidate),false);
});

test('başka öğrenci dönem veya ödeme kalemi mükerrer sayılmaz',()=>{
 assert.equal(odemeBildirimEslesir({...base,ogrenciId:'ogr-2'},candidate),false);
 assert.equal(odemeBildirimEslesir({...base,donem:'2025-2026'},candidate),false);
 assert.equal(odemeBildirimEslesir({...base,kalemTipi:'aidat-2026-10',ayKod:'2026-10'},candidate),false);
});

test('bekleyen ve onaylanan aynı ödeme uyarılır; reddedilen yeniden gönderimi engellemez',()=>{
 assert.equal(mukerrerOdemeBildirimiBul([base],candidate)?.id,'n1');
 assert.equal(mukerrerOdemeBildirimiBul([{...base,id:'n2',durum:'onaylandi'}],candidate)?.id,'n2');
 assert.equal(mukerrerOdemeBildirimiBul([{...base,durum:'reddedildi'}],candidate),null);
});

test('farklı kısmi ödeme aynı kaleme ait olsa da engellenmez',()=>{
 const list=[{...base,bildirilenTutar:10000,odemeTarihi:'2026-09-20',durum:'onaylandi'}];
 assert.equal(mukerrerOdemeBildirimiBul(list,{...candidate,tutar:22500,bildirilenTutar:22500,odemeTarihi:'2026-09-23'}),null);
});

test('veli arayüzü açık tekrar onayı ve muhasebe bağlantı bilgisini kaydeder',async()=>{
 const s=await readFile(new URL('../js/finans/parent.js',import.meta.url),'utf8');
 assert.match(s,/Daha önce bildirimde bulundunuz/);
 assert.match(s,/Bir yanlışlık var \/ yeniden bildir/);
 assert.match(s,/tekrarBildirim:true/);
 assert.match(s,/oncekiBildirimId/);
 assert.match(s,/tekrarNedeni/);
 assert.match(s,/tekrarOnayi:'veli_acik_onay'/);
});
