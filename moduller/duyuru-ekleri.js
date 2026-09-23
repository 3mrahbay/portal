// ══════════════════════════════════════════════════════════════
// PORTAL · DUYURU EKLERİ (resim + dosya)
// --------------------------------------------------------------
// 1) Duyuru oluştur/düzenle penceresine resim ve dosya ekleme
// 2) Duyuru listelerinde eklerin gösterimi (yönetim listesi,
//    veli Bildirimler sekmesi, şimşek popup, e-posta)
// 3) Resme dokununca tam ekran görüntüleyici (X ile kapanır,
//    ESC / geri tuşu / arka plana dokunma da kapatır)
//
// Veri modeli — duyurular/{id}.ekler (ZEKY ile ortak alan):
//   [{ tur: "resim"|"dosya", url, yol, ad, boyut, mime,
//      en?, boy?, yuklendi }]
//   url : Bunny CDN adresi   ·   yol : Bunny'den silmek için yol
//
// Yükleme PortalAPI.medya.yukle ile yapılır (Apps Script proxy →
// Bunny.net). Firestore'a base64 YAZILMAZ, yalnızca URL yazılır.
//
// index.html bu modülü modulYukle("duyuru-ekleri") ile yükler.
// Senkron erişim gereken yerler için window.duyuruEkleri de açılır.
// ══════════════════════════════════════════════════════════════

const MB = 1024 * 1024;
const MAKS_EK = 10;                 // bir duyurudaki en fazla ek
const RESIM_MAKS_KENAR = 2048;      // uzun kenar (px) — daha büyükse küçültülür
const RESIM_KALITE = 0.86;          // JPEG kalitesi
const RESIM_GIRDI_MAKS_MB = 30;     // sıkıştırma ÖNCESİ kabul edilen boyut
const DOSYA_MAKS_MB = 15;           // medyaDogrula ile aynı sınır
const DOSYA_UZANTILARI = ["pdf", "doc", "docx", "xls", "xlsx", "txt", "zip"];
const RESIM_UZANTILARI = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
const KABUL = "image/*," + DOSYA_UZANTILARI.map(u => "." + u).join(",");
const KLASOR_KOK = "duyurular";     // Bunny klasörü — silme yalnızca bunun içinde yapılır

const IKON = {
  atac: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  buyut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/></svg>',
  sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  sag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  ac: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
};

// ─────────────────────────── yardımcılar ───────────────────────────
const api = () => (typeof window !== "undefined" ? window.PortalAPI : null) || null;
function toast(mesaj, tip) { try { api()?.toast?.(mesaj, tip); } catch (_) {} }

function esc(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function uzanti(ad) {
  const p = String(ad || "").split(".");
  return p.length > 1 ? p.pop().toLowerCase() : "";
}
function boyutYazi(b) {
  const n = Number(b) || 0;
  if (!n) return "";
  if (n < 1024) return n + " B";
  if (n < MB) return Math.round(n / 1024) + " KB";
  return (n / MB).toFixed(1).replace(".", ",") + " MB";
}
function guvenliUrl(u) { return typeof u === "string" && /^https:\/\//i.test(u) ? u : ""; }
function gecerliEk(e) { return !!(e && typeof e === "object" && guvenliUrl(e.url)); }
function gifMi(e) { return /gif/i.test(e?.mime || "") || /\.gif(\?|$)/i.test(e?.url || ""); }

// Bunny Optimizer açıksa ?width= ile küçük sürüm gelir; kapalıysa parametre yok sayılır.
function boyutluUrl(url, en, ek) {
  const u = guvenliUrl(url);
  if (!u || !en || gifMi(ek)) return u;   // GIF'te animasyon bozulmasın
  return u + (u.includes("?") ? "&" : "?") + "width=" + en;
}
function resimMi(dosya) {
  return String(dosya?.type || "").startsWith("image/") || RESIM_UZANTILARI.includes(uzanti(dosya?.name));
}
// Bunny yolu için güvenli ve benzersiz dosya adı (Türkçe karakterler sadeleşir)
function guvenliDosyaAdi(ad, yeniUzanti) {
  const harita = { "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G", "ı": "i", "İ": "I", "ö": "o", "Ö": "O", "ş": "s", "Ş": "S", "ü": "u", "Ü": "U" };
  let govde = String(ad || "dosya").replace(/\.[^.]+$/, "");
  govde = govde.replace(/[çÇğĞıİöÖşŞüÜ]/g, h => harita[h])
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 60) || "dosya";
  const uz = String(yeniUzanti || uzanti(ad) || "bin").toLowerCase();
  const on = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `${on}-${govde}.${uz}`;
}
// Bunny'den sil — yalnızca duyurular/ klasöründeki dosyalar (galeri vb. asla silinmez)
function bunnySil(yol) {
  if (!yol || !String(yol).includes(KLASOR_KOK + "/")) return;
  try {
    const p = api()?.medya?.sil?.(yol);
    if (p && typeof p.catch === "function") p.catch(e => console.warn("Duyuru eki silinemedi:", e?.message || e));
  } catch (e) { console.warn("Duyuru eki silinemedi:", e?.message || e); }
}

// ─────────────────────────── resim hazırlama ───────────────────────────
function resimAc(dosya) {
  return new Promise((ok, hata) => {
    const url = URL.createObjectURL(dosya);
    const img = new Image();
    img.onload = () => ok({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      hata(new Error("Bu resim açılamadı. HEIC ise JPG olarak kaydedip tekrar deneyin"));
    };
    img.src = url;
  });
}

async function resimHazirla(dosya) {
  // GIF olduğu gibi gider (animasyon korunur)
  if (dosya.type === "image/gif" || uzanti(dosya.name) === "gif") {
    let olcu = null;
    try {
      const { img, url } = await resimAc(dosya);
      olcu = { en: img.naturalWidth, boy: img.naturalHeight };
      URL.revokeObjectURL(url);
    } catch (_) {}
    return { dosya: new File([dosya], guvenliDosyaAdi(dosya.name, "gif"), { type: "image/gif" }), olcu };
  }

  const { img, url } = await resimAc(dosya);
  try {
    const en0 = img.naturalWidth || img.width;
    const boy0 = img.naturalHeight || img.height;
    if (!en0 || !boy0) throw new Error("Resim okunamadı");
    const oran = Math.min(1, RESIM_MAKS_KENAR / Math.max(en0, boy0));
    const en = Math.max(1, Math.round(en0 * oran));
    const boy = Math.max(1, Math.round(boy0 * oran));
    const tip = String(dosya.type || "").toLowerCase();

    // Zaten küçük JPEG/WEBP ise tekrar sıkıştırma (kalite kaybı olmasın)
    if (oran === 1 && (tip === "image/jpeg" || tip === "image/webp") && dosya.size <= 900 * 1024) {
      return {
        dosya: new File([dosya], guvenliDosyaAdi(dosya.name, tip === "image/webp" ? "webp" : "jpg"), { type: tip }),
        olcu: { en, boy }
      };
    }

    const tuval = document.createElement("canvas");
    tuval.width = en;
    tuval.height = boy;
    const ctx = tuval.getContext("2d");
    ctx.fillStyle = "#ffffff";                 // şeffaf PNG siyaha dönmesin
    ctx.fillRect(0, 0, en, boy);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, en, boy);
    const blob = await new Promise(ok => tuval.toBlob(ok, "image/jpeg", RESIM_KALITE));
    if (!blob) throw new Error("Resim işlenemedi");
    return { dosya: new File([blob], guvenliDosyaAdi(dosya.name, "jpg"), { type: "image/jpeg" }), olcu: { en, boy } };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─────────────────────────── form durumu ───────────────────────────
let oturum = 0;          // her form açılışında artar; eski yüklemeler geçersiz kalır
let formAcik = false;
let kaydedildi = true;
let ogeler = [];         // { anahtar, durum:"yukleniyor"|"hazir"|"hata", yeni, ek, onizleme, hata, iptal, dosya }
let kaldirilanlar = [];  // kayıttan SONRA Bunny'den silinecek (mevcut ekler)
let sayac = 0;
const yeniAnahtar = () => "dek" + (++sayac);

function onizlemeBirak(o) {
  if (o?.onizleme) { try { URL.revokeObjectURL(o.onizleme); } catch (_) {} o.onizleme = ""; }
}

/** Form açılışında çağrılır. mevcut: düzenlenen duyurunun ekleri (yeni duyuruda []). */
export function formHazirla(mevcut) {
  stilEkle();
  formKapandi();          // önceki oturumdan kalan kaydedilmemiş yüklemeleri temizler
  oturum++;
  formAcik = true;
  kaydedildi = false;
  kaldirilanlar = [];
  ogeler = (Array.isArray(mevcut) ? mevcut : []).filter(gecerliEk).map(ek => ({
    anahtar: yeniAnahtar(), durum: "hazir", yeni: false, ek: { ...ek }, onizleme: ""
  }));
  alaniCiz();
}

/** Pencere kapanınca çağrılır. Kaydedilmeden kapatıldıysa yeni yüklenenler silinir. */
export function formKapandi() {
  if (!kaydedildi) {
    ogeler.forEach(o => { if (o.yeni && o.durum === "hazir" && o.ek?.yol) bunnySil(o.ek.yol); });
  }
  ogeler.forEach(onizlemeBirak);
  ogeler = [];
  kaldirilanlar = [];
  kaydedildi = true;
  formAcik = false;
  oturum++;               // yolda olan yüklemeler bitince kendini siler
}

export function yuklemeSuruyor() {
  return ogeler.some(o => o.durum === "yukleniyor");
}

/** Firestore'a yazılacak temiz ek listesi (yüklenemeyenler hariç). */
export function formEkleri() {
  return ogeler.filter(o => o.durum === "hazir" && gecerliEk(o.ek)).map(o => temizEk(o.ek));
}

/** Duyuru başarıyla kaydedildikten sonra çağrılır. */
export function kayitTamamlandi() {
  kaydedildi = true;
  ogeler.forEach(o => { o.yeni = false; });
  kaldirilanlar.forEach(bunnySil);
  kaldirilanlar = [];
}

/** Duyuru silinince eklerini Bunny'den temizler. */
export function ekleriSil(ekler) {
  (Array.isArray(ekler) ? ekler : []).forEach(e => { if (e?.yol) bunnySil(e.yol); });
}

function temizEk(e) {
  const t = {
    tur: e.tur === "resim" ? "resim" : "dosya",
    url: e.url,
    yol: e.yol || "",
    ad: String(e.ad || "").slice(0, 160),
    boyut: Number(e.boyut) || 0,
    mime: e.mime || "",
    yuklendi: e.yuklendi || ""
  };
  if (e.en && e.boy) { t.en = Number(e.en) || 0; t.boy = Number(e.boy) || 0; }
  return t;
}

function onDogrula(dosya, resim) {
  if (resim) {
    if (dosya.size > RESIM_GIRDI_MAKS_MB * MB) return `Resim çok büyük (en fazla ${RESIM_GIRDI_MAKS_MB} MB)`;
    if ((dosya.type === "image/gif" || uzanti(dosya.name) === "gif") && dosya.size > 10 * MB) return "GIF en fazla 10 MB olabilir";
    return "";
  }
  if (!DOSYA_UZANTILARI.includes(uzanti(dosya.name))) return "Bu dosya türü eklenemiyor. PDF, Word, Excel, TXT veya ZIP seçin";
  if (!dosya.size) return "Dosya boş görünüyor";
  if (dosya.size > DOSYA_MAKS_MB * MB) return `Dosya çok büyük (en fazla ${DOSYA_MAKS_MB} MB)`;
  return "";
}

async function dosyalariEkle(liste) {
  if (!formAcik) return;
  const dosyalar = [...(liste || [])].filter(Boolean);
  if (!dosyalar.length) return;
  const bos = MAKS_EK - ogeler.length;
  if (bos <= 0) return toast(`Bir duyuruya en fazla ${MAKS_EK} ek eklenebilir`, "error");
  if (dosyalar.length > bos) toast(`En fazla ${MAKS_EK} ek eklenebilir. İlk ${bos} dosya alındı`, "info");

  const benimOturum = oturum;
  const yeni = [];
  for (const dosya of dosyalar.slice(0, bos)) {
    const resim = resimMi(dosya);
    const oge = {
      anahtar: yeniAnahtar(), durum: "yukleniyor", yeni: true, dosya, onizleme: "",
      ek: { tur: resim ? "resim" : "dosya", ad: dosya.name || (resim ? "resim.jpg" : "dosya"), boyut: dosya.size || 0, mime: dosya.type || "" }
    };
    const hata = onDogrula(dosya, resim);
    if (hata) { oge.durum = "hata"; oge.hata = hata; oge.dosya = null; }
    else if (resim) { try { oge.onizleme = URL.createObjectURL(dosya); } catch (_) {} }
    ogeler.push(oge);
    yeni.push(oge);
  }
  alaniCiz();

  // Sırayla yükle — proxy'yi aynı anda çok istekle yormamak için
  for (const oge of yeni) {
    if (benimOturum !== oturum) break;
    if (oge.durum !== "yukleniyor" || oge.iptal) continue;
    await tekYukle(oge, benimOturum);
  }
}

async function tekYukle(oge, benimOturum) {
  try {
    const a = api();
    if (!a?.medya?.yukle) throw new Error("Yükleme servisi hazır değil, sayfayı yenileyip tekrar deneyin");
    let gonderilecek, olcu = null;
    if (oge.ek.tur === "resim") {
      const r = await resimHazirla(oge.dosya);
      gonderilecek = r.dosya;
      olcu = r.olcu;
    } else {
      gonderilecek = new File([oge.dosya], guvenliDosyaAdi(oge.dosya.name), { type: oge.dosya.type || "application/octet-stream" });
    }
    const klasor = `${KLASOR_KOK}/${new Date().toISOString().slice(0, 7)}`;
    const sonuc = await a.medya.yukle(gonderilecek, klasor, oge.ek.tur === "resim");
    if (!sonuc || !guvenliUrl(sonuc.url)) throw new Error("Yükleme tamamlanamadı");

    // Bu arada pencere kapandıysa ya da ek kaldırıldıysa dosyayı geri sil
    if (benimOturum !== oturum || oge.iptal) { bunnySil(sonuc.yol); return; }

    Object.assign(oge.ek, {
      url: sonuc.url,
      yol: sonuc.yol || "",
      boyut: gonderilecek.size || oge.ek.boyut,
      mime: gonderilecek.type || oge.ek.mime,
      yuklendi: new Date().toISOString()
    }, olcu && olcu.en && olcu.boy ? { en: olcu.en, boy: olcu.boy } : {});
    oge.durum = "hazir";
  } catch (e) {
    if (benimOturum !== oturum || oge.iptal) return;
    oge.durum = "hata";
    oge.hata = e?.message || "Yüklenemedi";
  } finally {
    oge.dosya = null;
  }
  if (benimOturum === oturum) alaniCiz();
}

function kaldir(anahtar) {
  const i = ogeler.findIndex(o => o.anahtar === anahtar);
  if (i < 0) return;
  const o = ogeler[i];
  if (o.durum === "yukleniyor") {
    o.iptal = true;                             // yükleme bitince kendini siler
  } else if (o.durum === "hazir" && o.ek?.yol) {
    if (o.yeni) bunnySil(o.ek.yol);             // henüz hiçbir yerde kullanılmıyor
    else kaldirilanlar.push(o.ek.yol);          // kayıttan sonra silinir
  }
  onizlemeBirak(o);
  ogeler.splice(i, 1);
  alaniCiz();
}

// ─────────────────────────── form arayüzü ───────────────────────────
function formOgeHtml(o) {
  const e = o.ek || {};
  const kucuk = e.tur === "resim" && (o.onizleme || e.url)
    ? `<img src="${esc(o.onizleme || boyutluUrl(e.url, 160, e))}" alt="">`
    : `<span class="dek-uz">${esc((uzanti(e.ad) || "dosya").slice(0, 4).toUpperCase())}</span>`;
  const durum = o.durum === "yukleniyor"
    ? `<span class="dek-yukleniyor"><span class="dek-donen"></span>Yükleniyor</span>`
    : o.durum === "hata"
      ? `<span class="dek-hata-yazi">${esc(o.hata || "Yüklenemedi")}</span>`
      : `<span class="dek-tamam">Eklendi</span>`;
  const boyut = e.boyut && o.durum !== "hata" ? `${boyutYazi(e.boyut)}, ` : "";
  return `<div class="dek-form-oge dek-${o.durum}">`
    + `<div class="dek-form-kucuk">${kucuk}</div>`
    + `<div class="dek-form-bilgi"><div class="dek-form-ad" title="${esc(e.ad)}">${esc(e.ad || "Ek")}</div>`
    + `<div class="dek-form-alt">${boyut}${durum}</div></div>`
    + `<button type="button" class="dek-kaldir" data-dek-kaldir="${esc(o.anahtar)}" aria-label="${esc((e.ad || "Ek") + " dosyasını kaldır")}" title="Kaldır">${IKON.x}</button>`
    + `</div>`;
}

function alaniCiz() {
  const kap = document.getElementById("duyuruEkAlani");
  if (!kap) return;
  stilEkle();
  const dolu = ogeler.length >= MAKS_EK;
  kap.innerHTML = `<label>Resim ve dosyalar</label>`
    + `<div class="dek-birak${dolu ? " dek-dolu" : ""}" data-dek-birak>`
    + `<input type="file" data-dek-input multiple accept="${esc(KABUL)}" hidden>`
    + `<button type="button" class="dek-sec" data-dek-sec${dolu ? " disabled" : ""}>${IKON.atac}<span>${dolu ? `${MAKS_EK} ek sınırına ulaşıldı` : "Resim veya dosya ekle"}</span></button>`
    + `<div class="dek-not">Resimler (JPG, PNG, WEBP, GIF) duyurunun altında görünür, dokununca tam ekran açılır. PDF, Word, Excel, TXT ve ZIP dosyaları en fazla 15 MB olabilir.</div>`
    + `</div>`
    + (ogeler.length ? `<div class="dek-form-liste">${ogeler.map(formOgeHtml).join("")}</div>` : "")
    + `<div class="field-hint">Öğrenci fotoğrafı içeren görseller seçilen tüm velilere gider. Bu tür paylaşımlar için Galeri'yi tercih edin.</div>`;

  const input = kap.querySelector("[data-dek-input]");
  kap.querySelector("[data-dek-sec]")?.addEventListener("click", () => input?.click());
  input?.addEventListener("change", () => {
    const secilen = [...(input.files || [])];
    input.value = "";
    dosyalariEkle(secilen);
  });
  kap.querySelectorAll("[data-dek-kaldir]").forEach(b => b.addEventListener("click", () => kaldir(b.dataset.dekKaldir)));

  const birak = kap.querySelector("[data-dek-birak]");
  if (birak && !dolu) {
    ["dragenter", "dragover"].forEach(t => birak.addEventListener(t, e => { e.preventDefault(); birak.classList.add("dek-surukle"); }));
    ["dragleave", "drop"].forEach(t => birak.addEventListener(t, e => { e.preventDefault(); birak.classList.remove("dek-surukle"); }));
    birak.addEventListener("drop", e => dosyalariEkle([...(e.dataTransfer?.files || [])]));
  }
}

// ─────────────────────────── gösterim ───────────────────────────
/**
 * Duyuru eklerinin HTML'i. Boş ise "" döner.
 * secenek.kompakt: şimşek popup gibi dar alanlar için daha kısa resim.
 */
export function html(ekler, secenek = {}) {
  const liste = (Array.isArray(ekler) ? ekler : []).filter(gecerliEk);
  if (!liste.length) return "";
  stilEkle();
  dinleyiciKur();
  const resimler = liste.filter(e => e.tur === "resim");
  const dosyalar = liste.filter(e => e.tur !== "resim");
  let s = `<div class="dek-goster${secenek.kompakt ? " dek-kompakt" : ""}">`;

  if (resimler.length) {
    const n = resimler.length;
    const duzen = n === 1 ? "dek-tek" : (n === 2 || n === 4) ? "dek-iki" : "dek-cok";
    s += `<div class="dek-galeri ${duzen}">` + resimler.map((e, i) => {
      const kaynak = boyutluUrl(e.url, n === 1 ? 1100 : 520, e);
      const olcu = n === 1 && e.en && e.boy ? ` width="${Number(e.en)}" height="${Number(e.boy)}"` : "";
      const etiket = n > 1 ? `Resmi tam ekran aç (${i + 1}/${n})` : "Resmi tam ekran aç";
      return `<button type="button" class="dek-resim" data-dek-tam="${esc(e.url)}" data-dek-ad="${esc(e.ad || "")}" aria-label="${etiket}">`
        + `<img src="${esc(kaynak)}" alt="${esc(e.ad || "Duyuru görseli")}" loading="lazy" decoding="async"${olcu}>`
        + `<span class="dek-buyut" aria-hidden="true">${IKON.buyut}</span></button>`;
    }).join("") + `</div>`;
  }

  if (dosyalar.length) {
    s += `<div class="dek-dosyalar">` + dosyalar.map(e =>
      `<a class="dek-dosya" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">`
      + `<span class="dek-dosya-ikon">${esc((uzanti(e.ad) || "dosya").slice(0, 4).toUpperCase())}</span>`
      + `<span class="dek-dosya-metin"><span class="dek-dosya-ad">${esc(e.ad || "Dosya")}</span>`
      + (e.boyut ? `<span class="dek-dosya-boyut">${boyutYazi(e.boyut)}</span>` : "")
      + `</span><span class="dek-dosya-ac">${IKON.ac}Aç</span></a>`
    ).join("") + `</div>`;
  }
  return s + `</div>`;
}

/** E-posta şablonu için ekler (resimler satır içi, dosyalar bağlantı). */
export function mailHtml(ekler) {
  const liste = (Array.isArray(ekler) ? ekler : []).filter(gecerliEk);
  if (!liste.length) return "";
  let s = "";
  for (const e of liste.filter(x => x.tur === "resim")) {
    const genislik = Math.min(520, Number(e.en) || 520);
    const yukseklik = e.en && e.boy ? Math.round(genislik * Number(e.boy) / Number(e.en)) : 0;
    s += `<div style="margin:14px 0 0;"><a href="${esc(e.url)}" target="_blank" style="text-decoration:none;">`
      + `<img src="${esc(boyutluUrl(e.url, 1040, e))}" alt="${esc(e.ad || "Duyuru görseli")}" width="${genislik}"${yukseklik ? ` height="${yukseklik}"` : ""} `
      + `style="display:block; width:100%; max-width:${genislik}px; height:auto; border:0; border-radius:8px;"></a></div>`;
  }
  const dosyalar = liste.filter(x => x.tur !== "resim");
  if (dosyalar.length) {
    s += `<div style="margin:14px 0 0; padding-top:10px; border-top:1px dashed #e5e7eb;">`
      + dosyalar.map(e => `<div style="margin:6px 0; font-size:14px;">📎 <a href="${esc(e.url)}" target="_blank" style="color:#1F5F33; font-weight:600;">${esc(e.ad || "Dosya")}</a>`
        + (e.boyut ? ` <span style="color:#6b7280; font-size:12px;">(${boyutYazi(e.boyut)})</span>` : "") + `</div>`).join("")
      + `</div>`;
  }
  return s;
}

// ─────────────────────────── tam ekran görüntüleyici ───────────────────────────
let lb = null;   // { kok, liste, sira, yakin, gecmis, oncekiOdak, tasma, dokunma }

export function tamEkranAc(liste, sira = 0) {
  const resimler = (liste || []).filter(x => guvenliUrl(x?.url));
  if (!resimler.length) return;
  stilEkle();
  if (lb) {                                  // zaten açıksa içeriği değiştir
    lb.liste = resimler;
    lb.sira = Math.min(Math.max(0, sira), resimler.length - 1);
    goster();
    return;
  }
  const coklu = resimler.length > 1;
  const kok = document.createElement("div");
  kok.className = "dek-lb";
  kok.setAttribute("role", "dialog");
  kok.setAttribute("aria-modal", "true");
  kok.setAttribute("aria-label", "Resim görüntüleyici");
  kok.innerHTML = `<div class="dek-lb-sahne" data-dek-lb-sahne><img class="dek-lb-resim" alt="" draggable="false"></div>`
    + `<button type="button" class="dek-lb-kapat" data-dek-lb-kapat aria-label="Kapat">${IKON.x}</button>`
    + (coklu ? `<button type="button" class="dek-lb-ok dek-lb-onceki" data-dek-lb-onceki aria-label="Önceki resim">${IKON.sol}</button>`
      + `<button type="button" class="dek-lb-ok dek-lb-sonraki" data-dek-lb-sonraki aria-label="Sonraki resim">${IKON.sag}</button>`
      + `<div class="dek-lb-sayac" data-dek-lb-sayac aria-live="polite"></div>` : "")
    + `<div class="dek-lb-ipucu${coklu ? " dek-lb-ipucu-ust" : ""}" aria-hidden="true">Yakınlaştırmak için resme dokunun</div>`;
  document.body.appendChild(kok);

  lb = {
    kok, liste: resimler, sira: Math.min(Math.max(0, sira), resimler.length - 1),
    yakin: false, gecmis: false, dokunma: null,
    oncekiOdak: document.activeElement,
    tasma: [document.documentElement.style.overflow, document.body.style.overflow]
  };
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  const sahne = kok.querySelector("[data-dek-lb-sahne]");
  kok.querySelector("[data-dek-lb-kapat]").addEventListener("click", () => tamEkranKapat());
  kok.querySelector("[data-dek-lb-onceki]")?.addEventListener("click", () => gec(-1));
  kok.querySelector("[data-dek-lb-sonraki]")?.addEventListener("click", () => gec(1));
  sahne.addEventListener("click", olay => {
    if (olay.target.classList?.contains("dek-lb-resim")) yakinlastir(olay);
    else if (!lb?.yakin) tamEkranKapat();           // boşluğa dokununca kapan
  });
  sahne.addEventListener("touchstart", olay => {
    if (!lb || lb.yakin || olay.touches.length !== 1) { if (lb) lb.dokunma = null; return; }
    lb.dokunma = { x: olay.touches[0].clientX, y: olay.touches[0].clientY };
  }, { passive: true });
  sahne.addEventListener("touchend", olay => {
    if (!lb || lb.yakin || !lb.dokunma) return;
    const t = olay.changedTouches[0];
    const dx = t.clientX - lb.dokunma.x;
    const dy = t.clientY - lb.dokunma.y;
    lb.dokunma = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && lb.liste.length > 1) gec(dx < 0 ? 1 : -1);
    else if (dy > 90 && dy > Math.abs(dx) * 1.3) tamEkranKapat();   // aşağı kaydırınca kapan
  }, { passive: true });
  document.addEventListener("keydown", tusDinle, true);

  goster();
  // Android geri tuşu görüntüleyiciyi kapatsın, sayfadan çıkmasın
  try { history.pushState({ dekLb: true }, ""); lb.gecmis = true; } catch (_) {}
  kok.querySelector("[data-dek-lb-kapat]").focus({ preventScroll: true });
}

export function tamEkranKapat(neden) {
  if (!lb) return;
  const { kok, gecmis, oncekiOdak, tasma } = lb;
  lb = null;
  document.removeEventListener("keydown", tusDinle, true);
  kok.remove();
  document.documentElement.style.overflow = tasma[0] || "";
  document.body.style.overflow = tasma[1] || "";
  if (gecmis && neden !== "gecmis") { try { history.back(); } catch (_) {} }
  try { oncekiOdak?.focus?.({ preventScroll: true }); } catch (_) {}
}

function tusDinle(olay) {
  if (!lb) return;
  if (olay.key === "Escape") { olay.preventDefault(); olay.stopPropagation(); tamEkranKapat(); }
  else if (olay.key === "ArrowRight") { olay.preventDefault(); gec(1); }
  else if (olay.key === "ArrowLeft") { olay.preventDefault(); gec(-1); }
}

function gec(yon) {
  if (!lb || lb.liste.length < 2) return;
  lb.sira = (lb.sira + yon + lb.liste.length) % lb.liste.length;
  goster();
}

function goster() {
  if (!lb) return;
  const e = lb.liste[lb.sira];
  const img = lb.kok.querySelector(".dek-lb-resim");
  const sahne = lb.kok.querySelector("[data-dek-lb-sahne]");
  lb.yakin = false;
  lb.kok.classList.remove("dek-lb-yakin");
  img.style.width = "";
  sahne.scrollTop = 0;
  sahne.scrollLeft = 0;
  lb.kok.classList.add("dek-lb-yukleniyor");
  const bitti = () => { if (lb && lb.kok.contains(img)) lb.kok.classList.remove("dek-lb-yukleniyor"); };
  img.onload = bitti;
  img.onerror = bitti;
  img.alt = e.ad || "Duyuru görseli";
  img.src = e.url;
  if (img.complete) bitti();
  const sayacEl = lb.kok.querySelector("[data-dek-lb-sayac]");
  if (sayacEl) sayacEl.textContent = `${lb.sira + 1} / ${lb.liste.length}`;
  if (lb.liste.length > 1) {                  // sonrakini önden yükle
    const on = new Image();
    on.src = lb.liste[(lb.sira + 1) % lb.liste.length].url;
  }
}

function yakinlastir(olay) {
  if (!lb) return;
  const img = lb.kok.querySelector(".dek-lb-resim");
  const sahne = lb.kok.querySelector("[data-dek-lb-sahne]");
  if (!lb.yakin) {
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const px = Math.min(1, Math.max(0, (olay.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (olay.clientY - r.top) / r.height));
    lb.yakin = true;
    lb.kok.classList.add("dek-lb-yakin");
    img.style.width = Math.round(r.width * 2.2) + "px";
    requestAnimationFrame(() => {        // dokunulan noktayı ortala
      sahne.scrollLeft = Math.max(0, px * img.offsetWidth - sahne.clientWidth / 2);
      sahne.scrollTop = Math.max(0, py * img.offsetHeight - sahne.clientHeight / 2);
    });
  } else {
    lb.yakin = false;
    lb.kok.classList.remove("dek-lb-yakin");
    img.style.width = "";
  }
}

// ─────────────────────────── genel dinleyiciler ───────────────────────────
let dinleyiciKurulu = false;
function dinleyiciKur() {
  if (dinleyiciKurulu || typeof document === "undefined") return;
  dinleyiciKurulu = true;

  // Duyurudaki resme dokununca tam ekran (tüm listeler için tek dinleyici)
  document.addEventListener("click", olay => {
    const btn = olay.target?.closest?.("[data-dek-tam]");
    if (!btn) return;
    olay.preventDefault();
    olay.stopPropagation();
    const galeri = btn.closest(".dek-galeri");
    const dugmeler = galeri ? [...galeri.querySelectorAll("[data-dek-tam]")] : [btn];
    const liste = dugmeler.map(b => ({ url: guvenliUrl(b.dataset.dekTam), ad: b.dataset.dekAd || "" })).filter(x => x.url);
    tamEkranAc(liste, Math.max(0, dugmeler.indexOf(btn)));
  });

  // Geri tuşu (Android / tarayıcı) görüntüleyiciyi kapatır
  window.addEventListener("popstate", () => { if (lb) tamEkranKapat("gecmis"); });

  // Duyuru penceresi açıkken panodan resim yapıştırma (bilgisayarda)
  document.addEventListener("paste", olay => {
    if (!formAcik || !document.getElementById("duyuruModal")?.classList.contains("active")) return;
    const dosyalar = [...(olay.clipboardData?.files || [])].filter(resimMi);
    if (!dosyalar.length) return;
    olay.preventDefault();
    dosyalariEkle(dosyalar);
  });
}

// ─────────────────────────── stil ───────────────────────────
function stilEkle() {
  if (typeof document === "undefined" || document.getElementById("duyuruEkStil")) return;
  const st = document.createElement("style");
  st.id = "duyuruEkStil";
  st.textContent = `
#duyuruEkAlani .dek-birak { border:1.5px dashed var(--gray-300,#D8DCE9); border-radius:12px; padding:14px; background:var(--warm-white,#F7F8FC); text-align:center; transition:border-color .15s, background .15s; }
#duyuruEkAlani .dek-birak.dek-surukle { border-color:var(--green-medium,#5A6ACF); background:var(--green-mist,#E9EBF4); }
#duyuruEkAlani .dek-sec { display:inline-flex; align-items:center; gap:8px; min-height:44px; padding:10px 16px; border-radius:10px; border:1px solid var(--gray-300,#D8DCE9); background:#fff; color:var(--ink,#1F2544); font:600 14px var(--font-body,inherit); cursor:pointer; }
#duyuruEkAlani .dek-sec:hover:not(:disabled) { border-color:var(--green-medium,#5A6ACF); color:var(--green-primary,#2B3674); }
#duyuruEkAlani .dek-sec:focus-visible { outline:3px solid var(--green-light,#C9D1F0); outline-offset:2px; }
#duyuruEkAlani .dek-sec:disabled { opacity:.55; cursor:not-allowed; }
#duyuruEkAlani .dek-sec svg { width:18px; height:18px; flex-shrink:0; }
#duyuruEkAlani .dek-not { font-size:12px; color:var(--ink-soft,#4A5169); margin:8px auto 0; line-height:1.5; max-width:46ch; }
#duyuruEkAlani .dek-form-liste { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
#duyuruEkAlani .dek-form-oge { display:flex; align-items:center; gap:10px; padding:8px 6px 8px 8px; border:1px solid var(--gray-300,#D8DCE9); border-radius:12px; background:#fff; min-width:0; }
#duyuruEkAlani .dek-form-oge.dek-hata { border-color:#FECACA; background:#FEF2F2; }
#duyuruEkAlani .dek-form-kucuk { width:48px; height:48px; flex-shrink:0; border-radius:8px; overflow:hidden; background:var(--green-mist,#E9EBF4); display:flex; align-items:center; justify-content:center; }
#duyuruEkAlani .dek-form-kucuk img { width:100%; height:100%; object-fit:cover; display:block; }
#duyuruEkAlani .dek-uz { font-size:11px; font-weight:800; color:var(--green-primary,#2B3674); letter-spacing:.3px; }
#duyuruEkAlani .dek-form-bilgi { flex:1; min-width:0; text-align:left; }
#duyuruEkAlani .dek-form-ad { font-size:13px; font-weight:600; color:var(--ink,#1F2544); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#duyuruEkAlani .dek-form-alt { font-size:12px; color:var(--gray-500,#8A92A6); margin-top:2px; }
#duyuruEkAlani .dek-tamam { color:#15803D; font-weight:600; }
#duyuruEkAlani .dek-hata-yazi { color:#B91C1C; font-weight:600; }
#duyuruEkAlani .dek-yukleniyor { display:inline-flex; align-items:center; gap:6px; color:var(--green-medium,#5A6ACF); font-weight:600; }
.dek-donen { width:12px; height:12px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:dekDon .8s linear infinite; display:inline-block; }
@keyframes dekDon { to { transform:rotate(360deg); } }
#duyuruEkAlani .dek-kaldir { width:40px; height:40px; flex-shrink:0; border:0; border-radius:10px; background:transparent; color:var(--gray-500,#8A92A6); cursor:pointer; display:flex; align-items:center; justify-content:center; }
#duyuruEkAlani .dek-kaldir:hover { background:#FEE2E2; color:#B91C1C; }
#duyuruEkAlani .dek-kaldir:focus-visible { outline:3px solid var(--green-light,#C9D1F0); }
#duyuruEkAlani .dek-kaldir svg { width:18px; height:18px; }

.dek-goster { margin-top:12px; display:flex; flex-direction:column; gap:10px; max-width:100%; white-space:normal; }
.dek-galeri { display:grid; gap:6px; max-width:560px; }
.dek-galeri.dek-tek { display:block; }
.dek-galeri.dek-iki { grid-template-columns:repeat(2, minmax(0,1fr)); }
.dek-galeri.dek-cok { grid-template-columns:repeat(3, minmax(0,1fr)); }
.dek-resim { position:relative; display:block; width:100%; padding:0; margin:0; border:0; border-radius:10px; overflow:hidden; background:rgba(15,23,42,.06); cursor:zoom-in; -webkit-tap-highlight-color:transparent; }
.dek-galeri:not(.dek-tek) .dek-resim { aspect-ratio:1 / 1; }
.dek-galeri:not(.dek-tek) .dek-resim img { width:100%; height:100%; object-fit:cover; display:block; }
.dek-tek .dek-resim { display:inline-block; width:auto; max-width:100%; vertical-align:top; background:transparent; }
.dek-tek .dek-resim img { display:block; width:auto; height:auto; max-width:100%; max-height:min(420px, 60vh); border-radius:10px; }
.dek-kompakt .dek-tek .dek-resim img { max-height:min(240px, 36vh); }
.dek-kompakt .dek-galeri { max-width:100%; }
.dek-resim:focus-visible { outline:3px solid var(--green-medium,#5A6ACF); outline-offset:2px; }
.dek-buyut { position:absolute; right:6px; bottom:6px; width:28px; height:28px; border-radius:8px; background:rgba(15,23,42,.55); color:#fff; display:flex; align-items:center; justify-content:center; pointer-events:none; }
.dek-buyut svg { width:15px; height:15px; }
.dek-dosyalar { display:flex; flex-direction:column; gap:6px; max-width:560px; }
.dek-dosya { display:flex; align-items:center; gap:10px; min-height:48px; padding:8px 12px 8px 8px; border-radius:10px; background:#fff; border:1px solid rgba(15,23,42,.1); text-decoration:none; color:var(--ink,#1F2544); min-width:0; }
.dek-dosya:hover { border-color:var(--green-medium,#5A6ACF); }
.dek-dosya:focus-visible { outline:3px solid var(--green-medium,#5A6ACF); outline-offset:2px; }
.dek-dosya-ikon { width:36px; height:36px; flex-shrink:0; border-radius:8px; background:var(--green-mist,#E9EBF4); color:var(--green-primary,#2B3674); font-size:10.5px; font-weight:800; display:flex; align-items:center; justify-content:center; }
.dek-dosya-metin { flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.35; }
.dek-dosya-ad { font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dek-dosya-boyut { font-size:11.5px; color:var(--gray-500,#8A92A6); }
.dek-dosya-ac { display:inline-flex; align-items:center; gap:4px; font-size:12.5px; font-weight:700; color:var(--green-primary,#2B3674); flex-shrink:0; }
.dek-dosya-ac svg { width:14px; height:14px; }

.dek-lb { position:fixed; inset:0; z-index:10060; background:rgba(9,12,24,.94); animation:dekLbAc .16s ease-out; }
@keyframes dekLbAc { from { opacity:0; } to { opacity:1; } }
.dek-lb-sahne { position:absolute; inset:0; display:flex; overflow:hidden; box-sizing:border-box; padding:calc(64px + env(safe-area-inset-top, 0px)) 12px calc(56px + env(safe-area-inset-bottom, 0px)); overscroll-behavior:contain; }
.dek-lb-resim { margin:auto; display:block; max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; cursor:zoom-in; user-select:none; -webkit-user-select:none; -webkit-touch-callout:default; }
.dek-lb-yakin .dek-lb-sahne { overflow:auto; padding:0; -webkit-overflow-scrolling:touch; }
.dek-lb-yakin .dek-lb-resim { max-width:none; max-height:none; cursor:zoom-out; }
.dek-lb-yukleniyor .dek-lb-sahne::after { content:""; position:absolute; left:50%; top:50%; width:34px; height:34px; margin:-17px 0 0 -17px; border:3px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:dekDon .8s linear infinite; }
.dek-lb-kapat { position:absolute; top:calc(12px + env(safe-area-inset-top, 0px)); right:12px; width:48px; height:48px; border-radius:50%; border:0; background:rgba(255,255,255,.18); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:2; }
.dek-lb-kapat:hover { background:rgba(255,255,255,.3); }
.dek-lb-kapat:focus-visible, .dek-lb-ok:focus-visible { outline:3px solid #fff; outline-offset:2px; }
.dek-lb-kapat svg { width:26px; height:26px; }
.dek-lb-ok { position:absolute; top:50%; transform:translateY(-50%); width:44px; height:44px; border-radius:50%; border:0; background:rgba(255,255,255,.16); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:2; }
.dek-lb-ok:hover { background:rgba(255,255,255,.28); }
.dek-lb-onceki { left:10px; }
.dek-lb-sonraki { right:10px; }
.dek-lb-ok svg { width:24px; height:24px; }
.dek-lb-yakin .dek-lb-ok, .dek-lb-yakin .dek-lb-ipucu { display:none; }
.dek-lb-sayac { position:absolute; left:50%; transform:translateX(-50%); bottom:calc(14px + env(safe-area-inset-bottom, 0px)); color:#fff; font-size:13px; font-weight:600; background:rgba(255,255,255,.16); padding:5px 12px; border-radius:999px; z-index:2; }
.dek-lb-ipucu { position:absolute; left:50%; transform:translateX(-50%); bottom:calc(16px + env(safe-area-inset-bottom, 0px)); color:rgba(255,255,255,.9); font-size:12px; background:rgba(255,255,255,.12); padding:5px 12px; border-radius:999px; pointer-events:none; white-space:nowrap; animation:dekIpucu 3.4s ease forwards; }
.dek-lb-ipucu.dek-lb-ipucu-ust { bottom:calc(52px + env(safe-area-inset-bottom, 0px)); }
@keyframes dekIpucu { 0%, 70% { opacity:1; } 100% { opacity:0; visibility:hidden; } }
@media (max-width:600px) {
  .dek-lb-ok { width:40px; height:40px; background:rgba(255,255,255,.12); }
  .dek-lb-onceki { left:6px; }
  .dek-lb-sonraki { right:6px; }
}
@media (prefers-reduced-motion:reduce) { .dek-lb, .dek-donen, .dek-lb-yukleniyor .dek-lb-sahne::after { animation:none; } }
`;
  document.head.appendChild(st);
}

// ─────────────────────────── başlat ───────────────────────────
if (typeof window !== "undefined") {
  stilEkle();
  dinleyiciKur();
  window.duyuruEkleri = {
    html, mailHtml, formHazirla, formKapandi, formEkleri, yuklemeSuruyor,
    kayitTamamlandi, ekleriSil, tamEkranAc, tamEkranKapat
  };
}
