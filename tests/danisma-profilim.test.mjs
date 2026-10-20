// Danışma denetimi (20 Ekim 2026) — Profilim.
// - "Veli Görüşmelerim" kartı kapalı randevuSlotlari koleksiyonunu okuyordu:
//   kural okumayı reddettiği için her personelde "Randevular yüklenemedi".
//   Artık öğretmen ana sayfasındaki gibi yeni sistemden (gorusme-notlari.ozetKart);
//   danışma veliyle görüşmediği için kart onda çizilmez.
// - Fiş gönderiminden sonra tüm fiş listesi yalnız yetkili rollerde yenilenir.
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

test('Veli Görüşmelerim: modül yüklenemezse eski okuma yedek olarak kalır', async () => {
  const x = calistir(null);
  await x.ctx.window.profilRandevulariYukle('ogretmen@ornek.com');
  assert.deepEqual(x.okumalar, ['randevuSlotlari']);
  assert.match(x.el.innerHTML, /yüklenemedi/);
});

test('Danışmada Veli Görüşmelerim kartı çizilmez', () => {
  assert.match(index, /\$\{danismaRolMu\(\) \? "" : kart\("Veli Görüşmelerim"/);
});

test('Fiş gönderiminden sonra tüm fiş listesi yalnız yetkili rollerde yenilenir', () => {
  assert.match(index, /typeof giderTalepleriYukle === "function" && \(isAdmin \|\| \["kurucu_mudur", "mudur", "muhasebe", "egitim_koordinator"\]\.includes\(rolNormalize\(aktifKullaniciRol\)\)\)\) giderTalepleriYukle\(\);/);
});
