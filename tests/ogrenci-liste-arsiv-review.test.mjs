import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../js/ogrenci-liste-core.js';
import { ogrenciListeXlsxOlustur } from '../js/ogrenci-liste-xlsx.js';

// Independent archive-extension review. All records are invented; no remote I/O.
const root = new URL('../', import.meta.url);
const now = new Date('2026-10-01T09:00:00Z');
function readyState() {
  return {
    currentUser: { uid: 'synthetic-archive-review' }, isAdmin: false, rol: 'mudur',
    aktifDonem: '2026-2027', ogrenciVerileriHazirMi: true,
    ogrenciDisAktarDurumu: { donem: '2026-2027', uid: 'synthetic-archive-review', hazir: true, hataSayisi: 0 },
    ogrenciList: [], ayarListesi: {},
  };
}
function add(s, id, durum, extra = {}) {
  s.ogrenciList.push({ id, ogrenciAdSoyad: id, ...extra });
  s.ayarListesi[id] = { donemYili: s.aktifDonem, durum };
}
const report = (s, scope) => core.ogrenciListeRaporu(s, { now, durumKapsami: scope });

test('archive review: selected-year archive aliases are separate and exclude applications, renewals and other years', () => {
  const s = readyState();
  const aliases = ['arsiv', 'arşiv', 'pasif', 'ayrildi', 'ayrıldı', ' ARŞİV ', 'AYRILDI'];
  aliases.forEach((status, index) => add(s, `archive-${index}`, status));
  add(s, 'active-only', 'aktif');
  ['basvuru', 'başvuru', 'yenileme', 'bekliyor', 'reddedildi', 'pending'].forEach(status => add(s, `excluded-${status}`, status));
  s.ogrenciList.push({ id: 'other-year-only', durum: 'arsiv', aktifDonem: '2025-2026' });
  s.ogrenciList.push({ id: 'summary-only', durum: 'arsiv' });
  s.ayarListesi['summary-only'] = { _anaKayitOzeti: true, durum: 'arsiv' };
  s.filteredList = []; s.activeDurum = 'basvuru'; s.search = 'nothing';
  assert.deepEqual(report(s, 'aktif').satirlar.map(row => row[1]), ['active-only']);
  assert.deepEqual(report(s, 'arsiv').satirlar.map(row => row[1]), aliases.map((_, index) => `archive-${index}`));
  assert.equal(report(s, 'arsiv').kapsam, 'Arşiv öğrencileri');
  assert.match(core.ogrenciListeDosyaAdi(report(s, 'arsiv'), 'pdf'), /_arsiv_7-ogrenci_2026-10-01\.pdf$/);
  assert.throws(() => report(s, 'tumu'), /Geçersiz liste kapsamı/);
});

test('archive review: period status overrides master status and named parent rules stay intact', () => {
  const s = readyState();
  add(s, 'archive', 'arsiv', { durum: 'aktif', aktifDonem: '2027-2028', sinif: 'Newer class', tcKimlik: '00000000001', veli1AdSoyad: 'Generic guardian', veli2AdSoyad: 'Other guardian' });
  Object.assign(s.ayarListesi.archive, {
    ogrenci: { tcKimlik: '' }, anne: { adSoyad: 'Named mother', tcKimlik: '00000000002' },
    vasi: { adSoyad: 'Not a father', tcKimlik: '00000000003' },
  });
  add(s, 'application', 'basvuru', { durum: 'arsiv' });
  add(s, 'renewal', 'yenileme', { durum: 'arsiv' });
  const rows = report(s, 'arsiv').satirlar;
  assert.equal(rows.length, 1);
  assert.equal(rows[0][2], '');
  assert.deepEqual(rows[0].slice(6), ['', 'Named mother', '00000000002', '', '']);
  s.ayarListesi.archive.donemYili = '2025-2026';
  assert.throws(() => report(s, 'arsiv'), /uyuşmazlık/);
});

function fixture() {
  let current = readyState();
  add(current, 'synthetic-active', 'aktif');
  add(current, 'synthetic-archive', 'arsiv');
  const downloads = [], messages = [], buttons = [];
  for (const scope of ['aktif', 'arsiv']) for (const format of ['xlsx', 'pdf']) buttons.push({
    dataset: { ogrenciIndir: format, ogrenciKapsam: scope }, listeners: [],
    setAttribute() {}, addEventListener(event, callback) { assert.equal(event, 'click'); this.listeners.push(callback); },
  });
  const panel = { hidden: true, querySelectorAll: () => buttons }, label = { textContent: '' };
  const ctx = {
    ...core, ogrenciListeXlsxOlustur, Blob,
    window: { PortalAPI: { get state() { return { ...current }; }, toast: (...args) => messages.push(args) } },
    document: { getElementById: id => id === 'ogrenciListeDisaAktar' ? panel : label,
      body: { appendChild() {} }, createElement: () => ({ style: {}, click() { downloads.push(this.download); }, remove() {} }) },
    URL: { createObjectURL: () => 'blob:synthetic-archive', revokeObjectURL() {} },
    setTimeout: (callback, ms) => ms === 30000 ? 0 : setTimeout(callback, ms),
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('js/ogrenci-liste-disa-aktar.js', root), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/export /g, ''), ctx);
  return { ctx, buttons, panel, label, downloads, messages, getState: () => current, setState: next => { current = next; } };
}

test('archive review: compact menu hides normal count text and independently disables empty categories', () => {
  const f = fixture();
  f.ctx.ogrenciListeDisaAktarmaGuncelle();
  assert.equal(f.panel.hidden, false);
  assert.equal(f.label.textContent, '');
  assert.ok(f.buttons.every(button => !button.disabled));
  delete f.getState().ayarListesi['synthetic-active'];
  f.ctx.ogrenciListeDisaAktarmaGuncelle();
  assert.ok(f.buttons.filter(b => b.dataset.ogrenciKapsam === 'aktif').every(b => b.disabled));
  assert.ok(f.buttons.filter(b => b.dataset.ogrenciKapsam === 'arsiv').every(b => !b.disabled));
  assert.ok(f.buttons.every(button => button.listeners.length === 1));
  f.setState({ ...f.getState(), rol: 'ogretmen' });
  f.ctx.ogrenciListeDisaAktarmaGuncelle();
  assert.equal(f.panel.hidden, true);
});

test('archive review: button dispatch retains category, disables cross-category concurrent export and recovers', async () => {
  const f = fixture();
  f.ctx.ogrenciListeDisaAktarmaGuncelle();
  const button = f.buttons.find(b => b.dataset.ogrenciKapsam === 'arsiv' && b.dataset.ogrenciIndir === 'xlsx');
  const pending = button.listeners[0]();
  assert.ok(f.buttons.every(b => b.disabled));
  assert.equal(await f.ctx.ogrenciListeIndir('xlsx', 'aktif'), false);
  assert.equal(await pending, true);
  assert.equal(f.downloads.length, 1);
  assert.match(f.downloads[0], /_arsiv_1-ogrenci_/);
  assert.ok(f.messages.some(([message]) => /Arşiv öğrencileri/.test(message)));
  assert.ok(f.buttons.every(b => !b.disabled));
  assert.equal(await f.ctx.ogrenciListeIndir('xlsx', 'tumu'), false);
  assert.equal(f.downloads.length, 1);
});

test('archive review: logout, role loss, account/year change and new load cancel pending archive export', async () => {
  const changes = [
    s => ({ ...s, currentUser: null }), s => ({ ...s, rol: 'ogretmen' }),
    s => ({ ...s, currentUser: { uid: 'other-account' } }), s => ({ ...s, aktifDonem: '2025-2026' }),
    s => ({ ...s, ogrenciDisAktarDurumu: { ...s.ogrenciDisAktarDurumu } }),
    s => ({ ...s, ogrenciDisAktarDurumu: { ...s.ogrenciDisAktarDurumu, hataSayisi: 1 } }),
  ];
  for (const change of changes) {
    const f = fixture();
    const pending = f.ctx.ogrenciListeIndir('xlsx', 'arsiv');
    f.setState(change(f.getState()));
    assert.equal(await pending, false);
    assert.equal(f.downloads.length, 0);
    assert.ok(f.messages.some(([message]) => /Oturum veya dönem değişti/.test(message)));
  }
});

test('archive review: actual panel has exactly one button per category and format', () => {
  const html = fs.readFileSync(new URL('index.html', root), 'utf8');
  const matches = [...html.matchAll(/data-ogrenci-indir="(xlsx|pdf)" data-ogrenci-kapsam="(aktif|arsiv)"/g)];
  assert.deepEqual(matches.map(match => `${match[2]}:${match[1]}`).sort(), ['aktif:pdf', 'aktif:xlsx', 'arsiv:pdf', 'arsiv:xlsx']);
});
