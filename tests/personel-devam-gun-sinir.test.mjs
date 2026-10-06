import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ozluk = await readFile(new URL('../moduller/personel-ozluk.js', import.meta.url), 'utf8');
const bildirim = await readFile(new URL('../js/portal-bildirim-merkezi.js', import.meta.url), 'utf8');

test('personel canlı durumu önceki günden bugüne taşınmaz', () => {
  assert.match(ozluk, /canliDurumBuguneAitMi/);
  assert.match(ozluk, /\["sonZaman", "guncellendi", "girisZamani", "cikisZamani", "zaman"\]/);
  assert.match(ozluk, /canliDurumBuguneAitMi\(canliKayit, bugun\) \? canliKayit\.durum : ""/);
});

test('QR giriş hatırlatması portal bildirim merkezinde ayrı kategori taşır', () => {
  assert.match(bildirim, /'personel-giris-hatirlatma': 'Giriş \/ Çıkış'/);
});
