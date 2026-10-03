import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// Synthetic DOM/render checks only. Browser geometry remains a separate check.
function documentHarness(ids = []) {
  const nodes = new Map(ids.map(id => [id, {id, innerHTML:'', textContent:'', classList:{add(){},remove(){}}}]));
  const styles = [];
  return {nodes, styles, document:{
    getElementById:id => nodes.get(id) || null,
    createElement:tag => ({tagName:tag, id:'', textContent:''}),
    head:{appendChild(node){nodes.set(node.id,node);styles.push(node);}}
  }};
}

test('loaded meal editor renders all fields in responsive tracks and reopening adds no duplicate style', () => {
  const h = documentHarness(['yemekModal','yemekModalBaslik','yemekModalTablo']);
  const B = {
    escapeHtml:value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
    haftaEtiketi:() => '5–9 Ekim 2026',
    YEMEK_GUNLER:['Pazartesi','Salı','Çarşamba','Perşembe','Cuma'],
    YEMEK_OGUNLER:['kahvalti','ogle','ikindi'].map(key=>({key,label:key,renk:'#fff'}))
  };
  const context = vm.createContext({window:{BCK:B}, document:h.document, console:{log(){}}});
  vm.runInContext(read('portal-yemek.js'), context);
  vm.runInContext(`aktifYemekHaftaBaslangic = new Date('2026-10-05T00:00:00Z');
    aktifYemekVerisi = {gunler:[{kahvalti:{yemek:'Uzun yemek adı \\"deneme\\"',kalori:'100',alerjen:'Süt ve buğday'}}]};
    window.yemekMenusuDuzenle(); window.yemekMenusuDuzenle();`, context);
  const html = h.nodes.get('yemekModalTablo').innerHTML;
  assert.equal((html.match(/class="yemek-editor-grid"/g)||[]).length,15);
  assert.equal((html.match(/<input /g)||[]).length,45);
  assert.ok(html.includes('Uzun yemek adı &quot;deneme&quot;'));
  assert.equal(h.styles.length,1);
  const css = h.styles[0].textContent;
  assert.match(css, /minmax\(0,2fr\) minmax\(0,1fr\) minmax\(0,1\.5fr\)/);
  assert.match(css, /@media \(max-width:640px\)[\s\S]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.yemek-editor-grid > input \{[^}]*min-width:0/);
  assert.match(read('portal-yemek.js'), /overflow-x:auto;[\s\S]*min-width:700px/);
});

test('meeting-note score controls move below labels on narrow phones and retain all five choices', () => {
  const source = read('moduller/gorusme-notlari.js');
  const styleFunction = source.slice(source.indexOf('function stilEkle() {'), source.indexOf('\nif (typeof window !== "undefined")'));
  const h = documentHarness();
  vm.runInNewContext(`${styleFunction}\nstilEkle(); stilEkle();`, {document:h.document});
  assert.equal(h.styles.length,1);
  const css = h.styles[0].textContent;
  assert.match(css, /@media \(max-width:480px\)[\s\S]*\.gn-olcut, \.gn-olcut-oku \{ grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.gn-puanlar \{ flex-wrap:wrap; \}/);
  assert.match(css, /\.gn-puan \{ flex:0 0 34px; \}/);
  assert.match(css, /\.gn-puan-ad \{ grid-column:auto; margin-top:0; \}/);
  assert.match(source, /PUAN\.map\(x => `<button[^`]+data-gn-puan/);
  assert.equal((source.match(/\{ p: [1-5], ad:/g)||[]).length,5);
});

test('parent-activity and personnel details shrink long names and emails outside the dashboard shell', () => {
  const activity = read('moduller/veli-katilim.js');
  assert.match(activity, /\.vk-detay, \.vk-detay-govde, \.vk-detay-bas > div \{ min-width:0; \}/);
  assert.match(activity, /\.vk-detay-bas > div \{ max-width:100%; overflow-wrap:anywhere; \}/);
  assert.match(activity, /\.vk-kapat \{[^}]*flex-shrink:0/);
  const personnel = read('moduller/personel-ozluk.js');
  assert.match(personnel, /\.po-kutu \{[^}]*grid-template-columns:auto minmax\(0,1fr\)/);
  assert.match(personnel, /\.po-kutu-sayi, \.po-kutu-ad \{ min-width:0; overflow-wrap:anywhere; \}/);
  assert.match(personnel, /\.po-cekmece, \.po-c-govde, \.po-c-govde > \* \{ min-width:0; \}/);
  assert.match(personnel, /\.po-c-kim, \.po-c-govde \{ overflow-wrap:anywhere; \}/);
  assert.match(personnel, /\.po-kapat \{[^}]*flex-shrink:0/);
  assert.match(personnel, /\.po-sekmeler \{[^}]*overflow-x:auto/);
});
