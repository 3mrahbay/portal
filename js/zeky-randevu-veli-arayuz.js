// =====================================================================
// zeky-randevu-veli-arayuz.js — VELİ RANDEVU ARAYÜZÜ (24 Eylül 2026)
//
// Yalnız ARAYÜZ ve bağlantı katmanıdır. Veri yolu değişmedi:
//   okuma  → randevuSorguV3  (parent_children, targets, slots, mine)
//   yazma  → randevuKomutV3  (create_parent, cancel, accept_proposal,
//                             reject_proposal)
// Güvenlik, App Check ve kimlik: zeky-randevu-cutover-runtime.js
// (dokunulmadı). ZEKY uygulaması aynı backend'i kullanır.
//
// Düzeltilen bağlantı hataları:
//   1) "Randevularım" ve ana sayfa kartı eski randevuSlotlari'nı
//      okuyordu; yeni sistemde oluşan talepler hiç görünmüyordu.
//      Artık randevuSorguV3 'mine' ile okunur (eski kayıtlar geçmişte).
//   2) İptal, kapalı olan randevuSlotlari'na doğrudan yazıyordu (kural
//      reddediyordu). Artık randevuKomutV3 'cancel' kullanılır.
//   3) Seçili çocuk window.veliAktifOgrenci'den okunuyordu (tanımsız);
//      kardeşli ailelerde hep ilk çocuk seçiliyordu. Artık portal durumu.
//   4) Yönetime mail ve uygulama içi bildirim çağrısı tanımsız bir
//      fonksiyona gidiyordu; talep sonrası kimse haberdar olmuyordu.
//   5) Randevu onaylanınca takvime ekleme (.ics) geri geldi.
// =====================================================================

import {
  callableCutoverAcikMi, randevuServisiGetir, istekIzleyiciOlustur,
  guvenliId, gunAnahtari
} from './zeky-randevu-cutover-runtime.js';

const istekler = istekIzleyiciOlustur();
let servisSozu = null;
let cocukSozu = null;

async function api() {
  if (!servisSozu) servisSozu = randevuServisiGetir().catch(e => { servisSozu = null; throw e; });
  return servisSozu;
}
async function uygunCocuklar() {
  if (!cocukSozu) {
    cocukSozu = api().then(s => s.veliOgrencileri())
      .then(l => (l || []).filter(c => guvenliId(c.id)))
      .catch(e => { cocukSozu = null; throw e; });
  }
  return cocukSozu;
}
const portal = () => window.PortalAPI?.state || {};
const kacar = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ikon = (ad, b = 16) => `<i data-lucide="${ad}" style="width:${b}px;height:${b}px;"></i>`;
const ikonCiz = () => { try { window.lucideYenile?.(); } catch (_) {} };
const toast = (m, t) => { try { window.showToast ? window.showToast(m, t) : window.PortalAPI?.toast?.(m, t); } catch (_) {} };

// ── Görüşme türleri ve durumlar (site renkleri + lucide ikonları) ──
export const TURLER = [
  { tip: 'ogretmen_veli', ad: 'Sınıf öğretmeni', ikon: 'graduation-cap', aciklama: 'Sınıf içi gelişim ve günlük durum', renk: '#2E6A9E', acik: '#E9F3FC' },
  { tip: 'pdr',           ad: 'Rehberlik (PDR)', ikon: 'brain',          aciklama: 'Gelişim, davranış ve uyum',         renk: '#7C3AED', acik: '#EDE9FE' },
  { tip: 'idare',         ad: 'Müdür / idare',   ikon: 'briefcase',      aciklama: 'Kayıt, ücret ve genel konular',     renk: '#2D5E3E', acik: '#E8F3EC' }
];
const turBul = (tip) => TURLER.find(t => t.tip === tip) || { ad: 'Görüşme', ikon: 'calendar', renk: '#475569', acik: '#F1F5F9' };
export const DURUMLAR = {
  talep:             { ad: 'Onay bekliyor',            ikon: 'hourglass',      renk: '#B45309', acik: '#FEF3C7' },
  dolu:              { ad: 'Onaylandı',                ikon: 'calendar-check', renk: '#15803D', acik: '#DCFCE7' },
  alternatif_teklif: { ad: 'Yeni saat önerildi',       ikon: 'calendar-clock', renk: '#1D4ED8', acik: '#DBEAFE' },
  reddedildi:        { ad: 'Karşılanamadı',            ikon: 'calendar-x',     renk: '#B91C1C', acik: '#FEE2E2' },
  teklif_reddedildi: { ad: 'Önerilen saat reddedildi', ikon: 'calendar-x',     renk: '#B91C1C', acik: '#FEE2E2' },
  iptal:             { ad: 'İptal edildi',             ikon: 'ban',            renk: '#64748B', acik: '#F1F5F9' }
};

// ── Tarih biçimleri (İstanbul saati) ──
const fSaat = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fGun = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long' });
const fGunKisa = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'short' });
const fAyKisa = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', month: 'short' });
const fGunNo = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric' });
const saatYazi = (ms) => Number.isSafeInteger(ms) ? fSaat.format(new Date(ms)) : '—';
const gunYazi = (ms) => Number.isSafeInteger(ms) ? fGun.format(new Date(ms)) : '—';

function hataMetni(error, varsayilan = 'İşlem tamamlanamadı, lütfen tekrar deneyin.') {
  const kod = String(error?.code || '');
  const msj = String(error?.message || '');
  if (kod.includes('permission-denied')) return 'Bu işlem için yetkiniz görünmüyor. Çıkış yapıp yeniden girmeyi deneyin.';
  if (kod.includes('unauthenticated')) return 'Oturumunuz doğrulanamadı. Sayfayı yenileyip yeniden giriş yapın.';
  if (kod.includes('aborted') || kod.includes('already-exists')) return 'Bu saat az önce doldu. Lütfen başka bir saat seçin.';
  if (kod.includes('failed-precondition')) return 'Çocuğunuzun kaydı randevu sistemine henüz açılmamış. Okul yönetimine bildirebilirsiniz.';
  if (kod.includes('not-found')) return 'Seçilen kişi ya da saat artık uygun değil. Listeyi yenileyip tekrar deneyin.';
  if (kod.includes('unavailable') || kod.includes('deadline') || /network|fetch/i.test(msj)) return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
  if (/App Check|appCheck|recaptcha/i.test(msj)) return 'Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar deneyin.';
  if (/kapalı/i.test(msj)) return 'Randevu sistemi şu anda kapalı.';
  return varsayilan;
}

// ═════════════════════════ TALEP PENCERESİ ═════════════════════════
const S = { ogrenciId: '', cocuklar: [], tip: '', hedefler: [], hedefKodu: '', saatler: [], gun: '', slotKodu: '', mesgul: false, bitti: false };

function kapat() { document.getElementById('caRandevuArka')?.remove(); document.removeEventListener('keydown', tusla, true); }
function tusla(e) { if (e.key === 'Escape') { e.preventDefault(); kapat(); } }

function mesaj(metin, hata = true) {
  const el = document.getElementById('zrvMesaj');
  if (!el) return;
  el.hidden = !metin;
  el.className = `zrv-mesaj ${hata ? 'zrv-hata' : 'zrv-bilgi'}`;
  el.innerHTML = metin ? `${ikon(hata ? 'circle-alert' : 'info', 16)}<span>${kacar(metin)}</span>` : '';
  ikonCiz();
}

function adimlar() {
  const n = S.bitti ? 4 : S.slotKodu ? 3 : S.hedefKodu ? 2 : 1;
  return `<ol class="zrv-adimlar" aria-label="Adımlar">${['Kiminle', 'Ne zaman', 'Gönder'].map((a, i) =>
    `<li class="${n > i + 1 ? 'zrv-tamam' : n === i + 1 ? 'zrv-simdi' : ''}"><span>${n > i + 1 ? ikon('check', 12) : i + 1}</span>${a}</li>`).join('')}</ol>`;
}

function govdeCiz() {
  const kap = document.getElementById('zrvGovde');
  if (!kap) return;
  if (S.bitti) { kap.innerHTML = basariHtml(); ikonCiz(); baglaBasari(); return; }
  const cocuk = S.cocuklar.find(c => c.id === S.ogrenciId);
  const gunler = new Map();
  for (const s of (S.saatler || [])) { const k = gunAnahtari(s.ms); if (!gunler.has(k)) gunler.set(k, { ms: s.ms, saatler: [] }); gunler.get(k).saatler.push(s); }
  if (S.gun && !gunler.has(S.gun)) S.gun = '';
  if (!S.gun && gunler.size) S.gun = [...gunler.keys()][0];
  const secilen = (S.saatler || []).find(s => s.slotKodu === S.slotKodu);
  const hedef = (S.hedefler || []).find(h => h.kod === S.hedefKodu);
  const tur = turBul(S.tip);
  kap.innerHTML = `
    ${adimlar()}
    <div id="zrvMesaj" hidden></div>
    ${S.cocuklar.length > 1 ? `<div class="zrv-bolum"><div class="zrv-etiket">Çocuğunuz</div>
      <div class="zrv-cipler">${S.cocuklar.map(c => `<button type="button" class="zrv-cip${c.id === S.ogrenciId ? ' zrv-secili' : ''}" data-zrv-cocuk="${kacar(c.id)}">${ikon('baby', 14)}${kacar(c.ad)}</button>`).join('')}</div></div>` : ''}
    <div class="zrv-bolum"><div class="zrv-etiket">Kiminle görüşmek istiyorsunuz?</div>
      <div class="zrv-turler">${TURLER.map(t => `<button type="button" class="zrv-tur${t.tip === S.tip ? ' zrv-secili' : ''}" data-zrv-tur="${t.tip}" style="--zrv-renk:${t.renk};--zrv-acik:${t.acik}" aria-pressed="${t.tip === S.tip}">
        <span class="zrv-tur-ikon">${ikon(t.ikon, 20)}</span><span class="zrv-tur-metin"><span class="zrv-tur-ad">${kacar(t.ad)}</span><span class="zrv-tur-alt">${kacar(t.aciklama)}</span></span></button>`).join('')}</div></div>
    ${S.tip ? `<div class="zrv-bolum"><div class="zrv-etiket">Görüşülecek kişi</div>
      ${S.hedefler === null ? `<div class="zrv-yukleniyor"><span class="zrv-donen"></span>Uygun kişiler getiriliyor</div>`
        : S.hedefler.length ? `<div class="zrv-cipler">${S.hedefler.map(h => `<button type="button" class="zrv-cip${h.kod === S.hedefKodu ? ' zrv-secili' : ''}" data-zrv-hedef="${kacar(h.kod)}">${ikon('user-round', 14)}${kacar(h.ad)}</button>`).join('')}</div>`
        : `<div class="zrv-bos">${ikon('user-x', 18)}<span>${kacar(tur.ad)} için şu anda görüşme açan kimse yok. Başka bir tür seçebilir ya da okulu arayabilirsiniz.</span></div>`}</div>` : ''}
    ${S.hedefKodu ? `<div class="zrv-bolum"><div class="zrv-etiket">Gün ve saat</div>
      ${S.saatler === null ? `<div class="zrv-yukleniyor"><span class="zrv-donen"></span>Uygun saatler getiriliyor</div>`
        : !S.saatler.length ? `<div class="zrv-bos">${ikon('calendar-off', 18)}<span>${kacar(hedef?.ad || 'Bu kişi')} için şu anda açık saat yok. Okul yeni saat açtığında burada görünecek.</span></div>`
        : `<div class="zrv-gunler" role="tablist">${[...gunler.entries()].map(([k, g]) => `<button type="button" role="tab" aria-selected="${k === S.gun}" class="zrv-gun${k === S.gun ? ' zrv-secili' : ''}" data-zrv-gun="${k}">
            <span class="zrv-gun-ad">${kacar(fGunKisa.format(new Date(g.ms)))}</span><span class="zrv-gun-no">${kacar(fGunNo.format(new Date(g.ms)))}</span><span class="zrv-gun-ay">${kacar(fAyKisa.format(new Date(g.ms)))}</span><span class="zrv-gun-say">${g.saatler.length} saat</span></button>`).join('')}</div>
          <div class="zrv-saatler">${(gunler.get(S.gun)?.saatler || []).map(s => `<button type="button" class="zrv-saat${s.slotKodu === S.slotKodu ? ' zrv-secili' : ''}" data-zrv-slot="${kacar(s.slotKodu)}">${kacar(saatYazi(s.ms))}</button>`).join('')}</div>`}</div>` : ''}
    <div class="zrv-bolum"><label class="zrv-etiket" for="zrvNot">Görüşme konusu <span>isteğe bağlı</span></label>
      <textarea id="zrvNot" rows="3" maxlength="1000" placeholder="Kısaca konuyu yazarsanız görüşmeye hazırlıklı gelinir.">${kacar(S.not || '')}</textarea></div>
    <div class="zrv-ozet${secilen ? ' zrv-ozet-hazir' : ''}">
      ${secilen ? `<span class="zrv-ozet-ikon" style="--zrv-renk:${tur.renk};--zrv-acik:${tur.acik}">${ikon(tur.ikon, 18)}</span>
        <span class="zrv-ozet-metin"><strong>${kacar(hedef?.ad || tur.ad)}</strong><span>${kacar(gunYazi(secilen.ms))} · ${kacar(saatYazi(secilen.ms))}${cocuk ? ` · ${kacar(cocuk.ad)}` : ''}</span></span>`
        : `<span class="zrv-ozet-metin"><span>${!S.tip ? 'Görüşme türünü seçin.' : !S.hedefKodu ? 'Görüşülecek kişiyi seçin.' : 'Size uygun gün ve saati seçin.'}</span></span>`}
      <button type="button" id="zrvGonder" class="zrv-birincil" ${secilen && !S.mesgul ? '' : 'disabled'}>${S.mesgul ? '<span class="zrv-donen zrv-donen-beyaz"></span>Gönderiliyor' : `${ikon('send', 16)}Talebi gönder`}</button>
    </div>`;
  bagla();
  ikonCiz();
}

function bagla() {
  const kap = document.getElementById('zrvGovde');
  kap.querySelectorAll('[data-zrv-cocuk]').forEach(b => b.addEventListener('click', () => { notuSakla(); cocukSec(b.dataset.zrvCocuk); }));
  kap.querySelectorAll('[data-zrv-tur]').forEach(b => b.addEventListener('click', () => { notuSakla(); turSec(b.dataset.zrvTur); }));
  kap.querySelectorAll('[data-zrv-hedef]').forEach(b => b.addEventListener('click', () => { notuSakla(); hedefSec(b.dataset.zrvHedef); }));
  kap.querySelectorAll('[data-zrv-gun]').forEach(b => b.addEventListener('click', () => { notuSakla(); S.gun = b.dataset.zrvGun; S.slotKodu = ''; govdeCiz(); }));
  kap.querySelectorAll('[data-zrv-slot]').forEach(b => b.addEventListener('click', () => { notuSakla(); S.slotKodu = b.dataset.zrvSlot; govdeCiz(); document.querySelector('.zrv-ozet')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }));
  kap.querySelector('#zrvGonder')?.addEventListener('click', gonder);
}
function notuSakla() { const t = document.getElementById('zrvNot'); if (t) S.not = t.value; }

async function cocukSec(id) {
  if (S.mesgul || id === S.ogrenciId) return;
  S.ogrenciId = id; const tip = S.tip; S.tip = '';
  await turSec(tip || TURLER[0].tip);
}

async function turSec(tip) {
  if (S.mesgul || !TURLER.some(t => t.tip === tip)) return;
  S.tip = tip; S.hedefKodu = ''; S.slotKodu = ''; S.hedefler = null; S.saatler = []; S.gun = '';
  govdeCiz();
  try {
    const rows = await (await api()).hedefleriGetir(S.ogrenciId, tip);
    if (S.tip !== tip) return;
    S.hedefler = (rows || []).filter(r => guvenliId(r.kod) && typeof r.ad === 'string');
    govdeCiz();
    if (S.hedefler.length === 1) await hedefSec(S.hedefler[0].kod);
  } catch (e) { if (S.tip === tip) { S.hedefler = []; govdeCiz(); mesaj(hataMetni(e, 'Görüşülecek kişiler getirilemedi.')); } }
}

async function hedefSec(kod) {
  if (S.mesgul || !(S.hedefler || []).some(h => h.kod === kod)) return;
  S.hedefKodu = kod; S.slotKodu = ''; S.saatler = null; S.gun = '';
  govdeCiz();
  try {
    const rows = await (await api()).saatleriGetir(S.ogrenciId, kod, S.tip);
    if (S.hedefKodu !== kod) return;
    S.saatler = (rows || []).map(r => ({ slotKodu: r.slotKodu, ms: Number(r.baslangicMillis) }))
      .filter(r => guvenliId(r.slotKodu, 240) && Number.isSafeInteger(r.ms) && r.ms > Date.now())
      .sort((a, b) => a.ms - b.ms);
    govdeCiz();
  } catch (e) { if (S.hedefKodu === kod) { S.saatler = []; govdeCiz(); mesaj(hataMetni(e, 'Uygun saatler getirilemedi.')); } }
}

async function gonder() {
  notuSakla();
  if (S.mesgul || !S.slotKodu) return;
  const secilen = (S.saatler || []).find(s => s.slotKodu === S.slotKodu);
  const hedef = (S.hedefler || []).find(h => h.kod === S.hedefKodu);
  const not = String(S.not || '').trim().slice(0, 1000);
  S.mesgul = true; govdeCiz();
  const payload = `${S.ogrenciId}|${S.hedefKodu}|${S.slotKodu}|${not}`;
  const requestId = istekler.anahtar('create_parent', S.ogrenciId, payload);
  try {
    await (await api()).veliRandevuOlustur({ requestId, ogrenciId: S.ogrenciId, hedefKodu: S.hedefKodu, slotKodu: S.slotKodu, not });
    istekler.tamamla('create_parent', S.ogrenciId, payload);
    S.sonuc = { hedefAd: hedef?.ad || '', ms: secilen?.ms, tip: S.tip, cocuk: S.cocuklar.find(c => c.id === S.ogrenciId)?.ad || '' };
    S.bitti = true; S.mesgul = false;
    govdeCiz();
    yonetimeBildir({ hedefAd: S.sonuc.hedefAd, not, baslangicMillis: S.sonuc.ms, tip: S.tip, ogrenciAd: S.sonuc.cocuk });
    listeleriYenile();
  } catch (e) {
    S.mesgul = false; govdeCiz(); mesaj(hataMetni(e, 'Talep gönderilemedi, lütfen tekrar deneyin.'));
    if (String(e?.code || '').includes('aborted')) hedefSec(S.hedefKodu);
  }
}

function basariHtml() {
  const r = S.sonuc || {}, tur = turBul(r.tip);
  return `${adimlar()}<div class="zrv-basari">
    <span class="zrv-basari-ikon">${ikon('check', 30)}</span>
    <h4>Talebiniz iletildi</h4>
    <p>${kacar(r.hedefAd || tur.ad)} · ${kacar(gunYazi(r.ms))} · ${kacar(saatYazi(r.ms))}</p>
    <p class="zrv-soluk">Okul onayladığında bildirim alacaksınız. Onaylanan randevuyu “Randevularım”dan takviminize ekleyebilirsiniz.</p>
    <div class="zrv-basari-eylem"><button type="button" class="zrv-ikincil" data-zrv-liste>${ikon('calendar-days', 16)}Randevularım</button><button type="button" class="zrv-birincil" data-zrv-kapat>Tamam</button></div>
  </div>`;
}
function baglaBasari() {
  document.querySelector('[data-zrv-kapat]')?.addEventListener('click', kapat);
  document.querySelector('[data-zrv-liste]')?.addEventListener('click', () => { kapat(); try { window.caGo?.('randevular'); } catch (_) {} });
}

export async function modalAc(ogrenciId) {
  kapat(); stilEkle();
  Object.assign(S, { ogrenciId: '', cocuklar: [], tip: '', hedefler: [], hedefKodu: '', saatler: [], gun: '', slotKodu: '', mesgul: false, bitti: false, not: '', sonuc: null });
  const div = document.createElement('div');
  div.id = 'caRandevuArka'; div.className = 'zrv-arka';
  div.innerHTML = `<div class="zrv-pencere" role="dialog" aria-modal="true" aria-labelledby="zrvBaslik">
    <header class="zrv-bas"><span class="zrv-bas-ikon">${ikon('calendar-plus', 20)}</span>
      <div><h3 id="zrvBaslik">Randevu talebi</h3><p>Okulun açtığı saatlerden size uygun olanı seçin.</p></div>
      <button type="button" class="zrv-kapat" aria-label="Kapat">${ikon('x', 20)}</button></header>
    <div class="zrv-govde" id="zrvGovde"><div class="zrv-yukleniyor"><span class="zrv-donen"></span>Randevu bilgileri hazırlanıyor</div></div></div>`;
  document.body.appendChild(div);
  div.querySelector('.zrv-kapat').addEventListener('click', kapat);
  div.addEventListener('click', e => { if (e.target === div) kapat(); });
  document.addEventListener('keydown', tusla, true);
  ikonCiz();
  try {
    const cocuklar = await uygunCocuklar();
    S.cocuklar = cocuklar;
    const istenen = guvenliId(ogrenciId) || guvenliId(portal().veliAktifOgrenci?.id);
    const uygun = cocuklar.find(c => c.id === istenen) || cocuklar[0];
    if (!uygun) { uygunsuzGoster(); return; }
    S.ogrenciId = uygun.id;
    await turSec(TURLER[0].tip);
    if (istenen && uygun.id !== istenen) {
      const ad = (portal().veliOgrenciler || []).find(o => o.id === istenen)?.ogrenciAdSoyad || 'Seçili çocuğunuz';
      mesaj(`${ad} için randevu kaydı henüz açılmamış; ${uygun.ad} için talep oluşturabilirsiniz.`, false);
    }
  } catch (e) {
    const kap = document.getElementById('zrvGovde');
    if (kap) kap.innerHTML = `<div class="zrv-bos zrv-bos-buyuk">${ikon('wifi-off', 22)}<span>${kacar(hataMetni(e, 'Randevu bilgileri alınamadı.'))}</span></div>`;
    ikonCiz();
  }
}
function uygunsuzGoster() {
  const kap = document.getElementById('zrvGovde');
  if (!kap) return;
  kap.innerHTML = `<div class="zrv-bos zrv-bos-buyuk">${ikon('user-round-x', 22)}<span><strong>Çocuğunuzun kaydı randevu sistemine henüz açılmamış.</strong><br>Okul yönetimi kaydı tamamladığında buradan talep oluşturabilirsiniz. Acil bir konu için okulu arayabilir ya da mesaj gönderebilirsiniz.</span></div>
    <div class="zrv-basari-eylem"><button type="button" class="zrv-ikincil" data-zrv-mesaj>${ikon('message-circle', 16)}Okula mesaj yaz</button><button type="button" class="zrv-birincil" data-zrv-kapat>Tamam</button></div>`;
  kap.querySelector('[data-zrv-kapat]').addEventListener('click', kapat);
  kap.querySelector('[data-zrv-mesaj]').addEventListener('click', () => { kapat(); try { window.caGo?.('mesajlar'); } catch (_) {} });
  ikonCiz();
}

// ═════════════════════════ YÖNETİME BİLDİRİM ═════════════════════════
// Talep backend'de oluştuktan sonra çalışır; başarısız olsa bile talep geçerlidir.
async function yonetimeBildir({ hedefAd, not, baslangicMillis, tip, ogrenciAd }) {
  const P = window.PortalAPI; if (!P?.db || !P?.fb) return;
  const { db, fb } = P;
  const kullanici = P.state?.currentUser || {};
  const veliAd = kullanici.displayName || kullanici.email || 'Veli';
  const zaman = `${gunYazi(baslangicMillis)} · ${saatYazi(baslangicMillis)}`;
  try {
    let okulMail = 'eposta@bircicekkoleji.com';
    try { const a = await fb.getDoc(fb.doc(db, 'ayarlar', 'okulBilgileri')); if (a.exists() && a.data().eposta) okulMail = a.data().eposta; } catch (_) {}
    await P.mail?.gonder?.({
      to: okulMail,
      subject: `Yeni randevu talebi · ${ogrenciAd || veliAd}`,
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:520px">
        <div style="background:#2D5E3E;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0"><div style="font-size:12px;opacity:.85;letter-spacing:1px">PORTAL</div><div style="font-size:19px;font-weight:700;margin-top:4px">Yeni Randevu Talebi</div></div>
        <div style="border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:20px">
          <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;color:#334155;line-height:1.7">
            <b>Veli:</b> ${kacar(veliAd)}<br><b>Öğrenci:</b> ${kacar(ogrenciAd || '—')}<br><b>Görüşme:</b> ${kacar(turBul(tip).ad)} · ${kacar(hedefAd)}<br><b>Zaman:</b> ${kacar(zaman)}</div>
          ${not ? `<div style="background:#FFF7ED;border-radius:10px;padding:13px 16px;margin-top:12px;color:#7C2D12"><b>Görüşme konusu:</b><br>${kacar(not)}</div>` : ''}
          <p style="color:#64748B;font-size:14px;margin:18px 0 14px">Portal → Randevular bölümünden onaylayabilir, farklı saat önerebilir ya da reddedebilirsiniz.</p>
          <a href="https://portal.bircicekkoleji.com/randevu-talepleri.html" style="display:inline-block;background:#2D5E3E;color:#fff;text-decoration:none;padding:11px 22px;border-radius:9px;font-weight:700">Randevuları aç</a></div></div>`
    });
  } catch (e) { console.warn('Randevu maili gönderilemedi:', e?.message); }
}
window.zekyRandevuYonetimeBildir = yonetimeBildir;

// ═════════════════════════ RANDEVULARIM ═════════════════════════
let listeKap = null, listeCocuk = '';

async function randevularim(ogrenciId) {
  const rows = await (await api()).randevularim(ogrenciId);
  return (rows || []).map(r => ({ ...r, ms: Number(r.baslangicMillis), teklifMs: Number(r.teklifBaslangicMillis) }))
    .filter(r => guvenliId(r.id, 200) && Number.isSafeInteger(r.ms));
}

function tarihKutusu(ms, renk, acik) {
  const d = new Date(ms);
  return `<span class="zrv-tarih" style="--zrv-renk:${renk};--zrv-acik:${acik}"><strong>${kacar(fGunNo.format(d))}</strong><span>${kacar(fAyKisa.format(d))}</span></span>`;
}

function kartHtml(r, gecmis = false) {
  const d = DURUMLAR[r.durum] || { ad: 'Durum bilinmiyor', ikon: 'help-circle', renk: '#64748B', acik: '#F1F5F9' };
  const tur = turBul(r.tip);
  const notlar = [
    r.veliNotu ? `<p class="zrv-not">${ikon('message-square', 13)}${kacar(r.veliNotu)}</p>` : '',
    r.teklifNotu && r.durum === 'alternatif_teklif' ? `<p class="zrv-not zrv-not-mavi">${ikon('message-square', 13)}${kacar(r.teklifNotu)}</p>` : '',
    r.retNedeni ? `<p class="zrv-not zrv-not-kirmizi"><b>Okuldan not:</b> ${kacar(r.retNedeni)}</p>` : '',
    r.iptalNedeni ? `<p class="zrv-not"><b>İptal nedeni:</b> ${kacar(r.iptalNedeni)}</p>` : ''
  ].join('');
  let eylem = '';
  if (!gecmis && r.durum === 'alternatif_teklif' && Number.isSafeInteger(r.teklifMs)) {
    eylem = `<div class="zrv-teklif">${ikon('calendar-clock', 16)}<span>Okul yeni bir saat önerdi: <strong>${kacar(gunYazi(r.teklifMs))} · ${kacar(saatYazi(r.teklifMs))}</strong></span></div>
      <div class="zrv-eylemler"><button type="button" class="zrv-birincil zrv-kucuk" data-zrv-kabul="${kacar(r.id)}">${ikon('check', 15)}Yeni saati kabul et</button><button type="button" class="zrv-ikincil zrv-kucuk" data-zrv-teklif-ret="${kacar(r.id)}">Uygun değil</button></div>`;
  } else if (!gecmis && ['talep', 'dolu'].includes(r.durum)) {
    eylem = `<div class="zrv-eylemler">${r.durum === 'dolu' ? `<button type="button" class="zrv-ikincil zrv-kucuk" data-zrv-ics="${kacar(r.id)}">${ikon('calendar-plus', 15)}Takvime ekle</button>` : ''}
      <button type="button" class="zrv-hafif zrv-kucuk" data-zrv-iptal="${kacar(r.id)}">${ikon('x', 14)}${r.durum === 'talep' ? 'Talebi geri çek' : 'İptal et'}</button></div>`;
  }
  return `<article class="zrv-kart${gecmis ? ' zrv-kart-gecmis' : ''}" style="--zrv-cizgi:${d.renk}">
    ${tarihKutusu(r.ms, tur.renk, tur.acik)}
    <div class="zrv-kart-govde">
      <div class="zrv-kart-ust"><strong>${kacar(r.hedefAd || tur.ad)}</strong><span class="zrv-rozet" style="color:${d.renk};background:${d.acik}">${ikon(d.ikon, 13)}${kacar(d.ad)}</span></div>
      <div class="zrv-kart-alt">${ikon(tur.ikon, 13)}${kacar(tur.ad)} · ${ikon('clock', 13)}${kacar(gunYazi(r.ms))} · ${kacar(saatYazi(r.ms))}</div>
      ${notlar}${eylem}
      <div class="zrv-neden" data-zrv-neden-kap="${kacar(r.id)}" hidden></div>
    </div></article>`;
}

async function eskiKayitlar() {
  try {
    const P = window.PortalAPI; const e = String(P?.state?.currentUser?.email || '').toLowerCase();
    if (!e) return [];
    const snap = await P.fb.getDocs(P.fb.query(P.fb.collection(P.db, 'randevuSlotlari'), P.fb.where('veliEmail', '==', e)));
    return snap.docs.map(d => d.data() || {}).filter(v => v.tarih).map(v => ({
      eski: true, durum: v.durum === 'talep' ? 'talep' : v.durum === 'reddedildi' ? 'reddedildi' : 'dolu',
      tip: v.tip, hedefAd: v.hedefAd || '', veliNotu: v.veliNotu || '', retNedeni: v.retGerekcesi || '',
      ms: Date.parse(`${v.tarih}T${v.baslangicSaat || '00:00'}:00+03:00`)
    })).filter(v => Number.isSafeInteger(v.ms));
  } catch (_) { return []; }
}

export async function listeCiz(kapId) {
  const kap = document.getElementById(kapId);
  if (!kap) return;
  stilEkle(); listeKap = kapId;
  kap.innerHTML = `<div class="ca-card zrv-yukleniyor zrv-kart-bos"><span class="zrv-donen"></span>Randevularınız getiriliyor</div>`;
  if (!callableCutoverAcikMi()) { kap.innerHTML = `<div class="ca-card zrv-bos zrv-bos-buyuk">${ikon('calendar-off', 22)}<span>Randevu sistemi şu anda kapalı.</span></div>`; ikonCiz(); return; }
  try {
    const cocuklar = await uygunCocuklar();
    const aktif = guvenliId(portal().veliAktifOgrenci?.id);
    if (!listeCocuk || !cocuklar.some(c => c.id === listeCocuk)) listeCocuk = (cocuklar.find(c => c.id === aktif) || cocuklar[0])?.id || '';
    if (!listeCocuk) {
      kap.innerHTML = `<div class="ca-card zrv-bos zrv-bos-buyuk">${ikon('user-round-x', 22)}<span><strong>Çocuğunuzun kaydı randevu sistemine henüz açılmamış.</strong><br>Okul yönetimi kaydı tamamladığında randevularınız burada görünecek.</span></div>`;
      ikonCiz(); return;
    }
    const [yeni, eski] = await Promise.all([randevularim(listeCocuk), eskiKayitlar()]);
    const simdi = Date.now() - 60 * 60000;
    const acik = ['talep', 'dolu', 'alternatif_teklif'];
    const yanit = yeni.filter(r => r.durum === 'alternatif_teklif');
    const yaklasan = yeni.filter(r => acik.includes(r.durum) && r.durum !== 'alternatif_teklif' && r.ms >= simdi).sort((a, b) => a.ms - b.ms);
    const gecmis = [...yeni.filter(r => !acik.includes(r.durum) || (r.ms < simdi && r.durum !== 'alternatif_teklif')), ...eski].sort((a, b) => b.ms - a.ms).slice(0, 15);
    const bolum = (baslik, liste, gec = false, ik = '') => liste.length ? `<div class="zrv-liste-baslik">${ik ? ikon(ik, 15) : ''}${baslik}<span>${liste.length}</span></div>${liste.map(r => kartHtml(r, gec || r.eski)).join('')}` : '';
    kap.innerHTML = `
      ${cocuklar.length > 1 ? `<div class="zrv-cipler zrv-liste-cocuk">${cocuklar.map(c => `<button type="button" class="zrv-cip${c.id === listeCocuk ? ' zrv-secili' : ''}" data-zrv-liste-cocuk="${kacar(c.id)}">${ikon('baby', 14)}${kacar(c.ad)}</button>`).join('')}</div>` : ''}
      ${!yanit.length && !yaklasan.length ? `<div class="ca-card zrv-bos-kart">${ikon('calendar-heart', 30)}<strong>Yaklaşan randevunuz yok</strong><span>Sınıf öğretmeni, rehberlik ya da müdürle görüşmek için talep oluşturabilirsiniz.</span><button type="button" class="zrv-birincil" data-zrv-yeni>${ikon('plus', 16)}Randevu talep et</button></div>` : ''}
      ${bolum('Yanıtınızı bekleyen', yanit, false, 'bell-ring')}
      ${bolum('Yaklaşan', yaklasan, false, 'calendar-days')}
      ${bolum('Geçmiş', gecmis, true, 'history')}`;
    kap.querySelectorAll('[data-zrv-liste-cocuk]').forEach(b => b.addEventListener('click', () => { listeCocuk = b.dataset.zrvListeCocuk; listeCiz(kapId); }));
    kap.querySelector('[data-zrv-yeni]')?.addEventListener('click', () => modalAc(listeCocuk));
    kap.querySelectorAll('[data-zrv-kabul]').forEach(b => b.addEventListener('click', () => komut('accept_proposal', b.dataset.zrvKabul, '', b)));
    kap.querySelectorAll('[data-zrv-teklif-ret]').forEach(b => b.addEventListener('click', () => nedenSor(b.dataset.zrvTeklifRet, 'reject_proposal', 'Önerilen saat neden uygun değil?')));
    kap.querySelectorAll('[data-zrv-iptal]').forEach(b => b.addEventListener('click', () => nedenSor(b.dataset.zrvIptal, 'cancel', 'Kısaca iptal nedenini yazın')));
    kap.querySelectorAll('[data-zrv-ics]').forEach(b => b.addEventListener('click', () => { const r = yeni.find(x => x.id === b.dataset.zrvIcs); if (r) icsIndir(r); }));
  } catch (e) {
    kap.innerHTML = `<div class="ca-card zrv-bos zrv-bos-buyuk">${ikon('wifi-off', 22)}<span>${kacar(hataMetni(e, 'Randevular yüklenemedi.'))}</span></div>
      <button type="button" class="zrv-ikincil zrv-tam" data-zrv-tekrar>${ikon('refresh-cw', 15)}Tekrar dene</button>`;
    kap.querySelector('[data-zrv-tekrar]')?.addEventListener('click', () => { cocukSozu = null; listeCiz(kapId); });
  }
  ikonCiz();
}

function nedenSor(id, eylem, baslik) {
  const kap = document.querySelector(`[data-zrv-neden-kap="${CSS.escape(id)}"]`);
  if (!kap) return;
  kap.hidden = false;
  kap.innerHTML = `<label class="zrv-etiket" for="zrvNeden_${kacar(id)}">${kacar(baslik)}</label>
    <textarea id="zrvNeden_${kacar(id)}" rows="2" maxlength="500"></textarea>
    <div class="zrv-eylemler"><button type="button" class="zrv-hafif zrv-kucuk" data-zrv-vazgec>Vazgeç</button><button type="button" class="zrv-tehlike zrv-kucuk" data-zrv-onay>${eylem === 'cancel' ? 'İptal et' : 'Gönder'}</button></div>`;
  const alan = kap.querySelector('textarea'); alan.focus();
  kap.querySelector('[data-zrv-vazgec]').addEventListener('click', () => { kap.hidden = true; kap.innerHTML = ''; });
  kap.querySelector('[data-zrv-onay]').addEventListener('click', (e) => {
    const neden = alan.value.trim();
    if (!neden) { alan.focus(); alan.classList.add('zrv-eksik'); return; }
    komut(eylem, id, neden, e.currentTarget);
  });
}

async function komut(eylem, id, neden, dugme) {
  if (dugme) { dugme.disabled = true; dugme.innerHTML = '<span class="zrv-donen"></span>İşleniyor'; }
  const requestId = istekler.anahtar(eylem, id, neden);
  try {
    const s = await api();
    if (eylem === 'accept_proposal') await s.teklifiKabulEt(requestId, id);
    else if (eylem === 'reject_proposal') await s.teklifiReddet(requestId, id, neden);
    else await s.iptalEt(requestId, id, neden);
    istekler.tamamla(eylem, id, neden);
    toast(eylem === 'accept_proposal' ? 'Yeni saat kabul edildi' : eylem === 'cancel' ? 'Randevu iptal edildi' : 'Yanıtınız iletildi', 'success');
  } catch (e) { toast(hataMetni(e), 'error'); }
  listeleriYenile();
}

function icsIndir(r) {
  const z = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const tur = turBul(r.tip);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bir Cicek Koleji//Portal//TR', 'BEGIN:VEVENT',
    `UID:${r.id}@portal.bircicekkoleji.com`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(r.ms)}`, `DTEND:${z(r.ms + 30 * 60000)}`,
    `SUMMARY:Okul görüşmesi · ${(r.hedefAd || tur.ad).replace(/[,;\n]/g, ' ')}`,
    'LOCATION:Bir Çiçek Koleji Anaokulu', 'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Okul görüşmesi', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  a.download = 'okul-gorusmesi.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Ana sayfa kartı: en yakın 3 randevu
export async function yaklasanCiz(bolum, el) {
  bolum = bolum || document.getElementById('caHomeRandevuBolum');
  el = el || document.getElementById('caHomeRandevular');
  if (!bolum || !el) return;
  stilEkle();
  try {
    if (!callableCutoverAcikMi()) { bolum.style.display = 'none'; return; }
    const cocuklar = await uygunCocuklar();
    const aktif = guvenliId(portal().veliAktifOgrenci?.id);
    const c = cocuklar.find(x => x.id === aktif) || cocuklar[0];
    if (!c) { bolum.style.display = 'none'; return; }
    const liste = (await randevularim(c.id)).filter(r => ['talep', 'dolu', 'alternatif_teklif'].includes(r.durum) && r.ms >= Date.now() - 3600000).sort((a, b) => a.ms - b.ms);
    if (!liste.length) { bolum.style.display = 'none'; return; }
    bolum.style.display = '';
    el.innerHTML = liste.slice(0, 3).map(r => { const d = DURUMLAR[r.durum], tur = turBul(r.tip);
      return `<button type="button" class="zrv-mini" data-zrv-git>${tarihKutusu(r.ms, tur.renk, tur.acik)}
        <span class="zrv-mini-metin"><strong>${kacar(r.hedefAd || tur.ad)}</strong><span>${kacar(gunYazi(r.ms))} · ${kacar(saatYazi(r.ms))}</span></span>
        <span class="zrv-rozet" style="color:${d.renk};background:${d.acik}">${kacar(r.durum === 'alternatif_teklif' ? 'Yanıt bekliyor' : d.ad)}</span></button>`; }).join('');
    el.querySelectorAll('[data-zrv-git]').forEach(b => b.addEventListener('click', () => window.caGo?.('randevular')));
    ikonCiz();
  } catch (_) { bolum.style.display = 'none'; }
}

function listeleriYenile() {
  if (listeKap && document.getElementById(listeKap)) listeCiz(listeKap);
  yaklasanCiz();
}

// ═════════════════════════ PORTAL BAĞLANTILARI ═════════════════════════
window.zekyRandevuApi = Object.freeze({ api, modalAc });
window.zekyRandevuListe = listeCiz;
window.zekyRandevuYaklasan = yaklasanCiz;
window.caRandevuTalepAc = async function () {
  if (!callableCutoverAcikMi()) { toast('Randevu sistemi şu anda kapalı', 'error'); return; }
  modalAc(guvenliId(portal().veliAktifOgrenci?.id));
};
window.caRandevuIptal = function () { try { window.caGo?.('randevular'); } catch (_) {} };

// ═════════════════════════ STİL ═════════════════════════
function stilEkle() {
  if (document.getElementById('zrvStil')) return;
  const st = document.createElement('style');
  st.id = 'zrvStil';
  st.textContent = `
.zrv-arka { position:fixed; inset:0; z-index:9500; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; padding:18px; animation:zrvAc .15s ease-out; }
@keyframes zrvAc { from { opacity:0; } to { opacity:1; } }
.zrv-pencere { width:100%; max-width:520px; max-height:92vh; background:#fff; border-radius:24px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px rgba(15,23,42,.28); font-family:var(--c-font-body, Inter, system-ui, sans-serif); color:#1E293B; }
.zrv-bas { display:flex; align-items:center; gap:12px; padding:18px 18px 14px 22px; border-bottom:1px solid #EEF2F0; flex-shrink:0; }
.zrv-bas-ikon { width:42px; height:42px; border-radius:13px; display:grid; place-items:center; background:#E8F3EC; color:#2D5E3E; flex-shrink:0; }
.zrv-bas div { flex:1; min-width:0; } .zrv-bas h3 { margin:0; font-family:var(--c-font-head, inherit); font-size:18px; font-weight:800; }
.zrv-bas p { margin:2px 0 0; font-size:12.5px; color:#64748B; }
.zrv-kapat { width:40px; height:40px; flex-shrink:0; border:0; border-radius:50%; background:rgba(15,23,42,.06); color:#475569; display:grid; place-items:center; cursor:pointer; }
.zrv-govde { overflow-y:auto; padding:16px 22px 0; display:flex; flex-direction:column; gap:16px; overscroll-behavior:contain; }
.zrv-adimlar { display:flex; gap:6px; list-style:none; margin:0; padding:0; }
.zrv-adimlar li { flex:1; display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:#94A3B8; padding-bottom:8px; border-bottom:3px solid #EEF2F0; }
.zrv-adimlar li span { width:20px; height:20px; border-radius:50%; display:grid; place-items:center; background:#EEF2F0; font-size:11px; flex-shrink:0; }
.zrv-adimlar .zrv-simdi { color:#2D5E3E; border-color:#2D5E3E; } .zrv-adimlar .zrv-simdi span { background:#2D5E3E; color:#fff; }
.zrv-adimlar .zrv-tamam { color:#4A7C59; border-color:#9DBFA8; } .zrv-adimlar .zrv-tamam span { background:#9DBFA8; color:#fff; }
.zrv-etiket { display:block; margin-bottom:8px; font-size:12.5px; font-weight:800; color:#334155; } .zrv-etiket span { font-weight:500; color:#94A3B8; }
.zrv-turler { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
.zrv-tur { display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:12px; border:1.5px solid #E2E8F0; border-radius:16px; background:#fff; font:inherit; text-align:left; cursor:pointer; color:#1E293B; transition:border-color .15s, box-shadow .15s; }
.zrv-tur:hover { border-color:var(--zrv-renk); }
.zrv-tur.zrv-secili { border-color:var(--zrv-renk); background:var(--zrv-acik); box-shadow:0 0 0 3px color-mix(in srgb, var(--zrv-renk) 15%, transparent); }
.zrv-tur-ikon { width:38px; height:38px; border-radius:12px; display:grid; place-items:center; background:var(--zrv-acik); color:var(--zrv-renk); margin-bottom:4px; }
.zrv-tur.zrv-secili .zrv-tur-ikon { background:#fff; }
.zrv-tur-metin { display:flex; flex-direction:column; gap:2px; min-width:0; }
.zrv-tur-ad { font-size:13.5px; font-weight:800; line-height:1.25; } .zrv-tur-alt { font-size:11.5px; color:#64748B; line-height:1.35; }
.zrv-cipler { display:flex; flex-wrap:wrap; gap:7px; }
.zrv-cip { display:inline-flex; align-items:center; gap:7px; min-height:40px; padding:7px 14px; border:1.5px solid #E2E8F0; border-radius:999px; background:#fff; font:inherit; font-size:13.5px; font-weight:700; color:#1E293B; cursor:pointer; }
.zrv-cip.zrv-secili { background:#2D5E3E; border-color:#2D5E3E; color:#fff; }
.zrv-gunler { display:flex; gap:7px; overflow-x:auto; padding-bottom:6px; margin-bottom:10px; scrollbar-width:thin; }
.zrv-gun { flex-shrink:0; width:70px; display:flex; flex-direction:column; align-items:center; gap:1px; padding:9px 4px; border:1.5px solid #E2E8F0; border-radius:14px; background:#fff; font:inherit; cursor:pointer; color:#1E293B; }
.zrv-gun-ad { font-size:11.5px; font-weight:700; color:#64748B; text-transform:capitalize; } .zrv-gun-no { font-size:20px; font-weight:800; line-height:1.1; } .zrv-gun-ay { font-size:11.5px; color:#64748B; text-transform:capitalize; }
.zrv-gun-say { margin-top:4px; font-size:10.5px; font-weight:700; color:#4A7C59; background:#E8F3EC; border-radius:999px; padding:1px 7px; }
.zrv-gun.zrv-secili { border-color:#2D5E3E; background:#2D5E3E; color:#fff; } .zrv-gun.zrv-secili span { color:#E8F3EC; } .zrv-gun.zrv-secili .zrv-gun-say { background:rgba(255,255,255,.18); color:#fff; }
.zrv-saatler { display:grid; grid-template-columns:repeat(auto-fill, minmax(78px, 1fr)); gap:7px; }
.zrv-saat { min-height:42px; border:1.5px solid #E2E8F0; border-radius:12px; background:#fff; font:inherit; font-size:14.5px; font-weight:800; font-variant-numeric:tabular-nums; color:#1E293B; cursor:pointer; }
.zrv-saat:hover { border-color:#4A7C59; } .zrv-saat.zrv-secili { background:#2D5E3E; border-color:#2D5E3E; color:#fff; }
.zrv-govde textarea, .zrv-neden textarea { width:100%; box-sizing:border-box; padding:11px 13px; border:1.5px solid #E2E8F0; border-radius:12px; font:inherit; font-size:14px; resize:vertical; color:#1E293B; }
.zrv-govde textarea:focus, .zrv-neden textarea:focus { outline:none; border-color:#4A7C59; box-shadow:0 0 0 3px #E8F3EC; }
.zrv-eksik { border-color:#DC2626 !important; }
.zrv-ozet { position:sticky; bottom:0; display:flex; align-items:center; gap:12px; margin:0 -22px; padding:14px 22px 16px; background:#fff; border-top:1px solid #EEF2F0; }
.zrv-ozet-hazir { background:#F7FBF8; }
.zrv-ozet-ikon { width:40px; height:40px; border-radius:12px; display:grid; place-items:center; background:var(--zrv-acik); color:var(--zrv-renk); flex-shrink:0; }
.zrv-ozet-metin { flex:1; min-width:0; display:flex; flex-direction:column; font-size:12.5px; color:#64748B; } .zrv-ozet-metin strong { font-size:14px; color:#1E293B; }
.zrv-birincil, .zrv-ikincil, .zrv-hafif, .zrv-tehlike { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:44px; padding:10px 18px; border-radius:12px; font:inherit; font-size:14px; font-weight:800; cursor:pointer; white-space:nowrap; }
.zrv-birincil { border:0; background:#2D5E3E; color:#fff; } .zrv-birincil:hover:not(:disabled) { background:#24503A; } .zrv-birincil:disabled { background:#CBD5E1; cursor:not-allowed; }
.zrv-ikincil { border:1.5px solid #D9E3DC; background:#fff; color:#2D5E3E; }
.zrv-hafif { border:0; background:#F1F5F9; color:#475569; }
.zrv-tehlike { border:0; background:#DC2626; color:#fff; }
.zrv-kucuk { min-height:38px; padding:7px 13px; font-size:13px; }
.zrv-tam { width:100%; margin-top:10px; }
.zrv-mesaj { display:flex; align-items:flex-start; gap:9px; padding:11px 13px; border-radius:12px; font-size:13px; line-height:1.5; }
.zrv-hata { background:#FEF2F2; color:#991B1B; } .zrv-bilgi { background:#EFF6FF; color:#1E40AF; }
.zrv-bos { display:flex; align-items:flex-start; gap:10px; padding:13px 14px; border-radius:14px; background:#F8FAFC; color:#475569; font-size:13px; line-height:1.55; }
.zrv-bos-buyuk { padding:22px 18px; font-size:14px; }
.zrv-yukleniyor { display:flex; align-items:center; justify-content:center; gap:10px; padding:18px; color:#64748B; font-size:13.5px; }
.zrv-donen { width:16px; height:16px; border:2px solid #4A7C59; border-right-color:transparent; border-radius:50%; display:inline-block; animation:zrvDon .8s linear infinite; }
.zrv-donen-beyaz { border-color:#fff; border-right-color:transparent; }
@keyframes zrvDon { to { transform:rotate(360deg); } }
.zrv-basari { display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; padding:10px 4px 20px; }
.zrv-basari-ikon { width:64px; height:64px; border-radius:50%; display:grid; place-items:center; background:#DCFCE7; color:#15803D; margin-bottom:6px; }
.zrv-basari h4 { margin:0; font-size:19px; font-weight:800; } .zrv-basari p { margin:0; font-size:14px; color:#334155; } .zrv-soluk { color:#64748B !important; font-size:13px !important; max-width:360px; }
.zrv-basari-eylem { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:12px; padding-bottom:18px; }
.zrv-liste-cocuk { margin-bottom:12px; }
.zrv-liste-baslik { display:flex; align-items:center; gap:7px; margin:18px 2px 9px; font-size:12.5px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:.4px; }
.zrv-liste-baslik span { font-size:11.5px; color:#94A3B8; }
.zrv-kart { display:flex; gap:13px; padding:14px 15px; margin-bottom:10px; background:#fff; border:1px solid #EEF2F0; border-left:4px solid var(--zrv-cizgi); border-radius:16px; box-shadow:0 2px 10px rgba(30,41,59,.04); }
.zrv-kart-gecmis { opacity:.72; }
.zrv-tarih { width:52px; flex-shrink:0; align-self:flex-start; display:flex; flex-direction:column; align-items:center; padding:8px 0; border-radius:13px; background:var(--zrv-acik); color:var(--zrv-renk); }
.zrv-tarih strong { font-size:21px; line-height:1; } .zrv-tarih span { font-size:11px; font-weight:800; text-transform:uppercase; margin-top:3px; }
.zrv-kart-govde { flex:1; min-width:0; }
.zrv-kart-ust { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; flex-wrap:wrap; } .zrv-kart-ust strong { font-size:15px; }
.zrv-rozet { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:800; white-space:nowrap; }
.zrv-kart-alt { display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin-top:5px; font-size:12.5px; color:#64748B; }
.zrv-not { display:flex; gap:7px; align-items:flex-start; margin:9px 0 0; padding:9px 11px; border-radius:10px; background:#F8FAFC; color:#475569; font-size:12.5px; line-height:1.5; }
.zrv-not-mavi { background:#EFF6FF; color:#1E40AF; } .zrv-not-kirmizi { background:#FEF2F2; color:#991B1B; }
.zrv-teklif { display:flex; gap:8px; align-items:flex-start; margin-top:10px; padding:10px 12px; border-radius:12px; background:#DBEAFE; color:#1E3A8A; font-size:13px; line-height:1.5; }
.zrv-eylemler { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
.zrv-neden { margin-top:10px; padding:12px; border-radius:12px; background:#F8FAFC; }
.zrv-bos-kart { display:flex; flex-direction:column; align-items:center; gap:8px; padding:30px 20px !important; text-align:center; color:#94A3B8; }
.zrv-bos-kart strong { color:#1E293B; font-size:15px; } .zrv-bos-kart span { color:#64748B; font-size:13px; max-width:320px; line-height:1.55; }
.zrv-kart-bos { padding:26px !important; }
.zrv-mini { display:flex; align-items:center; gap:11px; width:100%; padding:8px 0; border:0; border-top:1px solid #F1F5F4; background:none; font:inherit; text-align:left; cursor:pointer; color:#1E293B; }
.zrv-mini:first-child { border-top:0; } .zrv-mini .zrv-tarih { width:44px; padding:6px 0; } .zrv-mini .zrv-tarih strong { font-size:17px; }
.zrv-mini-metin { flex:1; min-width:0; display:flex; flex-direction:column; font-size:12px; color:#64748B; } .zrv-mini-metin strong { font-size:13.5px; color:#1E293B; }
@media (max-width:520px) {
  .zrv-arka { padding:0; align-items:flex-end; }
  .zrv-pencere { max-width:none; max-height:94vh; border-radius:22px 22px 0 0; }
  .zrv-govde { padding:14px 16px 0; } .zrv-ozet { margin:0 -16px; padding:12px 16px 14px; flex-wrap:wrap; } .zrv-ozet .zrv-birincil { width:100%; }
  .zrv-turler { grid-template-columns:1fr; } .zrv-tur { flex-direction:row; align-items:center; gap:12px; } .zrv-tur-ikon { margin:0; flex-shrink:0; }
}
@media (prefers-reduced-motion:reduce) { .zrv-arka, .zrv-donen { animation:none; } }
`;
  document.head.appendChild(st);
}
