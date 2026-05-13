/* ============================================================
   PDF ÜST BAŞLIK DÜZELTME MODÜLÜ
   Bir Çiçek Koleji Veli Portalı
   --------------------------------------------------------------
   Bu dosya: PDF sözleşme çıktısındaki estetik sorunları düzeltir.

   Düzeltilen sorunlar:
   1. "Özel Okul Adı: ..." ile "2025-2026 EĞİTİM..." 
      yazılarının üst üste binmesi
   2. Sarı zemindeki "Ödeme Bilgileri" başlıklarının 
      görünmez olması (textColor düzeltmesi)

   Strateji: pdfHeaderLogolu ve pdfHeaderBasit fonksiyonlarını
   override eder, autoTable head stillerini yamalar.
   ============================================================ */

(function() {

  // ============================================================
  // 1) HEADER FONKSİYONLARINI OVERRIDE ET
  // ============================================================
  function headerYamaUygula() {
    if (window._pdfHeaderYamasiUygulandi) return;

    // pdfHeaderLogolu mevcut mu kontrol et
    if (typeof window.pdfHeaderLogolu !== 'function' &&
        typeof window.pdfHeaderBasit !== 'function') {
      // Henüz tanımlanmamış olabilir, biraz daha bekle
      return false;
    }

    // tr() fonksiyonunu kullanıma hazırla
    const trFn = window.tr || function(s) {
      if (!s) return "";
      return String(s)
        .replace(/Ğ/g, "G").replace(/ğ/g, "g")
        .replace(/Ü/g, "U").replace(/ü/g, "u")
        .replace(/Ş/g, "S").replace(/ş/g, "s")
        .replace(/İ/g, "I").replace(/ı/g, "i")
        .replace(/Ö/g, "O").replace(/ö/g, "o")
        .replace(/Ç/g, "C").replace(/ç/g, "c");
    };

    // pdfHeaderLogolu'yu yeniden tanımla (DÜZELTİLMİŞ VERSİYON)
    window.pdfHeaderLogolu = function(pdf, veri, margin, pageW) {
      const logoH = 22;
      const okulLogoW = 16;
      const mebLogoW = 22;

      // Logoları çiz (eski koddaki gibi)
      try {
        if (window.LOGO_OKUL_BASE64) {
          pdf.addImage(window.LOGO_OKUL_BASE64, "PNG", margin, margin - 3, okulLogoW, logoH);
        }
      } catch(e) { console.warn("[PDF Header] Okul logo hata:", e); }

      try {
        if (window.LOGO_MEB_BASE64) {
          pdf.addImage(window.LOGO_MEB_BASE64, "PNG", pageW - margin - mebLogoW, margin - 1, mebLogoW, logoH - 4);
        }
      } catch(e) { console.warn("[PDF Header] MEB logo hata:", e); }

      // Üst başlıklar (T.C., MILLI EGITIM... vb.)
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("T.C.", pageW / 2, margin, { align: "center" });
      pdf.setFontSize(10);
      pdf.text("MILLI EGITIM BAKANLIGI", pageW / 2, margin + 4, { align: "center" });
      pdf.text("OZEL OGRETIM KURUMLARI GENEL MUDURLUGU", pageW / 2, margin + 8, { align: "center" });
      pdf.text("OGRENCI KAYIT SOZLESMESI", pageW / 2, margin + 12, { align: "center" });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("(OZEL OKULLAR)", pageW / 2, margin + 16, { align: "center" });

      // 🌱 DÜZELTME: İki yazıyı AYRI SATIRLARDA göster
      const y = margin + 25;

      // 1. satır: Özel Okul Adı
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(`Ozel Okul Adi: ${trFn(veri.okul.adi)}`, margin, y);

      // 2. satır: Eğitim Yılı (alt satıra al, çakışma yok)
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(`${veri.okul.donem} EGITIM VE OGRETIM YILI`, margin, y + 5);

      // Toplam yükseklik: y + 5 (alt satır) + 6 (boşluk) = y + 11
      return y + 11;
    };

    // pdfHeaderBasit'i yeniden tanımla (DEVAM SAYFALARI İÇİN)
    // Bu zaten tek satır, sorun yok ama tutarlılık için override ediyoruz
    window.pdfHeaderBasit = function(pdf, veri, margin, pageW) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(`${trFn(veri.okul.adi)} | ${veri.okul.donem} EGITIM VE OGRETIM YILI`, pageW / 2, margin, { align: "center" });
      return margin + 8;
    };

    window._pdfHeaderYamasiUygulandi = true;
    console.log('[PDF Header] ✅ Üst başlık çakışması düzeltildi (iki yazı ayrı satıra alındı).');
    return true;
  }

  // ============================================================
  // 2) AUTOTABLE HEAD RENK SORUNUNU DÜZELT
  // ============================================================
  // Sarı zemin (fillColor) üzerine açık/beyaz yazı yazıldığı için
  // başlıklar görünmüyor. autoTable çağrılarını yamalayıp
  // head'in textColor'unu siyah yapacağız.
  function autoTableRenkYamaUygula() {
    if (window._pdfAutoTableRenkYamasi) return;

    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFClass || !jsPDFClass.API || !jsPDFClass.API.autoTable) {
      return false;
    }

    // Önceki yamayı sakla (pdf-sayfa-bolunmesi.js zaten yamamış olabilir)
    const oncekiAutoTable = jsPDFClass.API.autoTable;

    jsPDFClass.API.autoTable = function(opts) {
      try {
        // Eğer head varsa ve fillColor açık tonsa, textColor'u siyah yap
        if (opts && opts.head && opts.head.length > 0) {

          // headStyles yoksa oluştur
          if (!opts.headStyles) opts.headStyles = {};

          // Eğer headStyles'da fillColor açık ton ise (örn. 230+),
          // textColor'u zorla siyah yap
          if (opts.headStyles.fillColor) {
            const fc = opts.headStyles.fillColor;
            const isLight = Array.isArray(fc) && fc.length === 3 &&
                            fc[0] > 200 && fc[1] > 200 && fc[2] > 150;
            if (isLight) {
              opts.headStyles.textColor = [0, 0, 0]; // siyah
            }
          }

          // Body'deki sarı/açık hücreler için de aynı kontrol
          // (örn. "Kurumun İlan Ettiği Ücretler" gibi tablo içi başlıklar)
          // didParseCell hook'u kullanarak her hücreyi kontrol et
          const oncekiHook = opts.didParseCell;
          opts.didParseCell = function(data) {
            // Eski hook varsa önce onu çağır
            if (typeof oncekiHook === 'function') {
              oncekiHook(data);
            }

            // Hücrenin fillColor'una bak
            if (data.cell && data.cell.styles) {
              const fc = data.cell.styles.fillColor;
              if (Array.isArray(fc) && fc.length === 3) {
                // Açık ton (sarı, krem, açık gri vb.) ise
                if (fc[0] > 200 && fc[1] > 200 && fc[2] > 150) {
                  data.cell.styles.textColor = [0, 0, 0]; // siyah
                }
              }
            }
          };
        }
      } catch (err) {
        console.warn('[PDF Renk] Yama hatası (görmezden geliniyor):', err.message);
      }

      // Önceki autoTable'ı çağır (pdf-sayfa-bolunmesi.js yamasını koruyoruz)
      return oncekiAutoTable.apply(this, arguments);
    };

    window._pdfAutoTableRenkYamasi = true;
    console.log('[PDF Renk] ✅ Sarı zemin yazı renkleri düzeltildi (siyaha çevrildi).');
    return true;
  }

  // ============================================================
  // 3) BAŞLAT
  // ============================================================
  function baslat() {
    // Hem header hem renk yamasını dene
    let denemeBekle = 0;
    const denemeAraligi = setInterval(() => {
      denemeBekle++;

      const headerOK = headerYamaUygula();
      const renkOK = autoTableRenkYamaUygula();

      if (headerOK && renkOK) {
        clearInterval(denemeAraligi);
        console.log('[PDF Estetik] ✅ Tüm yamalar uygulandı.');
      } else if (denemeBekle > 40) {
        clearInterval(denemeAraligi);
        if (!headerOK) console.warn('[PDF Header] pdfHeaderLogolu 20 saniye içinde bulunamadı.');
        if (!renkOK) console.warn('[PDF Renk] jsPDF 20 saniye içinde bulunamadı.');
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }

})();
