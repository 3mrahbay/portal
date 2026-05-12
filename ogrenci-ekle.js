/* ============================================================
   YENİ ÖĞRENCİ EKLE MODÜLÜ
   Bir Çiçek Koleji Veli Portalı
   --------------------------------------------------------------
   Bu dosya: Öğrenci Ayarları sekmesine "+ Öğrenci Ekle" butonu
              ekler ve manuel öğrenci ekleme modal'ını yönetir.
   Bağımsız ES module — kendi Firebase bağlantısını kurar.
   ============================================================ */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config — portal ile aynı (bcka-site projesi)
const firebaseConfig = {
  apiKey: "AIzaSyARlqAoh-HRBC9xPwj7qRgG-IuZFSH39Uc",
  authDomain: "bcka-site.firebaseapp.com",
  projectId: "bcka-site",
  storageBucket: "bcka-site.firebasestorage.app",
  messagingSenderId: "736581475783",
  appId: "1:736581475783:web:5729a05ed4d05f1d1d0de2"
};

// Portal zaten Firebase'i başlattıysa onu kullan, yoksa yeni başlat
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ============================================================
// 1) BUTON VE MODAL HTML'İNİ SAYFAYA EKLE
// ============================================================
function olusturBuyutonVeModal() {
  // Buton: Durum sekmelerinin altına eklenir
  const durumSekmeleri = document.querySelector('#tab-ogrenciler .durum-sekmeleri');
  if (!durumSekmeleri) {
    return false;
  }

  // Daha önce eklenmişse tekrar ekleme
  if (document.getElementById('btnYeniOgrenciAc')) return true;

  const butonDiv = document.createElement('div');
  butonDiv.style.cssText = 'display:flex; justify-content:flex-end; margin: 12px 0;';
  butonDiv.innerHTML = `
    <button id="btnYeniOgrenciAc"
      style="background:linear-gradient(135deg, #2d6a4f, #40916c); color:white; border:none;
             padding:11px 22px; border-radius:10px; font-family:'Manrope',sans-serif;
             font-weight:600; cursor:pointer; font-size:14px;
             box-shadow:0 4px 12px rgba(45,106,79,0.25);
             display:flex; align-items:center; gap:8px; transition:all 0.2s;">
      <span style="font-size:18px; line-height:1;">+</span>
      <span>Öğrenci Ekle</span>
    </button>
  `;
  durumSekmeleri.parentNode.insertBefore(butonDiv, durumSekmeleri.nextSibling);

  // Hover efektleri
  const btn = document.getElementById('btnYeniOgrenciAc');
  btn.addEventListener('mouseover', () => {
    btn.style.transform = 'translateY(-1px)';
    btn.style.boxShadow = '0 6px 16px rgba(45,106,79,0.35)';
  });
  btn.addEventListener('mouseout', () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 4px 12px rgba(45,106,79,0.25)';
  });

  // Modal
  const modal = document.createElement('div');
  modal.id = 'yeniOgrenciModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-large" style="max-width:680px;">
      <div class="modal-header">
        <div class="modal-header-row">
          <div>
            <h2 style="color:#1a4d2e;">➕ Yeni Öğrenci Ekle</h2>
            <p>Manuel öğrenci kaydı oluşturun</p>
          </div>
          <button class="btn-close" id="yo_kapatBtn">×</button>
        </div>
      </div>

      <div>

        <!-- ÖĞRENCİ BİLGİLERİ -->
        <div class="section-divider">
          <div>
            <h3 class="section-title">👦 Öğrenci Bilgileri</h3>
            <div class="section-subtitle">Temel bilgiler</div>
          </div>
        </div>

        <div class="form-grid full">
          <div class="form-group">
            <label>Ad Soyad <span style="color:#dc2626;">*</span></label>
            <input type="text" id="yo_adSoyad" placeholder="Örn: Ahmet Selim Bay">
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Doğum Tarihi <span style="color:#dc2626;">*</span></label>
            <input type="date" id="yo_dogumTarihi">
          </div>
          <div class="form-group">
            <label>Cinsiyet <span style="color:#dc2626;">*</span></label>
            <select id="yo_cinsiyet">
              <option value="">Seçiniz</option>
              <option value="erkek">Erkek</option>
              <option value="kiz">Kız</option>
            </select>
          </div>
        </div>

        <div class="form-grid full">
          <div class="form-group">
            <label>TC Kimlik No</label>
            <input type="text" id="yo_tcKimlik" maxlength="11" placeholder="11 haneli (opsiyonel)" inputmode="numeric">
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Sınıf <span style="color:#dc2626;">*</span></label>
            <select id="yo_sinif">
              <option value="">Seçiniz</option>
              <option value="Toodler Sınıfı (2-3 Yaş)">Toodler Sınıfı (2-3 Yaş)</option>
              <option value="Kardelen Çiçekleri Sınıfı">Kardelen Çiçekleri Sınıfı</option>
              <option value="Nar Çiçekleri Sınıfı">Nar Çiçekleri Sınıfı</option>
            </select>
          </div>
          <div class="form-group">
            <label>Program Türü <span style="color:#dc2626;">*</span></label>
            <select id="yo_programTuru">
              <option value="">Seçiniz</option>
              <option value="Tam Gün">Tam Gün</option>
              <option value="Yarım Gün">Yarım Gün</option>
            </select>
          </div>
        </div>

        <div class="form-grid full">
          <div class="form-group">
            <label>Aylık Aidat (₺) <span style="color:#dc2626;">*</span></label>
            <input type="number" id="yo_aylikAidat" min="0" placeholder="Örn: 37000">
          </div>
        </div>

        <!-- 1. VELİ -->
        <div class="section-divider">
          <div>
            <h3 class="section-title">👤 1. Veli Bilgileri</h3>
            <div class="section-subtitle">Zorunlu</div>
          </div>
        </div>

        <div class="form-grid full">
          <div class="form-group">
            <label>Ad Soyad <span style="color:#dc2626;">*</span></label>
            <input type="text" id="yo_veli1AdSoyad" placeholder="Velinin adı ve soyadı">
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>E-posta <span style="color:#dc2626;">*</span></label>
            <input type="email" id="yo_veli1Eposta" placeholder="veli@example.com">
          </div>
          <div class="form-group">
            <label>Telefon <span style="color:#dc2626;">*</span></label>
            <input type="tel" id="yo_veli1Telefon" placeholder="05XX XXX XX XX">
          </div>
        </div>

        <!-- 2. VELİ (OPSİYONEL) -->
        <div class="section-divider">
          <div>
            <h3 class="section-title">👥 2. Veli Bilgileri</h3>
            <div class="section-subtitle">Opsiyonel</div>
          </div>
        </div>

        <div class="checkbox-card" id="yo_veli2Toggle">
          <div class="checkbox-row">
            <input type="checkbox" id="yo_veli2Ekle">
            <div style="flex:1;">
              <label style="cursor:pointer;">2. veli bilgilerini ekle</label>
              <small>İkinci veli (anne/baba) bilgilerini ekleyin (opsiyonel)</small>
            </div>
          </div>
        </div>

        <div id="yo_veli2Alani" style="display:none;">
          <div class="form-grid full">
            <div class="form-group">
              <label>Ad Soyad</label>
              <input type="text" id="yo_veli2AdSoyad" placeholder="Velinin adı ve soyadı">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>E-posta</label>
              <input type="email" id="yo_veli2Eposta" placeholder="veli@example.com">
            </div>
            <div class="form-group">
              <label>Telefon</label>
              <input type="tel" id="yo_veli2Telefon" placeholder="05XX XXX XX XX">
            </div>
          </div>
        </div>

        <!-- BUTONLAR -->
        <div class="modal-footer">
          <button type="button" class="btn-cancel" id="yo_vazgecBtn">Vazgeç</button>
          <button type="button" id="yo_kaydetBtn" class="btn-save">
            💾 Kaydet
          </button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return true;
}

// ============================================================
// 2) FONKSİYONLAR
// ============================================================

// 2. veli toggle
function veli2Toggle() {
  const checkbox = document.getElementById('yo_veli2Ekle');
  const alan = document.getElementById('yo_veli2Alani');
  const kart = document.getElementById('yo_veli2Toggle');
  alan.style.display = checkbox.checked ? 'block' : 'none';
  if (checkbox.checked) {
    kart.classList.add('active');
  } else {
    kart.classList.remove('active');
  }
}

// Modal aç
function ac() {
  // Form temizle
  ['yo_adSoyad','yo_dogumTarihi','yo_cinsiyet','yo_tcKimlik','yo_sinif',
   'yo_programTuru','yo_aylikAidat','yo_veli1AdSoyad','yo_veli1Eposta',
   'yo_veli1Telefon','yo_veli2AdSoyad','yo_veli2Eposta','yo_veli2Telefon']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('yo_veli2Ekle').checked = false;
  document.getElementById('yo_veli2Alani').style.display = 'none';
  document.getElementById('yo_veli2Toggle').classList.remove('active');
  document.getElementById('yeniOgrenciModal').classList.add('active');
}

// Modal kapat
function kapat() {
  document.getElementById('yeniOgrenciModal').classList.remove('active');
}

// Toast bildirimi
function toastGoster(mesaj, tip) {
  const eski = document.getElementById('yo_toast');
  if (eski) eski.remove();
  const t = document.createElement('div');
  t.id = 'yo_toast';
  t.className = 'toast' + (tip === 'error' ? ' error' : tip === 'warn' ? ' warn' : '');
  t.textContent = mesaj;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// Kaydet
async function kaydet() {
  const btn = document.getElementById('yo_kaydetBtn');

  // Değerleri al
  const adSoyad = document.getElementById('yo_adSoyad').value.trim();
  const dogumTarihi = document.getElementById('yo_dogumTarihi').value;
  const cinsiyet = document.getElementById('yo_cinsiyet').value;
  const sinif = document.getElementById('yo_sinif').value;
  const programTuru = document.getElementById('yo_programTuru').value;
  const aylikAidatRaw = document.getElementById('yo_aylikAidat').value;
  const aylikAidat = parseFloat(aylikAidatRaw);
  const tcKimlik = document.getElementById('yo_tcKimlik').value.trim();
  const veli1AdSoyad = document.getElementById('yo_veli1AdSoyad').value.trim();
  const veli1Eposta = document.getElementById('yo_veli1Eposta').value.trim();
  const veli1Telefon = document.getElementById('yo_veli1Telefon').value.trim();
  const veli2Ekle = document.getElementById('yo_veli2Ekle').checked;
  const veli2AdSoyad = veli2Ekle ? document.getElementById('yo_veli2AdSoyad').value.trim() : '';
  const veli2Eposta = veli2Ekle ? document.getElementById('yo_veli2Eposta').value.trim() : '';
  const veli2Telefon = veli2Ekle ? document.getElementById('yo_veli2Telefon').value.trim() : '';

  // Validasyon
  if (!adSoyad) { toastGoster('⚠️ Öğrenci adı gerekli', 'warn'); return; }
  if (!dogumTarihi) { toastGoster('⚠️ Doğum tarihi gerekli', 'warn'); return; }
  if (!cinsiyet) { toastGoster('⚠️ Cinsiyet seçin', 'warn'); return; }
  if (!sinif) { toastGoster('⚠️ Sınıf seçin', 'warn'); return; }
  if (!programTuru) { toastGoster('⚠️ Program türü seçin', 'warn'); return; }
  if (isNaN(aylikAidat) || aylikAidat < 0) { toastGoster('⚠️ Geçerli bir aylık aidat girin', 'warn'); return; }
  if (tcKimlik && tcKimlik.length !== 11) { toastGoster('⚠️ TC Kimlik 11 haneli olmalı (veya boş bırakın)', 'warn'); return; }
  if (!veli1AdSoyad) { toastGoster('⚠️ 1. veli adı gerekli', 'warn'); return; }
  if (!veli1Eposta) { toastGoster('⚠️ 1. veli e-postası gerekli', 'warn'); return; }
  if (!veli1Telefon) { toastGoster('⚠️ 1. veli telefonu gerekli', 'warn'); return; }

  btn.disabled = true;
  btn.textContent = 'Kaydediliyor...';

  try {
    // Aktif kullanıcı email'i
    const aktifEmail = (auth.currentUser && auth.currentUser.email) || 'emrahby@gmail.com';
    const simdi = new Date().toISOString();

    // Firestore'a yazılacak öğrenci objesi (mevcut şemaya uygun)
    const yeniOgrenci = {
      ogrenciAdSoyad: adSoyad,
      dogumTarihi: dogumTarihi,
      cinsiyet: cinsiyet,
      tcKimlik: tcKimlik || '',
      sinif: sinif,
      programTuru: programTuru,
      aylikAidat: aylikAidat,
      durum: 'aktif',
      veli1AdSoyad: veli1AdSoyad,
      veli1Eposta: veli1Eposta,
      veli1Telefon: veli1Telefon,
      veli2AdSoyad: veli2AdSoyad,
      veli2Eposta: veli2Eposta,
      veli2Telefon: veli2Telefon,
      kaynakBasvuruId: 'manuel',
      olusturan: aktifEmail,
      olusturuldu: simdi,
      guncellendi: simdi,
      durumGuncelleyen: aktifEmail
    };

    // Firestore'a yaz
    await addDoc(collection(db, 'ogrenciler'), yeniOgrenci);

    toastGoster('✅ Öğrenci başarıyla eklendi');
    kapat();

    // 1.5 saniye sonra sayfayı yenile (listenin güncellenmesi için)
    setTimeout(() => location.reload(), 1500);

  } catch (err) {
    console.error('[Öğrenci Ekle] Hata:', err);
    toastGoster('❌ Hata: ' + (err.message || 'Bilinmeyen hata'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 Kaydet';
  }
}

// ============================================================
// 3) BAŞLAT
// ============================================================
function baslat() {
  let denemeBekle = 0;
  const denemeAraligi = setInterval(() => {
    denemeBekle++;
    const eklendi = olusturBuyutonVeModal();
    if (eklendi) {
      clearInterval(denemeAraligi);

      // Buton click
      const btn = document.getElementById('btnYeniOgrenciAc');
      if (btn) btn.addEventListener('click', ac);

      // Modal kapat butonları
      document.getElementById('yo_kapatBtn').addEventListener('click', kapat);
      document.getElementById('yo_vazgecBtn').addEventListener('click', kapat);

      // Kaydet butonu
      document.getElementById('yo_kaydetBtn').addEventListener('click', kaydet);

      // 2. veli toggle
      const veli2Check = document.getElementById('yo_veli2Ekle');
      const veli2Card = document.getElementById('yo_veli2Toggle');
      veli2Check.addEventListener('change', veli2Toggle);
      veli2Card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          veli2Check.checked = !veli2Check.checked;
          veli2Toggle();
        }
      });

      // Modal dışına tıklayınca kapat
      document.getElementById('yeniOgrenciModal').addEventListener('click', (e) => {
        if (e.target.id === 'yeniOgrenciModal') kapat();
      });

      console.log('[Öğrenci Ekle] ✅ Modül yüklendi.');
    } else if (denemeBekle > 30) {
      clearInterval(denemeAraligi);
      console.warn('[Öğrenci Ekle] 15 saniye içinde sekmeler bulunamadı. Modül başlatılamadı.');
    }
  }, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', baslat);
} else {
  baslat();
}
