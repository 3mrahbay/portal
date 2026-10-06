import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyGalleryApproval } from '../js/galeri-onay-bildirimi.js';

const OWNER = 'emrahby@gmail.com';
const ADMIN = 'principal@example.invalid';
const OTHER = 'founder@example.invalid';
const entry = (id, data = {}) => ({ id, data: () => ({ rol: 'mudur', durum: 'aktif', ...data }) });
const pending = { id: 'gallery-1', durum: 'beklemede' };
const docId = (id, email) => `galeri-onay-istek:${encodeURIComponent(id)}:${encodeURIComponent(email)}`;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// Synthetic Firestore/FCM only: no credentials, real accounts, network requests,
// uploads, backfills, recipient reads or live notifications are used by tests.
function environment(t, people = [entry(ADMIN)]) {
  const docs = new Map(), attempts = [], writes = [], pushes = [], lookups = [];
  const controls = { people, fail: new Set(), lookupError: false, denyUpdates: false };
  const state = { currentUser: { uid: 'teacher-uid', email: 'teacher@example.invalid' }, galeriOturumSurumu: 1, rol: 'ogretmen' };
  const api = { db: {}, state, fb: {
    collection: (_db, name) => ({ name }),
    doc: (_db, collection, id) => ({ path: `${collection}/${id}`, id }),
    getDocs: async reference => {
      assert.equal(reference.name, 'personeller');
      lookups.push(reference);
      await controls.beforeLookup?.();
      if (controls.lookupError) throw Object.assign(Error('synthetic roster failure'), { code: 'permission-denied' });
      return { forEach: callback => controls.people.forEach(callback) };
    },
    getDoc: () => { throw Error('Uploader must never read recipient notices'); },
    runTransaction: () => { throw Error('Uploader must never transact on recipient notices'); },
    setDoc: async (reference, payload, options) => {
      attempts.push({ reference, payload, options });
      await controls.beforeSave?.(reference, payload);
      if (controls.fail.has(payload.aliciEmail) || (controls.denyUpdates && docs.has(reference.path))) {
        throw Object.assign(Error('synthetic write failure'), { code: 'permission-denied' });
      }
      assert.deepEqual(options, { merge: true });
      docs.set(reference.path, { ...docs.get(reference.path), ...structuredClone(payload) });
      writes.push({ reference, payload, options });
      controls.afterSave?.(reference, payload);
    }
  } };
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    const payload = JSON.parse(request.body);
    assert.equal(request.method, 'POST');
    pushes.push(payload);
    await controls.beforePush?.();
    return { ok: true, status: 200, text: async () => JSON.stringify(controls.pushResult || {
      ok: true, sonuclar: payload.aliciEmailler.map(() => ({ ok: true }))
    }) };
  });
  return { api, state, controls, docs, attempts, writes, pushes, lookups };
}

test('pending upload sends one generic, stable per-recipient notice and push after persistence', async t => {
  const env = environment(t, [entry(ADMIN), entry(OTHER, { rol: 'kurucu_mudur' })]);
  const id = 'media:öğrenme 2?%';
  const outcome = await notifyGalleryApproval({ id, durum: 'beklemede', ogrenciAd: 'PRIVATE CHILD',
    medyaUrl: 'https://private.invalid/media', ogretmenAd: 'PRIVATE TEACHER', etkinlikBaslik: 'PRIVATE ACTIVITY' }, env.api);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.adet, 3);
  assert.equal(outcome.istenen, 3);
  assert.equal(outcome.recipientLookupFailed, false);
  assert.deepEqual(outcome.kayitHatalari, []);
  assert.equal(outcome.push.ok, true);
  assert.equal(env.docs.size, 3);
  assert.equal(env.pushes.length, 1);
  assert.deepEqual(new Set(env.pushes[0].aliciEmailler), new Set([OWNER, ADMIN, OTHER]));
  for (const { reference, payload } of env.writes) {
    assert.equal(reference.id, docId(id, payload.aliciEmail));
    assert.equal(reference.path.split('/').length, 2);
    assert.equal(payload.olayAnahtari, `galeri-onay-istek:${id}`);
    assert.equal(payload.kaynakId, id);
    assert.equal(payload.tip, 'galeri_onay');
    assert.equal(payload.hedefSayfa, `galeri-onay.html?medya=${encodeURIComponent(id)}`);
    assert.equal(Object.hasOwn(payload, 'okundu'), false);
    assert.deepEqual(Object.keys(payload).sort(), ['aliciEmail', 'baslik', 'hedefSayfa', 'kaynakId', 'metin', 'olayAnahtari', 'olusturuldu', 'tip'].sort());
  }
  assert.doesNotMatch(JSON.stringify([...env.writes, ...env.pushes]), /PRIVATE|private\.invalid|ogrenciId|medyaUrl/);
});

test('only active exact approver roles are recipients; owner is always included once', async t => {
  const env = environment(t, [
    entry(ADMIN), entry(' PRINCIPAL@EXAMPLE.INVALID '), entry(OTHER, { rol: 'kurucu_mudur' }),
    entry(OWNER, { rol: 'kurucu_mudur' }), entry('archived@example.invalid', { durum: 'arsiv' }),
    entry('inactive@example.invalid', { aktif: false }), entry('passive@example.invalid', { durum: 'pasif' }),
    entry('left@example.invalid', { durum: 'ayrıldı' }), entry('unknown@example.invalid', { durum: 'bilinmiyor' }),
    entry('missing-status@example.invalid', { durum: undefined }), entry('blank-status@example.invalid', { durum: '' }),
    entry('coordinator@example.invalid', { rol: 'egitim_koordinator' }), entry('teacher@example.invalid', { rol: 'ogretmen' }),
    entry('role-alias@example.invalid', { rol: 'kurucu' }), entry('admin-alias@example.invalid', { rol: 'admin' }),
    entry('spaced-role@example.invalid', { rol: ' mudur ' }), entry('spaced-status@example.invalid', { durum: ' aktif ' }),
    entry('noncanonical-role@example.invalid', { rol: 'MUDUR' }), entry('noncanonical-status@example.invalid', { durum: 'AKTIF' }),
    entry('legacy-alias@example.invalid', { rol: 'yonetici' }), entry('danisma@example.invalid', { rol: 'danisma' }),
    entry('not-an-email', { email: 'profile-alias@example.invalid' })
  ]);
  await notifyGalleryApproval(pending, env.api);
  assert.deepEqual(new Set(env.writes.map(item => item.payload.aliciEmail)), new Set([OWNER, ADMIN, OTHER]));
  assert.equal(env.writes.length, 3);
});

test('profile email alias cannot redirect canonical permission-bearing approver identity', async t => {
  const env = environment(t, [entry(ADMIN, { email: 'different-contact@example.invalid' })]);
  await notifyGalleryApproval(pending, env.api);
  assert.deepEqual(env.writes.map(item => item.payload.aliciEmail), [OWNER, ADMIN]);
});

test('only current and legacy pending statuses notify; coordinator autoapproved upload is quiet', async t => {
  const env = environment(t);
  for (const durum of ['onaylandi', 'reddedildi', 'onaylandı', '', undefined]) {
    env.state.rol = 'egitim_koordinator';
    const outcome = await notifyGalleryApproval({ id: `skip-${durum}`, durum }, env.api);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.adet, 0);
  }
  assert.equal(env.lookups.length, 0);
  assert.equal(env.writes.length, 0);
  assert.equal(env.pushes.length, 0);
  env.state.rol = 'ogretmen';
  assert.equal((await notifyGalleryApproval({ ...pending, durum: 'onayBekliyor' }, env.api)).ok, true);
  assert.equal(env.writes.length, 2);
});

test('inflight and completed event calls coalesce without duplicate writes, roster lookups or pushes', async t => {
  const env = environment(t), gate = deferred();
  env.controls.beforeLookup = () => gate.promise;
  const first = notifyGalleryApproval(pending, env.api);
  const second = notifyGalleryApproval(pending, env.api);
  gate.resolve();
  assert.deepEqual(await first, await second);
  await notifyGalleryApproval(pending, env.api);
  assert.equal(env.lookups.length, 1);
  assert.equal(env.writes.length, 2);
  assert.equal(env.pushes.length, 1);
});

test('allowed new-session replay merges deterministic IDs and preserves existing read state', async t => {
  const env = environment(t);
  await notifyGalleryApproval(pending, env.api);
  for (const payload of env.docs.values()) { payload.okundu = true; payload.okunmaTarihi = 'existing-read-time'; }
  env.state.galeriOturumSurumu++;
  assert.equal((await notifyGalleryApproval(pending, env.api)).ok, true);
  assert.equal(env.docs.size, 2);
  assert.equal(env.writes.length, 4);
  for (const payload of env.docs.values()) {
    assert.equal(payload.okundu, true);
    assert.equal(payload.okunmaTarihi, 'existing-read-time');
  }
});

test('denied replay remains an explicit failure rather than claiming duplicate success', async t => {
  const env = environment(t);
  await notifyGalleryApproval(pending, env.api);
  env.state.galeriOturumSurumu++;
  env.controls.denyUpdates = true;
  const outcome = await notifyGalleryApproval(pending, env.api);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.adet, 0);
  assert.equal(outcome.istenen, 2);
  assert.equal(outcome.kayitHatalari.length, 2);
  assert.ok(outcome.kayitHatalari.every(item => item.hata === 'permission-denied'));
  assert.equal(env.docs.size, 2);
  assert.equal(env.pushes.length, 1);
});

test('failed roster lookup persists owner fallback but reports unknown approvers; retry fills the gap', async t => {
  const env = environment(t);
  env.controls.lookupError = true;
  const first = await notifyGalleryApproval(pending, env.api);
  assert.equal(first.ok, false);
  assert.equal(first.recipientLookupFailed, true);
  assert.equal(first.adet, 1);
  assert.equal(first.istenen, 1);
  assert.deepEqual(env.writes.map(item => item.payload.aliciEmail), [OWNER]);
  env.controls.lookupError = false;
  const next = await notifyGalleryApproval(pending, env.api);
  assert.equal(next.ok, true);
  assert.equal(next.recipientLookupFailed, false);
  assert.equal(next.adet, 2);
  assert.deepEqual(env.writes.map(item => item.payload.aliciEmail), [OWNER, ADMIN]);
  assert.deepEqual(env.pushes.map(item => item.aliciEmailler), [[OWNER], [ADMIN]]);
});

test('missing roster adapter also reports fallback warning rather than false complete success', async t => {
  const env = environment(t);
  delete env.api.fb.getDocs;
  const outcome = await notifyGalleryApproval(pending, env.api);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.recipientLookupFailed, true);
  assert.equal(outcome.adet, 1);
  assert.equal(env.writes[0].payload.aliciEmail, OWNER);
});

test('partially denied persistence reports exact failure and only pushes saved recipients; retry is allowed', async t => {
  const env = environment(t, [entry(ADMIN), entry(OTHER)]);
  env.controls.fail.add(ADMIN);
  env.controls.beforePush = () => assert.deepEqual(new Set(env.pushes.at(-1).aliciEmailler),
    new Set(env.writes.map(item => item.payload.aliciEmail).filter(email => env.pushes.at(-1).aliciEmailler.includes(email))));
  const first = await notifyGalleryApproval(pending, env.api);
  assert.equal(first.ok, false);
  assert.equal(first.adet, 2);
  assert.equal(first.istenen, 3);
  assert.deepEqual(first.kayitHatalari, [{ email: ADMIN, hata: 'permission-denied' }]);
  assert.deepEqual(env.pushes[0].aliciEmailler, [OWNER, OTHER]);
  env.controls.fail.clear();
  const next = await notifyGalleryApproval(pending, env.api);
  assert.equal(next.ok, true);
  assert.equal(next.adet, 3);
  assert.deepEqual(next.kayitHatalari, []);
  assert.equal(env.writes.length, 3);
  assert.equal(env.attempts.length, 4);
  assert.deepEqual(env.pushes[1].aliciEmailler, [ADMIN]);
});

test('complete persistence failure sends no push and can be retried', async t => {
  const env = environment(t);
  env.controls.fail = new Set([OWNER, ADMIN]);
  assert.equal((await notifyGalleryApproval(pending, env.api)).adet, 0);
  assert.equal(env.pushes.length, 0);
  env.controls.fail.clear();
  assert.equal((await notifyGalleryApproval(pending, env.api)).ok, true);
  assert.equal(env.writes.length, 2);
  assert.equal(env.pushes.length, 1);
});

for (const change of ['uid', 'session', 'logout', 'auth']) {
  test(`account ${change} change during recipient lookup prevents all writes and pushes`, async t => {
    const env = environment(t), gate = deferred();
    env.controls.beforeLookup = () => gate.promise;
    if (change === 'auth') env.api.auth = { currentUser: { uid: env.state.currentUser.uid } };
    const send = notifyGalleryApproval(pending, env.api);
    if (change === 'uid') env.state.currentUser = { uid: 'another-account' };
    if (change === 'session') env.state.galeriOturumSurumu++;
    if (change === 'logout') env.state.currentUser = null;
    if (change === 'auth') env.api.auth.currentUser = { uid: 'another-account' };
    gate.resolve();
    const outcome = await send;
    assert.equal(outcome.ok, false);
    assert.equal(outcome.hata, 'galeri-oturumu-degisti');
    assert.equal(env.writes.length, 0);
    assert.equal(env.pushes.length, 0);
  });
}

test('session changes after the first persisted notice prevent remaining writes and all pushes', async t => {
  const env = environment(t);
  env.controls.afterSave = () => { env.state.galeriOturumSurumu++; };
  const outcome = await notifyGalleryApproval(pending, env.api);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.adet, 1);
  assert.equal(outcome.istenen, 2);
  assert.equal(outcome.hata, 'galeri-oturumu-degisti');
  assert.equal(env.attempts.length, 1);
  assert.equal(env.pushes.length, 0);
});

test('push failure is separate from persisted notices and uncertain pushes are not replayed', async t => {
  const env = environment(t);
  t.mock.method(console, 'warn', () => {});
  env.controls.pushResult = { ok: true, sonuclar: [{ ok: true }, { ok: false, hata: 'synthetic-token-failure' }] };
  const first = await notifyGalleryApproval(pending, env.api);
  assert.equal(first.ok, true);
  assert.equal(first.push.ok, false);
  assert.equal(first.push.gonderilen, 1);
  assert.equal((await notifyGalleryApproval(pending, env.api)).push.ok, false);
  assert.equal(env.pushes.length, 1);
  assert.equal(env.writes.length, 2);
});

test('invalid inputs and missing session fail safely; default PortalAPI adapter is supported', async t => {
  const env = environment(t);
  assert.equal((await notifyGalleryApproval({ durum: 'beklemede' }, env.api)).ok, false);
  assert.equal((await notifyGalleryApproval(pending, undefined)).ok, false);
  assert.equal(env.writes.length, 0);
  const previous = globalThis.window;
  globalThis.window = { PortalAPI: env.api };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  assert.equal((await notifyGalleryApproval(pending)).ok, true);
});

test('invalid gallery path IDs and malformed Unicode fail before lookups, writes or pushes', async t => {
  const env = environment(t);
  for (const id of ['part/child', 'part\\child', '.', '..', 'id\n', 'id\u0000x', 'id\u007fx', '\ud800']) {
    const outcome = await notifyGalleryApproval({ id, durum: 'beklemede' }, env.api);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.hata, 'galeri-kimligi-gecersiz');
  }
  assert.equal(env.lookups.length, 0);
  assert.equal(env.writes.length, 0);
  assert.equal(env.pushes.length, 0);
});
