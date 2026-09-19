// Canli portal galeri yuklemesine BCKA filigrani ekler.
// Eski galeri kodu index.html icindeki modul kapsamina kapali oldugu icin,
// yalnizca galeriYukle calisirken JPEG canvas ciktisini guvenle isaretler.
// Ayrintili veli egitim + gelismis ogretmen gozlem koprusu de bu ortak
// son-yuklenen modul uzerinden devreye girer; buyuk index.html'e dokunulmaz.
import './zeky-veli-egitim-koprusu.js?v=8';
import './zeky-galeri-onay-egitim.js?v=4';

const KOPRU_ANAHTARI = '__zekyGaleriFiligranKoprusuV6';

export function galeriFiligraniCiz(canvas) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx || !canvas.width || !canvas.height) return false;

  const kisaKenar = Math.min(canvas.width, canvas.height);
  const pay = Math.max(12, Math.round(kisaKenar * 0.035));
  const ustBoyut = Math.max(18, Math.round(kisaKenar * 0.06));
  let altBoyut = Math.max(10, Math.round(ustBoyut * 0.38));
  const sag = canvas.width - pay;
  const alt = canvas.height - pay;
  const altMetin = 'Bir Çiçek Koleji Anaokulu';
  const yaziTipi = '-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif';

  try {
    ctx.font = `600 ${altBoyut}px ${yaziTipi}`;
    const altGenislik = ctx.measureText(altMetin).width;
    const azamiGenislik = Math.max(80, canvas.width - pay * 2);
    if (altGenislik > azamiGenislik) {
      altBoyut = Math.max(8, Math.floor(altBoyut * azamiGenislik / altGenislik));
    }

    ctx.font = `650 ${altBoyut}px ${yaziTipi}`;
    const yaziGenisligi = Math.max(ctx.measureText(altMetin).width, ctx.measureText('BÇKA').width);
    const bosluk = Math.max(10, Math.round(ustBoyut * 0.34));
    const kutuYukseklik = ustBoyut + altBoyut + bosluk * 2 + Math.round(ustBoyut * 0.18);
    const kutuSol = canvas.width - pay - yaziGenisligi - bosluk * 2;
    const kutuUst = canvas.height - pay - kutuYukseklik;

    // Açık ve koyu fotoğraflarda yazının kaybolmaması için yarı saydam bir
    // kontrast plakası kullanılır. Yazı hâlâ istenen %60 saydamlıktadır.
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#10251A';
    if (typeof ctx.roundRect === 'function' && typeof ctx.fill === 'function') {
      ctx.beginPath();
      ctx.roundRect(kutuSol, kutuUst, yaziGenisligi + bosluk * 2, kutuYukseklik,
        Math.max(8, Math.round(ustBoyut * 0.28)));
      ctx.fill();
    } else if (typeof ctx.fillRect === 'function') {
      ctx.fillRect(kutuSol, kutuUst, yaziGenisligi + bosluk * 2, kutuYukseklik);
    }
    ctx.restore();

    ctx.save();
    // İstenen %60 saydamlık, %40 görünürlüğe karşılık gelir.
    ctx.globalAlpha = 0.40;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.82)';
    ctx.shadowBlur = Math.max(3, Math.round(ustBoyut * 0.14));
    ctx.shadowOffsetY = Math.max(1, Math.round(ustBoyut * 0.04));
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `650 ${altBoyut}px ${yaziTipi}`;
    ctx.fillText(altMetin, sag - bosluk, alt - bosluk);
    ctx.font = `800 ${ustBoyut}px ${yaziTipi}`;
    ctx.fillText('BÇKA', sag - bosluk, alt - bosluk - altBoyut - Math.round(ustBoyut * 0.18));
    ctx.restore();
    return true;
  } catch (hata) {
    console.warn('Galeri filigrani uygulanamadi; yukleme filigransiz suruyor.', hata);
    return false;
  } finally {
    /* Canvas durumları kendi bloklarında geri yüklenir. */
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
