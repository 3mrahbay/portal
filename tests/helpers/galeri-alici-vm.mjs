// index.html dilimlerini vm içinde çalıştıran testler için galeri alıcı bağlamı.
// Gerçek js/galeri-alici.js dışa aktarımları + index.html'deki gerçek yardımcı bloğu
// (galeriAliciKaynagi, galeriAliciIcin, galeriOnayKartBilgisiHtml …) aynı bağlama yüklenir.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as alici from '../../js/galeri-alici.js';

const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const bas = index.indexOf('// ── Galeri alıcısı / yetki yardımcıları');
const son = index.indexOf('async function galeriGozlemOnayiEsitle(', bas);
if (bas < 0 || son < bas) throw new Error('Galeri alıcı yardımcı bloğu index.html içinde bulunamadı');

export const galeriAliciModulu = alici;
export const galeriAliciYardimciKaynagi = index.slice(bas, son);

// vm bağlamına modül dışa aktarımlarını ve gerçek yardımcı bloğu ekler.
export function galeriAliciBaglaminaEkle(ctx, { yardimcilar = true } = {}) {
  for (const [ad, deger] of Object.entries(alici)) if (!(ad in ctx)) ctx[ad] = deger;
  if (yardimcilar) vm.runInContext(galeriAliciYardimciKaynagi, ctx);
  return ctx;
}
