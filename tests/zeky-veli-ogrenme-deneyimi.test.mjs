import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

test('veli ana sayfası son sunumu, tüm kazanımları ve günlük akışı bağlar', async () => {
  const s = await readFile(new URL('js/zeky-veli-ogrenme-deneyimi.js', kok), 'utf8');
  assert.match(s, /SON EĞİTİM SUNUMU/);
  assert.match(s, /TÜM KAZANIMLAR/);
  assert.match(s, /Günlük Akış/);
  assert.match(s, /sonGozlem/);
  assert.match(s, /__zekyEgitimBaslangic/);
  assert.match(s, /gunlukRaporlar/);
});

test('veli bildirimleri yalnız seçili çocuğun alt koleksiyonunu ve hedefli okul akışlarını kullanır', async () => {
  const s = await readFile(new URL('js/zeky-veli-ogrenme-deneyimi.js', kok), 'utf8');
  assert.match(s, /'ogrenciler',o\.id,'bildirimler'/);
  assert.match(s, /etkinlikUygun\(v,o\)/);
  assert.match(s, /egitim_gelisim/);
  assert.match(s, /duyuruPopupGetir/);
  assert.doesNotMatch(s, /collection\(p\.db,'ogrenciler'\)/);
  assert.doesNotMatch(s, /personeller|kullanicilar/);
});

test('öğretmen gözlemi alan klasörü, filigran sürümü ve veli bildirimi üretir', async () => {
  const s = await readFile(new URL('moduller/ogretmen-egitim-gozlem.js', kok), 'utf8');
  assert.match(s, /alanId,alanAd:alan\?\.ad/);
  assert.match(s, /grupAd:grup\?\.ad/);
  assert.match(s, /albumId:`egitim\|\$\{S\.program\}\|\$\{alanId\}`/);
  assert.match(s, /filigranVersiyon:2/);
  assert.match(s, /'ogrenciler',S\.ogrId,'bildirimler'/);
  assert.match(s, /tip:'egitim_gelisim'/);
  assert.match(s, /sonGozlem=.*alanAd/);
});

test('veli galerisi eğitim klasörlerini program ve gelişim alanına ayırır', async () => {
  const s = await readFile(new URL('moduller/veli-galeri.js', kok), 'utf8');
  assert.match(s, /\{ k:'egitim', ad:'Eğitim' \}/);
  assert.match(s, /function egitimKlasorleri/);
  assert.match(s, /egitimProgramAc/);
  assert.match(s, /egitimAlanAc/);
  assert.match(s, /alanKodu/);
  assert.match(s, /where\('hedefTur','==','ogrenci'\)/);
  assert.match(s, /where\('hedefDeger','==',ogr\.id\)/);
});

test('galeri onayı kazanım açıklaması, aşama ve öğrenci bağlamını gösterir', async () => {
  const s = await readFile(new URL('js/zeky-galeri-onay-egitim.js', kok), 'utf8');
  assert.match(s, /Gözlem açıklaması/);
  assert.match(s, /Gelişim alanı/);
  assert.match(s, /hedefOgrenciAd/);
  assert.match(s, /gozlemDurum/);
  assert.match(s, /galeriOnayla/);
  assert.match(s, /galeriReddet/);
});

test('portal yeni sürümü CDN ve PWA önbelleğine takılmadan yükler', async () => {
  const index = await readFile(new URL('index.html', kok), 'utf8');
  const sw = await readFile(new URL('serviceworker.js', kok), 'utf8');
  assert.match(index, /PORTAL_SURUM = "v104"/);
  assert.match(index, /serviceworker\.js\?\$\{swSurum\}/);
  assert.match(index, /updateViaCache:\s*"none"/);
  assert.match(index, /zeky-randevu-modal-koprusu\.js\?v=5/);
  assert.match(sw, /CACHE_VERSION = "v123"/);
  assert.match(sw, /zeky-randevu-modal-koprusu\.js\?v=5/);
});
