import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

test('öğretmen öğrenci listesi güvenli aktif dönem özetini kesin kaynak kullanır', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.match(s, /ogretmenDonemOzetiHazir/);
  assert.match(s, /anaKayitDonemOzetiKullaniliyor = true/);
  assert.match(s, /&& anaKayitDonemOzetiKullaniliyor/);
  assert.match(s, /if \(!donemVerisi\) return false/);
  assert.match(s, /getOgrenciDurum\(o, donemVerisi\) !== "aktif"/);
});

test('öğretmen sınıfları personel kaydından alınır ve adlar güvenli eşleştirilir', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  const kaynakBas = s.indexOf('async function personelSiniflariGetir');
  const kaynakSon = s.indexOf('// ============================================================', kaynakBas);
  const kaynak = s.slice(kaynakBas, kaynakSon);
  assert.match(kaynak, /personelKaydi\?\.siniflar/);
  assert.match(kaynak, /personelKaydi\?\.sinifAtamalari/);
  assert.match(kaynak, /if \(belgeSiniflari\.length\) return \[\.\.\.new Set\(belgeSiniflari\)\]/);
  assert.match(s, /personelSiniflariGetir\(email, personel\)/);

  const filtreBas = s.indexOf('function ogrenciErisilebilirMi');
  const filtreSon = s.indexOf('// Öğrenci listesini role göre filtrele', filtreBas);
  const filtre = s.slice(filtreBas, filtreSon);
  assert.match(filtre, /if \(!\(aktifKullaniciSiniflari \|\| \[\]\)\.length\) return false/);
  assert.match(filtre, /return sinifGorunur\(sinif\)/);
  assert.doesNotMatch(filtre, /aktifKullaniciSiniflari\.includes\(sinif\)/);
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

test('PWA dönem, gözlem, tek eğitim kartı ve aktif dönem velileri sürümü v135', async () => {
  const s = await readFile(new URL('serviceworker.js', kok), 'utf8');
  assert.match(s, /CACHE_VERSION = "v135"/);
  assert.match(s, /zeky-gozlem-modal-modern\.js\?v=1/);
});

test('veli listesi yalnız aktif dönem öğrencilerinden türetilir', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  const filtreBas = s.indexOf('function veliAktifDonemOgrencisiMi');
  const filtreSon = s.indexOf('window.veliListesiYukle', filtreBas);
  const filtre = s.slice(filtreBas, filtreSon);
  const yukleBas = s.indexOf('window.veliListesiYukle');
  const yukleSon = s.indexOf('function veliFiltreliListe', yukleBas);
  const yukle = s.slice(yukleBas, yukleSon);

  assert.match(filtre, /ayarListesi\[o\.id\]/);
  assert.match(filtre, /getOgrenciDurum\(o, ayar\)/);
  assert.match(filtre, /String\(o\.aktifDonem \|\| ""\) !== donem/);
  assert.match(filtre, /o\.aktifDonemDurum \|\| o\.durum \|\| "aktif"/);
  assert.match(yukle, /ogrenciler = ogrenciler\.filter\(veliAktifDonemOgrencisiMi\)/);
  assert.ok(
    yukle.indexOf('filter(veliAktifDonemOgrencisiMi)') < yukle.indexOf('ogrencileriRoleGoreSuz(ogrenciler)'),
    'aktif dönem filtresi rol filtresinden önce uygulanmalı'
  );
  assert.ok(
    yukle.indexOf('ogrencileriRoleGoreSuz(ogrenciler)') < yukle.indexOf('mukerrerTespit(ogrenciler)'),
    'mükerrer kontrolü yalnız görünür aktif dönem öğrencilerinde çalışmalı'
  );
});

test('eğitim sayfasında tek gözlem kartı takip başlığının hemen altında kalır', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  const kopru = await readFile(new URL('js/zeky-ogrenci-guvenlik-koprusu.js', kok), 'utf8');
  const hero = s.indexOf('id="zekyEgitimTakipHero"');
  const kart = s.indexOf('id="zekyCoreYeniGozlemKart"');
  const programlar = s.indexOf('<!-- 5 PROGRAM + BRANŞLAR (BCDM) -->');

  assert.equal((s.match(/id="zekyCoreYeniGozlemKart"/g) || []).length, 1);
  assert.equal((s.match(/id="zekyYeniGozlemKart"/g) || []).length, 0);
  assert.ok(hero >= 0 && hero < kart && kart < programlar);
  assert.match(kopru, /querySelectorAll\('#zekyYeniGozlemKart'\)\.forEach\(kart => kart\.remove\(\)\)/);
  assert.match(kopru, /hero\.after\(kart\)/);
  assert.doesNotMatch(kopru, /kart\.innerHTML=.*Yeni Eğitim Gözlemi/);
});

test('ana sayfa veri beklerken kullanılabilir kalır ve ağır kartları yalnız kesin veriyle başlatır', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');

  const girisBas = s.indexOf('if (personelMi) {');
  const girisSon = s.indexOf('// Onay bekleyenler sayacını arka planda yükle', girisBas);
  const giris = s.slice(girisBas, girisSon);
  assert.match(giris, /adminHomeYukleniyorGoster\(\)/);
  assert.doesNotMatch(giris, /renderAdminHome\(\)/);
  assert.ok(giris.indexOf('adminHomeYukleniyorGoster()') < giris.indexOf('await loadOgrenciler()'));
  assert.doesNotMatch(giris, /await ozellikBayraklariYukle\(\)/);
  assert.match(giris, /ozellikBayraklariYukle\(\)\s*\.then/);

  const beklemeBas = s.indexOf('function adminHomeYukleniyorGoster()');
  const beklemeSon = s.indexOf('function adminHomeVeriYuklemesiTamamlandi', beklemeBas);
  const bekleme = s.slice(beklemeBas, beklemeSon);
  assert.match(bekleme, /ogretmenHomeHTML\(ad\)/);
  assert.match(bekleme, /yonetimHomeHTML\(ad\)/);
  assert.match(bekleme, /adminHomeYuklemeDurumu/);
  assert.match(bekleme, /menüleri kullanabilirsiniz/);
  assert.doesNotMatch(bekleme, /ogretmenHomeVeriYukle\(/);
  assert.doesNotMatch(bekleme, /hbDuyurulariDoldur/);

  const yuklemeBas = s.indexOf('async function loadOgrenciler()');
  const yuklemeSon = s.indexOf('async function loadAyarlar()', yuklemeBas);
  const yukleme = s.slice(yuklemeBas, yuklemeSon);
  assert.doesNotMatch(yukleme, /renderAdminHome\(\)/);
  assert.match(yukleme, /finally\s*\{[\s\S]*adminHomeVeriYuklemesiTamamlandi\(\)/);
  assert.match(yukleme, /aktifKullaniciRol === "ogretmen"[\s\S]*ogrenciListeyiRoleGoreFiltrele\(ogrenciList\)/);
  assert.ok(yukleme.indexOf('ogrenciListeyiRoleGoreFiltrele(ogrenciList)') < yukleme.indexOf('await loadAyarlar()'));
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
  assert.match(render, /adminHomeGorevleriSirala\(\[/);
  assert.match(render, /\["duyurular", hbDuyurulariDoldur\]/);
  assert.match(render, /\["eğitim özeti", hbEgitimDoldur\]/);
  assert.match(render, /\["personel özeti", hbOgretmenDoldur\]/);

  const sekmeBas = s.indexOf('document.querySelectorAll(".tab").forEach');
  const sekmeSon = s.indexOf('// Etkinlik & Takvim iç alt-sekme geçişi', sekmeBas);
  const sekmeler = s.slice(sekmeBas, sekmeSon);
  assert.match(sekmeler, /tab\.dataset\.tab !== "anasayfa"/);
  assert.match(sekmeler, /adminHomeArkaPlanCalismasiniDurdur\(\)/);
});

test('çıktı ve grafik kütüphaneleri açılışta değil ilgili araçta yüklenir', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.doesNotMatch(s, /<script\s+src="[^"]*(?:jspdf|docx@|Chart\.js|jszip|FileSaver)/i);
  assert.doesNotMatch(s, /<script\s+src="(?:pdf-sayfa-bolunmesi|pdf-estetik-duzeltme|pdf-ust-baslik-fix-v2)\.js"/);
  assert.match(s, /const PORTAL_ARAC_KAYNAKLARI = \{/);
  assert.match(s, /window\.portalAracYukle = function\(ad\)/);
  assert.match(s, /await window\.portalAracYukle\("pdf"\)/);
  assert.match(s, /await window\.portalAracYukle\("docx"\)/);
  assert.match(s, /await window\.portalAracYukle\("zip"\)/);
  assert.match(s, /await window\.portalAracYukle\("chart"\)/);
});

test('ikon yenileme yalnız yeni yer tutucuları ve değişen paneli tarar', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  const ikonBas = s.indexOf('window.lucideYenile = function');
  const ikonSon = s.indexOf('// Sayfa yüklenince ilk render', ikonBas);
  const ikon = s.slice(ikonBas, ikonSon);
  assert.match(ikon, /querySelectorAll\("i\[data-lucide\]"\)/);
  assert.match(ikon, /nameAttr: "data-lucide-yeni"/);
  assert.doesNotMatch(ikon, /lucide\.createIcons\(\)/);

  const sekmeBas = s.indexOf('document.querySelectorAll(".tab").forEach');
  const sekmeSon = s.indexOf('// Etkinlik & Takvim iç alt-sekme geçişi', sekmeBas);
  const sekmeler = s.slice(sekmeBas, sekmeSon);
  assert.match(sekmeler, /lucideYenile\(panel\)/);
  assert.doesNotMatch(sekmeler, /setTimeout\(window\.lucideYenile, 300\)/);
});

test('gizli öğrenci tablosu ve gelecek dönem okumaları açılış zincirinden çıkarılır', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  const ayarBas = s.indexOf('async function loadAyarlar()');
  const ayarSon = s.indexOf('function ogrenciSekmesiAktifMi()', ayarBas);
  const ayarlar = s.slice(ayarBas, ayarSon);
  assert.match(ayarlar, /tamDonemVerisiGerekli/);
  assert.match(ayarlar, /_anaKayitOzeti: true/);
  assert.match(ayarlar, /Math\.min\(3, ogrenciList\.length\)/);
  assert.doesNotMatch(ayarlar, /aktifDonemGuncellendi/);
  assert.doesNotMatch(ayarlar, /gelRef|gelSnap/);

  const tabloBas = s.indexOf('function renderTable()');
  const tablo = s.slice(tabloBas, tabloBas + 450);
  assert.match(tablo, /!ogrenciSekmesiAktifMi\(\)/);

  const sekmeBas = s.indexOf('document.querySelectorAll(".tab").forEach');
  const sekmeSon = s.indexOf('// Etkinlik & Takvim iç alt-sekme geçişi', sekmeBas);
  const sekmeler = s.slice(sekmeBas, sekmeSon);
  assert.match(sekmeler, /tab\.dataset\.tab === "ogrenciler"/);
  assert.match(sekmeler, /gelecekDonemKayitlariniYukle\(\)/);
});

test('aktif dönem özeti kayıt ve durum değişimlerinde güvenli biçimde ana kayda yazılır', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');

  const ozetBas = s.indexOf('function aktifDonemOzetAlanlari');
  const ozetSon = s.indexOf('function aktifDonemOzetiniLokaldeUygula', ozetBas);
  const ozet = s.slice(ozetBas, ozetSon);
  assert.match(ozet, /aktifDonem: String\(AKTIF_DONEM/);
  assert.match(ozet, /aktifDonemDurum:/);
  assert.match(ozet, /aktifDonemGuncellendi:/);
  assert.doesNotMatch(ozet, /veli|telefon|eposta|aidat|tcKimlik/i);

  assert.ok((s.match(/\.\.\.aktifDonemOzetAlanlari\("aktif"\)/g) || []).length >= 3);

  for (const [baslangic, bitis] of [
    ['window.ogrenciArsivle = async function', 'window.ogrenciGeriDon = async function'],
    ['window.ogrenciGeriDon = async function', 'window.ogrenciArsivModalAc = function'],
    ['window.ogrenciDurumuDegistir = async function', 'window.toggleDurumMenu = function']
  ]) {
    const bas = s.indexOf(baslangic);
    const son = s.indexOf(bitis, bas);
    const islem = s.slice(bas, son);
    assert.match(islem, /const batch = writeBatch\(db\)/);
    assert.match(islem, /batch\.set\(doc\(db, "ogrenciler", ogrenciId\), aktifDonemOzeti, \{ merge: true \}\)/);
    assert.match(islem, /aktifDonemOzetiniLokaldeUygula\(ogrenciId, aktifDonemOzeti\)/);
  }

  const kaydetBas = s.indexOf('window.saveAyarlar = async function');
  const kaydetSon = s.indexOf('async function autoOnaylaVeliler', kaydetBas);
  const kaydet = s.slice(kaydetBas, kaydetSon);
  assert.match(kaydet, /const mevcutDonemDurumu = getOgrenciDurum/);
  assert.match(kaydet, /\.\.\.aktifDonemOzetAlanlari\(mevcutDonemDurumu\)/);
});

test('gelişim koleksiyonu aynı render içinde tek uçuş ve süreli önbellek kullanır', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  const bas = s.indexOf('let tumGelisimOnbellegi = null;');
  const son = s.indexOf('// ============ EĞİTİM SEKMESİ', bas);
  const cache = s.slice(bas, son);
  assert.match(cache, /TUM_GELISIM_ONBELLEK_MS = 5 \* 60 \* 1000/);
  assert.match(cache, /if \(tumGelisimYuklemeSozu\) return tumGelisimYuklemeSozu/);
  assert.equal((cache.match(/getDocs\(collection\(db, "ogrenciGelisim"\)\)/g) || []).length, 1);
  assert.match(s, /tumGelisimOnbelleginiTemizle\(\)/);
});
