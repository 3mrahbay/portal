// Portal Eğitim ekranını ZEKY mobildeki ayrıntılı gelişim yolculuğuna bağlar.
// Büyük index.html'e dokunmadan mevcut caEgitimYukle çağrı noktasını değiştirir.
// Ortak PortalData katmanını burada da garanti eder; yükleme sırasına bağımlı kalmaz.
import * as PortalDataModulu from '../portal-data.js?v=1';
import { render as veliEgitimRender } from '../moduller/veli-egitim-gelisim.js?v=1';
import { kur as gelismisGozlemKur } from '../moduller/ogretmen-egitim-gozlem.js?v=1';

if (typeof window !== 'undefined' && !window.PortalData) {
  window.PortalData = PortalDataModulu;
}

const KURULUM = '__zekyVeliEgitimKoprusuV1';

export function veliEgitimKoprusunuKur(win = window) {
  if (!win || win[KURULUM]) return false;
  let deneme = 0;
  const dene = () => {
    const egitimHazir = typeof win.caEgitimYukle === 'function';
    if (egitimHazir) {
      const eski = win.caEgitimYukle;
      const yeni = async function () {
        try {
          return await veliEgitimRender('cicekAppRoot');
        } catch (e) {
          console.error('ZEKY ayrıntılı eğitim ekranı açılamadı; eski ekrana dönülüyor.', e);
          return eski.apply(this, arguments);
        }
      };
      yeni.__zekyDetayliEgitim = true;
      yeni.__eski = eski;
      win.caEgitimYukle = yeni;
      win.zekyVeliEgitimRender = veliEgitimRender;
      win[KURULUM] = true;
      return true;
    }
    deneme += 1;
    if (deneme < 80) win.setTimeout(dene, 100);
    return false;
  };
  dene();
  gelismisGozlemKur(win);
  return true;
}

veliEgitimKoprusunuKur();
