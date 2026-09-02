// ═══════════════════════════════════════════════════════════════════
// SABAH GİRİŞİ — moduller/sabah-girisi.js
// ZEKY ile ORTAK: sabahGirisleri/{ogrenciId}__{tarih}
//
// Akış:  veli "Yola çıktık" → veliBildirdi
//        danışma VEYA öğretmen "Teslim aldım" → sinifaGirisOnayi (+ kim aldı)
// Sabah kapıda genelde danışma alır; öğretmen de alabilir. Kim aldıysa
// adı ve rolü kayda geçer — veli "kime teslim ettim" bilgisini görür.
//
// Kullanım (index.html):
//   const m = await modulYukle("sabah-girisi");
//   m.veliKart("hedefElemanId")      → veli ana sayfası
//   m.ogretmenKart("hedefElemanId")  → öğretmen ana sayfası
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

function saatY(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function haftaSonuMu() { const g = new Date().getDay(); return g === 0 || g === 6; }

// ───────────────────────────────────────────────────────────────────
// VELİ TARAFI
// ───────────────────────────────────────────────────────────────────
export async function veliKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { fb, db, state, esc, bugun } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) { el.innerHTML = ""; return; }

  if (haftaSonuMu()) {
    el.innerHTML = `<div style="padding:14px 18px; display:flex; align-items:center; gap:12px;">
      <span style="font-size:24px;">🌅</span>
      <div><div class="ca-head" style="font-size:14px;">Sabah Girişi</div>
      <div class="ca-tile-sub">Hafta sonu · okul kapalı</div></div></div>`;
    return;
  }

  const tarih = bugun();
  let k = null;
  try {
    const s = await fb.getDoc(fb.doc(db, "sabahGirisleri", ogr.id + "__" + tarih));
    if (s.exists()) k = s.data();
  } catch (e) { console.warn("sabah girişi:", e.code || e.message); }

  const ad = (ogr.ogrenciAdSoyad || "Çocuğunuz").split(" ")[0];
  const bildirdi = !!(k && k.veliBildirdi);
  const onaylandi = !!(k && k.sinifaGirisOnayi);

  // ── Henüz bildirilmedi ──
  if (!bildirdi && !onaylandi) {
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#0E7490 0%,#06B6D4 100%); color:#fff; padding:14px 18px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:24px;">🌅</span>
          <div style="flex:1;">
            <div class="ca-head" style="font-size:15px; color:#fff;">Sabah Girişi</div>
            <div style="font-size:12px; opacity:.9;">${esc(ad)} okula geliyorsa bildirin, kapıda karşılansın</div>
          </div>
        </div>
      </div>
      <div style="padding:14px 18px;">
        <button class="ca-btn" style="width:100%; background:#0E7490; font-size:14px; padding:13px;" onclick="window._sabahGirisi.bildir()">
          🚗 Yola çıktık, geliyoruz
        </button>
      </div>`;
    return;
  }

  // ── Sınıfa girdi → kompakt tek satır, gün boyunca yer kaplamasın ──
  if (onaylandi) {
    const kim = k.onaylayanAd ? " · " + esc(k.onaylayanAd.split(" ")[0]) : "";
    el.innerHTML = `<div style="display:flex; align-items:center; gap:10px; padding:10px 16px; font-size:12.5px; color:#166534;">
      <span>🌅</span>
      <span style="flex:1;"><strong>${esc(ad)}</strong> ${saatY(k.sinifaGirisOnayi)}'de teslim alındı${kim}</span>
    </div>`;
    return;
  }

  // ── Bildirildi, henüz onaylanmadı ──
  const alanKisi = k.onaylayanAd
    ? `${esc(k.onaylayanAd)}${k.onaylayanRol ? " (" + esc(k.onaylayanRol) + ")" : ""} teslim aldı`
    : "Okul teslim aldı";
  const s = onaylandi
    ? { ad: "Sınıfa girdi", alt: alanKisi, renk: "#059669", bg: "#ECFDF5", ikon: "✅" }
    : { ad: "Bildirim alındı", alt: "Kapıda karşılanacaksınız", renk: "#0E7490", bg: "#ECFEFF", ikon: "🚗" };

  el.innerHTML = `
    <div style="background:${s.bg}; border-bottom:1px solid ${s.renk}22; padding:14px 18px;">
      <div style="display:flex; align-items:center; gap:11px;">
        <span style="font-size:26px;">${s.ikon}</span>
        <div style="flex:1; min-width:0;">
          <div class="ca-head" style="font-size:15px; color:${s.renk};">${s.ad}</div>
          <div class="ca-tile-sub">${s.alt}</div>
        </div>
      </div>
    </div>
    <div style="padding:12px 18px; display:flex; gap:0;">
      ${[
        { ad: "Bildirdiniz", z: k.veliBildirimSaati, ok: bildirdi },
        { ad: "Sınıfa girdi", z: k.sinifaGirisOnayi, ok: onaylandi }
      ].map((a, i) => `
        <div style="flex:1; text-align:center; position:relative;">
          ${i > 0 ? `<div style="position:absolute; left:-50%; right:50%; top:9px; height:2px; background:${a.ok ? s.renk : "#E2E8F0"};"></div>` : ""}
          <div style="width:20px; height:20px; border-radius:50%; margin:0 auto; background:${a.ok ? s.renk : "#E2E8F0"}; color:#fff; font-size:11px; display:flex; align-items:center; justify-content:center; position:relative; z-index:1;">${a.ok ? "✓" : ""}</div>
          <div style="font-size:11px; font-weight:700; color:${a.ok ? "#1E293B" : "#94A3B8"}; margin-top:5px;">${a.ad}</div>
          <div style="font-size:10.5px; color:var(--c-muted);">${saatY(a.z) || "—"}</div>
        </div>`).join("")}
    </div>`;
}

async function veliBildir() {
  const { fb, db, state, toast, bugun } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) return;
  const tarih = bugun();
  try {
    await fb.setDoc(fb.doc(db, "sabahGirisleri", ogr.id + "__" + tarih), {
      ogrenciId: ogr.id,
      ogrenciAd: ogr.ogrenciAdSoyad || ogr.adSoyad || "",
      sinif: (state.ayarListesi[ogr.id]?.kayit?.sinif) || ogr.sinif || "",
      tarih,
      veliBildirdi: true,
      veliBildirimSaati: new Date().toISOString(),
      veliBildirenEmail: (state.currentUser?.email || "").toLowerCase(),
      guncellendi: fb.serverTimestamp()
    }, { merge: true });
    toast("🌅 Bildiriminiz okula iletildi");
    veliKart("veliSabahGirisiKart");
  } catch (e) {
    console.error("sabah bildir:", e);
    toast("Gönderilemedi: " + e.message, "error");
  }
}

// ───────────────────────────────────────────────────────────────────
// ÖĞRETMEN TARAFI — sınıfının bugünkü giriş listesi
// ───────────────────────────────────────────────────────────────────
let _unsub = null;

export async function ogretmenKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { fb, db, state, esc, bugun, ogrenciDurum, lucide } = P();

  if (haftaSonuMu()) {
    el.innerHTML = `<div class="ca-tile-sub">Hafta sonu · okul kapalı</div>`;
    return;
  }

  const tarih = bugun();
  const siniflarim = state.siniflar || [];

  // Sınıfımın aktif öğrencileri
  const ogrenciler = state.ogrenciList.filter(o => {
    const a = state.ayarListesi[o.id];
    if (!a) return false;
    if (ogrenciDurum(o, a) !== "aktif") return false;
    const sn = (a.kayit && a.kayit.sinif) || o.sinif || o.sinifi || "";
    return !siniflarim.length || siniflarim.includes(sn);
  }).sort((a, b) => (a.ogrenciAdSoyad || "").localeCompare(b.ogrenciAdSoyad || "", "tr"));

  // Bugünkü kayıtlar
  const kayitlar = {};
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(db, "sabahGirisleri"), fb.where("tarih", "==", tarih)));
    snap.forEach(d => { const v = d.data(); if (v.ogrenciId) kayitlar[v.ogrenciId] = v; });
  } catch (e) { console.warn("sabah girişleri:", e.code || e.message); }

  const yolda = ogrenciler.filter(o => kayitlar[o.id]?.veliBildirdi && !kayitlar[o.id]?.sinifaGirisOnayi);
  const girdi = ogrenciler.filter(o => kayitlar[o.id]?.sinifaGirisOnayi);
  const bekliyor = ogrenciler.filter(o => !kayitlar[o.id]?.veliBildirdi && !kayitlar[o.id]?.sinifaGirisOnayi);

  const satir = (o, tip) => {
    const k = kayitlar[o.id] || {};
    const ad = o.ogrenciAdSoyad || o.adSoyad || "—";
    const sinif = (state.ayarListesi[o.id]?.kayit?.sinif) || o.sinif || "";
    const R = {
      yolda:    { r: "#0E7490", bg: "#ECFEFF", et: "Yolda" },
      girdi:    { r: "#059669", bg: "#ECFDF5", et: "Sınıfta" },
      bekliyor: { r: "#94A3B8", bg: "#F8FAFC", et: "Bildirim yok" }
    }[tip];
    return `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #F1F2F7;">
      <div style="width:30px; height:30px; border-radius:9px; background:${R.bg}; color:${R.r}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0;">${esc(ad.charAt(0).toUpperCase())}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700; font-size:13px; color:var(--c-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(ad)}</div>
        <div style="font-size:11px; color:var(--c-muted);">
          ${siniflarim.length > 1 ? esc(sinif) + " · " : ""}
          ${k.veliBildirimSaati ? "🚗 " + saatY(k.veliBildirimSaati) : ""}
          ${k.sinifaGirisOnayi ? " · ✅ " + saatY(k.sinifaGirisOnayi) + (k.onaylayanAd ? " · " + esc(k.onaylayanAd.split(" ")[0]) : "") : ""}
        </div>
      </div>
      ${tip !== "girdi"
        ? `<button class="btn-mini" onclick="window._sabahGirisi.onayla('${o.id}','${esc(sinif)}')"
             style="background:#ECFDF5; color:#166534; border-color:#86EFAC; font-weight:700; padding:5px 10px; font-size:11px; white-space:nowrap;">Teslim aldım</button>`
        : `<span style="font-size:10px; font-weight:800; color:${R.r}; background:${R.bg}; padding:3px 8px; border-radius:100px;">${R.et}</span>`}
    </div>`;
  };

  el.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
      <span style="font-size:11px; font-weight:800; color:#0E7490; background:#ECFEFF; padding:3px 9px; border-radius:100px;">🚗 Yolda ${yolda.length}</span>
      <span style="font-size:11px; font-weight:800; color:#059669; background:#ECFDF5; padding:3px 9px; border-radius:100px;">✅ Sınıfta ${girdi.length}</span>
      <span style="font-size:11px; font-weight:800; color:#64748B; background:#F8FAFC; padding:3px 9px; border-radius:100px;">⏳ Bekleniyor ${bekliyor.length}</span>
    </div>
    ${yolda.map(o => satir(o, "yolda")).join("")}
    ${bekliyor.slice(0, 8).map(o => satir(o, "bekliyor")).join("")}
    ${girdi.map(o => satir(o, "girdi")).join("")}
    ${!ogrenciler.length ? `<div class="ca-tile-sub">Sınıfınızda aktif öğrenci yok.</div>` : ""}`;

  lucide();
  canliBaslat(hedefId);
}

async function ogretmenOnayla(ogrenciId, sinif) {
  const { fb, db, state, toast, bugun } = P();
  const tarih = bugun();
  try {
    const ROL_AD = { ogretmen: "Öğretmen", danisma: "Danışma", mudur: "Müdür", kurucu_mudur: "Kurucu Müdür", egitim_koordinator: "Koordinatör" };
    await fb.setDoc(fb.doc(db, "sabahGirisleri", ogrenciId + "__" + tarih), {
      ogrenciId, tarih, sinif: sinif || "",
      sinifaGirisOnayi: new Date().toISOString(),
      onaylayan: (state.currentUser?.email || "").toLowerCase(),
      onaylayanAd: (state.personel?.adSoyad) || state.currentUser?.displayName || "",
      onaylayanRol: ROL_AD[state.rol] || state.rol || "",
      guncellendi: fb.serverTimestamp()
    }, { merge: true });
    toast("✓ Sınıfa giriş onaylandı");
    // Canlı dinleme kartı kendisi yeniler
  } catch (e) {
    console.error("giriş onay:", e);
    toast("Kaydedilemedi: " + e.message, "error");
  }
}

function canliBaslat(hedefId) {
  if (_unsub) return;
  const { fb, db, bugun } = P();
  try {
    const q = fb.query(fb.collection(db, "sabahGirisleri"), fb.where("tarih", "==", bugun()));
    _unsub = fb.onSnapshot(q, () => {
      if (document.getElementById(hedefId)) ogretmenKart(hedefId);
      else { _unsub(); _unsub = null; }
    }, (e) => console.warn("sabah canlı:", e.code || e.message));
  } catch (e) { console.warn("sabah canlı:", e); }
}

// onclick'ler için global köprü
window._sabahGirisi = { bildir: veliBildir, onayla: ogretmenOnayla };
