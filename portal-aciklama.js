// ══════════════════════════════════════════════════════════════════════════
// PORTAL · KAZANIM AÇIKLAMALARI  ("Bu kazanım neden önemli?")
// ──────────────────────────────────────────────────────────────────────────
// İki katmanlı sistem (ZEKY ile birebir aynı veri yapısı):
//   1) ALAN açıklaması    → mufredatlar/{disiplin}.alanAciklamalari[alanId]
//   2) KAZANIM açıklaması → mufredatlar/{disiplin}.kazanimAciklamalari[anahtar]
// Gösterirken önce kazanım açıklaması aranır, yoksa alan açıklaması kullanılır.
//
// Portal bu metinleri hem GÖSTERİR (her rol) hem DÜZENLER (yalnızca yönetim).
// ZEKY tarafındaki mufredat-aciklama.html editörüyle aynı veriye yazar.
//
// Faz 2 · 2026-08-10 · PORTAL-ZEKY-SENKRON-YOL-HARITASI.md
// ══════════════════════════════════════════════════════════════════════════

const B = window.BCK;

// disiplin -> { alan:{}, kazanim:{} }  (oturum boyunca bellekte)
const _aciklamaOnbellek = {};
let _acikBaglam = null;   // modalda açık olan kazanımın bilgisi

function duzenleyebilirMi() {
  const rol = (B.rol && B.rol()) || "";
  return ["kurucu_mudur", "mudur", "egitim_koordinator"].includes(rol) ||
         (B.yoneticiMi && B.yoneticiMi());
}

// Bir disiplinin açıklamalarını getir (önbellekli)
window.aciklamalariYukle = async function(disiplin, zorla = false) {
  if (!disiplin) return { alan: {}, kazanim: {} };
  if (_aciklamaOnbellek[disiplin] && !zorla) return _aciklamaOnbellek[disiplin];
  if (!window.PortalData?.mufredatAciklamalariGetir) return { alan: {}, kazanim: {} };
  const veri = await window.PortalData.mufredatAciklamalariGetir(disiplin);
  _aciklamaOnbellek[disiplin] = veri;
  return veri;
};

// Bir kazanımın açıklaması VAR MI? (matriste ikonu renklendirmek için)
// Önbellek boşsa false döner — ikon yine tıklanabilir kalır.
window.aciklamaVarMi = function(disiplin, alanId, anahtar) {
  const ac = _aciklamaOnbellek[disiplin];
  if (!ac) return false;
  const k = (ac.kazanim || {})[anahtar];
  if (k && k.trim()) return "kazanim";
  const a = (ac.alan || {})[alanId];
  if (a && a.trim()) return "alan";
  return false;
};

// ── MODAL ─────────────────────────────────────────────────────────────────
window.aciklamaModalAc = async function(disiplin, alanId, alanAd, grupAd, dersAd) {
  const anahtar = `${alanId}__${grupAd}__${dersAd}`;
  _acikBaglam = { disiplin, alanId, alanAd, grupAd, dersAd, anahtar };

  const modal = document.getElementById("aciklamaModal");
  const govde = document.getElementById("aciklamaModalGovde");
  const baslik = document.getElementById("aciklamaModalBaslik");
  if (!modal || !govde) return;

  baslik.textContent = dersAd || "Kazanım";
  govde.innerHTML = `<div style="padding:34px; text-align:center; color:#9ca3af; font-size:13px;">Yükleniyor…</div>`;
  modal.classList.add("active");

  const ac = await window.aciklamalariYukle(disiplin);
  const coz = window.PortalData.aciklamaCoz(ac, anahtar, alanId);
  const kazanimMetin = (ac.kazanim || {})[anahtar] || "";
  const alanMetin = (ac.alan || {})[alanId] || "";
  const yonetim = duzenleyebilirMi();

  const kaynakRozet = coz.kaynak === "kazanim"
    ? `<span style="background:#E0D7F0; color:#5b3f8f; font-size:10px; font-weight:700; padding:3px 9px; border-radius:20px; letter-spacing:.04em;">KAZANIMA ÖZEL</span>`
    : coz.kaynak === "alan"
      ? `<span style="background:#D6E6F2; color:#2a5578; font-size:10px; font-weight:700; padding:3px 9px; border-radius:20px; letter-spacing:.04em;">ALAN AÇIKLAMASI</span>`
      : `<span style="background:#f3f4f6; color:#9ca3af; font-size:10px; font-weight:700; padding:3px 9px; border-radius:20px; letter-spacing:.04em;">HENÜZ YAZILMAMIŞ</span>`;

  govde.innerHTML = `
    <div style="padding:20px 22px;">

      <div style="font-size:12px; color:#9ca3af; margin-bottom:4px;">
        ${B.escapeHtml(alanAd || "")} › ${B.escapeHtml(grupAd || "")}
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:16px;">
        <div style="font-size:17px; font-weight:600; color:#2D5E3E;">${B.escapeHtml(dersAd || "")}</div>
        ${kaynakRozet}
      </div>

      <div style="background:${coz.metin ? "#f0fdf4" : "#f9fafb"}; border-left:3px solid ${coz.metin ? "#4A7C59" : "#e5e7eb"}; border-radius:10px; padding:16px 18px; font-size:14px; line-height:1.75; color:#374151; white-space:pre-wrap;">
        ${coz.metin ? B.escapeHtml(coz.metin) : `<span style="color:#9ca3af; font-style:italic;">Bu kazanım için henüz bir açıklama yazılmamış.${yonetim ? " Aşağıdan ekleyebilirsiniz." : ""}</span>`}
      </div>

      ${yonetim ? `
        <div style="margin-top:22px; padding-top:18px; border-top:1px solid #f3f4f6;">
          <div style="font-size:12px; font-weight:700; letter-spacing:.05em; color:#6b7280; margin-bottom:12px;">
            <i data-lucide="pencil" style="width:13px;height:13px;vertical-align:-2px;"></i> DÜZENLE
          </div>

          <label style="display:block; font-size:12px; font-weight:700; color:#374151; margin-bottom:5px;">
            Bu kazanıma özel açıklama
          </label>
          <textarea id="aciklamaKazanimMetin" rows="4" placeholder="Boş bırakılırsa alan açıklaması kullanılır."
            style="width:100%; padding:11px 13px; border:1px solid #d1d5db; border-radius:10px; font-size:13px; line-height:1.6; font-family:inherit; box-sizing:border-box; resize:vertical;">${B.escapeHtml(kazanimMetin)}</textarea>
          <div style="font-size:11px; color:#9ca3af; margin:5px 0 16px;">
            Yalnızca bu kazanım için geçerlidir. Silmek için boş bırakıp kaydedin.
          </div>

          <label style="display:block; font-size:12px; font-weight:700; color:#374151; margin-bottom:5px;">
            “${B.escapeHtml(alanAd || "")}” alanının genel açıklaması
          </label>
          <textarea id="aciklamaAlanMetin" rows="4" placeholder="Bu alandaki tüm kazanımlar için ortak metin."
            style="width:100%; padding:11px 13px; border:1px solid #d1d5db; border-radius:10px; font-size:13px; line-height:1.6; font-family:inherit; box-sizing:border-box; resize:vertical;">${B.escapeHtml(alanMetin)}</textarea>
          <div style="font-size:11px; color:#d97706; margin:5px 0 18px;">
            <i data-lucide="alert-triangle" style="width:12px;height:12px;vertical-align:-2px;"></i>
            Dikkat: bu metin alandaki <strong>bütün</strong> kazanımlarda görünür.
          </div>

          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button class="btn-mini" onclick="aciklamaModalKapat()">Vazgeç</button>
            <button class="btn-primary" onclick="aciklamaKaydet()">
              <i data-lucide="save" style="width:14px;height:14px;vertical-align:-2px;"></i> Kaydet
            </button>
          </div>
        </div>
      ` : `
        <div style="margin-top:18px; font-size:11px; color:#9ca3af;">
          Açıklamalar okul yönetimi tarafından düzenlenir.
        </div>
      `}
    </div>`;

  window.lucideYenile && window.lucideYenile();
};

window.aciklamaModalKapat = function() {
  const m = document.getElementById("aciklamaModal");
  if (m) m.classList.remove("active");
  _acikBaglam = null;
};

window.aciklamaKaydet = async function() {
  if (!_acikBaglam) return;
  const { disiplin, alanId, anahtar } = _acikBaglam;
  const kazanimEl = document.getElementById("aciklamaKazanimMetin");
  const alanEl = document.getElementById("aciklamaAlanMetin");
  if (!kazanimEl || !alanEl) return;

  const yeniKazanim = kazanimEl.value.trim();
  const yeniAlan = alanEl.value.trim();
  const ac = _aciklamaOnbellek[disiplin] || { alan: {}, kazanim: {} };
  const eskiKazanim = (ac.kazanim || {})[anahtar] || "";
  const eskiAlan = (ac.alan || {})[alanId] || "";

  try {
    const isler = [];
    // Sadece DEĞİŞENİ yaz — gereksiz yazma yapılmaz
    if (yeniKazanim !== eskiKazanim) {
      isler.push(window.PortalData.kazanimAciklamaKaydet(disiplin, anahtar, yeniKazanim));
    }
    if (yeniAlan !== eskiAlan) {
      isler.push(window.PortalData.alanAciklamaKaydet(disiplin, alanId, yeniAlan));
    }
    if (!isler.length) { window.showToast && window.showToast("Değişiklik yok"); return; }

    await Promise.all(isler);
    await window.aciklamalariYukle(disiplin, true);   // önbelleği tazele
    window.showToast && window.showToast("✓ Açıklama kaydedildi");
    window.aciklamaModalKapat();
    // Matristeki ikonları tazele
    if (typeof window.aciklamaIkonlariniTazele === "function") window.aciklamaIkonlariniTazele();
  } catch (e) {
    console.error("Açıklama kaydedilemedi:", e);
    window.showToast && window.showToast("Kaydedilemedi: " + (e.message || e), "error");
  }
};

// Matristeki açıklama ikonlarının rengini (yazılmış / yazılmamış) tazele
window.aciklamaIkonlariniTazele = function() {
  document.querySelectorAll("[data-aciklama-anahtar]").forEach(el => {
    const dis = el.getAttribute("data-aciklama-disiplin");
    const alanId = el.getAttribute("data-aciklama-alan");
    const anahtar = el.getAttribute("data-aciklama-anahtar");
    const durum = window.aciklamaVarMi(dis, alanId, anahtar);
    el.style.color = durum === "kazanim" ? "#7B5EA7" : durum === "alan" ? "#4A7C59" : "#d1d5db";
    el.title = durum === "kazanim" ? "Bu kazanıma özel açıklama var"
             : durum === "alan" ? "Alan açıklaması gösterilecek"
             : "Açıklama yok — eklemek için tıklayın";
  });
};

console.log("Kazanım Açıklamaları modülü yüklendi.");
