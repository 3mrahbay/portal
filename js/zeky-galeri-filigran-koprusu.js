// Canli portal galeri yuklemesine BCKA filigrani ekler.
// Eski galeri kodu index.html icindeki modul kapsamina kapali oldugu icin,
// yalnizca galeriYukle calisirken JPEG canvas ciktisini guvenle isaretler.
// Ayrintili veli egitim + gelismis ogretmen gozlem koprusu de bu ortak
// son-yuklenen modul uzerinden devreye girer; buyuk index.html'e dokunulmaz.
import './zeky-veli-egitim-koprusu.js?v=2';

const KOPRU_ANAHTARI = '__zekyGaleriFiligranKoprusuV2';

export function galeriFiligraniCiz(canvas) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx || !canvas.width || !canvas.height) return false;

  const kisaKenar = Math.min(canvas.width, canvas.height);
  const pay = Math.max(12, Math.round(kisaKenar * 0.035));
  const ustBoyut = Math.max(16, Math.round(kisaKenar * 0.055));
  let altBoyut = Math.max(9, Math.round(ustBoyut * 0.36));
  const sag = canvas.width - pay;
  const alt = canvas.height - pay;
  const altMetin = 'Bir Çiçek Koleji Anaokulu';
  const yaziTipi = '-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif';

  try {
    ctx.save();
    // Istenen %60 saydamlik, %40 gorunurluge karsilik gelir.
    ctx.globalAlpha = 0.40;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.max(2, Math.round(ustBoyut * 0.10));
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';

    ctx.font = `600 ${altBoyut}px ${yaziTipi}`;
    const altGenislik = ctx.measureText(altMetin).width;
    const azamiGenislik = Math.max(80, canvas.width - pay * 2);
    if (altGenislik > azamiGenislik) {
      altBoyut = Math.max(8, Math.floor(altBoyut * azamiGenislik / altGenislik));
    }

    ctx.font = `600 ${altBoyut}px ${yaziTipi}`;
    ctx.fillText(altMetin, sag, alt);
    ctx.font = `800 ${ustBoyut}px ${yaziTipi}`;
    ctx.fillText('BÇKA', sag, alt - altBoyut - Math.round(ustBoyut * 0.18));
    return true;
  } catch (hata) {
    console.warn('Galeri filigrani uygulanamadi; yukleme filigransiz suruyor.', hata);
    return false;
  } finally {
    try { ctx.restore(); } catch (_) { /* Canvas durumu yoksa yuklemeyi engelleme. */ }
  }
}

export function galeriFiligranKoprusunuKur(win = globalThis.window) {
  if (!win || win[KOPRU_ANAHTARI]) return false;

  const canvasPrototipi = win.HTMLCanvasElement?.prototype;
  const eskiGaleriYukle = win.galeriYukle;
  if (!canvasPrototipi || typeof canvasPrototipi.toBlob !== 'function' ||
      typeof eskiGaleriYukle !== 'function') return false;

  let etkinYukleme = 0;
  let eskiToBlob = null;
  let filigranliToBlob = null;
  let isaretlenenCanvaslar = null;

  async function filigranliGaleriYukle(...args) {
    if (etkinYukleme === 0) {
      eskiToBlob = canvasPrototipi.toBlob;
      isaretlenenCanvaslar = new WeakSet();
      filigranliToBlob = function (tamamla, tur, kalite) {
        const jpegCiktisi = !tur || /^image\/jpe?g$/i.test(String(tur));
        if (jpegCiktisi && !isaretlenenCanvaslar.has(this)) {
          galeriFiligraniCiz(this);
          isaretlenenCanvaslar.add(this);
        }
        return eskiToBlob.call(this, tamamla, tur, kalite);
      };
      canvasPrototipi.toBlob = filigranliToBlob;
    }

    etkinYukleme += 1;
    try {
      return await eskiGaleriYukle.apply(this, args);
    } finally {
      etkinYukleme -= 1;
      if (etkinYukleme === 0) {
        if (canvasPrototipi.toBlob === filigranliToBlob) {
          canvasPrototipi.toBlob = eskiToBlob;
        }
        eskiToBlob = null;
        filigranliToBlob = null;
        isaretlenenCanvaslar = null;
      }
    }
  }

  win.galeriYukle = filigranliGaleriYukle;
  win[KOPRU_ANAHTARI] = true;
  return true;
}

function otomatikKur() {
  if (typeof window === 'undefined') return;
  let deneme = 0;
  const dene = () => {
    if (galeriFiligranKoprusunuKur(window)) return;
    deneme += 1;
    if (deneme < 40) window.setTimeout(dene, 100);
  };
  dene();
}

otomatikKur();
