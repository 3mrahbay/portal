// Regression: iPhone Safari'de uzun veli duyuruları sınırlı DOM ile açılmalı.
// Gerçek Firestore ve kişisel veri yerine küçük sahte kayıtlar kullanılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readPortal } from './helpers/portal-pwa.mjs';

const source = readPortal('index.html');
const start = source.indexOf('let veliBildirimRenderSurumu = 0;');
const end = source.indexOf('// ============ VELİ: OKUL HAYATI', start);
assert.ok(start >= 0 && end > start, 'veli duyuru fonksiyonu bulundu');

function fixture(count = 19) {
  let raw = '', list = null, button = null;
  const chunks = [], seen = [];
  const el = {
    isConnected: true,
    set innerHTML(value) {
      raw = value;
      if (value.includes('class="vbd-liste"')) {
        list = { insertAdjacentHTML(where, html) { assert.equal(where, 'beforeend'); chunks.push(html); } };
        button = { removed: false, addEventListener(event, fn) { assert.equal(event, 'click'); this.click = fn; }, remove() { this.removed = true; } };
      } else {
        list = null; button = null;
      }
    },
    get innerHTML() { return raw; },
    querySelector(sel) { return sel === '.vbd-liste' ? list : sel === '.vbd-devam' ? button : null; },
    contains(node) { return !!list && list === node; },
  };
  const docs = Array.from({ length: count }, (_, i) => ({
    id: 'duyuru-' + i,
    data() {
      return {
        baslik: 'Duyuru ' + i, icerik: 'Örnek metin ' + i,
        hedefTur: 'tumOkul', aciliyet: 'normal', arsiv: false,
        olusturuldu: new Date(Date.UTC(2026, 10, 19, 23, 0, 0) - i * 3600000).toISOString()
      };
    }
  }));
  const context = {
    document: { getElementById(id) { assert.equal(id, 'veliBildirimlerContent'); return el; } },
    window: {}, currentUser: { email: 'veli@example.test' }, veliOgrenciler: [],
    db: {}, collection(_db, name) { return name; }, query(ref) { return ref; }, where() { return null; },
    async getDocs(which) {
      if (which === 'krediKartiTalepleri') return { forEach() {} };
      if (which === 'duyurular') return { docs };
      throw Error('Beklenmeyen koleksiyon: ' + which);
    },
    async modulYukle(name) {
      assert.equal(name, 'duyuru-okunma');
      return {
        async veliDurumuYukle() { return { eposta: 'veli@example.test' }; },
        veliOkudu() { return false; },
        veliGorulenleriKaydet(items) { seen.push(items.map(x => x.id)); },
      };
    },
    escapeHtml(value) { return String(value ?? '').replace(/</g, '&lt;'); },
    console,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return { run: () => context.veliRenderBildirimler(), chunks, seen, el, context, button: () => button };
}
const cardCount = chunks => chunks.join('').match(/<article class="vbd-kart"/g)?.length || 0;

test('veli duyuruları ilk açılışta 8 kayıt, ardından 8 ve kalan 3 kayıt olarak gösterir', async () => {
  const f = fixture(19);
  await f.run();
  assert.equal(cardCount(f.chunks), 8);
  assert.equal(f.seen.length, 1);
  assert.equal(f.seen[0].length, 8);
  assert.equal(f.button().removed, false);
  f.button().click();
  assert.equal(cardCount(f.chunks), 16);
  assert.equal(f.seen[1].length, 8);
  f.button().click();
  assert.equal(cardCount(f.chunks), 19);
  assert.equal(f.seen[2].length, 3);
  assert.equal(f.button().removed, true);
  assert.match(f.chunks.join(''), /class="vbd-gun"/);
});

test('hesap değişince eski duyuruların devamı çizilmez', async () => {
  const f = fixture(19);
  await f.run();
  f.context.currentUser.email = 'baska@example.test';
  f.button().click();
  assert.equal(cardCount(f.chunks), 8);
  assert.equal(f.seen.length, 1);
});

test('gösterilmeyen duyurular okundu olarak yazılmaz', async () => {
  const f = fixture(24);
  await f.run();
  assert.equal(f.seen.flat().length, 8);
  assert.equal(new Set(f.seen.flat()).size, 8);
  assert.equal(cardCount(f.chunks), 8);
});
