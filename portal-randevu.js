// ══════════════════════════════════════════════════════════════
// PORTAL · RANDEVU MODÜLÜ  (Yönetim slotları + Veli rezervasyon)
// --------------------------------------------------------------
// Faz 6 · index.html'den ayrıştırıldı (2026-08-07)
// Kaynak: "FAZ B: RANDEVU SLOT SİSTEMİ" + "FAZ B Oturum 2: VELİ REZERVASYON"
//
// NOT: Sınıf adı eşleme yardımcıları (normalizeSinif, sinifAdiResmiEsle,
// RESMI_SINIF_ADLARI, SINIF_ESLEME_HAM) bu bölümün içindeydi ama
// portalın 18 ayrı yerinde kullanılıyor — onlar çekirdekte KALDI.
// Buradan window.BCK üzerinden okunuyorlar.
//
// Rezervasyon Firestore TRANSACTION ile yapılır (iki veli aynı slotu alamaz).
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
        addDoc, query, where, orderBy, runTransaction, serverTimestamp,
        escapeHtml, isoTarih, brevoMail, portalMailSablon,
        normalizeSinif, sinifAdiResmiEsle, OKUL_MAIL, SCHOOL_EMAIL,
        escapeHtmlGelisim, mesajThreadGetirVeyaOlustur } = B;

// ============================================================
// ===== FAZ B: RANDEVU SLOT SİSTEMİ (YÖNETİM) =====
// ============================================================
// Veri yapısı: randevuSlotlari/{slotId}
// { tarih, baslangicSaat, bitisSaat, tip, tipAciklama (diger için),
//   ogretmenEmail, ogretmenAd, hedefSinif, konum, yonetimNotu,
//   durum (musait/dolu), veliEmail, veliAd, ogrenciId, ogrenciAd,
//   veliNotu, rezervasyonTarihi, meslekAdi, meslekAciklama,
//   arsiv, olusturan, olusturuldu, guncellendi }

const RANDEVU_TIP_LABEL = {
  ogretmen_veli: "👨‍🏫 Öğretmen-Veli",
  pdr: "🧠 PDR",
  idare: "🏢 İdare",
  meslek_sunumu: "💼 Meslek Sunumu",
  diger: "📌 Diğer"
};

let randevuSlotlari = [];

async function randevuSlotlariYukle(force = false) {
  if (randevuSlotlari.length > 0 && !force) return randevuSlotlari;
  try {
    const snap = await getDocs(collection(db, "randevuSlotlari"));
    const liste = [];
    snap.forEach(d => liste.push({ id: d.id, ...d.data() }));
    randevuSlotlari = liste;
    return liste;
  } catch (e) {
    console.error("Randevu slotları yüklenemedi:", e);
    return [];
  }
}

// Öğretmen dropdown'larını doldur (modal açılınca)
function randevuOgretmenDropdownDoldur() {
  const dropdowns = [
    document.getElementById("randevuSlotOgretmen"),
    document.getElementById("randevuTopluOgretmen")
  ].filter(Boolean);

  if (!B.personelleri()) return;

  // Sadece öğretmen ve yönetim rollerini al
  const seciliRoller = ["ogretmen", "kurucu_mudur", "mudur", "egitim_koordinator", "pdr"];
  const personeller = B.personelleri().filter(p =>
    seciliRoller.includes(p.rol) && p.aktif !== false
  );

  for (const sel of dropdowns) {
    // Mevcut "Genel" seçeneği koru, yenilerini ekle
    sel.innerHTML = '<option value="">— Genel / Yönetim —</option>';
    for (const p of personeller) {
      const opt = document.createElement("option");
      opt.value = p.id || p.email || "";
      const sinifBilgisi = p.siniflar && p.siniflar.length > 0 ? ` (${p.siniflar.join(", ")})` : "";
      opt.textContent = `${p.adSoyad || p.email}${sinifBilgisi}`;
      opt.dataset.email = p.email || "";
      opt.dataset.ad = p.adSoyad || p.email || "";
      opt.dataset.sinif = (p.siniflar && p.siniflar.length === 1) ? p.siniflar[0] : "";
      sel.appendChild(opt);
    }
  }
}

// ===== ANA RENDER =====

// ═══════════════════════════════════════════════════════════════════
// VELİ RANDEVU TALEPLERİ — ONAY / RED
// Veli randevuSlotlari'na durum:"talep" olarak yazar.
// Yönetim onaylayınca durum:"dolu" olur ve takvimde görünür.
// Her iki durumda da veliye bilgilendirme maili gider.
// ═══════════════════════════════════════════════════════════════════
const RANDEVU_TIP_ADI = {
  pdr: "PDR / Rehberlik", ogretmen_veli: "Sınıf Öğretmeni",
  idare: "Müdür / İdare", meslek_sunumu: "Meslek Sunumu", diger: "Diğer"
};

function randevuTalepleriCiz() {
  const kutu = document.getElementById("randevuTalepKutusu");
  if (!kutu) return;
  const talepler = (randevuSlotlari || [])
    .filter(s => !s.arsiv && s.durum === "talep")
    .sort((a, b) => (a.tarih + a.baslangicSaat).localeCompare(b.tarih + b.baslangicSaat));

  if (!talepler.length) { kutu.style.display = "none"; kutu.innerHTML = ""; return; }
  kutu.style.display = "";
  kutu.innerHTML = `
    <div style="background:#FFF7ED; border:1px solid #FED7AA; border-radius:14px; padding:15px 17px;">
      <div style="display:flex; align-items:center; gap:9px; margin-bottom:12px;">
        <i data-lucide="bell-ring" style="width:17px;height:17px;color:#C2410C;"></i>
        <span style="font-weight:700; font-size:14.5px; color:#7C2D12;">${talepler.length} veli randevu talebi onay bekliyor</span>
      </div>
      ${talepler.map(t => {
        const d = new Date(t.tarih + "T00:00:00");
        const tarihMetni = isNaN(d) ? t.tarih : d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
        return `
        <div style="background:#fff; border:1px solid #FED7AA; border-radius:11px; padding:12px 14px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
              <div style="font-weight:700; font-size:13.5px; color:#1E293B;">${escapeHtml(t.veliAd || t.veliEmail || "Veli")}
                <span style="font-weight:500; color:#64748B;">· ${escapeHtml(t.ogrenciAd || "")}</span></div>
              <div style="font-size:12.5px; color:#475569; margin-top:4px;">
                <i data-lucide="calendar" style="width:12px;height:12px;vertical-align:-2px;"></i> ${escapeHtml(tarihMetni)} · ${escapeHtml(t.baslangicSaat || "")}–${escapeHtml(t.bitisSaat || "")}
              </div>
              <div style="font-size:12.5px; color:#475569; margin-top:3px;">
                <i data-lucide="users" style="width:12px;height:12px;vertical-align:-2px;"></i> ${escapeHtml(RANDEVU_TIP_ADI[t.tip] || t.tip || "Görüşme")}
                ${t.hedefSinif ? " · " + escapeHtml(t.hedefSinif) : ""}
              </div>
              ${t.veliNotu ? `<div style="font-size:12.5px; color:#475569; margin-top:7px; background:#F8FAFC; border-radius:8px; padding:8px 10px; line-height:1.5;">${escapeHtml(t.veliNotu)}</div>` : ""}
            </div>
            <div style="display:flex; gap:7px; flex-wrap:wrap;">
              <button onclick="randevuTalepOnayla('${t.id}')" style="padding:8px 15px; border:none; background:#2D7A2D; color:#fff; border-radius:9px; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:700;">
                <i data-lucide="check" style="width:13px;height:13px;vertical-align:-2px;"></i> Onayla</button>
              <button onclick="randevuTalepReddet('${t.id}')" style="padding:8px 15px; border:1px solid #FECACA; background:#fff; color:#DC2626; border-radius:9px; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:700;">
                <i data-lucide="x" style="width:13px;height:13px;vertical-align:-2px;"></i> Reddet</button>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  if (window.lucideYenile) setTimeout(window.lucideYenile, 40);
}

// Veliye bilgilendirme maili
async function randevuVeliyeMail(t, onaylandi, gerekce) {
  if (typeof brevoMail !== "function" || !t.veliEmail) return;
  const d = new Date(t.tarih + "T00:00:00");
  const tarihMetni = isNaN(d) ? t.tarih : d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
  const tipAd = RANDEVU_TIP_ADI[t.tip] || "Görüşme";
  try {
    await brevoMail({
      to: t.veliEmail,
      subject: onaylandi ? "Randevunuz onaylandı · Bir Çiçek Koleji" : "Randevu talebiniz hakkında · Bir Çiçek Koleji",
      htmlContent: onaylandi
        ? `<div style="font-family:Arial,sans-serif; max-width:520px; margin:0 auto;">
             <div style="background:linear-gradient(135deg,#2D5E3E,#4A7C59); color:#fff; padding:22px 24px; border-radius:14px 14px 0 0;">
               <div style="font-size:12px; opacity:.85; letter-spacing:1px;">RANDEVU</div>
               <div style="font-size:21px; font-weight:700; margin-top:5px;">Randevunuz Onaylandı</div>
             </div>
             <div style="border:1px solid #E2E8F0; border-top:none; border-radius:0 0 14px 14px; padding:24px;">
               <p style="margin:0 0 16px; color:#334155;">Sayın ${escapeHtml(t.veliAd || "Velimiz")}, randevu talebiniz onaylanmıştır.</p>
               <div style="background:#ECFDF5; border-radius:11px; padding:16px 18px; color:#065F46;">
                 <div style="margin-bottom:7px;"><b>Görüşme:</b> ${escapeHtml(tipAd)}</div>
                 <div style="margin-bottom:7px;"><b>Tarih:</b> ${escapeHtml(tarihMetni)}</div>
                 <div style="margin-bottom:7px;"><b>Saat:</b> ${escapeHtml(t.baslangicSaat || "")} – ${escapeHtml(t.bitisSaat || "")}</div>
                 ${t.ogrenciAd ? `<div><b>Öğrenci:</b> ${escapeHtml(t.ogrenciAd)}</div>` : ""}
               </div>
               <p style="color:#475569; font-size:14px; margin:18px 0 6px;">Randevunuz portal takviminize eklendi.
                 Görüşmeden bir gün önce hatırlatma göndereceğiz.</p>
               <p style="color:#64748B; font-size:13px; margin:0 0 18px;">Katılamayacaksanız lütfen okulu bilgilendirin.</p>
               <a href="https://portal.bircicekkoleji.com" style="display:inline-block; background:#2D5E3E; color:#fff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:700;">Portalı Aç</a>
               <p style="margin:22px 0 0; color:#94A3B8; font-size:12px;">Bir Çiçek Koleji</p>
             </div>
           </div>`
        : `<div style="font-family:Arial,sans-serif; max-width:520px; margin:0 auto;">
             <div style="background:#B45309; color:#fff; padding:22px 24px; border-radius:14px 14px 0 0;">
               <div style="font-size:12px; opacity:.85; letter-spacing:1px;">RANDEVU</div>
               <div style="font-size:21px; font-weight:700; margin-top:5px;">Talebiniz Hakkında</div>
             </div>
             <div style="border:1px solid #E2E8F0; border-top:none; border-radius:0 0 14px 14px; padding:24px;">
               <p style="margin:0 0 14px; color:#334155;">Sayın ${escapeHtml(t.veliAd || "Velimiz")},</p>
               <p style="margin:0 0 16px; color:#334155;">${escapeHtml(tarihMetni)} ${escapeHtml(t.baslangicSaat || "")} için ilettiğiniz randevu talebi maalesef karşılanamadı.</p>
               ${gerekce ? `<div style="background:#FEF3C7; border-radius:11px; padding:15px 17px; color:#7C2D12; margin-bottom:16px;"><b>Okuldan not:</b><br>${escapeHtml(gerekce)}</div>` : ""}
               <p style="color:#475569; font-size:14px; margin:0 0 18px;">Portal üzerinden farklı bir tarih için yeni talep oluşturabilirsiniz.</p>
               <a href="https://portal.bircicekkoleji.com" style="display:inline-block; background:#2D5E3E; color:#fff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:700;">Yeni Talep Oluştur</a>
               <p style="margin:22px 0 0; color:#94A3B8; font-size:12px;">Bir Çiçek Koleji</p>
             </div>
           </div>`
    });
  } catch (e) { console.warn("randevu maili", e?.message); }
}

window.randevuTalepOnayla = async function(id) {
  const t = (randevuSlotlari || []).find(x => x.id === id);
  if (!t) return;
  if (!confirm(`${t.veliAd || t.veliEmail} için randevu onaylanacak.\n\n${t.tarih} ${t.baslangicSaat}\n\nVeliye onay maili gönderilecek. Devam edilsin mi?`)) return;
  try {
    await updateDoc(doc(db, "randevuSlotlari", id), {
      durum: "dolu",
      onaylandi: true,
      onaylayan: B.kullanici()?.email || "",
      onayTarihi: new Date().toISOString(),
      guncellendi: new Date().toISOString()
    });
    await randevuVeliyeMail(t, true);
    // Veliye uygulama içi bildirim
    try {
      await addDoc(collection(db, "bildirimler"), {
        aliciEmail: (t.veliEmail || "").toLowerCase(),
        tip: "randevu", baslik: "Randevunuz onaylandı",
        metin: `${t.tarih} ${t.baslangicSaat} · ${RANDEVU_TIP_ADI[t.tip] || "Görüşme"}`,
        okundu: false, olusturuldu: new Date().toISOString()
      });
    } catch (e) { console.warn("bildirim", e?.message); }
    showToast("Randevu onaylandı, veliye bilgi verildi", "success");
    await randevuSlotlariYukle(true);
    randevuListesiRender();
  } catch (e) { alert("Onaylanamadı: " + (e.message || e)); }
};

window.randevuTalepReddet = async function(id) {
  const t = (randevuSlotlari || []).find(x => x.id === id);
  if (!t) return;
  const gerekce = prompt("Ret gerekçesi (veliye iletilecek, boş bırakılabilir):", "");
  if (gerekce === null) return;
  try {
    await updateDoc(doc(db, "randevuSlotlari", id), {
      durum: "reddedildi", arsiv: true,
      retGerekcesi: gerekce || "",
      karariVeren: B.kullanici()?.email || "",
      karariTarihi: new Date().toISOString()
    });
    await randevuVeliyeMail(t, false, gerekce);
    try {
      await addDoc(collection(db, "bildirimler"), {
        aliciEmail: (t.veliEmail || "").toLowerCase(),
        tip: "randevu", baslik: "Randevu talebiniz karşılanamadı",
        metin: `${t.tarih} ${t.baslangicSaat}${gerekce ? " · " + gerekce : ""}`,
        okundu: false, olusturuldu: new Date().toISOString()
      });
    } catch (e) { console.warn("bildirim", e?.message); }
    showToast("Talep reddedildi, veliye bilgi verildi");
    await randevuSlotlariYukle(true);
    randevuListesiRender();
  } catch (e) { alert("İşlem yapılamadı: " + (e.message || e)); }
};

async function randevuListesiRender() {
  // Slotlar henüz yüklenmediyse önce yükle — aksi halde bekleyen
  // talep kutusu boş görünüyordu.
  if (!randevuSlotlari || !randevuSlotlari.length) {
    try { await randevuSlotlariYukle(true); } catch (e) { console.warn("slot yükleme", e?.message); }
  }
  const liste = document.getElementById("randevuListesi");
  if (!liste) return;

  await randevuSlotlariYukle();

  // Filtreler
  const filtreTip = document.getElementById("randevuFiltreTip")?.value || "";
  const filtreDurum = document.getElementById("randevuFiltreDurum")?.value || "";
  const filtreZaman = document.getElementById("randevuFiltreZaman")?.value || "gelecek";

  const bugun = new Date();
  const bugunStr = `${bugun.getFullYear()}-${String(bugun.getMonth()+1).padStart(2,"0")}-${String(bugun.getDate()).padStart(2,"0")}`;

  // ── VELİ TALEPLERİ (durum: "talep") — onay bekliyor ──
  randevuTalepleriCiz();

  let filtreli = randevuSlotlari.filter(s => !s.arsiv);
  if (filtreTip) filtreli = filtreli.filter(s => s.tip === filtreTip);
  if (filtreDurum) filtreli = filtreli.filter(s => (s.durum || "musait") === filtreDurum);
  if (filtreZaman === "gelecek") filtreli = filtreli.filter(s => s.tarih >= bugunStr);
  else if (filtreZaman === "gecmis") filtreli = filtreli.filter(s => s.tarih < bugunStr);

  // Sayaç
  const sayacEl = document.getElementById("randevuSayac");
  if (sayacEl) {
    const musait = filtreli.filter(s => (s.durum || "musait") === "musait").length;
    const dolu = filtreli.filter(s => s.durum === "dolu").length;
    const talep = (randevuSlotlari || []).filter(s => !s.arsiv && s.durum === "talep").length;
    sayacEl.textContent = `Toplam ${filtreli.length}  ·  🟢 ${musait} müsait  ·  🟡 ${dolu} dolu` +
      (talep ? `  ·  🟠 ${talep} onay bekliyor` : "");
  }

  if (filtreli.length === 0) {
    liste.innerHTML = `<div style="padding:30px; text-align:center; color:#9ca3af; font-size:13px; background:white; border:1px dashed #e5e7eb; border-radius:12px;">
      Slot yok. <strong>+ Tek Slot</strong> veya <strong>⚡ Toplu Slot Oluştur</strong> ile ekleyebilirsiniz.
    </div>`;
    return;
  }

  // Tarih bazında gruplandır
  const tarihGruplari = {};
  for (const s of filtreli) {
    if (!tarihGruplari[s.tarih]) tarihGruplari[s.tarih] = [];
    tarihGruplari[s.tarih].push(s);
  }

  const tarihler = Object.keys(tarihGruplari).sort();
  const aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];

  let html = "";
  for (const tarih of tarihler) {
    const slotlar = tarihGruplari[tarih].sort((a, b) => (a.baslangicSaat || "").localeCompare(b.baslangicSaat || ""));
    const d = new Date(tarih);
    const tarihYazi = `${d.getDate()} ${aylar[d.getMonth()]} ${d.getFullYear()} · ${gunler[d.getDay()]}`;
    const musait = slotlar.filter(s => (s.durum || "musait") === "musait").length;
    const dolu = slotlar.filter(s => s.durum === "dolu").length;

    html += `
      <div class="randevu-tarih-grubu">
        <div class="randevu-tarih-baslik">
          <span>📅 ${tarihYazi}</span>
          <span class="sayac">${slotlar.length} slot · 🟢 ${musait} · 🟡 ${dolu}</span>
        </div>
        ${slotlar.map(s => randevuSlotSatirHTML(s, tarih < bugunStr)).join("")}
      </div>
    `;
  }

  liste.innerHTML = html;
}

function randevuSlotSatirHTML(s, gecmis) {
  const durum = s.durum || "musait";
  const tip = s.tip || "diger";
  const tipLabel = (tip === "diger" && s.tipAciklama) ? `📌 ${escapeHtml(s.tipAciklama)}` : RANDEVU_TIP_LABEL[tip] || "📌 Slot";
  const saat = `${s.baslangicSaat || "—"} - ${s.bitisSaat || "—"}`;

  const ogretmenInfo = s.ogretmenAd ? `<span>👤 ${escapeHtml(s.ogretmenAd)}</span>` : "";
  const sinifInfo = s.hedefSinif ? `<span>🏷️ ${escapeHtml(s.hedefSinif)}</span>` : "";
  const konumInfo = s.konum ? `<span>📍 ${escapeHtml(s.konum)}</span>` : "";

  // Meslek sunumu bilgisi (sadece tip === "meslek_sunumu" ve dolu ise)
  const meslekInfo = (durum === "dolu" && s.tip === "meslek_sunumu" && (s.meslekAdi || s.meslekAciklama)) ? `
    <div style="margin-top:6px; padding:8px 10px; background:#fdf2f8; border:1px solid #f9a8d4; border-radius:8px; font-size:11px;">
      <div style="color:#9d174d; font-weight:700; margin-bottom:2px;">💼 Sunulacak Meslek: ${escapeHtml(s.meslekAdi || "—")}</div>
      ${s.meslekAciklama ? `<div style="color:#6b7280; font-style:italic;">"${escapeHtml(s.meslekAciklama)}"</div>` : ""}
    </div>` : "";

  const veliInfo = durum === "dolu" ? `
    <div class="alt" style="margin-top:4px;">
      <strong>${escapeHtml(s.veliAd || "Veli")}</strong>
      ${s.ogrenciAd ? ` · ${escapeHtml(s.ogrenciAd)} için` : ""}
      ${s.veliNotu ? `<div style="font-size:11px; color:#6b7280; margin-top:2px; font-style:italic;">"${escapeHtml(s.veliNotu)}"</div>` : ""}
    </div>
    ${meslekInfo}` : "";

  // Mesajlaşma butonu (dolu ise — yönetim veli ile mesajlaşabilir)
  const mesajBtn = (durum === "dolu" && s.veliEmail) ? `
    <button onclick="randevuYonetimMesajlas('${s.id}')" title="Bu veliyle mesajlaş" style="background:#dbeafe; border-color:#93c5fd; color:#1e40af;"><i data-lucide="message-circle" style="width:15px;height:15px;vertical-align:-2px;"></i></button>` : "";

  return `
    <div class="randevu-slot ${durum} ${gecmis ? 'gecmis' : ''}">
      <div class="randevu-slot-saat">⏰ ${saat}</div>
      <div class="randevu-slot-detay">
        <div class="ust">
          <span class="randevu-tip-rozet" data-tip="${tip}">${tipLabel.replace(/^[^\s]+\s/, '')}</span>
          <span class="randevu-durum-rozet ${durum}">${durum === "dolu" ? "Dolu" : "Müsait"}</span>
          ${ogretmenInfo}
          ${sinifInfo}
          ${konumInfo}
        </div>
        ${veliInfo}
      </div>
      <div class="randevu-slot-aksiyon">
        ${mesajBtn}
        ${!gecmis ? `<button onclick="randevuSlotModalAc('${s.id}')"><i data-lucide="pencil" style="width:14px;height:14px;vertical-align:-2px;"></i> Düzenle</button>` : ""}
        ${durum === "dolu" ? `<button onclick="randevuSlotIptal('${s.id}')" class="danger" title="Veli rezervasyonunu iptal et">🔓 Rez. İptal</button>` : ""}
        <button onclick="randevuSlotSilDirekt('${s.id}')" class="danger">🗑</button>
      </div>
    </div>
  `;
}

// Yönetim → Veli mesajlaşma (slot üzerinden)
window.randevuYonetimMesajlas = async function(slotId) {
  const s = randevuSlotlari.find(x => x.id === slotId);
  if (!s || !s.veliEmail) return showToast("Veli bilgisi bulunamadı", "error");

  try {
    // Mevcut mesajlaşma sistemi ile thread oluştur/bul
    const thread = await mesajThreadGetirVeyaOlustur({
      personel: {
        email: B.kullanici().email,
        ad: B.kullanici().displayName || B.kullanici().email.split("@")[0],
        rol: B.rol() || "yonetim"
      },
      veli: {
        email: s.veliEmail,
        ad: s.veliAd || ""
      },
      ogrenci: {
        id: s.ogrenciId || "",
        ad: s.ogrenciAd || "",
        sinif: s.hedefSinif || ""
      }
    });

    // Otomatik bir başlangıç mesajı önerisi (gönderilmez, sadece pano açma)
    const baslamaIpucu = `📞 Randevu: ${s.tarih} ${s.baslangicSaat}-${s.bitisSaat}\n${s.tip === "meslek_sunumu" ? "Konu: Meslek Sunumu" : ""}`;
    showToast("Mesajlaşma açılıyor...");

    // Bağımsız Mesajlaşma modülüne geç
    if (typeof modulSec === "function") {
      modulSec("mesaj");
    }
    console.log(`[Yönetim Mesaj] Thread açıldı: ${thread.id}, başlama ipucu: ${baslamaIpucu}`);
  } catch (e) {
    console.error("Mesajlaşma açılamadı:", e);
    showToast("Mesajlaşma açılamadı: " + e.message, "error");
  }
};

// ===== TEK SLOT MODAL =====
window.randevuSlotModalAc = function(slotId) {
  document.getElementById("randevuSlotModal").classList.add("active");
  document.getElementById("randevuSlotDuzenleId").value = slotId || "";

  randevuOgretmenDropdownDoldur();

  if (slotId) {
    const s = randevuSlotlari.find(x => x.id === slotId);
    if (!s) { showToast("Slot bulunamadı", "error"); return; }
    document.getElementById("randevuSlotModalBaslik").innerHTML = `📞 Randevu Slot — Düzenle`; window.lucideYenile && window.lucideYenile();
    document.getElementById("randevuSlotTip").value = s.tip || "ogretmen_veli";
    document.getElementById("randevuSlotDigerAd").value = s.tipAciklama || "";
    document.getElementById("randevuSlotTarih").value = s.tarih || "";
    document.getElementById("randevuSlotBaslangic").value = s.baslangicSaat || "14:00";
    document.getElementById("randevuSlotBitis").value = s.bitisSaat || "15:00";
    document.getElementById("randevuSlotKonum").value = s.konum || "";
    document.getElementById("randevuSlotNot").value = s.yonetimNotu || "";
    if (s.ogretmenEmail) {
      const sel = document.getElementById("randevuSlotOgretmen");
      for (const opt of sel.options) {
        if (opt.dataset.email === s.ogretmenEmail) { sel.value = opt.value; break; }
      }
    }
    document.getElementById("randevuSlotSilBtn").style.display = "inline-block";
  } else {
    document.getElementById("randevuSlotModalBaslik").innerHTML = `📞 Yeni Randevu Slot`; window.lucideYenile && window.lucideYenile();
    document.getElementById("randevuSlotTip").value = "ogretmen_veli";
    document.getElementById("randevuSlotDigerAd").value = "";
    document.getElementById("randevuSlotTarih").value = new Date().toISOString().slice(0,10);
    document.getElementById("randevuSlotBaslangic").value = "14:00";
    document.getElementById("randevuSlotBitis").value = "15:00";
    document.getElementById("randevuSlotKonum").value = "";
    document.getElementById("randevuSlotNot").value = "";
    document.getElementById("randevuSlotOgretmen").value = "";
    document.getElementById("randevuSlotSilBtn").style.display = "none";
  }

  randevuSlotTipDegisti();
};

window.randevuSlotModalKapat = function() {
  document.getElementById("randevuSlotModal").classList.remove("active");
};

window.randevuSlotTipDegisti = function() {
  const tip = document.getElementById("randevuSlotTip").value;
  document.getElementById("randevuSlotDigerWrap").style.display = tip === "diger" ? "block" : "none";
};

window.randevuSlotKaydet = async function() {
  const id = document.getElementById("randevuSlotDuzenleId").value;
  const tip = document.getElementById("randevuSlotTip").value;
  const tipAciklama = tip === "diger" ? document.getElementById("randevuSlotDigerAd").value.trim() : "";
  const tarih = document.getElementById("randevuSlotTarih").value;
  const baslangicSaat = document.getElementById("randevuSlotBaslangic").value;
  const bitisSaat = document.getElementById("randevuSlotBitis").value;
  const konum = document.getElementById("randevuSlotKonum").value.trim();
  const yonetimNotu = document.getElementById("randevuSlotNot").value.trim();

  const ogretmenSel = document.getElementById("randevuSlotOgretmen");
  const ogretmenEmail = ogretmenSel.options[ogretmenSel.selectedIndex]?.dataset?.email || "";
  const ogretmenAd = ogretmenSel.options[ogretmenSel.selectedIndex]?.dataset?.ad || "";
  const hedefSinif = ogretmenSel.options[ogretmenSel.selectedIndex]?.dataset?.sinif || "";

  if (!tarih) return showToast("Tarih zorunlu", "error");
  if (!baslangicSaat || !bitisSaat) return showToast("Saat zorunlu", "error");
  if (baslangicSaat >= bitisSaat) return showToast("Bitiş saati başlangıçtan sonra olmalı", "error");
  if (tip === "diger" && !tipAciklama) return showToast("Diğer tip için açıklama girin", "error");

  const data = {
    tip, tipAciklama,
    tarih, baslangicSaat, bitisSaat,
    konum, yonetimNotu,
    ogretmenEmail, ogretmenAd, hedefSinif,
    arsiv: false,
    guncellendi: new Date().toISOString()
  };

  try {
    if (id) {
      // Mevcut durumu/veli bilgisini koruyarak güncelle
      await updateDoc(doc(db, "randevuSlotlari", id), data);
      showToast("✓ Slot güncellendi");
    } else {
      data.durum = "musait";
      data.veliEmail = "";
      data.veliAd = "";
      data.ogrenciId = "";
      data.ogrenciAd = "";
      data.veliNotu = "";
      data.rezervasyonTarihi = "";
      data.olusturan = B.kullanici().email;
      data.olusturuldu = new Date().toISOString();
      const ref = doc(collection(db, "randevuSlotlari"));
      await setDoc(ref, data, { merge: true });
      showToast("✓ Slot oluşturuldu");
    }
    randevuSlotModalKapat();
    await randevuSlotlariYukle(true);
    randevuListesiRender();
  } catch (e) {
    console.error(e);
    showToast("Kaydedilemedi: " + e.message, "error");
  }
};

window.randevuSlotSil = async function() {
  const id = document.getElementById("randevuSlotDuzenleId").value;
  if (!id) return;
  if (!confirm("Bu slot silinecek. Emin misiniz?\n\nEğer slot doluysa veli rezervasyonu da silinmiş olacak.")) return;
  try {
    await deleteDoc(doc(db, "randevuSlotlari", id));
    showToast("✓ Slot silindi");
    randevuSlotModalKapat();
    await randevuSlotlariYukle(true);
    randevuListesiRender();
  } catch (e) {
    showToast("Silinemedi: " + e.message, "error");
  }
};

window.randevuSlotSilDirekt = async function(id) {
  const s = randevuSlotlari.find(x => x.id === id);
  if (!s) return;
  const uyari = s.durum === "dolu"
    ? `Bu slot DOLU (${s.veliAd || "veli"} rezerve etti). Yine de silmek istiyor musunuz?\n\nVeli artık rezervasyonu göremeyecek.`
    : "Bu slot silinecek. Emin misiniz?";
  if (!confirm(uyari)) return;
  try {
    await deleteDoc(doc(db, "randevuSlotlari", id));
    showToast("✓ Slot silindi");
    await randevuSlotlariYukle(true);
    randevuListesiRender();
  } catch (e) {
    showToast("Silinemedi: " + e.message, "error");
  }
};

window.randevuSlotIptal = async function(id) {
  const s = randevuSlotlari.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`${s.veliAd || "Veli"}'nin rezervasyonu iptal edilecek ve slot tekrar müsait olacak. Emin misiniz?`)) return;
  try {
    await updateDoc(doc(db, "randevuSlotlari", id), {
      durum: "musait",
      veliEmail: "",
      veliAd: "",
      ogrenciId: "",
      ogrenciAd: "",
      veliNotu: "",
      rezervasyonTarihi: "",
      hatirlatmaGonderildi: false,
      iptalEden: B.kullanici().email,
      iptalTarihi: new Date().toISOString()
    });
    showToast("✓ Rezervasyon iptal edildi");
    await randevuSlotlariYukle(true);
    randevuListesiRender();
  } catch (e) {
    showToast("İptal edilemedi: " + e.message, "error");
  }
};

// ===== TOPLU SLOT MODAL =====
window.randevuTopluModalAc = function() {
  document.getElementById("randevuTopluModal").classList.add("active");
  randevuOgretmenDropdownDoldur();
  // Varsayılan değerler
  document.getElementById("randevuTopluTip").value = "ogretmen_veli";
  document.getElementById("randevuTopluDigerAd").value = "";
  document.getElementById("randevuTopluTarih").value = new Date().toISOString().slice(0,10);
  document.getElementById("randevuTopluSure").value = "60";
  document.getElementById("randevuTopluBaslangic").value = "14:00";
  document.getElementById("randevuTopluBitis").value = "17:00";
  document.getElementById("randevuTopluKonum").value = "";
  document.getElementById("randevuTopluNot").value = "";
  document.getElementById("randevuTopluOgretmen").value = "";
  randevuTopluTipDegisti();
  randevuTopluOnizle();
};

window.randevuTopluModalKapat = function() {
  document.getElementById("randevuTopluModal").classList.remove("active");
};

window.randevuTopluTipDegisti = function() {
  const tip = document.getElementById("randevuTopluTip").value;
  document.getElementById("randevuTopluDigerWrap").style.display = tip === "diger" ? "block" : "none";
};

// Toplu slot önizleme (canlı)
function randevuTopluHesapla() {
  const tarih = document.getElementById("randevuTopluTarih").value;
  const baslangic = document.getElementById("randevuTopluBaslangic").value;
  const bitis = document.getElementById("randevuTopluBitis").value;
  const sure = parseInt(document.getElementById("randevuTopluSure").value, 10) || 60;

  if (!tarih || !baslangic || !bitis) return [];
  if (baslangic >= bitis) return [];

  const [bs1, bs2] = baslangic.split(":").map(Number);
  const [bt1, bt2] = bitis.split(":").map(Number);
  const baslangicDk = bs1 * 60 + bs2;
  const bitisDk = bt1 * 60 + bt2;

  const slotlar = [];
  let cur = baslangicDk;
  while (cur + sure <= bitisDk) {
    const slotEnd = cur + sure;
    const formatHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    slotlar.push({
      tarih,
      baslangicSaat: formatHHMM(cur),
      bitisSaat: formatHHMM(slotEnd)
    });
    cur = slotEnd;
  }
  return slotlar;
}

window.randevuTopluOnizle = function() {
  const slotlar = randevuTopluHesapla();
  const onizleme = document.getElementById("randevuTopluOnizleme");
  const sayac = document.getElementById("randevuTopluKaydetSayi");
  if (sayac) sayac.textContent = slotlar.length;

  if (slotlar.length === 0) {
    onizleme.innerHTML = `<span style="color:#dc2626;">⚠️ Geçerli saat aralığı ve süre seçin.</span>`;
    return;
  }
  onizleme.innerHTML = slotlar.map(s =>
    `<span class="slot-onizleme">${s.baslangicSaat}-${s.bitisSaat}</span>`
  ).join("");
};

// Toplu kayıt
window.randevuTopluKaydet = async function() {
  const slotlar = randevuTopluHesapla();
  if (slotlar.length === 0) return showToast("Önce geçerli saat aralığı seçin", "error");

  const tip = document.getElementById("randevuTopluTip").value;
  const tipAciklama = tip === "diger" ? document.getElementById("randevuTopluDigerAd").value.trim() : "";
  const konum = document.getElementById("randevuTopluKonum").value.trim();
  const yonetimNotu = document.getElementById("randevuTopluNot").value.trim();

  const ogretmenSel = document.getElementById("randevuTopluOgretmen");
  const ogretmenEmail = ogretmenSel.options[ogretmenSel.selectedIndex]?.dataset?.email || "";
  const ogretmenAd = ogretmenSel.options[ogretmenSel.selectedIndex]?.dataset?.ad || "";
  const hedefSinif = ogretmenSel.options[ogretmenSel.selectedIndex]?.dataset?.sinif || "";

  if (tip === "diger" && !tipAciklama) return showToast("Diğer tip için açıklama girin", "error");

  if (!confirm(`${slotlar.length} adet slot oluşturulacak. Devam edilsin mi?`)) return;

  showToast(`⏳ ${slotlar.length} slot kaydediliyor...`);

  let basarili = 0;
  let hata = 0;
  for (const slot of slotlar) {
    try {
      const data = {
        tip, tipAciklama,
        tarih: slot.tarih,
        baslangicSaat: slot.baslangicSaat,
        bitisSaat: slot.bitisSaat,
        konum, yonetimNotu,
        ogretmenEmail, ogretmenAd, hedefSinif,
        durum: "musait",
        veliEmail: "", veliAd: "", ogrenciId: "", ogrenciAd: "",
        veliNotu: "", rezervasyonTarihi: "",
        arsiv: false,
        olusturan: B.kullanici().email,
        olusturuldu: new Date().toISOString(),
        guncellendi: new Date().toISOString()
      };
      const ref = doc(collection(db, "randevuSlotlari"));
      await setDoc(ref, data, { merge: true });
      basarili++;
    } catch (e) {
      console.error("Slot kaydedilemedi:", e);
      hata++;
    }
  }

  if (hata === 0) {
    showToast(`✓ ${basarili} slot oluşturuldu`);
  } else {
    showToast(`⚠️ ${basarili} başarılı, ${hata} hata`, "error");
  }
  randevuTopluModalKapat();
  await randevuSlotlariYukle(true);
  randevuListesiRender();
};
// ===== /FAZ B - RANDEVU SLOT =====

// ============================================================
// ===== FAZ B Oturum 2: VELİ REZERVASYON SİSTEMİ =====
// ============================================================
// Veli müsait slotlardan birini seçer, Firestore TRANSACTION ile
// rezervasyon yapar (eşzamanlılık koruması — iki veli aynı slotu alamaz).
// İptal edebilir → slot tekrar açılır.


// Bu veli/öğrenci hangi sınıfta? Slot hedef sınıfla eşleşiyor mu?
function randevuVeliyeUygunMu(s) {
  if (!s.hedefSinif) return true; // Genel slot, herkes görür
  if (!B.veliOgrencileri() || B.veliOgrencileri().length === 0) {
    console.warn("[randevuVeliyeUygunMu] B.veliOgrencileri() henüz yüklenmedi");
    return false;
  }
  const hedefNorm = normalizeSinif(s.hedefSinif);
  const eslesti = B.veliOgrencileri().some(o => {
    const ayar = (typeof B.ayarlar() !== "undefined") ? B.ayarlar()[o.id] : null;
    const sinifHam = (ayar?.kayit?.sinif) || o.sinif || "";
    const sinifNorm = normalizeSinif(sinifHam);
    const ok = sinifNorm === hedefNorm;
    if (!ok) console.log(`[randevuVeliyeUygunMu] '${o.ogrenciAdSoyad || o.id}' sınıfı '${sinifHam}' (norm: '${sinifNorm}') ile slot hedefi '${s.hedefSinif}' (norm: '${hedefNorm}') eşleşmedi`);
    return ok;
  });
  return eslesti;
}

// Geçmiş tarih mi?
function randevuGecmisMi(s) {
  const bugun = new Date();
  const bugunStr = `${bugun.getFullYear()}-${String(bugun.getMonth()+1).padStart(2,"0")}-${String(bugun.getDate()).padStart(2,"0")}`;
  return s.tarih < bugunStr;
}

// Veli için tüm müsait slotları al
function veliMusaitSlotlar() {
  return randevuSlotlari.filter(s =>
    !s.arsiv &&
    (s.durum || "musait") === "musait" &&
    !randevuGecmisMi(s) &&
    randevuVeliyeUygunMu(s)
  ).sort((a, b) => {
    const t1 = a.tarih + (a.baslangicSaat || "00:00");
    const t2 = b.tarih + (b.baslangicSaat || "00:00");
    return t1.localeCompare(t2);
  });
}

// Veli'nin kendi rezervasyonları
function veliBenimSlotlar() {
  if (!B.kullanici()?.email) return [];
  const veliEmail = B.kullanici().email.toLowerCase();
  // DÜZELTME: eskiden yalnızca durum === "dolu" alınıyordu; veli kendi
  // gönderdiği ve henüz ONAYLANMAMIŞ talepleri takvimde göremiyordu.
  // Artık "talep" durumundakiler de listeleniyor (onay bekliyor rozetiyle).
  return randevuSlotlari.filter(s =>
    !s.arsiv &&
    (s.durum === "dolu" || s.durum === "talep") &&
    (s.veliEmail || "").toLowerCase() === veliEmail
  ).sort((a, b) => {
    const t1 = a.tarih + (a.baslangicSaat || "00:00");
    const t2 = b.tarih + (b.baslangicSaat || "00:00");
    return t1.localeCompare(t2);
  });
}

// Sayaçları güncelle (sekme rozetleri)
function veliRandevuSayaclariniGuncelle() {
  const musait = veliMusaitSlotlar().length;
  const benim = veliBenimSlotlar().length;
  const musaitEl = document.getElementById("veliMusaitSayac");
  const benimEl = document.getElementById("veliBenimSayac");
  if (musaitEl) {
    musaitEl.textContent = musait;
    musaitEl.style.display = musait > 0 ? "inline-block" : "none";
  }
  if (benimEl) {
    benimEl.textContent = benim;
    benimEl.style.display = benim > 0 ? "inline-block" : "none";
  }
}

// MÜSAİT RANDEVULAR LİSTESİ
async function veliMusaitRandevularRender() {
  const el = document.getElementById("veliMusaitListesi");
  if (!el) return;

  // Force=true ile her seferinde Firestore'dan taze veri çek
  await randevuSlotlariYukle(true);
  veliRandevuSayaclariniGuncelle();

  const slotlar = veliMusaitSlotlar();

  // Debug
  const tum = randevuSlotlari.filter(s => !s.arsiv && (s.durum || "musait") === "musait" && !randevuGecmisMi(s));
  console.log(`[Müsait Randevular] Toplam ${tum.length} aktif slot var, veliye uygun ${slotlar.length} tanesi.`);
  if (tum.length > 0 && slotlar.length === 0) {
    console.log("[Müsait Randevular] Hiçbir slot bu veliye uygun değil. Slotların hedefSinif değerleri:", tum.map(s => ({ baslik: s.tip, hedefSinif: s.hedefSinif })));
    console.log("[Müsait Randevular] Velinin öğrencileri:", B.veliOgrencileri()?.map(o => ({ ad: o.ogrenciAdSoyad, sinif: (B.ayarlar()?.[o.id]?.kayit?.sinif) || o.sinif })));
  }

  if (slotlar.length === 0) {
    const ipucu = tum.length > 0
      ? `<div style="margin-top:10px; padding:10px 12px; background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; font-size:11px; color:#9a3412; text-align:left;">
          💡 ${tum.length} slot mevcut ama sınıfınıza/öğrencinize uygun değil.<br>
          F12 → Console'da hangi sınıf eşleşmediğini görebilirsiniz.
         </div>`
      : "";
    el.innerHTML = `<div class="ca-card" style="padding:30px; text-align:center; color:var(--c-muted); font-size:13px;">
      📭 Şu an müsait randevu yok.<br>
      <span style="font-size:11px; color:#9ca3af;">Yönetim slot oluşturduğunda burada görünecek.</span>
      ${ipucu}
    </div>`;
    return;
  }

  el.innerHTML = slotlar.map(s => veliRandevuKartHTML(s, false)).join("");
}

// VELİ KENDİ RANDEVULARI LİSTESİ
async function veliBenimRandevularRender() {
  const el = document.getElementById("veliBenimRandevuListesi");
  if (!el) return;

  await randevuSlotlariYukle();
  veliRandevuSayaclariniGuncelle();

  const slotlar = veliBenimSlotlar();
  if (slotlar.length === 0) {
    el.innerHTML = `<div class="ca-card" style="padding:30px; text-align:center; color:var(--c-muted); font-size:13px;">
      ⭐ Henüz randevunuz yok.<br>
      <span style="font-size:11px; color:#9ca3af;">"Randevular" sekmesinden müsait bir slot seçebilir<br>veya ana sayfadan yeni randevu talebi oluşturabilirsiniz.</span>
      <br><button onclick="caRandevuTalepAc()" style="margin-top:14px; padding:10px 20px; border:none; background:var(--c-green,#2D5E3E); color:#fff; border-radius:11px; cursor:pointer; font-family:inherit; font-weight:700; font-size:13px;">Randevu Talep Et</button>
    </div>`;
    return;
  }

  el.innerHTML = slotlar.map(s => veliRandevuKartHTML(s, true)).join("");
}

// Veli randevu kart HTML üretimi
function veliRandevuKartHTML(s, benim) {
  const tarih = new Date(s.tarih);
  const aylarKisa = ["OCA","ŞUB","MAR","NİS","MAY","HAZ","TEM","AĞU","EYL","EKİ","KAS","ARA"];
  const ayKisa = aylarKisa[tarih.getMonth()];
  const gunNum = tarih.getDate();

  const tip = s.tip || "diger";
  const tipLabel = (tip === "diger" && s.tipAciklama)
    ? `📌 ${escapeHtmlGelisim(s.tipAciklama)}`
    : RANDEVU_TIP_LABEL[tip] || "📌 Slot";

  const ogretmenInfo = s.ogretmenAd ? `<span>👤 ${escapeHtmlGelisim(s.ogretmenAd)}</span>` : "";
  const konumInfo = s.konum ? `<span>📍 ${escapeHtmlGelisim(s.konum)}</span>` : "";

  const ogrenciBilgi = benim && s.ogrenciAd
    ? `<span style="background:#dcfce7; color:#166534;">👶 ${escapeHtmlGelisim(s.ogrenciAd)} için</span>`
    : "";

  // Durum rozeti — veli kendi talebinin onaylanıp onaylanmadığını görsün
  const durumRozeti = !benim ? "" :
    s.durum === "talep"
      ? `<span style="background:#FEF3C7; color:#92400E; font-weight:700;">⏳ Onay bekliyor</span>`
      : `<span style="background:#D1FAE5; color:#065F46; font-weight:700;">✓ Onaylandı</span>`;

  const onclick = benim
    ? `veliRandevuDetayAc('${s.id}', true)`
    : `veliSlotRezerveModalAc('${s.id}')`;

  return `
    <div class="veli-randevu-kart ${benim ? 'benim' : ''}" data-tip="${tip}" onclick="${onclick}">
      <div class="veli-randevu-tarih-kutu">
        <div class="ay">${ayKisa}</div>
        <div class="gun">${gunNum}</div>
      </div>
      <div class="veli-randevu-icerik">
        <div class="veli-randevu-baslik">${tipLabel.replace(/^[^\s]+\s/, '')}</div>
        <div class="veli-randevu-meta">
          <span>⏰ ${s.baslangicSaat || ""}-${s.bitisSaat || ""}</span>
          ${ogretmenInfo}
          ${konumInfo}
          ${ogrenciBilgi}
          ${durumRozeti}
        </div>
      </div>
      <span style="color:#94a3b8; font-size:18px; flex-shrink:0;">›</span>
    </div>
  `;
}

// SLOT REZERVE MODAL — Veli müsait bir slot tıkladığında açılır
window.veliSlotRezerveModalAc = function(slotId) {
  const s = randevuSlotlari.find(x => x.id === slotId);
  if (!s) { showToast("Slot bulunamadı", "error"); return; }
  if ((s.durum || "musait") !== "musait") {
    showToast("Bu slot artık dolu — başkası rezerve etti", "error");
    veliMusaitRandevularRender();
    return;
  }

  const tip = s.tip || "diger";
  const tipLabel = (tip === "diger" && s.tipAciklama)
    ? `📌 ${escapeHtmlGelisim(s.tipAciklama)}`
    : RANDEVU_TIP_LABEL[tip] || "📌 Slot";

  // Tarih güzel format
  const tarih = new Date(s.tarih);
  const aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  const tarihStr = `${tarih.getDate()} ${aylar[tarih.getMonth()]} ${tarih.getFullYear()} · ${gunler[tarih.getDay()]}`;

  // Çocuk seçici (birden fazla varsa)
  let cocukSeciciHTML = "";
  if (B.veliOgrencileri() && B.veliOgrencileri().length > 0) {
    if (B.veliOgrencileri().length === 1) {
      // Tek çocuk → otomatik
      cocukSeciciHTML = `
        <input type="hidden" id="rezervOgrenciId" value="${B.veliOgrencileri()[0].id}">
        <input type="hidden" id="rezervOgrenciAd" value="${escapeHtmlGelisim(B.veliOgrencileri()[0].ogrenciAdSoyad || "")}">
      `;
    } else {
      // Birden fazla → dropdown
      const options = B.veliOgrencileri().map(o =>
        `<option value="${o.id}" data-ad="${escapeHtmlGelisim(o.ogrenciAdSoyad || "")}">${escapeHtmlGelisim(o.ogrenciAdSoyad || "")}</option>`
      ).join("");
      cocukSeciciHTML = `
        <div class="rezervasyon-form-group">
          <label>Çocuğunuz</label>
          <select id="rezervOgrenciSec" required>
            <option value="">— Çocuk seçin —</option>
            ${options}
          </select>
          <input type="hidden" id="rezervOgrenciId" value="">
          <input type="hidden" id="rezervOgrenciAd" value="">
        </div>
      `;
    }
  }

  // Meslek sunumu özel alanları (Faz C için hazır — şimdilik basit)
  const meslekHTML = (tip === "meslek_sunumu") ? `
    <div class="rezervasyon-form-group">
      <label>Tanıtacağınız Meslek *</label>
      <input type="text" id="rezervMeslekAd" placeholder="Örn: Diş Hekimi, Pilot, Bilim İnsanı..."
             style="width:100%; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:13px;">
    </div>
    <div class="rezervasyon-form-group">
      <label>Kısa Açıklama *</label>
      <textarea id="rezervMeslekAciklama" rows="3" placeholder="Neyi nasıl anlatacaksınız? Maket, görsel veya materyal getirecek misiniz?"></textarea>
    </div>
  ` : "";

  const cicekSvg = `
    <svg width="36" height="36" viewBox="0 0 200 200" aria-hidden="true">
      <g transform="translate(100 100)">
        <g fill="#FFD4DC">
          <ellipse cx="0" cy="-34" rx="16" ry="30"/>
          <ellipse cx="0" cy="-34" rx="16" ry="30" transform="rotate(72)"/>
          <ellipse cx="0" cy="-34" rx="16" ry="30" transform="rotate(144)"/>
          <ellipse cx="0" cy="-34" rx="16" ry="30" transform="rotate(216)"/>
          <ellipse cx="0" cy="-34" rx="16" ry="30" transform="rotate(288)"/>
        </g>
        <circle r="18" fill="#F5C84B"/>
      </g>
    </svg>
  `;

  const html = `
    <div id="rezervasyonOverlay" class="rezervasyon-overlay" onclick="if(event.target===this) rezervasyonModalKapat()">
      <div class="rezervasyon-kart">
        <div class="rezervasyon-kart-head" data-tip="${tip}">
          <div class="rezervasyon-cicek">${cicekSvg}</div>
          <div style="text-align:center; margin-top:10px;">
            <div style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">
              ${tipLabel.replace(/^[^\s]+\s/, '')}
            </div>
            <h2 style="margin:6px 0 0; font-size:18px; color:#1f2937; font-weight:700;">Randevu Detayları</h2>
          </div>
        </div>
        <div class="rezervasyon-body">
          <div class="rezervasyon-meta">
            <div class="rezervasyon-meta-satir"><strong>📆 Tarih:</strong><span>${tarihStr}</span></div>
            <div class="rezervasyon-meta-satir"><strong>⏰ Saat:</strong><span>${s.baslangicSaat} - ${s.bitisSaat}</span></div>
            ${s.ogretmenAd ? `<div class="rezervasyon-meta-satir"><strong><i data-lucide="user" style="width:13px;height:13px;vertical-align:-2px;"></i> Görüşülecek:</strong><span>${escapeHtmlGelisim(s.ogretmenAd)}</span></div>` : ''}
            ${s.konum ? `<div class="rezervasyon-meta-satir"><strong><i data-lucide="map-pin" style="width:13px;height:13px;vertical-align:-2px;"></i> Konum:</strong><span>${escapeHtmlGelisim(s.konum)}</span></div>` : ''}
            ${s.hedefSinif ? `<div class="rezervasyon-meta-satir"><strong>🏷️ Sınıf:</strong><span>${escapeHtmlGelisim(s.hedefSinif)}</span></div>` : ''}
          </div>

          ${s.yonetimNotu ? `<div style="background:#fef3c7; border:1px solid #fde68a; color:#78350f; padding:10px 14px; border-radius:10px; font-size:12px; margin-bottom:14px;">
            <strong><i data-lucide="lightbulb" style="width:13px;height:13px;vertical-align:-2px;"></i> Yönetim notu:</strong><br>${escapeHtmlGelisim(s.yonetimNotu).replace(/\n/g, '<br>')}
          </div>` : ''}

          ${cocukSeciciHTML}

          ${meslekHTML}

          <div class="rezervasyon-form-group">
            <label>Notunuz (opsiyonel)</label>
            <textarea id="rezervVeliNot" rows="2" placeholder="Konuyla ilgili ekstra söyleyeceğiniz bir şey var mı?"></textarea>
          </div>
        </div>
        <div class="rezervasyon-butonlar">
          <button class="rezervasyon-btn kapat" onclick="rezervasyonModalKapat()">Kapat</button>
          <button class="rezervasyon-btn primary" id="rezervOnayBtn" onclick="veliSlotRezerveEt('${slotId}')"><i data-lucide="phone" style="width:13px;height:13px;vertical-align:-2px;"></i> Randevu Al</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);

  // Çocuk seçici değişince hidden alanları güncelle
  const cocukSec = document.getElementById("rezervOgrenciSec");
  if (cocukSec) {
    cocukSec.onchange = () => {
      const opt = cocukSec.options[cocukSec.selectedIndex];
      document.getElementById("rezervOgrenciId").value = opt.value;
      document.getElementById("rezervOgrenciAd").value = opt.dataset.ad || "";
    };
  }
};

window.rezervasyonModalKapat = function() {
  document.getElementById("rezervasyonOverlay")?.remove();
};

// FIRESTORE TRANSACTION ile rezervasyon — eşzamanlılık koruması
window.veliSlotRezerveEt = async function(slotId) {
  const btn = document.getElementById("rezervOnayBtn");
  if (!btn) return;

  // Validasyon
  const ogrenciId = document.getElementById("rezervOgrenciId")?.value || "";
  const ogrenciAd = document.getElementById("rezervOgrenciAd")?.value || "";

  if (B.veliOgrencileri() && B.veliOgrencileri().length > 0 && !ogrenciId) {
    return showToast("Lütfen çocuğunuzu seçin", "error");
  }

  // Meslek sunumu özel alanlar
  const meslekAdEl = document.getElementById("rezervMeslekAd");
  const meslekAciklamaEl = document.getElementById("rezervMeslekAciklama");
  const meslekAdi = meslekAdEl?.value?.trim() || "";
  const meslekAciklama = meslekAciklamaEl?.value?.trim() || "";

  if (meslekAdEl && !meslekAdi) return showToast("Tanıtacağınız mesleği yazın", "error");
  if (meslekAciklamaEl && !meslekAciklama) return showToast("Kısa açıklama yazın", "error");

  const veliNotu = document.getElementById("rezervVeliNot")?.value?.trim() || "";
  const veliEmail = B.kullanici().email.toLowerCase();
  const veliAd = B.kullanici().displayName || veliEmail.split("@")[0];

  btn.disabled = true;
  btn.innerHTML = "⏳ Rezervasyon yapılıyor...";

  try {
    // TRANSACTION — atomik rezervasyon
    await runTransaction(db, async (tx) => {
      const slotRef = doc(db, "randevuSlotlari", slotId);
      const snap = await tx.get(slotRef);
      if (!snap.exists()) throw new Error("Slot artık mevcut değil");
      const data = snap.data();
      if (data.arsiv) throw new Error("Slot arşivlenmiş");
      if ((data.durum || "musait") === "dolu") {
        throw new Error("Bu slot artık dolu — başkası rezerve etti");
      }
      // Rezervasyon
      const guncelle = {
        durum: "dolu",
        veliEmail,
        veliAd,
        ogrenciId,
        ogrenciAd,
        veliNotu,
        rezervasyonTarihi: new Date().toISOString(),
        hatirlatmaGonderildi: false,
        guncellendi: new Date().toISOString()
      };
      if (data.tip === "meslek_sunumu") {
        guncelle.meslekAdi = meslekAdi;
        guncelle.meslekAciklama = meslekAciklama;
      }
      tx.update(slotRef, guncelle);
    });

    showToast("✓ Randevunuz alındı!");
    rezervasyonModalKapat();
    await randevuSlotlariYukle(true);
    veliMusaitRandevularRender();
    veliBenimRandevularRender();
    veliRandevuSayaclariniGuncelle();
  } catch (e) {
    console.error("Rezervasyon hatası:", e);
    btn.disabled = false;
    btn.innerHTML = "📞 Randevu Al";
    showToast(e.message || "Rezervasyon başarısız", "error");
    // Sayfayı yenile ki güncel durumu görsün
    if (e.message && e.message.includes("dolu")) {
      await randevuSlotlariYukle(true);
      rezervasyonModalKapat();
      veliMusaitRandevularRender();
    }
  }
};

// VELİ RANDEVUSUNUN DETAYI (kendi rezervasyonu) - iptal butonu ile
window.veliRandevuDetayAc = function(slotId, benim) {
  const s = randevuSlotlari.find(x => x.id === slotId);
  if (!s) return;

  const tip = s.tip || "diger";
  const tipLabel = (tip === "diger" && s.tipAciklama)
    ? `📌 ${escapeHtmlGelisim(s.tipAciklama)}`
    : RANDEVU_TIP_LABEL[tip] || "📌 Slot";

  const tarih = new Date(s.tarih);
  const aylar = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  const tarihStr = `${tarih.getDate()} ${aylar[tarih.getMonth()]} ${tarih.getFullYear()} · ${gunler[tarih.getDay()]}`;

  const meslekHTML = (s.tip === "meslek_sunumu" && (s.meslekAdi || s.meslekAciklama)) ? `
    <div class="rezervasyon-meta" style="background:#fdf2f8; border:1px solid #f9a8d4; margin-top:10px;">
      <div class="rezervasyon-meta-satir"><strong>💼 Meslek:</strong><span>${escapeHtmlGelisim(s.meslekAdi || "—")}</span></div>
      ${s.meslekAciklama ? `<div class="rezervasyon-meta-satir" style="flex-direction:column;"><strong><i data-lucide="file-text" style="width:13px;height:13px;vertical-align:-2px;"></i> Açıklama:</strong><span>${escapeHtmlGelisim(s.meslekAciklama).replace(/\n/g,'<br>')}</span></div>` : ""}
    </div>
  ` : "";

  const cicekSvg = `
    <svg width="36" height="36" viewBox="0 0 200 200" aria-hidden="true">
      <g transform="translate(100 100)">
        <g fill="#FFD4DC">
          <ellipse cx="0" cy="-34" rx="16" ry="30"/>
          <ellipse cx="0" cy="-34" rx="16" ry="30" transform="rotate(72)"/>
          <ellipse cx="0" cy="-34" rx="16" ry="30" transform="rotate(144)"/>
          <ellipse cx="0" cy="-34" rx="16" ry="30" transform="rotate(216)"/>
          <ellipse cx="0" cy="-34" rx="16" ry="30" transform="rotate(288)"/>
        </g>
        <circle r="18" fill="#F5C84B"/>
      </g>
    </svg>
  `;

  const html = `
    <div id="rezervasyonOverlay" class="rezervasyon-overlay" onclick="if(event.target===this) rezervasyonModalKapat()">
      <div class="rezervasyon-kart">
        <div class="rezervasyon-kart-head" data-tip="${tip}">
          <div class="rezervasyon-cicek">${cicekSvg}</div>
          <div style="text-align:center; margin-top:10px;">
            <div style="font-size:11px; font-weight:700; color:#166534; text-transform:uppercase; letter-spacing:0.5px;">
              ⭐ Randevunuz Onaylandı
            </div>
            <h2 style="margin:6px 0 0; font-size:18px; color:#1f2937; font-weight:700;">${tipLabel.replace(/^[^\s]+\s/, '')}</h2>
          </div>
        </div>
        <div class="rezervasyon-body">
          <div class="rezervasyon-meta">
            <div class="rezervasyon-meta-satir"><strong>📆 Tarih:</strong><span>${tarihStr}</span></div>
            <div class="rezervasyon-meta-satir"><strong>⏰ Saat:</strong><span>${s.baslangicSaat} - ${s.bitisSaat}</span></div>
            ${s.ogretmenAd ? `<div class="rezervasyon-meta-satir"><strong><i data-lucide="user" style="width:13px;height:13px;vertical-align:-2px;"></i> Görüşülecek:</strong><span>${escapeHtmlGelisim(s.ogretmenAd)}</span></div>` : ''}
            ${s.konum ? `<div class="rezervasyon-meta-satir"><strong><i data-lucide="map-pin" style="width:13px;height:13px;vertical-align:-2px;"></i> Konum:</strong><span>${escapeHtmlGelisim(s.konum)}</span></div>` : ''}
            ${s.ogrenciAd ? `<div class="rezervasyon-meta-satir"><strong><i data-lucide="baby" style="width:13px;height:13px;vertical-align:-2px;"></i> Çocuğunuz:</strong><span>${escapeHtmlGelisim(s.ogrenciAd)}</span></div>` : ''}
          </div>

          ${meslekHTML}

          ${s.yonetimNotu ? `<div style="background:#fef3c7; border:1px solid #fde68a; color:#78350f; padding:10px 14px; border-radius:10px; font-size:12px; margin-bottom:10px;">
            <strong><i data-lucide="lightbulb" style="width:13px;height:13px;vertical-align:-2px;"></i> Yönetim notu:</strong><br>${escapeHtmlGelisim(s.yonetimNotu).replace(/\n/g, '<br>')}
          </div>` : ''}

          ${s.veliNotu ? `<div style="background:#ecfeff; border:1px solid #a5f3fc; color:#075985; padding:10px 14px; border-radius:10px; font-size:12px; margin-bottom:10px;">
            <strong><i data-lucide="file-text" style="width:13px;height:13px;vertical-align:-2px;"></i> Notunuz:</strong><br>${escapeHtmlGelisim(s.veliNotu).replace(/\n/g, '<br>')}
          </div>` : ''}

          <!-- MESAJLAŞMA SEÇENEKLERİ -->
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px 14px; margin-top:6px;">
            <div style="font-size:12px; font-weight:700; color:#166534; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <i data-lucide="message-circle" style="width:13px;height:13px;vertical-align:-2px;"></i> İletişim
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${s.ogretmenEmail ? `
                <button onclick="veliRandevuMesajlas('${s.id}', 'ogretmen')" style="display:flex; align-items:center; gap:8px; padding:10px 12px; background:white; border:1px solid #d1d5db; border-radius:8px; font-size:12px; color:#374151; cursor:pointer; text-align:left; width:100%;">
                  <span style="font-size:16px;"><i data-lucide="user" style="width:15px;height:15px;vertical-align:-2px;"></i></span>
                  <div>
                    <div style="font-weight:600;">${escapeHtmlGelisim(s.ogretmenAd || 'Öğretmen')} ile Mesajlaş</div>
                    <div style="font-size:10px; color:#6b7280;">Randevu öncesi soru sorabilir, bilgi alabilirsiniz</div>
                  </div>
                  <span style="margin-left:auto; color:#9ca3af;">›</span>
                </button>` : ''}
              <button onclick="veliRandevuMesajlas('${s.id}', 'yonetim')" style="display:flex; align-items:center; gap:8px; padding:10px 12px; background:white; border:1px solid #d1d5db; border-radius:8px; font-size:12px; color:#374151; cursor:pointer; text-align:left; width:100%;">
                <span style="font-size:16px;">🏢</span>
                <div>
                  <div style="font-weight:600;">Yönetim ile Mesajlaş</div>
                  <div style="font-size:10px; color:#6b7280;">Genel sorular, organizasyon bilgisi</div>
                </div>
                <span style="margin-left:auto; color:#9ca3af;">›</span>
              </button>
            </div>
          </div>
        </div>
        <div class="rezervasyon-butonlar" style="flex-direction:column; gap:8px;">
          <button class="rezervasyon-btn primary" onclick="veliRandevuICSIndir('${s.id}')" style="background:#4285f4;">
            <i data-lucide="calendar" style="width:13px;height:13px;vertical-align:-2px;"></i> Google/Apple Takvime Ekle
          </button>
          <div style="display:flex; gap:8px; width:100%;">
            <button class="rezervasyon-btn iptal" onclick="veliRandevuIptal('${s.id}')">❌ Randevuyu İptal Et</button>
            <button class="rezervasyon-btn kapat" onclick="rezervasyonModalKapat()">Kapat</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);
};

// VELİ → ÖĞRETMEN veya YÖNETİM mesajlaşma (randevu detayından açılır)
window.veliRandevuMesajlas = async function(slotId, hedef) {
  const s = randevuSlotlari.find(x => x.id === slotId);
  if (!s) return;

  let personelEmail = "";
  let personelAd = "";
  let personelRol = "";

  if (hedef === "ogretmen" && s.ogretmenEmail) {
    personelEmail = s.ogretmenEmail;
    personelAd = s.ogretmenAd || "Öğretmen";
    personelRol = "ogretmen";
  } else {
    // Yönetim → kurucu müdür / müdür
    // Email ayarlardan veya sabit
    personelEmail = (typeof OKUL_MAIL !== "undefined" ? OKUL_MAIL : "eposta@bircicekkoleji.com").toLowerCase();
    personelAd = "Bir Çiçek Koleji Yönetim";
    personelRol = "yonetim";
  }

  try {
    const veliEmail = B.kullanici().email.toLowerCase();
    const veliAd = B.kullanici().displayName || veliEmail.split("@")[0];

    // Öğrenci bilgisi
    let ogrenciId = s.ogrenciId || "";
    let ogrenciAd = s.ogrenciAd || "";
    let ogrenciSinif = s.hedefSinif || "";

    // Eğer slot'ta yoksa B.veliOgrencileri()[0]'dan al
    if (!ogrenciId && B.veliOgrencileri() && B.veliOgrencileri().length > 0) {
      ogrenciId = B.veliOgrencileri()[0].id;
      ogrenciAd = B.veliOgrencileri()[0].ogrenciAdSoyad || "";
      const ayar = B.ayarlar()?.[ogrenciId];
      ogrenciSinif = ayar?.kayit?.sinif || B.veliOgrencileri()[0].sinif || "";
    }

    const thread = await mesajThreadGetirVeyaOlustur({
      personel: { email: personelEmail, ad: personelAd, rol: personelRol },
      veli: { email: veliEmail, ad: veliAd },
      ogrenci: { id: ogrenciId, ad: ogrenciAd, sinif: ogrenciSinif }
    });

    // Modal'ı kapat ve mesajlaşma ekranına geç
    rezervasyonModalKapat();
    if (typeof caGo === "function") {
      // Aktif thread'i set et ki açıldığında bu konuşma seçili gelsin
      if (typeof caMsgAktifThreadId !== "undefined") {
        window.caMsgAktifThreadId = thread.id;
      }
      caGo("mesajlar");
    }
    showToast(`✓ ${personelAd} ile mesajlaşma açıldı`);
  } catch (e) {
    console.error("Mesajlaşma açılamadı:", e);
    showToast("Mesajlaşma açılamadı: " + e.message, "error");
  }
};

// VELİ RANDEVUSUNU İPTAL ET — slot tekrar müsait olur
window.veliRandevuIptal = async function(slotId) {
  if (!confirm("Bu randevuyu iptal etmek istediğinize emin misiniz?\n\nSlot tekrar müsait olarak diğer velilere açılacak.")) return;

  try {
    const veliEmail = B.kullanici().email.toLowerCase();
    await runTransaction(db, async (tx) => {
      const slotRef = doc(db, "randevuSlotlari", slotId);
      const snap = await tx.get(slotRef);
      if (!snap.exists()) throw new Error("Slot bulunamadı");
      const data = snap.data();
      // Güvenlik: sadece kendi rezervasyonunu iptal edebilir
      if ((data.veliEmail || "").toLowerCase() !== veliEmail) {
        throw new Error("Bu randevu size ait değil");
      }
      tx.update(slotRef, {
        durum: "musait",
        veliEmail: "",
        veliAd: "",
        ogrenciId: "",
        ogrenciAd: "",
        veliNotu: "",
        rezervasyonTarihi: "",
        meslekAdi: "",
        meslekAciklama: "",
        hatirlatmaGonderildi: false,
        guncellendi: new Date().toISOString()
      });
    });

    showToast("✓ Randevu iptal edildi");
    rezervasyonModalKapat();
    await randevuSlotlariYukle(true);
    veliMusaitRandevularRender();
    veliBenimRandevularRender();
    veliRandevuSayaclariniGuncelle();
  } catch (e) {
    console.error("İptal hatası:", e);
    showToast(e.message || "İptal başarısız", "error");
  }
};

// VELİ İÇİN ICS EXPORT — Google/Apple Calendar
window.veliRandevuICSIndir = function(slotId) {
  const s = randevuSlotlari.find(x => x.id === slotId);
  if (!s) return;

  const tarihParts = s.tarih.split("-");
  const tarihKodu = tarihParts.join("");
  const bsSaat = (s.baslangicSaat || "00:00").replace(":", "") + "00";
  const btSaat = (s.bitisSaat || s.baslangicSaat || "00:00").replace(":", "") + "00";

  const esc = (str) => (str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const tipLabel = (s.tip === "diger" && s.tipAciklama) ? s.tipAciklama : (RANDEVU_TIP_LABEL[s.tip] || "Randevu").replace(/^[^\s]+\s/, '');
  const baslik = `📞 ${tipLabel}${s.ogretmenAd ? ' - ' + s.ogretmenAd : ''}`;

  let aciklama = "";
  if (s.ogrenciAd) aciklama += `Çocuk: ${s.ogrenciAd}\n`;
  if (s.veliNotu) aciklama += `Notunuz: ${s.veliNotu}\n`;
  if (s.yonetimNotu) aciklama += `Yönetim notu: ${s.yonetimNotu}\n`;
  if (s.tip === "meslek_sunumu" && s.meslekAdi) aciklama += `Meslek: ${s.meslekAdi}\n`;
  aciklama += `\nBir Çiçek Koleji - Veli Portalı`;

  const dtStart = `DTSTART;TZID=Europe/Istanbul:${tarihKodu}T${bsSaat}`;
  const dtEnd = `DTEND;TZID=Europe/Istanbul:${tarihKodu}T${btSaat}`;
  const uid = `randevu_${slotId}@bircicekkoleji.com`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bir Çiçek Koleji//Randevu//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    dtStart,
    dtEnd,
    `SUMMARY:${esc(baslik)}`,
    `DESCRIPTION:${esc(aciklama)}`,
    s.konum ? `LOCATION:${esc(s.konum)}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT5H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(baslik + ' - 5 saat sonra')}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `randevu_${s.tarih}_${s.baslangicSaat || '00-00'}.ics`.replace(/:/g, "-");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("✓ Takvim dosyası indirildi (5 saat önce hatırlatma dahil)");
};
// ===== /FAZ B Oturum 2 =====

// ── Çekirdeğin erişimi için ──
window.randevuSlotlariYukle            = randevuSlotlariYukle;
window.randevuListesiRender            = randevuListesiRender;
window.veliMusaitRandevularRender      = veliMusaitRandevularRender;
window.veliBenimRandevularRender       = veliBenimRandevularRender;
window.veliRandevuSayaclariniGuncelle  = veliRandevuSayaclariniGuncelle;
window.veliBenimSlotlar                = veliBenimSlotlar;
window.veliMusaitSlotlar               = veliMusaitSlotlar;
window.RANDEVU_TIP_LABEL               = RANDEVU_TIP_LABEL;
console.log("Randevu modülü yüklendi.");
