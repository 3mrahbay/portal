// ══════════════════════════════════════════════════════════════
// PORTAL · ANLIK PERSONEL BİLDİRİMLERİ (24 Eylül 2026)
// --------------------------------------------------------------
// Veli "Yola çıktık, geliyoruz" (Sabah Girişi) ya da "Almaya
// geliyorum" (Okul Zili) dediğinde ilgili personelin ekranına
// BİR KEZ açılır pencere düşer. Aynı bildirim aynı cihazda ikinci
// kez gösterilmez (görülenler localStorage'da, kişi bazında).
//
// Kimler görür (varsayılan; ayarlar/anlikBildirimler belgesi varsa
// oradaki rol listeleri geçerlidir):
//   kurucu_mudur, mudur          → tüm okul
//   danisma / halkla_iliskiler   → tüm okul (güvenli projeksiyondan)
//   ogretmen                     → yalnız kendi sınıf(lar)ı
//                                   (sınıf ataması yoksa bildirim almaz)
//
// Veri — YALNIZ OKUMA, hiçbir koleksiyona yazmaz, kural değişikliği yok:
//   sabahGirisleri  / danismaSabahGirisleri       (tarih == bugün)
//   pickupBildirimleri / danismaPickupBildirimleri (tarih == bugün)
// Sorgular, mevcut kartların (sabah-girisi.js, okulZiliDoldur) zaten
// yaptığı sorgularla birebir aynıdır.
//
// Sınır: Portal açık değilken (sekme/uygulama kapalı) bildirim düşmez.
// Kapalıyken bildirim için FCM push gerekir — ayrı iş.
//
// Kullanım (index.html, personel girişinde):
//   modulYukle("personel-anlik-bildirim").then(m => m && m.baslat());
// Çıkışta: window.personelAnlikBildirim?.durdur()
// ══════════════════════════════════════════════════════════════

export const SURUM = "ANLIK-BILDIRIM-1";

const P = () => (typeof window !== "undefined" ? window.PortalAPI : null);
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const kucuk = (x) => String(x || "").trim().toLowerCase();
const ikon = (ad, b = 16) => `<i data-lucide="${ad}" style="width:${b}px;height:${b}px;"></i>`;
const ikonCiz = () => { try { window.lucideYenile?.(); } catch (_) {} };

const fSaat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const saatYazi = (iso) => { const t = Date.parse(iso || ""); return Number.isFinite(t) ? fSaat.format(new Date(t)) : ""; };

const DANISMA_ROLLERI = ["danisma", "halkla_iliskiler"];

export const VARSAYILAN = Object.freeze({
  acik: true,
  sabahRolleri: ["kurucu_mudur", "mudur", "danisma", "halkla_iliskiler", "ogretmen"],
  zilRolleri: ["kurucu_mudur", "mudur", "danisma", "halkla_iliskiler", "ogretmen"],
  ilkYuklemePencereDk: 30          // portal açılırken en fazla bu kadar eski bekleyenler gösterilir
});

const TUR = {
  sabah: {
    ana: "sabahGirisleri", danisma: "danismaSabahGirisleri",
    ikon: "car", renk: "#0E7490", acik: "#ECFEFF",
    alt: "Veli bildirdi · kapıda karşılanacak",
    kartlar: ["yonSabahGirisiKart", "danismaSabahGirisiKart", "ogrSabahGirisiKart"]
  },
  zil: {
    ana: "pickupBildirimleri", danisma: "danismaPickupBildirimleri",
    ikon: "bell-ring", renk: "#B45309", acik: "#FEF3C7",
    alt: "Okul Zili · çocuğu hazırlayın",
    kartlar: ["okulZiliListe"]
  }
};

// ─────────────────────────── SAF FONKSİYONLAR (test edilir) ───────────────────────────

// Firestore'daki ayar belgesini güvenli biçimde varsayılanlarla birleştirir.
export function ayarBirlestir(v) {
  const x = v || {};
  const liste = (a, d) => Array.isArray(a) ? a.filter(r => typeof r === "string" && r) : [...d];
  const dk = Number(x.ilkYuklemePencereDk);
  return {
    acik: x.acik !== false,
    sabahRolleri: liste(x.sabahRolleri, VARSAYILAN.sabahRolleri),
    zilRolleri: liste(x.zilRolleri, VARSAYILAN.zilRolleri),
    ilkYuklemePencereDk: Number.isFinite(dk) && dk >= 0 && dk <= 240 ? dk : VARSAYILAN.ilkYuklemePencereDk
  };
}

// Belge → bildirim olayı. Bildirim gerektirmiyorsa null.
export function olayUret(tur, id, v) {
  const x = v || {};
  const docId = String(id || "");
  if (!docId) return null;
  const ogrenciId = x.ogrenciId || x.cocukId || docId.split("__")[0] || "";
  if (tur === "sabah") {
    // Yalnız "veli bildirdi, henüz teslim alınmadı" anı bildirilir
    if (x.veliBildirdi !== true || x.sinifaGirisOnayi) return null;
    const zaman = x.veliBildirimSaati || "";
    return { tur, id: docId, anahtar: `sabah:${docId}:${zaman}`, ogrenciId,
      ogrenciAd: x.ogrenciAd || "", sinif: x.sinif || "", zaman };
  }
  if (tur === "zil") {
    // Yalnız "yolda" durumu bildirilir; hazır / teslim / iptal bildirilmez
    if ((x.durum || "yolda") !== "yolda") return null;
    const zaman = x.olusturuldu || "";
    return { tur, id: docId, anahtar: `zil:${docId}:${zaman}`, ogrenciId,
      ogrenciAd: x.ogrenciAd || "", sinif: x.sinif || "", zaman,
      hedefSaat: x.hedefSaat || "", alanKisi: x.alanKisi || "" };
  }
  return null;
}

// Rol bu türü alıyor mu? (öğretmenin sınıf kontrolü ayrı)
export function rolAliyorMu(k, roller) {
  if (!k || !Array.isArray(roller)) return false;
  if (roller.includes(String(k.rol || ""))) return true;
  return !!k.isAdmin && roller.includes("kurucu_mudur");
}

// Bu kullanıcı bu olayı görmeli mi?  k = { rol, isAdmin, siniflar }
export function kullaniciyaUygunMu(olay, k, ayar = VARSAYILAN) {
  if (!olay || !k) return false;
  const roller = olay.tur === "sabah" ? ayar.sabahRolleri : ayar.zilRolleri;
  if (!rolAliyorMu(k, roller)) return false;
  if (k.rol === "ogretmen" && !k.isAdmin) {
    const siniflar = Array.isArray(k.siniflar) ? k.siniflar : [];
    return siniflar.length > 0 && !!olay.sinif && siniflar.includes(olay.sinif);
  }
  return true;
}

// Portal açılırken gelen (eski) kayıtlardan hangisi gösterilsin?
export function ilkYuklemedeGosterilsinMi(olay, simdiMs, pencereDk = VARSAYILAN.ilkYuklemePencereDk) {
  const t = Date.parse(olay?.zaman || "");
  if (!Number.isFinite(t)) return false;
  const fark = simdiMs - t;
  return fark <= pencereDk * 60000 && fark >= -5 * 60000;
}

// Canlı gelen bir değişiklik bildirilsin mi? (3 saatten eski kayıt bayattır)
export function canliGosterilsinMi(olay, simdiMs) {
  const t = Date.parse(olay?.zaman || "");
  if (!Number.isFinite(t)) return true;   // zaman yoksa: şimdi geldi kabul et
  return simdiMs - t <= 3 * 3600000;
}

// Açılır pencere metni. En fazla 5 satır, fazlası "+N".
export function metinOlustur(tur, olaylar) {
  const liste = Array.isArray(olaylar) ? olaylar : [];
  const n = liste.length;
  const ad = (o) => o.ogrenciAd || "Öğrenci";
  const satir = (o) => {
    if (tur === "zil") {
      return [ad(o), o.sinif, o.alanKisi, o.hedefSaat ? `hedef ${o.hedefSaat}` : saatYazi(o.zaman)].filter(Boolean).join(" · ");
    }
    return [ad(o), o.sinif, saatYazi(o.zaman)].filter(Boolean).join(" · ");
  };
  let baslik;
  if (tur === "zil") baslik = n === 1 ? `${ad(liste[0])} için almaya geliyorlar` : `${n} öğrenciyi almaya geliyorlar`;
  else baslik = n === 1 ? `${ad(liste[0])} yola çıktı` : `${n} öğrenci yola çıktı`;
  return { baslik, satirlar: liste.slice(0, 5).map(satir), fazla: Math.max(0, n - 5) };
}

// ─────────────────────────── ÇALIŞMA ZAMANI ───────────────────────────

let aktif = null;            // { eposta, gun, unsubs, gunKontrol }
let baslatmaSozu = null;
let ayar = { ...VARSAYILAN };
const tampon = { sabah: [], zil: [] };
const tamponZamani = { sabah: null, zil: null };
const TAMPON_MS = 2500;      // aynı anda gelenler tek pencerede toplanır
const EN_FAZLA_KART = 3;

function kullanici() {
  const s = P()?.state || {};
  return { rol: s.rol || "", isAdmin: !!s.isAdmin, siniflar: s.siniflar || [], eposta: kucuk(s.currentUser?.email), personel: s.personel };
}

const gorulenAnahtari = () => `pab-gorulen:${aktif?.eposta || ""}`;
function gorulenOku() { try { return new Set(JSON.parse(localStorage.getItem(gorulenAnahtari()) || "[]")); } catch (_) { return new Set(); } }
function gorulenYaz(set) { try { localStorage.setItem(gorulenAnahtari(), JSON.stringify([...set].slice(-400))); } catch (_) {} }

async function ayarYukle(api) {
  try {
    const s = await api.fb.getDoc(api.fb.doc(api.db, "ayarlar", "anlikBildirimler"));
    if (s.exists()) return ayarBirlestir(s.data());
  } catch (_) { /* okunamazsa varsayılan */ }
  return ayarBirlestir(null);
}

export function baslat() {
  const k = kullanici();
  if (!k.eposta || !(k.personel || k.isAdmin)) return Promise.resolve(false);
  if (aktif && aktif.eposta === k.eposta) return Promise.resolve(true);
  if (baslatmaSozu) return baslatmaSozu;
  baslatmaSozu = (async () => {
    try {
      const api = P();
      if (!api?.fb || !api?.db) return false;
      durdur();
      ayar = await ayarYukle(api);
      if (!ayar.acik) return false;
      if (kullanici().eposta !== k.eposta) return false;   // bu arada oturum değişti
      aktif = { eposta: k.eposta, gun: api.bugun(), unsubs: [], gunKontrol: null };
      stilEkle();
      dinle(api, k);
      // Gece yarısı geçerse yeni günün kayıtlarını dinle
      aktif.gunKontrol = setInterval(() => {
        if (aktif && P()?.bugun?.() !== aktif.gun) { durdur(); baslat(); }
      }, 5 * 60000);
      return true;
    } catch (e) {
      console.warn("Anlık bildirimler başlatılamadı:", e?.code || e?.message);
      return false;
    } finally {
      baslatmaSozu = null;
    }
  })();
  return baslatmaSozu;
}

export function durdur() {
  if (aktif) {
    aktif.unsubs.forEach(u => { try { u(); } catch (_) {} });
    clearInterval(aktif.gunKontrol);
  }
  aktif = null;
  for (const t of Object.keys(tampon)) { tampon[t] = []; clearTimeout(tamponZamani[t]); tamponZamani[t] = null; }
}

function dinle(api, k) {
  const { fb, db } = api;
  const danisma = DANISMA_ROLLERI.includes(k.rol) && !k.isAdmin;
  for (const tur of Object.keys(TUR)) {
    const roller = tur === "sabah" ? ayar.sabahRolleri : ayar.zilRolleri;
    if (!rolAliyorMu(k, roller)) continue;                                   // bu rol almıyor → sorgu da yok
    if (k.rol === "ogretmen" && !k.isAdmin && !k.siniflar.length) continue;  // sınıfsız öğretmen almaz
    const koleksiyon = danisma ? TUR[tur].danisma : TUR[tur].ana;
    let ilkAsama = true;   // sunucudan ilk tam görüntü gelene kadar "açılış" sayılır
    try {
      const q = fb.query(fb.collection(db, koleksiyon), fb.where("tarih", "==", aktif.gun));
      const unsub = fb.onSnapshot(q, snap => {
        if (!aktif) return;
        const simdi = Date.now();
        const gorulen = gorulenOku();
        let degisti = false;
        const belgeler = ilkAsama ? snap.docs : snap.docChanges().filter(c => c.type !== "removed").map(c => c.doc);
        for (const d of belgeler) {
          const olay = olayUret(tur, d.id, d.data());
          if (!olay || gorulen.has(olay.anahtar)) continue;
          zenginlestir(olay);
          if (!kullaniciyaUygunMu(olay, k, ayar)) continue;
          const gosterilsin = ilkAsama ? ilkYuklemedeGosterilsinMi(olay, simdi, ayar.ilkYuklemePencereDk) : canliGosterilsinMi(olay, simdi);
          if (gosterilsin) tamponaEkle(olay);
          else { gorulen.add(olay.anahtar); degisti = true; }   // eski kayıt: sessizce görüldü say
        }
        if (degisti) gorulenYaz(gorulen);
        if (!snap.metadata?.fromCache) ilkAsama = false;
      }, e => console.warn(`Anlık bildirim (${koleksiyon}) dinlenemiyor:`, e?.code || e?.message));
      aktif.unsubs.push(unsub);
    } catch (e) { console.warn("Anlık bildirim sorgusu:", e?.code || e?.message); }
  }
}

// Kayıtta ad/sınıf yoksa (ör. eski ZEKY kaydı) portal öğrenci listesinden tamamla
function zenginlestir(olay) {
  if (olay.ogrenciAd && olay.sinif) return;
  const s = P()?.state || {};
  const o = (s.ogrenciList || []).find(x => x.id === olay.ogrenciId);
  if (!olay.ogrenciAd) olay.ogrenciAd = o?.ogrenciAdSoyad || o?.adSoyad || "";
  if (!olay.sinif) olay.sinif = (s.ayarListesi || {})[olay.ogrenciId]?.kayit?.sinif || o?.sinif || o?.sinifi || "";
}

function tamponaEkle(olay) {
  const b = tampon[olay.tur];
  if (b.some(x => x.anahtar === olay.anahtar)) return;
  b.push(olay);
  if (!tamponZamani[olay.tur]) tamponZamani[olay.tur] = setTimeout(() => bosalt(olay.tur), TAMPON_MS);
}

function bosalt(tur) {
  tamponZamani[tur] = null;
  const liste = tampon[tur].splice(0);
  if (!aktif || !liste.length) return;
  const gorulen = gorulenOku();
  const yeni = liste.filter(o => !gorulen.has(o.anahtar));
  if (!yeni.length) return;
  yeni.forEach(o => gorulen.add(o.anahtar));
  gorulenYaz(gorulen);
  yeni.sort((a, b) => String(a.zaman).localeCompare(String(b.zaman)));
  goster(tur, yeni);
}

// ─────────────────────────── AÇILIR PENCERE ───────────────────────────

function yiginGetir() {
  // gorusme-notlari.js ile aynı yığını paylaş: iki bildirim üst üste binmesin
  let y = document.getElementById("gnYigin");
  if (!y) {
    y = document.createElement("div");
    y.id = "gnYigin";
    y.className = "gn-yigin pab-yigin";
    y.setAttribute("aria-live", "assertive");
    document.body.appendChild(y);
  }
  return y;
}

function goster(tur, olaylar) {
  stilEkle();
  const t = TUR[tur];
  const { baslik, satirlar, fazla } = metinOlustur(tur, olaylar);
  const kart = document.createElement("div");
  kart.className = "pab-kart";
  kart.setAttribute("role", "alert");
  kart.style.setProperty("--pab-renk", t.renk);
  kart.style.setProperty("--pab-acik", t.acik);
  kart.innerHTML = `<span class="pab-ikon">${ikon(t.ikon, 22)}</span>
    <div class="pab-govde"><strong>${esc(baslik)}</strong>
      ${satirlar.map(s => `<span>${esc(s)}</span>`).join("")}
      ${fazla ? `<span class="pab-fazla">+${fazla} bildirim daha</span>` : ""}
      <small>${esc(t.alt)}</small>
      <div class="pab-eylem">
        <button type="button" class="pab-birincil" data-pab-ac>${ikon("list", 15)}Listeyi aç</button>
        <button type="button" class="pab-hafif" data-pab-kapat>Tamam</button>
      </div></div>
    <button type="button" class="pab-x" data-pab-kapat aria-label="Kapat">${ikon("x", 16)}</button>`;
  const kapat = () => { kart.classList.add("pab-cikis"); setTimeout(() => kart.remove(), 180); baslikTemizle(); };
  kart.querySelectorAll("[data-pab-kapat]").forEach(b => b.addEventListener("click", kapat));
  kart.querySelector("[data-pab-ac]")?.addEventListener("click", () => { kapat(); listeyeGit(tur); });
  const yigin = yiginGetir();
  yigin.prepend(kart);
  [...yigin.querySelectorAll(".pab-kart")].slice(EN_FAZLA_KART).forEach(k => k.remove());
  ikonCiz();
  sesCal();
  try { navigator.vibrate?.([120, 60, 120]); } catch (_) {}
  baslikIsaretle();
}

function listeyeGit(tur) {
  const bul = () => TUR[tur].kartlar.map(id => document.getElementById(id)).find(el => el && el.offsetParent !== null);
  const odakla = (el) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("pab-vurgu");
    setTimeout(() => el.classList.remove("pab-vurgu"), 2200);
  };
  const el = bul();
  if (el) { odakla(el); return; }
  try { window.modulSec?.("ozet"); } catch (_) {}
  setTimeout(() => { const e = bul(); if (e) odakla(e); }, 1200);
}

// Sekme arka plandaysa başlıkta işaret: "(●) Portal"
let asilBaslik = null;
function baslikIsaretle() {
  if (typeof document === "undefined" || document.visibilityState === "visible") return;
  if (asilBaslik === null) asilBaslik = document.title;
  document.title = "(●) " + asilBaslik;
  document.addEventListener("visibilitychange", baslikTemizle, { once: true });
}
function baslikTemizle() {
  if (asilBaslik !== null && document.visibilityState === "visible") { document.title = asilBaslik; asilBaslik = null; }
}

// Kısa iki notalı uyarı sesi (tarayıcı izin vermezse sessiz geçer)
let sesBaglam = null;
function sesCal() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    sesBaglam = sesBaglam || new AC();
    if (sesBaglam.state === "suspended") sesBaglam.resume().catch(() => {});
    const t0 = sesBaglam.currentTime + 0.02;
    [880, 1175].forEach((frekans, i) => {
      const o = sesBaglam.createOscillator(), g = sesBaglam.createGain();
      const bas = t0 + i * 0.18;
      o.type = "sine"; o.frequency.value = frekans;
      g.gain.setValueAtTime(0.0001, bas);
      g.gain.exponentialRampToValueAtTime(0.16, bas + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, bas + 0.35);
      o.connect(g); g.connect(sesBaglam.destination);
      o.start(bas); o.stop(bas + 0.4);
    });
  } catch (_) {}
}

function stilEkle() {
  if (typeof document === "undefined" || document.getElementById("pabStil")) return;
  const st = document.createElement("style");
  st.id = "pabStil";
  st.textContent = `
.pab-yigin { position:fixed; top:84px; right:18px; z-index:10050; display:flex; flex-direction:column; gap:10px; width:min(380px, calc(100vw - 24px)); pointer-events:none; }
.pab-kart { pointer-events:auto; position:relative; display:flex; gap:12px; padding:14px 40px 14px 14px; background:#fff; border-radius:18px; border:1px solid color-mix(in srgb, var(--pab-renk) 35%, #fff); border-left:5px solid var(--pab-renk); box-shadow:0 18px 44px rgba(15,23,42,.22); animation:pabGir .28s cubic-bezier(.2,.8,.2,1); font-family:inherit; box-sizing:border-box; }
.pab-kart.pab-cikis { animation:pabCik .18s ease-in forwards; }
@keyframes pabGir { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }
@keyframes pabCik { to { opacity:0; transform:translateX(24px); } }
.pab-ikon { width:44px; height:44px; flex-shrink:0; border-radius:13px; display:grid; place-items:center; background:var(--pab-acik); color:var(--pab-renk); animation:pabSalla 1.2s ease-in-out 2; }
@keyframes pabSalla { 0%,100% { transform:rotate(0); } 20% { transform:rotate(-12deg); } 40% { transform:rotate(10deg); } 60% { transform:rotate(-6deg); } }
.pab-govde { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; font-size:13px; color:#475569; }
.pab-govde strong { font-size:15px; color:#1E293B; line-height:1.3; }
.pab-govde span { overflow-wrap:anywhere; }
.pab-govde .pab-fazla { font-weight:700; color:var(--pab-renk); }
.pab-govde small { color:#94A3B8; font-size:12px; }
.pab-eylem { display:flex; gap:7px; flex-wrap:wrap; margin-top:8px; }
.pab-birincil, .pab-hafif { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:40px; padding:8px 14px; border-radius:12px; font:inherit; font-size:13px; font-weight:800; cursor:pointer; }
.pab-birincil { border:0; background:var(--pab-renk); color:#fff; }
.pab-hafif { border:0; background:#F1F5F9; color:#475569; }
.pab-x { position:absolute; top:8px; right:8px; width:32px; height:32px; border:0; border-radius:50%; background:transparent; color:#94A3B8; display:grid; place-items:center; cursor:pointer; }
.pab-x:hover { background:#F1F5F9; }
.pab-vurgu { outline:3px solid #06B6D4; outline-offset:4px; border-radius:12px; transition:outline-color .4s; }
@media (prefers-reduced-motion:reduce) { .pab-kart, .pab-ikon { animation:none; } }`;
  document.head.appendChild(st);
}

if (typeof window !== "undefined") window.personelAnlikBildirim = { baslat, durdur, SURUM };
