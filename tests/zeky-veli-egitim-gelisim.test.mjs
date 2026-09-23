import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bckUyumlulukKur } from '../js/zeky-veli-egitim-koprusu.js';

const kok = new URL('../', import.meta.url);

test('PortalAPI tek Firebase örneğiyle eski veri katmanına uyarlanır', () => {
  const currentUser={email:'veli@example.test'}, personel={ad:'Ada'};
  const sahte={PortalAPI:{db:{ad:'db'},fb:{doc:()=>{},getDoc:()=>{},setDoc:()=>{}},state:{currentUser,personel,rol:'mudur',siniflar:['Mimoza'],ogrenciList:[{id:'o1'}]}}};
  const b=bckUyumlulukKur(sahte);
  assert.equal(b.db,sahte.PortalAPI.db);
  assert.equal(b.kullanici(),currentUser);
  assert.equal(b.personel(),personel);
  assert.equal(b.rol(),'mudur');
  assert.equal(b.yoneticiMi(),true);
  assert.equal(b.__portalUyumluluk,true);
});

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

test('veli eğitim fotoğraf fallback sorgusu onaylı kapsamı ister ve seçili öğrenciyi istemcide ayırır', async () => {
  const kaynak = await readFile(new URL('moduller/veli-egitim-gelisim.js', kok), 'utf8');
  const portfolyo = await readFile(new URL('js/zeky-egitim-portfolyo.js', kok), 'utf8');
  assert.match(portfolyo, /where\('durum','==','onaylandi'\)/);
  assert.match(portfolyo, /hedef !== ogrenciId/);
  assert.doesNotMatch(portfolyo, /where\('ogrenciId'/);
  assert.doesNotMatch(kaynak, /URLSearchParams/);
  assert.match(kaynak, /state\.veliAktifOgrenci/);
});

test('veli oturumu yalnız aktif dönem öğrencisini açar ve doğrulama hatasında kapalı kalır', async () => {
  const kaynak = await readFile(new URL('index.html', kok), 'utf8');
  const bas = kaynak.indexOf('function veliOgrenciMasterAktifDonemdeMi');
  const son = kaynak.indexOf('// ============ ADMIN: VELİ DAVET', bas);
  const erisim = kaynak.slice(bas, son);

  assert.match(erisim, /String\(ogr\.aktifDonem \|\| ""\) === String\(AKTIF_DONEM \|\| ""\)/);
  assert.match(erisim, /return donemEslesir && durum === "aktif"/);
  assert.match(erisim, /if \(!donemSnap\.exists\(\)\)/);
  assert.match(erisim, /if \(masterAktif\) aktifOgrenciler\.push\(ogr\)/);
  assert.match(erisim, /if \(donemDurum !== "aktif"\)/);
  assert.match(erisim, /Aktif dönem doğrulanamadı, öğrenci elendi/);
  assert.doesNotMatch(erisim, /Dönem dokümanı okunamadıysa öğrenciyi dahil et/);
  assert.doesNotMatch(erisim, /Dönem durumu okunamadı, öğrenci dahil ediliyor/);
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

test('eğitim köprüsü PortalAPI uyumluluğuyla global caGo ve veli deneyimini yükler', async () => {
  const kopru = await readFile(new URL('js/zeky-veli-egitim-koprusu.js', kok), 'utf8');
  const baslangic = await readFile(new URL('js/zeky-galeri-filigran-koprusu.js', kok), 'utf8');
  assert.match(kopru, /bckUyumlulukKur/);
  assert.match(kopru, /!!win\.PortalAPI/);
  assert.doesNotMatch(kopru, /await bekle\(\(\) => !!win\.BCK/);
  assert.match(kopru, /typeof win\.caGo === 'function'/);
  assert.match(kopru, /ekran === 'egitim'/);
  assert.match(kopru, /veliEgitimRender\('cicekAppRoot'\)/);
  assert.match(kopru, /zeky-ogrenci-guvenlik-koprusu\.js\?v=7/);
  assert.match(kopru, /zeky-aktif-donem-senkron\.js\?v=3/);
  assert.match(kopru, /zeky-veli-ogrenme-deneyimi\.js\?v=3/);
  assert.match(kopru, /__zekyEgitimKoprusuSurum/);
  assert.doesNotMatch(kopru, /typeof win\.caEgitimYukle/);
  assert.match(baslangic, /zeky-veli-egitim-koprusu\.js\?v=9/);
});

test('öğrenci güvenlik köprüsü aktif dönem, gözlem ve e-posta gizliliğini uygular', async () => {
  const kaynak = await readFile(new URL('js/zeky-ogrenci-guvenlik-koprusu.js', kok), 'utf8');
  assert.match(kaynak, /aktifDonemDurum/);
  assert.match(kaynak, /String\(o\.aktifDonem \|\| ''\) === donem/);
  assert.doesNotMatch(kaynak, /aktifDonemGuncellendi/);
  assert.match(kaynak, /ogrenciEgitimIslem/);
  assert.match(kaynak, /islem==='gozlem'/);
  assert.match(kaynak, /islem==='mesaj'/);
  assert.match(kaynak, /zekyGelismisGozlemAc/);
  assert.match(kaynak, /__portalUyumluluk/);
  assert.match(kaynak, /window\.caGozlemAc/);
  assert.match(kaynak, /Yeni Eğitim Gözlemi/);
  assert.match(kaynak, /btn\.onclick=.*mesajYeniBaslat/);
  assert.doesNotMatch(kaynak, /Mesajlaşma bölümünden .*email/);
  assert.doesNotMatch(kaynak, /onclick=.{0,120}v\.email/);
  assert.match(kaynak, /if \(ayar\) return durumNorm\(ayar\.durum\) === 'aktif'/);
  assert.match(kaynak, /observerYenilemeBekliyor/);
  assert.match(kaynak, /requestAnimationFrame/);
  assert.match(kaynak, /\['tab-ogrenciler','tab-egitim'\]/);
  assert.doesNotMatch(kaynak, /observer\.observe\(document\.body/);
  assert.match(kaynak, /if \(el\.textContent !== yeniMetin\) el\.textContent = yeniMetin/);
});

test('aktif dönem senkronu yalnız güvenli dönem işaretlerini ana öğrenci kaydına yazar', async () => {
  const kaynak = await readFile(new URL('js/zeky-aktif-donem-senkron.js', kok), 'utf8');
  const guvenlik = await readFile(new URL('js/zeky-ogrenci-guvenlik-koprusu.js', kok), 'utf8');
  assert.match(kaynak, /aktifDonem:donem/);
  assert.match(kaynak, /aktifDonemDurum:durum/);
  assert.match(kaynak, /for\(let deneme=0;deneme<15;deneme\+\+\)/);
  assert.match(kaynak, /if\(aktifSenkronSozu\)return aktifSenkronSozu/);
  assert.match(kaynak, /isler\.slice\(i,i\+3\)\.map/);
  assert.match(kaynak, /s\.ogrenciVerileriHazirMi/);
  assert.doesNotMatch(kaynak, /isler\.push\(b\.setDoc/);
  assert.doesNotMatch(guvenlik, /setTimeout\(aktifDonemIsaretleriniSenkronla/);
  assert.doesNotMatch(kaynak, /aidat/);
  assert.doesNotMatch(kaynak, /veli1Eposta/);
});

test('PWA cache eğitim, güvenlik, modern gözlem ve aktif dönem veli zincirini tek sürümle taşır', async () => {
  const sw = await readFile(new URL('serviceworker.js', kok), 'utf8');
  assert.match(sw, /CACHE_VERSION = "v144-odeme-hesap"/);
  assert.doesNotMatch(sw, /portal-data\.js\?v=3/);
  assert.match(sw, /portal-data\.js\?v=8/);
  assert.match(sw, /zeky-veli-egitim-koprusu\.js\?v=9/);
  assert.match(sw, /zeky-veli-ogrenme-deneyimi\.js\?v=3/);
  assert.match(sw, /zeky-galeri-onay-egitim\.js\?v=4/);
  assert.match(sw, /zeky-egitim-portfolyo\.js\?v=2/);
  assert.match(sw, /zeky-veli-donem-raporu\.js\?v=1/);
  assert.match(sw, /zeky-ogrenci-guvenlik-koprusu\.js\?v=7/);
  assert.match(sw, /zeky-aktif-donem-senkron\.js\?v=3/);
  assert.match(sw, /veli-egitim-gelisim\.js\?v=8/);
  assert.match(sw, /ogretmen-egitim-gozlem\.js\?v=6/);
  assert.match(sw, /zeky-gozlem-modal-modern\.js\?v=1/);
});
