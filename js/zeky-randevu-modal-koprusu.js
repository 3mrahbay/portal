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
import { kartOzeti } from './finans/core.js';
import './zeky-galeri-filigran-koprusu.js?v=10';
import './zeky-gozlem-modal-modern.js?v=1';
import './zeky-randevu-veli-arayuz.js?v=1';


// ── Veli randevu arayüzü ─────────────────────────────────────────────
// Talep penceresi, "Randevularım" listesi, ana sayfa kartı ve yönetime
// bildirim artık ./zeky-randevu-veli-arayuz.js içinde (portal tasarım
// dili). Veri yolu aynı: randevuSorguV3 / randevuKomutV3.

function kacar(metin) {
  return String(metin == null ? '' : metin)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
let odemeKartDinleyici = null;
let odemeKartGuncellemePlanli = false;

function odemeKartiniYaz(kart, ozet) {
 const color=ozet.renk==='turuncu'?'#fff0df':ozet.renk==='yesil'?'#e4f5e9':'#fff';
 kart.style.background=color;
 kart.innerHTML=`<div class="ca-head" style="font-size:18px">${kacar(ozet.baslik)}</div>
 ${(ozet.ekler||[]).map(r=>`<div class="ca-tile-sub">${kacar(r.ad)}: ${r.durum==='odendi'?'Ödendi':r.durum==='kismi'?'Kısmen ödendi':r.durum==='tanimsiz'?'Tanımlanmamış':'Ödenmedi'}</div>`).join('')}
 <button type="button" class="ca-btn" data-zeky-odeme-detay style="margin-top:12px">${ozet.secilen?.kalan>0?'Ödeme Bildir':'Ödemeleri Gör'}</button>`;
 kart.querySelector('[data-zeky-odeme-detay]')?.addEventListener('click',()=>window.veliSwitchTab?.('odemeler'));
 kart.dataset.zekyOdemeDurum='hazir';
}

async function veliOdemeKartiniGuncelle() {
  const kart = document.querySelector('.ca-page .ca-pay');
  const portal = window.PortalAPI;
  const durum = portal?.state || {};
  const ogrenciId = String(durum.veliAktifOgrenci?.id || '');
  const donem = String(durum.aktifDonem || '');
  if (!kart && odemeKartDinleyici) { odemeKartDinleyici(); odemeKartDinleyici=null; }
  if (!kart || !portal?.db || !portal?.fb?.doc || !portal?.fb?.getDoc || !guvenliId(ogrenciId) || !donem) return;

  const anahtar = `${ogrenciId}|${donem}`;
  if (kart.dataset.zekyOdemeAnahtar === anahtar &&
      (kart.dataset.zekyOdemeDurum === 'yukleniyor' || kart.dataset.zekyOdemeDurum === 'hazir')) return;

  const istekNo = ++odemeKartIstekNo;
  if(odemeKartDinleyici) { odemeKartDinleyici(); odemeKartDinleyici=null; }
  kart.dataset.zekyOdemeAnahtar = anahtar;
  kart.dataset.zekyOdemeDurum = 'yukleniyor';
  odemeKartiniYaz(kart, {
    durum: 'plansiz', baslik: 'Ödeme durumu', rozet: 'Yükleniyor', tutar: null,
    aciklama: 'Gerçek ödeme bilgileriniz alınıyor.', eylem: 'Ödemeleri Gör'
  });
  kart.dataset.zekyOdemeDurum = 'yukleniyor';

  try {
    const referans = portal.fb.doc(portal.db, 'ogrenciler', ogrenciId, 'donemler', donem);
    const yaz = (belge) => {
      if(istekNo!==odemeKartIstekNo || !kart.isConnected || window.PortalAPI?.state?.veliAktifOgrenci?.id!==ogrenciId)return;
      odemeKartiniYaz(kart,kartOzeti(belge.exists()?belge.data():null,new Date()));
    };
    if(portal.fb.onSnapshot){odemeKartDinleyici=portal.fb.onSnapshot(referans,yaz,()=>odemeKartiniYaz(kart,{baslik:'Ödeme bilgileri okunamadı. Ödemelerim ekranından yeniden deneyin.'}));return;}
    const belge = await portal.fb.getDoc(referans);
    const guncelKart = document.querySelector('.ca-page .ca-pay');
    const guncelOgrenciId = String(window.PortalAPI?.state?.veliAktifOgrenci?.id || '');
    if (istekNo !== odemeKartIstekNo || guncelKart !== kart || guncelOgrenciId !== ogrenciId) return;
    odemeKartiniYaz(kart, kartOzeti(belge.exists() ? belge.data() : null, new Date()));
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
