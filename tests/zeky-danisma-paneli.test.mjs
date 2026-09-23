import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

async function portalKaynak() {
  return readFile(new URL('index.html', kok), 'utf8');
}

function bolum(kaynak, baslangic, bitis) {
  const bas = kaynak.indexOf(baslangic);
  assert.ok(bas >= 0, `${baslangic} bölümü bulunmalı`);
  const son = kaynak.indexOf(bitis, bas + baslangic.length);
  assert.ok(son > bas, `${bitis} bölüm sonu bulunmalı`);
  return kaynak.slice(bas, son);
}

test('danışma ve eski halkla ilişkiler rolleri tek operasyon hesabında birleşir', async () => {
  const s = await portalKaynak();
  assert.match(s, /=== "halkla_iliskiler" \? "danisma"/);
  assert.match(s, /danisma: "Danışma Personeli"/);
  assert.match(s, /halkla_iliskiler: "Danışma Personeli"/);
  assert.match(s, /<option value="danisma">Danışma Personeli \(Okul Zili ve operasyon\)<\/option>/);

  const personelFormu = await readFile(new URL('personel-ekle.html', kok), 'utf8');
  assert.match(personelFormu, /<optgroup label="Danışma Personeli">\s*<option value="danisma">🔔 Danışma Personeli<\/option>/);
  assert.match(personelFormu, /'halkla_iliskiler': '🔔 Danışma Personeli'/);

  const yetkiler = bolum(s, 'const SEKME_YETKILERI = {', '// ═══ VERİ GÖRÜNÜRLÜK KISITLARI');
  for (const sekme of ['anasayfa', 'ogrenciler', 'profilim', 'danismaRandevu', 'duyurular', 'etkinlik', 'mesajlasma']) {
    const bas = yetkiler.indexOf(`${sekme}:`);
    const izinler = yetkiler.slice(bas, yetkiler.indexOf(']', bas) + 1);
    assert.match(izinler, /"danisma"/, `${sekme} danışmaya açık olmalı`);
  }
  const profilBas = yetkiler.indexOf('profilim:');
  const profilIzinleri = yetkiler.slice(profilBas, yetkiler.indexOf(']', profilBas) + 1);
  assert.match(profilIzinleri, /"asci"/);
  assert.match(profilIzinleri, /"temizlik"/);
  for (const sekme of ['veliler', 'ozluk', 'egitim', 'finans', 'raporlar', 'devamsizlik', 'gunlukRapor']) {
    const satir = yetkiler.split('\n').find(x => x.trim().startsWith(`${sekme}:`)) || '';
    assert.doesNotMatch(satir, /"danisma"/, `${sekme} danışmaya kapalı olmalı`);
  }
  assert.match(s, /modulKey === "randevular" && danismaRolMu\(\)/);
  assert.match(s, /sekmeyeErisim\("onay"\) && typeof initOnayBekleyenler/);
  assert.match(s, /sekmeyeErisim\("finans"\) && typeof kontrolEtYeniTalepler/);
});

test('danışma ana ekranında Okul Zili birincil ve tüm operasyon kısayolları hazırdır', async () => {
  const s = await portalKaynak();
  const home = bolum(s, 'function danismaHomeHTML(ad)', 'async function danismaHomeMesajlariDoldur');
  assert.ok(home.indexOf('BİRİNCİL ÇALIŞMA ALANI') < home.indexOf('Hızlı işlemler'));
  assert.match(home, /Okul Zili · Teslim Kuyruğu/);
  assert.match(home, /id="okulZiliListe"/);
  assert.match(home, /Randevu Oluştur/);
  assert.match(home, /Kurum İçi Mesaj/);
  assert.match(home, /İzin Talebi/);
  assert.match(home, /Fiş Ekle/);
  assert.match(home, /İhtiyaç Bildir/);
  assert.match(home, /Giriş · Mola · Çıkış/);
  assert.match(home, /Veli rehberi, telefon\/e-posta, veli mesajları, muhasebe ve eğitim kayıtları bu hesapta kapalıdır/);
  assert.match(s, /const gorunenKayitlar = danismaRolMu\(\) \? kayitlar : kayitlar\.slice\(0, 6\)/);
  const bekleme = bolum(s, 'function adminHomeYukleniyorGoster()', 'function adminHomeVeriYuklemesiTamamlandi');
  assert.match(bekleme, /danismaMi && typeof okulZiliDoldur === "function"/);
  assert.match(bekleme, /Promise\.resolve\(okulZiliDoldur\(\)\)/);
  const zil = bolum(s, 'window.okulZiliDoldur = async function()', '// Özet sayfası hızlı işlem butonları');
  assert.match(zil, /where\("tarih", "==", bugun\)/);
  assert.doesNotMatch(zil, /veliEmail|veliOnayEmail/);
});

test('öğrenci görünümü danışma belleğine yalnız güvenli teslim özetini alır', async () => {
  const s = await portalKaynak();
  const ozet = bolum(s, 'function danismaOgrenciOzeti', 'const DANISMA_GUVENLI_KOLEKSIYONLAR');
  assert.match(ozet, /ogrenciAdSoyad/);
  assert.match(ozet, /sinif/);
  assert.match(ozet, /aktifDonemDurum/);
  assert.doesNotMatch(ozet, /veli|telefon|eposta|email|aidat|saglik/i);

  const yukleme = bolum(s, 'async function loadOgrenciler()', 'async function loadOnayBekleyenler');
  assert.match(yukleme, /DANISMA_GUVENLI_KOLEKSIYONLAR\.ogrenciler/);
  assert.match(yukleme, /danismaRolMu\(\)\s*\? danismaOgrenciOzeti\(d\.id, d\.data\(\)\)/);

  const kartlar = bolum(s, 'function renderTableDanisma(wrap)', 'function renderTableEgitim(wrap)');
  assert.match(kartlar, /Teslim Yetkilileri/);
  assert.match(kartlar, /Okul Zili/);
  assert.doesNotMatch(kartlar, /ogrenciEgitim|ogrenciModal|aidat|veli1|veli2|telefon|eposta/i);
});

test('danışma mesajlaşması yalnız personel kanalını oluşturur ve veli threadlerini reddeder', async () => {
  const s = await portalKaynak();
  const icThread = bolum(s, 'async function mesajIcThreadGetirVeyaOlustur', '// Bir thread\'e mesaj gönder');
  assert.match(icThread, /kanal: "kurum_ici"/);
  assert.match(icThread, /ccGozetimciler: \[\]/);
  assert.match(icThread, /ogrenciId: "", ogrenciAd: "", ogrenciSinif: ""/);
  assert.match(icThread, /mesajThreadVeliIceriyor\(veri\)/);

  const gonder = bolum(s, 'async function mesajGonder(', '// Bir thread\'i okundu işaretle');
  assert.match(gonder, /danismaRolMu\(\) && mesajThreadVeliIceriyor\(thread\)/);
  assert.match(gonder, /mesajThreadDanismaVeliMi\(thread\)/);
  assert.match(gonder, /Danışma hesabı ile veli mesajlaşması kapalıdır/);

  assert.match(s, /if \(danismaRolMu\(\)\) \{ mesajYeniPersonelleriListele\(\); return; \}/);
  assert.match(s, /rolNormalize\(p\.rol\) !== "danisma"/);
  assert.match(s, /if \(rolNormalize\(personelRol\) === "danisma"\)/);
});

test('duyuru ve etkinlikler danışmada salt okunur kalır', async () => {
  const s = await portalKaynak();
  assert.match(s, /body\.rol-danisma \.duyuru-yazma/);
  assert.match(s, /body\.rol-danisma \.etkinlik-yazma/);
  const duyuruKorumalari = s.match(/danismaSaltOkunurEngelle\("Duyurular"\)/g) || [];
  const etkinlikKorumalari = s.match(/danismaSaltOkunurEngelle\("Etkinlikler"\)/g) || [];
  assert.ok(duyuruKorumalari.length >= 6, 'duyuru yazma/arşiv/silme yolları korunmalı');
  assert.ok(etkinlikKorumalari.length >= 4, 'etkinlik yazma/silme yolları korunmalı');
});

test('kişisel işlemler fiş eki ve yalnız kendi taleplerini sorgulama sınırı taşır', async () => {
  const s = await portalKaynak();
  assert.match(s, /id="gtReceiptInput"/);
  assert.match(s, /receiptInput\(\{mount:document\.getElementById\('gtReceiptInput'\)/);
  assert.match(s, /medyaYukle\(fisDosya, `fis-talepleri\/\$\{klasorEmail\}`, false\)/);
  assert.match(s, /fisUrl, fisYol/);
  assert.match(s, /query\(collection\(db, "fisTalepleri"\), where\("talepEden", "==", email\)\)/);
  assert.match(s, /query\(collection\(db, "izinTalepleri"\), where\("personelEmail", "==", email\)\)/);
});

test('teslim yetkilisi telefonları danışma hesabına aktarılmaz veya gösterilmez', async () => {
  const s = await readFile(new URL('moduller/pickup-yetkilileri.js', kok), 'utf8');
  assert.match(s, /\["danisma", "halkla_iliskiler"\]\.includes\(state\.rol\)/);
  assert.match(s, /danismaMi \? "danismaPickupYetkilileri" : "pickupYetkilileri"/);
  assert.match(s, /kisiler = kisiler\.map\(k => \(\{ ad: k\.ad \|\| "", yakinlik: k\.yakinlik \|\| "" \}\)\)/);
  assert.match(s, /const telefonGoster = state\.rol !== "danisma" && state\.rol !== "halkla_iliskiler"/);
  assert.match(s, /yönetim üzerinden teyit isteyin/);
});

test('aday randevuları danışma ana ekran özetini de yeniler', async () => {
  const s = await readFile(new URL('moduller/danisma-randevulari.js', kok), 'utf8');
  assert.match(s, /document\.getElementById\("danismaHomeRandevu"\)/);
  assert.match(s, /ozetKart\("danismaHomeRandevu"\)/);
});
