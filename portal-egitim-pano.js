// ══════════════════════════════════════════════════════════════════════════
// PORTAL · YÖNETİM EĞİTİM PANOSU
// ──────────────────────────────────────────────────────────────────────────
// Sınıf × Program ısı haritası. Tüm aktif öğrencilerin gelişim kayıtlarını
// okur, sınıf ve program bazında ortalama tamamlanma yüzdesi gösterir.
// Veri kaynağı: PortalData.egitimPanoVerisi()  (ZEKY ile birebir aynı)
//
// MALİYET UYARISI: öğrenci sayısı kadar Firestore okuması yapar (68 öğrenci
// ≈ 68 okuma). Bu yüzden OTOMATİK ÇALIŞMAZ — kullanıcı butona basınca yüklenir,
// sonuç oturum boyunca bellekte tutulur.
//
// Faz 2 · 2026-08-10 · PORTAL-ZEKY-SENKRON-YOL-HARITASI.md
// ══════════════════════════════════════════════════════════════════════════

const B = window.BCK;

let panoVeri = null;      // bellekte tutulan son sonuç
let panoYukleniyor = false;

// Yüzdeye göre ısı rengi (portal paleti)
function isiRengi(v) {
  if (v == null) return { bg: "#f3f4f6", yazi: "#9ca3af", kenar: "#e5e7eb" };
  if (v >= 80)   return { bg: "#2D5E3E", yazi: "#ffffff", kenar: "#2D5E3E" };
  if (v >= 60)   return { bg: "#4A7C59", yazi: "#ffffff", kenar: "#4A7C59" };
  if (v >= 40)   return { bg: "#7CB97C", yazi: "#1f3d2a", kenar: "#7CB97C" };
  if (v >= 20)   return { bg: "#F9E9B8", yazi: "#7a5c00", kenar: "#f0dc9a" };
  return           { bg: "#F6D5DC", yazi: "#9b2c3c", kenar: "#eebcc6" };
}

function kutu(baslik, deger, altMetin, ikon) {
  return `
    <div style="flex:1; min-width:150px; background:white; border:1px solid #e5e7eb; border-radius:14px; padding:16px 18px;">
      <div style="display:flex; align-items:center; gap:7px; font-size:11px; font-weight:700; letter-spacing:.06em; color:#6b7280; text-transform:uppercase;">
        <i data-lucide="${ikon}" style="width:14px;height:14px;"></i> ${baslik}
      </div>
      <div style="font-family:var(--font-display); font-size:28px; font-weight:600; color:var(--green-deep); margin-top:6px; line-height:1.1;">${deger}</div>
      ${altMetin ? `<div style="font-size:11px; color:#9ca3af; margin-top:3px;">${altMetin}</div>` : ""}
    </div>`;
}

function panoRender() {
  const el = document.getElementById("egitimPanoIcerik");
  if (!el || !panoVeri) return;
  const d = panoVeri;

  const disiplinBaslik = d.disiplinler.map(x => {
    const bil = window.PortalData.disiplinBilgisi(x);
    return `<th style="padding:10px 8px; font-size:11px; font-weight:700; color:${bil.renk}; text-align:center; white-space:nowrap;">
      <i data-lucide="${bil.ikon}" style="width:14px;height:14px;vertical-align:-3px;"></i><br>${bil.ad}
    </th>`;
  }).join("");

  const satirlar = d.siniflar.map(s => {
    const hucreler = d.disiplinler.map(x => {
      const v = s.degerler[x];
      const r = isiRengi(v);
      return `<td style="padding:6px 5px; text-align:center;">
        <div style="background:${r.bg}; color:${r.yazi}; border:1px solid ${r.kenar}; border-radius:9px; padding:9px 4px; font-size:14px; font-weight:700;">
          ${v == null ? "—" : "%" + v}
        </div></td>`;
    }).join("");
    const ro = isiRengi(s.ortalama);
    return `<tr>
      <td style="padding:6px 12px 6px 4px; font-size:13px; font-weight:600; color:#374151; white-space:nowrap;">
        ${B.escapeHtml(s.ad)}
        <span style="display:block; font-size:11px; color:#9ca3af; font-weight:400;">${s.ogrenciSayisi} öğrenci · ${s.asama} aşama</span>
      </td>
      ${hucreler}
      <td style="padding:6px 5px 6px 12px; text-align:center; border-left:2px solid #e5e7eb;">
        <div style="background:${ro.bg}; color:${ro.yazi}; border:1px solid ${ro.kenar}; border-radius:9px; padding:9px 6px; font-size:14px; font-weight:700;">%${s.ortalama}</div>
      </td>
    </tr>`;
  }).join("");

  const dikkatHtml = d.dikkat.length ? d.dikkat.map(u => {
    const kayitsiz = u.tip === "kayitsiz";
    return `<div style="display:flex; align-items:flex-start; gap:10px; background:${kayitsiz ? "#fffbeb" : "#fef2f2"}; border-left:3px solid ${kayitsiz ? "#d97706" : "#dc2626"}; border-radius:9px; padding:11px 14px;">
      <i data-lucide="${kayitsiz ? "clock-alert" : "trending-down"}" style="width:16px;height:16px;color:${kayitsiz ? "#d97706" : "#dc2626"}; flex-shrink:0; margin-top:1px;"></i>
      <div>
        <div style="font-size:13px; font-weight:600; color:#374151;">${B.escapeHtml(u.baslik)}</div>
        <div style="font-size:12px; color:#6b7280; margin-top:2px;">${B.escapeHtml(u.metin)}</div>
      </div>
    </div>`;
  }).join("") : `<div style="font-size:13px; color:#6b7280; padding:14px; background:#f0fdf4; border-radius:9px; border-left:3px solid #16a34a;">
      <i data-lucide="check-circle" style="width:15px;height:15px;vertical-align:-3px;color:#16a34a;"></i>
      Şu an dikkat gerektiren bir durum görünmüyor.
    </div>`;

  el.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:18px;">
      ${kutu("Genel Ortalama", "%" + d.genelOrtalama, "tüm sınıf ve programlar", "gauge")}
      ${kutu("Öğrenci", d.ogrenciSayisi, d.sinifSayisi + " sınıfta", "users")}
      ${kutu("Kazanım", d.toplamKazanim, "ustalaşılan toplam", "check-check")}
      ${kutu("Aşama", d.toplamAsama, "tamamlanan alan", "award")}
    </div>

    <div style="background:white; border:1px solid #e5e7eb; border-radius:14px; padding:16px 18px; margin-bottom:18px; overflow-x:auto;">
      <div style="font-size:13px; font-weight:700; color:#374151; margin-bottom:12px;">
        <i data-lucide="grid-3x3" style="width:15px;height:15px;vertical-align:-3px;"></i> Sınıf × Program Isı Haritası
      </div>
      <table style="width:100%; border-collapse:collapse; min-width:620px;">
        <thead><tr style="border-bottom:2px solid #e5e7eb;">
          <th style="padding:10px 4px; text-align:left; font-size:11px; font-weight:700; color:#6b7280;">SINIF</th>
          ${disiplinBaslik}
          <th style="padding:10px 8px; font-size:11px; font-weight:700; color:var(--green-deep); text-align:center; border-left:2px solid #e5e7eb;">ORT.</th>
        </tr></thead>
        <tbody>${satirlar}</tbody>
      </table>
      <div style="display:flex; gap:14px; flex-wrap:wrap; margin-top:14px; padding-top:12px; border-top:1px solid #f3f4f6; font-size:11px; color:#6b7280; align-items:center;">
        <span style="font-weight:600;">Renk skalası:</span>
        ${[[0,"%0–19"],[20,"%20–39"],[40,"%40–59"],[60,"%60–79"],[80,"%80+"]].map(([v,l]) => {
          const r = isiRengi(v);
          return `<span style="display:inline-flex; align-items:center; gap:5px;">
            <span style="width:16px; height:16px; border-radius:5px; background:${r.bg}; border:1px solid ${r.kenar}; display:inline-block;"></span>${l}</span>`;
        }).join("")}
        <span style="display:inline-flex; align-items:center; gap:5px;">
          <span style="width:16px; height:16px; border-radius:5px; background:#f3f4f6; border:1px solid #e5e7eb; display:inline-block;"></span>veri yok</span>
      </div>
    </div>

    <div style="background:white; border:1px solid #e5e7eb; border-radius:14px; padding:16px 18px;">
      <div style="font-size:13px; font-weight:700; color:#374151; margin-bottom:12px;">
        <i data-lucide="bell-ring" style="width:15px;height:15px;vertical-align:-3px;"></i> Dikkat Edilmesi Gerekenler
      </div>
      <div style="display:flex; flex-direction:column; gap:9px;">${dikkatHtml}</div>
    </div>

    <div style="text-align:right; margin-top:12px;">
      <span style="font-size:11px; color:#9ca3af;">Yüzdeler her öğrencinin <strong>ustalaştığı</strong> kazanım oranının sınıf ortalamasıdır.</span>
    </div>
  `;
  window.lucideYenile && window.lucideYenile();
}

// ── Panoyu yükle (butonla tetiklenir) ─────────────────────────────────────
window.egitimPanoYukle = async function(zorla = false) {
  if (panoYukleniyor) return;
  if (panoVeri && !zorla) { panoRender(); return; }

  if (!window.PortalData?.egitimPanoVerisi) {
    window.showToast && window.showToast("Veri katmanı yüklenmedi (portal-data.js)", "error");
    return;
  }

  const el = document.getElementById("egitimPanoIcerik");
  panoYukleniyor = true;
  if (el) el.innerHTML = `<div style="padding:44px; text-align:center; color:#9ca3af; font-size:13px;">
      <i data-lucide="loader" style="width:22px;height:22px;"></i><br><br>
      Tüm sınıfların gelişim kayıtları okunuyor…<br>
      <span style="font-size:11px;">(öğrenci sayısına göre birkaç saniye sürebilir)</span>
    </div>`;
  window.lucideYenile && window.lucideYenile();

  try {
    panoVeri = await window.PortalData.egitimPanoVerisi();
    panoRender();
  } catch (e) {
    console.error("Eğitim panosu:", e);
    if (el) el.innerHTML = `<div style="padding:30px; text-align:center; color:#dc2626; font-size:13px;">
      Pano yüklenemedi: ${B.escapeHtml(e.message || String(e))}</div>`;
  } finally {
    panoYukleniyor = false;
  }
};

// Panoyu aç/kapat
window.egitimPanoToggle = function() {
  const wrap = document.getElementById("egitimPanoIcerik");
  const btn = document.getElementById("egitimPanoBtn");
  if (!wrap) return;
  const acik = wrap.style.display !== "none";
  if (acik) {
    wrap.style.display = "none";
    if (btn) btn.innerHTML = `<i data-lucide="layout-dashboard" style="width:14px;height:14px;vertical-align:-2px;"></i> Eğitim Panosunu Aç`;
  } else {
    wrap.style.display = "block";
    if (btn) btn.innerHTML = `<i data-lucide="chevron-up" style="width:14px;height:14px;vertical-align:-2px;"></i> Panoyu Gizle`;
    window.egitimPanoYukle();
  }
  window.lucideYenile && window.lucideYenile();
};

// ── Görünürlük: yalnızca yönetim rolleri ──────────────────────────────────
// NOT: "bck-cekirdek-hazir" olayına bağlanılamaz — o olay bu modül yüklenmeden
// ÖNCE gönderiliyor. Ayrıca rol, Google girişi tamamlanınca (çok daha sonra)
// belli oluyor. Bu yüzden kontrol, Eğitim sekmesi her açıldığında yapılır.
window.egitimPanoGorunurluk = function() {
  const kutu = document.getElementById("egitimPanoKutu");
  if (!kutu) return;
  const rol = (B.rol && B.rol()) || "";
  const gorebilir = ["kurucu_mudur", "mudur", "egitim_koordinator"].includes(rol) ||
                    (B.yoneticiMi && B.yoneticiMi());
  kutu.style.display = gorebilir ? "block" : "none";
  if (gorebilir) window.lucideYenile && window.lucideYenile();
};

console.log("Eğitim Panosu modülü yüklendi.");
