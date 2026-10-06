// Execute the production send functions and real Portal auth callback with
// synthetic Firebase/DOM adapters only. No credentials or network are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function section(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing production section: ${start}`);
  return html.slice(from, to);
}
const senderCode = section('function mesajGonderimOturumuAl()', '// Bir thread\'i okundu işaretle')
  .replace(/await import\("\.\/js\/zeky-operasyon-push\.js\?v=\d+"\)/, 'await loadPush()');
const variants = [
  { name: 'staff', handler: 'mesajGonderTikla', prefix: 'mesaj', active: 'mesajAktifThread', epoch: 'mesajSohbetSurumu', end: '// Enter ile gönder' },
  { name: 'modern parent', handler: 'caMsgGonder', prefix: 'caMsg', active: 'caMsgAktif', epoch: 'portalVeliSohbetSurumu', end: 'window.caMsgGirisKeydown', document: true },
  { name: 'classic parent', handler: 'veliMesajGonderTikla', prefix: 'veliMesaj', active: 'veliMesajAktifThread', epoch: 'portalVeliSohbetSurumu', end: 'window.veliMesajGirisKeydown' }
];
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const flushUntil = async predicate => { for (let i = 0; i < 100; i++) { if (predicate()) return; await Promise.resolve(); } assert.fail('Expected async stage was not reached'); };
const user = () => ({ uid: 'actor-uid', email: 'actor@example.invalid' });
const file = name => ({ name, type: name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' });
const uploaded = { url: 'https://media.example.invalid/attachment', yol: 'synthetic/attachment' };
function fixture(v = variants[0], { media = 'image', pause = null } = {}) {
  const nodes = new Map(), uploads = [], compressions = [], reads = [], commits = [], notices = [], pushes = [], toasts = [], imports = [];
  const gates = Object.fromEntries(['compress', 'upload', 'read', 'commit', 'notice', 'import', 'logout'].map(k => [k, deferred()]));
  const element = id => {
    if (!nodes.has(id)) {
      const listeners = new Map();
      nodes.set(id, { id, value: '', innerHTML: '', style: {}, disabled: false,
        classList: { add() {}, remove() {} },
        addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
        removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
        emit(name) { for (const fn of [...(listeners.get(name) || [])]) fn({ target: this }); },
        listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); }
      });
    }
    return nodes.get(id);
  };
  const actor = user();
  const ctx = vm.createContext({
    window: { location: { hash: '' } }, document: { getElementById: element, querySelector: element },
    currentUser: actor, auth: { currentUser: actor }, portalOturumSurumu: 1,
    mesajSohbetSurumu: 1, portalVeliSohbetSurumu: 1,
    [v.active]: { id: 'chat-A' }, [v.prefix + 'SeciliResim']: media === 'image' ? file('original.jpg') : null,
    caMsgSeciliBelge: media === 'document' ? file('original.pdf') : null,
    console: { error() {}, warn() {} }, showToast: (...args) => toasts.push(args), db: {},
    resimSikistir: async f => { compressions.push(f); if (pause === 'compress') await gates.compress.promise; return f; },
    medyaYukle: async (f, path, ...options) => { uploads.push({ f, path, options }); if (pause === 'upload') return gates.upload.promise; return uploaded; },
    collection: (_db, ...parts) => ({ path: parts.join('/') }),
    doc: (base, ...parts) => ({ path: parts.length ? parts.join('/') : base.path + '/generated' }),
    getDoc: async ref => { reads.push(ref); if (pause === 'read') await gates.read.promise; return { exists: () => true, data: () => ({ katilimcilar: [actor.email, ref.path.split('/').at(-1) + '@example.invalid'] }) }; },
    danismaRolMu: () => false, mesajThreadDanismaVeliMi: () => false, mesajSohbetKapaliMi: () => false,
    mesajGuvenliEkAdresi: url => /^https:\/\//.test(url), mesajGorunenAd: () => 'Sender',
    serverTimestamp: () => 'server-time', increment: n => n,
    FieldPath: class { constructor(...parts) { this.parts = parts; } },
    writeBatch: () => { const data = []; return { set: (...args) => data.push(['set', ...args]), update: (...args) => data.push(['update', ...args]),
      commit: async () => { commits.push(data); if (pause === 'commit') await gates.commit.promise; } }; },
    addDoc: async (...args) => { notices.push(args); if (pause === 'notice') await gates.notice.promise; },
    loadPush: async () => { imports.push(true); if (pause === 'import') await gates.import.promise; return { genelPushGonder: async (...args) => { pushes.push(args); return { ok: true }; } }; },
    googleGiris: { invalidate() {}, isPending: () => false }, galeriVeliUid: '', veliGaleriSinifSifirla() {},
    portalBildirimMerkeziDurdur() {}, galeriOnayTakibiniDurdur() {},
    aktifDonemYukle: () => new Promise(() => {}), // Auth identity is installed before this real callback's first await.
    setTimeout() {}, location: { reload() {} },
    onAuthStateChanged: (_auth, callback) => { ctx.authCallback = callback; }
  });
  ctx.fbSignOut = async () => { if (pause === 'logout') await gates.logout.promise; ctx.auth.currentUser = null; await ctx.authCallback(null); };
  vm.runInContext(senderCode + section(`window.${v.handler} = async function()`, v.end), ctx);
  vm.runInContext(section('onAuthStateChanged(auth, async (user) => {', '// ============ MODAL ============'), ctx);
  vm.runInContext(section('window.signOut = async function()', 'let portalOturumSurumu'), ctx);
  const input = element(v.prefix + 'GirisInput'), preview = element(v.prefix + 'ResimOnizleme');
  input.value = 'Original caption'; preview.innerHTML = media ? 'Original attachment preview' : ''; preview.style.display = media ? 'flex' : 'none';
  const submit = () => ctx.window[v.handler]();
  const navigate = id => { ctx[v.active] = id ? { id } : null; ctx[v.epoch]++; };
  const setDraft = (text = 'New draft', name = 'new.jpg') => { input.value = text; input.emit('input');
    ctx[v.prefix + 'SeciliResim'] = name ? file(name) : null;
    element(v.prefix + 'ResimInput').emit('change'); preview.innerHTML = name ? 'New preview' : ''; preview.style.display = name ? 'flex' : 'none'; };
  const changeAuth = next => { ctx.auth.currentUser = next; return ctx.authCallback(next); };
  return { ctx, element, input, preview, submit, navigate, setDraft, changeAuth, gates, uploads, compressions, reads, commits, notices, pushes, toasts, imports,
    message: n => commits[n ?? 0]?.find(x => x[0] === 'set'), listeners: () => [...nodes.values()].reduce((sum, node) => sum + node.listenerCount(), 0) };
}

for (const v of variants) {
  test(`${v.name}: image and caption reach one original thread and existing notification/push path`, async () => {
    const f = fixture(v); await f.submit();
    assert.equal(f.uploads[0].path, 'mesaj/chat-A'); assert.equal(f.message()[1].path, 'mesajlar/chat-A/messages/generated');
    assert.equal(f.message()[2].resimUrl, uploaded.url); assert.equal(f.message()[2].metin, 'Original caption');
    assert.equal(f.notices[0][1].aliciEmail, 'chat-a@example.invalid'); assert.deepEqual([...f.pushes[0][0]], ['chat-A@example.invalid']);
    assert.equal(f.ctx[v.prefix + 'SeciliResim'], null); assert.equal(f.input.value, ''); assert.equal(f.listeners(), 0);
  });
  for (const stage of ['compress', 'upload']) {
    test(`${v.name}: navigation during ${stage} cannot change upload/send destination or newer draft`, async () => {
      const f = fixture(v, { pause: stage }), pending = f.submit();
      await flushUntil(() => stage === 'compress' ? f.compressions.length : f.uploads.length);
      assert.equal(f.ctx[v.prefix + 'SeciliResim'], null, 'Original file consumed before another chat can inherit it');
      f.navigate('chat-B'); f.setDraft(); f.gates[stage].resolve(uploaded); await pending;
      assert.equal(f.uploads[0].path, 'mesaj/chat-A'); assert.equal(f.message()[1].path, 'mesajlar/chat-A/messages/generated');
      assert.equal(f.input.value, 'New draft'); assert.equal(f.preview.innerHTML, 'New preview'); assert.equal(f.ctx[v.prefix + 'SeciliResim'].name, 'new.jpg');
    });
    test(`${v.name}: actual auth logout during ${stage} rejects the late callback`, async () => {
      const f = fixture(v, { pause: stage }), pending = f.submit();
      await flushUntil(() => stage === 'compress' ? f.compressions.length : f.uploads.length);
      await f.changeAuth(null); f.gates[stage].resolve(uploaded); await pending;
      assert.equal(f.commits.length, 0); assert.equal(f.reads.length, 0); assert.equal(f.notices.length, 0); assert.equal(f.toasts.length, 0);
      if (stage === 'compress') assert.equal(f.uploads.length, 0);
    });
  }
  test(`${v.name}: double-click/Enter coalesces even when only an attachment is sent`, async () => {
    const f = fixture(v, { pause: 'upload' }); f.input.value = '';
    const first = f.submit(); await flushUntil(() => f.uploads.length); f.setDraft('Second deliberate draft', 'replacement.jpg');
    await f.submit(); assert.equal(f.uploads.length, 1);
    f.gates.upload.resolve(uploaded); await first; assert.equal(f.commits.length, 1);
    assert.equal(f.input.value, 'Second deliberate draft'); assert.equal(f.ctx[v.prefix + 'SeciliResim'].name, 'replacement.jpg');
    await f.submit(); assert.equal(f.commits.length, 2);
  });
  test(`${v.name}: text-only sends once with no compression or upload`, async () => {
    const f = fixture(v, { media: null, pause: 'read' }), first = f.submit(); await f.submit();
    f.gates.read.resolve(); await first;
    assert.equal(f.commits.length, 1); assert.equal(f.uploads.length, 0); assert.equal(f.compressions.length, 0); assert.equal(f.message()[2].resimUrl, undefined);
  });
  test(`${v.name}: failed upload restores untouched caption/file/preview and unlocks retry`, async () => {
    const f = fixture(v, { pause: 'upload' }), first = f.submit(); await flushUntil(() => f.uploads.length);
    f.gates.upload.reject(Error('synthetic upload failure')); await first;
    assert.equal(f.commits.length, 0); assert.equal(f.input.value, 'Original caption'); assert.equal(f.preview.innerHTML, 'Original attachment preview');
    assert.equal(f.ctx[v.prefix + 'SeciliResim'].name, 'original.jpg'); assert.equal(f.toasts.length, 1); assert.equal(f.listeners(), 0);
    await f.submit(); assert.equal(f.uploads.length, 2, 'Failed operation released lock');
  });
  for (const destination of ['chat-B', 'return-A', 'close-reopen-A']) {
    test(`${v.name}: failure after ${destination} does not restore an old draft or notify the new view`, async () => {
      const f = fixture(v, { pause: 'upload' }), first = f.submit(); await flushUntil(() => f.uploads.length);
      f.navigate(destination === 'close-reopen-A' ? null : 'chat-B'); if (destination !== 'chat-B') f.navigate('chat-A');
      f.setDraft(); f.gates.upload.reject(Error('old upload failure')); await first;
      assert.equal(f.input.value, 'New draft'); assert.equal(f.preview.innerHTML, 'New preview'); assert.equal(f.toasts.length, 0);
    });
  }
  test(`${v.name}: failure preserves newly typed-then-cleared text and newly selected-then-canceled file`, async () => {
    const f = fixture(v, { pause: 'upload' }), first = f.submit(); await flushUntil(() => f.uploads.length);
    f.setDraft(); f.setDraft('', null); f.gates.upload.reject(Error('old upload failure')); await first;
    assert.equal(f.input.value, ''); assert.equal(f.ctx[v.prefix + 'SeciliResim'], null); assert.equal(f.preview.innerHTML, '');
  });
  test(`${v.name}: logout/relogin to same email/UID uses actual auth epoch, even if SDK object reused`, async () => {
    const f = fixture(v, { pause: 'upload' }), actor = f.ctx.currentUser, first = f.submit(); await flushUntil(() => f.uploads.length);
    await f.changeAuth(null); f.changeAuth(actor); f.setDraft('New session draft');
    f.gates.upload.resolve(uploaded); await first;
    assert.equal(f.commits.length, 0); assert.equal(f.input.value, 'New session draft'); assert.equal(f.toasts.length, 0);
  });
  test(`${v.name}: Firebase actor replacement is rejected before delayed onAuthStateChanged runs`, async () => {
    const f = fixture(v, { pause: 'upload' }), first = f.submit(); await flushUntil(() => f.uploads.length);
    f.ctx.auth.currentUser = user(); // Same UID/email, different authenticated SDK instance.
    f.gates.upload.resolve(uploaded); await first; assert.equal(f.commits.length, 0);
  });
  test(`${v.name}: actual signOut invalidates immediately, before Firebase completion/listener`, async () => {
    const f = fixture(v, { pause: 'logout' }); const upload = deferred();
    f.ctx.medyaYukle = async () => { f.uploads.push(true); return upload.promise; };
    const first = f.submit(); await flushUntil(() => f.uploads.length); const logout = f.ctx.window.signOut();
    assert.ok(f.ctx.auth.currentUser, 'SDK signOut remains unresolved');
    upload.resolve(uploaded); await first; assert.equal(f.commits.length, 0);
    f.gates.logout.resolve(); await logout;
  });
  test(`${v.name}: delayed Firestore thread read cannot write after account switch`, async () => {
    const f = fixture(v, { media: null, pause: 'read' }), first = f.submit(); await flushUntil(() => f.reads.length);
    f.changeAuth({ uid: 'other', email: 'other@example.invalid' }); f.gates.read.resolve(); await first;
    assert.equal(f.commits.length, 0); assert.equal(f.notices.length, 0);
  });
  test(`${v.name}: a second chat can send while first is pending, without shared button ownership`, async () => {
    const f = fixture(v, { pause: 'upload' }), first = f.submit(); await flushUntil(() => f.uploads.length);
    f.navigate('chat-B'); f.setDraft('B text', null); await f.submit(); assert.equal(f.commits.length, 1);
    f.setDraft('B next text', 'new.jpg'); f.gates.upload.resolve(uploaded); await first;
    assert.equal(f.commits.length, 2); assert.equal(f.message(0)[1].path, 'mesajlar/chat-B/messages/generated');
    assert.equal(f.message(1)[1].path, 'mesajlar/chat-A/messages/generated'); assert.equal(f.input.value, 'B next text');
  });
}

test('modern parent document path captures original thread and retains metadata', async () => {
  const f = fixture(variants[1], { media: 'document', pause: 'upload' }), first = f.submit();
  await flushUntil(() => f.uploads.length); f.navigate('chat-B'); f.setDraft(); f.gates.upload.resolve(uploaded); await first;
  assert.equal(f.uploads[0].path, 'mesaj/chat-A'); assert.equal(f.uploads[0].options[0], false); assert.equal(f.compressions.length, 0);
  assert.equal(f.message()[2].belgeAd, 'original.pdf'); assert.equal(f.message()[2].belgeUrl, uploaded.url); assert.equal(f.ctx.caMsgSeciliBelge, null);
});
for (const stage of ['commit', 'notice', 'import']) {
  test(`shared send suppresses next notification stage after session changes during ${stage}`, async () => {
    const f = fixture(variants[0], { media: null, pause: stage }), first = f.submit();
    await flushUntil(() => stage === 'commit' ? f.commits.length : stage === 'notice' ? f.notices.length : f.imports.length);
    await f.changeAuth(null); f.gates[stage].resolve(); await first;
    assert.equal(f.commits.length, 1, 'An already-issued commit cannot be recalled');
    assert.equal(f.notices.length, stage === 'commit' ? 0 : 1); assert.equal(f.pushes.length, 0);
  });
}
test('old session finalizer cannot unlock new same-thread upload after relogin', async () => {
  const f = fixture(), gates = [deferred(), deferred()]; let index = 0;
  f.ctx.medyaYukle = async () => { const i = index++; f.uploads.push(i); return gates[i].promise; };
  const first = f.submit(); await flushUntil(() => f.uploads.length === 1);
  await f.changeAuth(null); f.changeAuth(user()); f.setDraft('New session message'); const second = f.submit();
  await flushUntil(() => f.uploads.length === 2); gates[0].resolve(uploaded); await first;
  f.setDraft('Next message'); await f.submit(); assert.equal(f.uploads.length, 2, 'Second operation still owns lock');
  gates[1].resolve(uploaded); await second; assert.equal(f.commits.length, 1); assert.equal(f.message()[2].metin, 'New session message'); assert.equal(f.input.value, 'Next message');
});
test('shared direct callers capture session by default and abort during getDoc', async () => {
  const f = fixture(variants[0], { pause: 'read' });
  const first = vm.runInContext('mesajGonder("chat-A", "Direct caller")', f.ctx);
  await flushUntil(() => f.reads.length); f.ctx.auth.currentUser = null; f.gates.read.resolve();
  await assert.rejects(first, { name: 'AbortError' }); assert.equal(f.commits.length, 0);
});
for (const v of variants) {
  test(`${v.name}: unauthenticated/mismatched caller cannot consume a draft or start upload`, async () => {
    for (const change of [f => f.ctx.auth.currentUser = null, f => f.ctx.currentUser = user()]) {
      const f = fixture(v); change(f); await f.submit();
      assert.equal(f.uploads.length, 0); assert.equal(f.commits.length, 0); assert.equal(f.input.value, 'Original caption');
      assert.equal(f.ctx[v.prefix + 'SeciliResim'].name, 'original.jpg');
    }
  });
  test(`${v.name}: empty upload result fails without silently delivering caption alone`, async () => {
    const f = fixture(v); f.ctx.medyaYukle = async () => ({}); await f.submit();
    assert.equal(f.commits.length, 0); assert.equal(f.input.value, 'Original caption'); assert.equal(f.ctx[v.prefix + 'SeciliResim'].name, 'original.jpg');
  });
}
test('shared send rechecks session immediately before issuing batch commit', async () => {
  const f = fixture(variants[0], { media: null }), realBatch = f.ctx.writeBatch;
  f.ctx.writeBatch = () => { const batch = realBatch(); const update = batch.update;
    batch.update = (...args) => { update(...args); f.ctx.portalOturumSurumu++; }; return batch; };
  await f.submit(); assert.equal(f.commits.length, 0); assert.equal(f.notices.length, 0);
});
test('missing thread failure restores only the still-current composer and never toasts another chat', async () => {
  for (const moved of [false, true]) {
    const f = fixture(), gate = deferred(); f.ctx.getDoc = async () => { f.reads.push(true); await gate.promise; return { exists: () => false }; };
    const first = f.submit(); await flushUntil(() => f.reads.length);
    if (moved) { f.navigate('chat-B'); f.setDraft(); }
    gate.resolve(); await first; assert.equal(f.commits.length, 0); assert.equal(f.toasts.length, moved ? 0 : 1);
    assert.equal(f.input.value, moved ? 'New draft' : 'Original caption');
  }
});
test('document failure restores original document; session change prevents document delivery', async () => {
  for (const logout of [false, true]) {
    const f = fixture(variants[1], { media: 'document', pause: 'upload' }), first = f.submit(); await flushUntil(() => f.uploads.length);
    if (logout) { await f.changeAuth(null); f.gates.upload.resolve(uploaded); } else f.gates.upload.reject(Error('synthetic failure'));
    await first; assert.equal(f.commits.length, 0);
    assert.equal(f.ctx.caMsgSeciliBelge?.name, logout ? undefined : 'original.pdf');
  }
});
for (const v of variants) {
  for (const changed of ['text only', 'attachment only']) {
    test(`${v.name}: failed send cannot mix original draft with newer ${changed}`, async () => {
      const f = fixture(v, { pause: 'upload' }), first = f.submit(); await flushUntil(() => f.uploads.length);
      if (changed === 'text only') { f.input.value = 'New text only'; f.input.emit('input'); }
      else { f.ctx[v.prefix + 'SeciliResim'] = file('new-only.jpg'); f.element(v.prefix + 'ResimInput').emit('change'); f.preview.innerHTML = 'New attachment only'; }
      f.gates.upload.reject(Error('original upload failed')); await first;
      assert.equal(f.input.value, changed === 'text only' ? 'New text only' : '');
      assert.equal(f.ctx[v.prefix + 'SeciliResim']?.name, changed === 'text only' ? undefined : 'new-only.jpg');
      assert.equal(f.preview.innerHTML, changed === 'text only' ? '' : 'New attachment only');
    });
  }
}
