// ══════════════════════════════════════════════════════════════
// PORTAL · ÖZLÜK & PUANTAJ — PERSONEL GÖRÜNÜMÜ
// --------------------------------------------------------------
// Liste: her çalışanın bugünkü durumu (içeride / molada / çıktı /
//        izinli-raporlu ve iznin bitiş tarihi), bugün ve bu hafta
//        çalışılan süre, son uygulama kullanımı. Canlı güncellenir.
// Ayrıntı (çalışana tıklayınca):
//   Özet       · aylık takvim (izin/rapor türüne göre renkli), göstergeler
//   Giriş-Çıkış· günlük / haftalık / aylık saat grafiği, günlük zaman
//                çizelgesi (çalışma + mola), ham kayıtlar
//   İzinler    · yıllık izin hakkı, geçmiş, süren iznin bitişi
//   Hak ediş   · ayın gün dökümü (çalışılan, ücretli/ücretsiz izin, rapor), bordro
//   Uygulama   · giriş sıklığı, gün × saat dağılımı, açılan bölümler
//
// Veri (ZEKY ile ortak): puantaj, personelDurum, izinTalepleri,
// bordrolar, personeller, personelKatilim(+Akisi)
// ══════════════════════════════════════════════════════════════

import { izinMetrikleri, izinTurKodu, izinDurumKodu, IZIN_TURLERI, izinSureOzeti } from "../js/personel-izin-core.js?v=1";

const P = () => window.PortalAPI;
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const kucuk = (x) => String(x || "").trim().toLowerCase();
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const GUN_KISA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const GUN_UZUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

// ── İzin türleri: her biri ayrı renk ve ikon (takvim, rozet, liste) ──
export const IZIN_GORUNUM = {
  yillik:   { ad: "Yıllık izin",       renk: "#16A34A", acik: "#DCFCE7", ikon: "palmtree",          ucretli: true },
  mazeret:  { ad: "Mazeret izni",      renk: "#D97706", acik: "#FEF3C7", ikon: "clock-3",           ucretli: true },
  saatlik:  { ad: "Saatlik izin",      renk: "#65A30D", acik: "#ECFCCB", ikon: "timer",             ucretli: true },
  rapor:    { ad: "Sağlık raporu",     renk: "#7C3AED", acik: "#EDE9FE", ikon: "briefcase-medical", ucretli: false, rapor: true },
  hastane:  { ad: "Hastane randevusu", renk: "#0891B2", acik: "#CFFAFE", ikon: "stethoscope",       ucretli: true },
  dogum:    { ad: "Doğum izni",        renk: "#DB2777", acik: "#FCE7F3", ikon: "baby",              ucretli: true },
  sut:      { ad: "Süt izni",          renk: "#2563EB", acik: "#DBEAFE", ikon: "droplets",          ucretli: true },
  vefat:    { ad: "Vefat izni",        renk: "#475569", acik: "#E2E8F0", ikon: "flower-2",          ucretli: true },
  evlilik:  { ad: "Evlilik izni",      renk: "#E11D48", acik: "#FFE4E6", ikon: "heart",             ucretli: true },
  ucretsiz: { ad: "Ücretsiz izin",     renk: "#92400E", acik: "#F5E6D8", ikon: "wallet",            ucretli: false }
};
function izinGorunum(tur) {
  const k = izinTurKodu(tur);
  return IZIN_GORUNUM[k] || { ad: IZIN_TURLERI[k]?.ad || "İzin", renk: "#64748B", acik: "#F1F5F9", ikon: "calendar-off", ucretli: true };
}
const CALISMA = "#4A7C59";           // marka yeşili — çalışılan gün / süre
const MOLA = "#E0A526";

const BOLUM_ADI = {
  ozet: "Özet", ogrencilerM: "Öğrenciler", velilerM: "Veliler", siniflarM: "Sınıflar", oryantasyonM: "İlk Adımlar",
  ozlukM: "Özlük & Puantaj", pdr: "PDR", danismaRandevu: "Aday Randevuları", basvuru: "Başvuru Havuzu",
  personel: "Personel", egitim: "Eğitim", muhasebe: "Muhasebe", devamsizlik: "Devamsızlık", haftalikPlan: "Haftalık Plan",
  gunlukRapor: "Günlük Rapor", programBelgeleme: "Evrak Takibi", geriBildirim: "Geri Bildirim", galeri: "Galeri",
  duyurular: "Duyurular", yemek: "Yemek Menüsü", etkinlik: "Etkinlik & Takvim", mesaj: "Mesajlaşma",
  gelisim: "Gelişim & Kalite", denetim: "MEB Denetim", profilim: "Profilim", veliKatilim: "Veli Katılımı", randevular: "Randevular",
  yoklama: "Yoklama", kazanim: "Kazanımlar", mesajlar: "Mesajlar", galeriyukle: "Galeri Yükleme", izin: "İzin Talebi", qr: "QR Giriş"
};
const bolumAdi = (k) => BOLUM_ADI[k] || (k ? k.charAt(0).toLocaleUpperCase("tr") + k.slice(1) : "");

// ── tarih yardımcıları (yerel saat) ──
function gunKodu(t) { return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; }
function tarihTen(kod) { const [y, a, g] = String(kod).split("-").map(Number); return new Date(y, a - 1, g); }
function gunEkle(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d; }
function haftaBasi(t) { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate()); const g = d.getDay(); d.setDate(d.getDate() + (g === 0 ? -6 : 1 - g)); return d; }
function saatDk(dk) { if (!dk && dk !== 0) return "—"; const s = Math.floor(dk / 60), d = Math.round(dk % 60); return s ? `${s} sa ${String(d).padStart(2, "0")} dk` : `${d} dk`; }
function kisaSure(dk) { const s = Math.floor(dk / 60), d = Math.round(dk % 60); return `${s}:${String(d).padStart(2, "0")}`; }
function saat(t) { return t ? `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}` : "—"; }
function tarihYaz(t, yil = false) { return `${t.getDate()} ${AYLAR[t.getMonth()]}${yil || t.getFullYear() !== new Date().getFullYear() ? " " + t.getFullYear() : ""}`; }
function tarihOku(z) { if (!z) return null; if (typeof z.toDate === "function") return z.toDate(); const t = new Date(z); return isNaN(t) ? null : t; }
function goreceZaman(t) {
  if (!t) return "Kayıt yok";
  const f = Date.now() - t.getTime();
  if (f < 60000) return "Az önce";
  if (f < 3600000) return `${Math.floor(f / 60000)} dk önce`;
  if (gunKodu(t) === gunKodu(new Date())) return `Bugün ${saat(t)}`;
  if (gunKodu(t) === gunKodu(gunEkle(new Date(), -1))) return `Dün ${saat(t)}`;
  const g = Math.floor(f / 86400000);
  return g < 7 ? `${g} gün önce` : tarihYaz(t);
}
function isGunuMu(t) { const g = t.getDay(); return g !== 0 && g !== 6; }
const ikon = (ad, boyut = 16) => `<i data-lucide="${ad}" style="width:${boyut}px;height:${boyut}px;"></i>`;
const ikonlariCiz = () => { try { window.lucideYenile?.(); } catch (_) {} };

// ── puantaj → günlük çalışma/mola ──
// Kayıt: { personelEmail, tip: giris|cikis|mola-basla|mola-bitir, zaman: ISO, tarih: YYYY-MM-DD }
export function gunuHesapla(kayitlar, bugunMu = false) {
  const s = [...kayitlar].map(k => ({ ...k, _t: tarihOku(k.zaman) })).filter(k => k._t).sort((a, b) => a._t - b._t);
  const dilimler = [];
  let durum = "disarida", bas = null;
  let giris = null, cikis = null;
  for (const k of s) {
    const t = k._t;
    if (k.tip === "giris") {
      if (durum === "molada" && bas) dilimler.push({ tur: "mola", bas, bit: t });
      if (durum !== "iceride") { durum = "iceride"; bas = t; }
      if (!giris) giris = t;
    } else if (k.tip === "mola-basla" && durum === "iceride") {
      dilimler.push({ tur: "calisma", bas, bit: t }); durum = "molada"; bas = t;
    } else if (k.tip === "mola-bitir" && durum === "molada") {
      dilimler.push({ tur: "mola", bas, bit: t }); durum = "iceride"; bas = t;
    } else if (k.tip === "cikis") {
      if (durum === "iceride" && bas) dilimler.push({ tur: "calisma", bas, bit: t });
      if (durum === "molada" && bas) dilimler.push({ tur: "mola", bas, bit: t });
      durum = "disarida"; bas = null; cikis = t;
    }
  }
  let acik = false, eksikCikis = false;
  if (durum !== "disarida" && bas) {
    if (bugunMu) { dilimler.push({ tur: durum === "molada" ? "mola" : "calisma", bas, bit: new Date(), acik: true }); acik = true; }
    else eksikCikis = true;
  }
  const dk = (tur) => dilimler.filter(d => d.tur === tur).reduce((t, d) => t + Math.max(0, (d.bit - d.bas) / 60000), 0);
  return { dilimler, calisma: dk("calisma"), mola: dk("mola"), giris, cikis, acik, eksikCikis, durum, kayitlar: s };
}

// ── izinler: gün → izin kaydı ──
function izinAraligi(v) {
  const bas = String(v.baslangic || "").slice(0, 10);
  const bit = String(v.bitis || v.baslangic || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bas)) return null;
  return { bas, bit: /^\d{4}-\d{2}-\d{2}$/.test(bit) ? bit : bas };
}
function gunIzni(izinler, kod) {
  let bulunan = null;
  for (const v of izinler) {
    const a = izinAraligi(v);
    if (!a || kod < a.bas || kod > a.bit) continue;
    const durum = izinDurumKodu(v.durum);
    if (durum === "reddedildi" || durum === "iptal") continue;
    if (!bulunan || (durum === "onaylandi" && izinDurumKodu(bulunan.durum) !== "onaylandi")) bulunan = v;
  }
  return bulunan;
}
function izinBitisi(v) {
  const a = izinAraligi(v);
  if (!a) return null;
  const bit = tarihTen(a.bit);
  let donus = gunEkle(bit, 1);
  while (!isGunuMu(donus)) donus = gunEkle(donus, 1);
  const kalan = Math.round((bit - tarihTen(gunKodu(new Date()))) / 86400000) + 1;
  return { bit, donus, kalan };
}

// ═════════════════════════ PANEL ═════════════════════════
let pnl = null;

function yonetimMi() { const s = P()?.state || {}; return !!s.isAdmin || ["kurucu_mudur", "mudur"].includes(s.rol); }

/** Özlük & Puantaj → "Personel" sekmesi */
export async function panelRender(kapId, personeller = []) {
  const kap = document.getElementById(kapId);
  if (!kap) return;
  stilEkle();
  const araclar = document.getElementById("ozlukAraclar");
  if (araclar) araclar.innerHTML = "";
  const kisiler = (personeller || []).filter(p => p && p.email).map(p => ({ ...p, email: kucuk(p.email) }));
  if (pnl && pnl.kap === kap) { pnl.personeller = kisiler; ciz(); return; }
  panelDurdur();
  pnl = { kap, personeller: kisiler, durumlar: {}, puantaj: [], izinler: [], katilim: new Map(), katilimIzni: true,
          filtre: { ara: "", rol: "", durum: "" }, zamanlayici: null, bekliyor: false };
  kap.innerHTML = `<div class="po-bos"><span class="po-donen"></span>Personel bilgileri yükleniyor</div>`;
  abone();
  pnl.zamanlayici = setInterval(() => {
    if (!pnl) return;
    if (!pnl.kap.isConnected || pnl.kap.offsetParent === null) { panelDurdur(); return; }
    cizPlanla();                                   // açık mesaide süre canlı artsın
  }, 60000);
  if (yonetimMi()) eskiAkisiTemizle();
}

export function panelDurdur() {
  if (!pnl) return;
  (pnl.abonelikler || []).forEach(f => { try { f(); } catch (_) {} });
  clearInterval(pnl.zamanlayici);
  pnl = null;
}

function abone() {
  const { db, fb } = P();
  const hafta = gunKodu(haftaBasi(new Date()));
  const uyar = (ne) => (e) => console.warn(`Personel ekranı · ${ne}:`, e?.code || e?.message);
  pnl.abonelikler = [
    fb.onSnapshot(fb.collection(db, "personelDurum"), s => {
      if (!pnl) return; pnl.durumlar = {}; s.forEach(d => { pnl.durumlar[kucuk(d.id)] = d.data() || {}; }); cizPlanla();
    }, uyar("durum")),
    fb.onSnapshot(fb.query(fb.collection(db, "puantaj"), fb.where("tarih", ">=", hafta)), s => {
      if (!pnl) return; pnl.puantaj = s.docs.map(d => ({ id: d.id, ...d.data() })); cizPlanla();
    }, uyar("puantaj")),
    fb.onSnapshot(fb.collection(db, "izinTalepleri"), s => {
      if (!pnl) return; pnl.izinler = s.docs.map(d => ({ id: d.id, ...d.data() })); cizPlanla();
    }, uyar("izin"))
  ];
  if (yonetimMi()) {
    pnl.abonelikler.push(fb.onSnapshot(fb.collection(db, "personelKatilim"), s => {
      if (!pnl) return; s.forEach(d => pnl.katilim.set(kucuk(d.id), d.data() || {})); cizPlanla();
    }, e => { if (pnl) { pnl.katilimIzni = false; cizPlanla(); } uyar("katılım")(e); }));
  }
}

function cizPlanla() {
  if (!pnl || pnl.bekliyor) return;
  pnl.bekliyor = true;
  setTimeout(() => { if (pnl) { pnl.bekliyor = false; ciz(); } }, 250);
}

async function eskiAkisiTemizle() {
  try {
    if (localStorage.getItem("po-temizlik") === gunKodu(new Date())) return;
    localStorage.setItem("po-temizlik", gunKodu(new Date()));
    const { db, fb } = P();
    const snap = await fb.getDocs(fb.query(fb.collection(db, "personelKatilimAkisi"),
      fb.where("zaman", "<", new Date(Date.now() - 365 * 86400000)), fb.limit(400)));
    if (snap.empty) return;
    const toplu = fb.writeBatch(db); snap.docs.forEach(d => toplu.delete(d.ref)); await toplu.commit();
  } catch (_) {}
}

// ── bir çalışanın bugünkü durumu ──
function kisiDurumu(p) {
  const bugun = gunKodu(new Date());
  const kayit = pnl.puantaj.filter(k => kucuk(k.personelEmail) === p.email && k.tarih === bugun);
  const g = gunuHesapla(kayit, true);
  const izinler = pnl.izinler.filter(v => kucuk(v.personelEmail) === p.email);
  const izin = gunIzni(izinler, bugun);
  const izinOnayli = izin && izinDurumKodu(izin.durum) === "onaylandi";
  const canli = pnl.durumlar[p.email]?.durum;
  let kod, etiket, alt = "", renk, acik, ik;
  if (izin && izinOnayli && g.durum === "disarida" && !g.kayitlar.length) {
    const gor = izinGorunum(izin.tur), b = izinBitisi(izin);
    kod = "izin"; etiket = gor.ad; renk = gor.renk; acik = gor.acik; ik = gor.ikon;
    alt = b ? (b.kalan <= 1 ? `Bugün bitiyor · dönüş ${GUN_UZUN[b.donus.getDay()]}` : `Bitiş ${tarihYaz(b.bit)} · ${b.kalan} gün kaldı`) : "";
  } else if (g.durum === "iceride" || canli === "iceride") {
    kod = "iceride"; etiket = "İçeride"; renk = "#15803D"; acik = "#DCFCE7"; ik = "log-in"; alt = g.giris ? `Giriş ${saat(g.giris)}` : "";
  } else if (g.durum === "molada" || canli === "molada") {
    kod = "molada"; etiket = "Molada"; renk = "#B45309"; acik = "#FEF3C7"; ik = "coffee";
    const m = [...g.dilimler].reverse().find(d => d.tur === "mola"); alt = m ? `Mola başı ${saat(m.bas)}` : "";
  } else if (g.cikis) {
    kod = "cikti"; etiket = "Çıktı"; renk = "#475569"; acik = "#F1F5F9"; ik = "log-out"; alt = `${saat(g.giris)} – ${saat(g.cikis)}`;
  } else if (isGunuMu(new Date())) {
    kod = "gelmedi"; etiket = "Henüz giriş yok"; renk = "#94A3B8"; acik = "#F8FAFC"; ik = "clock";
    if (izin) { alt = `${izinGorunum(izin.tur).ad} talebi onay bekliyor`; }
  } else {
    kod = "tatil"; etiket = "Hafta sonu"; renk = "#94A3B8"; acik = "#F8FAFC"; ik = "sun";
  }
  // bu hafta
  let hafta = 0;
  const haftaKayit = pnl.puantaj.filter(k => kucuk(k.personelEmail) === p.email);
  const gunler = {};
  haftaKayit.forEach(k => { (gunler[k.tarih] = gunler[k.tarih] || []).push(k); });
  for (const [kod2, l] of Object.entries(gunler)) hafta += gunuHesapla(l, kod2 === bugun).calisma;
  return { kod, etiket, alt, renk, acik, ikon: ik, bugun: g, hafta, izin, katilim: pnl.katilim.get(p.email) };
}

function kisiAdi(p) { return p.adSoyad || [p.ad, p.soyad].filter(Boolean).join(" ") || p.email; }
function basHarf(p) { return kisiAdi(p).split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toLocaleUpperCase("tr"); }
function rolAdi(p) {
  const r = { kurucu_mudur: "Kurucu Müdür", mudur: "Müdür", egitim_koordinator: "Eğitim Koordinatörü", muhasebe: "Muhasebe",
    ogretmen: "Sınıf Öğretmeni", yardimci_ogretmen: "Yardımcı Öğretmen", ingilizce_ogretmeni: "İngilizce Öğretmeni",
    degerler_ogretmeni: "Değerler Öğretmeni", orman_ogretmeni: "Orman Öğretmeni", brans_ogretmeni: "Branş Öğretmeni",
    danisma: "Danışma", pdr: "PDR Uzmanı", asci: "Aşçı", temizlik: "Temizlik" };
  return p.unvan || r[p.rol] || p.rol || "Personel";
}

function ciz() {
  if (!pnl) return;
  const kap = pnl.kap;
  const liste = pnl.personeller.map(p => ({ p, d: kisiDurumu(p) }));
  const say = (k) => liste.filter(x => x.d.kod === k).length;
  const bekleyenTalep = pnl.izinler.filter(v => izinDurumKodu(v.durum) === "bekliyor").length;
  const f = pnl.filtre;
  let gorunen = liste;
  if (f.ara) { const q = f.ara.toLocaleLowerCase("tr"); gorunen = gorunen.filter(x => `${kisiAdi(x.p)} ${rolAdi(x.p)} ${x.p.email}`.toLocaleLowerCase("tr").includes(q)); }
  if (f.rol) gorunen = gorunen.filter(x => x.p.rol === f.rol);
  if (f.durum) gorunen = gorunen.filter(x => x.d.kod === f.durum);
  const sira = { iceride: 0, molada: 1, izin: 2, gelmedi: 3, cikti: 4, tatil: 5 };
  gorunen.sort((a, b) => (sira[a.d.kod] - sira[b.d.kod]) || kisiAdi(a.p).localeCompare(kisiAdi(b.p), "tr"));
  const roller = [...new Set(pnl.personeller.map(p => p.rol).filter(Boolean))];
  const odak = document.activeElement && kap.contains(document.activeElement) ? document.activeElement.dataset.poFiltre : null;
  if (odak === "rol" || odak === "durum") return cizPlanla();

  const kutu = (kod, ad, sayi, ik, renk) => `<button type="button" class="po-kutu${f.durum === kod ? " po-kutu-secili" : ""}" data-po-durum="${kod}" style="--po-renk:${renk}">
      <span class="po-kutu-ikon">${ikon(ik, 18)}</span><span class="po-kutu-sayi">${sayi}</span><span class="po-kutu-ad">${ad}</span></button>`;

  kap.innerHTML = `
    <div class="po-kutular">
      ${kutu("iceride", "İçeride", say("iceride"), "log-in", "#15803D")}
      ${kutu("molada", "Molada", say("molada"), "coffee", "#B45309")}
      ${kutu("izin", "İzinli / raporlu", say("izin"), "calendar-off", "#7C3AED")}
      ${kutu("gelmedi", "Henüz giriş yok", say("gelmedi"), "clock", "#64748B")}
      ${kutu("cikti", "Çıktı", say("cikti"), "log-out", "#475569")}
    </div>
    ${bekleyenTalep ? `<button type="button" class="po-uyari" data-po-git="izin">${ikon("inbox", 16)}<span><strong>${bekleyenTalep} izin talebi</strong> onay bekliyor.</span><span class="po-uyari-git">İzin Talepleri ${ikon("chevron-right", 14)}</span></button>` : ""}
    <div class="po-arac">
      <label class="po-ara">${ikon("search", 16)}<input type="search" placeholder="Çalışan ara" value="${esc(f.ara)}" data-po-filtre="ara" aria-label="Çalışan ara"></label>
      <select data-po-filtre="rol" aria-label="Görev"><option value="">Tüm görevler</option>${roller.map(r => `<option value="${esc(r)}"${r === f.rol ? " selected" : ""}>${esc(rolAdi({ rol: r }))}</option>`).join("")}</select>
      ${f.durum ? `<button type="button" class="po-temizle" data-po-durum="">${ikon("x", 14)} Filtreyi kaldır</button>` : ""}
      <span class="po-canli"><span></span>Canlı · ${saat(new Date())}</span>
    </div>
    <div class="po-liste" role="list">
      ${gorunen.length ? gorunen.map(({ p, d }) => satirHtml(p, d)).join("") : `<div class="po-bos">Bu filtreye uyan çalışan yok.</div>`}
    </div>`;

  kap.querySelectorAll("[data-po-durum]").forEach(b => b.addEventListener("click", () => { pnl.filtre.durum = pnl.filtre.durum === b.dataset.poDurum ? "" : b.dataset.poDurum; ciz(); }));
  kap.querySelectorAll("[data-po-filtre]").forEach(el => el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => { pnl.filtre[el.dataset.poFiltre] = el.value; ciz(); }));
  kap.querySelectorAll("[data-po-kisi]").forEach(el => el.addEventListener("click", () => detayAc(el.dataset.poKisi)));
  kap.querySelector("[data-po-git]")?.addEventListener("click", () => window.ozlukSekme?.("izin"));
  if (odak === "ara") { const i = kap.querySelector('[data-po-filtre="ara"]'); i?.focus(); i?.setSelectionRange?.(i.value.length, i.value.length); }
  ikonlariCiz();
}

function satirHtml(p, d) {
  const hedef = 9 * 60;
  const oran = Math.min(100, Math.round((d.bugun.calisma / hedef) * 100));
  const k = d.katilim, son = tarihOku(k?.sonGorulme);
  return `<button type="button" class="po-satir" role="listitem" data-po-kisi="${esc(p.email)}" style="--po-renk:${d.renk};--po-acik:${d.acik}">
    <span class="po-avatar">${esc(basHarf(p))}</span>
    <span class="po-kim"><span class="po-ad">${esc(kisiAdi(p))}</span><span class="po-rol">${esc(rolAdi(p))}</span></span>
    <span class="po-durum"><span class="po-rozet">${ikon(d.ikon, 14)}${esc(d.etiket)}</span>${d.alt ? `<span class="po-durum-alt">${esc(d.alt)}</span>` : ""}</span>
    <span class="po-sure"><span class="po-sure-ust"><strong>${d.bugun.calisma ? kisaSure(d.bugun.calisma) : "—"}</strong> bugün</span>
      <span class="po-cubuk"><span style="width:${oran}%"></span></span>
      <span class="po-sure-alt">Bu hafta ${kisaSure(d.hafta)} sa${d.bugun.mola ? ` · mola ${Math.round(d.bugun.mola)} dk` : ""}</span></span>
    <span class="po-uyg">${pnl.katilimIzni && yonetimMi() ? `${ikon("smartphone", 14)}<span>${esc(son ? goreceZaman(son) : "Kayıt yok")}</span>` : ""}</span>
    <span class="po-ok">${ikon("chevron-right", 18)}</span>
  </button>`;
}

// ═════════════════════════ AYRINTI ═════════════════════════
let dty = null;

async function detayAc(email) {
  const p = pnl?.personeller.find(x => x.email === email);
  if (!p) return;
  detayKapat();
  const kok = document.createElement("div");
  kok.className = "po-arka";
  kok.innerHTML = `<aside class="po-cekmece" role="dialog" aria-modal="true" aria-label="${esc(kisiAdi(p))} özlük ayrıntısı">
    <div class="po-bos"><span class="po-donen"></span>Kayıtlar yükleniyor</div></aside>`;
  document.body.appendChild(kok);
  dty = { kok, p, sekme: "ozet", ay: new Date(new Date().getFullYear(), new Date().getMonth(), 1), grafik: "gun",
          hafta: haftaBasi(new Date()), puantaj: [], bordro: [], akis: [], tasma: document.body.style.overflow };
  document.body.style.overflow = "hidden";
  kok.addEventListener("click", e => { if (e.target === kok) detayKapat(); });
  document.addEventListener("keydown", detayTus, true);
  const benim = dty;
  const { db, fb } = P();
  const [pu, bo, ak] = await Promise.allSettled([
    fb.getDocs(fb.query(fb.collection(db, "puantaj"), fb.where("personelEmail", "==", p.email))),
    fb.getDocs(fb.query(fb.collection(db, "bordrolar"), fb.where("personelEmail", "==", p.email))),
    yonetimMi() ? fb.getDocs(fb.query(fb.collection(db, "personelKatilimAkisi"),
      fb.where(fb.documentId(), ">=", `${p.email}__`), fb.where(fb.documentId(), "<", `${p.email}__\uf8ff`),
      fb.orderBy(fb.documentId(), "desc"), fb.limit(400))) : Promise.reject(new Error("yetki"))
  ]);
  if (dty !== benim) return;
  if (pu.status === "fulfilled") dty.puantaj = pu.value.docs.map(d => d.data());
  if (bo.status === "fulfilled") dty.bordro = bo.value.docs.map(d => d.data());
  if (ak.status === "fulfilled") dty.akis = ak.value.docs.map(d => d.data());
  dty.akisIzni = ak.status === "fulfilled";
  detayCiz();
}
function detayTus(e) { if (e.key === "Escape") { e.preventDefault(); detayKapat(); } }
function detayKapat() {
  if (!dty) return;
  document.removeEventListener("keydown", detayTus, true);
  document.body.style.overflow = dty.tasma || "";
  dty.kok.remove(); dty = null;
}

function gunlukHaritasi(kayitlar) {
  const h = {};
  kayitlar.forEach(k => { if (k.tarih) (h[k.tarih] = h[k.tarih] || []).push(k); });
  const bugun = gunKodu(new Date());
  const sonuc = {};
  for (const [kod, l] of Object.entries(h)) sonuc[kod] = gunuHesapla(l, kod === bugun);
  return sonuc;
}

function detayCiz() {
  if (!dty) return;
  const { p } = dty;
  const d = kisiDurumu(p);
  const gunler = gunlukHaritasi(dty.puantaj);
  const izinler = pnl.izinler.filter(v => kucuk(v.personelEmail) === p.email);
  const sekmeler = [["ozet", "Özet", "layout-dashboard"], ["giris", "Giriş-Çıkış", "clock"], ["izin", "İzinler", "calendar-days"], ["hakedis", "Hak ediş", "wallet"]];
  if (yonetimMi()) sekmeler.push(["uygulama", "Uygulama", "smartphone"]);
  let govde = "";
  if (dty.sekme === "ozet") govde = ozetHtml(p, d, gunler, izinler);
  else if (dty.sekme === "giris") govde = girisHtml(gunler);
  else if (dty.sekme === "izin") govde = izinHtml(p, izinler);
  else if (dty.sekme === "hakedis") govde = hakedisHtml(p, gunler, izinler);
  else govde = uygulamaHtml(p);

  const cek = dty.kok.querySelector(".po-cekmece");
  cek.innerHTML = `
    <header class="po-c-bas" style="--po-renk:${d.renk};--po-acik:${d.acik}">
      <span class="po-avatar po-avatar-buyuk">${esc(basHarf(p))}</span>
      <div class="po-c-kim"><h3>${esc(kisiAdi(p))}</h3><p>${esc(rolAdi(p))}${p.iseBaslama ? ` · işe başlama ${esc(tarihYaz(tarihTen(p.iseBaslama), true))}` : ""}</p>
        <span class="po-rozet">${ikon(d.ikon, 14)}${esc(d.etiket)}${d.alt ? ` · ${esc(d.alt)}` : ""}</span></div>
      <button type="button" class="po-kapat" data-po-kapat aria-label="Kapat">${ikon("x", 20)}</button>
    </header>
    <nav class="po-sekmeler" role="tablist">${sekmeler.map(([k, a, i]) => `<button type="button" role="tab" aria-selected="${dty.sekme === k}" class="${dty.sekme === k ? "po-sekme-aktif" : ""}" data-po-sekme="${k}">${ikon(i, 15)}${a}</button>`).join("")}</nav>
    <div class="po-c-govde">${govde}</div>`;
  cek.querySelector("[data-po-kapat]").addEventListener("click", detayKapat);
  cek.querySelectorAll("[data-po-sekme]").forEach(b => b.addEventListener("click", () => { dty.sekme = b.dataset.poSekme; detayCiz(); }));
  cek.querySelectorAll("[data-po-ay]").forEach(b => b.addEventListener("click", () => { dty.ay = new Date(dty.ay.getFullYear(), dty.ay.getMonth() + Number(b.dataset.poAy), 1); detayCiz(); }));
  cek.querySelectorAll("[data-po-hafta]").forEach(b => b.addEventListener("click", () => { dty.hafta = gunEkle(dty.hafta, 7 * Number(b.dataset.poHafta)); detayCiz(); }));
  cek.querySelectorAll("[data-po-grafik]").forEach(b => b.addEventListener("click", () => { dty.grafik = b.dataset.poGrafik; detayCiz(); }));
  cek.querySelectorAll("[data-po-gun]").forEach(b => b.addEventListener("click", () => { dty.hafta = haftaBasi(tarihTen(b.dataset.poGun)); dty.sekme = "giris"; detayCiz(); }));
  ikonlariCiz();
}

// ── Özet: takvim + göstergeler ──
function ayGunleri(ay) {
  const son = new Date(ay.getFullYear(), ay.getMonth() + 1, 0).getDate();
  return Array.from({ length: son }, (_, i) => new Date(ay.getFullYear(), ay.getMonth(), i + 1));
}
function gunSinifi(kod, gunler, izinler) {
  const t = tarihTen(kod), bugun = gunKodu(new Date());
  const izin = gunIzni(izinler, kod);
  const g = gunler[kod];
  if (izin && !(g && g.calisma > 0)) {
    const gor = izinGorunum(izin.tur), onayli = izinDurumKodu(izin.durum) === "onaylandi";
    return { tur: "izin", gor, onayli, izin, g };
  }
  if (g && (g.calisma > 0 || g.kayitlar.length)) return { tur: "calisti", g, izin };
  if (!isGunuMu(t)) return { tur: "haftasonu" };
  if (kod > bugun) return { tur: "gelecek" };
  if (kod === bugun) return { tur: "bugun" };
  return { tur: "kayityok" };
}

function takvimHtml(gunler, izinler) {
  const ay = dty.ay, liste = ayGunleri(ay);
  const bosluk = (liste[0].getDay() + 6) % 7;
  const bugun = gunKodu(new Date());
  const hucreler = liste.map(t => {
    const kod = gunKodu(t), s = gunSinifi(kod, gunler, izinler);
    let stil = "", ic = "", baslik = `${tarihYaz(t)} ${GUN_UZUN[t.getDay()]}`;
    if (s.tur === "izin") {
      stil = `--po-renk:${s.gor.renk};--po-acik:${s.gor.acik}`;
      ic = `<span class="po-g-ikon">${ikon(s.gor.ikon, 13)}</span>`;
      baslik += ` · ${s.gor.ad}${s.onayli ? "" : " (onay bekliyor)"}`;
    } else if (s.tur === "calisti") {
      const o = Math.min(1, s.g.calisma / 540);
      stil = `--po-yogun:${(0.18 + o * 0.62).toFixed(2)}`;
      ic = `<span class="po-g-sure">${s.g.calisma ? kisaSure(s.g.calisma) : "—"}</span>`;
      baslik += ` · ${saatDk(s.g.calisma)} çalışma${s.g.mola ? `, ${Math.round(s.g.mola)} dk mola` : ""}${s.g.eksikCikis ? " · çıkış kaydı eksik" : ""}`;
    } else if (s.tur === "kayityok") baslik += " · kayıt yok";
    const sinif = ["po-gun", `po-g-${s.tur}`, s.tur === "izin" && !s.onayli ? "po-g-bekliyor" : "", s.g?.eksikCikis ? "po-g-eksik" : "", kod === bugun ? "po-g-bugun" : ""].filter(Boolean).join(" ");
    const tik = s.tur === "calisti" || s.tur === "bugun";
    return `<${tik ? `button type="button" data-po-gun="${kod}"` : "div"} class="${sinif}" style="${stil}" title="${esc(baslik)}">
      <span class="po-g-no">${t.getDate()}</span>${ic}</${tik ? "button" : "div"}>`;
  });
  const kullanilanTurler = new Set();
  liste.forEach(t => { const s = gunSinifi(gunKodu(t), gunler, izinler); if (s.tur === "izin") kullanilanTurler.add(izinTurKodu(s.izin.tur)); });
  const lejant = [`<span><i class="po-l" style="background:${CALISMA}"></i>Çalıştı</span>`,
    ...[...kullanilanTurler].map(k => { const g = izinGorunum(k); return `<span><i class="po-l" style="background:${g.renk}"></i>${esc(g.ad)}</span>`; }),
    `<span><i class="po-l po-l-eksik"></i>Çıkış eksik</span>`, `<span><i class="po-l po-l-yok"></i>Kayıt yok</span>`];
  return `<section class="po-bolum">
    <div class="po-bolum-bas"><h4>${AYLAR[ay.getMonth()]} ${ay.getFullYear()}</h4>
      <div class="po-gezin"><button type="button" data-po-ay="-1" aria-label="Önceki ay">${ikon("chevron-left", 16)}</button><button type="button" data-po-ay="1" aria-label="Sonraki ay">${ikon("chevron-right", 16)}</button></div></div>
    <div class="po-takvim">${GUN_KISA.slice(1).concat(GUN_KISA[0]).map(g => `<span class="po-t-bas">${g}</span>`).join("")}${"<span></span>".repeat(bosluk)}${hucreler.join("")}</div>
    <div class="po-lejant">${lejant.join("")}</div></section>`;
}

function ayMetrik(gunler, izinler, ay) {
  let calisma = 0, mola = 0, gun = 0, eksik = 0, girisler = [], cikislar = [];
  const izinGun = {};
  for (const t of ayGunleri(ay)) {
    const kod = gunKodu(t);
    if (kod > gunKodu(new Date())) break;
    const s = gunSinifi(kod, gunler, izinler);
    if (s.tur === "calisti") {
      calisma += s.g.calisma; mola += s.g.mola; gun++;
      if (s.g.eksikCikis) eksik++;
      if (s.g.giris) girisler.push(s.g.giris.getHours() * 60 + s.g.giris.getMinutes());
      if (s.g.cikis) cikislar.push(s.g.cikis.getHours() * 60 + s.g.cikis.getMinutes());
    } else if (s.tur === "izin" && s.onayli && isGunuMu(t)) {
      const k = izinTurKodu(s.izin.tur); izinGun[k] = (izinGun[k] || 0) + 1;
    }
  }
  const ort = (l) => l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : null;
  const dkSaat = (dk) => dk == null ? "—" : `${String(Math.floor(dk / 60)).padStart(2, "0")}:${String(dk % 60).padStart(2, "0")}`;
  return { calisma, mola, gun, eksik, ortGiris: dkSaat(ort(girisler)), ortCikis: dkSaat(ort(cikislar)), izinGun };
}

function gosterge(baslik, deger, alt = "", ik = "") {
  return `<div class="po-gosterge">${ik ? `<span class="po-gosterge-ikon">${ikon(ik, 16)}</span>` : ""}<span class="po-gosterge-bas">${esc(baslik)}</span><strong>${deger}</strong>${alt ? `<span class="po-gosterge-alt">${esc(alt)}</span>` : ""}</div>`;
}

function ozetHtml(p, d, gunler, izinler) {
  const m = ayMetrik(gunler, izinler, dty.ay);
  const suren = izinler.map(v => ({ v, b: izinBitisi(v) })).filter(x => x.b && izinDurumKodu(x.v.durum) === "onaylandi"
    && gunKodu(new Date()) >= izinAraligi(x.v).bas && gunKodu(new Date()) <= izinAraligi(x.v).bit);
  const uyari = suren.map(({ v, b }) => { const g = izinGorunum(v.tur); return `<div class="po-suren" style="--po-renk:${g.renk};--po-acik:${g.acik}">
      <span class="po-suren-ikon">${ikon(g.ikon, 20)}</span>
      <div><strong>${esc(g.ad)} sürüyor</strong><span>${esc(tarihYaz(tarihTen(izinAraligi(v).bas)))} – ${esc(tarihYaz(b.bit))} · ${b.kalan <= 1 ? "bugün bitiyor" : `${b.kalan} gün kaldı`}</span></div>
      <div class="po-suren-donus"><span>İşe dönüş</span><strong>${esc(tarihYaz(b.donus))} ${GUN_UZUN[b.donus.getDay()]}</strong></div></div>`; }).join("");
  return `${uyari}
    <div class="po-gostergeler">
      ${gosterge("Bu ay çalışılan", saatDk(m.calisma), `${m.gun} gün`, "briefcase")}
      ${gosterge("Ortalama giriş", m.ortGiris, "", "log-in")}
      ${gosterge("Ortalama çıkış", m.ortCikis, "", "log-out")}
      ${gosterge("Toplam mola", saatDk(m.mola), m.gun ? `günde ort. ${Math.round(m.mola / m.gun)} dk` : "", "coffee")}
    </div>
    ${takvimHtml(gunler, izinler)}
    ${m.eksik ? `<div class="po-not">${ikon("triangle-alert", 16)}<span>Bu ay ${m.eksik} gün çıkış kaydı eksik. Günün üstüne tıklayıp Giriş-Çıkış sekmesinde görebilirsiniz; düzeltme için <strong>Çıkış Düzeltme</strong> sekmesini kullanın.</span></div>` : ""}`;
}

// ── Giriş-Çıkış: grafik + zaman çizelgesi + kayıtlar ──
function cubukGrafik(veri, birim = "sa") {
  const enCok = Math.max(1, ...veri.map(v => v.deger));
  const G = 560, Y = 170, alt = 26, ust = 18, gen = G / veri.length;
  const cubuk = Math.min(38, gen * 0.62);
  const hedefCizgi = veri[0]?.hedef ? Y - alt - ((veri[0].hedef / enCok) * (Y - alt - ust)) : null;
  return `<svg class="po-grafik" viewBox="0 0 ${G} ${Y}" role="img" aria-label="Çalışma süresi grafiği">
    ${hedefCizgi != null && veri[0].hedef <= enCok ? `<line x1="0" x2="${G}" y1="${hedefCizgi}" y2="${hedefCizgi}" class="po-hedef"/>` : ""}
    ${veri.map((v, i) => {
      const h = Math.max(v.deger ? 3 : 0, (v.deger / enCok) * (Y - alt - ust));
      const x = i * gen + (gen - cubuk) / 2, y = Y - alt - h;
      return `<g><title>${esc(v.baslik)}: ${v.deger.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${birim}</title>
        ${v.izin ? `<rect x="${x}" y="${ust}" width="${cubuk}" height="${Y - alt - ust}" rx="6" fill="${v.izin.acik}"/>` : ""}
        <rect x="${x}" y="${y}" width="${cubuk}" height="${h}" rx="6" fill="${v.vurgu ? CALISMA : "#9DBFA8"}"/>
        ${v.deger ? `<text x="${x + cubuk / 2}" y="${y - 5}" text-anchor="middle" class="po-g-deger">${v.deger.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</text>` : ""}
        <text x="${x + cubuk / 2}" y="${Y - 8}" text-anchor="middle" class="po-g-etiket">${esc(v.etiket)}</text></g>`;
    }).join("")}
  </svg>`;
}

function grafikVerisi(gunler, izinler) {
  const bugun = new Date();
  if (dty.grafik === "gun") {
    return Array.from({ length: 14 }, (_, i) => {
      const t = gunEkle(bugun, i - 13), kod = gunKodu(t), g = gunler[kod], iz = gunIzni(izinler, kod);
      const izOn = iz && izinDurumKodu(iz.durum) === "onaylandi" ? izinGorunum(iz.tur) : null;
      return { etiket: i === 13 ? "Bugün" : `${GUN_KISA[t.getDay()]} ${t.getDate()}`, baslik: `${tarihYaz(t)}${izOn ? " · " + izOn.ad : ""}`,
               deger: g ? +(g.calisma / 60).toFixed(1) : 0, vurgu: i === 13, izin: izOn, hedef: 9 };
    });
  }
  if (dty.grafik === "hafta") {
    return Array.from({ length: 8 }, (_, i) => {
      const bas = gunEkle(haftaBasi(bugun), (i - 7) * 7);
      let dk = 0; for (let j = 0; j < 7; j++) { const g = gunler[gunKodu(gunEkle(bas, j))]; if (g) dk += g.calisma; }
      return { etiket: `${bas.getDate()} ${AY_KISA[bas.getMonth()]}`, baslik: `${tarihYaz(bas)} haftası`, deger: +(dk / 60).toFixed(1), vurgu: i === 7, hedef: 45 };
    });
  }
  return Array.from({ length: 6 }, (_, i) => {
    const ay = new Date(bugun.getFullYear(), bugun.getMonth() - 5 + i, 1);
    let dk = 0; for (const t of ayGunleri(ay)) { const g = gunler[gunKodu(t)]; if (g) dk += g.calisma; }
    return { etiket: AY_KISA[ay.getMonth()], baslik: `${AYLAR[ay.getMonth()]} ${ay.getFullYear()}`, deger: Math.round(dk / 60), vurgu: i === 5 };
  });
}

function cizelgeHtml(gunler, izinler) {
  const BAS = 7 * 60, BIT = 20 * 60, ARALIK = BIT - BAS;
  const yuzde = (t) => Math.max(0, Math.min(100, ((t.getHours() * 60 + t.getMinutes() - BAS) / ARALIK) * 100));
  const satirlar = Array.from({ length: 7 }, (_, i) => {
    const t = gunEkle(dty.hafta, i), kod = gunKodu(t), g = gunler[kod], iz = gunIzni(izinler, kod);
    let cubuk = "", bilgi = "";
    if (g && g.dilimler.length) {
      cubuk = g.dilimler.map(d => `<span class="po-dilim po-dilim-${d.tur}${d.acik ? " po-dilim-acik" : ""}" style="left:${yuzde(d.bas)}%;width:${Math.max(0.6, yuzde(d.bit) - yuzde(d.bas))}%" title="${d.tur === "mola" ? "Mola" : "Çalışma"} ${saat(d.bas)}–${d.acik ? "şimdi" : saat(d.bit)}"></span>`).join("");
      bilgi = `<span class="po-c-saat">${saat(g.giris)} – ${g.cikis ? saat(g.cikis) : g.acik ? "devam ediyor" : "çıkış yok"}</span><span class="po-c-top">${saatDk(g.calisma)}${g.mola ? ` · mola ${Math.round(g.mola)} dk` : ""}</span>`;
    } else if (iz) {
      const gor = izinGorunum(iz.tur);
      cubuk = `<span class="po-dilim-izin" style="--po-renk:${gor.renk};--po-acik:${gor.acik}">${ikon(gor.ikon, 13)} ${esc(gor.ad)}${izinDurumKodu(iz.durum) === "onaylandi" ? "" : " · onay bekliyor"}</span>`;
    } else {
      bilgi = `<span class="po-c-saat po-soluk">${isGunuMu(t) ? (kod > gunKodu(new Date()) ? "" : "Kayıt yok") : "Hafta sonu"}</span>`;
    }
    return `<div class="po-c-satir${g?.eksikCikis ? " po-c-eksik" : ""}">
      <span class="po-c-gun"><strong>${GUN_KISA[t.getDay()]}</strong> ${t.getDate()} ${AY_KISA[t.getMonth()]}</span>
      <span class="po-c-serit">${cubuk}</span><span class="po-c-bilgi">${bilgi}</span></div>`;
  }).join("");
  const olcek = [7, 9, 11, 13, 15, 17, 19].map(h => `<span style="left:${((h * 60 - BAS) / ARALIK) * 100}%">${String(h).padStart(2, "0")}</span>`).join("");
  return `<div class="po-cizelge"><div class="po-c-olcek"><span class="po-c-gun"></span><span class="po-c-serit">${olcek}</span><span class="po-c-bilgi"></span></div>${satirlar}</div>`;
}

function girisHtml(gunler) {
  const izinler = pnl.izinler.filter(v => kucuk(v.personelEmail) === dty.p.email);
  const hbit = gunEkle(dty.hafta, 6);
  const haftaKayit = Object.entries(gunler).filter(([k]) => k >= gunKodu(dty.hafta) && k <= gunKodu(hbit))
    .sort((a, b) => b[0].localeCompare(a[0]));
  const tipAd = { giris: ["Giriş", "log-in", "#15803D"], cikis: ["Çıkış", "log-out", "#B91C1C"], "mola-basla": ["Mola başladı", "coffee", "#B45309"], "mola-bitir": ["Mola bitti", "coffee", "#1D4ED8"] };
  const kayitlar = haftaKayit.flatMap(([kod, g]) => g.kayitlar.map(k => ({ kod, k })));
  return `<section class="po-bolum">
      <div class="po-bolum-bas"><h4>Çalışma süresi</h4>
        <div class="po-secici">${[["gun", "Günlük"], ["hafta", "Haftalık"], ["ay", "Aylık"]].map(([k, a]) => `<button type="button" data-po-grafik="${k}" class="${dty.grafik === k ? "po-secili" : ""}">${a}</button>`).join("")}</div></div>
      ${cubukGrafik(grafikVerisi(gunler, izinler))}
      <div class="po-lejant"><span><i class="po-l" style="background:${CALISMA}"></i>Çalışma (saat)</span>${dty.grafik !== "ay" ? `<span><i class="po-l po-l-hedef"></i>Hedef: ${dty.grafik === "gun" ? "günde 9" : "haftada 45"} saat</span>` : ""}<span><i class="po-l" style="background:#FDE7C4"></i>İzinli gün</span></div>
    </section>
    <section class="po-bolum">
      <div class="po-bolum-bas"><h4>Günlük akış · ${esc(tarihYaz(dty.hafta))} – ${esc(tarihYaz(hbit))}</h4>
        <div class="po-gezin"><button type="button" data-po-hafta="-1" aria-label="Önceki hafta">${ikon("chevron-left", 16)}</button><button type="button" data-po-hafta="1" aria-label="Sonraki hafta">${ikon("chevron-right", 16)}</button></div></div>
      ${cizelgeHtml(gunler, izinler)}
      <div class="po-lejant"><span><i class="po-l" style="background:${CALISMA}"></i>Çalışma</span><span><i class="po-l" style="background:${MOLA}"></i>Mola</span><span><i class="po-l po-l-acik"></i>Devam ediyor</span></div>
    </section>
    <section class="po-bolum">
      <div class="po-bolum-bas"><h4>Bu haftanın kayıtları</h4></div>
      ${kayitlar.length ? `<div class="po-kayitlar">${kayitlar.map(({ kod, k }) => { const [a, i, r] = tipAd[k.tip] || [k.tip, "dot", "#64748B"];
        return `<div class="po-kayit"><span class="po-kayit-ikon" style="color:${r}">${ikon(i, 15)}</span><span class="po-kayit-ad">${esc(a)}</span>
          <span class="po-kayit-zaman">${GUN_KISA[tarihTen(kod).getDay()]} ${tarihTen(kod).getDate()} ${AY_KISA[tarihTen(kod).getMonth()]} · <strong>${saat(k._t)}</strong></span>
          <span class="po-kayit-yontem">${esc(k.yontem === "duzeltme" ? "düzeltme" : k.yontem || "")}</span></div>`; }).join("")}</div>`
        : `<div class="po-bos po-bos-kucuk">Bu hafta giriş-çıkış kaydı yok.</div>`}
    </section>`;
}

// ── İzinler ──
function izinSatiri(v, a) {
  if (!a) return izinSureOzeti(v);
  const tarih = `${tarihYaz(tarihTen(a.bas))}${a.bit !== a.bas ? ` – ${tarihYaz(tarihTen(a.bit))}` : ""}`;
  if (IZIN_TURLERI[izinTurKodu(v.tur)]?.sureTipi === "saatlik") {
    const sa = v.baslangicSaat && v.bitisSaat ? ` · ${v.baslangicSaat}–${v.bitisSaat}` : "";
    const ozet = izinSureOzeti(v).split(" · ").pop();
    return `${tarih}${sa}${/saat/.test(ozet) ? ` · ${ozet}` : ""}`;
  }
  return `${tarih} · ${izinSureOzeti(v)}`;
}
function izinHtml(p, izinler) {
  const hak = Number(p.yillikIzinHakki) || 14;
  const m = izinMetrikleri(izinler, hak);
  const cevre = 2 * Math.PI * 42, kullanildi = Math.min(1, m.kullanilan / (m.toplam || 1)), bekleyen = Math.min(1 - kullanildi, m.bekleyen / (m.toplam || 1));
  const sirali = [...izinler].sort((a, b) => String(b.baslangic || "").localeCompare(String(a.baslangic || "")));
  const durumAd = { onaylandi: ["Onaylandı", "#15803D", "#DCFCE7"], bekliyor: ["Onay bekliyor", "#B45309", "#FEF3C7"], reddedildi: ["Reddedildi", "#B91C1C", "#FEE2E2"], iptal: ["İptal", "#64748B", "#F1F5F9"] };
  return `<section class="po-bolum po-hak">
      <svg viewBox="0 0 100 100" class="po-halka" role="img" aria-label="Yıllık izin kullanımı">
        <circle cx="50" cy="50" r="42" class="po-halka-zemin"/>
        <circle cx="50" cy="50" r="42" class="po-halka-kul" stroke-dasharray="${cevre * kullanildi} ${cevre}" transform="rotate(-90 50 50)"/>
        <circle cx="50" cy="50" r="42" class="po-halka-bek" stroke-dasharray="${cevre * bekleyen} ${cevre}" stroke-dashoffset="${-cevre * kullanildi}" transform="rotate(-90 50 50)"/>
        <text x="50" y="49" text-anchor="middle" class="po-halka-sayi">${m.kalan}</text><text x="50" y="63" text-anchor="middle" class="po-halka-yazi">gün kaldı</text>
      </svg>
      <div class="po-hak-bilgi">
        <h4>Yıllık izin hakkı</h4>
        <div class="po-hak-satir"><span><i class="po-l" style="background:#E2E8F0"></i>Toplam hak</span><strong>${m.toplam} gün</strong></div>
        <div class="po-hak-satir"><span><i class="po-l" style="background:${IZIN_GORUNUM.yillik.renk}"></i>Kullanılan</span><strong>${m.kullanilan} gün</strong></div>
        <div class="po-hak-satir"><span><i class="po-l" style="background:#F2C94C"></i>Onay bekleyen</span><strong>${m.bekleyen} gün</strong></div>
        <div class="po-hak-satir"><span><i class="po-l" style="background:${IZIN_GORUNUM.rapor.renk}"></i>Sağlık raporu (hakdan düşmez)</span><strong>${m.raporGun} gün</strong></div>
      </div>
    </section>
    <section class="po-bolum">
      <div class="po-bolum-bas"><h4>İzin geçmişi</h4></div>
      ${sirali.length ? `<div class="po-izinler">${sirali.map(v => {
        const g = izinGorunum(v.tur), dk = durumAd[izinDurumKodu(v.durum)] || durumAd.bekliyor, a = izinAraligi(v), b = izinBitisi(v);
        const bugun = gunKodu(new Date()), surer = a && bugun >= a.bas && bugun <= a.bit && izinDurumKodu(v.durum) === "onaylandi";
        return `<div class="po-izin" style="--po-renk:${g.renk};--po-acik:${g.acik}">
          <span class="po-izin-ikon">${ikon(g.ikon, 18)}</span>
          <div class="po-izin-bilgi"><strong>${esc(g.ad)}</strong>
            <span>${esc(izinSatiri(v, a))}</span>
            ${surer && b ? `<span class="po-izin-surer">${ikon("hourglass", 13)} Sürüyor · ${b.kalan <= 1 ? "bugün bitiyor" : `${b.kalan} gün kaldı`} · dönüş ${esc(tarihYaz(b.donus))}</span>` : ""}
            ${v.aciklama ? `<span class="po-izin-not">${esc(v.aciklama)}</span>` : ""}</div>
          <span class="po-izin-durum" style="color:${dk[1]};background:${dk[2]}">${dk[0]}</span>
          ${v.belgeUrl ? `<a class="po-izin-belge" href="${esc(v.belgeUrl)}" target="_blank" rel="noopener" aria-label="Belgeyi aç">${ikon("paperclip", 16)}</a>` : ""}
        </div>`; }).join("")}</div>` : `<div class="po-bos po-bos-kucuk">İzin kaydı yok.</div>`}
    </section>`;
}

// ── Hak ediş ──
function hakedisHtml(p, gunler, izinler) {
  const ay = dty.ay;
  const liste = ayGunleri(ay), bugunKod = gunKodu(new Date());
  let isGunu = 0, gecen = 0, calisilan = 0, ucretli = 0, ucretsiz = 0, rapor = 0, eksik = 0, kayityok = 0, dk = 0;
  for (const t of liste) {
    if (!isGunuMu(t)) continue;
    isGunu++;
    const kod = gunKodu(t);
    if (kod > bugunKod) continue;
    gecen++;
    const s = gunSinifi(kod, gunler, izinler);
    if (s.tur === "calisti") { calisilan++; dk += s.g.calisma; if (s.g.eksikCikis) eksik++; }
    else if (s.tur === "izin" && s.onayli) { if (s.gor.rapor) rapor++; else if (s.gor.ucretli) ucretli++; else ucretsiz++; }
    else if (s.tur === "kayityok") kayityok++;
  }
  const donem = `${ay.getFullYear()}-${String(ay.getMonth() + 1).padStart(2, "0")}`;
  const bordro = dty.bordro.find(b => String(b.donem || b.ay || "").startsWith(donem));
  const para = (n) => Number(n) ? Number(n).toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }) : "—";
  const satir = (ad, deger, renk, ik) => `<div class="po-hd-satir"><span>${ik ? ikon(ik, 15) : ""}<i class="po-l" style="background:${renk}"></i>${ad}</span><strong>${deger}</strong></div>`;
  return `<section class="po-bolum">
      <div class="po-bolum-bas"><h4>${AYLAR[ay.getMonth()]} ${ay.getFullYear()} gün dökümü</h4>
        <div class="po-gezin"><button type="button" data-po-ay="-1" aria-label="Önceki ay">${ikon("chevron-left", 16)}</button><button type="button" data-po-ay="1" aria-label="Sonraki ay">${ikon("chevron-right", 16)}</button></div></div>
      <div class="po-gostergeler">
        ${gosterge("İş günü", `${gecen} / ${isGunu}`, "geçen / aydaki", "calendar")}
        ${gosterge("Çalışılan", `${calisilan} gün`, saatDk(dk), "briefcase")}
        ${gosterge("Günlük ortalama", calisilan ? saatDk(dk / calisilan) : "—", "", "gauge")}
      </div>
      <div class="po-hd">
        ${satir("Çalışılan gün", calisilan, CALISMA, "briefcase")}
        ${satir("Ücretli izin (yıllık, mazeret, doğum…)", ucretli, IZIN_GORUNUM.yillik.renk, "palmtree")}
        ${satir("Sağlık raporu", rapor, IZIN_GORUNUM.rapor.renk, "briefcase-medical")}
        ${satir("Ücretsiz izin", ucretsiz, IZIN_GORUNUM.ucretsiz.renk, "wallet")}
        ${satir("Kaydı olmayan iş günü", kayityok, "#CBD5E1", "circle-help")}
        ${eksik ? satir("Çıkış kaydı eksik gün", eksik, "#F59E0B", "triangle-alert") : ""}
      </div>
      <p class="po-dipnot">Sağlık raporu ve ücretsiz izin günleri bordroda ayrıca değerlendirilir. Resmî tatiller bu dökümde ayrıca işaretlenmez.</p>
    </section>
    <section class="po-bolum">
      <div class="po-bolum-bas"><h4>Bordro</h4></div>
      ${bordro ? `<div class="po-hd">
          ${satir("Net ödeme", para(bordro.netMaas), CALISMA, "banknote")}
          ${bordro.brutMaas ? satir("Brüt", para(bordro.brutMaas), "#94A3B8", "receipt") : ""}
          ${satir("Durum", bordro.durum === "odendi" || bordro.odendi ? "Ödendi" : "Ödeme bekliyor", bordro.durum === "odendi" || bordro.odendi ? "#15803D" : "#D97706", "badge-check")}
        </div>` : `<div class="po-bos po-bos-kucuk">${AYLAR[ay.getMonth()]} için bordro kaydı yok ya da görme yetkiniz yok.</div>`}
    </section>`;
}

// ── Uygulama kullanımı ──
function uygulamaHtml(p) {
  const oz = pnl.katilim.get(p.email) || {};
  if (!dty.akisIzni && !pnl.katilimIzni) return `<div class="po-not">${ikon("shield-alert", 16)}<span>Uygulama kullanım kayıtları için Firestore kuralı eklenmeli (PERSONEL KATILIMI bloğu).</span></div>`;
  const son = tarihOku(oz.sonGorulme), sonGiris = tarihOku(oz.sonGiris) || son;
  const gunler = oz.gunler || {};
  let giris30 = 0, gun30 = 0;
  for (let i = 0; i < 30; i++) { const n = Number(gunler[gunKodu(gunEkle(new Date(), -i))]) || 0; giris30 += n; if (n) gun30++; }
  // gün × saat ısı haritası (son 400 hareket)
  const isi = Array.from({ length: 7 }, () => Array(24).fill(0));
  dty.akis.forEach(h => { const t = tarihOku(h.zaman); if (t) isi[(t.getDay() + 6) % 7][t.getHours()]++; });
  const enCok = Math.max(1, ...isi.flat());
  const saatler = Array.from({ length: 15 }, (_, i) => i + 6);
  const ekranlar = Object.entries(oz.ekranlar || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const enCokEkran = ekranlar[0]?.[1] || 1;
  const uyg = oz.uygulamalar || {};
  return `<div class="po-gostergeler">
      ${gosterge("Son görülme", son ? goreceZaman(son) : "—", son ? `${tarihYaz(son)} ${saat(son)}` : "Kayıt yok", "eye")}
      ${gosterge("30 günde giriş", giris30, `${gun30} farklı gün`, "log-in")}
      ${gosterge("Toplam giriş", Number(oz.girisSayisi) || 0, [uyg.portal ? `Portal ${uyg.portal}` : "", uyg.zeky ? `ZEKY ${uyg.zeky}` : ""].filter(Boolean).join(" · ") || "", "smartphone")}
    </div>
    <section class="po-bolum">
      <div class="po-bolum-bas"><h4>Son 30 gün</h4></div>
      <div class="po-serit30">${Array.from({ length: 30 }, (_, i) => { const t = gunEkle(new Date(), i - 29); const n = Number(gunler[gunKodu(t)]) || 0;
        return `<span class="${n ? (n > 2 ? "po-s3" : n > 1 ? "po-s2" : "po-s1") : ""}" title="${tarihYaz(t)}: ${n} giriş"></span>`; }).join("")}</div>
    </section>
    <section class="po-bolum">
      <div class="po-bolum-bas"><h4>Hangi gün, hangi saatte</h4><span class="po-bolum-alt">Son ${dty.akis.length} hareket</span></div>
      ${dty.akis.length ? `<div class="po-isi" style="grid-template-columns:34px repeat(${saatler.length}, minmax(0,1fr))">
        <span></span>${saatler.map(h => `<span class="po-isi-saat">${h % 2 === 0 ? h : ""}</span>`).join("")}
        ${isi.map((satir, g) => `<span class="po-isi-gun">${GUN_KISA[(g + 1) % 7]}</span>${saatler.map(h => { const n = satir[h];
          return `<span class="po-isi-hucre" style="opacity:${n ? (0.18 + 0.82 * n / enCok).toFixed(2) : 1};${n ? "" : "background:var(--gray-100,#F1F2F7)"}" title="${GUN_UZUN[(g + 1) % 7]} ${String(h).padStart(2, "0")}:00 · ${n} hareket"></span>`; }).join("")}`).join("")}
      </div>` : `<div class="po-bos po-bos-kucuk">Henüz hareket kaydı yok. Kayıtlar çalışan portala girdikçe oluşur.</div>`}
    </section>
    <section class="po-bolum">
      <div class="po-bolum-bas"><h4>En çok açtığı bölümler</h4></div>
      ${ekranlar.length ? `<div class="po-bolumler">${ekranlar.map(([k, n]) => `<div class="po-bolum-sat"><span>${esc(bolumAdi(k))}</span><span class="po-b-cubuk"><span style="width:${Math.round(n / enCokEkran * 100)}%"></span></span><strong>${n}</strong></div>`).join("")}</div>`
        : `<div class="po-bos po-bos-kucuk">Bölüm kaydı yok.</div>`}
    </section>`;
}

// ═════════════════════════ STİL ═════════════════════════
function stilEkle() {
  if (document.getElementById("personelOzlukStil")) return;
  const st = document.createElement("style");
  st.id = "personelOzlukStil";
  st.textContent = `
.po-bos { display:flex; align-items:center; justify-content:center; gap:10px; padding:32px 16px; color:#64748B; font-size:14px; text-align:center; }
.po-bos-kucuk { padding:16px 8px; font-size:13px; }
.po-donen { width:16px; height:16px; border:2px solid #4A7C59; border-right-color:transparent; border-radius:50%; animation:poDon .8s linear infinite; }
@keyframes poDon { to { transform:rotate(360deg); } }
.po-kutular { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:10px; margin-bottom:12px; }
.po-kutu { display:grid; grid-template-columns:auto 1fr; grid-template-rows:auto auto; column-gap:10px; align-items:center; text-align:left; padding:12px 14px; border:1.5px solid #E2E8F0; border-radius:14px; background:#fff; cursor:pointer; font:inherit; color:#1E293B; transition:border-color .15s, box-shadow .15s; }
.po-kutu:hover { border-color:var(--po-renk); }
.po-kutu-secili { border-color:var(--po-renk); box-shadow:0 0 0 3px color-mix(in srgb, var(--po-renk) 18%, transparent); }
.po-kutu-ikon { grid-row:1 / span 2; width:38px; height:38px; border-radius:11px; display:grid; place-items:center; color:var(--po-renk); background:color-mix(in srgb, var(--po-renk) 12%, #fff); }
.po-kutu-sayi { font-size:22px; font-weight:800; line-height:1.1; font-variant-numeric:tabular-nums; }
.po-kutu-ad { font-size:12.5px; color:#64748B; font-weight:600; }
.po-uyari { display:flex; align-items:center; gap:10px; width:100%; margin-bottom:12px; padding:10px 14px; border-radius:12px; border:1px solid #F6D58E; background:#FFF8E8; color:#7A4B00; font:inherit; font-size:13.5px; cursor:pointer; text-align:left; }
.po-uyari-git { margin-left:auto; display:inline-flex; align-items:center; gap:4px; font-weight:700; white-space:nowrap; }
.po-arac { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
.po-ara { display:flex; align-items:center; gap:8px; flex:1; min-width:200px; max-width:340px; padding:0 12px; border:1.5px solid #E2E8F0; border-radius:10px; background:#fff; color:#94A3B8; }
.po-ara input { border:0; outline:0; flex:1; min-height:40px; font:inherit; font-size:14px; background:transparent; color:#1E293B; }
.po-arac select { min-height:42px; padding:8px 10px; border:1.5px solid #E2E8F0; border-radius:10px; background:#fff; font:inherit; font-size:14px; color:#1E293B; }
.po-temizle { display:inline-flex; align-items:center; gap:4px; min-height:40px; padding:8px 12px; border:0; border-radius:10px; background:#F1F5F9; color:#475569; font:inherit; font-size:13px; font-weight:600; cursor:pointer; }
.po-canli { margin-left:auto; display:inline-flex; align-items:center; gap:7px; font-size:12px; color:#64748B; }
.po-canli span { width:8px; height:8px; border-radius:50%; background:#16A34A; animation:poNabiz 2s infinite; }
@keyframes poNabiz { 0% { box-shadow:0 0 0 0 rgba(22,163,74,.45); } 70% { box-shadow:0 0 0 7px rgba(22,163,74,0); } 100% { box-shadow:0 0 0 0 rgba(22,163,74,0); } }
.po-liste { display:flex; flex-direction:column; gap:8px; }
.po-satir { display:grid; grid-template-columns:44px minmax(150px,1.3fr) minmax(170px,1.2fr) minmax(170px,1fr) minmax(110px,.7fr) 20px; align-items:center; gap:14px; width:100%; padding:12px 14px; border:1px solid #E8EDF2; border-left:4px solid var(--po-renk); border-radius:14px; background:#fff; font:inherit; color:inherit; text-align:left; cursor:pointer; transition:box-shadow .15s, transform .15s; }
.po-satir:hover { box-shadow:0 6px 18px rgba(30,41,59,.08); }
.po-satir:focus-visible { outline:3px solid #BFD8C7; outline-offset:2px; }
.po-avatar { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; background:#E8F3EC; color:#2D5E3E; font-weight:800; font-size:15px; flex-shrink:0; }
.po-avatar-buyuk { width:56px; height:56px; font-size:19px; }
.po-kim { display:flex; flex-direction:column; min-width:0; }
.po-ad { font-weight:700; font-size:14.5px; color:#1E293B; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.po-rol { font-size:12.5px; color:#64748B; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.po-durum { display:flex; flex-direction:column; gap:3px; min-width:0; }
.po-rozet { display:inline-flex; align-items:center; gap:6px; align-self:flex-start; padding:4px 10px; border-radius:999px; background:var(--po-acik); color:var(--po-renk); font-size:12.5px; font-weight:700; white-space:nowrap; }
.po-durum-alt { font-size:12px; color:#64748B; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.po-sure { display:flex; flex-direction:column; gap:4px; min-width:0; }
.po-sure-ust { font-size:12.5px; color:#64748B; } .po-sure-ust strong { font-size:15px; color:#1E293B; font-variant-numeric:tabular-nums; margin-right:2px; }
.po-cubuk { height:6px; border-radius:999px; background:#EEF2F0; overflow:hidden; } .po-cubuk span { display:block; height:100%; border-radius:999px; background:${CALISMA}; }
.po-sure-alt { font-size:11.5px; color:#94A3B8; }
.po-uyg { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748B; min-width:0; } .po-uyg span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.po-ok { color:#CBD5E1; }
.po-arka { position:fixed; inset:0; z-index:1060; background:rgba(15,23,42,.45); display:flex; justify-content:flex-end; animation:poAc .15s ease-out; }
@keyframes poAc { from { opacity:0; } to { opacity:1; } }
.po-cekmece { width:min(820px, 100%); height:100%; background:#F7F9F8; display:flex; flex-direction:column; box-shadow:-18px 0 40px rgba(15,23,42,.18); animation:poKay .2s ease-out; }
@keyframes poKay { from { transform:translateX(30px); } to { transform:none; } }
.po-c-bas { display:flex; align-items:center; gap:14px; padding:20px 22px 14px; background:#fff; border-bottom:1px solid #E8EDF2; flex-shrink:0; }
.po-c-kim { flex:1; min-width:0; } .po-c-kim h3 { margin:0; font-size:19px; font-weight:800; color:#1E293B; } .po-c-kim p { margin:2px 0 8px; font-size:13px; color:#64748B; }
.po-kapat { width:42px; height:42px; flex-shrink:0; border:0; border-radius:50%; background:rgba(15,23,42,.06); color:#475569; display:grid; place-items:center; cursor:pointer; }
.po-kapat:hover { background:rgba(15,23,42,.12); }
.po-sekmeler { display:flex; gap:4px; padding:0 18px; background:#fff; border-bottom:1px solid #E8EDF2; overflow-x:auto; flex-shrink:0; }
.po-sekmeler button { display:inline-flex; align-items:center; gap:7px; padding:12px 12px 11px; border:0; border-bottom:2.5px solid transparent; background:none; font:inherit; font-size:13.5px; font-weight:600; color:#64748B; cursor:pointer; white-space:nowrap; }
.po-sekmeler .po-sekme-aktif { color:#2D5E3E; border-bottom-color:#2D5E3E; }
.po-c-govde { flex:1; overflow-y:auto; padding:18px 22px 28px; display:flex; flex-direction:column; gap:14px; overscroll-behavior:contain; }
.po-bolum { background:#fff; border:1px solid #E8EDF2; border-radius:16px; padding:16px 18px; }
.po-bolum-bas { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
.po-bolum-bas h4 { margin:0; font-size:14.5px; font-weight:800; color:#1E293B; }
.po-bolum-alt { font-size:12px; color:#94A3B8; }
.po-gezin { display:flex; gap:6px; } .po-gezin button { width:34px; height:34px; border-radius:9px; border:1px solid #E2E8F0; background:#fff; display:grid; place-items:center; cursor:pointer; color:#475569; }
.po-secici { display:inline-flex; padding:3px; background:#F1F5F4; border-radius:10px; }
.po-secici button { padding:6px 12px; border:0; border-radius:8px; background:none; font:inherit; font-size:12.5px; font-weight:700; color:#64748B; cursor:pointer; }
.po-secici .po-secili { background:#fff; color:#2D5E3E; box-shadow:0 1px 3px rgba(15,23,42,.1); }
.po-gostergeler { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; }
.po-gosterge { display:flex; flex-direction:column; gap:2px; padding:12px 14px; background:#fff; border:1px solid #E8EDF2; border-radius:14px; position:relative; }
.po-bolum .po-gosterge { background:#FAFBFA; }
.po-gosterge-ikon { position:absolute; right:12px; top:12px; color:#9DBFA8; }
.po-gosterge-bas { font-size:12px; color:#64748B; font-weight:600; }
.po-gosterge strong { font-size:19px; color:#1E293B; font-variant-numeric:tabular-nums; }
.po-gosterge-alt { font-size:11.5px; color:#94A3B8; }
.po-takvim { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:5px; }
.po-t-bas { font-size:11.5px; font-weight:700; color:#94A3B8; text-align:center; padding-bottom:2px; }
.po-gun { position:relative; height:58px; border-radius:10px; border:1px solid #EEF2F0; background:#fff; display:flex; flex-direction:column; justify-content:space-between; padding:5px 6px; font:inherit; text-align:left; color:#334155; }
button.po-gun { cursor:pointer; } button.po-gun:hover { box-shadow:0 0 0 2px #BFD8C7; }
.po-g-no { font-size:12px; font-weight:700; }
.po-g-sure { font-size:11px; font-weight:700; font-variant-numeric:tabular-nums; align-self:flex-end; }
.po-g-calisti { background:rgba(74,124,89,var(--po-yogun)); border-color:transparent; color:#10301D; }
.po-g-izin { background:var(--po-acik); border-color:transparent; color:var(--po-renk); box-shadow:inset 0 -3px 0 var(--po-renk); }
.po-g-bekliyor { background:repeating-linear-gradient(135deg, var(--po-acik) 0 6px, #fff 6px 10px); box-shadow:inset 0 0 0 1.5px var(--po-renk); }
.po-g-ikon { align-self:flex-end; display:flex; }
.po-g-haftasonu { background:#F8FAFC; color:#CBD5E1; }
.po-g-kayityok { background:#FFF7F7; border-color:#FDE2E2; color:#B98B8B; }
.po-g-gelecek { color:#CBD5E1; }
.po-g-eksik { box-shadow:inset 0 0 0 2px #F59E0B; }
.po-g-bugun { outline:2px solid #2D5E3E; outline-offset:1px; }
.po-lejant { display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:10px; font-size:12px; color:#64748B; }
.po-lejant span { display:inline-flex; align-items:center; gap:6px; }
.po-l { display:inline-block; width:10px; height:10px; border-radius:3px; }
.po-l-eksik { box-shadow:inset 0 0 0 2px #F59E0B; background:#fff; }
.po-l-yok { background:#FFF7F7; box-shadow:inset 0 0 0 1px #FDE2E2; }
.po-l-hedef { height:0; width:14px; border-top:2px dashed #94A3B8; border-radius:0; }
.po-l-acik { background:repeating-linear-gradient(90deg, ${CALISMA} 0 4px, #CFE3D6 4px 7px); }
.po-suren { display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:16px; background:var(--po-acik); border:1px solid color-mix(in srgb, var(--po-renk) 30%, transparent); color:#1E293B; }
.po-suren-ikon { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background:#fff; color:var(--po-renk); flex-shrink:0; }
.po-suren > div:nth-child(2) { flex:1; display:flex; flex-direction:column; gap:2px; font-size:13px; color:#475569; } .po-suren strong { color:var(--po-renk); font-size:15px; }
.po-suren-donus { display:flex; flex-direction:column; align-items:flex-end; font-size:12px; color:#64748B; } .po-suren-donus strong { color:#1E293B !important; font-size:14px !important; }
.po-not { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border-radius:12px; background:#FFF8E8; border:1px solid #F6D58E; color:#7A4B00; font-size:13px; line-height:1.5; }
.po-grafik { width:100%; height:auto; display:block; }
.po-g-deger { font-size:11px; font-weight:700; fill:#334155; } .po-g-etiket { font-size:10.5px; fill:#94A3B8; }
.po-hedef { stroke:#94A3B8; stroke-dasharray:4 4; } .po-hedef-yazi { font-size:10px; fill:#94A3B8; }
.po-cizelge { display:flex; flex-direction:column; gap:6px; }
.po-c-olcek, .po-c-satir { display:grid; grid-template-columns:86px 1fr 150px; align-items:center; gap:12px; }
.po-c-olcek .po-c-serit { position:relative; height:14px; background:none; } .po-c-olcek .po-c-serit span { position:absolute; transform:translateX(-50%); font-size:10.5px; color:#94A3B8; }
.po-c-gun { font-size:12.5px; color:#64748B; } .po-c-gun strong { color:#1E293B; }
.po-c-serit { position:relative; height:22px; border-radius:7px; background:#F3F6F4; overflow:hidden; }
.po-dilim { position:absolute; top:0; bottom:0; border-radius:5px; }
.po-dilim-calisma { background:${CALISMA}; } .po-dilim-mola { background:${MOLA}; }
.po-dilim-acik { background:repeating-linear-gradient(90deg, ${CALISMA} 0 6px, #7FA88C 6px 10px); animation:poSerit 1s linear infinite; background-size:10px 100%; }
@keyframes poSerit { to { background-position:10px 0; } }
.po-dilim-izin { position:absolute; inset:0; display:flex; align-items:center; gap:6px; padding:0 10px; background:var(--po-acik); color:var(--po-renk); font-size:12px; font-weight:700; }
.po-c-bilgi { display:flex; flex-direction:column; font-size:12px; color:#64748B; } .po-c-saat { font-weight:700; color:#1E293B; font-variant-numeric:tabular-nums; } .po-soluk { color:#CBD5E1 !important; font-weight:500 !important; }
.po-c-eksik .po-c-saat { color:#B45309; }
.po-kayitlar { display:flex; flex-direction:column; }
.po-kayit { display:grid; grid-template-columns:24px 110px 1fr auto; align-items:center; gap:10px; padding:8px 2px; border-top:1px solid #F1F5F4; font-size:13px; }
.po-kayit-ad { font-weight:700; color:#1E293B; } .po-kayit-zaman { color:#64748B; } .po-kayit-zaman strong { color:#1E293B; font-variant-numeric:tabular-nums; }
.po-kayit-yontem { font-size:11.5px; color:#94A3B8; }
.po-hak { display:flex; align-items:center; gap:22px; flex-wrap:wrap; }
.po-halka { width:130px; height:130px; flex-shrink:0; }
.po-halka circle { fill:none; stroke-width:11; stroke-linecap:round; }
.po-halka-zemin { stroke:#EEF2F0; } .po-halka-kul { stroke:${IZIN_GORUNUM.yillik.renk}; } .po-halka-bek { stroke:#F2C94C; }
.po-halka-sayi { font-size:24px; font-weight:800; fill:#1E293B; } .po-halka-yazi { font-size:9px; fill:#64748B; }
.po-hak-bilgi { flex:1; min-width:220px; } .po-hak-bilgi h4 { margin:0 0 8px; font-size:14.5px; }
.po-hak-satir, .po-hd-satir { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; border-top:1px solid #F1F5F4; font-size:13.5px; color:#475569; }
.po-hak-satir span, .po-hd-satir span { display:inline-flex; align-items:center; gap:8px; } .po-hak-satir strong, .po-hd-satir strong { color:#1E293B; font-variant-numeric:tabular-nums; }
.po-hd { margin-top:12px; } .po-hd-satir span svg { color:#94A3B8; }
.po-dipnot { margin:10px 0 0; font-size:12px; color:#94A3B8; line-height:1.5; }
.po-izinler { display:flex; flex-direction:column; gap:8px; }
.po-izin { display:flex; align-items:flex-start; gap:12px; padding:12px; border-radius:12px; border:1px solid #EEF2F0; border-left:4px solid var(--po-renk); }
.po-izin-ikon { width:38px; height:38px; border-radius:10px; display:grid; place-items:center; background:var(--po-acik); color:var(--po-renk); flex-shrink:0; }
.po-izin-bilgi { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; font-size:12.5px; color:#64748B; } .po-izin-bilgi strong { font-size:14px; color:#1E293B; }
.po-izin-surer { display:inline-flex; align-items:center; gap:5px; color:var(--po-renk); font-weight:700; }
.po-izin-not { font-style:italic; }
.po-izin-durum { flex-shrink:0; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; white-space:nowrap; }
.po-izin-belge { flex-shrink:0; width:34px; height:34px; border-radius:9px; display:grid; place-items:center; color:#475569; background:#F1F5F9; }
.po-serit30 { display:grid; grid-template-columns:repeat(30, minmax(0,1fr)); gap:3px; }
.po-serit30 span { height:26px; border-radius:4px; background:#F1F5F4; } .po-serit30 .po-s1 { background:#BFD8C7; } .po-serit30 .po-s2 { background:#7FA88C; } .po-serit30 .po-s3 { background:${CALISMA}; }
.po-isi { display:grid; gap:3px; align-items:center; }
.po-isi-saat { font-size:10px; color:#94A3B8; text-align:center; } .po-isi-gun { font-size:11px; color:#64748B; font-weight:600; }
.po-isi-hucre { height:18px; border-radius:4px; background:${CALISMA}; }
.po-bolumler { display:flex; flex-direction:column; gap:7px; }
.po-bolum-sat { display:grid; grid-template-columns:minmax(100px,150px) 1fr 36px; align-items:center; gap:10px; font-size:13px; color:#334155; } .po-bolum-sat strong { text-align:right; font-variant-numeric:tabular-nums; }
.po-b-cubuk { height:9px; border-radius:999px; background:#F1F5F4; overflow:hidden; } .po-b-cubuk span { display:block; height:100%; border-radius:999px; background:${CALISMA}; }
@media (max-width:1100px) { .po-satir { grid-template-columns:44px minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,1fr) 20px; } .po-uyg { display:none; } }
@media (max-width:900px) { .po-kutular { grid-template-columns:repeat(3, minmax(0,1fr)); } }
@media (max-width:700px) {
  .po-kutular { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .po-satir { grid-template-columns:40px minmax(0,1fr) 18px; row-gap:8px; }
  .po-avatar { width:40px; height:40px; }
  .po-durum, .po-sure { grid-column:2 / 3; }
  .po-ok { grid-row:1; grid-column:3; }
  .po-c-bas { padding:16px 14px 12px; } .po-c-govde { padding:14px 12px 24px; } .po-bolum { padding:14px; }
  .po-c-olcek, .po-c-satir { grid-template-columns:62px 1fr; } .po-c-bilgi { grid-column:2; flex-direction:row; gap:8px; }
  .po-suren { flex-wrap:wrap; } .po-suren-donus { align-items:flex-start; }
  .po-kayit { grid-template-columns:22px 1fr auto; } .po-kayit-yontem { display:none; }
  .po-gun { height:46px; padding:4px; } .po-g-sure { font-size:10px; }
  .po-canli { margin-left:0; }
  .po-sekmeler { padding:0 8px; } .po-sekmeler button { padding:11px 9px 10px; font-size:13px; }
}
@media (prefers-reduced-motion:reduce) { .po-donen, .po-canli span, .po-dilim-acik, .po-cekmece, .po-arka { animation:none; } }
`;
  document.head.appendChild(st);
}

if (typeof window !== "undefined") window.personelOzluk = { panelRender, panelDurdur, gunuHesapla, IZIN_GORUNUM };
