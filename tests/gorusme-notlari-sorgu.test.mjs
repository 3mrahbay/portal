import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kaynak = await readFile(new URL('../moduller/gorusme-notlari.js', import.meta.url), 'utf8');

test('öğretmen ve koordinatörün kendi not sorguları gizli notları dışarıda bırakır', () => {
  // Kural gizli notları yalnız PDR ve yönetime açar; filtresiz sorguyu reddeder.
  assert.match(kaynak, /where\("yazanEmail", "==", d\.eposta\), fb\.where\("gizli", "==", false\)/);
  assert.match(kaynak, /where\("bildirimAlicilari", "array-contains", d\.eposta\), fb\.where\("gizli", "==", false\)/);
  assert.match(kaynak, /if \(d\.yonetim \|\| d\.pdr\) sorgular\.push\(fb\.getDocs\(col\)\)/);
});
