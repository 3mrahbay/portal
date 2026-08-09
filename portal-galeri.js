// ══════════════════════════════════════════════════════════════
// PORTAL · GALERİ MODÜLÜ  (Yönetim + Veli)
// --------------------------------------------------------------
// Faz 5 · index.html'den ayrıştırıldı (2026-08-06)
// Kaynak: "GALERİ SİSTEMİ (Tur 5A)" + "VELİ GALERİ (Tur 5B)"
//
// İki taraf tek dosyada tutuldu; çünkü lightbox durumu
// (aktifLightboxOge) ve kategori listesi ikisi arasında paylaşılıyor.
// Medya yükleme Bunny.net üzerinden — window.BCK.medyaYukle.
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
        query, where, escapeHtml, getOgrenciDurum, isoTarih,
        brevoMail, portalMailSablon, medyaYukle, sinifGorunur,
        resimSikistir, sinifAdiResmiEsle } = B;

// ============ GALERİ SİSTEMİ (Tur 5A) ============
let galeriListesiVerisi = [];
let aktifGaleriFilter = "tumu";
let galeriSecilenDosyalar = [];
let galeriGorunum = "grid"; // "grid" (Instagram) | "album" (gruplu)

window.galeriGorunumToggle = function() {
  galeriGorunum = galeriGorunum === "grid" ? "album" : "grid";
  const btn = document.getElementById("galeriGorunumBtn");
  if (btn) {
    btn.innerHTML = galeriGorunum === "grid"
      ? '<i data-lucide="rows-3"></i> Albüm görünümü'
      : '<i data-lucide="layout-grid"></i> Izgara görünümü';
  }
  renderGaleri();
  if (window.lucideYenile) setTimeout(window.lucideYenile, 50);
};

window.galeriFilter = function(f) {
  // "Albümler" ayrı bir medya türü değil, GÖRÜNÜM modudur (mobil app ile aynı mantık).
  // Seçilince albüm görünümüne geçilir; diğer kategorilerde ızgara görünümü kullanılır.
  if (f === "album") {
    galeriGorunum = "album";
    aktifGaleriFilter = "tumu";
    document.querySelectorAll("[data-galeri-filter]").forEach(b => {
      const aktif = b.dataset.galeriFilter === "album";
      b.style.background = aktif ? "#9333ea" : "";
      b.style.color = aktif ? "white" : "";
      b.style.border = aktif ? "none" : "";
    });
    renderGaleri();
    if (window.lucideYenile) setTimeout(window.lucideYenile, 50);
    return;
  }
  galeriGorunum = "grid";
  aktifGaleriFilter = f;
  document.querySelectorAll("[data-galeri-filter]").forEach(b => {
    if (b.dataset.galeriFilter === f) {
      b.style.background = "#9333ea"; b.style.color = "white"; b.style.border = "none";
    } else {
      b.style.background = ""; b.style.color = ""; b.style.border = "";
    }
  });
  renderGaleri();
};

async function loadGaleri() {
  try {
    const snap = await getDocs(collection(db, "galeri"));
    galeriListesiVerisi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.galeriListesiVerisi = galeriListesiVerisi; // ZIP indir için global erişim
  } catch (e) {
    console.warn("Galeri yüklenemedi:", e);
    galeriListesiVerisi = [];
    window.galeriListesiVerisi = [];
  }
}

// ===== FAZ 4b: GALERİ MEDYA ONAY (sadece Müdür/Kurucu Müdür) =====
window.galeriOnayla = async function(id) {
  const yonetimMi = B.yoneticiMi() || ["kurucu_mudur","mudur"].includes(B.rol());
  if (!yonetimMi) { showToast("Onay yetkiniz yok", "error"); return; }
  try {
    await updateDoc(doc(db, "galeri", id), {
      durum: "onaylandi",
      onaylayanEmail: B.kullanici().email,
      onayTarihi: new Date().toISOString()
    });
    showToast("✓ Fotoğraf onaylandı, veliler görebilir");
    await renderGaleri();
  } catch (e) {
    console.error("Onaylama hatası:", e);
    showToast("Onaylanamadı: " + e.message, "error");
  }
};

window.galeriReddet = async function(id) {
  const yonetimMi = B.yoneticiMi() || ["kurucu_mudur","mudur"].includes(B.rol());
  if (!yonetimMi) { showToast("Yetkiniz yok", "error"); return; }
  if (!confirm("Bu fotoğraf reddedilecek. Veliler göremeyecek. Onaylıyor musunuz?")) return;
  try {
    await updateDoc(doc(db, "galeri", id), {
      durum: "reddedildi",
      onaylayanEmail: B.kullanici().email,
      onayTarihi: new Date().toISOString()
    });
    showToast("Fotoğraf reddedildi");
    await renderGaleri();
  } catch (e) {
    console.error("Reddetme hatası:", e);
    showToast("İşlem başarısız: " + e.message, "error");
  }
};

// Onay bekleyen medya sayısı (rozet için)
function galeriOnayBekleyenSayisi() {
  return (galeriListesiVerisi || []).filter(g => (g.durum || "onaylandi") === "onayBekliyor").length;
}


// Bir medyayı albümün KAPAĞI yap. Aynı albümdeki diğer kapaklar kaldırılır.
window.galeriKapakYap = async function(medyaId) {
  try {
    const hepsi = (typeof galeriVerisi !== "undefined" ? galeriVerisi : []);
    const secilen = hepsi.find(x => x.id === medyaId);
    if (!secilen) return;
    const albumAdi = secilen.etkinlikBaslik || "Diğer";

    // Aynı albümdeki eski kapağı kaldır
    const eskiler = hepsi.filter(x => (x.etkinlikBaslik || "Diğer") === albumAdi && x.kapak && x.id !== medyaId);
    await Promise.all(eskiler.map(x => updateDoc(doc(db, "galeri", x.id), { kapak: false })));

    await updateDoc(doc(db, "galeri", medyaId), { kapak: true });
    secilen.kapak = true;
    eskiler.forEach(x => x.kapak = false);
    if (typeof showToast === "function") showToast("Albüm kapağı güncellendi", "success");
    if (typeof renderGaleri === "function") renderGaleri();
  } catch (e) {
    console.error("kapak", e);
    alert("Kapak ayarlanamadı: " + (e.message || e));
  }
};


// ═══════════════════════════════════════════════════════════════════
// GALERİ KATEGORİLERİ — ayarlar/galeriKategorileri
// Veli galerisindeki üst çipleri besler. Yükleme sırasında hızlıca
// yeni kategori eklenebilir; ayrı bir yönetim ekranı gerekmez.
// ═══════════════════════════════════════════════════════════════════
let GALERI_KATEGORILER = [];

async function galeriKategorileriYukle() {
  if (GALERI_KATEGORILER.length) return GALERI_KATEGORILER;
  try {
    const d = await getDoc(doc(db, "ayarlar", "galeriKategorileri"));
    GALERI_KATEGORILER = (d.exists() && Array.isArray(d.data().liste) && d.data().liste.length)
      ? d.data().liste
      : ["Etkinlikler", "Orman", "Sanat", "Oyun"];
  } catch (e) {
    GALERI_KATEGORILER = ["Etkinlikler", "Orman", "Sanat", "Oyun"];
  }
  return GALERI_KATEGORILER;
}

async function galeriKategoriSecimDoldur() {
  const sel = document.getElementById("galeriKategori");
  if (!sel) return;
  const liste = await galeriKategorileriYukle();
  const mevcut = sel.value;
  sel.innerHTML = `<option value="">Kategorisiz</option>` +
    liste.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join("");
  if (mevcut) sel.value = mevcut;
}

window.galeriYeniKategori = async function() {
  const ad = (prompt("Yeni kategori adı:") || "").trim();
  if (!ad) return;
  await galeriKategorileriYukle();
  if (GALERI_KATEGORILER.some(k => k.toLocaleLowerCase("tr") === ad.toLocaleLowerCase("tr"))) {
    if (typeof showToast === "function") showToast("Bu kategori zaten var", "error");
    return;
  }
  GALERI_KATEGORILER = [...GALERI_KATEGORILER, ad];
  try {
    await setDoc(doc(db, "ayarlar", "galeriKategorileri"),
      { liste: GALERI_KATEGORILER, guncellendi: new Date().toISOString() }, { merge: true });
    await galeriKategoriSecimDoldur();
    const sel = document.getElementById("galeriKategori");
    if (sel) sel.value = ad;
    if (typeof showToast === "function") showToast("Kategori eklendi: " + ad, "success");
  } catch (e) {
    alert("Kategori eklenemedi: " + (e.message || e));
  }
};

async function renderGaleri() {
  const el = document.getElementById("galeriListesi");
  if (!el) return;
  await loadGaleri();

  // Yönetim ise onay filtre butonunu + rozeti göster
  const yonetimMi = B.yoneticiMi() || ["kurucu_mudur","mudur"].includes(B.rol());
  const onayBtn = document.getElementById("galeriOnayFiltreBtn");
  if (onayBtn) onayBtn.style.display = yonetimMi ? "" : "none";
  const bekleyenSayi = galeriOnayBekleyenSayisi();
  const rozet = document.getElementById("galeriOnayBekleyenRozet");
  if (rozet) {
    rozet.textContent = bekleyenSayi;
    rozet.style.display = bekleyenSayi > 0 ? "" : "none";
  }

  let liste = [...galeriListesiVerisi];
  if (aktifGaleriFilter === "foto") liste = liste.filter(g => g.dosyaTipi === "foto");
  else if (aktifGaleriFilter === "video") liste = liste.filter(g => g.dosyaTipi === "video");
  else if (aktifGaleriFilter === "onayBekliyor") liste = liste.filter(g => (g.durum || "onaylandi") === "onayBekliyor");

  // ═══ INSTAGRAM GRID GÖRÜNÜMÜ ═══
  if (galeriGorunum === "grid") {
    // Son eklenenler önce (olusturmaTarihi veya etkinlikTarih'e göre)
    const sirali = [...liste].sort((a, b) => {
      const ta = a.olusturmaTarihi || a.yuklemeTarihi || a.etkinlikTarih || "";
      const tb = b.olusturmaTarihi || b.yuklemeTarihi || b.etkinlikTarih || "";
      return String(tb).localeCompare(String(ta));
    });

    // Üstte 3 ekleme kutusu (kare) + son eklenenler grid
    let gHtml = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:8px;">`;

    // + RESİM EKLE
    gHtml += `
      <div onclick="openGaleriYuklemeModal('foto')" style="aspect-ratio:1; border:2px dashed #c4b5fd; border-radius:12px; background:#faf5ff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; transition:.15s;" onmouseover="this.style.background='#f3e8ff'; this.style.borderColor='#9333ea'" onmouseout="this.style.background='#faf5ff'; this.style.borderColor='#c4b5fd'">
        <div style="width:44px; height:44px; border-radius:50%; background:#ede9fe; display:grid; place-items:center; color:#7c3aed;"><i data-lucide="image-plus"></i></div>
        <div style="font-size:12px; font-weight:700; color:#6b21a8;">Resim Ekle</div>
      </div>`;
    // + ALBÜM EKLE
    gHtml += `
      <div onclick="openGaleriYuklemeModal('album')" style="aspect-ratio:1; border:2px dashed #c4b5fd; border-radius:12px; background:#faf5ff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; transition:.15s;" onmouseover="this.style.background='#f3e8ff'; this.style.borderColor='#9333ea'" onmouseout="this.style.background='#faf5ff'; this.style.borderColor='#c4b5fd'">
        <div style="width:44px; height:44px; border-radius:50%; background:#ede9fe; display:grid; place-items:center; color:#7c3aed;"><i data-lucide="folder-plus"></i></div>
        <div style="font-size:12px; font-weight:700; color:#6b21a8;">Albüm Ekle</div>
      </div>`;
    // + VİDEO EKLE
    gHtml += `
      <div onclick="openGaleriYuklemeModal('video')" style="aspect-ratio:1; border:2px dashed #c4b5fd; border-radius:12px; background:#faf5ff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; transition:.15s;" onmouseover="this.style.background='#f3e8ff'; this.style.borderColor='#9333ea'" onmouseout="this.style.background='#faf5ff'; this.style.borderColor='#c4b5fd'">
        <div style="width:44px; height:44px; border-radius:50%; background:#ede9fe; display:grid; place-items:center; color:#7c3aed;"><i data-lucide="video"></i></div>
        <div style="font-size:12px; font-weight:700; color:#6b21a8;">Video Ekle</div>
      </div>`;

    const yonetimMiG = B.yoneticiMi() || ["kurucu_mudur","mudur"].includes(B.rol());
    for (const d of sirali) {
      const previewUrl = d.dosyaTipi === "video" ? d.kucukResim : d.bunnyUrl;
      const thumbUrl = (d.dosyaTipi === "foto" && d.bunnyUrl) ? d.bunnyUrl + "?width=400" : previewUrl;
      const durum = d.durum || "onaylandi";
      const reddedildiMi = durum === "reddedildi";
      let rozet = "";
      if (durum === "onayBekliyor") rozet = `<div style="position:absolute; top:6px; right:6px; background:#f59e0b; color:white; padding:2px 7px; border-radius:6px; font-size:10px; font-weight:700;"><i data-lucide="clock" style="width:10px;height:10px;"></i></div>`;
      else if (reddedildiMi) rozet = `<div style="position:absolute; top:6px; right:6px; background:#dc2626; color:white; padding:2px 7px; border-radius:6px; font-size:10px; font-weight:700;">✕</div>`;

      let onayBtn = "";
      if (durum === "onayBekliyor" && yonetimMiG) {
        onayBtn = `<div style="position:absolute; bottom:0; left:0; right:0; display:flex; gap:3px; padding:5px; background:rgba(0,0,0,0.55);">
          <button onclick="event.stopPropagation(); galeriOnayla('${d.id}')" style="flex:1; padding:6px; background:#16a34a; color:white; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">✓</button>
          <button onclick="event.stopPropagation(); galeriReddet('${d.id}')" style="flex:1; padding:6px; background:#dc2626; color:white; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">✕</button>
        </div>`;
      }

      gHtml += `
        <div style="position:relative; aspect-ratio:1; background:#f3f4f6; border-radius:12px; overflow:hidden; cursor:pointer; ${durum==='onayBekliyor'?'outline:2px solid #f59e0b;':reddedildiMi?'outline:2px solid #dc2626; opacity:.7;':''}" onclick="acGaleriLightbox('${d.id}')">
          ${d.dosyaTipi === "video"
            ? `<img src="${escapeHtml(previewUrl||'')}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div style="display:none; width:100%; height:100%; background:#1f2937; color:white; align-items:center; justify-content:center;"><i data-lucide='video'></i></div><div style="position:absolute; inset:0; background:rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center;"><div style="background:rgba(255,255,255,0.9); width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#7c3aed;"><i data-lucide='play'></i></div></div>`
            : `<img src="${escapeHtml(thumbUrl||'')}" style="width:100%; height:100%; object-fit:cover;" loading="lazy">`
          }
          ${rozet}
          ${onayBtn}
          <button onclick="event.stopPropagation(); silGaleriOge('${d.id}')" class="galeri-sil-btn" style="position:absolute; top:6px; left:6px; background:rgba(220,38,38,0.9); color:white; border:none; width:26px; height:26px; border-radius:50%; cursor:pointer; opacity:0; transition:opacity 0.2s; display:grid; place-items:center;" onmouseover="this.style.opacity='1'"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
          <button onclick="event.stopPropagation(); galeriKapakYap('${d.id}')" title="Albüm kapağı yap" class="galeri-sil-btn" style="position:absolute; top:6px; left:38px; background:${d.kapak ? "#F5B301" : "rgba(15,23,42,.75)"}; color:white; border:none; width:26px; height:26px; border-radius:50%; cursor:pointer; opacity:${d.kapak ? "1" : "0"}; transition:opacity 0.2s; display:grid; place-items:center;" onmouseover="this.style.opacity='1'"><i data-lucide="star" style="width:13px;height:13px;${d.kapak ? "fill:#fff;" : ""}"></i></button>
        </div>`;
    }
    gHtml += `</div><style>.galeri-sil-btn:hover{opacity:1 !important;}div:hover > .galeri-sil-btn{opacity:0.85;}</style>`;

    if (sirali.length === 0) {
      gHtml = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:8px; margin-bottom:20px;">
        <div onclick="openGaleriYuklemeModal('foto')" style="aspect-ratio:1; border:2px dashed #c4b5fd; border-radius:12px; background:#faf5ff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer;"><div style="width:44px; height:44px; border-radius:50%; background:#ede9fe; display:grid; place-items:center; color:#7c3aed;"><i data-lucide="image-plus"></i></div><div style="font-size:12px; font-weight:700; color:#6b21a8;">Resim Ekle</div></div>
        <div onclick="openGaleriYuklemeModal('album')" style="aspect-ratio:1; border:2px dashed #c4b5fd; border-radius:12px; background:#faf5ff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer;"><div style="width:44px; height:44px; border-radius:50%; background:#ede9fe; display:grid; place-items:center; color:#7c3aed;"><i data-lucide="folder-plus"></i></div><div style="font-size:12px; font-weight:700; color:#6b21a8;">Albüm Ekle</div></div>
        <div onclick="openGaleriYuklemeModal('video')" style="aspect-ratio:1; border:2px dashed #c4b5fd; border-radius:12px; background:#faf5ff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer;"><div style="width:44px; height:44px; border-radius:50%; background:#ede9fe; display:grid; place-items:center; color:#7c3aed;"><i data-lucide="video"></i></div><div style="font-size:12px; font-weight:700; color:#6b21a8;">Video Ekle</div></div>
      </div><div style="text-align:center; color:var(--gray-500); padding:24px; font-size:13px;">Henüz içerik yok — yukarıdaki kutulardan ekleyin.</div>`;
    }
    el.innerHTML = gHtml;
    if (window.lucideYenile) setTimeout(window.lucideYenile, 30);
    return;
  }
  // ═══ /INSTAGRAM GRID ═══

  // Etkinlik/album bazında grupla
  const gruplar = {};
  for (const g of liste) {
    const anahtar = `${g.etkinlikTarih || "tarihsiz"}|${g.etkinlikBaslik || "Diğer"}|${g.hedefTur || ""}|${g.hedefDeger || ""}`;
    if (!gruplar[anahtar]) {
      gruplar[anahtar] = {
        etkinlikTarih: g.etkinlikTarih,
        etkinlikBaslik: g.etkinlikBaslik || "Diğer",
        hedefTur: g.hedefTur,
        hedefDeger: g.hedefDeger,
        hedefOgrenciAd: g.hedefOgrenciAd,
        dosyalar: []
      };
    }
    gruplar[anahtar].dosyalar.push(g);
  }

  const gruplarDizi = Object.values(gruplar).sort((a, b) => (b.etkinlikTarih || "").localeCompare(a.etkinlikTarih || ""));

  if (gruplarDizi.length === 0) {
    el.innerHTML = `
      <div style="background:white; border:2px dashed var(--gray-300); border-radius:14px; padding:40px 20px; text-align:center;">
        <div style="font-size:48px; margin-bottom:12px;"><i data-lucide="camera" style="width:15px;height:15px;vertical-align:-2px;"></i></div>
        <div style="font-family:var(--font-display); font-size:17px; color:var(--gray-700); margin-bottom:6px;">Galeri boş</div>
        <div style="font-size:13px; color:var(--gray-500); margin-bottom:16px;">İlk yüklemenizi yapın</div>
        <button class="btn-primary" onclick="openGaleriYuklemeModal()" style="background:#9333ea; border:none; color:white;">+ Yeni Yükleme</button>
      </div>
    `;
    return;
  }

  let html = `<div style="display:flex; flex-direction:column; gap:16px;">`;
  for (const grup of gruplarDizi) {
    const hedefLabel = grup.hedefTur === "tumOkul" ? "🏫 Tüm Okul"
      : grup.hedefTur === "sinif" ? `👥 ${escapeHtml(grup.hedefDeger)}`
      : `👤 ${escapeHtml(grup.hedefOgrenciAd || grup.hedefDeger || "")}`;

    const tarihStr = grup.etkinlikTarih ? new Date(grup.etkinlikTarih).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "Tarihsiz";

    const fotoSayi = grup.dosyalar.filter(d => d.dosyaTipi === "foto").length;
    const videoSayi = grup.dosyalar.filter(d => d.dosyaTipi === "video").length;

    const zipArgs = `'${grup.etkinlikBaslik.replace(/'/g, "\\'")}', '${grup.etkinlikTarih || ''}', '${grup.hedefTur || ''}', '${(grup.hedefDeger || '').replace(/'/g, "\\'")}'`;
    const eklArgs = `'${grup.etkinlikBaslik.replace(/'/g, "\\'")}', '${grup.etkinlikTarih || ''}', '${grup.hedefTur || ''}', '${(grup.hedefDeger || '').replace(/'/g, "\\'")}', '${(grup.hedefOgrenciAd || '').replace(/'/g, "\\'")}'`;

    html += `
      <div style="background:white; border:1px solid var(--gray-200); border-radius:14px; overflow:hidden;">
        <div style="padding:14px 18px; background:linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border-bottom:1px solid #e9d5ff;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-family:var(--font-display); font-size:16px; font-weight:700; color:#6b21a8;">${escapeHtml(grup.etkinlikBaslik)}</div>
              <div style="font-size:12px; color:#7c3aed; margin-top:3px;">📅 ${tarihStr} · ${hedefLabel} · ${fotoSayi > 0 ? `🖼 ${fotoSayi}` : ''} ${videoSayi > 0 ? `🎥 ${videoSayi}` : ''}</div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button onclick="albumEEkle(${eklArgs})" style="padding:7px 12px; background:#9333ea; border:none; color:white; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap;">+ İçerik Ekle</button>
              <button onclick="albumZipIndir(${zipArgs})" style="padding:7px 12px; background:white; border:1px solid #e9d5ff; color:#6b21a8; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap;"><i data-lucide="package" style="width:13px;height:13px;vertical-align:-2px;"></i> ZIP İndir</button>
            </div>
          </div>
        </div>
        <div style="padding:12px; display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px;">
    `;

    for (const d of grup.dosyalar) {
      const previewUrl = d.dosyaTipi === "video" ? d.kucukResim : d.bunnyUrl;
      // FAZ 4b: Onay durumu
      const durum = d.durum || "onaylandi"; // eski kayıtlar onaylı sayılır
      const onayliMi = durum === "onaylandi";
      const reddedildiMi = durum === "reddedildi";
      // Yönetim mi? (onaylama yetkisi)
      const yonetimMi = B.yoneticiMi() ||
                        (typeof B.rol() !== "undefined" && ["kurucu_mudur","mudur"].includes(B.rol()));
      // Küçük önizleme için Bunny resize (mobil veri tasarrufu)
      const thumbUrl = (d.dosyaTipi === "foto" && d.bunnyUrl) ? d.bunnyUrl + "?width=400" : previewUrl;

      // Durum rozeti (sadece onaylı değilse göster)
      let durumRozet = "";
      if (durum === "onayBekliyor") {
        durumRozet = `<div style="position:absolute; top:6px; right:6px; background:#f59e0b; color:white; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700;">⏳ Onay Bekliyor</div>`;
      } else if (reddedildiMi) {
        durumRozet = `<div style="position:absolute; top:6px; right:6px; background:#dc2626; color:white; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700;">✕ Reddedildi</div>`;
      }

      // Müdür onay butonları (sadece onay bekleyenlerde + yönetim görür)
      let onayButonlari = "";
      if (durum === "onayBekliyor" && yonetimMi) {
        onayButonlari = `
          <div style="position:absolute; bottom:0; left:0; right:0; display:flex; gap:4px; padding:6px; background:rgba(0,0,0,0.55);">
            <button onclick="event.stopPropagation(); galeriOnayla('${d.id}')" style="flex:1; padding:8px; background:#16a34a; color:white; border:none; border-radius:7px; font-size:12px; font-weight:700; cursor:pointer;">✓ Onayla</button>
            <button onclick="event.stopPropagation(); galeriReddet('${d.id}')" style="flex:1; padding:8px; background:#dc2626; color:white; border:none; border-radius:7px; font-size:12px; font-weight:700; cursor:pointer;">✕ Reddet</button>
          </div>`;
      }

      // Onaylanmamışsa hafif soluk göster (personel görünümünde)
      const opacity = onayliMi ? "1" : "0.92";

      html += `
        <div style="position:relative; aspect-ratio:1; background:#f3f4f6; border-radius:10px; overflow:hidden; cursor:pointer; opacity:${opacity}; ${durum==='onayBekliyor'?'outline:2px solid #f59e0b;':reddedildiMi?'outline:2px solid #dc2626;':''}" onclick="acGaleriLightbox('${d.id}')">
          ${d.dosyaTipi === "video" ?
            `<img src="${escapeHtml(previewUrl)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <div style="display:none; width:100%; height:100%; background:#1f2937; color:white; align-items:center; justify-content:center; font-size:24px;">🎥</div>
             <div style="position:absolute; inset:0; background:rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center;"><div style="background:white; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px;">▶</div></div>`
            :
            `<img src="${escapeHtml(thumbUrl)}" style="width:100%; height:100%; object-fit:cover;" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCBmaWxsPSIjZjNmNGY2IiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+TuDwvdGV4dD48L3N2Zz4='">`
          }
          ${durumRozet}
          ${onayButonlari}
          <button onclick="event.stopPropagation(); silGaleriOge('${d.id}')" style="position:absolute; top:6px; left:6px; background:rgba(220,38,38,0.9); color:white; border:none; width:24px; height:24px; border-radius:50%; cursor:pointer; font-size:11px; opacity:0; transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" class="galeri-sil-btn">🗑</button>
          <button onclick="event.stopPropagation(); galeriKapakYap('${d.id}')" title="Albüm kapağı yap" class="galeri-sil-btn" style="position:absolute; top:6px; left:36px; background:${d.kapak ? "#F0B429" : "rgba(31,37,68,.75)"}; color:white; border:none; width:24px; height:24px; border-radius:50%; cursor:pointer; opacity:${d.kapak ? "1" : "0"}; transition:opacity 0.2s; display:grid; place-items:center;" onmouseover="this.style.opacity='1'"><i data-lucide="star" style="width:12px;height:12px;${d.kapak ? "fill:#fff;" : ""}"></i></button>
        </div>
      `;
    }
    html += `</div></div>`;
  }
  html += `</div><style>.galeri-sil-btn:hover{opacity:1 !important;}div:hover > .galeri-sil-btn{opacity:0.8;}</style>`;
  el.innerHTML = html;
}

// Yükleme Modalı
window.openGaleriYuklemeModal = function(mod) {
  // mod: 'foto' | 'video' | 'album' | undefined (grid ekleme kutularından gelir)
  window._galeriYuklemeMod = mod || 'foto';
  // "Yeni Yükleme" butonu tıklandıysa (albumEkleMod null ise) sıfırla
  // "Albüme Ekle" çağırmışsa albumEEkle kendi setTimeout'unda doldurur
  document.getElementById("galeriYuklemeModal").classList.add("active");
  galeriSecilenDosyalar = [];
  document.getElementById("galeriSecilenDosyalar").innerHTML = "";
  document.getElementById("galeriYuklemeIlerleme").style.display = "none";

  // Alanları sıfırla
  const etkInp = document.getElementById("galeriEtkinlik");
  const tarInp = document.getElementById("galeriEtkinlikTarih");
  const hedefSel = document.getElementById("galeriHedefTur");
  galeriKategoriSecimDoldur().catch(e => console.warn("kategori", e));
  const sinifSel = document.getElementById("galeriHedefSinif");
  const ogrSel = document.getElementById("galeriHedefOgrenci");
  const aciklamaTxt = document.getElementById("galeriAciklama");

  // Kilit sıfırlama (düzenlemeden normal moda geçiş)
  if (etkInp) { etkInp.readOnly = false; etkInp.style.background = ""; etkInp.style.cursor = ""; }
  if (tarInp) { tarInp.readOnly = false; tarInp.style.background = ""; tarInp.style.cursor = ""; }
  if (hedefSel) { hedefSel.disabled = false; hedefSel.style.background = ""; hedefSel.style.cursor = ""; }
  if (sinifSel) { sinifSel.disabled = false; sinifSel.style.background = ""; sinifSel.style.cursor = ""; }
  if (ogrSel) { ogrSel.disabled = false; ogrSel.style.background = ""; ogrSel.style.cursor = ""; }

  // Başlık sıfırla (moda göre)
  const header = document.querySelector("#galeriYuklemeModal .modal-header h3");
  const fileInp = document.getElementById("galeriFileInput");
  if (mod === 'video') {
    if (header) header.innerHTML = `<i data-lucide="video"></i> Video Yükle`;
    if (fileInp) fileInp.setAttribute("accept", "video/*");
  } else if (mod === 'album') {
    if (header) header.innerHTML = `<i data-lucide="folder-plus"></i> Yeni Albüm`;
    if (fileInp) fileInp.setAttribute("accept", "image/*,video/*");
  } else {
    if (header) header.innerHTML = `<i data-lucide="image-plus"></i> Resim Yükle`;
    if (fileInp) fileInp.setAttribute("accept", "image/*");
  }
  if (window.lucideYenile) setTimeout(window.lucideYenile, 40);

  // Mail checkbox alanını geri getir
  const mailAlan = document.querySelector("#galeriMailGonder")?.closest(".form-group");
  if (!document.getElementById("galeriMailGonder")) {
    // albumEEkle tarafından değiştirilmişse yeniden ekle
    const placeholderDiv = document.querySelector("#galeriYuklemeModal .modal-body .form-grid.full:last-of-type");
    if (placeholderDiv) {
      const grp = placeholderDiv.querySelector(".form-group");
      if (grp && grp.innerHTML.includes("bildirim olarak gösterilir")) {
        grp.innerHTML = `
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
            <input type="checkbox" id="galeriMailGonder" style="width:18px; height:18px;">
            <span><i data-lucide="mail" style="width:13px;height:13px;vertical-align:-2px;"></i> Yükleme tamamlandıktan sonra hedef velilere bildirim maili gönder</span>
          </label>
          <div class="field-hint" style="margin-left:28px;">Veliler "Yeni fotoğraflar eklendi" maili alır ve portal galerisine yönlendirilir.</div>
        `;
      }
    }
  }

  // Buton sıfırla
  const btn = document.getElementById("btnGaleriYukle");
  if (btn) {
    btn.textContent = "🚀 Yükle";
    btn.onclick = galeriYukle;
  }

  // Varsayılan değerler (sadece yeni yüklemede)
  if (!albumEkleMod) {
    if (etkInp) etkInp.value = "";
    if (tarInp) tarInp.value = isoTarih(new Date());
    if (aciklamaTxt) aciklamaTxt.value = "";
    if (hedefSel) hedefSel.value = "tumOkul";
  }

  galeriHedefDegisti();
  doldurGaleriOgrenciSecici();
};

window.closeGaleriYuklemeModal = function() {
  document.getElementById("galeriYuklemeModal").classList.remove("active");
  albumEkleMod = null; // Modu temizle
};

window.galeriHedefDegisti = function() {
  const h = document.getElementById("galeriHedefTur").value;
  document.getElementById("galeriHedefSinifWrap").style.display = h === "sinif" ? "block" : "none";
  document.getElementById("galeriHedefOgrenciWrap").style.display = h === "ogrenci" ? "block" : "none";
};

function doldurGaleriOgrenciSecici() {
  const sel = document.getElementById("galeriHedefOgrenci");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Öğrenci Seçin --</option>';
  const aktif = B.ogrenciler().filter(o => getOgrenciDurum(o, B.ayarlar()[o.id]) === "aktif");
  aktif.sort((a, b) => (a.ogrenciAdSoyad || "").localeCompare(b.ogrenciAdSoyad || ""));
  for (const o of aktif) {
    const sinif = (B.ayarlar()[o.id]?.kayit?.sinif) || o.sinif || "";
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = `${o.ogrenciAdSoyad || ""}${sinif ? ` (${sinif})` : ""}`;
    opt.dataset.ad = o.ogrenciAdSoyad || "";
    sel.appendChild(opt);
  }
}

// Drag & Drop
window.galeriDragOver = function(e) {
  e.preventDefault();
  document.getElementById("galeriDropZone").style.background = "#f3e8ff";
  document.getElementById("galeriDropZone").style.borderColor = "#9333ea";
};

window.galeriDragLeave = function(e) {
  e.preventDefault();
  document.getElementById("galeriDropZone").style.background = "#faf5ff";
  document.getElementById("galeriDropZone").style.borderColor = "#c084fc";
};

window.galeriDrop = function(e) {
  e.preventDefault();
  galeriDragLeave(e);
  const files = Array.from(e.dataTransfer.files);
  galeriDosyalarEkle(files);
};

window.galeriDosyalarSecildi = function(e) {
  // Çoklu seçimde bu bir ALBÜM olur — kullanıcıya açıkça belirt
  setTimeout(function () {
    try {
      const sayi = (galeriSecilenDosyalar || []).length;
      const not = document.getElementById("galeriAlbumNot");
      const etk = document.getElementById("galeriEtkinlik");
      if (not) {
        not.style.display = sayi > 1 ? "flex" : "none";
        not.innerHTML = sayi > 1
          ? `<i data-lucide="folder-plus" style="width:15px;height:15px;color:#6B4FB6;flex-shrink:0;"></i>
             <span><b>${sayi} dosya seçildi.</b> Bunlar tek bir <b>albüm</b> olarak kaydedilecek.
             Aşağıdaki <b>Etkinlik / Albüm Adı</b> albümün adı olacak.</span>` : "";
      }
      if (etk && sayi > 1 && !etk.value) etk.focus();
      if (window.lucideYenile) setTimeout(window.lucideYenile, 30);
    } catch (e) {}
  }, 60);

  const files = Array.from(e.target.files);
  galeriDosyalarEkle(files);
};

function galeriDosyalarEkle(files) {
  for (const f of files) {
    // Max 500MB kontrolü
    if (f.size > 500 * 1024 * 1024) {
      showToast(`${f.name} çok büyük (max 500MB)`, "error");
      continue;
    }
    galeriSecilenDosyalar.push(f);
  }
  renderGaleriSecilenDosyalar();
}

function renderGaleriSecilenDosyalar() {
  const el = document.getElementById("galeriSecilenDosyalar");
  if (galeriSecilenDosyalar.length === 0) { el.innerHTML = ""; return; }

  let html = `<div style="background:#faf5ff; border:1px solid #e9d5ff; border-radius:10px; padding:12px; margin-top:12px;">
    <div style="font-size:13px; font-weight:600; color:#6b21a8; margin-bottom:8px;">📂 ${galeriSecilenDosyalar.length} dosya seçildi:</div>
    <div style="display:flex; flex-direction:column; gap:4px;">`;
  for (let i = 0; i < galeriSecilenDosyalar.length; i++) {
    const f = galeriSecilenDosyalar[i];
    const boyutMB = (f.size / 1024 / 1024).toFixed(1);
    const tip = f.type.startsWith("video/") ? "🎥" : "🖼";
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 10px; background:white; border-radius:8px; font-size:12px;">
        <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${tip} ${escapeHtml(f.name)}</div>
        <div style="color:var(--gray-500); font-size:11px;">${boyutMB} MB</div>
        <button onclick="galeriDosyaKaldir(${i})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:14px;">×</button>
      </div>
    `;
  }
  html += `</div></div>`;
  el.innerHTML = html;
}

window.galeriDosyaKaldir = function(index) {
  galeriSecilenDosyalar.splice(index, 1);
  renderGaleriSecilenDosyalar();
};

// YÜKLE
window.galeriYukle = async function() {
  if (galeriSecilenDosyalar.length === 0) return showToast("Dosya seçin", "error");

  const etkinlik = document.getElementById("galeriEtkinlik").value.trim() || "Genel";
  const etkinlikTarih = document.getElementById("galeriEtkinlikTarih").value || isoTarih(new Date());
  const aciklama = document.getElementById("galeriAciklama").value.trim();
  const hedefTur = document.getElementById("galeriHedefTur").value;

  let hedefDeger = "", hedefOgrenciAd = "";
  if (hedefTur === "sinif") {
    hedefDeger = document.getElementById("galeriHedefSinif").value;
    if (!hedefDeger) return showToast("Sınıf seçin", "error");
    // Öğretmen yalnızca atandığı sınıfa yükleyebilir
    if (B.rol() === "ogretmen" && typeof sinifGorunur === "function" && !sinifGorunur(hedefDeger)) {
      return showToast("Yalnızca kendi sınıfınıza medya yükleyebilirsiniz", "error");
    }
  } else if (hedefTur === "ogrenci") {
    hedefDeger = document.getElementById("galeriHedefOgrenci").value;
    if (!hedefDeger) return showToast("Öğrenci seçin", "error");
    const sel = document.getElementById("galeriHedefOgrenci");
    hedefOgrenciAd = sel.options[sel.selectedIndex]?.dataset?.ad || "";
  }

  const btn = document.getElementById("btnGaleriYukle");
  btn.disabled = true;
  btn.textContent = "⏳ Yükleniyor...";
  document.getElementById("galeriYuklemeIlerleme").style.display = "block";
  document.getElementById("galeriYuklemeToplam").textContent = galeriSecilenDosyalar.length;

  // Klasör path: galeri/{hedefTur}/{hedefDeger}/{etkinlikTarih}-{etkinlikBaslik}/
  const hedefPath = hedefTur === "tumOkul" ? "tumOkul"
    : `${hedefTur}/${hedefDeger}`.replace(/\s+/g, "-");
  const etkinlikSlug = (etkinlikTarih + "-" + etkinlik).replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\-]/g, "-").replace(/-+/g, "-").toLowerCase();
  const klasorPath = `galeri/${hedefPath}/${etkinlikSlug}`;

  let basarili = 0, hatali = 0;
  for (let i = 0; i < galeriSecilenDosyalar.length; i++) {
    const f = galeriSecilenDosyalar[i];
    document.getElementById("galeriYuklemeDurum").textContent = `${f.name}...`;
    document.getElementById("galeriYuklemeSayac").textContent = i + 1;

    try {
      let oge = {
        etkinlikBaslik: etkinlik,
        kategori: (document.getElementById("galeriKategori") || {}).value || "",
        etkinlikTarih,
        aciklama,
        hedefTur, hedefDeger, hedefOgrenciAd,
        // Öğrenci hedefliyse id'yi ayrıca yaz — okuma tarafı iki adı da destekler
        hedefOgrenciId: (hedefTur === "ogrenci" ? hedefDeger : ""),
        yukleyen: B.kullanici().email,
        yuklemeZamani: new Date().toISOString(),
        dosyaBoyutu: f.size,
        orjinalAd: f.name,
        donem: B.donem()
      };

      if (f.type.startsWith("video/")) {
        // VİDEO - henüz aktif değil (sonraki fazda güvenli Stream proxy ile gelecek)
        showToast("Video yükleme yakında eklenecek. Şimdilik sadece fotoğraf.", "warn");
        hatali++;
        continue;
      } else if (f.type.startsWith("image/")) {
        // FOTOĞRAF - sıkıştır ve GÜVENLİ proxy üzerinden yükle (medya.js)
        const sikistirilmis = await resimSikistir(f, 1920, 0.85);
        // medyaYukle proxy'ye gönderir, API key tarayıcıda görünmez
        const sonuc = await medyaYukle(sikistirilmis, klasorPath);
        oge.dosyaTipi = "foto";
        oge.bunnyUrl = sonuc.url;
        oge.kucukResim = sonuc.url; // fotoğraf için aynı (thumbnail Bunny ?width ile)
        oge.bunnyPath = sonuc.yol;
        oge.dosyaBoyutu = sikistirilmis.size;
      } else {
        hatali++;
        continue;
      }

      // MEDYA ONAY SİSTEMİ
      // Kural: Yönetim (kurucu müdür / müdür / koordinatör) yüklerse zaten
      // onay makamı olduğu için doğrudan yayınlanır.
      // Öğretmen KENDİ sınıfına yüklerse de doğrudan yayınlanır — aksi halde
      // fotoğraflar veliye hiç ulaşmıyordu. Diğer tüm durumlar onay bekler.
      const yonetimRolu = ["kurucu_mudur", "mudur", "egitim_koordinator"].includes(B.rol()) || B.yoneticiMi();
      const kendiSinifi = B.rol() === "ogretmen" &&
                          hedefTur === "sinif" &&
                          (typeof sinifGorunur === "function" ? sinifGorunur(hedefDeger) : false);
      const dogrudanYayin = yonetimRolu || kendiSinifi;

      oge.durum = dogrudanYayin ? "onaylandi" : "onayBekliyor";
      oge.onaylayanEmail = dogrudanYayin ? (B.kullanici()?.email || "") : "";
      oge.onayTarihi = dogrudanYayin ? new Date().toISOString() : "";

      // Firestore'a metadata kaydet
      const ref = doc(collection(db, "galeri"));
      await setDoc(ref, oge, { merge: true });
      basarili++;

      const toplam = ((i + 1) / galeriSecilenDosyalar.length) * 100;
      document.getElementById("galeriYuklemeBar").style.width = `${toplam}%`;
    } catch (e) {
      console.error("Yükleme hatası:", e);
      hatali++;
      // Proxy 404 / HTML dönerse "not valid JSON" hatası gelir.
      // Kullanıcı sebebini görsün, sessizce kaybolmasın.
      const m = String(e && e.message || "");
      if (m.includes("not valid JSON") || m.includes("Unexpected token")) {
        window._galeriProxyHatasi = true;
      }
    }
  }

  document.getElementById("galeriYuklemeDurum").textContent = `✓ ${basarili} başarılı${hatali > 0 ? `, ${hatali} hatalı` : ''}`;
  if (window._galeriProxyHatasi) {
    window._galeriProxyHatasi = false;
    const du = document.getElementById("galeriYuklemeDurum");
    if (du) du.innerHTML = `<span style="color:#DC2626;">Medya sunucusuna ulaşılamadı.</span>`;
    showToast("Medya sunucusuna ulaşılamıyor. Yönetici: BCKA-Medya Apps Script dağıtımını kontrol edin.", "error");
    if (btn) { btn.disabled = false; btn.textContent = eskiMetin || "Yükle"; }
    return;
  }
  showToast(`✓ ${basarili} dosya yüklendi${hatali > 0 ? ` (${hatali} hatalı)` : ''}`);
  // Onay bekleyen yükleme yapıldıysa kullanıcı bunu bilsin
  try {
    const sonDurum = document.getElementById("galeriYuklemeDurum");
    const yonetimR = ["kurucu_mudur", "mudur", "egitim_koordinator"].includes(B.rol()) || B.yoneticiMi();
    const kendiS = B.rol() === "ogretmen" && hedefTur === "sinif" &&
                   (typeof sinifGorunur === "function" ? sinifGorunur(hedefDeger) : false);
    if (sonDurum && !(yonetimR || kendiS)) {
      sonDurum.innerHTML = `✓ ${basarili} dosya yüklendi · <span style="color:#B45309;">yönetim onayından sonra velilere görünecek</span>`;
    } else if (sonDurum) {
      sonDurum.innerHTML = `✓ ${basarili} dosya yüklendi · <span style="color:#2D7A2D;">veliler görebiliyor</span>`;
    }
  } catch (e) {}

  // Yüklenen dosyaların sayısını hesapla
  const fotoSayisi = galeriSecilenDosyalar.filter(f => f.type.startsWith("image/")).length;
  const videoSayisi = galeriSecilenDosyalar.filter(f => f.type.startsWith("video/")).length;

  // Mail bildirim kontrolü (opsiyonel - YENİ yükleme modunda)
  const mailGonder = document.getElementById("galeriMailGonder")?.checked;

  if (albumEkleMod && basarili > 0) {
    // MEVCUT ALBÜME EKLEME: Sistem bildirimi oluştur (mail GİTMEZ)
    document.getElementById("galeriYuklemeDurum").textContent = "🔔 Veli bildirimleri oluşturuluyor...";
    await galeriGuncellemeBildirimi({
      etkinlikBaslik: etkinlik,
      etkinlikTarih,
      hedefTur,
      hedefDeger,
      hedefOgrenciAd: albumEkleMod.hedefOgrenciAd,
      fotoSayisi,
      videoSayisi
    });
  } else if (mailGonder && basarili > 0) {
    // YENİ YÜKLEME: Mail gönder
    document.getElementById("galeriYuklemeDurum").innerHTML = `<i data-lucide="mail" style="width:13px;height:13px;vertical-align:-2px;"></i> Velilere mail gönderiliyor...`; window.lucideYenile && window.lucideYenile();
    await galeriBildirimMailGonder({
      etkinlikBaslik: etkinlik,
      etkinlikTarih,
      aciklama,
      hedefTur,
      hedefDeger,
      dosyaSayisi: basarili,
      fotoSayisi,
      videoSayisi
    });
  }

  btn.textContent = "Kapat";
  btn.onclick = closeGaleriYuklemeModal;
  btn.disabled = false;
  renderGaleri();
};

// Lightbox
let aktifLightboxOge = null;

window.acGaleriLightbox = function(id) {
  const oge = galeriListesiVerisi.find(g => g.id === id);
  if (!oge) return;
  aktifLightboxOge = oge;
  document.getElementById("galeriLightbox").classList.add("active");

  const icerik = document.getElementById("galeriLightboxIcerik");
  if (oge.dosyaTipi === "video") {
    icerik.innerHTML = `<iframe src="${escapeHtml(oge.bunnyUrl)}?autoplay=true" style="width:90vw; max-width:1200px; height:70vh; border:none; background:black;" allowfullscreen allow="autoplay"></iframe>`;
  } else {
    icerik.innerHTML = `<img src="${escapeHtml(oge.bunnyUrl)}" style="max-width:95vw; max-height:90vh; object-fit:contain;">`;
  }
};

window.closeGaleriLightbox = function() {
  document.getElementById("galeriLightbox").classList.remove("active");
  document.getElementById("galeriLightboxIcerik").innerHTML = "";
  aktifLightboxOge = null;
};

window.galeriLightboxIndir = async function() {
  if (!aktifLightboxOge) return;
  const url = aktifLightboxOge.dosyaTipi === "video" ? aktifLightboxOge.mp4Url : aktifLightboxOge.bunnyUrl;
  const btn = document.getElementById("galeriLightboxIndirBtn");

  try {
    if (btn) { btn.disabled = true; btn.textContent = "⏳ İndiriliyor..."; }

    // Dosya adını belirle
    let dosyaAdi = aktifLightboxOge.orjinalAd || "dosya";
    // Uzantıyı garanti et
    if (aktifLightboxOge.dosyaTipi === "video" && !dosyaAdi.match(/\.(mp4|mov|webm)$/i)) {
      dosyaAdi = dosyaAdi.replace(/\.[^/.]+$/, "") + ".mp4";
    } else if (aktifLightboxOge.dosyaTipi === "foto" && !dosyaAdi.match(/\.(jpg|jpeg|png|webp)$/i)) {
      dosyaAdi = dosyaAdi.replace(/\.[^/.]+$/, "") + ".jpg";
    }

    // MIME type
    const mimeType = aktifLightboxOge.dosyaTipi === "video" ? "video/mp4" : "image/jpeg";

    // Modern tarayıcılarda: "Farklı Kaydet" diyalogu göster (Chrome/Edge)
    if (window.showSaveFilePicker) {
      try {
        // Önce dosya picker'ı göster
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: dosyaAdi,
          types: [{
            description: aktifLightboxOge.dosyaTipi === "video" ? "Video Dosyası" : "Fotoğraf",
            accept: { [mimeType]: aktifLightboxOge.dosyaTipi === "video" ? [".mp4"] : [".jpg", ".jpeg", ".png"] }
          }]
        });

        // Dosyayı Bunny'den çek
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Dosya indirilemedi: " + resp.status);
        const blob = await resp.blob();

        // Kullanıcının seçtiği yere yaz
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        showToast("✓ Dosya kaydedildi");
        if (btn) { btn.disabled = false; btn.textContent = "📥 İndir"; }
        return;
      } catch (pickerErr) {
        // Kullanıcı iptal ettiyse sessizce çık
        if (pickerErr.name === "AbortError") {
          if (btn) { btn.disabled = false; btn.textContent = "📥 İndir"; }
          return;
        }
        // Başka hata varsa fallback'e geç
        console.warn("File picker hatası, fallback kullanılıyor:", pickerErr);
      }
    }

    // FALLBACK: Blob yöntemi (eski tarayıcılar / Firefox / Safari / Mobil)
    // Bu yöntem tarayıcının varsayılan indirme klasörüne kaydeder
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Dosya indirilemedi: " + resp.status);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = dosyaAdi;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Blob URL'i serbest bırak
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

    showToast("✓ İndirme başladı");
    if (btn) { btn.disabled = false; btn.textContent = "📥 İndir"; }
  } catch (e) {
    console.error("İndirme hatası:", e);
    showToast("İndirilemedi: " + e.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "📥 İndir"; }
  }
};

// Sil
window.silGaleriOge = async function(id) {
  const oge = galeriListesiVerisi.find(g => g.id === id);
  if (!oge) return;
  if (!confirm(`"${oge.orjinalAd || oge.etkinlikBaslik}" silinsin mi?`)) return;

  try {
    // Bunny'den sil
    if (oge.dosyaTipi === "video" && oge.bunnyVideoId) {
      await bunnyDeleteVideo(oge.bunnyVideoId);
    } else if (oge.dosyaTipi === "foto" && oge.bunnyPath) {
      await bunnyDeleteFile(oge.bunnyPath);
    }
    // Firestore'dan sil
    await deleteDoc(doc(db, "galeri", id));
    showToast("✗ Silindi");
    renderGaleri();
  } catch (e) {
    showToast("Silinemedi: " + e.message, "error");
  }
};

// ============ ALBÜM ZIP İNDİRME (Admin + Veli ortak) ============
// ============ MEVCUT ALBÜME İÇERİK EKLEME (Düzenleme) ============
let albumEkleMod = null; // { etkinlikBaslik, etkinlikTarih, hedefTur, hedefDeger, hedefOgrenciAd }

window.albumEEkle = function(etkinlikBaslik, etkinlikTarih, hedefTur, hedefDeger, hedefOgrenciAd) {
  albumEkleMod = { etkinlikBaslik, etkinlikTarih, hedefTur, hedefDeger: hedefDeger || "", hedefOgrenciAd: hedefOgrenciAd || "" };
  openGaleriYuklemeModal();

  // Modal'ı düzenleme moduna çevir - alanları kilitle ve doldur
  setTimeout(() => {
    // Başlığı değiştir
    const header = document.querySelector("#galeriYuklemeModal .modal-header h3");
    if (header) header.innerHTML = `✏️ Albüme İçerik Ekle`;

    // Alanları doldur + kilitle
    const etkInp = document.getElementById("galeriEtkinlik");
    const tarInp = document.getElementById("galeriEtkinlikTarih");
    const hedefSel = document.getElementById("galeriHedefTur");
    const sinifSel = document.getElementById("galeriHedefSinif");
    const ogrSel = document.getElementById("galeriHedefOgrenci");
    const mailChk = document.getElementById("galeriMailGonder");

    if (etkInp) { etkInp.value = etkinlikBaslik; etkInp.readOnly = true; etkInp.style.background = "#f3f4f6"; etkInp.style.cursor = "not-allowed"; }
    if (tarInp) { tarInp.value = etkinlikTarih; tarInp.readOnly = true; tarInp.style.background = "#f3f4f6"; tarInp.style.cursor = "not-allowed"; }
    if (hedefSel) { hedefSel.value = hedefTur; hedefSel.disabled = true; hedefSel.style.background = "#f3f4f6"; hedefSel.style.cursor = "not-allowed"; }

    galeriHedefDegisti();

    if (hedefTur === "sinif" && sinifSel) { sinifSel.value = hedefDeger; sinifSel.disabled = true; sinifSel.style.background = "#f3f4f6"; sinifSel.style.cursor = "not-allowed"; }
    if (hedefTur === "ogrenci" && ogrSel) { ogrSel.value = hedefDeger; ogrSel.disabled = true; ogrSel.style.background = "#f3f4f6"; ogrSel.style.cursor = "not-allowed"; }

    // Mail checkbox'ı kapat ve gizle (güncellemede mail gitmez, sistem bildirim yeterli)
    if (mailChk) {
      mailChk.checked = false;
      const mailLabel = mailChk.closest(".form-group");
      if (mailLabel) {
        mailLabel.innerHTML = `
          <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px 14px; font-size:12px; color:#1e40af;">
            <i data-lucide="bell" style="width:13px;height:13px;vertical-align:-2px;"></i> Güncellemeler velilere <strong>bildirim</strong> olarak gösterilir (mail gitmez).
          </div>
        `;
      }
    }

    // Buton metnini değiştir
    const btn = document.getElementById("btnGaleriYukle");
    if (btn) btn.textContent = "➕ Albüme Ekle";
  }, 50);
};

// Eski fonksiyonu güncelle - düzenleme modunu da destekleyecek
window.albumZipIndir = async function(etkinlikBaslik, etkinlikTarih, hedefTur, hedefDeger) {
  if (!window.JSZip) return showToast("ZIP kütüphanesi yüklenmedi", "error");

  // Bu albüme ait dosyaları bul
  const dosyalar = (window.galeriListesiVerisi || []).filter(g =>
    g.etkinlikBaslik === etkinlikBaslik &&
    g.etkinlikTarih === etkinlikTarih &&
    g.hedefTur === hedefTur &&
    g.hedefDeger === (hedefDeger || "")
  );

  // Veli panelinden çağrılıyorsa veliGaleriVerisi'ne bak
  const dosyalarVeli = (window.veliGaleriVerisi || []).filter(g =>
    g.etkinlikBaslik === etkinlikBaslik &&
    g.etkinlikTarih === etkinlikTarih
  );
  const tumDosyalar = dosyalar.length > 0 ? dosyalar : dosyalarVeli;

  if (tumDosyalar.length === 0) return showToast("Dosya bulunamadı", "error");

  // Büyük ZIP indirme uyarısı
  const videoSay = tumDosyalar.filter(d => d.dosyaTipi === "video").length;
  if (videoSay > 0 && !confirm(`Bu albümde ${videoSay} video var. Videolar çok büyük olabilir, indirme uzun sürebilir. Devam edilsin mi?`)) return;

  // Progress modal
  const progressId = "albumZipProgress_" + Date.now();
  const progressHtml = `
    <div class="modal-overlay active" id="${progressId}">
      <div class="modal" style="max-width:440px;">
        <div class="modal-header" style="background:linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);">
          <h3 style="color:#6b21a8;"><i data-lucide="package" style="width:13px;height:13px;vertical-align:-2px;"></i> Albüm İndiriliyor</h3>
        </div>
        <div class="modal-body">
          <div style="font-size:14px; color:var(--gray-700); margin-bottom:12px;">
            <strong>${escapeHtml(etkinlikBaslik)}</strong><br>
            <span style="font-size:12px; color:var(--gray-500);">${tumDosyalar.length} dosya</span>
          </div>
          <div style="font-size:13px; color:#6b21a8; margin-bottom:8px;">
            <span id="${progressId}_durum">Hazırlanıyor...</span>
            <span style="float:right;"><span id="${progressId}_sayac">0</span> / ${tumDosyalar.length}</span>
          </div>
          <div style="background:#f3e8ff; height:10px; border-radius:5px; overflow:hidden;">
            <div id="${progressId}_bar" style="background:#9333ea; height:100%; width:0%; transition:width 0.3s;"></div>
          </div>
          <div style="font-size:11px; color:var(--gray-500); margin-top:10px; text-align:center;">Dosyalar hazırlandıktan sonra ZIP otomatik olarak inecek</div>
        </div>
      </div>
    </div>
  `;
  const wrap = document.createElement("div");
  wrap.innerHTML = progressHtml;
  document.body.appendChild(wrap);

  try {
    const zip = new JSZip();
    let basarili = 0, hatali = 0;

    for (let i = 0; i < tumDosyalar.length; i++) {
      const d = tumDosyalar[i];
      document.getElementById(progressId + "_durum").textContent = `İndiriliyor: ${(d.orjinalAd || "dosya").substring(0, 30)}...`;
      document.getElementById(progressId + "_sayac").textContent = i + 1;

      try {
        const url = d.dosyaTipi === "video" ? d.mp4Url : d.bunnyUrl;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Fetch başarısız");
        const blob = await resp.blob();

        // Dosya adını belirle
        let dosyaAdi = d.orjinalAd || `dosya_${i + 1}`;
        if (d.dosyaTipi === "video" && !dosyaAdi.match(/\.(mp4|mov|webm)$/i)) {
          dosyaAdi = dosyaAdi.replace(/\.[^/.]+$/, "") + ".mp4";
        } else if (d.dosyaTipi === "foto" && !dosyaAdi.match(/\.(jpg|jpeg|png|webp)$/i)) {
          dosyaAdi = dosyaAdi.replace(/\.[^/.]+$/, "") + ".jpg";
        }

        // Aynı isimde birden fazla olabilir, prefix ekle
        dosyaAdi = `${String(i + 1).padStart(3, "0")}_${dosyaAdi}`;

        zip.file(dosyaAdi, blob);
        basarili++;
      } catch (e) {
        console.warn(`${d.orjinalAd} indirilemedi:`, e);
        hatali++;
      }

      // Progress
      const yuzde = ((i + 1) / tumDosyalar.length) * 100;
      document.getElementById(progressId + "_bar").style.width = `${yuzde}%`;
    }

    document.getElementById(progressId + "_durum").textContent = "ZIP oluşturuluyor...";

    // ZIP oluştur ve indir
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "STORE" // Fotoğraflar zaten sıkıştırılmış, STORE hızlı
    }, (meta) => {
      document.getElementById(progressId + "_bar").style.width = `${meta.percent}%`;
    });

    // Dosya adı
    const albumAdi = `${etkinlikBaslik || "Album"}-${etkinlikTarih || isoTarih(new Date())}`.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\-]/g, "-").replace(/-+/g, "-");

    // Modern file picker
    if (window.showSaveFilePicker) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: `${albumAdi}.zip`,
          types: [{ description: "ZIP Dosyası", accept: { "application/zip": [".zip"] } }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(zipBlob);
        await writable.close();
      } catch (pickerErr) {
        if (pickerErr.name !== "AbortError") {
          // Fallback
          saveAs(zipBlob, `${albumAdi}.zip`);
        }
      }
    } else {
      // Eski tarayıcılar - FileSaver.js
      saveAs(zipBlob, `${albumAdi}.zip`);
    }

    document.getElementById(progressId).remove();
    showToast(`✓ Albüm indirildi (${basarili} dosya${hatali > 0 ? `, ${hatali} hatalı` : ''})`);
  } catch (e) {
    console.error("ZIP hatası:", e);
    document.getElementById(progressId)?.remove();
    showToast("ZIP oluşturulamadı: " + e.message, "error");
  }
};

// ============ ADMIN GALERİ YÜKLEME - MAİL BİLDİRİMİ ============
// ============ GALERİ GÜNCELLEME SİSTEM BİLDİRİMİ ============
// Mevcut albüme içerik eklendiğinde mail değil, sistem bildirimi (bildirimler sekmesinde görünür)
async function galeriGuncellemeBildirimi(grup) {
  try {
    const { etkinlikBaslik, etkinlikTarih, hedefTur, hedefDeger, hedefOgrenciAd, fotoSayisi, videoSayisi } = grup;

    // Hedef öğrencileri topla
    const hedefOgrenciler = [];
    for (const o of B.ogrenciler()) {
      if (getOgrenciDurum(o, B.ayarlar()[o.id]) !== "aktif") continue;
      const ayar = B.ayarlar()[o.id] || {};
      const ogrSinif = (ayar.kayit?.sinif) || o.sinif || "";

      let dahil = false;
      if (hedefTur === "tumOkul") dahil = true;
      else if (hedefTur === "sinif" && ogrSinif === hedefDeger) dahil = true;
      else if (hedefTur === "ogrenci" && o.id === hedefDeger) dahil = true;

      if (dahil) hedefOgrenciler.push(o);
    }

    if (hedefOgrenciler.length === 0) return;

    // İçerik metni
    let icerikParcalari = [];
    if (fotoSayisi > 0) icerikParcalari.push(`${fotoSayisi} yeni fotoğraf`);
    if (videoSayisi > 0) icerikParcalari.push(`${videoSayisi} yeni video`);
    const icerikMetni = icerikParcalari.join(" ve ");

    const tarihStr = etkinlikTarih ? new Date(etkinlikTarih).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "";

    // Her hedef öğrencinin bildirimler alt koleksiyonuna kaydet
    for (const o of hedefOgrenciler) {
      const bildirimRef = doc(collection(db, "ogrenciler", o.id, "bildirimler"));
      await setDoc(bildirimRef, {
        tip: "galeri_guncelleme",
        baslik: `📸 ${etkinlikBaslik} albümü güncellendi`,
        icerik: `${etkinlikBaslik} albümüne ${icerikMetni} eklenmiştir.${tarihStr ? ` (Etkinlik: ${tarihStr})` : ''}`,
        etkinlikBaslik,
        etkinlikTarih,
        fotoSayisi,
        videoSayisi,
        gonderenUid: B.kullanici().uid,
        gonderenAd: "Okul Yönetimi",
        tarih: new Date().toISOString(),
        okundu: false,
        donem: B.donem()
      }, { merge: true });
    }

    showToast(`🔔 ${hedefOgrenciler.length} öğrencinin velisine bildirim gönderildi`);
  } catch (e) {
    console.warn("Galeri bildirim hatası:", e);
    showToast("Bildirim oluşturulurken hata: " + e.message, "error");
  }
}

async function galeriBildirimMailGonder(grup) {
  try {
    const { etkinlikBaslik, etkinlikTarih, aciklama, hedefTur, hedefDeger, dosyaSayisi, fotoSayisi, videoSayisi } = grup;

    // Hedef velileri topla
    const hedefMailler = [];
    for (const o of B.ogrenciler()) {
      if (getOgrenciDurum(o, B.ayarlar()[o.id]) !== "aktif") continue;
      const ayar = B.ayarlar()[o.id] || {};
      const ogrSinif = (ayar.kayit?.sinif) || o.sinif || "";

      let dahil = false;
      if (hedefTur === "tumOkul") dahil = true;
      else if (hedefTur === "sinif" && ogrSinif === hedefDeger) dahil = true;
      else if (hedefTur === "ogrenci" && o.id === hedefDeger) dahil = true;

      if (!dahil) continue;

      const anne = ayar.anne || {};
      const baba = ayar.baba || {};
      if (anne.eposta) hedefMailler.push({ mail: anne.eposta, ad: anne.adSoyad || "Anne", ogrAd: o.ogrenciAdSoyad });
      if (baba.eposta) hedefMailler.push({ mail: baba.eposta, ad: baba.adSoyad || "Baba", ogrAd: o.ogrenciAdSoyad });
    }

    if (hedefMailler.length === 0) {
      showToast("Mail gönderilecek veli bulunamadı", "info");
      return;
    }

    const hedefLabel = hedefTur === "tumOkul" ? "tüm okul" : hedefTur === "sinif" ? `${hedefDeger} sınıfı` : "özel";
    const tarihStr = etkinlikTarih ? new Date(etkinlikTarih).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "";

    for (const v of hedefMailler) {
      const icerik = `
        <p style="margin:0 0 14px; font-size:15px;">Sayın <strong>${escapeHtml(v.ad)}</strong>,</p>

        <div style="background:#faf5ff; border-left:4px solid #9333ea; border-radius:8px; padding:18px 22px; margin:16px 0;">
          <div style="font-size:12px; font-weight:700; color:#6b21a8; letter-spacing:0.5px; margin-bottom:8px;"><i data-lucide="camera" style="width:13px;height:13px;vertical-align:-2px;"></i> YENİ GALERİ EKLENDİ</div>
          <h3 style="margin:0 0 10px; color:var(--gray-800); font-size:20px;">${escapeHtml(etkinlikBaslik)}</h3>
          ${tarihStr ? `<div style="font-size:13px; color:#6b7280; margin-bottom:10px;">📅 ${tarihStr}</div>` : ''}
          <div style="font-size:14px; color:#374151; line-height:1.7;">
            ${hedefLabel} için yeni fotoğraf ve videolar galeriye eklendi:
          </div>
          <div style="background:white; border-radius:8px; padding:12px; margin-top:12px; display:flex; gap:16px; font-size:14px; color:#374151;">
            ${fotoSayisi > 0 ? `<div>🖼 <strong>${fotoSayisi}</strong> fotoğraf</div>` : ''}
            ${videoSayisi > 0 ? `<div>🎥 <strong>${videoSayisi}</strong> video</div>` : ''}
          </div>
          ${aciklama ? `<div style="font-size:13px; color:#4b5563; line-height:1.6; margin-top:12px; padding-top:10px; border-top:1px dashed #e9d5ff;">${escapeHtml(aciklama)}</div>` : ''}
        </div>

        <div style="text-align:center; margin:20px 0;">
          <a href="https://portal.bircicekkoleji.com" style="display:inline-block; background:#9333ea; color:white; text-decoration:none; padding:12px 28px; border-radius:10px; font-weight:700; font-size:14px;"><i data-lucide="camera" style="width:13px;height:13px;vertical-align:-2px;"></i> Galeriyi Görüntüle</a>
        </div>

        <p style="margin:16px 0 0; font-size:13px; color:#6b7280; line-height:1.7; border-top:1px solid #e5e7eb; padding-top:14px;">
          Portal'a girip <strong>Galeri</strong> sekmesinden tüm fotoğraflara erişebilir, albümü tek seferde ZIP olarak indirebilirsiniz.
        </p>

        <p style="margin:16px 0 0; font-size:13px; color:#374151;">
          Saygılarımızla,<br>
          <strong>Bir Çiçek Koleji Anaokulu</strong>
        </p>
      `;

      await brevoMail({
        to: v.mail, toName: v.ad,
        subject: `<i data-lucide="camera" style="width:13px;height:13px;vertical-align:-2px;"></i> Yeni Fotoğraflar: ${etkinlikBaslik} - Bir Çiçek Koleji`,
        htmlContent: portalMailSablon(etkinlikBaslik, icerik, "Portal'daki galeriye yeni içerik eklendi.")
      });
      await new Promise(r => setTimeout(r, 300));
    }

    showToast(`📧 ${hedefMailler.length} veliye mail gönderildi`);
  } catch (e) {
    console.warn("Galeri mail hatası:", e);
  }
}

// ============ VELİ GALERİ (Tur 5B) ============
let veliGaleriVerisi = [];
let aktifVeliGaleriFilter = "tumu";
let veliGaleriAktifCocuk = "hepsi"; // "hepsi" veya ogrenciId


// ═══════════════════════════════════════════════════════════════════
// GALERİ TEŞHİS — konsoldan galeriTeshis() ile çalıştırılır
// Kaydın oluşup oluşmadığını ve veli filtresinin neden elediğini gösterir.
// ═══════════════════════════════════════════════════════════════════
window.galeriTeshis = async function() {
  console.log("═══ GALERİ TEŞHİS ═══");
  try {
    // Veli yalnızca onaylı kayıtları listeleyebilir (Rules şartı).
    // Personel tümünü görebilir.
    const personelMi = (typeof B.rol() !== "undefined" && B.rol()) ||
                       B.yoneticiMi();
    const snap = personelMi
      ? await getDocs(collection(db, "galeri"))
      : await getDocs(query(collection(db, "galeri"), where("durum", "==", "onaylandi")));
    const hepsi = [];
    snap.forEach(d => hepsi.push({ id: d.id, ...d.data() }));
    console.log("1) okunabilen kayıt sayısı:", hepsi.length, personelMi ? "(personel: tümü)" : "(veli: yalnızca onaylı)");

    if (!hepsi.length) {
      console.log("   → HİÇ KAYIT YOK. Yükleme Firestore'a hiç yazmamış.");
      console.log("   → Sebep: proxy yanıtı okunamıyor (echo 404) veya yükleme hata veriyor.");
      return;
    }

    hepsi.sort((a, b) => String(b.yuklenmeTarihi || b.olusturuldu || "").localeCompare(String(a.yuklenmeTarihi || a.olusturuldu || "")));
    console.log("2) Son 5 kayıt:");
    hepsi.slice(0, 5).forEach((g, i) => {
      console.log(`   [${i + 1}]`,
        "durum:", g.durum,
        "| hedefTur:", g.hedefTur,
        "| hedefDeger:", g.hedefDeger || "-",
        "| albüm:", g.etkinlikBaslik || "-",
        "| url:", g.bunnyUrl ? "VAR" : "YOK");
    });

    // Veli tarafı filtresi neden eliyor?
    const o = B.veliAktifOgrenci() || null;
    if (!o) {
      console.log("3) Veli oturumu değil (aktif öğrenci yok). Veli hesabıyla tekrar çalıştırın.");
      return;
    }
    const sinifim = o.sinif || o.sinifi || "";
    console.log("3) Çocuk:", o.ogrenciAdSoyad, "| sınıfı:", sinifim);

    const n = (x) => (sinifAdiResmiEsle(x) || "")
      .toString().toLocaleLowerCase("tr").replace(/\s+/g, "");

    console.log("4) Her kayıt için karar:");
    hepsi.slice(0, 10).forEach(g => {
      const sebepler = [];
      if (g.durum !== "onaylandi") sebepler.push("durum=" + g.durum + " (onaylandi değil)");
      if (g.hedefTur === "sinif" && n(g.hedefDeger) !== n(sinifim))
        sebepler.push(`sınıf uyuşmuyor ("${g.hedefDeger}" ≠ "${sinifim}")`);
      if (g.hedefTur === "ogrenci" && g.hedefOgrenciId !== o.id)
        sebepler.push("başka öğrenciye ait");
      if (!g.bunnyUrl) sebepler.push("bunnyUrl boş");
      console.log("   ", (g.etkinlikBaslik || g.id).substring(0, 30),
        sebepler.length ? "→ GİZLENİYOR: " + sebepler.join(", ") : "→ GÖRÜNMELİ");
    });
  } catch (e) {
    console.error("Teşhis hatası:", e.message);
    console.log("→ Firestore okuma izni sorunu olabilir.");
  }
};


window.veliGaleriKategoriSec = function(k) {
  window._veliGaleriKategori = k;
  veliRenderGaleri();
};

async function veliRenderGaleri() {
  // İki farklı galeri ekranı var (ana ekran kartı ve sekme paneli).
  // Hangisi açıksa onun kapsayıcısına çiziyoruz.
  const el = document.getElementById("caGaleriListesi")
          || document.getElementById("veliGaleriListesi");
  if (!el) return;
  el.innerHTML = `<div style="padding:30px; text-align:center; color:var(--gray-500); font-size:13px;">Yükleniyor...</div>`;

  try {
    // Rules gereği liste sorgusunda durum filtresi ZORUNLU
    const snap = await getDocs(query(collection(db, "galeri"),
                                     where("durum", "==", "onaylandi")));
    let hepsi = [];
    snap.forEach(d => hepsi.push({ id: d.id, ...d.data() }));

    // Veliye görünürlük filtresi
    const o = B.veliAktifOgrenci() || null;
    const sinifim = o ? (o.sinif || o.sinifi || "") : "";
    const n = (x) => (sinifAdiResmiEsle(x) || "")
      .toString().toLocaleLowerCase("tr").replace(/\s+/g, "");

    hepsi = hepsi.filter(g => {
      if (!g.bunnyUrl) return false;
      if (g.hedefTur === "tumOkul") return true;
      if (g.hedefTur === "sinif")   return n(g.hedefDeger) === n(sinifim);
      if (g.hedefTur === "ogrenci") return o && (g.hedefOgrenciId || g.hedefDeger) === o.id;
      return false;
    });

    // Hedef kitle filtresi (Tümü / Size Özel / Sınıf / Tüm Okul)
    const f = (typeof veliGaleriAktifFiltre !== "undefined" && veliGaleriAktifFiltre) || "tumu";
    let liste = hepsi;
    if (f === "ozel")  liste = hepsi.filter(g => g.hedefTur === "ogrenci");
    if (f === "sinif") liste = hepsi.filter(g => g.hedefTur === "sinif");
    if (f === "okul")  liste = hepsi.filter(g => g.hedefTur === "tumOkul");

    // KATEGORİ filtresi (Tümü / Etkinlikler / Orman / Sanat / Oyun …)
    const kategoriler = await galeriKategorileriYukle();
    const kullanilan = kategoriler.filter(k => hepsi.some(g => g.kategori === k));
    const aktifKat = window._veliGaleriKategori || "tumu";
    if (aktifKat !== "tumu") liste = liste.filter(g => g.kategori === aktifKat);

    const kategoriSerit = kullanilan.length ? `
      <div style="display:flex; gap:8px; overflow-x:auto; padding:2px 2px 14px; -webkit-overflow-scrolling:touch;">
        ${[{ k: "tumu", ad: "Tümü" }, ...kullanilan.map(k => ({ k, ad: k }))].map(x => {
          const secili = aktifKat === x.k;
          return `<button onclick="veliGaleriKategoriSec('${escapeHtml(x.k).replace(/'/g, "\\'")}')"
            style="flex:0 0 auto; padding:9px 18px; border-radius:22px; cursor:pointer; font-family:inherit; font-size:13.5px; font-weight:700;
                   border:1.5px solid ${secili ? "#2B3674" : "var(--gray-200,#E2E8F0)"};
                   background:${secili ? "#2B3674" : "#fff"}; color:${secili ? "#fff" : "var(--gray-600,#475569)"};">
            ${escapeHtml(x.ad)}</button>`;
        }).join("")}
      </div>` : "";

    if (!liste.length) {
      el.innerHTML = `<div style="padding:40px 20px; text-align:center; color:var(--gray-500);">
        <i data-lucide="camera-off" style="width:36px;height:36px;opacity:.3;display:block;margin:0 auto 12px;"></i>
        <div style="font-weight:700; color:var(--gray-700); font-size:14px; margin-bottom:5px;">Henüz medya yok</div>
        <div style="font-size:13px;">Öğretmeniniz fotoğraf paylaştığında burada görünecek.</div></div>`;
      if (window.lucideYenile) setTimeout(window.lucideYenile, 40);
      return;
    }

    liste.sort((a, b) => String(b.yuklenmeTarihi || b.tarih || "").localeCompare(String(a.yuklenmeTarihi || a.tarih || "")));

    // ── ALBÜMLERE GRUPLA ──
    const albumler = {};
    liste.forEach(g => {
      const ad = g.etkinlikBaslik || "Diğer";
      if (!albumler[ad]) albumler[ad] = { ad, ogeler: [], tarih: g.etkinlikTarih || g.tarih || "", aciklama: g.aciklama || "", hedef: g.hedefDeger || "" };
      albumler[ad].ogeler.push(g);
      if (!albumler[ad].aciklama && g.aciklama) albumler[ad].aciklama = g.aciklama;
    });
    const albumListe = Object.values(albumler).sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)));

    // Albüm kapak renkleri — pastel tema
    // Tema paleti — site renk değişkenleriyle uyumlu
    const KAPAK = [
      "linear-gradient(160deg, var(--c-pink-deep), var(--c-pink-soft))",
      "linear-gradient(160deg, var(--c-green-light), var(--c-green))",
      "linear-gradient(160deg, var(--c-yellow-deep), var(--c-yellow-soft))",
      "linear-gradient(160deg, var(--c-purple-deep), var(--c-purple-soft))",
      "linear-gradient(160deg, var(--c-blue-deep), var(--c-blue-soft))",
      "linear-gradient(160deg, var(--c-peach-deep), var(--c-peach-soft))"
    ];
    const tarihGuzel = (t) => {
      if (!t) return "";
      const d = new Date(t + "T00:00:00");
      if (isNaN(d)) return t;
      const AY = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
      return d.getDate() + " " + AY[d.getMonth()] + " " + d.getFullYear();
    };

    // ── ALBÜM ŞERİDİ (yatay kaydırmalı) ──
    const albumSerit = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin:6px 2px 12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="width:30px; height:30px; border-radius:10px; background:var(--c-purple-soft); color:var(--c-purple-deep); display:flex; align-items:center; justify-content:center;">
            <i data-lucide="folder" style="width:15px;height:15px;"></i></span>
          <span style="font-weight:700; font-size:16px; color:var(--c-ink);">Albümler</span>
          <span style="background:var(--c-tint); color:var(--c-muted); padding:2px 9px; border-radius:10px; font-size:11.5px; font-weight:700;">${albumListe.length}</span>
        </div>
        <span style="font-size:12px; color:var(--c-muted);">← kaydır →</span>
      </div>
      <div style="display:flex; gap:12px; overflow-x:auto; padding:2px 2px 12px; -webkit-overflow-scrolling:touch;">
        ${albumListe.map((a, i) => {
          // Yönetimin seçtiği kapak varsa onu kullan; yoksa ilk fotoğraf
          const kapakFoto = a.ogeler.find(x => x.kapak === true)
            || a.ogeler.find(x => x.dosyaTipi === "foto")
            || a.ogeler[0];
          const kapakUrl = kapakFoto && kapakFoto.bunnyUrl ? kapakFoto.bunnyUrl + "?width=400" : "";
          const videoVar = a.ogeler.some(x => x.dosyaTipi === "video");
          return `
          <div onclick="veliAlbumAc('${escapeHtml(a.ad).replace(/'/g, "\\'")}')"
               style="flex:0 0 200px; background:#fff; border-radius:18px; overflow:hidden; box-shadow:0 3px 14px rgba(31,37,68,.10); cursor:pointer; border:1px solid var(--c-line,#EDF0F7);">
            <div style="position:relative; height:130px; background:${KAPAK[i % KAPAK.length]};">
              ${kapakUrl ? `<img src="${escapeHtml(kapakUrl)}" alt="" loading="lazy"
                style="width:100%; height:100%; object-fit:cover; display:block;"
                onerror="this.style.display='none'">` : ""}
              <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,.45), transparent 55%);"></div>
              <div style="position:absolute; left:12px; bottom:10px; color:#fff; font-size:12.5px; font-weight:700;">
                ${a.ogeler.length} ${videoVar ? "medya" : "fotoğraf"}</div>
            </div>
            <div style="padding:11px 13px; display:flex; align-items:center; gap:6px;">
              <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:13.5px; color:var(--c-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(a.ad)}</div>
                ${a.tarih ? `<div style="font-size:11.5px; color:var(--c-muted); margin-top:2px;">${escapeHtml(tarihGuzel(a.tarih))}</div>` : ""}
              </div>
              <i data-lucide="chevron-right" style="width:15px;height:15px;color:#94A3B8;flex-shrink:0;"></i>
            </div>
          </div>`;
        }).join("")}
      </div>`;

    // ── MEDYA IZGARASI (masonry) ──
    // Değişken yükseklik deseni — hepsi aynı boyda olmasın
    const ORAN = ["4 / 5", "1 / 1", "3 / 4", "4 / 3", "1 / 1", "2 / 3", "4 / 5", "3 / 2"];

    const medyaIzgara = `
      <div style="height:1px; background:var(--c-line,#E2E8F0); margin:22px 0 18px;"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin:0 2px 12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="width:30px; height:30px; border-radius:10px; background:var(--c-blue-soft); color:var(--c-green); display:flex; align-items:center; justify-content:center;">
            <i data-lucide="image" style="width:15px;height:15px;"></i></span>
          <span style="font-weight:700; font-size:16px; color:var(--c-ink);">Tüm Medya</span>
          <span style="background:var(--c-tint); color:var(--c-muted); padding:2px 9px; border-radius:10px; font-size:11.5px; font-weight:700;">${liste.length}</span>
        </div>
      </div>
      <div style="columns:3 160px; column-gap:12px;">
        ${liste.map((g, i) => {
          const url = g.bunnyUrl;
          const kucuk = g.dosyaTipi === "foto" ? url + "?width=600" : (g.kucukResim || url);
          const oran = ORAN[i % ORAN.length];
          return `
          <div onclick="veliMedyaAc(${i})"
               style="break-inside:avoid; margin-bottom:12px; border-radius:16px; overflow:hidden; position:relative; cursor:pointer;
                      background:var(--c-tint); aspect-ratio:${oran}; box-shadow:0 2px 8px rgba(31,37,68,.07);">
            <img src="${escapeHtml(kucuk)}" alt="" loading="lazy"
                 style="width:100%; height:100%; object-fit:cover; display:block;"
                 onerror="this.style.display='none';">
            ${g.dosyaTipi === "video" ? `
              <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(31,37,68,.5), transparent 45%);"></div>
              <div style="position:absolute; left:11px; bottom:9px; display:flex; align-items:center; gap:5px; color:#fff; font-size:12px; font-weight:700;">
                <i data-lucide="play" style="width:14px;height:14px;"></i>${g.sure ? escapeHtml(g.sure) : "Video"}</div>` : ""}
            ${g.kategori ? `
              <span style="position:absolute; right:9px; top:9px; background:rgba(255,255,255,.92); color:var(--c-ink); padding:3px 9px; border-radius:9px; font-size:10.5px; font-weight:700;">${escapeHtml(g.kategori)}</span>` : ""}
          </div>`;
        }).join("")}
      </div>`;

    window._veliGaleriListe = liste;
    el.innerHTML = kategoriSerit + albumSerit + medyaIzgara;
    if (window.lucideYenile) setTimeout(window.lucideYenile, 40);
  } catch (e) {
    console.error("veliRenderGaleri", e);
    el.innerHTML = `<div style="padding:30px; text-align:center; color:#991b1b; font-size:13px;">Galeri yüklenemedi: ${escapeHtml(e.message)}</div>`;
  }
}

// Albüme tıklayınca yalnızca o albümü göster
window.veliAlbumAc = function(albumAdi) {
  const liste = (window._veliGaleriListe || []).filter(g => (g.etkinlikBaslik || "Diğer") === albumAdi);
  if (!liste.length) return;
  window._veliGaleriListe = liste;
  const el = document.getElementById("caGaleriListesi")
          || document.getElementById("veliGaleriListesi");
  if (!el) return;
  el.innerHTML = `
    <button onclick="veliRenderGaleri()" style="display:inline-flex; align-items:center; gap:6px; margin-bottom:14px; padding:8px 14px; border:1px solid var(--gray-200,#E2E8F0); background:#fff; border-radius:10px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:600;">
      <i data-lucide="arrow-left" style="width:14px;height:14px;"></i> Tüm albümler</button>
    <div style="font-weight:700; font-size:17px; color:var(--gray-800,#1E293B); margin-bottom:4px;">${escapeHtml(albumAdi)}</div>
    <div style="font-size:12.5px; color:var(--gray-500); margin-bottom:14px;">${liste.length} öğe</div>
    <div style="columns:3 150px; column-gap:10px;">
      ${liste.map((g, i) => `
        <div onclick="veliMedyaAc(${i})" style="break-inside:avoid; margin-bottom:10px; border-radius:14px; overflow:hidden; cursor:pointer; background:#F1F5F9;">
          <img src="${escapeHtml(g.dosyaTipi === "foto" ? g.bunnyUrl + "?width=500" : (g.kucukResim || g.bunnyUrl))}"
               alt="" loading="lazy" style="width:100%; display:block;"
               onerror="this.parentNode.style.minHeight='120px'; this.style.display='none';">
        </div>`).join("")}
    </div>`;
  if (window.lucideYenile) setTimeout(window.lucideYenile, 40);
};

// Medyayı tam ekran aç
window.veliMedyaAc = function(i) {
  const g = (window._veliGaleriListe || [])[i];
  if (!g || !g.bunnyUrl) return;
  const eski = document.getElementById("veliMedyaArka");
  if (eski) eski.remove();
  const div = document.createElement("div");
  div.id = "veliMedyaArka";
  div.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,.92); z-index:9700; display:flex; align-items:center; justify-content:center; padding:16px;";
  div.onclick = () => div.remove();
  div.innerHTML = g.dosyaTipi === "video"
    ? `<video src="${escapeHtml(g.bunnyUrl)}" controls autoplay style="max-width:100%; max-height:90vh; border-radius:12px;"></video>`
    : `<img src="${escapeHtml(g.bunnyUrl)}" alt="" style="max-width:100%; max-height:90vh; border-radius:12px; object-fit:contain;">`;
  document.body.appendChild(div);
};

window.veliGaleriFilter = function(f) {
  aktifVeliGaleriFilter = f;
  document.querySelectorAll("[data-veli-galeri-filter]").forEach(b => {
    if (b.dataset.veliGaleriFilter === f) {
      b.style.background = "#9333ea"; b.style.color = "white"; b.style.border = "none";
    } else {
      b.style.background = ""; b.style.color = ""; b.style.border = "";
    }
  });
  renderVeliGaleri();
};

window.veliGaleriCocukSec = function(id) {
  veliGaleriAktifCocuk = id;
  document.querySelectorAll("[data-veli-galeri-cocuk]").forEach(b => {
    if (b.dataset.veliGaleriCocuk === id) {
      b.style.background = "#9333ea"; b.style.color = "white"; b.style.border = "none";
    } else {
      b.style.background = ""; b.style.color = ""; b.style.border = "";
    }
  });
  renderVeliGaleri();
};

function renderVeliGaleriCocukFiltre() {
  const el = document.getElementById("veliGaleriCocukFiltre");
  if (!el) return;
  if (!B.veliOgrencileri() || B.veliOgrencileri().length <= 1) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  let html = `<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
    <span style="font-size:12px; color:var(--gray-600); font-weight:600;">Çocuk:</span>
    <button class="btn-mini" data-veli-galeri-cocuk="hepsi" onclick="veliGaleriCocukSec('hepsi')" style="background:#9333ea; border:none; color:white;">Tümü</button>`;
  for (const o of B.veliOgrencileri()) {
    html += `<button class="btn-mini" data-veli-galeri-cocuk="${o.id}" onclick="veliGaleriCocukSec('${o.id}')">${escapeHtml(o.ogrenciAdSoyad || "")}</button>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}

function renderVeliGaleri() {
  const el = document.getElementById("veliGaleriListesi");
  if (!el) return;

  let liste = [...veliGaleriVerisi];

  // Filtre: tip
  if (aktifVeliGaleriFilter === "okul") liste = liste.filter(g => g.hedefTur === "tumOkul");
  else if (aktifVeliGaleriFilter === "sinif") liste = liste.filter(g => g.hedefTur === "sinif");
  else if (aktifVeliGaleriFilter === "ozel") liste = liste.filter(g => g.hedefTur === "ogrenci");

  // Filtre: çocuk
  if (veliGaleriAktifCocuk !== "hepsi") {
    // Sadece bu çocuğun sınıfı + özel galerileri
    const ogr = B.veliOgrencileri().find(o => o.id === veliGaleriAktifCocuk);
    if (ogr) {
      const donemVeri = ogr._donemVeri || {};
      const sinif = (donemVeri.kayit?.sinif) || ogr.sinif || "";
      liste = liste.filter(g => {
        if (g.hedefTur === "tumOkul") return true;
        if (g.hedefTur === "sinif" && g.hedefDeger === sinif) return true;
        if (g.hedefTur === "ogrenci" && g.hedefDeger === veliGaleriAktifCocuk) return true;
        return false;
      });
    }
  }

  // Etkinlik bazlı grupla
  const gruplar = {};
  for (const g of liste) {
    const anahtar = `${g.etkinlikTarih || "tarihsiz"}|${g.etkinlikBaslik || "Diğer"}|${g.hedefTur || ""}|${g.hedefDeger || ""}`;
    if (!gruplar[anahtar]) {
      gruplar[anahtar] = {
        etkinlikTarih: g.etkinlikTarih,
        etkinlikBaslik: g.etkinlikBaslik || "Diğer",
        hedefTur: g.hedefTur,
        hedefDeger: g.hedefDeger,
        hedefOgrenciAd: g.hedefOgrenciAd,
        aciklama: g.aciklama,
        dosyalar: []
      };
    }
    gruplar[anahtar].dosyalar.push(g);
  }

  const gruplarDizi = Object.values(gruplar).sort((a, b) => (b.etkinlikTarih || "").localeCompare(a.etkinlikTarih || ""));

  if (gruplarDizi.length === 0) {
    el.innerHTML = `
      <div style="background:#faf5ff; border:1px dashed #e9d5ff; border-radius:14px; padding:40px 20px; text-align:center;">
        <div style="font-size:48px; margin-bottom:12px;"><i data-lucide="camera" style="width:15px;height:15px;vertical-align:-2px;"></i></div>
        <div style="font-family:var(--font-display); font-size:16px; color:#6b21a8; margin-bottom:6px;">Bu filtrede galeri yok</div>
        <div style="font-size:13px; color:#7c3aed;">Yeni fotoğraflar eklendiğinde burada görünecek</div>
      </div>
    `;
    return;
  }

  let html = `<div style="display:flex; flex-direction:column; gap:16px;">`;
  for (const grup of gruplarDizi) {
    const hedefLabel = grup.hedefTur === "tumOkul" ? "🏫 Tüm Okul"
      : grup.hedefTur === "sinif" ? `👥 ${escapeHtml(grup.hedefDeger)}`
      : `⭐ Size Özel`;

    const tarihStr = grup.etkinlikTarih ? new Date(grup.etkinlikTarih).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "Tarihsiz";

    const fotoSayi = grup.dosyalar.filter(d => d.dosyaTipi === "foto").length;
    const videoSayi = grup.dosyalar.filter(d => d.dosyaTipi === "video").length;

    // ZIP indirme parametreleri (JSON'a çevirmek zor, args olarak verelim)
    const zipArgs = `'${grup.etkinlikBaslik.replace(/'/g, "\\'")}', '${grup.etkinlikTarih || ''}', '${grup.hedefTur || ''}', '${(grup.hedefDeger || '').replace(/'/g, "\\'")}'`;

    html += `
      <div style="background:white; border:1px solid var(--gray-200); border-radius:14px; overflow:hidden;">
        <div style="padding:14px 18px; background:linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border-bottom:1px solid #e9d5ff;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
            <div style="flex:1; min-width:220px;">
              <div style="font-family:var(--font-display); font-size:16px; font-weight:700; color:#6b21a8;">${escapeHtml(grup.etkinlikBaslik)}</div>
              <div style="font-size:12px; color:#7c3aed; margin-top:3px;">📅 ${tarihStr} · ${hedefLabel}</div>
              <div style="font-size:12px; color:#7c3aed; margin-top:2px;">${fotoSayi > 0 ? `🖼 ${fotoSayi} fotoğraf` : ''} ${videoSayi > 0 ? `· 🎥 ${videoSayi} video` : ''}</div>
              ${grup.aciklama ? `<div style="font-size:12px; color:var(--gray-600); margin-top:8px; padding-top:8px; border-top:1px dashed #e9d5ff;">${escapeHtml(grup.aciklama)}</div>` : ''}
            </div>
            <button onclick="albumZipIndir(${zipArgs})" style="padding:8px 14px; background:#9333ea; border:none; color:white; border-radius:10px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap;"><i data-lucide="package" style="width:13px;height:13px;vertical-align:-2px;"></i> Tümünü İndir</button>
          </div>
        </div>
        <div style="padding:12px; display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:8px;">
    `;

    for (const d of grup.dosyalar) {
      const previewUrl = d.dosyaTipi === "video" ? d.kucukResim : d.bunnyUrl;
      html += `
        <div style="position:relative; aspect-ratio:1; background:#f3f4f6; border-radius:10px; overflow:hidden; cursor:pointer;" onclick="veliAcGaleriLightbox('${d.id}')">
          ${d.dosyaTipi === "video" ?
            `<img src="${escapeHtml(previewUrl)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <div style="display:none; width:100%; height:100%; background:#1f2937; color:white; align-items:center; justify-content:center; font-size:24px;">🎥</div>
             <div style="position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.6); color:white; padding:3px 8px; border-radius:6px; font-size:10px;">🎥</div>
             <div style="position:absolute; inset:0; background:rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center;"><div style="background:white; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px;">▶</div></div>`
            :
            `<img src="${escapeHtml(previewUrl)}" style="width:100%; height:100%; object-fit:cover;" loading="lazy">`
          }
        </div>
      `;
    }
    html += `</div></div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}

// Veli lightbox (admin lightbox'ın aynısını kullanır)
let veliLightboxListe = [];
let veliLightboxIndex = 0;

window.veliAcGaleriLightbox = function(id) {
  const idx = veliGaleriVerisi.findIndex(g => g.id === id);
  if (idx === -1) return;
  veliLightboxListe = veliGaleriVerisi;
  veliLightboxIndex = idx;
  aktifLightboxOge = veliGaleriVerisi[idx];

  document.getElementById("galeriLightbox").classList.add("active");
  renderVeliLightbox();
};

function renderVeliLightbox() {
  const oge = veliLightboxListe[veliLightboxIndex];
  if (!oge) return;
  aktifLightboxOge = oge;

  const icerik = document.getElementById("galeriLightboxIcerik");
  if (oge.dosyaTipi === "video") {
    icerik.innerHTML = `<iframe src="${escapeHtml(oge.bunnyUrl)}?autoplay=true" style="width:90vw; max-width:1200px; height:70vh; border:none; background:black;" allowfullscreen allow="autoplay"></iframe>`;
  } else {
    icerik.innerHTML = `<img src="${escapeHtml(oge.bunnyUrl)}" style="max-width:95vw; max-height:85vh; object-fit:contain;">`;
  }
}

// ── Çekirdeğin erişimi için ──
window.loadGaleri              = loadGaleri;
window.renderGaleri            = renderGaleri;
window.veliRenderGaleri        = veliRenderGaleri;
window.galeriKategorileriYukle = galeriKategorileriYukle;
window.galeriOnayBekleyenSayisi = galeriOnayBekleyenSayisi;
console.log("Galeri modülü yüklendi.");
