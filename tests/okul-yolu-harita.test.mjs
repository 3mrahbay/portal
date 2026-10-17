// Okul Yolu · iOS harita ara sayfası (okul-yolu-harita.html).
// ZEKY iOS'ta harita bu sayfanın içinde açılır (bkz. js/zeky-yol.js IOS_HARITA_CERCEVESI).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sayfa = readFileSync(new URL('../okul-yolu-harita.html', import.meta.url), 'utf8');
const betik = sayfa.match(/<script>([\s\S]*?)<\/script>/)[1];
const ANAHTAR = 'AIza' + 'B'.repeat(35);

function calistir(hash) {
  const govde = [];
  const dinleyiciler = {};
  const ogeYap = () => {
    const attrs = {};
    const o = { attrs, setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: k => attrs[k] ?? null,
      remove: () => { const i = govde.indexOf(o); if (i >= 0) govde.splice(i, 1); } };
    return o;
  };
  const document = { createElement: () => ogeYap(), querySelector: () => govde[0] || null, body: { appendChild: o => govde.push(o) } };
  const location = { hash };
  const window = { addEventListener: (ad, fn) => { dinleyiciler[ad] = fn; } };
  vm.runInNewContext(betik, { document, location, window, URLSearchParams });
  return { govde, location, degistir: h => { location.hash = h; dinleyiciler.hashchange(); } };
}

const hashYap = (ek = {}) => '#' + new URLSearchParams({ key: ANAHTAR, origin: '40.912,29.199', destination: '40.857,29.331', mode: 'driving', ...ek });

test('geçerli parametrelerle Google Embed yol tarifi çizilir', () => {
  const { govde } = calistir(hashYap({ destination: 'place_id:ChIJEe3U8uHbyhQR_75zGX5PEDk' }));
  assert.equal(govde.length, 1);
  const adres = new URL(govde[0].attrs.src);
  assert.equal(adres.origin + adres.pathname, 'https://www.google.com/maps/embed/v1/directions');
  assert.equal(adres.searchParams.get('key'), ANAHTAR);
  assert.equal(adres.searchParams.get('destination'), 'place_id:ChIJEe3U8uHbyhQR_75zGX5PEDk');
  assert.equal(adres.searchParams.get('language'), 'tr');
  assert.equal(govde[0].attrs.referrerpolicy, 'strict-origin-when-cross-origin');
});

test('ulaşım türü değişince aynı çerçeve yeni adrese gider', () => {
  const s = calistir(hashYap());
  s.degistir(hashYap({ mode: 'transit' }));
  assert.equal(s.govde.length, 1);
  assert.equal(new URL(s.govde[0].attrs.src).searchParams.get('mode'), 'transit');
});

test('geçersiz parametrede hiçbir şey çizilmez', () => {
  for (const h of ['', hashYap({ key: 'kotu' }), hashYap({ origin: 'javascript:alert(1)' }),
    hashYap({ destination: 'https://ornek.com' }), hashYap({ mode: 'ucak' }), hashYap({ mode: 'toString' })]) {
    assert.equal(calistir(h).govde.length, 0, h);
  }
});

test('sayfa yalnız Google çerçevesine izin verir ve dizine eklenmez', () => {
  assert.match(sayfa, /default-src 'none'; frame-src https:\/\/www\.google\.com;/);
  assert.match(sayfa, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(sayfa, /innerHTML|document\.write|eval\(/);
});

test('ortak modül bu sayfayı gösterir (ZEKY ile aynı adres)', () => {
  const modul = readFileSync(new URL('../js/zeky-yol.js', import.meta.url), 'utf8');
  assert.match(modul, /IOS_HARITA_CERCEVESI = 'https:\/\/portal\.bircicekkoleji\.com\/okul-yolu-harita\.html'/);
});
