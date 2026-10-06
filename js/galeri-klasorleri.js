// Display-only folder identity. Never use a folder key to grant media access.
export const GALLERY_PROGRAMS = Object.freeze({
  montessori: 'Montessori', orman: 'Orman Okulu', degerler: 'Değerler Eğitimi',
  ingilizce: 'İngilizce Eğitimi', degerlerPlus: 'Değerler+',
  jimnastik: 'Jimnastik', drama: 'Drama', kodlama: 'Kodlama'
});

export function galleryText(value) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function galleryProgram(m = {}) {
  const aliases = {
    montessori:'montessori', orman:'orman', 'orman okulu':'orman',
    degerler:'degerler', 'değerler':'degerler', 'değerler eğitimi':'degerler',
    'degerler egitimi':'degerler', degerlerplus:'degerlerPlus',
    'değerler+':'degerlerPlus', 'degerler+':'degerlerPlus',
    ingilizce:'ingilizce', 'ingilizce eğitimi':'ingilizce', 'ingilizce egitimi':'ingilizce', english:'ingilizce',
    jimnastik:'jimnastik', cimnastik:'jimnastik', drama:'drama', dram:'drama', kodlama:'kodlama'
  };
  const kod = value => {
    const key = galleryText(value).toLocaleLowerCase('tr');
    return Object.hasOwn(aliases, key) ? aliases[key] : '';
  };

  // Yeni kayıtlarda albumTuru kaynağın niyetidir. "Genel" seçilmiş bir
  // kaydı eski başlık/program kalıntıları eğitim klasörüne taşıyamaz.
  const albumTuru = galleryText(m.albumTuru).toLocaleLowerCase('tr');
  if (albumTuru === 'genel') return '';

  // Açık program alanı her zaman önceliklidir.
  const program = galleryText(m.program);
  if (program) return kod(program);

  // Kategori açıkça Genel/Kategorisiz ise başlıktan program tahmin etme.
  const kategori = galleryText(m.kategori);
  if (kategori) {
    const anahtar = kategori.toLocaleLowerCase('tr');
    if (['genel','kategorisiz','diğer','diger'].includes(anahtar)) return '';
    return kod(kategori);
  }

  // Yalnız eski kayıtlarda program/kategori alanı hiç yoksa başlıktan
  // geriye dönük uyumluluk için kesin program adı kurtarılır.
  return kod(m.etkinlikBaslik);
}
export function galleryIsObservation(media = {}) {
  return Boolean(galleryText(media.kazanimAnahtari));
}

export function galleryTopic(m = {}) {
  const acik = galleryText(m.konuBaslik);
  if (acik) return acik;
  const program = galleryProgram(m);
  for (const deger of [m.baslik, m.etkinlikBaslik]) {
    const baslik = galleryText(deger), anahtar = galleryText(baslik).toLocaleLowerCase('tr');
    if (!baslik || ['fotoğraf', 'fotograf', 'foto', 'photo', 'video', 'diğer', 'diger'].includes(anahtar)) continue;
    if (program && galleryProgram({program:baslik}) === program) continue;
    return baslik;
  }
  return 'Genel';
}
export function galleryAudience(m = {}) {
  const tur = m.hedefTur || ((m.hedefOgrenciId || m.ogrenciId) ? 'ogrenci' : m.sinif ? 'sinif' : 'tumOkul');
  if (['tumOkul', 'okul', 'tum'].includes(tur)) return [tur, ''];
  if (tur === 'ogrenci') return ['ogrenci', String(m.hedefDeger || m.hedefOgrenciId || m.ogrenciId || '')];
  if (tur === 'sinif') return ['sinif', String(m.hedefDeger || m.sinif || '')];
  return [String(tur), String(m.hedefDeger || '')];
}
export function galleryTopicKey(media = {}) {
  return JSON.stringify([galleryProgram(media), galleryTopic(media).toLocaleLowerCase('tr'), ...galleryAudience(media), String(media.donem || '')]);
}

export function galleryFolderKey(media = {}) {
  if (galleryIsObservation(media)) {
    const area = String(media.alanId || media.kazanimAnahtari || '').split('__')[0] || 'genel';
    return 'alan:' + area;
  }
  return 'konu:' + galleryTopicKey(media);
}

export function galleryTopicGroups(media = []) {
  const groups = new Map();
  for (const item of media) {
    const key = galleryFolderKey(item);
    if (!groups.has(key)) groups.set(key, { key, title: galleryTopic(item), media: [] });
    groups.get(key).media.push(item);
  }
  return [...groups.values()];
}
