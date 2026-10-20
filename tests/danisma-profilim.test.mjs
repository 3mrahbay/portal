// Danışma denetimi (20 Ekim 2026) — Profilim.
// - "Veli Görüşmelerim" kartı kapalı randevuSlotlari koleksiyonunu okuyordu:
//   kural okumayı reddettiği için her personelde "Randevular yüklenemedi".
//   Artık öğretmen ana sayfasındaki gibi yeni sistemden (gorusme-notlari.ozetKart);
//   danışma veliyle görüşmediği için kart onda çizilmez.
// - Fiş gönderiminden sonra tüm fiş listesi yalnız yetkili rollerde yenilenir.
// - Personel rehberi: sınıflar, silinen personelin düşmesi, yalnız yönetim eşitler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const bolum = (bas, son) => {
  const i = index.indexOf(bas), j = index.indexOf(son, i + bas.length);
  assert.ok(i >= 0 && j > i, 'bölüm bulunamadı: ' + bas);
  return index.slice(i, j);
};
const kaynak = bolum('window.profilRandevulariYukle = async function(email) {', '// ── Devam kaydı kartı');

function calistir(modul) {
  const okumalar = [];
  const el = { innerHTML: '' };
  const ctx = {
    window: {}, document: { getElementById: id => id === 'profilRandevular' ? el : null },
    db: {}, collection: (_, k) => ({ k }), getDocs: async (ref) => { okumalar.push(ref.k); throw Object.assign(new Error('denied'), { code: 'permission-denied' }); },
    modulYukle: async (ad) => (ad === 'gorusme-notlari' ? modul : null)
  };
  vm.createContext(ctx);
  vm.runInContext(kaynak, ctx);
  return { ctx, okumalar, el };
}

test('Veli Görüşmelerim: yeni randevu sisteminden çizilir, kapalı randevuSlotlari okunmaz', async () => {
  const cagri = [];
  const x = calistir({ ozetKart: async (id) => { cagri.push(id); return true; } });
  await x.ctx.window.profilRandevulariYukle('ogretmen@ornek.com');
  assert.deepEqual(cagri, ['profilRandevular']);
  assert.deepEqual(x.okumalar, []);
});

test('Veli Görüşmelerim: modül yüklenemezse kapalı arşiv okunmaz, kısa uyarı gösterilir', async () => {
  const x = calistir(null);
  await x.ctx.window.profilRandevulariYukle('ogretmen@ornek.com');
  assert.deepEqual(x.okumalar, []);
  assert.match(x.el.innerHTML, /yüklenemedi/);
});

test('Veli Görüşmelerim kartı yalnız randevu sunucusunun kabul ettiği rollerde çizilir', () => {
  assert.match(index, /\$\{!veliGorusmesiYapanRolMu\(\) \? "" : kart\("Veli Görüşmelerim"/);
  const ctx = { isAdmin: false, aktifKullaniciRol: '', rolNormalize: r => (r === 'halkla_iliskiler' ? 'danisma' : String(r || '')) };
  vm.createContext(ctx);
  vm.runInContext(bolum('function veliGorusmesiYapanRolMu() {', '// Görüşme yapmayan rollerde'), ctx);
  for (const [rol, beklenen] of [['ogretmen', true], ['pdr', true], ['mudur', true], ['egitim_koordinator', true], ['kurucu_mudur', true],
    ['danisma', false], ['halkla_iliskiler', false], ['muhasebe', false], ['asci', false], ['temizlik', false]]) {
    ctx.aktifKullaniciRol = rol;
    assert.equal(vm.runInContext('veliGorusmesiYapanRolMu()', ctx), beklenen, rol);
  }
  ctx.isAdmin = true; ctx.aktifKullaniciRol = '';
  assert.equal(vm.runInContext('veliGorusmesiYapanRolMu()', ctx), true);
});

test('Personel rehberi: sınıflar yazılır, silinen personel düşer; personel silinince rehberden de silinir', async () => {
  const yazilan = [], silinen = [];
  const ctx = {
    isAdmin: false, aktifKullaniciRol: 'mudur', rolNormalize: r => String(r || ''),
    DANISMA_GUVENLI_KOLEKSIYONLAR: { personeller: 'danismaPersonelRehberi' }, db: {},
    doc: (_, k, id) => ({ k, id }), collection: (_, k) => ({ k }), serverTimestamp: () => 'TS',
    danismaGuvenliBelgeleriYaz: async (l) => { yazilan.push(...l); },
    getDocs: async () => ({ forEach: cb => ['ogretmen@ornek.com', 'eski@ornek.com'].forEach(id => cb({ id, ref: { id } })) }),
    writeBatch: () => ({ delete: r => silinen.push(r.id), commit: async () => {} })
  };
  vm.createContext(ctx);
  vm.runInContext(bolum('async function danismaPersonelRehberiniSenkronla(liste, atamalar = {}) {', 'const ROL_ETIKETLERI'), ctx);
  await ctx.danismaPersonelRehberiniSenkronla([{ id: 'Ogretmen@Ornek.com', adSoyad: 'Öğr', rol: 'ogretmen', sinifAtamalari: ['Papatya'] }], { 'ogretmen@ornek.com': ['Lale', 'Papatya'] });
  assert.equal(yazilan.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(yazilan[0].data.siniflar)), ['Papatya', 'Lale']);
  assert.deepEqual(silinen, ['eski@ornek.com']);
  ctx.aktifKullaniciRol = 'egitim_koordinator'; yazilan.length = 0;
  await ctx.danismaPersonelRehberiniSenkronla([{ id: 'x@ornek.com', rol: 'ogretmen' }]);
  assert.equal(yazilan.length, 0, 'koordinatör rehberi eşitlemez (kural yalnız yönetim)');
  assert.match(bolum('window.personelSil = async function(email) {', 'showToast("🗑️ Personel silindi")'),
    /batch\.delete\(doc\(db, DANISMA_GUVENLI_KOLEKSIYONLAR\.personeller, email\.toLowerCase\(\)\)\)/);
});

test('Fiş gönderiminden sonra tüm fiş listesi yalnız yetkili rollerde yenilenir', () => {
  assert.match(index, /typeof giderTalepleriYukle === "function" && \(isAdmin \|\| \["kurucu_mudur", "mudur", "muhasebe", "egitim_koordinator"\]\.includes\(rolNormalize\(aktifKullaniciRol\)\)\)\) giderTalepleriYukle\(\);/);
});
