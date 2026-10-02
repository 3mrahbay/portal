import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNotificationNoticeTracker, notificationEventKey, notificationTime, notificationThreadId, notificationLabel, notificationStatus } from '../js/portal-bildirim-merkezi.js';

const email = 'Auth.User@example.test';
const record = (id = 'n1', extra = {}) => ({ id, aliciEmail: email, tip: 'duyuru', okundu: false, olusturuldu: '2026-09-30T10:00:00Z', ...extra });

test('source keys deduplicate duplicate documents and source timestamps accept ISO/Firestore', () => {
  assert.equal(notificationEventKey(record('a', { olayAnahtari: 'event', kaynakId: 'source' })), 'olay:event');
  assert.equal(notificationEventKey(record('a', { kaynakId: 'source' })), notificationEventKey(record('b', { kaynakId: 'source' })));
  assert.notEqual(notificationEventKey(record('a')), notificationEventKey(record('b')));
  assert.notEqual(notificationEventKey(record('a', { _source: 'one' })), notificationEventKey(record('a', { _source: 'two' })));
  const iso = '2026-09-30T10:00:00Z', ms = Date.parse(iso);
  for (const value of [iso, new Date(ms), { toMillis: () => ms }, { seconds: ms / 1000, nanoseconds: 0 }]) assert.equal(notificationTime(value), ms);
  for (const value of [null, {}, 'bad', { seconds: 1, nanoseconds: -1 }, { toMillis() { throw Error('bad'); } }, { toMillis: () => 1e30 }]) assert.equal(notificationTime(value), 0);
});

test('cache and initial server records are quiet; new logical events fire once, never on read updates', () => {
  const t = createNotificationNoticeTracker();
  assert.deepEqual(t.update([], { fromCache: true }), []);
  assert.deepEqual(t.update([record('cached')], { fromCache: true }), []);
  assert.deepEqual(t.update([record('old-server')]), []);
  assert.equal(t.ready, true);
  const fresh = record('fresh', { kaynakId: 'announcement' });
  assert.deepEqual(t.update([fresh]), [fresh]);
  assert.deepEqual(t.update([record('copy', { kaynakId: 'announcement' })]), []);
  assert.deepEqual(t.update([record('fresh', { kaynakId: 'announcement', okundu: true })]), []);
  assert.deepEqual(t.update([]), []);
  assert.deepEqual(t.update([fresh]), []);
  const pending = record('pending', { _pendingWrites: true });
  assert.deepEqual(t.update([pending]), []);
  assert.equal(t.update([record('pending')]).length, 1);
  const cacheOnly = record('offline');
  assert.deepEqual(t.update([cacheOnly], { fromCache: true }), []);
  assert.deepEqual(t.update([cacheOnly]), [cacheOnly]);
  t.reset(); assert.equal(t.ready, false); assert.deepEqual(t.update([record('reset')]), []);
});

test('explicit external initial loads are quiet and already-read events never replay', () => {
  const t = createNotificationNoticeTracker(); t.update([]);
  assert.deepEqual(t.update([record('initial')], { initial: true }), []);
  assert.deepEqual(t.update([record('read', { okundu: true })]), []);
  assert.deepEqual(t.update([record('read')]), []);
  assert.deepEqual(t.update(null), []);
});

test('legacy message thread parser accepts only the known local chat path', () => {
  assert.equal(notificationThreadId(record('m', { tip: 'mesaj', kaynakId: 'thread-source' })), 'thread-source');
  for (const hedefSayfa of ['sohbet.html?thread=thread-a', './sohbet.html?thread=thread-a', '/sohbet.html?thread=thread-a&x=1']) assert.equal(notificationThreadId({ tip: 'mesaj', hedefSayfa }), 'thread-a');
  for (const hedefSayfa of ['https://evil.test/sohbet.html?thread=a', '//evil.test/sohbet.html?thread=a', 'javascript:alert(1)', 'other.html?thread=a', 'sohbet.html?thread=a&thread=b', 'sohbet.html?thread=a%2Fb', 'sohbet.html?thread=']) assert.equal(notificationThreadId({ tip: 'mesaj', hedefSayfa }), '');
  assert.equal(notificationThreadId(record('x', { kaynakId: 'not-message' })), '');
  assert.equal(notificationLabel({ tip: '<img onerror=bad>' }), 'Bildirim');
});

class Element {
  constructor(tag, document) { this.tagName = tag; this.document = document; this.children = []; this.attributes = {}; this.listeners = {}; this.className = ''; this.text = ''; this.hidden = false; this.disabled = false; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  get classList() { return { add: value => { this.className += ` ${value}`; } }; }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) { node.parent = this; this.children.push(node); return node; }
  prepend(node) { node.parent = this; this.children.unshift(node); }
  replaceChildren(...nodes) { this.children.forEach(node => { node.parent = null; }); this.children = []; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  contains(target) { return target === this || this.children.some(node => node.contains(target)); }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  removeEventListener(type, callback) { this.listeners[type] = (this.listeners[type] || []).filter(fn => fn !== callback); }
  emit(type, event = {}) { for (const callback of this.listeners[type] || []) callback(event); }
  focus() { this.document.activeElement = this; }
  get isConnected() { return this === this.document.body || !!this.parent?.isConnected; }
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const byClass = (node, name) => descendants(node).filter(child => child.className.split(' ').includes(name));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let sequence = 0;
async function environment(run, options = {}) {
  const old = { document: globalThis.document, window: globalThis.window, setTimeout, clearTimeout };
  const listeners = {}, events = {}, timers = new Map(), audio = { contexts: [], sounds: [] }; let timer = 0;
  const document = { activeElement: null, visibilityState: 'visible',
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter(item => item !== fn); },
    emit(type, event) { for (const fn of listeners[type] || []) fn(event); },
    createElement(tag) { return new Element(tag, document); },
    getElementById(id) { return [...descendants(document.head), ...descendants(document.body)].find(node => node.id === id); }
  };
  document.body = new Element('body', document); document.head = new Element('head', document);
  const window = { navigator: { userActivation: { hasBeenActive: false } },
    addEventListener(type, fn) { (events[type] ||= []).push(fn); },
    AudioContext: class {
      constructor() { this.state = 'suspended'; this.currentTime = 1; audio.contexts.push(this); }
      resume() { this.state = 'running'; return Promise.resolve(); }
      createOscillator() { const node = { frequency: {}, connect() {}, disconnect() {}, start() {}, stop() {} }; audio.sounds.push(node); return node; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    }
  };
  Object.assign(globalThis, { document, window, setTimeout(fn) { timers.set(++timer, fn); return timer; }, clearTimeout(id) { timers.delete(id); } });
  const helperURL = new URL(`../js/portal-mesaj-bildirim.js?center=${++sequence}`, import.meta.url).href;
  const source = (await readFile(new URL('../js/portal-bildirim-merkezi.js', import.meta.url), 'utf8')).replace("'./portal-mesaj-bildirim.js?v=164'", JSON.stringify(helperURL)).replace("'./portal-bildirim-yerlesim.js?v=165'", JSON.stringify(new URL('../js/portal-bildirim-yerlesim.js', import.meta.url).href)).replace("'./portal-bildirim-basliklari.js?v=165'", JSON.stringify(new URL('../js/portal-bildirim-basliklari.js', import.meta.url).href));
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const helper = await import(helperURL);
  const subscriptions = [], writes = [], navigations = [], reads = [];
  let write = () => Promise.resolve(), read = () => Promise.resolve({exists:()=>false}), currentEmail = email;
  window.PortalAPI = {state: options.portalState || {currentUser:{email}}};
  const fb = { collection: (_db, ...parts) => parts.join('/'), where: (...parts) => parts, query: (...parts) => parts,
    doc: (_db, ...parts) => parts.join('/'),
    getDoc(path) { reads.push(path); return read(path); },
    updateDoc(path, patch) { writes.push({ path, patch }); return write(path, patch); },
    onSnapshot(query, metadata, next, error) { const sub = { query, metadata, next, error, stopped: false }; subscriptions.push(sub); return () => { sub.stopped = true; }; }
  };
  const center = module.startNotificationCenter({ fb, db: {}, email, getCurrentEmail: () => currentEmail, navigate: item => { navigations.push(item); }, ...options });
  const feed = (items, metadata = {}) => subscriptions[0].next({ metadata, forEach(fn) { items.forEach(item => fn({ id: item.id, data: () => item, metadata: { hasPendingWrites: !!item._pendingWrites } })); } });
  try { await run({ center, feed, document, events, audio, subscriptions, writes, navigations, timers, helper,
    writer: fn => { write = fn; }, changeAccount: value => { currentEmail = value; },
    reads, reader: fn => { read = fn; }, window, nodes: name => byClass(document.body, name), tick: flush }); }
  finally {
    center.stop(); helper.clearMessageNotices(); helper.clearPortalNotices();
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}

test('query is exact authenticated recipient only with metadata; mismatched recipients never hydrate', async () => {
  await environment(({ subscriptions, feed, center, writes }) => {
    assert.deepEqual(subscriptions[0].query, ['bildirimler', ['aliciEmail', '==', email]]);
    assert.deepEqual(subscriptions[0].metadata, { includeMetadataChanges: true });
    feed([record('mine'), record('other', { aliciEmail: 'someone@example.test' })]);
    assert.equal(center.ready, true); assert.equal(center.getState().unreadCount, 1); assert.equal(center.getState().items[0].id, 'mine');
    assert.equal(writes.length, 0);
  });
});

test('history is counted quietly; bell, close and Escape never mark anything read', async () => {
  await environment(({ feed, center, nodes, document, writes, audio }) => {
    feed([], { fromCache: true }); feed([record('history')], { fromCache: true });
    assert.equal(center.ready, false); feed([record('history'), record('server-history')]);
    assert.equal(nodes('pmb-kart').length, 0); assert.equal(audio.sounds.length, 0);
    const bell = nodes('pbm-zil')[0]; bell.focus(); bell.emit('click');
    assert.equal(center.getState().open, true); assert.equal(bell.getAttribute('aria-expanded'), 'true');
    assert.match(bell.getAttribute('aria-label'), /2 okunmamış/);
    assert.equal(nodes('pbm-satir').length, 2);
    document.emit('keydown', { key: 'Escape', preventDefault() {} });
    assert.equal(center.getState().open, false); assert.equal(document.activeElement, bell);
    bell.emit('click'); nodes('pbm-kapat')[0].emit('click');
    assert.equal(center.getState().unreadCount, 2); assert.equal(writes.length, 0);
  });
});

test('new non-message events show one generic alert; payload, student name and URLs never enter UI', async () => {
  await environment(({ feed, nodes, writes, center }) => {
    feed([]);
    const item = record('private', { baslik: 'STUDENT NAME', metin: 'SECRET BODY', ogrenciAd: 'PRIVATE CHILD', hedefSayfa: 'javascript:alert(1)' });
    feed([item]); assert.equal(nodes('pmb-kart').length, 1);
    const card = nodes('pmb-kart')[0]; assert.match(card.textContent, /Duyuru/);
    for (const secret of ['STUDENT NAME', 'SECRET BODY', 'PRIVATE CHILD', 'javascript:', email]) assert.ok(!card.textContent.includes(secret));
    assert.ok(!nodes('pbm-panel')[0].textContent.includes('SECRET BODY'));
    nodes('pmb-ac')[0].emit('click'); assert.equal(center.getState().open, true); assert.equal(writes.length, 0);
    feed([item]); assert.equal(nodes('pmb-kart').length, 0);
    feed([item, record('message', { tip: 'mesaj', kaynakId: 'chat-1' })]);
    assert.equal(center.getState().unreadCount, 2); assert.equal(nodes('pmb-kart').length, 0);
  });
});

test('same logical event has one unread row and all duplicate root documents are read deliberately', async () => {
  await environment(async ({ feed, center, writes }) => {
    feed([record('a', { olayAnahtari: 'shared' }), record('b', { olayAnahtari: 'shared' })]);
    assert.equal(center.getState().unreadCount, 1); assert.equal(center.getState().itemCount, 1);
    assert.equal(await center.markRead('a'), true); assert.equal(writes.length, 2);
    assert.equal(center.getState().unreadCount, 0);
    assert.deepEqual(writes.map(item => item.patch), [{ okundu: true }, { okundu: true }]);
  });
});

test('pending read is not optimistic; failure stays visible, count unchanged, retry can succeed and route', async () => {
  await environment(async ({ feed, center, writer, writes, nodes, tick, navigations }) => {
    const item = record('read'); feed([item]); center.open();
    const wait = deferred(); writer(() => wait.promise);
    nodes('pbm-satir')[0].emit('click');
    feed([{ ...item, okundu: true, _pendingWrites: true }], { fromCache: true });
    assert.equal(center.getState().unreadCount, 1); assert.equal(nodes('pbm-satir')[0].disabled, true);
    wait.reject(Error('permission-denied')); await tick();
    assert.equal(center.getState().unreadCount, 1); assert.match(nodes('pbm-durum')[0].textContent, /kaydedilemedi/);
    feed([{ ...item, okundu: true, _pendingWrites: true }], { fromCache: true });
    assert.equal(center.getState().unreadCount, 1);
    assert.equal(navigations.length, 0); assert.equal(center.getState().open, true);
    writer(() => Promise.resolve()); nodes('pbm-satir')[0].emit('click'); await tick();
    assert.equal(writes.length, 2); assert.equal(center.getState().unreadCount, 0);
    assert.equal(navigations[0].id, item.id); assert.equal(center.getState().open, false);
  });
});

test('new event reusing a document id is unread after its previous event was read', async () => {
  await environment(async ({ feed, center, nodes }) => {
    feed([record('same', { olayAnahtari: 'old-event' })]); await center.markRead('same');
    feed([record('same', { olayAnahtari: 'new-event' })]);
    assert.equal(center.getState().unreadCount, 1); assert.equal(nodes('pmb-kart').length, 1);
  });
});

test('thread-read touches only loaded matching message records, supports safe legacy path and never fetches child data', async () => {
  const callbacks = [];
  await environment(async ({ feed, center, writes }) => {
    feed([record('a', { tip: 'mesaj', kaynakId: 'chat' }), record('b', { tip: 'mesaj', hedefSayfa: 'sohbet.html?thread=chat' }),
      record('wrong', { tip: 'mesaj', kaynakId: 'another' }), record('evil', { tip: 'mesaj', hedefSayfa: 'https://evil.test/sohbet.html?thread=chat' }), record('not-message', { kaynakId: 'chat' })]);
    assert.equal(await center.markThreadRead('chat'), true);
    assert.deepEqual(writes.map(item => item.path), ['bildirimler/a', 'bildirimler/b']);
    assert.equal(center.getState().unreadCount, 3); assert.deepEqual(callbacks, ['chat']);
  }, { onMessageRead: id => callbacks.push(id) });
});

test('dynamic ownership suppresses only handled root types; other operational records still alert', async () => {
  let own = false;
  await environment(({ feed, center, nodes, helper }) => {
    feed([]);
    feed([record('morning', { tip: 'sabah_geliyorum' })]); assert.equal(nodes('pmb-kart').length, 1);
    helper.clearPortalNotices(); own = true; center.ownedTypes.add('sabah_geliyorum'); center.refresh();
    assert.equal(center.getState().unreadCount, 0); assert.equal(center.getState().itemCount, 0);
    feed([record('morning2', { tip: 'sabah_geliyorum' })]); assert.equal(nodes('pmb-kart').length, 0);
    feed([record('morning2', { tip: 'sabah_geliyorum' }), record('pickup', { tip: 'okul_zili' })]);
    assert.equal(nodes('pmb-kart').length, 1); assert.equal(center.getState().unreadCount, 1);
  }, { suppressAlert: item => own && item.tip === 'sabah_geliyorum', excludeFromCount: item => own && item.tip === 'sabah_geliyorum' });
});

test('urgent-flow and user-preference suppression preserves unread history; hidden page consumes alert without replay', async () => {
  await environment(({ feed, center, document, nodes }) => {
    feed([]); feed([record('silent', { sessizUyari: true })]); assert.equal(nodes('pmb-kart').length, 0);
    document.visibilityState = 'hidden'; feed([record('silent', { sessizUyari: true }), record('hidden')]);
    document.visibilityState = 'visible'; feed([record('silent', { sessizUyari: true }), record('hidden')]);
    assert.equal(nodes('pmb-kart').length, 0); assert.equal(center.getState().unreadCount, 2);
  });
});

test('external sources baseline cache/server quietly and only new source records alert', async () => {
  await environment(({ feed, center, nodes }) => {
    feed([]);
    center.setExternalItems('source', [], { fromCache: true });
    center.setExternalItems('source', [record('old-cache')], { fromCache: true });
    center.setExternalItems('source', [record('old-server')]);
    assert.equal(nodes('pmb-kart').length, 0);
    center.setExternalItems('source', [record('old-server'), record('new', { tip: 'egitim_gelisim' })]);
    assert.equal(nodes('pmb-kart').length, 1); assert.match(nodes('pmb-kart')[0].textContent, /Kazanım/);
    assert.equal(center.getState().unreadCount, 2);
    center.setExternalItems('source2', [record('new')]); assert.equal(center.getState().unreadCount, 3);
  });
});

test('external onRead failures preserve count; read-only adapter opening never invents persistence', async () => {
  await environment(async ({ feed, center, writes, nodes, tick }) => {
    feed([]); let opened = 0, read = 0;
    center.setExternalItems('safe', [record('external', { onRead: async () => { read++; throw Error('failed'); }, onOpen: () => opened++ })]);
    assert.equal(await center.markRead('external'), false); assert.equal(center.getState().unreadCount, 1); assert.equal(read, 1);
    center.setExternalItems('safe', [record('external', { onOpen: () => opened++ })]);
    center.open(); nodes('pbm-satir')[0].emit('click'); await tick();
    assert.equal(opened, 1); assert.equal(center.getState().unreadCount, 1); assert.equal(writes.length, 0);
    center.setExternalItems('safe', [record('external', { onRead: async () => true })]);
    assert.equal(await center.markRead('external'), true); assert.equal(center.getState().unreadCount, 0);
  });
});

test('stop rejects late snapshots, errors, adapters and pending navigation; clears only its own generic notice', async () => {
  await environment(async ({ feed, center, nodes, writer, navigations, tick, subscriptions, helper }) => {
    feed([]); feed([record('new')]); helper.showMessageNotice({ id: 'unrelated-chat' });
    assert.equal(nodes('pmb-kart').length, 2);
    const wait = deferred(); writer(() => wait.promise); center.open(); nodes('pbm-satir')[0].emit('click');
    center.stop(); center.stop(); assert.equal(subscriptions[0].stopped, true);
    assert.equal(nodes('pbm-zil').length, 0); assert.equal(nodes('pmb-kart').length, 1);
    feed([record('late')]); subscriptions[0].error(Error('late'));
    center.setExternalItems('late', [record('late')]); wait.resolve(); await tick();
    assert.equal(navigations.length, 0); assert.equal(center.ready, false); assert.equal(center.getState().unreadCount, 0);
  });
});

test('account mismatch rejects late callbacks and deliberate writes', async () => {
  await environment(async ({ feed, center, changeAccount, writes, nodes }) => {
    feed([record('old')]); changeAccount('next@example.test'); feed([record('late')]);
    assert.equal(center.ready, false); assert.equal(await center.markRead('old'), false);
    assert.equal(writes.length, 0); assert.equal(nodes('pmb-kart').length, 0);
  });
});

test('subscription error is visible and status is not falsely ready', async () => {
  await environment(({ subscriptions, center, nodes, feed }) => {
    feed([record('one')]); subscriptions[0].error(Error('permission-denied'));
    assert.equal(center.status, 'error'); assert.equal(center.ready, false);
    assert.match(nodes('pbm-durum')[0].textContent, /alınamadı/);
    feed([record('late')]); assert.equal(center.getState().items[0].id, 'one');
  });
});

test('all notice kinds share the interaction-gated sound throttle and silent notice has no queued sound', async () => {
  await environment(({ feed, events, audio, helper }) => {
    feed([]); feed([record('first')]); assert.equal(audio.contexts.length, 0);
    events.pointerdown[0](); assert.equal(audio.sounds.length, 0);
    feed([record('first'), record('second', { tip: 'etkinlik' })]); assert.equal(audio.sounds.length, 2);
    helper.showMessageNotice({ id: 'message' }); assert.equal(audio.sounds.length, 2);
    audio.contexts[0].currentTime += 1;
    feed([record('first'), record('second', { tip: 'etkinlik' }), record('silent', { sessizUyari: true })]);
    assert.equal(audio.sounds.length, 2);
    helper.showMessageNotice({ id: 'message-next' }); assert.equal(audio.sounds.length, 4);
  });
});


test('existing producer categories have safe Turkish labels', () => {
  for (const tip of ['pickup-yeni', 'pickup-kapida', 'pickup-hazir', 'pickup-hazir-personel', 'pickup-teslim']) assert.equal(notificationLabel({ tip }), 'Okul zili');
  for (const tip of ['sabah-yeni', 'sabah-onay']) assert.equal(notificationLabel({ tip }), 'Sabah gelişi');
  for (const tip of ['randevu-yeni', 'randevu_talep']) assert.equal(notificationLabel({ tip }), 'Randevu');
  for (const tip of ['galeri_guncelleme', 'galeri_onay']) assert.equal(notificationLabel({ tip }), 'Galeri');
  for (const tip of ['izin_talep', 'izin_sonuc']) assert.equal(notificationLabel({ tip }), 'İzin');
  for (const tip of ['odeme_bildirim', 'odeme_hatirlatma']) assert.equal(notificationLabel({ tip }), 'Ödeme');
  assert.equal(notificationLabel({ tip: 'gorusme_notu' }), 'Görüşme');
});

test('center and main page share the exact same versioned helper module and cache dependency', async () => {
  const [center, index, sw] = await Promise.all(['../js/portal-bildirim-merkezi.js', '../index.html', '../serviceworker.js'].map(path => readFile(new URL(path, import.meta.url), 'utf8')));
  const dependency = center.match(/from ['"]\.\/(portal-mesaj-bildirim\.js[^'"]*)['"]/)[1];
  assert.ok(index.includes(`./js/${dependency}`)); assert.ok(sw.includes(`./js/${dependency}`));
});


test('restarting the message receiver leaves generic center alerts intact', async () => {
  await environment(({ feed, helper, nodes }) => {
    feed([]); feed([record('center')]); helper.showMessageNotice({ id: 'message' });
    assert.equal(nodes('pmb-kart').length, 2); helper.clearMessageNotices();
    assert.equal(nodes('pmb-kart').length, 1); assert.match(nodes('pmb-kart')[0].textContent, /Duyuru/);
    helper.showMessageNotice({ id: 'message' }); helper.clearPortalNotices();
    assert.equal(nodes('pmb-kart').length, 1); assert.match(nodes('pmb-kart')[0].textContent, /Yeni mesaj/);
  });
});

test('automatic thread-read failures do not retry on a rollback snapshot or UI refresh; deliberate retry works', async () => {
  await environment(async ({feed,center,writer,writes}) => {
    const item=record('chat-read',{tip:'mesaj',kaynakId:'thread-failure'});feed([item]);
    writer(async()=>{throw Error('permission-denied');});
    assert.equal(await center.markThreadRead('thread-failure'),false);assert.equal(writes.length,1);
    feed([item]);center.refresh();await center.markThreadRead('thread-failure');assert.equal(writes.length,1);
    assert.equal(center.getState().unreadCount,1);
    writer(async()=>{});assert.equal(await center.markRead('chat-read'),true);assert.equal(writes.length,2);
  });
});


test('authenticated list shows full plain-text titles while toast stays generic', async () => {
  await environment(({ feed, center, nodes }) => {
    feed([]);
    const title = 'Sonbahar gezisi ve aile atölyesi '.repeat(12) + '<img src=x onerror=bad>';
    feed([record('event-title', { tip:'etkinlik', baslik:title }), record('sender-title', {tip:'mesaj',baslik:'Yeni mesaj · Deniz Örnek',metin:'MESSAGE BODY'})]);
    center.open();
    const rows=nodes('pbm-satir');
    assert.ok(rows.some(row=>row.textContent.includes(title)));
    assert.ok(rows.some(row=>row.textContent.includes('Deniz Örnek')));
    assert.ok(rows.every(row=>!row.textContent.includes('MESSAGE BODY')));
    const strong=nodes('pbm-metin').flatMap(node=>node.children).filter(node=>node.tagName==='strong');
    assert.ok(strong.every(node=>node.children.length===0));
    const toast=nodes('pmb-kart')[0];assert.ok(toast && !toast.textContent.includes(title));
    assert.equal(center.getState().unreadCount,2);
  });
});

test('historic sender lookup starts only on open; repeated open is cached and never marks read or alerts', async () => {
  await environment(async ({ feed, center, nodes, reads, reader, tick, writes, audio }) => {
    reader(async ()=>({exists:()=>true,data:()=>({katilimcilar:[email.toLowerCase(),'sender@example.test'],katilimciBilgi:{'sender@example.test':{ad:'Aylin Yılmaz'}}})}));
    feed([record('old-message',{tip:'mesaj',baslik:'Yeni mesaj',kaynakId:'chat-old'})]);
    await tick(); assert.equal(reads.length,0);
    center.open(); await tick();
    assert.deepEqual(reads,['mesajlar/chat-old']);
    assert.match(nodes('pbm-satir')[0].textContent,/Aylin Yılmaz/);
    center.close();center.open();await tick();assert.equal(reads.length,1);
    assert.equal(center.getState().unreadCount,1);assert.equal(writes.length,0);assert.equal(audio.sounds.length,0);
  });
});


test('notification status uses explicit urgency and read state, never title keywords or popup flags', () => {
  assert.deepEqual(notificationStatus({}),{state:'unread',label:'● Yeni'});
  assert.deepEqual(notificationStatus({okundu:true}),{state:'read',label:'✓ Okundu'});
  for (const note of [{aciliyet:'acil'},{acil:true},{aciliyet:' ACİL '}]) {
    assert.deepEqual(notificationStatus(note),{state:'urgent',label:'! Acil · Yeni'});
    assert.deepEqual(notificationStatus({...note,okundu:true}),{state:'urgent',label:'! Acil · Okundu'});
  }
  for (const note of [{baslik:'Acil haber',metin:'urgent emergency'},{tip:'simsek',simsek:true},{aciliyet:'onemli'},{acil:'true'},{acil:{telefon:'private'}},{oncelik:'urgent'}]) assert.equal(notificationStatus(note).state,'unread');
});

test('unread yellow becomes read green only after success; urgent stays red with explicit read label', async () => {
  await environment(async ({feed,center,nodes,writer,tick}) => {
    feed([record('normal'),record('urgent',{aciliyet:'acil'})]);
    const byTitle = id => nodes('pbm-satir').find(row=>row.getAttribute('data-state')===id);
    assert.equal(byTitle('unread').getAttribute('data-unread'),'true');
    assert.match(byTitle('urgent').textContent,/Acil · Yeni/);
    const pending=deferred();writer(()=>pending.promise);
    const mark=center.markRead('normal');assert.ok(byTitle('unread'));pending.resolve();await mark;await tick();
    assert.match(byTitle('read').textContent,/✓ Okundu/);
    writer(()=>Promise.resolve());await center.markRead('urgent');await tick();
    assert.match(byTitle('urgent').textContent,/Acil · Okundu/);assert.equal(byTitle('urgent').getAttribute('data-unread'),'false');
    assert.match(byTitle('urgent').getAttribute('aria-label'),/acil, okundu/);
  });
});

test('failed read remains yellow, and duplicate urgent mirror is red without changing group count', async () => {
  await environment(async ({feed,center,nodes,writer}) => {
    feed([record('failure')]);writer(()=>Promise.reject(Error('denied')));
    assert.equal(await center.markRead('failure'),false);assert.equal(nodes('pbm-satir')[0].getAttribute('data-state'),'unread');
    feed([record('one',{olayAnahtari:'same',okundu:true}),record('two',{olayAnahtari:'same',acil:true})]);
    assert.equal(center.getState().itemCount,1);assert.equal(center.getState().unreadCount,1);
    assert.equal(nodes('pbm-satir')[0].getAttribute('data-state'),'urgent');
  });
});

test('urgency from the existing authorized title read updates row styling without extra queries or alerts', async () => {
  await environment(async ({feed,center,nodes,reader,reads,tick,writes,audio}) => {
    reader(async()=>({exists:()=>true,data:()=>({baslik:'Yeni okul duyurusu',aciliyet:'acil',hedefTur:'tumOkul'})}));
    feed([record('old-urgent',{baslik:'Yeni okul duyurusu',kaynakId:'source'})]);
    assert.equal(reads.length,0);assert.equal(nodes('pbm-satir')[0].getAttribute('data-state'),'unread');
    center.open();await tick();assert.deepEqual(reads,['duyurular/source']);
    assert.equal(nodes('pbm-satir')[0].getAttribute('data-state'),'urgent');
    assert.match(nodes('pbm-satir')[0].textContent,/Acil · Yeni/);
    center.close();center.open();await tick();assert.equal(reads.length,1);assert.equal(writes.length,0);assert.equal(audio.sounds.length,0);
  },{portalState:{currentUser:{email},isAdmin:true}});
});

test('yellow green and red status palettes retain readable status and body text',async()=>{
  const source=await readFile(new URL('../js/portal-bildirim-merkezi.js',import.meta.url),'utf8');
  const lum=hex=>{const rgb=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  for(const [state,bg,hover,ink] of [['unread','#fffbeb','#fef3c7','#713f12'],['read','#f0fdf4','#dcfce7','#166534'],['urgent','#fff1f2','#ffe4e6','#9f1239']]){
    assert.ok(source.includes(`data-state="${state}"]{background:${bg}`));
    for(const surface of [bg,hover])for(const color of [ink,'#202944','#4b5563'])assert.ok(ratio(color,surface)>=4.5,`${state} ${color} contrast`);
  }
});
