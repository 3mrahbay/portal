// Günlük rapor özeti — veli ana sayfasındaki çocuk kartı için yemek · uyku · ruh hali.
// ZEKY (www/js/gunluk-ozet.js) ve portal (js/gunluk-ozet.js) bu dosyanın birebir aynısını kullanır;
// birinde değişirse diğerine de kopyalanır. Saf fonksiyonlar: ağa ve sayfaya dokunmaz.
//
// Öğretmen formunun yazdığı biçim (gunlukRaporlar/{ogrenciId}__{YYYY-MM-DD}):
//   yemek: { kahvalti, ogle, ikindi }   → 'Hepsini yedi' | 'Biraz yedi' | 'Yemedi'
//   uyku:  { durum, dakika }            → 'Uyudu' | 'Dinlendi' | 'Uyumadı', '60 dk'
//   mood:  'mutlu' | 'sakin' | 'enerjik' | 'yorgun' | 'huzursuz'
//   not, yazanAd, tarih
// Eski/başka kaynaklı kayıtlarda düz metin veya { deger | miktar | durum … } de gelebilir.

export const RUH_HALLERI = Object.freeze({
  mutlu: ['😊', 'Mutlu'], sakin: ['😌', 'Sakin'], enerjik: ['🤩', 'Enerjik'],
  yorgun: ['🥱', 'Yorgun'], huzursuz: ['😕', 'Huzursuz']
});

// Değer nesne olabilir ({miktar:"%85"} gibi) — düz metne çevir (ekranda "[object Object]" çıkmasın)
export function duzMetin(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (typeof v === 'object' && !Array.isArray(v)) {
    const aday = v.deger ?? v.miktar ?? v.durum ?? v.metin ?? v.ad ?? v.yuzde ?? v.sure;
    if (aday != null && typeof aday !== 'object') return String(aday).trim();
    const ilk = Object.values(v).find(x => (typeof x === 'string' && x.trim()) || typeof x === 'number');
    return ilk != null ? String(ilk).trim() : '';
  }
  return '';
}

function buyukHarf(t) { return t ? t.charAt(0).toLocaleUpperCase('tr') + t.slice(1) : t; }

// Öğün nesnesinde ana öğün (öğle) önce gelir
export function yemekOzeti(y) {
  if (y && typeof y === 'object' && !Array.isArray(y)) {
    for (const ogun of ['ogle', 'kahvalti', 'ikindi']) {
      const t = duzMetin(y[ogun]);
      if (t) return buyukHarf(t);
    }
  }
  return buyukHarf(duzMetin(y));
}

export function uykuOzeti(u) {
  if (u && typeof u === 'object' && !Array.isArray(u) && ('durum' in u || 'dakika' in u)) {
    const durum = duzMetin(u.durum);
    const dakika = duzMetin(u.dakika);
    if (!durum) return '';
    // "60 dk" satır sonunda bölünmesin
    return buyukHarf(durum) + (dakika && durum === 'Uyudu' ? ' · ' + dakika.replace(/ /g, '\u00a0') : '');
  }
  return buyukHarf(duzMetin(u));
}

export function ruhHaliOzeti(m) {
  const kod = duzMetin(m);
  const bilinen = RUH_HALLERI[kod.toLocaleLowerCase('tr')];
  return bilinen ? bilinen.join(' ') : buyukHarf(kod);
}

// "2026-10-14" → "14 Ekim Çarşamba"
export function gunAdi(tarih) {
  if (typeof tarih !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return '';
  const d = new Date(tarih + 'T12:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

// Rapor → kartın ihtiyaç duyduğu düz metinler (HTML üretmez; kaçış çağıranın işidir)
export function gunlukOzeti(r, bugun) {
  if (!r || typeof r !== 'object') return null;
  const tarih = typeof r.tarih === 'string' ? r.tarih : '';
  return {
    tarih,
    bugunMu: !!tarih && tarih === bugun,
    gun: gunAdi(tarih),
    yemek: yemekOzeti(r.yemek),
    uyku: uykuOzeti(r.uyku),
    ruhHali: ruhHaliOzeti(r.mood ?? r.ruhHali),
    not: duzMetin(r.not ?? r.aciklama),
    ogretmen: duzMetin(r.yazanAd ?? r.ogretmenAd)
  };
}
