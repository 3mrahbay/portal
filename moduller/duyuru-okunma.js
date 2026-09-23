// ══════════════════════════════════════════════════════════════
// PORTAL · DUYURU OKUNMA TAKİBİ
// --------------------------------------------------------------
// • Veli duyuruyu gördüğünde gün ve saatiyle kaydeder
// • Yönetim listesinde "12/40 gördü" düğmesi → Kimler gördü paneli
//   - Görmeyenler / Yüz yüze söylenenler / Görenler (sınıfa göre)
//   - "Yüz yüze söyledim" işareti (kim, ne zaman)
//   - Görmeyenlere hatırlatma e-postası, listeyi kopyalama
//
// Veri — duyurular/{duyuruId}/okumalar/{eposta}  (ZEKY ile ortak):
//   { eposta,
//     listedeGorulme?  : ISO   (Bildirimler'de ilk görüş — veli yazar)
//     simsekOnay?      : ISO   (şimşek popup'ta "Anladım" — veli yazar)
//     sonGorulme?      : ISO,  uygulama?: "portal" | "zeky"
//     yuzyuze?         : { zaman, isaretleyen, isaretleyenAd } (personel yazar) }
//   Portal hesabı olmayan veli için belge kimliği "yok:{ogrenciId}:{rol}".
//
//     eskiKayit?  : true  (eski listelerden aktarıldı, saat bilinmiyor)
//     eskiSimsek? : true  (eski kayıtta yalnız şimşek popup kapatılmış)
//
// Velinin KENDİ okundu bilgisi — kullaniciTercihleri/{eposta}
//   (yalnız velinin kendisi okur/yazar; e-posta başka yerde tutulmaz):
//   { okunanDuyurular: [duyuruId], kapatilanSimsekler: [duyuruId] }
//
// KVKK: Veli e-postası artık duyuru belgesine YAZILMAZ. Eski listeler
// (duyurular/{id}.okuyanVeliler, .popupKapatanVeliler) geçiş döneminde
// yalnız okunur; "Eski kayıtları aktar" aracı bunları yeni yapıya taşır.
// Okuma listesi yalnızca personele açıktır.
// ══════════════════════════════════════════════════════════════

const IKON = {
  goz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  kopya: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  el: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>'
};

// ─────────────────────────── yardımcılar ───────────────────────────
const P = () => (typeof window !== "undefined" ? window.PortalAPI : null) || null;
function toast(m, t) { try { P()?.toast?.(m, t); } catch (_) {} }
function esc(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const kucuk = (x) => String(x || "").trim().toLowerCase();
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function zamanYazi(iso, saatli = true) {
  if (!iso) return "";
  const t = new Date(iso);
  if (isNaN(t.getTime())) return "";
  const yil = t.getFullYear() !== new Date().getFullYear() ? ` ${t.getFullYear()}` : "";
  const saat = saatli ? `, ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}` : "";
  return `${t.getDate()} ${AYLAR[t.getMonth()]}${yil} ${GUNLER[t.getDay()]}${saat}`;
}
function hedefYazi(d) {
  if (d.hedefTur === "sinif") return d.hedefDeger || "Sınıf";
  if (d.hedefTur === "ogrenci") return d.hedefOgrenciAd || "Tek öğrenci";
  return "Tüm okul";
}
function iletisimGorur() {
  const s = P()?.state || {};
  return !!s.isAdmin || ["kurucu_mudur", "mudur"].includes(s.rol);
}
function izinHatasiMi(e) {
  const k = String(e?.code || e?.message || e || "");
  return /permission|insufficient/i.test(k);
}

// ─────────────────────────── veli tarafı ───────────────────────────
function veliEpostam() { return kucuk(P()?.state?.currentUser?.email); }
function yerelAnahtar(e, tur) { return `dok-${tur}:${e}`; }
function yerelOku(e, tur) {
  try { return JSON.parse(localStorage.getItem(yerelAnahtar(e, tur)) || "[]"); } catch (_) { return []; }
}
function yerelYaz(durum) {
  try {
    localStorage.setItem(yerelAnahtar(durum.eposta, "okunan"), JSON.stringify([...durum.okunan].slice(-400)));
    localStorage.setItem(yerelAnahtar(durum.eposta, "kapatilan"), JSON.stringify([...durum.kapatilan].slice(-400)));
  } catch (_) {}
}

/** Velinin kendi okundu durumu: kullaniciTercihleri/{eposta} (+ yerel yedek). */
export async function veliDurumuYukle() {
  const a = P();
  const eposta = veliEpostam();
  const durum = { eposta, okunan: new Set(yerelOku(eposta, "okunan")), kapatilan: new Set(yerelOku(eposta, "kapatilan")) };
  if (!eposta || !a?.fb || !a?.db) return durum;
  try {
    const snap = await a.fb.getDoc(a.fb.doc(a.db, "kullaniciTercihleri", eposta));
    if (snap.exists()) {
      const v = snap.data() || {};
      (v.okunanDuyurular || []).forEach(x => durum.okunan.add(x));
      (v.kapatilanSimsekler || []).forEach(x => durum.kapatilan.add(x));
    }
  } catch (e) { console.warn("Okundu durumu okunamadı:", e?.code || e?.message); }
  return durum;
}

/** Veli bu duyuruyu daha önce gördü mü? (kendi listesi + geçiş dönemi için eski liste) */
export function veliOkudu(d, durum) {
  if (!d || !durum) return false;
  if (durum.okunan.has(d.id)) return true;
  return (d.okuyanVeliler || []).some(x => kucuk(x) === durum.eposta);
}

export function simsekKapatildiMi(duyuruId, durum) {
  return !!(durum && duyuruId && durum.kapatilan.has(duyuruId));
}

// Korumalı okuma kaydı (personel görür). İlk görüş saati bir kez yazılır.
async function okumaKaydiYaz(duyuruId, alan) {
  const a = P();
  const eposta = veliEpostam();
  if (!a?.fb || !a?.db || !eposta || !duyuruId) return;
  const ref = a.fb.doc(a.db, "duyurular", duyuruId, "okumalar", eposta);
  try {
    const snap = await a.fb.getDoc(ref);
    if (snap.exists() && (snap.data() || {})[alan]) return;
    const simdi = new Date().toISOString();
    await a.fb.setDoc(ref, { eposta, [alan]: simdi, sonGorulme: simdi, uygulama: "portal" }, { merge: true });
  } catch (e) {
    console.warn("Okunma saati kaydedilemedi:", e?.code || e?.message);
  }
}

async function tercihEkle(eposta, alan, idler) {
  const a = P();
  if (!a?.fb?.arrayUnion || !eposta || !idler.length) return;
  try {
    await a.fb.setDoc(a.fb.doc(a.db, "kullaniciTercihleri", eposta),
      { [alan]: a.fb.arrayUnion(...idler), guncellendi: new Date().toISOString() }, { merge: true });
  } catch (e) { console.warn("Okundu durumu kaydedilemedi:", e?.code || e?.message); }
}

/**
 * Bildirimler ekranı çizildikten sonra çağrılır: listelenen duyuruları
 * velinin kendi listesine ekler; ilk kez görülenlere saatli kayıt yazar.
 */
export async function veliGorulenleriKaydet(duyurular, durum) {
  if (!durum?.eposta) return;
  const yeniler = [];
  for (const d of (duyurular || [])) {
    if (!d?.id || durum.okunan.has(d.id)) continue;
    const eskiListedeVar = (d.okuyanVeliler || []).some(x => kucuk(x) === durum.eposta);
    durum.okunan.add(d.id);
    yeniler.push(d.id);
    if (!eskiListedeVar) okumaKaydiYaz(d.id, "listedeGorulme");   // saat bilinen ilk görüş
  }
  if (!yeniler.length) return;
  yerelYaz(durum);
  await tercihEkle(durum.eposta, "okunanDuyurular", yeniler);
}

/** Şimşek popup'ta "Anladım". Duyuru belgesine e-posta YAZMAZ. */
export async function simsekKapat(duyuruId) {
  const eposta = veliEpostam();
  if (!eposta || !duyuruId) return;
  const durum = { eposta, okunan: new Set(yerelOku(eposta, "okunan")), kapatilan: new Set(yerelOku(eposta, "kapatilan")) };
  durum.okunan.add(duyuruId);
  durum.kapatilan.add(duyuruId);
  yerelYaz(durum);
  await Promise.allSettled([
    okumaKaydiYaz(duyuruId, "simsekOnay"),
    tercihEkle(eposta, "kapatilanSimsekler", [duyuruId]),
    tercihEkle(eposta, "okunanDuyurular", [duyuruId])
  ]);
}

/** Eski çağrılar için (önceki sürüm index.html). */
export async function goruldu(duyuruId, kaynak = "liste") {
  if (kaynak === "simsek") return simsekKapat(duyuruId);
  const eposta = veliEpostam();
  if (!eposta || !duyuruId) return;
  await okumaKaydiYaz(duyuruId, "listedeGorulme");
  await tercihEkle(eposta, "okunanDuyurular", [duyuruId]);
}

// ─────────────────────────── hedef veliler ───────────────────────────
// duyuruMailGonder ile aynı mantık: aktif öğrenciler, anne + baba
function hedefVeliler(d) {
  const a = P();
  const s = a?.state || {};
  const ogrenciler = s.ogrenciList || [];
  const ayarlar = s.ayarListesi || {};
  const ogretmen = !s.isAdmin && typeof a?.ogretmenMi === "function" && a.ogretmenMi();
  const siniflarim = new Set(s.siniflar || []);
  const harita = new Map();

  for (const o of ogrenciler) {
    const ayar = ayarlar[o.id];
    if (a?.ogrenciDurum?.(o, ayar) !== "aktif") continue;
    const sinif = ayar?.kayit?.sinif || o.sinif || "";
    const tur = d.hedefTur || "tumOkul";
    const dahil = tur === "tumOkul" ? true
      : tur === "sinif" ? sinif === d.hedefDeger
      : tur === "ogrenci" ? o.id === d.hedefDeger : false;
    if (!dahil) continue;
    if (ogretmen && siniflarim.size && !siniflarim.has(sinif)) continue;   // öğretmen yalnız kendi sınıfı

    const cocuk = { id: o.id, ad: o.ogrenciAdSoyad || "Öğrenci", sinif };
    for (const [rol, v] of [["Anne", ayar?.anne], ["Baba", ayar?.baba]]) {
      if (!v || (!v.eposta && !v.adSoyad)) continue;
      const eposta = kucuk(v.eposta);
      const anahtar = eposta || `yok:${o.id}:${rol.toLowerCase()}`;
      const var_ = harita.get(anahtar);
      if (var_) {
        if (!var_.cocuklar.some(c => c.id === o.id)) var_.cocuklar.push(cocuk);
        if (!var_.roller.includes(rol)) var_.roller.push(rol);
        continue;
      }
      harita.set(anahtar, { anahtar, eposta, ad: v.adSoyad || rol, roller: [rol], cocuklar: [cocuk] });
    }
  }
  return [...harita.values()];
}

function eskiOkuyanlar(d) {
  return {
    liste: new Set((d.okuyanVeliler || []).map(kucuk)),
    popup: new Set((d.popupKapatanVeliler || []).map(kucuk))
  };
}

function durumBul(veli, eski, okumalar) {
  const kayit = okumalar.get(veli.anahtar) || null;
  if (veli.eposta) {
    const adaylar = [];
    if (kayit?.listedeGorulme) adaylar.push({ zaman: kayit.listedeGorulme, kaynak: kayit.uygulama === "zeky" ? "ZEKY" : "Portal" });
    if (kayit?.simsekOnay) adaylar.push({ zaman: kayit.simsekOnay, kaynak: "Açılır pencere" });
    adaylar.sort((x, y) => String(x.zaman).localeCompare(String(y.zaman)));
    if (adaylar.length) return { durum: "gordu", ...adaylar[0], kayit };
    if (kayit?.eskiKayit) return { durum: "gordu", zaman: "", kaynak: kayit.eskiSimsek ? "Açılır pencere" : "Portal", kayit };
    if (eski.liste.has(veli.eposta)) return { durum: "gordu", zaman: "", kaynak: "Portal", kayit };
    if (eski.popup.has(veli.eposta)) return { durum: "gordu", zaman: "", kaynak: "Açılır pencere", kayit };
  }
  if (kayit?.yuzyuze?.zaman) return { durum: "yuzyuze", zaman: kayit.yuzyuze.zaman, kayit };
  return { durum: "gormedi", kayit };
}

// ─────────────────────────── liste düğmesi ───────────────────────────
/**
 * Yönetim listesindeki "12/40 gördü" düğmesi. Tıklayınca panel açılır.
 * Sayı önce eski listeden yazılır, ardından korumalı okuma kayıtları
 * sunucuda sayılıp (tek okuma) güncellenir.
 */
const sayimOnbellek = new Map();   // duyuruId → { sayi, zaman }
const sayimKuyrugu = new Set();
let sayimZamanlayici = null;

function rozetMetni(goren, hedef, eskiToplam) {
  return hedef ? `${Math.min(goren, hedef)}/${hedef} gördü` : `${eskiToplam} gördü`;
}

export function rozetHtml(d) {
  stilEkle();
  dinleyiciKur();
  aktarimBandiKontrol();
  const hedef = hedefVeliler(d).filter(v => v.eposta);
  const eski = eskiOkuyanlar(d);
  const eskiGoren = hedef.filter(v => eski.liste.has(v.eposta) || eski.popup.has(v.eposta)).length;
  const onb = sayimOnbellek.get(d.id);
  const goren = Math.max(eskiGoren, onb ? onb.sayi : 0);
  const tamam = hedef.length && goren >= hedef.length;
  if (!onb || Date.now() - onb.zaman > 60000) {
    sayimKuyrugu.add(d.id);
    clearTimeout(sayimZamanlayici);
    sayimZamanlayici = setTimeout(sayimlariCalistir, 50);
  }
  return `<button type="button" class="dok-rozet${tamam ? " dok-rozet-tamam" : ""}" data-dok-ac="${esc(d.id)}" data-dok-hedef="${hedef.length}" data-dok-eski="${eskiGoren}" data-dok-eski-toplam="${new Set([...eski.liste, ...eski.popup]).size}" title="Kimlerin gördüğünü göster">${IKON.goz}<span>${rozetMetni(goren, hedef.length, new Set([...eski.liste, ...eski.popup]).size)}</span></button>`;
}

async function sayimlariCalistir() {
  const a = P();
  const say = a?.fb?.getCountFromServer;
  if (!say || !a?.fb?.query || !a?.fb?.where) { sayimKuyrugu.clear(); return; }
  const idler = [...sayimKuyrugu];
  sayimKuyrugu.clear();
  const isci = async () => {
    while (idler.length) {
      const id = idler.shift();
      try {
        const q = a.fb.query(a.fb.collection(a.db, "duyurular", id, "okumalar"), a.fb.where("sonGorulme", ">", ""));
        const sonuc = await say(q);
        const sayi = Number(sonuc?.data?.().count) || 0;
        sayimOnbellek.set(id, { sayi, zaman: Date.now() });
        document.querySelectorAll(`[data-dok-ac="${String(id).replace(/["\\]/g, "\\$&")}"]`).forEach(b => {
          const hedef = Number(b.dataset.dokHedef) || 0;
          const goren = Math.max(Number(b.dataset.dokEski) || 0, sayi);
          const span = b.querySelector("span");
          if (span) span.textContent = rozetMetni(goren, hedef, Math.max(Number(b.dataset.dokEskiToplam) || 0, sayi));
          b.classList.toggle("dok-rozet-tamam", !!hedef && goren >= hedef);
        });
      } catch (e) { console.warn("Okunma sayısı alınamadı:", e?.code || e?.message); }
    }
  };
  await Promise.all([isci(), isci(), isci(), isci()]);
}

// ─────────────────────────── panel ───────────────────────────
let panel = null;   // { kok, d, okumalar, okumaHatasi, sekme, satirlar, gecmis, tasma, oncekiOdak, gonderiliyor }

export async function panelAc(duyuruId) {
  const a = P();
  if (!a?.fb || !duyuruId) return;
  stilEkle();
  dinleyiciKur();
  if (panel) panelKapat();

  const kok = document.createElement("div");
  kok.className = "dok-arka";
  kok.innerHTML = `<div class="dok-panel" role="dialog" aria-modal="true" aria-label="Duyuruyu kimler gördü"><div class="dok-yukleniyor"><span class="dok-donen"></span>Okunma bilgileri yükleniyor</div></div>`;
  document.body.appendChild(kok);
  panel = {
    kok, d: null, okumalar: new Map(), okumaHatasi: "", sekme: "gormedi", satirlar: [],
    gecmis: false, oncekiOdak: document.activeElement,
    tasma: [document.documentElement.style.overflow, document.body.style.overflow], gonderiliyor: false
  };
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  kok.addEventListener("click", olay => { if (olay.target === kok) panelKapat(); });
  document.addEventListener("keydown", tusDinle, true);
  try { history.pushState({ dokPanel: true }, ""); panel.gecmis = true; } catch (_) {}

  const benimPanel = panel;
  try {
    const snap = await a.fb.getDoc(a.fb.doc(a.db, "duyurular", duyuruId));
    if (!snap.exists()) throw new Error("Duyuru bulunamadı");
    if (panel !== benimPanel) return;
    panel.d = { id: snap.id, ...snap.data() };
  } catch (e) {
    if (panel !== benimPanel) return;
    kok.querySelector(".dok-panel").innerHTML = `<div class="dok-bos">Duyuru yüklenemedi: ${esc(e?.message || e)}</div><div class="dok-alt-bar"><button type="button" class="dok-ikincil" data-dok-kapat>Kapat</button></div>`;
    kok.querySelector("[data-dok-kapat]")?.addEventListener("click", () => panelKapat());
    return;
  }
  try {
    const s = await a.fb.getDocs(a.fb.collection(a.db, "duyurular", duyuruId, "okumalar"));
    if (panel !== benimPanel) return;
    s.forEach(x => panel.okumalar.set(x.id, x.data() || {}));
    sayimOnbellek.delete(duyuruId);
  } catch (e) {
    if (panel !== benimPanel) return;
    panel.okumaHatasi = izinHatasiMi(e) ? "izin" : (e?.message || "hata");
  }
  panelCiz();
}

export function panelKapat(neden) {
  if (!panel) return;
  const { kok, gecmis, tasma, oncekiOdak } = panel;
  panel = null;
  document.removeEventListener("keydown", tusDinle, true);
  kok.remove();
  document.documentElement.style.overflow = tasma[0] || "";
  document.body.style.overflow = tasma[1] || "";
  if (gecmis && neden !== "gecmis") { try { history.back(); } catch (_) {} }
  try { oncekiOdak?.focus?.({ preventScroll: true }); } catch (_) {}
}

function tusDinle(olay) {
  if (!panel) return;
  if (olay.key === "Escape" && !document.querySelector(".dek-lb")) {
    olay.preventDefault();
    olay.stopPropagation();
    panelKapat();
  }
}

function satirlariHesapla() {
  const d = panel.d;
  const eski = eskiOkuyanlar(d);
  panel.satirlar = hedefVeliler(d).map(v => ({ ...v, ...durumBul(v, eski, panel.okumalar) }));
}

function grupla(liste) {
  const gruplar = new Map();
  for (const r of liste) {
    const sinif = r.cocuklar[0]?.sinif || "Sınıfı belirsiz";
    if (!gruplar.has(sinif)) gruplar.set(sinif, []);
    gruplar.get(sinif).push(r);
  }
  const sirali = [...gruplar.entries()].sort((x, y) => x[0].localeCompare(y[0], "tr"));
  for (const [, l] of sirali) l.sort((x, y) => (x.cocuklar[0]?.ad || "").localeCompare(y.cocuklar[0]?.ad || "", "tr"));
  return sirali;
}

function satirHtml(r) {
  const cocuklar = r.cocuklar.map(c => esc(c.ad)).join(", ");
  const rol = r.roller.join(" ve ");
  // Veli iletişim bilgisi yalnız müdür ve kurucu müdüre görünür (portal kuralı: iletisimGorebilir)
  const hesap = !r.eposta ? `<span class="dok-uyari-yazi">Portal hesabı yok, e-posta kayıtlı değil</span>`
    : iletisimGorur() ? `<span class="dok-eposta">${esc(r.eposta)}</span>` : "";
  let sag = "";
  const izinYok = panel.okumaHatasi === "izin";
  if (r.durum === "gormedi") {
    sag = `<button type="button" class="dok-yuzyuze" data-dok-yuzyuze="${esc(r.anahtar)}"${izinYok ? " disabled" : ""}>${IKON.el}<span>Yüz yüze söyledim</span></button>`;
  } else if (r.durum === "yuzyuze") {
    const kim = r.kayit?.yuzyuze?.isaretleyenAd || r.kayit?.yuzyuze?.isaretleyen || "";
    sag = `<div class="dok-zaman"><span class="dok-zaman-ana">${esc(zamanYazi(r.zaman))}</span>${kim ? `<span class="dok-zaman-alt">${esc(kim)} söyledi</span>` : ""}</div>`
      + `<button type="button" class="dok-geri" data-dok-geri="${esc(r.anahtar)}"${izinYok ? " disabled" : ""}>Geri al</button>`;
  } else {
    sag = r.zaman
      ? `<div class="dok-zaman"><span class="dok-zaman-ana">${esc(zamanYazi(r.zaman))}</span><span class="dok-zaman-alt">${esc(r.kaynak)}</span></div>`
      : `<div class="dok-zaman"><span class="dok-zaman-ana">Gördü</span><span class="dok-zaman-alt">Saat kaydı yok (eski kayıt)</span></div>`;
  }
  return `<div class="dok-satir dok-${r.durum}">`
    + `<div class="dok-kim"><div class="dok-ad">${esc(r.ad)} <span class="dok-rol">${esc(rol)}</span></div>`
    + `<div class="dok-cocuk">${cocuklar}</div>${hesap}</div>`
    + `<div class="dok-sag">${sag}</div></div>`;
}

function panelCiz() {
  if (!panel?.d) return;
  satirlariHesapla();
  const d = panel.d;
  const s = panel.satirlar;
  const say = { gordu: 0, yuzyuze: 0, gormedi: 0 };
  s.forEach(r => { say[r.durum] = (say[r.durum] || 0) + 1; });
  const toplam = s.length || 1;
  const yuzde = (n) => Math.round((n / toplam) * 1000) / 10;
  const gorunen = s.filter(r => r.durum === panel.sekme);
  const hatirlatilacak = s.filter(r => r.durum === "gormedi" && r.eposta).length;
  const son = d.sonHatirlatma;

  const bilgi = panel.okumaHatasi === "izin"
    ? `<div class="dok-bilgi">Saatli kayıtlar için Firestore kuralının güncellenmesi gerekiyor. Şimdilik kimin gördüğü eski kayıtlardan gösteriliyor ve yüz yüze işareti kapalı.</div>`
    : panel.okumaHatasi ? `<div class="dok-bilgi">Saatli kayıtlar okunamadı: ${esc(panel.okumaHatasi)}</div>` : "";

  const sekme = (id, ad, n) => `<button type="button" role="tab" class="dok-sekme${panel.sekme === id ? " dok-sekme-aktif" : ""}" aria-selected="${panel.sekme === id}" data-dok-sekme="${id}">${ad}<b>${n}</b></button>`;

  const hazir = P()?.state?.ogrenciVerileriHazirMi !== false;
  const bosMetin = panel.sekme === "gormedi"
    ? (s.length ? "Hedefteki bütün veliler duyuruyu gördü ya da bilgilendirildi."
      : hazir ? "Bu duyurunun hedefinde aktif öğrenci velisi bulunamadı." : "Öğrenci listesi henüz yükleniyor. Birkaç saniye sonra paneli yeniden açın.")
    : panel.sekme === "yuzyuze" ? "Yüz yüze bilgilendirme işaretlenmedi. Görmeyenler sekmesinden işaretleyebilirsiniz."
    : "Henüz gören veli yok.";

  const liste = gorunen.length
    ? grupla(gorunen).map(([sinif, l]) => `<section class="dok-grup"><h4>${esc(sinif)} <span>${l.length}</span></h4>${l.map(satirHtml).join("")}</section>`).join("")
    : `<div class="dok-bos">${bosMetin}</div>`;

  const altBar = panel.sekme === "gormedi" && say.gormedi
    ? `<div class="dok-alt-bar">`
      + `<div class="dok-alt-not">${son?.zaman ? `Son hatırlatma ${esc(zamanYazi(son.zaman))} tarihinde ${Number(son.sayi) || 0} veliye gönderildi.` : "Yüz yüze söylenenler hatırlatma e-postası almaz."}</div>`
      + `<div class="dok-alt-dugmeler"><button type="button" class="dok-ikincil" data-dok-kopyala>${IKON.kopya}<span>Listeyi kopyala</span></button>`
      + `<button type="button" class="dok-birincil" data-dok-hatirlat${hatirlatilacak && !panel.gonderiliyor ? "" : " disabled"}>${IKON.mail}<span>${panel.gonderiliyor ? "Gönderiliyor" : `Görmeyenlere e-posta gönder (${hatirlatilacak})`}</span></button></div>`
      + `</div>`
    : "";

  panel.kok.querySelector(".dok-panel").innerHTML =
    `<header class="dok-bas"><div class="dok-bas-metin"><h3>${esc(d.baslik || "Duyuru")}</h3>`
    + `<p>${esc(hedefYazi(d))} için, ${esc(zamanYazi(d.olusturuldu, false))} yayınlandı.</p></div>`
    + `<button type="button" class="dok-kapat" data-dok-kapat aria-label="Kapat">${IKON.x}</button></header>`
    + `<div class="dok-ozet">`
    + `<div class="dok-cubuk" aria-hidden="true"><span class="dok-c-gordu" style="width:${yuzde(say.gordu)}%"></span><span class="dok-c-yuzyuze" style="width:${yuzde(say.yuzyuze)}%"></span></div>`
    + `<p class="dok-ozet-metin"><strong>${say.gordu}</strong> veli gördü, <strong>${say.gormedi}</strong> veli görmedi${say.yuzyuze ? `, <strong>${say.yuzyuze}</strong> veliye yüz yüze söylendi` : ""}.</p>`
    + `</div>${bilgi}`
    + `<div class="dok-sekmeler" role="tablist">${sekme("gormedi", "Görmeyenler", say.gormedi)}${sekme("yuzyuze", "Yüz yüze", say.yuzyuze)}${sekme("gordu", "Görenler", say.gordu)}</div>`
    + `<div class="dok-liste">${liste}</div>${altBar}`;

  const k = panel.kok;
  k.querySelector("[data-dok-kapat]")?.addEventListener("click", () => panelKapat());
  k.querySelectorAll("[data-dok-sekme]").forEach(b => b.addEventListener("click", () => { panel.sekme = b.dataset.dokSekme; panelCiz(); }));
  k.querySelectorAll("[data-dok-yuzyuze]").forEach(b => b.addEventListener("click", () => yuzyuzeIsaretle(b.dataset.dokYuzyuze, false, b)));
  k.querySelectorAll("[data-dok-geri]").forEach(b => b.addEventListener("click", () => yuzyuzeIsaretle(b.dataset.dokGeri, true, b)));
  k.querySelector("[data-dok-kopyala]")?.addEventListener("click", listeyiKopyala);
  k.querySelector("[data-dok-hatirlat]")?.addEventListener("click", hatirlatmaGonder);
  if (!k.contains(document.activeElement)) k.querySelector("[data-dok-kapat]")?.focus({ preventScroll: true });
}

async function yuzyuzeIsaretle(anahtar, geriAl, dugme) {
  const a = P();
  if (!panel?.d || !a?.fb) return;
  const r = panel.satirlar.find(x => x.anahtar === anahtar);
  if (!r) return;
  if (dugme) dugme.disabled = true;
  const s = a.state || {};
  const ben = kucuk(s.currentUser?.email);
  const ref = a.fb.doc(a.db, "duyurular", panel.d.id, "okumalar", anahtar);
  const yuzyuze = { zaman: new Date().toISOString(), isaretleyen: ben, isaretleyenAd: s.personel?.adSoyad || s.currentUser?.displayName || ben };
  try {
    if (geriAl) await a.fb.setDoc(ref, { yuzyuze: a.fb.deleteField() }, { merge: true });
    else await a.fb.setDoc(ref, { eposta: r.eposta || "", yuzyuze }, { merge: true });
    const kayit = { ...(panel.okumalar.get(anahtar) || {}), eposta: r.eposta || "" };
    if (geriAl) delete kayit.yuzyuze; else kayit.yuzyuze = yuzyuze;
    panel.okumalar.set(anahtar, kayit);
    toast(geriAl ? "Yüz yüze işareti kaldırıldı" : `${r.ad} yüz yüze bilgilendirildi olarak işaretlendi`);
    panelCiz();
  } catch (e) {
    if (dugme) dugme.disabled = false;
    toast(izinHatasiMi(e) ? "Bu işlem için Firestore kuralının güncellenmesi gerekiyor" : "Kaydedilemedi: " + (e?.message || e), "error");
  }
}

async function listeyiKopyala() {
  if (!panel?.d) return;
  const gormeyen = panel.satirlar.filter(r => r.durum === "gormedi");
  const satirlar = [`${panel.d.baslik || "Duyuru"}`, `Görmeyen veliler (${gormeyen.length}):`];
  for (const [sinif, l] of grupla(gormeyen)) {
    satirlar.push("", sinif);
    l.forEach(r => satirlar.push(`- ${r.ad} (${r.roller.join(" ve ")}), ${r.cocuklar.map(c => c.ad).join(", ")}${r.eposta ? "" : ", portal hesabı yok"}`));
  }
  const metin = satirlar.join("\n");
  try {
    await navigator.clipboard.writeText(metin);
  } catch (_) {
    const t = document.createElement("textarea");
    t.value = metin;
    t.style.cssText = "position:fixed; opacity:0; top:0; left:0;";
    document.body.appendChild(t);
    t.select();
    try { document.execCommand("copy"); } catch (_) {}
    t.remove();
  }
  toast("Görmeyenler listesi kopyalandı");
}

function hatirlatmaIcerik(d, ad, ekHtml) {
  const metin = esc(d.icerik || "").replace(/\n/g, "<br>");
  return `
    <p style="margin:0 0 14px; font-size:15px;">Sayın <strong>${esc(ad)}</strong>,</p>
    <p style="margin:0 0 12px; font-size:14px; color:#374151; line-height:1.7;">Okulumuzun aşağıdaki duyurusunu hatırlatmak isteriz.</p>
    <div style="background:#fefce8; border-left:4px solid #eab308; border-radius:8px; padding:16px 20px; margin:16px 0;">
      <h3 style="margin:0 0 10px; color:#1f2937; font-size:18px;">${esc(d.baslik || "Duyuru")}</h3>
      <div style="font-size:14px; color:#374151; line-height:1.7;">${metin}</div>
      ${ekHtml || ""}
    </div>
    <p style="margin:16px 0 0; font-size:13px; color:#6b7280; line-height:1.7;">Duyuruyu <strong>portal.bircicekkoleji.com</strong> üzerinden <strong>Bildirimler</strong> sekmesinde de görebilirsiniz.</p>
    <p style="margin:20px 0 0; font-size:13px; color:#374151;">Saygılarımızla,<br><strong>Bir Çiçek Koleji Anaokulu</strong></p>`;
}

async function hatirlatmaGonder() {
  const a = P();
  if (!panel?.d || panel.gonderiliyor) return;
  const benimPanel = panel;
  const alicilar = panel.satirlar.filter(r => r.durum === "gormedi" && r.eposta);
  if (!alicilar.length) return toast("E-posta gönderilecek veli yok", "info");
  if (!a?.mail?.gonder || !a?.mail?.sablon) return toast("E-posta servisi hazır değil, sayfayı yenileyip tekrar deneyin", "error");
  if (!confirm(`${alicilar.length} veliye "${panel.d.baslik || "Duyuru"}" için hatırlatma e-postası gönderilecek. Devam edilsin mi?`)) return;

  panel.gonderiliyor = true;
  panelCiz();
  const d = panel.d;
  let ekHtml = "";
  if (Array.isArray(d.ekler) && d.ekler.length) {
    try { const m = await window.modulYukle?.("duyuru-ekleri"); ekHtml = m?.mailHtml?.(d.ekler) || ""; } catch (_) {}
  }
  let basarili = 0, hatali = 0;
  for (const r of alicilar) {
    try {
      const sonuc = await a.mail.gonder({
        to: r.eposta, toName: r.ad,
        subject: `🔔 Hatırlatma: ${d.baslik || "Duyuru"}`,
        htmlContent: a.mail.sablon(d.baslik || "Duyuru", hatirlatmaIcerik(d, r.ad, ekHtml), "Bu hatırlatma okul yönetimi tarafından gönderilmiştir.")
      });
      if (sonuc && sonuc.success === false) hatali++; else basarili++;
    } catch (_) { hatali++; }
    await new Promise(ok => setTimeout(ok, 300));
  }
  const s = a.state || {};
  const son = { zaman: new Date().toISOString(), gonderen: kucuk(s.currentUser?.email), gonderenAd: s.personel?.adSoyad || "", sayi: basarili };
  try { await a.fb.updateDoc(a.fb.doc(a.db, "duyurular", d.id), { sonHatirlatma: son }); } catch (e) { console.warn("Hatırlatma kaydı yazılamadı:", e?.message); }
  if (panel === benimPanel) {
    panel.gonderiliyor = false;
    panel.d.sonHatirlatma = son;
    panelCiz();
  }
  toast(hatali ? `${basarili} veliye gönderildi, ${hatali} e-posta gönderilemedi` : `📧 ${basarili} veliye hatırlatma gönderildi`, hatali ? "error" : undefined);
}


// ─────────────────────────── eski kayıtları aktarma (tek seferlik) ───────────────────────────
// duyurular/{id}.okuyanVeliler + .popupKapatanVeliler →
//   • duyurular/{id}/okumalar/{eposta}  { eskiKayit: true, ... }  (personel paneli)
//   • kullaniciTercihleri/{eposta}      okunanDuyurular / kapatilanSimsekler (veli)
// Hiçbir şeyi SİLMEZ. Tekrar çalıştırmak güvenlidir.
// Kural: genel yönetici izni (isAdmin / isKurucuMudur) yeterlidir.
let aktarimKontrolEdildi = false;
function yoneticiMi() {
  const s = P()?.state || {};
  return !!s.isAdmin || s.rol === "kurucu_mudur";
}

async function aktarimBandiKontrol() {
  if (aktarimKontrolEdildi || !yoneticiMi()) return;
  aktarimKontrolEdildi = true;
  const a = P();
  if (!a?.fb || !a?.db) return;
  try {
    const snap = await a.fb.getDoc(a.fb.doc(a.db, "ayarlar", "duyuruOkumaAktarim"));
    if (snap.exists() && snap.data()?.sonAktarim) return;
  } catch (_) { return; }
  const liste = document.getElementById("duyurularListesi");
  if (!liste || document.getElementById("dokAktarimBandi")) return;
  const bant = document.createElement("div");
  bant.id = "dokAktarimBandi";
  bant.className = "dok-bant";
  bant.innerHTML = `<div class="dok-bant-metin"><strong>Eski okuma kayıtları yeni sisteme aktarılmadı.</strong> `
    + `Aktarım, velilerin e-postalarını duyurulardan kaldırmadan önceki ilk adımdır. Hiçbir kaydı silmez, tekrar çalıştırılabilir.</div>`
    + `<button type="button" class="dok-birincil" data-dok-aktar>Şimdi aktar</button>`;
  liste.parentNode.insertBefore(bant, liste);
  bant.querySelector("[data-dok-aktar]").addEventListener("click", () => eskiKayitlariAktar(bant));
}

export async function eskiKayitlariAktar(bant) {
  const a = P();
  if (!a?.fb?.writeBatch || !yoneticiMi()) return toast("Bu işlem yalnız kurucu müdür hesabıyla yapılabilir", "error");
  if (!confirm("Eski okuma kayıtları yeni yapıya aktarılacak. Hiçbir kayıt silinmez. Devam edilsin mi?")) return;
  const dugme = bant?.querySelector("[data-dok-aktar]");
  const yaz = (m) => { const el = bant?.querySelector(".dok-bant-metin"); if (el) el.textContent = m; };
  if (dugme) dugme.disabled = true;
  const { db, fb } = a;
  let toplu = fb.writeBatch(db), bekleyen = 0, okumaSayisi = 0, duyuruSayisi = 0;
  const bosalt = async () => { if (bekleyen) { await toplu.commit(); toplu = fb.writeBatch(db); bekleyen = 0; } };
  const veliler = new Map();
  try {
    const dSnap = await fb.getDocs(fb.collection(db, "duyurular"));
    let sira = 0;
    for (const ds of dSnap.docs) {
      sira++;
      const d = ds.data() || {};
      const liste = new Set((d.okuyanVeliler || []).map(kucuk).filter(Boolean));
      const popup = new Set((d.popupKapatanVeliler || []).map(kucuk).filter(Boolean));
      if (!liste.size && !popup.size) continue;
      duyuruSayisi++;
      yaz(`Aktarılıyor: ${sira}/${dSnap.size} duyuru`);
      const mevcut = new Map();
      (await fb.getDocs(fb.collection(db, "duyurular", ds.id, "okumalar"))).forEach(x => mevcut.set(x.id, x.data() || {}));
      for (const e of new Set([...liste, ...popup])) {
        if (e.includes("/")) continue;
        const v = mevcut.get(e) || {};
        if (!v.listedeGorulme && !v.simsekOnay && !v.eskiKayit) {
          const veri = { eposta: e, eskiKayit: true, sonGorulme: v.sonGorulme || d.olusturuldu || "eski" };
          if (popup.has(e) && !liste.has(e)) veri.eskiSimsek = true;
          toplu.set(fb.doc(db, "duyurular", ds.id, "okumalar", e), veri, { merge: true });
          bekleyen++; okumaSayisi++;
          if (bekleyen >= 450) await bosalt();
        }
        const b = veliler.get(e) || { okunan: new Set(), kapatilan: new Set() };
        b.okunan.add(ds.id);
        if (popup.has(e)) b.kapatilan.add(ds.id);
        veliler.set(e, b);
      }
    }
    yaz(`Velilerin kendi listeleri güncelleniyor (${veliler.size} veli)`);
    for (const [e, b] of veliler) {
      const veri = { okunanDuyurular: fb.arrayUnion(...b.okunan) };
      if (b.kapatilan.size) veri.kapatilanSimsekler = fb.arrayUnion(...b.kapatilan);
      toplu.set(fb.doc(db, "kullaniciTercihleri", e), veri, { merge: true });
      bekleyen++;
      if (bekleyen >= 450) await bosalt();
    }
    await bosalt();
    const s = a.state || {};
    await fb.setDoc(fb.doc(db, "ayarlar", "duyuruOkumaAktarim"), {
      sonAktarim: new Date().toISOString(), yapan: kucuk(s.currentUser?.email),
      duyuruSayisi, okumaKaydi: okumaSayisi, veliSayisi: veliler.size
    }, { merge: true });
    sayimOnbellek.clear();
    yaz(`Tamamlandı: ${duyuruSayisi} duyurudan ${okumaSayisi} okuma kaydı ve ${veliler.size} velinin kendi listesi aktarıldı.`);
    if (dugme) dugme.remove();
    toast("Eski okuma kayıtları aktarıldı");
    setTimeout(() => bant?.remove(), 8000);
  } catch (e) {
    console.error("Aktarım hatası:", e);
    yaz(`Aktarım yarıda kaldı: ${e?.message || e}. Tekrar çalıştırabilirsiniz, aktarılanlar yinelenmez.`);
    if (dugme) dugme.disabled = false;
  }
}

// ─────────────────────────── dinleyiciler ───────────────────────────
let dinleyiciKurulu = false;
function dinleyiciKur() {
  if (dinleyiciKurulu || typeof document === "undefined") return;
  dinleyiciKurulu = true;
  document.addEventListener("click", olay => {
    const b = olay.target?.closest?.("[data-dok-ac]");
    if (!b) return;
    olay.preventDefault();
    olay.stopPropagation();
    panelAc(b.dataset.dokAc);
  });
  window.addEventListener("popstate", () => { if (panel && !document.querySelector(".dek-lb")) panelKapat("gecmis"); });
}

// ─────────────────────────── stil ───────────────────────────
function stilEkle() {
  if (typeof document === "undefined" || document.getElementById("duyuruOkunmaStil")) return;
  const st = document.createElement("style");
  st.id = "duyuruOkunmaStil";
  st.textContent = `
.dok-rozet { display:inline-flex; align-items:center; gap:5px; margin-top:4px; padding:5px 10px; min-height:32px; border-radius:999px; border:1px solid #CFE3D6; background:#F2F8F4; color:#2d6a4f; font:600 12px var(--font-body,inherit); cursor:pointer; white-space:nowrap; }
.dok-rozet:hover { background:#E3F1E8; border-color:#9FCBB0; }
.dok-rozet:focus-visible { outline:3px solid var(--green-light,#C9D1F0); outline-offset:2px; }
.dok-rozet svg { width:14px; height:14px; flex-shrink:0; }
.dok-rozet-tamam { background:#2d6a4f; border-color:#2d6a4f; color:#fff; }
.dok-rozet-tamam:hover { background:#255a42; }

.dok-bant { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:0 0 12px; padding:12px 14px; border-radius:12px; background:#FFF8E8; border:1px solid #F0CF86; color:#5C3B00; font-size:13px; line-height:1.5; }
.dok-bant-metin { flex:1; min-width:220px; }
.dok-arka { position:fixed; inset:0; z-index:1050; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; padding:20px; animation:dokAc .15s ease-out; }
@keyframes dokAc { from { opacity:0; } to { opacity:1; } }
.dok-panel { background:#fff; width:100%; max-width:680px; max-height:min(88vh, 860px); border-radius:var(--radius-lg,24px); box-shadow:var(--shadow-lg,0 18px 40px rgba(30,41,90,.14)); display:flex; flex-direction:column; overflow:hidden; color:var(--ink,#1F2544); font-family:var(--font-body,inherit); }
.dok-yukleniyor, .dok-bos { padding:40px 24px; text-align:center; color:var(--ink-soft,#4A5169); font-size:14px; line-height:1.6; }
.dok-yukleniyor { display:flex; align-items:center; justify-content:center; gap:10px; }
.dok-donen { width:16px; height:16px; border:2px solid var(--green-medium,#5A6ACF); border-right-color:transparent; border-radius:50%; animation:dokDon .8s linear infinite; display:inline-block; }
@keyframes dokDon { to { transform:rotate(360deg); } }
.dok-bas { display:flex; align-items:flex-start; gap:12px; padding:20px 20px 12px 24px; }
.dok-bas-metin { flex:1; min-width:0; }
.dok-bas h3 { margin:0; font-size:18px; line-height:1.35; font-weight:700; color:var(--green-deep,#1F2544); overflow-wrap:anywhere; }
.dok-bas p { margin:4px 0 0; font-size:13px; color:var(--gray-500,#8A92A6); }
.dok-kapat { width:44px; height:44px; flex-shrink:0; border:0; border-radius:50%; background:var(--gray-100,#F1F2F7); color:var(--ink-soft,#4A5169); display:flex; align-items:center; justify-content:center; cursor:pointer; }
.dok-kapat:hover { background:var(--gray-300,#D8DCE9); }
.dok-kapat svg { width:20px; height:20px; }
.dok-ozet { padding:0 24px 14px; }
.dok-cubuk { display:flex; height:10px; border-radius:999px; overflow:hidden; background:#E7E9F0; }
.dok-c-gordu { background:#2d6a4f; }
.dok-c-yuzyuze { background:#D69E2E; }
.dok-ozet-metin { margin:10px 0 0; font-size:14px; color:var(--ink-soft,#4A5169); line-height:1.5; }
.dok-ozet-metin strong { color:var(--ink,#1F2544); }
.dok-bilgi { margin:0 24px 12px; padding:10px 12px; border-radius:10px; background:#FFF7E6; border:1px solid #F6D58E; color:#7A4B00; font-size:12.5px; line-height:1.5; }
.dok-sekmeler { display:flex; gap:6px; padding:0 24px 10px; border-bottom:1px solid var(--gray-100,#F1F2F7); overflow-x:auto; }
.dok-sekme { display:inline-flex; align-items:center; gap:7px; min-height:40px; padding:8px 14px; border-radius:999px; border:1px solid var(--gray-300,#D8DCE9); background:#fff; color:var(--ink-soft,#4A5169); font:600 13px var(--font-body,inherit); cursor:pointer; white-space:nowrap; }
.dok-sekme b { font-weight:700; font-size:12px; padding:1px 7px; border-radius:999px; background:var(--gray-100,#F1F2F7); color:var(--ink,#1F2544); }
.dok-sekme-aktif { background:var(--green-deep,#1F2544); border-color:var(--green-deep,#1F2544); color:#fff; }
.dok-sekme-aktif b { background:rgba(255,255,255,.2); color:#fff; }
.dok-sekme:focus-visible { outline:3px solid var(--green-light,#C9D1F0); outline-offset:2px; }
.dok-liste { flex:1 1 auto; min-height:0; overflow-y:auto; padding:6px 24px 18px; overscroll-behavior:contain; }
/* Üst bölüm, sekmeler ve alt bar asla sıkışmasın; yalnız liste kayar */
.dok-bas, .dok-ozet, .dok-bilgi, .dok-sekmeler, .dok-alt-bar { flex-shrink:0; }
.dok-grup h4 { position:sticky; top:0; z-index:1; margin:0; padding:12px 0 6px; background:#fff; font-size:13px; font-weight:700; color:var(--green-primary,#2B3674); }
.dok-grup h4 span { font-weight:600; color:var(--gray-500,#8A92A6); margin-left:4px; }
.dok-satir { display:flex; align-items:center; gap:12px; padding:11px 0; border-top:1px solid var(--gray-100,#F1F2F7); }
.dok-kim { flex:1; min-width:0; }
.dok-ad { font-size:14px; font-weight:600; color:var(--ink,#1F2544); }
.dok-rol { font-size:12px; font-weight:500; color:var(--gray-500,#8A92A6); margin-left:2px; }
.dok-cocuk { font-size:13px; color:var(--ink-soft,#4A5169); margin-top:2px; }
.dok-eposta, .dok-uyari-yazi { display:block; font-size:12px; color:var(--gray-500,#8A92A6); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dok-uyari-yazi { color:#9A3412; }
.dok-sag { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.dok-zaman { display:flex; flex-direction:column; align-items:flex-end; text-align:right; }
.dok-zaman-ana { font-size:13px; font-weight:600; color:var(--ink,#1F2544); }
.dok-zaman-alt { font-size:12px; color:var(--gray-500,#8A92A6); }
.dok-yuzyuze, .dok-geri, .dok-ikincil, .dok-birincil { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:40px; padding:8px 12px; border-radius:10px; font:600 13px var(--font-body,inherit); cursor:pointer; white-space:nowrap; }
.dok-yuzyuze { border:1px solid #F0CF86; background:#FFF8E8; color:#7A4B00; }
.dok-yuzyuze:hover:not(:disabled) { background:#FDEFCB; }
.dok-geri { border:1px solid var(--gray-300,#D8DCE9); background:#fff; color:var(--ink-soft,#4A5169); }
.dok-ikincil { border:1px solid var(--gray-300,#D8DCE9); background:#fff; color:var(--ink,#1F2544); }
.dok-birincil { border:0; background:var(--green-deep,#1F2544); color:#fff; }
.dok-birincil:hover:not(:disabled) { background:var(--green-primary,#2B3674); }
.dok-yuzyuze:disabled, .dok-geri:disabled, .dok-birincil:disabled { opacity:.5; cursor:not-allowed; }
.dok-yuzyuze svg, .dok-ikincil svg, .dok-birincil svg { width:16px; height:16px; flex-shrink:0; }
.dok-yuzyuze:focus-visible, .dok-geri:focus-visible, .dok-ikincil:focus-visible, .dok-birincil:focus-visible { outline:3px solid var(--green-light,#C9D1F0); outline-offset:2px; }
.dok-alt-bar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:12px 24px calc(14px + env(safe-area-inset-bottom, 0px)); border-top:1px solid var(--gray-100,#F1F2F7); background:var(--warm-white,#F7F8FC); }
.dok-alt-not { flex:1; min-width:200px; font-size:12px; color:var(--gray-500,#8A92A6); line-height:1.5; }
.dok-alt-dugmeler { display:flex; gap:8px; flex-wrap:wrap; }
@media (max-width:640px) {
  .dok-arka { padding:0; align-items:flex-end; }
  .dok-panel { max-width:none; max-height:94vh; border-radius:20px 20px 0 0; }
  .dok-bas { padding:16px 12px 10px 16px; }
  .dok-ozet, .dok-sekmeler, .dok-liste { padding-left:16px; padding-right:16px; }
  .dok-bilgi { margin-left:16px; margin-right:16px; }
  .dok-alt-bar { padding-left:16px; padding-right:16px; }
  .dok-satir { flex-wrap:wrap; }
  .dok-sag { width:100%; justify-content:space-between; }
  .dok-zaman { align-items:flex-start; text-align:left; }
  .dok-yuzyuze { flex:1; }
  .dok-alt-dugmeler { width:100%; }
  .dok-alt-dugmeler > button { flex:1; }
}
@media (prefers-reduced-motion:reduce) { .dok-arka, .dok-donen { animation:none; } }
`;
  document.head.appendChild(st);
}

// ─────────────────────────── başlat ───────────────────────────
if (typeof window !== "undefined") {
  stilEkle();
  dinleyiciKur();
  window.duyuruOkunma = {
    goruldu, rozetHtml, panelAc, panelKapat, veliDurumuYukle, veliOkudu,
    veliGorulenleriKaydet, simsekKapatildiMi, simsekKapat, eskiKayitlariAktar
  };
}
