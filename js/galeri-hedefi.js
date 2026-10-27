// GALERİ HEDEFİ — çoklu çocuk (Portal + ZEKY ortak sözleşme, 27 Eki 2026)
//
// Bir galeri fotoğrafı tüm okula, bir sınıfa ya da seçilen çocuklara gider. Çocuk hedefinde TAM
// liste `ogrenciler` dizisindedir; `hedefDeger`, `hedefOgrenciId` ve `ogrenciId` eski istemciler
// ile Faz 3b kuralı için ilk çocuktur. Eski kayıtlarda dizi yoktur: tek çocuk tekil alanlardadır.
//
// Eşleşme kuralı duyuru/takvimle aynıdır (icerik-hedefi.js → icerikHedefi): tekil alanlar listeyle
// çelişirse kayıt hiçbir veliye gösterilmez (fail-closed).
//
// Fotoğraf izni (Emrah, 27 Eki): yalnız izni AÇIKÇA geri alınmış çocuk seçilemez — izinGunlugu'nda
// o çocuğun tur:'foto' en son kaydı durum:true değilse. Kaydı olmayan çocuk izinli (kayıt sözleşmesi).
import { icerikHedefi } from './icerik-hedefi.js?v=1';

export const GALERI_EN_FAZLA_COCUK = 30;
export const IZIN_YOK_METNI = 'Fotoğraf izni yok';

// Galeri kaydının çocuk kümesi (çocuk hedefi değilse ya da çelişkiliyse boş)
export function galeriCocuklari(m) {
  if (!m || (m.hedefTur !== 'ogrenci' && m.hedefTur !== 'cocuk')) return [];
  const h = icerikHedefi(m);
  return h.tip === 'cocuk' ? [...h.ogrenciler] : [];
}

export function galeriCocugaAitMi(m, cocukId) {
  return !!cocukId && galeriCocuklari(m).includes(cocukId);
}

// Albüm / klasör ayırımı için hedef parçası: çoklu kayıt ilk çocuğun albümüyle birleşmez.
export function galeriHedefAnahtari(m) {
  if (m?.hedefTur === 'ogrenci' || m?.hedefTur === 'cocuk') {
    const c = galeriCocuklari(m);
    return c.length ? 'ogrenci:' + [...c].sort().join(',') : 'ogrenci:?';
  }
  return `${m?.hedefTur || ''}:${m?.hedefDeger || ''}`;
}

// İzin günlüğü kaydının zamanı (ms): sunucu zamanı (olusturuldu, Timestamp) varsa o, yoksa istemci "tarih"i.
// İstemci saati yanlış olabildiği için sıralamada sunucu zamanı önceliklidir.
export function izinKaydiZamani(k) {
  const o = k?.olusturuldu;
  if (o) {
    if (typeof o.toMillis === 'function') { const ms = o.toMillis(); if (Number.isFinite(ms)) return ms; }
    if (Number.isFinite(o.seconds)) return o.seconds * 1000 + Math.floor((Number(o.nanoseconds) || 0) / 1e6);
    if (Number.isFinite(o._seconds)) return o._seconds * 1000 + Math.floor((Number(o._nanoseconds) || 0) / 1e6);
    if (typeof o === 'string' || o instanceof Date) { const ms = Date.parse(o); if (Number.isFinite(ms)) return ms; }
  }
  const t = Date.parse(String(k?.tarih || ''));
  return Number.isFinite(t) ? t : 0;
}

// izinGunlugu kayıtları → izni geri alınmış çocuk kimlikleri (en son 'foto' kaydı durum:true değil).
// Öğrenci kimliği boş kayıt yok sayılır.
export function fotoIzniGeriAlinanlar(kayitlar = []) {
  const son = new Map();
  [...(Array.isArray(kayitlar) ? kayitlar : [])]
    .filter(k => k && k.tur === 'foto' && typeof k.ogrenciId === 'string' && k.ogrenciId.trim())
    .sort((a, b) => izinKaydiZamani(b) - izinKaydiZamani(a))
    .forEach(k => { const id = k.ogrenciId.trim(); if (!son.has(id)) son.set(id, k); });
  return new Set([...son.entries()].filter(([, k]) => k.durum !== true).map(([id]) => id));
}

// Onaylı (durum 'onaylandi') galeri yazımlarının taşıdığı izin denetimi sürümü: yazımdan hemen önce çocuk
// kümesinin fotoğraf izni (bu dosyadaki kural) sunucudan yeniden okundu. Kurallar çoklu çocuk kaydında arar.
export const GALERI_IZIN_KONTROL_SURUMU = 2;

// Formdaki seçimden galeri hedef alanları. ogrenciler: [{ id, ad }] ya da kimlik metni.
export function galeriHedefAlanlari({ tur, sinif = '', ogrenciler = [] } = {}) {
  if (tur === 'tumOkul') {
    return { hedefTur: 'tumOkul', hedefDeger: '', hedefOgrenciId: '', hedefOgrenciAd: '', ogrenciler: [] };
  }
  if (tur === 'sinif') {
    const s = typeof sinif === 'string' ? sinif.trim() : '';
    if (!s) throw new Error('Sınıf seçin');
    return { hedefTur: 'sinif', hedefDeger: s, hedefOgrenciId: '', hedefOgrenciAd: '', ogrenciler: [] };
  }
  if (tur === 'ogrenci') {
    const secim = [];
    for (const o of Array.isArray(ogrenciler) ? ogrenciler : []) {
      const id = typeof o === 'string' ? o.trim() : typeof o?.id === 'string' ? o.id.trim() : '';
      if (id && !secim.some(x => x.id === id)) secim.push({ id, ad: typeof o?.ad === 'string' ? o.ad.trim() : '' });
    }
    if (!secim.length) throw new Error('En az bir öğrenci seçin');
    if (secim.length > GALERI_EN_FAZLA_COCUK) throw new Error(`Bir yüklemede en çok ${GALERI_EN_FAZLA_COCUK} öğrenci seçebilirsiniz`);
    const ilk = secim[0].id;
    return {
      hedefTur: 'ogrenci', hedefDeger: ilk, hedefOgrenciId: ilk, ogrenciId: ilk,
      ogrenciler: secim.map(o => o.id),
      // Kayıt hedefteki her velinin cihazına iner: birden fazla çocukta başka çocuğun adı yazılmaz.
      hedefOgrenciAd: secim.length === 1 ? secim[0].ad : `${secim.length} öğrenci`,
      sinif: '', izinsizOgrenciler: []
    };
  }
  throw new Error('Bilinmeyen galeri hedefi: ' + tur);
}

// Var olan kaydın hedefini (albüme / konuya ekleme) yeni medyaya birebir taşır.
export function galeriHedefKopyala(m) {
  if (!m) return null;
  if (m.hedefTur === 'ogrenci' || m.hedefTur === 'cocuk') {
    const c = galeriCocuklari(m);
    if (!c.length) return null; // çelişkili kayda ekleme yapılmaz
    return { hedefTur: 'ogrenci', hedefDeger: c[0], hedefOgrenciId: c[0], ogrenciId: c[0], ogrenciler: c,
      hedefOgrenciAd: c.length === 1 ? String(m.hedefOgrenciAd || '') : `${c.length} öğrenci`, sinif: '', izinsizOgrenciler: [] };
  }
  if (m.hedefTur === 'sinif') return { hedefTur: 'sinif', hedefDeger: m.hedefDeger || '', hedefOgrenciId: '', hedefOgrenciAd: '', ogrenciler: [] };
  return { hedefTur: 'tumOkul', hedefDeger: '', hedefOgrenciId: '', hedefOgrenciAd: '', ogrenciler: [] };
}

// Veli ekranı: yalnız velinin kendi çocuk(lar)ının adı. cocuklar: [{ id, ad }]
export function galeriVeliEtiketi(m, cocuklar = []) {
  const c = galeriCocuklari(m);
  const kendi = (cocuklar || []).filter(x => x && c.includes(x.id)).map(x => x.ad).filter(Boolean);
  return kendi.length ? `Size özel · ${kendi.join(', ')}` : 'Size özel';
}
