// Galeri çoklu çocuk (27 Eki 2026): ortak hedef sözleşmesi, fotoğraf izni, yükleme/onay/bildirim ve veli görünürlüğü.
// Gerçek kişi verisi yok; tüm kimlikler sentetik.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  galeriCocuklari, galeriCocugaAitMi, galeriHedefAnahtari, fotoIzniGeriAlinanlar, galeriHedefAlanlari,
  galeriHedefKopyala, galeriVeliEtiketi, GALERI_EN_FAZLA_COCUK
} from '../js/galeri-hedefi.js';
import { childTargetMatches, targetChild } from '../js/portal-galeri-etkilesim.js';
import { classifyGalleryFile } from '../js/bunny-stream-upload.js';
import { gallerySession, pendingGallery } from '../js/galeri-onay-canli.js';
import { galleryText, galleryProgram } from '../js/galeri-klasorleri.js';
import { galeriYuklemeBaglami, GALERI_HEDEF_GLOBALS } from './helpers/galeri-hedef-baglami.mjs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dilim = (bas, son) => { const i = index.indexOf(bas); assert.ok(i >= 0, bas); return index.slice(i, index.indexOf(son, i)); };
const coklu = (ek = {}) => ({ hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciId: 'a', ogrenciId: 'a', ogrenciler: ['a', 'b'], hedefOgrenciAd: '2 öğrenci', durum: 'onaylandi', ...ek });

// ─────────────── sözleşme ───────────────
test('galeriCocuklari: eski tek çocuk, çoklu liste ve sınıf/okul hedefi', () => {
  assert.deepEqual(galeriCocuklari({ hedefTur: 'ogrenci', hedefDeger: 'a' }), ['a']);
  assert.deepEqual(galeriCocuklari({ hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciId: 'a', ogrenciId: 'a', sinif: 'Lale' }), ['a'], 'gözlem fotoğrafı');
  assert.deepEqual(galeriCocuklari({ hedefTur: 'ogrenci', hedefOgrenciId: 'a' }), ['a']);
  assert.deepEqual(galeriCocuklari(coklu()), ['a', 'b']);
  assert.deepEqual(galeriCocuklari({ hedefTur: 'sinif', hedefDeger: 'Lale' }), []);
  assert.deepEqual(galeriCocuklari({ hedefTur: 'tumOkul' }), []);
});

test('galeriCocuklari: çelişkili kayıt hiçbir çocuğa açılmaz (fail-closed)', () => {
  assert.deepEqual(galeriCocuklari(coklu({ hedefDeger: 'x' })), [], 'hedefDeger listede değil');
  assert.deepEqual(galeriCocuklari(coklu({ hedefOgrenciId: 'x' })), [], 'hedefOgrenciId listede değil');
  assert.deepEqual(galeriCocuklari(coklu({ ogrenciId: 'x' })), [], 'ogrenciId listede değil');
  assert.deepEqual(galeriCocuklari({ hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciId: 'b' }), [], 'eski tekil alanlar farklı');
  assert.deepEqual(galeriCocuklari(coklu({ ogrenciIds: ['a', 'c'] })), [], 'iki liste uyuşmuyor');
  assert.deepEqual(galeriCocuklari(coklu({ hedefTip: 'sinif' })), [], 'hedefTur / hedefTip çelişkisi');
  for (const m of [coklu({ hedefDeger: 'x' }), { hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciId: 'b' }]) {
    assert.equal(childTargetMatches(m, 'a'), false);
    assert.equal(childTargetMatches(m, 'b'), false);
  }
});

test('ikinci çocuğun velisi de görür; listede olmayan görmez (Portal eşleşme yardımcıları)', () => {
  const m = coklu();
  assert.equal(childTargetMatches(m, 'b'), true);
  assert.equal(childTargetMatches(m, 'c'), false);
  assert.equal(targetChild(m, [{ id: 'b' }], {})?.id, 'b');
  assert.equal(targetChild(m, [{ id: 'c' }], {}), null);
  assert.equal(targetChild({ ...m, durum: 'beklemede' }, [{ id: 'b' }], {}), null, 'onaysız gösterilmez');
  assert.equal(galeriCocugaAitMi({ hedefTur: 'ogrenci', hedefDeger: 'a' }, 'a'), true, 'eski kayıt değişmedi');
});

test('albüm anahtarı: çoklu albüm ilk çocuğun tek çocuklu albümüyle birleşmez, sıra önemsiz', () => {
  assert.notEqual(galeriHedefAnahtari(coklu()), galeriHedefAnahtari({ hedefTur: 'ogrenci', hedefDeger: 'a' }));
  assert.equal(galeriHedefAnahtari(coklu()), galeriHedefAnahtari(coklu({ ogrenciler: ['b', 'a'], hedefDeger: 'b', hedefOgrenciId: 'b', ogrenciId: 'b' })));
  assert.equal(galeriHedefAnahtari({ hedefTur: 'sinif', hedefDeger: 'Lale' }), 'sinif:Lale');
});

test('fotoIzniGeriAlinanlar: yalnız en son "foto" kaydı açıkça kapalı olan; kaydı olmayan izinli', () => {
  const kayit = (ogrenciId, tur, durum, tarih) => ({ ogrenciId, tur, durum, tarih });
  const izinsiz = fotoIzniGeriAlinanlar([
    kayit('kapali', 'foto', false, '2026-10-01T10:00:00Z'),
    kayit('geri-acildi', 'foto', false, '2026-09-01T10:00:00Z'), kayit('geri-acildi', 'foto', true, '2026-10-02T10:00:00Z'),
    kayit('sonra-kapandi', 'foto', true, '2026-09-01T10:00:00Z'), kayit('sonra-kapandi', 'foto', false, '2026-10-03T10:00:00Z'),
    kayit('sosyal-kapali', 'sosyal', false, '2026-10-03T10:00:00Z'),
    kayit('acik', 'foto', true, '2026-10-03T10:00:00Z'),
    { tur: 'foto', durum: false, tarih: '2026-10-03' }, null
  ]);
  assert.deepEqual([...izinsiz].sort(), ['kapali', 'sonra-kapandi']);
  assert.equal(izinsiz.has('kaydi-yok'), false);
});

test('galeriHedefAlanlari: sözleşme alanları; tek çocukta ad, çoklu seçimde başka çocuk adı yok', () => {
  assert.deepEqual(galeriHedefAlanlari({ tur: 'ogrenci', ogrenciler: [{ id: 'a', ad: 'Ada' }, { id: 'b', ad: 'Bora' }, { id: 'a', ad: 'Ada' }] }), {
    hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciId: 'a', ogrenciId: 'a', ogrenciler: ['a', 'b'],
    hedefOgrenciAd: '2 öğrenci', sinif: '', izinsizOgrenciler: []
  });
  assert.equal(galeriHedefAlanlari({ tur: 'ogrenci', ogrenciler: [{ id: 'a', ad: 'Ada' }] }).hedefOgrenciAd, 'Ada');
  assert.deepEqual(galeriHedefAlanlari({ tur: 'sinif', sinif: 'Lale' }), { hedefTur: 'sinif', hedefDeger: 'Lale', hedefOgrenciId: '', hedefOgrenciAd: '', ogrenciler: [] });
  assert.deepEqual(galeriHedefAlanlari({ tur: 'tumOkul' }).ogrenciler, []);
  assert.throws(() => galeriHedefAlanlari({ tur: 'ogrenci', ogrenciler: [] }), /öğrenci seçin/);
  assert.throws(() => galeriHedefAlanlari({ tur: 'sinif' }), /Sınıf/);
  const otuzBir = Array.from({ length: GALERI_EN_FAZLA_COCUK + 1 }, (_, i) => ({ id: 'c' + i }));
  assert.throws(() => galeriHedefAlanlari({ tur: 'ogrenci', ogrenciler: otuzBir }), /en çok 30/);
  for (const alanlar of [galeriHedefAlanlari({ tur: 'ogrenci', ogrenciler: [{ id: 'a', ad: 'Ada' }, { id: 'b', ad: 'Bora' }] })]) {
    assert.deepEqual(galeriCocuklari(alanlar), ['a', 'b'], 'yazılan kayıt okuyucuda tutarlı');
  }
});

test('albüme ekleme hedefi birebir taşır; çelişkili albüme ekleme yapılmaz; veli etiketi yalnız kendi çocuğu', () => {
  assert.deepEqual(galeriHedefKopyala(coklu()).ogrenciler, ['a', 'b']);
  assert.equal(galeriHedefKopyala(coklu()).hedefOgrenciAd, '2 öğrenci');
  assert.equal(galeriHedefKopyala(coklu({ hedefDeger: 'x' })), null);
  assert.equal(galeriHedefKopyala({ hedefTur: 'sinif', hedefDeger: 'Lale' }).hedefDeger, 'Lale');
  assert.equal(galeriVeliEtiketi(coklu(), [{ id: 'b', ad: 'Bora' }, { id: 'z', ad: 'Zeynep' }]), 'Size özel · Bora');
});

// ─────────────── yükleme ───────────────
function yukleme({ secili, izinsiz = [], izinOkumaHatasi = false, ogretmen = false, secilebilir = null } = {}) {
  const yazilar = [], bildirimler = [], toastlar = [], yuklenen = [], nodes = new Map();
  const degerler = { galeriEtkinlik: 'Bahçe', galeriEtkinlikTarih: '2026-10-27', galeriAciklama: '', galeriHedefTur: 'ogrenci', galeriKategori: '' };
  const document = { getElementById: id => { if (!nodes.has(id)) nodes.set(id, { value: degerler[id] || '', style: {}, checked: false, textContent: '' }); return nodes.get(id); } };
  let sayac = 0;
  const ctx = vm.createContext({
    ...galeriYuklemeBaglami({ secili, izinsiz, izinOkumaHatasi, secilebilir }),
    classifyGalleryFile, gallerySession, galeriBekliyorMu: pendingGallery, notifyGalleryApproval: async () => ({ ok: true }),
    window: { PortalAPI: { state: { currentUser: { uid: 'u' } } } }, document, console: { error() {}, warn() {} },
    galeriSecilenDosyalar: [{ name: 'f.jpg', type: 'image/jpeg', size: 10 }],
    aktifKullaniciRol: ogretmen ? 'ogretmen' : 'mudur', isAdmin: !ogretmen, currentUser: { email: 'personel@example.invalid' },
    AKTIF_DONEM: '2026-2027', db: {}, galleryText, galeriProgramKodu: galleryProgram, ogretmenRolMu: () => ogretmen, aktifKullaniciSiniflari: ['Lale'],
    isoTarih: () => '2026-10-27', showToast: (...v) => toastlar.push(v), resimSikistir: async f => f,
    medyaYukle: async (f, yol) => { yuklenen.push(yol); return { url: 'https://example.invalid/' + f.name, yol }; },
    collection: () => ({}), doc: () => ({ id: 'yeni-' + (++sayac) }), setDoc: async (ref, veri) => yazilar.push({ id: ref.id, ...veri }),
    galeriGuncellemeBildirimi: async veri => bildirimler.push(veri), galeriBildirimMailGonder: async () => {},
    albumEkleMod: null, closeGaleriYuklemeModal() {}, renderGaleri() {}
  });
  vm.runInContext(dilim('window.galeriYukle = async function() {', '// Lightbox'), ctx);
  return { calistir: () => ctx.window.galeriYukle(), yazilar, bildirimler, toastlar, yuklenen };
}

test('yönetim yüklemesi: çoklu öğrenci sözleşme alanlarıyla yazılır, bildirim tüm listeye gider', async () => {
  const y = yukleme({ secili: [{ id: 'a', ad: 'Ada' }, { id: 'b', ad: 'Bora' }] });
  await y.calistir();
  assert.equal(y.yazilar.length, 1);
  const w = y.yazilar[0];
  assert.deepEqual({ hedefTur: w.hedefTur, hedefDeger: w.hedefDeger, hedefOgrenciId: w.hedefOgrenciId, ogrenciId: w.ogrenciId, ogrenciler: w.ogrenciler, hedefOgrenciAd: w.hedefOgrenciAd, sinif: w.sinif, izinsizOgrenciler: w.izinsizOgrenciler },
    { hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciId: 'a', ogrenciId: 'a', ogrenciler: ['a', 'b'], hedefOgrenciAd: '2 öğrenci', sinif: '', izinsizOgrenciler: [] });
  assert.equal(w.durum, 'onaylandi');
  assert.doesNotMatch(JSON.stringify(w), /Ada|Bora/, 'çoklu kayıtta çocuk adı yok');
  assert.deepEqual([...y.bildirimler[0].ogrenciler], ['a', 'b']);
});

test('izni geri alınmış öğrenci seçiliyse yükleme yapılmaz; izinler okunamazsa da yapılmaz', async () => {
  const y = yukleme({ secili: [{ id: 'a', ad: 'Ada' }, { id: 'b', ad: 'Bora' }], izinsiz: ['b'] });
  await y.calistir();
  assert.equal(y.yazilar.length, 0); assert.equal(y.yuklenen.length, 0);
  assert.match(y.toastlar[0][0], /fotoğraf izni geri alınmış/);
  const h = yukleme({ secili: [{ id: 'a', ad: 'Ada' }], izinOkumaHatasi: true });
  await h.calistir();
  assert.equal(h.yazilar.length, 0); assert.match(h.toastlar[0][0], /doğrulanamadı/);
});

test('öğretmen: kendi sınıfı dışından öğrenci seçemez; kendi sınıfında beklemede yazılır', async () => {
  const disari = yukleme({ ogretmen: true, secili: [{ id: 'a', ad: 'Ada' }, { id: 'x', ad: 'Xe' }], secilebilir: [{ id: 'a', ad: 'Ada', sinif: 'Lale' }] });
  await disari.calistir();
  assert.equal(disari.yazilar.length, 0); assert.match(disari.toastlar[0][0], /kendi sınıfınızdaki/);
  const ic = yukleme({ ogretmen: true, secili: [{ id: 'a', ad: 'Ada' }, { id: 'b', ad: 'Bora' }], secilebilir: [{ id: 'a', ad: 'Ada' }, { id: 'b', ad: 'Bora' }] });
  await ic.calistir();
  assert.equal(ic.yazilar[0].durum, 'beklemede'); assert.deepEqual([...ic.yazilar[0].ogrenciler], ['a', 'b']);
  assert.equal(ic.bildirimler.length, 0, 'onay beklerken veliye bildirim yok');
});

// ─────────────── onay ───────────────
function onay(kayit, { izinsiz = [], izinOkumaHatasi = false } = {}) {
  const guncellenen = [], bildirimler = [], toastlar = [];
  const ctx = vm.createContext({
    ...GALERI_HEDEF_GLOBALS,
    window: {}, isAdmin: true, aktifKullaniciRol: 'mudur', currentUser: { email: 'mudur@example.invalid' },
    doc: (_db, _k, id) => ({ id }), db: {}, getDoc: async () => ({ exists: () => true, data: () => ({ ...kayit }) }),
    updateDoc: async (ref, veri) => guncellenen.push(veri), galeriBekliyorMu: pendingGallery,
    galeriIzinsizleriOku: async () => { if (izinOkumaHatasi) throw new Error('x'); return new Set(izinsiz); },
    galeriGozlemOnayiEsitle: async () => {}, galeriGuncellemeBildirimi: async v => bildirimler.push(v),
    showToast: (...v) => toastlar.push(v), renderGaleri: async () => {}, console: { error() {} }
  });
  vm.runInContext(dilim('window.galeriOnayla = async function(id) {', 'window.galeriReddet'), ctx);
  return { calistir: () => ctx.window.galeriOnayla('g1'), guncellenen, bildirimler, toastlar };
}

test('onay: izni geri alınmış öğrenci içeren kare onaylanmaz; uygun kare tüm listeye bildirilir', async () => {
  const red = onay(coklu({ durum: 'beklemede' }), { izinsiz: ['b'] });
  assert.equal(await red.calistir(), false);
  assert.equal(red.guncellenen.length, 0); assert.match(red.toastlar[0][0], /fotoğraf izni geri alınmış/);
  const celiski = onay(coklu({ durum: 'beklemede', hedefDeger: 'x' }));
  assert.equal(await celiski.calistir(), false); assert.match(celiski.toastlar[0][0], /çelişkili/);
  const hata = onay(coklu({ durum: 'beklemede' }), { izinOkumaHatasi: true });
  assert.equal(await hata.calistir(), false); assert.equal(hata.guncellenen.length, 0);
  const ok = onay(coklu({ durum: 'beklemede' }));
  assert.equal(await ok.calistir(), true);
  assert.equal(ok.guncellenen[0].durum, 'onaylandi'); assert.deepEqual([...ok.bildirimler[0].ogrenciler], ['a', 'b']);
  const sinif = onay({ hedefTur: 'sinif', hedefDeger: 'Lale', durum: 'beklemede' }, { izinOkumaHatasi: true });
  assert.equal(await sinif.calistir(), true, 'sınıf hedefinde öğrenci izni sorulmaz (değişmedi)');
});

// ─────────────── bildirim ───────────────
test('galeri bildirimi: listedeki her öğrencinin velisine; kök bildirim köprüsü tam listeyi alır; başka çocuk adı yok', async () => {
  const yazilar = [], kopru = [];
  const ogrenciList = [{ id: 'a', ogrenciAdSoyad: 'Ada' }, { id: 'b', ogrenciAdSoyad: 'Bora' }, { id: 'c', ogrenciAdSoyad: 'Cem' }];
  const ctx = vm.createContext({
    ogrenciList, ayarListesi: {}, veliAktifDonemOgrencisiMi: () => true, AKTIF_DONEM: '2026-2027', currentUser: { uid: 'u' },
    db: {}, collection: (_db, ...yol) => ({ yol }), doc: kol => ({ yol: kol.yol }), setDoc: async (ref, v) => yazilar.push({ ogrenci: ref.yol[1], ...v }),
    portalHedefBildir: async (hedef, b) => { kopru.push({ hedef, b }); return { ok: true }; }, showToast() {}, console: { warn() {} }
  });
  vm.runInContext(dilim('async function galeriGuncellemeBildirimi(grup) {', 'async function galeriBildirimMailGonder'), ctx);
  await vm.runInContext('galeriGuncellemeBildirimi', ctx)({ etkinlikBaslik: 'Bahçe', etkinlikTarih: '2026-10-27', hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciler: ['a', 'b'], hedefOgrenciAd: '2 öğrenci', fotoSayisi: 2, videoSayisi: 0 });
  assert.deepEqual(yazilar.map(y => y.ogrenci).sort(), ['a', 'b']);
  assert.deepEqual(JSON.parse(JSON.stringify(kopru[0].hedef)), { hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciler: ['a', 'b'] });
  assert.doesNotMatch(JSON.stringify(yazilar) + JSON.stringify(kopru), /Ada|Bora|Cem/);
  // Eski çağrı (liste yok) tek öğrenciye gider
  yazilar.length = 0; kopru.length = 0;
  await vm.runInContext('galeriGuncellemeBildirimi', ctx)({ etkinlikBaslik: 'X', hedefTur: 'ogrenci', hedefDeger: 'c', fotoSayisi: 1, videoSayisi: 0 });
  assert.deepEqual(yazilar.map(y => y.ogrenci), ['c']);
});

test('kaynak: yükleme modalı tek seçimli öğrenci listesi değil çoklu seçici; izin sunucudan okunur', () => {
  assert.doesNotMatch(index, /<select id="galeriHedefOgrenci">/);
  assert.match(index, /<div id="galeriHedefOgrenciSecici"><\/div>/);
  assert.match(index, /getDocsFromServer\(collection\(db, "izinGunlugu"\)\)/);
  assert.match(index, /pasif: izinsiz\.has\(o\.id\) \? IZIN_YOK_METNI : ""/);
});
