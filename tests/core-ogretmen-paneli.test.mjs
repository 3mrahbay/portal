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

test('PWA dönem, gözlem ve ana sayfa performans sürümü v128', async () => {
  const s = await readFile(new URL('serviceworker.js', kok), 'utf8');
  assert.match(s, /CACHE_VERSION = "v128"/);
  assert.match(s, /zeky-gozlem-modal-modern\.js\?v=1/);
});

test('ana sayfa öğrenci ve dönem verisi tamamlandıktan sonra yalnız bir kez çizilir', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');

  const girisBas = s.indexOf('if (personelMi) {');
  const girisSon = s.indexOf('// Onay bekleyenler sayacını arka planda yükle', girisBas);
  const giris = s.slice(girisBas, girisSon);
  assert.match(giris, /adminHomeYukleniyorGoster\(\)/);
  assert.doesNotMatch(giris, /renderAdminHome\(\)/);
  assert.ok(giris.indexOf('adminHomeYukleniyorGoster()') < giris.indexOf('await loadOgrenciler()'));

  const yuklemeBas = s.indexOf('async function loadOgrenciler()');
  const yuklemeSon = s.indexOf('async function loadAyarlar()', yuklemeBas);
  const yukleme = s.slice(yuklemeBas, yuklemeSon);
  assert.doesNotMatch(yukleme, /renderAdminHome\(\)/);
  assert.match(yukleme, /finally\s*\{[\s\S]*adminHomeVeriYuklemesiTamamlandi\(\)/);
  assert.ok(yukleme.indexOf('ogrenciListeyiRoleGoreFiltrele') < yukleme.indexOf('adminHomeVeriYuklemesiTamamlandi()'));
});

test('ana sayfa kart görevleri eski render ve gizli sekmede yeniden sorgu başlatmaz', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');

  const planBas = s.indexOf('function adminHomeGorevPlanla');
  const planSon = s.indexOf('function adminHomeYukleniyorGoster', planBas);
  const planlayici = s.slice(planBas, planSon);
  assert.match(planlayici, /renderSurumu !== adminHomeRenderSurumu/);
  assert.match(planlayici, /!adminHomeSekmesiAktifMi\(\)/);
  assert.match(planlayici, /sonuc && typeof sonuc\.catch === "function"/);

  const renderBas = s.indexOf('function renderAdminHome()');
  const renderSon = s.indexOf('// Personel Durumu widget', renderBas);
  const render = s.slice(renderBas, renderSon);
  assert.match(render, /adminHomeZamanlayicilariniTemizle\(\)/);
  assert.match(render, /const renderSurumu = \+\+adminHomeRenderSurumu/);
  assert.doesNotMatch(render, /setTimeout\(/);
  assert.match(render, /adminHomeGorevPlanla\(hbDuyurulariDoldur/);
  assert.match(render, /adminHomeGorevPlanla\(hbEgitimDoldur/);
  assert.match(render, /adminHomeGorevPlanla\(hbOgretmenDoldur/);

  const sekmeBas = s.indexOf('document.querySelectorAll(".tab").forEach');
  const sekmeSon = s.indexOf('// Etkinlik & Takvim iç alt-sekme geçişi', sekmeBas);
  const sekmeler = s.slice(sekmeBas, sekmeSon);
  assert.match(sekmeler, /tab\.dataset\.tab !== "anasayfa"/);
  assert.match(sekmeler, /adminHomeArkaPlanCalismasiniDurdur\(\)/);
});
