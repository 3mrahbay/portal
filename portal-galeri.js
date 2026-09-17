// ZEKY Portal Galeri uyumluluk katmanı — filigran + albüm kimliği.
// Mevcut galeri davranışı portal-galeri-core.js içinde aynen korunur.
(function () {
  const B = window.BCK;
  if (!B) {
    console.error('Galeri uyumluluk katmanı: window.BCK bulunamadı.');
    return;
  }

  const eskiSikistir = B.resimSikistir;
  const eskiSetDoc = B.setDoc;

  function resimYukle(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  async function filigranEkle(blob) {
    try {
      const img = await resimYukle(blob);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const kisa = Math.min(canvas.width, canvas.height);
      const ustBoy = Math.max(16, Math.round(kisa * 0.055));
      let altBoy = Math.max(9, Math.round(ustBoy * 0.36));
      const pay = Math.max(12, Math.round(kisa * 0.035));
      const sag = canvas.width - pay;
      const alt = canvas.height - pay;
      const ustMetin = 'BÇKA';
      const altMetin = 'Bir Çiçek Koleji Anaokulu';

      // %60 saydamlık = %40 görünürlük.
      ctx.globalAlpha = 0.40;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = Math.max(2, Math.round(ustBoy * 0.10));

      ctx.font = `600 ${altBoy}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
      const olcum = ctx.measureText(altMetin).width;
      const maxGen = Math.max(80, canvas.width - pay * 2);
      if (olcum > maxGen) altBoy = Math.max(8, Math.floor(altBoy * maxGen / olcum));

      ctx.font = `600 ${altBoy}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
      ctx.fillText(altMetin, sag, alt);
      ctx.font = `800 ${ustBoy}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
      ctx.fillText(ustMetin, sag, alt - altBoy - Math.round(ustBoy * 0.18));
      ctx.globalAlpha = 1;

      return await new Promise((resolve) => canvas.toBlob(
        b => resolve(b || blob),
        'image/jpeg',
        0.90
      ));
    } catch (e) {
      console.warn('Galeri filigranı uygulanamadı; özgün görsel korunuyor.', e);
      return blob;
    }
  }

  if (typeof eskiSikistir === 'function') {
    B.resimSikistir = async function (...args) {
      const sikistirilmis = await eskiSikistir.apply(this, args);
      return filigranEkle(sikistirilmis);
    };
  }

  function temizParca(v) {
    return String(v || '')
      .trim()
      .toLocaleLowerCase('tr')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function albumKimligi(veri) {
    const tarih = temizParca(veri.etkinlikTarih || (veri.yuklemeZamani || '').slice(0, 10) || 'tarihsiz');
    const baslik = temizParca(veri.etkinlikBaslik || 'genel');
    const hedefTur = temizParca(veri.hedefTur || 'tumOkul');
    const hedef = temizParca(veri.hedefDeger || 'tum');
    return `alb_${tarih}_${baslik}_${hedefTur}_${hedef}`;
  }

  if (typeof eskiSetDoc === 'function') {
    B.setDoc = function (ref, veri, ...rest) {
      try {
        const yol = String(ref?.path || '');
        if (yol.startsWith('galeri/') && veri && typeof veri === 'object' && veri.etkinlikBaslik) {
          veri = {
            ...veri,
            albumId: veri.albumId || albumKimligi(veri),
            filigran: veri.dosyaTipi === 'foto' ? {
              uygulandi: true,
              ustMetin: 'BÇKA',
              altMetin: 'Bir Çiçek Koleji Anaokulu',
              saydamlik: 0.60
            } : (veri.filigran || null)
          };
        }
      } catch (e) {
        console.warn('Galeri albüm meta bilgisi eklenemedi:', e);
      }
      return eskiSetDoc.call(this, ref, veri, ...rest);
    };
  }

  function cekirdegiYukle() {
    if (document.readyState === 'loading') {
      document.write('<script src="./portal-galeri-core.js"><\\/script>');
      return;
    }
    const s = document.createElement('script');
    s.src = './portal-galeri-core.js';
    s.async = false;
    document.head.appendChild(s);
  }

  cekirdegiYukle();
})();
