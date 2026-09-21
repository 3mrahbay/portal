import test from 'node:test';
import assert from 'node:assert/strict';
import { veliOdemeOzetiHesapla } from '../js/zeky-veli-odeme-ozeti.js';

const eylul = new Date('2026-09-16T09:00:00Z');

function plan(overrides = {}) {
  return {
    aidatAyarlari: {
      baslangicAyi: '2026-09', taksitSayisi: 10, aylikAidat: 38500,
      iDonemAylik: 38500, iiDonemAylik: 42000,
      ...overrides
    },
    aylikOdemeler: {}
  };
}

test('ödeme planı yoksa hiçbir demo tutar göstermez', () => {
  const result = veliOdemeOzetiHesapla(null, eylul);
  assert.equal(result.durum, 'plansiz');
  assert.equal(result.tutar, null);
});

test('cari ay için gerçek dönem tutarını gösterir', () => {
  const result = veliOdemeOzetiHesapla(plan(), eylul);
  assert.equal(result.baslik, 'Bu ay ödemesi');
  assert.equal(result.rozet, 'Bekliyor');
  assert.equal(result.tutar, 38500);
  assert.match(result.aciklama, /Eylül 2026/);
});

test('aylık kayıttaki elle düzeltilmiş beklenen tutarı önceliklendirir', () => {
  const data = plan();
  data.aylikOdemeler['2026-09'] = { beklenenTutar: 41000 };
  const result = veliOdemeOzetiHesapla(data, eylul);
  assert.equal(result.tutar, 41000);
});

test('kısmi ödemede yalnız kalan gerçek bakiyeyi gösterir', () => {
  const data = plan();
  data.aylikOdemeler['2026-09'] = { odenenTutar: 10000, odendi: false };
  const result = veliOdemeOzetiHesapla(data, eylul);
  assert.equal(result.durum, 'kismi');
  assert.equal(result.tutar, 28500);
  assert.match(result.aciklama, /10\.000 ₺ ödendi/);
});

test('cari ay ödendiyse gerçek ödendi durumunu gösterir', () => {
  const data = plan();
  data.aylikOdemeler['2026-09'] = { odenenTutar: 38500, odendi: true };
  const result = veliOdemeOzetiHesapla(data, eylul);
  assert.equal(result.durum, 'odendi');
  assert.equal(result.tutar, 38500);
  assert.equal(result.eylem, 'Detayları Gör');
});

test('eski açık taksit varsa cari aydan önce gecikmiş ödemeyi gösterir', () => {
  const data = plan({ baslangicAyi: '2026-07', taksitSayisi: 10 });
  const result = veliOdemeOzetiHesapla(data, eylul);
  assert.equal(result.durum, 'gecikmis');
  assert.equal(result.baslik, 'Gecikmiş ödeme');
  assert.match(result.aciklama, /Temmuz 2026/);
});

test('ödenmemiş ön ödeme aylık taksitlerden önce gösterilir', () => {
  const result = veliOdemeOzetiHesapla(plan({ onOdeme: 25000 }), eylul);
  assert.equal(result.baslik, 'Kayıt ön ödemesi');
  assert.equal(result.tutar, 25000);
});

test('peşin ödeme planı tek başına tahsilat kanıtı sayılmaz', () => {
  const result = veliOdemeOzetiHesapla(plan({ pesinOdeme: true }), eylul);
  assert.equal(result.durum, 'bekliyor');
  assert.equal(result.tutar, 38500);
});

test('Eylül kısmi borcu Ekim ödemesiyle gizlenmez', () => {
  const data = plan();
  data.aylikOdemeler['2026-09'] = { odenenTutar: 10000, odendi: false };
  data.aylikOdemeler['2026-10'] = { odenenTutar: 38500, odendi: true };
  const result = veliOdemeOzetiHesapla(data, new Date('2026-10-05T09:00:00Z'));
  assert.equal(result.durum, 'kismi');
  assert.equal(result.tutar, 28500);
  assert.match(result.aciklama, /Eylül 2026/);
  assert.equal(result.eylem, 'Ödeme Bildir');
});

test('eski kısmi bakiye daha yeni gecikmiş aydan önce gösterilir', () => {
  const data = plan();
  data.aylikOdemeler['2026-09'] = { odenenTutar: 10000, odendi: false };
  const result = veliOdemeOzetiHesapla(data, new Date('2026-12-20T09:00:00Z'));
  assert.equal(result.tutar, 28500);
  assert.match(result.aciklama, /Eylül 2026/);
});
