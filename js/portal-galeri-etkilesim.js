// The same existing schema as ZEKY. No new permissions or tracking fields.
export function management(state = {}) {
  return !!state.isAdmin || ['kurucu_mudur', 'mudur'].includes(state.rol);
}
export function displayName(value, fallback = 'Veli') {
  const s = String(value || '').trim();
  return s && !/@/.test(s) && !/\+?\d[\d\s()\-]{7,}\d/.test(s) ? s : fallback;
}
export async function emailHash(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s || !globalThis.crypto?.subtle) return '';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}
function childClass(child, state) {
  return state.ayarListesi?.[child.id]?.kayit?.sinif || child._donemVeri?.kayit?.sinif || child.sinif || child.sinifi || '';
}
export function classKey(value) {
  let s = String(value || '').toLocaleLowerCase('tr').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]/g,'');
  s = s.replace(/ciceklerisinifi|cicekler|sinifi|sinif/g,'');
  if (s.includes('papatya') || s.includes('mimoza') || s === 'montessori1' || s === 'toddler') return 'mimoza';
  if (s.includes('kardelen') || s.includes('yasemin') || s === 'montessori2') return 'yasemin';
  if (s.includes('nar') || s.includes('lavanta') || s === 'montessori3') return 'lavanta';
  if (s.includes('ilkadim')) return 'ilkadimlar';
  return s;
}
export function targetChild(media, children, state = {}) {
  if (media?.durum !== 'onaylandi') return null;
  return (children || []).find(child => {
    if (media.hedefTur === 'tumOkul') return true;
    if (media.hedefTur === 'ogrenci') return [media.hedefDeger, media.hedefOgrenciId, media.ogrenciId].filter(Boolean).includes(child.id);
    if (media.hedefTur === 'sinif') return !!media.hedefDeger && classKey(media.hedefDeger) === classKey(childClass(child, state));
    return false;
  }) || null;
}
export function interactionPatch(previous, type, now, completed = false) {
  if (type === 'acma') return { ilkAcma:previous.ilkAcma || now, sonAcma:now, acmaSayisi:Number(previous.acmaSayisi || 0) + 1 };
  if (type === 'indirme') return { indirmeBaslatildi:true, indirildi:completed || previous.indirildi === true,
    sonIndirme:now, sonIndirmeDurumu:completed ? 'tamamlandi' : 'baslatildi', indirmeSayisi:Number(previous.indirmeSayisi || 0) + 1 };
  return null;
}
export function createInteractionService(getApi) {
  async function record(media, type, completed = false) {
    const api = getApi(), state = api?.state || {}, user = state.currentUser;
    const child = targetChild(media, state.veliOgrenciler, state);
    if (state.rol !== 'veli' || !user?.uid || !user?.email || !media?.id || !child) return false;
    const hash = await emailHash(user.email), latest = getApi()?.state || {};
    if (!hash || latest.currentUser?.uid !== user.uid || latest.rol !== 'veli') return false;
    const { fb, db } = api;
    if (!fb?.runTransaction) throw new Error('Etkileşim kaydı için işlem desteği bulunamadı');
    const ref = fb.doc(db, 'galeri', media.id, 'etkilesimler', user.uid);
    await fb.runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const previous = snapshot.exists() ? snapshot.data() || {} : {};
      const now = new Date().toISOString(), patch = interactionPatch(previous, type, now, completed);
      if (!patch || getApi()?.state?.currentUser?.uid !== user.uid) return;
      transaction.set(ref, { veliUid:user.uid, veliEmailHash:hash, ogrenciId:child.id, uygulama:'portal', guncellendi:now, ...patch }, { merge:true });
    });
    return true;
  }
  async function report(media) {
    const api = getApi(), state = api?.state || {}, owner = state.currentUser?.uid;
    if (!management(state) || !owner || media?.durum !== 'onaylandi') throw new Error('Bu bilgi yalnızca yönetime açıktır');
    const {fb, db} = api;
    const students = (state.ogrenciList || []).filter(child => {
      const settings = state.ayarListesi?.[child.id] || {};
      if (api.ogrenciDurum && api.ogrenciDurum(child, settings) !== 'aktif') return false;
      return !!targetChild(media, [child], state);
    });
    const byId = new Map(students.map(child => [child.id, child]));
    const [parents, events] = await Promise.all([
      fb.getDocs(fb.collection(db, 'veliler')),
      fb.getDocs(fb.collection(db, 'galeri', media.id, 'etkilesimler'))
    ]);
    const records = events.docs.map(d => d.data() || {}), rows = [];
    for (const parent of parents.docs) {
      const value = parent.data() || {};
      const children = (Array.isArray(value.ogrenciIds) ? value.ogrenciIds : []).filter(id => byId.has(id));
      if (value.onaylandi !== true || !children.length) continue;
      const hash = await emailHash(parent.id);
      const matches = records.filter(r => hash && r.veliEmailHash === hash);
      rows.push({ name:displayName(value.adSoyad || [value.ad, value.soyad].filter(Boolean).join(' ')),
        children:children.map(id => displayName(byId.get(id).ogrenciAdSoyad || byId.get(id).adSoyad || byId.get(id).ad, 'Öğrenci')),
        opened:matches.some(r => r.ilkAcma || Number(r.acmaSayisi) > 0),
        downloaded:matches.some(r => r.indirildi === true),
        started:matches.some(r => r.indirmeBaslatildi || Number(r.indirmeSayisi) > 0),
        favorite:matches.some(r => r.favori === true),
        lastOpen:matches.map(r => String(r.sonAcma || r.ilkAcma || '')).sort().at(-1) || '' });
    }
    if (getApi()?.state?.currentUser?.uid !== owner || !management(getApi()?.state)) throw new Error('Oturum değişti');
    return rows;
  }
  return { record, report };
}
