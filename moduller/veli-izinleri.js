// ═══════════════════════════════════════════════════════════════════
// VELİ İZİNLERİ — moduller/veli-izinleri.js
// ZEKY ile ORTAK: veliIzinleri/{otoId}
//
// Veli: "yarın gelmeyecek / erken alacağım / doktora götüreceğim" bildirir
// Öğretmen/yönetim: onaylar veya reddeder → durum: bekliyor | onayli | ret
// Onaylı izin, Devamsızlık ekranında "izinli" olarak görünür.
//
// Kullanım:
//   m.veliKart("hedefId")       → veli ana sayfası (talep + geçmiş)
//   m.ogretmenKart("hedefId")   → öğretmen/yönetim (bekleyenler + onay)
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

const SEBEPLER = [
  { k: "hastalik",   ad: "Hastalık",            ikon: "🤒" },
  { k: "doktor",     ad: "Doktor / kontrol",     ikon: "🩺" },
  { k: "aile",       ad: "Aile ziyareti / seyahat", ikon: "🧳" },
  { k: "erken",      ad: "Erken alacağım",       ikon: "⏰" },
  { k: "gec",        ad: "Geç getireceğim",      ikon: "🕘" },
  { k: "diger",      ad: "Diğer",                ikon: "📝" }
];
const sebepAd = (k) => (SEBEPLER.find(s => s.k === k) || { ad: k }).ad;
const sebepIkon = (k) => (SEBEPLER.find(s => s.k === k) || { ikon: "📝" }).ikon;

function trh(iso) { return iso ? String(iso).substring(0, 10).split("-").reverse().join(".") : "—"; }
function gunAd(iso) {
  const d = new Date(iso); if (isNaN(d)) return "";
  return ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][d.getDay()];
}

// ───────────────────────────────────────────────────────────────────
// VELİ
// ───────────────────────────────────────────────────────────────────
export async function veliKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { fb, db, state, esc, bugun } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) { el.innerHTML = ""; return; }

  // Bu çocuğun izinleri (son 30 gün + gelecek)
  let izinler = [];
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(db, "veliIzinleri"), fb.where("ogrenciId", "==", ogr.id)));
    snap.forEach(d => izinler.push({ id: d.id, ...d.data() }));
    izinler.sort((a, b) => String(b.baslangic || "").localeCompare(String(a.baslangic || "")));
  } catch (e) { console.warn("veli izinleri:", e.code || e.message); }

  const b = bugun();
  const aktifler = izinler.filter(i => i.durum !== "ret" && (i.bitis || i.baslangic) >= b);
  const gecmis = izinler.filter(i => !aktifler.includes(i)).slice(0, 3);
  const ad = (ogr.ogrenciAdSoyad || "Çocuğunuz").split(" ")[0];

  const DURUM = {
    bekliyor: { ad: "Onay bekliyor", r: "#B45309", bg: "#FFFBEB" },
    onayli:   { ad: "Onaylandı",     r: "#059669", bg: "#ECFDF5" },
    ret:      { ad: "Reddedildi",    r: "#DC2626", bg: "#FEF2F2" }
  };
  const satir = (i) => {
    const s = DURUM[i.durum] || DURUM.bekliyor;
    return `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #F1F2F7;">
      <span style="font-size:18px;">${sebepIkon(i.sebep)}</span>
      <div style="flex:1; min-width:0;">
        <div style="font-size:13px; font-weight:600; color:var(--c-ink);">${esc(sebepAd(i.sebep))}</div>
        <div style="font-size:11px; color:var(--c-muted);">${gunAd(i.baslangic)} ${trh(i.baslangic)}${i.bitis && i.bitis !== i.baslangic ? " – " + trh(i.bitis) : ""}${i.aciklama ? " · " + esc(i.aciklama) : ""}</div>
      </div>
      <span style="font-size:10px; font-weight:800; color:${s.r}; background:${s.bg}; padding:3px 8px; border-radius:100px; white-space:nowrap;">${s.ad}</span>
    </div>`;
  };

  el.innerHTML = `
    <div style="padding:14px 18px; border-bottom:1px solid #F1F2F7; display:flex; align-items:center; gap:10px;">
      <span style="font-size:22px;">📅</span>
      <div style="flex:1;">
        <div class="ca-head" style="font-size:14px;">İzin & Bildirim</div>
        <div class="ca-tile-sub">${esc(ad)} gelmeyecekse veya erken/geç gelecekse bildirin</div>
      </div>
      <button class="ca-btn" style="padding:8px 14px; font-size:12.5px;" onclick="window._veliIzin.formAc()">+ Bildir</button>
    </div>
    <div id="veliIzinForm" style="display:none; padding:14px 18px; background:#F8FAFC; border-bottom:1px solid #F1F2F7;"></div>
    <div style="padding:6px 18px 12px;">
      ${aktifler.length
        ? aktifler.map(satir).join("")
        : `<div class="ca-tile-sub" style="padding:8px 0;">Aktif izin bildirimi yok.</div>`}
      ${gecmis.length ? `<details style="margin-top:8px;"><summary style="font-size:11.5px; color:var(--c-muted); cursor:pointer;">Geçmiş (${gecmis.length})</summary>${gecmis.map(satir).join("")}</details>` : ""}
    </div>`;
}

function formAc() {
  const f = document.getElementById("veliIzinForm");
  if (!f) return;
  if (f.style.display !== "none") { f.style.display = "none"; return; }
  const b = P().bugun();
  const yarin = new Date(); yarin.setDate(yarin.getDate() + 1);
  const y = yarin.toISOString().slice(0, 10);
  f.style.display = "block";
  f.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:8px; margin-bottom:10px;">
      ${SEBEPLER.map(s => `
        <label style="display:flex; align-items:center; gap:7px; padding:9px 11px; background:#fff; border:1.5px solid #E2E8F0; border-radius:10px; cursor:pointer; font-size:12.5px;">
          <input type="radio" name="vzSebep" value="${s.k}" ${s.k === "hastalik" ? "checked" : ""}>
          <span>${s.ikon}</span><span>${s.ad}</span>
        </label>`).join("")}
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
      <div><label style="font-size:10.5px; font-weight:800; color:var(--c-muted); text-transform:uppercase;">Başlangıç</label>
        <input type="date" id="vzBas" value="${y}" min="${b}" style="width:100%; box-sizing:border-box; padding:9px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"></div>
      <div><label style="font-size:10.5px; font-weight:800; color:var(--c-muted); text-transform:uppercase;">Bitiş</label>
        <input type="date" id="vzBit" value="${y}" min="${b}" style="width:100%; box-sizing:border-box; padding:9px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"></div>
    </div>
    <input type="text" id="vzNot" placeholder="Açıklama (isteğe bağlı) — örn. saat 14:00'te alacağım"
      style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; font-size:13px; margin-bottom:10px;">
    <div style="display:flex; gap:8px;">
      <button class="ca-btn ghost" style="flex:1;" onclick="window._veliIzin.formAc()">İptal</button>
      <button class="ca-btn" style="flex:2;" onclick="window._veliIzin.gonder()">Bildir</button>
    </div>`;
}

async function gonder() {
  const { fb, db, state, toast } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) return;
  const sebep = document.querySelector('input[name="vzSebep"]:checked')?.value || "diger";
  const bas = document.getElementById("vzBas")?.value;
  const bit = document.getElementById("vzBit")?.value || bas;
  const not = (document.getElementById("vzNot")?.value || "").trim();
  if (!bas) { toast("Tarih seçin", "error"); return; }
  if (bit < bas) { toast("Bitiş, başlangıçtan önce olamaz", "error"); return; }
  try {
    await fb.addDoc(fb.collection(db, "veliIzinleri"), {
      ogrenciId: ogr.id,
      ogrenciAd: ogr.ogrenciAdSoyad || "",
      sinif: (state.ayarListesi[ogr.id]?.kayit?.sinif) || ogr.sinif || "",
      sebep, sebepAd: sebepAd(sebep), aciklama: not,
      baslangic: bas, bitis: bit,
      durum: "bekliyor",
      veliEmail: (state.currentUser?.email || "").toLowerCase(),
      olusturuldu: new Date().toISOString()
    });
    toast("✓ Bildiriminiz iletildi, onay bekleniyor");
    veliKart("veliIzinKart");
  } catch (e) {
    console.error("izin bildir:", e);
    toast("Gönderilemedi: " + e.message, "error");
  }
}

// ───────────────────────────────────────────────────────────────────
// ÖĞRETMEN / YÖNETİM — bekleyen onaylar + bugün izinli olanlar
// ───────────────────────────────────────────────────────────────────
export async function ogretmenKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { fb, db, state, esc, bugun, lucide } = P();
  const siniflarim = state.siniflar || [];
  const ogretmenMi = P().ogretmenMi();
  const b = bugun();

  let hepsi = [];
  try {
    const snap = await fb.getDocs(fb.collection(db, "veliIzinleri"));
    snap.forEach(d => hepsi.push({ id: d.id, ...d.data() }));
  } catch (e) { console.warn("izinler:", e.code || e.message); }

  // Öğretmen sadece kendi sınıfı
  if (ogretmenMi && siniflarim.length) hepsi = hepsi.filter(i => siniflarim.includes(i.sinif));

  const bekleyen = hepsi.filter(i => i.durum === "bekliyor").sort((a, b2) => String(a.baslangic).localeCompare(String(b2.baslangic)));
  const bugunIzinli = hepsi.filter(i => i.durum === "onayli" && i.baslangic <= b && (i.bitis || i.baslangic) >= b);

  const satir = (i, islemli) => `
    <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #F1F2F7;">
      <span style="font-size:18px;">${sebepIkon(i.sebep)}</span>
      <div style="flex:1; min-width:0;">
        <div style="font-size:13px; font-weight:700; color:var(--c-ink);">${esc(i.ogrenciAd)}${siniflarim.length !== 1 ? ` <span style="font-weight:400; color:var(--c-muted); font-size:11px;">· ${esc(i.sinif)}</span>` : ""}</div>
        <div style="font-size:11px; color:var(--c-muted);">${esc(sebepAd(i.sebep))} · ${gunAd(i.baslangic)} ${trh(i.baslangic)}${i.bitis && i.bitis !== i.baslangic ? " – " + trh(i.bitis) : ""}${i.aciklama ? " · " + esc(i.aciklama) : ""}</div>
      </div>
      ${islemli ? `
        <button class="btn-mini" onclick="window._veliIzin.onayla('${i.id}','onayli')" style="background:#ECFDF5; color:#166534; border-color:#86EFAC; font-weight:700; padding:4px 9px; font-size:11px;">✓</button>
        <button class="btn-mini" onclick="window._veliIzin.onayla('${i.id}','ret')" style="background:#FEF2F2; color:#991B1B; border-color:#FCA5A5; padding:4px 9px; font-size:11px;">✕</button>`
      : `<span style="font-size:10px; font-weight:800; color:#059669; background:#ECFDF5; padding:3px 8px; border-radius:100px;">İzinli</span>`}
    </div>`;

  el.innerHTML = `
    ${bekleyen.length ? `
      <div style="font-size:11px; font-weight:800; color:#B45309; text-transform:uppercase; margin-bottom:6px;">Onay bekleyen (${bekleyen.length})</div>
      ${bekleyen.map(i => satir(i, true)).join("")}` : ""}
    ${bugunIzinli.length ? `
      <div style="font-size:11px; font-weight:800; color:#059669; text-transform:uppercase; margin:${bekleyen.length ? "12px" : "0"} 0 6px;">Bugün izinli (${bugunIzinli.length})</div>
      ${bugunIzinli.map(i => satir(i, false)).join("")}` : ""}
    ${!bekleyen.length && !bugunIzinli.length ? `<div class="ca-tile-sub">Bekleyen izin talebi yok, bugün izinli öğrenci yok.</div>` : ""}`;
  lucide();
}

async function onayla(id, sonuc) {
  const { fb, db, state, toast } = P();
  try {
    await fb.setDoc(fb.doc(db, "veliIzinleri", id), {
      durum: sonuc,
      onaylayan: (state.currentUser?.email || "").toLowerCase(),
      onaylayanAd: state.personel?.adSoyad || state.currentUser?.displayName || "",
      onayZamani: fb.serverTimestamp()
    }, { merge: true });
    toast(sonuc === "onayli" ? "✓ İzin onaylandı" : "İzin reddedildi");
    ogretmenKart("ogrVeliIzinKart");
    ogretmenKart("yonVeliIzinKart");
  } catch (e) {
    console.error("izin onay:", e);
    toast("Kaydedilemedi: " + e.message, "error");
  }
}

// Devamsızlık ekranı için: bu tarihte izinli öğrenci id'leri
export async function izinliOgrenciler(tarih) {
  const { fb, db } = P();
  const ids = new Set();
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(db, "veliIzinleri"), fb.where("durum", "==", "onayli")));
    snap.forEach(d => {
      const v = d.data();
      if (v.baslangic <= tarih && (v.bitis || v.baslangic) >= tarih && v.ogrenciId) ids.add(v.ogrenciId);
    });
  } catch (e) { /* sessiz */ }
  return ids;
}

window._veliIzin = { formAc, gonder, onayla };
