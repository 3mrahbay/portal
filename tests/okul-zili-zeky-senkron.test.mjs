import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const pickup = await readFile(new URL('moduller/pickup-yetkilileri.js', root), 'utf8');
const sabah = await readFile(new URL('js/sabah-giris-kaydi.js', root), 'utf8');
const randevu = await readFile(new URL('moduller/danisma-randevulari.js', root), 'utf8');
const kopru = await readFile(new URL('js/zeky-operasyon-push.js', root), 'utf8');
const index = await readFile(new URL('index.html', root), 'utf8');

test('portal veli işlemleri ZEKY personel sesli push olaylarını tetikler', () => {
  assert.match(pickup, /operasyonPushTetikle\("pickup-yeni", id\)/);
  assert.match(sabah, /operasyonPushTetikle\("sabah-yeni", id\)/);
  assert.match(randevu, /operasyonPushTetikle\("randevu-yeni", ref\.id\)/);
  assert.match(kopru, /alıcı\/personel e-postası gönderilmez/i);
});

test('portal danışma Okul Zili ZEKY kapıda kimlik ve not alanlarını taşır', () => {
  assert.match(index, /pickupKapidaBildirPortal/);
  assert.match(index, /pickupKimlikOnaylaPortal/);
  assert.match(index, /pickupDanismaNotuPortal/);
  assert.match(index, /kapidaZamani/);
  assert.match(index, /kimlikKontrolZamani/);
  assert.match(index, /danismaNotu/);
  assert.match(index, /danismaPickupBildirimleri/);
});

test('portal aday randevu durum alanları ZEKY ile geriye uyumludur', () => {
  assert.match(randevu, /durumZamani: zaman/);
  assert.match(randevu, /durumDegistiren: email/);
  assert.match(randevu, /\[yeni \+ "Zamani"\]: zaman/);
  assert.match(randevu, /guncelleyen: email/);
});
