import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installedPwa, assertPwaBootstrap, serviceWorkerHarness } from './helpers/portal-pwa.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('admin mobile: page-level horizontal movement is locked while wide data stays locally scrollable', () => {
  const css = read('stil/arayuz-duzeltmeleri.css');
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*html, body[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /overscroll-behavior-x:\s*none/);
  assert.match(css, /#dashboard[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /#dashboard \.tab-panel table[\s\S]*overflow-x:\s*auto/);
});

test('admin mobile: student toolbar wraps instead of widening the viewport', () => {
  const css = read('stil/arayuz-duzeltmeleri.css');
  assert.match(css, /#tab-ogrenciler \.ogrenci-arac-grubu[\s\S]*flex-wrap:\s*wrap/);
  assert.match(css, /#tab-ogrenciler \.toolbar-yeni \.tb-arama[\s\S]*min-width:\s*0/);
  assert.match(css, /#tab-ogrenciler \.ogrenci-arac-grubu > button[\s\S]*flex:\s*1 1 145px/);
});

test('admin mobile: known wide dynamic management grids collapse on narrow screens', () => {
  const css = read('stil/arayuz-duzeltmeleri.css');
  assert.match(css, /#geriBildirimIcerik[\s\S]*grid-template-columns:\s*1fr\s*!important/);
  assert.match(css, /#programBelgelemeIcerik[\s\S]*grid-template-columns:\s*1fr\s*!important/);
});

test('admin mobile: intentionally wide tables have an internal scroll owner', () => {
  assert.match(read('portal-yemek.js'), /overflow-x:auto;[\s\S]*min-width:700px/);
  assert.match(read('portal-egitim-pano.js'), /overflow-x:auto;[\s\S]*min-width:620px/);
});

test('admin mobile: complex management modules keep dedicated responsive layouts', () => {
  assert.match(read('moduller/personel-ozluk.js'), /@media\s*\(max-width:\s*700px\)/);
  assert.match(read('moduller/veli-katilim.js'), /@media\s*\(max-width:\s*640px\)/);
  assert.match(read('moduller/gorusme-notlari.js'), /@media\s*\(max-width:\s*640px\)/);
  assert.match(read('js/pdr/panel.css'), /@media\s*\(max-width:\s*720px\)/);
  assert.match(read('js/finans/ui.css'), /@media\s*\(max-width:\s*700px\)/);
});

test('admin mobile: browser receives and caches the linked versioned mobile-fix stylesheet', async () => {
  const html = read('index.html');
  const links = [...html.matchAll(/<link\b[^>]*>/g)].filter(([tag]) =>
    /rel="stylesheet"/.test(tag) && /href="(?:\.\/)?stil\/arayuz-duzeltmeleri\.css\?/.test(tag));
  assert.equal(links.length, 1, 'one active responsive stylesheet link');
  const href = links[0][0].match(/href="([^"]+)"/)[1];
  const url = new URL(href, 'https://portal.example.invalid/');
  assert.match(url.searchParams.get('v'), /^\d+$/);
  const css = read(url.pathname.slice(1));
  assert.match(css, /#dashboard \.tab-panel table[\s\S]*overflow-x:\s*auto/);
  const pwa = await installedPwa();
  await assertPwaBootstrap(pwa, html);
  const requests = [];
  const worker = serviceWorkerHarness({
    cacheMatch: async () => new Response('obsolete stylesheet'),
    fetcher: async request => { requests.push(request); return new Response(css); }
  });
  const request = { url: url.href, method: 'GET', mode: 'cors', destination: 'style' };
  let pending;
  worker.listeners.fetch({ request, respondWith(promise) { pending = promise; } });
  assert.ok(pending, 'the stylesheet uses the worker code-asset handler');
  assert.equal(await (await pending).text(), css);
  assert.deepEqual(requests, [request]);
  assert.equal(worker.puts.length, 1);
  assert.equal(worker.puts[0].name, pwa.cacheName);
  assert.equal(worker.puts[0].args[0], request, 'cache key retains the linked stylesheet version');
  assert.equal(await worker.puts[0].args[1].text(), css);
});
