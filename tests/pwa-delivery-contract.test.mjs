import test from 'node:test';
import assert from 'node:assert/strict';
import { installedPwa, assertPwaBootstrap, assertPrecachedImport, readPortal } from './helpers/portal-pwa.mjs';

const importer = 'index.html', target = 'js/ogretmen-sinif-core.js';
const origin = 'https://portal.example.invalid/';

// Mutation checks keep the shared release assertions honest: a source filename
// appearing somewhere is insufficient if the browser and installed cache differ.
test('PWA delivery rejects a missing live helper even when other assets are installed', async () => {
  const pwa = await installedPwa();
  const helper = assertPrecachedImport(pwa, importer, target);
  pwa.precache = pwa.precache.filter(path => new URL(path, origin).href !== helper.href);
  assert.throws(() => assertPrecachedImport(pwa, importer, target), /current precache entry/);
});

test('PWA delivery rejects an obsolete helper URL with the right filename', async () => {
  const pwa = await installedPwa();
  const helper = assertPrecachedImport(pwa, importer, target);
  pwa.precache = pwa.precache.map(path => new URL(path, origin).href === helper.href ? `./${target}?v=0` : path);
  assert.throws(() => assertPrecachedImport(pwa, importer, target), /exact import/);
});

test('PWA delivery rejects a stale duplicate beside the current version', async () => {
  const pwa = await installedPwa();
  pwa.precache.push(`./${target}?v=0`);
  assert.throws(() => assertPrecachedImport(pwa, importer, target), /current precache entry/);
});

test('PWA delivery preserves query syntax of the education bridge template imports', async () => {
  const pwa = await installedPwa();
  const bridge = 'js/zeky-veli-egitim-koprusu.js';
  const helper = assertPrecachedImport(pwa, bridge, 'portal-data.js');
  const wrong = new URL(helper.href);
  wrong.search = helper.search.includes('=') ? helper.search.replace('=', '') : helper.search.replace('v', 'v=');
  pwa.precache = pwa.precache.map(path => new URL(path, origin).href === helper.href ? wrong.href : path);
  assert.throws(() => assertPrecachedImport(pwa, bridge, 'portal-data.js'), /exact import/);
});

test('PWA delivery rejects registration and cache generation drift', async () => {
  const pwa = await installedPwa();
  const html = readPortal('index.html').replace(/(serviceworker\.js\?v=)\d+/, '$10');
  await assert.rejects(() => assertPwaBootstrap(pwa, html), /registration must request this cache generation/);
});

test('PWA delivery rejects a reload guard left on another generation', async () => {
  const pwa = await installedPwa();
  const html = readPortal('index.html').replace(/portalSwReload_v\d+/, 'portalSwReload_v0');
  await assert.rejects(() => assertPwaBootstrap(pwa, html), { code: 'ERR_ASSERTION' });
});

test('PWA installs the exact notification-center module used by the mark-all-read UI', async () => {
  const pwa = await installedPwa();
  await assertPwaBootstrap(pwa);
  assertPrecachedImport(pwa, 'index.html', 'js/portal-bildirim-merkezi.js');
  const generation = pwa.cacheVersion.match(/^v\d+/)[0];
  assert.ok(readPortal('index.html').includes(`window.PORTAL_SURUM = "${generation}";`), 'exported runtime release matches the installed cache generation');
  const center = readPortal('js/portal-bildirim-merkezi.js');
  assert.match(center, /function markAllRead\(/);
  assert.match(center, /Hepsini okundu yap/);
});
