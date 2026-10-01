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

import { bildirimZamani, enYeniBildirimOnce, canliListeOlustur } from "../js/okul-zili-liste-core.js?v=168";

import { sabahBugun, sabahDurumu, sabahVerileriniDinle } from "../js/sabah-yoklama-core.js?v=168";

const P = () => window.PortalAPI;

function saatY(iso) {
  if (!iso) return "";
  const ms = bildirimZamani(iso);
  if (!ms) return "";
  const d = new Date(ms);
  return isNaN(d) ? "" : String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function haftaSonuMu() { const g = new Date().getDay(); return g === 0 || g === 6; }
function danismaMi() { return ["danisma", "halkla_iliskiler"].includes(P().state.rol); }
function sabahKaynak() { return danismaMi() ? "danismaSabahGirisleri" : "sabahGirisleri"; }
function sabahGuvenliVeri(v, ogrenciId = "", tarih = "") {
  const { fb } = P();
  const x = v || {};
  return {
    ogrenciId: x.ogrenciId || ogrenciId || "", ogrenciAd: x.ogrenciAd || "",
    sinif: x.sinif || "", tarih: x.tarih || tarih || "",
    veliBildirdi: x.veliBildirdi === true, veliBildirimSaati: x.veliBildirimSaati || "",
    sinifaGirisOnayi: x.sinifaGirisOnayi || "", onaylayanAd: x.onaylayanAd || "",
    onaylayanRol: x.onaylayanRol || "", guncellendi: fb.serverTimestamp()
  };
}

// ───────────────────────────────────────────────────────────────────
// VELİ TARAFI
// ───────────────────────────────────────────────────────────────────
export async function veliKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { fb, db, state, esc } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) { el.innerHTML = ""; return; }

  if (haftaSonuMu()) {
    el.innerHTML = `<div style="padding:14px 18px; display:flex; align-items:center; gap:12px;">
      <span style="font-size:24px;">🌅</span>
      <div><div class="ca-head" style="font-size:14px;">Sabah Girişi</div>
      <div class="ca-tile-sub">Hafta sonu · okul kapalı</div></div></div>`;
    return;
  }

  const tarih = sabahBugun();
  let k = null;
  try {
    const s = await fb.getDoc(fb.doc(db, "sabahGirisleri", ogr.id + "__" + tarih));
    if (s.exists()) {
      k = s.data();
      // Rendering is read-only. Reception copy runs after an acknowledged notice.
    }
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

let _veliBildirimSuruyor = false;
async function veliBildir() {
  if (_veliBildirimSuruyor) return;
  const api = P();
  const uid = api?.auth?.currentUser?.uid;
  const childId = (api?.state?.veliAktifOgrenci || api?.state?.veliOgrenciler?.[0])?.id;
  if (!uid || !childId) { api?.toast?.("Sabah girişi: önce veli hesabıyla giriş yapın.", "error"); return; }
  const active = () => P()?.auth?.currentUser?.uid === uid &&
    (P()?.state?.veliAktifOgrenci || P()?.state?.veliOgrenciler?.[0])?.id === childId;
  const buttons = () => document.querySelectorAll('button[onclick="window._sabahGirisi.bildir()"]');
  const busy = value => buttons().forEach(el => { el.disabled = value; el.setAttribute('aria-busy', String(value)); });
  _veliBildirimSuruyor = true;
  busy(true);
  let saved = false;
  try {
    const { sabahGirisKaydet } = await import("../js/sabah-giris-kaydi.js?v=1");
    if (!active()) return;
    const tarihliApi = Object.create(api); // Canlı state getter / oturum kontrolleri korunur.
    tarihliApi.bugun = sabahBugun;
    const result = await sabahGirisKaydet(tarihliApi);
    saved = result.anaKayitKaydedildi;
    if (!active()) return;
    if (result.zatenTeslimAlindi) {
      api.toast("Sabah girişi: çocuğunuzun teslim alındığı zaten kayıtlı.");
    } else if (result.danismaAktarildi) {
      api.toast("🌅 Sabah giriş bildiriminiz kaydedildi.");
    } else {
      api.toast("Sabah giriş bildirimi kaydedildi; danışma ekranına aktarım doğrulanamadı (SG-OZET).", "warn");
    }
    try { await veliKart("veliSabahGirisiKart"); } catch (_) {
      if (active()) api.toast("Sabah bildirimi kaydedildi; ekran yenilenemedi (SG-EKRAN).", "warn");
    }
    if (active() && saved && !result.danismaAktarildi) {
      document.getElementById("sabahAktarimUyarisi")?.remove();
      const warning = document.createElement("div");
      warning.id = "sabahAktarimUyarisi";
      warning.setAttribute("role", "status");
      warning.style.cssText = "padding:12px 16px;font-size:13px;border-top:1px solid #e2e8f0;background:#fffbeb;color:#92400e;";
      warning.textContent = "Bildirim kaydedildi. Danışma ekranına aktarım doğrulanamadı; karşılanacağınızı okuldan teyit edin. Kontrol kodu: SG-OZET.";
      document.getElementById("veliSabahGirisiKart")?.append(warning);
    }
  } catch (e) {
    if (active()) {
      const code = /^[a-z0-9/-]{1,80}$/.test(e?.code || '') ? e.code : 'unknown';
      api.toast(saved ? "Sabah bildirimi kaydedildi; ekran güncellenemedi (SG-EKRAN)." : "Sabah girişi kaydedilemedi (SG-ANA): " + code, saved ? "warn" : "error");
    }
  } finally {
    _veliBildirimSuruyor = false;
    if (active()) busy(false);
  }
}

// ───────────────────────────────────────────────────────────────────
// ÖĞRETMEN TARAFI — sınıfının bugünkü giriş listesi
// ───────────────────────────────────────────────────────────────────
const _canli = canliListeOlustur();

export function ogretmenKart(hedefId, veri = null) {
  const el = document.getElementById(hedefId);
  if (!el) { _canli.durdur(); return; }
  const { state, esc, ogrenciDurum, lucide } = P();

  if (haftaSonuMu()) {
    _canli.durdur();
    el.innerHTML = `<div class="ca-tile-sub">Hafta sonu · okul kapalı</div>`;
    return;
  }

  if (!veri) { canliBaslat(hedefId); return; }

  const siniflarim = state.siniflar || [];

  // Sınıfımın aktif öğrencileri
  const ogrenciler = state.ogrenciList.filter(o => {
    const a = state.ayarListesi[o.id];
    if (!a) return false;
    if (ogrenciDurum(o, a) !== "aktif") return false;
    const sn = (a.kayit && a.kayit.sinif) || o.sinif || o.sinifi || "";
    return !siniflarim.length || siniflarim.includes(sn);
  }).sort((a, b) => (a.ogrenciAdSoyad || "").localeCompare(b.ogrenciAdSoyad || "", "tr"));

  const kayitlar = {};
  veri.sabah.forEach(d => { const v = d.data(); if (v.ogrenciId) kayitlar[v.ogrenciId] = v; });
  const yoklamaHazir = veri.yoklamaDurum === "kapali" ||
    (veri.yoklamaDurum === "hazir" && veri.izinDurum === "hazir");
  const durumlar = Object.fromEntries(ogrenciler.map(o => [o.id,
    sabahDurumu(kayitlar[o.id], veri.yoklama[o.id], veri.izinliler.has(o.id), yoklamaHazir)]));
  const yeniOnce = (a, b) => enYeniBildirimOnce(
    { id: a.id, veliBildirimSaati: kayitlar[a.id]?.veliBildirimSaati },
    { id: b.id, veliBildirimSaati: kayitlar[b.id]?.veliBildirimSaati }, 'veliBildirimSaati');
  const aktif = ogrenciler.filter(o => ["aktif", "kontrol"].includes(durumlar[o.id].grup)).sort(yeniOnce);
  const gelmeyen = ogrenciler.filter(o => durumlar[o.id].grup === "gelmeyen");
  const tamam = ogrenciler.filter(o => durumlar[o.id].grup === "tamam").sort(yeniOnce);
  const yolda = aktif.filter(o => durumlar[o.id].durum === "yolda").length;
  const bekliyor = aktif.filter(o => ["bekliyor", "belirsiz"].includes(durumlar[o.id].durum)).length;
  const kontrol = aktif.filter(o => durumlar[o.id].grup === "kontrol").length;
  const etiketler = { teslim: "Teslim alındı", geldi: "Yoklamada geldi", gec: "Yoklamada geç geldi", gelmedi: "Gelmedi", izinli: "İzinli", hasta: "Hasta",
    yolda: "Yolda", bekliyor: "Bildirim yok", belirsiz: "Yoklama doğrulanıyor", diger: "Diğer yoklama kaydı" };
  const satir = o => {
    const k = kayitlar[o.id] || {}, d = durumlar[o.id];
    const ad = o.ogrenciAdSoyad || o.adSoyad || "—";
    const sinif = state.ayarListesi[o.id]?.kayit?.sinif || o.sinif || "";
    const renk = d.grup === "kontrol" ? "#B45309" : d.grup === "tamam" ? "#059669" : d.grup === "gelmeyen" ? "#7C3AED" : "#0E7490";
    const detay = d.durum === "diger" ? "Tanımlanamayan yoklama durumu · Kaydı kontrol edin" : d.grup === "kontrol"
      ? `${d.teslim ? "Teslim onayı" : "Geliş bildirimi"} var · Yoklama: ${etiketler[d.durum]} · Kayıtları kontrol edin`
      : [siniflarim.length > 1 ? esc(sinif) : "", k.veliBildirimSaati ? "🚗 " + saatY(k.veliBildirimSaati) : "",
         k.sinifaGirisOnayi ? "✅ " + saatY(k.sinifaGirisOnayi) + (k.onaylayanAd ? " · " + esc(k.onaylayanAd.split(" ")[0]) : "") : ""].filter(Boolean).join(" · ");
    return `<div data-sabah-ogrenci="${esc(o.id)}" data-sabah-grup="${d.grup}" style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #F1F2F7;">
      <div style="width:30px; height:30px; border-radius:9px; background:#F8FAFC; color:${renk}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0;">${esc(ad.charAt(0).toUpperCase())}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700; font-size:13px; color:var(--c-ink);">${esc(ad)}</div>
        <div style="font-size:11px; color:${d.grup === "kontrol" ? renk : "var(--c-muted)"};">${detay}</div>
      </div>
      ${d.eylem ? `<button class="btn-mini" onclick="window._sabahGirisi.onayla('${o.id}','${esc(sinif)}')" style="background:#ECFDF5; color:#166534; border-color:#86EFAC; font-weight:700; padding:5px 10px; font-size:11px; white-space:nowrap;">Teslim aldım</button>`
        : `<span style="font-size:10px; font-weight:800; color:${renk}; background:#F8FAFC; padding:3px 8px; border-radius:100px;">${d.grup === "kontrol" ? "Kontrol gerekli" : etiketler[d.durum]}</span>`}
    </div>`;
  };
  const tamamAcik = el.querySelector('[data-sabah-tamam]')?.open === true;
  const okumaHatasi = [veri.yoklamaDurum, veri.izinDurum].includes("hata");
  el.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
      <span style="font-size:11px; font-weight:800; color:#0E7490; background:#ECFEFF; padding:3px 9px; border-radius:100px;">🚗 Yolda ${yolda}</span>
      <span style="font-size:11px; font-weight:800; color:#059669; background:#ECFDF5; padding:3px 9px; border-radius:100px;">✅ Geldi / teslim alındı ${tamam.length}</span>
      <span style="font-size:11px; font-weight:800; color:#64748B; background:#F8FAFC; padding:3px 9px; border-radius:100px;">⏳ Bekleniyor ${yoklamaHazir ? bekliyor : "—"}</span>
      ${gelmeyen.length ? `<span class="ca-tile-sub">Gelmedi / izinli / hasta ${gelmeyen.length}</span>` : ""}
      ${kontrol ? `<span style="color:#B45309; font-size:12px;">Kontrol gerekli ${kontrol}</span>` : ""}
    </div>
    ${!yoklamaHazir ? `<div role="status" class="ca-tile-sub">${okumaHatasi ? 'Yoklama veya izin bilgisi doğrulanamadı. <button class="btn-mini" data-sabah-tekrar>Yeniden dene</button>' : 'Yoklama ve izin bilgisi okunuyor…'}</div>` : ""}
    ${aktif.map(satir).join("")}
    ${!aktif.length && ogrenciler.length ? `<div class="ca-tile-sub" style="padding:8px 0;">Bekleyen geliş yok.</div>` : ""}
    ${gelmeyen.length ? `<section aria-label="Gelmedi, izinli ve hasta öğrenciler" style="margin-top:10px;">
      <div style="font-size:12px; font-weight:800; color:#64748B;">Gelmedi · İzinli · Hasta (${gelmeyen.length})</div>
      ${gelmeyen.map(satir).join("")}</section>` : ""}
    ${tamam.length ? `<details data-sabah-tamam ${tamamAcik ? "open" : ""} style="margin-top:10px;">
      <summary style="cursor:pointer; font-size:12px; font-weight:700; color:#059669;">Geldi / teslim alındı (${tamam.length})</summary>
      ${tamam.map(satir).join("")}</details>` : ""}
    ${!ogrenciler.length ? `<div class="ca-tile-sub">Sınıfınızda aktif öğrenci yok.</div>` : ""}`;
  el.querySelector('[data-sabah-tekrar]')?.addEventListener('click', () => { _canli.durdur(); ogretmenKart(hedefId); });

  lucide();
}

async function ogretmenOnayla(ogrenciId, sinif) {
  const { fb, db, state, toast } = P();
  const tarih = sabahBugun();
  try {
    const ROL_AD = { ogretmen: "Öğretmen", danisma: "Danışma", mudur: "Müdür", kurucu_mudur: "Kurucu Müdür", egitim_koordinator: "Koordinatör" };
    const tamGuncelleme = {
      ogrenciId, tarih, sinif: sinif || "",
      sinifaGirisOnayi: new Date().toISOString(),
      onaylayan: (state.currentUser?.email || "").toLowerCase(),
      onaylayanAd: (state.personel?.adSoyad) || state.currentUser?.displayName || "",
      onaylayanRol: ROL_AD[state.rol] || state.rol || "",
      guncellendi: fb.serverTimestamp()
    };
    const batch = fb.writeBatch(db);
    batch.set(fb.doc(db, "sabahGirisleri", ogrenciId + "__" + tarih), tamGuncelleme, { merge: true });
    batch.set(fb.doc(db, "danismaSabahGirisleri", ogrenciId + "__" + tarih), {
      ogrenciId, tarih, sinif: sinif || "",
      sinifaGirisOnayi: tamGuncelleme.sinifaGirisOnayi,
      onaylayanAd: tamGuncelleme.onaylayanAd,
      onaylayanRol: tamGuncelleme.onaylayanRol,
      guncellendi: fb.serverTimestamp()
    }, { merge: true });
    await batch.commit();
    toast("✓ Sınıfa giriş onaylandı");
    // Canlı dinleme kartı kendisi yeniler
  } catch (e) {
    console.error("giriş onay:", e);
    toast("Kaydedilemedi: " + e.message, "error");
  }
}

function sabahListeKimligi() {
  const { state } = P();
  return JSON.stringify([state.currentUser?.uid || "", state.rol, sabahKaynak(), sabahBugun(), state.siniflar || [], P().yoklamaGorebilir?.() === true]);
}
function canliBaslat(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) { _canli.durdur(); return; }
  const { fb, db } = P();
  const key = sabahListeKimligi();
  _canli.baslat({
    key, target: el,
    onStart: () => { el.innerHTML = '<div class="ca-tile-sub">Sabah girişleri yükleniyor…</div>'; },
    subscribe: (next, error) => sabahVerileriniDinle({ fb, db, kaynak: sabahKaynak(), tarih: sabahBugun(), yoklamaYetkisi: P().yoklamaGorebilir?.() === true }, next, error),
    isCurrent: () => document.getElementById(hedefId) === el && sabahListeKimligi() === key,
    render: veri => ogretmenKart(hedefId, veri),
    onError: e => {
      console.warn("sabah canlı:", e.code || e.message);
      el.innerHTML = '<div role="status" class="ca-tile-sub">Sabah girişleri yüklenemedi. <button class="btn-mini" data-sabah-tekrar>Yeniden dene</button></div>';
      el.querySelector('[data-sabah-tekrar]')?.addEventListener('click', () => ogretmenKart(hedefId));
    }
  });
}

// onclick'ler için global köprü
window._sabahGirisi = { bildir: veliBildir, onayla: ogretmenOnayla, durdur: () => _canli.durdur() };
