// ══════════════════════════════════════════════════════════════
// PORTAL · ÖĞRETMEN ANA SAYFASI — SINIFIM KARTI
// --------------------------------------------------------------
// Eskiden yalnız 5 öğrenci adı gösteren kart artık:
//   • bugünün yoklamasını canlı gösterir (geldi / gelmedi / izinli /
//     hasta / işaretlenmedi) — renkli halka ve özet çubuğu
//   • sınıfa ve duruma göre süzer (birden çok sınıf varsa)
//   • yaklaşan doğum günlerini işaretler
//   • öğrenciye dokununca öğrenci kartını açar
//   • yoklamaya ve öğrenci listesine tek dokunuşla götürür
// Veri: ogrenciler (portal belleği), devamsizlik/{gün} (canlı)
// ══════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const ikon = (ad, b = 16) => `<i data-lucide="${ad}" style="width:${b}px;height:${b}px;"></i>`;

const DURUMLAR = {
  geldi:   { ad: "Geldi",          renk: "#16A34A" },
  gelmedi: { ad: "Gelmedi",        renk: "#DC2626" },
  izinli:  { ad: "İzinli",         renk: "#7C3AED" },
  hasta:   { ad: "Hasta",          renk: "#EA580C" },
  yok:     { ad: "İşaretlenmedi",  renk: "#CBD5E1" }
};
function durumKodu(d) {
  if (d === "geldi" || d === "var") return "geldi";
  if (d === "gelmedi" || d === "yok" || d === "devamsiz") return "gelmedi";
  if (d === "izinli" || d === "izin") return "izinli";
  if (d === "hasta") return "hasta";
  return "yok";
}
const SINIF_RENK = ["#4A7C59", "#5A6ACF", "#C0508A", "#D08A1E", "#2E86A6", "#7C5CC4"];
const ILK_GOSTER = 20;

let kart = null;   // { kap, ogrenciler, bugun, kayitlar, sinif, durum, hepsi, abonelik }

/**
 * @param {string} kapId   kartın kabı (ogrHomeSinif)
 * @param {Array}  ogrenciler öğretmenin aktif öğrencileri (ogretmenHomeVeriYukle hesaplar)
 * @param {string} bugun   devamsizlik belge kimliği (yoklama ekranıyla aynı biçim)
 */
export function kartCiz(kapId, ogrenciler, bugun) {
  const kap = document.getElementById(kapId);
  if (!kap) return;
  stilEkle();
  kartDurdur();
  const ayar = P()?.state?.ayarListesi || {};
  const liste = (ogrenciler || []).map(o => ({
    id: o.id,
    ad: String(o.ogrenciAdSoyad || "Öğrenci").trim(),
    sinif: (ayar[o.id]?.kayit?.sinif) || o.sinif || o.sinifi || "",
    foto: o.fotoUrl || "",
    dogum: o.dogumTarihi || ayar[o.id]?.ogrenci?.dogumTarihi || ""
  })).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  kart = { kap, ogrenciler: liste, bugun, kayitlar: {}, sinif: "", durum: "", hepsi: false, yuklendi: false, abonelik: null };
  if (!liste.length) {
    kap.innerHTML = `<div class="osk-bos">Sınıfınıza atanmış öğrenci bulunamadı.</div>`;
    return;
  }
  ciz();
  try {
    const { db, fb } = P();
    kart.abonelik = fb.onSnapshot(fb.doc(db, "devamsizlik", bugun), snap => {
      if (!kart || !kart.kap.isConnected) { kartDurdur(); return; }
      kart.kayitlar = snap.exists() ? ((snap.data() || {}).kayitlar || {}) : {};
      kart.yuklendi = true;
      ciz();
    }, () => { if (kart) { kart.yuklendi = true; ciz(); } });
  } catch (_) { kart.yuklendi = true; ciz(); }
}

export function kartDurdur() {
  if (kart?.abonelik) { try { kart.abonelik(); } catch (_) {} }
  kart = null;
}

function dogumGunuKalan(dogum) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dogum || "")) || /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(dogum || ""));
  if (!m) return null;
  const [ay, gun] = m[1].length === 4 ? [Number(m[2]), Number(m[3])] : [Number(m[2]), Number(m[1])];
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  let sonraki = new Date(bugun.getFullYear(), ay - 1, gun);
  if (sonraki < bugun) sonraki = new Date(bugun.getFullYear() + 1, ay - 1, gun);
  return Math.round((sonraki - bugun) / 86400000);
}

function adParcala(ad) {
  const p = ad.split(/\s+/).filter(Boolean);
  return { ilk: p.slice(0, p.length > 2 ? 2 : 1).join(" "), soyad: p.length > 1 ? p[p.length - 1] : "" };
}

function ciz() {
  if (!kart) return;
  const { kap } = kart;
  const siniflar = [...new Set(kart.ogrenciler.map(o => o.sinif).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const renkSinif = Object.fromEntries(siniflar.map((s, i) => [s, SINIF_RENK[i % SINIF_RENK.length]]));
  const sinifta = kart.sinif ? kart.ogrenciler.filter(o => o.sinif === kart.sinif) : kart.ogrenciler;
  const durumu = (o) => durumKodu((kart.kayitlar[o.id] || {}).durum);
  const sayim = { geldi: 0, gelmedi: 0, izinli: 0, hasta: 0, yok: 0 };
  sinifta.forEach(o => sayim[durumu(o)]++);
  const gorunen = kart.durum ? sinifta.filter(o => durumu(o) === kart.durum) : sinifta;
  const kesik = !kart.hepsi && gorunen.length > ILK_GOSTER + 4;
  const listelenen = kesik ? gorunen.slice(0, ILK_GOSTER) : gorunen;
  const toplam = sinifta.length || 1;
  const yoklamaAlindi = Object.keys(kart.kayitlar).length > 0;
  const dogumlar = sinifta.map(o => ({ o, k: dogumGunuKalan(o.dogum) })).filter(x => x.k != null && x.k <= 7).sort((a, b) => a.k - b.k);
  const kisaSinif = (s) => s.replace(/\s*Çiçekleri Sınıfı$/i, "").replace(/\s*Sınıfı$/i, "");

  kap.innerHTML = `
    ${siniflar.length > 1 ? `<div class="osk-siniflar" role="tablist" aria-label="Sınıf">
      <button type="button" data-osk-sinif="" class="${!kart.sinif ? "osk-secili" : ""}">Tümü <span>${kart.ogrenciler.length}</span></button>
      ${siniflar.map(s => `<button type="button" data-osk-sinif="${esc(s)}" class="${kart.sinif === s ? "osk-secili" : ""}" style="--osk-renk:${renkSinif[s]}"><i></i>${esc(kisaSinif(s))} <span>${kart.ogrenciler.filter(o => o.sinif === s).length}</span></button>`).join("")}
    </div>` : ""}
    <div class="osk-ozet">
      <div class="osk-ozet-bas">
        <div><strong>${kart.yuklendi ? (yoklamaAlindi ? `${sayim.geldi}<span>/${sinifta.length}</span>` : sinifta.length) : "—"}</strong>
          <span class="osk-ozet-alt">${!kart.yuklendi ? "Yoklama okunuyor" : yoklamaAlindi ? "öğrenci bugün okulda" : "öğrenci · bugün yoklama alınmadı"}</span></div>
        <span class="osk-canli" title="Yoklama değiştikçe kendiliğinden güncellenir"><span></span>Canlı</span>
      </div>
      <div class="osk-cubuk" aria-hidden="true">${["geldi", "hasta", "izinli", "gelmedi", "yok"].map(k => sayim[k] ? `<span style="width:${(sayim[k] / toplam) * 100}%;background:${DURUMLAR[k].renk}"></span>` : "").join("")}</div>
      <div class="osk-lejant">${Object.entries(DURUMLAR).filter(([k]) => sayim[k] || k === "yok" || k === "gelmedi").map(([k, d]) =>
        `<button type="button" data-osk-durum="${k}" class="${kart.durum === k ? "osk-secili" : ""}" aria-pressed="${kart.durum === k}"><i style="background:${d.renk}"></i>${d.ad} <strong>${sayim[k]}</strong></button>`).join("")}</div>
    </div>
    ${dogumlar.length ? `<div class="osk-dogum">${ikon("cake", 16)}<span>${dogumlar.map(({ o, k }) => `<strong>${esc(adParcala(o.ad).ilk)}</strong> ${k === 0 ? "bugün" : k === 1 ? "yarın" : `${k} gün sonra`}`).join(" · ")}</span></div>` : ""}
    <div class="osk-izgara">
      ${listelenen.length ? listelenen.map(o => {
        const d = durumu(o), { ilk, soyad } = adParcala(o.ad), dg = dogumGunuKalan(o.dogum);
        const bas = o.ad.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toLocaleUpperCase("tr");
        return `<button type="button" class="osk-ogr osk-${d}" data-osk-ogr="${esc(o.id)}" title="${esc(o.ad)} · ${esc(o.sinif)} · ${DURUMLAR[d].ad}" style="--osk-durum:${DURUMLAR[d].renk};--osk-sinif:${renkSinif[o.sinif] || "#4A7C59"}">
          <span class="osk-avatar">${o.foto ? `<img src="${esc(o.foto)}" alt="" loading="lazy">` : esc(bas)}${dg != null && dg <= 7 ? `<span class="osk-pasta">${ikon("cake", 11)}</span>` : ""}</span>
          <span class="osk-ad">${esc(ilk)}</span><span class="osk-soyad">${esc(soyad)}</span>
        </button>`; }).join("") : `<div class="osk-bos">Bu durumda öğrenci yok.</div>`}
    </div>
    ${kesik ? `<button type="button" class="osk-daha" data-osk-hepsi>${ikon("chevrons-down", 16)} Tümünü göster (${gorunen.length - ILK_GOSTER} öğrenci daha)</button>` : ""}
    <div class="osk-eylemler">
      <button type="button" class="osk-birincil" data-osk-git="devamsizlik">${ikon("clipboard-check", 16)} ${yoklamaAlindi ? "Yoklamayı düzenle" : "Yoklama al"}</button>
      <button type="button" class="osk-ikincil" data-osk-git="ogrencilerM">${ikon("users", 16)} Öğrenci listesi</button>
    </div>`;

  kap.querySelectorAll("[data-osk-sinif]").forEach(b => b.addEventListener("click", () => { kart.sinif = b.dataset.oskSinif; kart.hepsi = false; ciz(); }));
  kap.querySelectorAll("[data-osk-durum]").forEach(b => b.addEventListener("click", () => { kart.durum = kart.durum === b.dataset.oskDurum ? "" : b.dataset.oskDurum; ciz(); }));
  kap.querySelectorAll("[data-osk-ogr]").forEach(b => b.addEventListener("click", () => window.ozetOgrenciAc?.(b.dataset.oskOgr)));
  kap.querySelector("[data-osk-hepsi]")?.addEventListener("click", () => { kart.hepsi = true; ciz(); });
  kap.querySelectorAll("[data-osk-git]").forEach(b => b.addEventListener("click", () => window.modulSec?.(b.dataset.oskGit)));
  try { window.lucideYenile?.(kap); } catch (_) {}
}

function stilEkle() {
  if (document.getElementById("ogretmenSinifimStil")) return;
  const st = document.createElement("style");
  st.id = "ogretmenSinifimStil";
  st.textContent = `
.osk-bos { padding:14px 4px; font-size:13px; color:#64748B; }
.osk-siniflar { display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; margin-bottom:12px; scrollbar-width:thin; }
.osk-siniflar button { display:inline-flex; align-items:center; gap:6px; flex-shrink:0; min-height:36px; padding:6px 12px; border:1.5px solid #E2E8F0; border-radius:999px; background:#fff; font:inherit; font-size:12.5px; font-weight:700; color:#475569; cursor:pointer; white-space:nowrap; }
.osk-siniflar button i { width:8px; height:8px; border-radius:50%; background:var(--osk-renk); }
.osk-siniflar button span { font-weight:600; color:#94A3B8; }
.osk-siniflar .osk-secili { border-color:#2D5E3E; background:#2D5E3E; color:#fff; } .osk-siniflar .osk-secili span { color:#CFE3D6; } .osk-siniflar .osk-secili i { box-shadow:0 0 0 2px #fff; }
.osk-ozet { padding:12px 14px; border-radius:14px; background:#F7F9F8; border:1px solid #EEF2F0; margin-bottom:12px; }
.osk-ozet-bas { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.osk-ozet-bas strong { font-size:26px; font-weight:800; color:#1E293B; font-variant-numeric:tabular-nums; margin-right:6px; }
.osk-ozet-bas strong span { font-size:15px; color:#94A3B8; font-weight:700; }
.osk-ozet-alt { font-size:12.5px; color:#64748B; }
.osk-canli { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; color:#64748B; white-space:nowrap; }
.osk-canli span { width:7px; height:7px; border-radius:50%; background:#16A34A; animation:oskNabiz 2s infinite; }
@keyframes oskNabiz { 0% { box-shadow:0 0 0 0 rgba(22,163,74,.45); } 70% { box-shadow:0 0 0 6px rgba(22,163,74,0); } 100% { box-shadow:0 0 0 0 rgba(22,163,74,0); } }
.osk-cubuk { display:flex; height:8px; border-radius:999px; overflow:hidden; background:#E8EDEA; margin:10px 0 8px; gap:2px; }
.osk-cubuk span { display:block; height:100%; }
.osk-lejant { display:flex; flex-wrap:wrap; gap:4px 6px; }
.osk-lejant button { display:inline-flex; align-items:center; gap:6px; min-height:32px; padding:4px 10px; border:1px solid transparent; border-radius:999px; background:transparent; font:inherit; font-size:12.5px; color:#475569; cursor:pointer; }
.osk-lejant button:hover { background:#fff; border-color:#E2E8F0; }
.osk-lejant .osk-secili { background:#fff; border-color:#2D5E3E; color:#1E293B; }
.osk-lejant i { width:9px; height:9px; border-radius:50%; } .osk-lejant strong { color:#1E293B; font-variant-numeric:tabular-nums; }
.osk-dogum { display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:9px 12px; border-radius:12px; background:#FDF2F8; color:#9D174D; font-size:12.5px; line-height:1.45; }
.osk-dogum strong { color:#831843; }
.osk-izgara { display:grid; grid-template-columns:repeat(auto-fill, minmax(74px, 1fr)); gap:8px 6px; }
.osk-ogr { display:flex; flex-direction:column; align-items:center; gap:2px; padding:6px 2px; border:0; border-radius:12px; background:none; font:inherit; color:#1E293B; cursor:pointer; min-width:0; }
.osk-ogr:hover { background:#F4F7F5; }
.osk-ogr:focus-visible { outline:3px solid #BFD8C7; outline-offset:1px; }
.osk-avatar { position:relative; width:46px; height:46px; border-radius:50%; display:grid; place-items:center; background:color-mix(in srgb, var(--osk-sinif) 16%, #fff); color:var(--osk-sinif); font-weight:800; font-size:14px; box-shadow:0 0 0 2.5px #fff, 0 0 0 5px var(--osk-durum); margin-bottom:6px; }
.osk-yok .osk-avatar { box-shadow:0 0 0 2.5px #fff, 0 0 0 4px #D5DCE3; }
.osk-gelmedi .osk-avatar, .osk-izinli .osk-avatar, .osk-hasta .osk-avatar { opacity:.85; }
.osk-avatar img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
.osk-pasta { position:absolute; right:-6px; top:-6px; width:20px; height:20px; border-radius:50%; background:#DB2777; color:#fff; display:grid; place-items:center; box-shadow:0 0 0 2px #fff; }
.osk-ad { max-width:100%; font-size:12.5px; font-weight:700; line-height:1.2; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.osk-soyad { max-width:100%; font-size:11px; color:#94A3B8; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.osk-daha { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-top:8px; min-height:40px; border:1px dashed #CBD5E1; border-radius:12px; background:#fff; font:inherit; font-size:13px; font-weight:600; color:#475569; cursor:pointer; }
.osk-eylemler { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; }
.osk-eylemler button { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:44px; padding:8px 10px; border-radius:12px; font:inherit; font-size:13.5px; font-weight:700; cursor:pointer; }
.osk-birincil { border:0; background:#2D5E3E; color:#fff; } .osk-birincil:hover { background:#24503A; }
.osk-ikincil { border:1.5px solid #D9E3DC; background:#fff; color:#2D5E3E; }
@media (max-width:420px) { .osk-izgara { grid-template-columns:repeat(4, minmax(0,1fr)); } .osk-avatar { width:42px; height:42px; } .osk-eylemler { grid-template-columns:1fr; } }
@media (prefers-reduced-motion:reduce) { .osk-canli span { animation:none; } }
`;
  document.head.appendChild(st);
}

if (typeof window !== "undefined") window.ogretmenSinifim = { kartCiz, kartDurdur };
