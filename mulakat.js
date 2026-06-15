// ═══════════════════════════════════════════════════════════
// MÜLAKAT PROFİLİ - ANA JS
// Admin için canlı mülakat aracı
// ═══════════════════════════════════════════════════════════

import { 
  auth, db,
  onAuthStateChanged,
  signOut,
  doc, getDoc, setDoc,
  serverTimestamp,
  PROXY_URL,
  ADMIN_EPOSTA
} from './firebase-config.js';

import { 
  ozetTabHTML,
  uyarilarTabHTML,
  sorularTabHTML,
  cevaplarTabHTML,
  notTabHTML,
  cubukChart
} from './mulakat-render.js';

import { tarihSaatFormatla } from './yardimci.js';

// ───────────────────────────────────────────────
// STATE
// ───────────────────────────────────────────────
let aktifAdayEposta = null;
let aktifAday = null;
let aktifAnaliz = null;
let aktifTestCevaplari = null;
let aktifMulakatNotu = null;
let aktifTab = 'ozet';

// ───────────────────────────────────────────────
// Auth kontrol
// ───────────────────────────────────────────────
onAuthStateChanged(auth, async (kullanici) => {
  if (!kullanici || kullanici.email !== ADMIN_EPOSTA) {
    document.getElementById('yukleniyor').classList.add('gizli');
    document.getElementById('yetkisiz').classList.remove('gizli');
    return;
  }
  
  // URL'den aday email'i al
  const urlParams = new URLSearchParams(window.location.search);
  aktifAdayEposta = urlParams.get('aday');
  
  if (!aktifAdayEposta) {
    document.getElementById('yukleniyor').classList.add('gizli');
    document.getElementById('yetkisiz').innerHTML = `
      <h2>⚠️ Aday Belirtilmemiş</h2>
      <p>Mülakat profili açmak için aday seçmelisiniz.</p>
      <a href="admin-havuz.html" class="btn">Aday Havuzuna Dön</a>
    `;
    document.getElementById('yetkisiz').classList.remove('gizli');
    return;
  }
  
  await tumVeriyiYukle();
});

// ───────────────────────────────────────────────
// Tüm veriyi paralel yükle
// ───────────────────────────────────────────────
async function tumVeriyiYukle() {
  try {
    // Paralel yükleme
    const [basvuruSnap, analizSnap, testSnap, notSnap] = await Promise.all([
      getDoc(doc(db, 'isBasvurulari', aktifAdayEposta)),
      getDoc(doc(db, 'analizler', aktifAdayEposta)),
      getDoc(doc(db, 'testCevaplari', aktifAdayEposta)),
      getDoc(doc(db, 'mulakatNotlari', aktifAdayEposta))
    ]);
    
    if (!basvuruSnap.exists()) {
      throw new Error('Aday bulunamadı');
    }
    
    aktifAday = basvuruSnap.data();
    aktifAnaliz = analizSnap.exists() ? analizSnap.data().analiz : null;
    aktifTestCevaplari = testSnap.exists() ? (testSnap.data().cevaplar || {}) : {};
    aktifMulakatNotu = notSnap.exists() ? notSnap.data() : {};
    
    // Sayfayı doldur
    document.getElementById('adayBaslik').textContent = aktifAday.adayAdi || aktifAdayEposta;
    document.getElementById('yukleniyor').classList.add('gizli');
    document.getElementById('anaIcerik').classList.remove('gizli');
    
    // Tüm tabları render et
    renderTumTablar();
    
    // Otomatik kayıt göstergesi
    otomatikKayitGostergesiOlustur();
    
  } catch (hata) {
    console.error('Yükleme hatası:', hata);
    document.getElementById('yukleniyor').classList.add('gizli');
    document.getElementById('yetkisiz').innerHTML = `
      <h2>⚠️ Yüklenemedi</h2>
      <p>${hata.message}</p>
      <a href="admin-havuz.html" class="btn">Aday Havuzuna Dön</a>
    `;
    document.getElementById('yetkisiz').classList.remove('gizli');
  }
}

// ───────────────────────────────────────────────
// Tüm tabları render et
// ───────────────────────────────────────────────
function renderTumTablar() {
  document.getElementById('tab-ozet').innerHTML = ozetTabHTML(aktifAday, aktifAnaliz, aktifTestCevaplari);
  document.getElementById('tab-uyarilar').innerHTML = uyarilarTabHTML(aktifAday, aktifAnaliz);
  document.getElementById('tab-sorular').innerHTML = sorularTabHTML(aktifAday, aktifAnaliz, aktifMulakatNotu);
  document.getElementById('tab-cevaplar').innerHTML = cevaplarTabHTML(aktifTestCevaplari, aktifAday?.kategoriId);
  document.getElementById('tab-not').innerHTML = notTabHTML(aktifAday, aktifMulakatNotu);
  
  // Event listenerlar
  baglaListenerlar();
}

// ───────────────────────────────────────────────
// Tab değiştirme
// ───────────────────────────────────────────────
window.tabDegistir = function(tabId) {
  aktifTab = tabId;
  
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('aktif'));
  document.querySelectorAll('.tab-icerik-alani').forEach(el => el.classList.add('gizli'));
  
  // Aktif tabı bul
  const aktifBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
  if (aktifBtn) aktifBtn.classList.add('aktif');
  
  document.getElementById(`tab-${tabId}`).classList.remove('gizli');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ───────────────────────────────────────────────
// Event listenerlar (textareas, butonlar)
// ───────────────────────────────────────────────
function baglaListenerlar() {
  // Tüm textarea'lara otomatik kayıt
  document.querySelectorAll('textarea[data-not-key]').forEach(ta => {
    ta.addEventListener('input', (e) => {
      const key = e.target.dataset.notKey;
      const deger = e.target.value;
      otomatikNotKaydet(key, deger);
    });
  });
  
  // Karar butonları
  document.querySelectorAll('.karar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const karar = e.currentTarget.dataset.karar;
      kararSec(karar);
    });
  });
  
  // Mevcut karar varsa butonu işaretle
  if (aktifMulakatNotu.karar) {
    const btn = document.querySelector(`.karar-btn[data-karar="${aktifMulakatNotu.karar}"]`);
    if (btn) {
      btn.classList.add('secili', aktifMulakatNotu.karar);
    }
  }
}

// ───────────────────────────────────────────────
// Karar seç
// ───────────────────────────────────────────────
async function kararSec(karar) {
  // Görsel
  document.querySelectorAll('.karar-btn').forEach(btn => {
    btn.classList.remove('secili', 'kabul', 'red', 'beklemede');
  });
  
  const btn = document.querySelector(`.karar-btn[data-karar="${karar}"]`);
  if (btn) {
    btn.classList.add('secili', karar);
  }
  
  // Kaydet
  await mulakatNotuKaydet({ karar: karar, kararZamani: serverTimestamp() });
}

// ───────────────────────────────────────────────
// Otomatik not kaydet (debounced)
// ───────────────────────────────────────────────
let otoKayitTimer = null;
function otomatikNotKaydet(key, deger) {
  if (otoKayitTimer) clearTimeout(otoKayitTimer);
  
  otoKayitTimer = setTimeout(async () => {
    const guncelleme = {};
    
    if (key.startsWith('derinSoru_')) {
      // Derin soru notu - subdocument
      const idx = key.replace('derinSoru_', '');
      guncelleme[`derinSoruNotlari.${idx}`] = deger;
    } else if (key.startsWith('soru_')) {
      // Mülakat sorusu notu
      const idx = key.replace('soru_', '');
      guncelleme[`soruNotlari.${idx}`] = deger;
    } else {
      // Genel notlar
      guncelleme[key] = deger;
    }
    
    await mulakatNotuKaydet(guncelleme);
  }, 1000);
}

// ───────────────────────────────────────────────
// Firestore'a kaydet
// ───────────────────────────────────────────────
async function mulakatNotuKaydet(guncelleme) {
  try {
    await setDoc(doc(db, 'mulakatNotlari', aktifAdayEposta), {
      adayEposta: aktifAdayEposta,
      adayAdi: aktifAday.adayAdi || '',
      pozisyonId: aktifAday.pozisyonId || null,
      ...guncelleme,
      sonGuncelleme: serverTimestamp()
    }, { merge: true });
    
    // Local state'i güncelle
    Object.keys(guncelleme).forEach(k => {
      if (k.includes('.')) {
        // Nested update
        const parts = k.split('.');
        if (!aktifMulakatNotu[parts[0]]) aktifMulakatNotu[parts[0]] = {};
        aktifMulakatNotu[parts[0]][parts[1]] = guncelleme[k];
      } else {
        aktifMulakatNotu[k] = guncelleme[k];
      }
    });
    
    otomatikKayitGoster();
    
  } catch (hata) {
    console.error('Kayıt hatası:', hata);
  }
}

// ───────────────────────────────────────────────
// Otomatik kayıt göstergesi
// ───────────────────────────────────────────────
function otomatikKayitGostergesiOlustur() {
  if (document.getElementById('otoKayit')) return;
  const div = document.createElement('div');
  div.id = 'otoKayit';
  div.className = 'otomatik-kayit';
  div.textContent = '✓ Kaydedildi';
  document.body.appendChild(div);
}

function otomatikKayitGoster() {
  const el = document.getElementById('otoKayit');
  if (!el) return;
  el.classList.add('gorunur');
  setTimeout(() => el.classList.remove('gorunur'), 1500);
}

// ───────────────────────────────────────────────
// Yazdırma
// ───────────────────────────────────────────────
window.yazdir = function() {
  // Tüm tabları görünür yap, sonra yazdır
  const tablar = document.querySelectorAll('.tab-icerik-alani');
  tablar.forEach(t => t.classList.remove('gizli'));
  window.print();
  // Yazdırma sonrası ilk tabı göster
  setTimeout(() => {
    tablar.forEach(t => t.classList.add('gizli'));
    document.getElementById(`tab-${aktifTab}`).classList.remove('gizli');
  }, 1000);
};

// ───────────────────────────────────────────────
// 🤖 Mülakat Sonu AI Analizi Tetikle
// ───────────────────────────────────────────────
window.mulakatSonuAnalizYap = async function() {
  const onay = confirm(
    '🤖 AI Mülakat Sonu Analizi\n\n' +
    'Bu analiz şu anda yazdığınız tüm mülakat notlarını alıp\n' +
    'test cevaplarıyla birleştirip yeni bir değerlendirme yapacak.\n\n' +
    'Yaklaşık 20-30 saniye sürer. Devam edilsin mi?'
  );
  if (!onay) return;
  
  const durumEl = document.getElementById('mulakatSonuAnalizDurum');
  if (durumEl) {
    durumEl.innerHTML = `
      <div style="margin-top: 16px; padding: 14px; background: rgba(255,255,255,0.2); border-radius: 8px;">
        ⏳ <strong>AI analiz yapıyor...</strong> Lütfen bekleyin (~20-30 saniye)
      </div>
    `;
  }
  
  try {
    const yanit = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        islem: 'mulakatSonuAnaliz',
        adayBilgileri: aktifAday,
        testCevaplari: aktifTestCevaplari,
        ilkAnaliz: aktifAnaliz,
        mulakatNotlari: aktifMulakatNotu
      })
    });
    
    const sonuc = await yanit.json();
    
    if (!sonuc.basarili) {
      durumEl.innerHTML = `
        <div style="margin-top: 16px; padding: 14px; background: rgba(255,0,0,0.2); border-radius: 8px;">
          ❌ Analiz başarısız: ${sonuc.hata || 'Bilinmeyen hata'}
        </div>
      `;
      return;
    }
    
    // Mülakat notlarına ekle
    await mulakatNotuKaydet({
      mulakatSonuAnaliz: sonuc.analiz,
      mulakatSonuAnalizZamani: serverTimestamp()
    });
    
    // Local state güncelle
    aktifMulakatNotu.mulakatSonuAnaliz = sonuc.analiz;
    aktifMulakatNotu.mulakatSonuAnalizZamani = new Date();
    
    // Notlar tab'ını yeniden render et
    document.getElementById('tab-not').innerHTML = notTabHTML(aktifAday, aktifMulakatNotu);
    baglaListenerlar();
    
    durumEl.innerHTML = `
      <div style="margin-top: 16px; padding: 14px; background: rgba(0,255,0,0.2); border-radius: 8px;">
        ✅ <strong>Analiz tamamlandı!</strong> Sayfayı kaydırarak sonucu görebilirsiniz.
      </div>
    `;
    
    // 1 sn sonra sonuca scroll
    setTimeout(() => {
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }, 800);
    
  } catch (hata) {
    console.error('Mülakat sonu analiz hatası:', hata);
    if (durumEl) {
      durumEl.innerHTML = `
        <div style="margin-top: 16px; padding: 14px; background: rgba(255,0,0,0.2); border-radius: 8px;">
          ❌ Hata: ${hata.message}
        </div>
      `;
    }
  }
};

// ───────────────────────────────────────────────
// 📧 TEKLİF MAİLİ MODAL
// ───────────────────────────────────────────────
window.teklifMailModalAc = function() {
  const ad = aktifAday.adayAdi || 'Aday';
  const pozisyon = aktifAday.pozisyonBaslik || '';
  const eposta = aktifAdayEposta;
  const beklediMaas = aktifAday.kisiselBilgiler?.ucretBeklenti || '';
  const baslamaTarihi = aktifAday.kisiselBilgiler?.baslamaTarihi || '';
  
  // AI'dan uyum yüzdesi
  const ilkSkor = aktifAnaliz?.genelUyumSkoru || 0;
  const sonSkor = aktifMulakatNotu?.mulakatSonuAnaliz?.guncellenmisSkor || ilkSkor;
  
  const modal = document.createElement('div');
  modal.id = 'teklifMailModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.7); z-index: 9999; padding: 20px; 
    overflow-y: auto; display: flex; align-items: flex-start; justify-content: center;
  `;
  
  modal.innerHTML = `
    <div style="background: white; max-width: 700px; width: 100%; border-radius: 16px; 
                padding: 32px; margin: 20px auto;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="color: var(--ana-yesil); margin: 0;">🎉 Teklif Maili Hazırla</h2>
        <button onclick="document.getElementById('teklifMailModal').remove()" 
                style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">✕</button>
      </div>
      
      <div style="background: #e8f5e9; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;">
        <strong>📧 Alıcı:</strong> ${ad} (${eposta})<br>
        <strong>🎯 Pozisyon:</strong> ${pozisyon}
      </div>
      
      <!-- UYUM YÜZDESİ -->
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--ana-yesil);">
          📊 Mailde Belirtilecek Uyum Yüzdesi:
        </label>
        <input type="number" id="teklifUyum" min="0" max="100" value="${sonSkor}" 
               style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
        <small style="color: #666;">AI'ın belirlediği uyum: %${sonSkor}</small>
      </div>
      
      <!-- MAAŞ -->
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--ana-yesil);">
          💰 Teklif Edilen Net Maaş (TL):
        </label>
        <input type="number" id="teklifMaas" min="0" value="${beklediMaas}" 
               style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
        <small style="color: #666;">${beklediMaas ? `Adayın beklentisi: ${parseInt(beklediMaas).toLocaleString('tr-TR')} TL` : 'Aday maaş belirtmemiş'}</small>
      </div>
      
      <!-- BAŞLAMA TARİHİ -->
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--ana-yesil);">
          📅 Başlama Tarihi:
        </label>
        <input type="text" id="teklifBaslama" value="${baslamaTarihi}" 
               placeholder="Örn: 1 Eylül 2026"
               style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
      </div>
      
      <!-- YAN HAKLAR DROPDOWN (multiple select) -->
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--ana-yesil);">
          🎁 Yan Haklar (birden fazla seçebilirsiniz):
        </label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 14px; 
                    background: #f8fffa; border: 2px solid #e0e0e0; border-radius: 8px;">
          ${[
            { kod: 'yol', metin: '🚌 Yol yardımı / Servis' },
            { kod: 'yemek', metin: '🍽️ Öğle yemeği ücretsiz' },
            { kod: 'sgk', metin: '🛡️ SGK (yasal)' },
            { kod: 'sigorta', metin: '⚕️ Özel sağlık sigortası' },
            { kod: 'izin14', metin: '🌴 Yıllık izin (14 gün)' },
            { kod: 'izin20', metin: '🌴 Yıllık izin (20 gün)' },
            { kod: 'dogum', metin: '👶 Doğum izni (yasal)' },
            { kod: 'cocuk', metin: '🧒 Çocuk için indirimli kayıt' },
            { kod: 'egitim', metin: '📚 Sürekli eğitim/seminer desteği' },
            { kod: 'yilsonu', metin: '🎁 Yıl sonu primi' },
            { kod: 'performans', metin: '⭐ Performans primi' },
            { kod: 'dogumGunu', metin: '🎂 Doğum günü izni' }
          ].map(yh => `
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px; cursor: pointer;
                          background: white; border-radius: 6px; transition: all 0.2s;">
              <input type="checkbox" value="${yh.metin}" data-kod="${yh.kod}" class="yan-hak-cb">
              <span style="font-size: 14px;">${yh.metin}</span>
            </label>
          `).join('')}
        </div>
        <small style="color: #666; margin-top: 4px; display: block;">
          ✓ İşaretlediğiniz yan haklar mailde liste olarak görünecek
        </small>
      </div>
      
      <!-- KİŞİSEL MESAJ -->
      <div style="margin-bottom: 20px;">
        <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--ana-yesil);">
          💌 Kişisel Mesaj (isteğe bağlı):
        </label>
        <textarea id="teklifKisisel" rows="3" 
                  placeholder="Mülakatta sizinle tanışmak çok keyifliydi. Çocuklara olan yaklaşımınız..."
                  style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;
                         font-family: inherit; font-size: 14px; line-height: 1.6;"></textarea>
        <small style="color: #666;">Bu mesaj mailde özel bir kart içinde görünecek</small>
      </div>
      
      <!-- ÖNİZLEME UYARI -->
      <div style="background: #fff3e0; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; line-height: 1.6;">
        ⚠️ <strong>Mail göndermeden önce:</strong> Bilgileri kontrol edin. Mail gönderildikten sonra 
        düzenlenemez. Adayla maaş konusunda anlaşma sağlandıktan sonra göndermenizi öneririz.
      </div>
      
      <!-- BUTONLAR -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <button class="btn btn-ikincil" onclick="document.getElementById('teklifMailModal').remove()">
          ❌ İptal
        </button>
        <button class="btn" onclick="teklifMailGonder()" 
                style="background: linear-gradient(135deg, #2c5530 0%, #4a7c59 100%);">
          📧 Teklif Mailini Gönder
        </button>
      </div>
      
      <div id="teklifMailDurum" style="margin-top: 12px;"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
};

// ───────────────────────────────────────────────
// 📧 TEKLİF MAİLİ GÖNDER
// ───────────────────────────────────────────────
window.teklifMailGonder = async function() {
  const uyum = document.getElementById('teklifUyum').value;
  const maas = document.getElementById('teklifMaas').value;
  const baslama = document.getElementById('teklifBaslama').value;
  const kisisel = document.getElementById('teklifKisisel').value;
  const durum = document.getElementById('teklifMailDurum');
  
  // Yan hakları topla
  const yanHaklar = [];
  document.querySelectorAll('.yan-hak-cb:checked').forEach(cb => {
    yanHaklar.push(cb.value);
  });
  
  if (yanHaklar.length === 0) {
    if (!confirm('Hiç yan hak seçmediniz. Yine de göndermek istiyor musunuz?')) return;
  }
  
  const yanHaklarHTML = yanHaklar.length > 0
    ? '<ul style="padding-left: 20px; margin: 0;">' + 
      yanHaklar.map(yh => `<li style="margin-bottom: 6px;">${yh}</li>`).join('') + 
      '</ul>'
    : '';
  
  durum.innerHTML = '<div style="padding:10px; background:#fff3e0; border-radius:8px;">⏳ Mail gönderiliyor...</div>';
  
  try {
    const yanit = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        islem: 'mailGonder',
        alici: aktifAdayEposta,
        aliciAdi: aktifAday.adayAdi || 'Aday',
        tip: 'teklifMaili',
        parametreler: {
          pozisyonBaslik: aktifAday.pozisyonBaslik || '',
          uyumYuzdesi: parseInt(uyum) || 0,
          maasOnerimiz: maas,
          baslamaTarihi: baslama,
          yanHaklarHTML: yanHaklarHTML,
          kisiselMesaj: kisisel
        }
      })
    });
    
    const sonuc = await yanit.json();
    
    if (sonuc.basarili) {
      // Mülakat notuna kaydet
      await mulakatNotuKaydet({
        sonGonderilenMail: {
          tip: 'Teklif Maili',
          tarih: serverTimestamp(),
          maas: maas,
          uyum: uyum,
          yanHaklar: yanHaklar.length
        }
      });
      
      durum.innerHTML = `
        <div style="padding:14px; background:#d4f5d4; border-radius:8px; color:#1b5e20;">
          ✅ <strong>Teklif maili başarıyla gönderildi!</strong><br>
          ${aktifAdayEposta} adresine ulaştı.
        </div>
      `;
      
      setTimeout(() => {
        document.getElementById('teklifMailModal')?.remove();
      }, 2500);
    } else {
      durum.innerHTML = `<div style="padding:10px; background:#ffebee; border-radius:8px;">❌ Hata: ${sonuc.hata || 'Bilinmeyen'}</div>`;
    }
  } catch (e) {
    durum.innerHTML = `<div style="padding:10px; background:#ffebee; border-radius:8px;">❌ Hata: ${e.message}</div>`;
  }
};

// ───────────────────────────────────────────────
// 📨 OLUMSUZ MAİL MODAL
// ───────────────────────────────────────────────
window.olumsuzMailModalAc = function() {
  const ad = aktifAday.adayAdi || 'Aday';
  const eposta = aktifAdayEposta;
  
  const modal = document.createElement('div');
  modal.id = 'olumsuzMailModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.7); z-index: 9999; padding: 20px; 
    overflow-y: auto; display: flex; align-items: flex-start; justify-content: center;
  `;
  
  modal.innerHTML = `
    <div style="background: white; max-width: 600px; width: 100%; border-radius: 16px; 
                padding: 32px; margin: 20px auto;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="color: var(--ana-yesil); margin: 0;">📨 Havuza Al ve Bilgilendir</h2>
        <button onclick="document.getElementById('olumsuzMailModal').remove()" 
                style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">✕</button>
      </div>
      
      <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;">
        <strong>📧 Alıcı:</strong> ${ad} (${eposta})<br>
        <strong>📋 İşlem:</strong> Aday havuzuna eklenecek, gelecekte uygun pozisyonlar için bilgilendirilecek
      </div>
      
      <!-- KİŞİSEL MESAJ -->
      <div style="margin-bottom: 20px;">
        <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--ana-yesil);">
          💌 Kişisel Mesaj (isteğe bağlı):
        </label>
        <textarea id="olumsuzKisisel" rows="4" 
                  placeholder="Sizinle tanışmak güzeldi. Çocuklara olan yaklaşımınız çok değerli..."
                  style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;
                         font-family: inherit; font-size: 14px; line-height: 1.6;"></textarea>
        <small style="color: #666;">Adayı içtenlikle yönlendiren ve değer veren bir mesaj yazabilirsiniz</small>
      </div>
      
      <!-- BİLGİ -->
      <div style="background: #f8fffa; padding: 14px; border-radius: 8px; margin-bottom: 16px; 
                  border-left: 3px solid #4a7c59;">
        <p style="font-size: 14px; line-height: 1.7; color: #333; margin: 0;">
          📌 Mail içeriğinde:<br>
          ✓ Başvurusu için teşekkür<br>
          ✓ Bu pozisyon için olumsuz dönüş (yumuşak dilde)<br>
          ✓ <strong>Aday havuzuna alındığı bildirimi</strong><br>
          ✓ Yeni pozisyonlarda otomatik bilgilendirileceği taahhüdü<br>
          ✓ Sosyal medya takip linkleri
        </p>
      </div>
      
      <!-- BUTONLAR -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <button class="btn btn-ikincil" onclick="document.getElementById('olumsuzMailModal').remove()">
          ❌ İptal
        </button>
        <button class="btn" onclick="olumsuzMailGonder()">
          📨 Maili Gönder
        </button>
      </div>
      
      <div id="olumsuzMailDurum" style="margin-top: 12px;"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
};

// ───────────────────────────────────────────────
// 📨 OLUMSUZ MAİL GÖNDER
// ───────────────────────────────────────────────
window.olumsuzMailGonder = async function() {
  const kisisel = document.getElementById('olumsuzKisisel').value;
  const durum = document.getElementById('olumsuzMailDurum');
  
  durum.innerHTML = '<div style="padding:10px; background:#fff3e0; border-radius:8px;">⏳ Mail gönderiliyor...</div>';
  
  try {
    const yanit = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        islem: 'mailGonder',
        alici: aktifAdayEposta,
        aliciAdi: aktifAday.adayAdi || 'Aday',
        tip: 'olumsuzMaili',
        parametreler: {
          pozisyonBaslik: aktifAday.pozisyonBaslik || '',
          kisiselMesaj: kisisel
        }
      })
    });
    
    const sonuc = await yanit.json();
    
    if (sonuc.basarili) {
      await mulakatNotuKaydet({
        sonGonderilenMail: {
          tip: 'Havuz Maili (Olumsuz)',
          tarih: serverTimestamp()
        }
      });
      
      durum.innerHTML = `
        <div style="padding:14px; background:#d4f5d4; border-radius:8px; color:#1b5e20;">
          ✅ <strong>Mail başarıyla gönderildi!</strong><br>
          Aday havuza eklendi, ${aktifAdayEposta} adresine bilgi verildi.
        </div>
      `;
      
      setTimeout(() => {
        document.getElementById('olumsuzMailModal')?.remove();
      }, 2500);
    } else {
      durum.innerHTML = `<div style="padding:10px; background:#ffebee; border-radius:8px;">❌ Hata: ${sonuc.hata || 'Bilinmeyen'}</div>`;
    }
  } catch (e) {
    durum.innerHTML = `<div style="padding:10px; background:#ffebee; border-radius:8px;">❌ Hata: ${e.message}</div>`;
  }
};

// ───────────────────────────────────────────────
// Çıkış
// ───────────────────────────────────────────────
window.cikisYap = async function() {
  await signOut(auth);
  window.location.href = 'index.html';
};
