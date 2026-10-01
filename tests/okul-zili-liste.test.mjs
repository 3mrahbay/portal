import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const coreSource = await read('js/okul-zili-liste-core.js');
const coreUrl = 'data:text/javascript;base64,' + Buffer.from(coreSource).toString('base64');
const { bildirimZamani, enYeniBildirimOnce, canliListeOlustur } = await import(coreUrl);
const index = await read('index.html');
const attendanceSource = (await read('js/sabah-yoklama-core.js')).replace('./okul-zili-liste-core.js?v=168', coreUrl);
const attendanceUrl = 'data:text/javascript;base64,' + Buffer.from(attendanceSource).toString('base64');
const { sabahBugun, sabahDurumu, sabahVerileriniDinle } = await import(attendanceUrl);
const morningSource = (await read('moduller/sabah-girisi.js'))
  .replace('../js/okul-zili-liste-core.js?v=168', coreUrl).replace('../js/sabah-yoklama-core.js?v=168', attendanceUrl);
const tick = () => new Promise(resolve => setImmediate(resolve));
const snapshot = records => ({ forEach(fn) { records.forEach(({ id, ...data }) => fn({ id, data: () => data })); } });
const iso = minute => `2026-10-01T06:${String(minute).padStart(2, '0')}:00.000Z`;

function environment() {
  const nodes = new Map();
  const subscriptions = [];
  const writes = [];
  const warnings = [];
  const fb = {
    doc: (_, name, id) => ({ name, id }), collection: (_, name) => ({ name }), where: (...args) => args,
    query: (collection, ...filters) => ({ ...collection, filters }),
    onSnapshot(query, next, error) {
      const sub = { query, next, error, stopped: false };
      subscriptions.push(sub);
      return () => { sub.stopped = true; };
    },
    getDocs() { throw new Error('Snapshot render must not refetch'); },
    setDoc(...args) { writes.push(args); }, updateDoc(...args) { writes.push(args); },
  };
  const document = { getElementById: id => nodes.get(id) || null };
  function mount(id) {
    const node = { innerHTML: '', textContent: '', querySelector: () => null };
    nodes.set(id, node); return node;
  }
  return { nodes, subscriptions, writes, warnings, fb, document, mount };
}
function pickup(role = 'danisma') {
  const e = environment();
  const list = e.mount('okulZiliListe'), summary = e.mount('okulZiliOzet');
  const ctx = {
    document: e.document, ...e.fb, db: {}, console: { warn: (...args) => e.warnings.push(args) },
    currentUser: { uid: 'staff-one' }, aktifKullaniciRol: role, aktifKullaniciSiniflari: ['A'],
    ogrenciList: [], bildirimZamani, enYeniBildirimOnce, canliListeOlustur,
    vzBugun: () => '2026-10-01',
  };
  ctx.window = ctx;
  ctx.danismaRolMu = () => ctx.aktifKullaniciRol === 'danisma';
  ctx.ogretmenRolMu = () => ctx.aktifKullaniciRol === 'ogretmen';
  ctx.okulZiliKoleksiyonu = () => ctx.danismaRolMu() ? 'danismaPickupBildirimleri' : 'pickupBildirimleri';
  vm.createContext(ctx);
  const start = index.indexOf('// Boş kuyrukta da tek canlı abonelik');
  const end = index.indexOf('// Özet sayfası hızlı işlem butonları', start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(index.slice(start, end), ctx);
  return { ...e, ctx, list, summary };
}
const record = (id, minute, extra = {}) => ({ id, ogrenciId: id, ogrenciAd: `Child-${id}`, sinif: 'A', olusturuldu: iso(minute), durum: 'yolda', ...extra });
const order = html => [...html.matchAll(/>\s*Child-([A-Za-z0-9]+)/g)].map(m => m[1]);

// Parse only the event timestamp; malformed values never poison the comparator.
test('event time accepts Firestore, Date, ISO and epoch milliseconds safely', () => {
  const ms = Date.parse(iso(10));
  const values = [iso(10), new Date(ms), ms, { toMillis: () => ms },
    { toDate: () => new Date(ms) }, { seconds: ms / 1000, nanoseconds: 0 }, { seconds: ms / 1000 }];
  for (const value of values) assert.equal(bildirimZamani(value), ms);
  for (const value of [undefined, null, '', 'invalid', {}, Infinity, NaN, new Date('invalid'),
    { toMillis: () => Infinity }, { toMillis() { throw Error(); } }, { seconds: 1, nanoseconds: -1 }]) {
    assert.equal(bildirimZamani(value), 0);
  }
});
test('newest-first comparator is deterministic for ties and ignores status/target/update times', () => {
  const records = [record('z', 5), record('b', 10), record('a', 10), record('missing', 0, { olusturuldu: '' })];
  records[0].guncellendi = iso(50); records[0].hedefSaat = '23:59'; records[1].durum = 'teslim';
  assert.deepEqual(records.sort(enYeniBildirimOnce).map(r => r.id), ['a', 'b', 'z', 'missing']);
});
test('empty pickup queue remains subscribed and displays the first new request', () => {
  const e = pickup(); e.ctx.okulZiliDoldur();
  assert.equal(e.subscriptions.length, 1);
  const s = e.subscriptions[0];
  assert.equal(s.query.name, 'danismaPickupBildirimleri');
  s.next(snapshot([])); assert.match(e.list.innerHTML, /Bugün için çıkış bildirimi yok/);
  assert.equal(s.stopped, false);
  s.next(snapshot([record('first', 10)]));
  assert.deepEqual(order(e.list.innerHTML), ['first']);
  assert.match(e.summary.textContent, /1 bekliyor/);
  assert.equal(e.subscriptions.length, 1); assert.equal(e.writes.length, 0);
});
test('live pickup snapshots reorder, remove and cancel records without losing delivery controls', () => {
  const e = pickup(); e.ctx.okulZiliDoldur(); const s = e.subscriptions[0];
  s.next(snapshot([record('old', 5, { hedefSaat: '23:30' }), record('new', 10, { hedefSaat: '01:00' })]));
  assert.deepEqual(order(e.list.innerHTML), ['new', 'old']);
  assert.match(e.list.innerHTML, /Kapıda<\/button>/); assert.match(e.list.innerHTML, /Kimlik ✓<\/button>/);
  assert.match(e.list.innerHTML, /pickupDanismaNotuPortal/); assert.match(e.list.innerHTML, /pickupHazirla/);
  s.next(snapshot([record('old', 5, { durum: 'hazir', guncellendi: iso(55) }), record('new', 10, { durum: 'teslim' })]));
  assert.deepEqual(order(e.list.innerHTML), ['new', 'old']); assert.match(e.list.innerHTML, /pickupTeslimEt/);
  s.next(snapshot([record('old', 5, { durum: 'iptal' })]));
  assert.deepEqual(order(e.list.innerHTML), []); assert.match(e.summary.textContent, /Bugün bildirim yok/);
  s.next(snapshot([record('return', 20)])); assert.deepEqual(order(e.list.innerHTML), ['return']);
  e.ctx.okulZiliDoldur(); e.ctx.okulZiliCanliBaslat();
  assert.equal(e.subscriptions.length, 1); assert.deepEqual(order(e.list.innerHTML), ['return']);
});
test('pickup permission errors clear stale rows and allow an explicit retry', () => {
  const e = pickup(); e.ctx.okulZiliDoldur(); const s = e.subscriptions[0];
  s.next(snapshot([record('first', 10)])); s.error({ code: 'permission-denied' });
  assert.equal(s.stopped, true); assert.doesNotMatch(e.list.innerHTML, /Child-first/);
  assert.match(e.list.innerHTML, /Yeniden dene/); assert.doesNotMatch(e.list.innerHTML, /Bugün için çıkış bildirimi yok/);
  e.ctx.okulZiliDoldur(); assert.equal(e.subscriptions.length, 2);
  s.next(snapshot([record('stale', 50)])); assert.doesNotMatch(e.list.innerHTML, /stale/);
  e.subscriptions[1].next(snapshot([record('fresh', 20)])); assert.deepEqual(order(e.list.innerHTML), ['fresh']);
});
test('pickup navigation, session and role changes reject old callbacks', () => {
  const e = pickup(); e.ctx.okulZiliDoldur(); const old = e.subscriptions[0];
  e.ctx.okulZiliCanliDurdur(); old.next(snapshot([record('stale', 10)])); assert.equal(e.list.innerHTML, '');
  const nextList = e.mount('okulZiliListe'); e.ctx.okulZiliDoldur(); assert.equal(e.subscriptions.length, 2);
  old.next(snapshot([record('stale', 10)])); assert.equal(nextList.innerHTML, '');
  e.ctx.aktifKullaniciRol = 'ogretmen'; e.ctx.currentUser = { uid: 'staff-two' };
  e.ctx.okulZiliDoldur(); assert.equal(e.subscriptions[1].stopped, true);
  const current = e.subscriptions[2]; assert.equal(current.query.name, 'pickupBildirimleri');
  e.subscriptions[1].next(snapshot([record('stale', 59)])); assert.equal(nextList.innerHTML, '');
  current.next(snapshot([record('mine', 10), record('other', 20, { sinif: 'B' })]));
  assert.deepEqual(order(nextList.innerHTML), ['mine']);
  e.nodes.delete('okulZiliListe'); current.next(snapshot([])); assert.equal(current.stopped, true);
});
test('pickup protects reception fields and handles Timestamp rendering without sounds or writes', () => {
  const e = pickup(); e.ctx.okulZiliDoldur(); const s = e.subscriptions[0];
  s.next(snapshot([record('old', 5), record('fresh', 10, { olusturuldu: { seconds: Date.parse(iso(10)) / 1000 },
    veliEmail: 'private@example.test', veliTelefon: '555-secret', veliOnaylayan: 'hidden@example.test' })]));
  const html = e.list.innerHTML; assert.deepEqual(order(html), ['fresh', 'old']);
  assert.doesNotMatch(html, /private@example|555-secret|hidden@example|null/);
  for (let i = 0; i < 3; i++) { s.next(snapshot([record('fresh', 10)])); e.ctx.okulZiliDoldur(); }
  assert.equal(e.subscriptions.length, 1); assert.equal(e.writes.length, 0);
  const affected = index.slice(index.indexOf('// Boş kuyrukta'), index.indexOf('// Özet sayfası hızlı işlem butonları'));
  assert.doesNotMatch(affected + coreSource, /showPortalNotice|setupMessageSound|operasyonPushTetikle|new Audio|fetch\(/);
});

async function morning({ authorize = false, count = 12 } = {}) {
  const e = environment(); const list = e.mount('morning');
  const state = { currentUser: { uid: 'teacher-one' }, rol: 'ogretmen', siniflar: ['A'], ogrenciList: [], ayarListesi: {} };
  for (let n = 1; n <= count; n++) {
    const id = String(n).padStart(2, '0'); state.ogrenciList.push({ id, ogrenciAdSoyad: 'Child-' + id, sinif: 'A' });
    state.ayarListesi[id] = {};
  }
  globalThis.window = { PortalAPI: { fb: e.fb, db: {}, state, yoklamaGorebilir: () => authorize && state.rol !== 'danisma', esc: s => String(s), bugun: () => '2026-10-01', ogrenciDurum: () => 'aktif', lucide() {} } };
  globalThis.document = e.document;
  // Freeze weekday without changing production code or relying on execution day.
  const source = morningSource.replace('function haftaSonuMu() { const g = new Date().getDay(); return g === 0 || g === 6; }', 'function haftaSonuMu() { return false; }');
  const m = await import('data:text/javascript;base64,' + Buffer.from(source + `\n// fixture ${Math.random()}`).toString('base64'));
  return { ...e, m, state, list, bridge: window._sabahGirisi };
}
test('morning displays all twelve waiting children and newest notices first on live changes', async () => {
  const e = await morning(); await e.m.ogretmenKart('morning'); const s = e.subscriptions[0];
  assert.equal(s.query.name, 'sabahGirisleri'); s.next(snapshot([])); await tick();
  assert.equal(order(e.list.innerHTML).length, 12); assert.match(e.list.innerHTML, /Bekleniyor 12/);
  const old = { id: '01', ogrenciId: '01', veliBildirdi: true, veliBildirimSaati: iso(5) };
  const fresh = { id: '12', ogrenciId: '12', veliBildirdi: true, veliBildirimSaati: { seconds: Date.parse(iso(10)) / 1000 } };
  s.next(snapshot([old, fresh])); await tick(); assert.deepEqual(order(e.list.innerHTML).slice(0, 2), ['12', '01']);
  assert.equal(order(e.list.innerHTML).length, 12);
  s.next(snapshot([{ ...old, sinifaGirisOnayi: iso(59), guncellendi: iso(59) }, fresh])); await tick();
  assert.equal(order(e.list.innerHTML)[0], '12'); assert.equal(order(e.list.innerHTML).at(-1), '01'); assert.match(e.list.innerHTML, /Geldi \/ teslim alındı 1/);
  s.next(snapshot([old])); await tick(); assert.equal(order(e.list.innerHTML)[0], '01');
  await e.m.ogretmenKart('morning'); assert.equal(e.subscriptions.length, 1); assert.equal(e.writes.length, 0);
  e.bridge.durdur();
});
test('morning permissions, navigation, role scope and stale callbacks are safe', async () => {
  const e = await morning(); await e.m.ogretmenKart('morning'); const old = e.subscriptions[0];
  old.next(snapshot([])); await tick(); old.error({ code: 'permission-denied' });
  assert.equal(old.stopped, true); assert.match(e.list.innerHTML, /Sabah girişleri yüklenemedi/);
  assert.doesNotMatch(e.list.innerHTML, /Child-/);
  e.state.rol = 'danisma'; await e.m.ogretmenKart('morning');
  assert.equal(e.subscriptions[1].query.name, 'danismaSabahGirisleri');
  old.next(snapshot([])); await tick(); assert.doesNotMatch(e.list.innerHTML, /Child-/);
  const newList = e.mount('morning'); await e.m.ogretmenKart('morning'); assert.equal(e.subscriptions[1].stopped, true);
  e.subscriptions[1].next(snapshot([])); await tick(); assert.match(newList.innerHTML, /Sabah girişleri yükleniyor/);
  e.subscriptions[2].next(snapshot([])); await tick(); assert.equal(order(newList.innerHTML).length, 12);
  e.bridge.durdur(); e.subscriptions[2].next(snapshot([])); await tick(); assert.equal(e.subscriptions[2].stopped, true);
  assert.match(index, /window\._sabahGirisi\?\.durdur\?\.\(\)/);
});
test('single-list controller handles synchronous subscription errors and deferred old events', () => {
  const c = canliListeOlustur(); let stopped = 0, errors = 0, renders = 0;
  const config = { key: 'k', target: {}, isCurrent: () => true, render: () => renders++, onError: () => errors++ };
  c.baslat({ ...config, subscribe(next, error) { error({ code: 'permission-denied' }); return () => stopped++; } });
  assert.equal(stopped, 1); assert.equal(errors, 1); assert.equal(renders, 0);
  c.baslat({ ...config, subscribe() { throw Error('unavailable'); } }); assert.equal(errors, 2);
});

// UI refreshes must pick up new student metadata without making another subscription.
test('cached pickup snapshot refreshes roster metadata and class changes replace the subscription', () => {
  const e = pickup('ogretmen'); e.ctx.okulZiliDoldur(); const old = e.subscriptions[0];
  old.next(snapshot([record('roster', 10, { ogrenciAd: '' })]));
  e.ctx.ogrenciList = [{ id: 'roster', ogrenciAdSoyad: 'Child-renamed', sinif: 'A' }];
  e.ctx.okulZiliDoldur(); assert.deepEqual(order(e.list.innerHTML), ['renamed']);
  assert.equal(e.subscriptions.length, 1);
  e.ctx.aktifKullaniciSiniflari = ['B']; e.ctx.okulZiliDoldur(); assert.equal(old.stopped, true);
  e.subscriptions[1].next(snapshot([record('A', 20), record('B', 5, { sinif: 'B' })]));
  assert.deepEqual(order(e.list.innerHTML), ['B']);
});
test('morning cached snapshot refreshes roster and class changes replace the subscription', async () => {
  const e = await morning(); await e.m.ogretmenKart('morning'); const old = e.subscriptions[0];
  old.next(snapshot([])); await tick();
  e.state.ogrenciList.push({ id: '13', ogrenciAdSoyad: 'Child-13', sinif: 'A' }); e.state.ayarListesi['13'] = {};
  await e.m.ogretmenKart('morning'); assert.equal(order(e.list.innerHTML).length, 13);
  assert.equal(e.subscriptions.length, 1);
  e.state.siniflar = ['B']; await e.m.ogretmenKart('morning'); assert.equal(old.stopped, true);
  e.subscriptions[1].next(snapshot([])); await tick(); assert.equal(order(e.list.innerHTML).length, 0);
  e.bridge.durdur();
});

const attendanceDoc = (kayitlar = {}, extra = {}) => ({ exists: () => true, data: () => ({ kayitlar, ...extra }) });
const arrival = (id, minute, extra = {}) => ({ id, ogrenciId: id, veliBildirdi: true, veliBildirimSaati: iso(minute), ...extra });
const section = (html, id) => html.match(new RegExp('data-sabah-ogrenci="'+id+'"[\\s\\S]*?(?=data-sabah-ogrenci=|$)'))?.[0] || '';
test('local morning calendar day matches attendance and ZEKY even near UTC midnight', () => {
  const local = { getFullYear: () => 2026, getMonth: () => 9, getDate: () => 2, toISOString: () => '2026-10-01T21:30:00Z' };
  assert.equal(sabahBugun(local), '2026-10-02');
  assert.match(morningSource, /Object.create\(api\)/); assert.doesNotMatch(morningSource, /sabahGirisKaydet\(\{ \.\.\.api/);
});
test('absence states and aliases do not offer receive; attendance arrived does not invent handover', () => {
  for (const status of ['gelmedi','yok','devamsiz','devamsız','izinli','izin','hasta']) {
    const result = sabahDurumu({}, { durum: status }); assert.equal(result.grup,'gelmeyen'); assert.equal(result.eylem,false);
  }
  assert.deepEqual(sabahDurumu({}, { durum:'geldi' }),{grup:'tamam',durum:'geldi',teslim:false,eylem:false});
  assert.equal(sabahDurumu({}, { durum:'var' }).durum,'geldi');
  assert.equal(sabahDurumu({}, {}, true).durum,'izinli');
  assert.equal(sabahDurumu({}, { durum:'geldi' }, true).durum,'geldi');
  assert.equal(sabahDurumu({}, { durum:'unknown-status' }, true).durum,'diger');
});
test('conflicts preserve received and new/unknown arrival evidence without inventing chronology', () => {
  for (const status of ['gelmedi','izinli','hasta']) {
    const y = {durum:status,kayitZamani:iso(20)};
    assert.equal(sabahDurumu(arrival('a',10),y).grup,'gelmeyen');
    assert.equal(sabahDurumu(arrival('a',20),y).grup,'gelmeyen');
    assert.equal(sabahDurumu(arrival('a',30),y).grup,'kontrol');
    assert.equal(sabahDurumu(arrival('a',10),{durum:status}).grup,'kontrol');
    assert.equal(sabahDurumu({sinifaGirisOnayi:iso(5)},y).grup,'kontrol');
    assert.equal(sabahDurumu({veliBildirdi:true},{durum:status,kayitZamani:iso(20)}).grup,'kontrol');
  }
  assert.equal(sabahDurumu({}, {}, false, false).eylem,false);
});
test('42-child screenshot case shows all nine non-arrivals with statuses before 33 completed', async () => {
  const e = await morning({authorize:true,count:42}); e.m.ogretmenKart('morning');
  assert.deepEqual(e.subscriptions.map(s=>s.query.name),['sabahGirisleri','devamsizlik','veliIzinleri']);
  const day = e.subscriptions[0].query.filters[0][2]; assert.equal(e.subscriptions[1].query.id,day);
  e.subscriptions[0].next(snapshot(Array.from({length:33},(_,n)=>arrival(String(n+1).padStart(2,'0'),n,{sinifaGirisOnayi:iso(40)}))));
  const absent = Object.fromEntries(Array.from({length:9},(_,n)=>[String(n+34),{durum:['gelmedi','izinli','hasta'][n%3],kayitZamani:iso(50),not:'private health note',kaydeden:'private@example.test'}]));
  e.subscriptions[1].next(attendanceDoc(absent)); e.subscriptions[2].next(snapshot([])); await tick();
  assert.match(e.list.innerHTML,/Bekleniyor 0/); assert.match(e.list.innerHTML,/Bekleyen geliş yok/);
  assert.match(e.list.innerHTML,/Gelmedi · İzinli · Hasta \(9\)/);
  assert.equal(order(e.list.innerHTML).length,42); assert.equal(e.list.innerHTML.match(/data-sabah-grup="gelmeyen"/g).length,9);
  assert.equal(e.list.innerHTML.includes('window._sabahGirisi.onayla('),false);
  assert.ok(e.list.innerHTML.indexOf('Child-34')<e.list.innerHTML.indexOf('Child-01'));
  assert.doesNotMatch(e.list.innerHTML,/private health|private@example/); assert.equal(e.writes.length,0); e.bridge.durdur();
});
test('live attendance and approved leave update morning list without reload or writing', async () => {
  const e = await morning({authorize:true}); e.m.ogretmenKart('morning');
  e.subscriptions[0].next(snapshot([arrival('01',10)]));
  assert.doesNotMatch(e.list.innerHTML,/window._sabahGirisi.onayla/); assert.match(e.list.innerHTML,/Yoklama ve izin bilgisi okunuyor/);
  const day=e.subscriptions[1].query.id;
  e.subscriptions[1].next(attendanceDoc({'01':{durum:'gelmedi',kayitZamani:iso(20)}}));
  e.subscriptions[2].next(snapshot([{id:'leave',durum:'onayli',ogrenciId:'02',baslangic:day,bitis:day,sebep:'private reason'}]));
  assert.match(section(e.list.innerHTML,'01'),/data-sabah-grup="gelmeyen"/);
  assert.match(section(e.list.innerHTML,'02'),/İzinli/);
  e.subscriptions[1].next(attendanceDoc({'01':{durum:'geldi',kayitZamani:iso(30)},'02':{durum:'geldi'}}));
  assert.match(section(e.list.innerHTML,'01'),/Yoklamada geldi/); assert.match(section(e.list.innerHTML,'02'),/Yoklamada geldi/);
  e.subscriptions[1].next(attendanceDoc({})); e.subscriptions[2].next(snapshot([]));
  assert.match(section(e.list.innerHTML,'01'),/data-sabah-grup="aktif"/);
  assert.equal(e.subscriptions.length,3); assert.equal(e.writes.length,0); e.bridge.durdur();
});
test('received versus absent conflicts remain visible outside completed details', async () => {
  const e = await morning({authorize:true});e.m.ogretmenKart('morning');
  e.subscriptions[0].next(snapshot([arrival('01',10,{sinifaGirisOnayi:iso(15)}),arrival('02',40)]));
  e.subscriptions[1].next(attendanceDoc({'01':{durum:'hasta',kayitZamani:iso(20)},'02':{durum:'gelmedi',kayitZamani:iso(20)}}));
  e.subscriptions[2].next(snapshot([]));
  assert.match(section(e.list.innerHTML,'01'),/Teslim onayı var · Yoklama: Hasta/);
  assert.match(section(e.list.innerHTML,'02'),/Geliş bildirimi var · Yoklama: Gelmedi/);
  assert.match(e.list.innerHTML,/Kontrol gerekli 2/);assert.doesNotMatch(section(e.list.innerHTML,'01').split('</div>')[0],/data-sabah-grup="tamam"/);
  assert.equal(order(e.list.innerHTML)[0],'02');e.bridge.durdur();
});
test('attendance permission failure is explicit, disables uncertain receipt, and stops all on navigation', async () => {
  const e = await morning({authorize:true});e.m.ogretmenKart('morning');
  e.subscriptions[0].next(snapshot([]));e.subscriptions[1].error({code:'permission-denied'});e.subscriptions[2].next(snapshot([]));
  assert.match(e.list.innerHTML,/Yoklama veya izin bilgisi doğrulanamadı/);assert.doesNotMatch(e.list.innerHTML,/window._sabahGirisi.onayla/);
  const before=e.list.innerHTML;e.bridge.durdur();assert.ok(e.subscriptions.every(s=>s.stopped));
  e.subscriptions[1].next(attendanceDoc({'01':{durum:'hasta'}}));assert.equal(e.list.innerHTML,before);
});
test('reception never subscribes attendance or leave and sensitive fields are stripped at source', () => {
  const e=environment();let results=[];
  const stop=sabahVerileriniDinle({fb:e.fb,db:{},kaynak:'danismaSabahGirisleri',tarih:'2026-10-01',yoklamaYetkisi:false},v=>results.push(v),()=>{});
  assert.deepEqual(e.subscriptions.map(s=>s.query.name),['danismaSabahGirisleri']);stop();
  const e2=environment();const stop2=sabahVerileriniDinle({fb:e2.fb,db:{},kaynak:'sabahGirisleri',tarih:'2026-10-01',yoklamaYetkisi:true},v=>results.push(v),()=>{});
  e2.subscriptions[0].next(snapshot([]));e2.subscriptions[1].next(attendanceDoc({'01':{durum:'hasta',kayitZamani:iso(5),not:'SECRET',kaydeden:'SECRET'}}));
  e2.subscriptions[2].next(snapshot([{id:'l',ogrenciId:'02',durum:'onayli',baslangic:'2026-10-01',aciklama:'SECRET',veliEmail:'SECRET'}]));
  assert.deepEqual(Object.keys(results.at(-1).yoklama['01']).sort(),['durum','kayitZamani']);
  assert.deepEqual([...results.at(-1).izinliler],['02']);assert.doesNotMatch(JSON.stringify(results),/SECRET/);stop2();
});

test('late attendance and legacy medical/late aliases preserve the shared ZEKY meanings', async () => {
  assert.deepEqual(sabahDurumu({}, {durum:'gec'}),{grup:'tamam',durum:'gec',teslim:false,eylem:false});
  assert.equal(sabahDurumu({}, {durum:'raporlu'}).durum,'hasta');
  const e=await morning({authorize:true});e.m.ogretmenKart('morning');
  e.subscriptions[0].next(snapshot([]));e.subscriptions[1].next(attendanceDoc({'01':{durum:'gec'},'02':{durum:'geldi',gecGeldi:true},'03':{durum:'raporlu'}}));e.subscriptions[2].next(snapshot([]));
  assert.match(section(e.list.innerHTML,'01'),/Yoklamada geç geldi/);
  assert.match(section(e.list.innerHTML,'02'),/Yoklamada geç geldi/);
  assert.match(section(e.list.innerHTML,'03'),/Hasta/);assert.doesNotMatch(e.list.innerHTML,/Kontrol gerekli/);
  e.bridge.durdur();
});
test('switching an attendance-authorized session to reception drops all private listeners and cached labels', async () => {
  const e=await morning({authorize:true});e.m.ogretmenKart('morning');
  e.subscriptions[0].next(snapshot([]));e.subscriptions[1].next(attendanceDoc({'01':{durum:'hasta'}}));e.subscriptions[2].next(snapshot([]));
  assert.match(e.list.innerHTML,/Hasta/);const old=e.subscriptions.slice();
  e.state.rol='danisma';e.state.currentUser={uid:'reception'};e.m.ogretmenKart('morning');
  assert.doesNotMatch(e.list.innerHTML,/Hasta|Child-/); // Clear prior role before the first new snapshot arrives.
  assert.ok(old.every(s=>s.stopped));assert.equal(e.subscriptions.length,4);assert.equal(e.subscriptions[3].query.name,'danismaSabahGirisleri');
  e.subscriptions[3].next(snapshot([]));assert.doesNotMatch(e.list.innerHTML,/Yoklama: Hasta|>Hasta<|Gelmedi · İzinli · Hasta/);
  const safe=e.list.innerHTML;old[1].next(attendanceDoc({'01':{durum:'hasta'}}));assert.equal(e.list.innerHTML,safe);e.bridge.durdur();
});

test('morning absence badges reuse exact attendance colors and icons with readable text', async () => {
  const e=await morning({authorize:true});e.m.ogretmenKart('morning');
  e.subscriptions[0].next(snapshot([]));e.subscriptions[1].next(attendanceDoc({'01':{durum:'gelmedi'},'02':{durum:'izinli'},'03':{durum:'hasta'}}));e.subscriptions[2].next(snapshot([]));
  const palette=[['01','Gelmedi','❌','#dc2626','#991b1b','#fef2f2','#fecaca'],['02','İzinli','🏖','#d97706','#92400e','#fffbeb','#fde68a'],['03','Hasta','🤒','#9333ea','#6b21a8','#faf5ff','#e9d5ff']];
  const attendance=await read('portal-devamsizlik.js');
  for(const [id,label,icon,accent,text,bg,border] of palette) {
    const html=section(e.list.innerHTML,id);
    for(const value of [accent,text,bg,border,icon,label]) { assert.ok(html.includes(value),id+' missing '+value); assert.ok(attendance.includes(value),'canonical palette missing '+value); }
    assert.match(html,/aria-hidden="true"/);assert.doesNotMatch(html,/window._sabahGirisi.onayla/);
  }
  assert.equal(e.writes.length,0);e.bridge.durdur();
});
test('absence palette never replaces the separate conflict warning', async () => {
  const e=await morning({authorize:true});e.m.ogretmenKart('morning');
  e.subscriptions[0].next(snapshot([arrival('01',10,{sinifaGirisOnayi:iso(15)})]));e.subscriptions[1].next(attendanceDoc({'01':{durum:'gelmedi',kayitZamani:iso(20)}}));e.subscriptions[2].next(snapshot([]));
  const html=section(e.list.innerHTML,'01');assert.match(html,/Kontrol gerekli/);assert.match(html,/#B45309/);assert.doesNotMatch(html,/#dc2626|#fecaca/);e.bridge.durdur();
});
