// BCKA-Medya yetki katmanı: portalın medya istekleri Firebase oturum jetonu taşır,
// veli kapsamındaki fotoğraflar kişiye özel klasöre gider. Ağ ve hesap kullanılmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const part = (a, b) => {
  const start = html.indexOf(a), end = html.indexOf(b, start);
  assert.ok(start >= 0 && end > start, a);
  return html.slice(start, end);
};
const code = part('async function medyaYanitOku(', '// Birden fazla dosyayı sırayla yükle');
const stream = part('async function galeriVideoYukle(', '// Legacy portal-galeri-core.js');

function fixture({ user = { uid: 'uid-a', getIdToken: async () => 'jeton-1' } } = {}) {
  const requests = [], streamCalls = [];
  const c = vm.createContext({
    auth: { currentUser: user }, console: { warn() {}, error() {} }, JSON,
    MEDYA_AYAR: { PROXY_URL: 'https://example.invalid/medya', PAYLASIM_ANAHTARI: 'synthetic' },
    medyaDogrula: () => ({ gecerli: true, tur: 'resim' }),
    medyaDosyaBase64: async () => 'c3ludGhldGlj',
    fetch: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return { status: 200, text: async () => JSON.stringify({ ok: true, url: 'https://cdn.invalid/x', yol: 'k/x' }) };
    },
    streamCalls
  });
  vm.runInContext(code + '\n' + stream.replace(
    'const stream = await import("./js/bunny-stream-upload.js?v=192");',
    'const stream = { bunnyStreamVideoYukle: async (f, o) => { streamCalls.push(o); return o; } };'), c);
  return { c, requests, streamCalls };
}

test('yükleme ve silme istekleri oturum jetonu taşır', async () => {
  const { c, requests } = fixture();
  await c.medyaYukle({ name: 'a.jpg', type: 'image/jpeg' }, 'mesaj/a@x__b@x');
  await c.medyaSil('mesaj/a@x__b@x/1_a.jpg');
  assert.deepEqual(requests.map(r => [r.body.islem, r.body.idToken]), [['yukle', 'jeton-1'], ['sil', 'jeton-1']]);
});

test('oturum yoksa jeton boş gider (geçiş dönemi ortak anahtarla sürer)', async () => {
  const { c, requests } = fixture({ user: null });
  await c.medyaYukle({ name: 'a.jpg', type: 'image/jpeg' }, 'genel');
  assert.equal(requests[0].body.idToken, '');
  assert.equal(requests[0].body.anahtar, 'synthetic');
});

test('Bunny Stream imza isteğine jeton eklenir, çağıranın fetchImpl seçeneği önceliklidir', async () => {
  const { c, requests, streamCalls } = fixture();
  await c.galeriVideoYukle({ name: 'v.mp4' }, {});
  const secenek = streamCalls[0];
  await secenek.fetchImpl('https://example.invalid/medya', { method: 'POST', body: JSON.stringify({ islem: 'stream_hazirla' }) });
  assert.deepEqual(requests[0].body, { islem: 'stream_hazirla', idToken: 'jeton-1' });
  const ozel = async () => {};
  await c.galeriVideoYukle({ name: 'v.mp4' }, { fetchImpl: ozel });
  assert.equal(streamCalls[1].fetchImpl, ozel);
});

test('öğrenci ve veli fotoğrafları kişiye özel klasöre yüklenir', () => {
  assert.equal((html.match(/profilFotoYukle\(dosya, "ogrenciler", ogrenciId, "ogrenci-foto\/" \+ ogrenciId\)/g) || []).length, 2);
  assert.match(html, /profilFotoYukle\(dosya, "veliler", eposta, "veli-foto\/" \+ currentUser\.uid\)/);
  assert.doesNotMatch(html, /profilFotoYukle\([^)]*"(ogrenci|veli)-foto"\)/);
});
