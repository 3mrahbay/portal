// HAVA VE KIYAFET ÖNERİSİ · veli ana sayfası
// ─────────────────────────────────────────────────────────────────────
// Velinin ana sayfasında okulun konumu için bir sonraki okul gününün havası
// (08:00–17:00) ve buna göre kısa bir kıyafet notu gösterilir. Orman okulu
// çocukları her gün dışarıda olduğu için yağmur, çamur ve soğuk öne çıkar.
//
// Veri: Open-Meteo (https://open-meteo.com, CC BY 4.0, anahtar gerekmez).
// İstekte YALNIZ okulun koordinatı gider; kullanıcı konumu, adı veya kimliği
// gönderilmez. Sonuç cihazda 1 saat saklanır, hata olursa 6 saate kadar eski
// sonuç gösterilir, yoksa kart hiç görünmez.
//
// Konum: Firestore ayarlar/havaDurumu = { enlem, boylam, yerAdi } (isteğe bağlı,
// yönetim yazar). Belge yoksa Bir Çiçek Koleji (Tuzla) kullanılır.
// Açma/kapama: config/ozellikBayraklari.havaKiyafet (varsayılan açık).
//
// ZEKY (www/js/zeky-hava.js) ve portal (js/zeky-hava.js) bu dosyanın BİREBİR
// kopyasını kullanır. ZEKY'de kart ana sayfada açılır-kapanır (havaKartiYukle);
// portalda veli ana sayfasındaki "Hava ve kıyafet" karosuna dokununca açılan
// pencerede ayrıntı gösterilir (havaHazirla + havaDetayCiz + havaOzetSatiri).
//
// Bu dosya Firebase veya başka modül içe aktarmaz; hesaplar test edilebilir.
// ─────────────────────────────────────────────────────────────────────

export const VARSAYILAN_KONUM = Object.freeze({ enlem: 40.857, boylam: 29.331, yerAdi: 'Tuzla' });
export const OKUL_SAATLERI = Object.freeze({ bas: 8, bit: 17 });   // 08:00–16:59 saatlik değerler
const DEPO_ANAHTARI = 'zeky_hava_v1';
const ACILDI_ANAHTARI = 'zeky_hava_acildi_v1';   // veli kartı bir kez açınca ok ipucu durur
const TAZE_MS = 60 * 60 * 1000;          // 1 saat
const YEDEK_MS = 6 * 60 * 60 * 1000;      // hata olursa 6 saate kadar eski veri
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const sayi = (x, yedek) => (typeof x === 'number' && Number.isFinite(x)) ? x : yedek;

export function konumDuzelt(k) {
  const enlem = sayi(Number(k?.enlem), NaN), boylam = sayi(Number(k?.boylam), NaN);
  if (!Number.isFinite(enlem) || !Number.isFinite(boylam) || Math.abs(enlem) > 90 || Math.abs(boylam) > 180) {
    return { ...VARSAYILAN_KONUM };
  }
  const yerAdi = String(k?.yerAdi || '').trim().slice(0, 40) || VARSAYILAN_KONUM.yerAdi;
  return { enlem: Math.round(enlem * 1000) / 1000, boylam: Math.round(boylam * 1000) / 1000, yerAdi };
}

export function havaAdresi(konum) {
  const k = konumDuzelt(konum);
  const p = new URLSearchParams({
    latitude: String(k.enlem), longitude: String(k.boylam),
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index',
    timezone: 'Europe/Istanbul', forecast_days: '4'
  });
  return 'https://api.open-meteo.com/v1/forecast?' + p.toString();
}

// İstanbul saatine göre tarih parçaları (cihaz başka saat diliminde olsa da).
function istanbulParcalari(simdi) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(simdi).map(x => [x.type, x.value]));
  const hafta = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { tarih: `${p.year}-${p.month}-${p.day}`, saat: Number(p.hour) % 24, hafta };
}

function tarihEkle(tarih, gun) {
  const d = new Date(tarih + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

// Gösterilecek okul günü: hafta içi 17:00'a kadar bugün, sonra bir sonraki hafta içi gün.
export function okulGunuSec(simdi = new Date()) {
  const { tarih, saat, hafta } = istanbulParcalari(simdi);
  let ileri = 0, h = hafta;
  if (h >= 1 && h <= 5 && saat < OKUL_SAATLERI.bit) return { tarih, etiket: 'Okulda bugün', kisa: 'Bugün', ileri: 0 };
  do { ileri++; h = (h + 1) % 7; } while (h === 0 || h === 6);
  const hedef = tarihEkle(tarih, ileri);
  const kisa = ileri === 1 ? 'Yarın' : GUNLER[h];
  return { tarih: hedef, etiket: kisa + ' okulda', kisa, ileri };
}

// Open-Meteo saatlik verisinden okul saatlerinin özeti.
export function gunOzeti(veri, tarih) {
  const h = veri?.hourly;
  if (!h || !Array.isArray(h.time)) return null;
  const idx = [];
  h.time.forEach((t, i) => {
    if (String(t).slice(0, 10) !== tarih) return;
    const saat = Number(String(t).slice(11, 13));
    if (saat >= OKUL_SAATLERI.bas && saat < OKUL_SAATLERI.bit) idx.push(i);
  });
  const al = ad => idx.map(i => h[ad]?.[i]).filter(x => typeof x === 'number' && Number.isFinite(x));
  const sic = al('temperature_2m');
  if (!sic.length) return null;
  const his = al('apparent_temperature'), olas = al('precipitation_probability'), mm = al('precipitation');
  const kod = al('weather_code'), ruz = al('wind_speed_10m'), uv = al('uv_index');
  const enBuyuk = a => a.length ? Math.max(...a) : 0;
  return {
    enDusuk: Math.round(Math.min(...sic)), enYuksek: Math.round(Math.max(...sic)),
    hisDusuk: Math.round(his.length ? Math.min(...his) : Math.min(...sic)),
    yagisOlasiligi: Math.round(enBuyuk(olas)), yagisMm: Math.round(mm.reduce((a, b) => a + b, 0) * 10) / 10,
    ruzgar: Math.round(enBuyuk(ruz)), uv: Math.round(enBuyuk(uv) * 10) / 10,
    kod: baskinKod(kod)
  };
}

// Günün en "etkili" hava kodu: fırtına > kar > yağmur > çisenti > sis > bulut > açık.
function kodSinifi(k) {
  if (k >= 95) return 7; if ([71, 73, 75, 77, 85, 86].includes(k)) return 6;
  if ((k >= 61 && k <= 67) || (k >= 80 && k <= 82)) return 5; if (k >= 51 && k <= 57) return 4;
  if (k === 45 || k === 48) return 3; if (k === 2 || k === 3) return 2; if (k === 1) return 1; return 0;
}
function baskinKod(kodlar) {
  return kodlar.reduce((en, k) => kodSinifi(k) > kodSinifi(en) ? k : en, kodlar[0] ?? 0);
}

export function havaDurumuMetni(kod) {
  return ['Güneşli', 'Az bulutlu', 'Parçalı bulutlu', 'Sisli', 'Çisentili', 'Yağmurlu', 'Karlı', 'Gök gürültülü'][kodSinifi(kod)];
}
export function havaIkonu(kod) {
  return ['sun', 'cloud-sun', 'cloud', 'cloud-fog', 'cloud-drizzle', 'cloud-rain', 'cloud-snow', 'cloud-lightning'][kodSinifi(kod)];
}
// Simge rengi ve zemini havaya göre: güneş sarı-turuncu, bulut gri, yağmur mavi, kar camgöbeği, fırtına mor.
const RENKLER = [
  { renk: '#C2410C', acik: '#FFEDD5' },   // güneşli
  { renk: '#B45309', acik: '#FEF3C7' },   // az bulutlu
  { renk: '#475569', acik: '#E2E8F0' },   // parçalı bulutlu
  { renk: '#64748B', acik: '#EEF1F5' },   // sisli
  { renk: '#2E5C8A', acik: '#E3EEF8' },   // çisentili
  { renk: '#1D4ED8', acik: '#DBEAFE' },   // yağmurlu
  { renk: '#0E7490', acik: '#CFFAFE' },   // karlı
  { renk: '#6D28D9', acik: '#EDE9FE' }    // gök gürültülü
];
export function havaRengi(kod) { return { ...RENKLER[kodSinifi(kod)] }; }

// Kıyafet notu: en çok 4 kısa öneri, önem sırasıyla.
export function kiyafetOnerisi(o) {
  if (!o) return [];
  const s = kodSinifi(o.kod);
  const kar = s === 6, yagmur = s === 5 || s === 7 || s === 4 || o.yagisOlasiligi >= 50 || o.yagisMm >= 1;
  const liste = [];
  const ekle = x => { if (!liste.includes(x)) liste.push(x); };
  if (o.hisDusuk <= 0 || kar) { ekle('Kalın mont'); ekle('Bere, eldiven ve atkı'); }
  else if (o.hisDusuk < 8) { ekle('Mont'); ekle('Bere'); }
  else if (o.hisDusuk < 14) ekle('Hırka veya ince mont');
  if (kar) { ekle('Kar botu'); ekle('Yedek çorap ve eldiven'); }
  else if (yagmur) { ekle('Yağmurluk'); ekle('Su geçirmez ayakkabı veya çizme'); ekle('Yedek çorap ve kıyafet'); }
  if (o.ruzgar >= 30 && !liste.some(x => /mont/i.test(x))) ekle('Rüzgârlık');
  if (o.enYuksek >= 26) { ekle('İnce, açık renk kıyafet'); ekle('Su matarası'); }
  if (o.uv >= 6) ekle('Şapka ve güneş kremi');
  if (!liste.length) ekle(o.enYuksek - o.enDusuk >= 8 ? 'Katmanlı giyim: tişört üstüne hırka' : 'Rahat günlük kıyafet');
  return liste.slice(0, 4);
}

export function ozetMetni(o) {
  if (!o) return '';
  const parcalar = [havaDurumuMetni(o.kod)];
  if (o.yagisOlasiligi >= 30) parcalar.push('yağış %' + o.yagisOlasiligi);
  if (o.ruzgar >= 30) parcalar.push('rüzgârlı');
  return parcalar.join(', ');
}

// ─── Önbellek ve yükleme ───────────────────────────────────────────────
function depoOku(depo) {
  try { const x = JSON.parse(depo?.getItem(DEPO_ANAHTARI) || 'null'); return x && typeof x === 'object' ? x : null; }
  catch (_) { return null; }
}
function depoYaz(depo, kayit) {
  try { depo?.setItem(DEPO_ANAHTARI, JSON.stringify(kayit)); } catch (_) { /* depo dolu/kapalı olabilir */ }
}

// Ham Open-Meteo verisini döndürür: önce taze önbellek, sonra ağ, olmazsa 6 saate kadar eski önbellek.
export async function havaVerisiGetir({ konum, fetchImpl = globalThis.fetch, depo = globalThis.localStorage, simdi = Date.now(), zamanAsimiMs = 8000 } = {}) {
  const k = konumDuzelt(konum);
  const anahtar = `${k.enlem},${k.boylam}`;
  const onbellek = depoOku(depo);
  const ayniYer = onbellek && onbellek.yer === anahtar && onbellek.veri;
  if (ayniYer && simdi - onbellek.zaman < TAZE_MS) return onbellek.veri;
  const kontrol = typeof AbortController === 'function' ? new AbortController() : null;
  const sayac = kontrol ? setTimeout(() => kontrol.abort(), zamanAsimiMs) : null;
  try {
    const yanit = await fetchImpl(havaAdresi(k), kontrol ? { signal: kontrol.signal } : undefined);
    if (!yanit || !yanit.ok) throw new Error('hava-yanit-' + (yanit && yanit.status));
    const veri = await yanit.json();
    if (!veri?.hourly?.time) throw new Error('hava-bicim');
    depoYaz(depo, { yer: anahtar, zaman: simdi, veri });
    return veri;
  } catch (e) {
    if (ayniYer && simdi - onbellek.zaman < YEDEK_MS) return onbellek.veri;
    throw e;
  } finally {
    if (sayac) clearTimeout(sayac);
  }
}

// Gösterilecek bilgi: { gun, ozet, oneriler, yerAdi } ya da veri yoksa null. Ağ hatası fırlatır.
export async function havaHazirla({ konum, fetchImpl, depo = globalThis.localStorage, simdi = new Date() } = {}) {
  const k = konumDuzelt(konum);
  const veri = await havaVerisiGetir({ konum: k, fetchImpl, depo, simdi: simdi.getTime() });
  const gun = okulGunuSec(simdi);
  const ozet = gunOzeti(veri, gun.tarih);
  return ozet ? { gun, ozet, oneriler: kiyafetOnerisi(ozet), yerAdi: k.yerAdi } : null;
}

// Karo/özet için tek satır: "Yarın · 11°–12° · Yağmurlu"
export function havaOzetSatiri(bilgi) {
  if (!bilgi?.ozet) return '';
  const o = bilgi.ozet;
  return `${bilgi.gun.kisa} · ${o.enDusuk}°–${o.enYuksek}° · ${havaDurumuMetni(o.kod)}`;
}

// Kartı doldurur (ZEKY). Veri yoksa kart gizli kalır (velinin önünde hata gösterilmez).
export async function havaKartiYukle(kap, { konum, fetchImpl, depo = globalThis.localStorage, simdi = new Date(), ikonlariCiz } = {}) {
  if (!kap) return false;
  try {
    const bilgi = await havaHazirla({ konum, fetchImpl, depo, simdi });
    if (!bilgi) { kap.hidden = true; return false; }
    havaKartiCiz(kap, { ...bilgi, depo });
    kap.hidden = false;
    if (typeof ikonlariCiz === 'function') ikonlariCiz();
    return true;
  } catch (e) {
    console.warn('hava durumu alınamadı', e);
    kap.hidden = true;
    return false;
  }
}

// Kart kapalı gelir: tek satır (ikon, gün, durum, sıcaklık, daire içinde ok). Ok, kartın
// açılabildiğini göstermek için hafifçe aşağı doğru zıplar; veli kartı bir kez açınca
// ("tanidik") hareket kalıcı olarak durur. Dokununca "Ne giysin?" önerileri aşağı kayarak
// açılır; tekrar dokununca kapanır.
function acildiMi(depo) { try { return depo?.getItem(ACILDI_ANAHTARI) === '1'; } catch (_) { return false; } }
function acildiKaydet(depo) { try { depo?.setItem(ACILDI_ANAHTARI, '1'); } catch (_) { /* depo kapalı olabilir */ } }

export function havaKartiAcKapa(kap, acik, depo) {
  const dugme = kap.querySelector ? kap.querySelector('.hava-ust') : kap._dugme;
  const panel = kap.querySelector ? kap.querySelector('.hava-detay') : kap._panel;
  const ac = acik == null ? !kap.classList.contains('acik') : !!acik;
  kap.classList.toggle('acik', ac);
  if (dugme) dugme.setAttribute('aria-expanded', String(ac));
  if (panel) panel.setAttribute('aria-hidden', String(!ac));
  if (ac && !kap.classList.contains('tanidik')) { kap.classList.add('tanidik'); acildiKaydet(depo); }
  return ac;
}

export function havaKartiCiz(kap, { gun, ozet, oneriler, yerAdi, depo }) {
  const d = kap.ownerDocument || document;
  const el = (etiket, sinif, metin) => { const x = d.createElement(etiket); if (sinif) x.className = sinif; if (metin != null) x.textContent = metin; return x; };
  const lucide = (ad, sinif) => { const i = el('i', sinif); i.setAttribute('data-lucide', ad); return i; };
  kap.replaceChildren();
  kap.classList.remove('acik');
  kap.classList.toggle('tanidik', acildiMi(depo));

  const ust = el('button', 'hava-ust');
  ust.type = 'button';
  ust.setAttribute('aria-expanded', 'false');
  ust.setAttribute('aria-controls', 'havaDetay');
  const ikon = el('div', 'hava-ikon');
  const rk = havaRengi(ozet.kod);
  ikon.style.background = rk.acik; ikon.style.color = rk.renk;
  ikon.appendChild(lucide(havaIkonu(ozet.kod)));
  const bilgi = el('div', 'hava-bilgi');
  bilgi.append(el('div', 'hava-baslik', gun.etiket + ' · ' + yerAdi), el('div', 'hava-durum', ozetMetni(ozet)));
  const derece = el('div', 'hava-derece', `${ozet.enDusuk}°–${ozet.enYuksek}°`);
  derece.setAttribute('aria-label', `En düşük ${ozet.enDusuk}, en yüksek ${ozet.enYuksek} derece`);
  const ok = el('div', 'hava-ok');
  ok.appendChild(lucide('chevron-down'));
  ust.append(ikon, bilgi, derece, ok);

  const panel = el('div', 'hava-detay');
  panel.id = 'havaDetay';
  panel.setAttribute('aria-hidden', 'true');
  const ic = el('div', 'hava-detay-ic');
  const oneri = el('div', 'hava-oneri');
  oneri.append(el('div', 'hava-oneri-baslik', 'Ne giysin?'));
  const liste = el('ul', 'hava-liste');
  oneriler.forEach(x => liste.appendChild(el('li', null, x)));
  oneri.appendChild(liste);
  ic.append(oneri, el('div', 'hava-kaynak', 'Okul saatleri (08.00–17.00) için tahmin · Open-Meteo'));
  panel.appendChild(ic);

  kap.append(ust, panel);
  kap._dugme = ust; kap._panel = panel;
  ust.addEventListener('click', () => havaKartiAcKapa(kap, null, depo));
}

// Açılır pencere içeriği (portal): başlık satırı, "Ne giysin?" önerileri ve kaynak.
export function havaDetayCiz(kap, { gun, ozet, oneriler, yerAdi }) {
  const d = kap.ownerDocument || document;
  const el = (etiket, sinif, metin) => { const x = d.createElement(etiket); if (sinif) x.className = sinif; if (metin != null) x.textContent = metin; return x; };
  kap.replaceChildren();
  const kutu = el('div', 'hava-detay-kart');
  const ust = el('div', 'hava-ust');
  const ikon = el('div', 'hava-ikon');
  const rk = havaRengi(ozet.kod);
  ikon.style.background = rk.acik; ikon.style.color = rk.renk;
  const i = el('i'); i.setAttribute('data-lucide', havaIkonu(ozet.kod)); ikon.appendChild(i);
  const bilgi = el('div', 'hava-bilgi');
  bilgi.append(el('div', 'hava-baslik', gun.etiket + ' · ' + yerAdi), el('div', 'hava-durum', ozetMetni(ozet)));
  const derece = el('div', 'hava-derece', `${ozet.enDusuk}°–${ozet.enYuksek}°`);
  derece.setAttribute('aria-label', `En düşük ${ozet.enDusuk}, en yüksek ${ozet.enYuksek} derece`);
  ust.append(ikon, bilgi, derece);
  const oneri = el('div', 'hava-oneri');
  oneri.append(el('div', 'hava-oneri-baslik', 'Ne giysin?'));
  const liste = el('ul', 'hava-liste');
  oneriler.forEach(x => liste.appendChild(el('li', null, x)));
  oneri.appendChild(liste);
  kutu.append(ust, oneri, el('div', 'hava-kaynak', 'Okul saatleri (08.00–17.00) için tahmin · Open-Meteo'));
  kap.appendChild(kutu);
}
