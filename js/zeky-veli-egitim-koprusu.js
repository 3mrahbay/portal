// Portal Eğitim ekranını ZEKY mobildeki ayrıntılı gelişim yolculuğuna bağlar.
// Veli tarafında caGo('egitim') derin gelişim ekranına yönlenir.
// Öğretmen/personel tarafındaki gözlem + aktif öğrenci + iletişim gizliliği
// ayrı güvenlik köprüsüyle kurulur.

const KURULUM = '__zekyVeliEgitimKoprusuV4';
const SURUM = 'v4';
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

  const [veliModulu, guvenlikModulu, donemModulu, deneyimModulu] = await Promise.all([
    import(`../moduller/veli-egitim-gelisim.js?${SURUM}`),
    import('./zeky-ogrenci-guvenlik-koprusu.js?v=2'),
    import('./zeky-aktif-donem-senkron.js?v=1'),
    import('./zeky-veli-ogrenme-deneyimi.js?v=1')
  ]);

  return {
    veliEgitimRender: veliModulu.render,
    guvenlikKur: guvenlikModulu.kur,
    aktifDonemSenkronla: donemModulu.aktifDonemSenkronla,
    veliOgrenmeKur: deneyimModulu.kur
  };
}

export async function veliEgitimKoprusunuKur(win = window) {
  if (!win || win[KURULUM]) return true;
  if (baslatiliyor) return false;
  baslatiliyor = true;

  try {
    const { veliEgitimRender, guvenlikKur, aktifDonemSenkronla, veliOgrenmeKur } = await modulleriYukle(win);
    await Promise.allSettled([guvenlikKur(), aktifDonemSenkronla(), veliOgrenmeKur(win)]);

    const eskiCaGo = win.caGo;
    if (!eskiCaGo.__zekyEgitimV4) {
      const yeniCaGo = function (ekran, ...args) {
        if (ekran === 'egitim') {
          Promise.resolve()
            .then(() => veliEgitimRender('cicekAppRoot'))
            .catch((e) => {
              console.error('ZEKY ayrıntılı veli eğitim ekranı açılamadı.', e);
              try { eskiCaGo.call(this, ekran, ...args); } catch (_) {}
            });
          return;
        }
        return eskiCaGo.call(this, ekran, ...args);
      };
      yeniCaGo.__zekyEgitimV4 = true;
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
