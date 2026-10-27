// Galeri çoklu çocuk (js/galeri-hedefi.js): vm ile dilimlenen index.html / modül kodu için ortak globaller.
// Test kurguları bunları bağlama yayar; içe aktarmalar silindiği için gerçek fonksiyonlar buradan gelir.
import * as G from '../../js/galeri-hedefi.js';

export const GALERI_HEDEF_GLOBALS = Object.freeze({
  galeriCocuklari: G.galeriCocuklari,
  galeriCocugaAitMi: G.galeriCocugaAitMi,
  galeriHedefAnahtari: G.galeriHedefAnahtari,
  galeriHedefAlanlari: G.galeriHedefAlanlari,
  galeriHedefKopyala: G.galeriHedefKopyala,
  galeriVeliEtiketi: G.galeriVeliEtiketi,
  GALERI_EN_FAZLA_COCUK: G.GALERI_EN_FAZLA_COCUK
});

// Yükleme kurgusu: seçicide seçili öğrenciler ve seçilebilir liste (öğretmende kendi sınıfı)
export function galeriYuklemeBaglami({ secili = [], secilebilir = null } = {}) {
  const liste = secilebilir || secili.map(o => ({ id: o.id, ad: o.ad || '', sinif: o.sinif || '' }));
  return {
    ...GALERI_HEDEF_GLOBALS,
    galeriOgrenciSecici: { seciliOgrenciler: () => secili.map(o => ({ ...o })), seciliIdler: () => secili.map(o => o.id), ogrencileriAyarla() {} },
    galeriSecilebilirOgrenciler: () => liste,
    hedefSecilebilirOgrenciler: () => liste
  };
}
