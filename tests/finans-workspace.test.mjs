import test from 'node:test';
import assert from 'node:assert/strict';
import {finansAnalizi} from '../js/finans/analytics.js';
import {MUHASEBE_HIZLI,personelOzeti,personelZamani} from '../js/finans/staff-home.js';
import {kayitZamani} from '../js/finans/data.js';
test('aging separates boundaries and keeps only outstanding cents',()=>{
 const data={gelirler:[],giderler:[],bildirimler:[],satirlar:[{vade:'2026-09-21',kalan:100},{vade:'2026-09-20',kalan:10.11},{vade:'2026-08-22',kalan:1.22},{vade:'2026-08-21',kalan:2.33},{vade:'2026-07-22',kalan:3.44},{vade:'2026-06-22',kalan:4.55},{vade:'',kalan:5}]};
 const a=finansAnalizi(data,'2026-09','2026-09-21');assert.deepEqual(a.yas.map(r=>r.tutar),[11.33,2.33,3.44,4.55]);assert.equal(a.vadesiz,1);
});
test('analytics uses transaction month, refunds and actual expense dates',()=>{
 const a=finansAnalizi({satirlar:[],gelirler:[{tarih:'2026-09-02',kalemId:'2026-08',tutar:100},{tarih:'2026-09-03',kalemId:'2026-08',tutar:-20},{tarih:'',tutar:999},{tarih:'2026-08-01',tutar:5}],giderler:[{tarih:'2026-09-05',tutar:50}],bildirimler:[]},'2026-09','2026-09-21');
 assert.equal(a.kalemler[0].tutar,80);assert.equal(a.trend.at(-1).tahsilat,80);assert.equal(a.trend.at(-1).gider,50);assert.equal(a.trend[0].ay,'2026-04');
});
test('missing attendance is not treated as absence and failed read stays failed',async()=>{
 const fb={collection:(_,name)=>name,getDocs:async name=>({docs:name==='personeller'?[{id:'one',data:()=>({adSoyad:'Bir',durum:'aktif'})},{id:'old',data:()=>({durum:'arsiv'})}]:[]})};
 assert.deepEqual((await personelOzeti({fb,db:{}})).map(p=>p.durum),['Kayıt yok']);
 await assert.rejects(personelOzeti({fb:{...fb,getDocs:async()=>{throw Error('denied');}},db:{}}));
});
test('accounting shortcuts retain staff workflows and exclude education operations',()=>{
 const ids=MUHASEBE_HIZLI.map(r=>r[0]);for(const id of ['mesaj','ozluk','devam','personel','fis','reports','accounts'])assert.ok(ids.includes(id));for(const id of ['okulZili','egitim','randevu'])assert.ok(!ids.includes(id));
 assert.equal(kayitZamani({guncellendi:'2026-09-21'},{}),'');assert.equal(kayitZamani({kayit:{kayitTarihi:'2026-09-01'}},{}),'2026-09-01');
});

test('attendance timestamp formats preserve dates and invalid values remain unknown',()=>{
 assert.equal(personelZamani({seconds:0}),'1970-01-01T00:00:00.000Z');
 assert.equal(personelZamani({toDate:()=>new Date('2026-09-21T09:30:00Z')}),'2026-09-21T09:30:00.000Z');
 assert.equal(personelZamani('2026-09-21T12:30:00+03:00'),'2026-09-21T09:30:00.000Z');
 for(const v of [undefined,'',{},'bozuk'])assert.equal(personelZamani(v),'');
});
