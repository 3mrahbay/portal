// Student-list exports are built only from the management session's loaded,
// selected-year documents. No reads, writes, logging or external services here.
export const OGRENCI_LISTE_BASLIKLARI = Object.freeze([
  'Sıra No', 'Ad Soyad', 'T.C. Kimlik No', 'Doğum Tarihi', 'Yaşı',
  'Cinsiyet', 'Sınıfı', 'Anne Ad Soyad', 'Anne T.C. Kimlik No',
  'Baba Ad Soyad', 'Baba T.C. Kimlik No'
]);
const metin = value => typeof value === 'string' ? value.trim()
  : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const nesne = value => value && typeof value === 'object' && !Array.isArray(value);
const kendi = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
// An explicitly blank period field stays blank; do not resurrect old values.
const alan = (period, key, fallback) => metin(kendi(period, key) ? period[key] : fallback);

export function ogrenciListeYetkili(state) {
  return !!state?.currentUser?.uid && (state.isAdmin === true ||
    ['kurucu_mudur', 'mudur'].includes(state.rol));
}

export function okulTakvimTarihi(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const part = type => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function dogumTakvimi(value) {
  let text = metin(value), year, month, day;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T\d{2}:\d{2})/.exec(text);
  const tr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (tr) [, day, month, year] = tr.map(Number);
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

export function yasMetni(birth, asOf) {
  if (!birth || !asOf || birth.iso > asOf.iso) return '';
  const months = (asOf.year - birth.year) * 12 + asOf.month - birth.month - (asOf.day < birth.day ? 1 : 0);
  return `${Math.floor(months / 12)} yaş ${months % 12} ay`;
}

export function ogrenciListeHazirlik(state) {
  if (!ogrenciListeYetkili(state)) return 'Öğrenci listesi indirme yetkiniz yok.';
  const durum = state.ogrenciDisAktarDurumu;
  if (durum?.donem === state.aktifDonem && durum?.uid === state.currentUser.uid && durum.hataSayisi > 0)
    return 'Bazı dönem kayıtları okunamadı. Eksik liste indirilmedi; sayfayı yenileyip tekrar deneyin.';
  if (!state.ogrenciVerileriHazirMi || !durum?.hazir || durum.donem !== state.aktifDonem || durum.uid !== state.currentUser.uid)
    return 'Seçili dönemin öğrenci bilgileri yükleniyor. Lütfen bekleyin.';
  return '';
}

export function ogrenciListeRaporu(state, { now = new Date(), durumKapsami = 'aktif' } = {}) {
  const hata = ogrenciListeHazirlik(state);
  if (hata) throw new Error(hata);
  if (!['aktif', 'arsiv'].includes(durumKapsami)) throw new Error('Geçersiz liste kapsamı.');
  const donem = metin(state.aktifDonem);
  if (!/^\d{4}-\d{4}$/.test(donem)) throw new Error('Geçerli bir eğitim yılı seçin.');
  const tarih = okulTakvimTarihi(now), asOf = dogumTakvimi(tarih);
  const ids = new Set();
  const records = (state.ogrenciList || []).filter(student => {
    if (!student?.id || ids.has(student.id)) return false;
    ids.add(student.id);
    const period = state.ayarListesi?.[student.id];
    if (!kendi(state.ayarListesi, student.id) || !nesne(period) || period._anaKayitOzeti) return false;
    if (period.donemYili && metin(period.donemYili) !== donem)
      throw new Error('Dönem bilgilerinde uyuşmazlık var. Sayfayı yenileyip tekrar deneyin.');
    const status = metin(period.durum || student.durum || 'aktif').toLocaleLowerCase('tr').replace(/ı/g, 'i');
    // Same archive family as aktifDonemOzetAlanlari; applications and renewal
    // stages are neither active students nor archived students.
    const archived = ['arsiv', 'arşiv', 'pasif', 'ayrildi'].includes(status);
    return durumKapsami === 'arsiv' ? archived : status === 'aktif';
  }).map(student => {
    const period = state.ayarListesi[student.id], identity = period.ogrenci || {};
    const dob = dogumTakvimi(alan(identity, 'dogumTarihi', student.dogumTarihi));
    const birth = dob && dob.iso <= tarih ? dob : null;
    // Only explicit mother/father fields are accepted. A guardian or first
    // contact is not necessarily the mother; a second contact is not the father.
    const mother = nesne(period.anne) ? period.anne : {};
    const father = nesne(period.baba) ? period.baba : {};
    const gender = alan(identity, 'cinsiyet', student.cinsiyet);
    const genderKey = gender.toLocaleLowerCase('tr');
    const row = [
      0,
      alan(identity, 'adSoyad', student.ogrenciAdSoyad),
      alan(identity, 'tcKimlik', student.tcKimlik),
      birth ? `${String(birth.day).padStart(2, '0')}.${String(birth.month).padStart(2, '0')}.${birth.year}` : '',
      yasMetni(birth, asOf),
      ({ kiz: 'Kız', kız: 'Kız', erkek: 'Erkek' })[genderKey] || gender,
      alan(period.kayit, 'sinif', student.aktifDonem === donem ? (student.sinif || student.sinifi) : ''),
      metin(mother.adSoyad), metin(mother.tcKimlik),
      metin(father.adSoyad), metin(father.tcKimlik)
    ];
    return { id: String(student.id), row };
  });
  records.sort((a, b) => a.row[6].localeCompare(b.row[6], 'tr') || a.row[1].localeCompare(b.row[1], 'tr') || a.id.localeCompare(b.id));
  const satirlar = records.map(({ row }, index) => { row[0] = index + 1; return row; });
  return { donem, tarih, durumKapsami, basliklar: [...OGRENCI_LISTE_BASLIKLARI], satirlar,
    kapsam: durumKapsami === 'aktif' ? 'Aktif öğrenciler' : 'Arşiv öğrencileri',
    not: 'Boş hücreler: kayıtlı bilgi yok veya tarih geçersiz. Yaş, çıktı tarihine göre hesaplanır.' };
}

export function ogrenciListeDosyaAdi(report, extension) {
  if (!['xlsx', 'pdf'].includes(extension)) throw new Error('Geçersiz dosya türü.');
  return `Ogrenci-Listesi_${report.donem}_${report.durumKapsami}_${report.satirlar.length}-ogrenci_${report.tarih}.${extension}`;
}
