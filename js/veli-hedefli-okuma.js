// VELİ HEDEFLİ OKUMA — Faz 3b gizlilik sözleşmesi (duyurular · takvim · galeri)
//
// Firestore kuralları filtre değildir: Faz 3b'de veli tüm koleksiyonu listeleyemez.
// Veli yalnız genel kayıtları ve kendi çocuğuna özel kayıtları, kuralın kanıtlayabildiği
// sorgu biçimleriyle okur. Bu dosya o biçimleri TEK YERDE üretir; kurallar da aynı
// sabitleri kullanır. Firestore fonksiyonları (collection, query, where, getDocs)
// dışarıdan verilir; böylece modül Node'da ağ olmadan sınanır.
//
// Kurallar: tarih aralığı (>=, <=) gibi ikinci bir alan aralığı sorguya eklenmez (bileşik
// indeks ister); aralık süzmesi istemcide yapılır. orderBy kullanılmaz. Ek koşullar yalnız
// eşitlik olabilir (ör. ['tarih', '==', bugün]).
import { icerikHedefi } from './icerik-hedefi.js?v=1';

export const GENEL_HEDEFLER = Object.freeze(['tumOkul', 'okul', 'tum', 'sinif']);
export const COCUK_HEDEFLERI = Object.freeze(['ogrenci', 'cocuk']);
export const EN_FAZLA_COCUK = 10;

// Koleksiyona göre çocuğa özel sorgu alanları.
// duyurular · takvim: çoklu öğrenci seçiminde tam liste "ogrenciler" dizisinde; hedefDeger yalnız ilk çocuk.
// galeri: hedefOgrenciId eski şema; her galeri sorgusu ayrıca durum == 'onaylandi' taşır.
const COCUK_ALANLARI = Object.freeze({
  duyurular: Object.freeze([['hedefDeger', '=='], ['ogrenciler', 'array-contains']]),
  takvim: Object.freeze([['hedefDeger', '=='], ['ogrenciler', 'array-contains']]),
  galeri: Object.freeze([['hedefDeger', '=='], ['hedefOgrenciId', '==']])
});

export const DESTEKLENEN_KOLEKSIYONLAR = Object.freeze(Object.keys(COCUK_ALANLARI));

// Çocuk listesi (kimlik metni ya da {id} nesnesi) → tekrarsız, boş olmayan, en çok 10 kimlik.
export function cocukIdleriniHazirla(cocuklar) {
  const idler = [];
  for (const cocuk of Array.isArray(cocuklar) ? cocuklar : []) {
    const id = typeof cocuk === 'string' ? cocuk.trim() : typeof cocuk?.id === 'string' ? cocuk.id.trim() : '';
    if (id && !idler.includes(id)) idler.push(id);
    if (idler.length === EN_FAZLA_COCUK) break;
  }
  return idler;
}

// Sözleşmedeki sorgu biçimlerini üretir:
//  (a) genel: hedefTur in GENEL_HEDEFLER
//  (b) her çocuk için: hedefTur in COCUK_HEDEFLERI + hedefDeger == id
//  (c) duyurular · takvim: + ogrenciler array-contains id · galeri: + hedefOgrenciId == id
export function veliSorgulariniOlustur(fb, db, koleksiyon, cocuklar, { genel = true, ekKosullar = [] } = {}) {
  const alanlar = COCUK_ALANLARI[koleksiyon];
  if (!alanlar) throw new Error(`Veli hedefli okuma bu koleksiyonu desteklemiyor: ${koleksiyon}`);
  for (const kosul of ekKosullar) {
    if (!Array.isArray(kosul) || kosul.length !== 3 || kosul[1] !== '==' || typeof kosul[0] !== 'string' || !kosul[0]) {
      throw new Error('Veli hedefli okumada ek koşul yalnız eşitlik olabilir: [alan, "==", değer]');
    }
  }
  const ortak = () => [
    ...(koleksiyon === 'galeri' ? [fb.where('durum', '==', 'onaylandi')] : []),
    ...ekKosullar.map(([alan, op, deger]) => fb.where(alan, op, deger))
  ];
  const sorgu = (...hedef) => fb.query(fb.collection(db, koleksiyon), ...ortak(), ...hedef);
  const sorgular = [];
  if (genel) sorgular.push(sorgu(fb.where('hedefTur', 'in', [...GENEL_HEDEFLER])));
  for (const id of cocukIdleriniHazirla(cocuklar)) {
    for (const [alan, op] of alanlar) {
      sorgular.push(sorgu(fb.where('hedefTur', 'in', [...COCUK_HEDEFLERI]), fb.where(alan, op, id)));
    }
  }
  return sorgular;
}

// Sorguları birlikte çalıştırır, belge kimliğine göre birleştirir. Hepsi başarısızsa ilk
// hatayı fırlatır; bir kısmı başarısızsa uyarı yazar ve başarılı sonuçlarla devam eder.
// Dönen nesne QuerySnapshot gibi kullanılır (docs, size, empty, forEach); eksik = kısmi sonuç.
export async function sorgulariBirlestir(fb, sorgular, { etiket = 'veli hedefli okuma', uyar } = {}) {
  const sonuclar = await Promise.allSettled((sorgular || []).map(async q => fb.getDocs(q)));
  const belgeler = new Map(), hatalar = [];
  for (const sonuc of sonuclar) {
    if (sonuc.status !== 'fulfilled') { hatalar.push(sonuc.reason); continue; }
    sonuc.value?.forEach?.(d => { if (d && d.id != null && !belgeler.has(d.id)) belgeler.set(d.id, d); });
  }
  if (sonuclar.length && hatalar.length === sonuclar.length) throw hatalar[0];
  if (hatalar.length) {
    const yaz = typeof uyar === 'function' ? uyar : (...x) => console.warn(...x);
    yaz(`${etiket}: ${hatalar.length}/${sonuclar.length} sorgu başarısız; başarılı sorgularla devam ediliyor.`,
      hatalar[0]?.code || hatalar[0]?.message || hatalar[0]);
  }
  const docs = [...belgeler.values()];
  return { docs, size: docs.length, empty: docs.length === 0, eksik: hatalar.length > 0, forEach(fn) { docs.forEach(fn); } };
}

// Tek çağrı: sözleşme sorgularını üret + birleştir. secenekler: { genel, ekKosullar, etiket, uyar }
export async function veliHedefliOku(fb, db, koleksiyon, cocuklar, secenekler = {}) {
  const { etiket = `${koleksiyon} veli okuması`, uyar, ...sorguSecenekleri } = secenekler;
  return sorgulariBirlestir(fb, veliSorgulariniOlustur(fb, db, koleksiyon, cocuklar, sorguSecenekleri), { etiket, uyar });
}

// Kayıt çocuğa özel mi (hedefTur/hedefTip: ogrenci | cocuk)?
export function cocukHedefliMi(kayit) {
  return COCUK_HEDEFLERI.includes(kayit?.hedefTur || kayit?.hedefTip || '');
}

// Çocuğa özel kayıt yalnız velinin kendi çocuğunu hedefliyorsa görünür. Eşleşme kuralı
// ortak hedef sözleşmesidir (icerik-hedefi.js, ZEKY ortakIcerikHedefi ile aynı): tek öğrenci
// (hedefDeger / hedefOgrenciId / ogrenciId aynı çocuk) ya da çoklu seçim ("ogrenciler");
// birbiriyle çelişen hedefli kayıt hiçbir veliye gösterilmez.
export function cocukHedefiUygunMu(kayit, cocuklar) {
  const h = icerikHedefi(kayit);
  if (h.tip !== 'cocuk') return false;
  return cocukIdleriniHazirla(cocuklar).some(id => h.ogrenciler.includes(id));
}
