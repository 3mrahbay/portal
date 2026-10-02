// Saf sınıf eşleştirme: oturum, Firebase ve kayıt yazımı içermez.
// Bilinen eski adlar ZEKY ile aynı sınıfa gider. Özel sınıflarda ilk kelime
// veya önek eşleşmesi yapılmaz; "Mimoza B" ve "Montessori 10" ayrı kalır.
function metin(deger) {
  return typeof deger === 'string' ? deger.trim() : '';
}

function normalize(deger) {
  return metin(deger).normalize('NFKC').toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

const siniflar = new Map();
const gruplar = [
  ['ilk-adimlar', ['ilk adimlar']],
  ['mimoza', ['mimoza', 'mimozalar', 'papatya', 'papatyalar', 'papatyalar toddler', 'papatyalar (toddler)', 'papatyalartoddler', 'toddler', 'toodler', 'montessori1', 'montessori 1']],
  ['yasemin', ['yasemin', 'yaseminler', 'kardelen', 'kardelenler', 'montessori2', 'montessori 2']],
  ['lavanta', ['lavanta', 'lavantalar', 'nar', 'montessori3', 'montessori 3']]
];
for (const [kimlik, adlar] of gruplar) {
  for (const ad of adlar) {
    for (const cicek of ['', ' cicekleri', ' cicegi']) {
      for (const ek of ['', ' sinifi', ' sinif', ' grubu', ' grup', ' subesi', ' sube']) {
        siniflar.set(ad + cicek + ek, kimlik);
        siniflar.set((ad + cicek + ek).replace(/ /g, ''), kimlik);
      }
    }
  }
}

export function sinifKimligi(deger) {
  const ad = normalize(deger);
  return ad ? (siniflar.has(ad) ? `resmi:${siniflar.get(ad)}` : `ozel:${ad}`) : '';
}

export function sinifEslesir(a, b) {
  const kimlik = sinifKimligi(a);
  return !!kimlik && kimlik === sinifKimligi(b);
}

// İlk dolu alan yetkilidir; eski sinifi alanı güncel sınıfı geçersiz kılamaz.
export function ogrenciSinifiCoz(ogrenci, ayar) {
  return metin(ayar?.kayit?.sinif) || metin(ogrenci?.sinif) || metin(ogrenci?.sinifi);
}
