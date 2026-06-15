// ═══════════════════════════════════════════════════════════
// MÜLAKAT PROFİLİ - RENDER FONKSİYONLARI
// ═══════════════════════════════════════════════════════════

import { tarihSaatFormatla, tarihFormatla, pozisyonKategorisiBul, testTipiBul } from './yardimci.js';

// Soru bankaları (cevapları tam soru metniyle göstermek için)
import { BOLUM1_KISILIK, BOLUM2_DEGERLER, BOLUM3_SENARYOLAR, BOLUM4_HIKAYELER, BOLUM5_KORUMA, BOLUM6_HIZLI } from './test-sorular.js';
import { IDARI_BOLUM1_KISILIK, IDARI_BOLUM2_DEGERLER, IDARI_BOLUM3_SENARYOLAR, IDARI_BOLUM4_HIKAYELER, IDARI_BOLUM5_ETIK, IDARI_BOLUM6_HIZLI } from './test-sorular-idari.js';
import { DESTEK_BOLUM1_KISILIK, DESTEK_BOLUM2_DEGERLER, DESTEK_BOLUM3_SENARYOLAR, DESTEK_BOLUM4_HIKAYELER, DESTEK_BOLUM5_ETIK, DESTEK_BOLUM6_HIZLI } from './test-sorular-destek.js';

// soruId → soru objesi haritası (test tipine göre)
function soruHaritasiOlustur(testTipi) {
  let bolumler;
  if (testTipi === 'destek') {
    bolumler = [DESTEK_BOLUM1_KISILIK, DESTEK_BOLUM2_DEGERLER, DESTEK_BOLUM3_SENARYOLAR, DESTEK_BOLUM4_HIKAYELER, DESTEK_BOLUM5_ETIK, DESTEK_BOLUM6_HIZLI];
  } else if (testTipi === 'idari') {
    bolumler = [IDARI_BOLUM1_KISILIK, IDARI_BOLUM2_DEGERLER, IDARI_BOLUM3_SENARYOLAR, IDARI_BOLUM4_HIKAYELER, IDARI_BOLUM5_ETIK, IDARI_BOLUM6_HIZLI];
  } else {
    bolumler = [BOLUM1_KISILIK, BOLUM2_DEGERLER, BOLUM3_SENARYOLAR, BOLUM4_HIKAYELER, BOLUM5_KORUMA, BOLUM6_HIZLI];
  }
  const harita = {};
  bolumler.forEach(b => {
    if (Array.isArray(b)) b.forEach(s => { if (s && s.id) harita[s.id] = s; });
  });
  return harita;
}

// Soru metnini çıkar (senaryo/durum/soru hangisi varsa)
function soruMetniBul(soru) {
  if (!soru) return '';
  return soru.soru || soru.senaryo || soru.durum || soru.metin || '';
}

// Cevabı okunaklı metne çevir (seçim harfini tam metinle eşleştir)
function cevapMetniCozMr(soru, cevap) {
  if (cevap === null || cevap === undefined || cevap === '') return '<em style="color:#999;">Boş</em>';
  // Likert (1-5)
  if (typeof cevap === 'number' || (typeof cevap === 'string' && /^[1-5]$/.test(cevap))) {
    const et = {1:'Kesinlikle katılmıyorum',2:'Katılmıyorum',3:'Kararsızım',4:'Katılıyorum',5:'Kesinlikle katılıyorum'};
    const v = parseInt(cevap);
    return `<strong>${v}/5</strong> — ${et[v] || ''}`;
  }
  // Seçimli {secim, neden}
  if (typeof cevap === 'object') {
    const secim = cevap.secim ?? cevap.secilen ?? '';
    let secenekMetni = secim;
    if (soru && soru.secenekler) {
      if (Array.isArray(soru.secenekler)) {
        const bulunan = soru.secenekler.find(x => x && x.id === secim);
        if (bulunan) secenekMetni = `${secim}) ${bulunan.metin}`;
      } else if (typeof soru.secenekler === 'object' && soru.secenekler[secim]) {
        const s = soru.secenekler[secim];
        secenekMetni = `${secim}) ${typeof s === 'string' ? s : (s.metin || '')}`;
      }
    }
    let html = `<strong>${secenekMetni}</strong>`;
    if (cevap.neden) html += `<div class="cevap-uzun"><strong>💭 Neden:</strong> ${cevap.neden}</div>`;
    return html;
  }
  // String (hikaye uzun / hızlı kısa)
  if (typeof cevap === 'string') {
    if (cevap.length > 60) return `<div class="cevap-uzun">${cevap}</div>`;
    return `<strong>${cevap}</strong>`;
  }
  return String(cevap);
}

// ───────────────────────────────────────────────
// TAB 1: ÖZET
// ───────────────────────────────────────────────
export function ozetTabHTML(aday, analiz, cevaplar) {
  const k = aday.kisiselBilgiler || {};
  const kategori = pozisyonKategorisiBul(aday.kategoriId || 'okulOncesiOgretmen');
  
  let html = '';
  
  // Kişisel bilgi kartı
  html += `
    <div class="kart">
      <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 16px;">
        ${aday.googleFoto 
          ? `<img src="${aday.googleFoto}" style="width:80px; height:80px; border-radius:50%; flex-shrink:0;">` 
          : `<div style="width:80px; height:80px; border-radius:50%; background:var(--cok-acik-yesil); 
               display:flex; align-items:center; justify-content:center; color:var(--ana-yesil); 
               font-weight:700; font-size:32px; flex-shrink:0;">
               ${(aday.adayAdi || '?').charAt(0).toUpperCase()}
             </div>`
        }
        <div style="flex: 1; min-width: 200px;">
          <h2 style="color: var(--ana-yesil); margin: 0 0 4px;">${aday.adayAdi || '-'}</h2>
          <div style="color: var(--gri); font-size: 14px;">📧 ${aday.adayEposta}</div>
          ${k.telefon ? `<div style="color: var(--gri); font-size: 14px;">📱 0${k.telefon}</div>` : ''}
          <div style="margin-top: 8px;">
            <span style="background: var(--cok-acik-yesil); color: var(--ana-yesil); 
                         padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
              ${kategori.ikon} ${aday.pozisyonBaslik || kategori.ad}
            </span>
          </div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 14px;">
        ${k.dogumTarihi ? `<div><strong>📅 Doğum:</strong> ${k.dogumTarihi}</div>` : ''}
        ${k.cinsiyet ? `<div><strong>👤 Cinsiyet:</strong> ${k.cinsiyet}</div>` : ''}
        ${k.medeniDurum ? `<div><strong>💑 Medeni:</strong> ${k.medeniDurum}</div>` : ''}
        ${k.egitimDurumu ? `<div><strong>🎓 Eğitim:</strong> ${k.egitimDurumu}</div>` : ''}
        ${k.bolum ? `<div><strong>📚 Bölüm:</strong> ${k.bolum}</div>` : ''}
        ${k.deneyimYil ? `<div><strong>💼 Deneyim:</strong> ${k.deneyimYil} yıl</div>` : ''}
      </div>
    </div>
    
    <!-- 💰 ÇALIŞMA TERCİHLERİ - Mülakatta Konuşulacaklar -->
    <div class="kart" style="background: linear-gradient(135deg, #f8fffa 0%, white 100%); border-left: 4px solid var(--ana-yesil);">
      <h3 style="color: var(--ana-yesil); margin-bottom: 12px;">💰 Çalışma Tercihleri & Beklentiler</h3>
      <p style="color: var(--gri); font-size: 13px; margin-bottom: 16px;">
        Bunlar mülakatta konuşulacak ve karar verirken kıyaslayacağınız önemli noktalar
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
        
        <div style="background: #e8f5e9; padding: 16px; border-radius: 10px;">
          <div style="font-size: 12px; color: #2c5530; font-weight: 600; margin-bottom: 4px;">
            💰 MAAŞ BEKLENTİSİ
          </div>
          <div style="font-size: 22px; font-weight: 800; color: #2c5530;">
            ${k.ucretBeklenti 
              ? parseInt(k.ucretBeklenti).toLocaleString('tr-TR') + ' TL'
              : '<span style="font-size:16px; color:#999;">Belirtilmemiş</span>'
            }
          </div>
          <div style="font-size: 12px; color: var(--gri); margin-top: 4px;">
            Aylık net beklenti
          </div>
        </div>
        
        ${k.baslamaTarihi ? `
        <div style="background: #fff3e0; padding: 16px; border-radius: 10px;">
          <div style="font-size: 12px; color: #e65100; font-weight: 600; margin-bottom: 4px;">
            📅 BAŞLAMA TARİHİ
          </div>
          <div style="font-size: 18px; font-weight: 700; color: #e65100;">
            ${k.baslamaTarihi}
          </div>
          <div style="font-size: 12px; color: var(--gri); margin-top: 4px;">
            En erken başlayabilir
          </div>
        </div>
        ` : ''}
        
        ${k.mevcutIsDurumu ? `
        <div style="background: #e3f2fd; padding: 16px; border-radius: 10px;">
          <div style="font-size: 12px; color: #1976d2; font-weight: 600; margin-bottom: 4px;">
            💼 ŞU ANKİ DURUM
          </div>
          <div style="font-size: 14px; font-weight: 600; color: #1976d2; line-height: 1.4;">
            ${({
              'issiz': '🔍 İş arıyor',
              'aktif': '💼 Çalışıyor, geçiş arıyor',
              'staj': '🎓 Stajda',
              'ogrenci': '📚 Öğrenci'
            })[k.mevcutIsDurumu] || k.mevcutIsDurumu}
          </div>
        </div>
        ` : ''}
        
      </div>
      
      ${k.nedenBCK ? `
        <div style="background: #fafafa; padding: 14px; border-radius: 8px; margin-top: 16px; border-left: 3px solid var(--acik-yesil);">
          <div style="font-size: 12px; color: var(--gri); font-weight: 600; margin-bottom: 6px;">
            💚 NEDEN BİZİ TERCİH ETTİ?
          </div>
          <div style="font-style: italic; color: var(--metin); line-height: 1.6;">
            "${k.nedenBCK}"
          </div>
        </div>
      ` : ''}
    </div>
  `;
  
  // Eğer analiz yoksa
  if (!analiz) {
    html += `
      <div class="kart" style="text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 12px;">⏳</div>
        <h3>AI Analizi Henüz Yapılmamış</h3>
        <p style="color: var(--gri);">
          Bu aday için henüz AI analizi oluşturulmamış. Önce aday havuzu sayfasından
          "AI Analizini Çalıştır" ile analizi tetikleyin.
        </p>
        <a href="admin-havuz.html" class="btn">Aday Havuzuna Dön</a>
      </div>
    `;
    return html;
  }
  
  const skor = analiz.genelUyumSkoru || 0;
  const etiket = analiz.tavsiyeEtiketi || 'degerlendirilmeli';
  const etiketler = {
    'guclu': { renk: '#2c5530', bg: '#d4f5d4', metin: '🟢 GÜÇLÜ ADAY' },
    'degerlendirilmeli': { renk: '#f57c00', bg: '#fff3e0', metin: '🟡 DEĞERLENDİRİLMELİ' },
    'uygunDegil': { renk: '#d32f2f', bg: '#ffebee', metin: '🔴 UYGUN DEĞİL' }
  };
  const e = etiketler[etiket] || etiketler['degerlendirilmeli'];
  
  // Manipülasyon ve bağlılık skorları
  const manipulasyon = analiz.manipulasyon || {};
  const kariyer = analiz.kariyer || {};
  
  // Genel skor + Tavsiye + Manipülasyon + Bağlılık
  html += `
    <div class="ozet-grid">
      
      <!-- GENEL SKOR -->
      <div class="kart skor-buyuk">
        <h3 style="color: var(--ana-yesil); margin-bottom: 12px;">🎯 Genel Uyum Skoru</h3>
        <div class="skor-cember" style="background: conic-gradient(${e.renk} ${skor * 3.6}deg, #e0e0e0 0deg);">
          <div class="skor-cember-ic">
            <div class="deger" style="color: ${e.renk};">${skor}</div>
            <div class="max">/ 100</div>
          </div>
        </div>
        <div style="display: inline-block; background: ${e.bg}; color: ${e.renk};
                    padding: 8px 20px; border-radius: 20px; font-weight: 700; font-size: 14px;">
          ${e.metin}
        </div>
      </div>
      
      <!-- ÖNEMLI METRIKLER -->
      <div class="kart">
        <h3 style="color: var(--ana-yesil); margin-bottom: 16px;">📊 Kritik Metrikler</h3>
        
        ${manipulasyonGosterge('🔍 Manipülasyon Eğilimi', manipulasyon.yuzde, manipulasyon.seviye)}
        ${baglılıkGosterge('💼 Kuruma Bağlılık', kariyer.baglilikYuzde, kariyer.baglilikSeviyesi)}
        ${cubukChart('🛡️ Çocuk Koruma', analiz.detayliSkorlar?.etikYuzde || 0, '#d32f2f')}
        ${cubukChart('🌱 Montessori Uyumu', analiz.yetkinlikler?.montessoriUyumu || 0, '#2c5530')}
        
      </div>
    </div>
  `;
  
  // Big Five
  const bf = analiz.bigFive || {};
  html += `
    <div class="kart">
      <h3>🧠 Kişilik Profili (Big Five)</h3>
      <div class="bigFive-grid">
        ${cubukChart('Açıklık', bf.aciklik || 0, '#9c27b0')}
        ${cubukChart('Sorumluluk', bf.sorumluluk || 0, '#1976d2')}
        ${cubukChart('Dışa Dönüklük', bf.disaDonukluk || bf.disadonukluk || 0, '#f57c00')}
        ${cubukChart('Uyumluluk ⭐', bf.uyumluluk || 0, '#2c5530')}
        ${cubukChart('Duygusal Denge', bf.duygusalDenge || 0, '#0097a7')}
      </div>
    </div>
  `;
  
  // 8 Yetkinlik
  const y = analiz.yetkinlikler || {};
  html += `
    <div class="kart">
      <h3>🎯 8 Yetkinlik Profili</h3>
      <div class="bigFive-grid">
        ${cubukChart('💚 Empati', y.empati || 0, '#2c5530')}
        ${cubukChart('🧘 Sabır', y.sabir || 0, '#4a7c59')}
        ${cubukChart('📚 Pedagojik Yaklaşım', y.pedagojikYaklasim || 0, '#1976d2')}
        ${cubukChart('🛡️ Çocuk Koruma', y.cocukKorumaFarkindaligi || 0, '#d32f2f')}
        ${cubukChart('🤝 Ekip Çalışması', y.ekipCalismasi || 0, '#f57c00')}
        ${cubukChart('💬 İletişim', y.iletisim || 0, '#9c27b0')}
        ${cubukChart('🌪️ Stres Yönetimi', y.stresYonetimi || 0, '#0097a7')}
        ${cubukChart('🌱 Montessori Uyumu', y.montessoriUyumu || 0, '#2c5530')}
      </div>
    </div>
  `;
  
  // Güçlü yönler / gelişim
  if (analiz.gucluYonler?.length || analiz.gelisimAlanlari?.length) {
    html += `
      <div class="ozet-grid">
        ${analiz.gucluYonler?.length ? `
          <div class="kart" style="background: #e8f5e9;">
            <h3 style="color: var(--ana-yesil);">✨ Güçlü Yönler</h3>
            <ul style="padding-left: 20px;">
              ${analiz.gucluYonler.map(g => `<li style="margin-bottom:8px;">${g}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${analiz.gelisimAlanlari?.length ? `
          <div class="kart" style="background: #fff3e0;">
            <h3 style="color: var(--turuncu);">🌱 Gelişim Alanları</h3>
            <ul style="padding-left: 20px;">
              ${analiz.gelisimAlanlari.map(g => `<li style="margin-bottom:8px;">${g}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // AI yorumu
  if (analiz.aiYorumu) {
    html += `
      <div class="kart">
        <h3>📝 AI Genel Değerlendirme</h3>
        <div style="line-height: 1.8; white-space: pre-wrap;">${analiz.aiYorumu}</div>
      </div>
    `;
  }
  
  return html;
}

// ───────────────────────────────────────────────
// TAB 2: UYARILAR
// ───────────────────────────────────────────────
export function uyarilarTabHTML(aday, analiz) {
  if (!analiz) return '<div class="kart"><p>AI analizi yok.</p></div>';
  
  const bayraklar = analiz.kirmiziBayraklar || [];
  const manipulasyon = analiz.manipulasyon || {};
  const kariyer = analiz.kariyer || {};
  
  let html = `
    <div class="kart">
      <h2>🚩 Uyarılar ve Kritik Noktalar</h2>
      <p style="color: var(--gri);">Bu sayfa adayın test cevaplarındaki dikkat çekici noktaları gösterir. Mülakata bunlarla hazırlıklı girin.</p>
    </div>
  `;
  
  // Kırmızı bayraklar
  if (bayraklar.length === 0) {
    html += `
      <div class="kart" style="background: #e8f5e9; text-align: center; padding: 40px;">
        <div style="font-size: 48px;">✅</div>
        <h3 style="color: var(--ana-yesil);">Kırmızı Bayrak Yok</h3>
        <p>Bu adayda dikkat edilmesi gereken kritik bir nokta tespit edilmedi.</p>
      </div>
    `;
  } else {
    html += `<h3 style="color: var(--kirmizi); margin-bottom: 16px;">🚨 Tespit Edilen ${bayraklar.length} Uyarı</h3>`;
    
    // Önce çok yüksek, sonra yüksek, sonra orta
    const siralı = [...bayraklar].sort((a, b) => {
      const oncelik = { cokYuksek: 0, yuksek: 1, orta: 2 };
      return (oncelik[a.kritiklik] || 3) - (oncelik[b.kritiklik] || 3);
    });
    
    siralı.forEach(b => {
      // Bayrak düz metin (string) veya nesne olabilir
      const metinMi = (typeof b === 'string');
      const kritiklikSinif = metinMi ? 'orta' : (b.kritiklik || 'orta');
      const tipSinif = `tip-${metinMi ? 'ai_genel' : (b.tip || 'ai_genel')}`;
      const tipMetin = metinMi ? '⚠️ Uyarı' : ({
        'cocukKoruma': '🚨 Çocuk Koruma',
        'etik': '⚠️ Etik',
        'manipulasyon': '🔍 Manipülasyon',
        'tutarsizlik': '⚖️ Tutarsızlık',
        'baglılık': '💼 Bağlılık',
        'ai_genel': '🤖 AI Tespiti'
      }[b.tip] || '⚠️ Uyarı');
      
      const kritiklikMetin = {
        'cokYuksek': '🔴 ÇOK KRİTİK',
        'yuksek': '🟠 YÜKSEK',
        'orta': '🟡 ORTA'
      }[kritiklikSinif] || '🟡 ORTA';
      
      const icerik = metinMi
        ? b
        : (b.aciklama || `Soru ${b.soruId}: Seçim "${b.secilen}", Doğru: "${b.dogru || '?'}"`);
      
      html += `
        <div class="uyari-kart ${kritiklikSinif}">
          <div class="uyari-baslik">
            <span class="uyari-tip ${tipSinif}">${tipMetin}</span>
            <span style="font-size: 12px; color: var(--gri); font-weight: 600;">${kritiklikMetin}</span>
          </div>
          <div style="line-height: 1.7;">
            ${icerik}
          </div>
        </div>
      `;
    });
  }
  
  // Manipülasyon detayı
  if (manipulasyon.detay && manipulasyon.detay.length > 0) {
    html += `
      <div class="kart" style="margin-top: 24px;">
        <h3>🔍 Manipülasyon Tespit Detayı</h3>
        <p style="color: var(--gri); font-size: 14px;">
          Aday aşağıdaki sorulara "fazla mükemmel" veya "saklayan" cevaplar verdi:
        </p>
        <div style="background: #fafafa; padding: 16px; border-radius: 8px;">
          ${manipulasyon.detay.map(d => `
            <div style="margin-bottom: 12px; padding: 12px; background: white; border-radius: 6px; border-left: 3px solid var(--turuncu);">
              <div style="font-size: 13px; color: var(--gri); margin-bottom: 4px;">
                ${d.sebep === 'idealize' || d.sebep === 'idealize_hafif' ? '✨ İdealize ediyor' : '🤐 Saklama eğilimi'}
              </div>
              <div style="font-style: italic; margin-bottom: 4px;">"${d.metin}"</div>
              <div style="font-size: 13px;">
                <strong>Verdiği cevap:</strong> ${d.secim}/5
                ${d.sebep.includes('hafif') ? ' (hafif şüpheli)' : ' (çok şüpheli)'}
              </div>
            </div>
          `).join('')}
        </div>
        ${manipulasyon.aiYorumu ? `
          <div style="margin-top: 16px; padding: 16px; background: #f3e5f5; border-radius: 8px; border-left: 4px solid #6a1b9a;">
            <strong style="color: #6a1b9a;">🤖 AI Yorumu:</strong>
            <div style="margin-top: 6px; line-height: 1.7;">${manipulasyon.aiYorumu}</div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Kariyer/bağlılık detayı
  if (kariyer.detay && Object.keys(kariyer.detay).length > 0) {
    const d = kariyer.detay;
    html += `
      <div class="kart">
        <h3>💼 Kariyer ve Bağlılık Profili</h3>
        <p style="color: var(--gri); font-size: 14px;">
          Adayın dolaylı kariyer sorularına verdiği cevaplardan çıkarılan profil:
        </p>
        <div style="background: #fafafa; padding: 16px; border-radius: 8px;">
          <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
            ${d.uzunSureli !== undefined ? `
              <div>
                ${d.uzunSureli ? '✅' : '⚠️'} <strong>Uzun süreli çalışma:</strong> 
                ${d.uzunSureli ? 'Tercih ediyor' : 'Hızlı geçişlere açık'}
              </div>
            ` : ''}
            ${d.kendiOkulIstiyor ? `
              <div style="color: var(--kirmizi);">
                ⚠️ <strong>Kendi okul/proje açma niyeti var</strong> (büyük dikkat!)
              </div>
            ` : ''}
            ${d.taahhutKabul !== undefined ? `
              <div>
                ${d.taahhutKabul ? '✅' : '⚠️'} <strong>Uzun yıllar taahhüt:</strong> 
                ${d.taahhutKabul ? 'Kabul ediyor' : 'Çekinceli'}
              </div>
            ` : ''}
            ${d.kurumIcindeGelisim !== undefined ? `
              <div>
                ${d.kurumIcindeGelisim ? '✅' : '⚠️'} <strong>Kurum içinde gelişim:</strong> 
                ${d.kurumIcindeGelisim ? 'Tercih ediyor' : 'Bağımsız öğrenmeyi tercih'}
              </div>
            ` : ''}
            ${d.ekipOyuncusu !== undefined ? `
              <div>
                ${d.ekipOyuncusu ? '✅' : '⚠️'} <strong>Ekip oyuncusu:</strong> 
                ${d.ekipOyuncusu ? 'Evet' : 'Bireysel takdir öncelikli'}
              </div>
            ` : ''}
          </div>
        </div>
        ${kariyer.aiYorumu ? `
          <div style="margin-top: 16px; padding: 16px; background: #e8eaf6; border-radius: 8px; border-left: 4px solid #283593;">
            <strong style="color: #283593;">🤖 AI Yorumu:</strong>
            <div style="margin-top: 6px; line-height: 1.7;">${kariyer.aiYorumu}</div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  return html;
}

// ───────────────────────────────────────────────
// TAB 3: MÜLAKAT SORULARI (AI'ın hazırladığı + derin sorular + not)
// ───────────────────────────────────────────────
export function sorularTabHTML(aday, analiz, mulakatNotu) {
  if (!analiz) return '<div class="kart"><p>AI analizi yok.</p></div>';
  
  const sorular = analiz.mulakatOnerileri || [];
  const derinSorular = analiz.derinSorular || [];
  const soruNotlari = mulakatNotu.soruNotlari || {};
  const derinSoruNotlari = mulakatNotu.derinSoruNotlari || {};
  
  let html = `
    <div class="kart">
      <h2>🎙️ Mülakat Soruları</h2>
      <p style="color: var(--gri);">
        AI'ın adayın cevaplarına dayalı olarak hazırladığı kişiselleştirilmiş sorular. 
        Mülakat sırasında her sorunun altına notlarınızı alabilirsiniz - otomatik kaydedilir.
      </p>
    </div>
  `;
  
  // Derin sorular (manipülasyon, tutarsızlık, kariyer)
  if (derinSorular.length > 0) {
    html += `<h3 style="color: var(--ana-yesil); margin: 24px 0 16px;">🔬 Yüzleştirme Soruları (Öncelikli)</h3>`;
    html += `<p style="color: var(--gri); font-size: 14px; margin-bottom: 12px;">
      Bu sorular adayın olası tutarsızlıklarını veya manipülasyon eğilimini test etmek için tasarlandı.
    </p>`;
    
    derinSorular.forEach((ds, idx) => {
      const kategori = ds.kategori || 'genel';
      const kategoriIkon = {
        'manipulasyon': '🔍',
        'tutarsizlik': '⚖️',
        'kariyer': '💼',
        'genel': '💬'
      }[kategori] || '💬';
      
      const kategoriMetin = {
        'manipulasyon': 'MANIPÜLASYON TESTİ',
        'tutarsizlik': 'TUTARSIZLIK YÜZLEŞTİRMESİ',
        'kariyer': 'KARİYER NETLEŞTİRMESİ',
        'genel': 'GENEL'
      }[kategori] || 'GENEL';
      
      const not = derinSoruNotlari[idx] || '';
      
      html += `
        <div class="derin-soru-kart kategori-${kategori}">
          <span class="kategori-rozet kategori-${kategori}">${kategoriIkon} ${kategoriMetin}</span>
          <div class="soru-metni">${ds.soru}</div>
          ${ds.sebep ? `<div class="sebep">💡 <strong>Neden bu soruyu sormalısınız:</strong> ${ds.sebep}</div>` : ''}
          <div class="not-alani">
            <label style="font-size: 13px; color: var(--gri); font-weight: 600; display: block; margin-bottom: 4px;">
              📝 Adayın cevabını ve gözlemlerinizi buraya yazın:
            </label>
            <textarea data-not-key="derinSoru_${idx}" placeholder="Adayın cevabı, vücut dili, samimiyet seviyesi...">${not}</textarea>
          </div>
        </div>
      `;
    });
  }
  
  // Genel mülakat soruları
  if (sorular.length > 0) {
    html += `<h3 style="color: var(--ana-yesil); margin: 32px 0 16px;">💬 Genel Mülakat Soruları</h3>`;
    html += `<p style="color: var(--gri); font-size: 14px; margin-bottom: 12px;">
      Adayın cevaplarına dayalı genel sorular.
    </p>`;
    
    sorular.forEach((s, idx) => {
      const not = soruNotlari[idx] || '';
      html += `
        <div class="derin-soru-kart">
          <span class="kategori-rozet kategori-genel">💬 GENEL SORU ${idx + 1}</span>
          <div class="soru-metni">${s}</div>
          <div class="not-alani">
            <label style="font-size: 13px; color: var(--gri); font-weight: 600; display: block; margin-bottom: 4px;">
              📝 Adayın cevabı ve gözlemleriniz:
            </label>
            <textarea data-not-key="soru_${idx}" placeholder="Adayın cevabı...">${not}</textarea>
          </div>
        </div>
      `;
    });
  }
  
  return html;
}

// ───────────────────────────────────────────────
// TAB 4: TÜM CEVAPLAR
// ───────────────────────────────────────────────
export function cevaplarTabHTML(cevaplar, kategoriId) {
  if (!cevaplar || Object.keys(cevaplar).length === 0) {
    return '<div class="kart"><p>Test cevabı bulunamadı.</p></div>';
  }
  
  // Test tipini bul ve soru haritasını oluştur (soru metinlerini göstermek için)
  const testTipi = testTipiBul(kategoriId || 'okulOncesiOgretmen');
  const soruHaritasi = soruHaritasiOlustur(testTipi);
  
  // Bölümlere göre grupla
  const gruplar = {
    'Kişilik (Big Five) + Sosyal Beğenirlik': { items: [], anahtar: 'k' },
    'Çocuk Değerleri + Kariyer Bağlılığı': { items: [], anahtar: 'd' },
    'Sınıf Senaryoları': { items: [], anahtar: 's' },
    'Açık Uçlu Hikayeler': { items: [], anahtar: 'h' },
    'Çocuk Koruma & Etik': { items: [], anahtar: 'e' },
    'Hızlı Tepkiler': { items: [], anahtar: 'r' }
  };
  
  Object.keys(cevaplar).forEach(soruId => {
    const cevap = cevaplar[soruId];
    Object.keys(gruplar).forEach(gAd => {
      if (soruId.startsWith(gruplar[gAd].anahtar)) {
        gruplar[gAd].items.push({ id: soruId, cevap });
      }
    });
  });
  
  let html = '';
  
  Object.keys(gruplar).forEach(grupAd => {
    const grup = gruplar[grupAd];
    if (grup.items.length === 0) return;
    
    html += `
      <div class="cevaplar-bolum">
        <h3>${grupAd} <span style="font-weight: normal; color: var(--gri); font-size: 14px;">(${grup.items.length} cevap)</span></h3>
    `;
    
    grup.items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    
    grup.items.forEach(({ id, cevap }) => {
      const soru = soruHaritasi[id];
      const soruMetni = soruMetniBul(soru);
      const cevapHTML = cevapMetniCozMr(soru, cevap);
      
      html += `
        <div class="cevap-item" style="display:block; padding:14px 16px; border:1px solid #ececec; border-radius:10px; margin-bottom:10px;">
          <div style="font-weight:600; color:#333; font-size:13px; margin-bottom:8px; line-height:1.5;">
            <span style="color:var(--ana-yesil); margin-right:4px;">${id.toUpperCase()}.</span>
            ${soruMetni || '<em style="color:#999; font-weight:400;">(Soru metni bulunamadı — aday eski test sürümünü çözmüş olabilir)</em>'}
          </div>
          <div class="cevap-icerik" style="font-size:13px; color:#444; padding-left:8px; border-left:3px solid #e3ede5;">
            ${cevapHTML}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  });
  
  return html;
}

// ───────────────────────────────────────────────
// TAB 5: NOT VE KARAR
// ───────────────────────────────────────────────
export function notTabHTML(aday, mulakatNotu) {
  const m = mulakatNotu || {};
  const sonAnaliz = m.mulakatSonuAnaliz || null;
  
  return `
    <!-- 🤖 MÜLAKAT SONU AI ANALİZİ -->
    <div class="kart" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 16px;">
      <h2 style="color: white; margin-bottom: 12px;">🤖 Mülakat Sonu AI Analizi</h2>
      <p style="color: rgba(255,255,255,0.9); margin-bottom: 16px; line-height: 1.7;">
        Mülakat notlarınızı yazdıktan sonra AI'ı çalıştırın. AI, test cevaplarını
        + mülakat cevaplarını + sizin gözlemlerinizi birleştirip 
        <strong style="color: white;">final karar</strong> önerisi sunacak.
      </p>
      
      <div style="background: rgba(255,255,255,0.15); padding: 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; line-height: 1.6;">
        <strong>📊 Analizde şunları göreceksiniz:</strong><br>
        ✓ Mülakat cevaplarının test ile <strong>tutarlılığı</strong><br>
        ✓ Manipülasyon eğiliminin <strong>doğrulanıp/çürütüldüğü</strong><br>
        ✓ Maaş beklentisinin <strong>piyasa değerlendirmesi</strong><br>
        ✓ Kariyer niyetinin gerçek hali<br>
        ✓ <strong>Final tavsiye</strong> (kabul / beklemede / red)
      </div>
      
      <button class="btn btn-buyuk" onclick="mulakatSonuAnalizYap()" 
              style="background: white; color: #764ba2; font-weight: 700;">
        🚀 ${sonAnaliz ? 'AI Analizini Yenile' : 'Mülakat Sonu AI Analizi Çalıştır'}
      </button>
      
      ${sonAnaliz ? `
        <div style="font-size: 12px; color: rgba(255,255,255,0.85); margin-top: 12px;">
          📅 Son analiz: ${m.mulakatSonuAnalizZamani ? tarihSaatFormatla(m.mulakatSonuAnalizZamani) : '-'}
        </div>
      ` : ''}
      
      <div id="mulakatSonuAnalizDurum"></div>
    </div>
    
    ${sonAnaliz ? mulakatSonuAnalizSonucHTML(sonAnaliz) : ''}
    
    <!-- KARAR PANELİ -->
    <div class="karar-paneli">
      <h2>⚖️ Final Kararı</h2>
      <p style="color: rgba(255,255,255,0.9); margin-bottom: 16px;">
        Tüm cevapları, AI analizini ve mülakat notlarınızı değerlendirip karar verin:
      </p>
      
      <div class="karar-secenekler">
        <button class="karar-btn" data-karar="kabul">
          <span class="ikon">🎉</span>
          <span class="baslik">KABUL ET</span>
          <span class="alt">Bu adayı işe almak istiyorum</span>
        </button>
        
        <button class="karar-btn" data-karar="beklemede">
          <span class="ikon">🤔</span>
          <span class="baslik">BEKLEMEDE</span>
          <span class="alt">Diğer adaylarla karşılaştırılmalı</span>
        </button>
        
        <button class="karar-btn" data-karar="red">
          <span class="ikon">❌</span>
          <span class="baslik">REDDET</span>
          <span class="alt">Bu pozisyon için uygun değil</span>
        </button>
      </div>
      
      ${m.kararZamani ? `
        <div style="text-align: center; margin-top: 16px; opacity: 0.8; font-size: 13px;">
          Son güncelleme: ${m.sonGuncelleme ? tarihSaatFormatla(m.sonGuncelleme) : 'şimdi'}
        </div>
      ` : ''}
    </div>
    
    <!-- GENEL İZLENİM -->
    <div class="not-grup">
      <h3>💭 Genel İzlenim</h3>
      <p style="color: var(--gri); font-size: 13px; margin-bottom: 8px;">
        Adayla ilgili genel izleniminiz, vücut dili, samimiyet, çekinmediği konular...
      </p>
      <textarea data-not-key="genelIzlenim" placeholder="Mülakatın başında nasıl bir izlenim bıraktı? Sonunda hisleriniz değişti mi?...">${m.genelIzlenim || ''}</textarea>
    </div>
    
    <!-- GÜÇLÜ YÖNLER -->
    <div class="not-grup">
      <h3>✨ Mülakatta Gözlemlediğiniz Güçlü Yönler</h3>
      <p style="color: var(--gri); font-size: 13px; margin-bottom: 8px;">
        Test sonuçlarındaki güçlü yönlere ek olarak, mülakatta keşfettikleriniz...
      </p>
      <textarea data-not-key="gozlenenGucluYonler" placeholder="Beklemediğim bir şekilde X konusunda çok rahat...">${m.gozlenenGucluYonler || ''}</textarea>
    </div>
    
    <!-- ENDİŞELERİNİZ -->
    <div class="not-grup">
      <h3>⚠️ Endişeleriniz / Çekinceleriniz</h3>
      <p style="color: var(--gri); font-size: 13px; margin-bottom: 8px;">
        Test'te kırmızı bayrak yoktu ama mülakatta hissettiğiniz çekinceler...
      </p>
      <textarea data-not-key="endiseler" placeholder="X konusunda biraz çekingen kaldı...">${m.endiseler || ''}</textarea>
    </div>
    
    <!-- KARARIN GEREKÇESİ -->
    <div class="not-grup">
      <h3>📋 Karar Gerekçesi</h3>
      <p style="color: var(--gri); font-size: 13px; margin-bottom: 8px;">
        Yukarıda verdiğiniz kararın somut gerekçesi - ileride gözden geçirmek için...
      </p>
      <textarea data-not-key="kararGerekcesi" placeholder="Bu adayı kabul/red/beklemede yapma sebebim...">${m.kararGerekcesi || ''}</textarea>
    </div>
    
    <!-- SONRAKİ ADIMLAR -->
    <div class="not-grup">
      <h3>🚀 Sonraki Adımlar</h3>
      <p style="color: var(--gri); font-size: 13px; margin-bottom: 8px;">
        Bu adayla ilgili yapılacaklar: ne zaman geri dönüş, hangi konular netleşmeli...
      </p>
      <textarea data-not-key="sonrakiAdimlar" placeholder="Pazartesi WhatsApp ile bilgi vereceğim, 2. tur mülakat ayarlanacak...">${m.sonrakiAdimlar || ''}</textarea>
    </div>
    
    <!-- 📧 MAIL GÖNDERME -->
    <div class="kart" style="background: linear-gradient(135deg, #ffefd5 0%, #fff8e7 100%); border-left: 4px solid #f57c00;">
      <h3 style="color: #e65100; margin-bottom: 12px;">📧 Adaya Sonuç Bildir</h3>
      <p style="color: var(--gri); font-size: 14px; line-height: 1.7; margin-bottom: 16px;">
        Karara göre adaya mail gönderebilirsiniz. <strong>Teklif</strong> veya 
        <strong>olumsuz dönüş</strong> maillerini özelleştirip yollayın.
      </p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <button class="btn" 
                onclick="teklifMailModalAc()"
                style="background: linear-gradient(135deg, #2c5530 0%, #4a7c59 100%); 
                       color: white; padding: 14px;">
          🎉 Teklif Maili Hazırla
        </button>
        
        <button class="btn" 
                onclick="olumsuzMailModalAc()"
                style="background: #f5f5f5; color: #555; padding: 14px;">
          📨 Havuza Al ve Bilgilendir
        </button>
      </div>
      
      ${m.sonGonderilenMail ? `
        <div style="margin-top: 14px; padding: 12px; background: white; border-radius: 8px; font-size: 13px;">
          📬 <strong>Son gönderilen mail:</strong> ${m.sonGonderilenMail.tip || '-'} 
          (${m.sonGonderilenMail.tarih ? tarihSaatFormatla(m.sonGonderilenMail.tarih) : '-'})
        </div>
      ` : ''}
    </div>
  `;
}

// ───────────────────────────────────────────────
// MÜLAKAT SONU ANALİZ SONUCU RENDER
// ───────────────────────────────────────────────
function mulakatSonuAnalizSonucHTML(sa) {
  if (!sa) return '';
  
  const skor = sa.guncellenmisSkor || 0;
  const degisim = sa.skorDegisimi || '';
  const tavsiye = sa.finalTavsiye || 'beklemede';
  
  const tavsiyeRenk = {
    'kabul': { bg: '#d4f5d4', renk: '#1b5e20', metin: '🎉 KABUL EDİLEBİLİR' },
    'beklemede': { bg: '#fff3e0', renk: '#e65100', metin: '🤔 BEKLEMEDE' },
    'red': { bg: '#ffebee', renk: '#c62828', metin: '❌ UYGUN DEĞİL' }
  }[tavsiye] || { bg: '#f5f5f5', renk: '#666', metin: '-' };
  
  const degisimRenk = degisim.startsWith('+') ? '#2c5530' : (degisim.startsWith('-') ? '#d32f2f' : '#666');
  
  let html = `
    <!-- AI SONUÇ KARTI -->
    <div class="kart" style="border: 2px solid #764ba2; background: linear-gradient(to right, #f5f0ff 0%, white 50%);">
      <h2 style="color: #764ba2; margin-bottom: 16px;">🤖 AI Mülakat Sonu Değerlendirmesi</h2>
      
      <!-- ÜST ŞERİT: Skor + Tavsiye -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        
        <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e0e0e0; text-align: center;">
          <div style="font-size: 12px; color: var(--gri); margin-bottom: 4px;">GÜNCEL SKOR</div>
          <div style="font-size: 42px; font-weight: 800; color: #764ba2; line-height: 1;">${skor}</div>
          <div style="font-size: 12px; color: var(--gri);">/ 100</div>
          ${degisim ? `<div style="font-size: 14px; font-weight: 700; color: ${degisimRenk}; margin-top: 6px;">
            ${degisim} puan değişim
          </div>` : ''}
        </div>
        
        <div style="background: ${tavsiyeRenk.bg}; padding: 20px; border-radius: 12px; text-align: center;">
          <div style="font-size: 12px; color: ${tavsiyeRenk.renk}; margin-bottom: 8px; font-weight: 600;">FİNAL TAVSİYE</div>
          <div style="font-size: 18px; font-weight: 800; color: ${tavsiyeRenk.renk}; margin-bottom: 8px;">
            ${tavsiyeRenk.metin}
          </div>
          ${sa.tavsiyeAciklama ? `<div style="font-size: 13px; color: ${tavsiyeRenk.renk}; line-height: 1.4;">
            ${sa.tavsiyeAciklama}
          </div>` : ''}
        </div>
      </div>
      
      <!-- TUTARLILIK ANALİZİ -->
      ${sa.tutarlilikAnalizi ? `
        <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 14px; border-left: 4px solid #1976d2;">
          <h4 style="color: #1976d2; margin-bottom: 10px;">⚖️ Tutarlılık Analizi</h4>
          <p style="line-height: 1.7; margin-bottom: 12px;">${sa.tutarlilikAnalizi.ozet || ''}</p>
          
          ${sa.tutarlilikAnalizi.tutarliNoktalar?.length ? `
            <div style="margin-top: 10px;">
              <strong style="color: #2c5530; font-size: 13px;">✓ Tutarlı Noktalar:</strong>
              <ul style="margin: 4px 0 0 0; padding-left: 20px;">
                ${sa.tutarlilikAnalizi.tutarliNoktalar.map(n => `<li style="margin-bottom: 4px;">${n}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${sa.tutarlilikAnalizi.tutarsizNoktalar?.length ? `
            <div style="margin-top: 10px;">
              <strong style="color: #d32f2f; font-size: 13px;">✗ Tutarsız Noktalar:</strong>
              <ul style="margin: 4px 0 0 0; padding-left: 20px;">
                ${sa.tutarlilikAnalizi.tutarsizNoktalar.map(n => `<li style="margin-bottom: 4px; color: #c62828;">${n}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      <!-- MANİPÜLASYON DEĞERLENDİRMESİ -->
      ${sa.manipulasyonDegerlendirmesi ? `
        <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 14px; border-left: 4px solid #f57c00;">
          <h4 style="color: #f57c00; margin-bottom: 8px;">🔍 Manipülasyon Doğrulaması</h4>
          <p style="line-height: 1.7;">${sa.manipulasyonDegerlendirmesi}</p>
        </div>
      ` : ''}
      
      <!-- KARİYER NİYETİ -->
      ${sa.kariyerNiyetiDegerlendirmesi ? `
        <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 14px; border-left: 4px solid #6a1b9a;">
          <h4 style="color: #6a1b9a; margin-bottom: 8px;">💼 Kariyer Niyeti Değerlendirmesi</h4>
          <p style="line-height: 1.7;">${sa.kariyerNiyetiDegerlendirmesi}</p>
        </div>
      ` : ''}
      
      <!-- MAAŞ DEĞERLENDİRMESİ -->
      ${sa.maasDegerlendirmesi ? `
        <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 14px; border-left: 4px solid #2c5530;">
          <h4 style="color: #2c5530; margin-bottom: 8px;">💰 Maaş Beklentisi Değerlendirmesi</h4>
          <p style="line-height: 1.7;">${sa.maasDegerlendirmesi}</p>
        </div>
      ` : ''}
      
      <!-- YENİ KIRMIZI BAYRAKLAR -->
      ${sa.yeniKirmiziBayraklar?.length ? `
        <div style="background: #ffebee; padding: 16px; border-radius: 10px; margin-bottom: 14px; border-left: 4px solid #d32f2f;">
          <h4 style="color: #d32f2f; margin-bottom: 8px;">🚨 Mülakatta Ortaya Çıkan Yeni Endişeler</h4>
          <ul style="margin: 0; padding-left: 20px;">
            ${sa.yeniKirmiziBayraklar.map(b => `<li style="margin-bottom: 6px; color: #c62828;">${b}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      <!-- YENİ GÜÇLÜ YÖNLER -->
      ${sa.yeniGucluYonler?.length ? `
        <div style="background: #e8f5e9; padding: 16px; border-radius: 10px; margin-bottom: 14px; border-left: 4px solid var(--ana-yesil);">
          <h4 style="color: var(--ana-yesil); margin-bottom: 8px;">✨ Mülakatta Keşfedilen Güçlü Yönler</h4>
          <ul style="margin: 0; padding-left: 20px;">
            ${sa.yeniGucluYonler.map(g => `<li style="margin-bottom: 6px;">${g}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      <!-- FİNAL KARAR -->
      ${sa.finalKarar ? `
        <div style="background: linear-gradient(135deg, #2c5530 0%, #4a7c59 100%); color: white; padding: 24px; border-radius: 12px;">
          <h3 style="color: white; margin-bottom: 12px;">📋 ${sa.finalKarar.baslik || 'FİNAL TAVSİYE'}</h3>
          <div style="line-height: 1.8; white-space: pre-wrap;">${sa.finalKarar.icerik || ''}</div>
          
          ${sa.finalKarar.dikkatEdilecekler?.length ? `
            <div style="margin-top: 16px; padding: 14px; background: rgba(255,255,255,0.15); border-radius: 8px;">
              <strong>⚠️ Eğer kabul edilirse dikkat edilecekler:</strong>
              <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                ${sa.finalKarar.dikkatEdilecekler.map(d => `<li style="margin-bottom: 4px;">${d}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
    </div>
  `;
  
  return html;
}

// ───────────────────────────────────────────────
// YARDIMCI FONKSIYONLAR
// ───────────────────────────────────────────────
export function cubukChart(etiket, skor, renk = '#2c5530') {
  return `
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 14px; font-weight: 500;">${etiket}</span>
        <span style="font-size: 14px; font-weight: 700; color: ${renk};">${skor}</span>
      </div>
      <div style="background: #f0f0f0; height: 10px; border-radius: 5px; overflow: hidden;">
        <div style="width: ${skor}%; height: 100%; background: ${renk}; border-radius: 5px;"></div>
      </div>
    </div>
  `;
}

function manipulasyonGosterge(etiket, skor, seviye) {
  // Yüksek skor = kötü (manipülasyon var)
  let renk;
  if (seviye === 'yuksek') renk = '#d32f2f';
  else if (seviye === 'orta') renk = '#f57c00';
  else renk = '#2c5530';
  
  const seviyeMetin = { 'yuksek': '⚠️ Yüksek', 'orta': '🟡 Orta', 'dusuk': '✅ Düşük' }[seviye] || '-';
  
  return `
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 14px; font-weight: 500;">${etiket}</span>
        <span style="font-size: 13px; font-weight: 700; color: ${renk};">${seviyeMetin} (%${skor || 0})</span>
      </div>
      <div style="background: #f0f0f0; height: 10px; border-radius: 5px; overflow: hidden;">
        <div style="width: ${skor || 0}%; height: 100%; background: ${renk}; border-radius: 5px;"></div>
      </div>
      <div style="font-size: 11px; color: var(--gri); margin-top: 2px;">
        Düşük = samimi cevap | Yüksek = idealize ediyor
      </div>
    </div>
  `;
}

function baglılıkGosterge(etiket, skor, seviye) {
  // Yüksek skor = iyi (bağlılık yüksek)
  let renk;
  if (seviye === 'yuksek') renk = '#2c5530';
  else if (seviye === 'orta') renk = '#f57c00';
  else renk = '#d32f2f';
  
  const seviyeMetin = { 'yuksek': '✅ Yüksek', 'orta': '🟡 Orta', 'dusuk': '⚠️ Düşük' }[seviye] || '-';
  
  return `
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 14px; font-weight: 500;">${etiket}</span>
        <span style="font-size: 13px; font-weight: 700; color: ${renk};">${seviyeMetin} (%${skor || 0})</span>
      </div>
      <div style="background: #f0f0f0; height: 10px; border-radius: 5px; overflow: hidden;">
        <div style="width: ${skor || 0}%; height: 100%; background: ${renk}; border-radius: 5px;"></div>
      </div>
      <div style="font-size: 11px; color: var(--gri); margin-top: 2px;">
        Adayın kuruma uzun vadeli bağlanma niyeti
      </div>
    </div>
  `;
}
