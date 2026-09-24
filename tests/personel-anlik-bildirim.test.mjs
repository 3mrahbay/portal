import { test } from 'node:test';
import assert from 'node:assert/strict';
const m = await import('../moduller/personel-anlik-bildirim.js');
const { olayUret, kullaniciyaUygunMu, ilkYuklemedeGosterilsinMi, canliGosterilsinMi, metinOlustur, ayarBirlestir, VARSAYILAN } = m;

const sabah = (x = {}) => ({ ogrenciId: 'c1', ogrenciAd: 'Ada Yıldız', sinif: 'Papatya', tarih: '2026-09-24', veliBildirdi: true, veliBildirimSaati: '2026-09-24T05:10:00.000Z', ...x });
const zil = (x = {}) => ({ ogrenciId: 'c2', ogrenciAd: 'Can Deniz', sinif: 'Lale', tarih: '2026-09-24', durum: 'yolda', hedefSaat: '16:30', alanKisi: 'Anne', olusturuldu: '2026-09-24T13:00:00.000Z', ...x });

test('Sabah: yalnız "veli bildirdi, teslim alınmadı" bildirim üretir', () => {
  assert.equal(olayUret('sabah', 'c1__2026-09-24', sabah()).anahtar, 'sabah:c1__2026-09-24:2026-09-24T05:10:00.000Z');
  assert.equal(olayUret('sabah', 'c1__2026-09-24', sabah({ sinifaGirisOnayi: '2026-09-24T05:20:00Z' })), null);
  assert.equal(olayUret('sabah', 'c1__2026-09-24', sabah({ veliBildirdi: false })), null);
});

test('Okul Zili: yalnız "yolda" bildirim üretir; hazır/teslim/iptal üretmez', () => {
  assert.ok(olayUret('zil', 'c2__2026-09-24', zil()));
  for (const durum of ['hazir', 'teslim', 'iptal']) assert.equal(olayUret('zil', 'c2__2026-09-24', zil({ durum })), null);
});

test('Veli yeniden bildirirse yeni anahtar → yeni açılır pencere', () => {
  const a = olayUret('sabah', 'c1__d', sabah()).anahtar;
  const b = olayUret('sabah', 'c1__d', sabah({ veliBildirimSaati: '2026-09-24T05:40:00.000Z' })).anahtar;
  assert.notEqual(a, b);
});

test('Yönetim ve danışma tüm okulu; öğretmen yalnız kendi sınıfını görür', () => {
  const o = olayUret('sabah', 'c1__d', sabah());
  assert.equal(kullaniciyaUygunMu(o, { rol: 'mudur' }), true);
  assert.equal(kullaniciyaUygunMu(o, { rol: 'danisma' }), true);
  assert.equal(kullaniciyaUygunMu(o, { rol: 'ogretmen', siniflar: ['Papatya'] }), true);
  assert.equal(kullaniciyaUygunMu(o, { rol: 'ogretmen', siniflar: ['Lale'] }), false);
  assert.equal(kullaniciyaUygunMu(o, { rol: 'ogretmen', siniflar: [] }), false);
  assert.equal(kullaniciyaUygunMu(o, { rol: 'muhasebe' }), false);
  assert.equal(kullaniciyaUygunMu(o, { rol: 'pdr', isAdmin: true }), true);
});

test('Ayar belgesi rol listelerini daraltabilir; bozuk değer varsayılana düşer', () => {
  const a = ayarBirlestir({ sabahRolleri: ['danisma'], ilkYuklemePencereDk: 'x' });
  assert.deepEqual(a.sabahRolleri, ['danisma']);
  assert.deepEqual(a.zilRolleri, VARSAYILAN.zilRolleri);
  assert.equal(a.ilkYuklemePencereDk, 30);
  assert.equal(ayarBirlestir({ acik: false }).acik, false);
  const o = olayUret('sabah', 'c1__d', sabah());
  assert.equal(kullaniciyaUygunMu(o, { rol: 'mudur' }, a), false);
});

test('Portal açılırken yalnız son 30 dakikadaki bekleyenler gösterilir', () => {
  const simdi = Date.parse('2026-09-24T05:30:00.000Z');
  assert.equal(ilkYuklemedeGosterilsinMi({ zaman: '2026-09-24T05:10:00.000Z' }, simdi), true);
  assert.equal(ilkYuklemedeGosterilsinMi({ zaman: '2026-09-24T04:40:00.000Z' }, simdi), false);
  assert.equal(ilkYuklemedeGosterilsinMi({ zaman: '' }, simdi), false);
  assert.equal(canliGosterilsinMi({ zaman: '' }, simdi), true);
  assert.equal(canliGosterilsinMi({ zaman: '2026-09-24T01:00:00.000Z' }, simdi), false);
});

test('Toplu bildirim tek pencere: 5 satır + fazlası', () => {
  const liste = Array.from({ length: 7 }, (_, i) => olayUret('sabah', `c${i}__d`, sabah({ ogrenciAd: `Çocuk ${i}` })));
  const t = metinOlustur('sabah', liste);
  assert.equal(t.baslik, '7 öğrenci yola çıktı');
  assert.equal(t.satirlar.length, 5);
  assert.equal(t.fazla, 2);
  assert.equal(metinOlustur('zil', [olayUret('zil', 'c2__d', zil())]).baslik, 'Can Deniz için almaya geliyorlar');
  assert.match(metinOlustur('zil', [olayUret('zil', 'c2__d', zil())]).satirlar[0], /hedef 16:30/);
});
