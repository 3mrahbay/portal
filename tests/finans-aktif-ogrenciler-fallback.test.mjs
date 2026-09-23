import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const path=existsSync(new URL('js/finans/data.js',root))?'js/finans/data.js':'www/js/finans/data.js';
const {aktifDonemKaydi,okulVerisi,toplam}=await import(new URL(path,root));
const donem='2026-2027';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function fixture(records){
  const source=freeze(records),requests=[];
  const doc=(id,data)=>({id,data:()=>data});
  const fb={
    collection:(_,name)=>name,doc:(_,...parts)=>parts.join('/'),
    async getDocs(name){
      if(name==='ogrenciler')return {docs:source.map(o=>doc(o.id,o.base))};
      if(name==='odemeBildirimleri')return {docs:source.map(o=>doc('bildirim-'+o.id,{ogrenciId:o.id,donem,durum:'bekliyor'}))};
      return {docs:[]};
    },
    async getDoc(path){requests.push(path);const o=source.find(o=>o.id===path.split('/')[1]);const v=path.endsWith('/'+donem)?o?.term:undefined;return {exists:()=>v!==undefined,data:()=>v};}
  };
  for(const name of ['setDoc','updateDoc','deleteDoc','runTransaction'])fb[name]=()=>assert.fail('Salt okunur filtre yazma yapmamalı');
  return {fb,db:{},donem,source,requests};
}
function plan(durum){return {durum,anne:{adSoyad:'Veli'},aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:1,aylikAidat:1000},aylikOdemeler:{'2026-09':{odenenTutar:200,odemeTarihi:'2026-09-10'}}};}

test('dönem durumu yoksa ana kayıttaki pasif durum korunur',()=>{
  for(const durum of ['arsiv','arşiv','pasif','ayrildi','ayrıldı',' ARŞİV ','PASIF']){
    assert.equal(aktifDonemKaydi({}, {durum}),false,durum);
    assert.equal(aktifDonemKaydi({durum:''},{durum}),false,durum);
  }
});
test('yeniden kayıt: açık aktif dönem eski arşiv ana kaydından önceliklidir',()=>{
  assert.equal(aktifDonemKaydi({durum:'aktif'},{durum:'arsiv'}),true);
  assert.equal(aktifDonemKaydi({durum:'pasif'},{durum:'aktif'}),false);
});
test('yalnız aktif durum kabul edilir; aday veya bilinmeyen durum öğrenci sayılmaz',()=>{
  for(const durum of ['on_kayit','beklemede','aday','iptal','mezun','bilinmeyen']){
    assert.equal(aktifDonemKaydi({durum}),false,durum);
    assert.equal(aktifDonemKaydi({}, {durum}),false,durum);
  }
  assert.equal(aktifDonemKaydi({durum:' AKTİF '}),true);
});
test('dönem belgesi zorunlu; iki durum da boşsa mevcut varsayılan korunur',()=>{
  assert.equal(aktifDonemKaydi(undefined,{durum:'aktif'}),false);
  assert.equal(aktifDonemKaydi(null,{durum:'aktif'}),false);
  assert.equal(aktifDonemKaydi({},{}),true);
  assert.equal(aktifDonemKaydi({durum:null},{durum:'aktif'}),true);
});
test('64 kayıt: 41 aktif + durumunu ana kayıttan alan 23 arşiv aynı kümeye süzülür',async()=>{
  const records=Array.from({length:64},(_,i)=>({id:'ogr-'+i,base:{durum:i<41?'aktif':'arsiv'},term:plan(undefined)}));
  const f=fixture(records),before=JSON.stringify(f.source),data=await okulVerisi(f);
  const expected=records.slice(0,41).map(o=>o.id);
  assert.deepEqual(data.ogrenciler.map(o=>o.id),expected);
  assert.deepEqual(data.bildirimler.map(b=>b.ogrenciId),expected);
  assert.deepEqual(data.satirlar.map(r=>r.ogrenciId),expected);
  assert.equal(toplam(data.satirlar,'beklenen'),41000);
  assert.equal(toplam(data.gelirler,'tutar'),8200);
  assert.equal(JSON.stringify(f.source),before);
});
test('öğrenci listesiyle aynı öncelik matrisi ve plansız aktif öğrenciler korunur',async()=>{
  const statuses=[undefined,'aktif','arsiv','pasif','ayrildi','on_kayit'];
  const records=[];
  for(const base of statuses)for(const term of statuses)records.push({id:'ogr-'+records.length,base:{durum:base},term:{durum:term}});
  // Portal getOgrenciDurum: ayar.durum > ogrenci.durum > aktif.
  const expected=records.filter(o=>(o.term.durum||o.base.durum||'aktif')==='aktif').map(o=>o.id);
  const data=await okulVerisi(fixture(records));
  assert.deepEqual(data.ogrenciler.map(o=>o.id),expected);
  assert.ok(data.ogrenciler.every(o=>o.plan.plansiz));
});
test('sayı sabitlenmez; 42 aktif öğrenci ve dönem belgesi olmayan kayıt ayrılır',async()=>{
  const records=Array.from({length:42},(_,i)=>({id:'ogr-'+i,base:{},term:{durum:'aktif'}}));
  records.push({id:'donemsiz',base:{durum:'aktif'}});
  const data=await okulVerisi(fixture(records));
  assert.equal(data.ogrenciler.length,42);
  assert.ok(data.bildirimler.every(b=>b.ogrenciId!=='donemsiz'));
});
test('okuma hatası eksik başarı olarak gizlenmez',async()=>{
  const f=fixture([{id:'ogr',base:{},term:{durum:'aktif'}}]);
  f.fb.getDoc=async()=>{throw new Error('permission-denied');};
  await assert.rejects(okulVerisi(f),/permission-denied/);
});
