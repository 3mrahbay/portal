// Günlük özeti (js/gunluk-ozet.js) — ZEKY www/js/gunluk-ozet.js ile birebir aynı dosya.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { duzMetin, gunAdi, gunlukOzeti, ruhHaliOzeti, uykuOzeti, yemekOzeti } from '../js/gunluk-ozet.js';

const ORTAK_OZET = '6e8d7302bd20028b';

test('ZEKY ile ortak dosya değişmedi (değişirse iki depoda birlikte güncellenir)', () => {
  const ozet = createHash('sha256').update(readFileSync(new URL('../js/gunluk-ozet.js', import.meta.url))).digest('hex').slice(0, 16);
  assert.equal(ozet, ORTAK_OZET);
});

test('öğretmen formunun biçimi: öğle önce, uyku süresi, ruh hali simgesiyle', () => {
  const r = { tarih: '2026-10-16', yemek: { kahvalti: 'Biraz yedi', ogle: 'Hepsini yedi', ikindi: '' },
    uyku: { durum: 'Uyudu', dakika: '60 dk' }, mood: 'mutlu', not: 'Bahçede çok eğlendi.', yazanAd: ' Ayşe Öğretmen ' };
  assert.deepEqual(gunlukOzeti(r, '2026-10-16'), { tarih: '2026-10-16', bugunMu: true, gun: gunAdi('2026-10-16'),
    yemek: 'Hepsini yedi', uyku: 'Uyudu · 60\u00a0dk', ruhHali: '😊 Mutlu', not: 'Bahçede çok eğlendi.', ogretmen: 'Ayşe Öğretmen' });
  assert.equal(gunlukOzeti(r, '2026-10-17').bugunMu, false);
});

test('eksik öğün ve uyku türleri', () => {
  assert.equal(yemekOzeti({ kahvalti: 'Yemedi', ogle: '' }), 'Yemedi');
  assert.equal(yemekOzeti({}), '');
  assert.equal(uykuOzeti({ durum: 'Dinlendi', dakika: '45 dk' }), 'Dinlendi');
  assert.equal(uykuOzeti({ durum: 'Uyumadı' }), 'Uyumadı');
  assert.equal(uykuOzeti({ durum: '', dakika: '60 dk' }), '');
  assert.equal(ruhHaliOzeti('yorgun'), '🥱 Yorgun');
  assert.equal(ruhHaliOzeti('neşeli'), 'Neşeli');
});

test('eski/başka biçimler: düz metin ve değer nesneleri "[object Object]" yazmaz', () => {
  assert.equal(yemekOzeti('hepsini yedi'), 'Hepsini yedi');
  assert.equal(yemekOzeti({ miktar: '%85' }), '%85');
  assert.equal(uykuOzeti('1 saat'), '1 saat');
  assert.equal(duzMetin({ x: { y: 1 }, z: 'metin' }), 'metin');
  assert.equal(duzMetin(['a']), '');
  const o = gunlukOzeti({ tarih: '2026-10-14', ruhHali: 'sakin', aciklama: 'Not', ogretmenAd: 'Can' }, '2026-10-16');
  assert.equal(o.ruhHali, '😌 Sakin');
  assert.equal(o.not, 'Not');
  assert.equal(o.ogretmen, 'Can');
  assert.equal(o.bugunMu, false);
  assert.match(o.gun, /14 Ekim/);
  assert.equal(gunlukOzeti(null, '2026-10-16'), null);
  assert.equal(gunAdi('2026-13-40'), '');
});
