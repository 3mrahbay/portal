/* ============================================================
   PDF ÜST BAŞLIK ÇAKIŞMA DÜZELTMESİ (v3)
   Bir Çiçek Koleji Veli Portalı
   --------------------------------------------------------------
   Bu dosya: PDF sözleşme çıktısında "Özel Okul Adı: ..." ile
              "2025-2026 EĞİTİM VE ÖĞRETİM YILI" yazılarının
              üst üste binmesini engeller.

   Strateji v3: jsPDF constructor'ını yamalar. Her oluşturulan
   PDF instance'ının text fonksiyonunu sarmalar. Çakışan yazı
   geldiğinde Y koordinatını arttırıp X'i sola alır.

   Not: text fonksiyonu API veya prototype'ta değil, instance
   üzerinde tanımlı olduğu için constructor'ı yamamamız gerekti.
   ============================================================ */

(function() {

  // ============================================================
  // 1) JSPDF CONSTRUCTOR'INI YAMALA
  // ============================================================
  function constructorYamaUygula() {
    if (window._pdfConstructorYamasi) return false;

    if (!window.jspdf || !window.jspdf.jsPDF) {
      return false;
    }

    // Orijinal constructor'ı sakla
    const OrijinalJsPDF = window.jspdf.jsPDF;

    // Yeni constructor: orijinali çağırır, sonra text'i sarmalar
    function YamaliJsPDF(...args) {
      // Orijinal constructor'ı çağır
      const instance = new OrijinalJsPDF(...args);

      // text fonksiyonunu sarmala
      const orijinalText = instance.text.bind(instance);

      instance.text = function(text, x, y, options) {
        try {
          // Sadece string yazılarla ilgileniyoruz
          if (typeof text === 'string') {

            // "EGITIM VE OGRETIM" geçen yazıyı yakala
            // Bu yazı muhtemelen "| 2025-2026 EGITIM VE OGRETIM YILI"
            // şeklinde ve X=95 civarında çiziliyor → çakışma var
            if (text.indexOf('EGITIM VE OGRETIM') !== -1 ||
                text.indexOf('EĞİTİM VE ÖĞRETİM') !== -1) {

              // Eğer X > 50 ve < 150 ise (yani yan yana çizim yapılıyorsa)
              // alt satıra al
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
          console.warn('[PDF Üst Başlık] Yama hatası:', err.message);
        }

        // Sarmalanmış orijinal text'i çağır
        return orijinalText(text, x, y, options);
      };

      return instance;
    }

    // Orijinal jsPDF'in static özelliklerini koru (API, version vb.)
    Object.setPrototypeOf(YamaliJsPDF, OrijinalJsPDF);
    Object.setPrototypeOf(YamaliJsPDF.prototype, OrijinalJsPDF.prototype);

    // API, version gibi static özellikleri kopyala
    for (const key in OrijinalJsPDF) {
      if (Object.prototype.hasOwnProperty.call(OrijinalJsPDF, key)) {
        YamaliJsPDF[key] = OrijinalJsPDF[key];
      }
    }

    // window.jspdf.jsPDF'i değiştir
    window.jspdf.jsPDF = YamaliJsPDF;

    window._pdfConstructorYamasi = true;
    console.log('[PDF Üst Başlık] ✅ jsPDF constructor yamalandı.');
    return true;
  }

  // ============================================================
  // 2) BAŞLAT
  // ============================================================
  function baslat() {
    let denemeBekle = 0;
    const denemeAraligi = setInterval(() => {
      denemeBekle++;
      const basarili = constructorYamaUygula();
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
