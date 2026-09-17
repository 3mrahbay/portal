// Portal Eğitim ekranını ZEKY mobildeki ayrıntılı gelişim yolculuğuna bağlar.
// Ana portal <script type="module"> içinde çalıştığı için caEgitimYukle window'a
// açılmaz. Bu köprü doğru global giriş noktası olan window.caGo'yu sarar.
// Ayrıca BCK hazır olana kadar bekler ve alt modülleri sürümlü dinamik import eder.

const KURULUM = '__zekyVeliEgitimKoprusuV2';
const SURUM = 'v2';
let baslatiliyor = false;

function bekle(kosul, deneme = 120, aralik = 100) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const bak = () => {
      try { if (kosul()) return resolve(true); } catch (_) {}
      n += 1;
      if (n >= deneme) return reject(new Error('Portal eğitim köprüsü için gerekli çekirdek hazır olmadı.'));
      setTimeout(bak, aralik);
    };
    bak();
  });
}

async function modulleriYukle(win) {
  await bekle(() => !!win.BCK && typeof win.caGo === 'function');

  const PortalDataModulu = await import(`../portal-data.js?${SURUM}`);
  if (!win.PortalData) win.PortalData = PortalDataModulu;

  const [veliModulu, gozlemModulu] = await Promise.all([
    import(`../moduller/veli-egitim-gelisim.js?${SURUM}`),
    import(`../moduller/ogretmen-egitim-gozlem.js?${SURUM}`)
  ]);

  return {
    veliEgitimRender: veliModulu.render,
    gelismisGozlemKur: gozlemModulu.kur
  };
}

export async function veliEgitimKoprusunuKur(win = window) {
  if (!win || win[KURULUM]) return true;
  if (baslatiliyor) return false;
  baslatiliyor = true;

  try {
    const { veliEgitimRender, gelismisGozlemKur } = await modulleriYukle(win);

    // Öğretmen tarafı: mevcut global caGozlemAc doğrudan gelişmiş pencereye çevrilir.
    gelismisGozlemKur(win);

    // Veli tarafı: caEgitimYukle modül-içi olduğu için window.caGo yakalanır.
    const eskiCaGo = win.caGo;
    if (!eskiCaGo.__zekyEgitimV2) {
      const yeniCaGo = function (ekran, ...args) {
        if (ekran === 'egitim') {
          // Eski caGo çağrılmaz; aksi halde modül-içi eski async eğitim ekranı
          // yeni ekranı sonradan tekrar ezebilir.
          Promise.resolve()
            .then(() => veliEgitimRender('cicekAppRoot'))
            .catch((e) => {
              console.error('ZEKY ayrıntılı eğitim ekranı açılamadı.', e);
              try { eskiCaGo.call(this, ekran, ...args); } catch (_) {}
            });
          return;
        }
        return eskiCaGo.call(this, ekran, ...args);
      };
      yeniCaGo.__zekyEgitimV2 = true;
      yeniCaGo.__eski = eskiCaGo;
      win.caGo = yeniCaGo;
    }

    win.zekyVeliEgitimRender = veliEgitimRender;
    win.__zekyEgitimKoprusuSurum = SURUM;
    win[KURULUM] = true;
    return true;
  } catch (e) {
    console.error('Portal eğitim köprüsü kurulamadı:', e);
    return false;
  } finally {
    baslatiliyor = false;
  }
}

if (typeof window !== 'undefined') veliEgitimKoprusunuKur(window);
