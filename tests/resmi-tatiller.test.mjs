// Resmi tatil listesi: dini bayramlar Diyanet takvimine göre; index.html ve portal-takvim.js aynı liste.
// (ZEKY www/js/zeky-data.js varsayılan tatilleriyle aynı tarihler.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function liste(dosya) {
  const s = await readFile(new URL('../' + dosya, import.meta.url), 'utf8');
  const bas = s.indexOf('const RESMI_TATILLER = [') + 'const RESMI_TATILLER = '.length;
  const son = s.indexOf('];', bas) + 1;
  return new Function('return ' + s.slice(bas, son))();
}

test('index.html ve portal-takvim.js aynı tatil listesini kullanır', async () => {
  assert.deepEqual(await liste('portal-takvim.js'), await liste('index.html'));
});

test('dini bayram tarihleri Diyanet takvimiyle aynı, liste sıralı ve tekil', async () => {
  const L = await liste('index.html');
  const tarihler = L.map(t => t.tarih);
  assert.deepEqual([...tarihler].sort(), tarihler);
  assert.equal(new Set(tarihler).size, tarihler.length);
  const bul = metin => L.filter(t => t.baslik.includes(metin)).map(t => t.tarih);
  assert.deepEqual(bul('Ramazan Bayramı'), ['2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22',
                                             '2027-03-08', '2027-03-09', '2027-03-10', '2027-03-11']);
  assert.deepEqual(bul('Kurban Bayramı'), ['2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30',
                                            '2027-05-15', '2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19']);
  assert.ok(tarihler.includes('2027-10-28'));
});
