import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

test('portal galeri uyumluluk katmanı BÇKA filigranını ve %60 saydamlığı tanımlar', async () => {
  const kaynak = await readFile(new URL('portal-galeri.js', kok), 'utf8');
  assert.match(kaynak, /BÇKA/);
  assert.match(kaynak, /Bir Çiçek Koleji Anaokulu/);
  assert.match(kaynak, /saydamlik:\s*0\.60/);
  assert.match(kaynak, /globalAlpha\s*=\s*0\.40/);
  assert.match(kaynak, /albumId/);
  assert.match(kaynak, /portal-galeri-core\.js/);
});

test('veli galerisi yalnız onaylı medyayı ister ve sınıf adlarını güvenli eşler', async () => {
  const kaynak = await readFile(new URL('moduller/veli-galeri.js', kok), 'utf8');
  assert.match(kaynak, /fb\.where\('durum','==','onaylandi'\)/);
  assert.match(kaynak, /sinifEslesir\(v\.hedefDeger,sinif\)/);
  assert.match(kaynak, /albumId/);
  assert.match(kaynak, /g\.medya\.length>1/);
  assert.match(kaynak, /albumAc/);
  assert.match(kaynak, /buyut/);
});
