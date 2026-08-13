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
  erken_kayit:     "Erken Kayit",
  on_odeme_taksit: "On Odeme + Taksitlendirme",
  sabit:           "Normal Kayit (esit odeme)"
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
    if (!paket) { showToast("Veri alinamadi", "error"); return; }
    const { veri, a, aylikOdemeler, planKodu } = paket;
    const od = veri.odeme;

    if (!od.taksitler || !od.taksitler.length) {
      showToast("Once aidat ayarlarini kaydedin (odeme plani bos)", "error");
      return;
    }

    showToast("Odeme plani hazirlaniyor...");

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
    pdf.text("ODEME PLANI", pageW / 2, y + 10, { align: "center" });
    pdf.setFont(F, "normal");
    pdf.setFontSize(9);
    pdf.text(`${veri.okul.donem} Egitim ve Ogretim Yili`, pageW / 2, y + 15, { align: "center" });

    y += 24;
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageW - margin, y);
    y += 6;

    // ── ÖĞRENCİ / VELİ ──
    const veliAd = veri.anne.adSoyad || veri.baba.adSoyad || veri.vasi?.adSoyad || "";
    pdf.autoTable({
      startY: y,
      body: [
        ["Ogrenci", trPdf(veri.ogrenci.adSoyad || "-")],
        ["Sinif / Program", trPdf((veri.ogrenci.sinif || "-") + "  /  " + (veri.ogrenci.program || "-"))],
        ["Veli", trPdf(veliAd || "-")],
        ["Odeme Plani", trPdf(PLAN_ADLARI[planKodu] || "-")]
      ],
      theme: "grid",
      styles: { font: F, fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 42, fontStyle: "bold", fillColor: [245, 245, 245] }, 1: { cellWidth: contentW - 42 } },
      margin: { left: margin, right: margin }
    });
    y = pdf.lastAutoTable.finalY + 6;

    // ── ÖZET ──
    const taksitToplam = od.taksitler.reduce((s, t) => s + (Number(t.tutar) || 0), 0);
    const egitimToplam = (Number(od.onOdeme) || 0) + taksitToplam;

    const ozetSatirlar = [];
    if (od.onOdeme > 0) ozetSatirlar.push(["Pesinat / On Odeme", paraFmt(od.onOdeme)]);
    ozetSatirlar.push([`Taksitler (${od.taksitler.length} ay)`, paraFmt(taksitToplam)]);
    ozetSatirlar.push(["EGITIM UCRETI TOPLAMI", paraFmt(egitimToplam)]);

    pdf.autoTable({
      startY: y,
      head: [[{ content: "OZET", colSpan: 2, styles: { halign: "center", fillColor: [45, 94, 62], textColor: 255, fontStyle: "bold", fontSize: 10 } }]],
      body: ozetSatirlar,
      theme: "grid",
      styles: { font: F, fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: contentW - 45 }, 1: { cellWidth: 45, halign: "right", fontStyle: "bold" } },
      margin: { left: margin, right: margin },
      didParseCell: (d) => {
        // Toplam satırını vurgula
        if (d.section === "body" && d.row.index === ozetSatirlar.length - 1) {
          d.cell.styles.fillColor = [235, 242, 236];
          d.cell.styles.fontStyle = "bold";
        }
      }
    });
    y = pdf.lastAutoTable.finalY + 6;

    // ── AYLIK TAKSİT TABLOSU ──
    const bugun = new Date();
    const buAy = bugun.getFullYear() + "-" + String(bugun.getMonth() + 1).padStart(2, "0");

    const satirlar = [];
    if (od.onOdeme > 0) {
      const opOdendi = !!(aylikOdemeler.__onOdeme && aylikOdemeler.__onOdeme.odendi);
      satirlar.push(["-", "Pesinat / On Odeme", paraFmt(od.onOdeme), opOdendi ? "Odendi" : "Bekliyor"]);
    }
    od.taksitler.forEach((t, i) => {
      const kayit = aylikOdemeler[t.ayKod] || {};
      let durum;
      if (kayit.odendi) durum = "Odendi";
      else if (t.ayKod && t.ayKod < buAy) durum = "Gecikti";
      else durum = "Bekliyor";
      satirlar.push([String(i + 1), trPdf(t.tam || t.isim || t.ayKod || "-"), paraFmt(t.tutar), durum]);
    });

    pdf.autoTable({
      startY: y,
      head: [["#", "Donem", "Tutar", "Durum"]],
      body: satirlar,
      theme: "grid",
      styles: { font: F, fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [45, 94, 62], textColor: 255, fontStyle: "bold", fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: contentW - 12 - 38 - 28 },
        2: { cellWidth: 38, halign: "right", fontStyle: "bold" },
        3: { cellWidth: 28, halign: "center" }
      },
      margin: { left: margin, right: margin },
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 3) {
          const v = d.cell.raw;
          if (v === "Odendi") d.cell.styles.textColor = [22, 101, 52];
          else if (v === "Gecikti") d.cell.styles.textColor = [185, 28, 28];
          else d.cell.styles.textColor = [120, 113, 108];
        }
      }
    });
    y = pdf.lastAutoTable.finalY + 6;

    // ── DİĞER ÜCRETLER (varsa) ──
    const digerAdlar = {
      egitimMateryali: "Egitim Materyali",
      okulKiyafeti: "Okul Kiyafeti",
      ormanKiyafeti: "Orman Kiyafeti",
      servis1: "Servis (1. Donem)",
      servis2: "Servis (2. Donem)"
    };
    const digerSatir = Object.entries(od.digerUcretler || {})
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => [trPdf(digerAdlar[k] || k), paraFmt(v)]);

    if (digerSatir.length) {
      if (y > pageH - 70) { pdf.addPage(); y = margin; }
      digerSatir.push(["TOPLAM", paraFmt(od.digerToplam)]);
      pdf.autoTable({
        startY: y,
        head: [[{ content: "DIGER UCRETLER (egitim ucretine dahil degildir)", colSpan: 2, styles: { halign: "center", fillColor: [120, 113, 108], textColor: 255, fontStyle: "bold", fontSize: 9 } }]],
        body: digerSatir,
        theme: "grid",
        styles: { font: F, fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: contentW - 45 }, 1: { cellWidth: 45, halign: "right" } },
        margin: { left: margin, right: margin },
        didParseCell: (d) => {
          if (d.section === "body" && d.row.index === digerSatir.length - 1) {
            d.cell.styles.fontStyle = "bold";
            d.cell.styles.fillColor = [245, 245, 244];
          }
        }
      });
      y = pdf.lastAutoTable.finalY + 6;
    }

    // ── NOTLAR + İMZA ──
    if (y > pageH - 55) { pdf.addPage(); y = margin; }

    pdf.setFont(F, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    const notlar = [
      "Odemeler her ayin 1-5'i (serbest meslek) veya 15-20'si (memur) arasinda yapilir.",
      "Bu belge bilgilendirme amaclidir; resmi hukumler imzalanan kayit sozlesmesinde yer alir.",
      "Tutarlar " + trPdf(veri.okul.donem) + " egitim ve ogretim yili icindir."
    ];
    notlar.forEach(n => {
      pdf.text("- " + n, margin, y, { maxWidth: contentW });
      y += 4.5;
    });
    pdf.setTextColor(0);

    y += 8;
    const bugunStr = bugun.toLocaleDateString("tr-TR");
    pdf.setFontSize(9);
    pdf.text(`Duzenleme Tarihi: ${bugunStr}`, margin, y);
    y += 14;

    const sutunW = contentW / 2;
    pdf.setFont(F, "bold");
    pdf.text("Okul Yetkilisi", margin + sutunW / 2, y, { align: "center" });
    pdf.text("Veli", margin + sutunW + sutunW / 2, y, { align: "center" });
    pdf.setFont(F, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text("Ad Soyad / Imza", margin + sutunW / 2, y + 5, { align: "center" });
    pdf.text(trPdf(veliAd || "Ad Soyad / Imza"), margin + sutunW + sutunW / 2, y + 5, { align: "center" });
    pdf.setTextColor(0);
    y += 16;
    pdf.setDrawColor(150);
    pdf.line(margin + 8, y, margin + sutunW - 8, y);
    pdf.line(margin + sutunW + 8, y, pageW - margin - 8, y);

    const dosyaAd = "Odeme-Plani_" +
      trPdf(veri.ogrenci.adSoyad || "ogrenci").replace(/\s+/g, "-") + ".pdf";
    pdf.save(dosyaAd);
    showToast("✓ Odeme plani indirildi");

  } catch (e) {
    console.error("Ödeme planı PDF:", e);
    showToast("PDF olusturulamadi: " + (e.message || e), "error");
  }
};

console.log("Ödeme Planı belgesi modülü yüklendi.");
