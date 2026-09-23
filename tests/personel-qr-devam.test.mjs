import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kaynak = await readFile(new URL('../js/personel-qr-devam.js', import.meta.url), 'utf8');
const adaptorKaynak = await readFile(new URL('../js/personel-devam-callable.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const { qrCoz, devamDurumu } = await import('../js/personel-qr-devam.js');
const { devamIstegi, devamHataMetni, devamServisiOlustur } = await import('../js/personel-devam-callable.js');

// Sunucunun (personelDevamKomutV1) yazdığı yeni kayıt biçimi.
const SUNUCU_KAYITLARI = [
  { personelEmail: 'a@okul.test', personelAd: 'A', tip: 'giris', zaman: '2026-09-24T05:00:00.000Z',
    tarih: '2026-09-24', yontem: 'qr', onayli: true, kaynak: 'portal',
    konum: { okulda: true, uzaklikMetre: 23, dogrulukMetre: 12 } },
  { personelEmail: 'a@okul.test', personelAd: 'A', tip: 'mola-basla', zaman: '2026-09-24T09:00:00.000Z',
    tarih: '2026-09-24', yontem: 'mola', onayli: true, kaynak: 'zeky' },
  { personelEmail: 'a@okul.test', personelAd: 'A', tip: 'mola-bitir', zaman: '2026-09-24T09:30:00.000Z',
    tarih: '2026-09-24', yontem: 'mola', onayli: true, kaynak: 'zeky' },
  { personelEmail: 'a@okul.test', personelAd: 'A', tip: 'cikis', zaman: '2026-09-24T14:00:00.000Z',
    tarih: '2026-09-24', yontem: 'qr', onayli: true, kaynak: 'portal',
    konum: { okulda: true, uzaklikMetre: 40, dogrulukMetre: 9 } }
];

test('portal artık puantaja, personelDurum’a ve QR ayarına doğrudan dokunmaz', () => {
  assert.doesNotMatch(kaynak, /addDoc|setDoc|updateDoc/);
  assert.doesNotMatch(kaynak, /'config', 'okulQR'/);
  assert.doesNotMatch(kaynak, /enlem: konum\.enlem/);
  assert.doesNotMatch(kaynak, /onayli|yontem/);
  assert.match(kaynak, /sunucuyaGonder\(tip, \{ qr: metin, konum \}\)/);
  assert.match(kaynak, /Giriş ve çıkış için okul QR/);
  assert.match(kaynak, /import\('\.\/zeky-randevu-cutover-runtime\.js'\)/);
});

test('mola düğmeleri de sunucudan geçer', () => {
  assert.match(kaynak, /window\.devamKaydet = async function\(tip\)/);
  assert.match(kaynak, /await sunucuyaGonder\(tip\);/);
  assert.doesNotMatch(kaynak, /asilKaydet/);
});

test('yalnız ZEKY devam QR biçimi kameradan kabul edilir', () => {
  assert.deepEqual(qrCoz('ZEKY-DEVAM:BCKA:ABC123'), { okulId: 'BCKA', jeton: 'ABC123' });
  assert.equal(qrCoz('https://ornek.test/qr'), null);
  assert.equal(qrCoz('ZEKY-DEVAM:BCKA:'), null);
});

test('istek yalnız işlem, QR, konum ve kaynak taşır', () => {
  assert.deepEqual(devamIstegi('giris', 'portal', {
    qr: ' ZEKY-DEVAM:BCKA:X ', konum: { enlem: 40.9, boylam: 29.3, dogrulukMetre: 12, zaman: 1 }
  }), {
    islem: 'giris', kaynak: 'portal', qr: 'ZEKY-DEVAM:BCKA:X',
    konum: { enlem: 40.9, boylam: 29.3, dogrulukMetre: 12 }
  });
  assert.deepEqual(devamIstegi('mola-basla', 'portal', { qr: 'x', konum: {} }),
    { islem: 'mola-basla', kaynak: 'portal' });
  assert.throws(() => devamIstegi('giris', 'portal', { qr: 'x' }), /Konum/);
  assert.throws(() => devamIstegi('sil', 'portal'), /Geçersiz/);
  for (const alan of ['personelEmail', 'zaman', 'tarih', 'onayli', 'yontem']) {
    assert.doesNotMatch(adaptorKaynak, new RegExp(`${alan}:`), alan);
  }
});

test('callable tek kullanımlık App Check tokenıyla çağrılır', async () => {
  let secenek, gonderilen;
  const servis = devamServisiOlustur({
    functions: {},
    httpsCallable: (_f, ad, s) => {
      assert.equal(ad, 'personelDevamKomutV1');
      secenek = s;
      return async veri => { gonderilen = veri; return { data: { ok: true, zaman: '2026-09-24T05:00:00.000Z' } }; };
    }
  });
  await servis.gonder('mola-bitir', 'portal');
  assert.deepEqual(secenek, { limitedUseAppCheckTokens: true });
  assert.deepEqual(gonderilen, { islem: 'mola-bitir', kaynak: 'portal' });
});

test('sunucu hataları anlaşılır Türkçe mesaja çevrilir', () => {
  assert.equal(devamHataMetni({ code: 'functions/failed-precondition',
    message: 'x', details: { kod: 'OKUL_DISINDA', uzaklikMetre: 240 } }),
  'Okul alanı dışındasınız (240 m). Kayıt yapılmadı.');
  assert.equal(devamHataMetni({ code: 'functions/failed-precondition',
    message: 'Çıkıştan önce “Moladan Dön” düğmesine basın.' }),
  'Çıkıştan önce “Moladan Dön” düğmesine basın.');
  assert.match(devamHataMetni({ code: 'functions/internal', message: 'iç ayrıntı' }), /İnternet/);
  assert.match(devamHataMetni(new Error('ağ')), /İnternet/);
});

test('devam durumu sunucu kayıtlarından doğru türetilir', () => {
  assert.equal(devamDurumu(SUNUCU_KAYITLARI.slice(0, 2)), 'molada');
  assert.equal(devamDurumu(SUNUCU_KAYITLARI.slice(0, 3)), 'iceride');
  assert.equal(devamDurumu(SUNUCU_KAYITLARI), 'disarida');
});

test('aylık puantaj raporu sunucu kayıtlarını okur (mola düşülür)', () => {
  const bas = html.indexOf('const gunNetDakika = (hareketler, gunTarihi) => {');
  const son = html.indexOf('\n  };', bas);
  assert.ok(bas > 0 && son > bas, 'rapor hesabı bulunamadı');
  const gunNetDakika = new Function(`return (${html.slice(bas + 'const gunNetDakika = '.length, son + 4)})`)();
  const sonuc = gunNetDakika(SUNUCU_KAYITLARI, '2026-09-24');
  assert.equal(Math.round(sonuc.net), 510);
  assert.equal(Math.round(sonuc.mola), 30);
  assert.equal(sonuc.eksikCikis, false);
});

test('rapor ve log ekranları yalnız sunucunun koruduğu alanları okur', () => {
  // QR log ekranı konum özetini "konumlu" olarak gösterir; tam koordinat okunmaz.
  assert.match(html, /\$\{k\.konum \? " · konumlu" : ""\}/);
  // Tek konum yazımı yönetimin okul konumunu kaydetmesidir (personel değil).
  assert.equal((html.match(/konum\.enlem/g) || []).length, 1);
  assert.match(html, /enlem:konum\.enlem, boylam:konum\.boylam, yaricapMetre/);
});
