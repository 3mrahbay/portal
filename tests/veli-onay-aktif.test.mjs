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

// index.html içindeki saf eşleştirme fonksiyonlarını aynen çıkarıp çalıştırır.
function fonksiyon(ad) {
  const bas = html.indexOf(`function ${ad}(`);
  assert.ok(bas >= 0, `${ad} bulunamadı`);
  const son = html.indexOf('\n}\n', bas);
  return html.slice(bas, son + 2);
}
const { veliMukerrerleriBul } = new Function(
  ['veliKayitlariCikar', 'veliTelAnahtar', 'veliIlkAd', 'veliMukerrerleriBul']
    .map(fonksiyon).join('\n') + '\nreturn { veliMukerrerleriBul };'
)();

test('mükerrer: aynı çocuk, aynı telefon ve aynı ad → eski e-posta açık hesaba birleşir', () => {
  const o = {
    id: 'c1',
    veliler: [{ email: 'Eski@Hotmail.com', adSoyad: 'AYŞE ÇELEBİ', telefon: '0537 835 79 78' }],
    veli1Eposta: 'yeni@gmail.com', veli1AdSoyad: 'Ayşe Çelebi', veli1Telefon: '905378357978'
  };
  const w = { 'yeni@gmail.com': { onaylandi: true, ogrenciIds: ['c1'] } };
  assert.deepEqual(veliMukerrerleriBul(o, 'Atlas', w), [
    { ogrenciId: 'c1', ogrenciAd: 'Atlas', veliAd: 'AYŞE ÇELEBİ', eski: 'eski@hotmail.com', yeni: 'yeni@gmail.com' }
  ]);
});

test('mükerrer: anne-baba aynı telefonu yazmışsa babanın e-postası anneye birleşmez', () => {
  const o = {
    id: 'c1',
    veliler: [{ email: 'baba@hotmail.com', adSoyad: 'Mehmet Şamlı', telefon: '5321112233' }],
    veli1Eposta: 'anne@gmail.com', veli1AdSoyad: 'Seha Şamlı', veli1Telefon: '05321112233'
  };
  const w = { 'anne@gmail.com': { onaylandi: true, ogrenciIds: ['c1'] } };
  assert.deepEqual(veliMukerrerleriBul(o, 'Eliz', w), []);
});

test('mükerrer: onaysız, başka çocuğa bağlı veya telefonsuz eşe birleştirilmez', () => {
  const o = {
    id: 'c1',
    veliler: [{ email: 'eski@x.com', adSoyad: 'Onur Tut', telefon: '5320000000' },
              { email: 'telsiz@x.com', adSoyad: 'Kübra Tut', telefon: '' }],
    veli1Eposta: 'a@gmail.com', veli1AdSoyad: 'Onur Tut', veli1Telefon: '5320000000',
    veli2Eposta: 'b@gmail.com', veli2AdSoyad: 'Kübra Tut', veli2Telefon: '5321111111'
  };
  for (const w of [
    { 'a@gmail.com': { onaylandi: false, ogrenciIds: ['c1'] } },
    { 'a@gmail.com': { onaylandi: true, ogrenciIds: ['baska'] } }
  ]) assert.deepEqual(veliMukerrerleriBul(o, 'İnci', w), []);
});

test('mükerrer birleştirme veli satırını silmez, yalnız e-postayı değiştirir ve eskisini saklar', () => {
  const blok = html.slice(html.indexOf('window.veliMukerrerBirlestir'), html.indexOf('function veliFiltreliListe'));
  assert.match(blok, /confirm\(/);
  assert.match(blok, /eskiEmail:/);
  assert.match(blok, /eskiVeliEpostalari = arrayUnion/);
  assert.match(blok, /\.\.\.v,/);
  assert.doesNotMatch(blok, /deleteDoc|setDoc|deleteField|\.filter\(v =>/);
});

test('veliler ekranında tek seferlik aktif onarımı yalnız aktif alanını yazar', () => {
  const blok = html.slice(html.indexOf('window.veliAktifOnar'), html.indexOf('function veliFiltreliListe'));
  assert.match(blok, /updateDoc\(doc\(db, "veliler", email\), \{ aktif: true \}\)/);
  assert.match(blok, /personelSet\.has\(email\)/);
  assert.doesNotMatch(blok, /deleteDoc|setDoc/);
});
