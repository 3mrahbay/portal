// ══════════════════════════════════════════════════════════════
// PORTAL · VELİ ANA SAYFASI — KOMPAKT KAROLAR (24 Eylül 2026)
// --------------------------------------------------------------
// Sabah Girişi, Okul Zili, İzin & Bildirim ve Teslim Alacak Kişiler
// kartları ana sayfada uzun uzun açık durmak yerine küçük karolara
// dönüşür. Her karo o kartın GÜNCEL durumunu tek satırda gösterir
// ("Yola çıktınız · 08:12", "3 kişi" gibi). Karoya dokununca kartın
// tamamı alttan açılan pencerede açılır; "Tamam" deyince küçülür.
//
// Ödeme kartı yerinde kalır ama kısa görünür; dokununca ayrıntı açılır,
// oradan Ödemeler sayfasına gidilir.
//
// 2. aşama (24 Eylül): kartların İÇİ sadeleşir (renkli şeritler, emoji ve
// farklı renkli düğmeler tek dile iner) ve "Okul ve iletişim" karoları
// eklenir: Duyurular, Takvim, Mesajlar, Randevular, Eğitim gelişimi,
// Rehberlik. "Bugünün günlüğü" ana içerik olduğu için kart olarak kalır.
//
// ÖNEMLİ: Kartların kendi kodu (moduller/sabah-girisi.js,
// veli-izinleri.js, pickup-yetkilileri.js, okul zili) DEĞİŞMEDİ.
// Kartlar kimlikleriyle (id) aynı kalır ve yalnız yerleri değişir;
// canlı güncellemeler çalışmaya devam eder, karo özeti kendiliğinden tazelenir.
// ══════════════════════════════════════════════════════════════

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ikon = (ad, b = 18) => `<i data-lucide="${ad}" style="width:${b}px;height:${b}px;"></i>`;
const ikonCiz = () => { try { window.lucideYenile?.(); } catch (_) {} };
const metin = (el) => String(el?.textContent || "").replace(/\s+/g, " ").trim();
const cocukAdi = () => {
  const o = window.PortalAPI?.state?.veliAktifOgrenci || {};
  return String(o.ogrenciAdSoyad || "").split(/\s+/)[0] || "Çocuğunuz";
};

// ── Karo özetleri: kartın içeriğinden tek satırlık durum ──
function satirBul(el, atla = []) {
  const parcalar = [...el.querySelectorAll("div, span, strong, p")]
    .filter(x => !x.children.length || x.tagName === "STRONG")
    .map(metin).filter(t => t.length > 3 && !atla.some(a => t.includes(a)));
  return parcalar[0] || "";
}

function sabahOzet(el) {
  const t = metin(el);
  if (!t || /Yükleniyor/.test(t)) return { durum: "yuk", yazi: "Yükleniyor" };
  if (/Hafta sonu/i.test(t)) return { durum: "pasif", yazi: "Hafta sonu · okul kapalı" };
  if (/Yola çıktık, geliyoruz/i.test(t)) return { durum: "bos", yazi: "Yola çıkınca bildirin" };
  return { durum: "aktif", yazi: satirBul(el, ["Sabah Girişi", "kapıda karşılansın"]) || "Bildirim gönderildi" };
}
function zilOzet(el) {
  const t = metin(el);
  if (!t || /Yükleniyor/.test(t)) return { durum: "yuk", yazi: "Yükleniyor" };
  if (/yarın sabah aktif/i.test(t)) return { durum: "pasif", yazi: "Yarın sabah açılacak" };
  const teslim = t.match(/([^.·]*teslim edildi[^.·]*)/i);
  if (teslim) return { durum: "tamam", yazi: teslim[1].trim() };
  if (/Almaya geliyorum/i.test(t) && !/iptal/i.test(t)) return { durum: "bos", yazi: "Almaya gelirken bildirin" };
  return { durum: "aktif", yazi: satirBul(el, ["Okul Zili", "öğretmen hazırlasın", "Varış saati", "Kim alacak", "Liste \""]) || "Bildirim gönderildi" };
}
function izinOzet(el) {
  const t = metin(el);
  if (!t || /Yükleniyor/.test(t)) return { durum: "yuk", yazi: "Yükleniyor" };
  if (/Aktif izin bildirimi yok/i.test(t)) return { durum: "bos", yazi: "Aktif bildirim yok" };
  const sayi = el.querySelectorAll("[data-izin-id], .veli-izin-oge, li").length;
  return { durum: "aktif", yazi: sayi > 1 ? `${sayi} aktif bildirim` : (satirBul(el, ["İzin & Bildirim", "İzin &amp; Bildirim", "gelmeyecekse", "+ Bildir"]) || "Aktif bildirim var") };
}
async function pickupOzet(el) {
  const t = metin(el);
  if (!t || /Yükleniyor/.test(t)) return { durum: "yuk", yazi: "Yükleniyor" };
  try {
    const m = await window.modulYukle?.("pickup-yetkilileri");
    const id = window.PortalAPI?.state?.veliAktifOgrenci?.id;
    const liste = m && id ? await m.listeGetir(id) : null;
    if (Array.isArray(liste)) {
      if (!liste.length) return { durum: "uyari", yazi: "Liste boş · kişi ekleyin" };
      const adlar = liste.map(k => String(k.ad || k.adSoyad || k.yakinlik || "").split(/\s+/)[0]).filter(Boolean);
      return { durum: "tamam", yazi: `${liste.length} kişi${adlar.length ? " · " + adlar.slice(0, 3).join(", ") : ""}` };
    }
  } catch (_) {}
  return { durum: "tamam", yazi: "Listeyi görmek için dokunun" };
}

const KAROLAR = [
  { id: "veliSabahGirisiKart", ad: "Sabah girişi", ikon: "sunrise", renk: "#0E7490", acik: "#E0F7FA", ozet: sabahOzet },
  { id: "veliOkulZiliKart", ad: "Okul zili", ikon: "bell-ring", renk: "#B45309", acik: "#FEF3C7", ozet: zilOzet },
  { id: "veliIzinKart", ad: "İzin ve bildirim", ikon: "calendar-x-2", renk: "#7C3AED", acik: "#EDE9FE", ozet: izinOzet },
  { id: "veliPickupYetkiKart", ad: "Teslim alacaklar", ikon: "shield-check", renk: "#2D5E3E", acik: "#E8F3EC", ozet: pickupOzet }
];
// Okul ve iletişim — ana sayfadaki bölümlerden karoya dönüşenler
const bolumKarti = (baslik) => {
  const h = [...document.querySelectorAll(".ca-page .ca-sectionhead .ca-head")].find(x => metin(x).includes(baslik));
  const sarici = h?.closest(".ca-sectionhead")?.parentElement;
  return sarici ? { sarici, kart: sarici.querySelector(":scope > .ca-card, :scope > .ca-announce") } : null;
};
const sayiBul = (el, secici) => [...el.querySelectorAll(secici)].reduce((t, x) => t + (parseInt(metin(x), 10) || 0), 0);
const GRUP2 = [
  { anahtar: "duyuru", ad: "Duyurular", ikon: "megaphone", renk: "#C2410C", acik: "#FFEDD5", bul: () => bolumKarti("Duyurular"),
    dogrudan: () => window.veliSwitchTab?.("bildirimler"), ozet: () => ({ durum: "bos", yazi: "Okul duyuruları" }) },
  { anahtar: "takvim", ad: "Takvim", ikon: "calendar-days", renk: "#2E6A9E", acik: "#E9F3FC", kartId: "caHomeTakvimOnizleme",
    ozet: (el) => { const t = metin(el); if (!t || /Yükleniyor/.test(t)) return { durum: "yuk", yazi: "Yükleniyor" };
      if (/yok|bulunmuyor|eklenmemiş/i.test(t)) return { durum: "bos", yazi: "Yaklaşan etkinlik yok" };
      return { durum: "tamam", yazi: satirBul(el) || "Yaklaşan etkinlikler" }; },
    eylem: { yazi: "Takvimi aç", ikon: "calendar-days", git: () => window.caGo?.("takvim") } },
  { anahtar: "mesaj", ad: "Mesajlar", ikon: "message-circle", renk: "#2B3674", acik: "#E9EBF4", kartId: "caHomeMesajlar",
    ozet: (el) => { const t = metin(el); if (!t || /Yükleniyor/.test(t)) return { durum: "yuk", yazi: "Yükleniyor" };
      const n = sayiBul(el, ".ca-unread"); if (n) return { durum: "aktif", yazi: `${n} okunmamış mesaj` };
      if (/yok|henüz/i.test(t)) return { durum: "bos", yazi: "Yeni mesaj yok" };
      return { durum: "tamam", yazi: "Okunmamış mesaj yok" }; },
    eylem: { yazi: "Tüm mesajlar", ikon: "messages-square", git: () => window.caGo?.("mesajlar") } },
  { anahtar: "randevu", ad: "Randevular", ikon: "calendar-clock", renk: "#0F766E", acik: "#CCFBF1", kartId: "caHomeRandevular", gizleId: "caHomeRandevuBolum",
    ozet: (el) => { const n = el.querySelectorAll(".zrv-mini").length;
      if (!n) return { durum: "bos", yazi: "Yaklaşan randevu yok" };
      const bekleyen = [...el.querySelectorAll(".zrv-mini")].some(x => /Yanıt bekliyor/.test(metin(x)));
      return { durum: bekleyen ? "uyari" : "aktif", yazi: bekleyen ? "Yanıtınızı bekleyen randevu var" : `${n} yaklaşan randevu · ${metin(el.querySelector(".zrv-mini-metin span")) || ""}` }; },
    bos: () => `<div class="vkp-bos">${ikon("calendar-heart", 22)}<span>Yaklaşan randevunuz yok. Öğretmen, rehberlik ya da müdürle görüşme talep edebilirsiniz.</span></div>`,
    eylem: { yazi: "Randevu talep et", ikon: "calendar-plus", git: () => window.caRandevuTalepAc?.() } },
  { anahtar: "egitim", ad: "Eğitim gelişimi", ikon: "sprout", renk: "#15803D", acik: "#DCFCE7", kartId: "caHomeEgitimOzet", kartSec: (el) => el.closest(".ca-card") || el,
    ozet: (el) => { const t = metin(el); if (!t || /Yükleniyor/.test(t)) return { durum: "yuk", yazi: "Yükleniyor" };
      return { durum: "tamam", yazi: satirBul(el, ["Gelişim raporlarını", "Montessori · İngilizce", "Aç →"]) || "Gelişimi görmek için dokunun" }; },
    eylem: { yazi: "Gelişim sayfası", ikon: "sprout", git: () => window.caGo?.("egitim") } },
  { anahtar: "pdr", ad: "Rehberlik", ikon: "brain", renk: "#7C3AED", acik: "#EDE9FE", bul: () => bolumKarti("Rehberlik"),
    ozet: () => ({ durum: "bos", yazi: "Tavsiyeler ve sık sorulanlar" }) }
];

const DURUM_RENK = { aktif: "#16A34A", tamam: "#2D5E3E", uyari: "#DC2626", bos: "#94A3B8", pasif: "#CBD5E1", yuk: "#CBD5E1" };

// ═════════════════════════ KURULUM ═════════════════════════
let gozcu = null;
export function baslat() {
  if (gozcu) return;
  stilEkle();
  let bekliyor = false;
  gozcu = new MutationObserver(() => {
    if (bekliyor) return;
    bekliyor = true;
    requestAnimationFrame(() => { bekliyor = false; kur(); odemeKompakt(); });
  });
  gozcu.observe(document.body, { childList: true, subtree: true });
  kur(); odemeKompakt();
}

function kur() {
  grup1Kur();
  grup2Kur();
}

function karoOlustur(k, liste) {
  const karo = document.createElement("button");
  karo.type = "button"; karo.className = "vkp-karo"; karo.setAttribute("role", "listitem");
  karo.style.setProperty("--vkp-renk", k.renk); karo.style.setProperty("--vkp-acik", k.acik);
  karo.dataset.vkpKaro = k.id || k.anahtar;
  karo.innerHTML = `<span class="vkp-ikon">${ikon(k.ikon, 20)}</span><span class="vkp-ad">${esc(k.ad)}</span>
    <span class="vkp-durum"><i></i><span>Yükleniyor</span></span><span class="vkp-ok">${ikon("chevron-right", 16)}</span>`;
  liste.appendChild(karo);
  return karo;
}

function grup1Kur() {
  const ilk = document.getElementById(KAROLAR[0].id);
  if (!ilk || ilk.dataset.vkpKarolu) return;
  const izgara = document.createElement("section");
  izgara.className = "vkp-bolum";
  izgara.innerHTML = `<div class="vkp-baslik">Günlük işlemler</div><div class="vkp-izgara" role="list"></div><div class="vkp-hazne" hidden></div>`;
  ilk.parentNode.insertBefore(izgara, ilk);
  const liste = izgara.querySelector(".vkp-izgara"), hazne = izgara.querySelector(".vkp-hazne");
  for (const k of KAROLAR) {
    const el = document.getElementById(k.id);
    if (!el) continue;
    el.dataset.vkpKarolu = "1";
    el.classList.add("vkp-sade");
    const karo = karoOlustur(k, liste);
    karo.addEventListener("click", () => sayfaAc(k, el));
    hazne.appendChild(el);
    const guncelle = zamanla(() => { sadelestir(el, k); ozetYaz(k, karo, el); });
    new MutationObserver(guncelle).observe(el, { childList: true, subtree: true, characterData: true });
    guncelle();
  }
  ikonCiz();
}

function grup2Kur() {
  const dash = document.querySelector(".ca-page .ca-dash");
  if (!dash || dash.dataset.vkpGrup2) return;
  const bulunan = [];
  for (const k of GRUP2) {
    let kart = null, sarici = null;
    if (k.kartId) {
      const el = document.getElementById(k.kartId);
      if (!el) continue;
      kart = k.kartSec ? k.kartSec(el) : el;
      sarici = kart.closest(".ca-sectionhead") ? null : (kart.parentElement?.querySelector(":scope > .ca-sectionhead") ? kart.parentElement : null);
      if (k.gizleId) sarici = document.getElementById(k.gizleId) || sarici;
    } else {
      const b = k.bul?.(); if (!b?.kart) continue; kart = b.kart; sarici = b.sarici;
    }
    bulunan.push({ k, kart, sarici });
  }
  if (!bulunan.length) return;
  dash.dataset.vkpGrup2 = "1";
  const izgara = document.createElement("section");
  izgara.className = "vkp-bolum";
  izgara.innerHTML = `<div class="vkp-baslik">Okul ve iletişim</div><div class="vkp-izgara vkp-izgara-3" role="list"></div><div class="vkp-hazne" hidden></div>`;
  dash.parentNode.insertBefore(izgara, dash);
  const liste = izgara.querySelector(".vkp-izgara"), hazne = izgara.querySelector(".vkp-hazne");
  for (const { k, kart, sarici } of bulunan) {
    const karo = karoOlustur(k, liste);
    if (sarici) sarici.dataset.vkpGizli = "1";
    if (k.dogrudan) {
      karo.addEventListener("click", k.dogrudan);
      ozetYaz(k, karo, kart);
      continue;
    }
    hazne.appendChild(kart);
    karo.addEventListener("click", () => sayfaAc(k, kart));
    const guncelle = zamanla(() => ozetYaz(k, karo, kart));
    new MutationObserver(guncelle).observe(kart, { childList: true, subtree: true, characterData: true });
    guncelle();
  }
  ikonCiz();
}

// Kartın içini sadeleştir: renkli şeritler, emoji ve tekrar eden başlık
const EMOJI = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
function sadelestir(el, k) {
  const baslik = { veliSabahGirisiKart: "Sabah Girişi", veliOkulZiliKart: "Okul Zili", veliIzinKart: "İzin", veliPickupYetkiKart: "Teslim Alabilecek" }[k.id];
  // Başlık satırı sayfanın kendi başlığında zaten var
  el.querySelectorAll(".ca-head").forEach(h => { if (baslik && metin(h).includes(baslik)) h.classList.add("vkp-cift"); });
  // Düğme ve başlıklardaki emojiler (kişi simgeleri gibi tek başına duran emojilere dokunulmaz)
  const yurut = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const degisecek = [];
  while (yurut.nextNode()) {
    const n = yurut.currentNode, ata = n.parentElement;
    if (!ata || !EMOJI.test(n.nodeValue)) { EMOJI.lastIndex = 0; continue; }
    EMOJI.lastIndex = 0;
    const sadeceEmoji = !metin(ata).replace(EMOJI, "").trim();
    EMOJI.lastIndex = 0;
    if (sadeceEmoji && !ata.closest("button, .ca-btn")) { ata.classList.add("vkp-emoji-yer"); continue; }
    degisecek.push(n);
  }
  degisecek.forEach(n => { const y = n.nodeValue.replace(EMOJI, "").replace(/^\s+/, n.previousSibling ? " " : ""); if (y !== n.nodeValue) n.nodeValue = y; });
}

function zamanla(f) { let t = null; return () => { clearTimeout(t); t = setTimeout(f, 120); }; }

async function ozetYaz(k, karo, el) {
  if (!karo.isConnected) return;
  const o = await k.ozet(el || document.createElement("div"));
  o.yazi = String(o.yazi || "").replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\s+/g, " ").trim() || "Ayrıntı için dokunun";
  const d = karo.querySelector(".vkp-durum");
  d.querySelector("i").style.background = DURUM_RENK[o.durum] || "#94A3B8";
  d.querySelector("span").textContent = o.yazi.length > 64 ? o.yazi.slice(0, 62) + "…" : o.yazi;
  karo.classList.toggle("vkp-etkin", o.durum === "aktif" || o.durum === "uyari");
  karo.title = `${k.ad} · ${o.yazi}`;
}

// ═════════════════════════ AÇILIR SAYFA ═════════════════════════
let acik = null;   // { kok, el, hazne }

function sayfaAc(k, el) {
  el = el || document.getElementById(k.id);
  if (!el) return;
  sayfaKapat();
  const alt = typeof k.alt === "function" ? k.alt() : "";
  const kok = document.createElement("div");
  kok.className = "vkp-arka";
  kok.innerHTML = `<div class="vkp-sayfa" role="dialog" aria-modal="true" aria-label="${esc(k.ad)}" style="--vkp-renk:${k.renk};--vkp-acik:${k.acik}">
    <div class="vkp-tutamak" aria-hidden="true"></div>
    <header class="vkp-sayfa-bas"><span class="vkp-ikon">${ikon(k.ikon, 20)}</span><div><h3>${esc(k.ad)}</h3>${alt ? `<p>${esc(alt)}</p>` : ""}</div>
      <button type="button" class="vkp-x" aria-label="Kapat">${ikon("x", 18)}</button></header>
    <div class="vkp-govde"></div>
    <div class="vkp-alt${k.eylem ? " vkp-alt-iki" : ""}">${k.eylem ? `<button type="button" class="vkp-ikincil" data-vkp-eylem>${ikon(k.eylem.ikon, 17)}${esc(k.eylem.yazi)}</button>` : ""}<button type="button" class="vkp-tamam">${ikon("check", 17)}Tamam</button></div></div>`;
  document.body.appendChild(kok);
  const hazne = el.parentNode;
  const govde = kok.querySelector(".vkp-govde");
  govde.appendChild(el);
  if (k.bos && !metin(el)) { const b = document.createElement("div"); b.innerHTML = k.bos(); govde.appendChild(b.firstElementChild); }
  acik = { kok, el, hazne };
  document.body.classList.add("vkp-kilit");
  kok.querySelector(".vkp-tamam").addEventListener("click", sayfaKapat);
  kok.querySelector(".vkp-x").addEventListener("click", sayfaKapat);
  kok.querySelector("[data-vkp-eylem]")?.addEventListener("click", () => { sayfaKapat(); k.eylem.git(); });
  kok.addEventListener("click", e => { if (e.target === kok) sayfaKapat(); });
  document.addEventListener("keydown", tus, true);
  ikonCiz();
  kok.querySelector(".vkp-tamam").focus({ preventScroll: true });
}
function tus(e) {
  // Kart içindeki bir alt pencere açıksa (ör. izin formu) Escape onu kapatsın
  if (e.key === "Escape" && acik && !document.querySelector(".modal-overlay.active, #vzFormArka, [role=dialog]:not(.vkp-sayfa)")) { e.preventDefault(); sayfaKapat(); }
}
function sayfaKapat() {
  if (!acik) return;
  const { kok, el, hazne } = acik;
  if (hazne && hazne.isConnected) hazne.appendChild(el); else el.remove();   // ana sayfa yenilendiyse eski kart atılır
  kok.classList.add("vkp-kapaniyor");
  setTimeout(() => kok.remove(), 160);
  document.body.classList.remove("vkp-kilit");
  document.removeEventListener("keydown", tus, true);
  acik = null;
}

// ═════════════════════════ ÖDEME KARTI ═════════════════════════
function odemeKompakt() {
  const kart = document.querySelector(".ca-page .ca-pay");
  if (!kart || kart.dataset.vkpOdeme) return;
  kart.dataset.vkpOdeme = "1";
  kart.classList.add("vkp-odeme");
  kart.setAttribute("role", "button");
  kart.tabIndex = 0;
  const ipucu = document.createElement("span");
  ipucu.className = "vkp-odeme-ipucu"; ipucu.innerHTML = `Ayrıntı ${ikon("chevron-right", 14)}`;
  kart.appendChild(ipucu);
  // Köprü kartın içeriğini sonradan yeniden yazar; ipucu kaybolursa geri ekle
  new MutationObserver(zamanla(() => { if (!kart.querySelector(".vkp-odeme-ipucu")) { kart.appendChild(ipucu); ikonCiz(); } })).observe(kart, { childList: true });
  const ac = (e) => {
    if (e.type === "keydown" && !["Enter", " "].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    odemeAc(kart);
  };
  kart.addEventListener("click", ac, true);      // içteki "Ödeme Bildir" düğmesinden önce yakala
  kart.addEventListener("keydown", ac);
  ikonCiz();
}

function odemeAc(kart) {
  sayfaKapat();
  const kopya = kart.cloneNode(true);
  kopya.classList.remove("vkp-odeme"); kopya.removeAttribute("role"); kopya.removeAttribute("tabindex");
  kopya.querySelectorAll("button, .vkp-odeme-ipucu").forEach(b => b.remove());
  kopya.style.cursor = "default";
  const kok = document.createElement("div");
  kok.className = "vkp-arka";
  kok.innerHTML = `<div class="vkp-sayfa" role="dialog" aria-modal="true" aria-label="Ödeme durumu">
    <div class="vkp-tutamak" aria-hidden="true"></div>
    <div class="vkp-govde"></div>
    <div class="vkp-alt vkp-alt-iki"><button type="button" class="vkp-ikincil" data-vkp-kapat>Kapat</button>
      <button type="button" class="vkp-tamam" data-vkp-git>${ikon("credit-card", 17)}Ödemelere git</button></div></div>`;
  kok.querySelector(".vkp-govde").appendChild(kopya);
  document.body.appendChild(kok);
  document.body.classList.add("vkp-kilit");
  const kapat = () => { kok.classList.add("vkp-kapaniyor"); setTimeout(() => kok.remove(), 160); document.body.classList.remove("vkp-kilit"); document.removeEventListener("keydown", tusO, true); };
  const tusO = (e) => { if (e.key === "Escape") { e.preventDefault(); kapat(); } };
  kok.querySelector("[data-vkp-kapat]").addEventListener("click", kapat);
  kok.querySelector("[data-vkp-git]").addEventListener("click", () => { kapat(); window.veliSwitchTab?.("odemeler"); });
  kok.addEventListener("click", e => { if (e.target === kok) kapat(); });
  document.addEventListener("keydown", tusO, true);
  ikonCiz();
}

// ═════════════════════════ STİL ═════════════════════════
function stilEkle() {
  if (document.getElementById("veliKompaktStil")) return;
  const st = document.createElement("style");
  st.id = "veliKompaktStil";
  st.textContent = `
.vkp-bolum { display:flex; flex-direction:column; gap:10px; }
.vkp-baslik { font-family:var(--c-font-head, inherit); font-size:15px; font-weight:700; color:var(--c-ink, #1F2544); }
.vkp-izgara { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; }
.vkp-karo { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:6px; min-width:0; padding:14px 14px 13px; border:1px solid rgba(31,37,68,.08); border-radius:18px; background:#fff; box-shadow:0 1px 3px rgba(31,37,68,.05); font:inherit; text-align:left; color:var(--c-ink, #1F2544); cursor:pointer; transition:transform .12s, box-shadow .15s, border-color .15s; }
.vkp-karo:hover { box-shadow:0 8px 20px rgba(31,37,68,.08); }
.vkp-karo:active { transform:scale(.98); }
.vkp-karo:focus-visible { outline:3px solid color-mix(in srgb, var(--vkp-renk) 35%, transparent); outline-offset:2px; }
.vkp-karo.vkp-etkin { border-color:color-mix(in srgb, var(--vkp-renk) 45%, #fff); box-shadow:0 0 0 3px color-mix(in srgb, var(--vkp-renk) 12%, transparent); }
.vkp-ikon { width:40px; height:40px; border-radius:13px; display:grid; place-items:center; background:var(--vkp-acik); color:var(--vkp-renk); margin-bottom:2px; }
.vkp-ad { font-size:14px; font-weight:700; line-height:1.2; }
.vkp-durum { display:flex; align-items:center; gap:6px; max-width:100%; font-size:12px; color:var(--c-muted, #64748B); line-height:1.35; }
.vkp-durum i { width:7px; height:7px; border-radius:50%; flex-shrink:0; background:#CBD5E1; }
.vkp-durum span { overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.vkp-karo.vkp-etkin .vkp-durum { color:var(--c-ink, #1F2544); font-weight:600; }
.vkp-ok { position:absolute; top:14px; right:12px; color:#CBD5E1; }
.vkp-arka { position:fixed; inset:0; z-index:9400; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; padding:18px; animation:vkpAc .16s ease-out; }
.vkp-arka.vkp-kapaniyor { animation:vkpKapa .16s ease-in forwards; }
@keyframes vkpAc { from { opacity:0; } to { opacity:1; } }
@keyframes vkpKapa { to { opacity:0; } }
.vkp-sayfa { width:100%; max-width:520px; max-height:88vh; display:flex; flex-direction:column; background:var(--c-bg, #F7F8FB); border-radius:24px; overflow:hidden; box-shadow:0 24px 60px rgba(15,23,42,.25); animation:vkpYuksel .22s cubic-bezier(.2,.8,.2,1); }
@keyframes vkpYuksel { from { transform:translateY(24px); opacity:.6; } to { transform:none; opacity:1; } }
.vkp-tutamak { display:none; }
.vkp-govde { overflow-y:auto; padding:14px; overscroll-behavior:contain; }
.vkp-govde > .ca-card { margin:0 !important; box-shadow:none !important; }
.vkp-alt { display:flex; gap:8px; padding:10px 14px 16px; background:var(--c-bg, #F7F8FB); flex-shrink:0; }
.vkp-tamam, .vkp-ikincil { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:48px; border-radius:14px; font:inherit; font-size:15px; font-weight:700; cursor:pointer; }
.vkp-tamam { border:0; background:var(--c-green, #2B3674); color:#fff; }
.vkp-ikincil { border:1.5px solid rgba(31,37,68,.12); background:#fff; color:var(--c-ink, #1F2544); }
.vkp-odeme { position:relative; cursor:pointer; }
.vkp-odeme .ca-tile-sub, .vkp-odeme button, .vkp-odeme .ca-btn { display:none !important; }
.vkp-odeme-ipucu { position:absolute; right:14px; bottom:12px; display:inline-flex; align-items:center; gap:2px; font-size:12px; font-weight:700; color:var(--c-purple-deep, #5B3E96); opacity:.85; }
.vkp-odeme:focus-visible { outline:3px solid rgba(91,62,150,.35); outline-offset:2px; }
body.vkp-kilit { overflow:hidden; }
[data-vkp-gizli] { display:none !important; }
.vkp-izgara-3 { grid-template-columns:repeat(3, minmax(0,1fr)); }
.vkp-sayfa-bas { display:flex; align-items:center; gap:12px; padding:16px 16px 8px 18px; flex-shrink:0; }
.vkp-sayfa-bas > div { flex:1; min-width:0; } .vkp-sayfa-bas h3 { margin:0; font-size:17px; font-weight:800; color:var(--c-ink, #1F2544); }
.vkp-sayfa-bas p { margin:2px 0 0; font-size:12.5px; color:var(--c-muted, #64748B); }
.vkp-sayfa-bas .vkp-ikon { margin:0; flex-shrink:0; }
.vkp-x { width:38px; height:38px; flex-shrink:0; border:0; border-radius:50%; background:rgba(31,37,68,.06); color:var(--c-ink, #1F2544); display:grid; place-items:center; cursor:pointer; }
.vkp-govde { padding-top:6px; }
.vkp-bos { display:flex; gap:10px; align-items:flex-start; padding:16px; border-radius:16px; background:#fff; color:var(--c-muted, #64748B); font-size:13.5px; line-height:1.5; }
.vkp-govde > .ca-card, .vkp-govde > .ca-announce { border-radius:18px !important; }
/* Kartların içi: tek renk dili */
.vkp-sade { background:#fff !important; }
.vkp-sade [style*="gradient"] { background:none !important; color:var(--c-ink, #1F2544) !important; }
.vkp-sade [style*="gradient"] *:not(.ca-btn):not(button) { color:inherit !important; }
.vkp-sade .ca-btn { white-space:nowrap; }
.vkp-sade .ca-btn:not(.ghost), .vkp-sade button.ca-btn:not(.ghost) { background:var(--c-green, #2B3674) !important; color:#fff !important; border:0 !important; border-radius:14px !important; min-height:46px; font-weight:700 !important; box-shadow:none !important; }
.vkp-sade .ca-btn.ghost { background:#fff !important; color:var(--c-ink, #1F2544) !important; border:1.5px solid rgba(31,37,68,.14) !important; border-radius:14px !important; min-height:46px; }
.vkp-sade input, .vkp-sade select, .vkp-sade textarea { border:1.5px solid rgba(31,37,68,.14) !important; border-radius:12px !important; min-height:44px; padding:8px 12px !important; font-size:15px !important; background:#fff !important; color:var(--c-ink, #1F2544) !important; box-sizing:border-box; }
.vkp-sade .vkp-cift { display:none !important; }
.vkp-sade .vkp-emoji-yer { font-size:16px; }
.vkp-govde .vkp-sade .ca-tile-sub { color:var(--c-muted, #64748B) !important; }
@media (max-width:760px) { .vkp-izgara-3 { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width:760px) { .vkp-izgara { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width:560px) {
  .vkp-arka { padding:0; align-items:flex-end; }
  .vkp-sayfa { max-width:none; max-height:92vh; border-radius:24px 24px 0 0; animation:vkpAlttan .24s cubic-bezier(.2,.8,.2,1); }
  @keyframes vkpAlttan { from { transform:translateY(100%); } to { transform:none; } }
  .vkp-tutamak { display:block; width:40px; height:5px; border-radius:999px; background:rgba(31,37,68,.18); margin:8px auto 0; flex-shrink:0; }
  .vkp-alt { padding-bottom:calc(16px + env(safe-area-inset-bottom, 0px)); }
}
@media (prefers-reduced-motion:reduce) { .vkp-arka, .vkp-sayfa { animation:none !important; } }
`;
  document.head.appendChild(st);
}

if (typeof window !== "undefined") window.veliKompakt = { baslat };
