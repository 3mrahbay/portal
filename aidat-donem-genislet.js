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

  // Randevu V3 geçiş köprüsü. Ana portal dosyası çok büyük olduğu için
  // güvenli callable ekranlarına yönlendirme burada atomik olarak uygulanır.
  const randevuRouteAc = (route) => {
    const hedef = new URL(route, window.location.href);
    hedef.search = window.location.search;
    window.location.assign(hedef.href);
  };
  window.zekyVeliRandevuAc = () => randevuRouteAc('./veli-randevu.html');
  window.zekyPersonelRandevuAc = () => randevuRouteAc('./randevu-talepleri.html');
  window.zekyRandevuAyarlariAc = () => randevuRouteAc('./randevu-ayarlar.html');

  function randevuV3KoprusunuKur() {
    if (typeof window.caGo === 'function' && !window.caGo.__zekyRandevuV3) {
      const oncekiCaGo = window.caGo;
      const yeniCaGo = function(ekran) {
        // 'randevular' ekrani portalin kendi listesinde kalir;
        // talep olusturma popup uzerinden callable'a gider.
        return oncekiCaGo.apply(this, arguments);
      };
      yeniCaGo.__zekyRandevuV3 = true;
      window.caGo = yeniCaGo;
    }

    // caRandevuTalepAc / caRandevuTalepGonder artik
    // js/zeky-randevu-modal-koprusu.js tarafindan callable backend'e
    // baglaniyor; veli ayri sayfaya gonderilmiyor, eski popup aciliyor.
    window.caRandevuIptal = window.zekyVeliRandevuAc;
    window.randevuSlotModalAc = window.zekyRandevuAyarlariAc;
    window.randevuTopluModalAc = window.zekyRandevuAyarlariAc;
    window.randevuSlotKaydet = window.zekyRandevuAyarlariAc;
    window.randevuTopluKaydet = window.zekyRandevuAyarlariAc;
    window.randevuSlotSil = window.zekyRandevuAyarlariAc;

    for (const id of ['randevuSlotModal', 'randevuTopluModal', 'randevuListesi']) {
      const element = document.getElementById(id);
      if (element) {
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
        element.style.setProperty('display', 'none', 'important');
      }
    }
    const eskiBar = document.querySelector('.randevu-yonetim-bar');
    if (eskiBar && !document.getElementById('zekyRandevuV3Bar')) {
      eskiBar.hidden = true;
      eskiBar.setAttribute('aria-hidden', 'true');
      eskiBar.style.setProperty('display', 'none', 'important');
      const bar = document.createElement('div');
      bar.id = 'zekyRandevuV3Bar';
      bar.className = 'randevu-yonetim-bar';
      bar.innerHTML = '<div><h3>Güvenli Randevu Yönetimi</h3>' +
        '<div style="font-size:12px;color:#0e7490;margin-top:4px">' +
        'Talepler ve uygunluklar App Check korumalı ekranda yönetilir.</div></div>' +
        '<div class="randevu-yeni-btn-grup">' +
        '<button type="button" class="randevu-yeni-btn" id="zekyRandevuTalepleriAc">Talepleri aç</button>' +
        '<button type="button" class="randevu-yeni-btn toplu" id="zekyRandevuAyarlariAc">Uygunlukları yönet</button></div>';
      eskiBar.before(bar);
      bar.querySelector('#zekyRandevuTalepleriAc')
        .addEventListener('click', window.zekyPersonelRandevuAc);
      bar.querySelector('#zekyRandevuAyarlariAc')
        .addEventListener('click', window.zekyRandevuAyarlariAc);
    }
  }

  document.addEventListener('click', (event) => {
    const tetikleyici = event.target.closest('[onclick]');
    const komut = tetikleyici?.getAttribute('onclick') || '';
    // Veli desenleri bilincli olarak cikarildi. Veli randevu tiklamalari
    // artik window.caRandevuTalepAc'a ulasiyor; onu
    // js/zeky-randevu-modal-koprusu.js devraliyor ve eski popup'i
    // callable backend'e bagli olarak aciyor.
    // Personel/yonetim ekranlari ayri sayfada kalmaya devam eder.
    if (/randevu(?:Slot|Toplu)ModalAc/.test(komut)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.zekyRandevuAyarlariAc();
    }
  }, true);

  const randevuKopruIzleyici = setInterval(randevuV3KoprusunuKur, 100);
  setTimeout(() => clearInterval(randevuKopruIzleyici), 30000);

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
    randevuV3KoprusunuKur();
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
