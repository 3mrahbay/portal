import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const kopru = await readFile(new URL('../js/zeky-bildirim-koprusu.js', import.meta.url), 'utf8');
const push = await readFile(new URL('../js/zeky-operasyon-push.js', import.meta.url), 'utf8');
const duyuru = await readFile(new URL('../portal-duyurular.js', import.meta.url), 'utf8');
const etkinlik = await readFile(new URL('../portal-etkinlik.js', import.meta.url), 'utf8');
const galeri = await readFile(new URL('../portal-galeri-core.js', import.meta.url), 'utf8');
const rozet = await readFile(new URL('../portal-rozet.js', import.meta.url), 'utf8');
const gorusme = await readFile(new URL('../moduller/gorusme-notlari.js', import.meta.url), 'utf8');

test('portal mesaj gönderimi kök bildirim ve sesli push üretir', () => {
  const bas=index.indexOf('async function mesajGonder(');
  const son=index.indexOf('// Bir thread\'i okundu işaretle',bas);
  const bolum=index.slice(bas,son);
  assert.match(bolum,/collection\(db, "bildirimler"\)/);
  assert.match(bolum,/tip: "mesaj"/);
  assert.match(bolum,/genelPushGonder/);
  assert.match(bolum,/hedefSayfa = "sohbet\.html\?thread="/);
});

test('ortak köprü kök bildirim yazıp aynı alıcılara push yollar', () => {
  assert.match(kopru,/bildirimKaydetVePush/);
  assert.match(kopru,/fb\.collection\(db,'bildirimler'\)/);
  assert.match(kopru,/genelPushGonder/);
  assert.match(push,/export async function genelPushGonder/);
  assert.match(push,/aliciEmailler/);
});

test('duyuru etkinlik ve galeri ZEKY ortak bildirim köprüsünü kullanır', () => {
  assert.match(duyuru,/bildirimKaydetVePush/);
  assert.match(duyuru,/tip:"duyuru"/);
  assert.match(etkinlik,/bildirimKaydetVePush/);
  assert.match(etkinlik,/tip:"etkinlik"/);
  assert.match(galeri,/bildirimKaydetVePush/);
  assert.match(galeri,/tip:"galeri"/);
});

test('rozet ve görüşme notu mevcut kök kayıt yanında push da yollar', () => {
  assert.match(rozet,/collection\(db, "bildirimler"\)/);
  assert.match(rozet,/genelPushGonder/);
  assert.match(gorusme,/collection\(db, "bildirimler"\)/);
  assert.match(gorusme,/genelPushGonder/);
});
