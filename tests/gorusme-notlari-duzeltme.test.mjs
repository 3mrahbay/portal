import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kaynak = await readFile(new URL('../moduller/gorusme-notlari.js', import.meta.url), 'utf8');

test('görüşme notu: okunamayan not yeni sanılmaz, editör açılmaz', () => {
  const blok = kaynak.slice(kaynak.indexOf('export async function editorAc'), kaynak.indexOf('const ogr = ogrenciBul(randevu.ogrenciAd)'));
  assert.match(blok, /catch \(e\) \{[\s\S]*görme yetkiniz yok[\s\S]*return;\s*\}/);
  assert.doesNotMatch(blok, /catch \(_\) \{\}/, 'okuma hatası yutulmaz');
});

test('görüşme notu: düzenlemede kaldırılan puan Firestore\'dan silinir', () => {
  assert.match(kaynak, /const kalkan = Object\.keys\(mevcut\?\.olcutler \|\| \{\}\)\.filter\(k => !Object\.hasOwn\(veri\.olcutler, k\)\);/);
  assert.match(kaynak, /kalkan\.map\(k => \[k, fb\.deleteField\(\)\]\)/);
  assert.match(kaynak, /fb\.setDoc\(fb\.doc\(db, "gorusmeNotlari", r\.id\), yazilacak, \{ merge: true \}\)/);
});
