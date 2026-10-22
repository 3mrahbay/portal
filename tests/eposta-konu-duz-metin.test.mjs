import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// E-posta konusu düz metindir: ikon etiketi (<i data-lucide>) konuya yazılırsa
// veli gelen kutusunda ham HTML görür. Ekrandaki ikonlar etkilenmez.
const dosyalar = ['index.html', 'portal-devamsizlik.js', 'portal-galeri-core.js', 'portal-kredikarti.js', 'portal-duyurular.js'];

test('e-posta konuları HTML/ikon etiketi içermez', async () => {
  for (const dosya of dosyalar) {
    const s = await readFile(new URL('../' + dosya, import.meta.url), 'utf8');
    for (const m of s.matchAll(/subject:\s*`([^`]*)`/g)) assert.doesNotMatch(m[1], /</, `${dosya}: ${m[1]}`);
    for (const m of s.matchAll(/const konu = `([^`]*)`/g)) assert.doesNotMatch(m[1], /<i /, `${dosya}: ${m[1]}`);
  }
});
