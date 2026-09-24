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
