import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);

// Kural: veli yalnız veliEmail'i kendi e-postası olan izinleri okuyabilir.
// Sorgu bu süzgeci taşımazsa Firestore tümünü reddeder (liste boş görünür).
test('veli izin listesi sorgusu veliEmail süzgeci taşır', async () => {
  const s = await readFile(new URL('moduller/veli-izinleri.js', kok), 'utf8');
  const veliKart = s.slice(s.indexOf('export async function veliKart'), s.indexOf('function formAc'));
  assert.match(veliKart, /fb\.where\("ogrenciId", "==", ogr\.id\), fb\.where\("veliEmail", "==", veliEmail\)/);
  assert.match(veliKart, /const veliEmail = \(state\.currentUser\?\.email \|\| ""\)\.toLowerCase\(\)/);
});

test('veli günlük akışındaki izin sorgusu veliEmail süzgeci taşır', async () => {
  const s = await readFile(new URL('js/zeky-veli-ogrenme-deneyimi.js', kok), 'utf8');
  assert.match(s, /collection\(p\.db,'veliIzinleri'\),p\.fb\.where\('ogrenciId','==',o\.id\),p\.fb\.where\('veliEmail','==',/);
});
