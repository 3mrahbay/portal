// ══════════════════════════════════════════════════════════════
// PORTAL · VELİ KATILIMI
// --------------------------------------------------------------
// Veli tarafı : girişleri ve açılan bölümleri kaydeder (portal)
// Yönetim     : Kurucu Müdür için canlı panel (sayfa yenilemeden)
//               kim çevrimiçi, kim ne zaman girdi, hangi bölümlere
//               baktı, giriş sıklığı, hiç girmeyenler
//
// Veri (ZEKY ile ortak — uygulama: "portal" | "zeky"):
//   veliKatilim/{eposta}                  velinin özet sayaçları
//     { eposta, sonGorulme, sonGiris, sonEkran, sonUygulama,
//       girisSayisi, gunler: {"YYYY-MM-DD": n}, ekranlar: {anahtar: n},
//       uygulamalar: {portal: n, zeky: n}, ogrenciIdler: [...] }
//   veliKatilimAkisi/{eposta}__{ms}{rast}  hareket akışı
//     { eposta, tur: "giris"|"ekran", ekran, uygulama, cihaz, zaman }
//
// "Giriş" = 30 dakikadan uzun aradan sonra ilk hareket.
// Çevrimiçi = son 4 dakikada hareket (açık ve kullanılan sekme 2 dk'da bir bildirir).
// Yalnız kurucu müdür okur (Firestore kuralı). Akış 12 ayda temizlenir.
// ══════════════════════════════════════════════════════════════

const OTURUM_ARASI = 30 * 60 * 1000;
const NABIZ_ARALIGI = 2 * 60 * 1000;
const CEVRIMICI_ESIK = 4 * 60 * 1000;
const ETKILESIM_ESIK = 15 * 60 * 1000;
const SAKLAMA_GUN = 365;

// Ortak bölüm anahtarları (portal + ZEKY aynı anahtarları kullanır)
export const BOLUMLER = {
  cocugum: "Çocuğum", gunluk: "Günlük Rapor", gelisim: "Gelişim ve Eğitim", galeri: "Galeri",
  mesajlar: "Mesajlar", duyurular: "Duyurular", odemeler: "Ödemeler", sozlesme: "Sözleşme",
  okul: "Okul Hayatı", etkinlikler: "Etkinlikler", randevular: "Randevular", pdr: "Rehberlik",
  takvim: "Takvim", yemek: "Yemek Menüsü", ayarlar: "Ayarlar", oryantasyon: "İlk Adımlar",
  iletisim: "İletişim", raporlar: "Raporlar"
};
const ESLEME = { profil: "cocugum", ogrenci: "cocugum", egitim: "gelisim", bildirimler: "duyurular", yeniapp: "home" };
const ATLANAN = new Set(["home", "menu", ""]);

const P = () => (typeof window !== "undefined" ? window.PortalAPI : null) || null;
const kucuk = (x) => String(x || "").trim().toLowerCase();
function esc(t) {
  return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function gunAnahtari(t = new Date()) {
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
function tarihYap(z) {
  if (!z) return null;
  if (typeof z.toDate === "function") return z.toDate();
  if (typeof z.seconds === "number") return new Date(z.seconds * 1000);
  const t = new Date(z);
  return isNaN(t.getTime()) ? null : t;
}
function bolumAdi(k) { return BOLUMLER[k] || (k ? k.charAt(0).toLocaleUpperCase("tr") + k.slice(1) : ""); }

// ═════════════════════════ VELİ / PERSONEL TARAFI ═════════════════════════
// Aynı kayıt mantığı iki hedefle çalışır: veliler (veliKatilim) ve
// personel (personelKatilim — Özlük & Puantaj › Uygulama sekmesi).
const HEDEFLER = {
  veli:     { ozet: "veliKatilim",     akis: "veliKatilimAkisi",     sarilanlar: ["caGo", "veliSwitchTab"], atla: ["home", "menu", ""] },
  personel: { ozet: "personelKatilim", akis: "personelKatilimAkisi", sarilanlar: ["modulSec"],             atla: ["ozet", ""] }
};
let hedef = HEDEFLER.veli;
let veliAktif = false;
let veliEposta = "";
let sonEkran = "";
let sonEkranZaman = 0;
let sonEtkilesim = Date.now();

function sonHareketOku() { try { return Number(localStorage.getItem(`vk-son:${veliEposta}`)) || 0; } catch (_) { return 0; } }
function sonHareketYaz() { try { localStorage.setItem(`vk-son:${veliEposta}`, String(Date.now())); } catch (_) {} }
function cihazTuru() {
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  return /Mobi|Android|iPhone/i.test(ua) ? "mobil" : "masaustu";
}

/** Veli paneli yüklendikten sonra çağrılır (index.html → loadVeliPanel). */
export function veliBaslat() {
  if (veliAktif) return;
  const a = P();
  const s = a?.state || {};
  if (s.personel || s.isAdmin) return;           // personel önizlemesi kaydedilmez
  veliEposta = kucuk(s.currentUser?.email);
  if (!veliEposta || !a?.fb || !a?.db) return;
  hedef = HEDEFLER.veli;
  izlemeyiKur();
}

/** Personel paneli açılınca çağrılır (kurucu müdür/admin kaydedilmez). */
export function personelBaslat() {
  if (veliAktif) return;
  const a = P();
  const s = a?.state || {};
  if (!s.personel || s.isAdmin) return;
  veliEposta = kucuk(s.currentUser?.email);
  if (!veliEposta || !a?.fb || !a?.db) return;
  hedef = HEDEFLER.personel;
  izlemeyiKur();
}

function izlemeyiKur() {
  veliAktif = true;

  ziyaretKontrol();
  gezinmeyiDinle();
  ["pointerdown", "keydown", "touchstart", "scroll"].forEach(t =>
    document.addEventListener(t, () => { sonEtkilesim = Date.now(); }, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { sonEtkilesim = Date.now(); ziyaretKontrol(); }
  });
  setInterval(nabiz, NABIZ_ARALIGI);
}

function ziyaretKontrol() {
  const onceki = sonHareketOku();
  sonHareketYaz();
  if (!onceki || Date.now() - onceki > OTURUM_ARASI) {
    sonEkran = "";
    kaydet("giris", "");
  }
}

function nabiz() {
  if (!veliAktif || document.visibilityState !== "visible") return;
  if (Date.now() - sonEtkilesim > ETKILESIM_ESIK) return;     // açık unutulan sekme yazmasın
  if (Date.now() - sonHareketOku() > OTURUM_ARASI) { ziyaretKontrol(); return; }
  sonHareketYaz();
  const { db, fb } = P();
  fb.setDoc(fb.doc(db, hedef.ozet, veliEposta),
    { eposta: veliEposta, sonGorulme: fb.serverTimestamp(), sonUygulama: "portal" }, { merge: true })
    .catch(e => console.warn("Katılım nabzı yazılamadı:", e?.code || e?.message));
}

function ekranGirdi(ham) {
  if (!veliAktif || typeof ham !== "string") return;
  const k = ((hedef === HEDEFLER.veli ? ESLEME[ham] : null) || ham).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  sonEtkilesim = Date.now();
  if (Date.now() - sonHareketOku() > OTURUM_ARASI) ziyaretKontrol(); else sonHareketYaz();
  if (hedef.atla.includes(k)) return;
  if (k === sonEkran && Date.now() - sonEkranZaman < 5 * 60 * 1000) return;
  sonEkran = k;
  sonEkranZaman = Date.now();
  kaydet("ekran", k);
}

function sar(ad) {
  const eski = window[ad];
  if (typeof eski !== "function" || eski.__vkSarili) return false;
  const yeni = function (...args) {
    const sonuc = eski.apply(this, args);
    try { ekranGirdi(args[0]); } catch (_) {}
    return sonuc;
  };
  Object.assign(yeni, eski);        // diğer köprülerin işaretleri korunsun
  yeni.__vkSarili = true;
  window[ad] = yeni;
  return true;
}

function gezinmeyiDinle() {
  let deneme = 0;
  const kur = () => {
    const tamam = hedef.sarilanlar.map(sar).every(Boolean);
    if (!tamam && ++deneme < 20) setTimeout(kur, 500);
  };
  kur();
  // Başka bir köprü sonradan sararsa bizimki içerde kalır; yine de ara ara kontrol et
  setTimeout(() => hedef.sarilanlar.forEach(sar), 8000);
}

async function kaydet(tur, ekran) {
  const a = P();
  if (!a?.fb?.writeBatch) return;
  const { db, fb } = a;
  const ozet = { eposta: veliEposta, sonGorulme: fb.serverTimestamp(), sonUygulama: "portal" };
  if (tur === "giris") {
    ozet.sonGiris = fb.serverTimestamp();
    ozet.girisSayisi = fb.increment(1);
    ozet.gunler = { [gunAnahtari()]: fb.increment(1) };
    ozet.uygulamalar = { portal: fb.increment(1) };
    if (hedef === HEDEFLER.veli) {
      const idler = (a.state?.veliOgrenciler || []).map(o => o?.id).filter(Boolean).slice(0, 10);
      if (idler.length) ozet.ogrenciIdler = idler;
    }
  } else {
    ozet.sonEkran = ekran;
    ozet.ekranlar = { [ekran]: fb.increment(1) };
  }
  const akisId = `${veliEposta}__${String(Date.now()).padStart(13, "0")}${Math.random().toString(36).slice(2, 6)}`;
  try {
    const toplu = fb.writeBatch(db);
    toplu.set(fb.doc(db, hedef.ozet, veliEposta), ozet, { merge: true });
    toplu.set(fb.doc(db, hedef.akis, akisId), {
      eposta: veliEposta, tur, ekran: ekran || "", uygulama: "portal", cihaz: cihazTuru(), zaman: fb.serverTimestamp()
    });
    await toplu.commit();
  } catch (e) {
    console.warn("Katılım kaydı yazılamadı:", e?.code || e?.message);
  }
}

// ═════════════════════════ YÖNETİM PANELİ ═════════════════════════
let pnl = null;   // { kap, ozetler: Map, akis: [], abonelikler: [], hata, filtre, zamanlayici, cizBekliyor, yeniAkisIdleri }

function yetkiliMi() {
  const s = P()?.state || {};
  return !!s.isAdmin || s.rol === "kurucu_mudur";
}

/** Yönetim sekmesi açıldığında çağrılır. */
export function panelRender(kapId) {
  const kap = document.getElementById(kapId);
  if (!kap) return;
  stilEkle();
  if (!yetkiliMi()) {
    kap.innerHTML = `<div class="vk-bos">Bu bölüm yalnızca kurucu müdüre açıktır.</div>`;
    return;
  }
  if (pnl && pnl.kap === kap && pnl.abonelikler.length) { ciz(); return; }
  panelDurdur();
  pnl = {
    kap, ozetler: new Map(), akis: [], abonelikler: [], hata: "", ilkYukleme: true,
    filtre: { sinif: "", durum: "", ara: "", sirala: "son" }, zamanlayici: null, cizBekliyor: false,
    gorulenAkis: new Set(), gorunmezSayac: 0
  };
  kap.innerHTML = `<div class="vk-bos"><span class="vk-donen"></span>Veli hareketleri yükleniyor</div>`;
  abone();
  pnl.zamanlayici = setInterval(() => {
    if (!pnl) return;
    if (!pnl.kap.isConnected || pnl.kap.offsetParent === null) {
      if (++pnl.gorunmezSayac >= 4) panelDurdur();      // 2 dk görünmezse dinlemeyi bırak
      return;
    }
    pnl.gorunmezSayac = 0;
    ciz();                                               // "3 dk önce" gibi süreler tazelensin
  }, 30000);
  eskiAkisiTemizle();
}

export function panelDurdur() {
  if (!pnl) return;
  pnl.abonelikler.forEach(f => { try { f(); } catch (_) {} });
  clearInterval(pnl.zamanlayici);
  pnl = null;
}

function abone() {
  const { db, fb } = P();
  const hata = (e) => {
    if (!pnl) return;
    pnl.hata = /permission|insufficient/i.test(String(e?.code || e?.message)) ? "izin" : (e?.message || "hata");
    cizPlanla();
  };
  pnl.abonelikler.push(fb.onSnapshot(fb.collection(db, "veliKatilim"), snap => {
    if (!pnl) return;
    snap.docChanges().forEach(d => {
      if (d.type === "removed") pnl.ozetler.delete(d.doc.id);
      else pnl.ozetler.set(d.doc.id, d.doc.data() || {});
    });
    pnl.hata = "";
    cizPlanla();
  }, hata));
  pnl.abonelikler.push(fb.onSnapshot(
    fb.query(fb.collection(db, "veliKatilimAkisi"), fb.orderBy("zaman", "desc"), fb.limit(60)),
    snap => {
      if (!pnl) return;
      pnl.akis = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      cizPlanla();
    }, hata));
}

function cizPlanla() {
  if (!pnl || pnl.cizBekliyor) return;
  pnl.cizBekliyor = true;
  setTimeout(() => { if (pnl) { pnl.cizBekliyor = false; ciz(); } }, 300);
}

async function eskiAkisiTemizle() {
  try {
    const anahtar = "vk-temizlik";
    if (localStorage.getItem(anahtar) === gunAnahtari()) return;
    localStorage.setItem(anahtar, gunAnahtari());
    const { db, fb } = P();
    const sinir = new Date(Date.now() - SAKLAMA_GUN * 86400000);
    const snap = await fb.getDocs(fb.query(fb.collection(db, "veliKatilimAkisi"), fb.where("zaman", "<", sinir), fb.limit(400)));
    if (snap.empty) return;
    const toplu = fb.writeBatch(db);
    snap.docs.forEach(d => toplu.delete(d.ref));
    await toplu.commit();
  } catch (e) { console.warn("Eski katılım kayıtları temizlenemedi:", e?.code || e?.message); }
}

// ── veri birleştirme ──
function veliKadrosu() {
  const a = P();
  const s = a?.state || {};
  const harita = new Map();
  const ogrenciAdi = new Map();
  for (const o of (s.ogrenciList || [])) {
    const ayar = (s.ayarListesi || {})[o.id];
    const sinif = ayar?.kayit?.sinif || o.sinif || "";
    ogrenciAdi.set(o.id, { ad: o.ogrenciAdSoyad || "Öğrenci", sinif });
    if (a?.ogrenciDurum?.(o, ayar) !== "aktif") continue;
    const cocuk = { id: o.id, ad: o.ogrenciAdSoyad || "Öğrenci", sinif };
    for (const [rol, v] of [["Anne", ayar?.anne], ["Baba", ayar?.baba]]) {
      if (!v || (!v.eposta && !v.adSoyad)) continue;
      const eposta = kucuk(v.eposta);
      const anahtar = eposta || `yok:${o.id}:${rol}`;
      const var_ = harita.get(anahtar);
      if (var_) {
        if (!var_.cocuklar.some(c => c.id === o.id)) var_.cocuklar.push(cocuk);
        if (!var_.roller.includes(rol)) var_.roller.push(rol);
        continue;
      }
      harita.set(anahtar, { anahtar, eposta, ad: v.adSoyad || rol, roller: [rol], cocuklar: [cocuk], aktifOgrenci: true });
    }
  }
  // Kayıtlı ama listede olmayan (mezun, farklı e-posta vb.)
  for (const [eposta, oz] of pnl.ozetler) {
    if (harita.has(eposta)) continue;
    const cocuklar = (oz.ogrenciIdler || []).map(id => ({ id, ...(ogrenciAdi.get(id) || { ad: "Öğrenci", sinif: "" }) }));
    harita.set(eposta, { anahtar: eposta, eposta, ad: eposta.split("@")[0], roller: ["Veli"], cocuklar, aktifOgrenci: false });
  }
  const simdi = Date.now();
  const bugun = gunAnahtari();
  const son30 = new Set(Array.from({ length: 30 }, (_, i) => gunAnahtari(new Date(simdi - i * 86400000))));
  return [...harita.values()].map(v => {
    const oz = v.eposta ? pnl.ozetler.get(v.eposta) : null;
    const sonGorulme = tarihYap(oz?.sonGorulme);
    const sonGiris = tarihYap(oz?.sonGiris) || sonGorulme;
    const gunler = oz?.gunler || {};
    let giris30 = 0, gun30 = 0;
    for (const [g, n] of Object.entries(gunler)) if (son30.has(g)) { giris30 += Number(n) || 0; gun30++; }
    const ekranlar = Object.entries(oz?.ekranlar || {}).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
    const gecen = sonGorulme ? simdi - sonGorulme.getTime() : Infinity;
    const durum = !v.eposta ? "hesapsiz"
      : gecen < CEVRIMICI_ESIK ? "cevrimici"
      : gecen <= 7 * 86400000 ? "aktif"
      : gecen <= 30 * 86400000 ? "az" : "pasif";
    const uyg = oz?.uygulamalar || {};
    return {
      ...v, oz, sonGorulme, sonGiris, gunler, giris30, gun30, ekranlar, durum,
      bugun: (Number(gunler[bugun]) || 0) > 0 || (sonGorulme && gunAnahtari(sonGorulme) === bugun),
      portal: Number(uyg.portal) || 0, zeky: Number(uyg.zeky) || 0,
      sinif: v.cocuklar[0]?.sinif || ""
    };
  });
}

function goreceZaman(t) {
  if (!t) return "Hiç girmedi";
  const fark = Date.now() - t.getTime();
  if (fark < 60000) return "Az önce";
  if (fark < 3600000) return `${Math.floor(fark / 60000)} dk önce`;
  if (fark < 86400000 && gunAnahtari(t) === gunAnahtari()) return `Bugün ${saat(t)}`;
  if (gunAnahtari(t) === gunAnahtari(new Date(Date.now() - 86400000))) return `Dün ${saat(t)}`;
  const gun = Math.floor(fark / 86400000);
  if (gun < 7) return `${gun} gün önce`;
  return tamTarih(t, false);
}
const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const GUNLER = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
function saat(t) { return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`; }
function tamTarih(t, saatli = true) {
  return `${t.getDate()} ${AYLAR[t.getMonth()]}${t.getFullYear() !== new Date().getFullYear() ? " " + t.getFullYear() : ""}${saatli ? " " + saat(t) : ""}`;
}

const DURUM = {
  cevrimici: { ad: "Çevrimiçi", renk: "#16A34A" },
  aktif: { ad: "Son 7 günde girdi", renk: "#2B3674" },
  az: { ad: "8–30 gündür girmedi", renk: "#D69E2E" },
  pasif: { ad: "30+ gündür girmedi", renk: "#DC2626" },
  hesapsiz: { ad: "Portal hesabı yok", renk: "#94A3B8" }
};

// ── çizim ──
function ciz() {
  if (!pnl) return;
  const kap = pnl.kap;
  // Açık bir açılır listeyi (özellikle telefonda) yenileme kapatmasın
  if (document.activeElement?.tagName === "SELECT" && kap.contains(document.activeElement)) {
    setTimeout(cizPlanla, 1500);
    return;
  }
  if (pnl.hata === "izin") {
    kap.innerHTML = `<div class="vk-uyari"><strong>Firestore kuralı eksik.</strong> Veli katılım kayıtlarını okumak için kurallara "VELİ KATILIMI" bloğu eklenmeli.</div>`;
    return;
  }
  const tumu = veliKadrosu();
  const hesapli = tumu.filter(v => v.eposta && v.aktifOgrenci);
  const cevrimici = hesapli.filter(v => v.durum === "cevrimici");
  const bugun = hesapli.filter(v => v.bugun);
  const hafta = hesapli.filter(v => v.durum === "cevrimici" || v.durum === "aktif");
  const pasif = hesapli.filter(v => v.durum === "pasif");
  const hicGirmeyen = hesapli.filter(v => !v.sonGorulme);
  const yuzde = (n) => hesapli.length ? Math.round((n / hesapli.length) * 100) : 0;

  // Aktif bir filtre kutusunda yazılıyorsa odak kaybolmasın
  const odak = document.activeElement && kap.contains(document.activeElement) ? document.activeElement.dataset.vkFiltre : null;
  const secim = odak ? { bas: document.activeElement.selectionStart, son: document.activeElement.selectionEnd } : null;

  const siniflar = [...new Set(tumu.map(v => v.sinif).filter(Boolean))].sort((x, y) => x.localeCompare(y, "tr"));
  const f = pnl.filtre;
  let liste = tumu.filter(v => v.aktifOgrenci || v.sonGorulme);
  if (f.sinif) liste = liste.filter(v => v.cocuklar.some(c => c.sinif === f.sinif));
  if (f.durum === "bugun") liste = liste.filter(v => v.bugun);
  else if (f.durum === "hic") liste = liste.filter(v => v.eposta && !v.sonGorulme);
  else if (f.durum) liste = liste.filter(v => v.durum === f.durum);
  if (f.ara) {
    const q = f.ara.toLocaleLowerCase("tr");
    liste = liste.filter(v => [v.ad, v.eposta, ...v.cocuklar.map(c => c.ad)].join(" ").toLocaleLowerCase("tr").includes(q));
  }
  const durumSira = { cevrimici: 0, aktif: 1, az: 2, pasif: 3, hesapsiz: 4 };
  liste.sort((x, y) => {
    if (f.sirala === "siklik") return (y.giris30 - x.giris30) || ((y.sonGorulme?.getTime() || 0) - (x.sonGorulme?.getTime() || 0));
    if (f.sirala === "ad") return x.ad.localeCompare(y.ad, "tr");
    return (durumSira[x.durum] - durumSira[y.durum]) || ((y.sonGorulme?.getTime() || 0) - (x.sonGorulme?.getTime() || 0));
  });

  kap.innerHTML = `
    <div class="vk-kartlar">
      ${kart("Şu an çevrimiçi", cevrimici.length, cevrimici.length ? cevrimici.slice(0, 3).map(v => v.ad).join(", ") + (cevrimici.length > 3 ? ` ve ${cevrimici.length - 3} veli` : "") : "Şu an kimse yok", "vk-kart-canli")}
      ${kart("Bugün giren", bugun.length, `${hesapli.length} velinin %${yuzde(bugun.length)}'i`)}
      ${kart("Son 7 günde giren", hafta.length, `${hesapli.length} velinin %${yuzde(hafta.length)}'i`)}
      ${kart("30 günden uzun süredir girmeyen", pasif.length, hicGirmeyen.length ? `${hicGirmeyen.length} veli hiç girmedi` : "Hepsi en az bir kez girdi", pasif.length ? "vk-kart-uyari" : "")}
    </div>
    <div class="vk-orta">
      <section class="vk-kutu">
        <h3>Günlük giren veli sayısı</h3>
        <p class="vk-kutu-alt">Son 14 gün. Her çubuk o gün en az bir kez giren veli sayısı.</p>
        ${gunlukGrafik(hesapli)}
        <h3 class="vk-ara-baslik">En çok bakılan bölümler</h3>
        <p class="vk-kutu-alt">Kayıtların başladığı günden bu yana, tüm veliler.</p>
        ${bolumGrafik(tumu)}
      </section>
      <section class="vk-kutu vk-akis-kutu">
        <h3><span class="vk-canli-nokta"></span>Canlı akış</h3>
        <p class="vk-kutu-alt">Yeni hareketler sayfa yenilenmeden eklenir.</p>
        <div class="vk-akis">${akisHtml(tumu)}</div>
      </section>
    </div>
    <section class="vk-kutu">
      <div class="vk-liste-bas">
        <h3>Veliler <span>${liste.length}</span></h3>
        <div class="vk-filtreler">
          <input type="search" placeholder="Veli ya da çocuk adı" value="${esc(f.ara)}" data-vk-filtre="ara" aria-label="Veli ara">
          <select data-vk-filtre="sinif" aria-label="Sınıf"><option value="">Tüm sınıflar</option>${siniflar.map(s => `<option${s === f.sinif ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>
          <select data-vk-filtre="durum" aria-label="Durum">
            ${[["", "Tüm veliler"], ["cevrimici", "Çevrimiçi"], ["bugun", "Bugün girenler"], ["aktif", "Son 7 günde girenler"], ["az", "8–30 gündür girmeyenler"], ["pasif", "30+ gündür girmeyenler"], ["hic", "Hiç girmeyenler"], ["hesapsiz", "Portal hesabı olmayanlar"]]
              .map(([d, ad]) => `<option value="${d}"${d === f.durum ? " selected" : ""}>${ad}</option>`).join("")}
          </select>
          <select data-vk-filtre="sirala" aria-label="Sıralama">
            ${[["son", "Son girişe göre"], ["siklik", "Giriş sıklığına göre"], ["ad", "Ada göre"]]
              .map(([d, ad]) => `<option value="${d}"${d === f.sirala ? " selected" : ""}>${ad}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="vk-tablo" role="list">
        ${liste.length ? liste.map(satirHtml).join("") : `<div class="vk-bos">Bu filtreye uyan veli yok.</div>`}
      </div>
    </section>`;

  kap.querySelectorAll("[data-vk-filtre]").forEach(el => {
    const olay = el.tagName === "INPUT" ? "input" : "change";
    el.addEventListener(olay, () => { pnl.filtre[el.dataset.vkFiltre] = el.value; ciz(); });
  });
  kap.querySelectorAll("[data-vk-veli]").forEach(el => el.addEventListener("click", () => detayAc(el.dataset.vkVeli)));
  if (odak) {
    const el = kap.querySelector(`[data-vk-filtre="${odak}"]`);
    if (el) { el.focus(); if (secim && el.setSelectionRange) try { el.setSelectionRange(secim.bas, secim.son); } catch (_) {} }
  }
  pnl.ilkYukleme = false;
}

function kart(baslik, sayi, alt, sinif = "") {
  return `<div class="vk-kart ${sinif}"><div class="vk-kart-baslik">${esc(baslik)}</div><div class="vk-kart-sayi">${sayi}</div><div class="vk-kart-alt">${esc(alt)}</div></div>`;
}

function gunlukGrafik(veliler) {
  const gunler = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86400000));
  const sayilar = gunler.map(g => { const k = gunAnahtari(g); return veliler.filter(v => (Number(v.gunler[k]) || 0) > 0).length; });
  const enCok = Math.max(1, ...sayilar);
  return `<div class="vk-gunluk">${gunler.map((g, i) => `
    <div class="vk-gunluk-sutun" title="${tamTarih(g, false)}: ${sayilar[i]} veli">
      <span class="vk-gunluk-sayi">${sayilar[i] || ""}</span>
      <span class="vk-gunluk-cubuk${i === 13 ? " vk-bugun" : ""}" style="height:${Math.max(3, Math.round((sayilar[i] / enCok) * 100))}%"></span>
      <span class="vk-gunluk-gun">${i === 13 ? "Bugün" : GUNLER[g.getDay()]}</span>
    </div>`).join("")}</div>`;
}

function bolumGrafik(veliler) {
  const toplam = new Map();
  veliler.forEach(v => v.ekranlar.forEach(([k, n]) => toplam.set(k, (toplam.get(k) || 0) + (Number(n) || 0))));
  const sirali = [...toplam.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  if (!sirali.length) return `<div class="vk-bos vk-bos-kucuk">Henüz bölüm kaydı yok. Veliler girdikçe burada görünecek.</div>`;
  const enCok = sirali[0][1];
  return `<div class="vk-bolumler">${sirali.map(([k, n]) => `
    <div class="vk-bolum"><span class="vk-bolum-ad">${esc(bolumAdi(k))}</span>
      <span class="vk-bolum-cubuk"><span style="width:${Math.round((n / enCok) * 100)}%"></span></span>
      <span class="vk-bolum-sayi">${n}</span></div>`).join("")}</div>`;
}

function akisHtml(veliler) {
  const epostadan = new Map(veliler.filter(v => v.eposta).map(v => [v.eposta, v]));
  if (!pnl.akis.length) return `<div class="vk-bos vk-bos-kucuk">Henüz hareket yok.</div>`;
  const ilk = pnl.gorulenAkis.size === 0;
  const html = pnl.akis.map(h => {
    const v = epostadan.get(h.eposta);
    const t = tarihYap(h.zaman);
    const yeni = !ilk && !pnl.gorulenAkis.has(h.id);
    pnl.gorulenAkis.add(h.id);
    const kim = v ? `${esc(v.ad)}` : esc(h.eposta);
    const cocuk = v?.cocuklar?.length ? `<span class="vk-akis-cocuk">${esc(v.cocuklar.map(c => c.ad.split(" ")[0]).join(", "))}${v.sinif ? `, ${esc(v.sinif)}` : ""}</span>` : "";
    const ne = h.tur === "giris" ? "giriş yaptı" : `${esc(bolumAdi(h.ekran))} bölümünü açtı`;
    return `<div class="vk-akis-oge${yeni ? " vk-yeni" : ""}"${v ? ` data-vk-veli="${esc(v.anahtar)}"` : ""}>
      <span class="vk-akis-saat">${t ? saat(t) : ""}</span>
      <span class="vk-akis-metin"><strong>${kim}</strong> ${ne}${cocuk}</span>
      <span class="vk-uyg vk-uyg-${h.uygulama === "zeky" ? "zeky" : "portal"}">${h.uygulama === "zeky" ? "ZEKY" : "Portal"}</span>
    </div>`;
  }).join("");
  return html;
}

function seritHtml(gunler, uzunluk = 30) {
  return `<span class="vk-serit" aria-hidden="true">${Array.from({ length: uzunluk }, (_, i) => {
    const g = new Date(Date.now() - (uzunluk - 1 - i) * 86400000);
    const n = Number(gunler[gunAnahtari(g)]) || 0;
    return `<span class="vk-serit-gun${n ? (n > 2 ? " vk-s3" : n > 1 ? " vk-s2" : " vk-s1") : ""}" title="${tamTarih(g, false)}: ${n} giriş"></span>`;
  }).join("")}</span>`;
}

function satirHtml(v) {
  const d = DURUM[v.durum];
  const cocuk = v.cocuklar.map(c => esc(c.ad)).join(", ");
  const enCok = v.ekranlar.slice(0, 3).map(([k]) => `<span class="vk-etiket">${esc(bolumAdi(k))}</span>`).join("");
  const uyg = [v.portal ? "Portal" : "", v.zeky ? "ZEKY" : ""].filter(Boolean)
    .map(u => `<span class="vk-uyg vk-uyg-${u === "ZEKY" ? "zeky" : "portal"}">${u}</span>`).join("");
  return `<button type="button" class="vk-satir" role="listitem" data-vk-veli="${esc(v.anahtar)}">
    <span class="vk-durum-nokta" style="background:${d.renk}" title="${d.ad}"></span>
    <span class="vk-kim"><span class="vk-ad">${esc(v.ad)} <span class="vk-rol">${esc(v.roller.join(" ve "))}</span></span>
      <span class="vk-cocuk">${cocuk}${v.sinif ? `, ${esc(v.sinif)}` : ""}${v.aktifOgrenci ? "" : " (aktif kayıt yok)"}</span></span>
    <span class="vk-son"><span class="vk-son-ana">${v.durum === "cevrimici" ? "Şu an çevrimiçi" : v.durum === "hesapsiz" ? "Portal hesabı yok" : goreceZaman(v.sonGiris)}</span>
      <span class="vk-son-alt">${v.eposta ? `30 günde ${v.giris30} giriş, ${v.gun30} farklı gün` : "E-posta kayıtlı değil"}</span></span>
    <span class="vk-serit-kap">${v.eposta ? seritHtml(v.gunler) : ""}</span>
    <span class="vk-ilgi">${enCok}${uyg}</span>
  </button>`;
}

// ── veli ayrıntısı ──
let detay = null;
async function detayAc(anahtar) {
  const v = veliKadrosu().find(x => x.anahtar === anahtar);
  if (!v) return;
  detayKapat();
  const kok = document.createElement("div");
  kok.className = "vk-arka";
  kok.innerHTML = `<div class="vk-detay" role="dialog" aria-modal="true" aria-label="${esc(v.ad)} katılım ayrıntısı">
    <header class="vk-detay-bas"><div><h3>${esc(v.ad)} <span class="vk-rol">${esc(v.roller.join(" ve "))}</span></h3>
      <p>${esc(v.cocuklar.map(c => c.ad + (c.sinif ? ", " + c.sinif : "")).join(" · "))}</p>
      ${v.eposta ? `<p class="vk-detay-eposta">${esc(v.eposta)}</p>` : ""}</div>
      <button type="button" class="vk-kapat" data-vk-kapat aria-label="Kapat">×</button></header>
    <div class="vk-detay-govde">
      <div class="vk-detay-ozet">
        ${kart("Son görülme", v.sonGorulme ? goreceZaman(v.sonGorulme) : "—", v.sonGorulme ? tamTarih(v.sonGorulme) : "Hiç girmedi")}
        ${kart("30 günde giriş", v.giris30, `${v.gun30} farklı gün`)}
        ${kart("Toplam giriş", Number(v.oz?.girisSayisi) || 0, [v.portal ? `Portal ${v.portal}` : "", v.zeky ? `ZEKY ${v.zeky}` : ""].filter(Boolean).join(", ") || "Kayıt yok")}
      </div>
      <h4>Son 60 gün</h4>
      ${seritHtml(v.gunler, 60)}
      <h4>Baktığı bölümler</h4>
      ${v.ekranlar.length ? `<div class="vk-bolumler">${v.ekranlar.slice(0, 10).map(([k, n]) => `
        <div class="vk-bolum"><span class="vk-bolum-ad">${esc(bolumAdi(k))}</span>
        <span class="vk-bolum-cubuk"><span style="width:${Math.round((n / v.ekranlar[0][1]) * 100)}%"></span></span>
        <span class="vk-bolum-sayi">${n}</span></div>`).join("")}</div>` : `<div class="vk-bos vk-bos-kucuk">Henüz bölüm kaydı yok.</div>`}
      <h4>Son hareketler</h4>
      <div class="vk-akis" data-vk-hareketler><div class="vk-bos vk-bos-kucuk"><span class="vk-donen"></span>Yükleniyor</div></div>
    </div></div>`;
  document.body.appendChild(kok);
  detay = { kok, tasma: document.body.style.overflow };
  document.body.style.overflow = "hidden";
  kok.addEventListener("click", e => { if (e.target === kok || e.target.closest("[data-vk-kapat]")) detayKapat(); });
  document.addEventListener("keydown", detayTus, true);
  kok.querySelector("[data-vk-kapat]").focus({ preventScroll: true });

  if (!v.eposta) { kok.querySelector("[data-vk-hareketler]").innerHTML = `<div class="vk-bos vk-bos-kucuk">Portal hesabı olmadığı için kayıt yok.</div>`; return; }
  try {
    const { db, fb } = P();
    const on = `${v.eposta}__`;
    const snap = await fb.getDocs(fb.query(fb.collection(db, "veliKatilimAkisi"),
      fb.where(fb.documentId(), ">=", on), fb.where(fb.documentId(), "<", on + "\uf8ff"),
      fb.orderBy(fb.documentId(), "desc"), fb.limit(80)));
    if (!detay || detay.kok !== kok) return;
    const hareketler = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    kok.querySelector("[data-vk-hareketler]").innerHTML = hareketler.length
      ? hareketler.map(h => {
          const t = tarihYap(h.zaman);
          return `<div class="vk-akis-oge"><span class="vk-akis-saat vk-akis-saat-genis">${t ? `${GUNLER[t.getDay()]} ${tamTarih(t)}` : ""}</span>
            <span class="vk-akis-metin">${h.tur === "giris" ? "<strong>Giriş yaptı</strong>" : `${esc(bolumAdi(h.ekran))} bölümünü açtı`}</span>
            <span class="vk-uyg vk-uyg-${h.uygulama === "zeky" ? "zeky" : "portal"}">${h.uygulama === "zeky" ? "ZEKY" : "Portal"}</span></div>`;
        }).join("")
      : `<div class="vk-bos vk-bos-kucuk">Kayıtlı hareket yok.</div>`;
  } catch (e) {
    if (detay?.kok === kok) kok.querySelector("[data-vk-hareketler]").innerHTML = `<div class="vk-bos vk-bos-kucuk">Hareketler okunamadı: ${esc(e?.code || e?.message)}</div>`;
  }
}
function detayTus(e) { if (e.key === "Escape") { e.preventDefault(); detayKapat(); } }
function detayKapat() {
  if (!detay) return;
  document.removeEventListener("keydown", detayTus, true);
  document.body.style.overflow = detay.tasma || "";
  detay.kok.remove();
  detay = null;
}

// ── stil ──
function stilEkle() {
  if (document.getElementById("veliKatilimStil")) return;
  const st = document.createElement("style");
  st.id = "veliKatilimStil";
  st.textContent = `
.vk-bos { padding:28px 16px; text-align:center; color:var(--ink-soft,#4A5169); font-size:14px; display:flex; align-items:center; justify-content:center; gap:10px; }
.vk-bos-kucuk { padding:14px 8px; font-size:13px; color:var(--gray-500,#8A92A6); }
.vk-donen { width:16px; height:16px; border:2px solid var(--green-medium,#5A6ACF); border-right-color:transparent; border-radius:50%; display:inline-block; animation:vkDon .8s linear infinite; }
@keyframes vkDon { to { transform:rotate(360deg); } }
.vk-uyari { padding:14px 16px; border-radius:12px; background:#FFF8E8; border:1px solid #F0CF86; color:#5C3B00; font-size:14px; line-height:1.5; }
.vk-kartlar { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; margin-bottom:14px; }
.vk-kart { background:#fff; border:1px solid var(--gray-100,#F1F2F7); border-radius:16px; padding:14px 16px; box-shadow:var(--shadow-sm,0 2px 8px rgba(30,41,90,.06)); min-width:0; }
.vk-kart-baslik { font-size:12.5px; color:var(--ink-soft,#4A5169); font-weight:600; }
.vk-kart-sayi { font-size:30px; font-weight:700; color:var(--green-deep,#1F2544); line-height:1.15; margin-top:4px; font-variant-numeric:tabular-nums; }
.vk-kart-alt { font-size:12px; color:var(--gray-500,#8A92A6); margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.vk-kart-canli { border-color:#BBF7D0; background:#F0FDF4; }
.vk-kart-canli .vk-kart-sayi { color:#15803D; }
.vk-kart-uyari .vk-kart-sayi { color:#B91C1C; }
.vk-orta { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); gap:12px; margin-bottom:14px; }
.vk-kutu { background:#fff; border:1px solid var(--gray-100,#F1F2F7); border-radius:16px; padding:16px 18px; box-shadow:var(--shadow-sm,0 2px 8px rgba(30,41,90,.06)); min-width:0; }
.vk-kutu h3 { margin:0; font-size:15px; font-weight:700; color:var(--green-deep,#1F2544); display:flex; align-items:center; gap:8px; }
.vk-kutu h3 span { font-size:13px; font-weight:600; color:var(--gray-500,#8A92A6); }
.vk-kutu-alt { margin:3px 0 12px; font-size:12px; color:var(--gray-500,#8A92A6); }
.vk-ara-baslik { margin-top:18px !important; }
.vk-canli-nokta { width:9px; height:9px; border-radius:50%; background:#16A34A; box-shadow:0 0 0 0 rgba(22,163,74,.5); animation:vkNabiz 2s infinite; }
@keyframes vkNabiz { 0% { box-shadow:0 0 0 0 rgba(22,163,74,.5); } 70% { box-shadow:0 0 0 8px rgba(22,163,74,0); } 100% { box-shadow:0 0 0 0 rgba(22,163,74,0); } }
.vk-gunluk { display:grid; grid-template-columns:repeat(14, minmax(0,1fr)); gap:5px; height:120px; align-items:end; }
.vk-gunluk-sutun { display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:4px; min-width:0; }
.vk-gunluk-sayi { font-size:10.5px; font-weight:700; color:var(--ink-soft,#4A5169); min-height:13px; }
.vk-gunluk-cubuk { width:100%; max-width:26px; border-radius:6px 6px 2px 2px; background:var(--green-light,#C9D1F0); flex:0 0 auto; }
.vk-gunluk-cubuk.vk-bugun { background:var(--green-medium,#5A6ACF); }
.vk-gunluk-gun { font-size:10.5px; color:var(--gray-500,#8A92A6); white-space:nowrap; }
.vk-bolumler { display:flex; flex-direction:column; gap:7px; }
.vk-bolum { display:grid; grid-template-columns:minmax(90px, 130px) 1fr 38px; align-items:center; gap:10px; font-size:13px; }
.vk-bolum-ad { color:var(--ink,#1F2544); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.vk-bolum-cubuk { height:9px; border-radius:999px; background:var(--gray-100,#F1F2F7); overflow:hidden; }
.vk-bolum-cubuk span { display:block; height:100%; border-radius:999px; background:var(--green-medium,#5A6ACF); }
.vk-bolum-sayi { text-align:right; font-weight:600; color:var(--ink-soft,#4A5169); font-variant-numeric:tabular-nums; }
.vk-akis-kutu { display:flex; flex-direction:column; max-height:470px; }
.vk-akis { overflow-y:auto; display:flex; flex-direction:column; }
.vk-akis-oge { display:flex; align-items:baseline; gap:10px; padding:8px 4px; border-top:1px solid var(--gray-100,#F1F2F7); font-size:13px; cursor:default; border-radius:8px; }
.vk-akis-oge[data-vk-veli] { cursor:pointer; }
.vk-akis-oge[data-vk-veli]:hover { background:var(--warm-white,#F7F8FC); }
.vk-akis-oge.vk-yeni { animation:vkYeni 2.4s ease-out; }
@keyframes vkYeni { 0% { background:#DCFCE7; } 100% { background:transparent; } }
.vk-akis-saat { flex-shrink:0; width:42px; font-weight:600; color:var(--gray-500,#8A92A6); font-variant-numeric:tabular-nums; }
.vk-akis-saat-genis { width:118px; }
.vk-akis-metin { flex:1; min-width:0; color:var(--ink,#1F2544); line-height:1.45; }
.vk-akis-cocuk { display:block; font-size:12px; color:var(--gray-500,#8A92A6); }
.vk-uyg { flex-shrink:0; font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:999px; }
.vk-uyg-portal { background:var(--green-mist,#E9EBF4); color:var(--green-primary,#2B3674); }
.vk-uyg-zeky { background:#DCFCE7; color:#166534; }
.vk-liste-bas { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
.vk-filtreler { display:flex; gap:8px; flex-wrap:wrap; }
.vk-filtreler input, .vk-filtreler select { min-height:40px; padding:8px 10px; border:1.5px solid var(--gray-300,#D8DCE9); border-radius:10px; font:14px var(--font-body,inherit); background:#fff; color:var(--ink,#1F2544); }
.vk-filtreler input { width:210px; }
.vk-filtreler input:focus, .vk-filtreler select:focus { outline:none; border-color:var(--green-medium,#5A6ACF); }
.vk-tablo { display:flex; flex-direction:column; }
.vk-satir { display:grid; grid-template-columns:12px minmax(0,1.6fr) minmax(0,1fr) auto minmax(0,1.2fr); align-items:center; gap:14px; width:100%; padding:12px 8px; border:0; border-top:1px solid var(--gray-100,#F1F2F7); background:transparent; text-align:left; font:inherit; color:inherit; cursor:pointer; border-radius:10px; }
.vk-satir:hover { background:var(--warm-white,#F7F8FC); }
.vk-satir:focus-visible { outline:3px solid var(--green-light,#C9D1F0); outline-offset:-3px; }
.vk-durum-nokta { width:10px; height:10px; border-radius:50%; }
.vk-kim, .vk-son { display:flex; flex-direction:column; min-width:0; }
.vk-ad { font-size:14px; font-weight:600; color:var(--ink,#1F2544); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.vk-rol { font-size:12px; font-weight:500; color:var(--gray-500,#8A92A6); }
.vk-cocuk { font-size:12.5px; color:var(--ink-soft,#4A5169); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.vk-son-ana { font-size:13px; font-weight:600; color:var(--ink,#1F2544); }
.vk-son-alt { font-size:12px; color:var(--gray-500,#8A92A6); }
.vk-serit { display:inline-flex; gap:2px; }
.vk-serit-gun { width:6px; height:18px; border-radius:2px; background:var(--gray-100,#F1F2F7); }
.vk-serit-gun.vk-s1 { background:var(--green-light,#C9D1F0); }
.vk-serit-gun.vk-s2 { background:#8C98DE; }
.vk-serit-gun.vk-s3 { background:var(--green-medium,#5A6ACF); }
.vk-ilgi { display:flex; flex-wrap:wrap; gap:5px; justify-content:flex-end; }
.vk-etiket { font-size:11.5px; padding:3px 8px; border-radius:999px; background:var(--gray-100,#F1F2F7); color:var(--ink-soft,#4A5169); white-space:nowrap; }
.vk-arka { position:fixed; inset:0; z-index:1050; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; padding:20px; }
.vk-detay { background:#fff; width:100%; max-width:640px; max-height:88vh; border-radius:var(--radius-lg,24px); display:flex; flex-direction:column; overflow:hidden; box-shadow:var(--shadow-lg,0 18px 40px rgba(30,41,90,.14)); }
.vk-detay-bas { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:20px 20px 12px 24px; flex-shrink:0; }
.vk-detay-bas h3 { margin:0; font-size:18px; color:var(--green-deep,#1F2544); }
.vk-detay-bas p { margin:4px 0 0; font-size:13px; color:var(--ink-soft,#4A5169); }
.vk-detay-eposta { color:var(--gray-500,#8A92A6) !important; }
.vk-kapat { width:44px; height:44px; flex-shrink:0; border:0; border-radius:50%; background:var(--gray-100,#F1F2F7); font-size:24px; line-height:1; color:var(--ink-soft,#4A5169); cursor:pointer; }
.vk-detay-govde { overflow-y:auto; padding:0 24px 22px; min-height:0; }
.vk-detay-govde h4 { margin:18px 0 8px; font-size:13.5px; color:var(--green-primary,#2B3674); }
.vk-detay-ozet { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
.vk-detay-ozet .vk-kart-sayi { font-size:20px; }
.vk-detay .vk-serit-gun { width:7px; height:24px; }
.vk-detay .vk-serit { flex-wrap:wrap; }
@media (max-width:1100px) { .vk-satir { grid-template-columns:12px minmax(0,1.5fr) minmax(0,1fr) auto; } .vk-ilgi { display:none; } }
@media (max-width:900px) {
  .vk-kartlar { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .vk-orta { grid-template-columns:1fr; }
  .vk-satir { grid-template-columns:12px minmax(0,1fr) auto; }
  .vk-serit-kap { grid-column:2 / -1; }
}
@media (max-width:640px) {
  .vk-filtreler, .vk-filtreler input, .vk-filtreler select { width:100%; }
  .vk-arka { padding:0; align-items:flex-end; }
  .vk-detay { max-width:none; max-height:94vh; border-radius:20px 20px 0 0; }
  .vk-detay-ozet { grid-template-columns:1fr 1fr; }
  .vk-akis-saat-genis { width:92px; }
  .vk-kart-sayi { font-size:24px; }
}
@media (prefers-reduced-motion:reduce) { .vk-canli-nokta, .vk-donen, .vk-akis-oge.vk-yeni { animation:none; } }
`;
  document.head.appendChild(st);
}

if (typeof window !== "undefined") {
  window.veliKatilim = { veliBaslat, personelBaslat, panelRender, panelDurdur, BOLUMLER };
}
