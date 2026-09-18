import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

test('öğretmen öğrenci listesi okunabilen aktif dönem belgelerini kesin kaynak kullanır', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.match(s, /ogretmenDonemBelgeleriOkundu/);
  assert.match(s, /Object\.keys\(ayarListesi \|\| \{\}\)\.length > 0/);
  assert.match(s, /if \(!donemVerisi\) return false/);
  assert.match(s, /getOgrenciDurum\(o, donemVerisi\) !== "aktif"/);
});

test('gözlem doğrudan çekirdek modalda S T U not ve fotoğraf sunar', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.match(s, /caGozlemModalArka/);
  assert.match(s, /Tekrar Ediyor/);
  assert.match(s, /Ustalaştı/);
  assert.match(s, /caGozlemFotoYukle/);
  assert.match(s, /kazanimAnahtari/);
  assert.match(s, /gozlemDurum/);
  assert.match(s, /albumTuru:"egitim"/);
  assert.match(s, /asamalar\[st\.seviye\]/);
  assert.match(s, /Bir Çiçek Koleji Anaokulu/);
  assert.match(s, /globalAlpha=\.40/);
});

test('gözlem açıcı dış portal-data ya da gözlem modülü importuna bağlı değildir', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  const i = s.indexOf('window.zekyGelismisGozlemAcCore');
  assert.ok(i >= 0);
  const parca = s.slice(i, i + 900);
  assert.doesNotMatch(parca, /await import\(/);
  assert.match(parca, /window\.caGozlemAc/);
});

test('galeri onayı fotoğrafı doğru S T U aşamasına da yazar', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.match(s, /const asamaKod = oge\?\.gozlemDurum/);
  assert.match(s, /asamalar\[asamaKod\]/);
  assert.match(s, /fotoDurum:durum/);
});

test('öğretmen mesaj arayüzünde e-posta toast veya inline veli hedefi üretmez', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.doesNotMatch(s, /Mesajlaşma bölümünden " \+ email \+ " ile görüşebilirsiniz/);
  assert.match(s, /Mesajlaşma bölümü açıldı\./);
  assert.match(s, /window\.__zekyMesajVeliSecim/);
  assert.match(s, /onclick="mesajYeniVeliSec\(\$\{idx\}\)"/);
  assert.match(s, /veliyeMesajAcByIndex/);
});

test('gözlem popup aşamaları görünür, tek seçimli ve klavye erişilebilirdir', async () => {
  const s = await readFile(new URL('js/zeky-gozlem-modal-modern.js', kok), 'utf8');
  assert.match(s, /#caGozlemModalRoot \.ca-sev/);
  assert.match(s, /\.ca-sev\.on/);
  assert.match(s, /pointer-events:auto!important/);
  assert.match(s, /role', 'radio'/);
  assert.match(s, /aria-checked/);
  assert.match(s, /e\.key !== 'Enter' && e\.key !== ' '/);
  assert.match(s, /window\.caGozlemSeviye\(buton\.dataset\.s\)/);
  assert.match(s, /Çalışma ilk kez tanıtıldı/);
  assert.match(s, /Pekiştirmek için çalışıyor/);
  assert.match(s, /Bağımsız ve güvenli uyguluyor/);
});

test('modern gözlem popup modülü canlı başlangıç zincirinde yüklenir', async () => {
  const s = await readFile(new URL('js/zeky-randevu-modal-koprusu.js', kok), 'utf8');
  assert.match(s, /zeky-gozlem-modal-modern\.js\?v=1/);
});

test('PWA dönem ve gözlem çekirdek sürümü v125', async () => {
  const s = await readFile(new URL('serviceworker.js', kok), 'utf8');
  assert.match(s, /CACHE_VERSION = "v125"/);
  assert.match(s, /zeky-gozlem-modal-modern\.js\?v=1/);
});
