/* ============================================================
   PDF ÜST BAŞLIK ÇAKIŞMA DÜZELTMESİ (v2)
   Bir Çiçek Koleji Veli Portalı
   --------------------------------------------------------------
   Bu dosya: PDF sözleşme çıktısında "Özel Okul Adı: ..." ile
              "2025-2026 EĞİTİM VE ÖĞRETİM YILI" yazılarının
              üst üste binmesini engeller.

   Strateji: pdf.text() fonksiyonunu yamalar. "EGITIM VE OGRETIM"
   yazısı geldiğinde Y koordinatını arttırıp, X'i sola alır.
   Bu sayede iki yazı ayrı satırlarda görünür.

   Not: pdfHeaderLogolu fonksiyonu module içinde olduğu için
   doğrudan override edilemiyor. Bu yüzden pdf.text'i yakalıyoruz.
   ============================================================ */

(function() {

  // ============================================================
  // 1) PDF.TEXT'İ YAMALA
  // ============================================================
  function pdfTextYamaUygula() {
    if (window._pdfTextYamasiUygulandi) return false;

    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFClass || !jsPDFClass.API || !jsPDFClass.API.text) {
      return false;
    }

    // Orijinal text fonksiyonunu sakla
    const orijinalText = jsPDFClass.API.text;

    jsPDFClass.API.text = function(text, x, y, options) {
      try {
        // Sadece string yazılarla ilgileniyoruz
        if (typeof text === 'string') {
          // "EGITIM VE OGRETIM" geçen yazıyı yakala
          if (text.indexOf('EGITIM VE OGRETIM') !== -1 ||
              text.indexOf('EĞİTİM VE ÖĞRETİM') !== -1) {

            // Bu yazı muhtemelen "| 2025-2026 EGITIM VE OGRETIM YILI" şeklinde
            // ve X=95 civarında çiziliyor → çakışma var
            // Eğer X > 50 ise (yani yan yana çizim yapılıyorsa), alt satıra al

            if (x > 50 && x < 150) {
              // Y koordinatını 5mm aşağı al
              y = y + 5;
              // X koordinatını sol margine al
              x = 15;
              // Başındaki "| " işaretini sil (artık yan yana değil)
              text = text.replace(/^\s*\|\s*/, '');

              console.log('[PDF Üst Başlık] ✅ "EGITIM" yazısı alt satıra alındı.');
            }
          }
        }
      } catch (err) {
        // Hata olursa sessiz geç
        console.warn('[PDF Üst Başlık] Yama hatası:', err.message);
      }

      // Orijinal text fonksiyonunu çağır
      return orijinalText.call(this, text, x, y, options);
    };

    window._pdfTextYamasiUygulandi = true;
    console.log('[PDF Üst Başlık] ✅ pdf.text yamalandı (çakışma önlendi).');
    return true;
  }

  // ============================================================
  // 2) BAŞLAT
  // ============================================================
  function baslat() {
    let denemeBekle = 0;
    const denemeAraligi = setInterval(() => {
      denemeBekle++;
      const basarili = pdfTextYamaUygula();
      if (basarili) {
        clearInterval(denemeAraligi);
      } else if (denemeBekle > 40) {
        clearInterval(denemeAraligi);
        console.warn('[PDF Üst Başlık] jsPDF 20 saniye içinde bulunamadı.');
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }

})();
