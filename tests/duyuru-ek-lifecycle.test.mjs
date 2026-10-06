import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { File } from 'node:buffer';

// Real form, upload/cleanup and save handlers; synthetic media and Firestore only.
const source = await readFile(process.env.PORTAL_SOURCE || new URL('../index.html', import.meta.url), 'utf8');
const attachments = (await readFile(new URL('../moduller/duyuru-ekleri.js', import.meta.url), 'utf8')).replace(/^export /gm, '');
function section(start, end) {
  const at = source.indexOf(start), to = source.indexOf(end, at + start.length);
  assert.ok(at >= 0 && to > at);
  return source.slice(at, to);
}
const handlers = [
  section('window.openDuyuruModal =', '// Hedef türü değiştiğinde'),
  section('let portalDuyuruKaydediliyor =', '// Hedef velilere mail gönder'),
  section('window.openEtkinlikModal =', 'window.etkinlikHedefDegisti ='),
  section('let portalEtkinlikKaydediliyor =', 'async function etkinlikMailGonder(')
].join('\n');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

async function environment(kind) {
  const deleted = [], writes = [], elements = new Map(), writeStarted = deferred(), notifyStarted = deferred();
  const controls = { write: null, notify: null };
  const element = id => {
    if (id === 'duyuruEkAlani' || id === 'etkinlikEkAlani') return null;
    if (!elements.has(id)) elements.set(id, {
      value: '', checked: false, style: {}, classList: { add() {}, remove() {}, contains: () => true }
    });
    return elements.get(id);
  };
  const save = async (ref, data) => {
    writeStarted.resolve();
    if (controls.write) await controls.write.promise;
    writes.push({ ref, data });
  };
  const ctx = vm.createContext({
    File, URL, console, document: { getElementById: element, addEventListener() {} },
    addEventListener() {},
    PortalAPI: { medya: {
      yukle: async () => ({ url: 'https://media.example.invalid/attachment.txt', yol: `${kind}/2026-10/attachment.txt` }),
      sil: async path => { deleted.push(path); }
    } },
    showToast() {}, danismaSaltOkunurEngelle: () => false, ogretmenRolMu: () => false,
    currentUser: { email: 'staff@example.invalid' }, db: {},
    collection: (_db, name) => ({ name }), doc: () => ({ id: 'synthetic' }),
    setDoc: save, updateDoc: save,
    portalHedefBildir: async () => {
      notifyStarted.resolve();
      if (controls.notify) await controls.notify.promise;
      return { ok: true };
    },
    duyuruMailGonder() {}, etkinlikMailGonder() {}, renderDuyurular() {}, renderEtkinlikler() {}
  });
  ctx.window = ctx;
  vm.runInContext(attachments + '\n' + handlers, ctx);
  ctx.modulYukle = async () => ctx.duyuruEkleri;
  const prefix = kind === 'duyurular' ? 'duyuru' : 'etkinlik';
  element(prefix + 'Baslik').value = 'Synthetic notice';
  element(prefix + 'Icerik').value = 'Synthetic content';
  element(prefix + 'Tarih').value = '2026-10-06';
  element(prefix + 'HedefTur').value = 'tumOkul';
  ctx.duyuruEkleri.formHazirla([], prefix);
  await ctx.dosyalariEkle([new File(['synthetic attachment'], 'example.txt', { type: 'text/plain' })]);
  assert.equal(ctx.duyuruEkleri.formEkleri().length, 1);
  const name = prefix === 'duyuru' ? 'Duyuru' : 'Etkinlik';
  return { ctx, controls, deleted, writes, element, prefix, writeStarted, notifyStarted,
    save: () => ctx['kaydet' + name](), close: () => ctx['close' + name + 'Modal']() };
}

for (const kind of ['duyurular', 'etkinlikler']) {
  test(`${kind}: closing during the pending database write cannot delete attachments`, async () => {
    const e = await environment(kind);
    e.controls.write = deferred();
    const pending = e.save();
    await e.writeStarted.promise;
    e.close();
    assert.deepEqual(e.deleted, []);
    e.controls.write.resolve();
    await pending;
    assert.equal(e.writes[0].data.ekler.length, 1);
    assert.deepEqual(e.deleted, []);
  });

  test(`${kind}: committed attachment survives cleanup while notifications are pending`, async () => {
    const e = await environment(kind);
    e.controls.notify = deferred();
    const pending = e.save();
    await e.notifyStarted.promise;
    // Exercise real attachment cleanup independently of the close-button guard.
    e.ctx.duyuruEkleri.formKapandi();
    assert.deepEqual(e.deleted, []);
    e.controls.notify.resolve();
    await pending;
  });

  test(`${kind}: shared attachment form cannot be replaced during save`, async () => {
    const e = await environment(kind);
    e.controls.write = deferred();
    const pending = e.save();
    await e.writeStarted.promise;
    // The unguarded handlers reach UI helpers absent from this test environment.
    e.ctx.openDuyuruModal();
    e.ctx.openEtkinlikModal();
    assert.equal(e.ctx.duyuruEkleri.formEkleri().length, 1);
    e.controls.write.resolve();
    await pending;
    assert.deepEqual(e.deleted, []);
  });

  test(`${kind}: failed write leaves the attachment available for retry`, async () => {
    const e = await environment(kind);
    e.controls.write = deferred();
    const pending = e.save();
    await e.writeStarted.promise;
    e.controls.write.reject(new Error('synthetic-write-failure'));
    await pending;
    assert.equal(e.ctx.duyuruEkleri.formEkleri().length, 1);
    assert.deepEqual(e.deleted, []);
    e.controls.write = null;
    await e.save();
    assert.equal(e.writes.length, 1);
    assert.deepEqual(e.deleted, []);
  });

  test(`${kind}: cancelling an unsaved form still removes its temporary upload`, async () => {
    const e = await environment(kind);
    e.close();
    assert.deepEqual(e.deleted, [`${kind}/2026-10/attachment.txt`]);
    assert.equal(e.writes.length, 0);
  });

  test(`${kind}: an edited record retains its newly uploaded attachment`, async () => {
    const e = await environment(kind);
    e.element(e.prefix + 'DuzenleId').value = 'existing';
    await e.save();
    assert.equal(e.writes[0].data.ekler.length, 1);
    assert.deepEqual(e.deleted, []);
  });
}
