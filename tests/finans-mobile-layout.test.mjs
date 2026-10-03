import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {grafikRaporlar} from '../js/finans/analytics.js';
import {para} from '../js/finans/core.js';

const css = readFileSync(new URL('../js/finans/ui.css', import.meta.url), 'utf8');

// These are source/render contracts, not browser geometry or visual acceptance.
function declarations(selector) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(',').some(part => part.trim() === selector))
    .map(([, , body]) => body).join(';');
}

test('finance calendar card tracks can fit inside a narrow padded section', () => {
  assert.match(declarations('.finans-app .due-days'), /minmax\(min\(100%,270px\),1fr\)/);
  assert.doesNotMatch(declarations('.finans-app .due-days'), /minmax\(270px,1fr\)/);
});

test('finance loaded totals and report labels wrap without hiding their content', () => {
  assert.match(declarations('.finans-app .card strong'), /overflow-wrap:anywhere/);
  assert.match(declarations('.finans-app .analytic-row>div:first-child'), /flex-wrap:wrap/);
  assert.match(declarations('.finans-app .analytic-row>div:first-child>*'), /min-width:0/);
  assert.match(declarations('.finans-app .analytic-row>div:first-child>*'), /overflow-wrap:anywhere/);
  assert.match(declarations('.finans-app .cards'), /repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(declarations('.finans-app .card strong'), /overflow:hidden|text-overflow:ellipsis/);
});

test('finance dialogs keep their titles and close controls within the available width', () => {
  for (const heading of ['.detail-heading', '.plan-heading']) {
    assert.match(declarations(`.finans-app ${heading}`), /flex-wrap:wrap/);
    assert.match(declarations(`.finans-app ${heading}>*`), /min-width:0/);
    assert.match(declarations(`.finans-app ${heading}>button`), /flex-shrink:0/);
  }
});

test('finance intentionally wide account tables retain local scroll owners', () => {
  assert.match(declarations('.finans-app .scroll'), /overflow:auto/);
  assert.match(declarations('.finans-app .plan-table-scroll'), /overflow-x:auto/);
  assert.match(declarations('.finans-app table'), /white-space:nowrap/);
  for (const selector of ['.finans-app .scroll', '.finans-app .plan-table-scroll']) {
    assert.match(declarations(selector), /min-width:0/);
    assert.match(declarations(selector), /max-width:100%/);
  }
});

test('populated reports retain complete long labels, large totals and accessible chart values', () => {
  const label = 'UzunMuhasebeKalemi'.repeat(6);
  const amount = 123456789.12;
  const data = {
    ogrenciler: [], satirlar: [], bildirimler: [], giderler: [],
    gelirler: [{id:'extra-test', kalemId:'diger-test', kalem:label, tarih:'2026-10-01', tutar:amount}]
  };
  const html = grafikRaporlar(data, '2026-10');
  assert.ok(html.includes(`<span>${label}</span>`));
  assert.ok(html.includes(`<b>${para(amount)}</b>`));
  assert.ok(html.includes('<div class="scroll"><table>'));
  assert.ok(html.includes('viewBox="0 0 720 220"'));
  assert.ok(html.includes('<title>2026-10:'));
});
