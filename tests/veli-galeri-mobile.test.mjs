import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

test('veli galerisi mobil lightbox kontrolleri, indirme ve swipe davranışını içerir', async () => {
  const kaynak = await readFile(new URL('moduller/veli-galeri.js', kok), 'utf8');
  assert.match(kaynak, /vg-controls/);
  assert.match(kaynak, /data-a="download"/);
  assert.match(kaynak, /touchstart/);
  assert.match(kaynak, /touchend/);
  assert.match(kaynak, /ArrowLeft/);
  assert.match(kaynak, /ArrowRight/);
  assert.match(kaynak, /fetch\(m\.bunnyUrl/);
  assert.match(kaynak, /BÇKA/);
  assert.match(kaynak, /Bir Çiçek Koleji Anaokulu/);
});

test('veli galerisi onay ve hedef izolasyonu kontrollerini korur', async () => {
  const kaynak = await readFile(new URL('moduller/veli-galeri.js', kok), 'utf8');
  assert.match(kaynak, /fb\.where\('durum','==','onaylandi'\)/);
  assert.match(kaynak, /v\.hedefTur==='sinif'&&sinifEslesir\(v\.hedefDeger,sinif\)/);
  assert.match(kaynak, /v\.hedefTur==='ogrenci'/);
  assert.match(kaynak, /v\.hedefDeger===ogr\.id/);
  assert.match(kaynak, /v\.hedefOgrenciId===ogr\.id/);
});
