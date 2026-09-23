import { devamHataMetni, devamServisiOlustur } from './personel-devam-callable.js';

// Giriş, çıkış ve mola kaydını sunucu (personelDevamKomutV1) yazar. QR jetonu,
// okul konumu, saat ve durum geçişi sunucuda doğrulanır; tarayıcı yalnız okunan
// QR metnini ve o anki konumu gönderir. Tam konum hiçbir yerde saklanmaz.
const QR_BICIMI = 'ZEKY-DEVAM';
const TARAYICI_KAYNAGI = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
const ETIKET = { giris: 'Giriş', cikis: 'Çıkış', 'mola-basla': 'Mola başlangıcı', 'mola-bitir': 'Mola bitişi' };
const FUNCTIONS_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

export function qrCoz(metin) {
  const parcalar = String(metin || '').trim().split(':');
  if (parcalar.length !== 3 || parcalar[0] !== QR_BICIMI || !parcalar[1] || !parcalar[2]) return null;
  return { okulId: parcalar[1], jeton: parcalar[2] };
}

export function devamDurumu(hareketler) {
  return [...(hareketler || [])]
    .sort((a, b) => new Date(a.zaman) - new Date(b.zaman))
    .reduce((durum, hareket) => {
      if (hareket.tip === 'giris' || hareket.tip === 'mola-bitir') return 'iceride';
      if (hareket.tip === 'cikis') return 'disarida';
      if (hareket.tip === 'mola-basla') return 'molada';
      return durum;
    }, 'disarida');
}

function bugunKodu() {
  const d = new Date();
  const iki = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
}

let servisSozu = null;
function devamServisi() {
  if (!servisSozu) {
    servisSozu = (async () => {
      const [{ guvenliFunctionsGetir }, { httpsCallable }] = await Promise.all([
        import('./zeky-randevu-cutover-runtime.js'),
        import(FUNCTIONS_SDK)
      ]);
      return devamServisiOlustur({ functions: await guvenliFunctionsGetir(), httpsCallable });
    })().catch(hata => { servisSozu = null; throw hata; });
  }
  return servisSozu;
}

function kutuphaneYukle() {
  if (window.Html5Qrcode) return Promise.resolve();
  if (window.__personelQrKutuphane) return window.__personelQrKutuphane;
  window.__personelQrKutuphane = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TARAYICI_KAYNAGI;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('QR kamera bileşeni yüklenemedi.'));
    document.head.appendChild(script);
  });
  return window.__personelQrKutuphane;
}

function konumAl() {
  if (!window.isSecureContext || !navigator.geolocation) {
    return Promise.reject(new Error('Konum doğrulaması bu tarayıcıda kullanılamıyor.'));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({
        enlem: p.coords.latitude,
        boylam: p.coords.longitude,
        dogrulukMetre: p.coords.accuracy
      }),
      () => reject(new Error('Konum alınamadı. Konum iznini açıp tekrar deneyin.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function modalOlustur() {
  document.getElementById('personelQrModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'personelQrModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <style>
      #personelQrModal{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:18px}
      #personelQrModal .pqr-kart{width:min(440px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#fff;border-radius:22px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.3)}
      #personelQrModal .pqr-ust{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
      #personelQrModal .pqr-baslik{flex:1;font-size:18px;font-weight:800;color:#1f2544}
      #personelQrModal .pqr-alt{font-size:12px;color:#64748b;margin-top:3px}
      #personelQrModal .pqr-kapat{border:0;background:#f1f5f9;border-radius:10px;width:38px;height:38px;font-size:22px;cursor:pointer;color:#475569}
      #personelQrOkuyucu{overflow:hidden;border-radius:16px;background:#0f172a;min-height:245px}
      #personelQrDurum{margin-top:12px;padding:11px 13px;border-radius:12px;background:#f8fafc;color:#475569;font-size:12.5px;line-height:1.45}
      #personelQrModal .pqr-not{margin-top:10px;font-size:11px;color:#94a3b8;line-height:1.45}
    </style>
    <div class="pqr-kart">
      <div class="pqr-ust">
        <div><div class="pqr-baslik">Okul QR’ını okutun</div><div class="pqr-alt">Giriş ve çıkış yalnız kamera + okul konumu ile kaydedilir.</div></div>
        <button class="pqr-kapat" type="button" aria-label="Kapat">×</button>
      </div>
      <div id="personelQrOkuyucu"></div>
      <div id="personelQrDurum">Kamera hazırlanıyor…</div>
      <div class="pqr-not">QR görseli yükleme kapalıdır. Konum izni verilmezse veya okul alanı dışındaysanız kayıt oluşturulmaz.</div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function durumYaz(metin, hata = false) {
  const el = document.getElementById('personelQrDurum');
  if (!el) return;
  el.textContent = metin;
  el.style.background = hata ? '#FEF2F2' : '#F0FDF4';
  el.style.color = hata ? '#B91C1C' : '#166534';
}

async function bugunkuHareketler(api, email) {
  const { collection, getDocs, query, where } = api.fb;
  const sonuc = await getDocs(query(collection(api.db, 'puantaj'),
    where('personelEmail', '==', email), where('tarih', '==', bugunKodu())));
  const hareketler = [];
  sonuc.forEach(d => hareketler.push(d.data()));
  return hareketler;
}

async function tarayiciyiDurdur(tarayici) {
  if (!tarayici) return;
  try { if (tarayici.isScanning) await tarayici.stop(); } catch (_) {}
  try { await tarayici.clear(); } catch (_) {}
}

export function portalQrDevamKur(api = window.PortalAPI) {
  if (!api || window.__portalQrDevamKuruldu) return false;
  if (typeof window.devamKartiCiz !== 'function' || typeof window.devamKaydet !== 'function') return false;
  window.__portalQrDevamKuruldu = true;

  const asilKartCiz = window.devamKartiCiz;
  let tarayici = null;
  let gonderiliyor = false;

  function ekranlariTazele() {
    if (typeof window.ozetDevamKartiDoldur === 'function' && document.getElementById('ozetDevamKart')) {
      window.ozetDevamKartiDoldur();
    }
    if (typeof window.profilimRender === 'function' && document.getElementById('devamKartAlan')) window.profilimRender();
    if (typeof window.hbOgretmenDoldur === 'function') setTimeout(window.hbOgretmenDoldur, 300);
  }

  async function sunucuyaGonder(islem, ek) {
    const servis = await devamServisi();
    const sonuc = await servis.gonder(islem, 'portal', ek);
    const saat = new Date(sonuc.zaman).toTimeString().slice(0, 5);
    api.toast(`✓ ${ETIKET[islem] || islem} kaydedildi · ${saat}`);
    ekranlariTazele();
    return sonuc;
  }

  // Mola düğmeleri de sunucudan geçer; giriş/çıkış yalnız QR ile yapılır.
  window.devamKaydet = async function(tip) {
    if (tip === 'giris' || tip === 'cikis') {
      api.toast('Giriş ve çıkış için okul QR’ını kamerayla okutmalısınız.', 'error');
      return;
    }
    if (gonderiliyor) return;
    gonderiliyor = true;
    try {
      await sunucuyaGonder(tip);
    } catch (hata) {
      api.toast(devamHataMetni(hata), 'error');
      ekranlariTazele();
    } finally {
      gonderiliyor = false;
    }
  };

  function qrButonunaCevir(hedefId) {
    const alan = document.getElementById(hedefId || 'devamKartAlan');
    if (!alan) return;
    alan.querySelectorAll('button[onclick*="devamKaydet(\'giris\')"],button[onclick*="devamKaydet(\'cikis\')"]').forEach(btn => btn.remove());
    const dugmeler = alan.querySelector('div[style*="display:flex"][style*="gap:8px"]');
    if (!dugmeler || dugmeler.querySelector('[data-personel-qr]')) return;
    const qr = document.createElement('button');
    qr.type = 'button';
    qr.dataset.personelQr = '1';
    qr.className = 'btn-mini';
    qr.style.cssText = 'flex:1;min-width:140px;padding:12px;font-weight:800;background:#2D5E3E;color:#fff;border-color:#2D5E3E;';
    qr.innerHTML = '<i data-lucide="scan-line" style="width:16px;height:16px;vertical-align:-3px"></i> QR ile Giriş / Çıkış';
    qr.onclick = () => window.personelQrDevamAc();
    dugmeler.prepend(qr);
    api.lucide();
  }

  window.devamKartiCiz = function(veri, hedefId) {
    const sonuc = asilKartCiz(veri, hedefId);
    qrButonunaCevir(hedefId);
    return sonuc;
  };

  window.personelQrDevamAc = async function() {
    const email = String(api.state.currentUser?.email || '').toLowerCase();
    if (!email) return api.toast('Personel oturumu bulunamadı.', 'error');

    let hareketler;
    try {
      hareketler = await bugunkuHareketler(api, email);
    } catch (e) {
      return api.toast('Devam bilgisi alınamadı: ' + (e.code || e.message), 'error');
    }
    const durum = devamDurumu(hareketler);
    if (durum === 'molada') return api.toast('Çıkıştan önce “Moladan Dön” butonuna basın.', 'error');
    const tip = durum === 'disarida' ? 'giris' : 'cikis';
    const modal = modalOlustur();
    let kapandi = false;
    const kapat = async () => {
      if (kapandi) return;
      kapandi = true;
      await tarayiciyiDurdur(tarayici);
      tarayici = null;
      modal.remove();
    };
    modal.querySelector('.pqr-kapat').onclick = kapat;
    modal.onclick = e => { if (e.target === modal) kapat(); };

    try {
      await kutuphaneYukle();
      tarayici = new window.Html5Qrcode('personelQrOkuyucu', { verbose: false });
      durumYaz(`Kamera açık · ${tip === 'giris' ? 'giriş' : 'çıkış'} için QR bekleniyor`);
      let isleniyor = false;
      await tarayici.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 }, aspectRatio: 1 },
        async metin => {
          if (isleniyor) return;
          isleniyor = true;
          if (!qrCoz(metin)) {
            durumYaz('Bu QR, okulun giriş-çıkış QR’ı değil.', true);
            setTimeout(() => { isleniyor = false; }, 1500);
            return;
          }
          durumYaz('QR okundu. Konum alınıyor…');
          await tarayiciyiDurdur(tarayici);
          let konum;
          try {
            konum = await konumAl();
          } catch (e) {
            durumYaz(e.message || 'Konum alınamadı. Kayıt yapılmadı.', true);
            return;
          }
          durumYaz('Okul sunucusu QR ve konumu doğruluyor…');
          try {
            await sunucuyaGonder(tip, { qr: metin, konum });
            await kapat();
          } catch (e) {
            durumYaz(devamHataMetni(e), true);
          }
        },
        () => {}
      );
    } catch (e) {
      durumYaz('Kamera açılamadı. Tarayıcı kamera iznini kontrol edin.', true);
    }
  };

  document.querySelectorAll('#ozetDevamKart,#devamKartAlan').forEach(el => qrButonunaCevir(el.id));
  return true;
}

function otomatikKur() {
  let deneme = 0;
  const zamanlayici = setInterval(() => {
    deneme++;
    if (portalQrDevamKur(window.PortalAPI) || deneme > 200) clearInterval(zamanlayici);
  }, 100);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') otomatikKur();
