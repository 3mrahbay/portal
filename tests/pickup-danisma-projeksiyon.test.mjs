// Danışma teslim yetkilisi projeksiyonu (danismaPickupYetkilileri) — zeky-backend kuralı (20 Eki):
// yalnız yönetim senkronu yazar ve ana listenin sürümünü (guncellendi) kaynakGuncellendi'ye
// kopyalar; ana liste o sürümden sonra değiştiyse danışmaya gösterilmez. Veli projeksiyona
// dokunmaz; ana liste her yazımda sunucu saatini taşır.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modul = await readFile(new URL('../moduller/pickup-yetkilileri.js', import.meta.url), 'utf8');
const portal = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('veli yolu danışma projeksiyonunu okumaz ve yazmaz', () => {
  // Tek kullanım: danışma rolünün okuma kaynağı seçimi.
  assert.equal((modul.match(/danismaPickupYetkilileri"/g) || []).length, 1);
  assert.match(modul, /const kaynak = danismaMi \? "danismaPickupYetkilileri" : "pickupYetkilileri";/);
  assert.doesNotMatch(modul, /setDoc\([^)]*danismaPickupYetkilileri/);
});

test('ana liste her kaydedişte sunucu saatini taşır', () => {
  assert.match(modul, /setDoc\(fb\.doc\(db, "pickupYetkilileri", ogrenciId\), \{\n\s+kisiler,\n\s+guncelleyen: [^\n]+\n\s+guncellendi: fb\.serverTimestamp\(\)\n\s+\}, \{ merge: true \}\)/);
});

test('yönetim senkronu ana listenin sürümünü projeksiyona kopyalar', () => {
  const bas = portal.indexOf('async function danismaOperasyonProjeksiyonlariniSenkronla()');
  assert.ok(bas > 0);
  const govde = portal.slice(bas, portal.indexOf('\n}\n', bas));
  assert.match(govde, /data: \{ kisiler, kaynakGuncellendi: d\.data\(\)\?\.guncellendi \?\? null, guncellendi: simdi \}/);
  assert.match(govde, /ad: String\(k\?\.ad \|\| ""\), yakinlik: String\(k\?\.yakinlik \|\| ""\)/);
});
