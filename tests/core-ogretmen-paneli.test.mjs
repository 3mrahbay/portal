import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

test('öğretmen öğrenci listesi aktif dönem master işaretini zorunlu tutar', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.match(s, /masterDonemAktif/);
  assert.match(s, /aktifDonemDurum/);
  assert.match(s, /String\(o\.aktifDonem \|\| ""\) === String\(AKTIF_DONEM\)/);
  assert.match(s, /masterSenkronYetkili/);
});

test('gözlem kısayolu ve Eğitim kartı doğrudan çekirdekte bulunur', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  const m = await readFile(new URL('moduller/ogretmen-egitim-gozlem.js', kok), 'utf8');
  assert.match(s, /zekyCoreYeniGozlemKart/);
  assert.match(s, /zekyYeniEgitimGozlemiAc/);
  assert.match(s, /zekyGelismisGozlemAcCore/);
  assert.match(s, /ogretmen-egitim-gozlem\.js\?v=4/);
  assert.match(m, /export async function gozlemAc/);
});

test('öğretmen mesaj arayüzünde e-posta toast veya inline veli hedefi üretmez', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.doesNotMatch(s, /Mesajlaşma bölümünden " \+ email \+ " ile görüşebilirsiniz/);
  assert.match(s, /Mesajlaşma bölümü açıldı\./);
  assert.match(s, /window\.__zekyMesajVeliSecim/);
  assert.match(s, /onclick="mesajYeniVeliSec\(\$\{idx\}\)"/);
  assert.match(s, /veliyeMesajAcByIndex/);
});

test('PWA çekirdek hotfix v118 ve v4 gözlem dosyasını taşır', async () => {
  const s = await readFile(new URL('serviceworker.js', kok), 'utf8');
  assert.match(s, /CACHE_VERSION = "v119"/);
  assert.match(s, /portal-data\.js\?v=4/);
  assert.match(s, /ogretmen-egitim-gozlem\.js\?v=4/);
});

test('öğretmen dönem işaretleri tamamlanmadıysa Yoklama ile aynı aktiflik fallbackini kullanır', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.match(s, /masterDonemIsaretleriHazir/);
  assert.match(s, /ogrenciList\.every/);
  assert.match(s, /getOgrenciDurum\(o, donemVerisi\) !== "aktif"/);
  assert.match(s, /Yoklama ekranının kullandığı aktiflik mantığıyla aynı fallback/);
});
