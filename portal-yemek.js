// ══════════════════════════════════════════════════════════════
// PORTAL · YEMEK MENÜSÜ (YÖNETİM) MODÜLÜ
// Faz 9 · index.html'den ayrıştırıldı (2026-08-07)
//
// NOT: Hafta yardımcıları (haftaBaslangic/haftaKodu/haftaEtiketi/
// isoTarih) ve YEMEK_GUNLER/YEMEK_OGUNLER çekirdekte KALDI —
// veli yemek ekranı ve takvim modülü de onları kullanıyor.
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
        escapeHtml, getOgrenciDurum, isoTarih,
        haftaBaslangic, haftaKodu, haftaEtiketi,
        AY_ISIMLERI, YEMEK_GUNLER, YEMEK_OGUNLER } = B;

let aktifYemekHaftaBaslangic = null; // Pazartesi tarihi ISO
let aktifYemekVerisi = null;

window.yemekHaftaDegistir = function(hafta) {
  const d = new Date(aktifYemekHaftaBaslangic || new Date());
  d.setDate(d.getDate() + (hafta * 7));
  aktifYemekHaftaBaslangic = haftaBaslangic(d);
  renderYemekMenusu();
};

window.yemekBuHaftaGit = function() {
  aktifYemekHaftaBaslangic = haftaBaslangic(new Date());
  renderYemekMenusu();
};

async function renderYemekMenusu() {
  const el = document.getElementById("yemekMenusuGorunum");
  if (!el) return;

  if (!aktifYemekHaftaBaslangic) aktifYemekHaftaBaslangic = haftaBaslangic(new Date());

  // Hafta etiketini güncelle
  const hEtiket = document.getElementById("yemekHaftaEtiketi");
  if (hEtiket) hEtiket.textContent = "📅 " + haftaEtiketi(aktifYemekHaftaBaslangic);

  // Firestore'dan bu haftanın menüsünü çek
  const kod = haftaKodu(aktifYemekHaftaBaslangic);
  try {
    const snap = await getDoc(doc(db, "yemekMenuleri", kod));
    aktifYemekVerisi = snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("Menü yüklenemedi:", e);
    aktifYemekVerisi = null;
  }

  // Tablo oluştur
  const pzt = aktifYemekHaftaBaslangic;
  const gunTarihler = [];
  for (let i = 0; i < 5; i++) {
    const t = new Date(pzt);
    t.setDate(pzt.getDate() + i);
    gunTarihler.push(t);
  }

  let html = `<div style="overflow-x:auto;"><table style="width:100%; border-collapse:separate; border-spacing:6px; min-width:700px;">`;

  // Başlık satırı (günler)
  html += `<tr><th style="width:110px;"></th>`;
  for (let i = 0; i < 5; i++) {
    const t = gunTarihler[i];
    const bugunMu = isoTarih(t) === isoTarih(new Date());
    html += `
      <th style="padding:12px; background:${bugunMu ? '#f97316' : 'white'}; color:${bugunMu ? 'white' : '#9a3412'}; border:1px solid #fed7aa; border-radius:10px; font-family:var(--font-display); font-size:13px; text-align:center;">
        <div>${YEMEK_GUNLER[i]}</div>
        <div style="font-size:11px; opacity:0.85; font-weight:400; margin-top:2px;">${t.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</div>
      </th>
    `;
  }
  html += `</tr>`;

  // Öğün satırları
  for (const ogun of YEMEK_OGUNLER) {
    html += `<tr>
      <td style="padding:10px; background:${ogun.renk}; border:1px solid #fde68a; border-radius:10px; font-size:12px; font-weight:700; color:var(--gray-700); text-align:center; font-family:var(--font-display);">${ogun.label}</td>
    `;
    for (let i = 0; i < 5; i++) {
      const gunData = (aktifYemekVerisi?.gunler?.[i] || {})[ogun.key] || {};
      const yemek = gunData.yemek || "";
      const kalori = gunData.kalori || "";
      const alerjen = gunData.alerjen || "";

      html += `
        <td style="padding:12px; background:white; border:1px solid var(--gray-200); border-radius:10px; font-size:12px; color:var(--gray-700); line-height:1.5; vertical-align:top; min-height:80px;">
          ${yemek ? `
            <div style="font-weight:600; color:var(--gray-800); margin-bottom:4px;">${escapeHtml(yemek)}</div>
            ${kalori ? `<div style="font-size:11px; color:#166534;">🔥 ~${escapeHtml(kalori)} kcal</div>` : ''}
            ${alerjen ? `<div style="font-size:11px; color:#991b1b; margin-top:4px;">⚠ ${escapeHtml(alerjen)}</div>` : ''}
          ` : '<div style="color:#9ca3af; font-style:italic; text-align:center; padding:8px;">— boş —</div>'}
        </td>
      `;
    }
    html += `</tr>`;
  }
  html += `</table></div>`;

  // Alt bilgi
  if (!aktifYemekVerisi) {
    html += `<div style="text-align:center; margin-top:20px; padding:20px; background:white; border:2px dashed var(--gray-300); border-radius:12px; font-size:13px; color:var(--gray-600);">
      📭 Bu hafta için menü henüz eklenmemiş. <strong style="color:#f97316; cursor:pointer;" onclick="yemekMenusuDuzenle()">+ Şimdi Ekle</strong>
    </div>`;
  } else if (aktifYemekVerisi.guncellendi) {
    html += `<div style="text-align:right; margin-top:10px; font-size:11px; color:var(--gray-500);">Son güncelleme: ${new Date(aktifYemekVerisi.guncellendi).toLocaleString("tr-TR")}</div>`;
  }

  el.innerHTML = html;
}

// Menü düzenleme modalını aç
window.yemekMenusuDuzenle = function() {
  document.getElementById("yemekModal").classList.add("active");
  document.getElementById("yemekModalBaslik").textContent = `🍽 Menü - ${haftaEtiketi(aktifYemekHaftaBaslangic)}`;

  const tablo = document.getElementById("yemekModalTablo");
  const pzt = aktifYemekHaftaBaslangic;
  const gunTarihler = [];
  for (let i = 0; i < 5; i++) {
    const t = new Date(pzt);
    t.setDate(pzt.getDate() + i);
    gunTarihler.push(t);
  }

  let html = `<div style="display:grid; gap:16px;">`;
  for (let gunIdx = 0; gunIdx < 5; gunIdx++) {
    const t = gunTarihler[gunIdx];
    html += `
      <div style="background:white; border:1px solid var(--gray-200); border-radius:12px; padding:16px;">
        <div style="font-family:var(--font-display); font-size:16px; font-weight:700; color:#9a3412; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #fed7aa;">
          ${YEMEK_GUNLER[gunIdx]} <span style="font-size:12px; color:var(--gray-500); font-weight:400;">${t.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</span>
        </div>
    `;
    for (const ogun of YEMEK_OGUNLER) {
      const gunData = (aktifYemekVerisi?.gunler?.[gunIdx] || {})[ogun.key] || {};
      html += `
        <div style="background:${ogun.renk}; border-radius:10px; padding:12px 14px; margin-bottom:10px;">
          <div style="font-size:12px; font-weight:700; color:var(--gray-700); margin-bottom:8px;">${ogun.label}</div>
          <div style="display:grid; grid-template-columns:2fr 1fr 1.5fr; gap:8px;">
            <input type="text" id="y_${gunIdx}_${ogun.key}_yemek" placeholder="Yemek adı" value="${escapeHtml(gunData.yemek || "")}" style="padding:8px; border:1px solid var(--gray-300); border-radius:8px; font-size:13px;">
            <input type="text" id="y_${gunIdx}_${ogun.key}_kalori" placeholder="Kalori (kcal)" value="${escapeHtml(gunData.kalori || "")}" style="padding:8px; border:1px solid var(--gray-300); border-radius:8px; font-size:13px;">
            <input type="text" id="y_${gunIdx}_${ogun.key}_alerjen" placeholder="Alerjen (ör: süt, buğday)" value="${escapeHtml(gunData.alerjen || "")}" style="padding:8px; border:1px solid var(--gray-300); border-radius:8px; font-size:13px;">
          </div>
        </div>
      `;
    }
    html += `</div>`;
  }
  html += `</div>`;
  tablo.innerHTML = html;
};

window.closeYemekModal = function() {
  document.getElementById("yemekModal").classList.remove("active");
};

window.kaydetYemekMenusu = async function() {
  const gunler = [];
  for (let i = 0; i < 5; i++) {
    const gun = {};
    for (const ogun of YEMEK_OGUNLER) {
      gun[ogun.key] = {
        yemek: (document.getElementById(`y_${i}_${ogun.key}_yemek`).value || "").trim(),
        kalori: (document.getElementById(`y_${i}_${ogun.key}_kalori`).value || "").trim(),
        alerjen: (document.getElementById(`y_${i}_${ogun.key}_alerjen`).value || "").trim()
      };
    }
    gunler.push(gun);
  }

  const kod = haftaKodu(aktifYemekHaftaBaslangic);
  const data = {
    haftaBaslangic: isoTarih(aktifYemekHaftaBaslangic),
    gunler,
    guncellendi: new Date().toISOString(),
    guncelleyen: B.kullanici().email
  };

  try {
    await setDoc(doc(db, "yemekMenuleri", kod), data);
    showToast("✓ Menü kaydedildi");
    closeYemekModal();
    renderYemekMenusu();
  } catch (e) {
    showToast("Kaydedilemedi: " + e.message, "error");
  }
};

// ── Çekirdeğin erişimi için ──
window.renderYemekMenusu = renderYemekMenusu;
console.log("Yemek Menüsü modülü yüklendi.");
