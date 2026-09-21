// SG-2: no permission changes, no alternate credentials, no automatic retries.
// Only the primary write acknowledges the notice. A failed reception copy is
// reported separately; it must not erase the primary write or imply delivery.
export const SURUM = 'SABAH-GIRIS-KAYDI-2';
const validId = x => typeof x === 'string' && x.length > 0 && x.length <= 512 && !x.includes('/');
const err = code => Object.assign(new Error(code), { code });
export const hataKodu = e => /^[a-z0-9/-]{1,80}$/.test(e?.code || '') ? e.code : 'unknown';

export async function sabahGirisKaydet(api) {
  const { fb, db, state, bugun } = api || {};
  const user = api?.auth?.currentUser;
  const child = state?.veliAktifOgrenci || state?.veliOgrenciler?.[0];
  if (!user || !child || state?.currentUser?.uid !== user.uid) throw err('sabah/session-mismatch');
  if (!validId(child.id) || typeof user.email !== 'string' || !user.email) throw err('sabah/invalid-context');
  const date = bugun();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw err('sabah/invalid-date');
  const uid = user.uid, childId = child.id, id = childId + '__' + date;
  const active = () => api.auth?.currentUser?.uid === uid &&
    (api.state?.veliAktifOgrenci || api.state?.veliOgrenciler?.[0])?.id === childId;
  const check = () => { if (!active()) throw err('sabah/session-changed'); };
  const primaryRef = fb.doc(db, 'sabahGirisleri', id);
  let existing = null;
  try {
    const snap = await fb.getDoc(primaryRef);
    check();
    if (snap.exists()) existing = snap.data();
  } catch (e) {
    check();
    // A GET denied on a missing resource does NOT establish its existence.
    // Attempt the normal authorized write; never interpret this as a grant.
    if (!['permission-denied', 'firestore/permission-denied'].includes(e.code)) throw e;
  }
  if (existing && existing.ogrenciId !== childId) throw err('sabah/student-mismatch');
  if (existing?.sinifaGirisOnayi) return { anaKayitKaydedildi: false, zatenTeslimAlindi: true, danismaAktarildi: null };
  const notice = {
    veliBildirdi: true,
    veliBildirimSaati: new Date().toISOString(),
    veliBildirenEmail: user.email.toLowerCase(),
    guncellendi: fb.serverTimestamp()
  };
  const initial = {
    ogrenciId: childId,
    ogrenciAd: child.ogrenciAdSoyad || child.adSoyad || '',
    sinif: state.ayarListesi?.[childId]?.kayit?.sinif || child.sinif || '',
    tarih: date, ...notice
  };
  check();
  if (existing) {
    // Parent update rule permits only these four fields. Do not rewrite class,
    // student name, admission confirmation, staff identity or historical data.
    await fb.updateDoc(primaryRef, notice);
  } else {
    await fb.setDoc(primaryRef, initial, { merge: true });
  }
  const result = { anaKayitKaydedildi: true, zatenTeslimAlindi: false, danismaAktarildi: false, danismaHataKodu: '' };
  if (!active()) return { ...result, danismaHataKodu: 'sabah/session-changed' };
  try {
    const projectionRef = fb.doc(db, 'danismaSabahGirisleri', id);
    const snap = await fb.getDoc(projectionRef);
    check();
    const noticeOnly = { veliBildirdi: true, veliBildirimSaati: notice.veliBildirimSaati, guncellendi: fb.serverTimestamp() };
    if (snap.exists()) {
      await fb.updateDoc(projectionRef, noticeOnly);
    } else {
      const source = existing || initial;
      await fb.setDoc(projectionRef, {
        ogrenciId: childId, ogrenciAd: source.ogrenciAd || '',
        sinif: source.sinif || '', tarih: date, ...noticeOnly
      });
    }
    result.danismaAktarildi = true;
  } catch (e) { result.danismaHataKodu = hataKodu(e); }
  return result;
}
