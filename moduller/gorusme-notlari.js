// ══════════════════════════════════════════════════════════════
// PORTAL · GÖRÜŞME NOTLARI + RANDEVU BİLDİRİMLERİ (24 Eylül 2026)
// --------------------------------------------------------------
// 1) Bildirim: veli randevu talep ettiğinde görüşülecek personelin
//    (ve yönetimin) ekranına açılır pencere gelir. Kaynak: randevu
//    servisi (randevuSorguV3 inbox / management_inbox) — veri yolu aynı.
// 2) Öğretmen özeti "Randevular" kartı artık yeni sistemden okur.
// 3) Görüşme notu: randevu sonrası öğretmen / PDR / yönetim hazır
//    sorular, değerlendirme ölçütleri ve serbest metinle not yazar.
//    VELİ HİÇBİR KOŞULDA GÖREMEZ (Firestore kuralı). Gizli notlar
//    yalnız PDR ve yönetimde.
// 4) "Yönetime bildir": kişiler seçilir; müdür ve kurucu müdür
//    her zaman otomatik eklenir, ekranlarına açılır pencere gelir.
//
// Veri:
//   gorusmeNotlari/{randevuId}        not (randevu kimliğiyle)
//   personelBildirimleri/{otomatik}   portal içi bildirim (açılır pencere)
//   bildirimler/{otomatik}            ZEKY bildirimi (eski biçim, en iyi çaba)
// ══════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const kucuk = (x) => String(x || "").trim().toLowerCase();
const ikon = (ad, b = 16) => `<i data-lucide="${ad}" style="width:${b}px;height:${b}px;"></i>`;
const ikonCiz = () => { try { window.lucideYenile?.(); } catch (_) {} };
const toast = (m, t) => { try { window.showToast ? window.showToast(m, t) : P()?.toast?.(m, t); } catch (_) {} };
const guvenliId = (v, max = 200) => { const s = String(v || "").trim(); return s && s.length <= max && /^[A-Za-z0-9_-]+$/.test(s) ? s : ""; };

const fGun = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long" });
const fKisa = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short" });
const fSaat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const gunYazi = (ms) => Number.isFinite(ms) ? fGun.format(new Date(ms)) : "—";
const kisaYazi = (ms) => Number.isFinite(ms) ? fKisa.format(new Date(ms)) : "—";
const saatYazi = (ms) => Number.isFinite(ms) ? fSaat.format(new Date(ms)) : "—";

const TUR = {
  ogretmen_veli: { ad: "Öğretmen–veli", ikon: "graduation-cap", renk: "#2E6A9E", acik: "#E9F3FC" },
  pdr:           { ad: "Rehberlik (PDR)", ikon: "brain",        renk: "#7C3AED", acik: "#EDE9FE" },
  idare:         { ad: "Müdür / idare",  ikon: "briefcase",      renk: "#2D5E3E", acik: "#E8F3EC" }
};
const turBul = (t) => TUR[t] || { ad: "Görüşme", ikon: "calendar", renk: "#475569", acik: "#F1F5F9" };

// ── Hazır alanlar ve değerlendirme ölçütleri ──
export const KONULAR = ["Okula uyum", "Gelişim ve kazanımlar", "Davranış", "Sosyal-duygusal gelişim", "Öz bakım (uyku, beslenme, tuvalet)",
  "Sağlık", "Aile ve ev düzeni", "Montessori / orman programı", "İdari / ödeme", "Diğer"];
export const OLCUTLER = [
  { k: "uyum", ad: "Okula uyum" }, { k: "sosyal", ad: "Sosyal ilişkiler" }, { k: "duygu", ad: "Duygusal düzenleme" },
  { k: "dil", ad: "Dil ve iletişim" }, { k: "ozbakim", ad: "Öz bakım becerileri" }, { k: "isbirligi", ad: "Aile–okul iş birliği" }
];
const PUAN = [
  { p: 1, ad: "Destek gerekli", renk: "#DC2626" }, { p: 2, ad: "Gelişiyor", renk: "#EA580C" }, { p: 3, ad: "Beklenen düzeyde", renk: "#CA8A04" },
  { p: 4, ad: "İyi", renk: "#16A34A" }, { p: 5, ad: "Çok iyi", renk: "#15803D" }
];
export const SORULAR = [
  { k: "gundem", ad: "Velinin gündemi ve kaygısı neydi?" },
  { k: "gozlem", ad: "Okul olarak neler paylaştınız? (gözlem, örnekler)" },
  { k: "kararlar", ad: "Birlikte hangi kararlar alındı?" },
  { k: "evOnerisi", ad: "Eve / aileye hangi öneriler verildi?" }
];
const GERCEKLESME = [["gerceklesti", "Gerçekleşti"], ["gelmedi", "Veli gelmedi"], ["ertelendi", "Ertelendi"]];
const SEKIL = [["yuzyuze", "Yüz yüze"], ["telefon", "Telefon"], ["online", "Online"]];
const KATILAN = [["anne", "Anne"], ["baba", "Baba"], ["diger", "Diğer yakın"]];
const ROL_AD = { kurucu_mudur: "Kurucu Müdür", mudur: "Müdür", egitim_koordinator: "Eğitim Koordinatörü", pdr: "PDR Uzmanı", ogretmen: "Sınıf Öğretmeni" };

function durum() {
  const s = P()?.state || {};
  const rol = s.isAdmin ? "kurucu_mudur" : (s.rol || "");
  return { s, rol, eposta: kucuk(s.currentUser?.email), ad: s.personel?.adSoyad || s.currentUser?.displayName || s.currentUser?.email || "",
    yonetim: s.isAdmin || ["kurucu_mudur", "mudur"].includes(rol), pdr: rol === "pdr", koordinator: rol === "egitim_koordinator",
    ogretmen: rol === "ogretmen", siniflar: s.siniflar || [] };
}
const notYazabilir = (d = durum()) => d.yonetim || d.pdr || d.koordinator || d.ogretmen;

// ── randevu servisi (veri yolu değişmedi) ──
let servisSozu = null;
async function servis() {
  if (!servisSozu) servisSozu = import("../js/zeky-randevu-cutover-runtime.js").then(m => {
    if (!m.callableCutoverAcikMi()) throw new Error("Randevu sistemi kapalı");
    return m.randevuServisiGetir();
  }).catch(e => { servisSozu = null; throw e; });
  return servisSozu;
}
async function kutu() {
  const s = await servis();
  let yonetimKapsami = false, veri;
  if (durum().yonetim) {
    try { veri = await s.yonetimKutusu(); yonetimKapsami = veri?.kapsam === "okul"; } catch (_) { veri = null; }
  }
  if (!veri) veri = await s.personelKutusu();
  const liste = (Array.isArray(veri?.randevular) ? veri.randevular : [])
    .map(r => ({ ...r, ms: Number(r.baslangicMillis) })).filter(r => guvenliId(r.id) && Number.isFinite(r.ms));
  return { liste, yonetimKapsami };
}

// Randevudaki öğrenci adını portal kaydıyla eşleştir (sınıf bilgisi için)
function ogrenciBul(ad) {
  const s = P()?.state || {};
  const hedef = String(ad || "").toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
  if (!hedef) return null;
  const o = (s.ogrenciList || []).find(x => String(x.ogrenciAdSoyad || "").toLocaleLowerCase("tr").replace(/\s+/g, " ").trim() === hedef);
  if (!o) return null;
  return { id: o.id, sinif: (s.ayarListesi || {})[o.id]?.kayit?.sinif || o.sinif || "" };
}

// ═════════════════════════ AÇILIR PENCERE BİLDİRİMLERİ ═════════════════════════
let bildirimAktif = false;
const YOKLAMA_ARALIK = 90 * 1000;

export function bildirimBaslat() {
  if (bildirimAktif) return;
  const d = durum();
  if (!d.s.personel || !d.eposta) return;
  bildirimAktif = true;
  stilEkle();
  randevuYokla();
  setInterval(() => { if (document.visibilityState === "visible") randevuYokla(); }, YOKLAMA_ARALIK);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") randevuYokla(); });
  bildirimDinle();
}

function gorulenler(anahtar) { try { return new Set(JSON.parse(localStorage.getItem(anahtar) || "[]")); } catch (_) { return new Set(); } }
function gorulduYaz(anahtar, set) { try { localStorage.setItem(anahtar, JSON.stringify([...set].slice(-300))); } catch (_) {} }

let yoklaniyor = false;
async function randevuYokla() {
  if (yoklaniyor) return;
  yoklaniyor = true;
  try {
    const { liste } = await kutu();
    sonKutu = liste;
    const anahtar = `gn-randevu-gorulen:${durum().eposta}`;
    const gorulen = gorulenler(anahtar);
    const yeni = liste.filter(r => r.durum === "talep" && r.ms > Date.now() - 3600000 && !gorulen.has(r.id)).sort((a, b) => a.ms - b.ms);
    if (yeni.length) {
      yeni.forEach(r => gorulen.add(r.id)); gorulduYaz(anahtar, gorulen);
      acilirGoster({
        tur: "randevu", ikon: "calendar-plus", renk: "#B45309", acik: "#FEF3C7",
        baslik: yeni.length === 1 ? "Yeni randevu talebi" : `${yeni.length} yeni randevu talebi`,
        satirlar: yeni.slice(0, 4).map(r => `${r.ogrenciAd || r.veliAd || "Veli"} · ${turBul(r.tip).ad} · ${gunYazi(r.ms)} ${saatYazi(r.ms)}`),
        not: yeni[0].veliNotu || "",
        eylem: { yazi: "Randevuları aç", ikon: "calendar-days", tikla: () => { location.href = "./randevu-talepleri.html"; } }
      });
    }
    document.querySelectorAll("[data-gn-ozet]").forEach(el => ozetCiz(el));
  } catch (e) { console.warn("Randevu bildirimi okunamadı:", e?.code || e?.message); }
  finally { yoklaniyor = false; }
}

function bildirimDinle() {
  const a = P(); if (!a?.fb) return;
  const { db, fb } = a;
  const anahtar = `gn-bildirim-gorulen:${durum().eposta}`;
  try {
    fb.onSnapshot(fb.query(fb.collection(db, "personelBildirimleri"), fb.where("aliciEmail", "==", durum().eposta), fb.where("okundu", "==", false)), snap => {
      const gorulen = gorulenler(anahtar);
      snap.docs.forEach(dokuman => {
        if (gorulen.has(dokuman.id)) return;
        gorulen.add(dokuman.id); gorulduYaz(anahtar, gorulen);
        const v = dokuman.data() || {};
        acilirGoster({
          tur: "not", ikon: "notebook-text", renk: "#2D5E3E", acik: "#E8F3EC",
          baslik: v.baslik || "Yeni bildirim", satirlar: [v.metin || ""], alt: v.gonderenAd ? `Gönderen: ${v.gonderenAd}` : "",
          eylem: v.kaynakId ? { yazi: "Notu aç", ikon: "eye", tikla: () => notGoster(v.kaynakId) } : null,
          kapaninca: () => fb.updateDoc(dokuman.ref, { okundu: true, okunduZaman: fb.serverTimestamp() }).catch(() => {})
        });
      });
    }, e => console.warn("Personel bildirimleri dinlenemiyor (kural eklendi mi?):", e?.code || e?.message));
  } catch (_) {}
}

function acilirGoster({ ikon: ik, renk, acik, baslik, satirlar = [], not = "", alt = "", eylem = null, kapaninca = null }) {
  stilEkle();
  let yigin = document.getElementById("gnYigin");
  if (!yigin) { yigin = document.createElement("div"); yigin.id = "gnYigin"; yigin.className = "gn-yigin"; yigin.setAttribute("aria-live", "assertive"); document.body.appendChild(yigin); }
  const kart = document.createElement("div");
  kart.className = "gn-acilir"; kart.setAttribute("role", "alertdialog"); kart.style.setProperty("--gn-renk", renk); kart.style.setProperty("--gn-acik", acik);
  kart.innerHTML = `<span class="gn-acilir-ikon">${ikon(ik, 22)}</span>
    <div class="gn-acilir-govde"><strong>${esc(baslik)}</strong>
      ${satirlar.filter(Boolean).map(s => `<span>${esc(s)}</span>`).join("")}
      ${not ? `<em>“${esc(not)}”</em>` : ""}${alt ? `<small>${esc(alt)}</small>` : ""}
      <div class="gn-acilir-eylem">${eylem ? `<button type="button" class="gn-birincil gn-kucuk" data-gn-eylem>${ikon(eylem.ikon, 15)}${esc(eylem.yazi)}</button>` : ""}<button type="button" class="gn-hafif gn-kucuk" data-gn-kapat>Tamam</button></div></div>
    <button type="button" class="gn-acilir-x" data-gn-kapat aria-label="Kapat">${ikon("x", 16)}</button>`;
  const kapat = () => { kart.classList.add("gn-cikis"); setTimeout(() => kart.remove(), 180); try { kapaninca?.(); } catch (_) {} };
  kart.querySelectorAll("[data-gn-kapat]").forEach(b => b.addEventListener("click", kapat));
  kart.querySelector("[data-gn-eylem]")?.addEventListener("click", () => { kapat(); eylem.tikla(); });
  yigin.prepend(kart);
  ikonCiz();
}

// ═════════════════════════ ÖĞRETMEN ÖZETİ KARTI ═════════════════════════
let sonKutu = null;
let notOnbellek = null;   // Map randevuId → not

export async function ozetKart(kapId) {
  const el = document.getElementById(kapId);
  if (!el) return false;
  stilEkle();
  el.dataset.gnOzet = "1";
  el.innerHTML = `<div class="gn-yuk"><span class="gn-donen"></span>Randevular getiriliyor</div>`;
  try { const { liste } = await kutu(); sonKutu = liste; } catch (e) {
    el.innerHTML = `<div class="ca-tile-sub">Randevu bilgisi alınamadı. <button type="button" class="gn-link" data-gn-tekrar>Tekrar dene</button></div>`;
    el.querySelector("[data-gn-tekrar]")?.addEventListener("click", () => ozetKart(kapId));
    return true;
  }
  await notlariYukle().catch(() => {});
  ozetCiz(el);
  return true;
}

function ozetCiz(el) {
  if (!sonKutu) return;
  const simdi = Date.now();
  const bekleyen = sonKutu.filter(r => r.durum === "talep" && r.ms > simdi - 3600000).sort((a, b) => a.ms - b.ms);
  const yaklasan = sonKutu.filter(r => r.durum === "dolu" && r.ms >= simdi - 3600000).sort((a, b) => a.ms - b.ms);
  const notBekleyen = sonKutu.filter(r => r.durum === "dolu" && r.ms < simdi && !(notOnbellek && notOnbellek.has(r.id))).sort((a, b) => b.ms - a.ms);
  const satir = (r, rozet, renk, acik) => { const t = turBul(r.tip); return `<div class="gn-satir">
      <span class="gn-tarih" style="--gn-renk:${t.renk};--gn-acik:${t.acik}"><strong>${esc(saatYazi(r.ms))}</strong><span>${esc(kisaYazi(r.ms))}</span></span>
      <span class="gn-satir-metin"><strong>${esc(r.ogrenciAd || r.veliAd || "Veli")}</strong><span>${esc(r.veliAd && r.ogrenciAd ? r.veliAd + " · " : "")}${esc(t.ad)}</span>${r.veliNotu ? `<em>“${esc(r.veliNotu)}”</em>` : ""}</span>
      <span class="gn-rozet" style="color:${renk};background:${acik}">${esc(rozet)}</span></div>`; };
  el.innerHTML = `
    ${bekleyen.length ? `<div class="gn-bolum-bas gn-uyari">${ikon("bell-ring", 15)}Onayınızı bekleyen ${bekleyen.length} talep</div>${bekleyen.slice(0, 3).map(r => satir(r, "Onay bekliyor", "#B45309", "#FEF3C7")).join("")}
      <a class="gn-birincil gn-kucuk gn-tam" href="./randevu-talepleri.html">${ikon("calendar-check", 15)}Talepleri yanıtla</a>` : ""}
    ${yaklasan.length ? `<div class="gn-bolum-bas">${ikon("calendar-days", 15)}Yaklaşan görüşmeler</div>${yaklasan.slice(0, 3).map(r => satir(r, "Onaylandı", "#15803D", "#DCFCE7")).join("")}` : ""}
    ${notYazabilir() && notBekleyen.length ? `<div class="gn-bolum-bas">${ikon("notebook-pen", 15)}Notu yazılmamış ${notBekleyen.length} görüşme</div>
      ${notBekleyen.slice(0, 2).map(r => `<button type="button" class="gn-not-cta" data-gn-yaz="${esc(r.id)}">${ikon("pen-line", 15)}<span><strong>${esc(r.ogrenciAd || r.veliAd || "Görüşme")}</strong> · ${esc(kisaYazi(r.ms))}</span><span class="gn-ok">Not yaz ${ikon("chevron-right", 14)}</span></button>`).join("")}` : ""}
    ${!bekleyen.length && !yaklasan.length && !(notYazabilir() && notBekleyen.length) ? `<div class="ca-tile-sub">Bekleyen ya da yaklaşan veli görüşmeniz yok.</div>` : ""}`;
  el.querySelectorAll("[data-gn-yaz]").forEach(b => b.addEventListener("click", () => { const r = sonKutu.find(x => x.id === b.dataset.gnYaz); if (r) editorAc(r); }));
  ikonCiz();
}

// ═════════════════════════ NOTLAR: OKUMA ═════════════════════════
async function notlariYukle() {
  const a = P(); const { db, fb } = a; const d = durum();
  const harita = new Map();
  const ekle = (snap) => snap.docs.forEach(x => harita.set(x.id, { id: x.id, ...x.data() }));
  const col = fb.collection(db, "gorusmeNotlari");
  const sorgular = [];
  if (d.yonetim || d.pdr) sorgular.push(fb.getDocs(col));
  else {
    sorgular.push(fb.getDocs(fb.query(col, fb.where("yazanEmail", "==", d.eposta))));
    sorgular.push(fb.getDocs(fb.query(col, fb.where("bildirimAlicilari", "array-contains", d.eposta))));
    if (d.koordinator) sorgular.push(fb.getDocs(fb.query(col, fb.where("gizli", "==", false))));
    else if (d.ogretmen) d.siniflar.forEach(s => sorgular.push(fb.getDocs(fb.query(col, fb.where("sinif", "==", s), fb.where("gizli", "==", false)))));
  }
  const sonuc = await Promise.allSettled(sorgular);
  sonuc.forEach(x => { if (x.status === "fulfilled") ekle(x.value); });
  if (sonuc.every(x => x.status === "rejected") && sonuc.length) throw sonuc[0].reason;
  notOnbellek = harita;
  return harita;
}

// ═════════════════════════ NOT YAZMA ═════════════════════════
let edt = null;

export async function editorAc(randevu, mevcut = null) {
  stilEkle();
  const d = durum();
  if (!notYazabilir(d)) { toast("Görüşme notu yazma yetkiniz yok", "error"); return; }
  if (!mevcut) {
    try { const x = await P().fb.getDoc(P().fb.doc(P().db, "gorusmeNotlari", randevu.id)); if (x.exists()) mevcut = { id: x.id, ...x.data() }; } catch (_) {}
  }
  const ogr = ogrenciBul(randevu.ogrenciAd) || {};
  const n = mevcut || {};
  edt = {
    randevu, mevcut, ogr,
    v: {
      gerceklesme: n.gerceklesme || "gerceklesti", sekil: n.sekil || "yuzyuze", katilanlar: n.katilanlar || [],
      konular: n.konular || [], olcutler: { ...(n.olcutler || {}) }, sorular: { ...(n.sorular || {}) },
      takip: { gerekli: false, tarih: "", sorumlu: "", ...(n.takip || {}) }, detay: n.detay || "",
      gizli: n.gizli != null ? !!n.gizli : randevu.tip === "pdr"
    }
  };
  kapatDetay();
  const kok = document.createElement("div");
  kok.className = "gn-arka"; kok.id = "gnEditor";
  kok.innerHTML = `<div class="gn-pencere" role="dialog" aria-modal="true" aria-labelledby="gnBaslik"></div>`;
  document.body.appendChild(kok);
  kok.addEventListener("click", e => { if (e.target === kok) kapatDetay(); });
  document.addEventListener("keydown", tusKapat, true);
  editorCiz();
}
function tusKapat(e) { if (e.key === "Escape") { e.preventDefault(); kapatDetay(); } }
function kapatDetay() { document.getElementById("gnEditor")?.remove(); document.getElementById("gnGoster")?.remove(); document.getElementById("gnBildir")?.remove(); document.removeEventListener("keydown", tusKapat, true); }

function secenekler(ad, liste, secili, coklu = false) {
  return `<div class="gn-secenek" role="${coklu ? "group" : "radiogroup"}">${liste.map(([k, a]) => {
    const on = coklu ? secili.includes(k) : secili === k;
    return `<button type="button" class="gn-cip${on ? " gn-secili" : ""}" data-gn-alan="${ad}" data-gn-deger="${esc(k)}" aria-pressed="${on}">${on ? ikon("check", 13) : ""}${esc(a)}</button>`; }).join("")}</div>`;
}

function editorCiz() {
  const kap = document.querySelector("#gnEditor .gn-pencere");
  if (!kap || !edt) return;
  const { randevu: r, v, mevcut } = edt;
  const t = turBul(r.tip);
  kap.innerHTML = `
    <header class="gn-bas"><span class="gn-bas-ikon" style="--gn-renk:${t.renk};--gn-acik:${t.acik}">${ikon("notebook-pen", 20)}</span>
      <div><h3 id="gnBaslik">Görüşme notu</h3><p>${esc(r.ogrenciAd || "Öğrenci")} · ${esc(r.veliAd || "Veli")} · ${esc(gunYazi(r.ms))} ${esc(saatYazi(r.ms))}</p></div>
      <button type="button" class="gn-x" data-gn-kapat aria-label="Kapat">${ikon("x", 20)}</button></header>
    <div class="gn-govde">
      <div class="gn-gizlilik">${ikon("shield-check", 16)}<span>Bu not <strong>velilere hiçbir zaman gösterilmez.</strong> ${v.gizli ? "Yalnız PDR ve yönetim görebilir." : "Sınıf öğretmeni, eğitim koordinatörü, PDR ve yönetim görebilir."}</span></div>
      <section class="gn-alan"><h4>Görüşme</h4>
        <label class="gn-etiket">Durum</label>${secenekler("gerceklesme", GERCEKLESME, v.gerceklesme)}
        <label class="gn-etiket">Şekli</label>${secenekler("sekil", SEKIL, v.sekil)}
        <label class="gn-etiket">Katılanlar</label>${secenekler("katilanlar", KATILAN, v.katilanlar, true)}
      </section>
      <section class="gn-alan"><h4>Konuşulan konular</h4>${secenekler("konular", KONULAR.map(k => [k, k]), v.konular, true)}</section>
      <section class="gn-alan"><h4>Değerlendirme ölçütleri</h4>
        <p class="gn-ipucu">Görüşmede konuşulan başlıkları puanlayın; konuşulmayanları boş bırakın. 1 = destek gerekli · 5 = çok iyi</p>
        <div class="gn-olcutler">${OLCUTLER.map(o => { const p = Number(v.olcutler[o.k]) || 0; const pd = PUAN.find(x => x.p === p);
          return `<div class="gn-olcut"><span class="gn-olcut-ad">${esc(o.ad)}</span>
            <span class="gn-puanlar" role="radiogroup" aria-label="${esc(o.ad)}">${PUAN.map(x => `<button type="button" class="gn-puan${p === x.p ? " gn-secili" : ""}" style="--gn-renk:${x.renk}" data-gn-olcut="${o.k}" data-gn-puan="${x.p}" title="${esc(x.ad)}" aria-pressed="${p === x.p}">${x.p}</button>`).join("")}</span>
            <span class="gn-puan-ad" style="color:${pd ? pd.renk : "#94A3B8"}">${pd ? esc(pd.ad) : "Puanlanmadı"}</span></div>`; }).join("")}</div>
      </section>
      <section class="gn-alan"><h4>Hazır sorular</h4>
        ${SORULAR.map(q => `<label class="gn-etiket" for="gnS_${q.k}">${esc(q.ad)}</label><textarea id="gnS_${q.k}" data-gn-soru="${q.k}" rows="2" maxlength="2000">${esc(v.sorular[q.k] || "")}</textarea>`).join("")}
      </section>
      <section class="gn-alan"><h4>Takip</h4>
        <label class="gn-anahtar"><input type="checkbox" data-gn-takip="gerekli" ${v.takip.gerekli ? "checked" : ""}><span></span>Takip görüşmesi gerekiyor</label>
        ${v.takip.gerekli ? `<div class="gn-iki"><div><label class="gn-etiket" for="gnTT">Takip tarihi</label><input id="gnTT" type="date" data-gn-takip="tarih" value="${esc(v.takip.tarih)}"></div>
          <div><label class="gn-etiket" for="gnTS">Sorumlu</label><input id="gnTS" type="text" maxlength="120" data-gn-takip="sorumlu" value="${esc(v.takip.sorumlu)}" placeholder="Ör. sınıf öğretmeni"></div></div>` : ""}
      </section>
      <section class="gn-alan"><h4>Ayrıntılı not</h4>
        <textarea id="gnDetay" data-gn-detay rows="6" maxlength="8000" placeholder="Görüşmenin akışı, dikkat çeken noktalar, verilen sözler…">${esc(v.detay)}</textarea>
      </section>
      <section class="gn-alan"><h4>Kimler görebilir</h4>
        ${secenekler("gizli", [["hayir", "Sınıf öğretmeni, koordinatör, PDR, yönetim"], ["evet", "Yalnız PDR ve yönetim (hassas içerik)"]], v.gizli ? "evet" : "hayir")}
      </section>
      ${mevcut ? `<p class="gn-ipucu">İlk yazan: ${esc(mevcut.yazanAd || mevcut.yazanEmail || "")}${mevcut.guncelleyenAd ? ` · son düzenleyen: ${esc(mevcut.guncelleyenAd)}` : ""}</p>` : ""}
    </div>
    <footer class="gn-alt"><div id="gnMesaj" class="gn-mesaj" hidden></div>
      <button type="button" class="gn-hafif" data-gn-kapat>Vazgeç</button>
      <button type="button" class="gn-ikincil" data-gn-kaydet>${ikon("save", 16)}Kaydet</button>
      <button type="button" class="gn-birincil" data-gn-bildir>${ikon("send", 16)}Kaydet ve yönetime bildir</button></footer>`;
  kap.querySelectorAll("[data-gn-kapat]").forEach(b => b.addEventListener("click", kapatDetay));
  kap.querySelectorAll("[data-gn-alan]").forEach(b => b.addEventListener("click", () => {
    alanlariOku();
    const alan = b.dataset.gnAlan, deger = b.dataset.gnDeger;
    if (alan === "katilanlar" || alan === "konular") { const l = new Set(edt.v[alan]); l.has(deger) ? l.delete(deger) : l.add(deger); edt.v[alan] = [...l]; }
    else if (alan === "gizli") edt.v.gizli = deger === "evet";
    else edt.v[alan] = deger;
    editorCiz();
  }));
  kap.querySelectorAll("[data-gn-olcut]").forEach(b => b.addEventListener("click", () => {
    alanlariOku(); const k = b.dataset.gnOlcut, p = Number(b.dataset.gnPuan);
    edt.v.olcutler[k] = edt.v.olcutler[k] === p ? 0 : p; editorCiz();
  }));
  kap.querySelector('[data-gn-takip="gerekli"]').addEventListener("change", (e) => { alanlariOku(); edt.v.takip.gerekli = e.target.checked; editorCiz(); });
  kap.querySelector("[data-gn-kaydet]").addEventListener("click", () => kaydet(false));
  kap.querySelector("[data-gn-bildir]").addEventListener("click", () => kaydet(true));
  ikonCiz();
}

function alanlariOku() {
  const kap = document.getElementById("gnEditor"); if (!kap || !edt) return;
  kap.querySelectorAll("[data-gn-soru]").forEach(t => { edt.v.sorular[t.dataset.gnSoru] = t.value; });
  const det = kap.querySelector("[data-gn-detay]"); if (det) edt.v.detay = det.value;
  kap.querySelectorAll('[data-gn-takip="tarih"], [data-gn-takip="sorumlu"]').forEach(i => { edt.v.takip[i.dataset.gnTakip] = i.value; });
}

function editorMesaj(m, hata = true) {
  const el = document.getElementById("gnMesaj"); if (!el) return;
  el.hidden = !m; el.className = `gn-mesaj ${hata ? "gn-hata" : ""}`; el.textContent = m || "";
}

async function kaydet(bildir) {
  alanlariOku();
  const { randevu: r, v, ogr, mevcut } = edt;
  const d = durum();
  const doluSoru = Object.values(v.sorular).some(x => String(x || "").trim());
  if (v.gerceklesme === "gerceklesti" && !doluSoru && !v.detay.trim() && !v.konular.length) { editorMesaj("En az bir konu seçin ya da kısa bir not yazın."); return; }
  if (v.takip.gerekli && !v.takip.tarih) { editorMesaj("Takip tarihini seçin."); return; }
  const { db, fb } = P();
  const temiz = (s, n) => String(s || "").trim().slice(0, n);
  const veri = {
    randevuId: r.id, ogrenciId: ogr.id || mevcut?.ogrenciId || "", ogrenciAd: temiz(r.ogrenciAd, 160), sinif: ogr.sinif || mevcut?.sinif || "",
    veliAd: temiz(r.veliAd, 160), tip: TUR[r.tip] ? r.tip : "diger", hedefAd: temiz(r.hedefAd, 160), randevuMillis: r.ms,
    gerceklesme: v.gerceklesme, sekil: v.sekil, katilanlar: v.katilanlar, konular: v.konular,
    olcutler: Object.fromEntries(Object.entries(v.olcutler).filter(([, p]) => p >= 1 && p <= 5)),
    sorular: Object.fromEntries(SORULAR.map(q => [q.k, temiz(v.sorular[q.k], 2000)])),
    takip: { gerekli: !!v.takip.gerekli, tarih: v.takip.gerekli ? temiz(v.takip.tarih, 10) : "", sorumlu: v.takip.gerekli ? temiz(v.takip.sorumlu, 120) : "" },
    detay: temiz(v.detay, 8000), gizli: !!v.gizli, veliGorebilir: false,
    guncelleyen: d.eposta, guncelleyenAd: d.ad, guncellendi: fb.serverTimestamp()
  };
  if (!mevcut) Object.assign(veri, { yazanEmail: d.eposta, yazanAd: d.ad, yazanRol: d.rol, olusturuldu: fb.serverTimestamp(), bildirimAlicilari: [] });
  const btn = document.querySelector(bildir ? "[data-gn-bildir]" : "[data-gn-kaydet]");
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="gn-donen gn-donen-beyaz"></span>Kaydediliyor`; }
  try {
    await fb.setDoc(fb.doc(db, "gorusmeNotlari", r.id), veri, { merge: true });
    const kayitli = { id: r.id, ...(mevcut || {}), ...veri, bildirimAlicilari: mevcut?.bildirimAlicilari || [] };
    notOnbellek?.set(r.id, kayitli);
    toast("Görüşme notu kaydedildi", "success");
    if (bildir) { kapatDetay(); bildirAc(kayitli); }
    else { kapatDetay(); }
    document.querySelectorAll("[data-gn-ozet]").forEach(el => ozetCiz(el));
    if (pnl) panelCiz();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = `${ikon(bildir ? "send" : "save", 16)}${bildir ? "Kaydet ve yönetime bildir" : "Kaydet"}`; ikonCiz(); }
    editorMesaj(/permission|insufficient/i.test(String(e?.code || e?.message)) ? "Kaydetme izni yok. Firestore kuralına GÖRÜŞME NOTLARI bloğu eklenmeli." : "Not kaydedilemedi, tekrar deneyin.");
  }
}

// ═════════════════════════ YÖNETİME BİLDİR ═════════════════════════
async function bildirAc(not) {
  stilEkle();
  const kok = document.createElement("div");
  kok.className = "gn-arka"; kok.id = "gnBildir";
  kok.innerHTML = `<div class="gn-pencere gn-pencere-dar" role="dialog" aria-modal="true"><div class="gn-yuk"><span class="gn-donen"></span>Kişiler getiriliyor</div></div>`;
  document.body.appendChild(kok);
  document.addEventListener("keydown", tusKapat, true);
  let kisiler = [];
  try {
    const snap = await P().fb.getDocs(P().fb.collection(P().db, "personeller"));
    kisiler = snap.docs.map(x => ({ email: kucuk(x.id), ...(x.data() || {}) })).filter(p => (p.durum || "aktif") === "aktif" && p.email);
  } catch (_) {}
  const ben = durum().eposta;
  const sabit = kisiler.filter(p => ["kurucu_mudur", "mudur"].includes(p.rol));
  const secilebilir = kisiler.filter(p => !sabit.includes(p) && p.email !== ben && (
    ["egitim_koordinator", "pdr"].includes(p.rol) ||
    (p.rol === "ogretmen" && !not.gizli && not.sinif && (p.siniflar || p.sinifAtamalari || []).includes?.(not.sinif))));
  const secili = new Set();
  const kap = kok.querySelector(".gn-pencere");
  const kisiHtml = (p, kilitli) => `<label class="gn-kisi${kilitli ? " gn-kilitli" : ""}"><input type="checkbox" ${kilitli ? "checked disabled" : ""} data-gn-kisi="${esc(p.email)}">
    <span class="gn-kisi-av">${esc((p.adSoyad || p.email).split(/\s+/).map(x => x[0]).slice(0, 2).join("").toLocaleUpperCase("tr"))}</span>
    <span class="gn-kisi-ad"><strong>${esc(p.adSoyad || p.email)}</strong><span>${esc(ROL_AD[p.rol] || p.unvan || p.rol || "Personel")}${kilitli ? " · her zaman bildirilir" : ""}</span></span></label>`;
  kap.innerHTML = `
    <header class="gn-bas"><span class="gn-bas-ikon" style="--gn-renk:#2D5E3E;--gn-acik:#E8F3EC">${ikon("send", 20)}</span>
      <div><h3>Yönetime bildir</h3><p>${esc(not.ogrenciAd)} · görüşme notu</p></div>
      <button type="button" class="gn-x" data-gn-kapat aria-label="Kapat">${ikon("x", 20)}</button></header>
    <div class="gn-govde">
      <div class="gn-etiket">Otomatik bildirilir</div>
      <div class="gn-kisiler">${sabit.length ? sabit.map(p => kisiHtml(p, true)).join("") : `<div class="gn-ipucu">Müdür ve kurucu müdür listesi okunamadı; bildirim yine de sistem yöneticisine gider.</div>`}</div>
      ${secilebilir.length ? `<div class="gn-etiket">Ayrıca bilgilendirmek istediğiniz kişiler</div><div class="gn-kisiler">${secilebilir.map(p => kisiHtml(p, false)).join("")}</div>` : ""}
      ${not.gizli ? `<p class="gn-ipucu">${ikon("lock", 13)} Not “yalnız PDR ve yönetim” olarak işaretli; sınıf öğretmenleri listede görünmez.</p>` : ""}
    </div>
    <footer class="gn-alt"><div id="gnBMesaj" class="gn-mesaj gn-hata" hidden></div>
      <button type="button" class="gn-hafif" data-gn-kapat>Şimdi değil</button>
      <button type="button" class="gn-birincil" data-gn-gonder>${ikon("send", 16)}Bildir</button></footer>`;
  kap.querySelectorAll("[data-gn-kapat]").forEach(b => b.addEventListener("click", kapatDetay));
  kap.querySelectorAll("input[data-gn-kisi]:not([disabled])").forEach(i => i.addEventListener("change", () => { i.checked ? secili.add(i.dataset.gnKisi) : secili.delete(i.dataset.gnKisi); }));
  kap.querySelector("[data-gn-gonder]").addEventListener("click", async (e) => {
    const alicilar = [...new Set([...sabit.map(p => p.email), ...secili, "emrahby@gmail.com"])].filter(x => x && x !== ben);
    const b = e.currentTarget; b.disabled = true; b.innerHTML = `<span class="gn-donen gn-donen-beyaz"></span>Gönderiliyor`;
    try { await bildirimGonder(not, alicilar); kapatDetay(); toast(`${alicilar.length} kişiye bildirildi`, "success"); if (pnl) panelCiz(); }
    catch (err) { b.disabled = false; b.innerHTML = `${ikon("send", 16)}Bildir`; ikonCiz();
      const m = document.getElementById("gnBMesaj"); m.hidden = false; m.textContent = /permission|insufficient/i.test(String(err?.code || err?.message)) ? "Bildirim izni yok. Firestore kuralına PERSONEL BİLDİRİMLERİ bloğu eklenmeli." : "Bildirim gönderilemedi."; }
  });
  ikonCiz();
}

async function bildirimGonder(not, alicilar) {
  const { db, fb } = P(); const d = durum();
  const konular = (not.konular || []).slice(0, 3).join(", ");
  const baslik = `Görüşme notu · ${not.ogrenciAd || "Öğrenci"}`;
  const metin = `${d.ad} · ${kisaYazi(not.randevuMillis)}${konular ? ` · ${konular}` : ""}${not.takip?.gerekli ? " · takip gerekli" : ""}`;
  const toplu = fb.writeBatch(db);
  alicilar.forEach(e => toplu.set(fb.doc(fb.collection(db, "personelBildirimleri")), {
    aliciEmail: e, tip: "gorusme_notu", baslik, metin, kaynakId: not.randevuId || not.id,
    gonderenEmail: d.eposta, gonderenAd: d.ad, okundu: false, olusturuldu: fb.serverTimestamp()
  }));
  toplu.set(fb.doc(db, "gorusmeNotlari", not.randevuId || not.id), {
    bildirimAlicilari: fb.arrayUnion(...alicilar), bildirildi: fb.serverTimestamp(), guncelleyen: d.eposta, guncelleyenAd: d.ad, guncellendi: fb.serverTimestamp()
  }, { merge: true });
  await toplu.commit();
  // ZEKY uygulaması bildirimleri (eski biçim) — başarısız olsa da portal bildirimi gitti
  Promise.all(alicilar.map(e => fb.addDoc(fb.collection(db, "bildirimler"), {
    aliciEmail: e, tip: "gorusme_notu", baslik, metin, hedefSayfa: "gorusmeNotlari", okundu: false, olusturuldu: new Date().toISOString()
  }))).catch(() => {});
  const kayit = notOnbellek?.get(not.randevuId || not.id);
  if (kayit) kayit.bildirimAlicilari = [...new Set([...(kayit.bildirimAlicilari || []), ...alicilar])];
}

// ═════════════════════════ NOT GÖRÜNTÜLEME ═════════════════════════
export async function notGoster(id, hazir = null) {
  stilEkle(); kapatDetay();
  let n = hazir;
  if (!n) { try { const x = await P().fb.getDoc(P().fb.doc(P().db, "gorusmeNotlari", id)); if (x.exists()) n = { id: x.id, ...x.data() }; } catch (_) {} }
  if (!n) { toast("Not açılamadı ya da görme yetkiniz yok", "error"); return; }
  const t = turBul(n.tip);
  const kok = document.createElement("div");
  kok.className = "gn-arka"; kok.id = "gnGoster";
  const etiket = (l, k) => (l || []).map(x => (k ? (k.find(y => y[0] === x) || [x, x])[1] : x)).map(x => `<span class="gn-etk">${esc(x)}</span>`).join("");
  const puanlar = OLCUTLER.filter(o => n.olcutler?.[o.k]).map(o => { const p = PUAN.find(x => x.p === Number(n.olcutler[o.k]));
    return `<div class="gn-olcut gn-olcut-oku"><span class="gn-olcut-ad">${esc(o.ad)}</span><span class="gn-cubuk"><span style="width:${p.p * 20}%;background:${p.renk}"></span></span><span class="gn-puan-ad" style="color:${p.renk}">${p.p} · ${esc(p.ad)}</span></div>`; }).join("");
  const sorular = SORULAR.filter(q => String(n.sorular?.[q.k] || "").trim()).map(q => `<div class="gn-soru"><strong>${esc(q.ad)}</strong><p>${esc(n.sorular[q.k])}</p></div>`).join("");
  const tarih = (z) => { const x = z?.toDate ? z.toDate() : null; return x ? `${fKisa.format(x)} ${fSaat.format(x)}` : ""; };
  kok.innerHTML = `<div class="gn-pencere" role="dialog" aria-modal="true">
    <header class="gn-bas"><span class="gn-bas-ikon" style="--gn-renk:${t.renk};--gn-acik:${t.acik}">${ikon("notebook-text", 20)}</span>
      <div><h3>${esc(n.ogrenciAd || "Görüşme notu")}</h3><p>${esc(t.ad)} · ${esc(gunYazi(n.randevuMillis))} ${esc(saatYazi(n.randevuMillis))}${n.veliAd ? ` · ${esc(n.veliAd)}` : ""}</p></div>
      <button type="button" class="gn-x" data-gn-kapat aria-label="Kapat">${ikon("x", 20)}</button></header>
    <div class="gn-govde">
      <div class="gn-gizlilik">${ikon(n.gizli ? "lock" : "shield-check", 16)}<span>Velilere gösterilmez. ${n.gizli ? "Yalnız PDR ve yönetim görebilir." : "Sınıf öğretmeni, koordinatör, PDR ve yönetim görebilir."}</span></div>
      <div class="gn-ozet-bilgi">${etiket([n.gerceklesme], GERCEKLESME)}${etiket([n.sekil], SEKIL)}${etiket(n.katilanlar, KATILAN)}</div>
      ${(n.konular || []).length ? `<section class="gn-alan"><h4>Konular</h4><div class="gn-ozet-bilgi">${etiket(n.konular)}</div></section>` : ""}
      ${puanlar ? `<section class="gn-alan"><h4>Değerlendirme</h4><div class="gn-olcutler">${puanlar}</div></section>` : ""}
      ${sorular ? `<section class="gn-alan"><h4>Görüşme</h4>${sorular}</section>` : ""}
      ${n.detay ? `<section class="gn-alan"><h4>Ayrıntılı not</h4><p class="gn-detay-metin">${esc(n.detay)}</p></section>` : ""}
      ${n.takip?.gerekli ? `<div class="gn-takip">${ikon("calendar-clock", 16)}<span>Takip görüşmesi: <strong>${esc(n.takip.tarih)}</strong>${n.takip.sorumlu ? ` · ${esc(n.takip.sorumlu)}` : ""}</span></div>` : ""}
      <p class="gn-ipucu">Yazan: ${esc(n.yazanAd || n.yazanEmail || "")}${tarih(n.olusturuldu) ? ` · ${tarih(n.olusturuldu)}` : ""}${n.guncelleyenAd && n.guncelleyenAd !== n.yazanAd ? ` · son düzenleyen: ${esc(n.guncelleyenAd)}` : ""}${(n.bildirimAlicilari || []).length ? ` · ${n.bildirimAlicilari.length} kişiye bildirildi` : ""}</p>
    </div>
    <footer class="gn-alt">${notYazabilir() ? `<button type="button" class="gn-ikincil" data-gn-duzenle>${ikon("pen-line", 16)}Düzenle</button><button type="button" class="gn-birincil" data-gn-bildir2>${ikon("send", 16)}Yönetime bildir</button>` : ""}<button type="button" class="gn-hafif" data-gn-kapat>Kapat</button></footer></div>`;
  document.body.appendChild(kok);
  kok.addEventListener("click", e => { if (e.target === kok) kapatDetay(); });
  document.addEventListener("keydown", tusKapat, true);
  kok.querySelectorAll("[data-gn-kapat]").forEach(b => b.addEventListener("click", kapatDetay));
  kok.querySelector("[data-gn-duzenle]")?.addEventListener("click", () => editorAc({ id: n.randevuId || n.id, ogrenciAd: n.ogrenciAd, veliAd: n.veliAd, tip: n.tip, hedefAd: n.hedefAd, ms: n.randevuMillis }, n));
  kok.querySelector("[data-gn-bildir2]")?.addEventListener("click", () => { kapatDetay(); bildirAc(n); });
  ikonCiz();
}

// ═════════════════════════ GÖRÜŞME NOTLARI EKRANI ═════════════════════════
let pnl = null;
export async function panelRender(kapId) {
  const kap = document.getElementById(kapId);
  if (!kap) return;
  stilEkle();
  pnl = { kap, ara: pnl?.ara || "", sekme: pnl?.sekme || "bekleyen", hata: "" };
  kap.innerHTML = `<div class="gn-yuk"><span class="gn-donen"></span>Görüşmeler getiriliyor</div>`;
  const [k, n] = await Promise.allSettled([kutu(), notlariYukle()]);
  if (k.status === "fulfilled") sonKutu = k.value.liste;
  if (n.status === "rejected") pnl.hata = /permission|insufficient/i.test(String(n.reason?.code || n.reason?.message)) ? "izin" : "hata";
  panelCiz();
}

function panelCiz() {
  if (!pnl) return;
  const { kap } = pnl;
  const simdi = Date.now();
  const liste = sonKutu || [];
  const notlar = [...(notOnbellek || new Map()).values()].sort((a, b) => (b.randevuMillis || 0) - (a.randevuMillis || 0));
  const bekleyen = notYazabilir() ? liste.filter(r => r.durum === "dolu" && r.ms < simdi && !notOnbellek?.has(r.id)).sort((a, b) => b.ms - a.ms) : [];
  const yaklasan = liste.filter(r => ["talep", "dolu"].includes(r.durum) && r.ms >= simdi - 3600000).sort((a, b) => a.ms - b.ms);
  const q = pnl.ara.toLocaleLowerCase("tr");
  const uy = (x) => !q || `${x.ogrenciAd} ${x.veliAd} ${x.hedefAd} ${x.sinif || ""}`.toLocaleLowerCase("tr").includes(q);
  const kart = (r, eylem) => { const t = turBul(r.tip); return `<div class="gn-kart" style="--gn-renk:${t.renk};--gn-acik:${t.acik}">
    <span class="gn-tarih"><strong>${esc(kisaYazi(r.ms))}</strong><span>${esc(saatYazi(r.ms))}</span></span>
    <span class="gn-kart-metin"><strong>${esc(r.ogrenciAd || "Öğrenci")}</strong><span>${ikon(t.ikon, 13)}${esc(t.ad)}${r.hedefAd ? ` · ${esc(r.hedefAd)}` : ""}${r.veliAd ? ` · ${esc(r.veliAd)}` : ""}</span></span>${eylem}</div>`; };
  const notKart = (n) => { const t = turBul(n.tip); const p = Object.values(n.olcutler || {}).map(Number).filter(Boolean);
    const ort = p.length ? (p.reduce((a, b) => a + b, 0) / p.length) : 0;
    return `<button type="button" class="gn-kart gn-kart-not" data-gn-ac="${esc(n.id)}" style="--gn-renk:${t.renk};--gn-acik:${t.acik}">
      <span class="gn-tarih"><strong>${esc(kisaYazi(n.randevuMillis))}</strong><span>${esc(saatYazi(n.randevuMillis))}</span></span>
      <span class="gn-kart-metin"><strong>${esc(n.ogrenciAd || "Öğrenci")}${n.gizli ? ` ${ikon("lock", 13)}` : ""}</strong><span>${esc(t.ad)} · ${esc(n.yazanAd || "")}${(n.konular || []).length ? ` · ${esc(n.konular.slice(0, 2).join(", "))}` : ""}</span></span>
      ${ort ? `<span class="gn-ort" title="Ölçüt ortalaması">${ort.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}<small>/5</small></span>` : ""}
      ${n.takip?.gerekli ? `<span class="gn-rozet" style="color:#1D4ED8;background:#DBEAFE">${ikon("calendar-clock", 12)}Takip</span>` : ""}
      <span class="gn-ok">${ikon("chevron-right", 16)}</span></button>`; };
  const sekmeler = [["bekleyen", "Not bekleyen", bekleyen.length, "notebook-pen"], ["notlar", "Görüşme notları", notlar.length, "notebook-text"], ["yaklasan", "Yaklaşan", yaklasan.length, "calendar-days"]];
  let govde = "";
  if (pnl.sekme === "bekleyen") govde = bekleyen.filter(uy).map(r => kart(r, `<button type="button" class="gn-birincil gn-kucuk" data-gn-yaz="${esc(r.id)}">${ikon("pen-line", 15)}Not yaz</button>`)).join("") || `<div class="gn-bos">${ikon("check-circle-2", 22)}<span>Notu yazılmamış görüşme yok.</span></div>`;
  else if (pnl.sekme === "notlar") govde = pnl.hata === "izin" ? `<div class="gn-bos gn-uyari-kutu">${ikon("shield-alert", 20)}<span>Notları okumak için Firestore kuralına GÖRÜŞME NOTLARI bloğu eklenmeli.</span></div>`
    : notlar.filter(uy).map(notKart).join("") || `<div class="gn-bos">${ikon("notebook-text", 22)}<span>Henüz görüşme notu yok.</span></div>`;
  else govde = yaklasan.filter(uy).map(r => kart(r, `<span class="gn-rozet" style="${r.durum === "talep" ? "color:#B45309;background:#FEF3C7" : "color:#15803D;background:#DCFCE7"}">${r.durum === "talep" ? "Onay bekliyor" : "Onaylandı"}</span>`)).join("") || `<div class="gn-bos">${ikon("calendar", 22)}<span>Yaklaşan görüşme yok.</span></div>`;
  const odak = document.activeElement?.dataset?.gnAra != null;
  kap.innerHTML = `
    <div class="gn-ust">
      <div class="gn-sekmeler" role="tablist">${sekmeler.map(([k, a, n, i]) => `<button type="button" role="tab" aria-selected="${pnl.sekme === k}" class="${pnl.sekme === k ? "gn-sekme-aktif" : ""}" data-gn-sekme="${k}">${ikon(i, 15)}${a}<span>${n}</span></button>`).join("")}</div>
      <label class="gn-ara">${ikon("search", 16)}<input type="search" data-gn-ara value="${esc(pnl.ara)}" placeholder="Öğrenci, veli ya da sınıf ara"></label>
    </div>
    <div class="gn-liste">${govde}</div>`;
  kap.querySelectorAll("[data-gn-sekme]").forEach(b => b.addEventListener("click", () => { pnl.sekme = b.dataset.gnSekme; panelCiz(); }));
  const ara = kap.querySelector("[data-gn-ara]");
  ara.addEventListener("input", () => { pnl.ara = ara.value; panelCiz(); });
  if (odak) { ara.focus(); ara.setSelectionRange(ara.value.length, ara.value.length); }
  kap.querySelectorAll("[data-gn-yaz]").forEach(b => b.addEventListener("click", () => { const r = liste.find(x => x.id === b.dataset.gnYaz); if (r) editorAc(r); }));
  kap.querySelectorAll("[data-gn-ac]").forEach(b => b.addEventListener("click", () => notGoster(b.dataset.gnAc, notOnbellek?.get(b.dataset.gnAc))));
  ikonCiz();
}

// ═════════════════════════ STİL ═════════════════════════
function stilEkle() {
  if (document.getElementById("gorusmeNotStil")) return;
  const st = document.createElement("style");
  st.id = "gorusmeNotStil";
  st.textContent = `
.gn-yigin { position:fixed; top:84px; right:18px; z-index:10050; display:flex; flex-direction:column; gap:10px; width:min(380px, calc(100vw - 24px)); pointer-events:none; }
.gn-acilir { pointer-events:auto; position:relative; display:flex; gap:12px; padding:14px 40px 14px 14px; background:#fff; border-radius:18px; border:1px solid color-mix(in srgb, var(--gn-renk) 35%, #fff); border-left:5px solid var(--gn-renk); box-shadow:0 18px 44px rgba(15,23,42,.22); animation:gnGir .28s cubic-bezier(.2,.8,.2,1); font-family:inherit; }
.gn-acilir.gn-cikis { animation:gnCik .18s ease-in forwards; }
@keyframes gnGir { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }
@keyframes gnCik { to { opacity:0; transform:translateX(24px); } }
.gn-acilir-ikon { width:44px; height:44px; flex-shrink:0; border-radius:13px; display:grid; place-items:center; background:var(--gn-acik); color:var(--gn-renk); animation:gnSalla 1.2s ease-in-out 2; }
@keyframes gnSalla { 0%,100% { transform:rotate(0); } 20% { transform:rotate(-12deg); } 40% { transform:rotate(10deg); } 60% { transform:rotate(-6deg); } }
.gn-acilir-govde { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; font-size:13px; color:#475569; }
.gn-acilir-govde strong { font-size:15px; color:#1E293B; } .gn-acilir-govde em { color:#64748B; } .gn-acilir-govde small { color:#94A3B8; font-size:12px; }
.gn-acilir-eylem { display:flex; gap:7px; flex-wrap:wrap; margin-top:8px; }
.gn-acilir-x { position:absolute; top:8px; right:8px; width:30px; height:30px; border:0; border-radius:50%; background:transparent; color:#94A3B8; display:grid; place-items:center; cursor:pointer; }
.gn-acilir-x:hover { background:#F1F5F9; }
.gn-yuk { display:flex; align-items:center; justify-content:center; gap:10px; padding:18px; color:#64748B; font-size:13.5px; }
.gn-donen { width:16px; height:16px; border:2px solid #4A7C59; border-right-color:transparent; border-radius:50%; display:inline-block; animation:gnDon .8s linear infinite; }
.gn-donen-beyaz { border-color:#fff; border-right-color:transparent; }
@keyframes gnDon { to { transform:rotate(360deg); } }
.gn-link { border:0; background:none; color:#2D5E3E; font:inherit; font-weight:700; cursor:pointer; text-decoration:underline; }
.gn-birincil, .gn-ikincil, .gn-hafif { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:44px; padding:10px 16px; border-radius:12px; font:inherit; font-size:14px; font-weight:800; cursor:pointer; white-space:nowrap; text-decoration:none; }
.gn-birincil { border:0; background:#2D5E3E; color:#fff; } .gn-birincil:hover:not(:disabled) { background:#24503A; } .gn-birincil:disabled { opacity:.7; }
.gn-ikincil { border:1.5px solid #D9E3DC; background:#fff; color:#2D5E3E; }
.gn-hafif { border:0; background:#F1F5F9; color:#475569; }
.gn-kucuk { min-height:36px; padding:7px 12px; font-size:13px; }
.gn-tam { width:100%; margin:8px 0 4px; box-sizing:border-box; }
.gn-bolum-bas { display:flex; align-items:center; gap:7px; margin:10px 0 4px; font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:.4px; }
.gn-bolum-bas:first-child { margin-top:0; } .gn-uyari { color:#B45309; }
.gn-satir { display:flex; align-items:center; gap:11px; padding:8px 0; border-bottom:1px solid #F1F2F7; }
.gn-tarih { width:52px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; padding:6px 0; border-radius:12px; background:var(--gn-acik); color:var(--gn-renk); }
.gn-tarih strong { font-size:13.5px; line-height:1.1; font-variant-numeric:tabular-nums; } .gn-tarih span { font-size:10.5px; font-weight:700; }
.gn-satir-metin, .gn-kart-metin { flex:1; min-width:0; display:flex; flex-direction:column; font-size:12px; color:#64748B; }
.gn-satir-metin strong, .gn-kart-metin strong { font-size:13.5px; color:#1E293B; display:inline-flex; align-items:center; gap:5px; }
.gn-satir-metin em { font-size:11.5px; color:#94A3B8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gn-kart-metin span { display:inline-flex; align-items:center; gap:5px; flex-wrap:wrap; }
.gn-rozet { display:inline-flex; align-items:center; gap:4px; flex-shrink:0; padding:3px 9px; border-radius:999px; font-size:11px; font-weight:800; white-space:nowrap; }
.gn-not-cta { display:flex; align-items:center; gap:9px; width:100%; margin-top:6px; padding:10px 12px; border:1.5px dashed #BFD8C7; border-radius:12px; background:#F7FBF8; font:inherit; font-size:13px; color:#1E293B; cursor:pointer; text-align:left; }
.gn-not-cta span:nth-child(2) { flex:1; min-width:0; } .gn-ok { display:inline-flex; align-items:center; gap:3px; color:#2D5E3E; font-weight:800; font-size:12.5px; }
.gn-arka { position:fixed; inset:0; z-index:10040; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; padding:18px; }
.gn-pencere { width:100%; max-width:720px; max-height:92vh; background:#fff; border-radius:24px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px rgba(15,23,42,.28); color:#1E293B; font-family:inherit; }
.gn-pencere-dar { max-width:500px; }
.gn-bas { display:flex; align-items:center; gap:12px; padding:18px 18px 14px 22px; border-bottom:1px solid #EEF2F0; flex-shrink:0; }
.gn-bas > div { flex:1; min-width:0; } .gn-bas h3 { margin:0; font-size:18px; font-weight:800; } .gn-bas p { margin:2px 0 0; font-size:13px; color:#64748B; }
.gn-bas-ikon { width:42px; height:42px; border-radius:13px; display:grid; place-items:center; background:var(--gn-acik); color:var(--gn-renk); flex-shrink:0; }
.gn-x { width:40px; height:40px; flex-shrink:0; border:0; border-radius:50%; background:rgba(15,23,42,.06); color:#475569; display:grid; place-items:center; cursor:pointer; }
.gn-govde { overflow-y:auto; padding:16px 22px; display:flex; flex-direction:column; gap:14px; overscroll-behavior:contain; }
.gn-alt { display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; padding:12px 22px 16px; border-top:1px solid #EEF2F0; flex-shrink:0; }
.gn-mesaj { flex:1 1 100%; padding:9px 12px; border-radius:10px; background:#EFF6FF; color:#1E40AF; font-size:13px; } .gn-mesaj.gn-hata { background:#FEF2F2; color:#991B1B; }
.gn-gizlilik { display:flex; gap:9px; align-items:flex-start; padding:10px 12px; border-radius:12px; background:#F0FDF4; color:#166534; font-size:12.5px; line-height:1.5; }
.gn-alan { border:1px solid #EEF2F0; border-radius:16px; padding:14px 16px; }
.gn-alan h4 { margin:0 0 10px; font-size:14px; font-weight:800; color:#1E293B; }
.gn-etiket { display:block; margin:10px 0 6px; font-size:12.5px; font-weight:700; color:#475569; } .gn-alan > .gn-etiket:first-of-type { margin-top:0; }
.gn-ipucu { margin:0 0 10px; font-size:12px; color:#94A3B8; line-height:1.5; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.gn-secenek { display:flex; flex-wrap:wrap; gap:6px; }
.gn-cip { display:inline-flex; align-items:center; gap:5px; min-height:36px; padding:6px 12px; border:1.5px solid #E2E8F0; border-radius:999px; background:#fff; font:inherit; font-size:13px; font-weight:600; color:#334155; cursor:pointer; }
.gn-cip.gn-secili { background:#2D5E3E; border-color:#2D5E3E; color:#fff; }
.gn-olcutler { display:flex; flex-direction:column; gap:8px; }
.gn-olcut { display:grid; grid-template-columns:minmax(120px, 1fr) auto 120px; align-items:center; gap:10px; }
.gn-olcut-ad { font-size:13.5px; font-weight:600; color:#1E293B; }
.gn-puanlar { display:flex; gap:5px; }
.gn-puan { width:38px; height:38px; border:1.5px solid #E2E8F0; border-radius:10px; background:#fff; font:inherit; font-size:14px; font-weight:800; color:#64748B; cursor:pointer; }
.gn-puan:hover { border-color:var(--gn-renk); } .gn-puan.gn-secili { background:var(--gn-renk); border-color:var(--gn-renk); color:#fff; }
.gn-puan-ad { font-size:12px; font-weight:700; }
.gn-olcut-oku { grid-template-columns:minmax(120px, 1fr) 1fr 140px; }
.gn-cubuk { height:8px; border-radius:999px; background:#F1F5F4; overflow:hidden; } .gn-cubuk span { display:block; height:100%; border-radius:999px; }
.gn-govde textarea, .gn-govde input[type=text], .gn-govde input[type=date] { width:100%; box-sizing:border-box; padding:10px 12px; border:1.5px solid #E2E8F0; border-radius:12px; font:inherit; font-size:14px; color:#1E293B; resize:vertical; }
.gn-govde textarea:focus, .gn-govde input:focus { outline:none; border-color:#4A7C59; box-shadow:0 0 0 3px #E8F3EC; }
.gn-iki { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.gn-anahtar { display:inline-flex; align-items:center; gap:10px; font-size:13.5px; font-weight:600; cursor:pointer; }
.gn-anahtar input { position:absolute; opacity:0; } .gn-anahtar span { width:40px; height:24px; border-radius:999px; background:#CBD5E1; position:relative; transition:background .15s; }
.gn-anahtar span::after { content:""; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .15s; }
.gn-anahtar input:checked + span { background:#2D5E3E; } .gn-anahtar input:checked + span::after { transform:translateX(16px); }
.gn-anahtar input:focus-visible + span { outline:3px solid #BFD8C7; }
.gn-kisiler { display:flex; flex-direction:column; gap:6px; }
.gn-kisi { display:flex; align-items:center; gap:10px; padding:9px 12px; border:1.5px solid #E2E8F0; border-radius:12px; cursor:pointer; }
.gn-kisi input { width:18px; height:18px; accent-color:#2D5E3E; }
.gn-kilitli { background:#F7FBF8; border-color:#CFE3D6; cursor:default; }
.gn-kisi-av { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; background:#E8F3EC; color:#2D5E3E; font-weight:800; font-size:12.5px; flex-shrink:0; }
.gn-kisi-ad { display:flex; flex-direction:column; font-size:12px; color:#64748B; } .gn-kisi-ad strong { font-size:13.5px; color:#1E293B; }
.gn-ozet-bilgi { display:flex; flex-wrap:wrap; gap:6px; } .gn-etk { padding:4px 10px; border-radius:999px; background:#F1F5F4; color:#334155; font-size:12.5px; font-weight:600; }
.gn-soru { margin-bottom:10px; } .gn-soru strong { display:block; font-size:12.5px; color:#475569; } .gn-soru p { margin:3px 0 0; font-size:14px; line-height:1.55; white-space:pre-wrap; }
.gn-detay-metin { margin:0; font-size:14px; line-height:1.6; white-space:pre-wrap; }
.gn-takip { display:flex; gap:8px; align-items:center; padding:10px 12px; border-radius:12px; background:#DBEAFE; color:#1E3A8A; font-size:13px; }
.gn-ust { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
.gn-sekmeler { display:flex; gap:6px; flex-wrap:wrap; }
.gn-sekmeler button { display:inline-flex; align-items:center; gap:7px; min-height:40px; padding:8px 14px; border:1.5px solid #E2E8F0; border-radius:999px; background:#fff; font:inherit; font-size:13.5px; font-weight:700; color:#475569; cursor:pointer; }
.gn-sekmeler button span { font-size:12px; color:#94A3B8; } .gn-sekmeler .gn-sekme-aktif { background:#2D5E3E; border-color:#2D5E3E; color:#fff; } .gn-sekmeler .gn-sekme-aktif span { color:#CFE3D6; }
.gn-ara { display:flex; align-items:center; gap:8px; min-width:220px; padding:0 12px; border:1.5px solid #E2E8F0; border-radius:12px; background:#fff; color:#94A3B8; }
.gn-ara input { border:0; outline:0; min-height:40px; flex:1; font:inherit; font-size:14px; background:transparent; color:#1E293B; }
.gn-liste { display:flex; flex-direction:column; gap:8px; }
.gn-kart { display:flex; align-items:center; gap:12px; width:100%; padding:12px 14px; background:#fff; border:1px solid #E8EDF2; border-left:4px solid var(--gn-renk); border-radius:14px; font:inherit; color:inherit; text-align:left; box-sizing:border-box; }
.gn-kart-not { cursor:pointer; } .gn-kart-not:hover { box-shadow:0 6px 18px rgba(30,41,59,.08); }
.gn-ort { font-size:18px; font-weight:800; color:#1E293B; font-variant-numeric:tabular-nums; } .gn-ort small { font-size:11px; color:#94A3B8; }
.gn-bos { display:flex; align-items:center; justify-content:center; gap:10px; padding:28px 16px; border:1px dashed #D5DEE3; border-radius:14px; background:#fff; color:#64748B; font-size:13.5px; }
.gn-uyari-kutu { background:#FFF8E8; border-color:#F6D58E; color:#7A4B00; }
@media (max-width:640px) {
  .gn-arka { padding:0; align-items:flex-end; } .gn-pencere { max-height:94vh; border-radius:22px 22px 0 0; }
  .gn-govde { padding:14px 14px; } .gn-bas { padding:16px 14px 12px; } .gn-alt { padding:10px 14px 14px; } .gn-alt button { flex:1; }
  .gn-olcut { grid-template-columns:1fr auto; } .gn-olcut-oku { grid-template-columns:1fr 110px; } .gn-puan-ad { grid-column:1 / -1; margin-top:-4px; }
  .gn-puan { width:34px; height:34px; } .gn-iki { grid-template-columns:1fr; }
  .gn-yigin { top:auto; bottom:14px; right:12px; left:12px; width:auto; }
  .gn-ara { min-width:0; width:100%; }
}
@media (prefers-reduced-motion:reduce) { .gn-acilir, .gn-acilir-ikon, .gn-donen { animation:none; } }
`;
  document.head.appendChild(st);
}

if (typeof window !== "undefined") window.gorusmeNotlari = { bildirimBaslat, ozetKart, panelRender, editorAc, notGoster };
