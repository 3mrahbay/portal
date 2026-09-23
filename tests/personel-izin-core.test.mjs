import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  IZIN_TURLERI, izinDurumKodu, izinGunSayisi, izinSaatSayisi,
  izinMetrikleri, izinTalebiDogrula
} from '../js/personel-izin-core.js';

test('ZEKY ile ortak sekiz izin ve rapor turu vardir', () => {
  assert.deepEqual(Object.keys(IZIN_TURLERI), [
    'yillik', 'mazeret', 'saatlik', 'dogum', 'vefat', 'sut', 'rapor', 'hastane'
  ]);
});

test('gunluk ve saatlik sureler dogru hesaplanir', () => {
  assert.equal(izinGunSayisi('2026-09-22', '2026-09-24'), 3);
  assert.equal(izinGunSayisi('2026-09-24', '2026-09-22'), 0);
  assert.equal(izinSaatSayisi('09:15', '11:45'), 2.5);
  assert.equal(izinSaatSayisi('12:00', '11:00'), 0);
});

test('eski durum ve tur adlari yeni ozetle uyumludur', () => {
  assert.equal(izinDurumKodu('Onaylandı'), 'onaylandi');
  const ozet = izinMetrikleri([
    { tur: 'Yıllık İzin', durum: 'onaylandi', gun: 4 },
    { tur: 'yillik', durum: 'bekliyor', baslangic: '2026-10-01', bitis: '2026-10-02' },
    { tur: 'Sağlık Raporu', durum: 'onaylı', gun: 3 }
  ], 14);
  assert.deepEqual(ozet, { toplam: 14, kullanilan: 4, bekleyen: 2, raporGun: 3, kalan: 10, kalanYuzde: 71 });
});

test('yillik bakiye ve vefat siniri asimina izin verilmez', () => {
  assert.throws(() => izinTalebiDogrula({ tur: 'yillik', baslangic: '2026-10-01', bitis: '2026-10-05' }, 4), /kalan yıllık izin/);
  assert.throws(() => izinTalebiDogrula({ tur: 'vefat', baslangic: '2026-10-01', bitis: '2026-10-04' }), /en fazla 3 gün/);
});

test('saatlik izin zaman araligi olmadan gonderilemez', () => {
  assert.throws(() => izinTalebiDogrula({ tur: 'saatlik', baslangic: '2026-10-01' }), /başlangıç ve bitiş saati/);
  const sonuc = izinTalebiDogrula({ tur: 'hastane', baslangic: '2026-10-01', baslangicSaat: '10:00', bitisSaat: '12:30' });
  assert.equal(sonuc.saat, 2.5);
});

test('portal basit prompt yerine bagli izin ve yonetim karar akislarini kullanir', async () => {
  const kaynak = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const bas = kaynak.indexOf('// ═══════════ PERSONEL İZİN / RAPOR');
  const son = kaynak.indexOf('// İlk Adımlar', bas);
  const akis = kaynak.slice(bas, son);
  assert.ok(bas > 0 && son > bas);
  assert.doesNotMatch(akis, /prompt\(/);
  assert.match(akis, /izin-belgeleri\/\$\{klasorEmail\}/);
  assert.match(akis, /durum: "bekliyor"/);
  assert.match(kaynak, /ozlukIzinDetayAc/);
  assert.match(kaynak, /onaylananGun/);
  assert.match(kaynak, /kararNotu/);
  assert.match(kaynak, /personelIzinMetrikleri\(izinler, izinHakki\)/);
});
