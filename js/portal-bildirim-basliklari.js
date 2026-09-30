// Authenticated Portal list titles only. Never used for push, sound, or popups.
const text = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
const lower = value => text(value).toLocaleLowerCase('tr-TR');
const emailKey = value => text(value).toLowerCase();
const messages = new Set(['mesaj', 'mesaj_yeni', 'sohbet', 'kapidanmesaj', 'kapıdanmesaj']);
const events = new Set(['etkinlik', 'etkinlik_yeni', 'takvim']);
const announcements = new Set(['duyuru', 'duyuru_yeni', 'simsek']);
const galleries = new Set(['galeri', 'foto_onay', 'galeri_guncelleme', 'galeri_onay']);
const labels = {
  egitim_gelisim:'Kazanım', kazanim:'Kazanım', kazanım:'Kazanım', egitim:'Eğitim',
  sabah:'Sabah gelişi', sabah_geliyorum:'Sabah gelişi', sabah_giris:'Sabah gelişi', 'sabah-yeni':'Sabah gelişi', 'sabah-onay':'Sabah gelişi',
  okul_zili:'Okul zili', zil:'Okul zili', almaya_geliyorum:'Okul zili', 'pickup-yeni':'Okul zili', 'pickup-kapida':'Okul zili', 'pickup-hazir':'Okul zili', 'pickup-hazir-personel':'Okul zili', 'pickup-teslim':'Okul zili',
  gorusme:'Görüşme', gorusme_talebi:'Görüşme', gorusme_notu:'Görüşme', randevu:'Randevu', 'randevu-yeni':'Randevu', randevu_talep:'Randevu', randevu_talebi:'Randevu',
  odeme:'Ödeme', odeme_bildirim:'Ödeme', odeme_hatirlatma:'Ödeme', finans:'Finans', izin:'İzin', izin_talep:'İzin', izin_sonuc:'İzin', devamsizlik:'Devamsızlık', rozet:'Rozet', rapor:'Rapor', 'gunluk-rapor':'Rapor'
};
const labelFor = record => {
  const type = lower(record?.tip);
  return messages.has(type) ? 'Mesaj' : events.has(type) ? 'Etkinlik' : announcements.has(type) ? 'Duyuru' : galleries.has(type) ? 'Galeri' : labels[type] || 'Bildirim';
};
const contact = value => /@|(?:\+?\d[\s().-]*){7,}/.test(value);
const genericNames = new Set(['okul', 'okul yönetimi', 'veli', 'personel', 'öğretmen', 'sınıf öğretmeni', 'kurucu müdür', 'müdür', 'yönetim', 'mesaj', 'yeni mesaj', 'yeni mesajınız var', 'bildirim', 'zeky']);
function personName(value) {
  const name = text(value);
  return name && !contact(name) && !genericNames.has(lower(name)) && !/^(?:veli|personel)\s*\d+$/iu.test(name) && !/^(?:sınıf\s+)?öğretmen[iİ]?(?:\s*\d+)?$/iu.test(name) && !/\bvelisi$/iu.test(name) && !/[<>]/.test(name) ? name : '';
}
const genericTitles = new Set(['bildirim', 'yeni bildirim', 'zeky', 'mesaj', 'yeni mesaj', 'yeni mesajınız var', 'etkinlik', 'yeni etkinlik', 'yeni okul etkinliği', 'duyuru', 'yeni duyuru', 'yeni okul duyurusu', 'galeri', 'yeni galeri içeriği', 'eğitim', 'kazanım', 'yeni eğitim gelişimi', 'yeni eğitim güncellemesi']);
const withoutIcon = value => text(value).replace(/^[^\p{L}\p{N}<]+/u, '').trim();
function meaningfulTitle(value, label) {
  const title = text(value), normalized = lower(withoutIcon(title));
  return title && normalized !== lower(label) && !genericTitles.has(normalized) ? title : '';
}
function storedSender(record) {
  const explicit = personName(record?.gonderenAd || record?.senderName);
  if (explicit) return explicit;
  // Known Portal/ZEKY writer shape. Do not treat an arbitrary message title/body as a person's name.
  const match = withoutIcon(record?.baslik).match(/^(?:yeni\s+)?mesaj\s*[·:–—-]\s*(.+)$/iu);
  return match ? personName(match[1]) : '';
}

/** Strings only: callers must insert title/label with textContent, never innerHTML. */
export function notificationPresentation(record, { senderName = '', sourceTitle = '' } = {}) {
  const label = labelFor(record), type = lower(record?.tip);
  if (messages.has(type)) return { title: storedSender(record) || personName(senderName) || label, label };
  const stored = meaningfulTitle(record?.baslik, label);
  const title = stored || text(sourceTitle) || text(record?.baslik) || label;
  return { title, label };
}

const safeId = value => {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && !/[\u0000-\u001f\u007f/\\]/.test(id) && id !== '.' && id !== '..' ? id : '';
};
function threadId(record) {
  const direct = safeId(record?.kaynakId);
  if (text(record?.kaynakId)) return direct;
  const target = text(record?.hedefSayfa);
  if (!/^(?:\.\/|\/)?sohbet\.html\?[^#]*$/.test(target)) return '';
  try {
    const ids = new URL(target, 'https://portal.invalid/').searchParams.getAll('thread');
    return ids.length === 1 ? safeId(ids[0]) : '';
  } catch (_) { return ''; }
}
const array = value => Array.isArray(value) ? value : [];
const classKey = value => lower(value);
const childClass = (child, state) => classKey(state.ayarListesi?.[child.id]?.kayit?.sinif || child.sinif || child.sinifi || child._sinif);
function childBelongsTo(child, state, account) {
  if (!child?.id) return false;
  for (const value of [child, state.ayarListesi?.[child.id]]) {
    if (!value) continue;
    const people = [value.anne, value.baba, value.veli, value.vasi, ...array(value.veliler)];
    const emails = [value.veliEmail, value.veliEposta, value.veli1Email, value.veli2Email,
      value.veli1Eposta, value.veli2Eposta, ...people.map(person => person?.email || person?.eposta)];
    if (emails.some(email => emailKey(email) === account)) return true;
  }
  return false;
}
function staff(state) {
  return state.isAdmin === true || !!state.personel && (!state.personel.durum || state.personel.durum === 'aktif');
}
function sourceAllowed(source, state) {
  if (!source || source.arsiv === true) return false;
  const ownChildren = array(state.veliOgrenciler), isStaff = staff(state);
  if (!isStaff && !ownChildren.length) return false;
  const type = lower(source.hedefTur || source.hedefTip || ((source.ogrenciId || source.hedefOgrenciId) ? 'ogrenci' : 'tumOkul'));
  if (['tumokul', 'okul', 'tum'].includes(type)) return true;
  if (!['sinif', 'ogrenci'].includes(type)) return false;
  const target = text(source.hedefDeger || (type === 'ogrenci' && (source.hedefOgrenciId || source.ogrenciId)));
  if (!target) return false;
  const teacher = lower(state.rol) === 'ogretmen' && state.isAdmin !== true;
  if (isStaff && !teacher) return true; // Exact getDoc is still subject to existing Firestore permissions.
  if (teacher) {
    const classes = array(state.siniflar).map(classKey);
    if (type === 'sinif') return classes.includes(classKey(target));
    if (state.ogrenciVerileriHazirMi !== true) return false;
    const child = array(state.ogrenciList).find(item => item.id === target);
    return !!child && classes.includes(childClass(child, state));
  }
  return type === 'ogrenci' ? ownChildren.some(child => child.id === target)
    : ownChildren.some(child => !!childClass(child, state) && childClass(child, state) === classKey(target));
}
function sourcePlan(record, state) {
  const type = lower(record?.tip);
  if (messages.has(type)) {
    const id = threadId(record);
    return id ? { path:['mesajlar', id], kind:'thread', cache:'threads' } : null;
  }
  if (!staff(state) && !array(state.veliOgrenciler).length) return null;
  const id = safeId(record?.kaynakId);
  if (!id) return null;
  if (events.has(type)) return { path:[type === 'takvim' || record.kaynak === 'takvim' ? 'takvim' : 'etkinlikler', id], kind:'source', cache:'events' };
  if (announcements.has(type)) return { path:['duyurular', id], kind:'source', cache:'announcements' };
  // Gallery IDs were historically also album names. Only explicit IDs/new event-key shapes are unambiguous.
  if (galleries.has(type) && (safeId(record.galeriId) || /^galeri-(?:onay|yayin):/.test(text(record.olayAnahtari)))) {
    return { path:['galeri', safeId(record.galeriId) || id], kind:'gallery', cache:'galleries' };
  }
  // Learning history is only read for a child already authorized in this account.
  if (type === 'egitim_gelisim' && /^egitim_/.test(id) && safeId(record.ogrenciId)
      && array(state.veliOgrenciler).some(child => child.id === record.ogrenciId)) {
    return { path:['ogrenciler', record.ogrenciId, 'bildirimler', id], kind:'child', cache:'' };
  }
  return null;
}
function fromThread(source, record, state, account) {
  const participants = [...new Set(array(source?.katilimcilar).map(emailKey).filter(Boolean))];
  if (!participants.includes(account)) return '';
  // A historic notification cannot use sonMesajGonderen: a later reply may have changed it.
  const explicit = emailKey(record.gonderenEmail || record.senderEmail);
  const other = explicit ? (explicit !== account && participants.includes(explicit) ? explicit : '')
    : participants.length === 2 ? participants.find(value => value !== account) : '';
  if (!other) return '';
  const info = source.katilimciBilgi?.[other] || {};
  if (lower(state.rol) === 'danisma' && Object.values(source.katilimciBilgi || {}).some(item => item.rol === 'veli' || item.tip === 'veli')) return '';
  const named = array(state.people).find(person => emailKey(person.email || person.id) === other);
  return personName(info.ad || info.adSoyad) || personName(named?.adSoyad || named?.ad);
}

/**
 * One instance per authenticated account. getState is PortalAPI.state, optionally
 * extended with already-authorized threads/events/announcements/galleries/people arrays.
 * Parent-child emails are matched locally; stale/unverifiable child arrays cannot grant scope.
 * The caller resolves only while the authenticated notification list is open.
 * No queries, writes, directory reads, body previews, or persistent browser caches.
 */
export function createTitleResolver({ fb, db, email, isActive = () => true, getState = () => ({}) } = {}) {
  const account = emailKey(email), documents = new Map(), pending = new Map();
  let generation = 0;
  function context() {
    try {
      if (!account || isActive() !== true) return null;
      const state = getState() || {};
      if (state.currentUser?.email && emailKey(state.currentUser.email) !== account) return null;
      return {...state, veliOgrenciler:array(state.veliOgrenciler).filter(child => childBelongsTo(child, state, account))};
    } catch (_) { return null; }
  }
  const ownsRecord = record => !record?.aliciEmail || emailKey(record.aliciEmail) === account;
  function cached(plan, state) {
    const local = array(state[plan.cache]).find(item => item.id === plan.path.at(-1)
      && (!item.kaynak || item.kaynak === plan.path[0]));
    return local || documents.get(plan.path.join('/')) || null;
  }
  function present(record, state, plan, source) {
    if (!state || !ownsRecord(record)) return { title:labelFor(record), label:labelFor(record) };
    if (!plan || !source) return notificationPresentation(record);
    if (plan.kind === 'thread') return notificationPresentation(record, {senderName:fromThread(source, record, state, account)});
    if (plan.kind === 'child') {
      const allowed = array(state.veliOgrenciler).some(child => child.id === plan.path[1]);
      const approved = !source.galeriId || !['beklemede','onaybekliyor','reddedildi'].includes(lower(source.fotoDurum));
      return notificationPresentation(record, {sourceTitle:allowed && approved ? text(source.baslik) : ''});
    }
    const approved = plan.kind !== 'gallery' || ['onaylandi', 'onaylı', 'onayli'].includes(lower(source.durum || source.fotoDurum));
    return notificationPresentation(record, {sourceTitle:approved && sourceAllowed(source, state) ? text(source.baslik || source.etkinlikBaslik) : ''});
  }
  function needed(record) {
    return messages.has(lower(record?.tip)) ? !storedSender(record) : !meaningfulTitle(record?.baslik, labelFor(record));
  }
  function peek(record) {
    const state = context(), plan = state && ownsRecord(record) && needed(record) ? sourcePlan(record, state) : null;
    return present(record, state, plan, plan ? cached(plan, state) : null);
  }
  async function resolve(record) {
    const state = context();
    if (!state || !ownsRecord(record) || !needed(record)) return peek(record);
    const plan = sourcePlan(record, state);
    if (!plan) return peek(record);
    const key = plan.path.join('/'), start = generation;
    if (!cached(plan, state) && !documents.has(key) && typeof fb?.getDoc === 'function' && typeof fb?.doc === 'function' && db) {
      if (!pending.has(key)) {
        const request = Promise.resolve().then(async () => {
          if (start !== generation || !context()) return;
          let data = null;
          try {
            const snap = await fb.getDoc(fb.doc(db, ...plan.path));
            if (snap?.exists()) data = snap.data() || null;
          } catch (_) { /* Denial/missing/offline: generic title; never broaden or repeatedly retry. */ }
          if (start === generation && context()) documents.set(key, data);
        }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
        pending.set(key, request);
      }
      await pending.get(key);
    }
    if (start !== generation || !context()) return { title:labelFor(record), label:labelFor(record) };
    return peek(record);
  }
  return { peek, resolve, clear() { generation++; documents.clear(); pending.clear(); } };
}
