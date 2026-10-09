// Read-only presentation data. Never copy this result into a gallery write or audience query.
const text = value => typeof value === 'string' ? value.trim() : '';
const first = (...values) => values.map(text).find(value => value && !['-', '—'].includes(value)) || '';
export function galleryPersonName(...values) {
  return values.map(text).find(value => value && !/@/.test(value) && !['-', '—', 'Öğretmen', 'Okul Personeli'].includes(value)) || '';
}
export function galleryEducationProgram(media = {}) {
  const known = ['montessori','orman','degerler','ingilizce','degerlerPlus','jimnastik','drama','kodlama'];
  for (const value of [media.program, media.kategori, media.programAd, media.etkinlikBaslik]) {
    if (known.includes(value)) return value;
    const normalized = text(value).toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
    if (/degerler\s*\+|degerlerplus/.test(normalized)) return 'degerlerPlus';
    for (const [fragment, code] of [['montessori','montessori'],['orman','orman'],['deger','degerler'],['ingiliz','ingilizce'],['english','ingilizce'],['jimnastik','jimnastik'],['drama','drama'],['kodlama','kodlama']]) {
      if (normalized.includes(fragment)) return code;
    }
  }
  return '';
}
export function galleryStudentId(media = {}) {
  const ids = [...new Set([media.ogrenciId, media.hedefOgrenciId, ['ogrenci','cocuk'].includes(media.hedefTur) ? media.hedefDeger : ''].map(text).filter(Boolean))];
  return ids.length === 1 ? ids[0] : '';
}
export function gallerySenderEmail(media = {}) {
  const emails = [...new Set([media.yukleyenEmail, media.yukleyen, media.gonderenEmail, media.olusturanEmail]
    .map(value => text(value).toLowerCase()).filter(value => /^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(value)))];
  return emails.length === 1 ? emails[0] : '';
}
export function galleryEducationMetadata(media = {}, {student = {}, settings = {}, personnel = {}, areas = [], observation = {}, currentPeriod = ''} = {}) {
  const parts = text(media.kazanimAnahtari).split('__');
  const program = galleryEducationProgram(media);
  const detail = observation?.[program]?.detay?.[media.kazanimAnahtari] || {};
  const stage = Object.entries(detail.asamalar || {}).find(([, value]) => media.id && value?.galeriId === media.id);
  const bound = detail.galeriId === media.id ? detail : {};
  const areaId = first(media.alanId, parts.length >= 3 ? parts[0] : '', bound.alanId);
  const area = (Array.isArray(areas) ? areas : []).find(value => value?.id === areaId) || {};
  const samePeriod = !media.donem || media.donem === currentPeriod;
  const studentName = first(media.hedefOgrenciAd, media.ogrenciAdSoyad, media.ogrenciAd,
    student.ogrenciAdSoyad, student.adSoyad, [student.ad, student.soyad].filter(Boolean).join(' '));
  const className = first(media.sinifAdi, media.hedefSinifAd, media.sinif,
    media.hedefTur === 'sinif' ? media.hedefDeger : '', settings.kayit?.sinif,
    samePeriod ? student.sinif : '', samePeriod ? student.sinifi : '');
  const senderName = galleryPersonName(media.yukleyenAd, media.yukleyenAdSoyad, media.gonderenAd, media.olusturanAd,
    personnel.adSoyad, [personnel.ad, personnel.soyad].filter(Boolean).join(' '), personnel.displayName);
  return {...media,
    hedefOgrenciAd:studentName, sinifAdi:className,
    alanId:areaId, alanAd:first(media.alanAd, bound.alanAd, area.ad),
    grupAd:first(media.grupAd, parts.length >= 3 ? parts[1] : '', bound.grupAd),
    kazanimAdi:first(media.kazanimAdi, parts.length >= 3 ? parts.slice(2).join('__') : '', bound.dersAd),
    gozlemDurum:first(media.gozlemDurum, stage?.[0], bound.durum),
    yukleyenAd:senderName, yukleyenRol:first(media.yukleyenRol, media.gonderenRol, personnel.rol)
  };
}
export async function hydrateGalleryEducationMetadata(media, {fb, db, state = {}, isCurrent = () => true} = {}) {
  const read = async (...path) => {
    if (!isCurrent() || !fb?.getDoc || !fb?.doc || !db || path.some(part => !text(part) || /[/\\]/.test(part))) return {};
    try { const snapshot = await fb.getDoc(fb.doc(db, ...path)); return isCurrent() && snapshot.exists() ? snapshot.data() || {} : {}; }
    catch (_) { return {}; } // A denied read is not permission to query broader collections.
  };
  const studentId = galleryStudentId(media), email = gallerySenderEmail(media);
  const period = first(media.donem, state.aktifDonem), program = galleryEducationProgram(media);
  const cachedStudent = (Array.isArray(state.ogrenciList) ? state.ogrenciList : []).find(value => value.id === studentId);
  const samePeriod = !media.donem || media.donem === state.aktifDonem;
  const cachedSettings = samePeriod ? state.ayarListesi?.[studentId] : null;
  const [student, settings, personnel, curriculum, observation] = await Promise.all([
    cachedStudent || (studentId ? read('ogrenciler', studentId) : {}),
    cachedSettings || (studentId && period ? read('ogrenciler', studentId, 'donemler', period) : {}),
    email ? read('personeller', email) : {},
    program ? read('mufredatlar', program) : {},
    studentId && media.kazanimAnahtari ? read('ogrenciGelisim', studentId) : {}
  ]);
  if (!isCurrent()) return null;
  return galleryEducationMetadata(media, {student, settings, personnel, areas:curriculum.alanlar || [], observation, currentPeriod:state.aktifDonem});
}
