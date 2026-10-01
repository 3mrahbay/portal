import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PDFDocument } from '../js/vendor/ogrenci-liste-pdf/pdf-lib-1.17.1.esm.js';
import { ogrenciListePdfOlustur } from '../js/ogrenci-liste-pdf.js';
import { syntheticReport, edgeReport, oversizeReport } from './ogrenci-liste-pdf-fixtures.mjs';
import { ogrenciListeRaporu, ogrenciListeDosyaAdi } from '../js/ogrenci-liste-core.js';

const root = new URL('../', import.meta.url);
const originalFetch = globalThis.fetch;
const fetchCalls = [];
globalThis.fetch = async (url, options) => {
  assert.equal(url.protocol, 'file:');
  assert.ok(url.href.startsWith(new URL('js/vendor/ogrenci-liste-pdf/', root).href));
  assert.match(url.pathname, /DejaVuSans(?:-Bold)?\.ttf$/);
  assert.deepEqual(options, { mode: 'same-origin', credentials: 'same-origin', redirect: 'error' });
  fetchCalls.push(url.href);
  return { ok: true, arrayBuffer: async () => new Uint8Array(await readFile(url)).buffer };
};
test.after(() => { globalThis.fetch = originalFetch; });

async function parsePdf(bytes) {
  const temp = await mkdtemp(join(tmpdir(), 'ogrenci-liste-pdf-test-'));
  try {
    const path = join(temp, 'synthetic.pdf');
    await writeFile(path, bytes);
    return execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  } finally { await rm(temp, { recursive: true, force: true }); }
}

test('local vendor assets have the checked-in pinned checksums', async () => {
  const vendor = new URL('js/vendor/ogrenci-liste-pdf/', root);
  const hashes = JSON.parse(await readFile(new URL('SHA256SUMS.json', vendor), 'utf8'));
  assert.equal(Object.keys(hashes).length, 4);
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(file, vendor))).digest('hex'), hash);
  }
});

test('PDF accepts the exact 11 columns, rejects malformed rows and dates before loading assets', async () => {
  const baselineCalls = fetchCalls.length;
  for (const report of [null, {}, { ...syntheticReport(0), basliklar: [] },
    { ...syntheticReport(0), tarih: '2026-02-30' },
    { ...syntheticReport(0), satirlar: [[...Array(12).fill('')]] },
    { ...syntheticReport(0), satirlar: [[{}]] }]) {
    await assert.rejects(ogrenciListePdfOlustur(report), /PDF/);
  }
  assert.equal(fetchCalls.length, baselineCalls);
});

test('Turkish characters, long names, missing values and string identities survive a real PDF parser', async () => {
  const report = edgeReport();
  const before = structuredClone(report);
  // Old jsPDF global monkey patches must never be read by this module.
  globalThis.jspdf = { jsPDF() { throw new Error('legacy PDF must not run'); } };
  globalThis.jsPDF = globalThis.jspdf.jsPDF;
  const bytes = await ogrenciListePdfOlustur(report);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 8)), '%PDF-1.7');
  assert.deepEqual(report, before);
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 1);
  for (const page of document.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 841.89) < 0.1);
    assert.ok(Math.abs(page.getHeight() - 595.28) < 0.1);
  }
  const text = await parsePdf(bytes);
  assert.match(text, /Çağrı Işık İpek Şule/);
  assert.match(text, /ÖĞÜŞİÇ öğüşıç/);
  assert.match(text, /00000000001/);
  assert.match(text, /Eksik Alan Örneği/);
  assert.match(text, /Öğrenci sayısı: 5/);
  assert.match(text, /01\.10\.2026/);
  assert.match(text, /Tüm aktif öğrenciler/);
  assert.match(text, /Yaş, çıktı tarihine göre hesaplanır/);
  assert.match(text, /6 yaş 0 ay/);
  assert.ok(!text.includes('\uFFFD'));
  assert.equal(fetchCalls.length, 2);
});

test('500 rows remain complete across pages, with repeated headings and page totals', async () => {
  const report = syntheticReport(500);
  const bytes = await ogrenciListePdfOlustur(report);
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 10);
  const text = await parsePdf(bytes);
  const pages = text.split('\f').filter(value => value.trim());
  assert.equal(pages.length, document.getPageCount());
  for (let index = 0; index < 500; index += 1) {
    assert.ok(text.includes(`Deneme${String(index + 1).padStart(4, '0')}`));
    assert.ok(text.includes(`000${String(index + 1).padStart(8, '0')}`));
  }
  for (let index = 0; index < pages.length; index += 1) {
    assert.match(pages[index], /ÖĞRENCİ LİSTESİ/);
    assert.match(pages[index], /Anne Ad Soyad/);
    assert.match(pages[index], /Baba Ad Soyad/);
    assert.ok(pages[index].includes(`Sayfa ${index + 1} / ${pages.length}`));
  }
  assert.equal(fetchCalls.length, 2, 'only local font bytes are cached; no report data is cached');
});

test('a row taller than a page continues explicitly, without dropping name tokens', async () => {
  const bytes = await ogrenciListePdfOlustur(oversizeReport());
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 1);
  const text = await parsePdf(bytes);
  for (let index = 1; index <= 220; index += 1) assert.ok(text.includes(`UzunAd${String(index).padStart(4, '0')}`));
  assert.match(text, /Başlangıç/);
  assert.match(text, /Sonuç/);
  assert.match(text, /1\. satırın devamı/);
});

test('empty list produces a valid one-page report', async () => {
  const bytes = await ogrenciListePdfOlustur(syntheticReport(0));
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
  assert.match(await parsePdf(bytes), /Bu dönem için listelenecek öğrenci bulunamadı/);
});

test('real active/archive PDFs keep categories and selected-year membership distinct', async () => {
  const state={currentUser:{uid:'synthetic'},isAdmin:true,aktifDonem:'2026-2027',ogrenciVerileriHazirMi:true,
    ogrenciDisAktarDurumu:{donem:'2026-2027',uid:'synthetic',hazir:true,hataSayisi:0},
    ogrenciList:[{id:'active',ogrenciAdSoyad:'AktifSentetik İpek'},{id:'archived',ogrenciAdSoyad:'ArşivSentetik Çağrı'},
      {id:'applicant',ogrenciAdSoyad:'BaşvuruSentetik'},{id:'old',ogrenciAdSoyad:'EskiDönemSentetik',durum:'arsiv'}],
    ayarListesi:{active:{donemYili:'2026-2027',durum:'aktif'},archived:{donemYili:'2026-2027',durum:'arsiv'},applicant:{durum:'basvuru'}}};
  for(const scope of ['aktif','arsiv']){
    const report=ogrenciListeRaporu(state,{now:new Date('2026-10-01T12:00:00Z'),durumKapsami:scope});
    const text=await parsePdf(await ogrenciListePdfOlustur(report));
    assert.match(text,scope==='aktif'?/Kapsam: Aktif öğrenciler/:/Kapsam: Arşiv öğrencileri/);
    assert.match(text,scope==='aktif'?/AktifSentetik İpek/:/ArşivSentetik Çağrı/);
    assert.doesNotMatch(text,scope==='aktif'?/ArşivSentetik/:/AktifSentetik/);
    assert.doesNotMatch(text,/BaşvuruSentetik|EskiDönemSentetik/);assert.match(text,/Öğrenci sayısı: 1/);
    assert.match(ogrenciListeDosyaAdi(report,'pdf'),new RegExp(`2026-2027_${scope}_1-ogrenci_`));
  }
});

test('unsupported glyphs are an explicit safe error rather than silent clipping or data leakage', async () => {
  const report = syntheticReport(1);
  report.satirlar[0][1] = 'Private synthetic marker \u{10FFFF}';
  await assert.rejects(ogrenciListePdfOlustur(report), error => {
    assert.match(error.message, /desteklemediği bir karakter/);
    assert.ok(!error.message.includes('Private'));
    return true;
  });
});
