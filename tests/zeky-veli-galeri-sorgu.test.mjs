import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

test('veli galeri modülü yalnızca onaylanmış medyayı Firestore’dan ister', async () => {
  const kaynak = await readFile(new URL('moduller/veli-galeri.js', kok), 'utf8');
  assert.match(kaynak, /fb\.where\("durum",\s*"==",\s*"onaylandi"\)/);
  assert.doesNotMatch(kaynak, /getDocs\(fb\.collection\(db,\s*"galeri"\)\)/);
});

test('klasik veli galeri ekranı da yalnızca onaylanmış medyayı ister', async () => {
  const kaynak = await readFile(new URL('index.html', kok), 'utf8');
  const baslangic = kaynak.indexOf('async function veliRenderGaleri()');
  const bitis = kaynak.indexOf('window.veliGaleriFilter', baslangic);
  assert.ok(baslangic >= 0 && bitis > baslangic, 'veli galeri bölümü bulunamadı');
  const bolum = kaynak.slice(baslangic, bitis);
  assert.match(bolum, /where\("durum",\s*"==",\s*"onaylandi"\)/);
  assert.doesNotMatch(bolum, /getDocs\(collection\(db,\s*"galeri"\)\)/);
});
