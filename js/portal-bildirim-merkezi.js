import { createTitleResolver, isUrgentNotification } from './portal-bildirim-basliklari.js?v=165';
// Yalnız oturum sahibinin kök bildirimleri. Kapalı tarayıcı/FCM alıcısı değildir.
import { createNotificationHeaderMounts, positionNotificationPanel } from './portal-bildirim-yerlesim.js?v=165';
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
  izin: 'İzin', izin_talep: 'İzin', izin_sonuc: 'İzin', devamsizlik: 'Devamsızlık', rozet: 'Rozet', rapor: 'Rapor', 'gunluk-rapor': 'Rapor',
  'personel-giris-hatirlatma': 'Giriş / Çıkış'
});
export const notificationLabel = record => TYPE_LABELS[kind(record?.tip)] || 'Bildirim';
export const isMessageNotification = record => ['mesaj', 'mesaj_yeni', 'sohbet'].includes(kind(record?.tip));

export function notificationStatus(record, { unread = record?.okundu !== true, urgent = false } = {}) {
  const isUrgent = urgent === true || isUrgentNotification(record);
  return { state:isUrgent ? 'urgent' : unread ? 'unread' : 'read',
    label:isUrgent ? `! Acil · ${unread ? 'Yeni' : 'Okundu'}` : unread ? '● Yeni' : '✓ Okundu' };
}

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
.pbm-yuva,.pbm-baslik-yuvasi{display:inline-flex;align-items:center;flex-shrink:0;font-family:inherit}
.pbm-veli-ustbar{position:sticky;top:0;z-index:55;display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:10px 18px;background:var(--cream,#f8f5ee);border-bottom:1px solid #e5e9f2;font-family:inherit}.pbm-ustbar-etiket{font-size:13px;font-weight:600;color:#4a5169}
#veliPanel.pbm-veli-aktif .ca-topbar button[onclick="veliSwitchTab('bildirimler')"]{display:none}
#veliPanel .pbm-veli-baslik{gap:12px}#veliPanel .pbm-veli-baslik>.ca-row:first-child{min-width:0}#veliPanel .pbm-veli-baslik>.ca-row:first-child>div{min-width:0}#veliPanel .pbm-veli-baslik>.ca-row:last-child{flex-shrink:0}#veliPanel .pbm-veli-baslik .ca-avatar,#veliPanel .pbm-veli-baslik .ca-back{flex-shrink:0}#veliPanel .pbm-veli-baslik h2{overflow-wrap:anywhere}
.cicek-app .pbm-veli-yuva .pbm-zil{width:44px;height:44px;border-color:var(--c-border);background:var(--c-surface);color:var(--c-ink);box-shadow:none}.cicek-app .pbm-veli-yuva .pbm-zil:hover{background:var(--c-tint)}.cicek-app .pbm-veli-yuva .pbm-zil svg{width:21px;height:21px}
@media(max-width:480px){#veliPanel .pbm-veli-baslik{gap:8px}#veliPanel .pbm-veli-baslik>.ca-row:first-child{gap:8px}}
.pbm-baslik-aktif .user-menu{flex-wrap:wrap}.pbm-baslik-aktif .user-badge{min-width:0}.pbm-baslik-aktif .user-badge>div:last-child{min-width:0}.pbm-baslik-aktif #userName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}
@media(max-width:900px){.pbm-baslik-aktif .dash-header-inner{flex-wrap:wrap;gap:12px}.pbm-baslik-aktif .user-menu{justify-content:flex-end;width:100%;gap:10px}}
@media(max-width:480px){.pbm-baslik-aktif .dash-header-inner{padding:0 12px}.pbm-baslik-aktif .user-menu{gap:8px}.pbm-baslik-aktif #userName{max-width:150px}.pbm-veli-ustbar{padding:8px 12px}}
.pbm-zil{position:relative;min-width:44px;min-height:44px;border:1px solid #d8deef;border-radius:14px;background:#fff;color:#28356a;cursor:pointer;font:inherit;font-size:22px;display:grid;place-items:center;box-shadow:0 3px 12px #17264c12}.pbm-zil svg{display:block;width:22px;height:22px}.pbm-zil:hover{background:#f1f3fc;border-color:#aeb9df}
.pbm-sayac{position:absolute;right:-5px;top:-6px;min-width:20px;min-height:20px;padding:2px 5px;border-radius:12px;background:#b42338;color:white;font-size:11px;font-weight:800;box-sizing:border-box}
.pbm-panel{position:fixed;top:var(--pbm-panel-top,76px);right:18px;width:min(420px,calc(100vw - 24px));max-height:calc(100dvh - var(--pbm-panel-top,76px) - 12px);display:flex;flex-direction:column;z-index:10060;background:#fff;color:#202944;border:1px solid #dbe1ed;border-radius:18px;box-shadow:0 20px 60px #17264c40;font-family:inherit;overflow:hidden}
.pbm-panel[hidden],.pbm-sayac[hidden]{display:none}.pbm-baslik{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #e5e9f2}.pbm-baslik h2{font-size:18px;margin:0}.pbm-kapat{width:40px;height:40px;border:0;border-radius:12px;background:#f1f4fa;color:#202944;font-size:24px;cursor:pointer}.pbm-durum{font-size:13px;padding:0 16px;line-height:1.5}.pbm-durum:empty{display:none}.pbm-durum[data-error="true"]{color:#9d2430}
.pbm-liste{margin:0;padding:8px 10px;list-style:none;overflow:auto;overscroll-behavior:contain}.pbm-satir{width:100%;display:flex;gap:12px;align-items:center;text-align:left;min-height:66px;padding:12px;border:0;border-bottom:1px solid #eef1f6;background:white;font:inherit;color:#202944;cursor:pointer;border-radius:10px}.pbm-satir[data-state="unread"]{background:#fffbeb;border-color:#fcd34d}.pbm-satir[data-state="unread"]:hover{background:#fef3c7}.pbm-satir[data-state="read"]{background:#f0fdf4;border-color:#86efac}.pbm-satir[data-state="read"]:hover{background:#dcfce7}.pbm-satir[data-state="urgent"]{background:#fff1f2;border-color:#fda4af}.pbm-satir[data-state="urgent"]:hover{background:#ffe4e6}.pbm-satir[data-state="unread"] .pbm-isaret{color:#713f12}.pbm-satir[data-state="read"] .pbm-isaret{color:#166534}.pbm-satir[data-state="urgent"] .pbm-isaret{color:#9f1239}.pbm-satir:disabled{cursor:wait;opacity:.75}.pbm-metin{flex:1;min-width:0}.pbm-metin strong{display:block;font-size:14px;line-height:1.45;white-space:normal;overflow-wrap:anywhere}.pbm-kategori{display:block;font-size:12px;color:#4b5563;margin-top:4px}.pbm-metin time{display:block;font-size:12px;color:#4b5563;margin-top:4px}.pbm-isaret{font-size:12px;font-weight:700;flex-shrink:0;max-width:100px;line-height:1.45;text-align:right}.pbm-bos{padding:24px 14px;text-align:center;color:#606c85;font-size:14px}
.pbm-islemler{display:flex;justify-content:flex-end;padding:4px 16px;border-bottom:1px solid #e5e9f2;flex-shrink:0}.pbm-hepsini-oku{min-height:44px;max-width:100%;padding:8px 10px;border:0;border-radius:10px;background:#eef2ff;color:#28356a;font:inherit;font-size:13px;font-weight:700;cursor:pointer;overflow-wrap:anywhere}.pbm-hepsini-oku:hover:not(:disabled){background:#dfe6ff}.pbm-hepsini-oku:disabled{color:#5f677a;background:#f1f4fa;cursor:default}
.pbm-zil:focus-visible,.pbm-kapat:focus-visible,.pbm-hepsini-oku:focus-visible,.pbm-satir:focus-visible{outline:3px solid #5a6acf;outline-offset:2px}
@media(max-width:600px){.pbm-panel{right:12px}.pbm-satir{align-items:flex-start}}`;
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
  const confirmedEvents = new Set(), bulkMirrors = new Map();
  const ownedTypes = new Set(), wrappers = [], buttons = [];
  let stopped = false, unsubscribe = null, panel = null, list = null, statusNode = null;
  let closeButton = null, markAllButton = null, bulkRead = null, bulkRenderTimer = null, readNotice = '', returnFocus = null, opened = false, rootFailed = false, headerMounts = null;
  const reposition = () => { if (opened) positionNotificationPanel(panel, buttons); };
  let status = 'loading', errorMessage = '';
  const isActive = () => {
    try { return !!account && !!fb && !!db && !stopped && (!getCurrentEmail || clean(getCurrentEmail()) === account); }
    catch (_) { return false; }
  };
  const requestedTitles = new Set();
  const titleResolver = createTitleResolver({ fb, db, email: account, isActive,
    getState: () => typeof window === 'undefined' ? {} : window.PortalAPI?.state || {} });
  const wasConfirmed = record => confirmed.get(keyFor(record)) === notificationEventKey(record);
  const keyFor = record => record._itemKey;
  const safeCallback = (callback, record) => {
    try { return typeof callback === 'function' && callback(record) === true; } catch (_) { return true; }
  };
  function effectiveRecord(record) {
    const candidate = pending.get(keyFor(record));
    const state = candidate?.event === notificationEventKey(record) ? candidate : null;
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
      } else if (bulkMirrors.get(keyFor(record)) === notificationEventKey(record)
          || (failedReads.get(keyFor(record)) === notificationEventKey(record)
          && confirmedEvents.has(notificationEventKey(record)))) values.push(record);
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
      error: errorMessage, markingAll: !!bulkRead, items: entries.map(entry => ({ ...entry.record, okundu: !entry.unread })) };
  }
  function render(immediate = false) {
    if (!isActive()) return;
    // Large read sets generate many acknowledgements. Keep the live counter
    // responsive without rebuilding the entire list for every document write.
    if (bulkRead && !immediate) {
      if (bulkRenderTimer == null) bulkRenderTimer = setTimeout(() => { bulkRenderTimer = null; render(true); }, 100);
      return;
    }
    const state = getState();
    for (const { button, badge } of buttons) {
      button.setAttribute('aria-label', `Bildirimler${state.unreadCount ? `, ${state.unreadCount} okunmamış` : ', okunmamış bildirim yok'}`);
      button.setAttribute('aria-expanded', String(opened));
      badge.textContent = state.unreadCount > 99 ? '99+' : String(state.unreadCount);
      badge.hidden = state.unreadCount === 0;
    }
    if (statusNode) {
      statusNode.textContent = errorMessage || (bulkRead ? `Bildirimler okundu olarak kaydediliyor… (${bulkRead.completed}/${bulkRead.total})` : readNotice) || (status === 'loading' ? 'Bildirimler yükleniyor…' : '');
      statusNode.setAttribute('data-error', String(!!errorMessage));
    }
    if (markAllButton) {
      markAllButton.disabled = !!bulkRead || !state.ready || !state.unreadCount || pending.size > 0;
      markAllButton.textContent = bulkRead ? 'Kaydediliyor…' : 'Hepsini okundu yap';
      markAllButton.setAttribute('aria-busy', String(!!bulkRead));
    }
    if (list) {
      list.replaceChildren();
      const entries = groups();
      for (const entry of entries) {
        const li = doc.createElement('li'), button = doc.createElement('button');
        button.type = 'button'; button.className = 'pbm-satir';
        button.setAttribute('data-unread', String(entry.unread));
        const presentation = titleResolver.peek(entry.record);
        const displayStatus = notificationStatus(entry.record, {unread:entry.unread, urgent:presentation.urgent === true || entry.items.some(isUrgentNotification)});
        button.setAttribute('data-state', displayStatus.state);
        button.setAttribute('aria-label', `${presentation.title}${presentation.title !== notificationLabel(entry.record) ? `, ${notificationLabel(entry.record)}` : ''}${displayStatus.state === 'urgent' ? ', acil' : ''}${entry.unread ? ', okunmamış' : ', okundu'}`);
        button.disabled = !!bulkRead || entry.items.some(item => pending.has(keyFor(item)));
        const text = doc.createElement('span'); text.className = 'pbm-metin';
        const title = doc.createElement('strong'); title.textContent = presentation.title;
        const category = doc.createElement('span'); category.className = 'pbm-kategori';
        if (presentation.title !== notificationLabel(entry.record)) category.textContent = notificationLabel(entry.record);
        const time = doc.createElement('time');
        if (entry.time) {
          const date = new Date(entry.time);
          time.dateTime = date.toISOString();
          time.textContent = date.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        } else time.textContent = 'Tarih bilgisi yok';
        const unread = doc.createElement('span'); unread.className = 'pbm-isaret';
        unread.textContent = displayStatus.label;
        text.append(title, category, time); button.append(text, unread); li.appendChild(button); list.appendChild(li);
        button.addEventListener('click', () => { void activate(entry.key); });
        // Başlık ayrıntıları yalnız kullanıcı merkezi açtığında yüklenir.
        // Aynı render/okuma değişimi ağ isteği veya uyarı döngüsü oluşturmaz.
        if (opened && !requestedTitles.has(entry.key)) {
          requestedTitles.add(entry.key);
          void titleResolver.resolve(entry.record).then(resolved => {
            if (isActive() && opened && (resolved.title !== presentation.title || resolved.urgent !== presentation.urgent)) render();
          }).catch(() => {});
        }
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
    returnFocus = doc.activeElement; requestedTitles.clear(); opened = true; panel.hidden = false; render(true); reposition(); closeButton.focus?.();
  }
  function close() {
    if (!panel) return;
    opened = false; panel.hidden = true; render(true);
    if (returnFocus?.isConnected !== false) returnFocus?.focus?.();
  }
  const onKey = event => { if (opened && event.key === 'Escape') { event.preventDefault?.(); close(); } };
  function mount() {
    if (!doc?.body) return;
    ensureStyles(doc);
    if (mounts == null) headerMounts = createNotificationHeaderMounts(doc);
    const targets = mounts == null ? headerMounts.targets : Array.isArray(mounts) ? mounts : [mounts];
    for (let target of targets) {
      if (typeof target === 'string') target = doc.getElementById(target);
      if (!target?.appendChild) continue;
      const wrapper = doc.createElement('span'); wrapper.className = 'pbm-yuva';
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'pbm-zil';
      button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', instance);
      const icon = doc.createElement('span'); icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>'; icon.setAttribute('aria-hidden', 'true');
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
    const actions = doc.createElement('div'); actions.className = 'pbm-islemler';
    markAllButton = doc.createElement('button'); markAllButton.type = 'button'; markAllButton.className = 'pbm-hepsini-oku';
    markAllButton.textContent = 'Hepsini okundu yap';
    markAllButton.addEventListener('click', () => { void markAllRead(); }); actions.appendChild(markAllButton);
    list = doc.createElement('ul'); list.className = 'pbm-liste';
    panel.append(heading, actions, statusNode, list); doc.body.appendChild(panel); doc.addEventListener('keydown', onKey);
    window.addEventListener?.('resize', reposition); window.addEventListener?.('scroll', reposition, true);
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
    if (!isActive()) return false;
    if (record.okundu === true || wasConfirmed(record)) {
      if (bulkMirrors.get(key) === notificationEventKey(record)) bulkMirrors.delete(key);
      return true;
    }
    if (pending.has(key)) return pending.get(key).promise;
    // External adapters own their own read semantics. Merely opening a source
    // with no onRead callback must not decrement its count.
    if (record._source && typeof record.onRead !== 'function') return true;
    const entry = { wasRead: record.okundu === true, event: notificationEventKey(record), promise: null };
    pending.set(key, entry); render();
    entry.promise = (async () => {
      try {
        if (record._source) {
          const result = await record.onRead(record);
          if (result === false) throw Error('read-not-persisted');
        } else await fb.updateDoc(fb.doc(db, 'bildirimler', record.id), { okundu: true });
        if (!isActive()) return false;
        confirmed.set(key, notificationEventKey(record)); failedReads.delete(key); bulkMirrors.delete(key); pending.delete(key); render(); return true;
      } catch (_) {
        if (!isActive()) return false;
        pending.delete(key); failedReads.set(key, notificationEventKey(record));
        const items = record._source ? externals.get(record._source)?.items : roots;
        if (items?.has(record.id) && notificationEventKey(items.get(record.id)) === entry.event) items.set(record.id, { ...items.get(record.id), okundu: false });
        if (!rootFailed) errorMessage = 'Bildirim okundu olarak kaydedilemedi. Lütfen tekrar deneyin.';
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
    errorMessage = ''; readNotice = '';
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
    if (bulkRead) return false;
    const entry = groups().find(group => group.key === id || group.items.some(item => item.id === id || keyFor(item) === id));
    return markGroup(entry);
  }
  async function activate(key) {
    const entry = groups().find(group => group.key === key);
    if (!entry || !isActive() || bulkRead || entry.items.some(item => pending.has(keyFor(item)))) return;
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
  // Freeze logical events, not a timestamp or a source-wide read flag. Later
  // notifications (including a reused source id with a new event) stay unread.
  // Eight sequential workers avoid unbounded writes and Firestore batch limits.
  function markAllRead() {
    if (bulkRead) return bulkRead.promise;
    if (!isActive() || !tracker.ready || rootFailed || pending.size) {
      return Promise.resolve({ status: 'unavailable', total: 0, readCount: 0, failedCount: 0 });
    }
    const entries = groups().filter(entry => entry.unread);
    for (const entry of entries) for (const record of entry.items) {
      if (record._displayEventKey && record.okundu !== true) bulkMirrors.set(keyFor(record), notificationEventKey(record));
    }
    const operation = { total: entries.length, completed: 0, promise: null };
    bulkRead = operation; errorMessage = ''; readNotice = '';
    // Defer execution until the promise is installed, including synchronous
    // observer/adaptor re-entry into markAllRead during the first render.
    operation.promise = Promise.resolve().then(async () => {
      let next = 0, readCount = 0;
      const worker = async () => {
        while (isActive() && !rootFailed && next < entries.length) {
          const entry = entries[next++]; let succeeded = true;
          for (const record of entry.items) {
            if (record.okundu === true) continue;
            if (!isActive() || rootFailed) { succeeded = false; break; }
            const items = record._source ? externals.get(record._source)?.items : roots;
            const current = items?.get(record.id);
            if (!current || notificationEventKey(current) !== notificationEventKey(record)
                || (record._source && effectiveRecord(current).okundu !== true && typeof current.onRead !== 'function')) { succeeded = false; continue; }
            if (!await persist(effectiveRecord(current))) succeeded = false;
          }
          if (!isActive()) break;
          if (succeeded) readCount++;
          operation.completed++; render();
        }
      };
      await Promise.all(Array.from({ length: Math.min(8, entries.length) }, worker));
      const failedCount = entries.length - readCount;
      if (!isActive()) return { status: 'cancelled', total: entries.length, readCount, failedCount };
      // Bulk acknowledges exactly the click-time snapshot. Unlike opening one
      // source item, it never authorizes automatic backfill of later arrivals.
      if (!rootFailed) {
        errorMessage = failedCount ? `${readCount} bildirim okundu. ${failedCount} bildirim kaydedilemedi; tekrar deneyin.` : '';
        readNotice = failedCount ? '' : entries.length ? `${readCount} bildirim okundu olarak kaydedildi.` : 'Okunmamış bildirim yok.';
      }
      return { status: rootFailed || failedCount ? 'partial' : 'complete', total: entries.length, readCount, failedCount };
    }).finally(() => {
      if (bulkRead === operation) { clearTimeout(bulkRenderTimer); bulkRenderTimer = null; bulkRead = null; render(); }
    });
    render(true);
    return operation.promise;
  }
  async function markThreadRead(threadId) {
    const id = clean(threadId); if (!id || !isActive() || bulkRead) return false;
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
    stopped = true; status = 'stopped'; opened = false; bulkRead = null; readNotice = '';
    clearTimeout(bulkRenderTimer); bulkRenderTimer = null;
    unsubscribe?.(); unsubscribe = null;
    doc?.removeEventListener('keydown', onKey);
    if (typeof window !== 'undefined') { window.removeEventListener?.('resize', reposition); window.removeEventListener?.('scroll', reposition, true); }
    headerMounts?.cleanup(); titleResolver.clear(); requestedTitles.clear();
    panel?.remove(); wrappers.forEach(wrapper => wrapper.remove()); dismissPortalNotice(instance);
    roots.clear(); externals.clear(); pending.clear(); confirmed.clear(); failedReads.clear(); confirmedEvents.clear(); bulkMirrors.clear(); tracker.reset(); ownedTypes.clear();
  }
  const api = { stop, open, close, markRead, markAllRead, markThreadRead, setExternalItems, refresh: render, getState, ownedTypes,
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
          if (record.okundu === true && bulkMirrors.get(keyFor(record)) === notificationEventKey(record)) bulkMirrors.delete(keyFor(record));
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
