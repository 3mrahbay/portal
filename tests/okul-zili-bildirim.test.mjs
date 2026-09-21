import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('window.okulZiliDoldur = async function()');
const source = html.slice(start, html.indexOf('// Özet sayfası hızlı işlem butonları', start));
function fixture(rows = [], { teacher = false, classes = ['Lavanta Çiçekleri Sınıfı'], fail = false } = {}) {
  const list = { innerHTML: '' }, summary = { textContent: '' };
  let listening = false;
  const context = {
    document: { getElementById: id => id === 'okulZiliListe' ? list : summary },
    okulZiliCanliBaslat: () => { listening = true; },
    okulZiliKoleksiyonu: () => 'pickupBildirimleri',
    db: {}, collection: () => ({}), where: () => ({}), query: () => ({}),
    getDocs: async () => { if (fail) throw new Error('permission-denied'); return { forEach: fn => rows.forEach((row, i) => fn({ id: `student${i}__2026-09-21`, data: () => row })) }; },
    ogrenciList: [], aktifKullaniciSiniflari: classes,
    ogretmenRolMu: () => teacher, danismaRolMu: () => false,
    sinifGorunur: name => classes.includes(name.replace(' Çiçekleri Sınıfı', '')),
    console: { warn() {} },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, list, summary, listening: () => listening };
}
test('boş kuyruk canlı dinlemeyi başlatır; sonraki bildirim görünür', async () => {
  const rows = [], f = fixture(rows);
  await f.context.okulZiliDoldur();
  assert.equal(f.listening(), true);
  rows.push({ ogrenciAd: 'Yeni bildirim', durum: 'yolda' });
  await f.context.okulZiliDoldur();
  assert.match(f.list.innerHTML, /Yeni bildirim/);
});
test('yönetim ve öğretmen altıncı kayıttan sonraki bildirimleri de görür', async () => {
  for (const teacher of [false, true]) {
    const f = fixture(Array.from({ length: 9 }, (_, i) => ({ ogrenciAd: `Çocuk-${i}`, sinif: 'Lavanta Çiçekleri Sınıfı', durum: 'yolda' })), { teacher });
    await f.context.okulZiliDoldur();
    assert.match(f.list.innerHTML, /Çocuk-8/);
    assert.match(f.summary.textContent, /9 bekliyor/);
  }
});
test('sorgu hatası boş kuyruk gibi gösterilmez', async () => {
  const f = fixture([], { fail: true });
  await f.context.okulZiliDoldur();
  assert.match(f.list.innerHTML, /Yeniden dene/);
  assert.doesNotMatch(f.list.innerHTML, /bildirimi yok/);
});
test('öğretmen başka sınıfın kayıtlarını göremez', async () => {
  const rows = [{ ogrenciAd: 'Yetkisiz', sinif: 'Nar', durum: 'yolda' }];
  for (const classes of [['Lavanta Çiçekleri Sınıfı']]) {
    const f = fixture(rows, { teacher: true, classes });
    await f.context.okulZiliDoldur();
    assert.doesNotMatch(f.list.innerHTML, /Yetkisiz/);
  }
});
test('iptal edilmiş bildirimler gösterilmez', async () => {
  const f = fixture([{ ogrenciAd: 'İptal kayıt', durum: 'iptal' }]);
  await f.context.okulZiliDoldur();
  assert.doesNotMatch(f.list.innerHTML, /İptal kayıt/);
});

function writeFixture({ primaryFails = false, projectionFails = true } = {}) {
  const writes = [], toasts = [];
  const denied = Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
  const context = {
    db: {}, veliAktifOgrenci: { id: 'test-child', ogrenciAdSoyad: 'Test öğrenci', sinif: 'Test sınıf' },
    currentUser: { email: 'parent@example.test' }, ayarListesi: {},
    DANISMA_GUVENLI_KOLEKSIYONLAR: { pickup: 'danismaPickupBildirimleri' },
    document: { getElementById: id => ({ value: id === 'vzSaat' ? '16:00' : 'Veli' }) },
    doc: (db, collection, id) => ({ collection, id }),
    getDoc: async ref => { if (projectionFails && ref.collection === 'danismaPickupBildirimleri') throw denied; return { exists: () => false }; },
    setDoc: async (ref, data) => { if (projectionFails && ref.collection === 'danismaPickupBildirimleri') throw denied; writes.push({ ref, data }); },
    writeBatch: () => {
      const pending = [];
      return {
        set: (ref, data) => pending.push({ ref, data }),
        commit: async () => {
          if (primaryFails || (projectionFails && pending.some(x => x.ref.collection === 'danismaPickupBildirimleri'))) throw denied;
          writes.push(...pending);
        }
      };
    },
    serverTimestamp: () => 'server-time', deleteField: () => 'deleted',
    showToast: (...args) => toasts.push(args), confirm: () => true,
    veliOkulZiliDoldur() {}, okulZiliDoldur() {},
    console: { warn() {}, error() {} }
  };
  context.window = context;
  vm.createContext(context);
  const between = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
  vm.runInContext([
    between('function vzBugun()', 'window.veliOkulZiliDoldur = async function()'),
    between('window.veliOkulZiliBildir = async function()', 'async function caHomeGunlukDoldur'),
    between('window.pickupHazirla = async function', '// Okul Zili canlı dinleme')
  ].join('\n'), context);
  return { context, writes, toasts };
}
for (const name of ['veliOkulZiliBildir', 'veliOkulZiliTeyit', 'veliOkulZiliIptal', 'pickupHazirla', 'pickupTeslimEt']) {
  test(`${name}: danışma izin hatası ana kaydı engellemez`, async () => {
    const f = writeFixture();
    await f.context[name]('test-child', '2026-09-21');
    assert.ok(f.writes.some(x => x.ref.collection === 'pickupBildirimleri'));
    assert.ok(f.toasts.length);
    assert.ok(f.toasts.every(x => x[1] !== 'error'));
  });
}
test('asıl kayıt reddedilirse başarı mesajı ve danışma kaydı oluşturulmaz', async () => {
  const f = writeFixture({ primaryFails: true, projectionFails: false });
  await f.context.veliOkulZiliBildir();
  assert.equal(f.writes.length, 0);
  assert.equal(f.toasts.length, 1);
  assert.equal(f.toasts[0][1], 'error');
});
test('danışma erişimi varsa asıl kayıttan sonra kişisel e-posta içermeyen özet yazılır', async () => {
  const f = writeFixture({ projectionFails: false });
  await f.context.veliOkulZiliBildir();
  assert.equal(f.writes[0].ref.collection, 'pickupBildirimleri');
  assert.equal(f.writes[1].ref.collection, 'pickupKuyruk');
  const projection = f.writes[2];
  assert.equal(projection.ref.collection, 'danismaPickupBildirimleri');
  assert.equal(projection.data.ogrenciId, 'test-child');
  assert.equal('veliEmail' in projection.data, false);
});
