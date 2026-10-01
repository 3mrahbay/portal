import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../js/ogrenci-liste-core.js';
import { ogrenciListeXlsxOlustur } from '../js/ogrenci-liste-xlsx.js';

// Independent review fixtures are synthetic and never connect to Firestore.
const root = new URL('../', import.meta.url);
const source = () => fs.readFileSync(new URL('index.html', root), 'utf8');
const fixedNow = new Date('2026-10-01T12:00:00Z');
function readyState() {
  return {
    currentUser: { uid: 'synthetic-management' }, isAdmin: false, rol: 'mudur',
    aktifDonem: '2026-2027', ogrenciVerileriHazirMi: true,
    ogrenciDisAktarDurumu: { donem: '2026-2027', uid: 'synthetic-management', hazir: true, hataSayisi: 0 },
    ogrenciList: [{ id: 'synthetic-one', ogrenciAdSoyad: 'Sentetik Öğrenci', tcKimlik: '00000000001', dogumTarihi: '2020-02-29' }],
    ayarListesi: { 'synthetic-one': { donemYili: '2026-2027', durum: 'aktif', kayit: { sinif: 'Sentetik Sınıf' } } },
  };
}

test('review: only authenticated management can prepare identity exports', () => {
  for (const rol of ['ogretmen', 'muhasebe', 'egitim_koordinator', 'pdr', 'danisma', 'halkla_iliskiler', null]) {
    assert.throws(() => core.ogrenciListeRaporu({ ...readyState(), rol }, { now: fixedNow }), /yetkiniz/);
  }
  for (const rol of ['kurucu_mudur', 'mudur']) assert.equal(core.ogrenciListeRaporu({ ...readyState(), rol }, { now: fixedNow }).satirlar.length, 1);
  assert.equal(core.ogrenciListeRaporu({ ...readyState(), isAdmin: true, rol: null }, { now: fixedNow }).satirlar.length, 1);
  assert.throws(() => core.ogrenciListeRaporu({ ...readyState(), currentUser: null, isAdmin: true }, { now: fixedNow }), /yetkiniz/);
});

test('review: stale year, account, and partial reads cannot produce a report', () => {
  const s = readyState();
  for (const patch of [{ donem: '2025-2026' }, { uid: 'other-account' }, { hazir: false }, { hataSayisi: 1 }]) {
    assert.throws(() => core.ogrenciListeRaporu({ ...s, ogrenciDisAktarDurumu: { ...s.ogrenciDisAktarDurumu, ...patch } }, { now: fixedNow }));
  }
});

test('review: historical explicit blanks are preserved and current class and generic guardians do not leak', () => {
  const s = readyState();
  Object.assign(s.ogrenciList[0], { aktifDonem: '2027-2028', sinif: 'Future class', veli1AdSoyad: 'Generic first guardian', veli2AdSoyad: 'Generic second guardian' });
  s.ayarListesi['synthetic-one'] = { donemYili: '2026-2027', durum: 'aktif', ogrenci: { tcKimlik: '', dogumTarihi: '', cinsiyet: '' }, anne: { adSoyad: 'Named mother', tcKimlik: '' }, vasi: { adSoyad: 'Guardian', tcKimlik: '00000000009' } };
  const row = core.ogrenciListeRaporu(s, { now: fixedNow }).satirlar[0];
  assert.deepEqual(row.slice(2, 7), ['', '', '', '', '']);
  assert.deepEqual(row.slice(7), ['Named mother', '', '', '']);
});

test('review: active export ignores all table filters but requires selected-year membership', () => {
  const s = readyState();
  s.ogrenciList.push({ id: 'synthetic-two' }, { id: 'synthetic-archived' }, { id: 'different-year-only' });
  s.ayarListesi['synthetic-two'] = { donemYili: s.aktifDonem, durum: 'aktif', ogrenci: { adSoyad: 'Another synthetic student' } };
  s.ayarListesi['synthetic-archived'] = { donemYili: s.aktifDonem, durum: 'arsiv' };
  Object.assign(s, { filteredList: [], activeFilter: 'sinif::Nonexistent', activeDurum: 'arsiv', searchVal: 'no match', currentPage: 500 });
  const report = core.ogrenciListeRaporu(s, { now: fixedNow });
  assert.equal(report.satirlar.length, 2);
  assert.deepEqual(report.satirlar.map(row => row[0]), [1, 2]);
  assert.equal(core.ogrenciListeRaporu(s, { now: fixedNow, durumKapsami: 'arsiv' }).satirlar.length, 1);
});

test('review: declared period mismatch must reject rather than export a different year', () => {
  const s = readyState();
  s.ayarListesi['synthetic-one'].donemYili = '2025-2026';
  assert.throws(() => core.ogrenciListeRaporu(s, { now: fixedNow }));
});

test('review: date parsing and Turkish calendar date avoid invalid and future birth values', () => {
  assert.equal(core.dogumTakvimi('2021-02-29'), null);
  assert.equal(core.dogumTakvimi('31.04.2020'), null);
  assert.equal(core.dogumTakvimi('29.02.2020').iso, '2020-02-29');
  assert.equal(core.okulTakvimTarihi(new Date('2026-09-30T21:01:00Z')), '2026-10-01');
  const s = readyState();
  s.ayarListesi['synthetic-one'].ogrenci = { dogumTarihi: '2027-01-01' };
  assert.deepEqual(core.ogrenciListeRaporu(s, { now: fixedNow }).satirlar[0].slice(3, 5), ['', '']);
});

function readStoredZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries = new Map();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    assert.equal(view.getUint16(offset + 8, true), 0);
    const length = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const dataStart = offset + 30 + nameLength + extraLength;
    entries.set(name, decoder.decode(bytes.subarray(dataStart, dataStart + length)));
    offset = dataStart + length;
  }
  return entries;
}

test('review: XLSX keeps formulas inert, identifiers textual, and XML escaped', () => {
  const s = readyState();
  s.ayarListesi['synthetic-one'].ogrenci = { adSoyad: '=HYPERLINK("https://example.invalid","ÇŞı<>&")\u0001' };
  const report = core.ogrenciListeRaporu(s, { now: fixedNow });
  const entries = readStoredZip(ogrenciListeXlsxOlustur(report));
  const sheet = entries.get('xl/worksheets/sheet1.xml');
  assert.equal(entries.size, 6);
  assert.match(sheet, /<c r="C5"[^>]*t="inlineStr"><is><t xml:space="preserve">00000000001<\/t>/);
  assert.match(sheet, /<c r="B5"[^>]*t="inlineStr">/);
  assert.match(sheet, /=HYPERLINK\(&quot;https:\/\/example.invalid&quot;,&quot;ÇŞı&lt;&gt;&amp;&quot;\)/);
  assert.doesNotMatch(sheet, /<f[ >]|\u0001/);
  assert.match(sheet, /topLeftCell="A5"/);
  assert.match(sheet, /autoFilter ref="A4:K5"/);
});

function extract(start, end) {
  const text = source(), from = text.indexOf(start), to = text.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Function extraction failed: ${start}`);
  return text.slice(from, to);
}

function loaderContext({ collectionReads = false } = {}) {
  const requests = [], collectionRequests = [];
  const ctx = {
    isAdmin: false, aktifKullaniciRol: 'mudur', currentUser: { uid: 'synthetic-management' }, AKTIF_DONEM: '2026-2027',
    ogrenciList: Array.from({ length: 5 }, (_, i) => ({ id: `synthetic-${i}` })), ayarListesi: {},
    ogrenciVerileriHazirMi: true, ogrenciDonemYuklemeSurumu: 0, ogrenciVeriYuklemeSurumu: 0,
    ogrenciDisAktarDurumu: {}, anaKayitDonemOzetiKullaniliyor: false, gelecekDonemKayitlari: {},
    gelecekDonemKayitlariHazirMi: false, gelecekDonemKayitlariYuklemeSozu: null, db: {},
    console: { warn() {}, error() {} }, setTimeout,
    doc: (_, ...parts) => parts.join('/'), collection: (_, name) => name,
    getDoc: path => new Promise((resolve, reject) => requests.push({ path, resolve, reject })),
    getDocs: name => new Promise((resolve, reject) => collectionRequests.push({ name, resolve, reject })),
    ogrenciListeDisaAktarmaGuncelle() {}, ogrenciSekmesiAktifMi: () => false,
    document: { getElementById: () => ({ innerHTML: '' }) }, danismaRolMu: () => false,
    ogrenciListeyiRoleGoreFiltrele: list => list, danismaProjeksiyonYonetebilirMi: () => false,
    ogrenciArayuzunuGuncelle() {}, adminHomeVeriYuklemesiTamamlandi() {},
  };
  vm.createContext(ctx);
  vm.runInContext(extract('async function loadAyarlar()', '\nfunction ogrenciSekmesiAktifMi()'), ctx);
  if (collectionReads) vm.runInContext(extract('async function loadOgrenciler()', '\nasync function loadAyarlar()'), ctx);
  return { ctx, requests, collectionRequests };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const succeed = request => { request.done = true; request.resolve({ exists: () => true, data: () => ({ donemYili: request.path.split('/').at(-1), durum: 'aktif' }) }); };
async function drain(requests) {
  for (let i = 0; i < 15; i++) {
    const pending = requests.filter(request => !request.done);
    for (const request of pending) succeed(request);
    await tick();
    if (!requests.some(request => !request.done)) return;
  }
  assert.fail('Synthetic loader failed to finish');
}

test('review: overlapping term reads atomically publish only the latest selected year', async () => {
  const { ctx, requests } = loaderContext();
  ctx.AKTIF_DONEM = '2025-2026';
  const oldLoad = ctx.loadAyarlar();
  assert.deepEqual(Object.keys(ctx.ayarListesi), []);
  ctx.AKTIF_DONEM = '2026-2027';
  const currentLoad = ctx.loadAyarlar();
  await drain(requests);
  await Promise.all([oldLoad, currentLoad]);
  assert.equal(Object.keys(ctx.ayarListesi).length, 5);
  assert.deepEqual([...new Set(Object.values(ctx.ayarListesi).map(row => row.donemYili))], ['2026-2027']);
  assert.equal(ctx.ogrenciDisAktarDurumu.hazir, true);
  assert.equal(ctx.ogrenciDisAktarDurumu.hataSayisi, 0);
  assert.equal(requests.filter(request => request.path.endsWith('/2025-2026')).length, 3);
});

test('review: denied period read is observable and blocks partial exports', async () => {
  const { ctx, requests } = loaderContext();
  const promise = ctx.loadAyarlar();
  requests[0].done = true;
  requests[0].reject(new Error('synthetic permission denied'));
  await drain(requests);
  await promise;
  assert.equal(ctx.ogrenciDisAktarDurumu.hataSayisi, 1);
  const state = { ...ctx, rol: ctx.aktifKullaniciRol, aktifDonem: ctx.AKTIF_DONEM };
  assert.match(core.ogrenciListeHazirlik(state), /okunamadı/);
  assert.throws(() => core.ogrenciListeRaporu(state, { now: fixedNow }), /okunamadı/);
});

test('review: empty collection finishes readiness with zero rows', async () => {
  const { ctx, collectionRequests } = loaderContext({ collectionReads: true });
  const promise = ctx.loadOgrenciler();
  collectionRequests[0].resolve({ empty: true });
  await promise;
  assert.equal(ctx.ogrenciVerileriHazirMi, true);
  assert.equal(ctx.ogrenciDisAktarDurumu.hazir, true);
  assert.deepEqual(Object.keys(ctx.ayarListesi), []);
});

test('review: collection result from an old account cannot publish under the new account', async () => {
  const { ctx, collectionRequests, requests } = loaderContext({ collectionReads: true });
  const oldList = ctx.ogrenciList;
  const promise = ctx.loadOgrenciler();
  ctx.currentUser = { uid: 'new-synthetic-management' };
  collectionRequests[0].resolve({ empty: false, forEach: callback => callback({ id: 'prior-account-student', data: () => ({ ogrenciAdSoyad: 'Prior synthetic account record' }) }) });
  await tick();
  await drain(requests);
  await promise;
  assert.equal(ctx.ogrenciList, oldList);
  assert.notEqual(ctx.ogrenciDisAktarDurumu.uid, 'new-synthetic-management');
});

function uiContext() {
  let current = readyState();
  const messages = [], downloads = [], timers = [];
  const buttons = ['xlsx', 'pdf'].map(format => ({ dataset: { ogrenciIndir: format }, setAttribute() {}, addEventListener() {} }));
  const label = { textContent: '' };
  const panel = { hidden: true, querySelectorAll: () => buttons };
  const ctx = {
    ...core, ogrenciListeXlsxOlustur, Blob,
    window: { PortalAPI: { get state() { return current; }, toast: (...args) => messages.push(args) } },
    document: {
      getElementById: id => id === 'ogrenciListeDisaAktar' ? panel : label,
      body: { appendChild() {} },
      createElement: () => ({ style: {}, click() { downloads.push(this.download); }, remove() {} }),
    },
    URL: { createObjectURL: () => 'blob:synthetic', revokeObjectURL() {} },
    setTimeout: (callback, milliseconds) => { if (milliseconds === 30000) { timers.push(callback); return 0; } return setTimeout(callback, milliseconds); },
  };
  vm.createContext(ctx);
  const code = fs.readFileSync(new URL('js/ogrenci-liste-disa-aktar.js', root), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/export /g, '');
  vm.runInContext(code, ctx);
  return { ctx, panel, label, buttons, messages, downloads, setState: next => { current = next; }, getState: () => current };
}

test('review: inconsistent period data shows an actionable UI error rather than a false zero count', () => {
  const f = uiContext();
  f.getState().ayarListesi['synthetic-one'].donemYili = '2025-2026';
  f.ctx.ogrenciListeDisaAktarmaGuncelle();
  assert.doesNotMatch(f.label.textContent, /0 aktif öğrenci/);
  assert.match(f.label.textContent, /yeniley|uyuşmaz|tutarsız/);
  assert.ok(f.buttons.every(button => button.disabled));
});

test('review: export action prevents a duplicate click and downloads only once', async () => {
  const f = uiContext();
  const first = f.ctx.ogrenciListeIndir('xlsx');
  assert.equal(await f.ctx.ogrenciListeIndir('xlsx'), false);
  assert.equal(await first, true);
  assert.equal(f.downloads.length, 1);
  assert.ok(f.downloads[0].endsWith('.xlsx'));
  assert.ok(f.buttons.every(button => !button.disabled));
});

test('review: logout, role loss, year change and fresh load prevent in-flight download', async () => {
  for (const change of [s => ({ ...s, currentUser: null }), s => ({ ...s, rol: 'ogretmen' }), s => ({ ...s, aktifDonem: '2025-2026' }), s => ({ ...s, ogrenciDisAktarDurumu: { ...s.ogrenciDisAktarDurumu } })]) {
    const f = uiContext();
    const promise = f.ctx.ogrenciListeIndir('xlsx');
    f.setState(change(f.getState()));
    assert.equal(await promise, false);
    assert.equal(f.downloads.length, 0);
    assert.ok(f.messages.some(([message]) => /Oturum veya dönem değişti/.test(message)));
  }
});
