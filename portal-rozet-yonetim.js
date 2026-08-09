// ══════════════════════════════════════════════════════════════════════════
// PORTAL · ROZET TANIMLARI YÖNETİMİ
// ──────────────────────────────────────────────────────────────────────────
// rozetTanimlari koleksiyonunu ekrandan düzenlemeyi sağlar.
// Rozet eklemek/değiştirmek artık kod değişikliği gerektirmez.
// Aynı koleksiyonu ZEKY de okur → iki sistem aynı rozetleri gösterir.
//
// Faz 2 · 2026-08-10
// ══════════════════════════════════════════════════════════════════════════

const B = window.BCK;

function yonetimMi() {
  const rol = (B.rol && B.rol()) || "";
  return ["kurucu_mudur", "mudur", "egitim_koordinator"].includes(rol) ||
         (B.yoneticiMi && B.yoneticiMi());
}

// Eğitim sekmesi açıldığında butonu göster/gizle
window.rozetYonetimGorunurluk = function() {
  const el = document.getElementById("rozetYonetimBtnKutu");
  if (!el) return;
  el.style.display = yonetimMi() ? "flex" : "none";
  if (yonetimMi()) window.lucideYenile && window.lucideYenile();
};

// ── LİSTE ─────────────────────────────────────────────────────────────────
window.rozetYonetimAc = async function() {
  const modal = document.getElementById("rozetYonetimModal");
  const govde = document.getElementById("rozetYonetimGovde");
  if (!modal || !govde) return;
  modal.classList.add("active");
  govde.innerHTML = `<div style="padding:34px; text-align:center; color:#9ca3af; font-size:13px;">Yükleniyor…</div>`;
  await window.BCK_ROZET.oku({ zorla: true });
  rozetYonetimListeRender();
};

window.rozetYonetimKapat = function() {
  const m = document.getElementById("rozetYonetimModal");
  if (m) m.classList.remove("active");
};

function rozetYonetimListeRender() {
  const govde = document.getElementById("rozetYonetimGovde");
  if (!govde) return;
  const R = window.BCK_ROZET;
  const tanimlar = R.tanimlar;
  const firestoreDa = R.kaynak === "firestore";

  const uyari = firestoreDa ? "" : `
    <div style="background:#fffbeb; border-left:3px solid #d97706; border-radius:10px; padding:14px 16px; margin-bottom:16px;">
      <div style="font-size:13px; font-weight:600; color:#92400e; margin-bottom:4px;">
        <i data-lucide="alert-triangle" style="width:14px;height:14px;vertical-align:-2px;"></i>
        Tanımlar henüz Firestore'a taşınmadı
      </div>
      <div style="font-size:12px; color:#78350f; line-height:1.6;">
        Şu an rozetler kodun içindeki varsayılan listeden okunuyor. Bu haliyle çalışır,
        ama <strong>ZEKY uygulaması bu rozetleri göremez</strong> ve buradan düzenleyemezsiniz.
        Aşağıdaki butonla tanımları Firestore'a taşıyın — kazanılmış rozetler etkilenmez.
      </div>
      <button class="btn-primary" style="margin-top:12px; font-size:13px;" onclick="rozetTanimlariniTasiTiklandi()">
        <i data-lucide="upload-cloud" style="width:14px;height:14px;vertical-align:-2px;"></i>
        15 rozeti Firestore'a taşı
      </button>
    </div>`;

  const satirlar = tanimlar.map(r => {
    const pasif = r.aktif === false;
    return `
    <div style="display:flex; align-items:center; gap:12px; padding:11px 13px; border:1px solid #e5e7eb; border-radius:11px; margin-bottom:8px; ${pasif ? "opacity:.5;" : ""}">
      <div style="width:34px; height:34px; border-radius:9px; background:${r.renk || "#e5e7eb"}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <i data-lucide="${r.ikon || "award"}" style="width:17px;height:17px;"></i>
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:13px; font-weight:600; color:#374151;">
          ${B.escapeHtml(r.ad || r.kod)}
          ${pasif ? `<span style="font-size:10px; background:#f3f4f6; color:#6b7280; padding:2px 7px; border-radius:20px; margin-left:6px;">PASİF</span>` : ""}
        </div>
        <div style="font-size:11px; color:#9ca3af; margin-top:2px;">
          ${B.escapeHtml(window.BCK_ROZET.kosulMetni(r))}
          <span style="color:#d1d5db;"> · </span>
          <code style="font-size:10px; color:#9ca3af;">${B.escapeHtml(r.kod)}</code>
        </div>
      </div>
      <button class="btn-mini" style="font-size:11px; flex-shrink:0;" onclick="rozetDuzenleAc('${r.kod}')"
        ${firestoreDa ? "" : "disabled title='Önce Firestore\\'a taşıyın'"}>
        <i data-lucide="pencil" style="width:12px;height:12px;vertical-align:-2px;"></i> Düzenle
      </button>
    </div>`;
  }).join("");

  govde.innerHTML = `
    <div style="padding:18px 20px;">
      ${uyari}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="font-size:12px; color:#6b7280;">
          <strong>${tanimlar.length}</strong> rozet tanımlı
          <span style="color:#d1d5db;"> · </span>
          kaynak: <strong>${firestoreDa ? "Firestore" : "kod (varsayılan)"}</strong>
        </div>
        ${firestoreDa ? `<button class="btn-mini" style="font-size:12px;" onclick="rozetDuzenleAc('')">
          <i data-lucide="plus" style="width:13px;height:13px;vertical-align:-2px;"></i> Yeni Rozet
        </button>` : ""}
      </div>
      ${satirlar}
      <div style="font-size:11px; color:#9ca3af; margin-top:14px; line-height:1.6;">
        <i data-lucide="info" style="width:12px;height:12px;vertical-align:-2px;"></i>
        Rozet kodu bir kez belirlenir, sonra <strong>değiştirilmez</strong> — kazanılmış rozetler bu kodla
        saklandığı için kod değişirse geçmiş kaybolur. Bir rozeti kullanımdan kaldırmak için silmek yerine
        <strong>pasife alın</strong>: çocukların kazandığı rozetler durur, yenisi verilmez.
      </div>
    </div>`;
  window.lucideYenile && window.lucideYenile();
}

// ── TAŞIMA ────────────────────────────────────────────────────────────────
window.rozetTanimlariniTasiTiklandi = async function() {
  if (!confirm("15 varsayılan rozet tanımı Firestore'a yazılacak.\n\nKazanılmış rozetler etkilenmez. Devam edilsin mi?")) return;
  try {
    const adet = await window.BCK_ROZET.tasi();
    window.showToast && window.showToast(`✓ ${adet} rozet tanımı Firestore'a taşındı`);
    rozetYonetimListeRender();
  } catch (e) {
    console.error("Rozet taşıma:", e);
    window.showToast && window.showToast("Taşınamadı: " + (e.message || e), "error");
  }
};

// ── DÜZENLEME FORMU ───────────────────────────────────────────────────────
window.rozetDuzenleAc = function(kod) {
  const govde = document.getElementById("rozetYonetimGovde");
  if (!govde) return;
  const yeni = !kod;
  const r = yeni ? { kod: "", ad: "", aciklama: "", ikon: "award", renk: "#7CB97C",
                     olcut: "toplamUzman", disiplin: "", esik: 5, aktif: true, sira: 99 }
                 : window.BCK_ROZET.tanimlar.find(x => x.kod === kod);
  if (!r) return;

  const O = window.BCK_ROZET.OLCUTLER;
  const olcutSecenek = Object.entries(O).map(([k, v]) =>
    `<option value="${k}" ${r.olcut === k ? "selected" : ""}>${v.ad}</option>`).join("");
  const disiplinSecenek = ["montessori", "orman", "ingilizce", "degerler"].map(d => {
    const ad = window.PortalData?.disiplinBilgisi ? window.PortalData.disiplinBilgisi(d).ad : d;
    return `<option value="${d}" ${r.disiplin === d ? "selected" : ""}>${ad}</option>`;
  }).join("");

  govde.innerHTML = `
    <div style="padding:18px 20px;">
      <button class="btn-mini" style="font-size:12px; margin-bottom:16px;" onclick="rozetYonetimListeRender()">
        ← Listeye dön
      </button>

      <label style="display:block; font-size:12px; font-weight:700; color:#374151; margin-bottom:5px;">Rozet Kodu *</label>
      <input type="text" id="rzKod" value="${B.escapeHtml(r.kod)}" ${yeni ? "" : "disabled"}
        placeholder="orn: orman_yolda"
        style="width:100%; padding:10px 13px; border:1px solid #d1d5db; border-radius:10px; font-size:13px; box-sizing:border-box; ${yeni ? "" : "background:#f9fafb; color:#9ca3af;"}">
      <div style="font-size:11px; color:${yeni ? "#d97706" : "#9ca3af"}; margin:5px 0 14px;">
        ${yeni ? "Sonradan DEĞİŞTİRİLEMEZ. Sadece harf, rakam ve alt çizgi kullanın." : "Kod değiştirilemez."}
      </div>

      <label style="display:block; font-size:12px; font-weight:700; color:#374151; margin-bottom:5px;">Rozet Adı *</label>
      <input type="text" id="rzAd" value="${B.escapeHtml(r.ad || "")}" placeholder="Orman Yolunda"
        style="width:100%; padding:10px 13px; border:1px solid #d1d5db; border-radius:10px; font-size:13px; box-sizing:border-box; margin-bottom:14px;">

      <label style="display:block; font-size:12px; font-weight:700; color:#374151; margin-bottom:5px;">Açıklama</label>
      <input type="text" id="rzAciklama" value="${B.escapeHtml(r.aciklama || "")}" placeholder="Veliye görünen kısa metin"
        style="width:100%; padding:10px 13px; border:1px solid #d1d5db; border-radius:10px; font-size:13px; box-sizing:border-box; margin-bottom:14px;">

      <div style="display:flex; gap:12px; margin-bottom:14px;">
        <div style="flex:2;">
          <label style="display:block; font-size:12px; font-weight:700; color:#374151; margin-bottom:5px;">Lucide İkon Adı</label>
          <input type="text" id="rzIkon" value="${B.escapeHtml(r.ikon || "award")}" placeholder="award"
            style="width:100%; padding:10px 13px; border:1px solid #d1d5db; border-radius:10px; font-size:13px; box-sizing:border-box;">
        </div>
        <div style="flex:1;">
          <label style="display:block; font-size:12px; font-weight:700; color:#374151; margin-bottom:5px;">Renk</label>
          <input type="color" id="rzRenk" value="${r.renk || "#7CB97C"}"
            style="width:100%; height:41px; padding:4px; border:1px solid #d1d5db; border-radius:10px; box-sizing:border-box; cursor:pointer;">
        </div>
      </div>

      <div style="background:#f9fafb; border-radius:11px; padding:14px 16px; margin-bottom:16px;">
        <div style="font-size:12px; font-weight:700; color:#374151; margin-bottom:10px;">KOŞUL — bu rozet ne zaman verilsin?</div>

        <label style="display:block; font-size:11px; font-weight:600; color:#6b7280; margin-bottom:4px;">Ölçüt</label>
        <select id="rzOlcut" onchange="rozetOlcutDegisti()"
          style="width:100%; padding:10px 13px; border:1px solid #d1d5db; border-radius:10px; font-size:13px; box-sizing:border-box; margin-bottom:10px; background:white;">
          ${olcutSecenek}
        </select>

        <div id="rzDisiplinKutu" style="display:${r.olcut === "disiplinYuzde" ? "block" : "none"}; margin-bottom:10px;">
          <label style="display:block; font-size:11px; font-weight:600; color:#6b7280; margin-bottom:4px;">Hangi program?</label>
          <select id="rzDisiplin" style="width:100%; padding:10px 13px; border:1px solid #d1d5db; border-radius:10px; font-size:13px; box-sizing:border-box; background:white;">
            ${disiplinSecenek}
          </select>
        </div>

        <label style="display:block; font-size:11px; font-weight:600; color:#6b7280; margin-bottom:4px;">Eşik değer</label>
        <input type="number" id="rzEsik" value="${r.esik ?? 1}" min="1"
          style="width:100%; padding:10px 13px; border:1px solid #d1d5db; border-radius:10px; font-size:13px; box-sizing:border-box;">
        <div id="rzOlcutAciklama" style="font-size:11px; color:#9ca3af; margin-top:6px;"></div>
      </div>

      <div style="display:flex; gap:14px; align-items:center; margin-bottom:18px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:#374151; cursor:pointer;">
          <input type="checkbox" id="rzAktif" ${r.aktif !== false ? "checked" : ""} style="width:17px; height:17px; cursor:pointer;">
          Aktif (pasif rozet yeni kimseye verilmez)
        </label>
        <div style="margin-left:auto; display:flex; align-items:center; gap:7px;">
          <label style="font-size:12px; color:#6b7280;">Sıra</label>
          <input type="number" id="rzSira" value="${r.sira ?? 99}" min="1"
            style="width:70px; padding:8px 10px; border:1px solid #d1d5db; border-radius:9px; font-size:13px; box-sizing:border-box;">
        </div>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button class="btn-mini" onclick="rozetYonetimListeRender()">Vazgeç</button>
        <button class="btn-primary" onclick="rozetTanimKaydetTiklandi()">
          <i data-lucide="save" style="width:14px;height:14px;vertical-align:-2px;"></i> Kaydet
        </button>
      </div>
    </div>`;
  window.lucideYenile && window.lucideYenile();
  window.rozetOlcutDegisti();
};

window.rozetOlcutDegisti = function() {
  const sec = document.getElementById("rzOlcut");
  const kutu = document.getElementById("rzDisiplinKutu");
  const acik = document.getElementById("rzOlcutAciklama");
  if (!sec) return;
  const o = window.BCK_ROZET.OLCUTLER[sec.value];
  if (kutu) kutu.style.display = (sec.value === "disiplinYuzde") ? "block" : "none";
  if (acik && o) acik.textContent = o.aciklama + (o.birim === "%" ? " (0–100 arası yüzde girin)" : "");
};

window.rozetTanimKaydetTiklandi = async function() {
  const kodEl = document.getElementById("rzKod");
  const kod = (kodEl.value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (!kod) { window.showToast && window.showToast("Rozet kodu zorunlu", "error"); return; }
  const ad = (document.getElementById("rzAd").value || "").trim();
  if (!ad) { window.showToast && window.showToast("Rozet adı zorunlu", "error"); return; }

  const olcut = document.getElementById("rzOlcut").value;
  const veri = {
    ad,
    aciklama: (document.getElementById("rzAciklama").value || "").trim(),
    ikon: (document.getElementById("rzIkon").value || "award").trim(),
    renk: document.getElementById("rzRenk").value,
    olcut,
    disiplin: olcut === "disiplinYuzde" ? document.getElementById("rzDisiplin").value : "",
    esik: Number(document.getElementById("rzEsik").value) || 1,
    aktif: document.getElementById("rzAktif").checked,
    sira: Number(document.getElementById("rzSira").value) || 99
  };

  try {
    await window.BCK_ROZET.tanimKaydet(kod, veri);
    window.showToast && window.showToast("✓ Rozet tanımı kaydedildi");
    rozetYonetimListeRender();
  } catch (e) {
    console.error("Rozet kaydı:", e);
    window.showToast && window.showToast("Kaydedilemedi: " + (e.message || e), "error");
  }
};

window.rozetYonetimListeRender = rozetYonetimListeRender;

console.log("Rozet Yönetimi modülü yüklendi.");
