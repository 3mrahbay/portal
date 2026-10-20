// Ortak içerik hedefi sözleşmesi (duyuru · takvim): Portal ve ZEKY aynı kayıtları
// aynı kurallarla yorumlar. Tek öğrenci, çoklu öğrenci ("ogrenciler"), sınıf ve tüm okul;
// çelişkili kayıt hiçbir veliye açılmaz ve formda "Tüm Okul"a dönüşmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  icerikHedefi, hedefKapsar, ogrenciHedefte, cocukHedefli, hedefAlanlari, formHedefi,
  hedefMetni, hedefEtiketi, veliHedefEtiketi
} from '../js/icerik-hedefi.js';
import { hedefVeliEmailleri } from '../js/zeky-bildirim-koprusu.js';

const B = { tip: 'bilinmiyor', siniflar: [], ogrenciler: [] };
const sade = h => JSON.parse(JSON.stringify(h));

test('portal ve ZEKY biçimleri aynı hedefe çözülür', () => {
  assert.deepEqual(sade(icerikHedefi({ hedefTur: 'tumOkul' })), { tip: 'okul', siniflar: [], ogrenciler: [] });
  assert.deepEqual(sade(icerikHedefi({})), { tip: 'okul', siniflar: [], ogrenciler: [] }, 'hedefsiz eski kayıt tüm okul');
  assert.deepEqual(sade(icerikHedefi({ hedefTur: 'sinif', hedefDeger: 'Papatyalar Sınıfı' })), { tip: 'sinif', siniflar: ['Papatyalar Sınıfı'], ogrenciler: [] });
  assert.deepEqual(sade(icerikHedefi({ hedefTip: 'sinif', siniflar: ['A', 'B'] })), { tip: 'sinif', siniflar: ['A', 'B'], ogrenciler: [] });
  assert.deepEqual(sade(icerikHedefi({ hedefTur: 'ogrenci', hedefDeger: 'a' })), { tip: 'cocuk', siniflar: [], ogrenciler: ['a'] });
  assert.deepEqual(sade(icerikHedefi({ hedefTip: 'cocuk', ogrenciler: ['a', 'b'] })), { tip: 'cocuk', siniflar: [], ogrenciler: ['a', 'b'] });
  assert.deepEqual(sade(icerikHedefi({ hedefTur: 'ogrenci', hedefTip: 'cocuk', hedefDeger: 'a', ogrenciler: ['a', 'b'] })),
    { tip: 'cocuk', siniflar: [], ogrenciler: ['a', 'b'] }, 'çoklu seçim: hedefDeger ilk öğrenci');
  assert.deepEqual(sade(icerikHedefi({ hedefTur: 'ogrenci', hedefOgrenciId: 'a' })), { tip: 'cocuk', siniflar: [], ogrenciler: ['a'] });
});

test('çelişkili kayıt "bilinmiyor" olur (ZEKY ortakIcerikHedefi ile aynı kurallar)', () => {
  for (const d of [
    { hedefTur: 'sinif', hedefTip: 'cocuk', ogrenciler: ['a'] },           // tür çelişkisi
    { hedefTur: 'ogrenci', hedefDeger: 'z', ogrenciler: ['a', 'b'] },     // ilk öğrenci listede yok
    { hedefTur: 'ogrenci', ogrenciler: ['a'], ogrenciIds: ['b'] },        // iki liste farklı
    { hedefTur: 'ogrenci', hedefOgrenciId: 'a', ogrenciId: 'b' },         // iki tekil takma ad
    { hedefTur: 'ogrenci', ogrenciler: ['a'], hedefOgrenciId: 'b' },      // takma ad listeyi genişletemez
    { hedefTur: 'tumOkul', ogrenciler: ['a'] },                           // tüm okul + değer
    { hedefTur: 'sinif', ogrenciler: ['a'] },                             // sınıf + öğrenci
    { hedefTur: 'bilinmeyen' }
  ]) assert.deepEqual(sade(icerikHedefi(d)), B, JSON.stringify(d));
  assert.deepEqual(sade(icerikHedefi(null)), B);
});

test('hedefKapsar ve ogrenciHedefte: veli, alıcı ve öğretmen süzgeçleri', () => {
  const coklu = { hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciler: ['a', 'b'] };
  assert.equal(hedefKapsar(coklu, { ogrenciIds: ['b'] }), true, 'ikinci öğrencinin velisi');
  assert.equal(hedefKapsar(coklu, { ogrenciIds: ['c'], siniflar: ['A'] }), false);
  assert.equal(hedefKapsar({ hedefTur: 'sinif', hedefDeger: 'Papatyalar Sınıfı' }, { siniflar: ['Mimoza'] }), true, 'eski/yeni sınıf adı');
  assert.equal(hedefKapsar({ hedefTur: 'sinif', hedefDeger: 'A' }, { siniflar: ['B'] }), false);
  assert.equal(hedefKapsar({ hedefTur: 'tumOkul' }, {}), true);
  assert.equal(hedefKapsar({ hedefTur: 'ogrenci', hedefDeger: 'z', ogrenciler: ['a'] }, { ogrenciIds: ['a', 'z'] }), false, 'çelişkili kapalı');
  assert.equal(ogrenciHedefte(coklu, 'b', 'X'), true);
  assert.equal(ogrenciHedefte(coklu, 'c', 'X'), false);
  assert.equal(ogrenciHedefte({ hedefTur: 'sinif', hedefDeger: 'A' }, 'c', 'A'), true);
  assert.equal(ogrenciHedefte({ hedefTur: 'sinif', hedefDeger: 'A' }, 'c', ''), false);
  assert.equal(cocukHedefli(coklu), true);
  assert.equal(cocukHedefli({ hedefTur: 'sinif', hedefDeger: 'A' }), false);
});

test('hedefAlanlari tüm hedef alanlarını tutarlı yazar; çoklu kayıtta başka çocuk adı yok', () => {
  assert.deepEqual(hedefAlanlari({ tur: 'tumOkul' }),
    { hedefTur: 'tumOkul', hedefTip: 'okul', hedefDeger: '', siniflar: [], ogrenciler: [], hedefOgrenciAd: '' });
  assert.deepEqual(hedefAlanlari({ tur: 'sinif', sinif: ' A ' }),
    { hedefTur: 'sinif', hedefTip: 'sinif', hedefDeger: 'A', siniflar: ['A'], ogrenciler: [], hedefOgrenciAd: '' });
  assert.deepEqual(hedefAlanlari({ tur: 'ogrenci', ogrenciler: [{ id: 'a', ad: 'Ada' }] }),
    { hedefTur: 'ogrenci', hedefTip: 'cocuk', hedefDeger: 'a', siniflar: [], ogrenciler: ['a'], hedefOgrenciAd: 'Ada' });
  const coklu = hedefAlanlari({ tur: 'ogrenci', ogrenciler: [{ id: 'a', ad: 'Ada' }, { id: 'b', ad: 'Bora' }, { id: 'a', ad: 'Ada' }, 'c'] });
  assert.deepEqual(coklu, { hedefTur: 'ogrenci', hedefTip: 'cocuk', hedefDeger: 'a', siniflar: [], ogrenciler: ['a', 'b', 'c'], hedefOgrenciAd: '3 öğrenci' });
  assert.ok(!JSON.stringify(coklu).includes('Bora'));
  // Yazılan her biçim aynı hedefe geri çözülür.
  for (const alan of [hedefAlanlari({ tur: 'tumOkul' }), hedefAlanlari({ tur: 'sinif', sinif: 'A' }), coklu]) {
    assert.notEqual(icerikHedefi(alan).tip, 'bilinmiyor', JSON.stringify(alan));
  }
  assert.throws(() => hedefAlanlari({ tur: 'ogrenci', ogrenciler: [] }), /Öğrenci seçilmedi/);
  assert.throws(() => hedefAlanlari({ tur: 'sinif', sinif: '' }), /Sınıf seçilmedi/);
  assert.throws(() => hedefAlanlari({ tur: 'x' }), /Bilinmeyen hedef/);
  assert.equal(hedefMetni(coklu), '3 öğrenci');
  assert.equal(hedefMetni(hedefAlanlari({ tur: 'sinif', sinif: 'A' })), 'A');
  assert.equal(hedefMetni(hedefAlanlari({ tur: 'tumOkul' })), 'Tüm okul');
});

test('formHedefi düzenlemede tüm seçimi geri getirir; çelişkili kayıt "Tüm Okul" olarak açılmaz', () => {
  assert.deepEqual(formHedefi({ hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciler: ['a', 'b'] }), { tur: 'ogrenci', sinif: '', siniflar: [], ogrenciIds: ['a', 'b'] });
  assert.deepEqual(formHedefi({ hedefTip: 'cocuk', ogrenciler: ['b'] }), { tur: 'ogrenci', sinif: '', siniflar: [], ogrenciIds: ['b'] });
  assert.deepEqual(formHedefi({ hedefTur: 'sinif', hedefDeger: 'A' }), { tur: 'sinif', sinif: 'A', siniflar: ['A'], ogrenciIds: [] });
  assert.deepEqual(formHedefi({ hedefTur: 'tumOkul' }), { tur: 'tumOkul', sinif: '', siniflar: [], ogrenciIds: [] });
  // ZEKY çok sınıflı kayıt: tüm sınıflar forma taşınır ve aynı sınıfla yeniden yazılınca korunur
  const coklu = formHedefi({ hedefTip: 'sinif', siniflar: ['A', 'B'] });
  assert.deepEqual(coklu, { tur: 'sinif', sinif: 'A', siniflar: ['A', 'B'], ogrenciIds: [] });
  const yeniden = hedefAlanlari({ tur: 'sinif', sinif: coklu.sinif, siniflar: coklu.siniflar });
  assert.deepEqual(yeniden.siniflar, ['A', 'B']); assert.equal(yeniden.hedefDeger, 'A');
  assert.equal(hedefKapsar(yeniden, { siniflar: ['B'] }), true, 'ikinci sınıfın velisi görmeye devam eder');
  assert.equal(hedefMetni(yeniden), 'A, B');
  assert.equal(formHedefi({ hedefTur: 'ogrenci', hedefDeger: 'z', ogrenciler: ['a'] }).tur, 'bilinmiyor');
});

test('etiketler: personel adları görür; veli yalnız kendi çocuğunun adını görür', () => {
  const adlar = { a: 'Ada', b: 'Bora', c: 'Cem', d: 'Deniz' };
  const adBul = id => adlar[id] || '';
  const coklu = { hedefTur: 'ogrenci', hedefDeger: 'a', ogrenciler: ['a', 'b'], hedefOgrenciAd: '2 öğrenci' };
  assert.equal(hedefEtiketi(coklu, { adBul }), 'Ada, Bora');
  assert.equal(hedefEtiketi({ ...coklu, ogrenciler: ['a', 'b', 'c', 'd'] }, { adBul }), 'Ada, Bora, Cem +1');
  assert.equal(hedefEtiketi({ hedefTur: 'ogrenci', hedefDeger: 'x', hedefOgrenciAd: 'Eski Ad' }, { adBul }), 'Eski Ad', 'eski tek öğrenci kaydı');
  assert.equal(hedefEtiketi({ hedefTur: 'sinif', hedefDeger: 'A' }), 'A');
  assert.equal(hedefEtiketi({ hedefTur: 'tumOkul' }), 'Tüm Okul');
  assert.equal(veliHedefEtiketi(coklu, [{ id: 'b', ad: 'Bora' }]), 'Size özel · Bora');
  assert.ok(!veliHedefEtiketi(coklu, [{ id: 'b', ad: 'Bora' }]).includes('Ada'), 'başka çocuğun adı yok');
  assert.equal(veliHedefEtiketi(coklu, []), 'Size özel');
  assert.equal(veliHedefEtiketi({ hedefTur: 'sinif', hedefDeger: 'A' }, []), 'A');
});

test('alıcı çözümü (e-posta/anlık bildirim) çoklu listeyi kullanır; çelişkili liste kimseye gitmez', t => {
  const eski = globalThis.window;
  globalThis.window = { PortalAPI: { state: {
    ogrenciList: [{ id: 'a', sinif: 'A' }, { id: 'b', sinif: 'B' }, { id: 'c', sinif: 'A' }],
    ayarListesi: { a: { durum: 'aktif', anne: { eposta: 'a@x.test' } }, b: { durum: 'aktif', baba: { eposta: 'b@x.test' } }, c: { durum: 'aktif', anne: { eposta: 'c@x.test' } } },
    aktifDonem: '2026-2027' } } };
  t.after(() => { if (eski === undefined) delete globalThis.window; else globalThis.window = eski; });
  assert.deepEqual(hedefVeliEmailleri(hedefAlanlari({ tur: 'ogrenci', ogrenciler: ['a', 'b'] })), ['a@x.test', 'b@x.test']);
  assert.deepEqual(hedefVeliEmailleri({ hedefTur: 'ogrenci', hedefDeger: 'c' }), ['c@x.test'], 'eski tek öğrenci çağrısı');
  assert.deepEqual(hedefVeliEmailleri({ hedefTur: 'ogrenci', hedefDeger: 'c', ogrenciler: ['a', 'b'] }), [], 'çelişkili');
  assert.deepEqual(hedefVeliEmailleri({ hedefTur: 'ogrenci', hedefDeger: '' , ogrenciler: ['a'] }), [], 'boş tekil değer');
});

test('Portal sözleşmesi ZEKY ortakIcerikHedefi ile aynı kuralları taşır (kaynak eşleşmesi)', async () => {
  const kaynak = await readFile(new URL('../js/icerik-hedefi.js', import.meta.url), 'utf8');
  for (const kural of [
    "if (tip === 'bilinmiyor' || (portalTur && zekyTur && portalTur !== zekyTur)) return BILINMIYOR;",
    'if (new Set(ozel).size > 1) return BILINMIYOR;',
    'if (ogrenciler.length && ozel.some(id => !ogrenciler.includes(id))) return BILINMIYOR;',
    'if (tek.length && ozel.some(id => !tek.includes(id))) return BILINMIYOR;'
  ]) assert.ok(kaynak.includes(kural), kural);
});
