// Eski randevuSlotlari koleksiyonu V3 geçişinden (Eylül 2026) beri arşiv ve istemciye
// kapalı (kural: read, write false). İstemciden okuma her seferinde Firestore reddi
// üretir (20 Eki ölçümü). Hiçbir Portal kodu bu koleksiyonu okumamalı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const kok = new URL('../', import.meta.url);
const OKUMA = /(getDocs?|getDocFromServer|getDocsFromServer|onSnapshot)\s*\([^;]{0,160}["'`]randevuSlotlari["'`]/;

async function dosyalar() {
  const liste = ['index.html'];
  for (const klasor of ['js', 'moduller']) {
    for (const ad of await readdir(new URL(klasor + '/', kok), { recursive: true })) {
      if (/\.(m?js|html)$/.test(ad)) liste.push(`${klasor}/${ad}`);
    }
  }
  return liste;
}

test('Portal istemcisi arşivlenmiş randevuSlotlari koleksiyonunu okumaz', async () => {
  const okuyanlar = [];
  for (const yol of await dosyalar()) {
    const satirlar = (await readFile(new URL(yol, kok), 'utf8')).split('\n');
    satirlar.forEach((s, i) => { if (OKUMA.test(s)) okuyanlar.push(`${yol}:${i + 1}`); });
  }
  assert.deepEqual(okuyanlar, []);
});

test('veli randevu yedekleri V3 köprüsünü bekler, arşive düşmez', async () => {
  const s = await readFile(new URL('index.html', kok), 'utf8');
  assert.match(s, /async function randevuKoprusuBekle\(ad, deneme = 10\)/);
  assert.match(s, /randevuKoprusuBekle\("zekyRandevuYaklasan"\)/);
  assert.match(s, /randevuKoprusuBekle\("zekyRandevuListe"\)/);
  assert.match(s, /gnModul\.ozetKart\("profilRandevular"\)/);
});
