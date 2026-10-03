import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
// Source sizing contracts only: these routes still require pixel/native-input QA.
test('standalone personnel form and loaded list own responsive tracks',()=>{
  const html=read('personel-ekle.html');
  assert.match(html,/\.form-grup-2\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(html,/@media \(max-width: 560px\)[\s\S]*\.form-grup-2 \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(html,/\.form-input, \.form-select \{ min-width: 0; max-width: 100%; \}/);
  assert.match(html,/\.personel-kart \{ display: grid; grid-template-columns: 44px minmax\(0, 1fr\)/);
  assert.match(html,/\.header \{ flex-wrap: wrap; gap: 12px; \}/);
});
test('standalone directory search and long-value sheets shrink without clipping',()=>{
  const html=read('ogrenciler.html');
  assert.match(html,/\.arama input \{ min-width:0; width:0; \}/);
  assert.match(html,/\.det-satir > \*, \.det-cocuk > \* \{ min-width:0; max-width:100%; \}/);
  assert.match(html,/\.det-govde \{ overflow-wrap:anywhere; \}/);
  assert.match(html,/\.det-veli-ara \{ flex-wrap:wrap; \}/);
});
test('parent appointment route wraps dynamically rendered person names, dates and notes',()=>{
  const html=read('veli-randevu-callable.html'),renderer=read('js/zeky-randevu-parent-page.js');
  assert.match(renderer,/row\.hedefAd/);assert.match(renderer,/row\.veliNotu/);
  assert.match(html,/main,\.kart,\.slot-gun\{min-width:0;overflow-wrap:anywhere\}/);
  assert.match(html,/\.kart-ust\{flex-wrap:wrap;align-items:flex-start\}/);
  assert.match(html,/\.secim,\.hedef,\.saat,\.islemler button\{min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere\}/);
});
test('both staff appointment routes load versioned responsive theme after local styles',()=>{
  for(const file of ['randevu-ayarlar.html','randevu-talepleri-callable.html']){
    const html=read(file);assert.ok(html.indexOf('randevu-sayfalari.css?v=2')>html.indexOf('</style>'));
  }
  const css=read('stil/randevu-sayfalari.css');
  assert.match(css,/\.ozet \{ grid-template-columns:repeat\(4,minmax\(0,1fr\)\); \}/);
  assert.match(css,/\.filtreler, \.ozet \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.match(css,/\.filtreler, \.randevu-slot \{ grid-template-columns:minmax\(0,1fr\); \}/);
  assert.match(css,/\.ozet-kart \{ padding:13px !important; \}/);
  assert.match(css,/\.ozet-kart \.rp-ozet-ikon \{ position:static;/);
});
test('legacy appointment URLs remain redirects to the responsive standalone routes',()=>{
  assert.match(read('randevu-talepleri.html'),/new URL\('\.\/randevu-talepleri-callable.html', location.href\)/);
  assert.match(read('veli-randevu.html'),/new URL\('\.\/veli-randevu-callable.html', location.href\)/);
});
