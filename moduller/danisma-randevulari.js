// ═══════════════════════════════════════════════════════════════════
// DANIŞMA RANDEVULARI — moduller/danisma-randevulari.js
// ZEKY ile ORTAK: danismaRandevulari/{otoId}
//
// Aday veli okul gezisi / tanışma randevusu. Kayıt hunisinin İLK adımı:
//   randevu → geldi → kayıt oldu   (veya gelmedi / iptal)
// "kaynak" alanı reklam yatırımının dönüşünü ölçer (Instagram, Google, tavsiye…).
//
// Kullanım:
//   m.panelRender("hedefId")  → tam sayfa liste + form (yönetim/danışma)
//   m.ozetKart("hedefId")     → Özet sayfası: bugünün randevuları
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

export const KAYNAKLAR = ["Kapıdan geldi", "Telefon", "Instagram", "Google", "Tavsiye", "Tabela", "Diğer"];
const DURUM = {
  bekliyor:  { ad: "Bekliyor",   r: "#B45309", bg: "#FFFBEB", ikon: "⏳" },
  onaylandi: { ad: "Onaylandı",  r: "#1D4ED8", bg: "#EFF6FF", ikon: "📅" },
  geldi:     { ad: "Geldi",      r: "#059669", bg: "#ECFDF5", ikon: "✅" },
  gelmedi:   { ad: "Gelmedi",    r: "#DC2626", bg: "#FEF2F2", ikon: "❌" },
  kayit_oldu:{ ad: "Kayıt oldu", r: "#7C3AED", bg: "#F5F3FF", ikon: "🎉" },
  iptal:     { ad: "İptal",      r: "#64748B", bg: "#F8FAFC", ikon: "—" }
};

let _filtre = "aktif";  // aktif | hepsi | kayit_oldu
let _liste = [];

function trh(iso) { return iso ? String(iso).substring(0, 10).split("-").reverse().join(".") : "—"; }
function gunAd(iso) { const d = new Date(iso); return isNaN(d) ? "" : ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"][d.getDay()]; }
function yasHesapla(dogum) {
  if (!dogum) return "";
  const d = new Date(dogum); if (isNaN(d)) return "";
  const ay = (Date.now() - d.getTime()) / (30.44 * 86400000);
  return ay < 24 ? Math.round(ay) + " ay" : Math.floor(ay / 12) + " yaş";
}

async function yukle() {
  const { fb, db } = P();
  _liste = [];
  try {
    const snap = await fb.getDocs(fb.collection(db, "danismaRandevulari"));
    snap.forEach(d => _liste.push({ id: d.id, ...d.data() }));
    _liste.sort((a, b) => String(b.tarih + b.saat).localeCompare(String(a.tarih + a.saat)));
  } catch (e) { console.warn("danışma randevuları:", e.code || e.message); }
  return _liste;
}

// ───────────────────────────────────────────────────────────────────
// TAM PANEL
// ───────────────────────────────────────────────────────────────────
export async function panelRender(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { esc, bugun, lucide } = P();
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p>Yükleniyor...</p></div>`;
  await yukle();
  const b = bugun();

  // İstatistik (bu ay)
  const buAy = b.substring(0, 7);
  const buAyListe = _liste.filter(r => (r.tarih || "").startsWith(buAy));
  const geldi = buAyListe.filter(r => ["geldi", "kayit_oldu"].includes(r.durum)).length;
  const kayit = buAyListe.filter(r => r.durum === "kayit_oldu").length;
  const donusum = geldi ? Math.round((kayit / geldi) * 100) : 0;

  // Kaynak dağılımı (bu ay)
  const kaynakSay = {};
  buAyListe.forEach(r => { const k = r.kaynak || "Belirtilmedi"; kaynakSay[k] = (kaynakSay[k] || 0) + 1; });
  const kaynakSirali = Object.entries(kaynakSay).sort((a, b2) => b2[1] - a[1]);

  // Filtre
  let gosterilen = _liste;
  if (_filtre === "aktif") gosterilen = _liste.filter(r => ["bekliyor", "onaylandi"].includes(r.durum) && r.tarih >= b);
  else if (_filtre === "kayit_oldu") gosterilen = _liste.filter(r => r.durum === "kayit_oldu");
  else if (_filtre === "gecmis") gosterilen = _liste.filter(r => r.tarih < b || ["geldi", "gelmedi", "iptal", "kayit_oldu"].includes(r.durum));

  const bugunku = _liste.filter(r => r.tarih === b && ["bekliyor", "onaylandi"].includes(r.durum));

  el.innerHTML = `
    <!-- Üst kartlar -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:14px;">
      <div style="background:#fff; border-left:4px solid #0E7490; border-radius:12px; padding:12px 15px;">
        <div style="font-size:10.5px; font-weight:800; color:#0E7490; text-transform:uppercase;">Bugün</div>
        <div style="font-size:22px; font-weight:800; color:#1E293B;">${bugunku.length}</div></div>
      <div style="background:#fff; border-left:4px solid #B45309; border-radius:12px; padding:12px 15px;">
        <div style="font-size:10.5px; font-weight:800; color:#B45309; text-transform:uppercase;">Bu Ay Randevu</div>
        <div style="font-size:22px; font-weight:800; color:#1E293B;">${buAyListe.length}</div></div>
      <div style="background:#fff; border-left:4px solid #059669; border-radius:12px; padding:12px 15px;">
        <div style="font-size:10.5px; font-weight:800; color:#059669; text-transform:uppercase;">Geldi</div>
        <div style="font-size:22px; font-weight:800; color:#1E293B;">${geldi}</div></div>
      <div style="background:#fff; border-left:4px solid #7C3AED; border-radius:12px; padding:12px 15px;">
        <div style="font-size:10.5px; font-weight:800; color:#7C3AED; text-transform:uppercase;">Kayıt → Dönüşüm</div>
        <div style="font-size:22px; font-weight:800; color:#1E293B;">${kayit} <span style="font-size:13px; color:#7C3AED;">%${donusum}</span></div></div>
    </div>

    ${kaynakSirali.length ? `
    <div style="background:#fff; border:1px solid #E9EBF4; border-radius:12px; padding:12px 15px; margin-bottom:14px;">
      <div style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase; margin-bottom:8px;">Bu ay bizi nereden duydular</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${kaynakSirali.map(([k, n]) => `<span style="font-size:12px; padding:5px 11px; background:#F1F5F9; border-radius:100px; color:#334155;"><strong>${n}</strong> ${esc(k)}</span>`).join("")}
      </div>
    </div>` : ""}

    <!-- Araç çubuğu -->
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">
      ${[["aktif","Yaklaşan"],["gecmis","Geçmiş"],["kayit_oldu","Kayıt olanlar"],["hepsi","Tümü"]].map(([k, ad]) =>
        `<button class="btn-mini" onclick="window._danisma.filtre('${k}')" style="${_filtre === k ? "background:#1E293B; color:#fff; border-color:#1E293B;" : ""} font-weight:700;">${ad}</button>`).join("")}
      <button class="btn-mini" onclick="window._danisma.formAc()" style="margin-left:auto; background:#0E7490; color:#fff; border:none; font-weight:700; padding:9px 16px;">
        <i data-lucide="calendar-plus" style="width:13px;height:13px;vertical-align:-2px;"></i> Yeni Randevu</button>
    </div>

    <div id="danismaForm" style="display:none;"></div>

    <!-- Liste -->
    ${gosterilen.length === 0
      ? `<div style="background:#fff; border-radius:14px; padding:30px; text-align:center; color:#94A3B8; font-size:13.5px;">Bu filtrede randevu yok.</div>`
      : gosterilen.map(r => {
          const s = DURUM[r.durum] || DURUM.bekliyor;
          const bugunMu = r.tarih === b;
          return `
          <div style="background:#fff; border:1px solid #E9EBF4; border-left:4px solid ${s.r}; border-radius:12px; padding:13px 15px; margin-bottom:9px; ${bugunMu ? "box-shadow:0 0 0 2px " + s.r + "22;" : ""}">
            <div style="display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap;">
              <div style="min-width:54px; text-align:center;">
                <div style="font-weight:800; font-size:16px; color:${s.r};">${esc(r.saat || "—")}</div>
                <div style="font-size:10.5px; color:#94A3B8;">${gunAd(r.tarih)} ${trh(r.tarih)}</div>
              </div>
              <div style="flex:1; min-width:200px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <strong style="font-size:14px; color:#1E293B;">${esc(r.veliAd)}</strong>
                  <span style="font-size:10px; font-weight:800; color:${s.r}; background:${s.bg}; padding:2px 8px; border-radius:100px;">${s.ikon} ${s.ad}</span>
                </div>
                <div style="font-size:12px; color:#64748B; margin-top:3px;">
                  ${r.cocukAd ? `👶 ${esc(r.cocukAd)}${r.cocukDogum ? " · " + yasHesapla(r.cocukDogum) : ""} · ` : ""}
                  ${r.telefon ? `<a href="tel:${esc(r.telefon)}" style="color:#0E7490; font-weight:700;">${esc(r.telefon)}</a>` : ""}
                  ${r.kaynak ? ` · <span style="color:#94A3B8;">${esc(r.kaynak)}</span>` : ""}
                  ${r.gorusecek ? ` · ${esc(r.gorusecek)} görüşecek` : ""}
                </div>
                ${r.not ? `<div style="font-size:11.5px; color:#94A3B8; margin-top:3px; font-style:italic;">"${esc(r.not)}"</div>` : ""}
              </div>
              <div style="display:flex; gap:5px; flex-wrap:wrap;">
                ${r.durum === "bekliyor" ? `<button class="btn-mini" onclick="window._danisma.durum('${r.id}','onaylandi')" style="background:#EFF6FF; color:#1D4ED8; border-color:#BFDBFE; font-size:11px; padding:4px 9px;">Onayla</button>` : ""}
                ${["bekliyor","onaylandi"].includes(r.durum) ? `
                  <button class="btn-mini" onclick="window._danisma.durum('${r.id}','geldi')" style="background:#ECFDF5; color:#166534; border-color:#86EFAC; font-size:11px; padding:4px 9px; font-weight:700;">Geldi</button>
                  <button class="btn-mini" onclick="window._danisma.durum('${r.id}','gelmedi')" style="background:#FEF2F2; color:#991B1B; border-color:#FCA5A5; font-size:11px; padding:4px 9px;">Gelmedi</button>` : ""}
                ${r.durum === "geldi" ? `<button class="btn-mini" onclick="window._danisma.durum('${r.id}','kayit_oldu')" style="background:#F5F3FF; color:#6D28D9; border-color:#DDD6FE; font-size:11px; padding:4px 9px; font-weight:700;">🎉 Kayıt oldu</button>` : ""}
                ${!["kayit_oldu","iptal"].includes(r.durum) ? `<button class="btn-mini" onclick="window._danisma.durum('${r.id}','iptal')" style="font-size:11px; padding:4px 9px; color:#94A3B8;">İptal</button>` : ""}
              </div>
            </div>
          </div>`;
        }).join("")}`;
  lucide();
}

function filtre(k) { _filtre = k; panelRender("danismaRandevuIcerik"); }

function formAc() {
  const f = document.getElementById("danismaForm");
  if (!f) return;
  if (f.style.display !== "none") { f.style.display = "none"; return; }
  const { bugun } = P();
  f.style.display = "block";
  f.innerHTML = `
    <div style="background:#fff; border:1px solid #A5F3FC; border-radius:14px; padding:16px 18px; margin-bottom:14px;">
      <div style="font-size:13px; font-weight:800; color:#0E7490; margin-bottom:12px;">Yeni Aday Veli Randevusu</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px;">
        <div><label style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;">Veli Adı *</label>
          <input id="drVeliAd" type="text" placeholder="Ad Soyad" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"></div>
        <div><label style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;">Telefon *</label>
          <input id="drTel" type="tel" placeholder="05xx xxx xx xx" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"></div>
        <div><label style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;">E-posta</label>
          <input id="drEposta" type="email" placeholder="isteğe bağlı" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"></div>
        <div><label style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;">Çocuğun Adı</label>
          <input id="drCocuk" type="text" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"></div>
        <div><label style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;">Çocuğun Doğum Tarihi</label>
          <input id="drDogum" type="date" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"></div>
        <div><label style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;">Bizi Nereden Duydu</label>
          <select id="drKaynak" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;">
            ${KAYNAKLAR.map(k => `<option>${k}</option>`).join("")}</select></div>
        <div><label style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;">Randevu Tarihi *</label>
          <input id="drTarih" type="date" value="${bugun()}" min="${bugun()}" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"></div>
        <div><label style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;">Saat *</label>
          <input id="drSaat" type="time" value="10:00" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;"></div>
        <div><label style="font-size:10.5px; font-weight:800; color:#64748B; text-transform:uppercase;">Kim Görüşecek</label>
          <select id="drGorusecek" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:3px;">
            <option>Kurucu Müdür</option><option>Müdür</option><option>Koordinatör</option><option>Danışma</option></select></div>
      </div>
      <input id="drNot" type="text" placeholder="Not (örn. ikiz çocuk, tam gün istiyor…)" style="width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; margin-top:10px;">
      <div style="display:flex; gap:8px; margin-top:12px; justify-content:flex-end;">
        <button class="btn-mini" onclick="window._danisma.formAc()">İptal</button>
        <button class="btn-mini" onclick="window._danisma.kaydet()" style="background:#0E7490; color:#fff; border:none; font-weight:700; padding:9px 18px;">Randevuyu Kaydet</button>
      </div>
    </div>`;
  setTimeout(() => document.getElementById("drVeliAd")?.focus(), 50);
}

async function kaydet() {
  const { fb, db, state, toast } = P();
  const g = (id) => (document.getElementById(id)?.value || "").trim();
  const veliAd = g("drVeliAd"), telefon = g("drTel"), tarih = g("drTarih"), saat = g("drSaat");
  if (!veliAd || !telefon || !tarih || !saat) { toast("Veli adı, telefon, tarih ve saat gerekli", "error"); return; }
  try {
    await fb.addDoc(fb.collection(db, "danismaRandevulari"), {
      veliAd, telefon,
      eposta: g("drEposta").toLowerCase(),
      cocukAd: g("drCocuk"),
      cocukDogum: g("drDogum"),
      cocukSayisi: 1,
      tarih, saat,
      kaynak: g("drKaynak"),
      gorusecek: g("drGorusecek"),
      not: g("drNot"),
      durum: "bekliyor",
      olusturanEmail: (state.currentUser?.email || "").toLowerCase(),
      olusturanAd: state.personel?.adSoyad || state.currentUser?.displayName || "",
      olusturuldu: new Date().toISOString(),
      guncellendi: fb.serverTimestamp()
    });
    toast("✓ Randevu kaydedildi");
    panelRender("danismaRandevuIcerik");
  } catch (e) {
    console.error("randevu kaydet:", e);
    toast("Kaydedilemedi: " + e.message, "error");
  }
}

async function durum(id, yeni) {
  const { fb, db, state, toast } = P();
  const etiket = DURUM[yeni]?.ad || yeni;
  if (yeni === "kayit_oldu" && !confirm("Bu aday kayıt oldu olarak işaretlenecek. Onaylıyor musunuz?")) return;
  try {
    await fb.setDoc(fb.doc(db, "danismaRandevulari", id), {
      durum: yeni,
      [yeni + "Zamani"]: new Date().toISOString(),
      guncelleyen: (state.currentUser?.email || "").toLowerCase(),
      guncellendi: fb.serverTimestamp()
    }, { merge: true });
    toast("✓ " + etiket);
    panelRender("danismaRandevuIcerik");
  } catch (e) { toast("Kaydedilemedi: " + e.message, "error"); }
}

// ───────────────────────────────────────────────────────────────────
// ÖZET KARTI — bugünün randevuları
// ───────────────────────────────────────────────────────────────────
export async function ozetKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { esc, bugun } = P();
  await yukle();
  const b = bugun();
  const bugunku = _liste.filter(r => r.tarih === b && ["bekliyor", "onaylandi"].includes(r.durum))
    .sort((a, c) => String(a.saat).localeCompare(String(c.saat)));
  const yarin = new Date(); yarin.setDate(yarin.getDate() + 1);
  const yarinku = _liste.filter(r => r.tarih === yarin.toISOString().slice(0, 10) && ["bekliyor", "onaylandi"].includes(r.durum)).length;

  if (!bugunku.length) {
    el.innerHTML = `<div style="font-size:12.5px; color:var(--c-muted);">Bugün aday veli randevusu yok${yarinku ? ` · yarın ${yarinku} randevu` : ""}.</div>`;
    return;
  }
  el.innerHTML = bugunku.map(r => `
    <div style="display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid #F1F2F7;">
      <div style="font-weight:800; font-size:13px; color:#0E7490; min-width:42px;">${esc(r.saat)}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:13px; font-weight:700; color:var(--c-ink);">${esc(r.veliAd)}</div>
        <div style="font-size:11px; color:var(--c-muted);">${r.cocukAd ? esc(r.cocukAd) + (r.cocukDogum ? " · " + yasHesapla(r.cocukDogum) : "") : ""}${r.gorusecek ? " · " + esc(r.gorusecek) : ""}</div>
      </div>
      <button class="btn-mini" onclick="window._danisma.durum('${r.id}','geldi').then(() => window._danisma.ozetYenile && window._danisma.ozetYenile())" style="background:#ECFDF5; color:#166534; border-color:#86EFAC; font-size:11px; padding:4px 9px; font-weight:700;">Geldi</button>
    </div>`).join("") + (yarinku ? `<div style="font-size:11px; color:var(--c-muted); padding-top:6px;">Yarın ${yarinku} randevu</div>` : "");
}

window._danisma = { filtre, formAc, kaydet, durum, ozetYenile: () => ozetKart("ozetDanismaKart") };
