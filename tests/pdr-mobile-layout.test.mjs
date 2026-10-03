import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {raporHTML} from '../js/pdr/core.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('js/pdr/panel.css');
// These are scoped CSS/source contracts, not a browser geometry pass.
test('PDR hero opts out of the portal landing-page grid',()=>{
  assert.match(read('js/pdr/panel.js'),/class="hero"/);
  assert.match(read('index.html'),/\.hero\s*\{[^}]*display:\s*grid/);
  assert.match(css,/\.pdr-work \.hero\{[^}]*display:block/);
});

test('PDR mobile grids and native controls own shrinkable minima',()=>{
  assert.match(css,/\.pdr-work \.layout\{[^}]*grid-template-columns:minmax\(0,300px\) minmax\(0,1fr\)/);
  assert.match(css,/\.pdr-work \.students\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  const mobile=css.slice(css.indexOf('@media(max-width:720px)'));
  assert.match(mobile,/\.pdr-work \.layout\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(mobile,/\.pdr-work \.grid\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(mobile,/\.pdr-work \.stats\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.pdr-work :is\(button, input, select, textarea\) \{ min-width:0; max-width:100%; \}/);
  assert.doesNotMatch(css,/overflow-x:hidden/);
});

test('long loaded names and notes are retained with wrapping; report table scroll is screen-only',()=>{
  const ad='ÇokUzunÖğrenciAdı'.repeat(30),not='ÇokUzunGözlemNotu'.repeat(60);
  const html=raporHTML({ad,sinif:'UzunSınıfAdı'.repeat(30)},[{tarih:'2026-10-03',alan:'sosyal',seviye:'takip',not}],[],[]);
  assert.ok(html.includes(ad));assert.ok(html.includes(not));assert.ok(html.includes('<table>'));
  assert.match(css,/\.pdr-work \{ min-width:0; overflow-wrap:anywhere; \}/);
  assert.match(css,/@media screen and \(max-width:720px\) \{\s*\.pdr-work \.report table \{ display:block; max-width:100%; overflow-x:auto; \}/);
});
