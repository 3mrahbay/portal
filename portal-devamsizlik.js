// ══════════════════════════════════════════════════════════════
// PORTAL · DEVAMSIZLIK MODÜLÜ
// Faz 4 · index.html'den ayrıştırıldı (2026-08-05)
// NOT: aylikOzetAy değişkeni çekirdekte kaldı — o "Aylık Özet"
// bölümüne ait, bu modül sadece tanımlıyordu.
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField,
        brevoMail, portalMailSablon, escapeHtml, getOgrenciDurum, isoTarih } = B;

let aktifDevamsizlikTarih = null;
// Aylık Özet (çekirdekte) bu tarihi okuyor — global olarak da tutuluyor.
window.aktifDevamsizlikTarih = null;
let aktifDevamsizlikVerisi = null;

const DEVAMSIZLIK_DURUMLAR = {
  geldi:    { ikon: "✅", label: "Geldi",    renk: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  gelmedi:  { ikon: "❌", label: "Gelmedi",  renk: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  izinli:   { ikon: "🏖", label: "İzinli",   renk: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  hasta:    { ikon: "🤒", label: "Hasta",    renk: "#9333ea", bg: "#faf5ff", border: "#e9d5ff" }
};

window.devamsizlikBugun = function() {
  aktifDevamsizlikTarih = window.aktifDevamsizlikTarih = isoTarih(new Date());
  document.getElementById("devamsizlikTarih").value = aktifDevamsizlikTarih;
  renderDevamsizlik();
};

window.devamsizlikGunDegistir = function(gun) {
  const d = new Date(aktifDevamsizlikTarih || new Date());
  d.setDate(d.getDate() + gun);
  aktifDevamsizlikTarih = window.aktifDevamsizlikTarih = isoTarih(d);
  document.getElementById("devamsizlikTarih").value = aktifDevamsizlikTarih;
  renderDevamsizlik();
};

window.devamsizlikTarihDegisti = function() {
  aktifDevamsizlikTarih = window.aktifDevamsizlikTarih = document.getElementById("devamsizlikTarih").value;
  renderDevamsizlik();
};

async function renderDevamsizlik() {
  const el = document.getElementById("devamsizlikListesi");
  if (!el) return;

  if (!aktifDevamsizlikTarih) aktifDevamsizlikTarih = window.aktifDevamsizlikTarih = isoTarih(new Date());
  const tarihInp = document.getElementById("devamsizlikTarih");
  if (tarihInp && !tarihInp.value) tarihInp.value = aktifDevamsizlikTarih;

  // Bugünün verisini yükle
  try {
    const snap = await getDoc(doc(db, "devamsizlik", aktifDevamsizlikTarih));
    aktifDevamsizlikVerisi = snap.exists() ? snap.data() : { tarih: aktifDevamsizlikTarih, kayitlar: {} };
  } catch (e) {
    console.warn("Devamsızlık yüklenemedi:", e);
    aktifDevamsizlikVerisi = { tarih: aktifDevamsizlikTarih, kayitlar: {} };
  }

  // Aktif öğrenciler
  const aktif = B.ogrenciler().filter(o => getOgrenciDurum(o, B.ayarlar()[o.id]) === "aktif");
  aktif.sort((a, b) => {
    const sA = (B.ayarlar()[a.id]?.kayit?.sinif) || a.sinif || "";
    const sB = (B.ayarlar()[b.id]?.kayit?.sinif) || b.sinif || "";
    if (sA !== sB) return sA.localeCompare(sB);
    return (a.ogrenciAdSoyad || "").localeCompare(b.ogrenciAdSoyad || "");
  });

  // Özet hesapla
  const sayaclar = { geldi: 0, gelmedi: 0, izinli: 0, hasta: 0, bilinmeyen: 0 };
  const kayitlar = aktifDevamsizlikVerisi.kayitlar || {};
  for (const o of aktif) {
    const k = kayitlar[o.id];
    if (k && k.durum) sayaclar[k.durum] = (sayaclar[k.durum] || 0) + 1;
    else sayaclar.bilinmeyen++;
  }

  // Özet şerit
  const ozetEl = document.getElementById("devamsizlikOzet");
  const tarihObj = new Date(aktifDevamsizlikTarih);
  const tarihStr = tarihObj.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const buGunMu = aktifDevamsizlikTarih === isoTarih(new Date());

  ozetEl.innerHTML = `
    <div style="background:linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border:1px solid #fecaca; border-radius:14px; padding:16px 20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="font-family:var(--font-display); font-size:15px; font-weight:700; color:#7f1d1d;">${tarihStr}${buGunMu ? ' <span style="background:#dc2626; color:white; padding:2px 10px; border-radius:8px; font-size:11px; margin-left:6px;">BUGÜN</span>' : ''}</div>
          <div style="font-size:12px; color:#991b1b; margin-top:2px;">Toplam ${aktif.length} aktif öğrenci</div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <div style="background:white; border:1px solid #bbf7d0; border-radius:10px; padding:8px 12px; min-width:75px; text-align:center;">
            <div style="font-size:11px; color:#166534; font-weight:600;">✅ Geldi</div>
            <div style="font-family:var(--font-display); font-size:22px; font-weight:700; color:#14532d;">${sayaclar.geldi}</div>
          </div>
          <div style="background:white; border:1px solid #fecaca; border-radius:10px; padding:8px 12px; min-width:75px; text-align:center;">
            <div style="font-size:11px; color:#991b1b; font-weight:600;">❌ Gelmedi</div>
            <div style="font-family:var(--font-display); font-size:22px; font-weight:700; color:#7f1d1d;">${sayaclar.gelmedi}</div>
          </div>
          <div style="background:white; border:1px solid #fde68a; border-radius:10px; padding:8px 12px; min-width:75px; text-align:center;">
            <div style="font-size:11px; color:#92400e; font-weight:600;">🏖 İzinli</div>
            <div style="font-family:var(--font-display); font-size:22px; font-weight:700; color:#78350f;">${sayaclar.izinli}</div>
          </div>
          <div style="background:white; border:1px solid #e9d5ff; border-radius:10px; padding:8px 12px; min-width:75px; text-align:center;">
            <div style="font-size:11px; color:#6b21a8; font-weight:600;">🤒 Hasta</div>
            <div style="font-family:var(--font-display); font-size:22px; font-weight:700; color:#581c87;">${sayaclar.hasta}</div>
          </div>
          ${sayaclar.bilinmeyen > 0 ? `
            <div style="background:#f3f4f6; border:1px solid #d1d5db; border-radius:10px; padding:8px 12px; min-width:75px; text-align:center;">
              <div style="font-size:11px; color:#6b7280; font-weight:600;">❓ İşaretsiz</div>
              <div style="font-family:var(--font-display); font-size:22px; font-weight:700; color:#374151;">${sayaclar.bilinmeyen}</div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // Öğrenci listesi (sınıf gruplu)
  if (aktif.length === 0) {
    el.innerHTML = `<div style="padding:30px; text-align:center; color:var(--gray-500);">Aktif öğrenci yok</div>`;
    return;
  }

  // Sınıfa göre grupla
  const sinifGruplari = {};
  for (const o of aktif) {
    const sinif = (B.ayarlar()[o.id]?.kayit?.sinif) || o.sinif || "Diğer";
    if (!sinifGruplari[sinif]) sinifGruplari[sinif] = [];
    sinifGruplari[sinif].push(o);
  }

  let html = `<div style="display:flex; flex-direction:column; gap:16px;">`;
  for (const sinif of Object.keys(sinifGruplari).sort()) {
    html += `
      <div style="background:white; border:1px solid var(--gray-200); border-radius:12px; overflow:hidden;">
        <div style="background:linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding:10px 16px; font-family:var(--font-display); font-size:14px; font-weight:700; color:var(--gray-800); border-bottom:1px solid var(--gray-200);">
          👥 ${escapeHtml(sinif)} <span style="font-size:12px; color:var(--gray-500); font-weight:400;">(${sinifGruplari[sinif].length} öğrenci)</span>
        </div>
        <div style="padding:8px;">
    `;
    for (const o of sinifGruplari[sinif]) {
      const k = kayitlar[o.id] || {};
      const durum = k.durum || "";
      const stil = DEVAMSIZLIK_DURUMLAR[durum];
      const notu = k.not || "";

      html += `
        <div style="padding:10px 12px; background:${stil ? stil.bg : 'white'}; border:1px solid ${stil ? stil.border : 'var(--gray-200)'}; border-radius:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="flex:1; min-width:200px;">
            <div style="font-weight:600; font-size:13px; color:${stil ? stil.renk : 'var(--gray-800)'};">
              ${escapeHtml(o.ogrenciAdSoyad || "")}
              ${stil ? `<span style="margin-left:8px; font-size:11px; background:white; color:${stil.renk}; padding:2px 8px; border-radius:6px; font-weight:700;">${stil.ikon} ${stil.label}</span>` : ''}
            </div>
            ${notu ? `<div style="font-size:11px; color:#6b7280; margin-top:3px; font-style:italic;">📝 ${escapeHtml(notu)}</div>` : ''}
          </div>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button onclick="devamsizlikIsaretle('${o.id}', 'geldi')" title="Geldi" style="padding:6px 10px; background:${durum === 'geldi' ? '#16a34a' : 'white'}; color:${durum === 'geldi' ? 'white' : '#16a34a'}; border:1px solid #bbf7d0; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; min-width:40px;">✅</button>
            <button onclick="devamsizlikIsaretle('${o.id}', 'gelmedi')" title="Gelmedi" style="padding:6px 10px; background:${durum === 'gelmedi' ? '#dc2626' : 'white'}; color:${durum === 'gelmedi' ? 'white' : '#dc2626'}; border:1px solid #fecaca; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; min-width:40px;">❌</button>
            <button onclick="devamsizlikIsaretle('${o.id}', 'izinli')" title="İzinli" style="padding:6px 10px; background:${durum === 'izinli' ? '#d97706' : 'white'}; color:${durum === 'izinli' ? 'white' : '#d97706'}; border:1px solid #fde68a; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; min-width:40px;">🏖</button>
            <button onclick="devamsizlikIsaretle('${o.id}', 'hasta')" title="Hasta" style="padding:6px 10px; background:${durum === 'hasta' ? '#9333ea' : 'white'}; color:${durum === 'hasta' ? 'white' : '#9333ea'}; border:1px solid #e9d5ff; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; min-width:40px;">🤒</button>
            <button onclick="acDevamsizlikNot('${o.id}')" title="Not ekle" style="padding:6px 10px; background:white; color:var(--gray-600); border:1px solid var(--gray-300); border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; min-width:40px;"><i data-lucide="file-text" style="width:15px;height:15px;vertical-align:-2px;"></i></button>
          </div>
        </div>
      `;
    }
    html += `</div></div>`;
  }
  html += `</div>`;

  el.innerHTML = html;
}

window.devamsizlikIsaretle = async function(ogrenciId, durum) {
  if (!aktifDevamsizlikVerisi) return;

  const eski = (aktifDevamsizlikVerisi.kayitlar || {})[ogrenciId] || {};
  const yeni = { durum, not: eski.not || "", kaydeden: B.kullanici().email, kayitZamani: new Date().toISOString() };

  // Aynı duruma tekrar tıklanırsa temizle
  const eskiDurum = eski.durum;
  let kayitSilindi = false;
  if (eskiDurum === durum) {
    // Temizle
    delete aktifDevamsizlikVerisi.kayitlar[ogrenciId];
    kayitSilindi = true;   // Faz 0: merge:true kaydı geri getirmesin diye aşağıda deleteField
  } else {
    aktifDevamsizlikVerisi.kayitlar = aktifDevamsizlikVerisi.kayitlar || {};
    aktifDevamsizlikVerisi.kayitlar[ogrenciId] = yeni;
  }

  aktifDevamsizlikVerisi.tarih = aktifDevamsizlikTarih;
  aktifDevamsizlikVerisi.guncellendi = new Date().toISOString();

  try {
    // Faz 0 · merge:true → ZEKY'den (öğretmen yoklaması) gelen alanlar silinmez.
    // Ama merge silinen anahtarı geri getirir; o yüzden temizleme deleteField ile yapılır.
    const devRef = doc(db, "devamsizlik", aktifDevamsizlikTarih);
    await setDoc(devRef, aktifDevamsizlikVerisi, { merge: true });
    if (kayitSilindi) {
      await updateDoc(devRef, { [`kayitlar.${ogrenciId}`]: deleteField() });
    }
    // Bugün için "Gelmedi" işaretlendiyse ve önceden farklıysa, veli mail'i (opsiyonel, sessiz)
    if (durum === "gelmedi" && eskiDurum !== "gelmedi" && aktifDevamsizlikTarih === isoTarih(new Date())) {
      devamsizlikVeliMail(ogrenciId);
    }
    renderDevamsizlik();
  } catch (e) {
    showToast("Kaydedilemedi: " + e.message, "error");
  }
};

async function devamsizlikVeliMail(ogrenciId) {
  try {
    const ogr = B.ogrenciler().find(o => o.id === ogrenciId);
    const ayar = B.ayarlar()[ogrenciId];
    if (!ogr || !ayar) return;
    const anne = ayar.anne || {};
    const baba = ayar.baba || {};
    const mailler = [];
    if (anne.eposta) mailler.push({ mail: anne.eposta, ad: anne.adSoyad || "Anne" });
    if (baba.eposta) mailler.push({ mail: baba.eposta, ad: baba.adSoyad || "Baba" });
    if (mailler.length === 0) return;

    const bugunStr = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    for (const v of mailler) {
      const icerik = `
        <p style="margin:0 0 14px; font-size:15px;">Sayın <strong>${escapeHtml(v.ad)}</strong>,</p>
        <div style="background:#fef2f2; border-left:4px solid #dc2626; border-radius:8px; padding:18px 22px; margin:16px 0;">
          <div style="font-size:12px; font-weight:700; color:#991b1b; letter-spacing:0.5px; margin-bottom:8px;"><i data-lucide="clipboard-list" style="width:13px;height:13px;vertical-align:-2px;"></i> DEVAMSIZLIK BİLDİRİMİ</div>
          <div style="font-size:14px; color:#374151; line-height:1.7;">
            <strong>${escapeHtml(ogr.ogrenciAdSoyad || "")}</strong> bugün (<strong>${bugunStr}</strong>) okula gelmedi.
          </div>
        </div>
        <p style="margin:16px 0; font-size:13px; color:#374151; line-height:1.7;">
          Eğer haberimiz olmaksızın bir durum varsa lütfen okul yönetimiyle iletişime geçin. Küçük bir arama bizi de rahatlatır. ☎️
        </p>
        <p style="margin:20px 0 0; font-size:13px; color:#374151;">Saygılarımızla,<br><strong>Bir Çiçek Koleji Anaokulu</strong></p>
      `;
      await brevoMail({
        to: v.mail, toName: v.ad,
        subject: `<i data-lucide="clipboard-list" style="width:13px;height:13px;vertical-align:-2px;"></i> Devamsızlık Bildirimi - ${ogr.ogrenciAdSoyad}`,
        htmlContent: portalMailSablon("Devamsızlık Bildirimi", icerik, "Okul yönetimi tarafından otomatik olarak gönderilmiştir.")
      });
      await new Promise(r => setTimeout(r, 300));
    }
  } catch (e) { console.warn("Devamsızlık mail hatası:", e); }
}

window.acDevamsizlikNot = function(ogrenciId) {
  const ogr = B.ogrenciler().find(o => o.id === ogrenciId);
  const mevcut = ((aktifDevamsizlikVerisi?.kayitlar || {})[ogrenciId] || {}).not || "";
  document.getElementById("devamsizlikNotBaslik").innerHTML = `📝 Not: ${ogr?.ogrenciAdSoyad || ""}`; window.lucideYenile && window.lucideYenile();
  document.getElementById("devamsizlikNotOgrenciId").value = ogrenciId;
  document.getElementById("devamsizlikNotMetin").value = mevcut;
  document.getElementById("devamsizlikNotModal").classList.add("active");
};

window.closeDevamsizlikNot = function() {
  document.getElementById("devamsizlikNotModal").classList.remove("active");
};

window.kaydetDevamsizlikNot = async function() {
  const ogrenciId = document.getElementById("devamsizlikNotOgrenciId").value;
  const not = document.getElementById("devamsizlikNotMetin").value.trim();
  if (!ogrenciId) return;

  aktifDevamsizlikVerisi.kayitlar = aktifDevamsizlikVerisi.kayitlar || {};
  const eski = aktifDevamsizlikVerisi.kayitlar[ogrenciId] || {};
  aktifDevamsizlikVerisi.kayitlar[ogrenciId] = { ...eski, not, kaydeden: B.kullanici().email };
  aktifDevamsizlikVerisi.tarih = aktifDevamsizlikTarih;
  aktifDevamsizlikVerisi.guncellendi = new Date().toISOString();

  try {
    await setDoc(doc(db, "devamsizlik", aktifDevamsizlikTarih), aktifDevamsizlikVerisi, { merge: true });
    showToast("✓ Not kaydedildi");
    closeDevamsizlikNot();
    renderDevamsizlik();
  } catch (e) {
    showToast("Kaydedilemedi: " + e.message, "error");
  }
};

window.devamsizlikHepsiGeldi = async function() {
  if (!confirm("Tüm aktif öğrencileri 'Geldi' olarak işaretlemek istiyor musunuz?\n(Önceki işaretlemeler korunur, sadece boş olanlar 'Geldi' olur)")) return;

  aktifDevamsizlikVerisi.kayitlar = aktifDevamsizlikVerisi.kayitlar || {};
  const aktif = B.ogrenciler().filter(o => getOgrenciDurum(o, B.ayarlar()[o.id]) === "aktif");
  let degisen = 0;
  for (const o of aktif) {
    if (!aktifDevamsizlikVerisi.kayitlar[o.id] || !aktifDevamsizlikVerisi.kayitlar[o.id].durum) {
      aktifDevamsizlikVerisi.kayitlar[o.id] = { durum: "geldi", not: "", kaydeden: B.kullanici().email, kayitZamani: new Date().toISOString() };
      degisen++;
    }
  }
  aktifDevamsizlikVerisi.tarih = aktifDevamsizlikTarih;
  aktifDevamsizlikVerisi.guncellendi = new Date().toISOString();

  try {
    await setDoc(doc(db, "devamsizlik", aktifDevamsizlikTarih), aktifDevamsizlikVerisi, { merge: true });
    showToast(`✓ ${degisen} öğrenci "Geldi" olarak işaretlendi`);
    renderDevamsizlik();
  } catch (e) {
    showToast("Kaydedilemedi: " + e.message, "error");
  }
};

// ── Çekirdeğin erişimi için ──
window.renderDevamsizlik    = renderDevamsizlik;
window.DEVAMSIZLIK_DURUMLAR = DEVAMSIZLIK_DURUMLAR;   // Veli · Okul Hayatı kullanıyor
console.log("Devamsızlık modülü yüklendi.");
