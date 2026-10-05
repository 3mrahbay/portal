import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createGooglePopupFlow } from '../js/portal-google-login.js';
import { installedPwa, assertPwaBootstrap, assertPrecachedImport } from './helpers/portal-pwa.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const user = (uid = 'parent') => ({ uid, email: `${uid}@example.invalid`, displayName: uid });
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

function fixture({ admit = async () => {}, popupError } = {}) {
  const auth = { currentUser: null }, popups = [], buttons = [], notices = [], warnings = [];
  let insideClick = false;
  const flow = createGooglePopupFlow({ auth,
    openPopup(a, provider) {
      assert.equal(insideClick, true, 'popup opens synchronously within click');
      assert.equal(a, auth); assert.equal(provider.prompt, 'select_account');
      if (popupError) throw popupError;
      const p = deferred(); popups.push(p); return p.promise;
    },
    createProvider: () => ({ prompt: 'select_account' }), admit,
    busy: value => buttons.push(value), notify: (...args) => notices.push(args), warn: code => warnings.push(code)
  });
  const start = () => { insideClick = true; try { return flow.start(); } finally { insideClick = false; } };
  return { auth, flow, start, popups, buttons, notices, warnings,
    succeed(u = user(), n = popups.length - 1) { auth.currentUser = u; popups[n].resolve({ user: u }); } };
}

test('first login and double tap keep one gesture-owned popup, then allow deliberate repeated login', async () => {
  const admitted = [], f = fixture({ admit: async u => admitted.push(u.uid) });
  const first = f.start(), second = f.start(); assert.equal(first, second); assert.equal(f.popups.length, 1);
  f.succeed(); assert.equal(await first, true); assert.deepEqual(admitted, ['parent']); assert.deepEqual(f.buttons, [true, false]);
  const again = f.start(); f.succeed(); assert.equal(await again, true); assert.equal(f.popups.length, 2);
});
test('cancel and replaced popup return to idle quietly and retry requires another deliberate click', async () => {
  for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']) {
    const f = fixture(), p = f.start(); f.popups[0].reject({ code }); assert.equal(await p, false);
    assert.deepEqual(f.buttons, [true, false]); assert.equal(f.notices.length, 0); assert.equal(f.warnings.length, 0);
    const retry = f.start(); assert.equal(f.popups.length, 2); f.succeed(); assert.equal(await retry, true);
  }
});
test('blocked/network/unknown failures restore button, redact raw errors and never retry automatically', async () => {
  for (const code of ['auth/popup-blocked', 'auth/network-request-failed', 'unknown-private-url?token=secret', 'auth/private-token-secret']) {
    const f = fixture(), p = f.start(); f.popups[0].reject({ code, message: 'private full OAuth URL/token' });
    assert.equal(await p, false); assert.equal(f.popups.length, 1); assert.deepEqual(f.buttons, [true, false]);
    assert.equal(f.notices.length, 1); assert.doesNotMatch(JSON.stringify(f.notices), /private|secret|token/);
    assert.doesNotMatch(JSON.stringify(f.warnings), /private|secret|token/);
  }
});
test('synchronous provider/popup errors also release the single-flight guard', async () => {
  const f = fixture({ popupError: { code: 'auth/popup-blocked' } });
  assert.equal(await f.start(), false); assert.deepEqual(f.buttons, [true, false]);
  assert.equal(await f.start(), false); assert.deepEqual(f.buttons, [true, false, true, false]);
});
test('logout invalidates unresolved popup; a late result cannot admit an old account', async () => {
  const admitted = [], f = fixture({ admit: async u => admitted.push(u.uid) });
  const p = f.start(); f.flow.invalidate(); f.succeed(); assert.equal(await p, false); assert.deepEqual(admitted, []);
});
test('old completion/finally cannot unlock or notify over a replacement attempt', async () => {
  const f = fixture(), first = f.start(); f.flow.invalidate(); const replacement = f.start();
  f.popups[0].reject({ code: 'auth/network-request-failed' }); await first;
  assert.equal(f.buttons.at(-1), true); assert.equal(f.notices.length, 0);
  f.succeed(user('replacement')); assert.equal(await replacement, true); assert.equal(f.buttons.at(-1), false);
});
test('resolved actor reference protects same-UID restart and account switch during admission read', async () => {
  for (const replacement of [user('other'), user('parent')]) {
    const gate = deferred(), effects = [];
    const f = fixture({ admit: async (u, current) => { await gate.promise; if (current()) effects.push(u.uid); } });
    const p = f.start(); f.succeed(); await Promise.resolve(); f.auth.currentUser = replacement; gate.resolve();
    assert.equal(await p, false); assert.deepEqual(effects, []);
  }
});

function admissionFixture({ personnel = null, whitelist = false } = {}) {
  const auth = { currentUser: null }, notices = [], providers = [], reads = [], calls = [];
  let nextPopup;
  const button = { disabled: false, setAttribute(key, value) { this[key] = value; } };
  const context = { createGooglePopupFlow, auth, GoogleAuthProvider: class { setCustomParameters(p) { providers.push(p); } },
    signInWithPopup: () => { nextPopup = deferred(); return nextPopup.promise; },
    personelGetir: async email => { reads.push(email); return typeof personnel === 'function' ? personnel() : personnel; },
    isEmailWhitelisted: async email => { reads.push(email); return typeof whitelist === 'function' ? whitelist() : whitelist; },
    fbSignOut: async () => { calls.push('signout'); auth.currentUser = null; },
    showToast: (...args) => notices.push(args), ADMIN_EMAIL: 'admin@example.invalid',
    document: { getElementById: () => button }, window: {}, console: { warn() {} }
  };
  vm.runInNewContext(html.slice(html.indexOf('const googleGiris = createGooglePopupFlow('), html.indexOf('\nwindow.signOut = async function()')), context);
  return { context, notices, providers, reads, calls, button, auth,
    start(u) { const promise = context.window.signInWithGoogle(); auth.currentUser = u; nextPopup.resolve({ user: u }); return promise; } };
}
test('actual admission branch preserves admin, staff, archive, approved parent and denial decisions', async () => {
  for (const row of [
    { u: user('admin'), out: 0, reads: 0 },
    { u: user('staff'), personnel: { durum: 'aktif', adSoyad: 'Staff' }, out: 0, reads: 1 },
    { u: user('archived'), personnel: { durum: 'arsiv' }, out: 1, reads: 1 },
    { u: user(), whitelist: true, out: 0, reads: 2 },
    { u: user('unknown'), out: 1, reads: 2 }
  ]) {
    const f = admissionFixture(row); await f.start(row.u);
    assert.equal(f.calls.length, row.out); assert.equal(f.reads.length, row.reads); assert.equal(f.button.disabled, false);
    assert.equal(f.providers[0].prompt, 'select_account');
  }
});
test('actual personnel/whitelist delayed rejection cannot sign out or greet a newer account', async () => {
  for (const phase of ['personnel', 'whitelist']) {
    const gate = deferred(), f = admissionFixture({ [phase]: () => gate.promise });
    const pending = f.start(user('old')); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    f.auth.currentUser = user('new'); gate.resolve(phase === 'personnel' ? { durum: 'arsiv' } : false);
    await pending; assert.deepEqual(f.calls, []); assert.deepEqual(f.notices, []);
  }
});
test('auth initialization null cannot cancel a user-initiated first popup; logout resets tracking first', () => {
  const authStart = html.slice(html.indexOf('onAuthStateChanged(auth, async (user) => {'), html.indexOf('// Aktif dönemi ayarlar/donem'));
  assert.match(authStart, /if \(!user && currentUser\) googleGiris\.invalidate\(\)/);
  assert.ok(authStart.indexOf('window.veliKatilim?.durdur?.()') < authStart.indexOf('if (user)'));
  const logout = html.slice(html.indexOf('window.signOut = async function()'), html.indexOf('let portalOturumSurumu'));
  for (const token of ['googleGiris.invalidate()', 'window.veliKatilim?.durdur?.()']) assert.ok(logout.indexOf(token) < logout.indexOf('await fbSignOut'));
});
test('late participation module loads bind the original actor and auth epoch', () => {
  const staff = html.match(/if \(!isAdmin\) modulYukle\("veli-katilim"\)\.then\(m => \{([\s\S]*?)\n      \}\);/)[1];
  const parent = html.match(/    modulYukle\("veli-katilim"\)\.then\(m => \{([\s\S]*?)\n    \}\);/)[1];
  for (const source of [staff, parent]) { assert.match(source, /portalOturumSurumu/); assert.match(source, /currentUser !== user/); assert.match(source, /auth\.currentUser\?\.uid !== user\.uid/); }
  assert.match(parent, /galeriVeliUid !== user\.uid/);
});
test('actual deferred tracking callbacks ignore replaced accounts, epochs and cleared parent proof', () => {
  const snippets = [
    html.match(/if \(!isAdmin\) modulYukle\("veli-katilim"\)\.then\(m => \{([\s\S]*?)\n      \}\);/)[1],
    html.match(/    modulYukle\("veli-katilim"\)\.then\(m => \{([\s\S]*?)\n    \}\);/)[1]
  ];
  for (let index = 0; index < snippets.length; index++) {
    for (const change of [null, c => c.currentUser = { ...c.user }, c => c.portalOturumSurumu++, c => c.auth.currentUser = user('other'), c => c.isAdmin = true,
      c => { if (index) c.galeriVeliUid = ''; else c.aktifPersonel = null; }]) {
      const u = user(), c = { user: u, currentUser: u, auth: { currentUser: u }, oturumSurumu: 4, galeriOturumu: 4,
        portalOturumSurumu: 4, isAdmin: false, aktifPersonel: index ? null : {}, galeriVeliUid: u.uid };
      let calls = 0; change?.(c);
      const callback = vm.runInNewContext('(function(m){' + snippets[index] + '})', c);
      callback({ personelBaslat() { calls++; }, veliBaslat() { calls++; } });
      assert.equal(calls, change ? 0 : 1);
    }
  }
});
test('logout delayed reload cannot interrupt an immediately restarted Google popup or a new signed-in account', async () => {
  const source = html.match(/window.signOut = async function\(\) \{([\s\S]*?)\n\};/)[1];
  for (const state of ['idle', 'popup', 'signed-in']) {
    let timer, reloads = 0, pending = false;
    const c = { auth: { currentUser: user() }, googleGiris: { invalidate() { pending = false; }, isPending: () => pending },
      window: {}, galeriVeliUid: 'parent', veliGaleriSinifSifirla() {}, showToast() {},
      setTimeout: fn => { timer = fn; }, location: { reload() { reloads++; } } };
    c.fbSignOut = async () => { c.auth.currentUser = null; };
    await vm.runInNewContext('(async function(){' + source + '})()', c);
    if (state === 'popup') pending = true;
    if (state === 'signed-in') c.auth.currentUser = user('new');
    timer(); assert.equal(reloads, state === 'idle' ? 1 : 0);
  }
});
test('new popup code and participation module use current exact precache URLs', async () => {
  const pwa = await installedPwa(); await assertPwaBootstrap(pwa); assertPrecachedImport(pwa, 'index.html', 'js/portal-google-login.js');
  assert.ok(pwa.precache.includes('./moduller/veli-katilim.js?v=178'));
  assert.match(html, /ad === "veli-katilim" \? "178"/);
});
