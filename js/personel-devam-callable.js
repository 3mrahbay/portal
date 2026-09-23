// Personel devam callable istemcisi. Portal (js/personel-devam-callable.js) ve
// ZEKY (www/js/zeky-devam-callable.js) bu dosyanın birebir kopyasını kullanır.
// Firebase SDK sürümüne bağlı kalmamak için httpsCallable dışarıdan verilir.
// İstemci e-posta, saat, tarih, onay veya yöntem göndermez; bunları sunucu koyar.

export const DEVAM_CALLABLE_ADI = 'personelDevamKomutV1';
const QR_ISLEMLERI = ['giris', 'cikis'];
const MOLA_ISLEMLERI = ['mola-basla', 'mola-bitir'];

function sayi(deger) {
  const n = Number(deger);
  if (!Number.isFinite(n)) throw new Error('Konum bilgisi okunamadı.');
  return n;
}

export function devamIstegi(islem, kaynak, { qr = '', konum = null } = {}) {
  if (!['portal', 'zeky'].includes(kaynak)) throw new Error('Geçersiz kaynak.');
  if (MOLA_ISLEMLERI.includes(islem)) return { islem, kaynak };
  if (!QR_ISLEMLERI.includes(islem)) throw new Error('Geçersiz devam işlemi.');
  if (typeof qr !== 'string' || !qr.trim()) throw new Error('QR okunamadı.');
  if (!konum) throw new Error('Konum alınamadı.');
  return {
    islem,
    kaynak,
    qr: qr.trim(),
    konum: {
      enlem: sayi(konum.enlem),
      boylam: sayi(konum.boylam),
      dogrulukMetre: sayi(konum.dogrulukMetre)
    }
  };
}

export function devamHataMetni(hata) {
  const kod = hata?.details?.kod;
  if (kod === 'OKUL_DISINDA' && Number.isFinite(hata.details.uzaklikMetre)) {
    return `Okul alanı dışındasınız (${hata.details.uzaklikMetre} m). Kayıt yapılmadı.`;
  }
  if (hata?.message && String(hata.code || '').startsWith('functions/') &&
      hata.code !== 'functions/internal' && hata.code !== 'functions/unavailable') {
    return hata.message;
  }
  return 'Kayıt yapılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
}

export function devamServisiOlustur({ functions, httpsCallable }) {
  if (!functions || typeof httpsCallable !== 'function') {
    throw new Error('Firebase Functions bağlantısı gerekli.');
  }
  const komut = httpsCallable(functions, DEVAM_CALLABLE_ADI, {
    limitedUseAppCheckTokens: true
  });
  return Object.freeze({
    async gonder(islem, kaynak, ek = {}) {
      const yanit = await komut(devamIstegi(islem, kaynak, ek));
      if (!yanit || !yanit.data || yanit.data.ok !== true) {
        throw new Error('Devam servisi geçersiz yanıt verdi.');
      }
      return yanit.data;
    }
  });
}
