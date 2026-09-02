// ═══════════════════════════════════════════════════════════════════
// PROGRAM BELGELEME — moduller/program-belgeleme.js
// ZEKY ile ORTAK üç koleksiyon:
//   ormanOturumlari/{sinif}__{ayKod}__H{hafta}   → orman günü kaydı (sınıf bazlı)
//   degerlerGozlem/{YYYY-MM}.kayitlar[ogrenciId]  → ayın değeri gözlemi (çocuk bazlı)
//   ogrenciBelgeleri/{otoId}                      → kimlik, aşı kartı, sağlık raporu
//
// Amaç: BFLM® (orman) ve BVLM® (değerler) programlarının MACTE/MEB için
// kanıt üretmesi; öğrenci evrak dosyasının dijital takibi.
//
// Kullanım:
//   m.panelRender("hedefId")  → sekmeli tam panel (öğretmen + yönetim)
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

let _sekme = "orman";
let _sinif = "", _ayKod = "", _hafta = 1;

const AY_AD = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const HAVA = [
  { k: "gunesli", ad: "Güneşli", ikon: "☀️" }, { k: "bulutlu", ad: "Bulutlu", ikon: "☁️" },
  { k: "yagmurlu", ad: "Yağmurlu", ikon: "🌧️" }, { k: "ruzgarli", ad: "Rüzgârlı", ikon: "💨" },
  { k: "soguk", ad: "Soğuk", ikon: "❄️" }, { k: "sicak", ad: "Sıcak", ikon: "🌡️" }
];
const KATILIM = ["Tam grup", "Küçük gruplar", "Serbest keşif", "Rehberli yürüyüş", "Sabit alan"];
const BELGE_TURLERI = [
  { k: "kimlik", ad: "Kimlik fotokopisi", zorunlu: true },
  { k: "asi", ad: "Aşı kartı", zorunlu: true },
  { k: "saglik", ad: "Sağlık raporu", zorunlu: true },
  { k: "ikamet", ad: "İkametgah", zorunlu: false },
  { k: "foto", ad: "Vesikalık fotoğraf", zorunlu: true },
  { k: "veli_kimlik", ad: "Veli kimlik fotokopisi", zorunlu: false },
  { k: "sozlesme", ad: "İmzalı sözleşme", zorunlu: true },
  { k: "kvkk", ad: "KVKK onay formu", zorunlu: true },
  { k: "diger", ad: "Diğer", zorunlu: false }
];

function trh(iso) { return iso ? String(iso).substring(0, 10).split("-").reverse().join(".") : "—"; }
function ormanId(s, a, h) { return `${s}__${a}__H${h}`.replace(/[^\wçğıöşüÇĞİÖŞÜ .\-_]/g, "_"); }

function siniflarim() {
  const { state } = P();
  const yonetimMi = state.isAdmin || ["kurucu_mudur", "mudur", "egitim_koordinator"].includes(state.rol);
  if (!yonetimMi) return state.siniflar || [];
  // Yönetim: aktif öğrencilerin sınıflarından türet
  const set = new Set();
  state.ogrenciList.forEach(o => {
    const a = state.ayarListesi[o.id];
    if (a && P().ogrenciDurum(o, a) === "aktif") set.add((a.kayit?.sinif) || o.sinif || "");
  });
  return [...set].filter(Boolean).sort();
}
function sinifOgrencileri(sinif) {
  const { state, ogrenciDurum } = P();
  return state.ogrenciList.filter(o => {
    const a = state.ayarListesi[o.id];
    if (!a || ogrenciDurum(o, a) !== "aktif") return false;
    return ((a.kayit?.sinif) || o.sinif || "") === sinif;
  }).sort((a, b) => (a.ogrenciAdSoyad || "").localeCompare(b.ogrenciAdSoyad || "", "tr"));
}

// ───────────────────────────────────────────────────────────────────
// PANEL İSKELETİ
// ───────────────────────────────────────────────────────────────────
export async function panelRender(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { esc } = P();
  const sn = siniflarim();
  if (!sn.length) {
    el.innerHTML = `<div style="background:#FFFBEB; border:1px solid #FCD34D; border-radius:14px; padding:22px; text-align:center; color:#92400E;">Sınıf ataması gerekiyor.</div>`;
    return;
  }
  if (!_sinif || !sn.includes(_sinif)) _sinif = sn[0];
  if (!_ayKod) _ayKod = P().bugun().substring(0, 7);

  el.innerHTML = `
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:14px;">
      ${[["orman","🌳 Orman Oturumu"],["degerler","💎 Değerler Gözlemi"],["belgeler","📁 Öğrenci Belgeleri"]].map(([k, ad]) =>
        `<button class="btn-mini" onclick="window._pb.sekme('${k}')" style="${_sekme === k ? "background:#2D5E3E; color:#fff; border-color:#2D5E3E;" : ""} font-weight:700;">${ad}</button>`).join("")}
      <select onchange="window._pb.sinif(this.value)" style="margin-left:auto; padding:8px 12px; border:1px solid #E2E8F0; border-radius:10px; font-family:inherit; font-size:13px; font-weight:600;">
        ${sn.map(s => `<option ${s === _sinif ? "selected" : ""}>${esc(s)}</option>`).join("")}
      </select>
    </div>
    <div id="pbIcerik"></div>`;

  if (_sekme === "orman") await ormanRender();
  else if (_sekme === "degerler") await degerlerRender();
  else await belgelerRender();
  P().lucide();
}

// ───────────────────────────────────────────────────────────────────
// 1) ORMAN OTURUMU — sınıf bazlı haftalık kayıt
// ───────────────────────────────────────────────────────────────────
async function ormanRender() {
  const el = document.getElementById("pbIcerik");
  const { fb, db, esc } = P();
  let v = {};
  try {
    const s = await fb.getDoc(fb.doc(db, "ormanOturumlari", ormanId(_sinif, _ayKod, _hafta)));
    if (s.exists()) v = s.data();
  } catch (e) { console.warn("orman:", e.code); }

  const [yil, ay] = _ayKod.split("-").map(Number);
  const katilan = new Set(v.katilanlar || []);
  const ogrenciler = sinifOgrencileri(_sinif);
  const inp = 'style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"';
  const lbl = 'style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;"';

  el.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
      <button class="btn-mini" onclick="window._pb.ay(-1)">‹</button>
      <strong style="font-size:14px; color:#2D5E3E;">${AY_AD[ay - 1]} ${yil}</strong>
      <button class="btn-mini" onclick="window._pb.ay(1)">›</button>
      <div style="display:flex; gap:5px; margin-left:8px;">
        ${[1,2,3,4].map(h => `<button class="btn-mini" onclick="window._pb.hafta(${h})" style="${h === _hafta ? "background:#E67E22; color:#fff; border-color:#E67E22;" : ""} padding:6px 11px;">H${h}</button>`).join("")}
      </div>
      ${v.guncellendi ? `<span style="margin-left:auto; font-size:11px; color:#059669; font-weight:700;">✓ kayıtlı</span>` : `<span style="margin-left:auto; font-size:11px; color:#94A3B8;">henüz kayıt yok</span>`}
    </div>

    <div style="background:#fff; border:1px solid #E9EBF4; border-radius:14px; padding:16px 18px;">
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px;">
        <div><label ${lbl}>Oturum Tarihi</label><input id="orTarih" type="date" value="${esc(v.tarih || "")}" ${inp}></div>
        <div><label ${lbl}>Hava</label>
          <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:4px;">
            ${HAVA.map(h => `<label style="display:flex; align-items:center; gap:4px; padding:6px 10px; border:1.5px solid #E2E8F0; border-radius:9px; cursor:pointer; font-size:12px;"><input type="radio" name="orHava" value="${h.k}" ${v.hava === h.k ? "checked" : ""}> ${h.ikon} ${h.ad}</label>`).join("")}
          </div></div>
        <div><label ${lbl}>Katılım Biçimi</label>
          <select id="orKatilim" ${inp}>${KATILIM.map(k => `<option ${v.katilimBicimi === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
        <div><label ${lbl}>Süre (dk)</label><input id="orSure" type="number" value="${v.sure || 90}" min="15" step="15" ${inp}></div>
      </div>

      <div style="margin-top:12px;"><label ${lbl}>Saha Kontrolü (oturum öncesi)</label>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:5px;">
          ${["Alan yürüyüşü yapıldı","Tehlikeli nesne yok","İlk yardım çantası hazır","Su ve atıştırmalık hazır","Veli bilgilendirildi"].map((k, i) =>
            `<label style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer;"><input type="checkbox" class="orSaha" value="${k}" ${(v.sahaKontrol || []).includes(k) ? "checked" : ""}> ${k}</label>`).join("")}
        </div></div>

      <div style="margin-top:12px;"><label ${lbl}>Etkinlik / Gözlem</label>
        <textarea id="orEtkinlik" rows="3" placeholder="Ne yapıldı? Çocuklar neyle ilgilendi? Doğal malzemeler, keşifler…" ${inp}>${esc(v.etkinlik || "")}</textarea></div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
        <div><label ${lbl}>Risk / Olay</label><input id="orRisk" type="text" placeholder="Yoksa boş bırakın" value="${esc(v.risk || "")}" ${inp}></div>
        <div><label ${lbl}>Uyarlama</label><input id="orUyarlama" type="text" placeholder="Hava/çocuk durumuna göre değişiklik" value="${esc(v.uyarlama || "")}" ${inp}></div>
      </div>

      <div style="margin-top:14px;"><label ${lbl}>Katılan Çocuklar (${katilan.size}/${ogrenciler.length})</label>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
          ${ogrenciler.map(o => `<label style="display:flex; align-items:center; gap:5px; padding:6px 10px; border:1.5px solid ${katilan.has(o.id) ? "#4A7C59" : "#E2E8F0"}; background:${katilan.has(o.id) ? "#ECFDF5" : "#fff"}; border-radius:9px; cursor:pointer; font-size:12px;">
            <input type="checkbox" class="orKatilan" value="${o.id}" ${katilan.has(o.id) ? "checked" : ""} style="display:none;"> ${esc((o.ogrenciAdSoyad || "").split(" ")[0])}</label>`).join("")}
        </div>
        <button class="btn-mini" onclick="document.querySelectorAll('.orKatilan').forEach(c => { c.checked = true; c.parentElement.style.borderColor='#4A7C59'; c.parentElement.style.background='#ECFDF5'; })" style="margin-top:6px; font-size:11px;">Tümünü seç</button>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:14px;">
        <button class="btn-mini" onclick="window._pb.ormanKaydet()" style="background:#E67E22; color:#fff; border:none; font-weight:700; padding:10px 20px;">Oturumu Kaydet</button>
      </div>
    </div>`;

  // Katılan tıklamasında renk değişimi
  el.querySelectorAll(".orKatilan").forEach(c => c.addEventListener("change", () => {
    c.parentElement.style.borderColor = c.checked ? "#4A7C59" : "#E2E8F0";
    c.parentElement.style.background = c.checked ? "#ECFDF5" : "#fff";
  }));
}

async function ormanKaydet() {
  const { fb, db, state, toast } = P();
  const g = (id) => (document.getElementById(id)?.value || "").trim();
  try {
    await fb.setDoc(fb.doc(db, "ormanOturumlari", ormanId(_sinif, _ayKod, _hafta)), {
      sinif: _sinif, ayKod: _ayKod, hafta: _hafta,
      tarih: g("orTarih"),
      hava: document.querySelector('input[name="orHava"]:checked')?.value || "",
      katilimBicimi: g("orKatilim"),
      sure: parseInt(g("orSure")) || 0,
      sahaKontrol: [...document.querySelectorAll(".orSaha:checked")].map(c => c.value),
      etkinlik: g("orEtkinlik"),
      risk: g("orRisk"),
      uyarlama: g("orUyarlama"),
      katilanlar: [...document.querySelectorAll(".orKatilan:checked")].map(c => c.value),
      guncelleyen: (state.currentUser?.email || "").toLowerCase(),
      guncelleyenAd: state.personel?.adSoyad || "",
      guncellendi: fb.serverTimestamp()
    }, { merge: true });
    toast("✓ Orman oturumu kaydedildi");
    ormanRender();
  } catch (e) { toast("Kaydedilemedi: " + e.message, "error"); }
}

// ───────────────────────────────────────────────────────────────────
// 2) DEĞERLER GÖZLEMİ — ayın değeri, çocuk bazlı işaret
// ───────────────────────────────────────────────────────────────────
async function degerlerRender() {
  const el = document.getElementById("pbIcerik");
  const { fb, db, esc } = P();
  const [yil, ay] = _ayKod.split("-").map(Number);

  // Ayın değeri (ayarlar/degerlerProgram)
  let deger = null;
  try {
    const s = await fb.getDoc(fb.doc(db, "ayarlar", "degerlerProgram"));
    if (s.exists()) deger = (s.data().degerler || []).find(d => Number(d.ay) === ay) || null;
  } catch (e) {}

  // Bu ayın gözlemleri
  let kayitlar = {};
  try {
    const s = await fb.getDoc(fb.doc(db, "degerlerGozlem", _ayKod));
    if (s.exists()) kayitlar = s.data().kayitlar || {};
  } catch (e) {}

  const ogrenciler = sinifOgrencileri(_sinif);
  const DURUM = [
    { k: "gozlendi", ad: "Gözlendi", ikon: "✓", renk: "#059669" },
    { k: "gelisiyor", ad: "Gelişiyor", ikon: "↗", renk: "#B45309" },
    { k: "destek", ad: "Destek", ikon: "!", renk: "#DC2626" }
  ];
  const isaretli = ogrenciler.filter(o => kayitlar[o.id]).length;

  el.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px;">
      <button class="btn-mini" onclick="window._pb.ay(-1)">‹</button>
      <strong style="font-size:14px; color:#2D5E3E;">${AY_AD[ay - 1]} ${yil}</strong>
      <button class="btn-mini" onclick="window._pb.ay(1)">›</button>
      <span style="margin-left:auto; font-size:12px; color:#64748B;"><strong style="color:#C44569;">${isaretli}</strong>/${ogrenciler.length} işaretlendi</span>
    </div>

    ${deger ? `
      <div style="background:linear-gradient(135deg,${deger.renk || "#C44569"},${deger.renk || "#C44569"}bb); color:#fff; border-radius:14px; padding:16px 18px; margin-bottom:14px;">
        <div style="font-size:11px; font-weight:800; letter-spacing:1.2px; opacity:.85;">AYIN DEĞERİ</div>
        <div style="font-size:22px; font-weight:800; margin-top:4px;">${esc(deger.ikon || "💎")} ${esc(deger.ad)}</div>
        ${deger.slogan ? `<div style="font-size:13px; opacity:.92; margin-top:4px;">"${esc(deger.slogan)}"</div>` : ""}
      </div>`
    : `<div style="background:#FFFBEB; border:1px solid #FCD34D; border-radius:12px; padding:12px 14px; margin-bottom:14px; font-size:12.5px; color:#92400E;">
        Bu ay için değer tanımlanmamış. Yönetim → Eğitim → Değerler programından ayın değeri atanmalı.</div>`}

    <div style="background:#fff; border:1px solid #E9EBF4; border-radius:14px; overflow:hidden;">
      ${ogrenciler.map(o => {
        const k = kayitlar[o.id];
        const d = k ? DURUM.find(x => x.k === k.durum) : null;
        return `<div style="display:flex; align-items:center; gap:10px; padding:10px 15px; border-bottom:1px solid #F1F2F7;">
          <div style="width:32px; height:32px; border-radius:9px; background:${d ? d.renk + "1a" : "#F1F5F9"}; color:${d ? d.renk : "#94A3B8"}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px;">${esc((o.ogrenciAdSoyad || "?").charAt(0))}</div>
          <div style="flex:1; font-size:13.5px; font-weight:700; color:#1E293B;">${esc(o.ogrenciAdSoyad)}</div>
          <div style="display:flex; gap:4px;">
            ${DURUM.map(x => `<button class="btn-mini" onclick="window._pb.degerIsaretle('${o.id}','${k?.durum === x.k ? "" : x.k}')" title="${x.ad}"
              style="padding:5px 10px; font-size:12px; font-weight:800; ${k?.durum === x.k ? `background:${x.renk}; color:#fff; border-color:${x.renk};` : `color:${x.renk};`}">${x.ikon}</button>`).join("")}
          </div>
        </div>`;
      }).join("")}
    </div>
    <div style="font-size:11px; color:#94A3B8; margin-top:8px;">✓ Gözlendi · ↗ Gelişiyor · ! Destek gerekiyor — tekrar tıklayınca kaldırır.</div>`;
}

async function degerIsaretle(ogrenciId, durum) {
  const { fb, db, state, toast } = P();
  const [yil, ay] = _ayKod.split("-").map(Number);
  try {
    const veri = { ay, yil, guncellendi: new Date().toISOString() };
    veri.kayitlar = { [ogrenciId]: durum
      ? { durum, isaretleyen: (state.currentUser?.email || "").toLowerCase(), tarih: new Date().toISOString() }
      : fb.deleteField() };
    await fb.setDoc(fb.doc(db, "degerlerGozlem", _ayKod), veri, { merge: true });
    degerlerRender();
  } catch (e) { toast("Kaydedilemedi: " + e.message, "error"); }
}

// ───────────────────────────────────────────────────────────────────
// 3) ÖĞRENCİ BELGELERİ — evrak takip matrisi
// ───────────────────────────────────────────────────────────────────
async function belgelerRender() {
  const el = document.getElementById("pbIcerik");
  const { fb, db, esc } = P();
  const ogrenciler = sinifOgrencileri(_sinif);

  // Tüm belgeler (bu sınıf)
  const belgeler = {};
  try {
    const s = await fb.getDocs(fb.collection(db, "ogrenciBelgeleri"));
    s.forEach(d => {
      const v = d.data();
      if (!v.ogrenciId) return;
      (belgeler[v.ogrenciId] = belgeler[v.ogrenciId] || {})[v.tur] = { id: d.id, ...v };
    });
  } catch (e) { console.warn("belgeler:", e.code); }

  const zorunlu = BELGE_TURLERI.filter(b => b.zorunlu);
  const eksikli = ogrenciler.filter(o => zorunlu.some(b => !belgeler[o.id]?.[b.k]?.teslim));

  el.innerHTML = `
    <div style="display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
      <div style="background:#fff; border-left:4px solid #DC2626; border-radius:12px; padding:10px 14px; flex:1; min-width:140px;">
        <div style="font-size:10.5px; font-weight:800; color:#DC2626; text-transform:uppercase;">Eksik Evrakı Olan</div>
        <div style="font-size:20px; font-weight:800; color:#1E293B;">${eksikli.length}<span style="font-size:12px; color:#94A3B8;">/${ogrenciler.length}</span></div></div>
      <div style="background:#fff; border-left:4px solid #059669; border-radius:12px; padding:10px 14px; flex:1; min-width:140px;">
        <div style="font-size:10.5px; font-weight:800; color:#059669; text-transform:uppercase;">Dosyası Tam</div>
        <div style="font-size:20px; font-weight:800; color:#1E293B;">${ogrenciler.length - eksikli.length}</div></div>
    </div>

    <div style="background:#fff; border:1px solid #E9EBF4; border-radius:14px; overflow:auto;">
      <table style="border-collapse:collapse; font-size:12px; min-width:100%;">
        <thead><tr style="background:#F8FAFC;">
          <th style="padding:9px 12px; text-align:left; position:sticky; left:0; background:#F8FAFC; font-size:10.5px; text-transform:uppercase; color:#64748B;">Öğrenci</th>
          ${BELGE_TURLERI.map(b => `<th style="padding:9px 6px; font-size:9.5px; text-transform:uppercase; color:${b.zorunlu ? "#DC2626" : "#94A3B8"}; text-align:center; white-space:nowrap;" title="${b.ad}">${b.ad.split(" ")[0]}${b.zorunlu ? " *" : ""}</th>`).join("")}
        </tr></thead>
        <tbody>
          ${ogrenciler.map(o => `<tr style="border-top:1px solid #F1F2F7;">
            <td style="padding:8px 12px; font-weight:700; color:#1E293B; position:sticky; left:0; background:#fff; white-space:nowrap;">${esc(o.ogrenciAdSoyad)}</td>
            ${BELGE_TURLERI.map(b => {
              const d = belgeler[o.id]?.[b.k];
              const var_ = !!d?.teslim;
              return `<td style="padding:6px; text-align:center;">
                <button onclick="window._pb.belgeToggle('${o.id}','${b.k}',${var_ ? "false" : "true"})"
                  style="width:30px; height:30px; border-radius:8px; border:1.5px solid ${var_ ? "#059669" : (b.zorunlu ? "#FCA5A5" : "#E2E8F0")}; background:${var_ ? "#ECFDF5" : "#fff"}; color:${var_ ? "#059669" : "#CBD5E1"}; font-weight:800; cursor:pointer;"
                  title="${b.ad}${d?.teslimTarihi ? " · " + trh(d.teslimTarihi) : ""}">${var_ ? "✓" : "·"}</button>
              </td>`;
            }).join("")}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div style="font-size:11px; color:#94A3B8; margin-top:8px;">* zorunlu belgeler. Kutuya tıklayınca teslim alındı / alınmadı olarak değişir.</div>`;
}

async function belgeToggle(ogrenciId, tur, teslim) {
  const { fb, db, state, toast } = P();
  const o = state.ogrenciList.find(x => x.id === ogrenciId);
  const id = `${ogrenciId}__${tur}`;
  try {
    await fb.setDoc(fb.doc(db, "ogrenciBelgeleri", id), {
      ogrenciId, ogrenciAd: o?.ogrenciAdSoyad || "",
      tur, turAd: (BELGE_TURLERI.find(b => b.k === tur) || {}).ad || tur,
      teslim,
      teslimTarihi: teslim ? new Date().toISOString().slice(0, 10) : null,
      teslimAlan: teslim ? (state.currentUser?.email || "").toLowerCase() : null,
      guncellendi: fb.serverTimestamp()
    }, { merge: true });
    belgelerRender();
  } catch (e) { toast("Kaydedilemedi: " + e.message, "error"); }
}

// ───────────────────────────────────────────────────────────────────
window._pb = {
  sekme: (k) => { _sekme = k; panelRender("programBelgelemeIcerik"); },
  sinif: (s) => { _sinif = s; panelRender("programBelgelemeIcerik"); },
  ay: (yon) => {
    const [y, a] = _ayKod.split("-").map(Number);
    const d = new Date(y, a - 1 + yon, 1);
    _ayKod = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    _hafta = 1;
    panelRender("programBelgelemeIcerik");
  },
  hafta: (h) => { _hafta = h; ormanRender(); },
  ormanKaydet, degerIsaretle, belgeToggle
};
