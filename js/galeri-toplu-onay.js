import {contentChildIds} from './egitim-gruplari-core.mjs';
import { galleryApprover, gallerySession, pendingGallery } from './galeri-onay-canli.js?v=186';
import { hedefVeliEmailleri } from './zeky-bildirim-koprusu.js?v=225';
import { genelPushGonder } from './zeky-operasyon-push.js';

export const GALLERY_NOTICE_INTERVAL = 10 * 60 * 1000;
export function galleryApprovalScope(media) {
  const type = media?.hedefTur || (media?.hedefOgrenciId ? 'ogrenci' : '');
  const value = String(media?.hedefDeger || media?.hedefOgrenciId || '').trim();
  if(type==='ogrenci'){const ids=contentChildIds(media);if(!ids.length)return null;return {hedefTur:type,hedefDeger:ids[0],...(ids.length>1?{ogrenciIds:ids}:{}),...(media.egitimGrupId?{egitimGrupId:media.egitimGrupId}:{})};}
  return ['sinif', 'ogrenci', 'tumOkul'].includes(type) && (type === 'tumOkul' || value)
    ? { hedefTur: type, hedefDeger: type === 'tumOkul' ? '' : value } : null;
}
export function galleryApprovalScopeKey(media) {
  const scope = galleryApprovalScope(media);
  return scope ? JSON.stringify([scope.hedefTur,scope.ogrenciIds?[...scope.ogrenciIds].sort():scope.hedefDeger,...(scope.egitimGrupId?[scope.egitimGrupId]:[])]) : '';
}

// Recheck on transaction retries: two approvers cannot publish the same item.
export async function reviewGalleryItem(id, decision, api) {
  if (!['onaylandi', 'reddedildi'].includes(decision)) throw new Error('Geçersiz onay işlemi');
  const session = gallerySession(api.state);
  const current = () => session === gallerySession(api.state) && galleryApprover(api.state);
  if (!current()) throw new Error('Onay yetkiniz yok');
  const { fb, db } = api;
  return fb.runTransaction(db, async tx => {
    if (!current()) throw new Error('Oturum değişti');
    const ref = fb.doc(db, 'galeri', id), snap = await tx.get(ref);
    if (!current()) throw new Error('Oturum değişti');
    if (!snap.exists() || !pendingGallery(snap.data().durum)) return null;
    const media = { ...snap.data(), id };
    tx.update(ref, { durum: decision, onaylayanEmail: api.state.currentUser.email,
      onayTarihi: new Date().toISOString() });
    return media;
  });
}

export function approveGalleryItem(id, api) { return reviewGalleryItem(id, 'onaylandi', api); }

// Commit the shared cooldown with the root notices. Principal permissions allow
// creating notices, not reading/updating recipient documents. Existing settings
// store only a hash and timestamp; no media, names or email addresses.
// Push runs once after commit. Uncertain FCM results are never replayed.
export async function notifyGalleryPublication(media, api = globalThis.window?.PortalAPI, options = {}) {
  const scope = galleryApprovalScope(media);
  if (!scope || !galleryApprover(api?.state || {})) return { ok: false, hata: 'hedef-veya-yetki-yok' };
  const session = gallerySession(api.state);
  const current = () => session === gallerySession(api.state) && galleryApprover(api.state);
  const recipients = [...new Set((options.recipients || hedefVeliEmailleri(scope)).map(e => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) return { ok: false, hata: 'alici-yok' };
  if (recipients.length > 499) return { ok: false, hata: 'bildirim-alici-siniri' };
  const kind = options.education ? 'egitim' : 'galeri';
  const period = String(api.state.aktifDonem || '');
  const key = JSON.stringify([period,kind,scope.hedefTur,scope.ogrenciIds?[...scope.ogrenciIds].sort():scope.hedefDeger,...(scope.egitimGrupId?[scope.egitimGrupId]:[])]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const { fb, db } = api;
  const marker = fb.doc(db, 'ayarlar', `galeriOnayBildirim_${hash}`);
  const content = options.education
    ? { tip: 'egitim_gelisim', baslik: 'Yeni eğitim güncellemesi', metin: 'Eğitim gelişimindeki yeni güncellemeleri inceleyebilirsiniz.', hedefSayfa: 'veli-egitim.html', ogrenciId: scope.hedefDeger }
    : { tip: 'galeri', baslik: 'Yeni galeri içeriği', metin: 'Galeriye yeni fotoğraf veya videolar eklendi. Tüm yeni içerikleri galeride görebilirsiniz.', hedefSayfa: 'galeri.html', ogrenciId: scope.hedefTur === 'ogrenci' && !scope.ogrenciIds ? scope.hedefDeger : '' };
  const refs = recipients.map(() => fb.doc(fb.collection(db, 'bildirimler')));
  try {
    const created = await fb.runTransaction(db, async tx => {
      if (!current()) throw new Error('Oturum değişti');
      const snap = await tx.get(marker);
      if (!current()) throw new Error('Oturum değişti');
      const now = options.now ? options.now() : Date.now();
      const previous = snap.exists() ? snap.data().sonBildirim?.toMillis?.() ?? Date.parse(snap.data().sonBildirim) : NaN;
      if (Number.isFinite(previous) && now - previous < GALLERY_NOTICE_INTERVAL) return false;
      const time = new Date(now).toISOString();
      for (let i = 0; i < recipients.length; i++) tx.set(refs[i], {
        aliciEmail: recipients[i], ...content, kaynakId: String(media.id || ''),
        olayAnahtari: `galeri-onay-grup:${hash}:${refs[0].id}`, okundu: false, olusturuldu: time
      });
      tx.set(marker, { sonBildirim: fb.serverTimestamp() });
      return true;
    });
    if (!created) return { ok: true, birlestirildi: true, adet: 0 };
    if (!current()) return { ok: true, adet: recipients.length, push: { ok: false, hata: 'oturum-degisti' } };
    const push = await (options.sendPush || genelPushGonder)(recipients, content);
    return { ok: true, adet: recipients.length, push };
  } catch (error) {
    return { ok: false, hata: String(error?.code || error?.message || error) };
  }
}
