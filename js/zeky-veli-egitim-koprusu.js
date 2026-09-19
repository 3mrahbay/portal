// Portal Eğitim ekranını ZEKY mobildeki ayrıntılı gelişim yolculuğuna bağlar.
// Veli tarafında caGo('egitim') derin gelişim ekranına yönlenir.
// Öğretmen/personel tarafındaki gözlem + aktif öğrenci + iletişim gizliliği
// ayrı güvenlik köprüsüyle kurulur.

const KURULUM = '__zekyVeliEgitimKoprusuV8';
const SURUM = 'v8';
let baslatiliyor = false;

// Portalın çekirdeği Firestore erişimini PortalAPI üzerinden yayımlıyor.
// Eski bağımsız modüller ise aynı işlevleri window.BCK altında bekliyor.
// Canlı portalda BCK hiç oluşturulmadığı için veli eğitim zinciri daha
// portal-data.js yüklenmeden 12 saniye sonra duruyordu. Bu küçük uyumluluk
// katmanı ikinci bir Firebase örneği kurmadan iki arayüzü birbirine bağlar.
export function bckUyumlulukKur(win = window) {
  if (!win || win.BCK) return win?.BCK || null;
  const p = win.PortalAPI;
  if (!p?.db || !p?.fb) return null;
  const durum = () => p.state || {};
  win.BCK = {
    __portalUyumluluk: true,
    db: p.db,
    ...p.fb,
    kullanici: () => durum().currentUser || null,
    personel: () => durum().personel || null,
    rol: () => durum().rol || '',
    siniflari: () => durum().siniflar || [],
    ogrenciler: () => durum().ogrenciList || [],
    yoneticiMi: () => !!durum().isAdmin || ['kurucu_mudur','mudur','egitim_koordinator'].includes(String(durum().rol || '')),
    toast: (mesaj, tip) => p.toast?.(mesaj, tip)
  };
  return win.BCK;
}

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
  await bekle(() => !!win.PortalAPI && typeof win.caGo === 'function');
  if (!bckUyumlulukKur(win)) throw new Error('Portal veri uyumluluk katmanı kurulamadı.');

  const PortalDataModulu = await import(`../portal-data.js?${SURUM}`);
  if (!win.PortalData) win.PortalData = PortalDataModulu;

  const [veliModulu, guvenlikModulu, donemModulu, deneyimModulu] = await Promise.all([
    import(`../moduller/veli-egitim-gelisim.js?${SURUM}`),
    import('./zeky-ogrenci-guvenlik-koprusu.js?v=6'),
    import('./zeky-aktif-donem-senkron.js?v=3'),
    import('./zeky-veli-ogrenme-deneyimi.js?v=3')
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
    if (!eskiCaGo.__zekyEgitimV6) {
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
      yeniCaGo.__zekyEgitimV6 = true;
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
