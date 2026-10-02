import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

test('admin mobile: browser receives the fresh mobile-fix stylesheet', () => {
  assert.match(read('index.html'), /stil\/arayuz-duzeltmeleri\.css\?v=3/);
  assert.match(read('serviceworker.js'), /v173-ogretmen-sinif-eslesme/);
});
