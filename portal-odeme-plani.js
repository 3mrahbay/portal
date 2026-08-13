// ══════════════════════════════════════════════════════════════════════════
// PORTAL · ÖDEME PLANI BELGESİ (A4 · PDF)
// ──────────────────────────────────────────────────────────────────────────
// Veliye verilecek tek sayfalık ödeme planı. Sözleşmeden AYRIDIR:
// sözleşme resmî MEB belgesi, bu ise "kim ne zaman ne kadar ödeyecek"
// sorusunun sade cevabı.
//
// Veri kaynağı portal-cikti.js'in topladığı veridir — yani ekranda ne
// görünüyorsa belgede o çıkar. Aylık kartlarda elle düzeltilmiş tutarlar
// da aynen yansır (hesaplama TEKRARLANMAZ, sadece okunur).
//
// 2026-08-13
// ══════════════════════════════════════════════════════════════════════════

const B = window.BCK;

// Carlito fontu yüklendiyse Türkçe karakterler olduğu gibi yazılır.
// Yüklenemezse (eski tarayıcı, dosya eksik) helvetica'ya düşer ve
// harfler sadeleştirilir — belge yine de okunabilir kalır.
let _turkceFontVar = false;

function trPdf(s) {
  if (!s && s !== 0) return "";
  const m = String(s);
  if (_turkceFontVar) return m;           // font var → dokunma
  return m
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c");
}

// Aktif font adı — autoTable ve setFont çağrılarında kullanılır
function fontAdi() { return _turkceFontVar ? "Carlito" : "helvetica"; }

function paraFmt(n) {
  return (Math.round(Number(n) || 0)).toLocaleString("tr-TR") + " TL";
}

const PLAN_ADLARI = {
  erken_kayit:     "Erken Kayıt",
  on_odeme_taksit: "Ön Ödeme + Taksitlendirme",
  sabit:           "Normal Kayıt (eşit ödeme)"
};

// Ödeme planı verisini topla (portal-cikti.js'in fonksiyonunu kullanır)
function odemePlaniVerisi() {
  if (typeof window.toplaSozlesmeVerisi !== "function") {
    console.warn("portal-cikti.js yüklenmemiş");
    return null;
  }
  const veri = window.toplaSozlesmeVerisi();
  if (!veri) return null;

  const o = B.ogrenci();
  const ayar = (B.ayarlar() || {})[o?.id] || {};
  const a = ayar.aidatAyarlari || {};
  const aylikOdemeler = ayar.aylikOdemeler || {};

  const planKodu = a.odemePlani ||
    (document.getElementById("ayarOdemePlani")?.value) ||
    (Number(a.onOdeme) > 0 ? "on_odeme_taksit" : "sabit");

  return { veri, a, aylikOdemeler, planKodu };
}

window.odemePlaniPDF = async function() {
  try {
    const paket = odemePlaniVerisi();
    if (!paket) { showToast("Veri alınamadı", "error"); return; }
    const { veri, a, aylikOdemeler, planKodu } = paket;
    const od = veri.odeme;

    if (!od.taksitler || !od.taksitler.length) {
      showToast("Önce aidat ayarlarını kaydedin (ödeme planı boş)", "error");
      return;
    }

    showToast("Ödeme planı hazırlanıyor…");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    // Türkçe font (Carlito) — başarısız olursa helvetica + sadeleştirme
    _turkceFontVar = (typeof window.pdfTurkceFont === "function")
      ? window.pdfTurkceFont(pdf) : false;
    const F = fontAdi();

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ── BAŞLIK ──
    try {
      pdf.addImage(B.LOGO_OKUL_BASE64, "PNG", margin, y - 2, 15, 20);
    } catch (e) {}

    pdf.setFont(F, "bold");
    pdf.setFontSize(13);
    pdf.text(trPdf(veri.okul.adi), pageW / 2, y + 4, { align: "center" });
    pdf.setFontSize(11);
    pdf.text("ÖDEME PLANI", pageW / 2, y + 10, { align: "center" });
    pdf.setFont(F, "normal");
    pdf.setFontSize(9);
    pdf.text(`${veri.okul.donem} Eğitim ve Öğretim Yılı`, pageW / 2, y + 15, { align: "center" });

    y += 22;
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageW - margin, y);
    y += 5;

    // Satır sayısına göre sıkışıklık ayarı — belge TEK SAYFADA kalmalı.
    const taksitAdedi = od.taksitler.length + (od.onOdeme > 0 ? 1 : 0);
    const sik = taksitAdedi > 11;              // 12+ taksitte daha dar satırlar
    const pad = sik ? 1.3 : 1.7;
    const fs  = sik ? 8 : 8.5;

    // ── ÖĞRENCİ / VELİ ──
    const veliAd = veri.anne.adSoyad || veri.baba.adSoyad || veri.vasi?.adSoyad || "";
    pdf.autoTable({
      startY: y,
      body: [
        ["Öğrenci", trPdf(veri.ogrenci.adSoyad || "-")],
        ["Sınıf / Program", trPdf((veri.ogrenci.sinif || "-") + "  /  " + (veri.ogrenci.program || "-"))],
        ["Veli", trPdf(veliAd || "-")],
        ["Ödeme Planı", trPdf(PLAN_ADLARI[planKodu] || "-")]
      ],
      theme: "grid",
      styles: { font: F, fontSize: fs, cellPadding: pad },
      columnStyles: { 0: { cellWidth: 40, fontStyle: "bold", fillColor: [245, 245, 245] }, 1: { cellWidth: contentW - 40 } },
      margin: { left: margin, right: margin }
    });
    y = pdf.lastAutoTable.finalY + 5;

    // ── AYLIK TAKSİT TABLOSU ──
    // NOT: Toplam satırı bilerek tabloya konmadı; tutarlar en altta
    // "Açıklamalar" bölümünde yazıyla veriliyor.
    const taksitToplam = od.taksitler.reduce((s, t) => s + (Number(t.tutar) || 0), 0);
    const egitimToplam = (Number(od.onOdeme) || 0) + taksitToplam;

    const bugun = new Date();
    const buAy = bugun.getFullYear() + "-" + String(bugun.getMonth() + 1).padStart(2, "0");

    const satirlar = [];
    if (od.onOdeme > 0) {
      const opOdendi = !!(aylikOdemeler.__onOdeme && aylikOdemeler.__onOdeme.odendi);
      satirlar.push(["–", "Peşinat / Ön Ödeme", paraFmt(od.onOdeme), opOdendi ? "Ödendi" : "Bekliyor"]);
    }
    od.taksitler.forEach((t, i) => {
      const kayit = aylikOdemeler[t.ayKod] || {};
      let durum;
      if (kayit.odendi) durum = "Ödendi";
      else if (t.ayKod && t.ayKod < buAy) durum = "Gecikti";
      else durum = "Bekliyor";
      satirlar.push([String(i + 1), trPdf(t.tam || t.isim || t.ayKod || "-"), paraFmt(t.tutar), durum]);
    });

    pdf.autoTable({
      startY: y,
      head: [["#", "Dönem", "Tutar", "Durum"]],
      body: satirlar,
      theme: "grid",
      styles: { font: F, fontSize: fs, cellPadding: pad },
      headStyles: { fillColor: [45, 94, 62], textColor: 255, fontStyle: "bold", fontSize: fs },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: contentW - 10 - 36 - 26 },
        2: { cellWidth: 36, halign: "right", fontStyle: "bold" },
        3: { cellWidth: 26, halign: "center" }
      },
      margin: { left: margin, right: margin },
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 3) {
          const v = d.cell.raw;
          if (v === "Ödendi") d.cell.styles.textColor = [22, 101, 52];
          else if (v === "Gecikti") d.cell.styles.textColor = [185, 28, 28];
          else d.cell.styles.textColor = [120, 113, 108];
        }
      }
    });
    y = pdf.lastAutoTable.finalY + 5;

    // ── DİĞER ÜCRETLER ──
    // Henüz ilan edilmemiş kalemler de listelenir (tutar yerine "Henüz ilan
    // edilmedi" yazar). Böylece veli hangi kalemlerin geleceğini önceden bilir.
    const DIGER_SIRA = [
      ["egitimMateryali", "Eğitim Materyali"],
      ["okulKiyafeti",    "Okul Kıyafeti"],
      ["ormanKiyafeti",   "Orman Kıyafeti"],
      ["servis1",         "Servis (I. Dönem)"],
      ["servis2",         "Servis (II. Dönem)"]
    ];
    const du = od.digerUcretler || {};
    const digerSatir = DIGER_SIRA.map(([k, ad]) => {
      const v = Number(du[k]) || 0;
      return [trPdf(ad), v > 0 ? paraFmt(v) : "Henüz ilan edilmedi"];
    });
    const digerToplam = DIGER_SIRA.reduce((s, [k]) => s + (Number(du[k]) || 0), 0);
    const ilanEdilmeyen = DIGER_SIRA.filter(([k]) => !(Number(du[k]) > 0)).length;

    pdf.autoTable({
      startY: y,
      head: [[{ content: "DİĞER ÜCRETLER  (eğitim ücretine dahil değildir)", colSpan: 2,
               styles: { halign: "center", fillColor: [120, 113, 108], textColor: 255, fontStyle: "bold", fontSize: fs } }]],
      body: digerSatir,
      theme: "grid",
      styles: { font: F, fontSize: fs, cellPadding: pad },
      columnStyles: { 0: { cellWidth: contentW - 46 }, 1: { cellWidth: 46, halign: "right" } },
      margin: { left: margin, right: margin },
      didParseCell: (d) => {
        // İlan edilmemiş kalemler soluk gösterilir
        if (d.section === "body" && d.column.index === 1 && d.cell.raw === "Henüz ilan edilmedi") {
          d.cell.styles.textColor = [150, 150, 150];
          d.cell.styles.fontStyle = "normal";
        }
      }
    });
    y = pdf.lastAutoTable.finalY + 6;

    // ── AÇIKLAMALAR (toplamlar burada) ──
    pdf.setFont(F, "bold");
    pdf.setFontSize(fs + 0.5);
    pdf.setTextColor(45, 94, 62);
    pdf.text("Açıklamalar", margin, y);
    pdf.setTextColor(60);
    y += 5;

    pdf.setFont(F, "normal");
    pdf.setFontSize(fs - 0.5);

    const notlar = [];
    if (od.onOdeme > 0) {
      notlar.push(`Eğitim ücreti toplamı ${paraFmt(egitimToplam)}'dir: ${paraFmt(od.onOdeme)} peşinat ve ${od.taksitler.length} taksit halinde ${paraFmt(taksitToplam)}.`);
    } else {
      notlar.push(`Eğitim ücreti toplamı ${paraFmt(egitimToplam)}'dir; ${od.taksitler.length} eşit taksit halinde ödenir.`);
    }
    if (digerToplam > 0) {
      notlar.push(`İlan edilen diğer ücretler toplamı ${paraFmt(digerToplam)}'dir` +
        (ilanEdilmeyen ? `; ${ilanEdilmeyen} kalem henüz ilan edilmemiştir.` : ".") +
        ` Bu tutar eğitim ücretinden ayrıdır.`);
    } else {
      notlar.push("Diğer ücretler henüz ilan edilmemiştir; ilan edildiğinde ayrıca bildirilecektir.");
    }
    notlar.push("Ödemeler her ayın 1–5'i (serbest meslek) veya 15–20'si (memur) arasında yapılır.");
    notlar.push(`Tutarlar ${trPdf(veri.okul.donem)} eğitim ve öğretim yılı içindir. Bu belge bilgilendirme amaçlıdır; resmî hükümler imzalanan kayıt sözleşmesinde yer alır.`);

    notlar.forEach(n => {
      const satirDizi = pdf.splitTextToSize("• " + n, contentW);
      pdf.text(satirDizi, margin, y);
      y += satirDizi.length * (fs - 0.5) * 0.42 + 1.6;
    });
    pdf.setTextColor(0);

    // ── İMZA ──
    // Sayfa sonuna sabitlenir; üstteki içerik ne kadar olursa olsun aynı yerde.
    const imzaY = Math.max(y + 8, pageH - margin - 26);
    pdf.setFontSize(fs);
    pdf.text(`Düzenleme Tarihi: ${bugun.toLocaleDateString("tr-TR")}`, margin, imzaY);

    const sutunW = contentW / 2;
    const isimY = imzaY + 12;
    pdf.setFont(F, "bold");
    pdf.text("Okul Yetkilisi", margin + sutunW / 2, isimY, { align: "center" });
    pdf.text("Veli", margin + sutunW + sutunW / 2, isimY, { align: "center" });
    pdf.setFont(F, "normal");
    pdf.setFontSize(fs - 1);
    pdf.setTextColor(120);
    pdf.text("Ad Soyad / İmza", margin + sutunW / 2, isimY + 4.5, { align: "center" });
    pdf.text(trPdf(veliAd || "Ad Soyad / İmza"), margin + sutunW + sutunW / 2, isimY + 4.5, { align: "center" });
    pdf.setTextColor(0);
    pdf.setDrawColor(150);
    pdf.line(margin + 8, isimY + 10, margin + sutunW - 8, isimY + 10);
    pdf.line(margin + sutunW + 8, isimY + 10, pageW - margin - 8, isimY + 10);

    const dosyaAd = "Odeme-Plani_" +
      trPdf(veri.ogrenci.adSoyad || "ogrenci").replace(/\s+/g, "-") + ".pdf";
    pdf.save(dosyaAd);
    showToast("✓ Ödeme planı indirildi");

  } catch (e) {
    console.error("Ödeme planı PDF:", e);
    showToast("PDF oluşturulamadı: " + (e.message || e), "error");
  }
};

console.log("Ödeme Planı belgesi modülü yüklendi.");
