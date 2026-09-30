import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../portal-galeri-core.js', import.meta.url), 'utf8');

test('portal veli galerisi tam ekran acma olayini kaydeder', () => {
  assert.match(src, /galeriVeliEtkilesimKaydet\(aktifLightboxOge, "acma"\)/);
  assert.match(src, /"galeri", oge\.id, "etkilesimler"/);
  assert.match(src, /veliEmailHash/);
  assert.match(src, /crypto\.subtle\.digest\("SHA-256"/);
});

test('portal indirmede tamamlandi ve baslatildi ayrimini korur', () => {
  assert.match(src, /indirmeDurumu:"tamamlandi"/);
  assert.match(src, /indirmeDurumu:"baslatildi"/);
  assert.match(src, /mp4Url \|\| aktifLightboxOge\.bunnyUrl \|\| aktifLightboxOge\.url/);
});

test('yonetim kartinda hedefe gore acma indirme favori rozeti vardir', () => {
  assert.match(src, /👁.*↓.*♥/s);
  assert.match(src, /galeriEtkilesimRozetleriYenile/);
  assert.match(src, /galeriEtkilesimPanelAc/);
});

test('yonetim detayinda acan ve acmayan veli hesaplari ayrilir', () => {
  assert.match(src, /Açanlar/);
  assert.match(src, /Henüz açmayanlar/);
  assert.match(src, /veli hesabı açtı/);
  assert.match(src, /İndirme başlatıldı/);
});

test('etkilesim belgesinde ham e-posta saklanmaz', () => {
  const bas = src.indexOf('async function galeriVeliEtkilesimKaydet');
  const son = src.indexOf('function galeriHedefVeliler', bas);
  assert.ok(bas >= 0 && son > bas);
  const bolum = src.slice(bas, son);
  assert.match(bolum, /veliUid/);
  assert.match(bolum, /veliEmailHash/);
  assert.doesNotMatch(bolum, /eposta\s*:/i);
  assert.doesNotMatch(bolum, /email\s*:/i);
});
