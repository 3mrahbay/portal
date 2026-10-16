import { operasyonPushTetikle } from "../js/zeky-operasyon-push.js";
// ═══════════════════════════════════════════════════════════════════
// PICKUP YETKİLİLERİ — moduller/pickup-yetkilileri.js
// ZEKY ile ORTAK: pickupYetkilileri/{ogrenciId} → { kisiler: [{ad, yakinlik, telefon?}] }
//
// Çocuğu kimlerin teslim alabileceği listesi. Çocuk güvenliği için:
//   • Veli listeyi yönetir (ekle / çıkar)
//   • Okul Zili "kim alacak" seçeneği bu listeden gelir (sabit liste değil)
//   • Öğretmen kuyrukta "yetkili listede mi" uyarısını görür
//
// Kullanım:
//   m.veliKart("hedefId")           → veli ana sayfası
//   m.listeGetir(ogrenciId)         → Okul Zili için (Promise<[{ad,yakinlik}]>)
//   m.yetkiliMi(ogrenciId, ad)      → öğretmen kuyruğu için (Promise<bool>)
//   m.zilKonumKur()                 → Okul Zili "Kim alacak" altında konum gönderme
//
// Okulun konumunu gönder: çocuğu anne-baba dışında biri (dede, teyze, bakıcı…)
// alacaksa veli okulun adresini ve Google Haritalar konumunu hazır bir mesajla
// gönderir (telefon kayıtlıysa WhatsApp, değilse paylaşım menüsü).
// Ortak modül: js/zeky-yol.js (ZEKY ile birebir); okul: ayarlar/okulYolu.
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

const YAKINLIKLAR = ["Anne", "Baba", "Anneanne", "Babaanne", "Dede", "Teyze", "Hala", "Dayı", "Amca", "Abla", "Ağabey", "Servis", "Bakıcı", "Diğer"];

const _cache = {};

let _okulSozu = null;
function okulKonumuHazirla() {
  if (!_okulSozu) {
    const { fb, db } = P();
    _okulSozu = Promise.all([
      import("../js/zeky-yol.js?v=4"),
      fb.getDoc(fb.doc(db, "ayarlar", "okulYolu")).then(s => (s.exists() ? s.data() : null))
    ]).then(([yol, ayar]) => ({ yol, okul: yol.okulBilgisiDuzelt(ayar) }))
      .catch(e => { _okulSozu = null; console.warn("okul konumu:", e?.code || e?.message || e); return { yol: null, okul: null }; });
  }
  return _okulSozu;
}
const disariAc = (url) => window.open(url, "_blank", "noopener");
function aktifOgrenci() {
  const { state } = P();
  return state.veliAktifOgrenci || state.veliOgrenciler?.[0] || null;
}
function paylasimBildir(yol, sonuc) {
  const m = yol.paylasimSonucMetni(sonuc);
  if (m) P().toast(m, sonuc === "kopyalandi" ? undefined : "error");
}

export async function listeGetir(ogrenciId, tazele = false) {
  if (!tazele && _cache[ogrenciId]) return _cache[ogrenciId];
  const { fb, db, state } = P();
  const danismaMi = ["danisma", "halkla_iliskiler"].includes(state.rol);
  const kaynak = danismaMi ? "danismaPickupYetkilileri" : "pickupYetkilileri";
  let kisiler = null;
  try {
    const s = await fb.getDoc(fb.doc(db, kaynak, ogrenciId));
    if (s.exists() && Array.isArray(s.data().kisiler)) kisiler = s.data().kisiler;

    // Veli eski tam listeyi ilk açtığında telefon içermeyen operasyon
    // projeksiyonunu hazırlar. Personel kaynak belgeyi kopyalayamaz.
    if (!danismaMi && !state.rol && kisiler?.length) {
      try {
        const guvenliRef = fb.doc(db, "danismaPickupYetkilileri", ogrenciId);
        const guvenli = await fb.getDoc(guvenliRef);
        if (!guvenli.exists()) {
          await fb.setDoc(guvenliRef, {
            kisiler: kisiler.map(k => ({ ad: k.ad || "", yakinlik: k.yakinlik || "" })),
            guncellendi: fb.serverTimestamp()
          });
        }
      } catch (e) { console.warn("pickup güvenli yetkili özeti:", e.code || e.message); }
    }
  } catch (e) { console.warn("pickup yetkilileri:", e.code || e.message); }
  // ZEKY varsayılanı: kayıt yoksa anne + baba
  if ((!kisiler || !kisiler.length) && !danismaMi) kisiler = [{ ad: "Anne", yakinlik: "Anne" }, { ad: "Baba", yakinlik: "Baba" }];
  if (danismaMi) {
    kisiler = kisiler || [];
    kisiler = kisiler.map(k => ({ ad: k.ad || "", yakinlik: k.yakinlik || "" }));
  }
  _cache[ogrenciId] = kisiler;
  return kisiler;
}

export async function yetkiliMi(ogrenciId, ad) {
  const liste = await listeGetir(ogrenciId);
  const n = (t) => String(t || "").toLocaleLowerCase("tr").trim();
  return liste.some(k => n(k.ad) === n(ad) || n(k.yakinlik) === n(ad));
}

// ───────────────────────────────────────────────────────────────────
// VELİ — listeyi yönet
// ───────────────────────────────────────────────────────────────────
export async function veliKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { state, esc } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) { el.innerHTML = ""; return; }

  const [kisiler, { yol, okul }] = await Promise.all([listeGetir(ogr.id, true), okulKonumuHazirla()]);
  const ad = (ogr.ogrenciAdSoyad || "Çocuğunuz").split(" ")[0];
  const konumVar = (k) => !!(okul && yol?.konumGonderilebilirMi(k));

  const ikon = (y) => ({
    Anne: "👩", Baba: "👨", Anneanne: "👵", Babaanne: "👵", Dede: "👴",
    Teyze: "👩", Hala: "👩", Dayı: "👨", Amca: "👨", Abla: "👧", Ağabey: "👦",
    Servis: "🚌", Bakıcı: "🧑", Diğer: "🧑"
  })[y] || "🧑";

  el.innerHTML = `
    <div style="padding:14px 18px; border-bottom:1px solid #F1F2F7; display:flex; align-items:center; gap:10px;">
      <span style="font-size:22px;">🛡️</span>
      <div style="flex:1;">
        <div class="ca-head" style="font-size:14px;">Teslim Alabilecek Kişiler</div>
        <div class="ca-tile-sub">${esc(ad)}'ı okuldan yalnızca bu listedekiler alabilir</div>
      </div>
      <button class="ca-btn" style="padding:8px 14px; font-size:12.5px;" onclick="window._pickupYetki.formAc()">+ Ekle</button>
    </div>
    <div id="pyForm" style="display:none; padding:14px 18px; background:#F8FAFC; border-bottom:1px solid #F1F2F7;"></div>
    <div id="pyGonder" hidden aria-live="polite" style="padding:14px 18px; background:#F0FDF4; border-bottom:1px solid #DCFCE7;"></div>
    <div style="padding:6px 18px 12px;">
      ${kisiler.map((k, i) => `
        <div style="display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #F1F2F7;">
          <span style="font-size:20px;">${ikon(k.yakinlik)}</span>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13.5px; font-weight:700; color:var(--c-ink);">${esc(k.ad)}</div>
            <div style="font-size:11px; color:var(--c-muted);">${esc(k.yakinlik)}${k.telefon ? " · " + esc(k.telefon) : ""}</div>
          </div>
          ${konumVar(k)
            ? `<button onclick="window._pickupYetki.konumGonder(${i})" style="flex-shrink:0; border:0; border-radius:10px; background:var(--c-tint,#EEF2FF); color:var(--c-green,#2B3674); font-family:inherit; font-size:12px; font-weight:700; padding:7px 10px; cursor:pointer;" title="Okulun konumunu gönder">📍 Konum</button>`
            : ""}
          ${kisiler.length > 1
            ? `<button onclick="window._pickupYetki.sil(${i})" style="background:none; border:none; color:#94A3B8; cursor:pointer; font-size:18px; padding:0 4px;" title="Listeden çıkar">×</button>`
            : ""}
        </div>`).join("")}
      <div style="font-size:11px; color:var(--c-muted); margin-top:8px; line-height:1.5;">
        Listede olmayan biri geldiğinde öğretmen sizi arayarak teyit alır. Değişiklikler anında geçerli olur.
      </div>
    </div>`;
}

// Form cards may be moved to a body-level compact sheet.
function formStiliEkle() {
  if (document.getElementById("pickupYetkiFormStil")) return;
  const st = document.createElement("style");
  st.id = "pickupYetkiFormStil";
  st.textContent = `
#pyForm { min-width:0; max-width:100%; overflow-wrap:anywhere; }
.py-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-bottom:10px; }
.py-form-grid > * { min-width:0; }
#pyForm :is(input:not([type="radio"]), select, textarea) { min-width:0; max-width:100%; width:100%; box-sizing:border-box; }
@media (max-width:420px) { .py-form-grid { grid-template-columns:minmax(0,1fr); } }
`;
  document.head.appendChild(st);
}

function formAc() {
  const f = document.getElementById("pyForm");
  if (!f) return;
  if (f.style.display !== "none") { f.style.display = "none"; return; }
  formStiliEkle();
  f.style.display = "block";
  f.innerHTML = `
    <div class="py-form-grid">
      <div>
        <label style="font-size:10.5px; font-weight:800; color:var(--c-muted); text-transform:uppercase;">Ad Soyad</label>
        <input type="text" id="pyAd" placeholder="Ayşe Yılmaz"
          style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; font-size:13px; margin-top:3px;">
      </div>
      <div>
        <label style="font-size:10.5px; font-weight:800; color:var(--c-muted); text-transform:uppercase;">Yakınlık</label>
        <select id="pyYakinlik" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; font-size:13px; margin-top:3px;">
          ${YAKINLIKLAR.map(y => `<option>${y}</option>`).join("")}
        </select>
      </div>
    </div>
    <input type="tel" id="pyTel" placeholder="Telefon (isteğe bağlı) — acil teyit için"
      style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; font-size:13px; margin-bottom:10px;">
    <div style="display:flex; gap:8px;">
      <button class="ca-btn ghost" style="flex:1;" onclick="window._pickupYetki.formAc()">İptal</button>
      <button class="ca-btn" style="flex:2;" onclick="window._pickupYetki.ekle()">Listeye Ekle</button>
    </div>`;
  setTimeout(() => document.getElementById("pyAd")?.focus(), 50);
}

async function ekle() {
  const { state, toast } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) return;
  const ad = (document.getElementById("pyAd")?.value || "").trim();
  const yakinlik = document.getElementById("pyYakinlik")?.value || "Diğer";
  const telefon = (document.getElementById("pyTel")?.value || "").trim();
  if (ad.length < 2) { toast("Ad soyad girin", "error"); return; }

  const mevcut = await listeGetir(ogr.id, true);
  if (mevcut.some(k => k.ad.toLocaleLowerCase("tr") === ad.toLocaleLowerCase("tr"))) {
    toast("Bu kişi zaten listede", "error"); return;
  }
  const kisi = { ad, yakinlik, telefon };
  const yeni = [...mevcut, kisi];
  if (!(await kaydet(ogr.id, yeni))) return;
  toast("✓ " + ad + " listeye eklendi");
  await veliKart("veliPickupYetkiKart");
  await gonderKartiGoster(kisi);
}

// Yeni eklenen kişi için: mesaj önizlemesi + WhatsApp / Paylaş / Şimdi değil.
let _bekleyen = null;
async function gonderKartiGoster(kisi) {
  const kutu = document.getElementById("pyGonder");
  const ogr = aktifOgrenci();
  const { yol, okul } = await okulKonumuHazirla();
  if (!kutu || !ogr || !okul || !yol.konumGonderilebilirMi(kisi)) return;
  const { esc } = P();
  const metin = yol.konumMesaji({ okul, kisiAdi: kisi.ad, cocukAdi: ogr.ogrenciAdSoyad || "", teslim: true });
  const wa = yol.whatsappBaglantisi(kisi.telefon, metin);
  _bekleyen = { metin, wa, baslik: okul.ad + " konumu" };
  kutu.innerHTML = `
    <div style="font-size:14px; font-weight:800; color:var(--c-ink);">📍 Okulun konumunu gönderin</div>
    <div style="font-size:12px; color:var(--c-muted); margin-top:3px; line-height:1.45;">${esc(kisi.ad)} okula ilk kez gelecekse yol tarif etmek yerine bu mesajı gönderin.</div>
    <div style="margin-top:10px; padding:10px 12px; background:#fff; border:1px solid #DCFCE7; border-radius:10px; font-size:12px; line-height:1.5; white-space:pre-wrap; overflow-wrap:anywhere; max-height:160px; overflow-y:auto;">${esc(metin)}</div>
    <div style="display:flex; gap:8px; margin-top:10px;">
      ${wa ? `<button class="ca-btn" style="flex:1; background:#15803D;" onclick="window._pickupYetki.gonderWa()">💬 WhatsApp</button>` : ""}
      <button class="ca-btn ${wa ? "ghost" : ""}" style="flex:1;" onclick="window._pickupYetki.gonderPaylas()">↗ Paylaş</button>
    </div>
    <button onclick="window._pickupYetki.gonderKapat()" style="display:block; margin:8px auto 0; background:none; border:0; color:var(--c-muted); font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer;">Şimdi değil</button>`;
  kutu.hidden = false;
}
function gonderKapat() {
  _bekleyen = null;
  const kutu = document.getElementById("pyGonder");
  if (kutu) { kutu.hidden = true; kutu.innerHTML = ""; }
}
function gonderWa() {
  if (_bekleyen?.wa) disariAc(_bekleyen.wa);
  gonderKapat();
}
async function gonderPaylas() {
  if (!_bekleyen) return;
  const { yol } = await okulKonumuHazirla();
  const sonuc = await yol.konumPaylas({ metin: _bekleyen.metin, baslik: _bekleyen.baslik });
  paylasimBildir(yol, sonuc);
  if (sonuc === "paylasildi") gonderKapat();
}

// Listedeki kişiye: telefonu varsa WhatsApp'ta o kişiyle sohbet, yoksa paylaşım menüsü.
async function konumGonder(i) {
  const ogr = aktifOgrenci();
  if (!ogr) return;
  const [liste, { yol, okul }] = await Promise.all([listeGetir(ogr.id), okulKonumuHazirla()]);
  const kisi = liste[i];
  if (!okul || !kisi) return;
  paylasimBildir(yol, await yol.teslimKonumuGonder({ okul, kisi, cocukAdi: ogr.ogrenciAdSoyad || "", bugun: false, disariAc }));
}

// Okul Zili: "Kim alacak" seçimi anne/baba değilse konum gönderme düğmesi görünür.
export async function zilKonumKur() {
  const kutu = document.getElementById("vzKonum"), sec = document.getElementById("vzKisi");
  if (!kutu || !sec) return;
  const { yol, okul } = await okulKonumuHazirla();
  if (!okul || !yol || !kutu.isConnected) { kutu.hidden = true; return; }
  const { esc } = P();
  const ciz = () => {
    const kisi = (window._vzYetkililer || []).find(k => k.ad === sec.value) || null;
    kutu.hidden = !yol.konumGonderilebilirMi(kisi);
    if (kutu.hidden) { kutu.innerHTML = ""; return; }
    const wa = !!yol.whatsappBaglantisi(kisi.telefon, "x");
    kutu.innerHTML = `
      <button type="button" onclick="window._pickupYetki.zilKonumGonder()" style="width:100%; border:0; border-radius:10px; background:#FEF3C7; color:#92400E; font-family:inherit; font-size:13.5px; font-weight:700; padding:11px; cursor:pointer;">📍 ${wa ? "Konumu WhatsApp ile gönder" : "Okulun konumunu gönder"}</button>
      <div style="font-size:10.5px; color:var(--c-muted); margin-top:5px; text-align:center; line-height:1.45;">${esc(kisi.ad)} okula ilk kez gelecekse: okulun adresi ve haritadaki yeri hazır bir mesajla gider.</div>`;
  };
  sec.addEventListener("change", ciz);
  ciz();
}
async function zilKonumGonder() {
  const ogr = aktifOgrenci(), sec = document.getElementById("vzKisi");
  const kisi = (window._vzYetkililer || []).find(k => k.ad === sec?.value);
  const { yol, okul } = await okulKonumuHazirla();
  if (!ogr || !kisi || !okul) return;
  paylasimBildir(yol, await yol.teslimKonumuGonder({ okul, kisi, cocukAdi: ogr.ogrenciAdSoyad || "", disariAc }));
}

async function sil(i) {
  const { state, toast } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) return;
  const mevcut = await listeGetir(ogr.id, true);
  const k = mevcut[i];
  if (!k) return;
  if (!confirm(`${k.ad} listeden çıkarılsın mı?\n\nBu kişi artık ${(ogr.ogrenciAdSoyad || "çocuğunuzu").split(" ")[0]}'ı teslim alamaz.`)) return;
  mevcut.splice(i, 1);
  await kaydet(ogr.id, mevcut);
  toast(k.ad + " listeden çıkarıldı");
  veliKart("veliPickupYetkiKart");
}

async function kaydet(ogrenciId, kisiler) {
  const { fb, db, state } = P();
  try {
    // Ana veli kaydı asıl kaynaktır. Danışma için kişisel telefon içermeyen
    // projeksiyon yardımcı kayıttır ve izin sorunu ana işlemi engellememelidir.
    await fb.setDoc(fb.doc(db, "pickupYetkilileri", ogrenciId), {
      kisiler,
      guncelleyen: (state.currentUser?.email || "").toLowerCase(),
      guncellendi: fb.serverTimestamp()
    }, { merge: true });

    try {
      await fb.setDoc(fb.doc(db, "danismaPickupYetkilileri", ogrenciId), {
        kisiler: kisiler.map(k => ({ ad: k.ad || "", yakinlik: k.yakinlik || "" })),
        guncellendi: fb.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("pickup güvenli yetkili özeti kaydedilemedi:", e.code || e.message);
    }

    _cache[ogrenciId] = kisiler;
    return true;
  } catch (e) {
    console.error("pickup yetkili kaydet:", e);
    P().toast("Kaydedilemedi: " + e.message, "error");
    return false;
  }
}


// ───────────────────────────────────────────────────────────────────
// ÖĞRETMEN / DANIŞMA — teslim anında "kim alabilir?" penceresi
// ───────────────────────────────────────────────────────────────────
const _IKON = { Anne:"👩", Baba:"👨", Anneanne:"👵", Babaanne:"👵", Dede:"👴", Teyze:"👩‍🦱", Hala:"👩‍🦱",
  Amca:"👨‍🦱", Dayı:"👨‍🦱", Abla:"👧", Ağabey:"👦", Servis:"🚌", Bakıcı:"🧑‍🍼", Komşu:"🏠" };

export async function ogretmenPopup(ogrenciId, ogrenciAd) {
  const { esc, state } = P();
  const kisiler = await listeGetir(ogrenciId);
  const telefonGoster = state.rol !== "danisma" && state.rol !== "halkla_iliskiler";
  const eski = document.getElementById("pyPopup");
  if (eski) eski.remove();
  const m = document.createElement("div");
  m.id = "pyPopup";
  m.className = "modal-overlay active";
  m.onclick = (e) => { if (e.target.id === "pyPopup") m.remove(); };
  m.innerHTML = `
    <div class="modal-box" style="max-width:420px;">
      <div style="background:linear-gradient(135deg,#2D5E3E,#4A7C59); color:#fff; padding:16px 20px; border-radius:18px 18px 0 0;">
        <div style="font-size:11px; font-weight:800; letter-spacing:1.2px; opacity:.85;">🛡️ TESLİM YETKİSİ</div>
        <div style="font-size:17px; font-weight:800; margin-top:4px;">${esc(ogrenciAd)}</div>
      </div>
      <div style="padding:14px 20px;">
        <div style="font-size:12px; color:var(--c-muted); margin-bottom:10px;">Bu çocuğu yalnızca aşağıdaki kişiler teslim alabilir:</div>
        ${kisiler.map(k => `
          <div style="display:flex; align-items:center; gap:11px; padding:9px 0; border-bottom:1px solid #F1F2F7;">
            <span style="font-size:24px;">${_IKON[k.yakinlik] || "👤"}</span>
            <div style="flex:1;">
              <div style="font-size:14px; font-weight:700; color:var(--c-ink);">${esc(k.ad)}</div>
              <div style="font-size:11.5px; color:var(--c-muted);">${esc(k.yakinlik || "")}${telefonGoster && k.telefon ? ` · <a href="tel:${esc(k.telefon)}" style="color:#2D5E3E; font-weight:700;">${esc(k.telefon)}</a>` : ""}</div>
            </div>
          </div>`).join("")}
        ${!kisiler.length ? `<div style="padding:12px; background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; font-size:12px; color:#92400E;">Güvenli teslim yetkilisi listesi henüz hazırlanmadı. Çocuğu teslim etmeden önce yönetimden teyit alın.</div>` : ""}
        <div style="margin-top:12px; padding:10px 12px; background:#FEF2F2; border-radius:10px; font-size:11.5px; color:#991B1B; line-height:1.5;">
          ⚠ Listede olmayan biri geldiyse çocuğu <strong>teslim etmeyin</strong>; yönetim üzerinden teyit isteyin.
        </div>
        <button class="btn-mini" onclick="document.getElementById('pyPopup').remove()" style="width:100%; margin-top:12px; padding:10px;">Kapat</button>
      </div>
    </div>`;
  document.body.appendChild(m);
}

// ───────────────────────────────────────────────────────────────────
// VELİ OKUL ZİLİ — izin güvenli kayıt
// Eski akış ana pickup kaydı ile danışma projeksiyonunu aynı batch'e koyduğu
// için projeksiyon izni reddedildiğinde ana bildirim de geri alınıyordu.
// Burada ana kayıt + isimsiz kuyruk atomik tutulur; danışma özeti best-effort'tur.
// ───────────────────────────────────────────────────────────────────
function pickupBugun() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

async function veliOkulZiliGuvenliBildir() {
  const api = P();
  if (!api) return;
  const { fb, db, state, toast } = api;
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler?.[0];
  if (!ogr) {
    if (toast) toast("Öğrenci bilgisi bulunamadı.", "error");
    return;
  }

  const saat = (document.getElementById("vzSaat")?.value || "").trim();
  const kisiEl =
    document.getElementById("vzKisi") ||
    document.getElementById("vzAlanKisi") ||
    document.querySelector("#veliOkulZiliKart select");
  const kisi = (kisiEl?.value || "Veli").trim();

  if (!/^\d{1,2}:\d{2}$/.test(saat)) {
    if (toast) toast("Varış saatini seçin.", "error");
    return;
  }

  const tarih = pickupBugun();
  const id = ogr.id + "__" + tarih;
  const tamVeri = {
    ogrenciId: ogr.id,
    ogrenciAd: ogr.ogrenciAdSoyad || ogr.ogrenciAd || "",
    sinif: ogr.sinif || "",
    tarih,
    hedefSaat: saat,
    alanKisi: kisi,
    durum: "yolda",
    veliEmail: (state.currentUser?.email || "").toLowerCase(),
    olusturuldu: new Date().toISOString(),
    guncellendi: fb.serverTimestamp()
  };

  // Ana çıkış kaydı ile sıra kaydını birbirinden ayır.
  // Böylece kuyruk tarafındaki bir izin/şema sorunu veli bildirimini engellemez.
  try {
    await fb.setDoc(fb.doc(db, "pickupBildirimleri", id), tamVeri, { merge: true });
  } catch (e) {
    console.error("okul zili pickupBildirimleri:", e);
    if (toast) toast("Gönderilemedi — ana çıkış kaydı: " + (e.message || e), "error");
    return;
  }

  try {
    await fb.setDoc(fb.doc(db, "pickupKuyruk", tarih), {
      tarih,
      ogrenciler: { [ogr.id]: { saat } },
      guncellendi: fb.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn("Okul Zili sıra kaydı güncellenemedi:", e.code || e.message);
  }

  try {
    const guvenliRef = fb.doc(db, "danismaPickupBildirimleri", id);
    const guvenli = {
      ogrenciId: ogr.id,
      ogrenciAd: tamVeri.ogrenciAd,
      sinif: tamVeri.sinif,
      tarih,
      hedefSaat: saat,
      alanKisi: kisi,
      durum: "yolda",
      olusturuldu: tamVeri.olusturuldu,
      guncellendi: fb.serverTimestamp()
    };
    const mevcut = await fb.getDoc(guvenliRef);
    if (mevcut.exists()) {
      await fb.setDoc(guvenliRef, {
        hedefSaat: saat,
        alanKisi: kisi,
        durum: "yolda",
        guncellendi: fb.serverTimestamp()
      }, { merge: true });
    } else {
      await fb.setDoc(guvenliRef, guvenli);
    }
  } catch (e) {
    console.warn("Okul Zili danışma özeti güncellenemedi:", e.code || e.message);
  }

  await operasyonPushTetikle("pickup-yeni", id);

  if (toast) toast("🔔 Bildiriminiz öğretmene iletildi");
  if (typeof window.veliOkulZiliDoldur === "function") {
    try { await window.veliOkulZiliDoldur(); } catch (_) {}
  }
}
veliOkulZiliGuvenliBildir.__bckaGuvenli = true;

function okulZiliGuvenliBildirimiKur() {
  const mevcut = window.veliOkulZiliBildir;
  if (mevcut && mevcut.__bckaGuvenli) return true;
  if (typeof mevcut !== "function") return false;
  window.veliOkulZiliBildir = veliOkulZiliGuvenliBildir;
  return true;
}

if (!okulZiliGuvenliBildirimiKur()) {
  let deneme = 0;
  const timer = setInterval(() => {
    deneme += 1;
    if (okulZiliGuvenliBildirimiKur() || deneme >= 80) clearInterval(timer);
  }, 250);
}

window._pickupYetki = { formAc, ekle, sil, ogretmenPopup, konumGonder, gonderWa, gonderPaylas, gonderKapat, zilKonumGonder };
