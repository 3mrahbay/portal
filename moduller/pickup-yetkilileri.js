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
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

const YAKINLIKLAR = ["Anne", "Baba", "Anneanne", "Babaanne", "Dede", "Teyze", "Hala", "Dayı", "Amca", "Abla", "Ağabey", "Servis", "Bakıcı", "Diğer"];

const _cache = {};

export async function listeGetir(ogrenciId, tazele = false) {
  if (!tazele && _cache[ogrenciId]) return _cache[ogrenciId];
  const { fb, db } = P();
  let kisiler = null;
  try {
    const s = await fb.getDoc(fb.doc(db, "pickupYetkilileri", ogrenciId));
    if (s.exists() && Array.isArray(s.data().kisiler)) kisiler = s.data().kisiler;
  } catch (e) { console.warn("pickup yetkilileri:", e.code || e.message); }
  // ZEKY varsayılanı: kayıt yoksa anne + baba
  if (!kisiler || !kisiler.length) kisiler = [{ ad: "Anne", yakinlik: "Anne" }, { ad: "Baba", yakinlik: "Baba" }];
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

  const kisiler = await listeGetir(ogr.id, true);
  const ad = (ogr.ogrenciAdSoyad || "Çocuğunuz").split(" ")[0];

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
    <div style="padding:6px 18px 12px;">
      ${kisiler.map((k, i) => `
        <div style="display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #F1F2F7;">
          <span style="font-size:20px;">${ikon(k.yakinlik)}</span>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13.5px; font-weight:700; color:var(--c-ink);">${esc(k.ad)}</div>
            <div style="font-size:11px; color:var(--c-muted);">${esc(k.yakinlik)}${k.telefon ? " · " + esc(k.telefon) : ""}</div>
          </div>
          ${kisiler.length > 1
            ? `<button onclick="window._pickupYetki.sil(${i})" style="background:none; border:none; color:#94A3B8; cursor:pointer; font-size:18px; padding:0 4px;" title="Listeden çıkar">×</button>`
            : ""}
        </div>`).join("")}
      <div style="font-size:11px; color:var(--c-muted); margin-top:8px; line-height:1.5;">
        Listede olmayan biri geldiğinde öğretmen sizi arayarak teyit alır. Değişiklikler anında geçerli olur.
      </div>
    </div>`;
}

function formAc() {
  const f = document.getElementById("pyForm");
  if (!f) return;
  if (f.style.display !== "none") { f.style.display = "none"; return; }
  f.style.display = "block";
  f.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
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
  const yeni = [...mevcut, { ad, yakinlik, telefon }];
  await kaydet(ogr.id, yeni);
  toast("✓ " + ad + " listeye eklendi");
  veliKart("veliPickupYetkiKart");
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
    await fb.setDoc(fb.doc(db, "pickupYetkilileri", ogrenciId), {
      kisiler,
      guncelleyen: (state.currentUser?.email || "").toLowerCase(),
      guncellendi: fb.serverTimestamp()
    }, { merge: true });
    _cache[ogrenciId] = kisiler;
  } catch (e) {
    console.error("pickup yetkili kaydet:", e);
    P().toast("Kaydedilemedi: " + e.message, "error");
  }
}


// ───────────────────────────────────────────────────────────────────
// ÖĞRETMEN / DANIŞMA — teslim anında "kim alabilir?" penceresi
// ───────────────────────────────────────────────────────────────────
const _IKON = { Anne:"👩", Baba:"👨", Anneanne:"👵", Babaanne:"👵", Dede:"👴", Teyze:"👩‍🦱", Hala:"👩‍🦱",
  Amca:"👨‍🦱", Dayı:"👨‍🦱", Abla:"👧", Ağabey:"👦", Servis:"🚌", Bakıcı:"🧑‍🍼", Komşu:"🏠" };

export async function ogretmenPopup(ogrenciId, ogrenciAd) {
  const { esc } = P();
  const kisiler = await listeGetir(ogrenciId);
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
              <div style="font-size:11.5px; color:var(--c-muted);">${esc(k.yakinlik || "")}${k.telefon ? ` · <a href="tel:${esc(k.telefon)}" style="color:#2D5E3E; font-weight:700;">${esc(k.telefon)}</a>` : ""}</div>
            </div>
          </div>`).join("")}
        <div style="margin-top:12px; padding:10px 12px; background:#FEF2F2; border-radius:10px; font-size:11.5px; color:#991B1B; line-height:1.5;">
          ⚠ Listede olmayan biri geldiyse çocuğu <strong>teslim etmeyin</strong>, veliyi arayın.
        </div>
        <button class="btn-mini" onclick="document.getElementById('pyPopup').remove()" style="width:100%; margin-top:12px; padding:10px;">Kapat</button>
      </div>
    </div>`;
  document.body.appendChild(m);
}

window._pickupYetki = { formAc, ekle, sil, ogretmenPopup };
