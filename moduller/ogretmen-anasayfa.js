// ══════════════════════════════════════════════════════════════
// PORTAL · ÖĞRETMEN ANA SAYFASI — YENİ DÜZEN (24 Eylül 2026)
// --------------------------------------------------------------
// Sıra (Emrah'ın istediği):
//   1. Okul Zili            (açık kart — gün içinde canlı kullanılır)
//   2. Sabah Girişi         (açık kart — ilk 20 kayıt, "Tümünü göster")
//   3. Sınıfım · Bugün      (açık kart — öğrenciye dokununca işlem menüsü)
//   4. Günün akışı karoları (dokununca alttan açılır):
//      Günün planı · Yemek menüsü · Duyuru & etkinlik · Veli mesajları ·
//      Yaklaşan görüşmeler · İzin talepleri
//
// Kartların kendi kodu DEĞİŞMEDİ; kartlar kimlikleriyle (id) yer değiştirir,
// verileri aynı fonksiyonlar doldurmaya devam eder. Karo özetleri
// kartların içeriğinden kendiliğinden tazelenir.
// ══════════════════════════════════════════════════════════════

const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ikon = (ad, b = 18) => `<i data-lucide="${ad}" style="width:${b}px;height:${b}px;"></i>`;
const ikonCiz = () => { try { window.lucideYenile?.(); } catch (_) {} };
const metin = (el) => String(el?.textContent || "").replace(/\s+/g, " ").trim();
const EMOJI = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
const temiz = (t) => String(t || "").replace(EMOJI, "").replace(/\s+/g, " ").trim();
const git = (m) => { try { window.modulSec?.(m); } catch (_) {} };
const sayiTopla = (el, s) => [...el.querySelectorAll(s)].reduce((t, x) => t + (parseInt(metin(x), 10) || 0), 0);

// ── Günün akışı karoları ──
const KAROLAR = [
  { kartId: "ogrHomePlan", ad: "Günün planı", ikon: "calendar-check-2", renk: "#2E6A9E", acik: "#E9F3FC", baslikKart: true,
    eylem: { yazi: "Haftalık plan", ikon: "calendar-range", git: () => git("haftalikPlan") },
    ozet: (el) => { const t = metin(el); if (/Yükleniyor/.test(t)) return yuk();
      if (!t || /yok/i.test(t)) return { durum: "bos", yazi: "Bugün için planlı etkinlik yok" };
      const n = el.children.length;
      const ilkEl = el.querySelector('[style*="font-weight:700"], [style*="font-weight: 700"], strong, b') || el.firstElementChild?.firstElementChild || el.firstElementChild;
      const ilk = temiz(metin(ilkEl));
      return { durum: "tamam", yazi: `${n > 1 ? n + " etkinlik · " : ""}${ilk}` }; } },
  { kartId: "ogrHomeYemek", ad: "Yemek menüsü", ikon: "utensils", renk: "#C2410C", acik: "#FFEDD5",
    eylem: { yazi: "Haftalık menü", ikon: "utensils", git: () => git("yemek") },
    ozet: (el) => { const t = metin(el); if (/Yükleniyor/.test(t)) return yuk();
      if (/girilmemiş|eklenmemiş|Hafta sonu/i.test(t)) return { durum: "bos", yazi: temiz(t) };
      const satirlar = [...el.querySelectorAll(":scope > div")];
      const ogle = satirlar.find(s => /Öğle/.test(metin(s))) || satirlar[0];
      const deger = ogle?.children?.[1] ? metin(ogle.children[1]) : temiz(metin(ogle));
      return { durum: "tamam", yazi: deger ? `Öğle: ${temiz(deger)}` : "Bugünün menüsü" }; } },
  { kartId: "ogrHomeDuyuru", ad: "Duyuru & etkinlik", ikon: "megaphone", renk: "#7C3AED", acik: "#EDE9FE",
    eylem: { yazi: "Duyurular", ikon: "megaphone", git: () => git("duyurular") },
    ozet: (el) => { const t = metin(el); if (/Yükleniyor/.test(t)) return yuk();
      if (/yok/i.test(t) && !el.querySelector('[style*="font-weight:700"]')) return { durum: "bos", yazi: "Yeni duyuru ya da etkinlik yok" };
      const b = el.querySelector('[style*="font-weight:700"], strong');
      return { durum: "tamam", yazi: temiz(metin(b)) || "Duyuru ve etkinlikler" }; } },
  { kartId: "ogrHomeMesajlar", ad: "Veli mesajları", ikon: "message-circle", renk: "#2B3674", acik: "#E9EBF4",
    eylem: { yazi: "Mesajlaşma", ikon: "messages-square", git: () => git("mesaj") },
    ozet: (el) => { const t = metin(el); if (/Yükleniyor/.test(t)) return yuk();
      const n = sayiTopla(el, ".ca-unread");
      if (n) return { durum: "uyari", yazi: `${n} okunmamış mesaj` };
      return { durum: "bos", yazi: "Bekleyen veli mesajı yok" }; } },
  { kartId: "ogrHomeRandevu", ad: "Yaklaşan görüşmeler", ikon: "calendar-clock", renk: "#0F766E", acik: "#CCFBF1",
    eylem: { yazi: "Görüşme notları", ikon: "notebook-text", git: () => git("gorusmeNotlari") },
    ozet: (el) => { const t = metin(el); if (/getiriliyor|Yükleniyor/.test(t)) return yuk();
      const bekleyen = t.match(/Onayınızı bekleyen (\d+) talep/);
      if (bekleyen) return { durum: "uyari", yazi: `${bekleyen[1]} talep onay bekliyor` };
      const yak = el.querySelectorAll(".gn-satir").length;
      const not = t.match(/Notu yazılmamış (\d+) görüşme/);
      if (yak) return { durum: "aktif", yazi: `${yak} yaklaşan görüşme${not ? ` · ${not[1]} not bekliyor` : ""}` };
      if (not) return { durum: "aktif", yazi: `${not[1]} görüşmenin notu bekliyor` };
      return { durum: "bos", yazi: "Bekleyen görüşme yok" }; } },
  { kartId: "ogrVeliIzinKart", ad: "İzin talepleri", ikon: "calendar-x-2", renk: "#B45309", acik: "#FEF3C7",
    ozet: (el) => { const t = metin(el); if (/Yükleniyor/.test(t)) return yuk();
      if (/Bekleyen izin talebi yok/i.test(t)) return { durum: "bos", yazi: "Bekleyen talep yok" };
      const n = el.querySelectorAll('[style*="border-bottom:1px solid #F1F2F7"]').length;
      return { durum: "uyari", yazi: n ? `${n} izin bildirimi` : "İzin bildirimi var" }; } }
];
const yuk = () => ({ durum: "yuk", yazi: "Yükleniyor" });
const DURUM_RENK = { aktif: "#16A34A", tamam: "#2D5E3E", uyari: "#D97706", bos: "#94A3B8", yuk: "#CBD5E1" };

// ═════════════════════════ DÜZENLE ═════════════════════════
export function duzenle() {
  stilEkle();
  const sinif = document.getElementById("ogrHomeSinif");
  if (!sinif || sinif.dataset.oakDuzen) return;
  sinif.dataset.oakDuzen = "1";
  const dash = sinif.closest(".ca-dash");
  if (!dash) return;

  const bolum = (id) => {
    const kart = document.getElementById(id);
    if (!kart) return null;
    const bas = kart.previousElementSibling?.classList.contains("ca-sectionhead") ? kart.previousElementSibling : null;
    return { bas, kart };
  };
  const akis = document.createElement("div");
  akis.className = "oak-akis";
  dash.parentNode.insertBefore(akis, dash);

  // 1–3: açık kartlar
  for (const id of ["okulZiliListe", "ogrSabahGirisiKart", "ogrHomeSinif"]) {
    const b = bolum(id);
    if (!b) continue;
    const sar = document.createElement("section");
    sar.className = "oak-acik";
    if (b.bas) {
      // Başlıklardaki emoji (🔔 🌅) kalkar; ikon dili karolarla aynı olsun
      b.bas.querySelectorAll(".ca-head").forEach(h => h.childNodes.forEach(n => { if (n.nodeType === 3) n.nodeValue = n.nodeValue.replace(EMOJI, "").replace(/^\s+/, ""); }));
      sar.appendChild(b.bas);
    }
    sar.appendChild(b.kart);
    akis.appendChild(sar);
  }

  // 4: Günün akışı karoları
  const grup = document.createElement("section");
  grup.className = "oak-grup";
  grup.innerHTML = `<div class="oak-baslik">Günün akışı</div><div class="oak-izgara" role="list"></div><div class="oak-hazne" hidden></div>`;
  akis.appendChild(grup);
  const liste = grup.querySelector(".oak-izgara"), hazne = grup.querySelector(".oak-hazne");
  for (const k of KAROLAR) {
    const kart = document.getElementById(k.kartId);
    if (!kart) continue;
    if (k.baslikKart) { const dis = kart.closest(".ca-card"); if (dis) dis.dataset.oakGizli = "1"; }
    else { const b = bolum(k.kartId); if (b?.bas) b.bas.dataset.oakGizli = "1"; }
    const karo = document.createElement("button");
    karo.type = "button"; karo.className = "oak-karo"; karo.setAttribute("role", "listitem");
    karo.style.setProperty("--oak-renk", k.renk); karo.style.setProperty("--oak-acik", k.acik);
    karo.innerHTML = `<span class="oak-ikon">${ikon(k.ikon, 20)}</span><span class="oak-ad">${esc(k.ad)}</span>
      <span class="oak-durum"><i></i><span>Yükleniyor</span></span><span class="oak-ok">${ikon("chevron-right", 16)}</span>`;
    karo.addEventListener("click", () => sayfaAc(k, kart));
    liste.appendChild(karo);
    hazne.appendChild(kart);
    const guncelle = zamanla(() => ozetYaz(k, karo, kart));
    new MutationObserver(guncelle).observe(kart, { childList: true, subtree: true, characterData: true });
    guncelle();
  }
  // Günün planı kartı üst sıradan çıktı: yoklama kartı tek başına tam genişlik
  sinif.closest(".ca-page")?.querySelector(".ca-hero-row")?.classList.add("oak-tek");
  dash.dataset.oakGizli = "1";

  // Sabah girişi: ilk 20 kayıt
  const sabah = document.getElementById("ogrSabahGirisiKart");
  if (sabah) { const s = zamanla(() => sabahSinirla(sabah)); new MutationObserver(s).observe(sabah, { childList: true, subtree: true }); s(); }
  ikonCiz();
}

function zamanla(f) { let t = null; return () => { clearTimeout(t); t = setTimeout(f, 120); }; }

async function ozetYaz(k, karo, el) {
  if (!karo.isConnected) return;
  const o = k.ozet(el);
  const d = karo.querySelector(".oak-durum");
  d.querySelector("i").style.background = DURUM_RENK[o.durum] || "#94A3B8";
  const y = temiz(o.yazi) || "Ayrıntı için dokunun";
  d.querySelector("span").textContent = y.length > 64 ? y.slice(0, 62) + "…" : y;
  karo.classList.toggle("oak-etkin", o.durum === "aktif" || o.durum === "uyari");
  karo.title = `${k.ad} · ${y}`;
}

// ── Sabah girişi: 20 kayıt + "Tümünü göster" ──
const SABAH_SINIR = 20;
let sabahAcik = false;
function sabahSinirla(kart) {
  const satirlar = [...kart.querySelectorAll('[style*="border-bottom:1px solid #F1F2F7"]')].filter(x => x.style.display === "flex" || /display:\s*flex/.test(x.getAttribute("style") || ""));
  kart.querySelector(".oak-tumu")?.remove();
  satirlar.forEach((s, i) => s.classList.toggle("oak-gizli", !sabahAcik && i >= SABAH_SINIR));
  if (satirlar.length <= SABAH_SINIR) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "oak-tumu";
  b.innerHTML = sabahAcik ? `${ikon("chevrons-up", 16)}Daha az göster` : `${ikon("chevrons-down", 16)}Tümünü göster (${satirlar.length - SABAH_SINIR} kayıt daha)`;
  b.addEventListener("click", () => { sabahAcik = !sabahAcik; sabahSinirla(kart); if (!sabahAcik) kart.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
  satirlar[satirlar.length - 1].after(b);
  ikonCiz();
}

// ═════════════════════════ ALTTAN AÇILAN SAYFA ═════════════════════════
let acik = null;
function sayfaAc(k, el) {
  sayfaKapat();
  const kok = document.createElement("div");
  kok.className = "oak-arka";
  const gun = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][new Date().getDay()];
  kok.innerHTML = `<div class="oak-sayfa" role="dialog" aria-modal="true" aria-label="${esc(k.ad)}" style="--oak-renk:${k.renk};--oak-acik:${k.acik}">
    <div class="oak-tutamak" aria-hidden="true"></div>
    <header class="oak-sayfa-bas"><span class="oak-ikon">${ikon(k.ikon, 20)}</span><div><h3>${esc(k.ad)}</h3><p>${esc(gun)}</p></div>
      <button type="button" class="oak-x" aria-label="Kapat">${ikon("x", 18)}</button></header>
    <div class="oak-govde"></div>
    <div class="oak-alt">${k.eylem ? `<button type="button" class="oak-ikincil" data-oak-eylem>${ikon(k.eylem.ikon, 17)}${esc(k.eylem.yazi)}</button>` : ""}<button type="button" class="oak-tamam">${ikon("check", 17)}Tamam</button></div></div>`;
  document.body.appendChild(kok);
  const hazne = el.parentNode;
  kok.querySelector(".oak-govde").appendChild(el);
  acik = { kok, el, hazne };
  document.body.classList.add("oak-kilit");
  kok.querySelector(".oak-tamam").addEventListener("click", sayfaKapat);
  kok.querySelector(".oak-x").addEventListener("click", sayfaKapat);
  kok.querySelector("[data-oak-eylem]")?.addEventListener("click", () => { sayfaKapat(); k.eylem.git(); });
  kok.addEventListener("click", e => { if (e.target === kok) sayfaKapat(); });
  document.addEventListener("keydown", tus, true);
  ikonCiz();
}
function tus(e) { if (e.key === "Escape" && acik) { e.preventDefault(); sayfaKapat(); } }
function sayfaKapat() {
  if (!acik) return;
  const { kok, el, hazne } = acik;
  if (hazne?.isConnected) hazne.appendChild(el); else el.remove();
  kok.classList.add("oak-kapaniyor");
  setTimeout(() => kok.remove(), 160);
  document.body.classList.remove("oak-kilit");
  document.removeEventListener("keydown", tus, true);
  acik = null;
}

// ═════════════════════════ STİL ═════════════════════════
function stilEkle() {
  if (document.getElementById("ogretmenAnasayfaStil")) return;
  const st = document.createElement("style");
  st.id = "ogretmenAnasayfaStil";
  st.textContent = `
[data-oak-gizli] { display:none !important; }
.oak-akis { display:flex; flex-direction:column; gap:18px; margin-top:4px; }
.oak-acik > .ca-card { margin-bottom:0 !important; }
.ca-hero-row.oak-tek { grid-template-columns:1fr !important; }
.oak-grup { display:flex; flex-direction:column; gap:10px; }
.oak-baslik { font-family:var(--c-font-head, inherit); font-size:15px; font-weight:700; color:var(--c-ink, #1F2544); }
.oak-izgara { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
.oak-karo { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:6px; min-width:0; padding:14px 14px 13px; border:1px solid rgba(31,37,68,.08); border-radius:18px; background:#fff; box-shadow:0 1px 3px rgba(31,37,68,.05); font:inherit; text-align:left; color:var(--c-ink, #1F2544); cursor:pointer; transition:transform .12s, box-shadow .15s, border-color .15s; }
.oak-karo:hover { box-shadow:0 8px 20px rgba(31,37,68,.08); } .oak-karo:active { transform:scale(.98); }
.oak-karo:focus-visible { outline:3px solid color-mix(in srgb, var(--oak-renk) 35%, transparent); outline-offset:2px; }
.oak-karo.oak-etkin { border-color:color-mix(in srgb, var(--oak-renk) 45%, #fff); box-shadow:0 0 0 3px color-mix(in srgb, var(--oak-renk) 12%, transparent); }
.oak-ikon { width:40px; height:40px; border-radius:13px; display:grid; place-items:center; background:var(--oak-acik); color:var(--oak-renk); flex-shrink:0; }
.oak-ad { font-size:14px; font-weight:700; line-height:1.2; }
.oak-durum { display:flex; align-items:center; gap:6px; max-width:100%; font-size:12px; color:var(--c-muted, #64748B); line-height:1.35; }
.oak-durum i { width:7px; height:7px; border-radius:50%; flex-shrink:0; background:#CBD5E1; }
.oak-durum span { overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.oak-karo.oak-etkin .oak-durum { color:var(--c-ink, #1F2544); font-weight:600; }
.oak-ok { position:absolute; top:14px; right:12px; color:#CBD5E1; }
.oak-gizli { display:none !important; }
.oak-tumu { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-top:10px; min-height:42px; border:1px dashed rgba(31,37,68,.18); border-radius:12px; background:#fff; font:inherit; font-size:13px; font-weight:700; color:var(--c-green, #2B3674); cursor:pointer; }
.oak-arka { position:fixed; inset:0; z-index:9400; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; padding:18px; animation:oakAc .16s ease-out; }
.oak-arka.oak-kapaniyor { animation:oakKapa .16s ease-in forwards; }
@keyframes oakAc { from { opacity:0; } to { opacity:1; } } @keyframes oakKapa { to { opacity:0; } }
.oak-sayfa { width:100%; max-width:560px; max-height:88vh; display:flex; flex-direction:column; background:#F7F8FB; border-radius:24px; overflow:hidden; box-shadow:0 24px 60px rgba(15,23,42,.25); animation:oakYuksel .22s cubic-bezier(.2,.8,.2,1); }
@keyframes oakYuksel { from { transform:translateY(24px); opacity:.6; } to { transform:none; opacity:1; } }
.oak-tutamak { display:none; }
.oak-sayfa-bas { display:flex; align-items:center; gap:12px; padding:16px 16px 8px 18px; flex-shrink:0; }
.oak-sayfa-bas > div { flex:1; min-width:0; } .oak-sayfa-bas h3 { margin:0; font-size:17px; font-weight:800; color:var(--c-ink, #1F2544); }
.oak-sayfa-bas p { margin:2px 0 0; font-size:12.5px; color:var(--c-muted, #64748B); }
.oak-x { width:38px; height:38px; flex-shrink:0; border:0; border-radius:50%; background:rgba(31,37,68,.06); color:var(--c-ink, #1F2544); display:grid; place-items:center; cursor:pointer; }
.oak-govde { overflow-y:auto; padding:6px 14px 14px; overscroll-behavior:contain; }
.oak-govde > * { background:#fff; border-radius:18px; padding:12px 16px; box-shadow:none !important; margin:0 !important; }
.oak-alt { display:flex; gap:8px; padding:10px 14px 16px; flex-shrink:0; }
.oak-tamam, .oak-ikincil { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:48px; border-radius:14px; font:inherit; font-size:15px; font-weight:700; cursor:pointer; }
.oak-tamam { border:0; background:var(--c-green, #2B3674); color:#fff; }
.oak-ikincil { border:1.5px solid rgba(31,37,68,.12); background:#fff; color:var(--c-ink, #1F2544); }
body.oak-kilit { overflow:hidden; }
@media (max-width:760px) { .oak-izgara { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width:560px) {
  .oak-arka { padding:0; align-items:flex-end; }
  .oak-sayfa { max-width:none; max-height:92vh; border-radius:24px 24px 0 0; animation:oakAlttan .24s cubic-bezier(.2,.8,.2,1); }
  @keyframes oakAlttan { from { transform:translateY(100%); } to { transform:none; } }
  .oak-tutamak { display:block; width:40px; height:5px; border-radius:999px; background:rgba(31,37,68,.18); margin:8px auto 0; flex-shrink:0; }
  .oak-alt { padding-bottom:calc(16px + env(safe-area-inset-bottom, 0px)); }
}
@media (prefers-reduced-motion:reduce) { .oak-arka, .oak-sayfa { animation:none !important; } }
`;
  document.head.appendChild(st);
}

if (typeof window !== "undefined") window.ogretmenAnasayfa = { duzenle };
