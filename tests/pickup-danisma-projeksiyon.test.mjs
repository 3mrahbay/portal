// Danışma teslim yetkilisi projeksiyonu: veli listesini açınca ana listeyle eşitlenir.
// Kural (zeky-backend rules-gizlilik): ana listeden eski projeksiyon danışmaya
// gösterilmez; veliden yalnız birebir ad/yakınlık kopyası, sunucu saatiyle kabul edilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kaynak = await readFile(new URL('../moduller/pickup-yetkilileri.js', import.meta.url), 'utf8');

// Modül tarayıcıda çalışır (window); saf yardımcıları ayrı değerlendirilir.
function yardimcilar() {
  const bas = kaynak.indexOf('export function danismaOzeti');
  const son = kaynak.indexOf('export async function listeGetir');
  assert.ok(bas >= 0 && son > bas, 'yardımcılar listeGetir öncesinde olmalı');
  const govde = kaynak.slice(bas, son).replace(/export function/g, 'function');
  return new Function(`${govde}; return { danismaOzeti, projeksiyonYenilenmeli };`)();
}
const { danismaOzeti, projeksiyonYenilenmeli } = yardimcilar();
const zaman = (ms) => ({ toMillis: () => ms });

test('özet yalnız ad + yakınlık taşır (telefon düşer)', () => {
  assert.deepEqual(danismaOzeti([{ ad: 'Dede', yakinlik: 'Dede', telefon: '05' }, { ad: 'Teyze' }]),
    [{ ad: 'Dede', yakinlik: 'Dede' }, { ad: 'Teyze', yakinlik: '' }]);
});

test('projeksiyon yoksa, farklıysa, zamansızsa ya da ana listeden eskiyse yenilenir', () => {
  const ozet = [{ ad: 'Dede', yakinlik: 'Dede' }];
  assert.equal(projeksiyonYenilenmeli(null, { guncellendi: zaman(5) }, ozet), true);
  assert.equal(projeksiyonYenilenmeli({ kisiler: [{ ad: 'Eski', yakinlik: 'Dayı' }], guncellendi: zaman(9) }, { guncellendi: zaman(5) }, ozet), true);
  assert.equal(projeksiyonYenilenmeli({ kisiler: ozet }, { guncellendi: zaman(5) }, ozet), true);
  // ZEKY aynı listeyi yeniden kaydetti: içerik aynı ama ana liste daha yeni.
  assert.equal(projeksiyonYenilenmeli({ kisiler: ozet, guncellendi: zaman(4) }, { guncellendi: zaman(5) }, ozet), true);
});

test('güncel ve aynı projeksiyon yeniden yazılmaz', () => {
  const ozet = [{ ad: 'Dede', yakinlik: 'Dede' }];
  assert.equal(projeksiyonYenilenmeli({ kisiler: ozet, guncellendi: zaman(6) }, { guncellendi: zaman(5) }, ozet), false);
  assert.equal(projeksiyonYenilenmeli({ kisiler: ozet, guncellendi: zaman(6) }, {}, ozet), false);
});

test('veli yolu projeksiyonu yalnız gerektiğinde, özet + sunucu saatiyle yazar', () => {
  assert.match(kaynak, /if \(projeksiyonYenilenmeli\(guvenli\.exists\(\) \? guvenli\.data\(\) : null, s\.data\(\), ozet\)\)/);
  assert.match(kaynak, /setDoc\(guvenliRef, \{ kisiler: ozet, guncellendi: fb\.serverTimestamp\(\) \}\)/);
  // Kaydetme: ana liste asıl kaynak, projeksiyon aynı özetle ve ayrı yazılır.
  assert.match(kaynak, /kisiler: danismaOzeti\(kisiler\),\n\s+guncellendi: fb\.serverTimestamp\(\)/);
  assert.doesNotMatch(kaynak, /if \(!guvenli\.exists\(\)\) \{/);
});
