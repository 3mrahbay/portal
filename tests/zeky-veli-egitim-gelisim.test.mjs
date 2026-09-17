import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

test('veli eğitim modülü ZEKY S/T/U yolculuğunu ve açıklama/fotoğraf modelini okur', async () => {
  const kaynak = await readFile(new URL('moduller/veli-egitim-gelisim.js', kok), 'utf8');
  assert.match(kaynak, /S:\s*\{\s*ad:'Sunuldu'/);
  assert.match(kaynak, /T:\s*\{\s*ad:'Tekrar ediyor'/);
  assert.match(kaynak, /U:\s*\{\s*ad:'Ustalaştı'/);
  assert.match(kaynak, /detay\.asamalar/);
  assert.match(kaynak, /kazanimAnahtari/);
  assert.match(kaynak, /gozlemDurum/);
  assert.match(kaynak, /paylas!==false/);
  assert.match(kaynak, /aciklamaCoz/);
  assert.match(kaynak, /Bu kazanım neden önemli/);
});

test('veli eğitim fotoğraf fallback sorgusu yalnız seçili öğrenciyi ister', async () => {
  const kaynak = await readFile(new URL('moduller/veli-egitim-gelisim.js', kok), 'utf8');
  assert.match(kaynak, /where\('durum','==','onaylandi'\)/);
  assert.match(kaynak, /where\('ogrenciId','==',ogr\.id\)/);
  assert.match(kaynak, /if \(v\.ogrenciId !== ogr\.id\) return/);
  assert.doesNotMatch(kaynak, /URLSearchParams/);
  assert.match(kaynak, /state\.veliAktifOgrenci/);
});

test('portal öğretmen gözlemi aşama, not ve fotoğrafı aynı kazanım zincirine yazar', async () => {
  const kaynak = await readFile(new URL('moduller/ogretmen-egitim-gozlem.js', kok), 'utf8');
  assert.match(kaynak, /Sunuldu/);
  assert.match(kaynak, /Tekrar ediyor/);
  assert.match(kaynak, /Ustalaştı/);
  assert.match(kaynak, /kazanimAnahtari:anahtar/);
  assert.match(kaynak, /gozlemDurum:S\.durum/);
  assert.match(kaynak, /hedefTur:'ogrenci'/);
  assert.match(kaynak, /hedefOgrenciId:S\.ogrId/);
  assert.match(kaynak, /albumTuru:'egitim'/);
  assert.match(kaynak, /asamalar\[S\.durum\]=yeni/);
  assert.match(kaynak, /fotoDurum/);
  assert.match(kaynak, /globalAlpha=\.40/);
  assert.match(kaynak, /Bir Çiçek Koleji Anaokulu/);
  assert.match(kaynak, /BÇKA/);
});

test('eğitim köprüsü modül-içi caEgitimYukle yerine global caGo girişini kullanır', async () => {
  const kopru = await readFile(new URL('js/zeky-veli-egitim-koprusu.js', kok), 'utf8');
  const baslangic = await readFile(new URL('js/zeky-galeri-filigran-koprusu.js', kok), 'utf8');
  assert.match(kopru, /typeof win\.caGo === 'function'/);
  assert.match(kopru, /ekran === 'egitim'/);
  assert.match(kopru, /veliEgitimRender\('cicekAppRoot'\)/);
  assert.match(kopru, /gelismisGozlemKur/);
  assert.match(kopru, /__zekyEgitimKoprusuSurum/);
  assert.doesNotMatch(kopru, /typeof win\.caEgitimYukle/);
  assert.match(baslangic, /zeky-veli-egitim-koprusu\.js\?v=2/);
});

test('PWA cache eğitim zincirinin v2 dosyalarını taşır', async () => {
  const sw = await readFile(new URL('serviceworker.js', kok), 'utf8');
  assert.match(sw, /CACHE_VERSION = "v116"/);
  assert.match(sw, /portal-data\.js\?v=2/);
  assert.match(sw, /zeky-veli-egitim-koprusu\.js\?v=2/);
  assert.match(sw, /veli-egitim-gelisim\.js\?v=2/);
  assert.match(sw, /ogretmen-egitim-gozlem\.js\?v=2/);
});
