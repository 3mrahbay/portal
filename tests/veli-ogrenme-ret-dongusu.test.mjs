// 20 Eki ret ölçümü: veli öğrenme modülü ogrenciler/{id}/bildirimler alt koleksiyonunu
// her DOM değişikliğinde yeniden okuyordu (kural reddediyor → havuz boş → gözlemci tekrar
// tetikliyor). Bu test modülü sahte DOM ve sahte Firestore ile gerçekten çalıştırır.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const kaynak = await readFile(new URL('../js/zeky-veli-ogrenme-deneyimi.js', import.meta.url), 'utf8');
const flush = () => new Promise((r) => setImmediate(r));

function kurgu({ alt = 'ret', altKayitlar = [] } = {}) {
  const okumalar = [];
  const zamanlayicilar = [];
  let gozlemciGeriCagri = null;
  const icerik = { id: 'veliBildirimlerContent', dataset: {}, isConnected: true, children: [], firstChild: null,
    insertBefore(d) { this.children.unshift(d); eklendi = d; } };
  let eklendi = null;
  const ogeler = new Map([['veliBildirimlerContent', icerik]]);
  const ogeYap = () => ({ style: {}, dataset: {}, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; },
    querySelectorAll: () => [], querySelector: () => ({ addEventListener() {} }), appendChild() {}, remove() {}, setAttribute() {} });
  const document = {
    getElementById: (id) => (id === 'zekyOgrenciBildirimleri' ? eklendi : ogeler.get(id) || null),
    querySelector: () => null, querySelectorAll: () => [], createElement: () => ogeYap(),
    head: { appendChild() {} }, body: { appendChild() {} }
  };
  const bos = { forEach() {}, docs: [] };
  const fb = {
    collection: (_db, ...p) => ({ path: p.join('/') }),
    doc: (_db, ...p) => ({ path: p.join('/') }),
    query: (c) => c, where: () => ({}),
    getDocs: async (ref) => {
      okumalar.push(ref.path);
      if (/^ogrenciler\/[^/]+\/bildirimler$/.test(ref.path)) {
        if (alt === 'ret') { const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; throw e; }
        const satirlar = altKayitlar.map((v, i) => ({ id: `b${i}`, data: () => v }));
        return { forEach: (fn) => satirlar.forEach(fn), docs: satirlar };
      }
      return bos;
    },
    getDoc: async (ref) => { okumalar.push(ref.path); return { exists: () => false, data: () => null }; }
  };
  const state = { veliAktifOgrenci: { id: 'c1', sinif: 'Papatya' }, aktifDonem: '' };
  const window = { PortalAPI: { state, fb, db: {} }, veliSwitchTab() {} };
  const context = vm.createContext({
    window, document, console: { warn() {} },
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout: (fn) => { zamanlayicilar.push(fn); return zamanlayicilar.length; }, clearTimeout() {},
    MutationObserver: class { constructor(fn) { gozlemciGeriCagri = fn; } observe() {} disconnect() {} },
    Date, Set, Map, JSON, Promise, Error, String, Number, Array, Object
  });
  const donusmus = kaynak
    .replace(/^import \{[^}]+\} from '\.\/zeky-egitim-portfolyo\.js\?v=\d+';/m,
      'const onayliGaleriGetir=async()=>[],portfolyoOlustur=()=>[],bugununSunumlari=()=>[];')
    .replace(/^import \{[^}]+\} from '\.\/veli-hedefli-okuma\.js\?v=\d+';/m,
      'const veliHedefliOku=async(fb,db,ad)=>fb.getDocs(fb.collection(db,ad));')
    .replace(/\bexport /g, '');
  vm.runInContext(donusmus, context);
  const calistir = async () => {
    for (let tur = 0; tur < 20 && zamanlayicilar.length; tur++) {
      const simdi = zamanlayicilar.splice(0);
      for (const fn of simdi) { try { fn(); } catch (_) { /* modül kendi hatasını yutar */ } }
      for (let i = 0; i < 20; i++) await flush();
    }
  };
  return {
    context, window, state, icerik, okumalar, calistir,
    altOkuma: () => okumalar.filter((p) => /^ogrenciler\/[^/]+\/bildirimler$/.test(p)).length,
    etkinlikOkuma: () => okumalar.filter((p) => p === 'etkinlikler').length,
    degisiklik: async (kez = 1) => { for (let i = 0; i < kez; i++) { gozlemciGeriCagri(); await calistir(); } }
  };
}

test('alt koleksiyon reddedilince oturumda bir kez denenir; DOM değişiklikleri yeniden okutmaz', async () => {
  const x = kurgu({ alt: 'ret' });
  x.context.kur(x.window);
  await x.calistir();
  await x.degisiklik(25);
  assert.equal(x.altOkuma(), 1, 'reddedilen alt koleksiyon yalnız bir kez okunmalı');
  assert.ok(x.etkinlikOkuma() <= 2, `etkinlik okuması döngüye girmemeli (${x.etkinlikOkuma()})`);
  // Veli bildirimler sekmesini açınca sayfa tazelenir ama reddedilen okuma tekrarlanmaz.
  x.window.veliSwitchTab('bildirimler');
  await x.calistir();
  assert.equal(x.altOkuma(), 1);
});

test('alt koleksiyon boş dönerse gözlemci döngüsü kesilir; sekme açılınca bir kez tazelenir', async () => {
  const x = kurgu({ alt: 'bos' });
  x.context.kur(x.window);
  await x.calistir();
  await x.degisiklik(1); // ilk değişiklikte zenginleştirme bir kez çalışır
  const ilk = x.okumalar.length;
  await x.degisiklik(25);
  assert.equal(x.okumalar.length, ilk, 'boş havuzda DOM değişikliği yeni okuma başlatmamalı');
  assert.equal(x.icerik.dataset.zvoBildirim, 'c1');
  x.window.veliSwitchTab('bildirimler');
  await x.calistir();
  assert.ok(x.etkinlikOkuma() > 0 && x.okumalar.length > ilk, 'sekme açılınca güncel veri okunmalı');
  const sekmeSonrasi = x.okumalar.length;
  await x.degisiklik(10);
  assert.equal(x.okumalar.length, sekmeSonrasi);
});

test('başka çocuğa geçince o çocuk için yeniden bakılır', async () => {
  const x = kurgu({ alt: 'bos' });
  x.context.kur(x.window);
  await x.calistir();
  await x.degisiklik(3);
  const once = x.altOkuma();
  x.state.veliAktifOgrenci = { id: 'c2', sinif: 'Lale' };
  await x.degisiklik(3);
  assert.equal(x.altOkuma(), once + 1);
  assert.equal(x.icerik.dataset.zvoBildirim, 'c2');
});

test('kayıt varsa bildirimler eklenir (mevcut davranış korunur)', async () => {
  const x = kurgu({ alt: 'izin', altKayitlar: [{ tip: 'duyuru', baslik: 'Yeni', olusturuldu: '2026-10-20T08:00:00Z' }] });
  x.context.kur(x.window);
  await x.calistir();
  await x.degisiklik(5);
  assert.equal(x.icerik.children.length, 1);
  assert.equal(x.icerik.dataset.zvoBildirim, undefined);
});
