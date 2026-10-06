import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('galeri mail hedefi güncel veliler koleksiyonu ve ogrenciIds bağını kullanır',()=>{
  const start=source.indexOf('async function galeriBildirimMailGonder(grup)');
  const end=source.indexOf('// ============ VELİ GALERİ',start);
  assert.ok(start>0&&end>start);
  const fn=source.slice(start,end);
  assert.match(fn,/getDocs\(collection\(db, "veliler"\)\)/);
  assert.match(fn,/v\.ogrenciIds/);
  assert.match(fn,/hedefOgrenciIdleri/);
  assert.match(fn,/hedefMailHarita/);
  assert.match(fn,/veli1Eposta|veli1Email/);
  assert.match(fn,/Yeni Galeri İçeriği/);
});

test('yükleme hatası kullanıcıya gerçek neden ile gösterilir',()=>{
  const start=source.indexOf('window.galeriYukle = async function()');
  const end=source.indexOf('// Lightbox',start);
  assert.ok(start>0&&end>start);
  const fn=source.slice(start,end);
  assert.match(fn,/const yuklemeHatalari = \[\]/);
  assert.match(fn,/Video\/dosya yüklenemedi/);
  assert.match(fn,/Önceki video yükleme oturumu çakıştı/);
  assert.match(fn,/Yükleme başarısız:/);
});
