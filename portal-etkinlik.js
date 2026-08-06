// ══════════════════════════════════════════════════════════════
// PORTAL · ETKİNLİK TAKVİMİ MODÜLÜ
// Faz 4 · index.html'den ayrıştırıldı (2026-08-05)
// Çekirdeğe window.BCK köprüsüyle bağlanır.
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
        brevoMail, portalMailSablon, escapeHtml, getOgrenciDurum, isoTarih } = B;

let etkinlikListesi = [];
let aktifEtkinlikFilter = "yaklasan";

window.etkinlikFilter = function(f) {
  aktifEtkinlikFilter = f;
  document.querySelectorAll("[data-etkinlik-filter]").forEach(b => {
    if (b.dataset.etkinlikFilter === f) {
      b.style.background = "#3b82f6"; b.style.color = "white"; b.style.border = "none";
    } else {
      b.style.background = ""; b.style.color = ""; b.style.border = "";
    }
  });
  renderEtkinlikler();
};

async function loadEtkinlikler() {
  try {
    const snap = await getDocs(collection(db, "etkinlikler"));
    etkinlikListesi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Etkinlikler yüklenemedi:", e);
    etkinlikListesi = [];
  }
}

async function renderEtkinlikler() {
  const el = document.getElementById("etkinlikListesi");
  if (!el) return;

  await loadEtkinlikler();

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const buAy = bugun.getFullYear() + "-" + String(bugun.getMonth() + 1).padStart(2, "0");

  let liste = [...etkinlikListesi];
  if (aktifEtkinlikFilter === "yaklasan") {
    liste = liste.filter(e => e.tarih && new Date(e.tarih) >= bugun);
  } else if (aktifEtkinlikFilter === "buAy") {
    liste = liste.filter(e => (e.tarih || "").startsWith(buAy));
  } else if (aktifEtkinlikFilter === "gecmis") {
    liste = liste.filter(e => e.tarih && new Date(e.tarih) < bugun);
  }

  liste.sort((a, b) => aktifEtkinlikFilter === "gecmis"
    ? (b.tarih || "").localeCompare(a.tarih || "")
    : (a.tarih || "").localeCompare(b.tarih || ""));

  if (liste.length === 0) {
    el.innerHTML = `
      <div style="background:white; border:2px dashed var(--gray-300); border-radius:14px; padding:40px 20px; text-align:center;">
        <div style="font-size:48px; margin-bottom:12px;"><i data-lucide="calendar" style="width:15px;height:15px;vertical-align:-2px;"></i></div>
        <div style="font-family:var(--font-display); font-size:17px; color:var(--gray-700); margin-bottom:6px;">${aktifEtkinlikFilter === "gecmis" ? "Geçmiş etkinlik yok" : "Etkinlik bulunamadı"}</div>
        <div style="font-size:13px; color:var(--gray-500); margin-bottom:16px;">İlk etkinliğinizi oluşturun</div>
        <button class="btn-primary" onclick="openEtkinlikModal()" style="background:#3b82f6; border:none; color:white;">+ Yeni Etkinlik</button>
      </div>
    `;
    return;
  }

  const kategoriStilleri = {
    gezi:     { ikon: "🚌", label: "Gezi",              renk: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
    kutlama:  { ikon: "🎉", label: "Kutlama",           renk: "#e11d48", bg: "#fff1f2", border: "#fecdd3" },
    toplanti: { ikon: "👥", label: "Veli Toplantısı",   renk: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
    atolye:   { ikon: "🎨", label: "Atölye",            renk: "#9333ea", bg: "#faf5ff", border: "#e9d5ff" },
    diger:    { ikon: "📌", label: "Diğer",             renk: "#6b7280", bg: "#f9fafb", border: "#d1d5db" }
  };

  let html = `<div style="display:flex; flex-direction:column; gap:12px;">`;
  for (const e of liste) {
    const st = kategoriStilleri[e.kategori] || kategoriStilleri.diger;
    const etkinlikTarih = e.tarih ? new Date(e.tarih) : null;
    const gecmisMi = etkinlikTarih && etkinlikTarih < bugun;
    const buGunMu = etkinlikTarih && isoTarih(etkinlikTarih) === isoTarih(bugun);
    const hedefLabel = e.hedefTur === "tumOkul" ? "🏫 Tüm Okul" : `👥 ${escapeHtml(e.hedefDeger)}`;

    const tarihStr = etkinlikTarih ? etkinlikTarih.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Tarih yok";
    const saatStr = e.baslangicSaat ? (e.bitisSaat ? `${e.baslangicSaat} - ${e.bitisSaat}` : e.baslangicSaat) : "";

    html += `
      <div style="background:white; border:1px solid ${st.border}; border-left:4px solid ${st.renk}; border-radius:12px; padding:16px 20px; ${gecmisMi ? 'opacity:0.7;' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:12px;">
          <div style="flex:1; min-width:220px;">
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
              <span style="background:${st.bg}; border:1px solid ${st.border}; color:${st.renk}; padding:3px 10px; border-radius:8px; font-size:11px; font-weight:700;">${st.ikon} ${st.label}</span>
              <span style="background:#f3f4f6; color:var(--gray-700); padding:3px 10px; border-radius:8px; font-size:11px; font-weight:600;">${hedefLabel}</span>
              ${buGunMu ? '<span style="background:#fef9c3; border:1px solid #fde68a; color:#78350f; padding:3px 10px; border-radius:8px; font-size:11px; font-weight:700;"><i data-lucide="map-pin" style="width:13px;height:13px;vertical-align:-2px;"></i> BUGÜN</span>' : ''}
              ${gecmisMi ? '<span style="background:#f3f4f6; color:var(--gray-500); padding:3px 10px; border-radius:8px; font-size:11px; font-weight:600;">⏮ Geçmiş</span>' : ''}
            </div>
            <div style="font-family:var(--font-display); font-size:17px; font-weight:700; color:var(--gray-800);">${escapeHtml(e.baslik)}</div>
            <div style="font-size:13px; color:var(--gray-600); margin-top:6px;">
              📅 ${tarihStr}${saatStr ? ' · ⏰ ' + saatStr : ''}
              ${e.konum ? '<br>📍 ' + escapeHtml(e.konum) : ''}
            </div>
            ${e.aciklama ? `<div style="font-size:13px; color:var(--gray-700); line-height:1.6; margin-top:8px; padding-top:8px; border-top:1px dashed var(--gray-200); white-space:pre-wrap;">${escapeHtml(e.aciklama)}</div>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:12px; padding-top:10px; border-top:1px dashed var(--gray-200);">
          <button onclick="duzenleEtkinlik('${e.id}')" style="padding:6px 12px; background:white; border:1px solid var(--gray-300); color:var(--gray-700); border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;"><i data-lucide="pencil" style="width:14px;height:14px;vertical-align:-2px;"></i> Düzenle</button>
          <button onclick="silEtkinlikHizli('${e.id}')" style="padding:6px 12px; background:white; border:1px solid #fecaca; color:#991b1b; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; margin-left:auto;"><i data-lucide="trash-2" style="width:14px;height:14px;vertical-align:-2px;"></i> Sil</button>
        </div>
      </div>
    `;
  }
  html += `</div>`;
  el.innerHTML = html;
}

window.openEtkinlikModal = function() {
  document.getElementById("etkinlikModal").classList.add("active");
  document.getElementById("etkinlikModalBaslik").innerHTML = `📅 Yeni Etkinlik`; window.lucideYenile && window.lucideYenile();
  document.getElementById("etkinlikDuzenleId").value = "";
  document.getElementById("etkinlikBaslik").value = "";
  document.getElementById("etkinlikKategori").value = "gezi";
  document.getElementById("etkinlikHedefTur").value = "tumOkul";
  document.getElementById("etkinlikHedefSinif").value = "";
  document.getElementById("etkinlikTarih").value = "";
  document.getElementById("etkinlikBaslangicSaat").value = "";
  document.getElementById("etkinlikBitisSaat").value = "";
  document.getElementById("etkinlikKonum").value = "";
  document.getElementById("etkinlikAciklama").value = "";
  document.getElementById("etkinlikMailGonder").checked = false;
  document.getElementById("etkinlikSilBtn").style.display = "none";
  etkinlikHedefDegisti();
};

window.closeEtkinlikModal = function() {
  document.getElementById("etkinlikModal").classList.remove("active");
};

window.etkinlikHedefDegisti = function() {
  const h = document.getElementById("etkinlikHedefTur").value;
  document.getElementById("etkinlikHedefSinifWrap").style.display = h === "sinif" ? "block" : "none";
};

window.duzenleEtkinlik = function(id) {
  const e = etkinlikListesi.find(x => x.id === id);
  if (!e) return;
  openEtkinlikModal();
  document.getElementById("etkinlikModalBaslik").textContent = "✏️ Etkinliği Düzenle";
  document.getElementById("etkinlikDuzenleId").value = id;
  document.getElementById("etkinlikBaslik").value = e.baslik || "";
  document.getElementById("etkinlikKategori").value = e.kategori || "gezi";
  document.getElementById("etkinlikHedefTur").value = e.hedefTur || "tumOkul";
  if (e.hedefTur === "sinif") document.getElementById("etkinlikHedefSinif").value = e.hedefDeger || "";
  document.getElementById("etkinlikTarih").value = e.tarih || "";
  document.getElementById("etkinlikBaslangicSaat").value = e.baslangicSaat || "";
  document.getElementById("etkinlikBitisSaat").value = e.bitisSaat || "";
  document.getElementById("etkinlikKonum").value = e.konum || "";
  document.getElementById("etkinlikAciklama").value = e.aciklama || "";
  document.getElementById("etkinlikMailGonder").checked = false;
  document.getElementById("etkinlikSilBtn").style.display = "inline-block";
  etkinlikHedefDegisti();
};

window.kaydetEtkinlik = async function() {
  const id = document.getElementById("etkinlikDuzenleId").value;
  const baslik = document.getElementById("etkinlikBaslik").value.trim();
  const kategori = document.getElementById("etkinlikKategori").value;
  const hedefTur = document.getElementById("etkinlikHedefTur").value;
  const tarih = document.getElementById("etkinlikTarih").value;
  const baslangicSaat = document.getElementById("etkinlikBaslangicSaat").value;
  const bitisSaat = document.getElementById("etkinlikBitisSaat").value;
  const konum = document.getElementById("etkinlikKonum").value.trim();
  const aciklama = document.getElementById("etkinlikAciklama").value.trim();
  const mailGonder = document.getElementById("etkinlikMailGonder").checked;

  if (!baslik) return showToast("Başlık zorunlu", "error");
  if (!tarih) return showToast("Tarih seçin", "error");

  let hedefDeger = "";
  if (hedefTur === "sinif") {
    hedefDeger = document.getElementById("etkinlikHedefSinif").value;
    if (!hedefDeger) return showToast("Sınıf seçin", "error");
  }

  const data = {
    baslik, kategori, hedefTur, hedefDeger,
    tarih, baslangicSaat, bitisSaat, konum, aciklama,
    guncellendi: new Date().toISOString(),
    guncelleyen: B.kullanici().email
  };

  try {
    if (id) {
      await updateDoc(doc(db, "etkinlikler", id), data);
      showToast("✓ Etkinlik güncellendi");
    } else {
      data.olusturuldu = new Date().toISOString();
      data.olusturan = B.kullanici().email;
      const ref = doc(collection(db, "etkinlikler"));
      await setDoc(ref, data);
      if (mailGonder) etkinlikMailGonder(data);
      showToast("✓ Etkinlik oluşturuldu");
    }
    closeEtkinlikModal();
    renderEtkinlikler();
  } catch (e) {
    showToast("Kaydedilemedi: " + e.message, "error");
  }
};

async function etkinlikMailGonder(data) {
  try {
    const kategoriLabels = { gezi: "🚌 Gezi", kutlama: "🎉 Kutlama", toplanti: "👥 Veli Toplantısı", atolye: "🎨 Atölye", diger: "📌 Etkinlik" };
    const hedefMailler = [];
    for (const o of B.ogrenciler()) {
      if (getOgrenciDurum(o, B.ayarlar()[o.id]) !== "aktif") continue;
      const ayar = B.ayarlar()[o.id] || {};
      const ogrSinif = (ayar.kayit?.sinif) || o.sinif || "";
      let dahil = false;
      if (data.hedefTur === "tumOkul") dahil = true;
      else if (data.hedefTur === "sinif" && ogrSinif === data.hedefDeger) dahil = true;
      if (!dahil) continue;
      const anne = ayar.anne || {};
      const baba = ayar.baba || {};
      if (anne.eposta) hedefMailler.push({ mail: anne.eposta, ad: anne.adSoyad || "Anne" });
      if (baba.eposta) hedefMailler.push({ mail: baba.eposta, ad: baba.adSoyad || "Baba" });
    }
    if (hedefMailler.length === 0) return;

    const tarihStr = new Date(data.tarih).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const saatStr = data.baslangicSaat ? (data.bitisSaat ? `${data.baslangicSaat} - ${data.bitisSaat}` : data.baslangicSaat) : "";

    for (const v of hedefMailler) {
      const icerik = `
        <p style="margin:0 0 14px; font-size:15px;">Sayın <strong>${escapeHtml(v.ad)}</strong>,</p>
        <div style="background:#eff6ff; border-left:4px solid #3b82f6; border-radius:8px; padding:18px 22px; margin:16px 0;">
          <div style="font-size:12px; font-weight:700; color:#1e40af; letter-spacing:0.5px; margin-bottom:8px;">${kategoriLabels[data.kategori] || '<i data-lucide="calendar" style="width:13px;height:13px;vertical-align:-2px;"></i> Etkinlik'}</div>
          <h3 style="margin:0 0 10px; color:var(--gray-800); font-size:20px;">${escapeHtml(data.baslik)}</h3>
          <div style="font-size:14px; color:#374151; line-height:1.8;">
            📅 <strong>${tarihStr}</strong>${saatStr ? '<br>⏰ ' + saatStr : ''}
            ${data.konum ? '<br>📍 ' + escapeHtml(data.konum) : ''}
          </div>
          ${data.aciklama ? `<div style="font-size:13px; color:#4b5563; line-height:1.7; margin-top:12px; padding-top:10px; border-top:1px dashed #bfdbfe; white-space:pre-wrap;">${escapeHtml(data.aciklama)}</div>` : ''}
        </div>
        <p style="margin:20px 0 0; font-size:13px; color:#374151;">Saygılarımızla,<br><strong>Bir Çiçek Koleji Anaokulu</strong></p>
      `;
      await brevoMail({ to: v.mail, toName: v.ad, subject: `📅 ${data.baslik} - Bir Çiçek Koleji`, htmlContent: portalMailSablon(data.baslik, icerik, "Etkinlik duyurusu") });
      await new Promise(r => setTimeout(r, 300));
    }
    showToast(`📧 ${hedefMailler.length} veliye mail gönderildi`);
  } catch (e) { console.warn("Etkinlik maili hatası:", e); }
}

window.silEtkinlik = async function() {
  const id = document.getElementById("etkinlikDuzenleId").value;
  if (!id) return;
  if (!confirm("Bu etkinliği silmek istediğinize emin misiniz?")) return;
  try {
    await deleteDoc(doc(db, "etkinlikler", id));
    showToast("✗ Etkinlik silindi");
    closeEtkinlikModal();
    renderEtkinlikler();
  } catch (e) { showToast("Silinemedi: " + e.message, "error"); }
};

window.silEtkinlikHizli = async function(id) {
  if (!confirm("Bu etkinliği silmek istediğinize emin misiniz?")) return;
  try {
    await deleteDoc(doc(db, "etkinlikler", id));
    showToast("✗ Silindi");
    renderEtkinlikler();
  } catch (e) { showToast("Silinemedi: " + e.message, "error"); }
};

// ── Çekirdeğin erişimi için ──
window.loadEtkinlikler   = loadEtkinlikler;
window.renderEtkinlikler = renderEtkinlikler;
console.log("Etkinlik Takvimi modülü yüklendi.");
