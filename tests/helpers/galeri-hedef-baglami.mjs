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
  IZIN_YOK_METNI: G.IZIN_YOK_METNI
});

// Yükleme kurgusu: seçicide seçili öğrenciler ve izni geri alınmış öğrenciler (sunucu okuması)
export function galeriYuklemeBaglami({ secili = [], izinsiz = [], secilebilir = null, izinOkumaHatasi = false } = {}) {
  const liste = secilebilir || secili.map(o => ({ id: o.id, ad: o.ad || '', sinif: o.sinif || '' }));
  return {
    ...GALERI_HEDEF_GLOBALS,
    galeriOgrenciSecici: { seciliOgrenciler: () => secili.map(o => ({ ...o })), seciliIdler: () => secili.map(o => o.id), ogrencileriAyarla() {} },
    galeriIzinsizIdler: null,
    galeriSecilebilirOgrenciler: () => liste,
    hedefSecilebilirOgrenciler: () => liste,
    galeriIzinsizleriOku: async () => { if (izinOkumaHatasi) throw new Error('izin okunamadı'); return new Set(izinsiz); }
  };
}
