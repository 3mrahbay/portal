// Danışma Okul Zili / Sabah girişi listesinde çocuk adı (20 Ekim 2026).
// Kök neden: veli, danışma kopyasını (danismaPickupBildirimleri /
// danismaSabahGirisleri) OKUYAMAZ; eski akış önce okuyup sonra yazdığı için
// kopya hiç yazılmıyor, satır yalnız öğretmen "Hazırla"sıyla isimsiz oluşuyordu.
// Yayındaki kurala karşı emülatör denemesi PR açıklamasında; burada istemci.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const index = await read('index.html');
const pickupModul = await read('moduller/pickup-yetkilileri.js');
const coreSource = await read('js/okul-zili-liste-core.js');
const coreUrl = 'data:text/javascript;base64,' + Buffer.from(coreSource).toString('base64');
const { bildirimZamani, enYeniBildirimOnce, canliListeOlustur } = await import(coreUrl);

const bolum = (kaynak, bas, son) => {
  const i = kaynak.indexOf(bas); const j = kaynak.indexOf(son, i + bas.length);
  assert.ok(i >= 0 && j > i, `bölüm bulunamadı: ${bas}`);
  return kaynak.slice(i, j);
};
const VELI_IZINLI = ['alanKisi', 'durum', 'guncellendi', 'hedefSaat', 'ogrenciAd', 'ogrenciId', 'olusturuldu', 'sinif', 'tarih'];
const TS = 'SERVER_TS';
// vm bağlamında üretilen nesnelerin prototipi farklıdır; düz nesneye çevirip karşılaştır.
const duz = x => JSON.parse(JSON.stringify(x));

function firestoreSahte() {
  const yazimlar = [], okumalar = [], batchler = [];
  const fb = {
    db: {}, serverTimestamp: () => TS,
    doc: (_, koleksiyon, id) => ({ koleksiyon, id, yol: koleksiyon + '/' + id }),
    collection: (_, koleksiyon) => ({ koleksiyon }),
    where: (...a) => a, query: (c, ...f) => ({ ...c, f }),
    async getDoc(ref) { okumalar.push(ref.yol); throw Object.assign(new Error('denied'), { code: 'permission-denied' }); },
    async setDoc(ref, veri, secenek) { yazimlar.push({ yol: ref.yol, koleksiyon: ref.koleksiyon, veri, secenek }); },
    writeBatch() {
      const b = { setler: [], set(ref, veri, secenek) { b.setler.push({ yol: ref.yol, koleksiyon: ref.koleksiyon, veri, secenek }); }, async commit() { batchler.push(b.setler); } };
      return b;
    },
    deleteField: () => 'DELETE'
  };
  return { fb, yazimlar, okumalar, batchler };
}

// ─────────────── Veli: Portal "Almaya geliyorum" ───────────────

test('veli kopyası yalnız kuralın izin verdiği alanları taşır, e-posta ve boş metin taşımaz', () => {
  const ctx = { serverTimestamp: () => TS };
  vm.createContext(ctx);
  vm.runInContext(bolum(index, 'const OKUL_ZILI_VELI_KOPYA_ALANLARI', '// Eski istemciden ya da reddedilen'), ctx);
  const k = ctx.okulZiliVeliKopyasi({ ogrenciId: 'c1', ogrenciAd: 'Çocuk Bir', sinif: '', tarih: 'T', hedefSaat: '16:10',
    alanKisi: 'Anne', durum: 'hazir', veliEmail: 'veli@ornek.test', olusturuldu: 'o', hazirZamani: 'h', teslimEden: 'x' });
  assert.deepEqual(Object.keys(k).sort(), VELI_IZINLI.filter(a => a !== 'sinif'));
  assert.equal(k.durum, 'yolda');
  assert.equal('veliEmail' in k, false);
  assert.equal(ctx.okulZiliVeliKopyasi({ cocukId: 'c9' }, '', 'T').ogrenciId, 'c9');
});

test('veli "Almaya geliyorum": danışma kopyası okunmadan, birleştirilerek yazılır', async () => {
  const s = firestoreSahte();
  const toastlar = [];
  const ctx = {
    ...s.fb, db: s.fb.db, console: { warn() {}, error() {} },
    DANISMA_GUVENLI_KOLEKSIYONLAR: { pickup: 'danismaPickupBildirimleri' },
    veliAktifOgrenci: { id: 'c1', ogrenciAdSoyad: 'Çocuk Bir', sinif: 'Papatya' }, veliOgrenciler: [],
    ayarListesi: {}, currentUser: { email: 'veli@ornek.test' },
    document: { getElementById: id => ({ vzSaat: { value: '16:10' }, vzKisi: { value: 'Anne' } })[id] || null },
    vzBugun: () => '2026-10-20', showToast: (m, t) => toastlar.push([m, t]), veliOkulZiliDoldur() {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(bolum(index, '// Danışma kopyası (danismaPickupBildirimleri) — VELİ yazımı.', 'window.veliOkulZiliDoldur = async function'), ctx);
  vm.runInContext(bolum(index, '// "Almaya geliyorum" — ZEKY pickupBildir ile aynı belge', '// Veli teyidi — ZEKY'), ctx);
  await ctx.veliOkulZiliBildir();
  assert.equal(s.okumalar.some(y => y.startsWith('danisma')), false, 'veliye kapalı kopya okunmamalı');
  const kopya = s.yazimlar.find(y => y.koleksiyon === 'danismaPickupBildirimleri');
  assert.ok(kopya, 'kopya yazılmalı');
  assert.deepEqual(duz(kopya.secenek), { merge: true });
  assert.deepEqual(Object.keys(kopya.veri).sort(), VELI_IZINLI);
  assert.equal(kopya.veri.ogrenciAd, 'Çocuk Bir');
  assert.equal(kopya.veri.hedefSaat, '16:10');
  assert.equal(s.batchler[0].find(x => x.koleksiyon === 'pickupBildirimleri').veri.veliEmail, 'veli@ornek.test');
  assert.match(toastlar.at(-1)[0], /iletildi/);
});

test('veli ekranı: bekleyen bildirimin eksik kopyası oturumda bir kez tamamlanır; hazır kayda dokunulmaz', async () => {
  const s = firestoreSahte();
  const ctx = { ...s.fb, console: { warn() {} }, DANISMA_GUVENLI_KOLEKSIYONLAR: { pickup: 'danismaPickupBildirimleri' }, ayarListesi: { c1: { kayit: { sinif: 'Papatya' } } } };
  vm.createContext(ctx);
  vm.runInContext(bolum(index, '// Danışma kopyası (danismaPickupBildirimleri) — VELİ yazımı.', 'window.veliOkulZiliDoldur = async function'), ctx);
  const ogr = { id: 'c1', ogrenciAdSoyad: 'Çocuk Bir' };
  const b = { ogrenciId: 'c1', tarih: 'T', durum: 'yolda', hedefSaat: '16:10', alanKisi: 'Baba', olusturuldu: 'o', veliEmail: 'gizli@ornek.test' };
  assert.equal(await ctx.okulZiliVeliKopyasiniTamamla(b, ogr, 'T'), true);
  assert.equal(await ctx.okulZiliVeliKopyasiniTamamla(b, ogr, 'T'), false);
  assert.equal(s.yazimlar.length, 1);
  assert.deepEqual(duz(s.yazimlar[0].secenek), { merge: true });
  assert.equal(s.yazimlar[0].veri.ogrenciAd, 'Çocuk Bir');
  assert.equal(s.yazimlar[0].veri.sinif, 'Papatya');
  assert.equal('veliEmail' in s.yazimlar[0].veri, false);
  for (const durum of ['hazir', 'teslim', 'iptal']) assert.equal(await ctx.okulZiliVeliKopyasiniTamamla({ ...b, durum }, ogr, 'T'), false);
  assert.equal(s.yazimlar.length, 1);
  // Veli ekranı artık kopyayı okumuyor
  const doldur = bolum(index, 'window.veliOkulZiliDoldur = async function', '// ── Hafta sonu ──');
  assert.doesNotMatch(doldur, /getDoc\(guvenliRef\)/);
  assert.match(doldur, /okulZiliVeliKopyasiniTamamla\(b, ogr, tarih\)/);
});

test('pickup-yetkilileri modülündeki veli gönderimi de kopyayı okumaz, izinli alanlarla merge yazar', () => {
  const gonder = bolum(pickupModul, 'async function veliOkulZiliGuvenliBildir()', 'veliOkulZiliGuvenliBildir.__bckaGuvenli');
  assert.doesNotMatch(gonder, /getDoc\(guvenliRef\)/);
  assert.match(gonder, /setDoc\(fb\.doc\(db, "danismaPickupBildirimleri", id\),\s*veliDanismaKopyasi\(tamVeri, fb\.serverTimestamp\(\)\), \{ merge: true \}\)/);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(bolum(pickupModul, 'const VELI_DANISMA_KOPYA_ALANLARI', 'function pickupBugun()').replace(/export /g, ''), ctx);
  const k = ctx.veliDanismaKopyasi({ ogrenciId: 'c1', ogrenciAd: '', sinif: 'P', tarih: 'T', hedefSaat: '16:00', alanKisi: 'Veli',
    durum: 'yolda', veliEmail: 'v@ornek.test', olusturuldu: 'o', guncellendi: 'eski' }, TS);
  assert.deepEqual(Object.keys(k).sort(), VELI_IZINLI.filter(a => a !== 'ogrenciAd'));
  assert.equal(k.guncellendi, TS);
});

// ─────────────── Personel işlemleri eksik kimliği tamamlar ───────────────

function liste(rol, ogrenciList = []) {
  const s = firestoreSahte();
  const dugumler = new Map();
  const ctx = {
    ...s.fb, console: { warn() {}, error() {} }, document: { getElementById: id => dugumler.get(id) || null },
    currentUser: { uid: 'p1', email: 'personel@ornek.test' }, aktifKullaniciRol: rol, aktifKullaniciSiniflari: ['Papatya'],
    ogrenciList, bildirimZamani, enYeniBildirimOnce, canliListeOlustur, vzBugun: () => 'T',
    DANISMA_GUVENLI_KOLEKSIYONLAR: { pickup: 'danismaPickupBildirimleri' },
    showToast() {}, confirm: () => true, prompt: () => 'not', aktifPersonel: { adSoyad: 'Personel Bir' },
    onSnapshot: () => () => {}
  };
  ctx.window = ctx;
  ctx.danismaRolMu = () => ctx.aktifKullaniciRol === 'danisma';
  ctx.ogretmenRolMu = () => ctx.aktifKullaniciRol === 'ogretmen';
  ctx.okulZiliKoleksiyonu = () => ctx.danismaRolMu() ? 'danismaPickupBildirimleri' : 'pickupBildirimleri';
  vm.createContext(ctx);
  vm.runInContext(bolum(index, '// ═══ OKUL ZİLİ İŞLEMLERİ', '// Boş kuyrukta da tek canlı abonelik'), ctx);
  vm.runInContext(bolum(index, '// Boş kuyrukta da tek canlı abonelik', '// Özet sayfası hızlı işlem butonları'), ctx);
  for (const id of ['okulZiliListe', 'okulZiliOzet']) dugumler.set(id, { innerHTML: '', textContent: '' });
  return { ...s, ctx };
}
const snap = kayitlar => ({ forEach(fn) { kayitlar.forEach(({ id, ...v }) => fn({ id, data: () => v })); } });

test('öğretmen "Hazırla": danışma kopyasına ad, sınıf, saat, alacak kişi ve bildirim zamanı da gider', async () => {
  const x = liste('ogretmen');
  x.ctx.okulZiliDoldur(snap([{ id: 'c1__T', ogrenciId: 'c1', ogrenciAd: 'Çocuk Bir', sinif: 'Papatya', tarih: 'T',
    hedefSaat: '16:10', alanKisi: 'Anne', durum: 'yolda', olusturuldu: '2026-10-20T13:05:00.000Z', veliEmail: 'gizli@ornek.test' }]));
  await x.ctx.pickupHazirla('c1', 'T');
  const kopya = x.batchler[0].find(y => y.koleksiyon === 'danismaPickupBildirimleri');
  assert.deepEqual(duz(kopya.secenek), { merge: true });
  assert.equal(kopya.veri.ogrenciAd, 'Çocuk Bir');
  assert.equal(kopya.veri.sinif, 'Papatya');
  assert.equal(kopya.veri.hedefSaat, '16:10');
  assert.equal(kopya.veri.alanKisi, 'Anne');
  assert.equal(kopya.veri.olusturuldu, '2026-10-20T13:05:00.000Z');
  assert.equal(kopya.veri.durum, 'hazir');
  assert.equal('veliEmail' in kopya.veri, false);
});

test('yönetim: kayıtta ad yoksa öğrenci listesinden tamamlanır; boş alan yazılmaz', async () => {
  const x = liste('mudur', [{ id: 'c2', ogrenciAdSoyad: 'Çocuk İki', sinif: 'Lale' }]);
  x.ctx.okulZiliDoldur(snap([{ id: 'c2__T', ogrenciId: 'c2', tarih: 'T', durum: 'hazir' }]));
  await x.ctx.pickupTeslimEt('c2', 'T', 'Çocuk İki', 'veli');
  const kopya = x.batchler[0].find(y => y.koleksiyon === 'danismaPickupBildirimleri');
  assert.equal(kopya.veri.ogrenciAd, 'Çocuk İki');
  assert.equal(kopya.veri.sinif, 'Lale');
  for (const a of ['hedefSaat', 'alanKisi', 'olusturuldu']) assert.equal(a in kopya.veri, false, a);
});

test('danışmanın Kapıda / Kimlik / Not işlemleri de kimlik alanlarını taşır; listede olmayan kayıt boş ek alır', async () => {
  const x = liste('danisma');
  x.ctx.okulZiliDoldur(snap([{ id: 'c1__T', ogrenciId: 'c1', ogrenciAd: 'Çocuk Bir', tarih: 'T', durum: 'hazir', hedefSaat: '16:10' }]));
  await x.ctx.pickupKapidaBildirPortal('c1', 'T');
  await x.ctx.pickupKimlikOnaylaPortal('c1', 'T', 'Anne');
  await x.ctx.pickupDanismaNotuPortal('c1', 'T', '');
  const kopyalar = x.batchler.map(b => b.find(y => y.koleksiyon === 'danismaPickupBildirimleri'));
  assert.equal(kopyalar.length, 3);
  for (const k of kopyalar) { assert.equal(k.veri.ogrenciAd, 'Çocuk Bir'); assert.equal(k.veri.hedefSaat, '16:10'); }
  assert.deepEqual(duz(x.ctx.okulZiliKopyaKimligi('yok', 'T')), {});
});

test('danışma listesi: isimsiz satır "—" gösterir (yedek öğrenci listesi yoksa) — davranış korunur', () => {
  const x = liste('danisma');
  x.ctx.okulZiliDoldur(snap([{ id: 'c3__T', ogrenciId: 'c3', tarih: 'T', durum: 'hazir', hazirZamani: '2026-10-20T13:19:00.000Z' }]));
  assert.match(x.ctx.document.getElementById('okulZiliListe').innerHTML, />\s*—/);
});

// ─────────────── Yönetim eşitlemesi ───────────────

function esitleme({ reddedilen = [] } = {}) {
  const s = firestoreSahte();
  const koleksiyonlar = {
    pickupBildirimleri: [
      { id: 'a__T', ogrenciId: 'a', ogrenciAd: 'Ada', sinif: 'P', tarih: 'T', hedefSaat: '16:00', alanKisi: 'Anne', durum: 'yolda', olusturuldu: 'o', veliEmail: 'gizli@ornek.test' },
      { id: 'b__T', ogrenciId: 'b', ogrenciAd: 'Bora', sinif: 'L', tarih: 'T', hedefSaat: '16:30', alanKisi: '', durum: 'yolda', olusturuldu: 'o2' },
      { id: 'c__T', ogrenciId: 'c', ogrenciAd: 'Cem', sinif: 'L', tarih: 'T', durum: 'yolda' }
    ],
    danismaPickupBildirimleri: [
      { id: 'b__T', ogrenciId: 'b', tarih: 'T', durum: 'hazir', hazirZamani: 'h', kapida: true },
      { id: 'c__T', ogrenciId: 'c', ogrenciAd: 'Cem', sinif: 'L', tarih: 'T', durum: 'hazir' }
    ],
    sabahGirisleri: [{ id: 'a__T', ogrenciId: 'a', ogrenciAd: 'Ada', sinif: 'P', tarih: 'T', veliBildirdi: true, veliBildirimSaati: 's', tahminiSureDk: 10, veliBildirenEmail: 'gizli@ornek.test' }],
    danismaSabahGirisleri: [],
    pickupYetkilileri: []
  };
  const commitler = [];
  const ctx = {
    ...s.fb, console: { warn() {} }, isAdmin: false, aktifKullaniciRol: 'mudur', AKTIF_DONEM: '2026-2027',
    ogrenciList: [{ id: 'a', ogrenciAdSoyad: 'Ada' }], ayarListesi: {}, getOgrenciDurum: () => 'aktif',
    rolNormalize: r => r, DANISMA_GUVENLI_KOLEKSIYONLAR: { ogrenciler: 'danismaOgrenciOzetleri', personeller: 'danismaPersonelRehberi',
      pickup: 'danismaPickupBildirimleri', pickupYetkilileri: 'danismaPickupYetkilileri', sabah: 'danismaSabahGirisleri' },
    async getDocs(q) { return snap(koleksiyonlar[q.koleksiyon] || []); },
    writeBatch() {
      const setler = [];
      return { set(ref, veri, secenek) { setler.push({ koleksiyon: ref.koleksiyon, id: ref.id, veri, secenek }); },
        async commit() { if (setler.some(x => reddedilen.includes(x.koleksiyon))) throw Object.assign(new Error('denied'), { code: 'permission-denied' }); commitler.push(...setler); } };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(bolum(index, 'function danismaProjeksiyonYonetebilirMi()', 'async function danismaPersonelRehberiniSenkronla'), ctx);
  return { ctx, commitler };
}

test('eşitleme: kuralı olmayan öğrenci özeti reddedilse de okul zili ve sabah kopyaları yazılır', async () => {
  const x = esitleme({ reddedilen: ['danismaOgrenciOzetleri'] });
  await x.ctx.danismaOperasyonProjeksiyonlariniSenkronla();
  assert.equal(x.commitler.some(c => c.koleksiyon === 'danismaOgrenciOzetleri'), false);
  assert.ok(x.commitler.some(c => c.koleksiyon === 'danismaPickupBildirimleri'));
  assert.ok(x.commitler.some(c => c.koleksiyon === 'danismaSabahGirisleri'));
  assert.ok(x.commitler.every(c => c.secenek?.merge === true), 'her yazım merge olmalı');
});

test('eşitleme: var olan kopyada yalnız boş kimlik tamamlanır, durum ve danışma alanlarına dokunulmaz', async () => {
  const x = esitleme();
  await x.ctx.danismaOperasyonProjeksiyonlariniSenkronla();
  const zil = Object.fromEntries(x.commitler.filter(c => c.koleksiyon === 'danismaPickupBildirimleri').map(c => [c.id, c.veri]));
  // a: kopya yok → ana kayıttan oluşur, e-posta taşınmaz
  assert.equal(zil['a__T'].ogrenciAd, 'Ada'); assert.equal(zil['a__T'].durum, 'yolda'); assert.equal('veliEmail' in zil['a__T'], false);
  // b: kopya var (hazır, kapıda) → yalnız eksik kimlik; durum yazılmaz, boş alanKisi yazılmaz
  assert.deepEqual(Object.keys(zil['b__T']).sort(), ['guncellendi', 'hedefSaat', 'ogrenciAd', 'olusturuldu', 'sinif']);
  // c: kopya tam → hiç yazılmaz
  assert.equal('c__T' in zil, false);
  const sabah = x.commitler.find(c => c.koleksiyon === 'danismaSabahGirisleri');
  assert.equal(sabah.veri.ogrenciAd, 'Ada'); assert.equal(sabah.veri.tahminiSureDk, 10); assert.equal('veliBildirenEmail' in sabah.veri, false);
});
