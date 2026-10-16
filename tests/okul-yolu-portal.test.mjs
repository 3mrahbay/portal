// Veli ana sayfası · Okul Yolu karosu (portal). Ortak modül: js/zeky-yol.js
// (ZEKY'deki www/js/zeky-yol.js ile birebir aynı dosya; ayrıntılı testler ZEKY'de).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPortal, installedPwa, assertPrecachedImport } from './helpers/portal-pwa.mjs';

const index = readPortal('index.html');
const kompakt = readPortal('moduller/veli-kompakt.js');
const modulKaynak = readPortal('js/zeky-yol.js');
const dizin = await mkdtemp(join(tmpdir(), 'portal-yol-'));
await writeFile(join(dizin, 'zeky-yol.mjs'), modulKaynak);
const Y = await import(pathToFileURL(join(dizin, 'zeky-yol.mjs')).href);

function fonksiyonKaynagi(kaynak, ad) {
  const bas = kaynak.indexOf(`async function ${ad}(`) >= 0 ? kaynak.indexOf(`async function ${ad}(`) : kaynak.indexOf(`function ${ad}(`);
  assert.ok(bas >= 0, `${ad} bulunamadı`);
  let i = kaynak.indexOf('{', bas), derinlik = 0;
  for (; i < kaynak.length; i++) {
    if (kaynak[i] === '{') derinlik++;
    else if (kaynak[i] === '}' && --derinlik === 0) return kaynak.slice(bas, i + 1);
  }
  throw new Error(`${ad} kapanmadı`);
}

test('ortak modül saf ve ZEKY kopyasıyla aynı sözleşme', () => {
  assert.doesNotMatch(modulKaynak, /^\s*import\s/m);
  assert.doesNotMatch(modulKaynak, /innerHTML/);
  assert.match(modulKaynak, /portal \(js\/zeky-yol\.js\) bu dosyanın BİREBİR/);
  assert.equal(Y.CAGRI_ADI, 'okulYoluV1');
  assert.equal(Y.TAZE_MS, 5 * 60 * 1000);
  for (const ad of ['yolPaneliKur', 'satirBilgisi', 'konumAlici', 'yolServisiOlustur', 'sonSonuc', 'otomatikZamaniMi']) {
    assert.equal(typeof Y[ad], 'function', ad);
  }
});

test('ana sayfa: Okul Yolu kartı hava kartından hemen sonra; doldurma açılışta çağrılır', () => {
  const ev = fonksiyonKaynagi(index, 'caHomeHTML');
  const hava = ev.indexOf('id="veliHavaKart"'), yol = ev.indexOf('id="veliYolKart"'), sabah = ev.indexOf('id="veliSabahGirisiKart"');
  assert.ok(hava > 0 && hava < yol && yol < sabah);
  assert.match(ev, /id="veliYolKart" class="ca-card"[^>]*data-yol="bekliyor"/);
  assert.match(index, /caHomeHavaDoldur\(\); caHomeYolDoldur\(\); veliOkulZiliDoldur\(\);/);
});

test('özellik anahtarı ZEKY ile ortak (okulYolu), varsayılan kapalı ve etiketli', () => {
  assert.match(index, /okulYolu: false\s+\/\/ Veli ana sayfası: okula tahmini yol süresi/);
  assert.match(index, /okulYolu: \{ ad: "Okul Yolu"/);
});

test('sunucu çağrısı güvenli callable çerçevesinden (App Check + oturum)', () => {
  const servis = fonksiyonKaynagi(index, 'caYolServisi');
  assert.match(servis, /import\("\.\/js\/zeky-randevu-cutover-runtime\.js"\)/);
  assert.match(servis, /m\.yolServisiOlustur\(\{ functions: await calisma\.guvenliFunctionsGetir\(\), httpsCallable: fn\.httpsCallable \}\)/);
  assert.match(index, /window\.caYolAcildi = \(\) => caYolPaneli\?\.hesapla\(\);/);
});

test('PWA: modülün sürümlü adresi önbelleğe alınır ve önbellek sürümü artar', async () => {
  const pwa = await installedPwa();
  assertPrecachedImport(pwa, 'index.html', 'js/zeky-yol.js');
  assertPrecachedImport(pwa, 'moduller/pickup-yetkilileri.js', 'js/zeky-yol.js');
  assert.match(readPortal('serviceworker.js'), /const CACHE_VERSION = "v204-veli-mobil-duzen";/);
  assert.match(index, /window\.PORTAL_SURUM = "v204";/);
});

const OKUL_AYARI = { ad: 'Bir Çiçek Koleji Anaokulu', adres: 'Aydınlı Mah., Bahçeler Sok. No:45, 34953 Tuzla/İstanbul', placeId: 'ChIJEe3U8uHbyhQR_75zGX5PEDk' };

async function doldur({ bayrak = true, depo = null, izin = false, otomatik = false } = {}) {
  const veri = {};
  const el = { dataset: veri, isConnected: true, cocuklar: ['eski'], replaceChildren() { this.cocuklar = []; } };
  const kurulan = [];
  const modul = {
    ...Y,
    konumAlici: () => ({ izinVarMi: async () => izin, al: async () => ({ enlem: 41, boylam: 29 }) }),
    otomatikZamaniMi: () => otomatik,
    yolPaneliKur: (kap, secenek) => { kurulan.push(secenek); return { hesapla: async () => null, arkaPlan: async () => null }; }
  };
  const kaynak = fonksiyonKaynagi(index, 'caHomeYolDoldur').replace('import("./js/zeky-yol.js?v=4")', '__modul()');
  const c = vm.createContext({
    document: { getElementById: id => id === 'veliYolKart' ? el : null },
    window: { localStorage: depo }, console: { warn() {} }, setTimeout, Promise, Date, Object,
    ozellikBayraklariYukle: async () => ({ okulYolu: bayrak }),
    caYolPaneli: null, caYolServisi: async () => ({}),
    db: {}, doc: (_db, k, id) => `${k}/${id}`,
    getDoc: async yol => ({ exists: () => yol === 'ayarlar/okulYolu', data: () => ({ ...OKUL_AYARI, _guncelleyen: 'yonetim@okul' }) }),
    __modul: async () => modul
  });
  vm.runInContext(kaynak + '\nglobalThis.calistir = caHomeYolDoldur;', c);
  await c.calistir();
  return { el, veri, kurulan };
}

test('doldurma: özellik kapalıyken karo gizlenir; açıkken pencere kurulur ve karo "dokunun" der', async () => {
  const kapali = await doldur({ bayrak: false });
  assert.equal(kapali.veri.yol, 'kapali');
  assert.deepEqual(kapali.el.cocuklar, []);
  assert.equal(kapali.kurulan.length, 0);

  const acik = await doldur();
  assert.equal(acik.veri.yol, 'hazir');
  assert.equal(acik.veri.ozet, 'Süreyi görmek için dokunun');
  assert.equal(acik.veri.deger, '');
  assert.equal(acik.kurulan.length, 1);
  assert.equal(typeof acik.kurulan[0].bildir, 'function');
  assert.deepEqual({ ...acik.kurulan[0].okul }, OKUL_AYARI, 'Okul kaydı "Konumu gönder" için panele verilir');
});

test('doldurma: 5 dakikadan yeni sonuç varsa karo süreyi büyük gösterir', async () => {
  const m = new Map([['zeky_okul_yolu_v1', JSON.stringify({ son: 'araba', sonuclar: { araba: {
    ok: true, durum: 'rota', mod: 'araba', sureSn: 1200, normalSureSn: 1150, mesafeM: 9000, hedef: { enlem: 40.857, boylam: 29.331 }, zaman: Date.now() - 60e3 } } })]]);
  const depo = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  const { veri } = await doldur({ depo });
  assert.equal(veri.deger, '20 dk');
  assert.equal(veri.ozet, 'Araba · trafik akıcı');
  assert.equal(veri.ikon, 'car');
  assert.equal(veri.renk, '#15803D');
});

test('karo: hava karosundan sonra, tam genişlik; açılınca süre hesaplanır; özet data-yol ile yenilenir', () => {
  const karolar = kompakt.slice(kompakt.indexOf('const KAROLAR = ['));
  assert.match(karolar, /\{ id: "veliHavaKart"[\s\S]*?\},\s*\{ id: "veliYolKart", ad: "Okul Yolu", ikon: "car"[^}]*genis: true,[\s\S]*?ozet: yolOzet, acildi: \(\) => window\.caYolAcildi\?\.\(\) \}/);
  const yolOzet = vm.runInNewContext(`(${fonksiyonKaynagi(kompakt, 'yolOzet')})`);
  assert.deepEqual({ ...yolOzet({ dataset: { yol: 'hazir', ozet: 'Araba · trafik akıcı', deger: '20 dk', ikon: 'car', renk: '#15803D', acik: '#DCFCE7' } }) },
    { durum: 'tamam', yazi: 'Araba · trafik akıcı', deger: '20 dk', ikon: 'car', renk: '#15803D', acik: '#DCFCE7' });
  assert.equal(yolOzet({ dataset: { yol: 'hazir', ozet: 'Süreyi görmek için dokunun', deger: '' } }).durum, 'bos');
  for (const yol of ['bekliyor', 'kapali', undefined]) assert.equal(yolOzet({ dataset: { yol } }).durum, 'gizle');
  assert.match(kompakt, /attributes: true, attributeFilter: \["data-yol"\]/);
  assert.match(kompakt, /if \(typeof k\.acildi === "function"\) \{ try \{ k\.acildi\(el\); \}/);
});

test('pencere görünümü: sekmeler, büyük süre, harita yüksekliği, hareket azaltma', () => {
  assert.match(index, /\.cicek-app \.yol-sekmeler \{ display:grid; grid-template-columns:repeat\(3,1fr\);/);
  assert.match(index, /\.cicek-app \.yol-buyuk \{ font-size:34px; font-weight:800;/);
  assert.match(index, /\.cicek-app \.yol-harita \{ height:220px;/);
  assert.match(index, /prefers-reduced-motion: reduce\) \{ \.cicek-app \.yol-donen/);
});

test('pencere: "Haritalar\'da aç" ve "Konumu gönder" yan yana', () => {
  assert.match(index, /\.cicek-app \.yol-eylemler \{ display:flex; gap:8px; \}/);
  assert.match(index, /\.cicek-app \.yol-git, \.cicek-app \.yol-gonder \{ flex:1 1 0; min-width:0;/);
  assert.match(index, /\.cicek-app \.yol-gonder\[hidden\], \.cicek-app \.yol-paylas-not\[hidden\] \{ display:none; \}/);
  for (const ad of ['okulBilgisiDuzelt', 'konumMesaji', 'whatsappBaglantisi', 'konumPaylas', 'konumGonderilebilirMi', 'teslimKonumuGonder']) {
    assert.equal(typeof Y[ad], 'function', ad);
  }
});

test('teslim alabilecek kişiler ve Okul Zili: anne/baba dışındakilere okulun konumu gönderilir', () => {
  const py = readPortal('moduller/pickup-yetkilileri.js');
  assert.match(py, /import\("\.\.\/js\/zeky-yol\.js\?v=4"\),\s*fb\.getDoc\(fb\.doc\(db, "ayarlar", "okulYolu"\)\)/);
  assert.match(py, /const konumVar = \(k\) => !!\(okul && yol\?\.konumGonderilebilirMi\(k\)\);/);
  assert.match(py, /onclick="window\._pickupYetki\.konumGonder\(\$\{i\}\)"/);
  assert.match(py, /if \(!\(await kaydet\(ogr\.id, yeni\)\)\) return;[\s\S]*?await gonderKartiGoster\(kisi\);/, 'Kayıt başarılıysa gönderme kartı');
  assert.match(py, /yol\.konumMesaji\(\{ okul, kisiAdi: kisi\.ad, cocukAdi: ogr\.ogrenciAdSoyad \|\| "", teslim: true \}\)/);
  assert.match(py, /\$\{esc\(metin\)\}/, 'Mesaj önizlemesi kaçışlı');
  assert.match(py, /yol\.teslimKonumuGonder\(\{ okul, kisi, cocukAdi: ogr\.ogrenciAdSoyad \|\| "", bugun: false, disariAc \}\)/);
  assert.match(py, /export async function zilKonumKur\(\)/);
  assert.match(py, /kutu\.hidden = !yol\.konumGonderilebilirMi\(kisi\);/);
  assert.match(py, /window\._pickupYetki = \{ formAc, ekle, sil, ogretmenPopup, konumGonder, gonderWa, gonderPaylas, gonderKapat, zilKonumGonder \};/);
  const zilBas = index.indexOf('window.veliOkulZiliDoldur = async function()');
  const zil = index.slice(zilBas, index.indexOf('// ── Teslim + veli teyidi tamam', zilBas));
  assert.ok(zilBas > 0 && zil.length > 0);
  assert.match(zil, /<div id="vzKonum" hidden style="padding:0 18px 12px;"><\/div>/);
  assert.match(zil, /modulYukle\("pickup-yetkilileri"\)\.then\(m => m\?\.zilKonumKur\?\.\(\)\)/);
});

test('iPhone: pencere yüksekliği vh yerine örtünün yüzdesi; düğmeler haritanın üstünde, harita telefonda kısa', () => {
  const kompaktCss = readPortal('moduller/veli-kompakt.js');
  assert.match(kompaktCss, /\.vkp-sayfa \{ width:100%; max-width:520px; max-height:100%;/);
  assert.match(kompaktCss, /\.vkp-sayfa \{ max-width:none; max-height:94%;/);
  assert.doesNotMatch(kompaktCss, /\.vkp-sayfa \{[^}]*max-height:\d+vh/);
  assert.match(index, /@media \(max-width:560px\) \{ \.cicek-app \.yol-harita \{ height:180px; \} \}/);
  assert.match(modulKaynak, /panel\.append\(sekmeler, sonucKutusu, dugmeler2, paylasNot, harita, kaynak\);/);
});
