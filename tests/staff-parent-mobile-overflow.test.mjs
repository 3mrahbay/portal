import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installedPwa, assertPwaBootstrap } from './helpers/portal-pwa.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('staff mobile: role dashboards cannot widen the page', () => {
  const css = read('stil/arayuz-duzeltmeleri.css');
  for (const role of ['ogretmen','danisma','muhasebe','pdr','egitim_koordinator','mudur']) {
    assert.match(css, new RegExp('body\\.rol-' + role + ' #dashboard'));
  }
  assert.match(css, /body\.rol-ogretmen #dashboard[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /#tab-personel \.personel-liste[\s\S]*grid-template-columns:\s*1fr\s*!important/);
});

test('staff mobile: role-specific complex screens retain responsive layouts', () => {
  assert.match(read('moduller/ogretmen-anasayfa.js'), /@media\s*\(max-width:\s*560px\)/);
  assert.match(read('moduller/ogretmen-sinifim.js'), /@media\s*\(max-width:\s*420px\)/);
  assert.match(read('moduller/personel-ozluk.js'), /@media\s*\(max-width:\s*700px\)/);
  assert.match(read('moduller/personel-anlik-bildirim.js'), /@media\s*\(max-width:\s*700px\)/);
  assert.match(read('js/finans/ui.css'), /@media\s*\(max-width:\s*700px\)/);
  assert.match(read('js/pdr/panel.css'), /@media\s*\(max-width:\s*720px\)/);
});

test('parent mobile: parent shell is fixed horizontally and wide tables scroll locally', () => {
  const css = read('stil/arayuz-duzeltmeleri.css');
  assert.match(css, /#veliPanel,[\s\S]*#veliPanel \.ca-page[\s\S]*min-width:\s*0/);
  assert.match(css, /#veliPanel\s*\{[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /#veliPanel \.veli-tab-panel table[\s\S]*overflow-x:\s*auto/);
});

test('parent mobile: messages, reports and legacy cards fit viewport', () => {
  const css = read('stil/arayuz-duzeltmeleri.css');
  assert.match(css, /#veliPanel \.mesaj-konteyner[\s\S]*max-width:\s*100%/);
  assert.match(css, /#veliPanel \.rapor-disiplin-grid[\s\S]*grid-template-columns:\s*1fr\s*!important/);
  assert.match(css, /#veliPanel \.veli-card-grid-2,[\s\S]*grid-template-columns:\s*1fr\s*!important/);
  assert.match(read('portal-stil.css'), /@media \(max-width: 768px\)[\s\S]*\.mesaj-konteyner \{ height: 70vh/);
});

test('parent mobile: modern parent modules already use responsive breakpoints', () => {
  assert.match(read('portal-tema.css'), /@media \(max-width: 820px\)[\s\S]*ca-hero-row/);
  assert.match(read('moduller/veli-kompakt.js'), /@media\s*\(max-width:\s*560px\)/);
  assert.match(read('js/finans/ui.css'), /@media\s*\(max-width:\s*600px\)/);
  assert.match(read('js/zeky-randevu-veli-arayuz.js'), /@media\s*\(max-width:\s*520px\)/);
});

test('staff parent mobile: fresh stylesheet and current cache generation are served', async () => {
  assert.match(read('index.html'), /stil\/arayuz-duzeltmeleri\.css\?v=5/);
  const pwa = await installedPwa();
  assert.match(pwa.cacheVersion, /^v\d+/);
  await assertPwaBootstrap(pwa);
});
