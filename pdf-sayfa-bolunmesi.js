/* ============================================================
   PDF TABLO SAYFA BÖLÜNMESİ ENGELLEME MODÜLÜ
   Bir Çiçek Koleji Veli Portalı
   --------------------------------------------------------------
   Bu dosya: jsPDF-autotable çağrılarını "akıllı" hale getirir.
              Her tablo çiziminden önce kalan sayfa yüksekliğini
              kontrol eder, yetmiyorsa yeni sayfa açar.
              
   Hedef: PDF çıktısında sözleşme tablolarının sayfa sonunda
          ortadan bölünmesini engellemek.
   ============================================================ */

(function() {

  // Yamadan önce orijinal autoTable fonksiyonunu sakla
  let yamaUygulandi = false;

  // ============================================================
  // 1) AUTOTABLE'I AKILLI HALE GETİR
  // ============================================================
  function autoTableYamaUygula() {
    if (yamaUygulandi) return;

    // jsPDF prototype'unda autoTable var mı kontrol et
    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
      return false;
    }

    // jsPDF v2 modülü
    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFClass || !jsPDFClass.API || !jsPDFClass.API.autoTable) {
      return false;
    }

    // Orijinal autoTable fonksiyonunu sakla
    const orijinalAutoTable = jsPDFClass.API.autoTable;

    // Yeni autoTable: önce yer kontrolü yap, sonra orijinali çağır
    jsPDFClass.API.autoTable = function(opts) {
      try {
        // Sayfa boyutlarını al
        const sayfaYuksekligi = this.internal.pageSize.height || this.internal.pageSize.getHeight();
        const sayfaGenisligi = this.internal.pageSize.width || this.internal.pageSize.getWidth();

        // Mevcut Y pozisyonu (startY varsa)
        const baslangicY = (opts && opts.startY) || 20;

        // Tablo yüksekliğini tahmin et:
        // - Başlık (head) varsa: ~10mm
        // - Her body satırı için: ~7-8mm (cellPadding'e göre)
        let tahminiBodyYuksekligi = 0;
        if (opts && opts.body && Array.isArray(opts.body)) {
          const cellPadding = (opts.styles && opts.styles.cellPadding) || 2;
          const fontSize = (opts.styles && opts.styles.fontSize) || 9;
          // Her satır için: font yüksekliği + 2x cellPadding + ~1mm satır boşluğu
          const satirYuksekligi = (fontSize * 0.5) + (cellPadding * 2) + 1;
          tahminiBodyYuksekligi = opts.body.length * satirYuksekligi;
        }

        const tahminiHeadYuksekligi = (opts && opts.head && opts.head.length > 0) ? 10 : 0;
        const tahminiToplamYukseklik = tahminiHeadYuksekligi + tahminiBodyYuksekligi + 5;

        // Alt margin (genelde sayfanın altından 15-20mm boşluk bırakılır)
        const altSinir = sayfaYuksekligi - 20;

        // Tablo sayfaya sığmıyorsa VE makul büyüklükteyse (200mm'den küçük) yeni sayfa aç
        // Çok büyük tablolar (200mm+) zaten birden çok sayfaya yayılmak zorunda
        if (baslangicY + tahminiToplamYukseklik > altSinir &&
            tahminiToplamYukseklik < 200 &&
            baslangicY > 30) {
          // Yeni sayfa aç
          this.addPage();
          // Yeni başlangıç Y'sini ayarla (üst margin)
          if (opts) {
            opts.startY = 20;
          }
        }

        // Ayrıca tek bir satırın bölünmesini engelle
        // (autoTable v3.5+ özelliği — eski sürümlerde sessizce yok sayılır)
        if (opts) {
          if (typeof opts.rowPageBreak === 'undefined') {
            opts.rowPageBreak = 'avoid';
          }
        }
      } catch (err) {
        // Hata olursa sessiz geç — orijinal davranışı koru
        console.warn('[PDF Sayfa] Yer kontrolü hatası (görmezden geliniyor):', err.message);
      }

      // Orijinal autoTable'ı çağır
      return orijinalAutoTable.apply(this, arguments);
    };

    yamaUygulandi = true;
    console.log('[PDF Sayfa] ✅ autoTable akıllı hale getirildi (tablolar artık bölünmeyecek).');
    return true;
  }

  // ============================================================
  // 2) BAŞLAT
  // ============================================================
  function baslat() {
    // jsPDF yüklenene kadar bekle (CDN'den geliyor, biraz sürebilir)
    let denemeBekle = 0;
    const denemeAraligi = setInterval(() => {
      denemeBekle++;
      const basarili = autoTableYamaUygula();
      if (basarili) {
        clearInterval(denemeAraligi);
      } else if (denemeBekle > 40) {
        clearInterval(denemeAraligi);
        console.warn('[PDF Sayfa] jsPDF 20 saniye içinde bulunamadı. Modül başlatılamadı.');
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }

})();
