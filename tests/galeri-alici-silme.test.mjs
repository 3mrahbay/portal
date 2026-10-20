// Galeri: alıcı etiketi · alıcıyı düzenle · tam silme · yüklemede/onayda alıcı görünürlüğü.
// Ortak sözleşme (Portal + ZEKY) A–E. Gerçek js/galeri-alici.js ve index.html dilimleri
// sentetik Firestore/DOM ile çalıştırılır; gerçek hesap, yazma, yükleme ya da ağ yoktur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as alici from '../js/galeri-alici.js';
import { classifyGalleryFile } from '../js/bunny-stream-upload.js';
import { gallerySession, pendingGallery } from '../js/galeri-onay-canli.js';
import { galleryText, galleryProgram } from '../js/galeri-klasorleri.js';
import * as folders from '../js/galeri-klasorleri.js';
import { galleryRuntime, media, settle } from '../qa/galeri-onay-fixture.mjs';
import { galeriAliciBaglaminaEkle } from './helpers/galeri-alici-vm.mjs';
// window tanımsızken içe aktarılır: modülün tarayıcı kurulumu (kur) Node'da çalışmaz.
import { detayHTML } from '../js/zeky-galeri-onay-egitim.js';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dilim = (bas, son) => {
  const a = index.indexOf(bas), b = index.indexOf(son, a + bas.length);
  assert.ok(a >= 0 && b > a, `index.html dilimi bulunamadı: ${bas}`);
  return index.slice(a, b);
};

const ogrenciler = [
  { id: 'ali', ogrenciAdSoyad: 'Ali Yılmaz', sinif: 'Eski Sınıf' },
  { id: 'ayse', ogrenciAdSoyad: 'Ayşe Demir' },
  { id: 'can', ogrenciAdSoyad: 'Can Kaya', sinif: 'Kardelenler Sınıfı' }
];
const ayarListesi = { ali: { durum: 'aktif', kayit: { sinif: 'Papatyalar Sınıfı' } }, ayse: { durum: 'aktif', kayit: { sinif: 'Kardelenler Sınıfı' } } };
const rehber = alici.galeriAliciRehberi(ogrenciler, ayarListesi);
const KEY = 'pratik__Bakım__Ayakkabı boyama';
const URL_A = 'https://cdn.example.invalid/galeri/ogrenci/ali/a.jpg';
const egitimOgesi = (ek = {}) => ({
  hedefTur: 'ogrenci', hedefDeger: 'ali', hedefOgrenciId: 'ali', ogrenciId: 'ali', hedefOgrenciAd: 'Ali Yılmaz',
  sinif: 'Papatyalar Sınıfı', sinifAdi: 'Papatyalar Sınıfı', kazanimAnahtari: KEY, program: 'montessori', egitimKaydi: true,
  gozlemDurum: 'T', durum: 'onaylandi', dosyaTipi: 'foto', bunnyUrl: URL_A, kucukResim: URL_A,
  bunnyPath: 'galeri/ogrenci/ali/a.jpg', yukleyen: 'ogretmen@example.invalid', yukleyenAd: 'Ece Öğretmen', ...ek
});
const gelisimAli = () => ({
  montessori: {
    kayitlar: { [KEY]: 'T' },
    detay: { [KEY]: { durum: 'T', not: 'Gözlem notu', fotoUrl: URL_A, galeriId: 'g1', fotoYol: 'galeri/ogrenci/ali/a.jpg', fotoDurum: 'onaylandi',
      asamalar: { S: { durum: 'S', fotoUrl: 'https://cdn.example.invalid/eski.jpg', galeriId: 'g0', fotoDurum: 'onaylandi' },
        T: { durum: 'T', not: 'Gözlem notu', fotoUrl: URL_A, galeriId: 'g1', fotoYol: 'galeri/ogrenci/ali/a.jpg', fotoDurum: 'onaylandi' } } } },
    fotolar: { [KEY]: URL_A, baska: 'https://cdn.example.invalid/x.jpg' }
  },
  sonGozlem: { galeriId: 'g1', fotoUrl: URL_A, fotoDurum: 'onaylandi', dersAd: 'Ayakkabı boyama', durum: 'T' }
});

// ── Sentetik Firestore (yol tabanlı; merge, arrayUnion, transaction, hata enjeksiyonu) ──
const nesne = v => v && typeof v === 'object' && !Array.isArray(v);
const birlestir = (a, b) => { const s = { ...(nesne(a) ? a : {}) }; for (const [k, v] of Object.entries(b)) s[k] = nesne(v) && nesne(s[k]) ? birlestir(s[k], v) : structuredClone(v); return s; };
function sahteFirestore(tohum = {}, { hata = () => null } = {}) {
  const belgeler = new Map(Object.entries(tohum).map(([k, v]) => [k, structuredClone(v)]));
  const iz = [];
  const ref = parcalar => ({ path: parcalar.join('/'), id: parcalar.at(-1) });
  const dene = (tur, r) => { const e = hata(tur, r.path); if (e) { iz.push(`hata:${tur}:${r.path}`); throw e; } };
  const fb = {
    doc: (_db, ...p) => ref(p), collection: (_db, ...p) => ({ path: p.join('/') }),
    getDoc: async r => { iz.push(`oku:${r.path}`); return { id: r.id, exists: () => belgeler.has(r.path), data: () => structuredClone(belgeler.get(r.path)) }; },
    getDocs: async c => { iz.push(`liste:${c.path}`); const on = c.path + '/';
      return { docs: [...belgeler.keys()].filter(k => k.startsWith(on) && !k.slice(on.length).includes('/')).map(k => ({ id: k.split('/').at(-1), ref: ref(k.split('/')) })) }; },
    setDoc: async (r, veri, sec) => { dene('set', r); iz.push(`yaz:${r.path}`); belgeler.set(r.path, sec?.merge ? birlestir(belgeler.get(r.path), veri) : structuredClone(veri)); },
    updateDoc: async (r, veri) => { dene('update', r); iz.push(`guncelle:${r.path}`);
      if (!belgeler.has(r.path)) throw Object.assign(new Error('not-found'), { code: 'not-found' });
      const mevcut = belgeler.get(r.path);
      for (const [k, v] of Object.entries(veri)) mevcut[k] = v?.__arrayUnion ? [...(mevcut[k] || []), ...structuredClone(v.__arrayUnion)] : structuredClone(v); },
    deleteDoc: async r => { dene('delete', r); iz.push(`sil:${r.path}`); belgeler.delete(r.path); },
    runTransaction: async (_db, fn) => { const yazilar = []; iz.push('islem'); await fn({ get: r => fb.getDoc(r), set: (...a) => yazilar.push(a) }); for (const a of yazilar) await fb.setDoc(...a); },
    arrayUnion: (...ogeler) => ({ __arrayUnion: ogeler }),
    serverTimestamp: () => 'SUNUCU_ZAMANI'
  };
  return { fb, db: {}, belgeler, iz };
}
const yetkiHatasi = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

// ───────────────────────── A. Alıcı etiketi ─────────────────────────

test('alıcı etiketi: canlı ad + sınıf, kayıttaki eski ad uyarısı ve tüm görünümler', () => {
  const a = alici.galeriAlici({ hedefTur: 'ogrenci', hedefDeger: 'ali', hedefOgrenciAd: 'Ali  yılmaz' }, rehber);
  assert.deepEqual(a, { tur: 'ogrenci', ogrenciId: 'ali', ad: 'Ali Yılmaz', sinif: 'Papatyalar Sınıfı', uyari: '' }, 'boşluk/harf farkı uyarı değildir; sınıf dönem kaydından');
  const yanlis = alici.galeriAlici({ hedefTur: 'cocuk', hedefOgrenciId: 'ali', hedefOgrenciAd: 'Ayşe Demir' }, rehber);
  assert.equal(yanlis.ad, 'Ali Yılmaz'); assert.equal(yanlis.uyari, 'kayıtta: Ayşe Demir');
  assert.equal(alici.galeriAliciMetni(yanlis), '👤 Ali Yılmaz · Papatyalar Sınıfı');
  assert.equal(alici.galeriAliciMetni(alici.galeriAlici({ hedefTur: 'sinif', hedefDeger: 'Kardelenler Sınıfı' })), '👥 Kardelenler Sınıfı');
  assert.equal(alici.galeriAliciMetni(alici.galeriAlici({ hedefTur: 'sinif', sinif: 'Yedek Sınıf' })), '👥 Yedek Sınıf');
  for (const tur of ['tumOkul', 'okul', 'tum']) assert.equal(alici.galeriAliciMetni(alici.galeriAlici({ hedefTur: tur })), '🏫 Tüm okul');
  assert.equal(alici.galeriAliciMetni(alici.galeriAlici({})), '⚠️ Alıcı belirsiz — düzenleyin');
});

test('alıcı etiketi: çelişkili kimlik, kimliksiz çocuk ve bilinmeyen tür belirsizdir; kayıp öğrenci uyarılı', () => {
  const cakisma = alici.galeriAlici({ hedefTur: 'ogrenci', hedefDeger: 'ali', hedefOgrenciId: 'ali', ogrenciId: 'ayse' }, rehber);
  assert.equal(cakisma.tur, 'belirsiz'); assert.equal(cakisma.uyari, 'çelişkili alıcı');
  assert.equal(alici.galeriAlici({ hedefTur: 'ogrenci', hedefDeger: '  ' }, rehber).uyari, 'çocuk kimliği yok');
  assert.equal(alici.galeriAlici({ hedefTur: 'grup', hedefDeger: 'x' }, rehber).tur, 'belirsiz');
  assert.equal(alici.galeriAlici({ hedefTur: '', hedefOgrenciId: 'ali' }, rehber).tur, 'belirsiz', 'hedefTur boşsa veli sorgusu göremez');
  assert.equal(alici.galeriAlici({ hedefTur: 'sinif' }).tur, 'belirsiz');
  const kayip = alici.galeriAlici({ hedefTur: 'ogrenci', hedefDeger: 'gitti', hedefOgrenciAd: 'Eski Öğrenci', sinifAdi: 'Nar' }, rehber);
  assert.deepEqual(kayip, { tur: 'ogrenci', ogrenciId: 'gitti', ad: 'Eski Öğrenci', sinif: 'Nar', uyari: 'öğrenci kaydı bulunamadı' });
  const html = alici.galeriAliciHtml({ ...kayip, ad: '<img src=x>' }, { yukleyen: 'x@y.z"><b>' });
  assert.ok(!html.includes('<img src=x>') && !html.includes('"><b>'), 'etiket HTML kaçışlı');
  assert.match(html, /öğrenci kaydı bulunamadı/); assert.match(html, /Yükleyen: x@y\.z/);
});

test('cümle metinleri: onaya gönderme ve alıcı değişimi onayları çocuğu/sınıfı adıyla söyler', () => {
  const a = alici.galeriAlici({ hedefTur: 'ogrenci', hedefDeger: 'ali' }, rehber);
  assert.equal(alici.galeriYuklemeOnayMetni(a), 'Bu fotoğraf Ali Yılmaz (Papatyalar Sınıfı) için onaya gönderilecek.');
  assert.equal(alici.galeriYuklemeOnayMetni(alici.galeriAlici({ hedefTur: 'sinif', hedefDeger: 'Papatyalar Sınıfı' }), { adet: 3 }), 'Bu 3 dosya Papatyalar Sınıfı için onaya gönderilecek.');
  assert.equal(alici.galeriAliciDegisimOnayMetni(a), 'Bu fotoğraf artık yalnızca Ali Yılmaz (Papatyalar Sınıfı) velisine görünecek.');
  assert.equal(alici.galeriAliciDegisimOnayMetni({ tur: 'sinif', sinif: 'Nar' }, { video: true }), 'Bu video artık yalnızca Nar sınıfı velilerine görünecek.');
  assert.equal(alici.galeriAliciDegisimOnayMetni({ tur: 'okul' }), 'Bu fotoğraf artık tüm okul velilerine görünecek.');
  assert.equal(alici.galeriYukleyenEtiketi({ yukleyenAd: 'Öğretmen', yukleyen: 'T@x.io' }), 'T@x.io', 'genel etiket ad sayılmaz, e-postaya düşer');
  assert.equal(alici.galeriYukleyenEtiketi({ yukleyenAd: 'Ece Öğretmen', yukleyen: 't@x.io' }), 'Ece Öğretmen');
});

test('yetkiler kurallarla aynı: yönetim/koordinatör/admin her öğe, öğretmen yalnız kendi yüklediği', () => {
  const oge = { yukleyen: 'Ogretmen@Example.invalid' };
  for (const rol of ['kurucu_mudur', 'mudur', 'egitim_koordinator']) assert.equal(alici.galeriSilmeYetkisi(oge, { email: 'baska@x.io', rol }), true);
  assert.equal(alici.galeriSilmeYetkisi(oge, { email: 'emrahby@gmail.com', rol: '' }), true);
  assert.equal(alici.galeriSilmeYetkisi(oge, { email: 'ogretmen@example.invalid', rol: 'ogretmen' }), true);
  assert.equal(alici.galeriSilmeYetkisi({ ekleyenEmail: 'o@x.io' }, { email: 'o@x.io', rol: 'ogretmen' }), true);
  assert.equal(alici.galeriSilmeYetkisi(oge, { email: 'baska@x.io', rol: 'ogretmen' }), false);
  assert.equal(alici.galeriOnaylayiciMi({ rol: 'egitim_koordinator' }), false, 'Portal onay yetkisi koordinatörü kapsamaz');
  assert.equal(alici.galeriOnaylayiciMi({ rol: 'mudur' }), true);
});

// ───────────────────────── C. Alıcıyı düzenle ─────────────────────────

test('alıcıyı düzenle: öğrenci/sınıf/okul alanları ve denetim kaydı sözleşmeyle birebir', () => {
  const zaman = '2026-10-20T09:00:00.000Z';
  const g = alici.galeriAliciGuncellemesi(egitimOgesi(), { tur: 'ogrenci', ogrenciId: 'ayse' }, { yapan: 'Mudur@X.io', zaman, ogrenciler, ayarListesi });
  assert.deepEqual(g.alanlar, { hedefTur: 'ogrenci', hedefDeger: 'ayse', hedefOgrenciId: 'ayse', ogrenciId: 'ayse', hedefOgrenciAd: 'Ayşe Demir',
    sinif: 'Kardelenler Sınıfı', sinifAdi: 'Kardelenler Sınıfı', guncellendi: zaman });
  assert.deepEqual(g.denetim, { onceki: { tur: 'ogrenci', ogrenciId: 'ali', ad: 'Ali Yılmaz', sinif: 'Papatyalar Sınıfı' },
    yeni: { tur: 'ogrenci', ogrenciId: 'ayse', ad: 'Ayşe Demir', sinif: 'Kardelenler Sınıfı' }, yapan: 'mudur@x.io', zaman });
  const sinifsiz = alici.galeriAliciGuncellemesi({ hedefTur: 'sinif', hedefDeger: 'Nar' }, { tur: 'ogrenci', ogrenciId: 'ali' }, { ogrenciler, ayarListesi });
  assert.ok(!('sinif' in sinifsiz.alanlar) && !('sinifAdi' in sinifsiz.alanlar), 'boş sınıf alanlarına dokunulmaz');
  const s = alici.galeriAliciGuncellemesi(egitimOgesi(), { tur: 'sinif', sinif: 'Nar Sınıfı' }, { zaman });
  assert.deepEqual(s.alanlar, { hedefTur: 'sinif', hedefDeger: 'Nar Sınıfı', sinif: 'Nar Sınıfı', hedefOgrenciId: '', ogrenciId: '', hedefOgrenciAd: '', sinifAdi: 'Nar Sınıfı', guncellendi: zaman });
  const o = alici.galeriAliciGuncellemesi(egitimOgesi({ hedefEtiket: 'Ali Yılmaz' }), { tur: 'okul' }, { zaman });
  assert.deepEqual(o.alanlar, { hedefTur: 'tumOkul', hedefDeger: '', hedefOgrenciId: '', ogrenciId: '', hedefOgrenciAd: '', hedefEtiket: 'Tüm okul', guncellendi: zaman });
  assert.throws(() => alici.galeriAliciGuncellemesi({}, { tur: 'ogrenci', ogrenciId: 'yok' }, { ogrenciler }), /bulunamadı/);
  assert.throws(() => alici.galeriAliciGuncellemesi({}, { tur: 'sinif', sinif: ' ' }), /Sınıf seçin/);
  assert.equal(alici.galeriAliciGuncellemesi({ hedefTur: 'tumOkul', hedefDeger: '' }, { tur: 'okul' }).degisti, false);
  const izin = alici.galeriAliciGuncellemesi({ hedefTur: 'sinif', hedefDeger: 'A', izinsizOgrenciler: [{ id: 'x' }] }, { tur: 'ogrenci', ogrenciId: 'ali' }, { ogrenciler });
  assert.deepEqual(izin.alanlar.izinsizOgrenciler, [], 'tek çocuk hedefinde izinsiz listesi boşalır');
});

test('onaylı eğitim fotoğrafının alıcısı değişince: tek update + eski çocuk temizliği + egitim_{id} silme + yeni aileye bildirim', async () => {
  const f = sahteFirestore({ 'galeri/g1': egitimOgesi(), 'ogrenciGelisim/ali': gelisimAli(), 'ogrenciler/ali/bildirimler/egitim_g1': { tip: 'egitim_gelisim', fotoUrl: URL_A } });
  const cagri = [];
  const sonuc = await alici.galeriAliciniDegistir('g1', { tur: 'ogrenci', ogrenciId: 'ayse' }, { ...f, yapan: 'mudur@x.io', ogrenciler, ayarListesi,
    gelisimEsitle: async (oge, durum) => cagri.push(['esitle', oge.ogrenciId, durum]),
    egitimOnayEsitle: async (id, durum, sec) => { cagri.push(['egitim', id, durum, sec.canliOnay]); return true; },
    genelBildirim: async () => cagri.push(['genel']) });
  assert.equal(sonuc.durum, 'degisti'); assert.deepEqual(sonuc.uyarilar, []);
  assert.equal(f.iz.filter(x => x === 'guncelle:galeri/g1').length, 1, 'alanlar tek updateDoc ile yazılır');
  const g = f.belgeler.get('galeri/g1');
  assert.equal(g.hedefDeger, 'ayse'); assert.equal(g.hedefOgrenciId, 'ayse'); assert.equal(g.ogrenciId, 'ayse'); assert.equal(g.hedefOgrenciAd, 'Ayşe Demir'); assert.equal(g.sinif, 'Kardelenler Sınıfı');
  assert.equal(g.aliciDuzenlemeleri.length, 1); assert.equal(g.aliciDuzenlemeleri[0].onceki.ogrenciId, 'ali'); assert.equal(g.aliciDuzenlemeleri[0].yapan, 'mudur@x.io');
  const eski = f.belgeler.get('ogrenciGelisim/ali'), d = eski.montessori.detay[KEY];
  assert.deepEqual([d.fotoUrl, d.galeriId, d.fotoYol], ['', '', '']); assert.equal(d.durum, 'T', 'eğitim aşaması korunur'); assert.equal(d.not, 'Gözlem notu');
  assert.deepEqual([d.asamalar.T.fotoUrl, d.asamalar.T.galeriId], ['', '']); assert.equal(d.asamalar.S.galeriId, 'g0', 'başka fotoğrafa dokunulmaz');
  assert.equal(eski.montessori.fotolar[KEY], ''); assert.equal(eski.montessori.fotolar.baska, 'https://cdn.example.invalid/x.jpg');
  assert.equal(eski.sonGozlem.fotoUrl, ''); assert.equal(eski.sonGozlem.galeriId, ''); assert.equal(eski.sonGozlem.dersAd, 'Ayakkabı boyama');
  assert.ok(!f.belgeler.has('ogrenciler/ali/bildirimler/egitim_g1'), 'eski ailenin eğitim bildirimi silinir');
  assert.deepEqual(cagri, [['esitle', 'ayse', 'onaylandi'], ['egitim', 'g1', 'onaylandi', true]]);
  assert.ok(f.iz.indexOf('guncelle:galeri/g1') < f.iz.indexOf('sil:ogrenciler/ali/bildirimler/egitim_g1'));
  assert.equal(sonuc.plan.oncekiAileGormusOlabilir, true);
});

test('bekleyen eğitim fotoğrafı: yeni çocuğa bekliyor senkronu, aileye bildirim yok; yetkisiz bildirim silme uyarıdır', async () => {
  const f = sahteFirestore({ 'galeri/g1': egitimOgesi({ durum: 'beklemede' }), 'ogrenciGelisim/ali': gelisimAli() },
    { hata: (tur, yol) => tur === 'delete' && yol.includes('/bildirimler/') ? yetkiHatasi() : null });
  const cagri = [];
  const sonuc = await alici.galeriAliciniDegistir('g1', { tur: 'ogrenci', ogrenciId: 'ayse' }, { ...f, ogrenciler, ayarListesi,
    gelisimEsitle: async (oge, durum) => cagri.push(['esitle', oge.hedefDeger, durum]),
    egitimOnayEsitle: async () => cagri.push(['egitim']), genelBildirim: async () => cagri.push(['genel']) });
  assert.deepEqual(cagri, [['esitle', 'ayse', 'beklemede']]);
  assert.equal(sonuc.uyarilar.length, 1); assert.match(sonuc.uyarilar[0], /eğitim bildirimi silinemedi: permission-denied/);
  assert.equal(sonuc.plan.oncekiAileGormusOlabilir, false);
});

test('onaylı genel fotoğraf sınıfa taşınınca genel galeri bildirimi; aynı alıcı yazma yapmaz; izinsiz listesi yeniden hesaplanır', async () => {
  const genel = { hedefTur: 'ogrenci', hedefDeger: 'ali', hedefOgrenciId: 'ali', durum: 'onaylandi', dosyaTipi: 'foto', izinsizOgrenciler: [] };
  const f = sahteFirestore({ 'galeri/g2': genel });
  const cagri = [];
  const sonuc = await alici.galeriAliciniDegistir('g2', { tur: 'sinif', sinif: 'Kardelenler Sınıfı' }, { ...f, ogrenciler, ayarListesi,
    izinsizHesapla: async hedef => [{ id: 'ayse', ad: 'Ayşe Demir', hedef: hedef.sinif }],
    gelisimEsitle: async () => cagri.push('esitle'), egitimOnayEsitle: async () => cagri.push('egitim'),
    genelBildirim: async oge => cagri.push(['genel', oge.hedefTur, oge.hedefDeger]) });
  assert.deepEqual(cagri, [['genel', 'sinif', 'Kardelenler Sınıfı']]);
  assert.deepEqual(f.belgeler.get('galeri/g2').izinsizOgrenciler, [{ id: 'ayse', ad: 'Ayşe Demir', hedef: 'Kardelenler Sınıfı' }]);
  assert.ok(!f.iz.some(x => x.startsWith('islem')), 'eğitim kaydı olmayan öğede gelişim okunmaz');
  const once = f.iz.length;
  const ayni = await alici.galeriAliciniDegistir('g2', { tur: 'sinif', sinif: 'Kardelenler Sınıfı' }, { ...f, ogrenciler, ayarListesi });
  assert.equal(ayni.durum, 'ayni'); assert.ok(!f.iz.slice(once).some(x => x.startsWith('guncelle')));
});

test('gerçek Portal galeriAliciKaydet: bellek güncellenir, "önceki aile görmüş olabilir" notu ve köprüler çağrılır', async () => {
  const f = sahteFirestore({ 'galeri/g1': egitimOgesi(), 'ogrenciGelisim/ali': gelisimAli(), 'ogrenciler/ali/bildirimler/egitim_g1': {} });
  const toasts = [], cagri = [];
  const ctx = vm.createContext({ ...f.fb, db: f.db, console: { warn() {}, error() {} }, showToast: (...a) => toasts.push(a), confirm: () => true,
    currentUser: { email: 'mudur@x.io' }, aktifKullaniciRol: 'mudur', isAdmin: false, sinifYonetimListesi: [],
    getOgrenciDurum: () => 'aktif', escapeHtml: v => String(v ?? ''),
    galeriGozlemOnayiEsitle: async (oge, durum) => cagri.push(['esitle', oge.ogrenciId, durum]),
    galeriGuncellemeBildirimi: async () => cagri.push(['genel']), renderGaleri: async () => cagri.push(['render']) });
  ctx.window = ctx;
  ctx.PortalAPI = { state: { ogrenciList: ogrenciler, ayarListesi } };
  ctx.galeriEgitimOnayiniEsitle = async (id, durum, sec) => { cagri.push(['egitim', id, durum, sec.canliOnay]); return true; };
  galeriAliciBaglaminaEkle(ctx);
  vm.runInContext(`let galeriListesiVerisi=[{id:'g1',hedefDeger:'ali',durum:'onaylandi'}];let galeriOnayDurumu={status:'ready',items:[]};let aktifLightboxOge=null;function galeriOnayRozetGuncelle(){}\n`
    + dilim('// ===== ALICIYI DÜZENLE (ortak sözleşme C) =====', 'window.galeriAliciDuzenle = async function(id)')
    + '\nglobalThis.kaydet=galeriAliciKaydet;globalThis.liste=()=>galeriListesiVerisi;', ctx);
  assert.equal(await ctx.kaydet('g1', { tur: 'ogrenci', ogrenciId: 'ayse' }), true);
  assert.equal(ctx.liste()[0].hedefDeger, 'ayse');
  assert.match(toasts.at(-1)[0], /Alıcı güncellendi: 👤 Ayşe Demir · Kardelenler Sınıfı · Önceki aile fotoğrafı daha önce görmüş olabilir\./);
  assert.deepEqual(cagri, [['esitle', 'ayse', 'onaylandi'], ['egitim', 'g1', 'onaylandi', true], ['render']]);
  ctx.aktifKullaniciRol = 'egitim_koordinator';
  assert.equal(await ctx.kaydet('g1', { tur: 'okul' }), false, 'Portal onay yetkisi olmayan düzenleyemez');
  assert.equal(f.belgeler.get('galeri/g1').hedefDeger, 'ayse');
});

// ───────────────────────── D. Silme ─────────────────────────

const silmeTohumu = (ek = {}) => ({
  'galeri/g1': egitimOgesi(ek), 'ogrenciGelisim/ali': gelisimAli(),
  'ogrenciler/ali/bildirimler/egitim_g1': { tip: 'egitim_gelisim', fotoUrl: URL_A },
  'galeri/g1/etkilesimler/veli1': { acmaSayisi: 2 }, 'galeri/g1/etkilesimler/veli2': { indirildi: true }
});

test('silme sırası: belge → gelişim bağı + egitim bildirimi → etkileşimler → galeri belgesi → Bunny dosyası', async () => {
  const f = sahteFirestore(silmeTohumu());
  const silinen = [], onaylar = [];
  const sonuc = await alici.galeriOgesiniSil('g1', { ...f, oturum: { email: 'mudur@x.io', rol: 'mudur' },
    onayla: metin => { onaylar.push(metin); return true; }, medyaSil: async yol => { f.iz.push(`depo:${yol}`); silinen.push(yol); } });
  assert.equal(sonuc.ok, true);
  assert.deepEqual(onaylar, ['Bu fotoğraf kalıcı olarak silinecek; veliler hiçbir ekranda göremeyecek.']);
  const sira = ['oku:galeri/g1', 'islem', 'yaz:ogrenciGelisim/ali', 'sil:ogrenciler/ali/bildirimler/egitim_g1', 'liste:galeri/g1/etkilesimler',
    'sil:galeri/g1/etkilesimler/veli1', 'sil:galeri/g1/etkilesimler/veli2', 'sil:galeri/g1', 'depo:galeri/ogrenci/ali/a.jpg'];
  assert.deepEqual(f.iz.filter(x => sira.includes(x)), sira);
  assert.deepEqual(silinen, ['galeri/ogrenci/ali/a.jpg'], 'medyaSil kayıttaki bunnyPath ile çağrılır');
  assert.ok(!f.belgeler.has('galeri/g1')); assert.ok(![...f.belgeler.keys()].some(k => k.startsWith('galeri/g1/')));
  const d = f.belgeler.get('ogrenciGelisim/ali').montessori.detay[KEY];
  assert.equal(d.fotoUrl, ''); assert.equal(d.fotoDurum, 'silindi'); assert.equal(d.durum, 'T');
});

test('galeri belgesi silinemezse (permission-denied) işlem durur: depolama silinmez, açık yetki hatası', async () => {
  const f = sahteFirestore(silmeTohumu(), { hata: (tur, yol) => tur === 'delete' && yol === 'galeri/g1' ? yetkiHatasi() : null });
  let depo = 0;
  const sonuc = await alici.galeriOgesiniSil('g1', { ...f, oturum: { email: 'koordinator@x.io', rol: 'egitim_koordinator' }, medyaSil: async () => { depo++; } });
  assert.equal(sonuc.ok, false); assert.equal(sonuc.hata, 'Bu fotoğrafı silme yetkiniz yok.'); assert.equal(depo, 0);
  assert.ok(f.belgeler.has('galeri/g1'));
  const diger = sahteFirestore(silmeTohumu(), { hata: (tur, yol) => tur === 'delete' && yol === 'galeri/g1' ? new Error('unavailable') : null });
  assert.equal((await alici.galeriOgesiniSil('g1', { ...diger, oturum: { rol: 'mudur' } })).hata, 'Silinemedi: unavailable');
});

test('depolama en iyi çabadır: medyaSil hatası uyarı olur; Stream videosu ve yolsuz kayıt atlanır', async () => {
  const f = sahteFirestore(silmeTohumu());
  const sonuc = await alici.galeriOgesiniSil('g1', { ...f, oturum: { rol: 'mudur' }, medyaSil: async () => { throw new Error('Silme başarısız'); } });
  assert.equal(sonuc.ok, true); assert.match(sonuc.uyarilar.join(' '), /Depolama dosyası silinemedi: Silme başarısız/); assert.ok(!f.belgeler.has('galeri/g1'));
  const v = sahteFirestore({ 'galeri/v1': { hedefTur: 'tumOkul', dosyaTipi: 'video', bunnyPath: '', streamVideoId: 'vid', streamLibraryId: 'lib', yukleyen: 'm@x.io' } });
  let depo = 0;
  const video = await alici.galeriOgesiniSil('v1', { ...v, oturum: { rol: 'mudur' }, onayla: m => { assert.match(m, /^Bu video kalıcı/); return true; }, medyaSil: async () => { depo++; } });
  assert.equal(video.ok, true); assert.equal(depo, 0); assert.match(video.notlar.join(' '), /Stream silme işlemi yok/);
  const fb = alici.galeriDepolamaPlani({ storagePath: 'galeri/eski.mp4', depolamaSaglayici: 'firebase-storage' });
  assert.equal(fb.bunnyYolu, ''); assert.equal(fb.firebaseYolu, 'galeri/eski.mp4');
  assert.equal(alici.galeriDepolamaPlani({ fotoYol: 'galeri/f.jpg' }).bunnyYolu, 'galeri/f.jpg');
  assert.equal(alici.galeriDepolamaPlani({ bunnyUrl: 'https://cdn.example.invalid/galeri/x.jpg' }).bunnyYolu, '', 'bilinmeyen ana makineden yol türetilmez');
  assert.equal(alici.galeriDepolamaPlani({ bunnyUrl: 'https://cdn.example.invalid/galeri/x%20y.jpg?w=1' }, { yuklemeKokleri: ['https://cdn.example.invalid/'] }).bunnyYolu, 'galeri/x y.jpg');
});

test('öğretmen başkasının yüklemesini silemez, kendisininkini siler ama etkileşimlere dokunmaz; iptal ve silinmiş belge yazmaz', async () => {
  const f = sahteFirestore(silmeTohumu());
  const red = await alici.galeriOgesiniSil('g1', { ...f, oturum: { email: 'baska@x.io', rol: 'ogretmen' }, medyaSil: async () => assert.fail('silinmemeli') });
  assert.equal(red.durum, 'yetki-yok'); assert.equal(red.hata, 'Bu fotoğrafı silme yetkiniz yok.');
  assert.ok(!f.iz.some(x => /^(yaz|sil|guncelle)/.test(x)));
  const iptal = await alici.galeriOgesiniSil('g1', { ...f, oturum: { rol: 'mudur' }, onayla: () => false });
  assert.equal(iptal.durum, 'iptal'); assert.ok(!f.iz.some(x => /^(yaz|sil|guncelle)/.test(x)));
  const kendi = await alici.galeriOgesiniSil('g1', { ...f, oturum: { email: 'ogretmen@example.invalid', rol: 'ogretmen' }, medyaSil: async () => {} });
  assert.equal(kendi.ok, true); assert.ok(!f.iz.includes('liste:galeri/g1/etkilesimler'), 'etkileşim silme yalnız yönetim');
  assert.equal((await alici.galeriOgesiniSil('g1', { ...f, oturum: { rol: 'mudur' } })).durum, 'yok');
});

test('gerçek Portal silGaleriOge: ReferenceError yok, medyaSil(bunnyPath), bellek ve onay kuyruğu temizlenir', async () => {
  const f = sahteFirestore(silmeTohumu());
  const toasts = [], depo = [], denetim = [];
  const ctx = vm.createContext({ ...f.fb, db: f.db, console: { warn() {}, error() {}, info() {} }, showToast: (...a) => toasts.push(a), confirm: () => true,
    currentUser: { email: 'mudur@x.io' }, aktifKullaniciRol: 'mudur', isAdmin: false, escapeHtml: v => String(v ?? ''),
    medyaSil: async yol => { depo.push(yol); return true; }, renderGaleri: async () => {} });
  ctx.window = ctx; ctx.PortalAPI = { state: {} }; ctx.zekiDenetim = (eylem, detay) => denetim.push([eylem, detay.galeriId]);
  galeriAliciBaglaminaEkle(ctx);
  vm.runInContext(`let galeriListesiVerisi=[{id:'g1'},{id:'g2'}];let galeriOnayDurumu={status:'ready',items:[{id:'g1'}]};let aktifLightboxOge=null;function galeriOnayRozetGuncelle(){}\n`
    + dilim('// Sil — ızgara, albüm ve Eğitim klasörü', '// ============ ALBÜM ZIP İNDİRME')
    + '\nglobalThis.durum=()=>({liste:galeriListesiVerisi.map(x=>x.id),kuyruk:galeriOnayDurumu.items.map(x=>x.id)});', ctx);
  assert.equal(await ctx.silGaleriOge('g1'), true);
  assert.deepEqual(depo, ['galeri/ogrenci/ali/a.jpg']); assert.equal(JSON.stringify(ctx.durum()), JSON.stringify({ liste: ['g2'], kuyruk: [] }));
  assert.match(toasts.at(-1)[0], /Fotoğraf kalıcı olarak silindi/); assert.deepEqual(denetim, [['galeri_sil', 'g1']]);
  assert.ok(!toasts.some(([m]) => /bunnyDeleteFile|is not defined/.test(m)));
  assert.equal(await ctx.silGaleriOge('g1'), false); assert.match(toasts.at(-1)[0], /zaten silinmiş/);
});

// ───────────────────────── B. Onay ekranları ─────────────────────────

const yonetimDurumu = { ogrenciList: [{ id: 'a', ogrenciAdSoyad: 'Canlı Ad' }], ayarListesi: { a: { kayit: { sinif: 'Papatyalar Sınıfı' } } } };

test('Onay Bekleyenler kartı alıcı + yükleyeni gösterir; belirsiz alıcıda Onayla devre dışı ve düzenle düğmesi var', async () => {
  const r = galleryRuntime({ state: yonetimDurumu });
  r.window.galeriFilter('onayBekliyor');
  r.emit([media('sinifta', { yukleyenAd: 'Ece Öğretmen' }), media('cakisma', { hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciId: 'b', yukleyen: 'ogr@x.io' }),
    media('eskiad', { hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciAd: 'Yanlış Ad' })]);
  await settle();
  const html = r.html();
  assert.match(html, /👥 Sentetik Sınıf/); assert.match(html, /Yükleyen: Ece Öğretmen/); assert.match(html, /Yükleyen: ogr@x\.io/);
  assert.match(html, /👤 Canlı Ad · Papatyalar Sınıfı/); assert.match(html, /kayıtta: Yanlış Ad/);
  assert.match(html, /galeriOnayla\('sinifta'\)/); assert.doesNotMatch(html, /galeriOnayla\('cakisma'\)/);
  assert.match(html, /data-onay-engelli="cakisma"[^>]*disabled|disabled[^>]*data-onay-engelli="cakisma"/); assert.match(html, /Önce alıcıyı düzenleyin/);
  assert.match(html, /⚠️ Alıcı belirsiz — düzenleyin/); assert.match(html, /çelişkili alıcı/);
  assert.equal((html.match(/data-galeri-alici-duzenle=/g) || []).length, 3);
  assert.deepEqual(r.calls.writes, []);
});

test('galeriOnayla belirsiz alıcıyı sunucuda da reddeder; önizleme alıcıyı ve düzenle düğmesini gösterir', async () => {
  const cakisma = media('cakisma', { hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciId: 'b' });
  const r = galleryRuntime({ rows: [cakisma], state: yonetimDurumu });
  assert.equal(await r.window.galeriOnayla('cakisma'), false); assert.deepEqual(r.calls.writes, []);
  assert.match(r.calls.toasts.at(-1).message, /Önce alıcıyı düzenleyin/);
  r.window.galeriFilter('onayBekliyor'); r.emit([media('ozel', { hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciAd: 'Eski Ad', yukleyen: 'o@x.io' })]);
  r.window.acGaleriLightbox('ozel');
  assert.match(r.nodes.get('galeriLightboxAlici').innerHTML, /👤 Canlı Ad · Papatyalar Sınıfı/);
  assert.match(r.nodes.get('galeriLightboxAlici').innerHTML, /kayıtta: Eski Ad/);
  assert.match(r.nodes.get('galeriLightboxAlici').innerHTML, /Yükleyen: o@x\.io/);
  assert.equal(r.nodes.get('galeriLightboxAliciBtn').style.display, 'inline-flex');
  r.window.closeGaleriLightbox(); assert.equal(r.nodes.get('galeriLightboxAlici').style.display, 'none');
});

test('albüm görünümü canlı alıcıyı başlıkta, bekleyen kartta alıcı/yükleyeni gösterir; öğretmen yalnız kendi yüklemesinde sil görür', async () => {
  const rows = [media('own', { hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciAd: 'Eski Ad', yukleyen: 'teacher@example.test', etkinlikTarih: '2026-10-01' }),
    media('other', { durum: 'onaylandi', yukleyen: 'baska@example.test', etkinlikTarih: '2026-10-02' })];
  const yonetim = galleryRuntime({ rows, state: yonetimDurumu });
  yonetim.window.galeriFilter('album'); await settle(); await settle();
  assert.match(yonetim.html(), /📅 [^·]+ · 👤 Canlı Ad · Papatyalar Sınıfı/); assert.match(yonetim.html(), /Yükleyen: teacher@example\.test/);
  assert.match(yonetim.html(), /silGaleriOge\('own'\)/); assert.match(yonetim.html(), /silGaleriOge\('other'\)/);
  const ogretmen = galleryRuntime({ rows, state: { ...yonetimDurumu, rol: 'ogretmen', currentUser: { uid: 'teacher', email: 'teacher@example.test' } } });
  await ogretmen.render();
  assert.match(ogretmen.html(), /silGaleriOge\('own'\)/); assert.doesNotMatch(ogretmen.html(), /silGaleriOge\('other'\)/);
  assert.doesNotMatch(ogretmen.html(), /galeriAliciDuzenle/, 'öğretmen alıcı düzenleyemez');
});

function klasorCalisma(items, options) {
  const kaynak = readFileSync(new URL('../js/portal-galeri-klasor-ui.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export function ', 'function ');
  class Host { constructor() { this._html = ''; this.nodes = null; } set innerHTML(v) { this._html = v; this.nodes = null; } get innerHTML() { return this._html; }
    insertAdjacentHTML(_w, html) { this.innerHTML += html; }
    querySelectorAll(s) { if (!this.nodes) this.nodes = [...this._html.matchAll(/<[^>]+\s(data-[\w-]+)(?:="([^"]*)")?[^>]*>/g)].map(m => ({ key: m[1], dataset: { [m[1].slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]: m[2] || '' } })); return this.nodes.filter(n => s === `[${n.key}]`); }
    querySelector(s) { return this.querySelectorAll(s)[0] || null; } }
  const host = new Host(), calls = { deleted: [], approve: [], edit: [] };
  const ctx = vm.createContext({ ...folders, console, window: { silGaleriOge: id => calls.deleted.push(id), galeriOnayla: id => calls.approve.push(id), galeriReddet() {} },
    mountMedia() {}, disposeMedia() {}, refreshGalleryCards() {}, downloadAlbum() {} });
  vm.runInContext(kaynak + '\nglobalThis.view=createGalleryFolderView();', ctx);
  const opts = { management: true, activePeriod: '2026-2027', editRecipient: m => calls.edit.push(m.id), ...options };
  ctx.view.render(host, items, opts);
  const tikla = (attr, i = 0) => { const el = host.querySelectorAll(`[${attr}]`)[i]; assert.ok(el, attr); el.onclick(); ctx.view.render(host, items, opts); };
  return { host, calls, tikla };
}

test('Eğitim klasörü çocukları karıştırınca başlık tek çocuk göstermez; her kartta alıcı, belirsizde Onayla kapalı', () => {
  const gozlem = (id, ek) => ({ id, program: 'montessori', kazanimAnahtari: 'pratik__Bakım__X', alanId: 'pratik', donem: '2026-2027', dosyaTipi: 'foto', durum: 'beklemede', ...ek });
  const items = [gozlem('a1', { hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciAd: 'İlk Çocuk', yukleyen: 'o@x.io' }),
    gozlem('b1', { hedefTur: 'ogrenci', hedefDeger: 'b', hedefOgrenciAd: 'İkinci Çocuk' }), gozlem('c1', { hedefTur: 'ogrenci', hedefDeger: 'c', ogrenciId: 'd' })];
  const r = alici.galeriAliciRehberi([{ id: 'a', ogrenciAdSoyad: 'Canlı A' }, { id: 'b', ogrenciAdSoyad: 'Canlı B' }]);
  const k = klasorCalisma(items, {
    recipient: m => { const x = alici.galeriAlici(m, r); return { text: alici.galeriAliciMetni(x), warning: x.uyari, blocked: alici.galeriAliciBelirsizMi(x) }; },
    uploader: m => alici.galeriYukleyenEtiketi(m), canDelete: m => m.id !== 'b1' });
  k.tikla('data-program-index', 0); k.tikla('data-folder-index');
  const html = k.host.innerHTML;
  assert.match(html, /Farklı alıcılar · her kartta gösterilir/); assert.doesNotMatch(html, /<div style="font-size:12px;color:#64748b;margin-top:5px">[^<]*İlk Çocuk/);
  assert.match(html, /👤 Canlı A/); assert.match(html, /👤 Canlı B/); assert.match(html, /kayıtta: İlk Çocuk/); assert.match(html, /Yükleyen: o@x\.io/);
  assert.equal(k.host.querySelectorAll('[data-approve]').length, 2); assert.equal(k.host.querySelectorAll('[data-approve-blocked]').length, 1);
  assert.equal(k.host.querySelectorAll('[data-folder-delete]').length, 2, 'silme yetkisi olmayana sil düğmesi gösterilmez');
  k.host.querySelectorAll('[data-recipient-edit]')[0].onclick(); assert.equal(k.calls.edit.length, 1);
});

test('eğitim onay paneli canlı adı ve kayıt uyarısını gösterir; belirsiz alıcıda Onayla devre dışı', async () => {
  const eski = globalThis.window;
  globalThis.window = { PortalAPI: { state: { isAdmin: true, ogrenciList: [{ id: 'child', ogrenciAdSoyad: 'Gerçek Çocuk' }], ayarListesi: { child: { kayit: { sinif: 'Nar Sınıfı' } } } } } };
  try {
    const temel = { id: 'm1', durum: 'beklemede', hedefTur: 'ogrenci', hedefDeger: 'child', program: 'montessori', kazanimAnahtari: 'a__b__c', gozlemDurum: 'S' };
    const dogru = detayHTML({ ...temel, hedefOgrenciAd: 'Yanlış Çocuk' });
    assert.match(dogru, /👤 Gerçek Çocuk · Nar Sınıfı \(kayıtta: Yanlış Çocuk\)/); assert.match(dogru, /<b>Gerçek Çocuk<\/b>/); assert.match(dogru, /data-zgo-onay /);
    const belirsiz = detayHTML({ ...temel, ogrenciId: 'other' });
    assert.match(belirsiz, /data-zgo-onay-engelli/); assert.doesNotMatch(belirsiz, /data-zgo-onay /); assert.match(belirsiz, /Önce alıcıyı düzenleyin/);
  } finally { if (eski === undefined) delete globalThis.window; else globalThis.window = eski; }
});

// ───────────────────────── E. Yüklemede alıcı görünürlüğü ─────────────────────────

function yuklemeOrtami({ rol = 'ogretmen', hedefTur = 'ogrenci', ogrenci = 'ali', onay = true, dosyalar = [{ name: 'a.jpg', type: 'image/jpeg', size: 100 }] } = {}) {
  const nodes = new Map(), yazilar = [], toasts = [], onaylar = [], yuklemeler = [], onayBildirimleri = [];
  const degerler = { galeriEtkinlik: 'Sentetik', galeriEtkinlikTarih: '2026-10-20', galeriAciklama: '', galeriHedefTur: hedefTur, galeriKategori: '',
    galeriHedefSinif: 'Papatyalar Sınıfı', galeriHedefOgrenci: ogrenci };
  const document = { getElementById: id => { if (!nodes.has(id)) nodes.set(id, { value: degerler[id] || '', style: {}, checked: false, textContent: '', options: [{ dataset: { ad: 'Seçicideki Ad' } }], selectedIndex: 0 }); return nodes.get(id); } };
  const yonetim = rol !== 'ogretmen';
  const ctx = vm.createContext({ confirm: m => { onaylar.push(m); return onay; }, classifyGalleryFile, gallerySession, galeriBekliyorMu: pendingGallery,
    notifyGalleryApproval: async x => { onayBildirimleri.push(x); return { ok: true }; },
    window: { PortalAPI: { state: { currentUser: { uid: 'u', email: 'u@x.io' }, ogrenciList: ogrenciler, ayarListesi } } }, document, console: { error() {}, warn() {} },
    galeriSecilenDosyalar: dosyalar, aktifKullaniciRol: rol, isAdmin: false, currentUser: { uid: 'u', email: 'u@x.io' }, aktifPersonel: { adSoyad: 'Ece Öğretmen' },
    AKTIF_DONEM: '2026-2027', db: {}, galleryText, galeriProgramKodu: galleryProgram, ogretmenRolMu: () => !yonetim, aktifKullaniciSiniflari: ['Papatyalar Sınıfı'],
    isoTarih: () => '2026-10-20', showToast: (...a) => toasts.push(a), resimSikistir: async f => f,
    medyaYukle: async (f, yol) => { yuklemeler.push(yol); return { url: 'https://cdn.example.invalid/' + f.name, yol: yol + '/' + f.name }; },
    galeriVideoYukle: async () => ({ embedUrl: 'https://iframe.mediadelivery.net/embed/1/v', videoId: 'v', libraryId: '1' }),
    collection: () => ({}), doc: () => ({ id: 'yeni-' + (yazilar.length + 1) }), setDoc: async (r, veri) => yazilar.push({ id: r.id, ...veri }),
    galeriGuncellemeBildirimi: async () => {}, galeriBildirimMailGonder: async () => {}, albumEkleMod: null, closeGaleriYuklemeModal() {}, renderGaleri() {} });
  galeriAliciBaglaminaEkle(ctx);
  vm.runInContext(dilim('window.galeriYukle = async function() {', '// Lightbox'), ctx);
  return { calistir: () => ctx.window.galeriYukle(), yazilar, toasts, onaylar, yuklemeler, onayBildirimleri };
}

test('öğretmen yüklemesi kaydetmeden önce çocuğun canlı adıyla onaylatılır; vazgeçerse hiçbir şey yüklenmez', async () => {
  const f = yuklemeOrtami();
  await f.calistir();
  assert.deepEqual(f.onaylar, ['Bu fotoğraf Ali Yılmaz (Papatyalar Sınıfı) için onaya gönderilecek.']);
  assert.equal(f.yazilar.length, 1); assert.equal(f.yazilar[0].hedefOgrenciAd, 'Ali Yılmaz'); assert.equal(f.yazilar[0].durum, 'beklemede');
  assert.equal(f.yazilar[0].yukleyenAd, 'Ece Öğretmen'); assert.equal(f.onayBildirimleri.length, 1);
  const vazgec = yuklemeOrtami({ onay: false });
  await vazgec.calistir();
  assert.equal(vazgec.onaylar.length, 1); assert.equal(vazgec.yuklemeler.length, 0); assert.equal(vazgec.yazilar.length, 0);
  const sinif = yuklemeOrtami({ hedefTur: 'sinif', dosyalar: [{ name: 'a.jpg', type: 'image/jpeg', size: 1 }, { name: 'b.jpg', type: 'image/jpeg', size: 1 }] });
  await sinif.calistir(); assert.deepEqual(sinif.onaylar, ['Bu 2 dosya Papatyalar Sınıfı için onaya gönderilecek.']);
});

test('"Tek çocuk" yüklemesi öğrenci seçilmeden kaydedilmez; yönetim yüklemesi onay sormadan yayınlanır', async () => {
  const f = yuklemeOrtami({ ogrenci: '' });
  await f.calistir();
  assert.equal(f.yazilar.length, 0); assert.equal(f.yuklemeler.length, 0); assert.equal(f.onaylar.length, 0);
  assert.match(f.toasts.at(-1)[0], /Tek çocuk yüklemesi için öğrenci seçin/);
  const y = yuklemeOrtami({ rol: 'mudur' });
  await y.calistir();
  assert.equal(y.onaylar.length, 0); assert.equal(y.yazilar[0].durum, 'onaylandi');
});

test('yükleme formu seçilen alıcıyı canlı gösterir ve öğrencisiz tek çocuk seçimini uyarır', () => {
  const nodes = new Map();
  const el = (id, deger = '') => { if (!nodes.has(id)) nodes.set(id, { value: deger, innerHTML: '', style: {}, options: [{ dataset: { ad: 'Eski Ad' } }], selectedIndex: 0 }); return nodes.get(id); };
  const ctx = vm.createContext({ document: { getElementById: id => el(id) }, isAdmin: false, aktifKullaniciRol: 'ogretmen', escapeHtml: v => String(v ?? '').replace(/</g, '&lt;') });
  ctx.window = ctx; ctx.PortalAPI = { state: { ogrenciList: ogrenciler, ayarListesi } };
  galeriAliciBaglaminaEkle(ctx);
  vm.runInContext(dilim('// Yükleme formunda seçilen alıcının canlı etiketi (sözleşme E).', '\nfunction doldurGaleriOgrenciSecici'), ctx);
  el('galeriHedefTur').value = 'ogrenci'; el('galeriHedefOgrenci').value = '';
  ctx.galeriAliciOnizlemeGuncelle();
  assert.match(el('galeriAliciOnizleme').innerHTML, /Öğrenci seçilmedi — tek çocuk yüklemesi öğrenci seçilmeden kaydedilmez/);
  el('galeriHedefOgrenci').value = 'ali'; ctx.galeriAliciOnizlemeGuncelle();
  assert.match(el('galeriAliciOnizleme').innerHTML, /👤 Ali Yılmaz · Papatyalar Sınıfı/); assert.match(el('galeriAliciOnizleme').innerHTML, /kayıtta: Eski Ad/);
  assert.match(el('galeriAliciOnizleme').innerHTML, /Yönetim onayından sonra yalnız bu alıcı görür/);
});

test('gözlem fotoğrafı (caGozlem) bekliyorsa onaylayıcıya bildirim gider; öğretmen önce çocuğun adıyla onaylar', async () => {
  const kurulum = ({ rol = 'ogretmen', onay = true, gelisimHatasi = false } = {}) => {
    const iz = [], toasts = [], onaylar = [];
    const ctx = vm.createContext({ console: { error() {}, warn() {} }, showToast: (...a) => toasts.push(a), confirm: m => { onaylar.push(m); return onay; },
      isAdmin: false, aktifKullaniciRol: rol, document: { getElementById: () => null },
      mufredatYukle: async () => [{ id: 'pratik', ad: 'Pratik', gruplar: [{ ad: 'Bakım', dersler: ['Ayakkabı'] }] }],
      caGozlemFotoYukle: async () => { iz.push('foto'); return { id: 'gal1', url: 'u', yol: 'y', durum: rol === 'ogretmen' ? 'beklemede' : 'onaylandi' }; },
      caGozlemDetayKaydet: async () => { iz.push('gelisim'); if (gelisimHatasi) throw new Error('gelişim yazılamadı'); return null; },
      caGozlemEgitimGorunumunuGuncelle() {}, zekiDenetim() {}, galeriBekliyorMu: pendingGallery,
      notifyGalleryApproval: async x => { iz.push(['onay-bildirimi', x.id, x.durum]); return { ok: true }; } });
    ctx.window = ctx; ctx.PortalAPI = { state: { ogrenciList: ogrenciler, ayarListesi } }; ctx.caGozlemKapat = () => iz.push('kapat');
    galeriAliciBaglaminaEkle(ctx);
    vm.runInContext(`let caGozlemState={ogrId:'ali',ogrAd:'Ali Yılmaz',sinif:'Papatyalar Sınıfı',disiplin:'montessori',alanIdx:0,grupIdx:0,dersIdx:0,seviye:'T',not:'',foto:{name:'f.jpg'},kaydediliyor:false};\n`
      + dilim('window.caGozlemKaydet = async function() {', '\nfunction yonetimHomeHTML('), ctx);
    return { ctx, iz, toasts, onaylar };
  };
  const o = kurulum();
  await o.ctx.caGozlemKaydet();
  assert.deepEqual(o.onaylar, ['Bu fotoğraf Ali Yılmaz (Papatyalar Sınıfı) için onaya gönderilecek.']);
  assert.deepEqual(o.iz, ['foto', 'gelisim', ['onay-bildirimi', 'gal1', 'beklemede'], 'kapat']);
  assert.match(o.toasts.at(-1)[0], /fotoğraf Ali Yılmaz \(Papatyalar Sınıfı\) için yönetim onayında/);
  const vazgec = kurulum({ onay: false }); await vazgec.ctx.caGozlemKaydet(); assert.deepEqual(vazgec.iz, []);
  const hata = kurulum({ gelisimHatasi: true }); await hata.ctx.caGozlemKaydet();
  assert.deepEqual(hata.iz, ['foto', 'gelisim', ['onay-bildirimi', 'gal1', 'beklemede']], 'kaydedilen fotoğraf gelişim hatasında da bildirilir');
  const yonetim = kurulum({ rol: 'mudur' }); await yonetim.ctx.caGozlemKaydet();
  assert.deepEqual(yonetim.onaylar, []); assert.ok(!yonetim.iz.some(x => Array.isArray(x)), 'yayınlanan fotoğraf onay bildirimi üretmez');
});
