// ══════════════════════════════════════════════════════════════
// PORTAL · DUYURULAR MODÜLÜ
// --------------------------------------------------------------
// Faz 3 · index.html'den ayrıştırıldı (2026-08-05)
// Kaynak: index.html satır 13942-14282 (modül içi numaralandırma)
//
// Bu dosya <script type="module"> olarak, ana modülden SONRA
// yüklenir. Bu sayede window.BCK çekirdek köprüsü hazır olur.
//
// Dışa açılan: duyuruFilter, openDuyuruModal, closeDuyuruModal,
// duyuruHedefDegisti, duzenleDuyuru, kaydetDuyuru, arsivleDuyuru,
// arsivAcDuyuru, silDuyuru, silDuyuruHizli (HTML onclick'ten)
// + loadDuyurular, renderDuyurular (çekirdekten çağrılıyor)
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
        brevoMail, portalMailSablon, escapeHtml, getOgrenciDurum } = B;

let duyuruListesi = [];
window.duyuruListesi = duyuruListesi;   // Hızlı Bakış widget'ı çekirdekten okuyor
let aktifDuyuruFilter = "aktif";

window.duyuruFilter = function(f) {
  aktifDuyuruFilter = f;
  document.querySelectorAll("[data-duyuru-filter]").forEach(b => {
    if (b.dataset.duyuruFilter === f) {
      b.style.background = "#eab308"; b.style.color = "white"; b.style.border = "none";
    } else {
      b.style.background = ""; b.style.color = ""; b.style.border = "";
    }
  });
  renderDuyurular();
};

async function loadDuyurular() {
  try {
    const snap = await getDocs(collection(db, "duyurular"));
    duyuruListesi = window.duyuruListesi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Duyurular yüklenemedi:", e);
    duyuruListesi = window.duyuruListesi = [];
  }
}

async function renderDuyurular() {
  const el = document.getElementById("duyurularListesi");
  if (!el) return;

  await loadDuyurular();

  let liste = [...duyuruListesi];
  if (aktifDuyuruFilter === "aktif") liste = liste.filter(d => !d.arsiv);
  else if (aktifDuyuruFilter === "arsiv") liste = liste.filter(d => d.arsiv);

  liste.sort((a, b) => (b.olusturuldu || "").localeCompare(a.olusturuldu || ""));

  if (liste.length === 0) {
    el.innerHTML = `
      <div style="background:white; border:2px dashed var(--gray-300); border-radius:14px; padding:40px 20px; text-align:center;">
        <div style="font-size:48px; margin-bottom:12px;"><i data-lucide="file-text" style="width:15px;height:15px;vertical-align:-2px;"></i></div>
        <div style="font-family:var(--font-display); font-size:17px; color:var(--gray-700); margin-bottom:6px;">${aktifDuyuruFilter === "arsiv" ? "Arşivde duyuru yok" : "Henüz duyuru yok"}</div>
        <div style="font-size:13px; color:var(--gray-500); margin-bottom:16px;">Velilerinize ilk duyurunuzu gönderin</div>
        <button class="btn-primary" onclick="openDuyuruModal()" style="background:#eab308; border:none; color:white;">+ Yeni Duyuru Oluştur</button>
      </div>
    `;
    return;
  }

  const aciliyetStilleri = {
    normal: { bg: "#fef9c3", border: "#fde68a", text: "#78350f", ikon: "📢", label: "Normal" },
    onemli: { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412", ikon: "⚠️", label: "Önemli" },
    acil: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", ikon: "🚨", label: "Acil" }
  };

  let html = `<div style="display:flex; flex-direction:column; gap:12px;">`;
  for (const d of liste) {
    const st = aciliyetStilleri[d.aciliyet] || aciliyetStilleri.normal;
    const hedefLabel = d.hedefTur === "tumOkul" ? "🏫 Tüm Okul"
      : d.hedefTur === "sinif" ? `👥 ${escapeHtml(d.hedefDeger)}`
      : `👤 ${escapeHtml(d.hedefOgrenciAd || d.hedefDeger)}`;
    const tarih = d.olusturuldu ? new Date(d.olusturuldu).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const okunmaSayisi = (d.okuyanVeliler || []).length;
    const mailIkon = d.mailGonder ? '<span title="E-posta gönderildi" style="font-size:13px;">📧</span>' : '';
    const simsekRozet = d.simsek ? '<span title="Şimşek Duyuru - velilere popup olarak gösteriliyor" style="background:#fef3c7; border:1px solid #fde68a; color:#92400e; padding:3px 10px; border-radius:8px; font-size:11px; font-weight:700;">⚡ Şimşek</span>' : '';
    const popupKapatanSayi = (d.popupKapatanVeliler || []).length;
    const simsekDurum = d.simsek && popupKapatanSayi > 0 ? `<span title="${popupKapatanSayi} veli popup'ı kapattı" style="font-size:11px; color:#92400e;">⚡ ${popupKapatanSayi} kapadı</span>` : '';

    html += `
      <div style="background:white; border:1px solid ${st.border}; border-left:4px solid ${st.text}; border-radius:12px; padding:16px 20px; ${d.arsiv ? 'opacity:0.65;' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
          <div style="flex:1; min-width:200px;">
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:4px;">
              <span style="background:${st.bg}; border:1px solid ${st.border}; color:${st.text}; padding:3px 10px; border-radius:8px; font-size:11px; font-weight:700;">${st.ikon} ${st.label}</span>
              <span style="background:#f3f4f6; color:var(--gray-700); padding:3px 10px; border-radius:8px; font-size:11px; font-weight:600;">${hedefLabel}</span>
              ${simsekRozet}
              ${mailIkon}
              ${d.arsiv ? '<span style="background:#f3f4f6; color:var(--gray-500); padding:3px 10px; border-radius:8px; font-size:11px; font-weight:600;"><i data-lucide="package" style="width:13px;height:13px;vertical-align:-2px;"></i> Arşiv</span>' : ''}
            </div>
            <div style="font-family:var(--font-display); font-size:16px; font-weight:700; color:var(--gray-800); margin-top:6px;">${escapeHtml(d.baslik)}</div>
          </div>
          <div style="text-align:right; font-size:11px; color:var(--gray-500);">
            ${tarih}<br>
            <span title="${okunmaSayisi} veli okudu" style="color:#2d6a4f;">👁 ${okunmaSayisi}</span>
            ${simsekDurum ? '<br>' + simsekDurum : ''}
          </div>
        </div>
        <div style="font-size:13px; color:var(--gray-700); line-height:1.7; margin-top:8px; white-space:pre-wrap;">${escapeHtml(d.icerik).replace(/\n/g, '<br>').replace(/&lt;a href=&quot;([^&]+)&quot;&gt;([^&]+)&lt;\/a&gt;/g, '<a href="$1" target="_blank" style="color:#2d6a4f;">$2</a>')}</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:12px; padding-top:10px; border-top:1px dashed var(--gray-200);">
          <button onclick="duzenleDuyuru('${d.id}')" style="padding:6px 12px; background:white; border:1px solid var(--gray-300); color:var(--gray-700); border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;"><i data-lucide="pencil" style="width:14px;height:14px;vertical-align:-2px;"></i> Düzenle</button>
          ${!d.arsiv ? `<button onclick="arsivleDuyuru('${d.id}')" style="padding:6px 12px; background:white; border:1px solid var(--gray-300); color:var(--gray-700); border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;"><i data-lucide="package" style="width:13px;height:13px;vertical-align:-2px;"></i> Arşivle</button>` : `<button onclick="arsivAcDuyuru('${d.id}')" style="padding:6px 12px; background:white; border:1px solid var(--gray-300); color:var(--gray-700); border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;">📤 Arşivden Çıkar</button>`}
          <button onclick="silDuyuruHizli('${d.id}')" style="padding:6px 12px; background:white; border:1px solid #fecaca; color:#991b1b; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; margin-left:auto;"><i data-lucide="trash-2" style="width:14px;height:14px;vertical-align:-2px;"></i> Sil</button>
        </div>
      </div>
    `;
  }
  html += `</div>`;
  el.innerHTML = html;
}

// Modal aç
window.openDuyuruModal = function() {
  document.getElementById("duyuruModal").classList.add("active");
  document.getElementById("duyuruModalBaslik").innerHTML = `📝 Yeni Duyuru`; window.lucideYenile && window.lucideYenile();
  document.getElementById("duyuruDuzenleId").value = "";
  document.getElementById("duyuruBaslik").value = "";
  document.getElementById("duyuruIcerik").value = "";
  document.getElementById("duyuruAciliyet").value = "normali";
  document.getElementById("duyuruAciliyet").value = "normal";
  document.getElementById("duyuruHedefTur").value = "tumOkul";
  document.getElementById("duyuruHedefSinif").value = "";
  document.getElementById("duyuruMailGonder").checked = true;
  document.getElementById("duyuruSimsek").checked = false;
  document.getElementById("duyuruSilBtn").style.display = "none";
  duyuruHedefDegisti();
  doldurOgrenciSecici();
};

window.closeDuyuruModal = function() {
  document.getElementById("duyuruModal").classList.remove("active");
};

// Hedef türü değiştiğinde alt alan göster/gizle
window.duyuruHedefDegisti = function() {
  const hedef = document.getElementById("duyuruHedefTur").value;
  document.getElementById("duyuruHedefSinifWrap").style.display = hedef === "sinif" ? "block" : "none";
  document.getElementById("duyuruHedefOgrenciWrap").style.display = hedef === "ogrenci" ? "block" : "none";
};

// Öğrenci seçici doldur
function doldurOgrenciSecici() {
  const sel = document.getElementById("duyuruHedefOgrenci");
  if (!sel) return;
  const aktif = B.ogrenciler().filter(o => getOgrenciDurum(o, B.ayarlar()[o.id]) === "aktif");
  aktif.sort((a, b) => (a.ogrenciAdSoyad || "").localeCompare(b.ogrenciAdSoyad || ""));
  sel.innerHTML = '<option value="">-- Öğrenci Seçin --</option>';
  for (const o of aktif) {
    const sinif = (B.ayarlar()[o.id]?.kayit?.sinif) || o.sinif || "";
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = `${o.ogrenciAdSoyad || ""}${sinif ? ` (${sinif})` : ""}`;
    opt.dataset.ad = o.ogrenciAdSoyad || "";
    sel.appendChild(opt);
  }
}

// Düzenle
window.duzenleDuyuru = function(id) {
  const d = duyuruListesi.find(x => x.id === id);
  if (!d) return;
  openDuyuruModal();
  document.getElementById("duyuruModalBaslik").textContent = "✏️ Duyuruyu Düzenle";
  document.getElementById("duyuruDuzenleId").value = id;
  document.getElementById("duyuruBaslik").value = d.baslik || "";
  document.getElementById("duyuruIcerik").value = d.icerik || "";
  document.getElementById("duyuruAciliyet").value = d.aciliyet || "normal";
  document.getElementById("duyuruHedefTur").value = d.hedefTur || "tumOkul";
  if (d.hedefTur === "sinif") document.getElementById("duyuruHedefSinif").value = d.hedefDeger || "";
  if (d.hedefTur === "ogrenci") document.getElementById("duyuruHedefOgrenci").value = d.hedefDeger || "";
  document.getElementById("duyuruMailGonder").checked = false; // Düzenlemede mail yeniden gönderilmez
  document.getElementById("duyuruSimsek").checked = !!d.simsek;
  document.getElementById("duyuruSilBtn").style.display = "inline-block";
  duyuruHedefDegisti();
};

// Kaydet / Yayınla
window.kaydetDuyuru = async function() {
  const id = document.getElementById("duyuruDuzenleId").value;
  const baslik = document.getElementById("duyuruBaslik").value.trim();
  const icerik = document.getElementById("duyuruIcerik").value.trim();
  const aciliyet = document.getElementById("duyuruAciliyet").value;
  const hedefTur = document.getElementById("duyuruHedefTur").value;
  const mailGonder = document.getElementById("duyuruMailGonder").checked;
  const simsek = document.getElementById("duyuruSimsek").checked;

  if (!baslik) return showToast("Başlık zorunlu", "error");
  if (!icerik) return showToast("İçerik zorunlu", "error");

  let hedefDeger = "";
  let hedefOgrenciAd = "";
  if (hedefTur === "sinif") {
    hedefDeger = document.getElementById("duyuruHedefSinif").value;
    if (!hedefDeger) return showToast("Sınıf seçin", "error");
  } else if (hedefTur === "ogrenci") {
    hedefDeger = document.getElementById("duyuruHedefOgrenci").value;
    if (!hedefDeger) return showToast("Öğrenci seçin", "error");
    const sel = document.getElementById("duyuruHedefOgrenci");
    hedefOgrenciAd = sel.options[sel.selectedIndex]?.dataset?.ad || "";
  }

  const data = {
    baslik, icerik, aciliyet, hedefTur, hedefDeger, hedefOgrenciAd,
    mailGonder,
    simsek: !!simsek,
    arsiv: false,
    olusturan: B.kullanici().email,
    guncellendi: new Date().toISOString()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "duyurular", id), data);
      showToast("✓ Duyuru güncellendi");
    } else {
      data.olusturuldu = new Date().toISOString();
      data.okuyanVeliler = [];
      data.popupKapatanVeliler = [];
      const ref = doc(collection(db, "duyurular"));
      await setDoc(ref, data);

      // Mail gönderimi
      if (mailGonder) {
        duyuruMailGonder(data);
      }
      showToast("✓ Duyuru yayınlandı");
    }
    closeDuyuruModal();
    renderDuyurular();
  } catch (e) {
    showToast("Kaydedilemedi: " + e.message, "error");
  }
};

// Hedef velilere mail gönder (arka planda)
async function duyuruMailGonder(data) {
  try {
    // Hedef velilerin mail adreslerini topla
    const hedefMailler = [];
    for (const o of B.ogrenciler()) {
      if (getOgrenciDurum(o, B.ayarlar()[o.id]) !== "aktif") continue;

      const ayar = B.ayarlar()[o.id] || {};
      const ogrSinif = (ayar.kayit?.sinif) || o.sinif || "";

      let dahil = false;
      if (data.hedefTur === "tumOkul") dahil = true;
      else if (data.hedefTur === "sinif" && ogrSinif === data.hedefDeger) dahil = true;
      else if (data.hedefTur === "ogrenci" && o.id === data.hedefDeger) dahil = true;

      if (!dahil) continue;

      const anne = ayar.anne || {};
      const baba = ayar.baba || {};
      if (anne.eposta) hedefMailler.push({ mail: anne.eposta, ad: anne.adSoyad || "Anne", ogrAd: o.ogrenciAdSoyad });
      if (baba.eposta) hedefMailler.push({ mail: baba.eposta, ad: baba.adSoyad || "Baba", ogrAd: o.ogrenciAdSoyad });
    }

    if (hedefMailler.length === 0) {
      showToast("⚠ Hedef velilerin mail adresi kayıtlı değil", "info");
      return;
    }

    const aciliyetLabels = { normal: "📢 Duyuru", onemli: "⚠️ Önemli Duyuru", acil: "🚨 Acil Duyuru" };
    const aciliyetRenk = { normal: "#eab308", onemli: "#f59e0b", acil: "#dc2626" };
    const konu = `${aciliyetLabels[data.aciliyet] || '<i data-lucide="megaphone" style="width:13px;height:13px;vertical-align:-2px;"></i> Duyuru'}: ${data.baslik}`;

    // Tek tek gönder (çünkü her velinin adı özelleşmiş olmalı)
    for (const v of hedefMailler) {
      const icerik = `
        <p style="margin:0 0 14px; font-size:15px;">Sayın <strong>${escapeHtml(v.ad)}</strong>,</p>

        <div style="background:${data.aciliyet === 'acil' ? '#fef2f2' : data.aciliyet === 'onemli' ? '#fff7ed' : '#fefce8'}; border-left:4px solid ${aciliyetRenk[data.aciliyet]}; border-radius:8px; padding:16px 20px; margin:16px 0;">
          <div style="font-size:12px; font-weight:700; color:${aciliyetRenk[data.aciliyet]}; letter-spacing:0.5px; margin-bottom:8px;">${aciliyetLabels[data.aciliyet]}</div>
          <h3 style="margin:0 0 10px; color:var(--gray-800); font-size:18px;">${escapeHtml(data.baslik)}</h3>
          <div style="font-size:14px; color:#374151; line-height:1.7; white-space:pre-wrap;">${escapeHtml(data.icerik).replace(/\n/g, '<br>')}</div>
        </div>

        <p style="margin:16px 0 0; font-size:13px; color:#6b7280; line-height:1.7;">
          Bu duyuruyu <strong>portal.bircicekkoleji.com</strong> üzerinden <strong>Bildirimler</strong> sekmesinden de görüntüleyebilirsiniz.
        </p>

        <p style="margin:20px 0 0; font-size:13px; color:#374151;">
          Saygılarımızla,<br>
          <strong>Bir Çiçek Koleji Anaokulu</strong>
        </p>
      `;

      const html = portalMailSablon(data.baslik, icerik, "Bu duyuru okul yönetimi tarafından gönderilmiştir.");

      await brevoMail({
        to: v.mail, toName: v.ad,
        subject: konu,
        htmlContent: html
      });

      // Rate limit için kısa bekleme
      await new Promise(r => setTimeout(r, 300));
    }

    showToast(`📧 ${hedefMailler.length} veliye mail gönderildi`);
  } catch (e) {
    console.warn("Duyuru maili hatası:", e);
  }
}

// Arşivle / Arşivden çıkar
window.arsivleDuyuru = async function(id) {
  try {
    await updateDoc(doc(db, "duyurular", id), { arsiv: true, guncellendi: new Date().toISOString() });
    showToast("✓ Arşivlendi");
    renderDuyurular();
  } catch (e) {
    showToast("Hata: " + e.message, "error");
  }
};

window.arsivAcDuyuru = async function(id) {
  try {
    await updateDoc(doc(db, "duyurular", id), { arsiv: false, guncellendi: new Date().toISOString() });
    showToast("✓ Arşivden çıkarıldı");
    renderDuyurular();
  } catch (e) {
    showToast("Hata: " + e.message, "error");
  }
};

// Sil
window.silDuyuru = async function() {
  const id = document.getElementById("duyuruDuzenleId").value;
  if (!id) return;
  if (!confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
  try {
    await deleteDoc(doc(db, "duyurular", id));
    showToast("✗ Duyuru silindi");
    closeDuyuruModal();
    renderDuyurular();
  } catch (e) {
    showToast("Silinemedi: " + e.message, "error");
  }
};

window.silDuyuruHizli = async function(id) {
  if (!confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
  try {
    await deleteDoc(doc(db, "duyurular", id));
    showToast("✗ Duyuru silindi");
    renderDuyurular();
  } catch (e) {
    showToast("Silinemedi: " + e.message, "error");
  }
};

// ── Çekirdeğin bu modüle erişebilmesi için ──
window.loadDuyurular       = loadDuyurular;
window.renderDuyurular     = renderDuyurular;
window.doldurOgrenciSecici = doldurOgrenciSecici;
console.log("Duyurular modülü yüklendi.");
