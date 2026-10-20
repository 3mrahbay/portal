// İÇERİK HEDEFİ — duyuru · takvim ortak hedef sözleşmesi (Portal + ZEKY)
//
// Bir duyuru ya da takvim kaydı üç hedeften birine gider: tüm okul, sınıf ya da
// seçilen öğrenciler. Kayıt iki şekilde yazılmış olabilir:
//   Portal : hedefTur ('tumOkul'|'sinif'|'ogrenci') + hedefDeger (tek değer)
//   ZEKY   : hedefTip ('okul'|'sinif'|'cocuk')      + siniflar[] / ogrenciler[]
// Çoklu öğrenci seçiminde TAM liste `ogrenciler` dizisindedir; `hedefDeger` eski
// istemciler ve Faz 3b kuralları için yalnız ilk öğrencidir.
//
// icerikHedefi(), ZEKY'deki ortakIcerikHedefi() (www/js/zeky-data.js) ile AYNI
// kuralları uygular: çelişen kayıt 'bilinmiyor' olur ve hiçbir veliye gösterilmez.
// Biri değişirse öteki de değişmeli (tests/icerik-hedefi.test.mjs iki tarafı karşılaştırır).
import { sinifEslesir } from './ogretmen-sinif-core.js?v=173';

const TUR = { tumOkul: 'okul', okul: 'okul', tum: 'okul', sinif: 'sinif', ogrenci: 'cocuk', cocuk: 'cocuk' };
const BILINMIYOR = Object.freeze({ tip: 'bilinmiyor', siniflar: Object.freeze([]), ogrenciler: Object.freeze([]) });

function liste_(deger) {
  return Array.isArray(deger) ? deger.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()) : [];
}
function liste(deger) {
  return (Array.isArray(deger) ? deger : [deger])
    .filter(v => typeof v === 'string' && v.trim())
    .map(v => v.trim());
}

// Kayıt → { tip: 'okul'|'sinif'|'cocuk'|'bilinmiyor', siniflar[], ogrenciler[] }
export function icerikHedefi(d) {
  if (!d) return BILINMIYOR;
  const turu = deger => TUR[deger] || 'bilinmiyor';
  const portalTur = d.hedefTur ? turu(d.hedefTur) : '';
  const zekyTur = d.hedefTip ? turu(d.hedefTip) : '';
  const tip = portalTur || zekyTur || 'okul';
  if (tip === 'bilinmiyor' || (portalTur && zekyTur && portalTur !== zekyTur)) return BILINMIYOR;
  const tek = liste(d.hedefDeger);
  const siniflar = liste(d.siniflar);
  const ogrencilerBir = liste(d.ogrenciler);
  const ogrencilerIki = liste(d.ogrenciIds);
  if (ogrencilerBir.length && ogrencilerIki.length &&
      (ogrencilerBir.some(id => !ogrencilerIki.includes(id)) || ogrencilerIki.some(id => !ogrencilerBir.includes(id)))) return BILINMIYOR;
  const ogrenciler = [...new Set([...ogrencilerBir, ...ogrencilerIki])];
  const ozel = [...liste(d.hedefOgrenciId), ...liste(d.ogrenciId)];
  if (new Set(ozel).size > 1) return BILINMIYOR;
  // Açık liste tüm alıcıları taşır; tekil takma adlar listeyle uyuşmalı,
  // listeyi genişletemez ya da sessizce ilk alıcıya indiremez.
  if (ogrenciler.length && ozel.some(id => !ogrenciler.includes(id))) return BILINMIYOR;
  if (tek.length && ozel.some(id => !tek.includes(id))) return BILINMIYOR;
  const birlesik = ogrenciler.length ? ogrenciler : [...new Set(ozel)];
  if (tip === 'okul') {
    return tek.length || siniflar.length || birlesik.length ? BILINMIYOR : { tip, siniflar: [], ogrenciler: [] };
  }
  if (tip === 'sinif') {
    if (birlesik.length || (tek.length && siniflar.length &&
        !tek.every(t => siniflar.some(s => sinifEslesir(s, t))))) return BILINMIYOR;
    return { tip, siniflar: siniflar.length ? [...new Set(siniflar)] : tek, ogrenciler: [] };
  }
  if (siniflar.length || (tek.length && birlesik.length && !tek.every(id => birlesik.includes(id)))) return BILINMIYOR;
  return { tip, siniflar: [], ogrenciler: ogrenciler.length ? ogrenciler : (tek.length ? tek : birlesik) };
}

// Kayıt, verilen sınıflardaki ya da verilen çocuklardan birine yönelik mi?
// (veli: kendi çocukları ve onların sınıfları; öğretmen: kendi sınıfları)
export function hedefKapsar(d, { siniflar = [], ogrenciIds = [] } = {}) {
  const h = icerikHedefi(d);
  if (h.tip === 'okul') return true;
  if (h.tip === 'sinif') return h.siniflar.some(hs => (siniflar || []).some(s => sinifEslesir(hs, s)));
  if (h.tip === 'cocuk') return h.ogrenciler.some(id => (ogrenciIds || []).includes(id));
  return false;
}

// Bir öğrenci kaydın hedefinde mi? (alıcı çözümü: e-posta, anlık bildirim, okunma sayacı)
export function ogrenciHedefte(d, ogrenciId, ogrenciSinifi = '') {
  const h = icerikHedefi(d);
  if (h.tip === 'okul') return true;
  if (h.tip === 'sinif') return !!ogrenciSinifi && h.siniflar.some(s => sinifEslesir(s, ogrenciSinifi));
  if (h.tip === 'cocuk') return !!ogrenciId && h.ogrenciler.includes(ogrenciId);
  return false;
}

export function cocukHedefli(d) {
  return icerikHedefi(d).tip === 'cocuk';
}

// Formdaki seçimden Firestore alanları. Her yazımda TÜM hedef alanları yazılır;
// böylece Portal'da ya da ZEKY'de düzenlenen kayıt iki tarafta da tutarlı kalır.
//   ogrenciler: [{ id, ad }]   — ad yalnız tek öğrencide kayda girer
//   siniflar: ZEKY'de birden fazla sınıfa yazılmış kaydı düzenlerken tüm sınıfları korumak için
export function hedefAlanlari({ tur, sinif = '', siniflar = null, ogrenciler = [] } = {}) {
  if (tur === 'tumOkul' || tur === 'okul') {
    return { hedefTur: 'tumOkul', hedefTip: 'okul', hedefDeger: '', siniflar: [], ogrenciler: [], hedefOgrenciAd: '' };
  }
  if (tur === 'sinif') {
    const s = typeof sinif === 'string' ? sinif.trim() : '';
    const liste = [...new Set([s, ...liste_(siniflar)].filter(Boolean))];
    if (!liste.length) throw new Error('Sınıf seçilmedi');
    return { hedefTur: 'sinif', hedefTip: 'sinif', hedefDeger: liste[0], siniflar: liste, ogrenciler: [], hedefOgrenciAd: '' };
  }
  if (tur === 'ogrenci' || tur === 'cocuk') {
    const secim = [];
    for (const o of Array.isArray(ogrenciler) ? ogrenciler : []) {
      const id = typeof o === 'string' ? o.trim() : typeof o?.id === 'string' ? o.id.trim() : '';
      if (id && !secim.some(x => x.id === id)) secim.push({ id, ad: typeof o?.ad === 'string' ? o.ad.trim() : '' });
    }
    if (!secim.length) throw new Error('Öğrenci seçilmedi');
    const ids = secim.map(o => o.id);
    return {
      hedefTur: 'ogrenci', hedefTip: 'cocuk', hedefDeger: ids[0], siniflar: [], ogrenciler: ids,
      // Kayıt, hedefteki her velinin cihazına iner: birden fazla öğrencide
      // başka çocukların adı kayda yazılmaz.
      hedefOgrenciAd: ids.length === 1 ? secim[0].ad : `${ids.length} öğrenci`
    };
  }
  throw new Error('Bilinmeyen hedef: ' + tur);
}

// Formu düzenleme için doldurmak: kayıt → { tur, sinif, ogrenciIds }
// Çelişkili kayıt 'bilinmiyor' döner; form onu "Tüm Okul" diye AÇMAMALI (hedef genişlerdi).
export function formHedefi(d) {
  const h = icerikHedefi(d);
  if (h.tip === 'okul') return { tur: 'tumOkul', sinif: '', siniflar: [], ogrenciIds: [] };
  if (h.tip === 'sinif') return { tur: 'sinif', sinif: h.siniflar[0] || '', siniflar: [...h.siniflar], ogrenciIds: [] };
  if (h.tip === 'cocuk') return { tur: 'ogrenci', sinif: '', siniflar: [], ogrenciIds: [...h.ogrenciler] };
  return { tur: 'bilinmiyor', sinif: '', siniflar: [], ogrenciIds: [] };
}

// ZEKY duyuru listesinin gösterdiği kısa hedef metni (duyurular.hedef alanı)
export function hedefMetni(alanlar) {
  if (alanlar?.hedefTur === 'tumOkul') return 'Tüm okul';
  if (alanlar?.hedefTur === 'sinif') return (alanlar.siniflar || []).length ? alanlar.siniflar.join(', ') : (alanlar.hedefDeger || '');
  if (alanlar?.hedefTur === 'ogrenci') return `${(alanlar.ogrenciler || []).length} öğrenci`;
  return '';
}

// Personel ekranı etiketi. adBul(id) → öğrencinin adı (bilinmiyorsa boş).
export function hedefEtiketi(d, { adBul = () => '', enFazla = 3 } = {}) {
  const h = icerikHedefi(d);
  if (h.tip === 'okul') return 'Tüm Okul';
  if (h.tip === 'sinif') return h.siniflar.join(', ');
  if (h.tip === 'cocuk') {
    const adlar = h.ogrenciler.map(id => adBul(id) || (h.ogrenciler.length === 1 && d?.hedefOgrenciAd) || 'Öğrenci');
    if (adlar.length <= enFazla) return adlar.join(', ');
    return `${adlar.slice(0, enFazla).join(', ')} +${adlar.length - enFazla}`;
  }
  return 'Hedef belirsiz';
}

// Veli ekranı etiketi: yalnız velinin kendi çocuklarının adı; başka çocuk adı gösterilmez.
//   cocuklar: [{ id, ad }]
export function veliHedefEtiketi(d, cocuklar = []) {
  const h = icerikHedefi(d);
  if (h.tip === 'okul') return 'Tüm Okul';
  if (h.tip === 'sinif') return h.siniflar.join(', ');
  if (h.tip === 'cocuk') {
    const kendi = (cocuklar || []).filter(c => c && h.ogrenciler.includes(c.id)).map(c => c.ad).filter(Boolean);
    return kendi.length ? `Size özel · ${kendi.join(', ')}` : 'Size özel';
  }
  return '';
}
