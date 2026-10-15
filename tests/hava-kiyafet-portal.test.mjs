// Veli ana sayfası · Hava ve kıyafet karosu (portal). Ortak modül: js/zeky-hava.js
// (ZEKY'deki www/js/zeky-hava.js ile birebir aynı dosya).
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
const modulKaynak = readPortal('js/zeky-hava.js');
const dizin = await mkdtemp(join(tmpdir(), 'portal-hava-'));
await writeFile(join(dizin, 'zeky-hava.mjs'), modulKaynak);
const H = await import(pathToFileURL(join(dizin, 'zeky-hava.mjs')).href);

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

test('ortak modül saf: Firebase içe aktarmaz, innerHTML kullanmaz, portal yardımcılarını verir', () => {
  assert.doesNotMatch(modulKaynak, /^\s*import\s/m);
  assert.doesNotMatch(modulKaynak, /innerHTML/);
  for (const ad of ['havaHazirla', 'havaOzetSatiri', 'havaDetayCiz', 'kiyafetOnerisi', 'havaAdresi']) assert.equal(typeof H[ad], 'function', ad);
  assert.match(modulKaynak, /portal \(js\/zeky-hava\.js\) bu dosyanın BİREBİR\s*\n\/\/ kopyasını kullanır/);
});

test('ana sayfa: hava kartı sabah girişinden önce, doldurma ana sayfa açılışında çağrılır', () => {
  const ev = fonksiyonKaynagi(index, 'caHomeHTML');
  const hava = ev.indexOf('id="veliHavaKart"'), sabah = ev.indexOf('id="veliSabahGirisiKart"');
  assert.ok(hava > 0 && hava < sabah, 'Hava kartı karo ızgarasının başında olmalı');
  assert.match(ev, /id="veliHavaKart" class="ca-card"[^>]*data-hava="yukleniyor"/);
  assert.match(index, /caHomeOryantasyonDoldur\(\); caHomeHavaDoldur\(\); veliOkulZiliDoldur\(\);/);
});

test('özellik anahtarı ZEKY ile ortak ve varsayılan açık; yönetim ekranında etiketli', () => {
  assert.match(index, /havaKiyafet: true\s+\/\/ Veli ana sayfası: hava ve kıyafet önerisi/);
  assert.match(index, /havaKiyafet: \{ ad: "Hava ve Kıyafet Önerisi"/);
});

test('PWA: modülün tam sürümlü adresi önbelleğe alınır', async () => {
  const pwa = await installedPwa();
  assertPrecachedImport(pwa, 'index.html', 'js/zeky-hava.js');
});

async function doldur({ bayrak = true, bilgi, hata, ayar = null } = {}) {
  const el = { dataset: {}, isConnected: true, cocuk: ['Yükleniyor'], replaceChildren() { this.cocuk = []; } };
  let cizilen = null;
  const modul = {
    havaHazirla: async ({ konum }) => { if (hata) throw hata; assert.deepEqual(konum, ayar); return bilgi; },
    havaOzetSatiri: H.havaOzetSatiri,
    havaDetayCiz: (kap, b) => { cizilen = b; kap.cocuk = ['detay']; }
  };
  const kaynak = fonksiyonKaynagi(index, 'caHomeHavaDoldur').replace('import("./js/zeky-hava.js?v=1")', '__modul()');
  const c = vm.createContext({
    document: { getElementById: id => id === 'veliHavaKart' ? el : null },
    window: {}, console: { warn() {} }, setTimeout, Promise,
    ozellikBayraklariYukle: async () => ({ havaKiyafet: bayrak }),
    db: {}, doc: (_db, a, b) => `${a}/${b}`,
    getDoc: async () => ({ exists: () => !!ayar, data: () => ayar }),
    __modul: async () => modul
  });
  vm.runInContext(kaynak + '\nglobalThis.calistir = caHomeHavaDoldur;', c);
  await c.calistir();
  return { el, cizilen };
}

const ornekBilgi = {
  gun: { tarih: '2026-10-16', etiket: 'Yarın okulda', kisa: 'Yarın', ileri: 1 },
  ozet: { enDusuk: 11, enYuksek: 12, hisDusuk: 9, yagisOlasiligi: 70, yagisMm: 1, ruzgar: 12, uv: 1, kod: 61 },
  oneriler: ['Hırka veya ince mont', 'Yağmurluk'], yerAdi: 'Tuzla'
};

test('doldurma: veri gelince kart hazır ve karo özeti yazılır; konum ayarı kullanılır', async () => {
  const ayar = { enlem: 41, boylam: 29, yerAdi: 'Kadıköy' };
  const { el, cizilen } = await doldur({ bilgi: ornekBilgi, ayar });
  assert.equal(el.dataset.hava, 'hazir');
  assert.equal(el.dataset.ozet, 'Yarın · 11°–12° · Yağmurlu');
  assert.equal(cizilen, ornekBilgi);
});

test('doldurma: özellik kapalı, veri yok veya ağ hatası → kart boş, karo gizlenecek', async () => {
  const kapali = await doldur({ bayrak: false, bilgi: ornekBilgi });
  assert.equal(kapali.el.dataset.hava, 'kapali');
  assert.deepEqual(kapali.el.cocuk, []);
  assert.equal(kapali.cizilen, null);
  const yok = await doldur({ bilgi: null });
  assert.equal(yok.el.dataset.hava, 'yok');
  const hata = await doldur({ hata: new Error('ağ yok') });
  assert.equal(hata.el.dataset.hava, 'yok');
  assert.deepEqual(hata.el.cocuk, []);
});

test('karo: tam genişlik ilk karo; özet kart durumunu izler, veri yoksa karo gizlenir', () => {
  const karolar = kompakt.slice(kompakt.indexOf('const KAROLAR = ['));
  assert.match(karolar, /^const KAROLAR = \[\s*\{ id: "veliHavaKart", ad: "Hava ve kıyafet", ikon: "cloud-sun"[^}]*genis: true/);
  const havaOzet = vm.runInNewContext(`(${fonksiyonKaynagi(kompakt, 'havaOzet')})`);
  assert.deepEqual({ ...havaOzet({ dataset: { hava: 'hazir', ozet: 'Yarın · 11°–12° · Yağmurlu' } }) }, { durum: 'tamam', yazi: 'Yarın · 11°–12° · Yağmurlu' });
  assert.equal(havaOzet({ dataset: { hava: 'kapali' } }).durum, 'gizle');
  assert.equal(havaOzet({ dataset: { hava: 'yok' } }).durum, 'gizle');
  assert.equal(havaOzet({ dataset: { hava: 'yukleniyor' } }).durum, 'yuk');
  assert.match(kompakt, /karo\.hidden = o\.durum === "gizle";\s*if \(karo\.hidden\) return;/);
  assert.match(kompakt, /\.vkp-karo\.vkp-genis \{ grid-column:1 \/ -1;/);
  assert.match(kompakt, /const ilk = KAROLAR\.map\(k => document\.getElementById\(k\.id\)\)\.find\(Boolean\);/);
});
