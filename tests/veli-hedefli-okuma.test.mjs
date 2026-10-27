// Faz 3b gizlilik: veli okumaları (duyurular · takvim · galeri) tüm koleksiyon yerine
// genel + kendi çocuğuna özel sorgulara bölünür. Bu dosya ortak yardımcının sorgu
// biçimlerini, birleştirme davranışını, veli yollarının dönüşümünü ve ekrandaki iki
// sızıntı düzeltmesini (etkinlik listesi, okul hayatı akışı) ağsız sınar.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readPortal, installedPwa, assertPrecachedImport } from './helpers/portal-pwa.mjs';
import * as hedefli from '../js/veli-hedefli-okuma.js';
import { onayliGaleriGetir } from '../js/zeky-egitim-portfolyo.js';

const {
  GENEL_HEDEFLER, COCUK_HEDEFLERI, EN_FAZLA_COCUK, cocukIdleriniHazirla, veliSorgulariniOlustur,
  sorgulariBirlestir, veliHedefliOku, cocukHedefliMi, cocukHedefiUygunMu
} = hedefli;

const index = readPortal('index.html');
const fonk = (kaynak, ad) => {
  const bas = kaynak.search(new RegExp(`(?:async )?function ${ad}\\(`));
  assert.ok(bas >= 0, `${ad} bulunamadı`);
  return kaynak.slice(bas, kaynak.indexOf('\n}\n', bas) + 2);
};

// ── Sahte Firestore: sorguları kaydeder ve kısıtları belgeler üzerinde uygular ──
const ID_ALANI = '__belgeKimligi__';
function kosulUyar(belge, { alan, op, deger }) {
  const v = alan === ID_ALANI ? belge.id : belge[alan];
  if (op === '==') return v === deger;
  if (op === 'in') return deger.includes(v);
  if (op === 'array-contains') return Array.isArray(v) && v.includes(deger);
  if (op === '>=') return v != null && v >= deger;
  if (op === '<=') return v != null && v <= deger;
  throw new Error(`desteklenmeyen işleç: ${op}`);
}
function sahteFirestore(belgeler = {}, { hata = () => null, filtresiz = false } = {}) {
  const sorgular = [];
  const fb = {
    collection: (_db, ad) => ({ ad, kosullar: [] }),
    where: (alan, op, deger) => ({ alan, op, deger }),
    query: (kol, ...kosullar) => ({ ad: kol.ad, kosullar }),
    getDocs: async q => {
      sorgular.push(q);
      const h = hata(q);
      if (h) throw h;
      // filtresiz: bugünkü kurallar gibi her şeyi döndürür — istemci süzmesini ayrıca sınamak için.
      const satirlar = (belgeler[q.ad] || []).filter(b => filtresiz || q.kosullar.every(k => kosulUyar(b, k)));
      const docs = satirlar.map(b => ({ id: b.id, data: () => ({ ...b }) }));
      return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) };
    },
    getDoc: async () => ({ exists: () => false, data: () => null }),
    doc: (_db, ...yol) => yol.join('/')
  };
  return { fb, sorgular };
}

// ── Faz 3b kural sözleşmesinin sınama eşleniği ──
// Firestore kuralları filtre değildir: sorgu kısıtları dönebilecek HER belgenin veliye
// okunabilir olduğunu kanıtlamalıdır. Kapsam dışı koleksiyonlar burada denetlenmez.
const COCUK_ALANLARI = {
  duyurular: [['hedefDeger', '=='], ['ogrenciler', 'array-contains']],
  takvim: [['hedefDeger', '==']],
  galeri: [['hedefDeger', '=='], ['hedefOgrenciId', '==']]
};
function kuralIzinVerir({ ad, kosullar }, cocukIdleri) {
  if (!COCUK_ALANLARI[ad]) return true;
  if (!kosullar.every(k => ['==', 'in', 'array-contains'].includes(k.op))) return false;
  if (ad === 'galeri' && !kosullar.some(k => k.alan === 'durum' && k.op === '==' && k.deger === 'onaylandi')) return false;
  const tur = kosullar.find(k => k.alan === 'hedefTur');
  const turler = tur?.op === 'in' ? tur.deger : tur?.op === '==' ? [tur.deger] : [];
  if (!turler.length) return false;
  if (turler.every(t => GENEL_HEDEFLER.includes(t))) return true;
  if (!turler.every(t => COCUK_HEDEFLERI.includes(t))) return false;
  return kosullar.some(k => COCUK_ALANLARI[ad].some(([a, op]) => k.alan === a && k.op === op && cocukIdleri.includes(k.deger)));
}
const bicim = q => q.kosullar.map(k => `${k.alan} ${k.op} ${JSON.stringify(k.deger)}`).join(' & ');
// vm bağlamından dönen diziler başka realm'dedir; karşılaştırma için bu realm'e alınır.
const basliklar = liste => Array.from(liste, x => x.baslik).sort();

// ═══════════════════════ Ortak yardımcı ═══════════════════════

test('sabitler kural sözleşmesiyle birebir aynı ve değiştirilemez', () => {
  assert.deepEqual([...GENEL_HEDEFLER], ['tumOkul', 'okul', 'tum', 'sinif']);
  assert.deepEqual([...COCUK_HEDEFLERI], ['ogrenci', 'cocuk']);
  assert.equal(EN_FAZLA_COCUK, 10);
  assert.ok(Object.isFrozen(GENEL_HEDEFLER) && Object.isFrozen(COCUK_HEDEFLERI));
});

test('duyurular sorguları: genel + çocuk başına hedefDeger ve ogrenciler array-contains', () => {
  const { fb } = sahteFirestore();
  const sorgular = veliSorgulariniOlustur(fb, {}, 'duyurular', [{ id: 'a' }, 'b']);
  assert.deepEqual(sorgular.map(q => [q.ad, bicim(q)]), [
    ['duyurular', 'hedefTur in ["tumOkul","okul","tum","sinif"]'],
    ['duyurular', 'hedefTur in ["ogrenci","cocuk"] & hedefDeger == "a"'],
    ['duyurular', 'hedefTur in ["ogrenci","cocuk"] & ogrenciler array-contains "a"'],
    ['duyurular', 'hedefTur in ["ogrenci","cocuk"] & hedefDeger == "b"'],
    ['duyurular', 'hedefTur in ["ogrenci","cocuk"] & ogrenciler array-contains "b"']
  ]);
  assert.ok(sorgular.every(q => kuralIzinVerir(q, ['a', 'b'])));
});

test('takvim sorguları: genel + çocuk başına yalnız hedefDeger; ek eşitlik koşulu her sorguya eklenir', () => {
  const { fb } = sahteFirestore();
  assert.deepEqual(veliSorgulariniOlustur(fb, {}, 'takvim', ['a']).map(bicim), [
    'hedefTur in ["tumOkul","okul","tum","sinif"]',
    'hedefTur in ["ogrenci","cocuk"] & hedefDeger == "a"'
  ]);
  const gunluk = veliSorgulariniOlustur(fb, {}, 'takvim', ['a'], { ekKosullar: [['tarih', '==', '2026-10-20']] });
  assert.deepEqual(gunluk.map(bicim), [
    'tarih == "2026-10-20" & hedefTur in ["tumOkul","okul","tum","sinif"]',
    'tarih == "2026-10-20" & hedefTur in ["ogrenci","cocuk"] & hedefDeger == "a"'
  ]);
  assert.ok(gunluk.every(q => kuralIzinVerir(q, ['a'])));
});

test('galeri sorgularının hepsi durum == onaylandi taşır; eski şema hedefOgrenciId hedefTur ile birlikte', () => {
  const { fb } = sahteFirestore();
  const sorgular = veliSorgulariniOlustur(fb, {}, 'galeri', ['a']);
  assert.deepEqual(sorgular.map(bicim), [
    'durum == "onaylandi" & hedefTur in ["tumOkul","okul","tum","sinif"]',
    'durum == "onaylandi" & hedefTur in ["ogrenci","cocuk"] & hedefDeger == "a"',
    'durum == "onaylandi" & hedefTur in ["ogrenci","cocuk"] & hedefOgrenciId == "a"'
  ]);
  assert.deepEqual(veliSorgulariniOlustur(fb, {}, 'galeri', ['a'], { genel: false }).map(bicim), sorgular.slice(1).map(bicim));
  assert.ok(sorgular.every(q => kuralIzinVerir(q, ['a'])));
  assert.ok(sorgular.every(q => !q.kosullar.some(k => k.alan === 'ogrenciId')), 'hedefTur\'suz ogrenciId sorgusu yok');
});

test('aralık ya da sıralama gibi eşitlik dışı ek koşullar ve bilinmeyen koleksiyon reddedilir', () => {
  const { fb } = sahteFirestore();
  for (const kosul of [['tarih', '>=', '2026-10-01'], ['tarih', '<=', 'x'], ['tarih', 'in', ['x']], ['', '==', 'x'], 'tarih']) {
    assert.throws(() => veliSorgulariniOlustur(fb, {}, 'takvim', ['a'], { ekKosullar: [kosul] }), /yalnız eşitlik/);
  }
  assert.throws(() => veliSorgulariniOlustur(fb, {}, 'etkinlikler', ['a']), /desteklemiyor/);
  for (const q of ['duyurular', 'takvim', 'galeri'].flatMap(ad => veliSorgulariniOlustur(fb, {}, ad, ['a', 'b']))) {
    assert.ok(q.kosullar.every(k => ['==', 'in', 'array-contains'].includes(k.op)), bicim(q));
  }
});

test('çocuk kimlikleri tekrarsız, boşsuz ve en çok 10; fazla çocuk sorgu sayısını büyütmez', () => {
  assert.deepEqual(cocukIdleriniHazirla(['a', { id: 'a' }, ' b ', '', null, { id: 7 }, { ad: 'x' }, 'c']), ['a', 'b', 'c']);
  assert.deepEqual(cocukIdleriniHazirla(undefined), []);
  const on2 = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}` }));
  assert.deepEqual(cocukIdleriniHazirla(on2), on2.slice(0, 10).map(c => c.id));
  const { fb } = sahteFirestore();
  assert.equal(veliSorgulariniOlustur(fb, {}, 'duyurular', on2).length, 1 + 10 * 2);
  assert.equal(veliSorgulariniOlustur(fb, {}, 'takvim', on2).length, 1 + 10);
  assert.equal(veliSorgulariniOlustur(fb, {}, 'galeri', [], { genel: false }).length, 0);
});

test('birleştirme belge kimliğine göre tekilleştirir ve QuerySnapshot gibi davranır', async () => {
  const { fb, sorgular } = sahteFirestore({ duyurular: [
    { id: 'genel', hedefTur: 'tumOkul' },
    { id: 'ikisi', hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciler: ['a', 'b'] },
    { id: 'ikinci', hedefTur: 'ogrenci', hedefDeger: 'x', ogrenciler: ['x', 'b'] },
    { id: 'baska', hedefTur: 'ogrenci', hedefDeger: 'z', ogrenciler: ['z'] }
  ] });
  const snap = await veliHedefliOku(fb, {}, 'duyurular', ['a', 'b']);
  assert.deepEqual(snap.docs.map(d => d.id).sort(), ['genel', 'ikinci', 'ikisi']);
  assert.equal(snap.size, 3);
  assert.equal(snap.empty, false);
  assert.equal(snap.eksik, false);
  const gorulen = [];
  snap.forEach(d => gorulen.push(d.id));
  assert.equal(gorulen.length, 3);
  assert.ok(sorgular.every(q => kuralIzinVerir(q, ['a', 'b'])));
});

test('bir kısım sorgu başarısızsa uyarı yazılır ve başarılı sonuçlarla devam edilir', async () => {
  const { fb } = sahteFirestore({ takvim: [{ id: 'g', hedefTur: 'tumOkul' }, { id: 'c', hedefTur: 'ogrenci', hedefDeger: 'a' }] },
    { hata: q => q.kosullar.some(k => k.alan === 'hedefDeger') ? Object.assign(new Error('gizli ayrıntı'), { code: 'permission-denied' }) : null });
  const uyarilar = [];
  const snap = await veliHedefliOku(fb, {}, 'takvim', ['a'], { etiket: 'sınama', uyar: (...x) => uyarilar.push(x) });
  assert.deepEqual(snap.docs.map(d => d.id), ['g']);
  assert.equal(snap.eksik, true);
  assert.equal(uyarilar.length, 1);
  assert.match(uyarilar[0][0], /^sınama: 1\/2 sorgu başarısız/);
  assert.equal(uyarilar[0][1], 'permission-denied');

  // Varsayılan uyarı console.warn'a gider.
  const eski = console.warn, yazilan = [];
  console.warn = (...x) => yazilan.push(x);
  try { await veliHedefliOku(fb, {}, 'takvim', ['a']); } finally { console.warn = eski; }
  assert.equal(yazilan.length, 1);
  assert.match(yazilan[0][0], /takvim veli okuması/);
});

test('tüm sorgular başarısızsa ilk hata aynen fırlatılır; sorgu yoksa boş sonuç döner', async () => {
  const ilk = Object.assign(new Error('ilk'), { code: 'permission-denied' });
  let n = 0;
  const { fb } = sahteFirestore({}, { hata: () => (n++ === 0 ? ilk : new Error('sonraki')) });
  await assert.rejects(() => veliHedefliOku(fb, {}, 'galeri', ['a']), e => e === ilk);
  // getDocs eşzamanlı fırlatsa da allSettled içinde yakalanır.
  const atan = { getDocs: () => { throw ilk; } };
  await assert.rejects(() => sorgulariBirlestir(atan, [{}, {}]), e => e === ilk);
  const bos = await sorgulariBirlestir(atan, []);
  assert.deepEqual([bos.size, bos.empty, bos.docs.length, bos.eksik], [0, true, 0, false]);
  await assert.rejects(() => veliHedefliOku(fb, {}, 'bilinmeyen', ['a']), /desteklemiyor/);
});

test('çocuk hedefi eşleşmesi galeriyle aynı kuralı kullanır: çelişen kimlik kapalı kalır', () => {
  assert.equal(cocukHedefliMi({ hedefTur: 'ogrenci' }), true);
  assert.equal(cocukHedefliMi({ hedefTur: 'cocuk' }), true);
  assert.equal(cocukHedefliMi({ hedefTip: 'ogrenci' }), true);
  assert.equal(cocukHedefliMi({ hedefTur: 'sinif', hedefTip: 'ogrenci' }), false);
  for (const tur of ['tumOkul', 'okul', 'tum', 'sinif', '', undefined]) assert.equal(cocukHedefliMi({ hedefTur: tur }), false);
  const cocuklar = [{ id: 'a' }, { id: 'b' }];
  assert.equal(cocukHedefiUygunMu({ hedefTur: 'ogrenci', hedefDeger: 'b' }, cocuklar), true);
  assert.equal(cocukHedefiUygunMu({ hedefTur: 'ogrenci', hedefOgrenciId: 'a' }, cocuklar), true);
  assert.equal(cocukHedefiUygunMu({ hedefTur: 'ogrenci', hedefDeger: 'z' }, cocuklar), false);
  assert.equal(cocukHedefiUygunMu({ hedefTur: 'ogrenci', hedefDeger: 'a', hedefOgrenciId: 'z' }, cocuklar), false);
  assert.equal(cocukHedefiUygunMu({ hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciId: 'b' }, cocuklar), false);
  assert.equal(cocukHedefiUygunMu({ hedefTur: 'ogrenci' }, cocuklar), false);
  assert.equal(cocukHedefiUygunMu({ hedefTur: 'ogrenci', hedefDeger: 'a' }, []), false);
});

// ═══════════════════════ Veli yollarının dönüşümü (kaynak) ═══════════════════════

const TUM_KOLEKSIYON = /getDocs\(\s*collection\(\s*db\s*,\s*["'](?:duyurular|takvim|galeri)["']\s*\)\s*\)/;

test('index.html veli fonksiyonları duyurular/takvim/galeri koleksiyonunu kısıtsız okumaz', () => {
  const beklenen = {
    simsekDuyuruKontrolEt: /veliHedefliOku\(veliOkumaFb, db, "duyurular", veliOgrenciler/,
    veliRenderBildirimler: /veliHedefliOku\(veliOkumaFb, db, "duyurular", veliOgrenciler/,
    veliRenderGaleri: /veliHedefliOku\(veliOkumaFb, db, "galeri", veliOgrenciler/,
    veliZamanCizelgesiYukle: /veliHedefliOku\(veliOkumaFb, db, "galeri", \[o\.id\]/
  };
  for (const [ad, desen] of Object.entries(beklenen)) {
    const kaynak = fonk(index, ad);
    assert.doesNotMatch(kaynak, TUM_KOLEKSIYON, ad);
    assert.match(kaynak, desen, ad);
  }
  const zaman = fonk(index, 'veliZamanCizelgesiYukle');
  assert.doesNotMatch(zaman, /collection\(db, "galeri"\)/, 'okul hayatı galeriyi ne tarih aralığıyla ne de tam okur');
  assert.match(index, /import \{ veliHedefliOku, cocukHedefliMi, cocukHedefiUygunMu \} from "\.\/js\/veli-hedefli-okuma\.js\?v=1";/);
  assert.match(index, /const veliOkumaFb = \{ collection, query, where, getDocs \};/);
});

test('takvim yükleyici veli oturumunda hedefli okur, personelde tüm koleksiyonu korur', () => {
  const kaynak = fonk(index, 'takvimEtkinlikleriYukle');
  assert.match(kaynak, /const veliMi = veliOturumuMu\(\);/);
  assert.match(kaynak, /await oku\("takvim", veliMi\);/);
  assert.match(kaynak, /await oku\("etkinlikler"\);/);
  assert.match(kaynak, /veliSorgusu\s*\? await veliHedefliOku\(veliOkumaFb, db, koleksiyonAdi, veliOgrenciler/);
});

test('ZEKY veli modülleri: takvim/duyurular/galeri tüm koleksiyon okuması yok', () => {
  const ogrenme = readPortal('js/zeky-veli-ogrenme-deneyimi.js');
  assert.match(ogrenme, /^import \{ veliHedefliOku \} from '\.\/veli-hedefli-okuma\.js\?v=1';$/m);
  assert.doesNotMatch(ogrenme, /p\.fb\.collection\(p\.db,'duyurular'\)/);
  assert.match(ogrenme, /veliHedefliOku\(p\.fb,p\.db,'duyurular',\[o\.id\]/);
  // Tüm koleksiyon / tarih eşitliğiyle okuma yalnız herkese açık "etkinlikler" için kalır.
  assert.equal((ogrenme.match(/ad==='takvim'\?await veliHedefliOku\(p\.fb,p\.db,'takvim',\[o\.id\]/g) || []).length, 2);
  assert.match(ogrenme, /ekKosullar:\[\['tarih','==',bugun\(\)\]\]/);

  const portfolyo = readPortal('js/zeky-egitim-portfolyo.js');
  assert.doesNotMatch(portfolyo, /fb\.query\(fb\.collection\(db,'galeri'\)/);

  const galeri = readPortal('moduller/veli-galeri.js');
  assert.doesNotMatch(galeri, /fb\.where\('(?:hedefOgrenciId|ogrenciId)'/, 'hedefTur\'suz çocuk kimliği sorgusu kalmadı');
  assert.doesNotMatch(galeri, /getDocs\(fb\.collection\(db,\s*'galeri'\)\)/);
});

test('bildirim başlığı tekil okuması izin reddinde boş başlığa düşer (try/catch korunuyor)', () => {
  const kaynak = readPortal('js/portal-bildirim-basliklari.js');
  assert.match(kaynak, /try \{\s*const snap = await fb\.getDoc\(fb\.doc\(db, \.\.\.plan\.path\)\);[\s\S]*?\} catch \(_\) \{/);
});

test('yeni yardımcı her içe aktarandan aynı sürümle PWA önbelleğinde', async () => {
  const pwa = await installedPwa();
  for (const iceAktaran of ['index.html', 'js/zeky-veli-ogrenme-deneyimi.js', 'js/zeky-egitim-portfolyo.js', 'moduller/veli-galeri.js']) {
    assertPrecachedImport(pwa, iceAktaran, 'js/veli-hedefli-okuma.js');
  }
  assertPrecachedImport(pwa, 'js/veli-hedefli-okuma.js', 'js/portal-galeri-etkilesim.js');
});

// ═══════════════════════ Çalışma zamanı: dönüştürülen yollar ═══════════════════════

const VELI_COCUKLARI = [{ id: 'kendi', sinif: 'Lale' }, { id: 'kardes', sinif: 'Gül' }];

test('veli oturumu personel/yönetici olmayan giriş yapmış kullanıcıdır', () => {
  const c = vm.createContext({ currentUser: null, isAdmin: false, aktifPersonel: null });
  vm.runInContext(`${fonk(index, 'veliOturumuMu')}; globalThis.veliMi = veliOturumuMu;`, c);
  assert.equal(c.veliMi(), false, 'giriş yok');
  c.currentUser = { uid: 'u' };
  assert.equal(c.veliMi(), true, 'veli');
  c.aktifPersonel = { durum: 'aktif' };
  assert.equal(c.veliMi(), false, 'personel');
  c.aktifPersonel = null; c.isAdmin = true;
  assert.equal(c.veliMi(), false, 'yönetici');
});

function takvimYukleyici(belgeler) {
  const { fb, sorgular } = sahteFirestore(belgeler);
  const c = vm.createContext({
    currentUser: { uid: 'veli' }, isAdmin: false, aktifPersonel: null, veliOgrenciler: VELI_COCUKLARI,
    veliHedefliOku, veliOkumaFb: fb, db: {}, getDocs: fb.getDocs, collection: fb.collection, console: { warn() {} }
  });
  vm.runInContext(`let takvimEtkinlikler = []; let takvimEtkinliklerKapsam = "";
    ${fonk(index, 'veliOturumuMu')}
    ${fonk(index, 'takvimEtkinlikleriYukle')}
    globalThis.yukle = takvimEtkinlikleriYukle;`, c);
  return { c, sorgular };
}

test('takvim yükleyici: veli hedefli sorgular, personel tüm koleksiyon; oturum değişince önbellek yenilenir', async () => {
  const belgeler = {
    etkinlikler: [{ id: 'e1', baslik: 'Şenlik', tarih: '2026-10-21' }],
    takvim: [
      { id: 't1', baslik: 'Genel', tarih: '2026-10-22', hedefTur: 'tumOkul' },
      { id: 't2', baslik: 'Kendi', tarih: '2026-10-23', hedefTur: 'ogrenci', hedefDeger: 'kendi' },
      { id: 't3', baslik: 'Başka', tarih: '2026-10-24', hedefTur: 'ogrenci', hedefDeger: 'baska' }
    ]
  };
  const { c, sorgular } = takvimYukleyici(belgeler);
  const veliListesi = await c.yukle();
  assert.deepEqual(basliklar(veliListesi), ['Genel', 'Kendi', 'Şenlik']);
  const takvimSorgulari = sorgular.filter(q => q.ad === 'takvim');
  assert.equal(takvimSorgulari.length, 1 + VELI_COCUKLARI.length);
  assert.ok(takvimSorgulari.every(q => kuralIzinVerir(q, ['kendi', 'kardes'])), takvimSorgulari.map(bicim).join(' | '));

  // Aynı oturumda önbellek kullanılır.
  const once = sorgular.length;
  await c.yukle();
  assert.equal(sorgular.length, once);

  // Aynı sayfada personel oturumu: önbellek veli kapsamından gelmez, takvim tam okunur.
  c.aktifPersonel = { durum: 'aktif' };
  const personelListesi = await c.yukle();
  const yeni = sorgular.slice(once);
  assert.deepEqual(yeni.map(q => [q.ad, q.kosullar.length]), [['etkinlikler', 0], ['takvim', 0]]);
  assert.ok(personelListesi.some(e => e.baslik === 'Başka'), 'personel yolu değişmedi');
});

test('ZEKY veli modülü: duyuru popup, etkinlik bildirimi ve günlük akış hedefli sorgularla okur', async () => {
  const ogrenme = readPortal('js/zeky-veli-ogrenme-deneyimi.js')
    .replace(/^import .*;\n/gm, '').replace(/^export /gm, '').replace("if(typeof window!=='undefined')kur();", '');
  const d = new Date(), bugun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { fb, sorgular } = sahteFirestore({
    duyurular: [
      { id: 'd1', baslik: 'Genel duyuru', hedefTur: 'tumOkul' },
      { id: 'd2', baslik: 'Kendi duyuru', hedefTur: 'ogrenci', hedefDeger: 'kendi' },
      { id: 'd3', baslik: 'Başka duyuru', hedefTur: 'ogrenci', hedefDeger: 'baska', hedefOgrenciAd: 'GİZLİ AD' }
    ],
    takvim: [
      { id: 't1', baslik: 'Genel gezi', tarih: bugun, hedefTur: 'tumOkul' },
      { id: 't2', baslik: 'Kendi randevu', tarih: '2099-01-02', hedefTur: 'ogrenci', hedefDeger: 'kendi' },
      { id: 't3', baslik: 'Başka randevu', tarih: bugun, hedefTur: 'ogrenci', hedefDeger: 'baska' }
    ],
    etkinlikler: [{ id: 'e1', baslik: 'Açık şenlik', tarih: bugun }]
  });
  const c = vm.createContext({
    window: { PortalAPI: { fb, db: {}, state: { veliAktifOgrenci: { id: 'kendi' }, ayarListesi: {} } } },
    document: {}, console: { warn() {} }, veliHedefliOku
  });
  vm.runInContext(ogrenme, c);
  const o = { id: 'kendi' };
  const duyurular = await c.duyuruPopupGetir(o);
  assert.deepEqual(basliklar(duyurular), ['Genel duyuru', 'Kendi duyuru']);
  const bildirimler = await c.etkinlikBildirimleriGetir(o);
  assert.ok(bildirimler.some(x => x.baslik.includes('Kendi randevu')));
  assert.ok(!bildirimler.some(x => x.baslik.includes('Başka')));
  const gunluk = await c.bugununEtkinlikleri(o);
  assert.deepEqual(basliklar(gunluk), ['Açık şenlik', 'Genel gezi']);

  for (const q of sorgular) assert.ok(kuralIzinVerir(q, ['kendi']), `${q.ad}: ${bicim(q)}`);
  const gunlukTakvim = sorgular.filter(q => q.ad === 'takvim' && q.kosullar.some(k => k.alan === 'tarih'));
  assert.equal(gunlukTakvim.length, 2);
  assert.ok(gunlukTakvim.every(q => q.kosullar.some(k => k.alan === 'tarih' && k.op === '==' && k.deger === bugun)));
  assert.ok(sorgular.some(q => q.ad === 'etkinlikler' && q.kosullar.length === 0), 'herkese açık etkinlikler değişmedi');
});

test('eğitim portföyü galerisi yalnız seçili çocuğa özel onaylı sorgularla okur', async () => {
  const { fb, sorgular } = sahteFirestore({ galeri: [
    { id: 'g1', durum: 'onaylandi', hedefTur: 'ogrenci', hedefDeger: 'kendi', hedefOgrenciId: 'kendi', egitimKaydi: true, program: 'montessori', kazanimAnahtari: 'k', gozlemDurum: 'S' },
    { id: 'g2', durum: 'onaylandi', hedefTur: 'ogrenci', hedefDeger: 'baska', hedefOgrenciId: 'baska', egitimKaydi: true, program: 'montessori', kazanimAnahtari: 'k', gozlemDurum: 'S' },
    { id: 'g3', durum: 'beklemede', hedefTur: 'ogrenci', hedefDeger: 'kendi', egitimKaydi: true, program: 'montessori', kazanimAnahtari: 'k', gozlemDurum: 'S' },
    { id: 'g4', durum: 'onaylandi', hedefTur: 'sinif', hedefDeger: 'Lale', egitimKaydi: true, program: 'montessori', kazanimAnahtari: 'k', gozlemDurum: 'S' }
  ] });
  const sonuc = await onayliGaleriGetir('kendi', { fb, db: {} });
  assert.deepEqual(sonuc.map(x => x.id), ['g1']);
  assert.deepEqual(sorgular.map(bicim), [
    'durum == "onaylandi" & hedefTur in ["ogrenci","cocuk"] & hedefDeger == "kendi"',
    'durum == "onaylandi" & hedefTur in ["ogrenci","cocuk"] & hedefOgrenciId == "kendi"'
  ]);
});

test('veli galeri modülü: her sorgu kural sözleşmesinde; hedefTur\'suz çocuk sorgusu yok', async () => {
  const kaynak = readPortal('moduller/veli-galeri.js');
  const satir = ad => kaynak.split('\n').find(s => s.startsWith(`function ${ad}(`));
  const { fb, sorgular } = sahteFirestore({ galeri: [] });
  const c = vm.createContext({ veliSorgulariniOlustur, galleryDisplayUrl: v => v.bunnyUrl, galleryMediaType: () => 'foto' });
  vm.runInContext(`${satir('sinifAnahtar')}\n${satir('sinifAdaylari')}\n${fonk(kaynak, 'hedefliGaleriOku')}\nglobalThis.oku = hedefliGaleriOku;`, c);
  await c.oku(fb, {}, { id: 'kendi' }, 'Lale');
  assert.ok(sorgular.length >= 4);
  for (const q of sorgular) assert.ok(kuralIzinVerir(q, ['kendi']), bicim(q));
  assert.ok(sorgular.every(q => q.kosullar.some(k => k.alan === 'hedefTur')));
});

// ═══════════════════════ Ekrandaki sızıntı düzeltmeleri ═══════════════════════

test('etkinlik listesi: başka çocuğa özel etkinlik veliye görünmez; genel, sınıf ve kendi çocukları korunur', async () => {
  const el = { innerHTML: '' };
  const liste = [
    { id: '1', baslik: 'GENEL-OKUL', tarih: '2099-01-01', hedefTur: 'tumOkul' },
    { id: '2', baslik: 'GENEL-TIPSIZ', tarih: '2099-01-02' },
    { id: '3', baslik: 'GENEL-OKUL2', tarih: '2099-01-03', hedefTur: 'okul' },
    { id: '4', baslik: 'SINIF-KENDI', tarih: '2099-01-04', hedefTur: 'sinif', hedefDeger: 'Lale' },
    { id: '5', baslik: 'SINIF-BASKA', tarih: '2099-01-05', hedefTur: 'sinif', hedefDeger: 'Papatya' },
    { id: '6', baslik: 'COCUK-KENDI', tarih: '2099-01-06', hedefTur: 'ogrenci', hedefDeger: 'kendi', hedefOgrenciAd: 'Kendi' },
    { id: '7', baslik: 'COCUK-KARDES', tarih: '2099-01-07', hedefTur: 'cocuk', hedefDeger: 'kardes' },
    { id: '8', baslik: 'COCUK-BASKA', tarih: '2099-01-08', hedefTur: 'ogrenci', hedefDeger: 'baska', hedefOgrenciAd: 'GİZLİ ÇOCUK' },
    { id: '9', baslik: 'COCUK-CELISKI', tarih: '2099-01-09', hedefTur: 'ogrenci', hedefDeger: 'kendi', hedefOgrenciId: 'baska' },
    { id: '10', baslik: 'HEDEFTIP-BASKA', tarih: '2099-01-10', hedefTip: 'ogrenci', hedefDeger: 'baska' },
    { id: '11', baslik: 'COCUK-HEDEFSIZ', tarih: '2099-01-11', hedefTur: 'ogrenci' }
  ];
  const c = vm.createContext({
    document: { getElementById: id => (id === 'caEtkinlikListe' ? el : null) },
    takvimEtkinlikleriYukle: async () => liste.map(x => ({ ...x })),
    veliAktifOgrenci: VELI_COCUKLARI[0], veliOgrenciler: VELI_COCUKLARI, caEtkinlikSekme: 'tumu',
    AY_ISIMLERI: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    caEtkinlikKategori: () => ({ ad: 'Etkinlik', bg: '#fff', yazi: '#000' }), escapeHtml: s => String(s), modulYukle: async () => null,
    window: {}, cocukHedefliMi, cocukHedefiUygunMu
  });
  vm.runInContext(`${fonk(index, 'caEtkinlikleriRender')}; globalThis.ciz = caEtkinlikleriRender;`, c);
  await c.ciz();
  const gorunen = liste.map(x => x.baslik).filter(b => el.innerHTML.includes(`>${b}<`));
  assert.deepEqual(gorunen, ['GENEL-OKUL', 'GENEL-TIPSIZ', 'GENEL-OKUL2', 'SINIF-KENDI', 'COCUK-KENDI', 'COCUK-KARDES']);
  assert.doesNotMatch(el.innerHTML, /GİZLİ/);
});

function zamanCizelgesi({ galeri, takvim, filtresiz = false }) {
  const elemanlar = { veliZamanCizelgesi: { innerHTML: '' }, veliOkulOzet: { innerHTML: '' }, veliZamanAyEtiketi: { textContent: '' } };
  const { fb, sorgular } = sahteFirestore({ galeri, gunlukRaporlar: [], devamsizlik: [] }, { filtresiz });
  const tip = { ad: '', ikon: '', renk: '', bg: '' };
  const c = vm.createContext({
    document: { getElementById: id => elemanlar[id] || null },
    veliZamanAy: new Date(2026, 9, 1), veliAktifOgrenci: VELI_COCUKLARI[0], veliOgrenciler: VELI_COCUKLARI,
    getDocs: fb.getDocs, query: fb.query, collection: fb.collection, where: fb.where, documentId: () => ID_ALANI,
    getDoc: fb.getDoc, doc: fb.doc, db: {}, veliHedefliOku, veliOkumaFb: fb, cocukHedefliMi, cocukHedefiUygunMu,
    takvimEtkinlikleriYukle: async () => takvim.map(x => ({ ...x })),
    sinifAdiResmiEsle: s => String(s || '').toLocaleLowerCase('tr'),
    ZAMAN_TIP: { gunluk: tip, galeri: tip, etkinlik: tip, gelisim: tip, devamsiz: tip },
    escapeHtml: s => String(s), window: {}, console: { warn() {} }, setTimeout
  });
  vm.runInContext(`${fonk(index, 'veliZamanCizelgesiYukle')}; globalThis.yukle = veliZamanCizelgesiYukle;`, c);
  return { c, sorgular, html: () => elemanlar.veliZamanCizelgesi.innerHTML };
}

test('okul hayatı akışı: başka çocuğun gözlem fotoğrafı ve etkinliği sınıf eşleşse de görünmez', async () => {
  const foto = (id, ek) => ({ id, baslik: id, durum: 'onaylandi', tarih: '2026-10-05', ...ek });
  const galeri = [
    foto('G-GENEL', { hedefTur: 'tumOkul' }),
    foto('G-SINIF', { hedefTur: 'sinif', hedefDeger: 'Lale', sinif: 'Lale' }),
    foto('G-BASKA-SINIF', { hedefTur: 'sinif', hedefDeger: 'Papatya', sinif: 'Papatya' }),
    foto('G-GOZLEM-KENDI', { hedefTur: 'ogrenci', hedefDeger: 'kendi', hedefOgrenciId: 'kendi', sinif: 'Lale' }),
    foto('G-GOZLEM-BASKA', { hedefTur: 'ogrenci', hedefDeger: 'baska', hedefOgrenciId: 'baska', sinif: 'Lale', hedefOgrenciAd: 'GİZLİ ÇOCUK' }),
    foto('G-GOZLEM-KARDES', { hedefTur: 'ogrenci', hedefDeger: 'kardes', hedefOgrenciId: 'kardes', sinif: 'Lale' }),
    foto('G-BEKLEYEN', { hedefTur: 'tumOkul', durum: 'beklemede' }),
    foto('G-EYLUL', { hedefTur: 'tumOkul', tarih: '2026-09-30' })
  ];
  const takvim = [
    { id: 't1', baslik: 'T-GENEL', tarih: '2026-10-10', hedefTur: 'tumOkul' },
    { id: 't2', baslik: 'T-COCUK-KENDI', tarih: '2026-10-11', hedefTur: 'ogrenci', hedefDeger: 'kendi' },
    { id: 't3', baslik: 'T-COCUK-BASKA', tarih: '2026-10-12', hedefTur: 'ogrenci', hedefDeger: 'baska', hedefOgrenciAd: 'GİZLİ ÇOCUK' },
    { id: 't4', baslik: 'T-SINIF-BASKA', tarih: '2026-10-13', hedefTur: 'sinif', hedefDeger: 'Papatya' }
  ];
  const beklenen = ['G-GENEL', 'G-SINIF', 'G-GOZLEM-KENDI', 'T-GENEL', 'T-COCUK-KENDI'];
  const yasak = ['G-BASKA-SINIF', 'G-GOZLEM-BASKA', 'G-GOZLEM-KARDES', 'G-BEKLEYEN', 'G-EYLUL', 'T-COCUK-BASKA', 'T-SINIF-BASKA'];

  // 1) Faz 3b sorguları: galeri tarih aralığıyla ya da tam okunmaz; her sorgu kural sözleşmesinde.
  const hedefliOkuma = zamanCizelgesi({ galeri, takvim });
  await hedefliOkuma.c.yukle();
  const galeriSorgulari = hedefliOkuma.sorgular.filter(q => q.ad === 'galeri');
  assert.equal(galeriSorgulari.length, 3);
  for (const q of galeriSorgulari) assert.ok(kuralIzinVerir(q, ['kendi']), bicim(q));
  for (const b of beklenen) assert.ok(hedefliOkuma.html().includes(`>${b}<`), b);
  for (const b of yasak) assert.ok(!hedefliOkuma.html().includes(`>${b}<`), b);

  // 2) Sunucu bugünkü gibi her şeyi döndürse bile istemci süzmesi başka çocuğu göstermez.
  const tamOkuma = zamanCizelgesi({ galeri, takvim, filtresiz: true });
  await tamOkuma.c.yukle();
  for (const b of beklenen) assert.ok(tamOkuma.html().includes(`>${b}<`), b);
  for (const b of yasak) assert.ok(!tamOkuma.html().includes(`>${b}<`), b);
  assert.doesNotMatch(tamOkuma.html(), /GİZLİ/);
});
