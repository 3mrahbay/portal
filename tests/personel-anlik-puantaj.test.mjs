import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function bolum(baslangic, bitis) {
  const a = source.indexOf(baslangic);
  assert.ok(a >= 0, baslangic + ' bulunamadı');
  const b = source.indexOf(bitis, a);
  assert.ok(b > a, bitis + ' bulunamadı');
  return source.slice(a, b);
}

const hizli = bolum('async function hbOgretmenDoldur()', '// ===== HIZLI BAKIŞ HYDRATION =====');
const anlik = bolum('async function ozlukDurumCiz()', '// ── 2) GİRİŞ-ÇIKIŞ KAYDI');

test('Anlık Durum çalışıyor/molada statüsünü yalnız bugünkü puantajdan üretir', () => {
  assert.match(anlik, /collection\(db, "puantaj"\).*where\("tarih", "==", ozlukBugun\(\)\)/s);
  assert.doesNotMatch(anlik, /collection\(db, "personelDurum"\)/);
  assert.match(anlik, /if \(x\.tip === "giris"\) durum = "iceride"/);
  assert.match(anlik, /else if \(x\.tip === "cikis"\) durum = "disarida"/);
  assert.match(anlik, /if \(!h\.length && izinliler\[e\]\) durum = "izinli"/);
  assert.match(anlik, /sonHareketSaat: sonHareket \? ozlukSaat\(sonHareket\.zaman\) : null/);
});

test('Ana sayfa personel özeti de eski personelDurum önbelleğini kullanmaz', () => {
  assert.match(hizli, /collection\(db, "puantaj"\).*where\("tarih", "==", bugunStr\)/s);
  assert.doesNotMatch(hizli, /collection\(db, "personelDurum"\)/);
  assert.match(hizli, /if \(x\.tip === "giris"\) durum = "iceride"/);
  assert.match(hizli, /if \(!h\.length && izinliMap\[e\]\) return "izinli"/);
});

test('Özlük tarih hesabı İstanbul gününü kullanır', () => {
  assert.match(source, /function ozlukBugun\(\)[\s\S]*timeZone: "Europe\/Istanbul"/);
});
