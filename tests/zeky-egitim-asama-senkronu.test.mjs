import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { egitimOnayiniEsitle } from '../js/zeky-galeri-onay-egitim.js';

const kok = new URL('../', import.meta.url);
const anahtar = 'practical__Ön Çalışmalar__Sandalye Taşıma';

test('öğretmen gözlemi durum, tarih ve ayrıntıyı tek transaction ile yazar', async () => {
  const kaynak = await readFile(new URL('index.html', kok), 'utf8');
  const bas = kaynak.indexOf('async function caGozlemDetayKaydet');
  const son = kaynak.indexOf('window.caGozlemKaydet', bas);
  const fonksiyon = kaynak.slice(bas, son);
  assert.match(fonksiyon, /runTransaction\(db/);
  assert.match(fonksiyon, /kayitlar\[anahtar\] = st\.seviye/);
  assert.match(fonksiyon, /tarihler\[anahtar\] = simdi\.slice/);
  assert.match(fonksiyon, /detay\[anahtar\]/);
  assert.match(fonksiyon, /sonGozlem/);
});

test('açık eğitim matrisi gelişim koleksiyonunu canlı dinler', async () => {
  const kaynak = await readFile(new URL('index.html', kok), 'utf8');
  assert.match(kaynak, /egitimGelisimCanliDinlemeyiBaslat/);
  assert.match(kaynak, /onSnapshot\(collection\(db, "ogrenciGelisim"\)/);
  assert.match(kaynak, /caGozlemEgitimGorunumunuGuncelle/);
});

test('Değerler+ ayrı program anahtarında tutulur', async () => {
  const kaynak = await readFile(new URL('js/zeky-galeri-onay-egitim.js', kok), 'utf8');
  assert.match(kaynak, /degerlerPlus:'Değerler\+'/);
  assert.match(kaynak, /s\.includes\('degerlerplus'\).*return'degerlerPlus'/);
});

test('eski bir Sunuldu fotoğrafının onayı Ustalaştı durumunu geriye düşürmez', async () => {
  const yazilan = [];
  const galeri = {
    durum:'onaylandi', egitimKaydi:true, program:'montessori', ogrenciId:'o1',
    kazanimAnahtari:anahtar, gozlemDurum:'S', baslik:'Sandalye Taşıma',
    bunnyUrl:'https://cdn.test/eski-s.jpg', tarih:'2026-09-10T10:00:00Z'
  };
  const gelisim = {
    montessori:{
      kayitlar:{[anahtar]:'U'}, tarihler:{[anahtar]:'2026-09-18'},
      detay:{[anahtar]:{durum:'U',not:'Bağımsız tamamladı',paylas:true,asamalar:{
        U:{durum:'U',tarih:'2026-09-18T10:00:00Z',paylas:true}
      }}}
    }
  };
  const fb = {
    doc:(_db,...parcalar)=>parcalar.join('/'),
    getDoc:async yol=>yol==='galeri/g-eski'
      ? {exists:()=>true,data:()=>galeri}
      : {exists:()=>true,data:()=>gelisim},
    setDoc:async(yol,veri,secenek)=>yazilan.push({yol,veri,secenek}),
    serverTimestamp:()=>({seconds:1})
  };
  const onceki = globalThis.window;
  globalThis.window = {PortalAPI:{db:{},fb}};
  try { assert.equal(await egitimOnayiniEsitle('g-eski','onaylandi'), true); }
  finally { if(onceki===undefined) delete globalThis.window; else globalThis.window=onceki; }

  const dis = yazilan.find(x=>x.yol==='ogrenciGelisim/o1').veri.montessori;
  assert.equal(dis.kayitlar[anahtar], 'U');
  assert.equal(dis.tarihler[anahtar], '2026-09-18');
  assert.equal(dis.detay[anahtar].durum, 'U');
  assert.equal(dis.detay[anahtar].asamalar.S.fotoUrl, 'https://cdn.test/eski-s.jpg');
});

test('fotoğraf reddi eğitim aşamasını ve veliye açık pedagojik kaydı korur', async () => {
  const yazilan = [];
  const galeri = {
    durum:'reddedildi', egitimKaydi:true, program:'montessori', ogrenciId:'o1',
    kazanimAnahtari:anahtar, gozlemDurum:'S', baslik:'Sandalye Taşıma',
    tarih:'2026-09-18T10:00:00Z'
  };
  const gelisim = {montessori:{kayitlar:{[anahtar]:'S'},tarihler:{[anahtar]:'2026-09-18'},detay:{
    [anahtar]:{durum:'S',paylas:true,asamalar:{S:{durum:'S',paylas:true,galeriId:'g-red'}}}
  }}};
  const fb = {
    doc:(_db,...parcalar)=>parcalar.join('/'),
    getDoc:async yol=>yol==='galeri/g-red'
      ? {exists:()=>true,data:()=>galeri}
      : {exists:()=>true,data:()=>gelisim},
    setDoc:async(yol,veri,secenek)=>yazilan.push({yol,veri,secenek}),
    serverTimestamp:()=>({seconds:1})
  };
  const onceki = globalThis.window;
  globalThis.window = {PortalAPI:{db:{},fb}};
  try { assert.equal(await egitimOnayiniEsitle('g-red','reddedildi'), true); }
  finally { if(onceki===undefined) delete globalThis.window; else globalThis.window=onceki; }

  const dis = yazilan.find(x=>x.yol==='ogrenciGelisim/o1').veri.montessori;
  assert.equal(dis.kayitlar[anahtar], 'S');
  assert.equal(dis.detay[anahtar].paylas, true);
  assert.equal(dis.detay[anahtar].asamalar.S.fotoDurum, 'reddedildi');
  assert.equal(dis.detay[anahtar].asamalar.S.fotoUrl, '');
});
