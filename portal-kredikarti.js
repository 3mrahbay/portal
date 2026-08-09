// ══════════════════════════════════════════════════════════════
// PORTAL · KREDİ KARTI TALEP MODÜLÜ
// Faz 8 · index.html'den ayrıştırıldı (2026-08-07)
// Veli kredi kartıyla ödeme talebi açar, muhasebe onaylar/reddeder.
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
        addDoc, query, where, orderBy, serverTimestamp,
        escapeHtml, escapeHtmlGelisim, getOgrenciDurum, isoTarih,
        brevoMail, portalMailSablon, getAyListesi,
        haftaBaslangic, haftaKodu, haftaEtiketi,
        AY_ISIMLERI, YEMEK_GUNLER, YEMEK_OGUNLER, OKUL_MAIL, PORTAL_URL,
        veliRenderBildirimler } = B;

// ============ TUR C: KREDİ KARTI TALEP SİSTEMİ ============
let krediKartiTalepleri = [];

// VELİ TARAFI: kartTalep parametresi ile gelmişse talep modalı aç
window.veliKartTalepAc = async function(ogrenciId) {
  // Bu öğrenci bu veliye ait mi kontrol et
  if (!B.veliOgrencileri() || B.veliOgrencileri().length === 0) return;
  const ogr = B.veliOgrencileri().find(o => o.id === ogrenciId);
  if (!ogr) {
    showToast("Bu öğrenci bilgisine erişiminiz yok", "error");
    return;
  }

  // URL'i temizle
  window.history.replaceState({}, document.title, window.location.pathname);

  // Borç hesabı
  let toplamBorc = 0, gecikenAySayisi = 0;
  try {
    const donemRef = doc(db, "ogrenciler", ogrenciId, "donemler", B.donem());
    const donemSnap = await getDoc(donemRef);
    if (donemSnap.exists()) {
      const v = donemSnap.data();
      const a = v.aidatAyarlari || {};
      const baslangic = a.baslangicAyi;
      const taksit = a.taksitSayisi || 10;
      const iDonemAylik = a.iDonemAylik || a.aylikAidat || 0;
      const iiDonemAylik = a.iiDonemAylik || a.aylikAidat || 0;
      const aylikOdemeler = v.aylikOdemeler || {};
      const bugun = new Date();
      if (baslangic) {
        const ayListesi = getAyListesi(baslangic, taksit);
        for (const ay of ayListesi) {
          const ayTarihi = new Date(parseInt(ay.ayKod.split("-")[0]), parseInt(ay.ayKod.split("-")[1]) - 1, 10);
          if (ayTarihi >= bugun) continue;
          const ayNum = parseInt(ay.ayKod.split("-")[1], 10);
          const beklenen = (ayNum >= 9 || ayNum <= 1) ? iDonemAylik : iiDonemAylik;
          const od = aylikOdemeler[ay.ayKod] || {};
          if (!od.odendi) {
            toplamBorc += beklenen;
            gecikenAySayisi++;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Borç hesabı hatası:", e);
  }

  const modalHtml = `
    <div class="modal-overlay active" id="kartTalepVeliModal" onclick="if(event.target.id==='kartTalepVeliModal') closeVeliKartTalep()">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header" style="background:linear-gradient(135deg, #fef9c3 0%, #fde68a 100%); border-bottom:1px solid #facc15;">
          <h3 style="color:#78350f;"><i data-lucide="credit-card" style="width:13px;height:13px;vertical-align:-2px;"></i> Kredi Kartı ile Ödeme Talebi</h3>
          <button class="close-btn" onclick="closeVeliKartTalep()">×</button>
        </div>
        <div class="modal-body">
          <p style="margin:0 0 14px; font-size:14px; color:var(--gray-700); line-height:1.7;">
            <strong>${escapeHtml(ogr.ogrenciAdSoyad || "Öğrenci")}</strong> için kredi kartı ile ödeme talebi oluşturuyorsunuz.
          </p>

          ${toplamBorc > 0 ? `
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px 18px; margin-bottom:14px;">
            <div style="font-size:11px; color:#991b1b; font-weight:600; letter-spacing:0.5px;">BEKLEYEN ÖDEME</div>
            <div style="font-size:22px; font-weight:700; color:#7f1d1d; font-family:var(--font-display); margin-top:4px;">₺${toplamBorc.toLocaleString("tr-TR")}</div>
            <div style="font-size:12px; color:#991b1b; margin-top:2px;">${gecikenAySayisi} ay geciken</div>
          </div>
          ` : `
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 18px; margin-bottom:14px; font-size:13px; color:#166534;">
            ✓ Şu an bekleyen geciken ödemeniz yok. Yine de talep oluşturabilirsiniz.
          </div>
          `}

          <div style="background:#f9fafb; border-radius:10px; padding:14px 18px; margin-bottom:14px; font-size:13px; color:var(--gray-700); line-height:1.8;">
            <strong><i data-lucide="clipboard-list" style="width:13px;height:13px;vertical-align:-2px;"></i> Süreç:</strong>
            <ol style="margin:6px 0 0; padding-left:22px; color:var(--gray-600);">
              <li>Talebiniz okul yönetimine iletilir</li>
              <li>Okul yönetimi sizi en kısa sürede arar</li>
              <li>Kart bilgilerinizi telefonda güvenli şekilde alır</li>
              <li>POS işlemi yapıldıktan sonra SMS onayı alırsınız</li>
            </ol>
          </div>

          <div class="form-group">
            <label>İsteğe Bağlı Not (okula iletilecek)</label>
            <textarea id="kartTalepNot" rows="3" placeholder="Örn: Öğleden sonra arayabilirsiniz" style="width:100%; padding:10px; border:1px solid var(--gray-300); border-radius:8px; font-family:inherit; font-size:13px; resize:vertical;"></textarea>
          </div>
        </div>
        <div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">
          <button class="btn-secondary" onclick="closeVeliKartTalep()">İptal</button>
          <button class="btn-primary" id="btnKartTalepGonder" style="background:#facc15; color:#422006; border:none;" onclick="kartTalepOlustur('${ogrenciId}', ${toplamBorc}, ${gecikenAySayisi})">📤 Talep Gönder</button>
        </div>
      </div>
    </div>
  `;

  let wrap = document.getElementById("kartTalepVeliWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "kartTalepVeliWrap";
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = modalHtml;
};

window.closeVeliKartTalep = function() {
  const m = document.getElementById("kartTalepVeliModal");
  if (m) m.remove();
};

// Veli: Talep Firestore'a yaz + okula bilgilendirme maili
window.kartTalepOlustur = async function(ogrenciId, borc, gecikenAy) {
  const btn = document.getElementById("btnKartTalepGonder");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Gönderiliyor..."; }

  const not = (document.getElementById("kartTalepNot") || {}).value || "";
  const ogr = B.veliOgrencileri().find(o => o.id === ogrenciId);
  const veliAd = B.kullanici().displayName || B.kullanici().email.split("@")[0];

  const talepData = {
    ogrenciId,
    ogrenciAd: ogr ? (ogr.ogrenciAdSoyad || "") : "",
    veliEposta: (B.kullanici().email || "").toLowerCase(),
    veliAd: veliAd,
    borc: borc || 0,
    gecikenAySayisi: gecikenAy || 0,
    not: not.trim(),
    durum: "bekliyor",
    okundu: false,
    olusturuldu: new Date().toISOString(),
    donem: B.donem()
  };

  try {
    const ref = doc(collection(db, "krediKartiTalepleri"));
    await setDoc(ref, talepData, { merge: true });

    // Admin'e bilgilendirme maili
    const adminMail = `
      <h3 style="color:#78350f;"><i data-lucide="credit-card" style="width:13px;height:13px;vertical-align:-2px;"></i> Yeni Kredi Kartı Ödeme Talebi</h3>
      <div style="background:#fef9c3; border-radius:8px; padding:14px; margin:14px 0; font-size:14px;">
        <div><strong>Öğrenci:</strong> ${escapeHtml(talepData.ogrenciAd)}</div>
        <div><strong>Veli:</strong> ${escapeHtml(veliAd)} (${escapeHtml(B.kullanici().email)})</div>
        <div><strong>Bekleyen Borç:</strong> ₺${borc.toLocaleString("tr-TR")}</div>
        <div><strong>Geciken Ay:</strong> ${gecikenAy}</div>
        ${not ? `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed #fde68a;"><strong>Veli Notu:</strong><br><em>${escapeHtml(not)}</em></div>` : ''}
      </div>
      <p style="font-size:13px; color:#374151;">
        Admin paneline girip veliyi aramanız ve kart ödemesi almanız gerekmektedir.
      </p>
      <div style="text-align:center; margin:20px 0;">
        <a href="${PORTAL_URL}" style="display:inline-block; background:#2d6a4f; color:white; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600;">🔗 Admin Paneli</a>
      </div>
    `;
    brevoMail({
      to: OKUL_MAIL, toName: "Okul Yönetimi",
      subject: `<i data-lucide="credit-card" style="width:13px;height:13px;vertical-align:-2px;"></i> Yeni Kart Talebi - ${talepData.ogrenciAd}`,
      htmlContent: portalMailSablon("Yeni Kart Talebi", adminMail, "Veli kredi kartı ile ödeme talep etti.")
    });

    closeVeliKartTalep();
    showToast("✓ Talebiniz başarıyla iletildi. Okul yönetimi en kısa sürede sizi arayacaktır.", "success");

    // Veli paneli bildirimler sekmesini yenile
    veliRenderBildirimler();
  } catch (e) {
    showToast("Talep gönderilemedi: " + e.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "📤 Talep Gönder"; }
  }
};

// ADMIN TARAFI: Giriş yapınca yeni talep kontrolü
window.kontrolEtYeniTalepler = async function() {
  try {
    // Bu sorgu yalnızca yönetim/muhasebe içindir. Veli oturumunda
    // filtresiz liste okuması Firestore Rules tarafından reddediliyor
    // ve konsolu hata ile dolduruyordu.
    const yetkili = (typeof B.yoneticiMi() !== "undefined" && B.yoneticiMi()) ||
      ["kurucu_mudur", "mudur", "muhasebe"].includes(B.rol());
    if (!yetkili) return;
    const snap = await getDocs(collection(db, "krediKartiTalepleri"));
    const tumu = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    krediKartiTalepleri = tumu;

    const yeniler = tumu.filter(t => !t.okundu && t.durum === "bekliyor");
    if (yeniler.length > 0) {
      admintalepPopupAc(yeniler.length);
    }

    // Navbar rozet güncelle
    guncelleNavbarTalepRozet(yeniler.length);
  } catch (e) {
    console.warn("Talep kontrolü hatası:", e);
  }
};

function admintalepPopupAc(sayi) {
  const popupHtml = `
    <div class="modal-overlay active" id="adminTalepPopup" onclick="if(event.target.id==='adminTalepPopup') closeAdminTalepPopup()">
      <div class="modal" style="max-width:440px;">
        <div class="modal-header" style="background:linear-gradient(135deg, #fef9c3 0%, #facc15 100%); border-bottom:1px solid #eab308;">
          <h3 style="color:#422006;"><i data-lucide="bell" style="width:13px;height:13px;vertical-align:-2px;"></i> Yeni Talepler</h3>
          <button class="close-btn" onclick="closeAdminTalepPopup()">×</button>
        </div>
        <div class="modal-body" style="text-align:center; padding:24px;">
          <div style="font-size:56px; margin-bottom:12px;"><i data-lucide="credit-card" style="width:15px;height:15px;vertical-align:-2px;"></i></div>
          <div style="font-family:var(--font-display); font-size:22px; font-weight:700; color:#422006; margin-bottom:8px;">
            ${sayi} yeni kredi kartı talebi
          </div>
          <div style="font-size:14px; color:#78350f; line-height:1.6;">
            Veliler kredi kartı ile ödeme yapmak için sizi bekliyor.<br>
            En kısa sürede aramanız gerekiyor.
          </div>
        </div>
        <div class="modal-footer" style="display:flex; gap:10px; justify-content:center;">
          <button class="btn-secondary" onclick="closeAdminTalepPopup()">Sonra Bakarım</button>
          <button class="btn-primary" onclick="closeAdminTalepPopup(); acTaleplerSekmesi();" style="background:#f59e0b; border:none; color:white;">👁 Talepleri Göster</button>
        </div>
      </div>
    </div>
  `;
  let wrap = document.getElementById("adminTalepPopupWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "adminTalepPopupWrap";
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = popupHtml;
}

window.closeAdminTalepPopup = function() {
  const m = document.getElementById("adminTalepPopup");
  if (m) m.remove();
};

// Navbar'a talep rozet ekle
function guncelleNavbarTalepRozet(sayi) {
  let rozet = document.getElementById("navbarTalepRozet");
  if (sayi <= 0) {
    if (rozet) rozet.remove();
    return;
  }
  if (!rozet) {
    // User avatar'ın yanına ekle
    const userMenu = document.querySelector(".user-menu") || document.querySelector(".dashboard-header") || document.getElementById("userAvatar")?.parentElement;
    if (!userMenu) return;
    rozet = document.createElement("button");
    rozet.id = "navbarTalepRozet";
    rozet.onclick = () => acTaleplerSekmesi();
    rozet.title = "Kredi kartı talepleri";
    rozet.style.cssText = "position:relative; background:#fef9c3; border:1px solid #facc15; color:#422006; border-radius:10px; padding:8px 14px; margin-right:10px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit;";
    userMenu.insertBefore(rozet, userMenu.firstChild);
  }
  rozet.innerHTML = `🔔 <span style="margin-left:4px;">${sayi}</span>`;
}

window.acTaleplerSekmesi = function() {
  // Finansal Yönetim sekmesini aç
  const finansTab = document.querySelector('.tab[data-tab="finans"]');
  if (finansTab) finansTab.click();
  // Sonra talepler alt sekmesini seç
  setTimeout(() => {
    if (typeof finansSwitchAlt === "function") finansSwitchAlt("talepler");
  }, 200);
};

// Talepleri render et (admin alt sekmesi)
async function renderKartTalepleri() {
  const el = document.getElementById("kartTalepleriIcerik");
  if (!el) return;

  try {
    const snap = await getDocs(collection(db, "krediKartiTalepleri"));
    krediKartiTalepleri = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    el.innerHTML = `<div class="ozel-madde-empty">Talepler yüklenemedi: ${e.message}</div>`;
    return;
  }

  const liste = [...krediKartiTalepleri].sort((a, b) => (b.olusturuldu || "").localeCompare(a.olusturuldu || ""));
  const bekleyenSayi = liste.filter(t => t.durum === "bekliyor").length;
  const tamamlananSayi = liste.filter(t => t.durum === "tamamlandi").length;

  if (liste.length === 0) {
    el.innerHTML = `
      <div style="background:#fef9c3; border:1px solid #fde68a; border-radius:14px; padding:30px; text-align:center;">
        <div style="font-size:48px; margin-bottom:12px;"><i data-lucide="credit-card" style="width:15px;height:15px;vertical-align:-2px;"></i></div>
        <div style="font-family:var(--font-display); font-size:16px; font-weight:700; color:#78350f; margin-bottom:6px;">Henüz talep yok</div>
        <div style="font-size:13px; color:#92400e;">Veliler hatırlatma mailindeki "Kredi Kartı ile Öde" butonundan talep oluşturabilir.</div>
      </div>
    `;
    return;
  }

  let html = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-bottom:16px;">
      <div style="background:#fef9c3; border:1px solid #fde68a; border-radius:10px; padding:14px;">
        <div style="font-size:11px; color:#78350f; font-weight:600; letter-spacing:0.5px;">BEKLİYOR</div>
        <div style="font-family:var(--font-display); font-size:26px; font-weight:700; color:#422006;">${bekleyenSayi}</div>
      </div>
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px;">
        <div style="font-size:11px; color:#166534; font-weight:600; letter-spacing:0.5px;">TAMAMLANAN</div>
        <div style="font-family:var(--font-display); font-size:26px; font-weight:700; color:#14532d;">${tamamlananSayi}</div>
      </div>
      <div style="background:white; border:1px solid var(--gray-300); border-radius:10px; padding:14px;">
        <div style="font-size:11px; color:var(--gray-500); font-weight:600; letter-spacing:0.5px;">TOPLAM</div>
        <div style="font-family:var(--font-display); font-size:26px; font-weight:700; color:var(--gray-800);">${liste.length}</div>
      </div>
    </div>
  `;

  const durumStilleri = {
    bekliyor: { bg: "#fef9c3", border: "#fde68a", text: "#78350f", label: "⏳ Bekliyor" },
    arandi: { bg: "#dbeafe", border: "#bfdbfe", text: "#1e40af", label: "📞 Arandı" },
    tamamlandi: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", label: "✓ Tamamlandı" },
    iptal: { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280", label: "✗ İptal" }
  };

  html += `<div style="display:flex; flex-direction:column; gap:10px;">`;
  for (const t of liste) {
    const stil = durumStilleri[t.durum] || durumStilleri.bekliyor;
    const yeniRozet = !t.okundu ? '<span style="background:#dc2626; color:white; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:700; margin-left:6px;">YENİ</span>' : '';
    const olusturuldu = t.olusturuldu ? new Date(t.olusturuldu).toLocaleString("tr-TR") : "";
    html += `
      <div style="background:white; border:1px solid var(--gray-300); border-radius:12px; padding:16px 20px; ${!t.okundu ? 'border-left:4px solid #dc2626;' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:12px; margin-bottom:10px;">
          <div style="flex:1; min-width:220px;">
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
              <span style="font-family:var(--font-display); font-size:16px; font-weight:700; color:var(--gray-800);">${escapeHtml(t.ogrenciAd)}</span>
              ${yeniRozet}
              <span style="background:${stil.bg}; border:1px solid ${stil.border}; color:${stil.text}; padding:3px 10px; border-radius:8px; font-size:11px; font-weight:700;">${stil.label}</span>
            </div>
            <div style="font-size:12px; color:var(--gray-600); margin-top:4px;">
              ${escapeHtml(t.veliAd)} · <a href="mailto:${escapeHtml(t.veliEposta)}" style="color:#2d6a4f; text-decoration:none;">${escapeHtml(t.veliEposta)}</a>
            </div>
            <div style="font-size:11px; color:var(--gray-500); margin-top:2px;">${olusturuldu}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-display); font-size:20px; font-weight:700; color:#7f1d1d;">₺${(t.borc || 0).toLocaleString("tr-TR")}</div>
            <div style="font-size:11px; color:var(--gray-500);">${t.gecikenAySayisi} ay geciken</div>
          </div>
        </div>
        ${t.not ? `
          <div style="background:#f9fafb; border-radius:8px; padding:10px 14px; margin:8px 0; font-size:13px; color:var(--gray-700); border-left:3px solid #d1d5db;">
            <strong style="color:var(--gray-500); font-size:11px;">VELİ NOTU</strong><br>
            ${escapeHtml(t.not)}
          </div>
        ` : ''}
        ${t.adminNotu ? `
          <div style="background:#eff6ff; border-radius:8px; padding:10px 14px; margin:8px 0; font-size:13px; color:#1e40af; border-left:3px solid #3b82f6;">
            <strong style="font-size:11px;">ADMIN NOTU</strong><br>
            ${escapeHtml(t.adminNotu)}
          </div>
        ` : ''}
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;">
          ${t.durum === "bekliyor" ? `
            <button onclick="talepDurumGuncelle('${t.id}', 'arandi')" style="padding:7px 14px; background:#3b82f6; border:none; color:white; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;"><i data-lucide="phone" style="width:13px;height:13px;vertical-align:-2px;"></i> Arandı</button>
            <button onclick="talepDurumGuncelle('${t.id}', 'tamamlandi')" style="padding:7px 14px; background:#16a34a; border:none; color:white; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;"><i data-lucide="check" style="width:14px;height:14px;vertical-align:-2px;"></i> Tamamlandı</button>
            <button onclick="talepDurumGuncelle('${t.id}', 'iptal')" style="padding:7px 14px; background:white; border:1px solid #d1d5db; color:#6b7280; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;"><i data-lucide="x" style="width:14px;height:14px;vertical-align:-2px;"></i> İptal</button>
          ` : t.durum === "arandi" ? `
            <button onclick="talepDurumGuncelle('${t.id}', 'tamamlandi')" style="padding:7px 14px; background:#16a34a; border:none; color:white; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;"><i data-lucide="check" style="width:14px;height:14px;vertical-align:-2px;"></i> Tamamlandı</button>
            <button onclick="talepDurumGuncelle('${t.id}', 'iptal')" style="padding:7px 14px; background:white; border:1px solid #d1d5db; color:#6b7280; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;"><i data-lucide="x" style="width:14px;height:14px;vertical-align:-2px;"></i> İptal</button>
          ` : ''}
          <button onclick="talepNotEkle('${t.id}')" style="padding:7px 14px; background:white; border:1px solid var(--gray-300); color:var(--gray-700); border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;"><i data-lucide="file-text" style="width:13px;height:13px;vertical-align:-2px;"></i> Not Ekle</button>
          <a href="mailto:${escapeHtml(t.veliEposta)}?subject=Kredi%20Kart%C4%B1%20Talebiniz%20Hk." style="padding:7px 14px; background:white; border:1px solid var(--gray-300); color:var(--gray-700); border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; text-decoration:none;">✉ Mail</a>
          ${!t.okundu ? `<button onclick="talepOkunduIsaretle('${t.id}')" style="padding:7px 14px; background:white; border:1px solid var(--gray-300); color:var(--gray-700); border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; margin-left:auto;">👁 Okundu</button>` : ''}
        </div>
      </div>
    `;
  }
  html += `</div>`;

  el.innerHTML = html;

  // Tüm bekleyen talepleri okundu işaretle (görüntüledi)
  const okunmamis = liste.filter(t => !t.okundu);
  for (const t of okunmamis) {
    try {
      await updateDoc(doc(db, "krediKartiTalepleri", t.id), { okundu: true });
    } catch (e) { /* sessiz */ }
  }
  // Rozet sıfırla
  guncelleNavbarTalepRozet(0);
}

window.talepDurumGuncelle = async function(talepId, yeniDurum) {
  try {
    const data = {
      durum: yeniDurum,
      guncelleyen: B.kullanici().email,
      guncellendiTarih: new Date().toISOString()
    };
    if (yeniDurum === "arandi") data.aranmaTarihi = new Date().toISOString();
    if (yeniDurum === "tamamlandi") data.tamamlanmaTarihi = new Date().toISOString();
    await updateDoc(doc(db, "krediKartiTalepleri", talepId), data);
    const labels = { arandi: "Arandı", tamamlandi: "Tamamlandı", iptal: "İptal" };
    showToast(`✓ Durum güncellendi: ${labels[yeniDurum] || yeniDurum}`);
    renderKartTalepleri();
  } catch (e) {
    showToast("Güncellenemedi: " + e.message, "error");
  }
};

window.talepNotEkle = async function(talepId) {
  const mevcut = krediKartiTalepleri.find(t => t.id === talepId);
  const not = prompt("Admin notu:", mevcut?.adminNotu || "");
  if (not === null) return;
  try {
    await updateDoc(doc(db, "krediKartiTalepleri", talepId), {
      adminNotu: not.trim(),
      guncellendiTarih: new Date().toISOString()
    });
    showToast("✓ Not kaydedildi");
    renderKartTalepleri();
  } catch (e) {
    showToast("Kaydedilemedi: " + e.message, "error");
  }
};

window.talepOkunduIsaretle = async function(talepId) {
  try {
    await updateDoc(doc(db, "krediKartiTalepleri", talepId), { okundu: true });
    renderKartTalepleri();
  } catch (e) {
    showToast("Güncellenemedi: " + e.message, "error");
  }
};

// ── Çekirdeğin erişimi için ──
window.renderKartTalepleri = renderKartTalepleri;
console.log("Kredi Kartı Talep modülü yüklendi.");
