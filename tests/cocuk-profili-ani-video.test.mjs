// Çocuk profili (16 Ekim 2026): öğrenciye dair canlı bilgiler + haftalık anı videoları.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPortal } from './helpers/portal-pwa.mjs';

const index = readPortal('index.html');
const fonk = (ad) => {
  const bas = index.search(new RegExp(`(?:async )?function ${ad}\\(`));
  assert.ok(bas >= 0, ad);
  return index.slice(bas, index.indexOf('\n}\n', bas) + 2);
};

test('doğum günü metni: bugün, yarın, kalan gün ve noktalı tarih', () => {
  const kaynak = fonk('caDogumGunuMetni');
  const caDogumGunuMetni = new Function(`${kaynak}; return caDogumGunuMetni;`)();
  const simdi = new Date(2026, 9, 16, 15, 0);
  assert.equal(caDogumGunuMetni('2021-10-16', simdi), 'Bugün doğum günü!');
  assert.equal(caDogumGunuMetni('2021-10-17', simdi), 'Doğum günü yarın');
  assert.equal(caDogumGunuMetni('2021-11-08', simdi), 'Doğum gününe 23 gün');
  assert.equal(caDogumGunuMetni('2021-10-15', simdi), 'Doğum gününe 364 gün');
  assert.equal(caDogumGunuMetni('08.11.2021', simdi), 'Doğum gününe 23 gün');
  assert.equal(caDogumGunuMetni('', simdi), '');
  assert.equal(caDogumGunuMetni('bilinmiyor', simdi), '');
});

test('profil: gerçek sayaçlar, son fotoğraflar ve video bölümü; belge onayı burada değil', () => {
  const html = fonk('caProfilHTML');
  for (const parca of ['id="caProfGunluk"', '>Bu ay günlük<', 'id="caProfFoto"', '>Fotoğraf<', '>Gelişim ort.<',
    'id="caProfilFotolar"', 'Son fotoğrafları', '<div id="caProfilVideoBolum" hidden></div>', 'gelişim ortalaması']) {
    assert.ok(html.includes(parca), parca);
  }
  assert.doesNotMatch(html, /veliBelgeOnayKart|Onay Bekleyen Belgeler/);
  assert.ok(html.indexOf('caProfilFotoBolum') < html.indexOf('caProfilVideoBolum'));
  assert.ok(html.indexOf('caProfilVideoBolum') < html.indexOf('Eğitim Gelişimi'));
  assert.match(index, /if \(caEkran === "profil"\) \{ setTimeout\(\(\) => \{ try \{ caProfilDoldur\(\); \}/);
});

test('profil doldurma: bu ayın günlükleri, galeri özeti ve anı videoları', () => {
  const d = fonk('caProfilDoldur');
  assert.match(d, /collection\(db, "gunlukRaporlar"\), where\("ogrenciId", "==", ogrId\)/);
  assert.match(d, /m\?\.profilOzeti \? await m\.profilOzeti\(6\)/);
  assert.match(d, /if \(veliAktifOgrenci\?\.id !== ogrId \|\| !kutu\?\.isConnected\) return;/);
  assert.match(d, /escapeHtml\(f\.url\)/);
  assert.match(d, /modulYukle\("veli-ani-video"\)\.then\(m => m && m\.profilBolumu\("caProfilVideoBolum"\)\)/);
  const galeri = readPortal('moduller/veli-galeri.js');
  assert.match(galeri, /export async function profilOzeti\(adet=6\)\{/);
  assert.match(galeri, /url:kucuk\(m\.bunnyUrl,360\)/);
  assert.match(galeri, /const ozel=fotolar\.filter\(m=>m\.hedefTur==='ogrenci'\);/);
});

test('ana sayfa: izlenmemiş yeni video kartı belge uyarısının üstünde', () => {
  const ev = fonk('caHomeHTML');
  assert.ok(ev.indexOf('<div id="caHomeAniVideo" hidden></div>') > 0);
  assert.ok(ev.indexOf('caHomeAniVideo') < ev.indexOf('caHomeBelgeUyari'));
  assert.match(index, /modulYukle\("veli-ani-video"\)\.then\(m => m && m\.anaSayfaUyari\("caHomeAniVideo"\)\)/);
});

// ── moduller/veli-ani-video.js
const modul = await import('../moduller/veli-ani-video.js');

test('yalnız Firebase Storage adresleri ve yayındaki videolar', () => {
  const { guvenliAdres, videoNormalle } = modul;
  const url = 'https://firebasestorage.googleapis.com/v0/b/bcka-site.firebasestorage.app/o/ani-videolari%2Fa%2Fv.mp4?alt=media&token=t';
  assert.equal(guvenliAdres(url), url);
  for (const kotu of ['http://firebasestorage.googleapis.com/x', 'https://evil.example.com/v.mp4', 'javascript:alert(1)', '']) {
    assert.equal(guvenliAdres(kotu), '');
  }
  const v = videoNormalle('a__2026-W42', { url, kapakUrl: 'https://evil.example.com/k.jpg', yayinda: true, baslik: "Asım'ın Haftası",
    alt: '12 – 16 Ekim 2026', sureSn: 33.7, olusturuldu: { toMillis: () => 5 } });
  assert.deepEqual(v, { id: 'a__2026-W42', url, kapak: '', baslik: "Asım'ın Haftası", alt: '12 – 16 Ekim 2026', sure: 34, tur: '', zaman: 5 });
  assert.equal(videoNormalle('x', { url, yayinda: false }), null);
  assert.equal(videoNormalle('x', { url: 'https://evil.example.com/v.mp4', yayinda: true }), null);
});

test('sorgu Firestore kuralıyla uyumlu: öğrenci + yayinda filtresi; yeniden eskiye sıralı, önbellekli', async () => {
  const kosullar = [];
  let okuma = 0;
  const url = (n) => `https://firebasestorage.googleapis.com/v0/b/b/o/${n}?alt=media&token=t`;
  const belgeler = [
    { id: 'o1__2026-W41', data: () => ({ url: url(1), yayinda: true, olusturuldu: { toMillis: () => 100 } }) },
    { id: 'o1__2026-W42', data: () => ({ url: url(2), yayinda: true, olusturuldu: { toMillis: () => 200 } }) },
    { id: 'o1__bozuk', data: () => ({ url: 'https://x.example.com/v.mp4', yayinda: true }) }
  ];
  globalThis.window = { PortalAPI: {
    db: {}, state: {},
    fb: {
      collection: (_db, ad) => ({ ad }),
      where: (alan, op, deger) => { kosullar.push([alan, op, deger]); return { alan }; },
      query: (k) => k,
      getDocs: async () => { okuma++; return { forEach: (f) => belgeler.forEach(f) }; }
    }
  } };
  const liste = await modul.videolariGetir('o1');
  assert.deepEqual(kosullar, [['ogrenciId', '==', 'o1'], ['yayinda', '==', true]]);
  assert.deepEqual(liste.map(v => v.id), ['o1__2026-W42', 'o1__2026-W41']);
  await modul.videolariGetir('o1');
  assert.equal(okuma, 1, 'beş dakika içinde tekrar okunmaz');
  await modul.videolariGetir('o1', { tazele: true });
  assert.equal(okuma, 2);
  assert.deepEqual(await modul.videolariGetir(''), []);
  delete globalThis.window;
});

test('oynatıcı ve kartlar erişilebilir; metinler kaçışlı; yeni rozet yalnız izlenmemişe', () => {
  const kaynak = readPortal('moduller/veli-ani-video.js');
  assert.match(kaynak, /<video controls playsinline autoplay preload="auto"><\/video>/);
  assert.match(kaynak, /perde\.setAttribute\('role', 'dialog'\)/);
  assert.match(kaynak, /aria-label="Kapat"/);
  assert.match(kaynak, /if \(e\.key === 'Escape'\) kapat\(\);/);
  assert.match(kaynak, /v\.src = video\.url;/);
  assert.match(kaynak, /kartHTML\(v, i, v\.zaman > gorulen\)/);
  assert.match(kaynak, /env\(safe-area-inset-top, 0px\)/);
  assert.doesNotMatch(kaynak, /\$\{(?:v|video|yeni)\.(?:baslik|alt|url|kapak|id)\}/, 'çıktıya giden her alan esc() ile');
  assert.match(kaynak, /\$\{esc\(video\.baslik\)\}/);
});

test('sürüm: önbellek, kayıt ve galeri modülü birlikte', () => {
  assert.match(index, /window\.PORTAL_SURUM = "v219";/);
  assert.match(index, /serviceworker\.js\?v=219/);
  assert.match(index, /"portalSwReload_v219"/);
  const sw = readPortal('serviceworker.js');
  assert.match(sw, /const CACHE_VERSION = "v219-kitap-kulubu-tercihi";/);
  assert.match(sw, /"\.\/moduller\/veli-galeri\.js\?v=v219",/);
});
