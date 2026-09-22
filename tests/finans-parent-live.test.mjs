import test from 'node:test';
import assert from 'node:assert/strict';
import {veliEkrani} from '../js/finans/parent.js';

test('live payment updates preserve the screen and refresh only on user action', async () => {
  const nodes = new Map();
  let renders = 0, reads = 0;
  const root = {
    classList: {add() {}}, isConnected: true,
    set innerHTML(value) { renders++; this.html = value; nodes.clear(); },
    querySelector(selector) {
      if (selector === 'dialog[open]') return null;
      if (!nodes.has(selector)) nodes.set(selector, {textContent: '', value: ''});
      return nodes.get(selector);
    },
    querySelectorAll() { return []; }
  };
  const listeners = [];
  const data = {aidatAyarlari: {}, aylikOdemeler: {}};
  const snapshot = (value, fromCache = false) => ({exists: () => true, data: () => value, metadata: {fromCache}});
  const fb = {
    doc: (...args) => args, collection: (...args) => args,
    query: (...args) => args, where: (...args) => args,
    getDoc: async () => { reads++; return snapshot(data); },
    getDocs: async () => ({docs: []}),
    onSnapshot(ref, callback) {
      const listener = {callback, active: true}; listeners.push(listener);
      return () => { listener.active = false; };
    }
  };
  await veliEkrani(root, {fb, db: {}, email: 'parent@example.test', donem: '2026-2027', ogrenciler: [{id: 'child'}]});
  const initialRenders = renders;
  const refresh = root.querySelector('#refresh');
  const filter = root.querySelector('#filter'); filter.value = 'open';
  for (let i = 0; i < 8; i++) {
    listeners[0].callback(snapshot({old: true}, true));
    listeners[1].callback({docs: [{id: 'cached', data: () => ({durum: 'bekliyor'})}], metadata: {fromCache: true}});
  }
  assert.equal(refresh.textContent, '');
  listeners[0].callback(snapshot({...data, changed: true}));
  assert.match(refresh.textContent, /Yeni ödeme durumu/);
  listeners[1].callback({docs: [{id: 'new', data: () => ({durum: 'onaylandi'})}], metadata: {fromCache: false}});
  assert.match(refresh.textContent, /Yeni bildirim durumu/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 1, 'snapshots must not start a read/resubscribe loop');
  assert.equal(renders, initialRenders, 'updates must not replace the visible payment screen');
  assert.equal(root.querySelector('#filter').value, 'open');
  await refresh.onclick();
  assert.equal(reads, 2);
  assert.equal(listeners.filter(l => l.active).length, 2);
  assert.ok(listeners.slice(0, 2).every(l => !l.active));
  root._financeUnsubscribe();
});
