// Yalnız oturum sahibinin kök bildirimleri. Kapalı tarayıcı/FCM alıcısı değildir.
import { setupMessageSound, showPortalNotice, dismissPortalNotice } from './portal-mesaj-bildirim.js?v=164';

const clean = value => String(value ?? '').trim();
const kind = value => clean(value).toLocaleLowerCase('tr-TR');
const TYPE_LABELS = Object.freeze({
  mesaj: 'Mesaj', mesaj_yeni: 'Mesaj', sohbet: 'Mesaj', kapıdanmesaj: 'Mesaj', kapidanmesaj: 'Mesaj',
  duyuru: 'Duyuru', duyuru_yeni: 'Duyuru', simsek: 'Duyuru',
  etkinlik: 'Etkinlik', etkinlik_yeni: 'Etkinlik', takvim: 'Etkinlik',
  kazanim: 'Kazanım', kazanım: 'Kazanım', egitim_gelisim: 'Kazanım',
  egitim: 'Eğitim', galeri: 'Galeri', foto_onay: 'Galeri', galeri_guncelleme: 'Galeri', galeri_onay: 'Galeri',
  sabah: 'Sabah gelişi', sabah_geliyorum: 'Sabah gelişi', sabah_giris: 'Sabah gelişi', 'sabah-yeni': 'Sabah gelişi', 'sabah-onay': 'Sabah gelişi',
  okul_zili: 'Okul zili', zil: 'Okul zili', almaya_geliyorum: 'Okul zili',
  'pickup-yeni': 'Okul zili', 'pickup-kapida': 'Okul zili', 'pickup-hazir': 'Okul zili', 'pickup-hazir-personel': 'Okul zili', 'pickup-teslim': 'Okul zili',
  gorusme: 'Görüşme', gorusme_talebi: 'Görüşme', gorusme_notu: 'Görüşme', randevu: 'Randevu', 'randevu-yeni': 'Randevu', randevu_talep: 'Randevu',
  randevu_talebi: 'Randevu', odeme: 'Ödeme', odeme_bildirim: 'Ödeme', odeme_hatirlatma: 'Ödeme', finans: 'Finans',
  izin: 'İzin', izin_talep: 'İzin', izin_sonuc: 'İzin', devamsizlik: 'Devamsızlık', rozet: 'Rozet', rapor: 'Rapor', 'gunluk-rapor': 'Rapor'
});
export const notificationLabel = record => TYPE_LABELS[kind(record?.tip)] || 'Bildirim';
export const isMessageNotification = record => ['mesaj', 'mesaj_yeni', 'sohbet'].includes(kind(record?.tip));

export function notificationTime(value) {
  try {
    if (value == null || value === '') return 0;
    if (typeof value.toMillis === 'function') {
      const ms = value.toMillis(); return Number.isFinite(ms) && Math.abs(ms) <= 8.64e15 ? ms : 0;
    }
    if (Number.isFinite(value.seconds) && Number.isFinite(value.nanoseconds)
        && value.nanoseconds >= 0 && value.nanoseconds < 1e9) {
      const ms = value.seconds * 1000 + value.nanoseconds / 1e6;
      return Math.abs(ms) <= 8.64e15 ? ms : 0;
    }
    const ms = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(ms) ? ms : 0;
  } catch (_) { return 0; }
}
export function notificationEventKey(record) {
  if (clean(record?.olayAnahtari)) return `olay:${clean(record.olayAnahtari)}`;
  if (clean(record?.kaynakId)) return `kaynak:${kind(record.tip) || 'genel'}:${clean(record.kaynakId)}`;
  return `belge:${record?._source ? `${clean(record._source)}:` : ''}${clean(record?.id)}`;
}
export function notificationThreadId(record) {
  if (!isMessageNotification(record)) return '';
  const source = clean(record.kaynakId);
  if (source) return source;
  // Eski mesaj kayıtları yalnız bu yerel sayfa biçiminde çözümlenir. URL'ye
  // hiçbir zaman gidilmez; şema, host, başka sayfa ve tekrarlı parametre reddedilir.
  const target = clean(record.hedefSayfa);
  if (!/^(?:\.\/|\/)?sohbet\.html\?[^#]*$/.test(target)) return '';
  try {
    const url = new URL(target, 'https://portal.invalid/');
    const ids = url.searchParams.getAll('thread');
    return ids.length === 1 && ids[0] && !/[\u0000-\u001f/\\]/.test(ids[0]) ? ids[0] : '';
  } catch (_) { return ''; }
}

// İlk önbellekler ve ilk sunucu görüntüsü geçmiş sayılır. Okundu değişmesi,
// sorgudan çıkıp geri dönme veya başka belge kimliğiyle aynı olay tekrar çalmaz.
export function createNotificationNoticeTracker() {
  const seen = new Set(); let ready = false;
  return {
    get ready() { return ready; },
    reset() { seen.clear(); ready = false; },
    update(records = [], { fromCache = false, initial = false } = {}) {
      if (!Array.isArray(records) || (ready && fromCache)) return [];
      const incoming = [];
      for (const record of records) {
        if (!record || !clean(record.id)) continue;
        if (ready && record._pendingWrites) continue;
        const key = notificationEventKey(record);
        const fresh = !seen.has(key); seen.add(key);
        if (ready && !initial && fresh && record.okundu !== true) incoming.push(record);
      }
      if (!fromCache) ready = true;
      return incoming;
    }
  };
}

let serial = 0;
function ensureStyles(doc) {
  if (doc.getElementById('portalBildirimMerkeziStil')) return;
  const style = doc.createElement('style'); style.id = 'portalBildirimMerkeziStil';
  style.textContent = `
.pbm-yuva{display:inline-flex;align-items:center;font-family:inherit}.pbm-yuva.pbm-sabit{position:fixed;right:18px;bottom:max(82px,calc(env(safe-area-inset-bottom) + 82px));z-index:9990}
.pbm-zil{position:relative;min-width:44px;min-height:44px;border:1px solid #d8deef;border-radius:14px;background:#fff;color:#28356a;cursor:pointer;font:inherit;font-size:22px;box-shadow:0 3px 12px #17264c12}
.pbm-sayac{position:absolute;right:-5px;top:-6px;min-width:20px;min-height:20px;padding:2px 5px;border-radius:12px;background:#b42338;color:white;font-size:11px;font-weight:800;box-sizing:border-box}
.pbm-panel{position:fixed;top:76px;right:18px;width:min(400px,calc(100vw - 24px));max-height:calc(100dvh - 100px);display:flex;flex-direction:column;z-index:10060;background:#fff;color:#202944;border:1px solid #dbe1ed;border-radius:18px;box-shadow:0 20px 60px #17264c40;font-family:inherit;overflow:hidden}
.pbm-panel[hidden],.pbm-sayac[hidden]{display:none}.pbm-baslik{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #e5e9f2}.pbm-baslik h2{font-size:18px;margin:0}.pbm-kapat{width:40px;height:40px;border:0;border-radius:12px;background:#f1f4fa;color:#202944;font-size:24px;cursor:pointer}.pbm-durum{font-size:13px;padding:0 16px;line-height:1.5}.pbm-durum:empty{display:none}.pbm-durum[data-error="true"]{color:#9d2430}
.pbm-liste{margin:0;padding:8px 10px;list-style:none;overflow:auto;overscroll-behavior:contain}.pbm-satir{width:100%;display:flex;gap:12px;align-items:center;text-align:left;min-height:66px;padding:12px;border:0;border-bottom:1px solid #eef1f6;background:white;font:inherit;color:#202944;cursor:pointer;border-radius:10px}.pbm-satir:hover{background:#f3f5fb}.pbm-satir[data-unread="true"]{background:#edf2ff}.pbm-satir:disabled{cursor:wait;opacity:.75}.pbm-metin{flex:1;min-width:0}.pbm-metin strong{display:block;font-size:14px}.pbm-metin time{display:block;font-size:12px;color:#606c85;margin-top:4px}.pbm-isaret{font-size:12px;color:#263f94}.pbm-bos{padding:24px 14px;text-align:center;color:#606c85;font-size:14px}
.pbm-zil:focus-visible,.pbm-kapat:focus-visible,.pbm-satir:focus-visible{outline:3px solid #5a6acf;outline-offset:2px}
@media(max-width:600px){.pbm-panel{top:auto;bottom:max(12px,env(safe-area-inset-bottom));right:12px;max-height:80dvh}}`;
  doc.head.appendChild(style);
}

/**
 * email must be derived from the authenticated user (never a selected person).
 * The caller supplies the same normalization used by its Firestore rules/writers.
 * Parent owns auth lifecycle and calls stop before switching accounts. Optional
 * getCurrentEmail adds a second guard against late callbacks during auth changes.
 * mounts: elements (or IDs) to receive bell buttons; [] keeps the API headless.
 * Root suppression/count callbacks are evaluated live; external records are
 * already authorized/scoped by their source and need no extra collection reads.
 */
export function startNotificationCenter({ fb, db, email, mounts, navigate,
  suppressAlert, excludeFromCount, getCurrentEmail, onMessageRead, onStateChange } = {}) {
  const account = clean(email); // Preserve the caller's verified query identity.
  const doc = typeof document === 'undefined' ? null : document;
  const instance = `bildirim-merkezi-${++serial}`;
  const tracker = createNotificationNoticeTracker();
  const roots = new Map(), externals = new Map(), pending = new Map(), confirmed = new Map(), failedReads = new Map();
  const confirmedEvents = new Set();
  const ownedTypes = new Set(), wrappers = [], buttons = [];
  let stopped = false, unsubscribe = null, panel = null, list = null, statusNode = null;
  let closeButton = null, returnFocus = null, opened = false, rootFailed = false;
  let status = 'loading', errorMessage = '';
  const isActive = () => {
    try { return !!account && !!fb && !!db && !stopped && (!getCurrentEmail || clean(getCurrentEmail()) === account); }
    catch (_) { return false; }
  };
  const wasConfirmed = record => confirmed.get(keyFor(record)) === notificationEventKey(record);
  const keyFor = record => record._itemKey;
  const safeCallback = (callback, record) => {
    try { return typeof callback === 'function' && callback(record) === true; } catch (_) { return true; }
  };
  function effectiveRecord(record) {
    const state = pending.get(keyFor(record));
    const failed = failedReads.get(keyFor(record)) === notificationEventKey(record);
    return { ...record, okundu: state ? state.wasRead : failed ? false : wasConfirmed(record) || record.okundu === true };
  }
  function rootEventKey(record) {
    return record._source && clean(record.rootOlayAnahtari) ? `olay:${clean(record.rootOlayAnahtari)}` : notificationEventKey(record);
  }
  function visibleRecords() {
    const sourceRecords = [...externals.values()].flatMap(source => [...source.items.values()]);
    const sourceKeys = new Map(sourceRecords.map(record => [rootEventKey(record), notificationEventKey(record)]));
    const values = [...sourceRecords];
    for (const record of roots.values()) {
      if (!safeCallback(excludeFromCount,record)) values.push(record);
      else if (sourceKeys.has(notificationEventKey(record))) {
        // Gizlenen ayna aynı satırın okuma durumuna katılır; ayrı sayaç/uyarı üretmez.
        values.push({...record,_displayEventKey:sourceKeys.get(notificationEventKey(record))});
      } else if (failedReads.get(keyFor(record)) === notificationEventKey(record)
          && confirmedEvents.has(notificationEventKey(record))) values.push(record);
    }
    return values.map(effectiveRecord);
  }
  function groups() {
    const grouped = new Map();
    for (const record of visibleRecords()) {
      const key = record._displayEventKey || notificationEventKey(record);
      if (!grouped.has(key)) grouped.set(key, { key, record, items: [], unread: false, time: 0 });
      const group = grouped.get(key); group.items.push(record);
      group.unread ||= record.okundu !== true;
      group.time = Math.max(group.time, notificationTime(record.olusturuldu || record.tarih));
      if (record._source && !group.record._source) group.record = record;
    }
    return [...grouped.values()].sort((a, b) => b.time - a.time || a.key.localeCompare(b.key));
  }
  function getState() {
    const entries = groups();
    return { status, ready: tracker.ready && !rootFailed && isActive(), open: opened,
      unreadCount: entries.filter(entry => entry.unread).length, itemCount: entries.length,
      error: errorMessage, items: entries.map(entry => ({ ...entry.record, okundu: !entry.unread })) };
  }
  function render() {
    if (!isActive()) return;
    const state = getState();
    for (const { button, badge } of buttons) {
      button.setAttribute('aria-label', `Bildirimler${state.unreadCount ? `, ${state.unreadCount} okunmamış` : ', okunmamış bildirim yok'}`);
      button.setAttribute('aria-expanded', String(opened));
      badge.textContent = state.unreadCount > 99 ? '99+' : String(state.unreadCount);
      badge.hidden = state.unreadCount === 0;
    }
    if (statusNode) {
      statusNode.textContent = errorMessage || (status === 'loading' ? 'Bildirimler yükleniyor…' : '');
      statusNode.setAttribute('data-error', String(!!errorMessage));
    }
    if (list) {
      list.replaceChildren();
      const entries = groups();
      for (const entry of entries) {
        const li = doc.createElement('li'), button = doc.createElement('button');
        button.type = 'button'; button.className = 'pbm-satir';
        button.setAttribute('data-unread', String(entry.unread));
        button.setAttribute('aria-label', `${notificationLabel(entry.record)}${entry.unread ? ', okunmamış' : ', okundu'}`);
        button.disabled = entry.items.some(item => pending.has(keyFor(item)));
        const text = doc.createElement('span'); text.className = 'pbm-metin';
        const title = doc.createElement('strong'); title.textContent = notificationLabel(entry.record);
        const time = doc.createElement('time');
        if (entry.time) {
          const date = new Date(entry.time);
          time.dateTime = date.toISOString();
          time.textContent = date.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        } else time.textContent = 'Tarih bilgisi yok';
        const unread = doc.createElement('span'); unread.className = 'pbm-isaret';
        unread.textContent = entry.unread ? 'Yeni' : 'Okundu';
        text.append(title, time); button.append(text, unread); li.appendChild(button); list.appendChild(li);
        button.addEventListener('click', () => { void activate(entry.key); });
      }
      if (!entries.length) {
        const empty = doc.createElement('li'); empty.className = 'pbm-bos';
        empty.textContent = 'Henüz bildirim yok'; list.appendChild(empty);
      }
    }
    if (typeof onStateChange === 'function') {
      try { onStateChange(state); } catch (_) { /* UI observers cannot break the receiver. */ }
    }
  }
  function open() {
    if (!isActive() || !panel) return;
    returnFocus = doc.activeElement; opened = true; panel.hidden = false; render(); closeButton.focus?.();
  }
  function close() {
    if (!panel) return;
    opened = false; panel.hidden = true; render();
    if (returnFocus?.isConnected !== false) returnFocus?.focus?.();
  }
  const onKey = event => { if (opened && event.key === 'Escape') { event.preventDefault?.(); close(); } };
  function mount() {
    if (!doc?.body) return;
    ensureStyles(doc);
    const targets = mounts == null ? [doc.body] : Array.isArray(mounts) ? mounts : [mounts];
    for (let target of targets) {
      if (typeof target === 'string') target = doc.getElementById(target);
      if (!target?.appendChild) continue;
      const wrapper = doc.createElement('span'); wrapper.className = `pbm-yuva${mounts == null ? ' pbm-sabit' : ''}`;
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'pbm-zil';
      button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', instance);
      const icon = doc.createElement('span'); icon.textContent = '🔔'; icon.setAttribute('aria-hidden', 'true');
      const badge = doc.createElement('span'); badge.className = 'pbm-sayac'; badge.setAttribute('aria-hidden', 'true');
      button.append(icon, badge); wrapper.appendChild(button); target.appendChild(wrapper);
      button.addEventListener('click', () => { if (opened) close(); else open(); });
      wrappers.push(wrapper); buttons.push({ button, badge });
    }
    panel = doc.createElement('section'); panel.id = instance; panel.className = 'pbm-panel'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', `${instance}-baslik`);
    const heading = doc.createElement('div'); heading.className = 'pbm-baslik';
    const title = doc.createElement('h2'); title.id = `${instance}-baslik`; title.textContent = 'Bildirimler';
    closeButton = doc.createElement('button'); closeButton.type = 'button'; closeButton.className = 'pbm-kapat';
    closeButton.setAttribute('aria-label', 'Bildirimleri kapat'); closeButton.textContent = '×'; closeButton.addEventListener('click', close);
    heading.append(title, closeButton);
    statusNode = doc.createElement('p'); statusNode.className = 'pbm-durum'; statusNode.setAttribute('role', 'status');
    statusNode.setAttribute('aria-live', 'polite');
    list = doc.createElement('ul'); list.className = 'pbm-liste';
    panel.append(heading, statusNode, list); doc.body.appendChild(panel); doc.addEventListener('keydown', onKey);
  }
  function alert(records, root = false) {
    if (!isActive() || doc?.visibilityState === 'hidden') return;
    const incoming = records.filter(record => !isMessageNotification(record) && record.sessizUyari !== true
      && !(root && (safeCallback(suppressAlert, record) || safeCallback(excludeFromCount, record))));
    if (!incoming.length) return;
    const labels = [...new Set(incoming.map(notificationLabel))];
    showPortalNotice({ id: instance, title: labels.length === 1 ? labels[0] : 'Bildirimler',
      message: incoming.length === 1 ? 'Yeni bir bildiriminiz var.' : `${incoming.length} yeni bildiriminiz var.` }, { onOpen: open });
  }
  async function persist(record) {
    const key = keyFor(record);
    if (!isActive() || record.okundu === true || wasConfirmed(record)) return true;
    if (pending.has(key)) return pending.get(key).promise;
    // External adapters own their own read semantics. Merely opening a source
    // with no onRead callback must not decrement its count.
    if (record._source && typeof record.onRead !== 'function') return true;
    const entry = { wasRead: record.okundu === true, promise: null };
    pending.set(key, entry); render();
    entry.promise = (async () => {
      try {
        if (record._source) {
          const result = await record.onRead(record);
          if (result === false) throw Error('read-not-persisted');
        } else await fb.updateDoc(fb.doc(db, 'bildirimler', record.id), { okundu: true });
        if (!isActive()) return false;
        confirmed.set(key, notificationEventKey(record)); failedReads.delete(key); pending.delete(key); render(); return true;
      } catch (_) {
        if (!isActive()) return false;
        pending.delete(key); failedReads.set(key, notificationEventKey(record));
        const items = record._source ? externals.get(record._source)?.items : roots;
        if (items?.has(record.id)) items.set(record.id, { ...items.get(record.id), okundu: false });
        errorMessage = 'Bildirim okundu olarak kaydedilemedi. Lütfen tekrar deneyin.';
        render(); return false;
      }
    })();
    return entry.promise;
  }
  async function reconcileReadMirrors() {
    if (!isActive()) return;
    const records = [...roots.values()].map(effectiveRecord).filter(record => record.okundu !== true
      && confirmedEvents.has(notificationEventKey(record))
      && failedReads.get(keyFor(record)) !== notificationEventKey(record));
    await Promise.all(records.map(persist));
  }
  async function markGroup(entry) {
    if (!entry || !isActive()) return false;
    errorMessage = '';
    const results = await Promise.all(entry.items.map(persist));
    entry.items.forEach((record,index) => {
      if (results[index] && (!record._source || typeof record.onRead === 'function')) confirmedEvents.add(rootEventKey(record));
    });
    // Kaynak kaydı okunurken henüz gelmemiş kök aynayı da sadece aynı olay için eşitle.
    await reconcileReadMirrors();
    render();
    return isActive() && results.every(Boolean);
  }
  async function markRead(id) {
    const entry = groups().find(group => group.key === id || group.items.some(item => item.id === id || keyFor(item) === id));
    return markGroup(entry);
  }
  async function activate(key) {
    const entry = groups().find(group => group.key === key);
    if (!entry || !isActive() || entry.items.some(item => pending.has(keyFor(item)))) return;
    if (!await markGroup(entry) || !isActive()) return;
    try {
      // No record URL is followed here. The parent supplies allowlisted routing.
      const action = entry.record._source && typeof entry.record.onOpen === 'function' ? entry.record.onOpen : navigate;
      if (typeof action === 'function') {
        await action(entry.record);
        if (isActive()) close();
      }
    } catch (_) {
      if (isActive()) { errorMessage = 'Bildirim ekranı açılamadı. Lütfen tekrar deneyin.'; render(); }
    }
  }
  async function markThreadRead(threadId) {
    const id = clean(threadId); if (!id || !isActive()) return false;
    const matches = [...roots.values()].map(effectiveRecord).filter(record => record.okundu !== true
      && notificationThreadId(record) === id
      && failedReads.get(keyFor(record)) !== notificationEventKey(record));
    const results = await Promise.all(matches.map(persist));
    const success = isActive() && results.every(Boolean);
    if (success && matches.length && typeof onMessageRead === 'function') {
      try { onMessageRead(id); } catch (_) { /* Observer only. */ }
    }
    return success;
  }
  function setExternalItems(sourceName, records = [], options = {}) {
    if (!isActive() || !clean(sourceName) || !Array.isArray(records)) return;
    const source = clean(sourceName);
    let state = externals.get(source);
    if (!state) { state = { tracker: createNotificationNoticeTracker(), items: new Map() }; externals.set(source, state); }
    const items = new Map();
    for (const record of records) {
      if (!record || !clean(record.id)) continue;
      const item = { ...record, id: clean(record.id), _source: source, _itemKey: `external:${source}:${clean(record.id)}` };
      if (!options.fromCache && !item._pendingWrites && !pending.has(keyFor(item))) {
        confirmed.delete(keyFor(item)); failedReads.delete(keyFor(item));
      }
      items.set(item.id, item);
    }
    state.items = items;
    const incoming = state.tracker.update([...items.values()], options);
    render(); alert(incoming);
  }
  function stop() {
    if (stopped) return;
    stopped = true; status = 'stopped'; opened = false;
    unsubscribe?.(); unsubscribe = null;
    doc?.removeEventListener('keydown', onKey);
    panel?.remove(); wrappers.forEach(wrapper => wrapper.remove()); dismissPortalNotice(instance);
    roots.clear(); externals.clear(); pending.clear(); confirmed.clear(); failedReads.clear(); confirmedEvents.clear(); tracker.reset(); ownedTypes.clear();
  }
  const api = { stop, open, close, markRead, markThreadRead, setExternalItems, refresh: render, getState, ownedTypes,
    get status() { return status; }, get ready() { return tracker.ready && !rootFailed && isActive(); } };
  if (!account || !fb || !db) { status = 'inactive'; return api; }
  mount(); setupMessageSound(); render();
  try {
    const query = fb.query(fb.collection(db, 'bildirimler'), fb.where('aliciEmail', '==', account));
    unsubscribe = fb.onSnapshot(query, { includeMetadataChanges: true }, snapshot => {
      if (!isActive() || rootFailed) return;
      const records = [];
      snapshot.forEach(item => {
        const data = item.data() || {};
        // Defense in depth for accidental SDK/mocking/query changes; never
        // hydrate a different recipient into this account's list.
        if (data.aliciEmail !== account) return;
        records.push({ ...data, id: item.id, _source: '', _itemKey: `root:${item.id}`,
          _pendingWrites: item.metadata?.hasPendingWrites === true });
      });
      roots.clear();
      for (const record of records) {
        roots.set(record.id, record);
        if (!snapshot.metadata?.fromCache && !record._pendingWrites && !pending.has(keyFor(record))) {
          confirmed.delete(keyFor(record));
          if (record.okundu === true || failedReads.get(keyFor(record)) !== notificationEventKey(record)) failedReads.delete(keyFor(record));
        }
      }
      const incoming = tracker.update(records, { fromCache: snapshot.metadata?.fromCache === true });
      status = tracker.ready ? 'ready' : 'loading'; render(); alert(incoming, true);
      void reconcileReadMirrors();
    }, () => {
      if (!isActive()) return;
      rootFailed = true; status = 'error'; errorMessage = 'Bildirimler alınamadı. Bağlantınızı ve oturumunuzu kontrol edin.'; render();
    });
  } catch (_) {
    rootFailed = true; status = 'error'; errorMessage = 'Bildirimler alınamadı. Bağlantınızı ve oturumunuzu kontrol edin.'; render();
  }
  return api;
}
