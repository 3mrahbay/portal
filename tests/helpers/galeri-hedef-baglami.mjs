// Galeri çoklu çocuk (js/galeri-hedefi.js): vm ile dilimlenen index.html / modül kodu için ortak globaller.
// Test kurguları bunları bağlama yayar; içe aktarmalar silindiği için gerçek fonksiyonlar buradan gelir.
import * as G from '../../js/galeri-hedefi.js';

export const GALERI_HEDEF_GLOBALS = Object.freeze({
  galeriCocuklari: G.galeriCocuklari,
  galeriCocugaAitMi: G.galeriCocugaAitMi,
  galeriHedefAnahtari: G.galeriHedefAnahtari,
  fotoIzniGeriAlinanlar: G.fotoIzniGeriAlinanlar,
  galeriHedefAlanlari: G.galeriHedefAlanlari,
  galeriHedefKopyala: G.galeriHedefKopyala,
  galeriVeliEtiketi: G.galeriVeliEtiketi,
  GALERI_EN_FAZLA_COCUK: G.GALERI_EN_FAZLA_COCUK,
  IZIN_YOK_METNI: G.IZIN_YOK_METNI,
  GALERI_IZIN_KONTROL_SURUMU: G.GALERI_IZIN_KONTROL_SURUMU
});

// index.html galeriYayinIzniDogrula ile aynı davranış (izin okuyucu verilir)
export function yayinIzniDogrulayici(oku) {
  return async cocuklar => {
    const liste = (cocuklar || []).filter(Boolean);
    if (!liste.length) return true;
    let izinsiz;
    try { izinsiz = await oku(); }
    catch (e) { throw Object.assign(new Error('Fotoğraf izinleri doğrulanamadı. Bağlantıyı kontrol edip yeniden deneyin.'), { izinHatasi: 'okunamadi' }); }
    const sayi = liste.filter(id => izinsiz.has(id)).length;
    if (sayi) throw Object.assign(new Error(`Seçilen öğrencilerden ${sayi} tanesinin fotoğraf izni geri alınmış.`), { izinHatasi: 'geriAlindi', izinsiz });
    return true;
  };
}

// Yükleme kurgusu: seçicide seçili öğrenciler ve izni geri alınmış öğrenciler (sunucu okuması)
export function galeriYuklemeBaglami({ secili = [], izinsiz = [], secilebilir = null, izinOkumaHatasi = false } = {}) {
  const liste = secilebilir || secili.map(o => ({ id: o.id, ad: o.ad || '', sinif: o.sinif || '' }));
  return {
    ...GALERI_HEDEF_GLOBALS,
    galeriOgrenciSecici: { seciliOgrenciler: () => secili.map(o => ({ ...o })), seciliIdler: () => secili.map(o => o.id), ogrencileriAyarla() {} },
    galeriIzinsizIdler: null,
    galeriSecilebilirOgrenciler: () => liste,
    hedefSecilebilirOgrenciler: () => liste,
    galeriIzinsizleriOku: async () => { if (izinOkumaHatasi) throw new Error('izin okunamadı'); return new Set(izinsiz); },
    galeriYayinIzniDogrula: yayinIzniDogrulayici(async () => { if (izinOkumaHatasi) throw new Error('izin okunamadı'); return new Set(izinsiz); })
  };
}
