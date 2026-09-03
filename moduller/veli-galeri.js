// ═══════════════════════════════════════════════════════════════════
// VELİ GALERİSİ — moduller/veli-galeri.js
// Koleksiyon: galeri/{otoId}
//   { etkinlikBaslik, etkinlikTarih, aciklama, hedefTur, hedefDeger,
//     hedefOgrenciAd, bunnyUrl, kucukResim, dosyaTipi, durum, yuklemeZamani }
//
// KVKK: yalnızca durum === "onaylandi" olan medya veliye gösterilir.
// Kapsam: tumOkul + velinin çocuğunun sınıfı + o çocuğa özel medya.
//
// Kullanım:
//   m.render("hedefId")   → tam galeri ekranı (albümler + masonry medya)
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

let _filtre = "tumu";      // tumu | etkinlik | orman | sanat | oyun
let _gruplama = "aylik";   // aylik | haftalik
let _medya = [];
let _albumler = [];
let _acikAlbum = null;

const KATEGORILER = [
  { k: "tumu", ad: "Tümü" },
  { k: "orman", ad: "Orman", esle: ["orman", "doğa", "doga", "bahçe", "bahce", "yürüyüş"] },
  { k: "sanat", ad: "Sanat", esle: ["sanat", "atölye", "atolye", "boya", "resim", "el işi"] },
  { k: "oyun",  ad: "Oyun",  esle: ["oyun", "hareket", "jimnastik", "dans", "müzik", "muzik"] },
  { k: "etkinlik", ad: "Etkinlikler", esle: ["şenlik", "senlik", "kutlama", "bayram", "gösteri", "23 nisan", "gezi"] }
];
const ALBUM_RENK = [
  ["#F9A8D4","#EC4899"], ["#86EFAC","#22C55E"], ["#FDE68A","#F59E0B"],
  ["#C4B5FD","#8B5CF6"], ["#93C5FD","#3B82F6"], ["#FCA5A5","#EF4444"],
  ["#A7F3D0","#10B981"], ["#DDD6FE","#7C3AED"]
];
const AY = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

// Bunny CDN thumbnail — genişlik parametresiyle küçük sürüm ister
function kucuk(url, w = 600) {
  if (!url) return "";
  return url.includes("?") ? `${url}&width=${w}` : `${url}?width=${w}`;
}
function kategoriEsle(m) {
  const metin = ((m.etkinlikBaslik || "") + " " + (m.aciklama || "")).toLocaleLowerCase("tr");
  for (const k of KATEGORILER) {
    if (!k.esle) continue;
    if (k.esle.some(e => metin.includes(e))) return k.k;
  }
  return "etkinlik";
}
function zamanKey(m) {
  const t = m.etkinlikTarih || (m.yuklemeZamani || "").substring(0, 10);
  if (!t) return "";
  return _gruplama === "aylik" ? t.substring(0, 7) : t;
}
function zamanEtiket(key) {
  if (!key) return "Tarihsiz";
  if (_gruplama === "aylik") {
    const [y, a] = key.split("-").map(Number);
    return `${AY[a - 1]} ${y}`;
  }
  const d = new Date(key + "T12:00:00");
  return isNaN(d) ? key : `${d.getDate()} ${AY[d.getMonth()]} ${d.getFullYear()}`;
}

// ───────────────────────────────────────────────────────────────────
async function yukle() {
  const { fb, db, state } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) { _medya = []; return; }
  const sinif = (state.ayarListesi[ogr.id]?.kayit?.sinif) || ogr.sinif || "";

  _medya = [];
  try {
    const snap = await fb.getDocs(fb.collection(db, "galeri"));
    snap.forEach(d => {
      const v = d.data() || {};
      if (v.durum !== "onaylandi") return;               // KVKK: onaysız medya gösterilmez
      if (v.dosyaTipi === "video" && !v.bunnyUrl) return;
      // Kapsam kontrolü
      const kapsamda =
        v.hedefTur === "tumOkul" ||
        (v.hedefTur === "sinif" && v.hedefDeger === sinif) ||
        (v.hedefTur === "ogrenci" && v.hedefDeger === ogr.id);
      if (!kapsamda) return;
      _medya.push({ id: d.id, ...v });
    });
  } catch (e) { console.warn("galeri:", e.code || e.message); }

  // En yeni önce
  _medya.sort((a, b) => String(b.etkinlikTarih || b.yuklemeZamani || "")
    .localeCompare(String(a.etkinlikTarih || a.yuklemeZamani || "")));

  // Albümler = etkinlik başlığına göre grup, en yeni albüm en üstte
  const grup = {};
  _medya.forEach(m => {
    const ad = (m.etkinlikBaslik || "").trim() || "Diğer";
    if (!grup[ad]) grup[ad] = { ad, medya: [], tarih: m.etkinlikTarih || m.yuklemeZamani || "" };
    grup[ad].medya.push(m);
    const t = m.etkinlikTarih || m.yuklemeZamani || "";
    if (t > grup[ad].tarih) grup[ad].tarih = t;
  });
  _albumler = Object.values(grup).sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)));
}

// ───────────────────────────────────────────────────────────────────
export async function render(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { esc, lucide } = P();
  el.innerHTML = `<div class="ca-card" style="text-align:center; color:var(--c-muted); padding:24px; font-size:13px;">Yükleniyor…</div>`;
  await yukle();

  if (!_medya.length) {
    el.innerHTML = `
      <div class="ca-card" style="text-align:center; padding:36px 22px;">
        <div style="font-size:38px; margin-bottom:10px;">📷</div>
        <div style="font-weight:700; color:var(--c-ink); font-size:15px;">Henüz paylaşılan anı yok</div>
        <div class="ca-tile-sub" style="margin-top:5px; line-height:1.5;">Öğretmenleriniz fotoğraf paylaştığında<br>ve yönetim onayladığında burada görünecek.</div>
      </div>`;
    return;
  }

  // Albüm açıksa detay
  if (_acikAlbum) { albumDetay(el, hedefId); lucide(); return; }

  // Filtreye göre medya
  let liste = _medya;
  if (_filtre !== "tumu") liste = _medya.filter(m => kategoriEsle(m) === _filtre);

  // Zaman gruplaması
  const zaman = {};
  liste.forEach(m => { const k = zamanKey(m); (zaman[k] = zaman[k] || []).push(m); });
  const zamanlar = Object.keys(zaman).sort().reverse();

  el.innerHTML = `
    <!-- Kategori çipleri -->
    <div class="ca-chips" style="overflow-x:auto; padding-bottom:4px;">
      ${KATEGORILER.map(k => {
        const n = k.k === "tumu" ? _medya.length : _medya.filter(m => kategoriEsle(m) === k.k).length;
        if (!n && k.k !== "tumu") return "";
        return `<button class="ca-chip ${_filtre === k.k ? "active" : ""}" onclick="window._vg.filtre('${k.k}','${hedefId}')">${k.ad} ${n ? `<span style="opacity:.6;">${n}</span>` : ""}</button>`;
      }).join("")}
    </div>

    <!-- Albümler -->
    ${_albumler.length ? `
      <div class="ca-sectionhead" style="margin-top:14px;">
        <h3 class="ca-head" style="font-size:15px;">Albümler</h3>
        <span class="ca-tile-sub">${_albumler.length} albüm</span>
      </div>
      <div style="display:flex; gap:11px; overflow-x:auto; padding:2px 2px 8px;">
        ${_albumler.map((a, i) => {
          const [c1, c2] = ALBUM_RENK[i % ALBUM_RENK.length];
          const kapak = a.medya.find(m => m.dosyaTipi !== "video");
          return `<button onclick="window._vg.albumAc('${esc(a.ad).replace(/'/g, "")}','${hedefId}')"
            style="flex-shrink:0; width:158px; border:none; padding:0; background:none; cursor:pointer; text-align:left;">
            <div style="height:104px; border-radius:14px 14px 0 0; overflow:hidden; position:relative;
              background:linear-gradient(135deg,${c1},${c2});">
              ${kapak?.bunnyUrl ? `<img src="${esc(kucuk(kapak.kucukResim || kapak.bunnyUrl, 320))}" loading="lazy"
                style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">` : ""}
              <span style="position:absolute; left:9px; bottom:8px; color:#fff; font-size:11.5px; font-weight:800; text-shadow:0 1px 4px rgba(0,0,0,.45);">${a.medya.length} medya</span>
            </div>
            <div style="background:#fff; border:1px solid var(--c-border); border-top:none; border-radius:0 0 14px 14px; padding:9px 11px;">
              <div style="font-size:13px; font-weight:700; color:var(--c-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(a.ad)}</div>
              <div class="ca-tile-sub" style="font-size:10.5px;">${a.tarih ? zamanEtiket(a.tarih.substring(0, 7)) : ""}</div>
            </div>
          </button>`;
        }).join("")}
      </div>` : ""}

    <!-- Medya -->
    <div class="ca-sectionhead" style="margin-top:6px;">
      <h3 class="ca-head" style="font-size:15px;">Medya</h3>
      <div style="display:flex; gap:4px; background:var(--c-tint, #F1F5F9); border-radius:100px; padding:3px;">
        ${[["haftalik","Haftalık"],["aylik","Aylık"]].map(([k, ad]) =>
          `<button onclick="window._vg.gruplama('${k}','${hedefId}')"
            style="border:none; padding:5px 13px; border-radius:100px; font-family:inherit; font-size:12px; font-weight:700; cursor:pointer;
              background:${_gruplama === k ? "var(--c-ink)" : "transparent"}; color:${_gruplama === k ? "#fff" : "var(--c-muted)"};">${ad}</button>`).join("")}
      </div>
    </div>

    ${zamanlar.map(z => `
      <div class="ca-tile-sub" style="margin:10px 0 6px 4px; letter-spacing:.05em; font-weight:700;">${zamanEtiket(z).toUpperCase()}</div>
      ${masonry(zaman[z], hedefId)}
    `).join("")}`;
  lucide();
}

// Masonry: CSS columns — dikey fotoğraflar dikey kalır, kırpılmaz
function masonry(liste, hedefId) {
  const { esc } = P();
  return `<div style="column-count:3; column-gap:8px;" class="vg-masonry">
    ${liste.map(m => {
      const url = esc(kucuk(m.kucukResim || m.bunnyUrl, 700));
      const video = m.dosyaTipi === "video";
      return `<div style="break-inside:avoid; margin-bottom:8px; position:relative; border-radius:12px; overflow:hidden; background:var(--c-tint, #F1F5F9); cursor:pointer;"
        onclick="window._vg.buyut('${m.id}','${hedefId}')">
        <img src="${url}" loading="lazy" alt="${esc(m.etkinlikBaslik || "Anı")}"
          style="width:100%; display:block; border-radius:12px;"
          onerror="this.parentElement.style.minHeight='120px'; this.style.display='none';">
        ${video ? `<span style="position:absolute; left:8px; bottom:8px; background:rgba(0,0,0,.55); color:#fff; font-size:11px; font-weight:700; padding:3px 8px; border-radius:100px;">▶</span>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

function albumDetay(el, hedefId) {
  const { esc } = P();
  const a = _albumler.find(x => x.ad === _acikAlbum);
  if (!a) { _acikAlbum = null; render(hedefId); return; }
  el.innerHTML = `
    <div class="ca-row" style="margin-bottom:12px;">
      <button class="ca-back" onclick="window._vg.albumKapat('${hedefId}')" title="Geri">←</button>
      <div><div class="ca-tile-sub">ALBÜM</div><h3 class="ca-head" style="font-size:16px;">${esc(a.ad)}</h3></div>
      <span class="ca-tile-sub" style="margin-left:auto;">${a.medya.length} medya</span>
    </div>
    ${masonry(a.medya, hedefId)}`;
}

// Tam ekran görüntüleyici
function buyut(id, hedefId) {
  const { esc } = P();
  const havuz = _acikAlbum ? (_albumler.find(a => a.ad === _acikAlbum)?.medya || []) : _medya;
  const i = havuz.findIndex(m => m.id === id);
  if (i < 0) return;
  const m = havuz[i];
  const eski = document.getElementById("vgLightbox");
  if (eski) eski.remove();
  const d = document.createElement("div");
  d.id = "vgLightbox";
  d.style.cssText = "position:fixed; inset:0; background:rgba(15,23,42,.94); z-index:2000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px;";
  d.onclick = (e) => { if (e.target === d) d.remove(); };
  d.innerHTML = `
    <img src="${esc(m.bunnyUrl)}" style="max-width:100%; max-height:76vh; border-radius:12px; object-fit:contain;">
    <div style="color:#fff; text-align:center; margin-top:14px; max-width:600px;">
      <div style="font-size:15px; font-weight:700;">${esc(m.etkinlikBaslik || "")}</div>
      ${m.aciklama ? `<div style="font-size:13px; opacity:.85; margin-top:4px;">${esc(m.aciklama)}</div>` : ""}
      <div style="font-size:11.5px; opacity:.6; margin-top:5px;">${m.etkinlikTarih ? String(m.etkinlikTarih).substring(0,10).split("-").reverse().join(".") : ""} · ${i + 1}/${havuz.length}</div>
    </div>
    <div style="display:flex; gap:10px; margin-top:16px;">
      ${i > 0 ? `<button onclick="window._vg.buyut('${havuz[i-1].id}','${hedefId}')" style="background:rgba(255,255,255,.15); border:none; color:#fff; width:44px; height:44px; border-radius:50%; font-size:20px; cursor:pointer;">‹</button>` : ""}
      <a href="${esc(m.bunnyUrl)}" download target="_blank" style="background:rgba(255,255,255,.15); color:#fff; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none; font-size:18px;">↓</a>
      <button onclick="document.getElementById('vgLightbox').remove()" style="background:rgba(255,255,255,.15); border:none; color:#fff; width:44px; height:44px; border-radius:50%; font-size:20px; cursor:pointer;">×</button>
      ${i < havuz.length - 1 ? `<button onclick="window._vg.buyut('${havuz[i+1].id}','${hedefId}')" style="background:rgba(255,255,255,.15); border:none; color:#fff; width:44px; height:44px; border-radius:50%; font-size:20px; cursor:pointer;">›</button>` : ""}
    </div>`;
  document.body.appendChild(d);
}

window._vg = {
  filtre: (k, h) => { _filtre = k; _acikAlbum = null; render(h); },
  gruplama: (k, h) => { _gruplama = k; render(h); },
  albumAc: (ad, h) => { _acikAlbum = ad; render(h); },
  albumKapat: (h) => { _acikAlbum = null; render(h); },
  buyut
};
