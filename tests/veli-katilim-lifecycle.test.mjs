import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../moduller/veli-katilim.js', import.meta.url), 'utf8').replace(/export\s+/g, '');
const EPOSTA = 'parent@example.invalid';
const key = `vk-son:${EPOSTA}`;
const MINUTE = 60_000;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(overrides = {}, options = {}) {
  let now = 1_800_000_000_000, nextTimer = 1;
  const state = {
    currentUser: { uid: 'parent-a', email: ' Parent@Example.Invalid ', providerData: [] },
    rol: null, isAdmin: false, personel: null, galeriVeliUid: 'parent-a', galeriOturumSurumu: 3,
    aktifDonem: '2026-2027', veliOgrenciler: [{ id: 'child-a' }, { id: 'child-b' }],
    ogrenciList: [], ayarListesi: {}, ...overrides
  };
  const timers = new Map(), listeners = new Map(), storage = new Map(options.storage || []);
  const calls = { batches: [], presence: [], reads: [], warnings: [], toasts: [], unsubscribed: [], navigation: [] };
  const subscribers = [];
  let batchAction = async () => {}, presenceAction = async () => {}, readsAction = async () => ({ empty: true, docs: [] });
  const root = { innerHTML: '', isConnected: true, offsetParent: {}, querySelectorAll: () => [], contains: () => false };
  const document = {
    visibilityState: 'visible', activeElement: null,
    getElementById: id => id === 'panel' ? root : id === 'veliKatilimStil' ? {} : null,
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    body: { style: {}, appendChild() {} }, head: { appendChild() {} },
    createElement() { throw Error('Unexpected DOM creation'); }
  };
  const fb = {
    doc: (_, ...path) => path.join('/'), collection: (_, name) => name,
    query: (collection, ...filters) => ({ collection, filters }),
    where: (...args) => args, orderBy: (...args) => args, limit: n => n, documentId: () => '__name__',
    serverTimestamp: () => ({ operation: 'serverTimestamp' }), increment: n => ({ operation: 'increment', n }),
    writeBatch() {
      const writes = [];
      return { set: (ref, data, options) => writes.push({ ref, data, options }), delete: ref => writes.push({ delete: ref }),
        commit: async () => { calls.batches.push(writes); await batchAction(writes); } };
    },
    setDoc: async (ref, data, options) => { const write = { ref, data, options }; calls.presence.push(write); await presenceAction(write); },
    getDocs: async query => { calls.reads.push(query); return readsAction(query); },
    onSnapshot(query, next, error) { const subscription = { query, next, error }; subscribers.push(subscription); return () => calls.unsubscribed.push(subscription); }
  };
  const originals = {};
  const window = { PortalAPI: { get state() { return state; }, db: {}, fb,
    toast: (...args) => calls.toasts.push(args), lucide() {}, ogrenciDurum: () => 'aktif' } };
  for (const name of ['caGo', 'veliSwitchTab', 'modulSec']) {
    const fn = function (...args) { calls.navigation.push({ name, args, context: this }); return name + ':result'; };
    fn.otherBridge = 'preserved'; window[name] = originals[name] = fn;
  }
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const c = { window, document, navigator: { userAgent: options.userAgent || 'iPhone' }, Date: FakeDate,
    localStorage: { getItem(k) { if (options.storageBlocked) throw Error('blocked'); return storage.get(k) ?? null; },
      setItem(k, v) { if (options.storageBlocked) throw Error('blocked'); storage.set(k, v); } },
    setInterval(fn, ms) { const id = nextTimer++; timers.set(id, { fn, ms, due: now + ms, interval: true }); return id; },
    clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id),
    setTimeout(fn, ms) { const id = nextTimer++; timers.set(id, { fn, ms, due: now + ms }); return id; },
    console: { warn: (...args) => calls.warnings.push(args) }
  };
  vm.runInNewContext(source, c);
  const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
  return { state, fb, window, document, root, originals, calls, storage, timers, listeners, subscribers, api: window.veliKatilim,
    flush, now: () => now, elapse: ms => { now += ms; },
    batch: action => { batchAction = action; }, presence: action => { presenceAction = action; }, reads: action => { readsAction = action; },
    async fire(name) { for (const fn of [...(listeners.get(name) || [])]) fn(); await flush(); },
    async tick(ms) { now += ms; for (const [id, timer] of [...timers]) { if (timer.due > now) continue; if (timer.interval) timer.due = now + timer.ms; else timers.delete(id); timer.fn(); } await flush(); },
    async go(screen, method = 'caGo') { const result = window[method](screen); await flush(); return result; },
    switchUser(uid = 'parent-b', email = 'second@example.invalid') {
      state.currentUser = { uid, email }; state.galeriVeliUid = uid; state.galeriOturumSurumu++;
      state.veliOgrenciler = [{ id: 'second-child' }];
    }
  };
}
const feeds = f => f.calls.batches.flat().filter(w => w.ref?.startsWith('veliKatilimAkisi/'));
const logins = f => feeds(f).filter(w => w.data.tur === 'giris');
const screens = f => feeds(f).filter(w => w.data.tur === 'ekran');

// All Firestore calls in this suite are in-memory mocks, with synthetic actors only.
test('verified null-role and legacy explicit parent contracts both write one login', async () => {
  for (const legacy of [false, true]) {
    const f = fixture(legacy ? { rol: 'veli' } : {});
    if (legacy) delete f.state.galeriVeliUid;
    assert.equal(await f.api.veliBaslat(), true);
    assert.equal(logins(f).length, 1);
    assert.equal(f.calls.reads.length, 0);
  }
});

test('login preserves actor, server time, exact summary/feed schema and assigned children only', async () => {
  const f = fixture({ veliOgrenciler: [{ id: 'child-a', privateNote: 'PRIVATE' }, { id: 'child-a' }, ...Array.from({ length: 12 }, (_, n) => ({ id: `child-${n}` }))] });
  await f.api.veliBaslat();
  const [summary, feed] = f.calls.batches[0];
  assert.equal(summary.ref, `veliKatilim/${EPOSTA}`);
  assert.deepEqual(plain(summary.options), { merge: true });
  assert.deepEqual(Object.keys(summary.data).sort(), ['eposta', 'sonGorulme', 'sonUygulama', 'sonGiris', 'girisSayisi', 'gunler', 'uygulamalar', 'ogrenciIdler'].sort());
  assert.deepEqual(plain(summary.data.sonGiris), { operation: 'serverTimestamp' });
  assert.deepEqual(plain(summary.data.sonGorulme), { operation: 'serverTimestamp' });
  assert.deepEqual(plain(summary.data.uygulamalar), { portal: { operation: 'increment', n: 1 } });
  assert.equal(summary.data.ogrenciIdler.length, 10); assert.equal(new Set(summary.data.ogrenciIdler).size, 10);
  assert.match(feed.ref, /^veliKatilimAkisi\/parent@example\.invalid__\d{13}[a-z0-9]{4}$/);
  assert.deepEqual(Object.keys(feed.data).sort(), ['eposta', 'tur', 'ekran', 'uygulama', 'cihaz', 'zaman'].sort());
  assert.equal(feed.data.eposta, EPOSTA); assert.equal(feed.data.cihaz, 'mobil');
  assert.deepEqual(plain(feed.data.zaman), { operation: 'serverTimestamp' });
  assert.doesNotMatch(JSON.stringify(f.calls), /PRIVATE|providerData|password|accessToken/);
});

test('unverified, staff preview, founder, admin, unknown role and signed-out contexts cannot track as parent', async () => {
  for (const override of [
    { galeriVeliUid: '' }, { galeriVeliUid: 'other' }, { veliOgrenciler: [] }, { currentUser: null },
    { currentUser: { email: EPOSTA } }, { currentUser: { uid: 'parent-a' } }, { personel: { rol: 'ogretmen' } },
    { isAdmin: true }, { rol: 'kurucu_mudur' }, { rol: 'ogretmen' }, { rol: 'unknown' }, { rol: '' }
  ]) {
    const f = fixture(override); assert.equal(await f.api.veliBaslat(), false); await f.go('galeri');
    await f.tick(2 * MINUTE); assert.equal(f.calls.batches.length, 0); assert.equal(f.calls.presence.length, 0); assert.equal(f.timers.size, 0);
  }
  const f = fixture(); delete f.state.galeriVeliUid;
  assert.equal(await f.api.veliBaslat(), false, 'null role without current binding is not parent proof');
});

test('Firebase auth identity mismatch blocks otherwise retained portal state', async () => {
  const f = fixture(); f.window.PortalAPI.auth = { currentUser: { uid: 'different', email: EPOSTA } };
  assert.equal(await f.api.veliBaslat(), false); assert.equal(f.calls.batches.length, 0);
});

test('repeated starts, duplicate navigation bridges and rapid visibility do not multiply logins', async () => {
  const f = fixture(); const start = f.api.veliBaslat();
  assert.equal(f.api.veliBaslat(), start); f.window.caGo('galeri'); f.window.veliSwitchTab('galeri');
  await f.fire('visibilitychange'); await start; await f.flush();
  assert.equal(logins(f).length, 1); assert.equal(screens(f).length, 1);
  assert.equal([...f.timers.values()].filter(t => t.interval).length, 1);
  assert.equal([...f.listeners.values()].reduce((n, v) => n + v.size, 0), 5);
  assert.equal(await f.go('galeri'), 'caGo:result'); assert.equal(f.window.caGo.otherBridge, 'preserved');
});

test('restart inside 30 minutes updates presence immediately without inflating shared visit counters', async () => {
  const f = fixture(); f.storage.set(key, String(f.now() - MINUTE));
  await f.api.veliBaslat(); assert.equal(logins(f).length, 0); assert.equal(f.calls.presence.length, 1);
  const write = f.calls.presence[0]; assert.equal(write.ref, `veliKatilim/${EPOSTA}`);
  assert.deepEqual(Object.keys(write.data).sort(), ['eposta', 'sonGorulme', 'sonUygulama'].sort());
  f.api.durdur(); f.state.galeriOturumSurumu++; await f.api.veliBaslat();
  assert.equal(logins(f).length, 0); assert.equal(f.calls.presence.length, 2);
  f.api.durdur(); f.elapse(31 * MINUTE); f.state.galeriOturumSurumu++; await f.api.veliBaslat();
  assert.equal(logins(f).length, 1);
});

test('failed login does not poison local visit timestamp and succeeds on retry with no 30-minute wait', async () => {
  const f = fixture(); f.batch(async () => { throw Object.assign(Error('PRIVATE provider URL and email'), { code: 'permission-denied' }); });
  assert.equal(await f.api.veliBaslat(), false); assert.equal(f.storage.has(key), false);
  assert.deepEqual(plain(f.api.kayitDurumu()), { aktif: true, durum: 'hata', hataKodu: 'permission-denied' });
  assert.equal(f.calls.toasts.length, 1); await f.fire('visibilitychange'); assert.equal(f.calls.toasts.length, 1);
  f.batch(async () => {}); await f.go('galeri');
  assert.equal(f.calls.batches.length, 4); // two rejected logins, successful login + screen
  assert.equal(f.storage.get(key), String(f.now())); assert.equal(f.api.kayitDurumu().durum, 'kayitli');
  assert.equal(f.api.kayitDurumu().hataKodu, ''); assert.doesNotMatch(JSON.stringify(f.calls.warnings), /PRIVATE|example.invalid/);
});

test('pending commit cannot claim success or suppress a subsequent login before acknowledgement', async () => {
  const f = fixture(), pending = deferred(); f.batch(() => pending.promise);
  const start = f.api.veliBaslat(); await f.flush();
  assert.equal(f.storage.has(key), false); assert.equal(f.api.kayitDurumu().durum, 'bekliyor');
  f.window.caGo('galeri'); await f.flush(); assert.equal(f.calls.batches.length, 1);
  f.batch(async () => {}); pending.resolve(); assert.equal(await start, true); await f.flush();
  assert.equal(logins(f).length, 1); assert.equal(screens(f).length, 1); assert.equal(f.storage.has(key), true);
});

test('failed screen and heartbeat writes remain retryable and never cache private provider errors', async () => {
  const f = fixture(); await f.api.veliBaslat(); const previous = f.storage.get(key); f.elapse(MINUTE);
  f.batch(async () => { throw Object.assign(Error('PRIVATE'), { code: 'PRIVATE-CODE' }); }); await f.go('galeri');
  assert.equal(f.storage.get(key), previous); assert.equal(f.api.kayitDurumu().hataKodu, 'unknown');
  f.batch(async () => {}); await f.go('galeri'); assert.equal(screens(f).length, 2);
  f.presence(async () => { throw Error('PRIVATE'); }); f.elapse(MINUTE); const before = f.storage.get(key); await f.fire('visibilitychange');
  assert.equal(f.storage.get(key), before); assert.equal(f.api.kayitDurumu().durum, 'hata');
  f.presence(async () => {}); await f.fire('visibilitychange'); assert.equal(f.api.kayitDurumu().durum, 'kayitli');
  assert.doesNotMatch(JSON.stringify([f.calls.warnings, f.calls.toasts]), /PRIVATE/);
});

test('storage blocked or corrupt/future timestamps cannot disable logging or duplicate same-session visits', async () => {
  for (const value of ['not-a-number', '-1', 'Infinity', '999999999999999']) {
    const f = fixture({}, { storage: [[key, value]] }); await f.api.veliBaslat(); assert.equal(logins(f).length, 1);
  }
  const f = fixture({}, { storageBlocked: true }); await f.api.veliBaslat(); await f.go('galeri'); await f.fire('visibilitychange');
  assert.equal(logins(f).length, 1); f.elapse(31 * MINUTE); await f.go('gunluk'); assert.equal(logins(f).length, 2);
});

test('hidden and abandoned tabs do not heartbeat; resuming after 30 minutes adds one visit', async () => {
  const f = fixture(); await f.api.veliBaslat(); f.document.visibilityState = 'hidden'; await f.tick(2 * MINUTE);
  assert.equal(f.calls.presence.length, 0); f.document.visibilityState = 'visible'; f.elapse(16 * MINUTE); await f.tick(2 * MINUTE);
  assert.equal(f.calls.presence.length, 0); f.elapse(12 * MINUTE); await f.fire('visibilitychange'); assert.equal(logins(f).length, 2);
});

test('logout cancels all timers/listeners/wrappers and a stale in-flight commit never affects a new actor', async () => {
  const f = fixture(), oldCommit = deferred(); f.batch(() => oldCommit.promise);
  const oldStart = f.api.veliBaslat(); await f.flush(); const oldNavigation = f.window.caGo;
  f.window.caGo('galeri'); f.api.durdur();
  assert.equal(f.timers.size, 0); assert.equal([...f.listeners.values()].reduce((n, set) => n + set.size, 0), 0);
  assert.equal(f.window.caGo, f.originals.caGo);
  f.switchUser(); f.batch(async () => {}); await f.api.veliBaslat();
  oldNavigation('mesajlar'); oldCommit.resolve(); assert.equal(await oldStart, false); await f.flush();
  assert.equal(f.storage.has(key), false); assert.equal(f.calls.batches.length, 2);
  assert.equal(f.calls.batches[1][0].ref, 'veliKatilim/second@example.invalid');
  assert.deepEqual(plain(f.calls.batches[1][0].data.ogrenciIdler), ['second-child']);
  assert.equal(f.api.kayitDurumu().durum, 'kayitli');
});

test('changed UID, auth epoch, user object, parent proof and role cannot reuse old callbacks even without reset', async () => {
  for (const mutate of [
    f => f.switchUser(), f => f.state.galeriOturumSurumu++, f => f.state.currentUser = { ...f.state.currentUser },
    f => f.state.currentUser = null, f => f.state.galeriVeliUid = '', f => f.state.veliOgrenciler = [],
    f => f.state.rol = 'ogretmen', f => f.state.personel = {}, f => f.state.isAdmin = true,
    f => f.state.currentUser.email = 'another@example.invalid'
  ]) {
    const f = fixture(); await f.api.veliBaslat(); mutate(f); await f.go('galeri'); await f.fire('visibilitychange'); await f.tick(2 * MINUTE);
    assert.equal(f.calls.batches.length, 1); assert.equal(f.calls.presence.length, 0); assert.equal(f.api.kayitDurumu().aktif, false);
  }
});

test('calling start with a different account replaces tracking without accumulating old wrappers or listeners', async () => {
  const f = fixture(); await f.api.veliBaslat(); f.switchUser(); await f.api.veliBaslat(); await f.go('mesajlar');
  assert.equal(logins(f).length, 2); assert.equal(screens(f).length, 1); assert.equal(screens(f)[0].data.eposta, 'second@example.invalid');
  assert.equal([...f.listeners.values()].reduce((n, set) => n + set.size, 0), 5);
  assert.equal([...f.timers.values()].filter(t => t.interval).length, 1);
});

test('staff tracking stays in staff collections and founders/admins are never recorded', async () => {
  const f = fixture({ rol: 'ogretmen', personel: { rol: 'ogretmen' } }); await f.api.personelBaslat(); await f.go('egitim', 'modulSec');
  assert.equal(f.calls.batches.length, 2); assert.ok(f.calls.batches.flat().every(w => w.ref.startsWith('personelKatilim')));
  assert.ok(f.calls.batches.flat().every(w => !('ogrenciIdler' in w.data)));
  for (const override of [{ isAdmin: true }, { rol: 'kurucu_mudur' }, { rol: 'veli', personel: {} }, { personel: null }]) {
    const g = fixture({ rol: 'ogretmen', personel: {}, ...override }); await g.api.personelBaslat(); assert.equal(g.calls.batches.length, 0);
  }
});

test('parent cannot read audit collections or keep admin reader contents after reset', async () => {
  const parent = fixture(); parent.api.panelRender('panel'); assert.equal(parent.subscribers.length, 0); assert.equal(parent.calls.reads.length, 0);
  const f = fixture({ isAdmin: true, rol: 'kurucu_mudur' }); f.api.panelRender('panel');
  assert.equal(f.subscribers.length, 2); f.root.innerHTML = 'PRIVATE ADMIN HISTORY';
  f.api.durdur(); f.switchUser(); f.state.isAdmin = false; f.state.rol = null;
  let accessed = false;
  f.subscribers[0].next({ docChanges() { accessed = true; return []; } });
  f.subscribers[1].next({ get docs() { accessed = true; return []; } });
  f.subscribers[0].error(Error('PRIVATE')); await f.tick(30_000);
  assert.equal(accessed, false); assert.equal(f.root.innerHTML, ''); assert.equal(f.calls.unsubscribed.length, 2);
});

test('old admin subscriptions cannot contaminate a newer admin session or run delayed cleanup', async () => {
  const f = fixture({ isAdmin: true, rol: 'kurucu_mudur' }), read = deferred(); f.reads(() => read.promise);
  f.api.panelRender('panel'); const oldSubscriptions = [...f.subscribers]; f.api.durdur();
  f.state.currentUser = { uid: 'admin-b', email: 'admin-b@example.invalid' }; f.state.galeriOturumSurumu++;
  f.api.panelRender('panel'); let accessed = false;
  oldSubscriptions[0].next({ docChanges() { accessed = true; return []; } });
  oldSubscriptions[1].next({ get docs() { accessed = true; return []; } });
  read.resolve({ empty: false, docs: [{ ref: 'old-history' }] }); await f.flush();
  assert.equal(accessed, false); assert.equal(f.calls.batches.length, 0);
});

test('failed presence plus skipped navigation does not extend an unconfirmed legacy activity marker', async () => {
  const f = fixture(); const old = String(f.now() - MINUTE); f.storage.set(key, old);
  f.presence(async () => { throw Object.assign(Error('PRIVATE'), { code: 'permission-denied' }); });
  await f.api.veliBaslat(); f.elapse(MINUTE); await f.go('home');
  assert.equal(f.storage.get(key), old); assert.equal(f.calls.presence.length, 2);
  f.presence(async () => {}); await f.go('home'); assert.equal(f.storage.get(key), String(f.now()));
});

test('recent acknowledged presence is shown as last seen after online expires, never as an invented login', async () => {
  const f = fixture({ isAdmin: true, rol: 'kurucu_mudur' }); f.api.panelRender('panel');
  const data = { eposta: EPOSTA, sonGiris: new Date(f.now() - 4 * 86400_000), sonGorulme: new Date(f.now() - 5 * MINUTE), girisSayisi: 2, gunler: {} };
  f.subscribers[0].next({ docChanges: () => [{ type: 'added', doc: { id: EPOSTA, data: () => data } }] });
  f.subscribers[1].next({ docs: [] }); await f.tick(300);
  assert.match(f.root.innerHTML, /Son görülme: 5 dk önce/);
  assert.match(f.root.innerHTML, /Son görülmeye göre/);
  assert.doesNotMatch(f.root.innerHTML, /4 gün önce|giriş yaptı/);
  assert.equal(data.girisSayisi, 2); assert.equal(f.calls.batches.length, 0);
});

test('reader reports generic safe errors; another subscription success cannot conceal a failed feed', async () => {
  const f = fixture({ isAdmin: true, rol: 'kurucu_mudur' }); f.api.panelRender('panel');
  f.subscribers[1].error(Object.assign(Error('PRIVATE rule detail'), { code: 'permission-denied' }));
  f.subscribers[0].next({ docChanges: () => [] }); await f.tick(300);
  assert.match(f.root.innerHTML, /Katılım kayıtları okunamadı/); assert.doesNotMatch(f.root.innerHTML, /kuralı eksik|PRIVATE|Henüz hareket yok/);
  f.subscribers[1].next({ docs: [] }); await f.tick(300); assert.doesNotMatch(f.root.innerHTML, /Katılım kayıtları okunamadı/);
  f.subscribers[0].error(Error('PRIVATE')); await f.tick(300); assert.match(f.root.innerHTML, /Bağlantıyı kontrol/);
});

test('period and assigned-child list changes invalidate queued writes without needing class hydration', async () => {
  for (const mutate of [f => f.state.aktifDonem = '2027-2028', f => f.state.veliOgrenciler = [{ id: 'foreign-child' }]]) {
    const f = fixture(), commit = deferred(); f.batch(() => commit.promise);
    const start = f.api.veliBaslat(); await f.flush(); f.window.caGo('galeri'); mutate(f);
    commit.resolve(); assert.equal(await start, false); await f.flush(); await f.tick(2 * MINUTE);
    assert.equal(f.calls.batches.length, 1); assert.equal(f.calls.presence.length, 0);
    assert.equal(f.storage.has(key), false); assert.equal(f.api.kayitDurumu().aktif, false);
  }
});

test('selected sibling changes do not interrupt actor-level tracking or alter assigned-child scope', async () => {
  const f = fixture(); await f.api.veliBaslat(); f.state.veliAktifOgrenci = { id: 'child-b' }; await f.go('gunluk');
  assert.equal(logins(f).length, 1); assert.equal(screens(f).length, 1);
  assert.deepEqual(plain(f.calls.batches[0][0].data.ogrenciIdler), ['child-a', 'child-b']);
});

test('unresolved summary stays loading and a failed feed keeps confirmed summary with an incomplete-data banner', async () => {
  const f = fixture({ isAdmin: true, rol: 'kurucu_mudur' }); f.api.panelRender('panel');
  f.subscribers[1].next({ docs: [] }); await f.tick(300);
  assert.match(f.root.innerHTML, /Veli hareketleri yükleniyor/); assert.doesNotMatch(f.root.innerHTML, /veli hiç girmedi|Hepsi en az/);
  f.subscribers[0].next({ docChanges: () => [{ type: 'added', doc: { id: EPOSTA, data: () => ({ eposta: EPOSTA, sonGorulme: new Date(f.now() - 5 * MINUTE) }) } }] });
  f.subscribers[1].error(Object.assign(Error('PRIVATE'), { code: 'unavailable' })); await f.tick(300);
  assert.match(f.root.innerHTML, /Gösterilen bilgiler eksik olabilir/); assert.match(f.root.innerHTML, /Son görülme: 5 dk önce/);
  assert.match(f.root.innerHTML, /Hareket akışı okunamadı/); assert.doesNotMatch(f.root.innerHTML, /Henüz hareket yok/);
});

test('staff tracking continues across period-selector changes without attaching parent scope', async () => {
  const f = fixture({ rol: 'ogretmen', personel: { rol: 'ogretmen' } }); await f.api.personelBaslat();
  f.state.aktifDonem = '2027-2028'; await f.go('egitim', 'modulSec'); await f.tick(2 * MINUTE);
  assert.equal(f.api.kayitDurumu().aktif, true); assert.equal(f.calls.batches.length, 2); assert.equal(f.calls.presence.length, 1);
  assert.ok(f.calls.batches.flat().every(w => !('ogrenciIdler' in w.data) && !('donem' in w.data)));
});

test('reopening an errored panel replaces dead listeners and recovers only from the new subscriptions', async () => {
  const f = fixture({ isAdmin: true, rol: 'kurucu_mudur' }); f.api.panelRender('panel');
  const old = [...f.subscribers]; old[0].next({ docChanges: () => [] });
  old[1].error(Object.assign(Error('PRIVATE'), { code: 'permission-denied' })); await f.tick(300);
  assert.match(f.root.innerHTML, /Katılım kayıtları okunamadı/);
  f.api.panelRender('panel'); assert.equal(f.calls.unsubscribed.length, 2); assert.equal(f.subscribers.length, 4);
  let accessed = false; old[0].next({ docChanges() { accessed = true; return []; } }); old[1].next({ get docs() { accessed = true; return []; } });
  old[1].error(Error('PRIVATE')); assert.equal(accessed, false);
  f.subscribers[2].next({ docChanges: () => [] }); f.subscribers[3].next({ docs: [] }); await f.tick(300);
  assert.doesNotMatch(f.root.innerHTML, /Katılım kayıtları okunamadı|yükleniyor/);
  assert.match(f.root.innerHTML, /Henüz hareket yok/);
});
