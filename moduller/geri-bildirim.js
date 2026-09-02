// ═══════════════════════════════════════════════════════════════════
// İLETİŞİM & GERİ BİLDİRİM — moduller/geri-bildirim.js
// ZEKY ile ORTAK üç koleksiyon:
//   memnuniyet/{veliEmail}__{hafta}   → veli haftalık anket (puanlar, yorum, öneri)
//   ihtiyacTalepleri/{otoId}          → PERSONEL → yönetim: "sınıfa X lazım"
//   belgeOnaylari/{otoId}             → veli KVKK / sözleşme / foto izni dijital onayı
//
// Kullanım:
//   m.veliMemnuniyetKart("id")     → veli: bu haftanın anketi
//   m.veliBelgeOnayKart("id")      → veli: bekleyen onaylar
//   m.personelIhtiyacKart("id")    → öğretmen/personel: talep aç + kendi talepleri
//   m.yonetimPanel("id")           → yönetim: memnuniyet panosu + ihtiyaç onayı
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

const SORULAR = [
  { k: "iletisim",  ad: "Öğretmenle iletişim" },
  { k: "bakim",     ad: "Çocuğumun bakımı ve güvenliği" },
  { k: "egitim",    ad: "Eğitim programından memnuniyet" },
  { k: "genel",     ad: "Genel memnuniyet" }
];
const BELGELER = [
  { k: "kvkk",     ad: "KVKK Aydınlatma ve Açık Rıza Metni", ozet: "Kişisel verilerin işlenmesine ilişkin bilgilendirme ve onay." },
  { k: "sozlesme", ad: "Eğitim Hizmet Sözleşmesi",           ozet: "2026-2027 dönemi hizmet şartları, ücret ve ödeme planı." },
  { k: "foto",     ad: "Fotoğraf ve Görüntü Kullanım İzni",  ozet: "Etkinlik fotoğraflarının okul iletişim kanallarında paylaşımı." },
  { k: "gezi",     ad: "Okul Dışı Etkinlik Genel İzni",      ozet: "Orman okulu ve yakın çevre gezileri için dönemlik izin." }
];

function haftaKodu(d = new Date()) {
  const t = new Date(d); const g = t.getDay() || 7;
  t.setDate(t.getDate() - g + 1);
  return t.toISOString().slice(0, 10);
}
function trh(iso) { return iso ? String(iso).substring(0, 10).split("-").reverse().join(".") : "—"; }
const yildiz = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

// ───────────────────────────────────────────────────────────────────
// 1) MEMNUNİYET — VELİ
// ───────────────────────────────────────────────────────────────────
export async function veliMemnuniyetKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { fb, db, state, esc } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) { el.innerHTML = ""; return; }
  const email = (state.currentUser?.email || "").toLowerCase();
  const hafta = haftaKodu();

  let mevcut = null;
  try {
    const s = await fb.getDoc(fb.doc(db, "memnuniyet", email + "__" + hafta));
    if (s.exists()) mevcut = s.data();
  } catch (e) {}

  // Bu hafta doldurulmuş → kompakt teşekkür
  if (mevcut) {
    el.innerHTML = `<div style="display:flex; align-items:center; gap:10px; padding:10px 16px; font-size:12.5px; color:#166534;">
      <span>💚</span><span style="flex:1;">Bu haftaki değerlendirmeniz alındı · ${yildiz(mevcut.puan || 0)} <span style="color:var(--c-muted);">(${mevcut.puan})</span></span>
      <button onclick="window._gb.memnuniyetYenidenAc('${hedefId}')" style="background:none; border:none; color:#166534; font-size:11px; cursor:pointer; text-decoration:underline;">Değiştir</button>
    </div>`;
    return;
  }
  memnuniyetForm(el, hedefId);
}

function memnuniyetForm(el, hedefId) {
  el.innerHTML = `
    <div style="padding:14px 18px; border-bottom:1px solid #F1F2F7; display:flex; align-items:center; gap:10px;">
      <span style="font-size:22px;">💬</span>
      <div><div class="ca-head" style="font-size:14px;">Bu Hafta Nasıl Geçti?</div>
      <div class="ca-tile-sub">30 saniye · yanıtlarınız okulu geliştirir</div></div>
    </div>
    <div style="padding:12px 18px;">
      ${SORULAR.map(s => `
        <div style="display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid #F1F2F7;">
          <span style="flex:1; font-size:13px; color:var(--c-ink);">${s.ad}</span>
          <div style="display:flex; gap:3px;" data-soru="${s.k}">
            ${[1,2,3,4,5].map(n => `<button onclick="window._gb.puanSec('${s.k}',${n},this)" data-n="${n}"
              style="width:30px; height:30px; border-radius:8px; border:1.5px solid #E2E8F0; background:#fff; color:#CBD5E1; font-size:16px; cursor:pointer; padding:0;">★</button>`).join("")}
          </div>
        </div>`).join("")}
      <textarea id="gbYorum" rows="2" placeholder="Eklemek istediğiniz bir şey var mı? (isteğe bağlı)"
        style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; font-size:13px; margin-top:10px;"></textarea>
      <label style="display:flex; align-items:center; gap:7px; font-size:11.5px; color:var(--c-muted); margin-top:8px; cursor:pointer;">
        <input type="checkbox" id="gbGizli"> İsmim görünmesin (anonim)</label>
      <button class="ca-btn" style="width:100%; margin-top:10px; padding:11px;" onclick="window._gb.memnuniyetGonder('${hedefId}')">Gönder</button>
    </div>`;
}
const _puanlar = {};
function puanSec(soru, n, btn) {
  _puanlar[soru] = n;
  btn.parentElement.querySelectorAll("button").forEach(b => {
    const on = Number(b.dataset.n) <= n;
    b.style.color = on ? "#F59E0B" : "#CBD5E1";
    b.style.borderColor = on ? "#F59E0B" : "#E2E8F0";
  });
}
async function memnuniyetGonder(hedefId) {
  const { fb, db, state, toast } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  const email = (state.currentUser?.email || "").toLowerCase();
  const doluSoru = Object.keys(_puanlar).length;
  if (doluSoru < SORULAR.length) { toast(`${SORULAR.length - doluSoru} soru daha puanlayın`, "error"); return; }
  const vals = Object.values(_puanlar);
  const ort = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  const gizli = !!document.getElementById("gbGizli")?.checked;
  try {
    await fb.setDoc(fb.doc(db, "memnuniyet", email + "__" + haftaKodu()), {
      veliEmail: email,
      ogrenciId: ogr?.id || "", ogrenciAd: gizli ? "" : (ogr?.ogrenciAdSoyad || ""),
      sinif: (state.ayarListesi[ogr?.id]?.kayit?.sinif) || ogr?.sinif || "",
      hafta: haftaKodu(), puanlar: { ..._puanlar }, puan: ort,
      yorum: (document.getElementById("gbYorum")?.value || "").trim(), oneri: "",
      yanitlar: [], gizlilik: gizli ? "anonim" : "acik",
      tarih: new Date().toISOString(), olusturuldu: fb.serverTimestamp()
    }, { merge: true });
    toast("💚 Teşekkürler, değerlendirmeniz alındı");
    Object.keys(_puanlar).forEach(k => delete _puanlar[k]);
    veliMemnuniyetKart(hedefId);
  } catch (e) { toast("Gönderilemedi: " + e.message, "error"); }
}

// ───────────────────────────────────────────────────────────────────
// 2) BELGE ONAYLARI — VELİ
// ───────────────────────────────────────────────────────────────────
export async function veliBelgeOnayKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { fb, db, state, esc } = P();
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  if (!ogr) { el.innerHTML = ""; return; }
  const email = (state.currentUser?.email || "").toLowerCase();

  const onaylar = {};
  try {
    const s = await fb.getDocs(fb.query(fb.collection(db, "belgeOnaylari"), fb.where("veliEmail", "==", email)));
    s.forEach(d => { const v = d.data(); if (v.ogrenciId === ogr.id) onaylar[v.belge] = v; });
  } catch (e) {}

  const bekleyen = BELGELER.filter(b => !onaylar[b.k]);
  if (!bekleyen.length) {
    el.innerHTML = `<div style="display:flex; align-items:center; gap:10px; padding:10px 16px; font-size:12.5px; color:#166534;">
      <span>📋</span><span>Tüm belge onaylarınız tamam · ${BELGELER.length}/${BELGELER.length}</span></div>`;
    return;
  }
  el.innerHTML = `
    <div style="padding:14px 18px; border-bottom:1px solid #F1F2F7; display:flex; align-items:center; gap:10px;">
      <span style="font-size:22px;">📋</span>
      <div><div class="ca-head" style="font-size:14px;">Onay Bekleyen Belgeler</div>
      <div class="ca-tile-sub">${bekleyen.length} belge onayınızı bekliyor</div></div>
    </div>
    <div style="padding:6px 18px 12px;">
      ${bekleyen.map(b => `
        <div style="padding:10px 0; border-bottom:1px solid #F1F2F7;">
          <div style="font-size:13px; font-weight:700; color:var(--c-ink);">${b.ad}</div>
          <div style="font-size:11.5px; color:var(--c-muted); margin:3px 0 8px;">${b.ozet}</div>
          <button class="ca-btn" style="padding:8px 14px; font-size:12.5px;" onclick="window._gb.belgeOnayla('${b.k}','${hedefId}')">Okudum, onaylıyorum</button>
        </div>`).join("")}
    </div>`;
}
async function belgeOnayla(belge, hedefId) {
  const { fb, db, state, toast } = P();
  const b = BELGELER.find(x => x.k === belge);
  if (!confirm(`"${b.ad}" belgesini okuduğunuzu ve onayladığınızı beyan ediyorsunuz.\n\nDevam edilsin mi?`)) return;
  const ogr = state.veliAktifOgrenci || state.veliOgrenciler[0];
  try {
    await fb.addDoc(fb.collection(db, "belgeOnaylari"), {
      veliEmail: (state.currentUser?.email || "").toLowerCase(),
      veliAd: state.currentUser?.displayName || "",
      ogrenciId: ogr.id, ogrenciAd: ogr.ogrenciAdSoyad || "",
      belge, belgeAd: b.ad,
      donem: state.aktifDonem,
      onayZamani: new Date().toISOString(),
      tarayici: navigator.userAgent.substring(0, 120),
      olusturuldu: fb.serverTimestamp()
    });
    toast("✓ Onayınız kaydedildi");
    veliBelgeOnayKart(hedefId);
  } catch (e) { toast("Kaydedilemedi: " + e.message, "error"); }
}

// ───────────────────────────────────────────────────────────────────
// 3) İHTİYAÇ TALEBİ — PERSONEL (Profilim'de)
// ───────────────────────────────────────────────────────────────────
export async function personelIhtiyacKart(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { fb, db, state, esc } = P();
  const email = (state.currentUser?.email || "").toLowerCase();
  let talepler = [];
  try {
    const s = await fb.getDocs(fb.query(fb.collection(db, "ihtiyacTalepleri"), fb.where("talepEden", "==", email)));
    s.forEach(d => talepler.push({ id: d.id, ...d.data() }));
    talepler.sort((a, b) => (b.olusturuldu?.seconds || 0) - (a.olusturuldu?.seconds || 0));
  } catch (e) {}
  const D = { Beklemede: ["#B45309","#FFFBEB"], Onaylandi: ["#059669","#ECFDF5"], Alindi: ["#059669","#ECFDF5"], Reddedildi: ["#DC2626","#FEF2F2"] };
  const sn = state.siniflar || [];
  el.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:10px;">
      <input id="ihBaslik" type="text" placeholder="Ne lazım? (örn. sulu boya seti)" style="flex:2; padding:9px 11px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; font-size:13px;">
      <input id="ihAdet" type="text" placeholder="Adet" style="width:60px; padding:9px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; font-size:13px;">
      <select id="ihTur" style="padding:9px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; font-size:13px;"><option>Malzeme</option><option>Onarım</option><option>Diğer</option></select>
    </div>
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px;">
      ${sn.length > 1 ? `<select id="ihSinif" style="padding:8px; border:1px solid #E2E8F0; border-radius:9px; font-family:inherit; font-size:12px;">${sn.map(s => `<option>${esc(s)}</option>`).join("")}</select>` : `<input type="hidden" id="ihSinif" value="${esc(sn[0] || "")}">`}
      <label style="font-size:12px; display:flex; gap:5px; align-items:center;"><input type="checkbox" id="ihAcil"> Acil</label>
      <button class="btn-mini" onclick="window._gb.ihtiyacGonder('${hedefId}')" style="margin-left:auto; background:#2D5E3E; color:#fff; border:none; font-weight:700;">Talep Gönder</button>
    </div>
    ${talepler.slice(0, 5).map(t => {
      const [r, bg] = D[t.durum] || D.Beklemede;
      return `<div style="display:flex; align-items:center; gap:9px; padding:7px 0; border-bottom:1px solid #F1F2F7;">
        <div style="flex:1; min-width:0;"><div style="font-size:13px; font-weight:600; color:#334155;">${esc(t.baslik)}${t.adet ? " × " + esc(t.adet) : ""}${t.acil ? ' <span style="color:#DC2626; font-size:10px; font-weight:800;">ACİL</span>' : ""}</div>
        <div style="font-size:11px; color:#94A3B8;">${esc(t.tur)} · ${esc(t.sinif)}${t.yonetimNotu ? " · " + esc(t.yonetimNotu) : ""}</div></div>
        <span style="font-size:10px; font-weight:800; color:${r}; background:${bg}; padding:3px 8px; border-radius:100px;">${esc(t.durum)}</span>
      </div>`;
    }).join("") || `<div style="font-size:12.5px; color:#94A3B8;">Henüz talebiniz yok.</div>`}`;
}
async function ihtiyacGonder(hedefId) {
  const { fb, db, state, toast } = P();
  const baslik = (document.getElementById("ihBaslik")?.value || "").trim();
  if (!baslik) { toast("Ne lazım olduğunu yazın", "error"); return; }
  try {
    await fb.addDoc(fb.collection(db, "ihtiyacTalepleri"), {
      tur: document.getElementById("ihTur")?.value || "Malzeme",
      sinif: document.getElementById("ihSinif")?.value || "",
      baslik, adet: (document.getElementById("ihAdet")?.value || "").trim(),
      acil: !!document.getElementById("ihAcil")?.checked,
      durum: "Beklemede",
      talepEden: (state.currentUser?.email || "").toLowerCase(),
      talepEdenAd: state.personel?.adSoyad || state.currentUser?.displayName || "",
      olusturuldu: fb.serverTimestamp()
    });
    toast("✓ Talep yönetime iletildi");
    personelIhtiyacKart(hedefId);
  } catch (e) { toast("Gönderilemedi: " + e.message, "error"); }
}

// ───────────────────────────────────────────────────────────────────
// 4) YÖNETİM PANELİ — memnuniyet panosu + ihtiyaç onayı
// ───────────────────────────────────────────────────────────────────
export async function yonetimPanel(hedefId) {
  const el = document.getElementById(hedefId);
  if (!el) return;
  const { fb, db, esc, lucide } = P();
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p>Yükleniyor...</p></div>`;

  // Memnuniyet (son 8 hafta)
  let mem = [];
  try { const s = await fb.getDocs(fb.collection(db, "memnuniyet")); s.forEach(d => mem.push(d.data())); } catch (e) {}
  const haftalar = [...new Set(mem.map(m => m.hafta))].sort().slice(-8);
  const haftaOrt = haftalar.map(h => {
    const x = mem.filter(m => m.hafta === h);
    return { h, n: x.length, ort: x.length ? Math.round(x.reduce((a, b) => a + (b.puan || 0), 0) / x.length * 10) / 10 : 0 };
  });
  const buHafta = mem.filter(m => m.hafta === haftaKodu());
  const soruOrt = SORULAR.map(s => {
    const v = buHafta.map(m => m.puanlar?.[s.k]).filter(Boolean);
    return { ad: s.ad, ort: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : 0, n: v.length };
  });
  const yorumlar = mem.filter(m => m.yorum).sort((a, b) => String(b.tarih).localeCompare(String(a.tarih))).slice(0, 10);

  // İhtiyaç talepleri
  let ih = [];
  try { const s = await fb.getDocs(fb.collection(db, "ihtiyacTalepleri")); s.forEach(d => ih.push({ id: d.id, ...d.data() })); } catch (e) {}
  const bekleyen = ih.filter(t => t.durum === "Beklemede").sort((a, b) => (b.acil - a.acil) || ((b.olusturuldu?.seconds || 0) - (a.olusturuldu?.seconds || 0)));

  el.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px;">
      <!-- Memnuniyet -->
      <div style="background:#fff; border:1px solid #E9EBF4; border-radius:14px; padding:16px 18px;">
        <div style="font-size:13.5px; font-weight:800; color:#1E293B; margin-bottom:12px;">💬 Veli Memnuniyeti</div>
        <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:12px;">
          <span style="font-size:32px; font-weight:800; color:#059669;">${haftaOrt.at(-1)?.ort || "—"}</span>
          <span style="font-size:12px; color:#64748B;">/ 5 · bu hafta ${buHafta.length} yanıt</span>
        </div>
        ${soruOrt.map(s => `<div style="display:flex; justify-content:space-between; font-size:12.5px; padding:5px 0; border-bottom:1px solid #F1F2F7;">
          <span style="color:#334155;">${s.ad}</span><span style="font-weight:700; color:${s.ort >= 4 ? "#059669" : s.ort >= 3 ? "#B45309" : "#DC2626"};">${s.ort ? yildiz(s.ort) + " " + s.ort : "—"}</span></div>`).join("")}
        <div style="display:flex; gap:4px; align-items:flex-end; height:50px; margin-top:12px;">
          ${haftaOrt.map(w => `<div title="${trh(w.h)} · ${w.ort} (${w.n} yanıt)" style="flex:1; background:${w.ort >= 4 ? "#059669" : w.ort >= 3 ? "#F59E0B" : "#DC2626"}; height:${Math.max(4, w.ort / 5 * 100)}%; border-radius:4px 4px 0 0; opacity:.85;"></div>`).join("")}
        </div>
        <div style="font-size:10.5px; color:#94A3B8; margin-top:4px;">Son ${haftaOrt.length} hafta</div>
        ${yorumlar.length ? `<div style="font-size:11px; font-weight:800; color:#64748B; text-transform:uppercase; margin:14px 0 6px;">Son yorumlar</div>
          ${yorumlar.slice(0, 5).map(y => `<div style="font-size:12px; color:#475569; padding:6px 0; border-bottom:1px solid #F1F2F7; font-style:italic;">"${esc(y.yorum)}" <span style="color:#94A3B8; font-style:normal;">— ${y.gizlilik === "anonim" ? "anonim" : esc(y.ogrenciAd) + " velisi"}</span></div>`).join("")}` : ""}
      </div>

      <!-- İhtiyaç talepleri -->
      <div style="background:#fff; border:1px solid #E9EBF4; border-radius:14px; padding:16px 18px;">
        <div style="font-size:13.5px; font-weight:800; color:#1E293B; margin-bottom:12px;">🧰 İhtiyaç Talepleri <span style="font-size:11px; color:#B45309;">${bekleyen.length} bekliyor</span></div>
        ${bekleyen.length ? bekleyen.map(t => `
          <div style="padding:9px 0; border-bottom:1px solid #F1F2F7;">
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:700; color:#1E293B;">${t.acil ? '🔴 ' : ''}${esc(t.baslik)}${t.adet ? " × " + esc(t.adet) : ""}</div>
                <div style="font-size:11px; color:#94A3B8;">${esc(t.tur)} · ${esc(t.sinif)} · ${esc(t.talepEdenAd || t.talepEden)}</div>
              </div>
              <button class="btn-mini" onclick="window._gb.ihtiyacDurum('${t.id}','Onaylandi','${hedefId}')" style="background:#ECFDF5; color:#166534; border-color:#86EFAC; font-size:11px; padding:4px 9px; font-weight:700;">Onayla</button>
              <button class="btn-mini" onclick="window._gb.ihtiyacDurum('${t.id}','Reddedildi','${hedefId}')" style="font-size:11px; padding:4px 9px; color:#94A3B8;">Reddet</button>
            </div>
          </div>`).join("") : `<div style="font-size:12.5px; color:#94A3B8;">Bekleyen talep yok.</div>`}
        ${ih.filter(t => t.durum === "Onaylandi").length ? `<div style="font-size:11px; color:#059669; margin-top:10px;">✓ ${ih.filter(t => t.durum === "Onaylandi").length} onaylı · satın alındığında "Alındı" işaretleyin</div>` : ""}
      </div>
    </div>`;
  lucide();
}
async function ihtiyacDurum(id, durum, hedefId) {
  const { fb, db, state, toast } = P();
  let not = "";
  if (durum === "Reddedildi") not = prompt("Red nedeni (personele iletilir):") || "";
  try {
    await fb.setDoc(fb.doc(db, "ihtiyacTalepleri", id), {
      durum, yonetimNotu: not, islemYapan: (state.currentUser?.email || "").toLowerCase(), guncellendi: fb.serverTimestamp()
    }, { merge: true });
    toast(durum === "Onaylandi" ? "✓ Onaylandı" : "Reddedildi");
    yonetimPanel(hedefId);
  } catch (e) { toast("Kaydedilemedi: " + e.message, "error"); }
}

window._gb = {
  puanSec, memnuniyetGonder, belgeOnayla, ihtiyacGonder, ihtiyacDurum,
  memnuniyetYenidenAc: (id) => { const el = document.getElementById(id); if (el) memnuniyetForm(el, id); }
};
