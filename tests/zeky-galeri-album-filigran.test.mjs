import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

test('portal galeri uyumluluk katmanı BÇKA filigranını ve %60 saydamlığı tanımlar', async () => {
  const kaynak = await readFile(new URL('portal-galeri.js', kok), 'utf8');
  const kopru = await readFile(new URL('js/zeky-galeri-filigran-koprusu.js', kok), 'utf8');
  const yukleyici = await readFile(new URL('js/zeky-randevu-modal-koprusu.js', kok), 'utf8');
  assert.match(kaynak, /BÇKA/);
  assert.match(kaynak, /Bir Çiçek Koleji Anaokulu/);
  assert.match(kaynak, /saydamlik:\s*0\.60/);
  assert.match(kaynak, /globalAlpha\s*=\s*0\.40/);
  assert.match(kaynak, /albumId/);
  assert.match(kaynak, /portal-galeri-core\.js/);
  assert.match(kopru, /globalAlpha\s*=\s*0\.40/);
  assert.match(kopru, /Bir Çiçek Koleji Anaokulu/);
  assert.match(kopru, /BÇKA/);
  assert.match(yukleyici, /zeky-galeri-filigran-koprusu\.js\?v=9/);
});

test('veli galerisi yalnız onaylı medyayı ister ve sınıf adlarını güvenli eşler', async () => {
  const kaynak = await readFile(new URL('moduller/veli-galeri.js', kok), 'utf8');
  assert.match(kaynak, /fb\.where\('durum','==','onaylandi'\)/);
  assert.match(kaynak, /sinifEslesir\(v\.hedefDeger,sinif\)/);
  assert.match(kaynak, /albumId/);
  assert.match(kaynak, /g\.medya\.length>1/);
  assert.match(kaynak, /albumAc/);
  assert.match(kaynak, /buyut/);
});

test('canlı galeri yüklemesi filigranı fotoğraf pikseline gerçekten çizer', async () => {
  const kaynak = await readFile(new URL('js/zeky-galeri-filigran-koprusu.js', kok), 'utf8');
  const yalnizFiligran = kaynak.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '');
  const modulUrl = `data:text/javascript;base64,${Buffer.from(yalnizFiligran).toString('base64')}`;
  const { galeriFiligranKoprusunuKur } = await import(modulUrl);

  const yazilar = [];
  const kodlananlar = [];
  class SahteCanvas {
    constructor() {
      this.width = 1200;
      this.height = 1600;
      this.ctx = {
        globalAlpha: 1,
        save() {},
        restore() {},
        measureText(metin) { return { width: metin.length * 10 }; },
        fillText: (metin, x, y) => yazilar.push({
          metin, x, y, alpha: this.ctx.globalAlpha
        })
      };
    }
    getContext() { return this.ctx; }
    toBlob(tamamla, tur, kalite) {
      kodlananlar.push({ tur, kalite });
      tamamla({ type: tur });
    }
  }

  const asilToBlob = SahteCanvas.prototype.toBlob;
  const win = {
    HTMLCanvasElement: SahteCanvas,
    galeriYukle: async () => {
      const canvas = new SahteCanvas();
      await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      return 'yuklendi';
    }
  };

  assert.equal(galeriFiligranKoprusunuKur(win), true);
  assert.equal(galeriFiligranKoprusunuKur(win), false, 'köprü iki kez kurulmamalı');
  assert.equal(await win.galeriYukle(), 'yuklendi');
  assert.deepEqual(yazilar.map(x => x.metin), ['Bir Çiçek Koleji Anaokulu', 'BÇKA']);
  assert.ok(yazilar.every(x => x.alpha === 0.40 && x.x > 1000 && x.y > 1400));
  assert.ok(yazilar[1].y < yazilar[0].y);
  assert.deepEqual(kodlananlar, [{ tur: 'image/jpeg', kalite: 0.85 }]);
  assert.equal(SahteCanvas.prototype.toBlob, asilToBlob,
    'yükleme bitince genel canvas davranışı geri yüklenmeli');
});
