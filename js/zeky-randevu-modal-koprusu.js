// =====================================================================
// zeky-randevu-modal-koprusu.js
//
// AMAC
//   Portalin eski randevu popup'ini (caRandevuTalepAc) yeni guvenli
//   callable backend'e baglar. Arayuz eskisi gibi kalir; sadece veri
//   kaynagi ve yazma yolu degisir.
//
//   ESKI: veli istedigi saati secer, tarayici dogrudan randevuSlotlari
//         koleksiyonuna yazardi. Bu yol Firestore kurallariyla kapatildi.
//   YENI: hedefler ve saatler randevuSorguV3'ten gelir, talep
//         randevuKomutV3 uzerinden olusturulur. Gun ve saatler okulun
//         onceden tanimladigi musaitliklerden secilir.
//
//   Korunanlar: yonetime Brevo maili, yonetime uygulama ici bildirim,
//   gorusme konusu notu, eski modal gorunumu.
//
// YUKLEME
//   index.html icinde </body> oncesine:
//   <script type="module" src="./js/zeky-randevu-modal-koprusu.js"></script>
//
//   Modul yuklenince window.zekyRandevuApi hazir olur ve eski
//   caRandevuTalepAc / caRandevuTalepGonder fonksiyonlarinin yerine
//   callable surumleri gecer.
// =====================================================================

import {
  callableCutoverAcikMi, randevuServisiGetir, istekIzleyiciOlustur,
  guvenliId, gunAnahtari, zamanYazi
} from './zeky-randevu-cutover-runtime.js';
import { veliOdemeOzetiHesapla } from './zeky-veli-odeme-ozeti.js?v=1';
import './zeky-galeri-filigran-koprusu.js?v=6';
import './zeky-gozlem-modal-modern.js?v=1';

const istekler = istekIzleyiciOlustur();
let apiOnbellek = null;

async function api() {
  if (!apiOnbellek) apiOnbellek = await randevuServisiGetir();
  return apiOnbellek;
}

// Eski modaldaki hedef turleri. Yeni backend ayni tip adlarini kullanir:
// pdr, ogretmen_veli, idare. Eski listedeki "diger" turunun karsiligi yok.
const TURLER = [
  { tip: 'ogretmen_veli', ad: 'Sınıf Öğretmeni', ikon: 'user',
    aciklama: 'Sınıf içi gelişim ve günlük durum' },
  { tip: 'pdr', ad: 'PDR / Rehberlik', ikon: 'brain',
    aciklama: 'Gelişim, davranış, uyum konuları' },
  { tip: 'idare', ad: 'Müdür / İdare', ikon: 'briefcase',
    aciklama: 'Kayıt, ücret, genel konular' }
];

const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function gunEtiketi(millis) {
  const d = new Date(millis);
  return d.getDate() + ' ' + AY[d.getMonth()] + ' ' + GUN[d.getDay()];
}

function kacar(metin) {
  return String(metin == null ? '' : metin)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Modal durumu ────────────────────────────────────────────────────
const S = {
  ogrenciId: '', tip: '', hedefKodu: '', slotKodu: '',
  hedefler: [], saatler: [], mesgul: false
};

function kapat() {
  const el = document.getElementById('caRandevuArka');
  if (el) el.remove();
}

function ikonlariYenile() {
  if (window.lucideYenile) setTimeout(window.lucideYenile, 40);
}

function mesaj(metin, hata) {
  const el = document.getElementById('caRandevuMesaj');
  if (!el) return;
  el.textContent = metin || '';
  el.hidden = !metin;
  el.style.background = hata ? '#FEF2F2' : '#F0FDF4';
  el.style.color = hata ? '#991B1B' : '#166534';
}

function hataMetni(error) {
  const kod = String(error?.code || '');
  if (kod.includes('permission-denied')) return 'Bu işlem için yetkiniz yok.';
  if (kod.includes('failed-precondition')) return 'Randevu bilgileri hazır değil.';
  if (kod.includes('unauthenticated')) return 'Oturum doğrulanamadı, sayfayı yenileyin.';
  if (kod.includes('aborted')) return 'Bu saat az önce doldu, başka saat seçin.';
  if (kod.includes('not-found')) return 'Görüşülecek kişi şu anda uygun değil.';
  return 'Talep gönderilemedi, lütfen tekrar deneyin.';
}

// ── Cizim ───────────────────────────────────────────────────────────
function turleriCiz() {
  const kap = document.getElementById('caRandevuTurler');
  if (!kap) return;
  kap.innerHTML = TURLER.map(t => `
    <button type="button" data-tip="${t.tip}"
      style="display:flex; align-items:center; gap:11px; text-align:left; padding:11px 13px;
             border:2px solid ${t.tip === S.tip ? '#2D5E3E' : '#E2E8F0'}; background:#fff;
             border-radius:12px; cursor:pointer; font-family:inherit;">
      <span style="width:34px; height:34px; flex-shrink:0; border-radius:10px; background:#ECFDF5;
                   color:#2D5E3E; display:flex; align-items:center; justify-content:center;">
        <i data-lucide="${t.ikon}" style="width:16px;height:16px;"></i></span>
      <span style="flex:1;">
        <span style="display:block; font-weight:700; font-size:13.5px; color:#1E293B;">${kacar(t.ad)}</span>
        <span style="display:block; font-size:11.5px; color:#64748B; margin-top:1px;">${kacar(t.aciklama)}</span>
      </span>
    </button>`).join('');
  for (const btn of kap.querySelectorAll('button')) {
    btn.addEventListener('click', () => turSec(btn.dataset.tip));
  }
  ikonlariYenile();
}

function hedefleriCiz() {
  const kap = document.getElementById('caRandevuKisiler');
  const bolum = document.getElementById('caRandevuKisiBolum');
  if (!kap || !bolum) return;
  if (!S.hedefler.length) { bolum.hidden = true; return; }
  bolum.hidden = false;
  kap.innerHTML = S.hedefler.map(h => `
    <button type="button" data-kod="${kacar(h.kod)}"
      style="padding:9px 14px; border:2px solid ${h.kod === S.hedefKodu ? '#2D5E3E' : '#E2E8F0'};
             background:${h.kod === S.hedefKodu ? '#2D5E3E' : '#fff'};
             color:${h.kod === S.hedefKodu ? '#fff' : '#1E293B'};
             border-radius:20px; cursor:pointer; font-family:inherit;
             font-weight:700; font-size:13px;">${kacar(h.ad)}</button>`).join('');
  for (const btn of kap.querySelectorAll('button')) {
    btn.addEventListener('click', () => hedefSec(btn.dataset.kod));
  }
}

function saatleriCiz() {
  const kap = document.getElementById('caRandevuSaatler');
  const bolum = document.getElementById('caRandevuSaatBolum');
  if (!kap || !bolum) return;
  if (!S.hedefKodu) { bolum.hidden = true; return; }
  bolum.hidden = false;
  if (!S.saatler.length) {
    kap.innerHTML = `<div style="padding:14px; background:#F8FAFC; border-radius:11px;
      color:#64748B; font-size:13px;">Bu kişi için şu anda açık saat yok.
      Okul yeni saat tanımladığında burada görünecek.</div>`;
    return;
  }
  // Gune gore grupla
  const gunler = new Map();
  for (const saat of S.saatler) {
    const ms = Number(saat.baslangicMillis);
    if (!Number.isSafeInteger(ms)) continue;
    const anahtar = gunAnahtari(ms);
    if (!gunler.has(anahtar)) gunler.set(anahtar, { ms, saatler: [] });
    gunler.get(anahtar).saatler.push(saat);
  }
  kap.innerHTML = [...gunler.values()].map(grup => `
    <div style="margin-bottom:13px;">
      <div style="font-size:12px; font-weight:800; color:#2D5E3E; margin-bottom:7px;">
        ${kacar(gunEtiketi(grup.ms))}</div>
      <div style="display:flex; flex-wrap:wrap; gap:7px;">
        ${grup.saatler.map(s => `
          <button type="button" data-slot="${kacar(s.slotKodu)}"
            style="padding:9px 15px; border:2px solid ${s.slotKodu === S.slotKodu ? '#2D5E3E' : '#E2E8F0'};
                   background:${s.slotKodu === S.slotKodu ? '#2D5E3E' : '#fff'};
                   color:${s.slotKodu === S.slotKodu ? '#fff' : '#1E293B'};
                   border-radius:11px; cursor:pointer; font-family:inherit;
                   font-weight:700; font-size:13.5px;">
            ${kacar(zamanYazi(Number(s.baslangicMillis)))}</button>`).join('')}
      </div>
    </div>`).join('');
  for (const btn of kap.querySelectorAll('button[data-slot]')) {
    btn.addEventListener('click', () => { S.slotKodu = btn.dataset.slot; saatleriCiz(); gonderDurumu(); });
  }
  gonderDurumu();
}

function gonderDurumu() {
  const btn = document.getElementById('caRandevuGonderBtn');
  if (btn) btn.disabled = S.mesgul || !S.slotKodu;
}

// ── Secim akisi ─────────────────────────────────────────────────────
async function turSec(tip) {
  if (S.mesgul || !TURLER.some(t => t.tip === tip)) return;
  S.tip = tip; S.hedefKodu = ''; S.slotKodu = '';
  S.hedefler = []; S.saatler = [];
  turleriCiz(); hedefleriCiz(); saatleriCiz();
  mesaj('');
  try {
    const servis = await api();
    const rows = await servis.hedefleriGetir(S.ogrenciId, tip);
    if (S.tip !== tip) return;
    S.hedefler = rows.filter(r => guvenliId(r.kod) && typeof r.ad === 'string');
    hedefleriCiz();
    if (S.hedefler.length === 1) await hedefSec(S.hedefler[0].kod);
    else if (!S.hedefler.length) mesaj('Bu tür için görüşülecek kişi bulunamadı.', true);
  } catch (error) {
    mesaj(hataMetni(error), true);
  }
}

async function hedefSec(kod) {
  if (S.mesgul || !S.hedefler.some(h => h.kod === kod)) return;
  S.hedefKodu = kod; S.slotKodu = ''; S.saatler = [];
  hedefleriCiz(); saatleriCiz(); mesaj('');
  try {
    const servis = await api();
    const rows = await servis.saatleriGetir(S.ogrenciId, kod, S.tip);
    if (S.hedefKodu !== kod) return;
    S.saatler = rows.filter(r => guvenliId(r.slotKodu, 240) &&
      Number.isSafeInteger(Number(r.baslangicMillis)));
    saatleriCiz();
  } catch (error) {
    mesaj(hataMetni(error), true);
  }
}

// ── Modal ───────────────────────────────────────────────────────────
function modalAc(ogrenciId) {
  kapat();
  S.ogrenciId = ogrenciId; S.tip = ''; S.hedefKodu = ''; S.slotKodu = '';
  S.hedefler = []; S.saatler = []; S.mesgul = false;

  const div = document.createElement('div');
  div.id = 'caRandevuArka';
  div.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:9500;' +
    'display:flex; align-items:center; justify-content:center; padding:20px;';
  div.innerHTML = `
    <div style="background:#fff; border-radius:20px; max-width:460px; width:100%;
                padding:22px; max-height:90vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <h3 style="margin:0; font-family:var(--c-font-head,inherit); font-size:18px;">Randevu Talebi</h3>
        <button id="caRandevuKapat" style="border:none; background:transparent; font-size:24px;
          color:#94A3B8; cursor:pointer; line-height:1;">&times;</button>
      </div>
      <div style="font-size:12.5px; color:#64748B; margin-bottom:16px; line-height:1.5;">
        Talebiniz okula iletilir. Onaylandığında size bildirim gönderilir ve
        randevuyu takviminize ekleyebilirsiniz.</div>

      <div id="caRandevuMesaj" hidden style="padding:11px 13px; border-radius:11px;
        font-size:13px; margin-bottom:14px;"></div>

      <label style="display:block; font-size:12px; font-weight:700; color:#64748B;
        text-transform:uppercase; letter-spacing:.4px; margin-bottom:7px;">
        Kiminle görüşmek istiyorsunuz?</label>
      <div id="caRandevuTurler" style="display:grid; gap:8px; margin-bottom:16px;"></div>

      <div id="caRandevuKisiBolum" hidden style="margin-bottom:16px;">
        <label style="display:block; font-size:12px; font-weight:700; color:#64748B;
          text-transform:uppercase; letter-spacing:.4px; margin-bottom:7px;">Görüşülecek kişi</label>
        <div id="caRandevuKisiler" style="display:flex; flex-wrap:wrap; gap:7px;"></div>
      </div>

      <div id="caRandevuSaatBolum" hidden style="margin-bottom:16px;">
        <label style="display:block; font-size:12px; font-weight:700; color:#64748B;
          text-transform:uppercase; letter-spacing:.4px; margin-bottom:7px;">Uygun gün ve saatler</label>
        <div id="caRandevuSaatler"></div>
      </div>

      <label style="display:block; font-size:12px; font-weight:700; color:#64748B;
        text-transform:uppercase; letter-spacing:.4px; margin-bottom:5px;">
        Görüşme konusu <span style="font-weight:500; text-transform:none; letter-spacing:0;">(isteğe bağlı)</span></label>
      <textarea id="caRandevuNot" rows="3" maxlength="1000" placeholder="Kısaca konuyu yazabilirsiniz…"
        style="width:100%; padding:10px 12px; border:1px solid #E2E8F0; border-radius:10px;
               font-family:inherit; font-size:13.5px; resize:vertical;"></textarea>

      <div style="display:flex; gap:9px; justify-content:flex-end; margin-top:18px;">
        <button id="caRandevuVazgec" style="padding:11px 18px; border:1px solid #E2E8F0;
          background:#fff; border-radius:11px; cursor:pointer; font-family:inherit; font-weight:600;">Vazgeç</button>
        <button id="caRandevuGonderBtn" disabled style="padding:11px 22px; border:none;
          background:#2D5E3E; color:#fff; border-radius:11px; cursor:pointer;
          font-family:inherit; font-weight:700;">Talep Gönder</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('caRandevuKapat').addEventListener('click', kapat);
  document.getElementById('caRandevuVazgec').addEventListener('click', kapat);
  document.getElementById('caRandevuGonderBtn').addEventListener('click', gonder);
  turleriCiz();
  turSec(TURLER[0].tip);
}

// ── Gonderme ────────────────────────────────────────────────────────
async function gonder() {
  if (S.mesgul || !S.slotKodu) return;
  const btn = document.getElementById('caRandevuGonderBtn');
  const not = (document.getElementById('caRandevuNot')?.value || '').trim();
  const secilenSaat = S.saatler.find(s => s.slotKodu === S.slotKodu);
  const hedef = S.hedefler.find(h => h.kod === S.hedefKodu);

  S.mesgul = true; btn.disabled = true; btn.textContent = 'Gönderiliyor…';
  mesaj('');
  const payload = `${S.ogrenciId}|${S.hedefKodu}|${S.slotKodu}|${not}`;
  const requestId = istekler.anahtar('create_parent', S.ogrenciId, payload);
  try {
    const servis = await api();
    await servis.veliRandevuOlustur({
      requestId, ogrenciId: S.ogrenciId, hedefKodu: S.hedefKodu,
      slotKodu: S.slotKodu, not
    });
    istekler.tamamla('create_parent', S.ogrenciId, payload);

    // Yonetim bilgilendirmeleri. Randevu zaten olustu; bunlar basarisiz
    // olsa bile talep gecerlidir, o yuzden hatalari yutuyoruz.
    try {
      await window.zekyRandevuYonetimeBildir?.({
        hedefAd: hedef?.ad || '', not,
        baslangicMillis: Number(secilenSaat?.baslangicMillis || 0)
      });
    } catch (e) { console.warn('randevu bildirimi', e?.message); }

    kapat();
    if (typeof window.showToast === 'function') {
      window.showToast('Randevu talebiniz iletildi', 'success');
    }
    if (typeof window.caHomeRandevulariDoldur === 'function') {
      try { window.caHomeRandevulariDoldur(); } catch (e) { /* liste sonra yenilenir */ }
    }
  } catch (error) {
    mesaj(hataMetni(error), true);
    btn.textContent = 'Talep Gönder';
  } finally {
    S.mesgul = false; gonderDurumu();
  }
}

// ── Disari acilan yuzey ─────────────────────────────────────────────
window.zekyRandevuApi = Object.freeze({ api, modalAc });

// Eski cagri noktasini devral. Aktif ogrenci portalin kendi
// degiskeninden okunur; yoksa callable'dan ilk cocuk alinir.
window.caRandevuTalepAc = async function () {
  if (!callableCutoverAcikMi()) {
    if (typeof window.showToast === 'function') {
      window.showToast('Randevu sistemi şu anda kapalı', 'error');
    }
    return;
  }
  let ogrenciId = '';
  try {
    const aktif = window.veliAktifOgrenci;
    if (aktif && guvenliId(aktif.id)) ogrenciId = aktif.id;
  } catch (e) { /* asagida callable'dan alinir */ }
  if (!ogrenciId) {
    try {
      const servis = await api();
      const cocuklar = await servis.veliOgrencileri();
      ogrenciId = cocuklar[0]?.id || '';
    } catch (error) {
      if (typeof window.showToast === 'function') {
        window.showToast('Randevu bilgileri alınamadı', 'error');
      }
      return;
    }
  }
  if (!ogrenciId) {
    if (typeof window.showToast === 'function') {
      window.showToast('Randevuya açık öğrenci kaydı bulunamadı', 'error');
    }
    return;
  }
  modalAc(ogrenciId);
};

// ── Veli ana sayfasındaki ödeme özeti ──────────────────────────────
// Ana sayfanın HTML iskeleti eski görünümü korur. Bu köprü, kart ekrana
// geldiğinde yalnızca oturumdaki velinin seçili çocuğuna ait dönem belgesini
// okur ve demo tutarı gerçek ödeme özetiyle değiştirir. Firestore kuralları
// başka bir veliye ait öğrenci belgesinin okunmasına ayrıca izin vermez.
const ODEME_GORUNUMLERI = Object.freeze({
  plansiz:     { arkaPlan: '#fff', renk: 'var(--c-purple-deep)' },
  tamamlandi: { arkaPlan: '#DFF4E3', renk: 'var(--c-green-deep)' },
  odendi:      { arkaPlan: '#DFF4E3', renk: 'var(--c-green-deep)' },
  kismi:       { arkaPlan: 'var(--c-yellow-soft)', renk: '#8a6d1a' },
  bekliyor:    { arkaPlan: '#fff', renk: 'var(--c-purple-deep)' },
  gecikmis:    { arkaPlan: '#FFE3E9', renk: 'var(--c-pink-deep)' }
});

let odemeKartIstekNo = 0;
let odemeKartGuncellemePlanli = false;

function odemeKartiniYaz(kart, ozet) {
  const gorunum = ODEME_GORUNUMLERI[ozet.durum] || ODEME_GORUNUMLERI.bekliyor;
  const tutar = ozet.tutar === null
    ? '—'
    : `₺${Math.round(ozet.tutar).toLocaleString('tr-TR')}`;
  kart.style.border = ozet.durum === 'gecikmis' ? '1px solid #f9a8d4' : '';
  kart.innerHTML = `
    <div class="ca-row" style="justify-content:space-between;">
      <span class="ca-pill" style="background:var(--c-purple-deep); color:#fff;">
        <i data-lucide="credit-card" style="width:13px;height:13px;vertical-align:-2px;"></i>
        ${kacar(ozet.baslik)}
      </span>
      <span class="ca-pill" style="background:${gorunum.arkaPlan}; color:${gorunum.renk};">${kacar(ozet.rozet)}</span>
    </div>
    <div class="ca-row" style="justify-content:space-between; margin-top:12px; align-items:flex-end;">
      <div>
        <div class="ca-head" style="font-size:22px;">${tutar}</div>
        <div class="ca-tile-sub">${kacar(ozet.aciklama)}</div>
      </div>
      <button type="button" class="ca-btn" data-zeky-odeme-detay style="background:var(--c-purple-deep);">${kacar(ozet.eylem)}</button>
    </div>`;
  kart.querySelector('[data-zeky-odeme-detay]')?.addEventListener('click', () => {
    if (typeof window.veliSwitchTab === 'function') window.veliSwitchTab('odemeler');
  });
  kart.dataset.zekyOdemeDurum = 'hazir';
  if (window.lucideYenile) window.lucideYenile();
}

async function veliOdemeKartiniGuncelle() {
  const kart = document.querySelector('.ca-page .ca-pay');
  const portal = window.PortalAPI;
  const durum = portal?.state || {};
  const ogrenciId = String(durum.veliAktifOgrenci?.id || '');
  const donem = String(durum.aktifDonem || '');
  if (!kart || !portal?.db || !portal?.fb?.doc || !portal?.fb?.getDoc || !guvenliId(ogrenciId) || !donem) return;

  const anahtar = `${ogrenciId}|${donem}`;
  if (kart.dataset.zekyOdemeAnahtar === anahtar &&
      (kart.dataset.zekyOdemeDurum === 'yukleniyor' || kart.dataset.zekyOdemeDurum === 'hazir')) return;

  const istekNo = ++odemeKartIstekNo;
  kart.dataset.zekyOdemeAnahtar = anahtar;
  kart.dataset.zekyOdemeDurum = 'yukleniyor';
  odemeKartiniYaz(kart, {
    durum: 'plansiz', baslik: 'Ödeme durumu', rozet: 'Yükleniyor', tutar: null,
    aciklama: 'Gerçek ödeme bilgileriniz alınıyor.', eylem: 'Ödemeleri Gör'
  });
  kart.dataset.zekyOdemeDurum = 'yukleniyor';

  try {
    const referans = portal.fb.doc(portal.db, 'ogrenciler', ogrenciId, 'donemler', donem);
    const belge = await portal.fb.getDoc(referans);
    const guncelKart = document.querySelector('.ca-page .ca-pay');
    const guncelOgrenciId = String(window.PortalAPI?.state?.veliAktifOgrenci?.id || '');
    if (istekNo !== odemeKartIstekNo || guncelKart !== kart || guncelOgrenciId !== ogrenciId) return;
    odemeKartiniYaz(kart, veliOdemeOzetiHesapla(belge.exists() ? belge.data() : null, new Date()));
  } catch (error) {
    console.warn('[Veli ödeme özeti]', error?.code || error?.message || error);
    if (istekNo !== odemeKartIstekNo || !kart.isConnected) return;
    odemeKartiniYaz(kart, {
      durum: 'plansiz', baslik: 'Ödeme durumu', rozet: 'Alınamadı', tutar: null,
      aciklama: 'Ödeme bilgilerinizi ayrıntılar ekranından kontrol edebilirsiniz.',
      eylem: 'Ödemeleri Gör'
    });
  }
}

function veliOdemeKartiniPlanla() {
  if (odemeKartGuncellemePlanli) return;
  odemeKartGuncellemePlanli = true;
  queueMicrotask(() => {
    odemeKartGuncellemePlanli = false;
    veliOdemeKartiniGuncelle();
  });
}

const veliOdemeKartGozlemcisi = new MutationObserver(veliOdemeKartiniPlanla);
veliOdemeKartGozlemcisi.observe(document.documentElement, { childList: true, subtree: true });
veliOdemeKartiniPlanla();
