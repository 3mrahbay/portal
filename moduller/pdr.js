// ═══════════════════════════════════════════════════════════════════
// PDR — moduller/pdr.js
// ZEKY ile ORTAK: pdrGozlemleri/{id}, pdrTestleri/{id}
//
// ⚠ ÖZEL NİTELİKLİ KİŞİSEL VERİ (KVKK md.6)
//   Firestore Rules: yalnızca isPdr(), isYonetim(), isAdmin() okur/yazar.
//   Öğretmen ERİŞEMEZ — bilinçli ayrım. Veli yalnızca "veliylePaylas"
//   işaretli kayıtları görür.
//
// Kullanım:
//   m.panelRender("hedefId")  → PDR uzmanı / yönetim tam ekran
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

// ZEKY sabitleri — birebir
const ALANLAR = [
  { id: "sosyal",   ad: "Sosyal-Duygusal", ikon: "🤝", renk: "#C44569" },
  { id: "dil",      ad: "Dil ve İletişim", ikon: "💬", renk: "#2E5C8A" },
  { id: "bilissel", ad: "Bilişsel",        ikon: "🧠", renk: "#7B5EA7" },
  { id: "motor",    ad: "Motor",           ikon: "🏃", renk: "#E67E22" },
  { id: "ozbakim",  ad: "Özbakım",         ikon: "👕", renk: "#4A7C59" },
  { id: "davranis", ad: "Davranış-Oyun",   ikon: "🧩", renk: "#B8860B" }
];
const BAGLAMLAR = ["Serbest oyun", "Grup etkinliği", "Yemek", "Bahçe", "Geliş-gidiş", "Bireysel"];
const SEVIYELER = [
  { id: "takip",  ad: "Takip",  renk: "#C0392B", aciklama: "Yakından izlenmeli" },
  { id: "destek", ad: "Destek", renk: "#E0A100", aciklama: "Desteklenmeli" },
  { id: "tipik",  ad: "Tipik",  renk: "#2D7A2D", aciklama: "Yaşına uygun" }
];
const TESTLER = [
  { kod: "AGTE",   ad: "Ankara Gelişim Tarama Envanteri", yas: "0-6 yaş" },
  { kod: "DENVER", ad: "Denver II Gelişim Testi",         yas: "0-6 yaş" },
  { kod: "GOODEN", ad: "Goodenough-Harris Adam Çizimi",   yas: "3-15 yaş" },
  { kod: "CBCL",   ad: "Çocuk Davranış Listesi (CBCL)",   yas: "1.5-5 yaş" },
  { kod: "SOSYO",  ad: "Sosyometri (Akran tercihi)",      yas: "4-6 yaş" },
  { kod: "DIGER",  ad: "Diğer",                           yas: "" }
];
const alan = (id) => ALANLAR.find(a => a.id === id) || { ad: id, ikon: "📝", renk: "#64748B" };
const seviye = (id) => SEVIYELER.find(s => s.id === id) || SEVIYELER[2];
const test = (kod) => TESTLER.find(t => t.kod === kod) || { ad: kod };

let _sekme = "gozlem";   // gozlem | test | ogrenci
let _seciliOgr = null;
let _gozlemler = [], _testler = [];

function trh(iso) { return iso ? String(iso).substring(0, 10).split("-").reverse().join(".") : "—"; }

async function yukle() {
  const { fb, db } = P();
  _gozlemler = []; _testler = [];
  try {
    const g = await fb.getDocs(fb.collection(db, "pdrGozlemleri"));
    g.forEach(d => _gozlemler.push({ id: d.id, ...d.data() }));
    _gozlemler.sort((a, b) => String(b.tarih || "").localeCompare(String(a.tarih || "")));
  } catch (e) { console.warn("pdr gözlem:", e.code || e.message); }
  try {
    const t = await fb.getDocs(fb.collection(db, "pdrTestleri"));
    t.forEach(d => _testler.push({ id: d.id, ...d.data() }));
    _testler.sort((a, b) => String(b.tarih || "").localeCompare(String(a.tarih || "")));
  } catch (e) { console.warn("pdr test:", e.code || e.message); }
}

function aktifOgrenciler() {
  const { state, ogrenciDurum } = P();
  return state.ogrenciList.filter(o => {
    const a = state.ayarListesi[o.id];
    return a && ogrenciDurum(o, a) === "aktif";
  }).sort((a, b) => (a.ogrenciAdSoyad || "").localeCompare(b.ogrenciAdSoyad || "", "tr"));
}
function ogrSinif(o) { const a = P().state.ayarListesi[o.id]; return (a?.kayit?.sinif) || o.sinif || ""; }

// ───────────────────────────────────────────────────────────────────
// PANEL
// ───────────────────────────────────────────────────────────────────
export async function panelRender(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { esc, lucide } = P();
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p>Yükleniyor...</p></div>`;
  await yukle();
  const ogrenciler = aktifOgrenciler();

  // Özet: takip/destek seviyesindeki çocuk sayısı
  const sonGozlem = {};
  _gozlemler.forEach(g => { if (!sonGozlem[g.ogrenciId]) sonGozlem[g.ogrenciId] = g; });
  const takip = Object.values(sonGozlem).filter(g => g.seviye === "takip").length;
  const destek = Object.values(sonGozlem).filter(g => g.seviye === "destek").length;
  const buAy = P().bugun().substring(0, 7);
  const buAyGozlem = _gozlemler.filter(g => (g.tarih || "").startsWith(buAy)).length;

  el.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:14px;">
      <div style="background:#fff; border-left:4px solid #C0392B; border-radius:12px; padding:12px 15px;">
        <div style="font-size:10.5px; font-weight:800; color:#C0392B; text-transform:uppercase;">Takip</div>
        <div style="font-size:22px; font-weight:800; color:#1E293B;">${takip}</div></div>
      <div style="background:#fff; border-left:4px solid #E0A100; border-radius:12px; padding:12px 15px;">
        <div style="font-size:10.5px; font-weight:800; color:#E0A100; text-transform:uppercase;">Destek</div>
        <div style="font-size:22px; font-weight:800; color:#1E293B;">${destek}</div></div>
      <div style="background:#fff; border-left:4px solid #7B5EA7; border-radius:12px; padding:12px 15px;">
        <div style="font-size:10.5px; font-weight:800; color:#7B5EA7; text-transform:uppercase;">Bu Ay Gözlem</div>
        <div style="font-size:22px; font-weight:800; color:#1E293B;">${buAyGozlem}</div></div>
      <div style="background:#fff; border-left:4px solid #2E5C8A; border-radius:12px; padding:12px 15px;">
        <div style="font-size:10.5px; font-weight:800; color:#2E5C8A; text-transform:uppercase;">Test Kaydı</div>
        <div style="font-size:22px; font-weight:800; color:#1E293B;">${_testler.length}</div></div>
    </div>

    <div style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; align-items:center;">
      ${[["gozlem","Gözlemler"],["test","Test Sonuçları"],["ogrenci","Öğrenci Bazlı"]].map(([k, ad]) =>
        `<button class="btn-mini" onclick="window._pdr.sekme('${k}')" style="${_sekme === k ? "background:#7B5EA7; color:#fff; border-color:#7B5EA7;" : ""} font-weight:700;">${ad}</button>`).join("")}
      <button class="btn-mini" onclick="window._pdr.formAc('gozlem')" style="margin-left:auto; background:#7B5EA7; color:#fff; border:none; font-weight:700;">+ Gözlem</button>
      <button class="btn-mini" onclick="window._pdr.formAc('test')" style="background:#2E5C8A; color:#fff; border:none; font-weight:700;">+ Test Sonucu</button>
    </div>

    <div id="pdrForm" style="display:none;"></div>
    <div id="pdrIcerik"></div>

    <div style="margin-top:14px; padding:11px 14px; background:#F5F3FF; border:1px solid #DDD6FE; border-radius:12px; font-size:11.5px; color:#5B21B6; line-height:1.6;">
      🔒 <strong>KVKK md.6 — özel nitelikli veri.</strong> Bu kayıtlar yalnızca PDR uzmanı ve yönetim tarafından görülür; öğretmenlere kapalıdır.
      "Veliyle paylaş" işaretli kayıtlar veli uygulamasında görünür.
    </div>`;

  icerikRender();
  lucide();
}

function icerikRender() {
  const el = document.getElementById("pdrIcerik");
  if (!el) return;
  const { esc } = P();

  if (_sekme === "gozlem") {
    el.innerHTML = _gozlemler.length === 0
      ? `<div style="background:#fff; border-radius:14px; padding:30px; text-align:center; color:#94A3B8;">Henüz gözlem kaydı yok.</div>`
      : _gozlemler.slice(0, 60).map(g => gozlemKart(g)).join("");
  } else if (_sekme === "test") {
    el.innerHTML = _testler.length === 0
      ? `<div style="background:#fff; border-radius:14px; padding:30px; text-align:center; color:#94A3B8;">Henüz test kaydı yok.</div>`
      : _testler.map(t => testKart(t)).join("");
  } else {
    const ogrenciler = aktifOgrenciler();
    const sonGozlem = {};
    _gozlemler.forEach(g => { if (!sonGozlem[g.ogrenciId]) sonGozlem[g.ogrenciId] = g; });
    el.innerHTML = `<div style="background:#fff; border:1px solid #E9EBF4; border-radius:14px; overflow:hidden;">
      ${ogrenciler.map(o => {
        const s = sonGozlem[o.id];
        const sv = s ? seviye(s.seviye) : null;
        const gSay = _gozlemler.filter(g => g.ogrenciId === o.id).length;
        const tSay = _testler.filter(t => t.ogrenciId === o.id).length;
        return `<div style="display:flex; align-items:center; gap:11px; padding:10px 15px; border-bottom:1px solid #F1F2F7; cursor:pointer;" onclick="window._pdr.ogrenciAc('${o.id}')">
          <div style="width:34px; height:34px; border-radius:10px; background:${sv ? sv.renk + "1a" : "#F1F5F9"}; color:${sv ? sv.renk : "#94A3B8"}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px;">${esc((o.ogrenciAdSoyad || "?").charAt(0))}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13.5px; color:#1E293B;">${esc(o.ogrenciAdSoyad)}</div>
            <div style="font-size:11px; color:#94A3B8;">${esc(ogrSinif(o))} · ${gSay} gözlem · ${tSay} test</div>
          </div>
          ${sv ? `<span style="font-size:10px; font-weight:800; color:${sv.renk}; background:${sv.renk}1a; padding:3px 9px; border-radius:100px;">${sv.ad}</span>` : `<span style="font-size:10px; color:#94A3B8;">gözlem yok</span>`}
        </div>`;
      }).join("")}
    </div>`;
  }
}

function gozlemKart(g) {
  const { esc } = P();
  const a = alan(g.alan), s = seviye(g.seviye);
  return `<div style="background:#fff; border:1px solid #E9EBF4; border-left:4px solid ${s.renk}; border-radius:12px; padding:13px 15px; margin-bottom:9px;">
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
      <strong style="font-size:14px; color:#1E293B;">${esc(g.ogrenciAd)}</strong>
      <span style="font-size:11px; color:#94A3B8;">${esc(g.sinif)}</span>
      <span style="font-size:10px; font-weight:800; color:${s.renk}; background:${s.renk}1a; padding:2px 8px; border-radius:100px;">${s.ad}</span>
      <span style="font-size:10px; font-weight:800; color:${a.renk}; background:${a.renk}1a; padding:2px 8px; border-radius:100px;">${a.ikon} ${a.ad}</span>
      ${g.veliylePaylas ? `<span style="font-size:10px; color:#059669; font-weight:700;">👁 veliyle paylaşıldı</span>` : ""}
      <span style="margin-left:auto; font-size:11px; color:#94A3B8;">${trh(g.tarih)} · ${esc(g.uzmanAd || "")}</span>
    </div>
    ${g.baglam ? `<div style="font-size:11px; color:#64748B; margin-bottom:4px;">Bağlam: ${esc(g.baglam)}</div>` : ""}
    <div style="font-size:13px; color:#334155; line-height:1.55;">${esc(g.not)}</div>
    ${(g.oneriler || []).length ? `<div style="margin-top:8px; font-size:12px; color:#475569;"><strong>Öneriler:</strong> ${g.oneriler.map(esc).join(" · ")}</div>` : ""}
  </div>`;
}

function testKart(t) {
  const { esc } = P();
  const ts = test(t.testKod);
  return `<div style="background:#fff; border:1px solid #E9EBF4; border-left:4px solid #2E5C8A; border-radius:12px; padding:13px 15px; margin-bottom:9px;">
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
      <strong style="font-size:14px; color:#1E293B;">${esc(t.ogrenciAd)}</strong>
      <span style="font-size:10px; font-weight:800; color:#2E5C8A; background:#2E5C8A1a; padding:2px 8px; border-radius:100px;">${esc(t.testKod)}</span>
      ${t.veliylePaylas ? `<span style="font-size:10px; color:#059669; font-weight:700;">👁 veliyle paylaşıldı</span>` : ""}
      <span style="margin-left:auto; font-size:11px; color:#94A3B8;">${trh(t.tarih)} · ${esc(t.uzmanAd || "")}</span>
    </div>
    <div style="font-size:12px; color:#64748B; margin-bottom:4px;">${esc(ts.ad)}${t.metrikAd ? ` · <strong>${esc(t.metrikAd)}: ${esc(t.metrikDeger)}</strong>` : ""}</div>
    ${t.ozet ? `<div style="font-size:13px; color:#334155; line-height:1.55;">${esc(t.ozet)}</div>` : ""}
    ${t.uzmanYorumu ? `<div style="margin-top:8px; padding:9px 12px; background:#F8FAFC; border-radius:9px; font-size:12.5px; color:#475569; font-style:italic;">${esc(t.uzmanYorumu)}</div>` : ""}
    ${t.gorselUrl ? `<a href="${esc(t.gorselUrl)}" target="_blank" style="display:inline-block; margin-top:8px; font-size:12px; color:#2E5C8A; font-weight:700;">📎 Görseli aç</a>` : ""}
  </div>`;
}

// ───────────────────────────────────────────────────────────────────
// FORMLAR
// ───────────────────────────────────────────────────────────────────
function formAc(tur) {
  const f = document.getElementById("pdrForm");
  if (!f) return;
  if (f.style.display !== "none" && f.dataset.tur === tur) { f.style.display = "none"; return; }
  f.style.display = "block"; f.dataset.tur = tur;
  const { esc, bugun } = P();
  const ogrenciler = aktifOgrenciler();
  const ogrSecici = `<select id="pdfOgr" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;">
    <option value="">Öğrenci seçin…</option>
    ${ogrenciler.map(o => `<option value="${o.id}" ${_seciliOgr === o.id ? "selected" : ""}>${esc(o.ogrenciAdSoyad)} · ${esc(ogrSinif(o))}</option>`).join("")}
  </select>`;
  const inp = 'style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"';
  const lbl = 'style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;"';

  if (tur === "gozlem") {
    f.innerHTML = `<div style="background:#fff; border:1px solid #DDD6FE; border-radius:14px; padding:16px 18px; margin-bottom:14px;">
      <div style="font-size:13px; font-weight:800; color:#7B5EA7; margin-bottom:12px;">Yeni Gözlem</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px;">
        <div style="grid-column:1/-1;"><label ${lbl}>Öğrenci *</label>${ogrSecici}</div>
        <div><label ${lbl}>Gelişim Alanı *</label>
          <select id="pdfAlan" ${inp}>${ALANLAR.map(a => `<option value="${a.id}">${a.ikon} ${a.ad}</option>`).join("")}</select></div>
        <div><label ${lbl}>Bağlam</label>
          <select id="pdfBaglam" ${inp}>${BAGLAMLAR.map(b => `<option>${b}</option>`).join("")}</select></div>
        <div style="grid-column:1/-1;"><label ${lbl}>Seviye *</label>
          <div style="display:flex; gap:8px; margin-top:4px;">
            ${SEVIYELER.map(s => `<label style="flex:1; display:flex; align-items:center; gap:7px; padding:9px 11px; background:#fff; border:1.5px solid #E2E8F0; border-radius:10px; cursor:pointer; font-size:12.5px;">
              <input type="radio" name="pdfSeviye" value="${s.id}" ${s.id === "tipik" ? "checked" : ""}>
              <span style="width:10px; height:10px; border-radius:50%; background:${s.renk};"></span>
              <span><strong>${s.ad}</strong><br><span style="font-size:10.5px; color:#94A3B8;">${s.aciklama}</span></span></label>`).join("")}
          </div></div>
        <div style="grid-column:1/-1;"><label ${lbl}>Gözlem Notu *</label>
          <textarea id="pdfNot" rows="4" placeholder="Ne gözlemlediniz? Somut, davranış odaklı yazın." ${inp}></textarea></div>
        <div style="grid-column:1/-1;"><label ${lbl}>Öneriler (virgülle ayırın)</label>
          <input id="pdfOneri" type="text" placeholder="Örn. Küçük grup etkinliği, evde okuma saati" ${inp}></div>
      </div>
      <label style="display:flex; align-items:center; gap:8px; margin-top:12px; font-size:12.5px; cursor:pointer;">
        <input type="checkbox" id="pdfPaylas"> Veliyle paylaş (veli uygulamasında görünür)</label>
      <div style="display:flex; gap:8px; margin-top:12px; justify-content:flex-end;">
        <button class="btn-mini" onclick="window._pdr.formAc('gozlem')">İptal</button>
        <button class="btn-mini" onclick="window._pdr.gozlemKaydet()" style="background:#7B5EA7; color:#fff; border:none; font-weight:700; padding:9px 18px;">Kaydet</button>
      </div></div>`;
  } else {
    f.innerHTML = `<div style="background:#fff; border:1px solid #BFDBFE; border-radius:14px; padding:16px 18px; margin-bottom:14px;">
      <div style="font-size:13px; font-weight:800; color:#2E5C8A; margin-bottom:12px;">Test Sonucu Kaydı</div>
      <div style="font-size:11.5px; color:#64748B; margin-bottom:10px;">Lisanslı araçlar — sistem yalnızca <strong>sonucu</strong> arşivler, testi uygulamaz.</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px;">
        <div style="grid-column:1/-1;"><label ${lbl}>Öğrenci *</label>${ogrSecici}</div>
        <div><label ${lbl}>Test *</label>
          <select id="pdfTest" ${inp}>${TESTLER.map(t => `<option value="${t.kod}">${t.ad}${t.yas ? " (" + t.yas + ")" : ""}</option>`).join("")}</select></div>
        <div><label ${lbl}>Uygulama Tarihi</label><input id="pdfTarih" type="date" value="${bugun()}" ${inp}></div>
        <div><label ${lbl}>Ölçüt Adı</label><input id="pdfMetrikAd" type="text" placeholder="Örn. Gelişim Yaşı" ${inp}></div>
        <div><label ${lbl}>Ölçüt Değeri</label><input id="pdfMetrikDeger" type="text" placeholder="Örn. 48 ay" ${inp}></div>
        <div style="grid-column:1/-1;"><label ${lbl}>Sonuç Özeti</label>
          <textarea id="pdfOzet" rows="3" placeholder="Test sonucunun kısa özeti" ${inp}></textarea></div>
        <div style="grid-column:1/-1;"><label ${lbl}>Uzman Yorumu</label>
          <textarea id="pdfYorum" rows="3" placeholder="Değerlendirme ve öneriler" ${inp}></textarea></div>
      </div>
      <label style="display:flex; align-items:center; gap:8px; margin-top:12px; font-size:12.5px; cursor:pointer;">
        <input type="checkbox" id="pdfPaylas"> Veliyle paylaş</label>
      <div style="display:flex; gap:8px; margin-top:12px; justify-content:flex-end;">
        <button class="btn-mini" onclick="window._pdr.formAc('test')">İptal</button>
        <button class="btn-mini" onclick="window._pdr.testKaydet()" style="background:#2E5C8A; color:#fff; border:none; font-weight:700; padding:9px 18px;">Kaydet</button>
      </div></div>`;
  }
  f.scrollIntoView({ behavior: "smooth", block: "start" });
}

function uzman() {
  const { state } = P();
  return {
    uzmanEmail: (state.currentUser?.email || "").toLowerCase(),
    uzmanAd: state.personel?.adSoyad || state.currentUser?.displayName || "PDR Uzmanı"
  };
}
function seciliOgrenci() {
  const id = document.getElementById("pdfOgr")?.value;
  const o = aktifOgrenciler().find(x => x.id === id);
  return o ? { ogrenciId: o.id, ogrenciAd: o.ogrenciAdSoyad || "", sinif: ogrSinif(o) } : null;
}

async function gozlemKaydet() {
  const { fb, db, toast, bugun } = P();
  const o = seciliOgrenci();
  const not = (document.getElementById("pdfNot")?.value || "").trim();
  if (!o) { toast("Öğrenci seçin", "error"); return; }
  if (!not) { toast("Gözlem notu gerekli", "error"); return; }
  try {
    await fb.addDoc(fb.collection(db, "pdrGozlemleri"), {
      ...o,
      alan: document.getElementById("pdfAlan")?.value || "sosyal",
      baglam: document.getElementById("pdfBaglam")?.value || "",
      seviye: document.querySelector('input[name="pdfSeviye"]:checked')?.value || "tipik",
      not,
      oneriler: (document.getElementById("pdfOneri")?.value || "").split(",").map(s => s.trim()).filter(Boolean),
      veliylePaylas: !!document.getElementById("pdfPaylas")?.checked,
      ...uzman(),
      tarih: bugun(),
      olusturuldu: fb.serverTimestamp()
    });
    toast("✓ Gözlem kaydedildi");
    _sekme = "gozlem";
    panelRender("pdrIcerikKap");
  } catch (e) { toast("Kaydedilemedi: " + e.message, "error"); }
}

async function testKaydet() {
  const { fb, db, toast, bugun } = P();
  const o = seciliOgrenci();
  const kod = document.getElementById("pdfTest")?.value;
  if (!o) { toast("Öğrenci seçin", "error"); return; }
  try {
    await fb.addDoc(fb.collection(db, "pdrTestleri"), {
      ogrenciId: o.ogrenciId, ogrenciAd: o.ogrenciAd,
      testKod: kod, testAd: test(kod).ad,
      tarih: document.getElementById("pdfTarih")?.value || bugun(),
      metrikAd: (document.getElementById("pdfMetrikAd")?.value || "").trim(),
      metrikDeger: (document.getElementById("pdfMetrikDeger")?.value || "").trim(),
      ozet: (document.getElementById("pdfOzet")?.value || "").trim(),
      uzmanYorumu: (document.getElementById("pdfYorum")?.value || "").trim(),
      puanlar: {},
      veliylePaylas: !!document.getElementById("pdfPaylas")?.checked,
      ...uzman(),
      olusturuldu: fb.serverTimestamp()
    });
    toast("✓ Test sonucu kaydedildi");
    _sekme = "test";
    panelRender("pdrIcerikKap");
  } catch (e) { toast("Kaydedilemedi: " + e.message, "error"); }
}

function ogrenciAc(id) {
  _seciliOgr = id;
  const { esc } = P();
  const o = aktifOgrenciler().find(x => x.id === id);
  if (!o) return;
  const g = _gozlemler.filter(x => x.ogrenciId === id);
  const t = _testler.filter(x => x.ogrenciId === id);
  const el = document.getElementById("pdrIcerik");
  el.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
      <button class="btn-mini" onclick="window._pdr.sekme('ogrenci')">‹ Listeye dön</button>
      <strong style="font-size:15px; color:#1E293B;">${esc(o.ogrenciAdSoyad)}</strong>
      <span style="font-size:12px; color:#94A3B8;">${esc(ogrSinif(o))}</span>
      <button class="btn-mini" onclick="window._pdr.formAc('gozlem')" style="margin-left:auto; background:#7B5EA7; color:#fff; border:none; font-size:11px;">+ Gözlem</button>
      <button class="btn-mini" onclick="window._pdr.formAc('test')" style="background:#2E5C8A; color:#fff; border:none; font-size:11px;">+ Test</button>
    </div>
    ${g.length ? `<div style="font-size:11px; font-weight:800; color:#7B5EA7; text-transform:uppercase; margin-bottom:6px;">Gözlemler (${g.length})</div>` + g.map(gozlemKart).join("") : ""}
    ${t.length ? `<div style="font-size:11px; font-weight:800; color:#2E5C8A; text-transform:uppercase; margin:12px 0 6px;">Testler (${t.length})</div>` + t.map(testKart).join("") : ""}
    ${!g.length && !t.length ? `<div style="background:#fff; border-radius:14px; padding:24px; text-align:center; color:#94A3B8;">Bu öğrenci için kayıt yok.</div>` : ""}`;
}

window._pdr = {
  sekme: (k) => { _sekme = k; _seciliOgr = null; icerikRender(); document.querySelectorAll("#pdrIcerikKap .btn-mini").forEach(b => { /* görsel güncelleme panelRender ile */ }); panelRender("pdrIcerikKap"); },
  formAc, gozlemKaydet, testKaydet, ogrenciAc
};
