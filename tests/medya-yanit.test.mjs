import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const kaynak = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('fiş ve izin belgesi klasöründe @ ve nokta kalmaz', () => {
  assert.ok(!kaynak.includes('[^a-z0-9@._-]'), 'eski klasör kalıbı kalmamalı');
  const temizle = e => String(e).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  assert.equal(temizle('Emrah@BirCicekKoleji.com'), 'emrah_bircicekkoleji_com');
});

test('medya sunucusu JSON dışı yanıt verirse anlaşılır hata üretilir', async () => {
  const bas = kaynak.indexOf('async function medyaYanitOku(');
  assert.ok(bas >= 0);
  const son = kaynak.indexOf('\n}\n', bas) + 2;
  const medyaYanitOku = new Function(kaynak.slice(bas, son) + '; return medyaYanitOku;')();
  const yanit = (govde, status = 200) => ({ status, text: async () => govde });
  const eskiHata = console.error; console.error = () => {};
  try {
    assert.deepEqual(await medyaYanitOku(yanit('{"ok":true,"url":"https://x/y.jpg","yol":"a/b"}')), { ok: true, url: 'https://x/y.jpg', yol: 'a/b' });
    await assert.rejects(medyaYanitOku(yanit('<html><head><style>p{}</style></head><body><div>Exception: Invalid argument (satır 45)</div></body></html>', 500)),
      /HTTP 500.*Exception: Invalid argument/);
    await assert.rejects(medyaYanitOku(yanit('', 502)), /HTTP 502/);
  } finally { console.error = eskiHata; }
  assert.ok(kaynak.includes('await medyaYanitOku(res)'));
});


test('galeri video doğrulaması MP4/WEBM/MOV kabul eder ve belge kanalından ayrıdır', () => {
  const ayarBas = kaynak.indexOf('const MEDYA_AYAR = {');
  const dogrulaBas = kaynak.indexOf('function medyaDogrula(', ayarBas);
  const dogrulaSon = kaynak.indexOf('\n}\n\n// Medya sunucusu', dogrulaBas) + 2;
  assert.ok(ayarBas >= 0 && dogrulaBas > ayarBas && dogrulaSon > dogrulaBas);
  const ayarSon = kaynak.indexOf('\n};', ayarBas) + 3;
  const kod = kaynak.slice(ayarBas, ayarSon) + '\n' + kaynak.slice(dogrulaBas, dogrulaSon) + '\nreturn {MEDYA_AYAR, medyaDogrula};';
  const {MEDYA_AYAR, medyaDogrula} = new Function(kod)();

  assert.equal(MEDYA_AYAR.MAKS_VIDEO_BOYUT_MB, 30);
  assert.equal(medyaDogrula({name:'clip.mp4',type:'video/mp4',size:30*1024*1024}, 'video').gecerli, true);
  assert.equal(medyaDogrula({name:'clip.webm',type:'video/webm',size:1}, 'video').gecerli, true);
  assert.equal(medyaDogrula({name:'clip.mov',type:'video/quicktime',size:1}, 'video').gecerli, true);
  assert.equal(medyaDogrula({name:'clip.mp4',type:'video/mp4',size:30*1024*1024+1}, 'video').gecerli, false);
  assert.equal(medyaDogrula({name:'clip.pdf',type:'application/pdf',size:1}, 'video').gecerli, false);
  assert.equal(medyaDogrula({name:'clip.mp4',type:'video/mp4',size:1}, false).gecerli, false);
  assert.ok(kaynak.includes("const sonuc = await galeriVideoYukle(f,"), "current gallery video uploads use the already-deployed Bunny Stream path");
  assert.match(kaynak, /medyaTuru: dogrula\.tur/);
});
