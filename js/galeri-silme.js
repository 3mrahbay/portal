import { galleryApprover, gallerySession } from './galeri-onay-canli.js?v=186';
import { galleryProgram } from './galeri-klasorleri.js?v=225';

const TEACHERS = new Set(['ogretmen','yardimci_ogretmen','ingilizce_ogretmeni','degerler_ogretmeni','orman_ogretmeni','brans_ogretmeni']);
const email = value => String(value || '').trim().toLowerCase();
export function canDeleteGalleryMedia(media, state = {}) {
  if (!media || !state.currentUser?.uid) return false;
  if (galleryApprover(state)) return true;
  if (state.personel?.durum !== 'aktif' || state.personel?.aktif === false) return false;
  if (state.rol === 'egitim_koordinator') return true;
  const actor = email(state.currentUser.email);
  return !!actor && TEACHERS.has(state.rol)
    && ['yukleyenEmail','yukleyen','ekleyenEmail'].some(key => email(media[key]) === actor);
}
export function galleryDeleteButton(media, state) {
  if (!canDeleteGalleryMedia(media, state)) return '';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const action = `event.stopPropagation(); silGaleriOge(${JSON.stringify(String(media.id))})`;
  return `<button type="button" onclick="${escape(action)}" class="galeri-sil-btn" aria-label="İçeriği sil" style="position:absolute;z-index:5;top:6px;left:6px;background:#b91c1c;color:white;border:1px solid #fff;border-radius:8px;min-width:44px;min-height:36px;padding:6px 9px;cursor:pointer;font-size:12px;font-weight:700;">Sil</button>`;
}

// Remove only references to this exact media. Never delete a learning stage,
// observation text, assessment, date, or a newer photo of the same achievement.
export async function unlinkGalleryObservation(media, api, current = () => true) {
  const child = media.ogrenciId || media.hedefOgrenciId || (media.hedefTur === 'ogrenci' ? media.hedefDeger : '');
  const program = galleryProgram(media), key = media.kazanimAnahtari;
  if (!child || !program || !key) return;
  const {fb,db} = api;
  await fb.runTransaction(db, async tx => {
    if (!current()) throw new Error('Oturum değişti');
    const ref = fb.doc(db,'ogrenciGelisim',child), snap = await tx.get(ref);
    if (!current()) throw new Error('Oturum değişti');
    if (!snap.exists()) return;
    const data = snap.data(), detail = data[program]?.detay?.[key], patch = {};
    const clear = value => ({...value,fotoUrl:'',fotoYol:'',fotoDurum:'silindi'});
    if (detail) {
      let changed = false, next = {...detail};
      if (detail.galeriId === media.id) { next = clear(next); changed = true; }
      if (detail.asamalar) {
        const stages = {...detail.asamalar};
        for (const [stage,value] of Object.entries(stages)) if (value?.galeriId === media.id) {
          stages[stage] = clear(value); changed = true;
        }
        next.asamalar = stages;
      }
      if (changed) patch[program] = {...data[program],detay:{...data[program].detay,[key]:next}};
    }
    if (data.sonGozlem?.galeriId === media.id) patch.sonGozlem = clear(data.sonGozlem);
    if (Object.keys(patch).length) tx.set(ref,patch,{merge:true});
  });
}

export async function removeGalleryMedia(id, api) {
  const session = gallerySession(api.state);
  const current = () => session === gallerySession(api.state)
    && (!api.auth || api.auth.currentUser?.uid === api.state.currentUser?.uid);
  const {fb,db} = api;
  // Authoritative deletion happens before any storage request. A rule rejection
  // cannot remove the physical file while leaving its gallery record intact.
  const media = await fb.runTransaction(db, async tx => {
    if (!current()) throw new Error('Oturum değişti');
    const ref = fb.doc(db,'galeri',id), snap = await tx.get(ref);
    if (!current()) throw new Error('Oturum değişti');
    if (!snap.exists()) return null;
    const item = {...snap.data(),id};
    if (!canDeleteGalleryMedia(item,api.state)) throw new Error('Yalnızca kendi yüklediğiniz içerikleri silebilirsiniz.');
    tx.delete(ref);
    return item;
  });
  if (!media) return {removed:false,missing:true};
  const warnings = [];
  if (current()) {
    try { await unlinkGalleryObservation(media,api,current); }
    catch (_) { warnings.push('Eğitim fotoğrafı bağlantısı temizlenemedi.'); }
  } else warnings.push('Oturum değiştiği için dosya temizliği tamamlanamadı.');
  if (current()) {
    try {
      if (media.bunnyPath) await api.medya.sil(media.bunnyPath);
      else if (media.bunnyVideoId) {
        if (!api.medya?.videoSil) throw new Error('Video temizleme servisi yok');
        await api.medya.videoSil(media.bunnyVideoId);
      }
    } catch (_) { warnings.push('Galeri kaydı kaldırıldı; dosyanın depodan temizlenmesi tamamlanamadı.'); }
  }
  return {removed:true,media,warnings};
}
