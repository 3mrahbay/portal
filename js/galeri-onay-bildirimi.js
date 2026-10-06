import { genelPushGonder } from './zeky-operasyon-push.js';

const OWNER_EMAIL = 'emrahby@gmail.com';
const APPROVER_ROLES = new Set(['kurucu_mudur', 'mudur']);
const sessions = new WeakMap();
const emailKey = value => String(value || '').trim().toLowerCase();
const errorCode = error => String(error?.code || error?.message || error || 'bildirim-kaydi-basarisiz');
const result = extra => ({ ok: false, adet: 0, istenen: 0, recipientLookupFailed: false, kayitHatalari: [], ...extra });

// The same gallery event has the same recipient document in Portal and ZEKY.
// Colons and slashes within either component are escaped, so IDs cannot collide.
function notificationId(id, email) {
  return `galeri-onay-istek:${encodeURIComponent(id)}:${encodeURIComponent(email)}`;
}

function sessionFor(api, uid, version) {
  let session = sessions.get(api);
  if (!session || session.uid !== uid || session.version !== version) {
    session = { uid, version, events: new Map() };
    sessions.set(api, session);
  }
  return session;
}

function recipientEmail(snapshot) {
  const person = snapshot.data() || {};
  const role = person.rol;
  const status = person.durum;
  if (!APPROVER_ROLES.has(role) || person.aktif === false || status !== 'aktif') return '';
  // personeller/{email} is the permission-bearing identity. Do not redirect an
  // approver's notice to a different profile/contact alias stored in the data.
  const email = emailKey(snapshot.id);
  return /^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email) ? email : '';
}

/**
 * Notify active gallery approvers after a pending gallery document was saved.
 * ok describes complete recipient lookup + persistence; push.ok separately
 * describes FCM acceptance, never delivery to a device. A failed lookup keeps
 * ok=false even when the owner fallback was saved: other approvers are unknown.
 *
 * No recipient-document reads/transactions: uploaders cannot read admin notices.
 * Merge retries deliberately omit okundu, preserving recipient read state. A
 * denied cross-session replay is reported honestly, not assumed to be a duplicate.
 */
export async function notifyGalleryApproval({ id, durum } = {}, api = globalThis.window?.PortalAPI) {
  if (!['beklemede', 'onayBekliyor'].includes(durum)) return result({ ok: true });
  if (typeof id !== 'string' || !id.trim()) return result({ hata: 'galeri-kimligi-yok' });
  if (/[\/\\\u0000-\u001f\u007f]/.test(id) || id === '.' || id === '..') return result({ hata: 'galeri-kimligi-gecersiz' });
  // URI encoding rejects malformed Unicode rather than producing a broken link.
  try { encodeURIComponent(id); } catch (_) { return result({ hata: 'galeri-kimligi-gecersiz' }); }
  const state = api?.state || {};
  const uid = state.currentUser?.uid;
  const version = state.galeriOturumSurumu ?? 0;
  if (!uid || !api?.db || !api.fb?.doc || !api.fb?.setDoc) return result({ hata: 'galeri-bildirim-altyapisi-hazir-degil' });
  const session = sessionFor(api, uid, version);
  const active = () => {
    const current = api.state || {};
    return sessions.get(api) === session && current.currentUser?.uid === uid
      && (current.galeriOturumSurumu ?? 0) === version
      && (!api.auth || api.auth.currentUser?.uid === uid);
  };
  if (!active()) return result({ hata: 'galeri-oturumu-degisti' });
  let event = session.events.get(id);
  if (!event) {
    event = { saved: new Set(), pushes: new Map(), createdAt: new Date().toISOString(), inFlight: null, completed: null };
    session.events.set(id, event);
  }
  if (event.completed) return event.completed;
  if (event.inFlight) return event.inFlight;

  const send = async () => {
    const recipients = new Set([OWNER_EMAIL]);
    let recipientLookupFailed = false;
    try {
      const snapshot = await api.fb.getDocs(api.fb.collection(api.db, 'personeller'));
      if (active()) snapshot.forEach(person => {
        const email = recipientEmail(person);
        if (email) recipients.add(email);
      });
    } catch (_) {
      recipientLookupFailed = true;
    }
    const emails = [...recipients];
    const failures = [];
    const newlySaved = [];
    const content = {
      tip: 'galeri_onay', baslik: 'Galeri onayı bekleniyor',
      metin: 'Yeni bir galeri içeriği onayınızı bekliyor.',
      hedefSayfa: `galeri-onay.html?medya=${encodeURIComponent(id)}`
    };
    for (const email of emails) {
      if (!active()) break;
      if (event.saved.has(email)) continue;
      try {
        await api.fb.setDoc(api.fb.doc(api.db, 'bildirimler', notificationId(id, email)), {
          aliciEmail: email, ...content, kaynakId: id,
          olayAnahtari: `galeri-onay-istek:${id}`, olusturuldu: event.createdAt
          // Missing okundu is already interpreted as unread by the readers.
        }, { merge: true });
        event.saved.add(email);
        newlySaved.push(email);
      } catch (error) {
        failures.push({ email, hata: errorCode(error) });
      }
    }

    // A root record must exist before a push is attempted. Saved recipients are
    // not pushed again on partial retries. Even an uncertain FCM result is kept:
    // retrying that attempt could replay notifications already accepted by FCM.
    if (newlySaved.length && active()) {
      let push;
      try { push = await genelPushGonder(newlySaved, content); }
      catch (error) { push = { ok: false, hata: errorCode(error) }; }
      for (const email of newlySaved) event.pushes.set(email, push);
    }

    const stillActive = active();
    const adet = emails.filter(email => event.saved.has(email)).length;
    const pushResults = [...new Set(emails.map(email => event.pushes.get(email)).filter(Boolean))];
    const push = pushResults.length === 1 ? pushResults[0] : pushResults.length > 1
      ? { ok: pushResults.every(item => item?.ok === true), sonuclar: pushResults } : undefined;
    return result({
      ok: stillActive && !recipientLookupFailed && adet === emails.length,
      adet, istenen: emails.length, recipientLookupFailed, kayitHatalari: failures,
      ...(!stillActive ? { hata: 'galeri-oturumu-degisti' } : {}), ...(push ? { push } : {})
    });
  };
  event.inFlight = send();
  try {
    const outcome = await event.inFlight;
    if (outcome.ok) event.completed = outcome;
    return outcome;
  } finally {
    event.inFlight = null;
  }
}
