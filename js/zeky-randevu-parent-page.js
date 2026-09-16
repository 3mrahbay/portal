import {
  callableCutoverAcikMi, dugme, gunAnahtari, gunYazi, guvenliId,
  istekIzleyiciOlustur, metinElemani, randevuOturumDegisimiDinle,
  randevuServisiGetir, zamanYazi
} from './zeky-randevu-cutover-runtime.js';

const TIPLER = Object.freeze({
  ogretmen_veli: 'Öğretmen',
  pdr: 'PDR',
  idare: 'Yönetim'
});
const DURUMLAR = Object.freeze({
  talep: 'Onay bekliyor',
  dolu: 'Onaylandı',
  alternatif_teklif: 'Farklı saat önerildi',
  reddedildi: 'Reddedildi',
  teklif_reddedildi: 'Teklif reddedildi',
  iptal: 'İptal edildi'
});

const durum = {
  api: null,
  cocuklar: [],
  ogrenciId: '',
  tip: 'ogretmen_veli',
  hedefler: [],
  hedef: null,
  slotlar: [],
  randevular: [],
  yukleniyor: false,
  oturumAktif: true,
  oturumSurumu: 0
};
const istekler = istekIzleyiciOlustur();

function eleman(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Eksik sayfa öğesi: ${id}`);
  return node;
}

function mesaj(yazi, hata = false) {
  const alan = eleman('durumMesaji');
  alan.textContent = yazi;
  alan.classList.toggle('hata', hata);
  alan.hidden = !yazi;
}

function hataMetni(error, varsayilan) {
  const code = String(error?.code || '');
  if (code.includes('unauthenticated')) return 'Oturum doğrulanamadı.';
  if (code.includes('permission-denied')) return 'Bu kayıt için erişim izniniz yok.';
  if (code.includes('failed-precondition')) return 'Randevu servisi şu anda hazır değil.';
  return varsayilan;
}

function oturumuKapat() {
  durum.oturumAktif = false;
  durum.oturumSurumu += 1;
  durum.api = null;
  durum.cocuklar = [];
  durum.ogrenciId = '';
  durum.hedefler = [];
  durum.hedef = null;
  durum.slotlar = [];
  durum.randevular = [];
  eleman('talepAlani').hidden = true;
  eleman('cocukSec').replaceChildren();
  eleman('randevuListesi').replaceChildren();
  eleman('hedefler').replaceChildren();
  eleman('slotlar').replaceChildren();
  mesaj('Oturum değişti. Randevu verileri temizlendi; sayfayı yeniden açın.', true);
}

function randevuKarti(row) {
  const kart = document.createElement('article');
  kart.className = 'kart';
  const durumSinifi = Object.hasOwn(DURUMLAR, row.durum) ? row.durum : '';
  const ust = document.createElement('div');
  ust.className = 'kart-ust';
  ust.append(
    metinElemani('strong', zamanYazi(row.baslangicMillis)),
    metinElemani('span', DURUMLAR[row.durum] || 'Durum bilinmiyor', `rozet ${durumSinifi}`)
  );
  kart.append(
    ust,
    metinElemani('div', `${TIPLER[row.tip] || 'Randevu'} · ${row.hedefAd || 'Personel'}`, 'ikincil')
  );
  if (row.veliNotu) kart.append(metinElemani('p', row.veliNotu, 'not'));
  if (row.retNedeni) kart.append(metinElemani('p', `Ret nedeni: ${row.retNedeni}`, 'not'));
  if (row.teklifRetNedeni) kart.append(metinElemani('p', `Teklif ret nedeni: ${row.teklifRetNedeni}`, 'not'));
  if (row.iptalNedeni) kart.append(metinElemani('p', `İptal nedeni: ${row.iptalNedeni}`, 'not'));

  const islemler = document.createElement('div');
  islemler.className = 'islemler';
  if (row.durum === 'alternatif_teklif') {
    kart.append(metinElemani(
      'p',
      `Önerilen saat: ${zamanYazi(row.teklifBaslangicMillis)}${row.teklifNotu ? ` · ${row.teklifNotu}` : ''}`,
      'teklif'
    ));
    islemler.append(
      dugme('Kabul et', () => teklifKabul(row.id), 'birincil'),
      dugme('Reddet', () => teklifReddet(row.id), 'tehlike')
    );
  } else if (['talep', 'dolu'].includes(row.durum)) {
    islemler.append(dugme('İptal et', () => iptalEt(row.id), 'ikincil-buton'));
  }
  if (islemler.childElementCount) kart.append(islemler);
  return kart;
}

function randevulariCiz() {
  const alan = eleman('randevuListesi');
  alan.replaceChildren();
  if (!durum.randevular.length) {
    alan.append(metinElemani('p', 'Bu çocuk için randevu bulunmuyor.', 'bos'));
    return;
  }
  for (const row of durum.randevular) alan.append(randevuKarti(row));
}

function cocuklariCiz() {
  const select = eleman('cocukSec');
  select.replaceChildren();
  for (const cocuk of durum.cocuklar) {
    const option = document.createElement('option');
    option.value = cocuk.id;
    option.textContent = cocuk.ad;
    option.selected = cocuk.id === durum.ogrenciId;
    select.append(option);
  }
  select.disabled = durum.cocuklar.length < 2;
}

async function cocukDegistir(ogrenciId) {
  const next = durum.cocuklar.find(row => row.id === ogrenciId);
  if (!next || durum.yukleniyor) {
    cocuklariCiz();
    return;
  }
  durum.ogrenciId = next.id;
  durum.hedefler = [];
  durum.hedef = null;
  durum.slotlar = [];
  durum.randevular = [];
  hedefleriCiz();
  slotlariCiz();
  randevulariCiz();
  try {
    await Promise.all([randevulariYukle(), hedefleriYukle()]);
  } catch (error) {
    if (!durum.oturumAktif) return;
    durum.randevular = [];
    randevulariCiz();
    mesaj(hataMetni(error, 'Randevu listesi güvenli biçimde yüklenemedi.'), true);
  }
}

function tipleriCiz() {
  const alan = eleman('tipler');
  alan.replaceChildren();
  for (const [kod, ad] of Object.entries(TIPLER)) {
    const button = dugme(ad, async () => {
      if (durum.yukleniyor || kod === durum.tip) return;
      durum.tip = kod;
      durum.hedefler = [];
      durum.hedef = null;
      durum.slotlar = [];
      tipleriCiz();
      hedefleriCiz();
      slotlariCiz();
      await hedefleriYukle();
    }, `secim${kod === durum.tip ? ' aktif' : ''}`);
    alan.append(button);
  }
}

function hedefleriCiz() {
  const alan = eleman('hedefler');
  alan.replaceChildren();
  if (!durum.hedefler.length) {
    alan.append(metinElemani('p', 'Bu görev türünde uygun kişi bulunmuyor.', 'bos'));
    return;
  }
  for (const hedef of durum.hedefler) {
    alan.append(dugme(hedef.ad, async () => {
      durum.hedef = hedef;
      durum.slotlar = [];
      hedefleriCiz();
      slotlariCiz();
      await slotlariYukle();
    }, `hedef${durum.hedef?.kod === hedef.kod ? ' aktif' : ''}`));
  }
}

function slotlariCiz() {
  const alan = eleman('slotlar');
  alan.replaceChildren();
  if (!durum.hedef) {
    alan.append(metinElemani('p', 'Önce görüşülecek kişiyi seçin.', 'bos'));
    return;
  }
  if (!durum.slotlar.length) {
    alan.append(metinElemani('p', 'Bu kişi için uygun saat bulunmuyor.', 'bos'));
    return;
  }
  const gruplar = new Map();
  for (const slot of durum.slotlar) {
    const gun = gunAnahtari(slot.baslangicMillis);
    if (!gruplar.has(gun)) gruplar.set(gun, []);
    gruplar.get(gun).push(slot);
  }
  for (const slots of gruplar.values()) {
    const kart = document.createElement('section');
    kart.className = 'slot-gun';
    kart.append(metinElemani('strong', gunYazi(slots[0].baslangicMillis)));
    const butonlar = document.createElement('div');
    butonlar.className = 'slot-butonlar';
    for (const slot of slots) {
      const saat = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).format(new Date(slot.baslangicMillis));
      butonlar.append(dugme(saat, () => talepOlustur(slot), 'saat'));
    }
    kart.append(butonlar);
    alan.append(kart);
  }
}

async function randevulariYukle() {
  if (!durum.oturumAktif || !durum.api) return;
  const surum = durum.oturumSurumu;
  const ogrenciId = durum.ogrenciId;
  const rows = await durum.api.randevularim(ogrenciId);
  if (!durum.oturumAktif || durum.oturumSurumu !== surum ||
      durum.ogrenciId !== ogrenciId) return;
  durum.randevular = rows;
  randevulariCiz();
}

async function hedefleriYukle() {
  if (!durum.oturumAktif || !durum.api) return;
  const surum = durum.oturumSurumu;
  const ogrenciId = durum.ogrenciId;
  const istekTip = durum.tip;
  durum.yukleniyor = true;
  mesaj('Kişiler yükleniyor…');
  try {
    const rows = await durum.api.hedefleriGetir(ogrenciId, istekTip);
    if (!durum.oturumAktif || durum.oturumSurumu !== surum ||
        durum.ogrenciId !== ogrenciId || durum.tip !== istekTip) return;
    durum.hedefler = rows;
    durum.hedef = durum.hedefler[0] || null;
    hedefleriCiz();
    if (durum.hedef) await slotlariYukle();
    else mesaj('');
  } catch (error) {
    if (!durum.oturumAktif || durum.oturumSurumu !== surum) return;
    durum.hedefler = [];
    durum.hedef = null;
    hedefleriCiz();
    slotlariCiz();
    mesaj(hataMetni(error, 'Kişiler güvenli biçimde yüklenemedi.'), true);
  } finally {
    durum.yukleniyor = false;
  }
}

async function slotlariYukle() {
  const hedef = durum.hedef;
  if (!durum.oturumAktif || !durum.api || !hedef) return;
  const surum = durum.oturumSurumu;
  const ogrenciId = durum.ogrenciId;
  const istekTip = durum.tip;
  mesaj('Saatler yükleniyor…');
  try {
    const rows = await durum.api.saatleriGetir(ogrenciId, hedef.kod, istekTip);
    if (!durum.oturumAktif || durum.oturumSurumu !== surum ||
        durum.ogrenciId !== ogrenciId || durum.tip !== istekTip ||
        durum.hedef?.kod !== hedef.kod) return;
    durum.slotlar = rows;
    slotlariCiz();
    mesaj('');
  } catch (error) {
    if (!durum.oturumAktif || durum.oturumSurumu !== surum ||
        durum.hedef?.kod !== hedef.kod) return;
    durum.slotlar = [];
    slotlariCiz();
    mesaj(hataMetni(error, 'Saatler güvenli biçimde yüklenemedi.'), true);
  }
}

async function talepOlustur(slot) {
  if (!durum.oturumAktif || !durum.api || !durum.hedef || durum.yukleniyor) return;
  const surum = durum.oturumSurumu;
  const not = globalThis.prompt('Görüşme konusu (isteğe bağlı):', '');
  if (not === null) return;
  const payload = `${durum.ogrenciId}|${durum.hedef.kod}|${slot.slotKodu}|${not.trim()}`;
  const requestId = istekler.anahtar('create_parent', slot.slotKodu, payload);
  durum.yukleniyor = true;
  try {
    await durum.api.veliRandevuOlustur({
      requestId,
      ogrenciId: durum.ogrenciId,
      hedefKodu: durum.hedef.kod,
      slotKodu: slot.slotKodu,
      not: not.trim()
    });
  } catch (error) {
    if (!durum.oturumAktif || durum.oturumSurumu !== surum) return;
    mesaj(hataMetni(error, 'Talep gönderilemedi; tekrar deneyebilirsiniz.'), true);
    durum.yukleniyor = false;
    return;
  } finally {
    durum.yukleniyor = false;
  }
  if (!durum.oturumAktif || durum.oturumSurumu !== surum) return;
  istekler.tamamla('create_parent', slot.slotKodu, payload);
  mesaj('Randevu talebi onaya gönderildi.');
  try {
    await Promise.all([randevulariYukle(), slotlariYukle()]);
  } catch (_) {
    if (durum.oturumAktif && durum.oturumSurumu === surum) {
      durum.randevular = [];
      randevulariCiz();
      mesaj('Talep gönderildi ancak liste yenilenemedi. Sayfayı yeniden açın.', true);
    }
  }
}

async function komut(action, id, payload, calistir, basari) {
  if (!durum.oturumAktif || !durum.api || durum.yukleniyor) return;
  const surum = durum.oturumSurumu;
  const requestId = istekler.anahtar(action, id, payload);
  durum.yukleniyor = true;
  try {
    await calistir(requestId);
  } catch (error) {
    if (!durum.oturumAktif || durum.oturumSurumu !== surum) return;
    mesaj(hataMetni(error, 'İşlem tamamlanamadı; tekrar deneyebilirsiniz.'), true);
    durum.yukleniyor = false;
    return;
  } finally {
    durum.yukleniyor = false;
  }
  if (!durum.oturumAktif || durum.oturumSurumu !== surum) return;
  istekler.tamamla(action, id, payload);
  mesaj(basari);
  try {
    await randevulariYukle();
  } catch (_) {
    if (durum.oturumAktif && durum.oturumSurumu === surum) {
      durum.randevular = [];
      randevulariCiz();
      mesaj('İşlem tamamlandı ancak liste yenilenemedi. Sayfayı yeniden açın.', true);
    }
  }
}

async function teklifKabul(id) {
  await komut('accept_proposal', id, '',
    key => durum.api.teklifiKabulEt(key, id), 'Yeni saat kabul edildi.');
}

async function teklifReddet(id) {
  const neden = globalThis.prompt('Teklif neden reddediliyor?', '');
  if (neden === null || !neden.trim()) return;
  await komut('reject_proposal', id, neden.trim(),
    key => durum.api.teklifiReddet(key, id, neden.trim()), 'Saat teklifi reddedildi.');
}

async function iptalEt(id) {
  const neden = globalThis.prompt('Randevu neden iptal ediliyor?', '');
  if (neden === null || !neden.trim()) return;
  await komut('cancel', id, neden.trim(),
    key => durum.api.iptalEt(key, id, neden.trim()), 'Randevu iptal edildi.');
}

async function baslat() {
  tipleriCiz();
  hedefleriCiz();
  slotlariCiz();
  if (!callableCutoverAcikMi()) {
    eleman('talepAlani').hidden = true;
    mesaj('Randevu sistemi güvenli geçiş tamamlanana kadar kapalıdır.', true);
    return;
  }
  const surum = durum.oturumSurumu;
  try {
    const api = await randevuServisiGetir();
    if (!durum.oturumAktif || durum.oturumSurumu !== surum) return;
    durum.api = api;
    randevuOturumDegisimiDinle(oturumuKapat);
    if (!durum.oturumAktif || durum.oturumSurumu !== surum) return;
    const children = await api.veliOgrencileri();
    if (!durum.oturumAktif || durum.oturumSurumu !== surum) return;
    durum.cocuklar = children;
    const istenen = guvenliId(new URLSearchParams(location.search).get('ogrenci'));
    const secili = durum.cocuklar.find(row => row.id === istenen) || durum.cocuklar[0];
    if (!secili) {
      eleman('talepAlani').hidden = true;
      mesaj('Randevuya açık öğrenci kaydı bulunamadı.', true);
      return;
    }
    durum.ogrenciId = secili.id;
    cocuklariCiz();
    eleman('cocukSec').addEventListener('change', event => cocukDegistir(event.target.value));
    eleman('talepAlani').hidden = false;
    await Promise.all([randevulariYukle(), hedefleriYukle()]);
  } catch (error) {
    if (!durum.oturumAktif || durum.oturumSurumu !== surum) return;
    eleman('talepAlani').hidden = true;
    mesaj(hataMetni(error, 'Randevu servisine güvenli bağlantı kurulamadı.'), true);
  }
}

baslat();
