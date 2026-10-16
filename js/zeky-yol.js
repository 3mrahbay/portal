// OKUL YOLU · veli ana sayfası
// ─────────────────────────────────────────────────────────────────────
// Velinin bulunduğu yerden okula tahmini yol süresi: araba (canlı trafikle),
// yürüyerek ve otobüs (toplu taşıma). Ana sayfada hava satırı gibi tek satır
// durur ve süre büyük yazılır ("20 dk"); dokununca alttan açılan pencerede
// sekmeler, trafik durumu, rota haritası ve "Google Haritalar'da aç" görünür.
//
// Hesap sunucuda (okulYoluV1, Google Routes API) yapılır; okulun konumu da
// sunucudan gelir. Velinin konumu 3 ondalığa (~110 m) yuvarlanıp yalnız bu
// hesap için gönderilir; sunucuda saklanmaz. Sonuç cihazda 5 dakika tutulur,
// bu sürede yeniden bakılırsa yeni hesap yapılmaz.
//
// Konum izni ilk kez yalnız veli dokununca istenir. İzin verilmişse ana sayfa
// hafta içi sabah (06.30–09.30) ve öğleden sonra (14.30–18.30) açıldığında
// süre kendiliğinden hesaplanır; diğer saatlerde dokununca hesaplanır.
// Açma/kapama: config/ozellikBayraklari.okulYolu (varsayılan kapalı).
//
// "Konumu gönder": çocuğu bazen onaylı başka bir yetişkin (dede, teyze…) alır.
// Veli okulun konumunu hazır bir mesajla gönderir (WhatsApp ya da paylaşım
// menüsü). Okul bilgisi ayarlar/okulYolu = { ad, adres, placeId }.
//
// ZEKY (www/js/zeky-yol.js) ve portal (js/zeky-yol.js) bu dosyanın BİREBİR
// kopyasını kullanır. Firebase'i ve Capacitor'ı dışarıdan alır; DOM'u
// yalnız createElement ve textContent ile kurar.
// ─────────────────────────────────────────────────────────────────────

export const CAGRI_ADI = 'okulYoluV1';
export const TAZE_MS = 5 * 60 * 1000;                 // aynı sonuç 5 dakika gösterilir
const DEPO_ANAHTARI = 'zeky_okul_yolu_v1';
const SAKLAMA_MS = 24 * 60 * 60 * 1000;               // eski sonuçlar bir gün sonra silinir
const ISTANBUL_MS = 3 * 60 * 60 * 1000;               // UTC+3, yaz saati yok
// Kendiliğinden hesaplama saatleri (İstanbul, hafta içi, dakika olarak)
export const OTOMATIK_SAATLER = Object.freeze([[6 * 60 + 30, 9 * 60 + 30], [14 * 60 + 30, 18 * 60 + 30]]);

export const MODLAR = Object.freeze([
  Object.freeze({ k: 'araba', ad: 'Araba', ikon: 'car', harita: 'driving' }),
  Object.freeze({ k: 'yuruyus', ad: 'Yürüyerek', ikon: 'footprints', harita: 'walking' }),
  Object.freeze({ k: 'otobus', ad: 'Otobüs', ikon: 'bus-front', harita: 'transit' })
]);
export function modBul(k) { return MODLAR.find(m => m.k === k) || MODLAR[0]; }

const ARAC_IKONLARI = Object.freeze({ otobus: 'bus-front', metro: 'train-front', tren: 'train-front', tramvay: 'tram-front', vapur: 'ship', dolmus: 'car-taxi-front', teleferik: 'cable-car' });
const RENKLER = Object.freeze({
  akici: Object.freeze({ renk: '#15803D', acik: '#DCFCE7' }),
  yogun: Object.freeze({ renk: '#B45309', acik: '#FEF3C7' }),
  cokYogun: Object.freeze({ renk: '#B91C1C', acik: '#FEE2E2' }),
  yuruyus: Object.freeze({ renk: '#2D5E3E', acik: '#E8F3EC' }),
  otobus: Object.freeze({ renk: '#1D4ED8', acik: '#DBEAFE' }),
  bos: Object.freeze({ renk: '#2D5E3E', acik: '#E8F3EC' })
});

// ── Biçimleme ──
export function sureMetni(sn) {
  const dk = Math.max(1, Math.round(Number(sn || 0) / 60));
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60), kalan = dk % 60;
  return kalan ? `${sa} sa ${kalan} dk` : `${sa} sa`;
}

export function mesafeMetni(m) {
  const n = Number(m);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1000) return `${Math.max(10, Math.round(n / 10) * 10)} m`;
  if (n >= 100000) return `${Math.round(n / 1000)} km`;
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',')} km`;
}

export function saatMetni(ms) {
  return new Date(Number(ms) + ISTANBUL_MS).toISOString().slice(11, 16);
}

// Trafik: trafikli süre ile trafiksiz süre karşılaştırılır.
export function trafikDurumu(sureSn, normalSureSn) {
  const normal = Number(normalSureSn) > 0 ? Number(normalSureSn) : Number(sureSn);
  const oran = normal > 0 ? Number(sureSn) / normal : 1;
  const ekDk = Math.max(0, Math.round((Number(sureSn) - normal) / 60));
  if (ekDk < 3 || oran < 1.15) return { k: 'akici', ad: 'Akıcı', ekDk, ...RENKLER.akici };
  if (oran < 1.45) return { k: 'yogun', ad: 'Yoğun', ekDk, ...RENKLER.yogun };
  return { k: 'cokYogun', ad: 'Çok yoğun', ekDk, ...RENKLER.cokYogun };
}

export function sonucRengi(sonuc) {
  if (!sonuc || sonuc.durum === 'okulda') return RENKLER.bos;
  if (sonuc.mod === 'araba') { const t = trafikDurumu(sonuc.sureSn, sonuc.normalSureSn); return { renk: t.renk, acik: t.acik }; }
  return sonuc.mod === 'otobus' ? RENKLER.otobus : RENKLER.yuruyus;
}

export function ozetMetni(sonuc) {
  if (!sonuc) return '';
  if (sonuc.durum === 'okulda') return 'Okulun yakınındasınız';
  const mod = modBul(sonuc.mod);
  if (sonuc.mod === 'araba') {
    const t = trafikDurumu(sonuc.sureSn, sonuc.normalSureSn);
    return t.k === 'akici' ? 'Araba · trafik akıcı' : `Araba · trafik ${t.ad.toLocaleLowerCase('tr')} (+${t.ekDk} dk)`;
  }
  if (sonuc.mod === 'otobus') {
    const hatlar = Array.isArray(sonuc.hatlar) ? sonuc.hatlar : [];
    return hatlar.length ? `Otobüs · ${hatlar.map(h => h.ad).join(' → ')}` : 'Otobüs · yürümek daha hızlı';
  }
  const mesafe = mesafeMetni(sonuc.mesafeM);
  return mesafe ? `${mod.ad} · ${mesafe}` : mod.ad;
}

// Ana sayfa satırı ve portal karosu için tek özet.
export function satirBilgisi(sonuc, { yukleniyor = false } = {}) {
  if (!sonuc) {
    return { deger: '', yazi: yukleniyor ? 'Süre hesaplanıyor…' : 'Süreyi görmek için dokunun', ikon: 'car', ...RENKLER.bos, hazir: false };
  }
  const rk = sonucRengi(sonuc);
  if (sonuc.durum === 'okulda') return { deger: '', yazi: ozetMetni(sonuc), ikon: 'school', ...rk, hazir: true };
  return { deger: sureMetni(sonuc.sureSn), yazi: ozetMetni(sonuc), ikon: modBul(sonuc.mod).ikon, ...rk, hazir: true };
}

// ── Zaman ──
export function otomatikZamaniMi(ms) {
  const d = new Date(Number(ms) + ISTANBUL_MS);
  const gun = d.getUTCDay();
  if (gun === 0 || gun === 6) return false;
  const dk = d.getUTCHours() * 60 + d.getUTCMinutes();
  return OTOMATIK_SAATLER.some(([bas, bit]) => dk >= bas && dk < bit);
}

// ── Cihazdaki önbellek (5 dk) ──
function depoOku(depo) {
  try { const v = JSON.parse(depo?.getItem(DEPO_ANAHTARI) || 'null'); return v && typeof v === 'object' ? v : null; } catch (_) { return null; }
}
function depoYaz(depo, v) { try { depo?.setItem(DEPO_ANAHTARI, JSON.stringify(v)); } catch (_) { /* depo kapalı olabilir */ } }

export function tazeSonuc(depo, mod, simdi) {
  const s = depoOku(depo)?.sonuclar?.[mod];
  return s && Number.isFinite(s.zaman) && simdi - s.zaman >= 0 && simdi - s.zaman < TAZE_MS ? s : null;
}
export function sonMod(depo) { const k = depoOku(depo)?.son; return MODLAR.some(m => m.k === k) ? k : 'araba'; }
export function sonSonuc(depo, simdi) { return tazeSonuc(depo, sonMod(depo), simdi); }
export function bilinenHedef(depo) { const h = depoOku(depo)?.hedef; return h && Number.isFinite(h.enlem) && Number.isFinite(h.boylam) ? h : null; }

export function sonucKaydet(depo, sonuc, simdi) {
  const eski = depoOku(depo) || {};
  const sonuclar = {};
  for (const [k, s] of Object.entries(eski.sonuclar || {})) {
    if (MODLAR.some(m => m.k === k) && s && simdi - s.zaman < SAKLAMA_MS) sonuclar[k] = s;
  }
  const kayit = { ...sonuc, zaman: simdi };
  sonuclar[sonuc.mod] = kayit;
  depoYaz(depo, { son: sonuc.mod, sonuclar, hedef: sonuc.hedef || eski.hedef || null });
  return kayit;
}
export function modSec(depo, mod) {
  const eski = depoOku(depo) || {};
  depoYaz(depo, { ...eski, son: modBul(mod).k });
}

// ── Hatalar ──
export function yolHatasi(kod) { const e = new Error(kod); e.yolKodu = kod; return e; }

const SUNUCU_KODLARI = ['GECERSIZ_ISTEK', 'OTURUM', 'OKUL_KONUMU_YOK', 'COK_UZAK', 'KOTA_DOLDU', 'GENEL_KOTA_DOLDU', 'ROTA_YOK', 'ROTA_SERVISI', 'IC_HATA'];
export function yolHatasiCevir(e) {
  if (e?.yolKodu) return e;
  const kod = e?.details?.kod;
  if (SUNUCU_KODLARI.includes(kod)) return yolHatasi(kod);
  if (e?.code === 'functions/unauthenticated') return yolHatasi('OTURUM');
  return yolHatasi('BAGLANTI');
}

export function hataMetni(kod, mod) {
  switch (kod) {
    case 'KONUM_IZNI': return 'Konum izni verilmedi. Süreyi hesaplamak için konum iznini açın.';
    case 'KONUM_YOK': return 'Konumunuz alınamadı. Konum servisinin açık olduğundan emin olun.';
    case 'OKUL_KONUMU_YOK': return 'Okulun konumu henüz ayarlanmadı.';
    case 'COK_UZAK': return 'Okula çok uzaktasınız; yol süresi hesaplanamadı.';
    case 'KOTA_DOLDU': return 'Bugün için hesaplama sınırınız doldu. Yarın yeniden deneyebilirsiniz.';
    case 'GENEL_KOTA_DOLDU': return 'Okulun bugünkü hesaplama sınırı doldu. Yarın yeniden deneyebilirsiniz.';
    case 'ROTA_YOK': return mod === 'otobus' ? 'Şu an için toplu taşıma rotası bulunamadı.' : 'Bu ulaşım türüyle rota bulunamadı.';
    case 'OTURUM': return 'Oturumunuz doğrulanamadı. Çıkış yapıp yeniden girin.';
    case 'UYGULAMA': return 'Okul Yolu yalnız ZEKY uygulamasında ve veli portalında çalışır.';
    default: return 'Yol süresi şu an alınamıyor. Biraz sonra tekrar deneyin.';
  }
}
const TEKRAR_DENENIR = new Set(['KONUM_IZNI', 'KONUM_YOK', 'ROTA_YOK', 'ROTA_SERVISI', 'IC_HATA', 'BAGLANTI', 'OTURUM']);

// ── Konum (Capacitor varsa yerel eklenti, yoksa tarayıcı) ──
function izinliMi(p) { return p?.location === 'granted' || p?.coarseLocation === 'granted'; }
function konumHatasi(e) {
  if (e?.yolKodu) return e;
  if (e?.code === 1 || /denied|permission|izin/i.test(String(e?.message || ''))) return yolHatasi('KONUM_IZNI');
  return yolHatasi('KONUM_YOK');
}
const KONUM_AYARI = Object.freeze({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });

export function konumAlici({ capacitor = globalThis.Capacitor, geolocation = globalThis.navigator?.geolocation, izinler = globalThis.navigator?.permissions } = {}) {
  const Geo = capacitor?.isNativePlatform?.() ? capacitor?.Plugins?.Geolocation : null;
  async function izinVarMi() {
    try {
      if (Geo) return izinliMi(await Geo.checkPermissions());
      if (!izinler?.query) return false;
      return (await izinler.query({ name: 'geolocation' }))?.state === 'granted';
    } catch (_) { return false; }
  }
  return Object.freeze({
    izinVarMi,
    async al({ izinIste = true } = {}) {
      try {
        if (Geo) {
          let izin = await Geo.checkPermissions().catch(() => null);
          if (!izinliMi(izin)) {
            if (!izinIste) throw yolHatasi('KONUM_IZNI');
            izin = await Geo.requestPermissions({ permissions: ['location', 'coarseLocation'] });
            if (!izinliMi(izin)) throw yolHatasi('KONUM_IZNI');
          }
          const p = await Geo.getCurrentPosition(KONUM_AYARI);
          return { enlem: p.coords.latitude, boylam: p.coords.longitude };
        }
        if (!geolocation?.getCurrentPosition) throw yolHatasi('KONUM_YOK');
        if (!izinIste && !(await izinVarMi())) throw yolHatasi('KONUM_IZNI');
        return await new Promise((tamam, hata) => geolocation.getCurrentPosition(
          p => tamam({ enlem: p.coords.latitude, boylam: p.coords.longitude }), hata, KONUM_AYARI));
      } catch (e) { throw konumHatasi(e); }
    }
  });
}

// ── Sunucu ──
const ondalik3 = n => Math.round(Number(n) * 1000) / 1000;
export function yolServisiOlustur({ functions, httpsCallable }) {
  if (!functions || typeof httpsCallable !== 'function') throw new Error('Firebase Functions bağlantısı gerekli.');
  const komut = httpsCallable(functions, CAGRI_ADI);
  return Object.freeze({
    async hesapla({ mod, enlem, boylam }) {
      let yanit;
      try {
        yanit = await komut({ mod: modBul(mod).k, enlem: ondalik3(enlem), boylam: ondalik3(boylam) });
      } catch (e) { throw yolHatasiCevir(e); }
      const v = yanit?.data;
      const hedefTamam = v?.hedef && Number.isFinite(v.hedef.enlem) && Number.isFinite(v.hedef.boylam);
      if (!v || v.ok !== true || !['rota', 'okulda'].includes(v.durum) || !hedefTamam ||
          (v.durum === 'rota' && !Number.isFinite(v.sureSn))) throw yolHatasi('BAGLANTI');
      return v;
    }
  });
}

// Önbellek → konum → sunucu. izinIste=false iken izin yoksa sessizce KONUM_IZNI atar.
export async function sonucGetir({ servis, konum, depo = globalThis.localStorage, mod = 'araba', simdi = Date.now(), izinIste = true }) {
  const k = modBul(mod).k;
  const taze = tazeSonuc(depo, k, simdi);
  if (taze) return taze;
  const baslangic = await konum.al({ izinIste });
  const yuvarlak = { enlem: ondalik3(baslangic.enlem), boylam: ondalik3(baslangic.boylam) };
  const v = await servis.hesapla({ mod: k, ...yuvarlak });
  return sonucKaydet(depo, { ...v, mod: k, baslangic: yuvarlak }, simdi);
}

// ── Harita ve bağlantı ──
// Varış noktası okulun Google Haritalar kaydı (hedef.placeId) ile verilir; böylece haritada
// okulun adı görünür. Kayıt yoksa koordinat kullanılır (Google en yakın kayıtlı yeri gösterebilir).
const PLACE_ID = /^[A-Za-z0-9_-]{16,300}$/;
function hedefKaydi(hedef) { return hedef && typeof hedef.placeId === 'string' && PLACE_ID.test(hedef.placeId) ? hedef.placeId : ''; }

export function haritaAdresi({ anahtar, baslangic, hedef, mod }) {
  if (!anahtar || !baslangic || !hedef) return '';
  const kayit = hedefKaydi(hedef);
  const q = new URLSearchParams({
    key: anahtar,
    origin: `${baslangic.enlem},${baslangic.boylam}`,
    destination: kayit ? `place_id:${kayit}` : `${hedef.enlem},${hedef.boylam}`,
    mode: modBul(mod).harita,
    language: 'tr',
    region: 'TR'
  });
  return `https://www.google.com/maps/embed/v1/directions?${q}`;
}

// Başlangıç gönderilmez: Google Haritalar velinin canlı konumunu kendisi kullanır.
export function haritalarLinki({ hedef, mod }) {
  if (!hedef) return '';
  const kayit = hedefKaydi(hedef);
  const ad = typeof hedef.ad === 'string' ? hedef.ad.trim() : '';
  const q = new URLSearchParams({ api: '1', destination: kayit && ad ? ad : `${hedef.enlem},${hedef.boylam}` });
  if (kayit) q.set('destination_place_id', kayit);
  q.set('travelmode', modBul(mod).harita);
  return `https://www.google.com/maps/dir/?${q}`;
}

// ── Okulun konumunu gönderme ──
// Velinin kendi konumu gerekmez; mesaj velinin telefonundan, onun seçtiği kişiye gider.
const temiz = (t, n) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, n) : '');

export function okulBilgisiDuzelt(veri, yedekHedef = null) {
  const placeId = hedefKaydi(veri) || hedefKaydi(yedekHedef);
  const kaynak = [veri, yedekHedef].find(k => k && Number.isFinite(k.enlem) && Number.isFinite(k.boylam));
  if (!placeId && !kaynak) return null;
  const okul = { ad: temiz(veri?.ad, 80) || temiz(yedekHedef?.ad, 80) || 'Okul', adres: temiz(veri?.adres, 160) };
  if (placeId) okul.placeId = placeId;
  if (kaynak) { okul.enlem = kaynak.enlem; okul.boylam = kaynak.boylam; }
  return okul;
}

// Google Haritalar'da okulun kendi sayfasını açan bağlantı (kayıt yoksa koordinat).
export function okulKonumBaglantisi(okul) {
  if (!okul) return '';
  const kayit = hedefKaydi(okul);
  if (!kayit && !(Number.isFinite(okul.enlem) && Number.isFinite(okul.boylam))) return '';
  const q = new URLSearchParams({ api: '1', query: kayit && okul.ad ? okul.ad : `${okul.enlem},${okul.boylam}` });
  if (kayit) q.set('query_place_id', kayit);
  return `https://www.google.com/maps/search/?${q}`;
}

// teslim=true: çocuğu alacak kişiye giden mesaj (çocuğun adı ve kimlik hatırlatması ile).
// bugun=false: kalıcı listedeki biri için ("Okuldan alacağınız çocuk").
export function konumMesaji({ okul, kisiAdi = '', cocukAdi = '', teslim = false, bugun = true } = {}) {
  if (!okul) return '';
  const satirlar = [];
  const kisi = temiz(kisiAdi, 60), cocuk = temiz(cocukAdi, 60);
  if (kisi) satirlar.push(`Merhaba ${kisi},`);
  if (teslim && cocuk) satirlar.push(`${bugun ? 'Bugün okuldan' : 'Okuldan'} alacağınız çocuk: ${cocuk}`);
  if (satirlar.length) satirlar.push('');
  satirlar.push(`Okul: ${okul.ad}`);
  if (okul.adres) satirlar.push(`Adres: ${okul.adres}`);
  const baglanti = okulKonumBaglantisi(okul);
  if (baglanti) satirlar.push(`Konum (Google Haritalar): ${baglanti}`);
  if (teslim) satirlar.push('', 'Teslim sırasında kimlik kontrolü yapılır; lütfen kimliğinizi yanınızda bulundurun.');
  return satirlar.join('\n');
}

// Türkiye numaraları: 05xx…, 5xx…, +90 5xx…, 0090 5xx… → 905xx…; geçersizse ''.
export function whatsappBaglantisi(telefon, metin) {
  let n = String(telefon || '').replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 11 && n.startsWith('0')) n = '90' + n.slice(1);
  else if (n.length === 10 && n.startsWith('5')) n = '90' + n;
  if (n.length < 11 || n.length > 15) return '';
  return `https://wa.me/${n}?text=${encodeURIComponent(metin || '')}`;
}

// Telefonun paylaşım menüsü (ZEKY'de yerel eklenti, tarayıcıda Web Share); yoksa panoya kopyalar.
// Dönüş: 'paylasildi' | 'iptal' | 'kopyalandi' | 'yok'
export async function konumPaylas({ metin, baslik = 'Okulun konumu', capacitor = globalThis.Capacitor, gezgin = globalThis.navigator } = {}) {
  const Share = capacitor?.isNativePlatform?.() ? capacitor?.Plugins?.Share : null;
  try {
    if (Share?.share) { await Share.share({ title: baslik, text: metin, dialogTitle: baslik }); return 'paylasildi'; }
    if (typeof gezgin?.share === 'function') { await gezgin.share({ title: baslik, text: metin }); return 'paylasildi'; }
  } catch (e) {
    if (e?.name === 'AbortError' || /cancel|iptal/i.test(String(e?.message || e || ''))) return 'iptal';
  }
  try { if (gezgin?.clipboard?.writeText) { await gezgin.clipboard.writeText(metin); return 'kopyalandi'; } } catch (_) { /* izin yok */ }
  return 'yok';
}

// Anne ve baba yolu bilir; düğme yalnız diğer yetişkinler (dede, teyze, bakıcı…) için çıkar.
export function konumGonderilebilirMi(kisi) {
  const n = t => String(t || '').toLocaleLowerCase('tr').trim();
  if (!kisi || !n(kisi.ad)) return false;
  return !['anne', 'baba'].includes(n(kisi.yakinlik) || n(kisi.ad));
}

// Çocuğu alacak kişiye: telefonu kayıtlıysa WhatsApp'ta doğrudan o kişiyle sohbet açılır,
// değilse telefonun paylaşım menüsü. Dönüş: 'whatsapp' | konumPaylas sonucu.
export async function teslimKonumuGonder({ okul, kisi, cocukAdi = '', bugun = true, disariAc, whatsapp = true, ...paylasim } = {}) {
  const metin = konumMesaji({ okul, kisiAdi: kisi?.ad, cocukAdi, teslim: true, bugun });
  if (!metin) return 'yok';
  const wa = whatsapp ? whatsappBaglantisi(kisi?.telefon, metin) : '';
  if (wa && typeof disariAc === 'function') { disariAc(wa); return 'whatsapp'; }
  return konumPaylas({ metin, baslik: `${okul.ad} konumu`, ...paylasim });
}

export function paylasimSonucMetni(sonuc) {
  return { kopyalandi: 'Mesaj kopyalandı; dilediğiniz uygulamaya yapıştırabilirsiniz.',
    yok: 'Bu cihazda paylaşım açılamadı.' }[sonuc] || '';
}

// ── Çizim ──
function yapici(kap) {
  const d = kap.ownerDocument || document;
  const el = (etiket, sinif, metin) => { const x = d.createElement(etiket); if (sinif) x.className = sinif; if (metin != null) x.textContent = metin; return x; };
  const ikon = ad => { const i = el('i'); i.setAttribute('data-lucide', ad); return i; };
  return { el, ikon };
}

// ZEKY ana sayfa satırı: simge, "Okul Yolu", özet ve büyük süre.
export function yolSatiriCiz(kap, { bilgi, ac, ikonlariCiz } = {}) {
  const { el, ikon } = yapici(kap);
  const b = bilgi || satirBilgisi(null);
  kap.replaceChildren();
  const ust = el('button', 'yol-ust');
  ust.type = 'button';
  ust.setAttribute('aria-haspopup', 'dialog');
  const kutu = el('div', 'yol-ikon');
  kutu.style.background = b.acik; kutu.style.color = b.renk;
  kutu.appendChild(ikon(b.ikon));
  const metin = el('div', 'yol-bilgi');
  metin.append(el('div', 'yol-baslik', 'Okul Yolu'), el('div', 'yol-durum', b.yazi));
  const sure = el('div', 'yol-sure', b.deger);
  sure.style.color = b.renk;
  sure.hidden = !b.deger;
  if (b.deger) sure.setAttribute('aria-label', `Okula tahmini ${b.deger}`);
  const ok = el('div', 'yol-ok');
  ok.appendChild(ikon('chevron-right'));
  ust.append(kutu, metin, sure, ok);
  kap.appendChild(ust);
  kap.hidden = false;
  if (typeof ac === 'function') ust.addEventListener('click', () => ac());
  if (typeof ikonlariCiz === 'function') ikonlariCiz();
}

// Açılır pencerenin gövdesi (ZEKY ve portal): sekmeler, sonuç, harita, Google Haritalar.
export function yolPaneliKur(kap, { servis, konum, depo = globalThis.localStorage, simdi = () => Date.now(), ikonlariCiz, disariAc, bildir, okul = null } = {}) {
  const { el, ikon } = yapici(kap);
  let mod = sonMod(depo);
  let istekNo = 0;
  let durum = { tur: 'bekliyor' };

  kap.replaceChildren();
  const panel = el('div', 'yol-panel');
  const sekmeler = el('div', 'yol-sekmeler');
  sekmeler.setAttribute('role', 'tablist');
  sekmeler.setAttribute('aria-label', 'Ulaşım türü');
  const dugmeler = MODLAR.map(m => {
    const b = el('button', 'yol-sekme');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.mod = m.k;
    b.append(ikon(m.ikon), el('span', null, m.ad));
    // Seçili sekmede sonuç veya yükleme varken yeniden dokunmak bir şey yapmaz
    b.addEventListener('click', () => { if (m.k !== mod || !['sonuc', 'yukleniyor'].includes(durum.tur)) hesapla(m.k); });
    sekmeler.appendChild(b);
    return b;
  });
  const sonucKutusu = el('div', 'yol-sonuc');
  sonucKutusu.setAttribute('aria-live', 'polite');
  const harita = el('div', 'yol-harita');
  harita.hidden = true;
  // Okulun Google kaydı (ayarlar) varsa, hesaplama yapmadan da haritada açılır ve gönderilir.
  const okulHedefi = () => (okul && hedefKaydi(okul) ? okul : bilinenHedef(depo));
  const dugmeler2 = el('div', 'yol-eylemler');
  const git = el('button', 'yol-git');
  git.type = 'button';
  git.append(ikon('map'), el('span', null, "Haritalar'da aç"));
  git.hidden = true;
  git.addEventListener('click', () => {
    const url = haritalarLinki({ hedef: okulHedefi(), mod });
    if (url && typeof disariAc === 'function') disariAc(url);
  });
  const gonder = el('button', 'yol-gonder');
  gonder.type = 'button';
  gonder.append(ikon('send'), el('span', null, 'Konumu gönder'));
  gonder.hidden = !okul;
  const paylasNot = el('div', 'yol-paylas-not');
  paylasNot.setAttribute('role', 'status');
  paylasNot.hidden = true;
  gonder.addEventListener('click', async () => {
    const m = paylasimSonucMetni(await konumPaylas({ metin: konumMesaji({ okul }), baslik: `${okul.ad} konumu` }));
    paylasNot.textContent = m;
    paylasNot.hidden = !m;
  });
  dugmeler2.append(git, gonder);
  const kaynak = el('div', 'yol-kaynak', 'Tahmin: Google Haritalar · Konumunuz kaydedilmez');
  // Düğmeler haritanın üstünde: kısa ekranlarda (iPhone tarayıcısı) kaydırmadan görünsün.
  panel.append(sekmeler, sonucKutusu, dugmeler2, paylasNot, harita, kaynak);
  kap.appendChild(panel);

  function sekmeleriGuncelle() {
    for (const b of dugmeler) {
      const secili = b.dataset.mod === mod;
      b.setAttribute('aria-selected', secili ? 'true' : 'false');
      b.classList.toggle('secili', secili);
    }
  }

  function haritayiGuncelle(sonuc) {
    const adres = sonuc && sonuc.durum === 'rota'
      ? haritaAdresi({ anahtar: sonuc.haritaAnahtari, baslangic: sonuc.baslangic, hedef: sonuc.hedef, mod: sonuc.mod })
      : '';
    if (!adres) { harita.hidden = true; harita.replaceChildren(); return; }
    let cerceve = harita.firstChild;
    if (!cerceve) {
      cerceve = el('iframe');
      cerceve.setAttribute('title', 'Okula giden rota haritası');
      cerceve.setAttribute('loading', 'lazy');
      cerceve.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      harita.appendChild(cerceve);
    }
    if (cerceve.getAttribute('src') !== adres) cerceve.setAttribute('src', adres);
    harita.hidden = false;
  }

  function sonucCiz(sonuc) {
    const rk = sonucRengi(sonuc);
    const kart = el('div', 'yol-sonuc-kart');
    if (sonuc.durum === 'okulda') {
      const ust = el('div', 'yol-buyuk-satir');
      const b = el('div', 'yol-buyuk', 'Okuldasınız');
      b.style.color = rk.renk;
      ust.appendChild(b);
      kart.append(ust, el('div', 'yol-ayrinti', 'Şu an okulun yakınındasınız; yol süresi hesaplanmadı.'));
      return kart;
    }
    const ust = el('div', 'yol-buyuk-satir');
    const b = el('div', 'yol-buyuk', sureMetni(sonuc.sureSn));
    b.style.color = rk.renk;
    ust.appendChild(b);
    if (sonuc.mod === 'araba') {
      const t = trafikDurumu(sonuc.sureSn, sonuc.normalSureSn);
      const cip = el('span', 'yol-trafik', t.k === 'akici' ? 'Trafik akıcı' : `Trafik ${t.ad.toLocaleLowerCase('tr')} · +${t.ekDk} dk`);
      cip.style.background = t.acik; cip.style.color = t.renk;
      ust.appendChild(cip);
    }
    kart.appendChild(ust);
    const mesafe = mesafeMetni(sonuc.mesafeM);
    if (sonuc.mod === 'otobus') {
      const hatlar = Array.isArray(sonuc.hatlar) ? sonuc.hatlar : [];
      if (hatlar.length) {
        const liste = el('div', 'yol-hatlar');
        hatlar.forEach((h, i) => {
          if (i) liste.appendChild(el('span', 'yol-ara', '→'));
          const hat = el('span', 'yol-hat');
          hat.append(ikon(ARAC_IKONLARI[h.tur] || 'bus-front'), el('span', null, h.ad));
          liste.appendChild(hat);
        });
        kart.appendChild(liste);
        const parca = [mesafe, sonuc.yuruyusSn > 0 ? `${sureMetni(sonuc.yuruyusSn)} yürüme` : '', sonuc.aktarma ? `${sonuc.aktarma} aktarma` : 'aktarmasız'].filter(Boolean);
        kart.appendChild(el('div', 'yol-ayrinti', parca.join(' · ')));
      } else {
        kart.appendChild(el('div', 'yol-ayrinti', 'Bu mesafede yürümek toplu taşımadan daha hızlı.'));
      }
    } else if (sonuc.mod === 'araba') {
      const parca = [mesafe, `trafiksiz ${sureMetni(sonuc.normalSureSn || sonuc.sureSn)}`].filter(Boolean);
      kart.appendChild(el('div', 'yol-ayrinti', parca.join(' · ')));
    } else if (mesafe) {
      kart.appendChild(el('div', 'yol-ayrinti', mesafe));
    }
    kart.appendChild(el('div', 'yol-zaman', `${saatMetni(sonuc.hesaplandi || sonuc.zaman)} itibarıyla`));
    return kart;
  }

  function ciz() {
    sekmeleriGuncelle();
    sonucKutusu.replaceChildren();
    sonucKutusu.dataset.durum = durum.tur;
    if (durum.tur === 'yukleniyor' || durum.tur === 'bekliyor') {
      const y = el('div', 'yol-yukleniyor');
      if (durum.tur === 'yukleniyor') y.appendChild(el('span', 'yol-donen'));
      y.appendChild(el('span', null, durum.tur === 'bekliyor' ? 'Süre için bir ulaşım türü seçin.' : durum.metin));
      sonucKutusu.appendChild(y);
      haritayiGuncelle(null);
    } else if (durum.tur === 'hata') {
      const h = el('div', 'yol-hata');
      h.appendChild(el('p', null, hataMetni(durum.kod, mod)));
      if (TEKRAR_DENENIR.has(durum.kod)) {
        const t = el('button', 'yol-tekrar', 'Tekrar dene');
        t.type = 'button';
        t.addEventListener('click', () => hesapla(mod));
        h.appendChild(t);
      }
      sonucKutusu.appendChild(h);
      haritayiGuncelle(null);
    } else {
      sonucKutusu.appendChild(sonucCiz(durum.sonuc));
      haritayiGuncelle(durum.sonuc);
    }
    git.hidden = !okulHedefi();
    if (typeof ikonlariCiz === 'function') ikonlariCiz();
  }

  async function hesapla(yeniMod = mod, { izinIste = true, sessiz = false } = {}) {
    mod = modBul(yeniMod).k;
    modSec(depo, mod);
    const no = ++istekNo;
    const zaman = simdi();
    const taze = tazeSonuc(depo, mod, zaman);
    if (taze) {
      durum = { tur: 'sonuc', sonuc: taze };
      if (typeof bildir === 'function') bildir(taze);
      ciz();
      return taze;
    }
    if (!sessiz) { durum = { tur: 'yukleniyor', metin: 'Konumunuz alınıyor…' }; ciz(); }
    try {
      const konumSarmal = {
        al: async (s) => {
          const k = await konum.al(s);
          if (no === istekNo && !sessiz) { durum = { tur: 'yukleniyor', metin: 'Yol süresi hesaplanıyor…' }; ciz(); }
          return k;
        }
      };
      const sonuc = await sonucGetir({ servis, konum: konumSarmal, depo, mod, simdi: zaman, izinIste });
      if (no !== istekNo) return sonuc;      // bu arada başka sekme seçildi
      durum = { tur: 'sonuc', sonuc };
      if (typeof bildir === 'function') bildir(sonuc);
      ciz();
      return sonuc;
    } catch (e) {
      if (no !== istekNo || sessiz) return null;
      durum = { tur: 'hata', kod: e?.yolKodu || 'BAGLANTI' };
      ciz();
      return null;
    }
  }

  const ilk = tazeSonuc(depo, mod, simdi());
  durum = ilk ? { tur: 'sonuc', sonuc: ilk } : { tur: 'bekliyor' };
  ciz();

  return Object.freeze({
    hesapla: (m) => hesapla(m ?? mod),
    // Ana sayfa açılışında: izin önceden verilmişse sessizce hesaplar, hata göstermez.
    arkaPlan: () => hesapla(mod, { izinIste: false, sessiz: true }),
    get mod() { return mod; }
  });
}
