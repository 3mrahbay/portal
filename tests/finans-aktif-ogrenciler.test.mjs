import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';

// The same regression suite runs in both Portal and ZEKY, with the real
// finance calculation module. Only Firestore I/O is replaced with fixtures.
const root=new URL('../',import.meta.url);
const entry=new URL(existsSync(new URL('js/finans/data.js',root))?'js/finans/data.js':'www/js/finans/data.js',root);
const {okulVerisi,aktifDonemKaydi,toplam,sinirliMap}=await import(entry.href);
const DONEM='2026-2027',ESKI='2025-2026';
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const row=(id,data)=>({id,data});
function plan(durum='aktif',extra={}){
  return {durum,kayit:{sinif:'A'},anne:{adSoyad:'Güncel veli'},
    aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:1,aylikAidat:1000},
    aylikOdemeler:{'2026-09':{odenenTutar:200,odemeTarihi:'2026-09-10'}},...extra};
}
function fixture({students=[],periods={},notifications=[],expenses=[],accounting=[],failPath}={}){
  const source=freeze({ogrenciler:students,giderler:expenses,odemeBildirimleri:notifications,odemeler:accounting,periods});
  const paths=[];let writes=0,running=0,maxRunning=0;
  const snap=r=>({id:r.id,data:()=>r.data});
  const fb={
    collection:(_db,...parts)=>parts.join('/'),doc:(_db,...parts)=>parts.join('/'),
    async getDocs(path){assert.ok(Object.hasOwn(source,path));return {docs:source[path].map(snap)};},
    async getDoc(path){
      paths.push(path);running++;maxRunning=Math.max(maxRunning,running);
      try{
        await new Promise(resolve=>setImmediate(resolve));
        if(path===failPath)throw Object.assign(new Error('permission-denied'),{code:'permission-denied'});
        const data=source.periods[path];return {exists:()=>data!==undefined,data:()=>data};
      }finally{running--;}
    }
  };
  for(const name of ['setDoc','updateDoc','deleteDoc','addDoc','runTransaction','writeBatch'])fb[name]=()=>{writes++;throw Error('Read-only fixture: writes forbidden');};
  return {fb,db:{},source,paths,get writes(){return writes;},get maxRunning(){return maxRunning;}};
}
function student(id,veri=plan(),base={}){
  return {record:row(id,{ogrenciAdSoyad:id,...base}),path:`ogrenciler/${id}/donemler/${DONEM}`,veri};
}
function setup(items,extra={}){
  return fixture({students:items.map(s=>s.record),periods:Object.fromEntries(items.filter(s=>s.veri!==undefined).map(s=>[s.path,s.veri])),...extra});
}
const load=(f,donem=DONEM)=>okulVerisi({fb:f.fb,db:f.db,donem});

test('arşiv, pasif ve ayrılmış dönem durumları Türkçe/ASCII ve büyük-küçük harfle dışlanır',()=>{
  for(const durum of ['arsiv','arşiv','pasif','ayrildi','ayrıldı',' ARŞİV ','ARSIV',' PASIF ','PASİF','AYRILDI']){
    assert.equal(aktifDonemKaydi({durum}),false,durum);
  }
});

test('durum alanı olmayan mevcut dönem belgeleri öğrenci listesiyle uyumlu kalır',()=>{
  for(const veri of [{},{durum:''},{durum:null},{durum:'aktif'},{durum:' AKTİF '}])assert.equal(aktifDonemKaydi(veri),true);
  for(const veri of [null,undefined,false,'aktif'])assert.equal(aktifDonemKaydi(veri),false);
});

test('regresyon: 64 dönem belgesi içindeki 41 aktif öğrenci sayılır; 23 eski veli dışlanır',async()=>{
  const items=Array.from({length:64},(_,i)=>student(`ogr-${i}`,plan(i<41?'aktif':['arsiv','pasif','ayrildi'][i%3],{anne:{adSoyad:`veli-${i}`}})));
  const data=await load(setup(items));
  assert.equal(data.ogrenciler.length,41);
  assert.deepEqual(data.ogrenciler.map(o=>o.id),items.slice(0,41).map(s=>s.record.id));
  assert.equal(data.satirlar.length,41);
  assert.equal(data.gelirler.length,41);
  assert.ok(data.ogrenciler.every(o=>Number(o.veli.slice(5))<41));
  assert.equal(toplam(data.satirlar,'beklenen'),41000);
  assert.equal(toplam(data.gelirler,'tutar'),8200);
});

test('öğrenci sayısı 41 sabitine değil veriye bağlıdır; yeni kayıtla otomatik artar',async()=>{
  const items=Array.from({length:42},(_,i)=>student(`yeni-${i}`));
  assert.equal((await load(setup(items))).ogrenciler.length,42);
});

test('ödeme planı olmayan aktif öğrenci sayımdan düşmez',async()=>{
  const data=await load(setup([student('plansiz',{durum:'aktif',kayit:{sinif:'B'}})]));
  assert.equal(data.ogrenciler.length,1);
  assert.equal(data.ogrenciler[0].plan.plansiz,true);
  assert.equal(data.satirlar.length,0);
});

test('ana kayıtta aktif yazsa bile seçili dönem belgesi olmayan öğrenci alınmaz',async()=>{
  const f=fixture({students:[row('eski',{aktifDonem:DONEM,aktifDonemDurum:'aktif'})],periods:{[`ogrenciler/eski/donemler/${ESKI}`]:plan()}});
  const data=await load(f);
  assert.equal(data.ogrenciler.length,0);
  assert.deepEqual(f.paths,[`ogrenciler/eski/donemler/${DONEM}`]);
});

test('dönem durumu eski ana kayıt özetinden önce gelir; yeniden kayıt korunur',async()=>{
  const f=setup([
    student('yeniden',plan('aktif'),{durum:'arsiv',aktifDonem:ESKI,aktifDonemDurum:'arsiv'}),
    student('ayrilmis',plan('pasif'),{durum:'aktif',aktifDonem:DONEM,aktifDonemDurum:'aktif'})
  ]);
  assert.deepEqual((await load(f)).ogrenciler.map(o=>o.id),['yeniden']);
});

test('veli bildirimleri yalnız aynı aktif öğrenci kümesine ve seçili döneme bağlanır',async()=>{
  const notifications=[
    row('guncel',{ogrenciId:'aktif',donem:DONEM,durum:'bekliyor'}),
    row('arsiv-veli',{ogrenciId:'arsiv',donem:DONEM,durum:'bekliyor'}),
    row('eski-donem',{ogrenciId:'aktif',donem:ESKI,durum:'bekliyor'}),
    row('bilinmeyen',{ogrenciId:'yok',donem:DONEM,durum:'bekliyor'}),
    row('kimliksiz',{donem:DONEM,durum:'bekliyor'}),
    row('donemsiz-arsiv',{ogrenciId:'arsiv',durum:'bekliyor'})
  ];
  const data=await load(setup([student('aktif'),student('arsiv',plan('arsiv'))],{notifications}));
  assert.deepEqual(data.bildirimler.map(b=>b.id),['guncel']);
});

test('aktif öğrencinin dönemi eksik eski bildirimi mevcut kontrol akışı için korunur',async()=>{
  const data=await load(setup([student('aktif')],{notifications:[row('kontrol',{ogrenciId:'aktif',durum:'bekliyor'})]}));
  assert.equal(data.bildirimler.length,1);
  assert.equal(data.bildirimler[0].donem,undefined);
});

test('seçili dönemdeki veli ve sınıf ana kayıttaki eski bilgilerden önce kullanılır',async()=>{
  const f=setup([student('aktif',plan('aktif',{kayit:{sinif:'Yeni sınıf'},anne:{adSoyad:'Yeni veli'}}),{sinif:'Eski sınıf',veliAdSoyad:'Eski veli'})]);
  const o=(await load(f)).ogrenciler[0];
  assert.equal(o.sinif,'Yeni sınıf');assert.equal(o.veli,'Yeni veli');
});

test('aynı isimli öğrenciler kimlikleriyle ayrı kalır; veli adına göre yanlış birleşmez',async()=>{
  const f=setup([student('bir',plan(),{ogrenciAdSoyad:'Aynı Ad'}),student('iki',plan(),{ogrenciAdSoyad:'Aynı Ad'})]);
  assert.deepEqual((await load(f)).ogrenciler.map(o=>o.id),['bir','iki']);
});

test('filtre veriyi değiştirmez; arşiv, gider ve banka mutabakatı kayıtları silinmez',async()=>{
  const expenses=[row('gider',{tutar:125,kategori:'Gıda'})];
  const accounting=[row('banka',{tur:'banka_mutabakati',donem:DONEM}),row('eski',{tur:'banka_mutabakati',donem:ESKI})];
  const f=setup([student('aktif'),student('arsiv',plan('arsiv'))],{expenses,accounting});
  const before=JSON.stringify(f.source),data=await load(f);
  assert.equal(JSON.stringify(f.source),before);assert.equal(f.writes,0);
  assert.deepEqual(data.giderler,[{id:'gider',tutar:125,kategori:'Gıda'}]);
  assert.deepEqual(data.mutabakatlar.map(r=>r.id),['banka']);
  assert.equal(f.source.periods[`ogrenciler/arsiv/donemler/${DONEM}`].durum,'arsiv');
});

test('dönem değiştirilince yalnız istenen dönemin aktif kaydı yüklenir',async()=>{
  const f=fixture({students:[row('ogrenci',{})],periods:{
    [`ogrenciler/ogrenci/donemler/${ESKI}`]:plan('aktif',{anne:{adSoyad:'Önceki dönem velisi'}}),
    [`ogrenciler/ogrenci/donemler/${DONEM}`]:plan('arsiv')
  }});
  assert.equal((await load(f)).ogrenciler.length,0);
  const old=await load(f,ESKI);assert.equal(old.ogrenciler.length,1);assert.equal(old.donem,ESKI);
});

test('okuma hatasında eksik öğrenci sayısı başarılı sonuç gibi sunulmaz',async()=>{
  const f=setup([student('bir'),student('iki')],{failPath:`ogrenciler/iki/donemler/${DONEM}`});
  await assert.rejects(load(f),/permission-denied/);
});

test('öğrenci dönem okumaları en fazla altılı yürütülür ve sıralama korunur',async()=>{
  const items=Array.from({length:23},(_,i)=>student(`ogr-${i}`)),f=setup(items);
  const data=await load(f);assert.ok(f.maxRunning<=6);assert.ok(f.maxRunning>1);
  assert.deepEqual(data.ogrenciler.map(o=>o.id),items.map(s=>s.record.id));
});

test('boş okul listesi tüm öğrenciye bağlı alanlarda boş sonuç verir',async()=>{
  const f=fixture(),data=await load(f);
  for(const field of ['ogrenciler','satirlar','gelirler','bildirimler'])assert.deepEqual(data[field],[]);
  assert.equal(f.paths.length,0);
  assert.deepEqual(await sinirliMap([],()=>assert.fail('Çağrılmamalı')),[]);
});
