import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const base=new URL(existsSync(new URL('../js/finans/core.js',import.meta.url))?'../js/finans/':'../www/js/finans/',import.meta.url);
const {benzerBildirimler,benzerBildirimUyarisi}=await import(new URL('payment-workspace.js',base));

const donem='2026-2027';
const bildirim=(ek={})=>({id:'a',ogrenciId:'ogr1',donem,kalemTipi:'aidat-2026-10',tutar:4000,bildirilenTutar:4000,odemeTarihi:'2026-10-02',durum:'bekliyor',veliEmail:'anne@example.invalid',...ek});

test('iki farklı velinin aynı tutarlı bildirimi muhasebede mükerrer olarak işaretlenir',()=>{
  const anne=bildirim(),baba=bildirim({id:'b',veliEmail:'baba@example.invalid',odemeTarihi:'2026-10-03'});
  const sonuc=benzerBildirimler(anne,[anne,baba]);
  assert.equal(sonuc.length,1);
  assert.equal(sonuc[0].bildirim.id,'b');
  assert.equal(sonuc[0].ayniTutar,true);
  assert.equal(sonuc[0].farkliVeli,true);
  assert.match(benzerBildirimUyarisi(sonuc),/Muhtemel mükerrer bildirim · diğer veliden/);
});

test('onaylanmış eski bildirim de karşılaştırmaya girer',()=>{
  const yeni=bildirim({id:'yeni',veliEmail:'baba@example.invalid'}),eski=bildirim({id:'eski',durum:'onaylandi'});
  const sonuc=benzerBildirimler(yeni,[yeni,eski]);
  assert.equal(sonuc.length,1);assert.equal(sonuc[0].onayli,true);
});

test('farklı tutar yalnız "başka bildirim var" uyarısı verir',()=>{
  const a=bildirim(),b=bildirim({id:'b',tutar:2000,bildirilenTutar:2000});
  const sonuc=benzerBildirimler(a,[a,b]);
  assert.equal(sonuc[0].ayniTutar,false);
  assert.equal(benzerBildirimUyarisi(sonuc),'Aynı kalem için başka bildirim de var · birlikte kontrol edin.');
});

test('farklı kalem, farklı öğrenci, farklı dönem, reddedilmiş kayıt ve kendisi eşleşmez',()=>{
  const a=bildirim();
  const digerleri=[a,
    bildirim({id:'k',kalemTipi:'aidat-2026-11'}),
    bildirim({id:'o',ogrenciId:'ogr2'}),
    bildirim({id:'d',donem:'2025-2026'}),
    bildirim({id:'r',durum:'reddedildi'}),
    bildirim({id:'i',durum:'iade_edildi'})];
  assert.deepEqual(benzerBildirimler(a,digerleri),[]);
  assert.equal(benzerBildirimUyarisi([]),'');
});

test('dönemi eksik eski bildirim aynı kalemle eşleşir',()=>{
  const a=bildirim(),eski=bildirim({id:'e',donem:undefined});
  assert.equal(benzerBildirimler(a,[a,eski]).length,1);
});

test('tutarlar kuruş hassasiyetiyle karşılaştırılır',()=>{
  const a=bildirim({tutar:1234.5,bildirilenTutar:1234.5}),b=bildirim({id:'b',tutar:'1234.50',bildirilenTutar:'1234.50'});
  assert.equal(benzerBildirimler(a,[a,b])[0].ayniTutar,true);
});
