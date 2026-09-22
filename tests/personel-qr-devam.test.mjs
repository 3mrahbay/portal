import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kaynak = await readFile(new URL('../js/personel-qr-devam.js', import.meta.url), 'utf8');
const modul = await import('data:text/javascript;base64,' + Buffer.from(kaynak).toString('base64'));
const { qrCoz, qrEslesir, mesafeMetre, devamDurumu, konumKarari } = modul;

test('yalniz ZEKY devam QR bicimini kabul eder', () => {
  assert.deepEqual(qrCoz('ZEKY-DEVAM:BCKA:ABC123'), { okulId: 'BCKA', jeton: 'ABC123' });
  assert.equal(qrCoz('https://ornek.test/qr'), null);
  assert.equal(qrEslesir('ZEKY-DEVAM:BCKA:ABC123', { okulId: 'BCKA', jeton: 'ABC123' }), true);
  assert.equal(qrEslesir('ZEKY-DEVAM:BCKA:ESKI', { okulId: 'BCKA', jeton: 'ABC123' }), false);
});

test('devam durumu son hareketten guvenli bicimde turetilir', () => {
  const hareketler = [
    { tip: 'mola-basla', zaman: '2026-09-22T09:00:00Z' },
    { tip: 'giris', zaman: '2026-09-22T08:00:00Z' },
    { tip: 'mola-bitir', zaman: '2026-09-22T09:20:00Z' }
  ];
  assert.equal(devamDurumu(hareketler), 'iceride');
  assert.equal(devamDurumu([...hareketler, { tip: 'cikis', zaman: '2026-09-22T17:00:00Z' }]), 'disarida');
});

test('okul yaricapi disindaki konumu reddeder', () => {
  const okul = { enlem: 40.900000, boylam: 29.300000, yaricapMetre: 100 };
  assert.equal(konumKarari({ enlem: 40.900100, boylam: 29.300100, dogrulukMetre: 12 }, okul).uygun, true);
  const uzak = konumKarari({ enlem: 40.904000, boylam: 29.304000, dogrulukMetre: 10 }, okul);
  assert.equal(uzak.uygun, false);
  assert.equal(uzak.kod, 'okul-disinda');
  assert.ok(uzak.uzaklikMetre > 100);
});

test('eksik veya guvenilmez konumda kayda izin vermez', () => {
  const okul = { enlem: 40.9, boylam: 29.3, yaricapMetre: 100 };
  assert.equal(konumKarari(null, okul).kod, 'cihaz-konumu-eksik');
  assert.equal(konumKarari({ enlem: 40.9, boylam: 29.3, dogrulukMetre: 250 }, okul).kod, 'konum-dogrulugu-yetersiz');
  assert.equal(konumKarari({ enlem: 40.9, boylam: 29.3, dogrulukMetre: 10 }, {}).kod, 'okul-konumu-eksik');
});

test('haversine ayni noktada sifir ve simetriktir', () => {
  assert.equal(mesafeMetre(40.9, 29.3, 40.9, 29.3), 0);
  assert.equal(mesafeMetre(40.9, 29.3, 40.91, 29.31), mesafeMetre(40.91, 29.31, 40.9, 29.3));
});
