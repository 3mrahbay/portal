import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { okulQrMetni, okulQrAyarDogrula, okulQrYeniJeton, okulQrPosterDosyaAdi } from '../js/okul-qr-core.js';

test('ZEKY ve portal ayni okul QR bicimini kullanir', () => {
  assert.equal(okulQrMetni({ okulId:'BCKA', jeton:'ABC123' }), 'ZEKY-DEVAM:BCKA:ABC123');
  assert.equal(okulQrMetni({ okulId:'BCKA' }), '');
});

test('QR ve okul konumu hazirligi ayri ayri dogrulanir', () => {
  const eksik = okulQrAyarDogrula({ okulId:'BCKA', jeton:'A' });
  assert.equal(eksik.qrHazir, true);
  assert.equal(eksik.konumHazir, false);
  const hazir = okulQrAyarDogrula({ okulId:'BCKA', jeton:'A', enlem:40.9, boylam:29.3, yaricapMetre:75 });
  assert.equal(hazir.konumHazir, true);
  assert.equal(hazir.yaricapMetre, 75);
  assert.equal(okulQrAyarDogrula({ okulId:'BCKA', jeton:'A', enlem:null, boylam:null }).konumHazir, false);
});

test('jeton guvenli rastgele baytlardan uretilir', () => {
  const sahte = { getRandomValues(dizi) { dizi.forEach((_, i) => { dizi[i] = i + 1; }); return dizi; } };
  assert.equal(okulQrYeniJeton(sahte), '0102030405060708090A0B0C0D0E0F101112');
});

test('poster dosya adi baskiya uygun uretilir', () => {
  assert.equal(okulQrPosterDosyaAdi('Bir Çiçek'), 'Bir-Cicek-personel-giris-cikis-QR.png');
});

test('portal yonetim ekraninda QR indirme ve A4 baski vardir', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sw = await readFile(new URL('../serviceworker.js', import.meta.url), 'utf8');
  assert.match(html, /data-o="qrayar"/);
  assert.match(html, /<span>Okul QR<\/span>/);
  assert.match(html, /okulQrPngIndir/);
  assert.match(html, /okulQrYazdir/);
  assert.match(html, /config", "okulQR"/);
  assert.match(html, /QR yenilenirse mevcut tüm basılı QR/);
  assert.match(sw, /CACHE_VERSION = "v146-personel-devam-sunucu"/);
  assert.match(sw, /okul-qr-core\.js\?v=1/);
});
