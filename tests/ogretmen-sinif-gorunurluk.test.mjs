import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { installedPwa, assertPwaBootstrap, assertPrecachedImport } from './helpers/portal-pwa.mjs';
import { sinifKimligi, sinifEslesir, ogrenciSinifiCoz } from '../js/ogretmen-sinif-core.js';

const root = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('index.html', root), 'utf8');
const PERIOD = '2026-2027';
const M = 'Mimoza Çiçekleri Sınıfı';
function chunk(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Source boundary: ${start}`);
  return source.slice(a, b);
}
const scopeCode = [
  chunk('function normalizeSinif(s)', '// RESMİ SINIF ADLARI'),
  chunk('const RESMI_SINIF_ADLARI =', '// ===== ÖĞRENCİLER:'),
  chunk('function sinifAdiResmiEsle(ham)', '// Bu veli/öğrenci'),
  chunk('function sinifKisitiVarMi()', 'window.iletisimGorebilir'),
  chunk('function ogrenciSinifiAl(o)', '// Öğretmen veli iletişim'),
  chunk('function getOgrenciDurum(o, ayar)', '// Öğretmen ve finans'),
  chunk('async function loadOgrenciler()', 'function ogrenciSekmesiAktifMi'),
  chunk('function zekiAktifDonemOgrencisi(o)', 'window.zekyGozlemOgrenciSec')
].join('\n');
const listCode = chunk('  filteredList = ogrenciList.filter(o => {', '  if (filteredList.length === 0)');
const archiveCode = chunk('    // Öğretmen/koordinatör: arşivlenmiş öğrenciler yine gizlensin', '    renderTableEgitim(wrap);');
const attendanceCode = chunk('async function renderDevamsizlik()', '  aktif.sort').match(/const aktif = ([\s\S]*?);\n$/)[1];
const homeCode = chunk('    sinifOgrencileri = hepsi.filter(o => {', '  } catch (e) { console.warn("sınıf mevcudu"').replace('sinifOgrencileri =', 'var sinifOgrencileri =');
function student(id = 'synthetic-target', extra = {}) {
  return { id, ogrenciAdSoyad: id, sinif: M, durum: 'aktif', aktifDonem: PERIOD, aktifDonemDurum: 'aktif', ...extra };
}
function context({ rows = [student()], assignments = ['Mimoza Çiçekleri'], role = 'ogretmen', admin = false, documents = {} } = {}) {
  const calls = [], writes = [];
  const c = {
    console: { log() {}, warn() {}, error(e) { throw e; } }, window: {},
    ogretmenSinifEslesir: sinifEslesir, ogrenciSinifiCoz,
    isAdmin: admin, aktifKullaniciRol: role, aktifKullaniciSiniflari: assignments,
    TUM_SINIF_ROLLERI: ['mudur', 'kurucu_mudur', 'egitim_koordinator'],
    ayarListesi: {}, ogrenciList: [], AKTIF_DONEM: PERIOD,
    currentUser: { uid: 'synthetic-account' }, ogrenciDonemYuklemeSurumu: 0, ogrenciVeriYuklemeSurumu: 0,
    document: { getElementById() { return {}; } },
    ogrenciListeDisaAktarmaGuncelle() {}, ogrenciArayuzunuGuncelle() {}, ogrenciSekmesiAktifMi() { return false; },
    finansGorebilir() { return admin || ['mudur', 'kurucu_mudur', 'muhasebe'].includes(role); },
    danismaRolMu() { return false; }, danismaProjeksiyonYonetebilirMi() { return false; },
    searchVal: '', activeFilter: 'tumu', activeDurum: 'aktif', db: {},
    collection(_, name) { return name; }, doc(_, ...path) { return path.join('/'); },
    async getDocs(name) {
      calls.push(name);
      return { empty: !rows.length, forEach(fn) { rows.forEach(o => fn({ id: o.id, data: () => ({ ...o }) })); } };
    },
    async getDoc(path) {
      calls.push(path);
      return { exists: () => Object.hasOwn(documents, path), data: () => documents[path] };
    },
    async setDoc(...args) { writes.push(args); },
    setTimeout(fn) { fn(); }
  };
  vm.createContext(c); vm.runInContext(scopeCode, c);
  return { c, calls, writes, rows };
}
function ids(rows) { return Array.from(rows, o => o.id); }
function views(c) {
  c.ogretmenDonemOzetiHazir = !c.finansGorebilir() && c.anaKayitDonemOzetiKullaniliyor;
  vm.runInContext(listCode, c);
  if (!c.finansGorebilir()) vm.runInContext(archiveCode, c);
  c.hepsi = c.ogrenciList;
  vm.runInContext(homeCode, c);
  return {
    list: ids(c.filteredList), attendance: ids(vm.runInContext(attendanceCode, c)),
    observation: ids(c.zekiGozlemOgrenciListesi()), home: ids(c.sinifOgrencileri)
  };
}
function expectViews(c, expected) {
  for (const [view, actual] of Object.entries(views(c))) assert.deepEqual(actual, expected, view);
}

for (const [name, aliases] of [
  ['Mimoza', [M, 'Mimoza Çiçekleri', '  MİMOZA  ÇİÇEKLERİ  SINIFI ', 'mimoza', 'Papatyalar Sınıfı', 'Papatya', 'Papatyalar (Toddler)', 'Papatyalar Toddler', 'PapatyalarToddler', 'PapatyalarSınıfı', 'Toddler', 'Montessori 1']],
  ['Yasemin', ['Yasemin Çiçekleri Sınıfı', 'Yasemin Çiçekleri', 'Kardelenler Sınıfı', 'kardelencicekleri', 'Montessori2']],
  ['Lavanta', ['Lavanta Çiçekleri Sınıfı', 'Lavanta Çiçekleri', 'Nar Çiçekleri', 'narcicegi', 'Montessori 3']],
  ['İlk Adımlar', ['İlk Adımlar', 'İlk Adımlar Sınıfı']]
]) test(`${name}: explicit equivalent labels are symmetric`, () => {
  for (const a of aliases) for (const b of aliases) assert.equal(sinifEslesir(a, b), true, `${a} / ${b}`);
});

test('unassigned, unrelated, unknown and numbered classes never collapse', () => {
  for (const [a, b] of [
    ['', ''], [' ', M], [null, M], [M, 'Yasemin'], [M, 'Lavanta'], [M, 'Mimoza B'],
    [M, 'Mimoza 2'], [M, 'Montessori 10'], ['Custom Alpha', 'Custom Beta'],
    ['İlk A', 'İlk B'], ['resmi:mimoza', M], ['__proto__', M]
  ]) assert.equal(sinifEslesir(a, b), false, `${a} / ${b}`);
  assert.equal(sinifEslesir(' Custom Alpha ', 'CUSTOM ALPHA'), true);
  assert.notEqual(sinifKimligi('Mimoza B'), sinifKimligi(M));
});

test('class resolution honors authoritative values and only falls back for blank fields', () => {
  assert.equal(ogrenciSinifiCoz({ sinif: 'Yasemin', sinifi: M }, { kayit: { sinif: 'Lavanta' } }), 'Lavanta');
  assert.equal(ogrenciSinifiCoz({ sinif: 'Yasemin', sinifi: M }), 'Yasemin');
  assert.equal(ogrenciSinifiCoz({ sinif: ' ', sinifi: M }), M);
  assert.equal(ogrenciSinifiCoz({ sinifi: M }, { kayit: { sinif: ' ' }, sinif: 'Lavanta' }), M);
  assert.equal(ogrenciSinifiCoz(null), '');
});

for (const [label, extra, assignments] of [
  ['full master / short assignment', {}, ['Mimoza Çiçekleri']],
  ['short master / full assignment', { sinif: 'Mimoza Çiçekleri' }, [M]],
  ['legacy class', { sinif: 'Papatyalar Sınıfı' }, [M]],
  ['legacy field only', { sinif: '', sinifi: M }, [M]],
  ['blank master / legacy field', { sinif: '  ', sinifi: M }, ['mimoza']],
  ['multiple assigned classes', {}, ['Yasemin', 'Mimoza Çiçekleri']]
]) test(`${label}: first load and reload retain the student in all four teacher views`, async () => {
  const x = context({ rows: [student('synthetic-target', extra), student('foreign', { sinif: 'Lavanta' })], assignments });
  for (let i = 0; i < 2; i++) { await x.c.loadOgrenciler(); expectViews(x.c, ['synthetic-target']); }
  assert.deepEqual(x.calls, ['ogrenciler', 'ogrenciler']); // No finance/period-document reads for teachers.
  assert.equal(x.writes.length, 0);
});

for (const [label, extra, assignments] of [
  ['empty assignments', {}, []], ['blank assignment', {}, ['  ']],
  ['blank class', { sinif: '', sinifi: '' }, [M]], ['unrelated class', { sinif: 'Yasemin' }, [M]],
  ['custom suffix', { sinif: 'Mimoza B' }, [M]],
  ['stale secondary field', { sinif: 'Lavanta', sinifi: M }, [M]],
  ['missing period', { aktifDonem: '' }, [M]], ['old period', { aktifDonem: '2025-2026' }, [M]],
  ['archived period', { aktifDonemDurum: 'arsiv' }, [M]],
  ['archived fallback', { aktifDonemDurum: '', durum: 'arsiv' }, [M]],
  ['status-format remains separate', { aktifDonemDurum: 'Aktif' }, [M]]
]) test(`${label}: all four teacher views remain closed`, async () => {
  const x = context({ rows: [student('synthetic-target', extra)], assignments });
  await x.c.loadOgrenciler(); expectViews(x.c, []);
});

test('all downstream teacher views recheck scope if an unfiltered list or changed setting is supplied', async () => {
  for (const assignments of [[], [M]]) {
    const x = context({ assignments }); await x.c.loadOgrenciler();
    x.c.ogrenciList = [student()];
    x.c.ayarListesi = { 'synthetic-target': { durum: 'aktif', kayit: { sinif: 'Lavanta' } } };
    expectViews(x.c, []);
  }
});

test('teacher class chips match equivalent labels and never grant access to another class', async () => {
  const x = context(); await x.c.loadOgrenciler();
  for (const filter of ['sinif::Mimoza Çiçekleri', `sinif::${M}`, 'sinif::Papatyalar Sınıfı', 'papatyalar']) {
    x.c.activeFilter = filter; assert.deepEqual(views(x.c).list, ['synthetic-target']);
  }
  x.c.activeFilter = 'sinif::Lavanta'; assert.deepEqual(views(x.c).list, []);
});

test('legacy archive boolean remains excluded from the student list', async () => {
  const x = context({ rows: [student('synthetic-target', { arsiv: true })] });
  await x.c.loadOgrenciler(); assert.deepEqual(views(x.c).list, []);
});

for (const [role, admin] of [['mudur', false], ['kurucu_mudur', false], ['muhasebe', false], ['ogretmen', true]]) {
  test(`${role} admin=${admin}: management keeps all classes and real period settings`, async () => {
    const rows = [student(), student('foreign', { sinif: 'Lavanta' })];
    const documents = Object.fromEntries(rows.map(o => [`ogrenciler/${o.id}/donemler/${PERIOD}`, { durum: 'aktif', kayit: { sinif: 'Yasemin' } }]));
    const x = context({ rows, assignments: [], role, admin, documents });
    await x.c.loadOgrenciler(); assert.deepEqual(ids(x.c.ogrenciList).sort(), ['foreign', 'synthetic-target']);
    assert.equal(x.calls.filter(p => p.includes('/donemler/')).length, 2);
    assert.equal(x.c.ogrenciSinifiAl(rows[0]), 'Yasemin');
    assert.equal(x.c.sinifGorunur('Lavanta'), true);
    assert.equal(x.writes.length, 0);
  });
}

test('parent ownership and active enrollment still control parent child lookup', async () => {
  const documents = {
    'veliler/parent@example.test': { onaylandi: true, ogrenciIds: ['synthetic-target', 'own-archived'] },
    'ogrenciler/synthetic-target': student(),
    'ogrenciler/own-archived': student('own-archived', { aktifDonemDurum: 'arsiv' }),
    'ogrenciler/foreign': student('foreign'),
    [`ogrenciler/synthetic-target/donemler/${PERIOD}`]: { durum: 'aktif' },
    [`ogrenciler/own-archived/donemler/${PERIOD}`]: { durum: 'arsiv' }
  };
  const x = context({ role: 'veli', documents });
  vm.runInContext(chunk('function veliOgrenciMasterAktifDonemdeMi', '// ============ ADMIN: VELİ DAVET'), x.c);
  const result = await x.c.findOgrenciForVeli({ uid: 'synthetic-parent', email: 'parent@example.test' });
  assert.deepEqual(ids(result), ['synthetic-target']);
  assert.equal(x.calls.includes('ogrenciler/foreign'), false);
  assert.equal(x.calls.includes('ogrenciler'), false);
});

test('bootstrap and PWA ship the exact versioned helper', async () => {
  const pwa = await installedPwa();
  assertPrecachedImport(pwa, 'index.html', 'js/ogretmen-sinif-core.js');
  await assertPwaBootstrap(pwa, source);
  assert.ok(source.includes('class="tb-grup tb-grup-indir"')); // Preserve the approved export-toolbar change.
  const helper = fs.readFileSync(new URL('js/ogretmen-sinif-core.js', root), 'utf8');
  assert.doesNotMatch(helper, /window\.|document\.|getDoc\(|setDoc\(|fetch\(/);
});

for (const assignments of [[], [M]]) test(`bulk attendance respects visible scope (${assignments.length} assignments)`, async () => {
  const x = context({ assignments }); await x.c.loadOgrenciler();
  x.c.ogrenciList = [student('own'), student('hidden-foreign'), student('archived')];
  x.c.ayarListesi = {
    own: { durum: 'aktif', kayit: { sinif: M } },
    'hidden-foreign': { durum: 'aktif', kayit: { sinif: 'Lavanta' } },
    archived: { durum: 'arsiv', kayit: { sinif: M } }
  };
  Object.assign(x.c, { confirm: () => true, showToast() {}, renderDevamsizlik() {},
    aktifDevamsizlikTarih: '2026-10-02', aktifDevamsizlikVerisi: { kayitlar: {} } });
  vm.runInContext(chunk('window.devamsizlikHepsiGeldi =', '// ============ AYLIK ÖZET'), x.c);
  await x.c.window.devamsizlikHepsiGeldi();
  assert.deepEqual(Object.keys(x.c.aktifDevamsizlikVerisi.kayitlar), assignments.length ? ['own'] : []);
});
