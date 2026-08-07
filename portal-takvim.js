// ══════════════════════════════════════════════════════════════
// PORTAL · TAKVİM MODÜLÜ  (Yönetim takvimi + Veli app ekranları)
// --------------------------------------------------------------
// Faz 8 · index.html'den ayrıştırıldı (2026-08-07)
// Kaynak: "TAKVİM SİSTEMİ (FAZ A)" + veli yemek/etkinlik/takvim ekranları
//
// İkisi tek dosyada: veli ekranları takvim verisini ve aktif ay
// durumunu doğrudan kullanıyor, ayırmak gereksiz köprü yaratırdı.
//
// Yemek hafta yardımcıları (haftaBaslangic/haftaKodu/haftaEtiketi)
// çekirdekte kaldı — yönetim yemek ekranı da onları kullanıyor.
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
        addDoc, query, where, orderBy, serverTimestamp,
        escapeHtml, escapeHtmlGelisim, getOgrenciDurum, isoTarih,
        brevoMail, portalMailSablon, getAyListesi,
        haftaBaslangic, haftaKodu, haftaEtiketi,
        AY_ISIMLERI, YEMEK_GUNLER, YEMEK_OGUNLER, OKUL_MAIL, PORTAL_URL } = B;

// ===== TAKVİM SİSTEMİ (FAZ A) =====
// ============================================================
// Veri yapısı: takvim/{etkinlikId}
// { baslik, aciklama, tarih (YYYY-MM-DD), baslangicSaat, bitisSaat,
//   tumGun, konum, tip, hedefTur, hedefDeger, hedefOgrenciAd, arsiv,
//   olusturan, olusturuldu, guncellendi }

// TR Resmi Tatiller (2026-2027)
const RESMI_TATILLER = [
  // 2026
  { tarih: "2026-01-01", baslik: "Yılbaşı", aciklama: "Resmi tatil" },
  { tarih: "2026-03-20", baslik: "Ramazan Bayramı Arifesi (yarım gün)", aciklama: "Resmi tatil" },
  { tarih: "2026-03-21", baslik: "Ramazan Bayramı 1. Gün", aciklama: "Resmi tatil" },
  { tarih: "2026-03-22", baslik: "Ramazan Bayramı 2. Gün", aciklama: "Resmi tatil" },
  { tarih: "2026-03-23", baslik: "Ramazan Bayramı 3. Gün", aciklama: "Resmi tatil" },
  { tarih: "2026-04-23", baslik: "Ulusal Egemenlik ve Çocuk Bayramı", aciklama: "Resmi tatil" },
  { tarih: "2026-05-01", baslik: "Emek ve Dayanışma Günü", aciklama: "Resmi tatil" },
  { tarih: "2026-05-19", baslik: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", aciklama: "Resmi tatil" },
  { tarih: "2026-05-26", baslik: "Kurban Bayramı Arifesi (yarım gün)", aciklama: "Resmi tatil" },
  { tarih: "2026-05-27", baslik: "Kurban Bayramı 1. Gün", aciklama: "Resmi tatil" },
  { tarih: "2026-05-28", baslik: "Kurban Bayramı 2. Gün", aciklama: "Resmi tatil" },
  { tarih: "2026-05-29", baslik: "Kurban Bayramı 3. Gün", aciklama: "Resmi tatil" },
  { tarih: "2026-05-30", baslik: "Kurban Bayramı 4. Gün", aciklama: "Resmi tatil" },
  { tarih: "2026-07-15", baslik: "Demokrasi ve Milli Birlik Günü", aciklama: "Resmi tatil" },
  { tarih: "2026-08-30", baslik: "Zafer Bayramı", aciklama: "Resmi tatil" },
  { tarih: "2026-10-28", baslik: "Cumhuriyet Bayramı Arifesi (yarım gün)", aciklama: "Resmi tatil" },
  { tarih: "2026-10-29", baslik: "Cumhuriyet Bayramı", aciklama: "Resmi tatil" },
  // 2027
  { tarih: "2027-01-01", baslik: "Yılbaşı", aciklama: "Resmi tatil" },
  { tarih: "2027-03-10", baslik: "Ramazan Bayramı Arifesi (yarım gün)", aciklama: "Resmi tatil" },
  { tarih: "2027-03-11", baslik: "Ramazan Bayramı 1. Gün", aciklama: "Resmi tatil" },
  { tarih: "2027-03-12", baslik: "Ramazan Bayramı 2. Gün", aciklama: "Resmi tatil" },
  { tarih: "2027-03-13", baslik: "Ramazan Bayramı 3. Gün", aciklama: "Resmi tatil" },
  { tarih: "2027-04-23", baslik: "Ulusal Egemenlik ve Çocuk Bayramı", aciklama: "Resmi tatil" },
  { tarih: "2027-05-01", baslik: "Emek ve Dayanışma Günü", aciklama: "Resmi tatil" },
  { tarih: "2027-05-16", baslik: "Kurban Bayramı Arifesi (yarım gün)", aciklama: "Resmi tatil" },
  { tarih: "2027-05-17", baslik: "Kurban Bayramı 1. Gün", aciklama: "Resmi tatil" },
  { tarih: "2027-05-18", baslik: "Kurban Bayramı 2. Gün", aciklama: "Resmi tatil" },
  { tarih: "2027-05-19", baslik: "Atatürk'ü Anma, Gençlik ve Spor Bayramı + Kurban Bayramı 3. Gün", aciklama: "Resmi tatil" },
  { tarih: "2027-05-20", baslik: "Kurban Bayramı 4. Gün", aciklama: "Resmi tatil" },
  { tarih: "2027-07-15", baslik: "Demokrasi ve Milli Birlik Günü", aciklama: "Resmi tatil" },
  { tarih: "2027-08-30", baslik: "Zafer Bayramı", aciklama: "Resmi tatil" },
  { tarih: "2027-10-29", baslik: "Cumhuriyet Bayramı", aciklama: "Resmi tatil" }
];

const TAKVIM_TIP_LABEL = {
  etkinlik: "🎉 Etkinlik",
  toplanti: "👥 Toplantı",
  randevu: "📞 Randevu",
  gezi: "🚌 Gezi",
  duyuru: "📢 Duyuru",
  tatil: "🏖️ Tatil"
};

let takvimEtkinlikler = window.takvimEtkinlikler = [];
let takvimAktifAy = new Date();

async function takvimEtkinlikleriYukle(force = false) {
  if (takvimEtkinlikler.length > 0 && !force) return takvimEtkinlikler;

  // ═══ İKİ KOLEKSİYON BİRDEN OKUNUR (ZEKY app ile ortak) ═══
  // Etkinlik Yönetimi modülü "etkinlikler"e yazıyor, eski okul takvimi
  // ise "takvim"de duruyordu. Sadece "takvim" okunduğu için Etkinlik
  // Yönetimi'nden eklenen etkinlikler veli takviminde GÖRÜNMÜYORDU.
  // Artık ikisi birleştirilip tekrarlar eleniyor.
  const liste = [];
  const gorulen = new Set();

  const oku = async (koleksiyonAdi) => {
    try {
      const snap = await getDocs(collection(db, koleksiyonAdi));
      snap.forEach(d => {
        const v = d.data() || {};
        if (v.arsiv === true) return;
        const imza = (v.baslik || "") + "|" + (v.tarih || "") + "|" + (v.baslangicSaat || "");
        if (gorulen.has(imza)) return;
        gorulen.add(imza);
        liste.push({ id: d.id, kaynak: koleksiyonAdi, ...v });
      });
    } catch (e) {
      console.warn("Takvim okuma (" + koleksiyonAdi + "):", e?.message);
    }
  };

  await oku("etkinlikler");   // önce Etkinlik Yönetimi kayıtları
  await oku("takvim");        // sonra eski okul takvimi

  takvimEtkinlikler = window.takvimEtkinlikler = liste;
  return liste;
}

function takvimTumEtkinlikler() {
  const tatiller = RESMI_TATILLER.map((t, i) => ({
    id: `tatil_${i}`,
    baslik: t.baslik,
    aciklama: t.aciklama || "",
    tarih: t.tarih,
    tumGun: true,
    tip: "tatil",
    hedefTur: "tumOkul",
    sabit: true
  }));
  const aktifFirestore = takvimEtkinlikler.filter(e => !e.arsiv);
  return [...tatiller, ...aktifFirestore].sort((a, b) => {
    const t1 = a.tarih + (a.baslangicSaat || "00:00");
    const t2 = b.tarih + (b.baslangicSaat || "00:00");
    return t1.localeCompare(t2);
  });
}

function takvimAyGridRender(containerId, ay, etkinlikler, tiklamaFn) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const yil = ay.getFullYear();
  const ayNum = ay.getMonth();
  const ilkGun = new Date(yil, ayNum, 1);
  const sonGun = new Date(yil, ayNum + 1, 0);
  const ofset = (ilkGun.getDay() + 6) % 7; // Pazartesi başlangıç
  const toplamHucre = Math.ceil((ofset + sonGun.getDate()) / 7) * 7;

  const bugun = new Date();
  const bugunStr = `${bugun.getFullYear()}-${String(bugun.getMonth()+1).padStart(2,"0")}-${String(bugun.getDate()).padStart(2,"0")}`;

  let html = `
    <div class="takvim-gun-basligi">Pzt</div>
    <div class="takvim-gun-basligi">Sal</div>
    <div class="takvim-gun-basligi">Çar</div>
    <div class="takvim-gun-basligi">Per</div>
    <div class="takvim-gun-basligi">Cum</div>
    <div class="takvim-gun-basligi">Cmt</div>
    <div class="takvim-gun-basligi">Paz</div>
  `;

  for (let i = 0; i < toplamHucre; i++) {
    const gunOfset = i - ofset;
    const tarih = new Date(yil, ayNum, gunOfset + 1);
    const disAyMi = (tarih.getMonth() !== ayNum);
    const tarihStr = `${tarih.getFullYear()}-${String(tarih.getMonth()+1).padStart(2,"0")}-${String(tarih.getDate()).padStart(2,"0")}`;
    const bugunMi = (tarihStr === bugunStr);
    const haftaSonu = (tarih.getDay() === 0 || tarih.getDay() === 6);

    const gunEtkinlikleri = etkinlikler.filter(e => e.tarih === tarihStr);

    // Baskın tip belirle (rozet rengini günün arka planına yansıtmak için)
    // Öncelik: tatil > toplanti > randevu > gezi > duyuru > etkinlik
    const tipOncelik = ["tatil", "toplanti", "randevu", "gezi", "duyuru", "etkinlik"];
    let baskinTip = "";
    if (gunEtkinlikleri.length > 0) {
      for (const t of tipOncelik) {
        if (gunEtkinlikleri.some(e => e.tip === t)) { baskinTip = t; break; }
      }
      if (!baskinTip) baskinTip = gunEtkinlikleri[0].tip || "etkinlik";
    }

    const nokta = gunEtkinlikleri.slice(0, 3).map(e => `
      <div class="takvim-etkinlik-nokta-item" data-tip="${e.tip || 'etkinlik'}" title="${escapeHtml(e.baslik)}">${escapeHtml(e.baslik)}</div>
    `).join("");
    const fazla = gunEtkinlikleri.length > 3 ? `<div class="takvim-etkinlik-fazla">+${gunEtkinlikleri.length - 3} daha</div>` : "";

    const varEtkinlikClass = gunEtkinlikleri.length > 0 ? "var-etkinlik" : "";
    const baskinAttr = baskinTip ? `data-baskin-tip="${baskinTip}"` : "";

    html += `
      <div class="takvim-hucre ${disAyMi ? 'disayd' : ''} ${bugunMi ? 'bugun' : ''} ${haftaSonu ? 'haftasonu' : ''} ${varEtkinlikClass}"
           ${baskinAttr}
           onclick="${tiklamaFn}('${tarihStr}')">
        <div class="takvim-gun-num">${tarih.getDate()}</div>
        <div class="takvim-etkinlik-nokta">${nokta}</div>
        ${fazla}
      </div>
    `;
  }

  container.innerHTML = html;
}

window.takvimAyGec = function(dir) {
  takvimAktifAy.setMonth(takvimAktifAy.getMonth() + dir);
  takvimYonetimRender();
};
window.takvimBugune = function() {
  takvimAktifAy = new Date();
  takvimYonetimRender();
};

function takvimAyBasligiYaz(elId) {
  const aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const el = document.getElementById(elId);
  if (el) el.textContent = `${aylar[takvimAktifAy.getMonth()]} ${takvimAktifAy.getFullYear()}`;
}

async function takvimYonetimRender() {
  await takvimEtkinlikleriYukle();
  takvimAyBasligiYaz("takvimAyBaslik");
  const tum = takvimTumEtkinlikler();
  takvimAyGridRender("takvimGrid", takvimAktifAy, tum, "takvimGunTikla");

  const bugun = new Date();
  const bugunStr = `${bugun.getFullYear()}-${String(bugun.getMonth()+1).padStart(2,"0")}-${String(bugun.getDate()).padStart(2,"0")}`;
  const yaklasan = tum.filter(e => e.tarih >= bugunStr).slice(0, 10);

  const listeEl = document.getElementById("takvimYaklasanListe");
  if (!listeEl) return;
  if (yaklasan.length === 0) {
    listeEl.innerHTML = `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:13px;">Yaklaşan etkinlik yok. + Yeni Etkinlik ile ekleyebilirsiniz.</div>`;
    return;
  }
  listeEl.innerHTML = yaklasan.map(e => takvimEtkinlikKartHTML(e, true)).join("");

  // FAZ B: Randevu slot listesi de yenile
  try { randevuListesiRender(); } catch(e) { console.warn("randevuListesiRender:", e); }
}

function takvimEtkinlikKartHTML(e, gosterAksiyon) {
  const tarih = new Date(e.tarih);
  const aylar = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const tarihStr = `${tarih.getDate()} ${aylar[tarih.getMonth()]} ${tarih.getFullYear()}`;
  const saatStr = e.tumGun ? "Tüm gün" : (e.baslangicSaat ? `${e.baslangicSaat}${e.bitisSaat ? ' - ' + e.bitisSaat : ''}` : "");
  const hedef = e.hedefTur === "tumOkul" ? "🏫 Tüm Okul"
              : e.hedefTur === "sinif" ? `🏷️ ${escapeHtml(e.hedefDeger || "")}`
              : e.hedefTur === "ogrenci" ? `👤 ${escapeHtml(e.hedefOgrenciAd || "")}` : "";

  const aksiyon = gosterAksiyon && !e.sabit ? `
    <div style="display:flex; gap:6px; flex-shrink:0; flex-wrap:wrap;">
      <button class="takvim-aksiyon-btn" onclick="takvimEtkinlikModalAc('${e.id}')"><i data-lucide="pencil" style="width:14px;height:14px;vertical-align:-2px;"></i> Düzenle</button>
      <button class="takvim-aksiyon-btn" onclick="takvimICSIndir('${e.id}')"><i data-lucide="calendar-plus" style="width:14px;height:14px;vertical-align:-2px;"></i> Takvime Ekle</button>
    </div>` : (e.sabit ? `<span style="font-size:11px; color:#9ca3af; flex-shrink:0;">Sabit (resmi)</span>` : "");

  return `
    <div class="takvim-etkinlik-kart" data-tip="${e.tip || 'etkinlik'}">
      <div style="flex:1; min-width:0;">
        <div class="takvim-etkinlik-baslik">${escapeHtml(e.baslik)}</div>
        <div class="takvim-etkinlik-meta">
          <span>${TAKVIM_TIP_LABEL[e.tip] || e.tip}</span>
          <span>📆 ${tarihStr}</span>
          ${saatStr ? `<span>⏰ ${saatStr}</span>` : ''}
          ${e.konum ? `<span>📍 ${escapeHtml(e.konum)}</span>` : ''}
          ${hedef ? `<span>${hedef}</span>` : ''}
        </div>
        ${e.aciklama ? `<div style="font-size:12px; color:#6b7280; margin-top:6px;">${escapeHtml(e.aciklama).substring(0, 120)}${e.aciklama.length > 120 ? '...' : ''}</div>` : ''}
      </div>
      ${aksiyon}
    </div>
  `;
}

window.takvimGunTikla = function(tarihStr) {
  const tum = takvimTumEtkinlikler();
  const gunEtkinlikleri = tum.filter(e => e.tarih === tarihStr);
  if (gunEtkinlikleri.length > 0) {
    takvimEtkinlikDetayAc(gunEtkinlikleri[0]);
  } else {
    takvimEtkinlikModalAc(null, tarihStr);
  }
};

window.takvimEtkinlikModalAc = function(id, varsayilanTarih) {
  document.getElementById("takvimModal").classList.add("active");
  document.getElementById("takvimDuzenleId").value = id || "";

  if (id) {
    const e = takvimEtkinlikler.find(x => x.id === id);
    if (!e) { showToast("Etkinlik bulunamadı", "error"); return; }
    document.getElementById("takvimModalBaslik").textContent = "🗓️ Etkinliği Düzenle";
    document.getElementById("takvimBaslik").value = e.baslik || "";
    document.getElementById("takvimTip").value = e.tip || "etkinlik";
    document.getElementById("takvimTarih").value = e.tarih || "";
    document.getElementById("takvimTumGun").checked = !!e.tumGun;
    document.getElementById("takvimBaslangic").value = e.baslangicSaat || "14:00";
    document.getElementById("takvimBitis").value = e.bitisSaat || "15:00";
    document.getElementById("takvimKonum").value = e.konum || "";
    document.getElementById("takvimAciklama").value = e.aciklama || "";
    document.getElementById("takvimHedefTur").value = e.hedefTur || "tumOkul";
    if (e.hedefTur === "sinif") document.getElementById("takvimHedefSinif").value = e.hedefDeger || "";
    if (e.hedefTur === "ogrenci") document.getElementById("takvimHedefOgrenci").value = e.hedefDeger || "";
    document.getElementById("takvimSilBtn").style.display = "inline-block";
  } else {
    document.getElementById("takvimModalBaslik").textContent = "🗓️ Yeni Etkinlik";
    document.getElementById("takvimBaslik").value = "";
    document.getElementById("takvimTip").value = "etkinlik";
    document.getElementById("takvimTarih").value = varsayilanTarih || new Date().toISOString().slice(0,10);
    document.getElementById("takvimTumGun").checked = false;
    document.getElementById("takvimBaslangic").value = "14:00";
    document.getElementById("takvimBitis").value = "15:00";
    document.getElementById("takvimKonum").value = "";
    document.getElementById("takvimAciklama").value = "";
    document.getElementById("takvimHedefTur").value = "tumOkul";
    document.getElementById("takvimSilBtn").style.display = "none";
  }

  takvimHedefDegisti();
  takvimTumGunToggle();
  takvimOgrenciSeciciDoldur();
};

window.takvimModalKapat = function() {
  document.getElementById("takvimModal").classList.remove("active");
};

window.takvimTumGunToggle = function() {
  const tumGun = document.getElementById("takvimTumGun").checked;
  document.getElementById("takvimSaatWrap").style.display = tumGun ? "none" : "grid";
};

window.takvimHedefDegisti = function() {
  const hedef = document.getElementById("takvimHedefTur").value;
  document.getElementById("takvimHedefSinifWrap").style.display = hedef === "sinif" ? "block" : "none";
  document.getElementById("takvimHedefOgrenciWrap").style.display = hedef === "ogrenci" ? "block" : "none";
};

function takvimOgrenciSeciciDoldur() {
  const sel = document.getElementById("takvimHedefOgrenci");
  if (!sel) return;
  const aktif = B.ogrenciler().filter(o => getOgrenciDurum(o, B.ayarlar()[o.id]) === "aktif");
  aktif.sort((a, b) => (a.ogrenciAdSoyad || "").localeCompare(b.ogrenciAdSoyad || ""));
  sel.innerHTML = '<option value="">— Öğrenci Seçin —</option>';
  for (const o of aktif) {
    const sinif = (B.ayarlar()[o.id]?.kayit?.sinif) || o.sinif || "";
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = `${o.ogrenciAdSoyad || ""}${sinif ? ` (${sinif})` : ""}`;
    opt.dataset.ad = o.ogrenciAdSoyad || "";
    sel.appendChild(opt);
  }
}

window.takvimEtkinlikKaydet = async function() {
  const id = document.getElementById("takvimDuzenleId").value;
  const baslik = document.getElementById("takvimBaslik").value.trim();
  const tip = document.getElementById("takvimTip").value;
  const tarih = document.getElementById("takvimTarih").value;
  const tumGun = document.getElementById("takvimTumGun").checked;
  const baslangicSaat = tumGun ? "" : document.getElementById("takvimBaslangic").value;
  const bitisSaat = tumGun ? "" : document.getElementById("takvimBitis").value;
  const konum = document.getElementById("takvimKonum").value.trim();
  const aciklama = document.getElementById("takvimAciklama").value.trim();
  const hedefTur = document.getElementById("takvimHedefTur").value;
  let hedefDeger = "", hedefOgrenciAd = "";
  if (hedefTur === "sinif") {
    hedefDeger = document.getElementById("takvimHedefSinif").value;
    if (!hedefDeger) return showToast("Sınıf seçin", "error");
  } else if (hedefTur === "ogrenci") {
    const sel = document.getElementById("takvimHedefOgrenci");
    hedefDeger = sel.value;
    if (!hedefDeger) return showToast("Öğrenci seçin", "error");
    hedefOgrenciAd = sel.options[sel.selectedIndex]?.dataset?.ad || "";
  }

  if (!baslik) return showToast("Başlık zorunlu", "error");
  if (!tarih) return showToast("Tarih zorunlu", "error");

  const data = {
    baslik, aciklama, tarih, baslangicSaat, bitisSaat, tumGun, konum,
    tip, hedefTur, hedefDeger, hedefOgrenciAd,
    arsiv: false,
    guncellendi: new Date().toISOString()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "takvim", id), data);
      showToast("✓ Etkinlik güncellendi");
    } else {
      data.olusturan = B.kullanici().email;
      data.olusturuldu = new Date().toISOString();
      const ref = doc(collection(db, "takvim"));
      await setDoc(ref, data);
      showToast("✓ Etkinlik eklendi");
    }
    takvimModalKapat();
    await takvimEtkinlikleriYukle(true);
    takvimYonetimRender();
  } catch (e) {
    console.error(e);
    showToast("Kaydedilemedi: " + e.message, "error");
  }
};

window.takvimEtkinlikSil = async function() {
  const id = document.getElementById("takvimDuzenleId").value;
  if (!id) return;
  if (!confirm("Bu etkinliği silmek istediğinize emin misiniz?")) return;
  try {
    await deleteDoc(doc(db, "takvim", id));
    showToast("✓ Etkinlik silindi");
    takvimModalKapat();
    await takvimEtkinlikleriYukle(true);
    takvimYonetimRender();
  } catch (e) {
    showToast("Silinemedi: " + e.message, "error");
  }
};

window.takvimEtkinlikDetayAc = function(e) {
  const tarih = new Date(e.tarih);
  const aylar = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const tarihStr = `${tarih.getDate()} ${aylar[tarih.getMonth()]} ${tarih.getFullYear()}`;
  const saatStr = e.tumGun ? "Tüm gün" : (e.baslangicSaat ? `${e.baslangicSaat}${e.bitisSaat ? ' - ' + e.bitisSaat : ''}` : "");
  const hedef = e.hedefTur === "tumOkul" ? "Tüm Okul"
              : e.hedefTur === "sinif" ? escapeHtml(e.hedefDeger || "")
              : e.hedefTur === "ogrenci" ? escapeHtml(e.hedefOgrenciAd || "") : "";

  const aciklamaSafe = (e.aciklama || "").replace(/\n/g, "<br>");

  const html = `
    <div id="takvimDetayOverlay" class="takvim-detay-overlay" onclick="if(event.target===this) takvimDetayKapat()">
      <div class="takvim-detay-kart">
        <span class="takvim-detay-tip-rozet" data-tip="${e.tip || 'etkinlik'}">${TAKVIM_TIP_LABEL[e.tip] || e.tip}</span>
        <div class="takvim-detay-baslik">${escapeHtml(e.baslik)}</div>
        <div class="takvim-detay-meta">
          <div><strong>📆 Tarih:</strong> ${tarihStr}</div>
          ${saatStr ? `<div><strong>⏰ Saat:</strong> ${saatStr}</div>` : ''}
          ${e.konum ? `<div><strong><i data-lucide="map-pin" style="width:13px;height:13px;vertical-align:-2px;"></i> Konum:</strong> ${escapeHtml(e.konum)}</div>` : ''}
          ${hedef ? `<div><strong><i data-lucide="users" style="width:13px;height:13px;vertical-align:-2px;"></i> Hedef:</strong> ${hedef}</div>` : ''}
        </div>
        ${e.aciklama ? `<div class="takvim-detay-aciklama">${aciklamaSafe}</div>` : ''}
        <div class="takvim-detay-butonlar">
          ${!e.sabit ? `<button class="takvim-detay-btn ics" onclick="takvimICSIndir('${e.id}')"><i data-lucide="calendar-plus" style="width:14px;height:14px;vertical-align:-2px;"></i> Takvime Ekle</button>` : ''}
          <button class="takvim-detay-btn kapat" onclick="takvimDetayKapat()">Kapat</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", html);
};

window.takvimDetayKapat = function() {
  document.getElementById("takvimDetayOverlay")?.remove();
};

// ICS EXPORT — Google/Apple/Outlook hepsi destekler
window.takvimICSIndir = function(id) {
  const e = takvimEtkinlikler.find(x => x.id === id) || takvimTumEtkinlikler().find(x => x.id === id);
  if (!e) return;

  const tarihParts = e.tarih.split("-");
  const tarihKodu = tarihParts.join("");

  let dtStart, dtEnd;
  if (e.tumGun || !e.baslangicSaat) {
    const sonrakiTarih = new Date(parseInt(tarihParts[0]), parseInt(tarihParts[1])-1, parseInt(tarihParts[2]) + 1);
    const sonrakiKod = `${sonrakiTarih.getFullYear()}${String(sonrakiTarih.getMonth()+1).padStart(2,"0")}${String(sonrakiTarih.getDate()).padStart(2,"0")}`;
    dtStart = `DTSTART;VALUE=DATE:${tarihKodu}`;
    dtEnd = `DTEND;VALUE=DATE:${sonrakiKod}`;
  } else {
    const bsSaat = (e.baslangicSaat || "00:00").replace(":", "") + "00";
    const btSaat = (e.bitisSaat || e.baslangicSaat || "00:00").replace(":", "") + "00";
    dtStart = `DTSTART;TZID=Europe/Istanbul:${tarihKodu}T${bsSaat}`;
    dtEnd = `DTEND;TZID=Europe/Istanbul:${tarihKodu}T${btSaat}`;
  }

  const esc = (s) => (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const uid = `${id}@bircicekkoleji.com`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bir Çiçek Koleji//Takvim//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    dtStart,
    dtEnd,
    `SUMMARY:${esc(e.baslik)}`,
    e.aciklama ? `DESCRIPTION:${esc(e.aciklama)}` : "",
    e.konum ? `LOCATION:${esc(e.konum)}` : "",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(e.baslik || "etkinlik").replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]/g, "_").substring(0, 50)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("✓ Takvim dosyası indirildi");
};

// ============================================================
// VELİ TARAFI — ZEKY ekran
// ============================================================

// ===== YEMEK MENÜSÜ EKRANI (sadece yemek, mevsimsel tasarım) =====
// Mevsime göre tema: yaz (Haz-Ağu) turuncu-yeşil taze, sonbahar, kış, ilkbahar
function caYemekMevsim() {
  const ay = new Date().getMonth(); // 0-11
  if (ay >= 5 && ay <= 7) return { ad:"Yaz", ikon:"☀️", renk1:"#fb923c", renk2:"#34d399", arka:"#fff7ed", vurgu:"#ea580c", emoji:"🍉🍅🥒" };
  if (ay >= 8 && ay <= 10) return { ad:"Sonbahar", ikon:"🍂", renk1:"#d97706", renk2:"#b45309", arka:"#fffbeb", vurgu:"#b45309", emoji:"🍂🎃🌰" };
  if (ay === 11 || ay <= 1) return { ad:"Kış", ikon:"❄️", renk1:"#0891b2", renk2:"#0e7490", arka:"#ecfeff", vurgu:"#0e7490", emoji:"❄️🍵🍲" };
  return { ad:"İlkbahar", ikon:"🌸", renk1:"#16a34a", renk2:"#65a30d", arka:"#f0fdf4", vurgu:"#16a34a", emoji:"🌸🥬🍓" };
}

function caYemekHTML() {
  const m = caYemekMevsim();
  return `
    <div class="ca-page ca-stack">
      <div class="ca-topbar">
        <div class="ca-row">
          <button class="ca-back" onclick="caGo('home')" title="Geri">←</button>
          <div>
            <div class="ca-tile-sub">OKUL MUTFAĞI</div>
            <h2 style="font-size:18px;">Yemek Menüsü</h2>
          </div>
        </div>
      </div>

      <!-- Mevsim başlık kartı -->
      <div class="ca-card" style="background:linear-gradient(135deg, ${m.renk1}, ${m.renk2}); border:none; color:#fff; padding:18px 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-size:12px; opacity:0.9; font-weight:600; letter-spacing:0.5px;">${m.ikon} ${m.ad.toUpperCase()} MENÜSÜ</div>
            <div style="font-family:var(--c-font-head); font-weight:700; font-size:20px; margin-top:2px;">Sağlıklı Mutfak</div>
          </div>
          <div style="font-size:30px;">${m.emoji}</div>
        </div>
        <div style="font-size:12px; opacity:0.92; margin-top:10px; line-height:1.5;">
          Şekersiz · katkısız · ev yapımı. Mevsiminde, taze ve dengeli beslenme.
        </div>
      </div>

      <!-- Mutfak ilkeleri rozet şeridi -->
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:2px;">
        <span class="ca-pill" style="background:#dcfce7; color:#166534; font-size:11px;">🚫 Şeker yok</span>
        <span class="ca-pill" style="background:#dcfce7; color:#166534; font-size:11px;">🌿 Hurma & elma özü</span>
        <span class="ca-pill" style="background:#dcfce7; color:#166534; font-size:11px;">🚫 Kızartma yok</span>
        <span class="ca-pill" style="background:#dcfce7; color:#166534; font-size:11px;">🚫 Margarin yok</span>
        <span class="ca-pill" style="background:#dcfce7; color:#166534; font-size:11px;">🚫 Paketli gıda yok</span>
      </div>

      <!-- Hafta navigasyonu -->
      <div class="ca-card" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; margin-top:4px;">
        <button class="ca-bell" style="width:36px; height:36px; font-size:18px;" onclick="caYemekHaftaGec(-1)">‹</button>
        <div style="text-align:center;">
          <div id="caYemekHaftaEtiket" style="font-weight:700; color:var(--c-ink); font-size:14px;">—</div>
          <button class="ca-link" style="font-size:11px;" onclick="caYemekBuHafta()">Bu haftaya dön</button>
        </div>
        <button class="ca-bell" style="width:36px; height:36px; font-size:18px;" onclick="caYemekHaftaGec(1)">›</button>
      </div>

      <!-- Günlük menü kartları -->
      <div id="caYemekGunler">
        <div class="ca-card" style="padding:30px; text-align:center; color:var(--c-muted); font-size:13px;">Yükleniyor…</div>
      </div>

      <!-- İçecekler bilgi kartı -->
      <div class="ca-card" style="background:${m.arka}; border-color:${m.renk1}33;">
        <div class="ca-head" style="font-size:14px; color:${m.vurgu};">🥤 İçeceklerimiz</div>
        <div style="font-size:12.5px; color:var(--c-body); margin-top:6px; line-height:1.7;">
          Ihlamur · meyve çayı · siyah çay · ayran. Kışın kahvaltıya sıcak çorba eklenir. Şekerli/gazlı içecek bulunmaz.
        </div>
      </div>
    </div>
  `;
}

let caYemekHaftaBas = null;

window.caYemekHaftaGec = function(yon) {
  const d = new Date(caYemekHaftaBas || new Date());
  d.setDate(d.getDate() + (yon * 7));
  caYemekHaftaBas = haftaBaslangic(d);
  caYemekYukle();
};
window.caYemekBuHafta = function() {
  caYemekHaftaBas = haftaBaslangic(new Date());
  caYemekYukle();
};

async function caYemekYukle() {
  const el = document.getElementById("caYemekGunler");
  if (!el) return;
  if (!caYemekHaftaBas) caYemekHaftaBas = haftaBaslangic(new Date());

  const etiket = document.getElementById("caYemekHaftaEtiket");
  if (etiket) etiket.textContent = haftaEtiketi(caYemekHaftaBas);

  const kod = haftaKodu(caYemekHaftaBas);
  let veri = null;
  try {
    const snap = await getDoc(doc(db, "yemekMenuleri", kod));
    veri = snap.exists() ? snap.data() : null;
  } catch (e) { console.warn("Yemek menü yüklenemedi:", e); }

  const pzt = caYemekHaftaBas;
  const m = caYemekMevsim();

  if (!veri) {
    el.innerHTML = `
      <div class="ca-card" style="padding:36px 20px; text-align:center;">
        <div style="font-size:42px; margin-bottom:10px;">🍽️</div>
        <div style="font-size:14px; color:var(--c-ink); font-weight:600;">Bu hafta için menü henüz eklenmemiş</div>
        <div style="font-size:12px; color:var(--c-muted); margin-top:6px;">Okul mutfağı menüyü yakında yayınlayacak 🌿</div>
      </div>`;
    return;
  }

  let html = `<div style="display:grid; gap:10px;">`;
  for (let gunIdx = 0; gunIdx < 5; gunIdx++) {
    const t = new Date(pzt);
    t.setDate(pzt.getDate() + gunIdx);
    const bugunMu = isoTarih(t) === isoTarih(new Date());
    const gunData = veri.gunler?.[gunIdx] || {};
    const doluMu = YEMEK_OGUNLER.some(o => (gunData[o.key]?.yemek || "").trim() !== "");

    html += `
      <div class="ca-card" style="padding:0; overflow:hidden; ${bugunMu ? `border:2px solid ${m.renk1};` : ''}">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:${bugunMu ? m.renk1 : 'var(--c-tint)'}; ${bugunMu ? 'color:#fff;' : ''}">
          <div style="font-family:var(--c-font-head); font-weight:700; font-size:15px;">
            ${YEMEK_GUNLER[gunIdx]}
            ${bugunMu ? '<span style="font-size:10px; background:rgba(255,255,255,0.3); padding:2px 8px; border-radius:6px; margin-left:6px;">BUGÜN</span>' : ''}
          </div>
          <div style="font-size:12px; ${bugunMu ? 'opacity:0.9;' : 'color:var(--c-muted);'}">${t.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</div>
        </div>`;

    if (!doluMu) {
      html += `<div style="padding:18px; text-align:center; color:var(--c-muted); font-size:12px; font-style:italic;">— menü girilmemiş —</div>`;
    } else {
      html += `<div style="padding:8px 14px 12px;">`;
      for (const ogun of YEMEK_OGUNLER) {
        const od = gunData[ogun.key] || {};
        if (!(od.yemek || "").trim()) continue;
        html += `
          <div style="padding:10px 0; border-bottom:1px dotted var(--c-line);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
              <span style="font-size:12px; font-weight:700; color:var(--c-green-deep);">${ogun.label}</span>
              ${od.kalori ? `<span style="font-size:11px; color:${m.vurgu}; font-weight:600; background:${m.arka}; padding:2px 8px; border-radius:6px;">🔥 ~${escapeHtmlGelisim(String(od.kalori))} kcal</span>` : ''}
            </div>
            <div style="font-size:13.5px; color:var(--c-ink); line-height:1.6; white-space:pre-line;">${escapeHtmlGelisim(od.yemek)}</div>
            ${od.alerjen ? `<div style="font-size:11px; color:#991b1b; margin-top:4px;">⚠ Alerjen: ${escapeHtmlGelisim(od.alerjen)}</div>` : ''}
          </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// VELİ ETKİNLİK LİSTESİ (ZEKY app veli-etkinlikler.html ile AYNI mantık)
// Veri kaynağı takvimEtkinlikleriYukle() — "etkinlikler" + "takvim" birleşik.
// Aynı etkinlik hem burada listelenir hem Takvim ekranında görünür.
// ═══════════════════════════════════════════════════════════════
let caEtkinlikSekme = "yaklasan";   // yaklasan | gecmis | tumu

const CA_ETKINLIK_KATEGORI = {
  etkinlik:   { ad: "Etkinlik",   bg: "#FCE7EC", yazi: "#C44569" },
  gezi:       { ad: "Gezi",       bg: "#EDE8F7", yazi: "#6B4FB6" },
  tatil:      { ad: "Tatil",      bg: "#FDF3D6", yazi: "#B8860B" },
  egitim:     { ad: "Eğitim",     bg: "#E4F2DC", yazi: "#2D7A2D" },
  randevu:    { ad: "Randevu",    bg: "#DCEBF6", yazi: "#2E5C8A" },
  hatirlatma: { ad: "Hatırlatma", bg: "#FDECD9", yazi: "#C77E20" },
  genel:      { ad: "Etkinlik",   bg: "#FCE7EC", yazi: "#C44569" }
};
function caEtkinlikKategori(e) {
  const k = String(e.kategori || e.tip || "genel").toLocaleLowerCase("tr");
  return CA_ETKINLIK_KATEGORI[k] || CA_ETKINLIK_KATEGORI.genel;
}

window.caEtkinlikSekmeSec = function(s) {
  caEtkinlikSekme = s;
  document.querySelectorAll(".ca-etk-tab").forEach(b =>
    b.classList.toggle("active", b.dataset.s === s));
  caEtkinlikleriRender();
};

function caEtkinliklerHTML() {
  const tab = (id, ad) =>
    `<button class="veli-takvim-tab ca-etk-tab ${caEtkinlikSekme === id ? "active" : ""}" data-s="${id}" onclick="caEtkinlikSekmeSec('${id}')">${ad}</button>`;
  return `
    <div class="ca-page ca-stack">
      <div class="ca-topbar">
        <div class="ca-row">
          <button class="ca-back" onclick="caGo('home')" title="Geri">←</button>
          <div>
            <div class="ca-tile-sub">OKUL</div>
            <h2 style="font-size:18px;">Etkinlikler</h2>
          </div>
        </div>
      </div>

      <div class="veli-takvim-tabs">
        ${tab("yaklasan", "Yaklaşan")}${tab("gecmis", "Geçmiş")}${tab("tumu", "Tümü")}
      </div>

      <div id="caEtkinlikListe">
        <div class="ca-card" style="padding:20px; text-align:center; color:var(--c-muted); font-size:13px;">Yükleniyor...</div>
      </div>

      <button class="ca-card" onclick="caGo('takvim')"
        style="width:100%; padding:13px; margin-top:6px; text-align:center; cursor:pointer; border:none; font-family:inherit; font-weight:700; font-size:13.5px; color:var(--c-ink);">
        <i data-lucide="calendar-days" style="width:15px;height:15px;vertical-align:-3px;"></i> Takvimde görüntüle
      </button>
    </div>
  `;
}

async function caEtkinlikleriRender() {
  const el = document.getElementById("caEtkinlikListe");
  if (!el) return;

  const AY_KISA = ["OCA","ŞUB","MAR","NİS","MAY","HAZ","TEM","AĞU","EYL","EKİ","KAS","ARA"];
  const GUN_AD  = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];

  let liste = [];
  try {
    liste = await takvimEtkinlikleriYukle(true);
  } catch (e) {
    el.innerHTML = `<div class="ca-card" style="padding:24px; text-align:center; color:var(--c-muted); font-size:13px;">Etkinlikler yüklenemedi.</div>`;
    return;
  }

  // Hedef kitle filtresi — veli sadece kendi sınıfının etkinliklerini görür
  const sinifim = (typeof B.veliAktifOgrenci() !== "undefined" && B.veliAktifOgrenci())
    ? (B.veliAktifOgrenci().sinif || "") : "";
  liste = liste.filter(e => {
    const tur = e.hedefTur || e.hedefTip || "tumOkul";
    if (tur === "tumOkul" || tur === "okul" || tur === "tum") return true;
    if (tur === "sinif") {
      const hedef = e.hedefDeger || "";
      if (!sinifim || !hedef) return true;
      return String(hedef).toLocaleLowerCase("tr").trim() === String(sinifim).toLocaleLowerCase("tr").trim();
    }
    return true;
  });

  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const tarihi = (e) => {
    if (!e.tarih) return null;
    const d = new Date(e.tarih + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  };

  liste = liste.filter(e => tarihi(e))
               .sort((a,b) => ((a.tarih||"") + (a.baslangicSaat||"00:00"))
                          .localeCompare((b.tarih||"") + (b.baslangicSaat||"00:00")));

  if (caEtkinlikSekme === "yaklasan")      liste = liste.filter(e => tarihi(e) >= bugun);
  else if (caEtkinlikSekme === "gecmis")   liste = liste.filter(e => tarihi(e) <  bugun).reverse();

  if (!liste.length) {
    const mesaj = caEtkinlikSekme === "yaklasan" ? "Yaklaşan etkinlik yok."
                : caEtkinlikSekme === "gecmis"   ? "Geçmiş etkinlik yok."
                : "Henüz etkinlik yok.";
    el.innerHTML = `<div class="ca-card" style="padding:28px 20px; text-align:center; color:var(--c-muted); font-size:13px;">${mesaj}</div>`;
    return;
  }

  let html = "", sonAy = "";
  liste.forEach(e => {
    const d = tarihi(e);
    const ayEt = AY_ISIMLERI[d.getMonth()] + " " + d.getFullYear();
    if (ayEt !== sonAy) {
      html += `<div style="font-size:12px; font-weight:700; color:var(--c-muted); text-transform:uppercase; letter-spacing:.5px; margin:14px 2px 8px;">${ayEt}</div>`;
      sonAy = ayEt;
    }
    const kat = caEtkinlikKategori(e);
    const gecmis = d < bugun;
    const buGun = d.getTime() === bugun.getTime();
    const saat = e.tumGun ? "Tüm gün"
               : [e.baslangicSaat, e.bitisSaat].filter(Boolean).join(" – ");

    html += `
      <div class="ca-card" style="display:flex; gap:12px; padding:13px 14px; margin-bottom:9px; ${gecmis ? "opacity:.62;" : ""}">
        <div style="width:50px; flex-shrink:0; border-radius:11px; background:${kat.bg}; color:${kat.yazi}; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:7px 0;">
          <div style="font-size:20px; font-weight:700; line-height:1;">${d.getDate()}</div>
          <div style="font-size:10px; font-weight:700; margin-top:3px;">${AY_KISA[d.getMonth()]}</div>
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:14.5px; font-weight:700; line-height:1.35;">${escapeHtml(e.baslik || "Etkinlik")}</div>
          <div style="font-size:12px; color:var(--c-muted); margin-top:5px;">${GUN_AD[d.getDay()]}${saat ? " · " + escapeHtml(saat) : ""}</div>
          ${e.konum ? `<div style="font-size:12px; color:var(--c-muted); margin-top:3px;"><i data-lucide="map-pin" style="width:12px;height:12px;vertical-align:-2px;"></i> ${escapeHtml(e.konum)}</div>` : ""}
          ${e.aciklama ? `<div style="font-size:12.5px; color:#5A6B62; margin-top:7px; line-height:1.55;">${escapeHtml(e.aciklama)}</div>` : ""}
          <span style="display:inline-block; padding:3px 9px; border-radius:12px; font-size:10.5px; font-weight:700; margin-top:8px; background:${kat.bg}; color:${kat.yazi};">${kat.ad}</span>
          ${buGun ? `<span style="display:inline-block; padding:3px 9px; border-radius:12px; font-size:10.5px; font-weight:700; margin-top:8px; margin-left:5px; background:#2D5E3E; color:#fff;">Bugün</span>` : ""}
        </div>
      </div>`;
  });

  el.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function caTakvimHTML() {
  return `
    <div class="ca-page ca-stack">
      <div class="ca-topbar">
        <div class="ca-row">
          <button class="ca-back" onclick="caGo('home')" title="Geri">←</button>
          <div>
            <div class="ca-tile-sub">OKUL</div>
            <h2 style="font-size:18px;">Takvim</h2>
          </div>
        </div>
      </div>

      <!-- VELİ TAKVİM SEKMELERİ -->
      <div class="veli-takvim-tabs">
        <button class="veli-takvim-tab active" data-tab="aylik" onclick="veliTakvimSekmeDegistir('aylik')"><i data-lucide="calendar" style="width:13px;height:13px;vertical-align:-2px;"></i> Aylık</button>
        <button class="veli-takvim-tab" data-tab="randevular" onclick="veliTakvimSekmeDegistir('randevular')"><i data-lucide="phone" style="width:13px;height:13px;vertical-align:-2px;"></i> Randevular <span id="veliMusaitSayac" style="background:#0891b2;color:white;padding:1px 7px;border-radius:99px;font-size:10px;margin-left:4px;display:none;">0</span></button>
        <button class="veli-takvim-tab" data-tab="benim" onclick="veliTakvimSekmeDegistir('benim')">⭐ Randevularım <span id="veliBenimSayac" style="background:#16a34a;color:white;padding:1px 7px;border-radius:99px;font-size:10px;margin-left:4px;display:none;">0</span></button>
      </div>

      <!-- AYLIK SEKMESİ -->
      <div id="veliTakvimPanel-aylik" class="veli-takvim-panel">
        <div class="takvim-ay-bar">
          <div class="takvim-ay-baslik" id="veliTakvimAyBaslik">—</div>
          <div class="takvim-ay-nav">
            <button onclick="veliTakvimAyGec(-1)">‹</button>
            <button onclick="veliTakvimBugune()" style="width:auto; padding:0 12px; font-size:12px;">Bugün</button>
            <button onclick="veliTakvimAyGec(1)">›</button>
          </div>
        </div>
        <div id="veliTakvimGrid" class="takvim-grid"></div>

        <h3 class="ca-head" style="font-size:15px; margin-top:14px;">Yaklaşan Etkinlikler</h3>
        <div id="veliTakvimYaklasanListe" class="takvim-etkinlik-listesi">
          <div class="ca-card" style="padding:20px; text-align:center; color:var(--c-muted);">Yükleniyor...</div>
        </div>
      </div>

      <!-- MÜSAİT RANDEVULAR SEKMESİ -->
      <div id="veliTakvimPanel-randevular" class="veli-takvim-panel" style="display:none;">
        <div class="ca-card tint" style="padding:14px 16px; margin-bottom:12px; border-left:4px solid #0891b2;">
          <div style="font-weight:700; color:#0e7490; font-size:14px;"><i data-lucide="phone" style="width:13px;height:13px;vertical-align:-2px;"></i> Müsait Randevular</div>
          <div style="font-size:12px; color:#475569; margin-top:4px;">Aşağıdaki müsait slotlardan size uygun olanı seçip randevu alabilirsiniz. Tek bir slot bir veliyi rezerve eder; biri rezervasyon yaparsa diğer veliler o slotu artık göremez.</div>
        </div>
        <div id="veliMusaitListesi">
          <div class="ca-card" style="padding:20px; text-align:center; color:var(--c-muted); font-size:13px;">Yükleniyor...</div>
        </div>
      </div>

      <!-- RANDEVULARIM SEKMESİ -->
      <div id="veliTakvimPanel-benim" class="veli-takvim-panel" style="display:none;">
        <div class="ca-card tint" style="padding:14px 16px; margin-bottom:12px; border-left:4px solid #16a34a;">
          <div style="font-weight:700; color:#166534; font-size:14px;">⭐ Randevularım</div>
          <div style="font-size:12px; color:#475569; margin-top:4px;">Aldığınız randevular burada listelenir. İstediğiniz zaman iptal edip slot'u tekrar diğer velilere açabilirsiniz.</div>
        </div>
        <div id="veliBenimRandevuListesi">
          <div class="ca-card" style="padding:20px; text-align:center; color:var(--c-muted); font-size:13px;">Yükleniyor...</div>
        </div>
      </div>
    </div>
  `;
}

// VELİ SEKME DEĞİŞTİRME
window.veliTakvimSekmeDegistir = function(sekme) {
  // Tabs
  document.querySelectorAll(".veli-takvim-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === sekme);
  });
  // Panels
  document.querySelectorAll(".veli-takvim-panel").forEach(p => {
    p.style.display = p.id === `veliTakvimPanel-${sekme}` ? "block" : "none";
  });
  // Render
  if (sekme === "aylik") veliTakvimRender();
  else if (sekme === "randevular") veliMusaitRandevularRender();
  else if (sekme === "benim") veliBenimRandevularRender();
};

window.veliTakvimAyGec = function(dir) {
  takvimAktifAy.setMonth(takvimAktifAy.getMonth() + dir);
  veliTakvimRender();
};
window.veliTakvimBugune = function() {
  takvimAktifAy = new Date();
  veliTakvimRender();
};

async function veliTakvimRender() {
  await takvimEtkinlikleriYukle();
  const veliEtkinlikler = takvimTumEtkinlikler().filter(e => takvimVeliyeUygunMu(e));

  const aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const el = document.getElementById("veliTakvimAyBaslik");
  if (el) el.textContent = `${aylar[takvimAktifAy.getMonth()]} ${takvimAktifAy.getFullYear()}`;

  takvimAyGridRender("veliTakvimGrid", takvimAktifAy, veliEtkinlikler, "veliTakvimGunTikla");

  const bugun = new Date();
  const bugunStr = `${bugun.getFullYear()}-${String(bugun.getMonth()+1).padStart(2,"0")}-${String(bugun.getDate()).padStart(2,"0")}`;
  const yaklasan = veliEtkinlikler.filter(e => e.tarih >= bugunStr).slice(0, 10);

  const listeEl = document.getElementById("veliTakvimYaklasanListe");
  if (!listeEl) return;
  if (yaklasan.length === 0) {
    listeEl.innerHTML = `<div class="ca-card" style="padding:20px; text-align:center; color:var(--c-muted); font-size:13px;">Yaklaşan etkinlik yok.</div>`;
    return;
  }
  listeEl.innerHTML = yaklasan.map(e => {
    const tarih = new Date(e.tarih);
    const aylarKisa = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    const tarihStr = `${tarih.getDate()} ${aylarKisa[tarih.getMonth()]}`;
    const saatStr = e.tumGun ? "Tüm gün" : (e.baslangicSaat ? `${e.baslangicSaat}` : "");
    return `
      <div class="takvim-etkinlik-kart" data-tip="${e.tip || 'etkinlik'}" style="cursor:pointer;" onclick="veliTakvimEtkinlikDetay('${e.id}')">
        <div style="flex:1; min-width:0;">
          <div class="takvim-etkinlik-baslik">${escapeHtml(e.baslik)}</div>
          <div class="takvim-etkinlik-meta">
            <span>${TAKVIM_TIP_LABEL[e.tip] || e.tip}</span>
            <span>📆 ${tarihStr}</span>
            ${saatStr ? `<span>⏰ ${saatStr}</span>` : ''}
            ${e.konum ? `<span>📍 ${escapeHtml(e.konum)}</span>` : ''}
          </div>
        </div>
        <button class="takvim-aksiyon-btn" onclick="event.stopPropagation(); takvimICSIndir('${e.id}')" style="flex-shrink:0;"><i data-lucide="calendar" style="width:13px;height:13px;vertical-align:-2px;"></i> Ekle</button>
      </div>
    `;
  }).join("");
}

function takvimVeliyeUygunMu(e) {
  if (!e.hedefTur || e.hedefTur === "tumOkul") return true;
  if (typeof B.veliOgrencileri() === "undefined" || !B.veliOgrencileri()) return false;
  if (e.hedefTur === "sinif") {
    return B.veliOgrencileri().some(o => {
      const ayar = (typeof B.ayarlar() !== "undefined") ? B.ayarlar()[o.id] : null;
      const sinif = (ayar?.kayit?.sinif) || o.sinif || "";
      return sinif === e.hedefDeger;
    });
  }
  if (e.hedefTur === "ogrenci") {
    return B.veliOgrencileri().some(o => o.id === e.hedefDeger);
  }
  return false;
}

window.veliTakvimGunTikla = function(tarihStr) {
  const veliEtkinlikler = takvimTumEtkinlikler().filter(e => takvimVeliyeUygunMu(e));
  const gunEtkinlikleri = veliEtkinlikler.filter(e => e.tarih === tarihStr);
  if (gunEtkinlikleri.length === 0) return;
  takvimEtkinlikDetayAc(gunEtkinlikleri[0]);
};

window.veliTakvimEtkinlikDetay = function(id) {
  const e = takvimTumEtkinlikler().find(x => x.id === id);
  if (e) takvimEtkinlikDetayAc(e);
};
// ===== /TAKVİM =====

// ── Çekirdeğin erişimi için ──
window.takvimEtkinlikleriYukle = takvimEtkinlikleriYukle;
window.takvimTumEtkinlikler    = takvimTumEtkinlikler;
window.takvimVeliyeUygunMu     = takvimVeliyeUygunMu;
window.takvimYonetimRender     = takvimYonetimRender;
window.takvimAyGridRender      = takvimAyGridRender;
window.TAKVIM_TIP_LABEL        = TAKVIM_TIP_LABEL;
window.caYemekHTML             = caYemekHTML;
window.caYemekYukle            = caYemekYukle;
window.caEtkinliklerHTML       = caEtkinliklerHTML;
window.caEtkinlikleriRender    = caEtkinlikleriRender;
window.caTakvimHTML            = caTakvimHTML;
window.veliTakvimRender        = veliTakvimRender;
console.log("Takvim modülü yüklendi.");
