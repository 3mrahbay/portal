// Kural: onaylı veli = aktif veli.
// Randevu sunucusu, randevu bildirimleri ve kimlik eşleştirmesi veliyi ancak
// onaylandi:true VE aktif:true ise açık sayar. Portal bir veliyi onaylarken
// aktif:true, onayı tamamen kaldırırken aktif:false yazmalıdır; aksi halde
// onaylı veli "kaydı randevu sistemine açılmamış" hatası alır (Ekim 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// veliler belgesine yazan setDoc(...) / updateDoc(...) çağrılarının nesne gövdeleri
function veliYazimlari() {
  const sonuc = [];
  const re = /(setDoc|updateDoc)\(\s*(veliRef|doc\(db,\s*["']veliler["'][^)]*\))\s*,\s*\{/g;
  let m;
  while ((m = re.exec(html))) {
    let i = re.lastIndex, derinlik = 1;
    while (i < html.length && derinlik) {
      if (html[i] === '{') derinlik++;
      else if (html[i] === '}') derinlik--;
      i++;
    }
    sonuc.push(html.slice(re.lastIndex, i - 1));
  }
  return sonuc;
}

test('veli onaylayan her yazım aktif:true da yazar', () => {
  const onaylar = veliYazimlari().filter(g => /onaylandi:\s*true/.test(g));
  assert.ok(onaylar.length >= 4, 'veli onay yazımları bulunamadı');
  for (const g of onaylar) assert.match(g, /aktif:\s*true/, g.slice(0, 160));
});

test('veli onayını kaldıran yazım aktif:false da yazar', () => {
  const kaldirmalar = veliYazimlari().filter(g => /onaylandi:\s*false/.test(g));
  assert.ok(kaldirmalar.length >= 1, 'veli onay kaldırma yazımı bulunamadı');
  for (const g of kaldirmalar) assert.match(g, /aktif:\s*false/, g.slice(0, 160));
});

test('veliler ekranında tek seferlik aktif onarımı yalnız aktif alanını yazar', () => {
  const blok = html.slice(html.indexOf('window.veliAktifOnar'), html.indexOf('function veliFiltreliListe'));
  assert.match(blok, /updateDoc\(doc\(db, "veliler", email\), \{ aktif: true \}\)/);
  assert.match(blok, /personelSet\.has\(email\)/);
  assert.doesNotMatch(blok, /deleteDoc|setDoc/);
});
