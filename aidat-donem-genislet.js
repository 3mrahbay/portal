/* ============================================================
   AIDAT DÖNEM UZUNLUĞU GENİŞLETME MODÜLÜ
   Bir Çiçek Koleji Veli Portalı
   --------------------------------------------------------------
   Bu dosya: Aidat sekmesindeki "Dönem Uzunluğu" dropdown'una
              1-9 ay seçeneklerini ekler. Mevcut 10-11-12 ay
              seçeneklerine dokunmaz. Esnek aidat hesabı sağlar:
              - Dönem ortası kayıt (örn. 4 ay)
              - Yarıyıl deneme (örn. 1 ay)
              - Kısa süreli kayıt
   ============================================================ */

(function() {

  // ============================================================
  // 1) DROPDOWN'U BUL VE GENİŞLET
  // ============================================================
  function dropdownGenisle() {
    // Modal açıldığında "Dönem Uzunluğu" select'ini bul
    const tumSelectler = document.querySelectorAll('select');
    let donemSelect = null;

    for (const sel of tumSelectler) {
      // İçindeki option metinlerine bakarak doğru dropdown'u bul
      const optionMetinleri = Array.from(sel.options).map(o => o.textContent || '').join('|');
      if (optionMetinleri.includes('10 ay') &&
          optionMetinleri.includes('Eylül') &&
          optionMetinleri.includes('Haziran')) {
        donemSelect = sel;
        break;
      }
    }

    if (!donemSelect) return false;

    // Zaten genişletilmiş mi kontrol et
    if (donemSelect.dataset.genisletildi === 'evet') return true;

    // Mevcut seçili değeri hatırla
    const mevcutDeger = donemSelect.value;

    // 1-9 ay seçeneklerini en başa ekle
    // (10, 11, 12 ay seçenekleri olduğu gibi kalacak)
    const yeniSecenekler = [
      { value: '1', text: '1 ay (kısa süreli kayıt)' },
      { value: '2', text: '2 ay' },
      { value: '3', text: '3 ay' },
      { value: '4', text: '4 ay' },
      { value: '5', text: '5 ay (yarıyıl)' },
      { value: '6', text: '6 ay' },
      { value: '7', text: '7 ay' },
      { value: '8', text: '8 ay' },
      { value: '9', text: '9 ay' }
    ];

    // İlk option'ı referans al (genelde 10 ay olan)
    const ilkOption = donemSelect.options[0];

    yeniSecenekler.forEach(s => {
      // Aynı value'da option var mı kontrol et
      const zatenVar = Array.from(donemSelect.options).some(o => o.value === s.value);
      if (zatenVar) return;

      const opt = document.createElement('option');
      opt.value = s.value;
      opt.textContent = s.text;
      donemSelect.insertBefore(opt, ilkOption);
    });

    // İşaretle (tekrar çalışmasın)
    donemSelect.dataset.genisletildi = 'evet';

    // Seçili değeri eski haline getir
    if (mevcutDeger) {
      donemSelect.value = mevcutDeger;
    }

    console.log('[Aidat Dönem] ✅ Dropdown genişletildi (1-12 ay arası).');
    return true;
  }

  // ============================================================
  // 2) MODAL AÇILDIĞINDA ÇALIŞTIR
  // ============================================================
  // MutationObserver: DOM değişikliklerini izle, modal açıldığında genişlet
  function izlemeBaslat() {
    const observer = new MutationObserver((mutations) => {
      // Modal açık mı kontrol et
      const ayarModal = document.getElementById('ayarModal');
      if (ayarModal && ayarModal.classList.contains('active')) {
        // Modal açık, dropdown'u genişletmeye çalış
        dropdownGenisle();
      }
    });

    // Sayfanın tamamını izle (class değişiklikleri için)
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'style']
    });

    console.log('[Aidat Dönem] 👁️ Modal izlemesi başladı.');
  }

  // ============================================================
  // 3) BAŞLAT
  // ============================================================
  function baslat() {
    // İlk denemede dene (belki modal zaten açıktır)
    dropdownGenisle();

    // İzlemeyi başlat (modal her açıldığında çalışsın)
    izlemeBaslat();

    console.log('[Aidat Dönem] ✅ Modül yüklendi.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', baslat);
  } else {
    baslat();
  }

})();
