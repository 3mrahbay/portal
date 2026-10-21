import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Basit DOM ve PortalAPI taklidi: modül yüklenmeden önce kurulur.
const dugumler = new Map();
const stiller = [];
globalThis.document = {
  getElementById: (id) => dugumler.get(id) || null,
  createElement: (tag) => ({ tagName: tag, id: '', textContent: '' }),
  head: { appendChild(n) { stiller.push(n); dugumler.set(n.id, n); } },
  activeElement: null,
};
const yazilanlar = [];
const mesajlar = [];
let veri = {};
let onbellekten = false;
let okumaHatasi = false;
let girisEposta = 'emrahby@gmail.com';
const snap = (v) => ({ exists: () => v != null, data: () => structuredClone(v), metadata: { fromCache: onbellekten } });
globalThis.window = {
  scrollY: 0, scrollTo() {},
  modulYukle: async () => null,
  PortalAPI: {
    get auth() { return { currentUser: girisEposta ? { email: girisEposta } : null }; },
    db: {},
    toast: (m, t) => mesajlar.push([m, t]),
    lucide() {},
    fb: {
      doc: (_db, kol, id) => ({ yol: `${kol}/${id}` }),
      collection: (_db, kol) => ({ kol }),
      orderBy: () => ({}), limit: () => ({}),
      query: (k) => k,
      getDoc: async (ref) => { if (okumaHatasi) throw new Error('unavailable'); return snap(veri[ref.yol]); },
      getDocs: async (q) => { if (okumaHatasi) throw new Error('unavailable'); return { docs: Object.entries(veri).filter(([k]) => k.startsWith(q.kol + '/')).map(([, v]) => ({ data: () => structuredClone(v) })) }; },
      setDoc: async (ref, v) => { yazilanlar.push({ ref, v }); },
      serverTimestamp: () => 'SUNUCU_ZAMANI',
    },
  },
};

const m = await import('../moduller/gorunurluk.js');
const kok = () => { const d = { id: 'wsGorunurluk', innerHTML: '' }; dugumler.set('wsGorunurluk', d); return d; };

const gunlukBelge = (tarih, tiklama, gosterim, sira = 8) => ({ tarih, searchConsole: { tiklama, gosterim, ctr: gosterim ? tiklama / gosterim : 0, sira } });
const ayBelgesi = (ay, ek = {}) => ({
  ay,
  searchConsole: {
    ay, baslangic: `${ay}-01`, bitis: `${ay}-30`,
    toplam: { tiklama: 30, gosterim: 1200, ctr: 0.025, sira: 9.5 },
    marka: { tiklama: 12, gosterim: 40, ctr: 0.3, sira: 1.2, sorguSayisi: 1 },
    markaDisi: { tiklama: 18, gosterim: 1000, ctr: 0.018, sira: 12, sorguSayisi: 4 },
    bolgeler: { tuzla: { tiklama: 15, gosterim: 400, ctr: 0.0375, sira: 7, sorguSayisi: 2 }, pendik: { tiklama: 1, gosterim: 200, ctr: 0.005, sira: 15, sorguSayisi: 1 } },
    bolgeDisi: { tiklama: 12, gosterim: 440, ctr: 0.027, sira: 20, sorguSayisi: 2 },
    konular: { montessori: { tiklama: 5, gosterim: 500, ctr: 0.01, sira: 20, sorguSayisi: 2 } },
    niyetler: { ucret: { tiklama: 1, gosterim: 200, ctr: 0.005, sira: 15, sorguSayisi: 1 } },
    etiketler: {
      bolgeler: [{ id: 'tuzla', ad: 'Tuzla' }, { id: 'pendik', ad: 'Pendik' }],
      konular: [{ id: 'montessori', ad: 'Montessori' }],
      niyetler: [{ id: 'ucret', ad: 'Ücret' }],
    },
    ilkSorgular: [
      { sorgu: 'montessori nedir', tiklama: 0, gosterim: 400, ctr: 0, sira: 30, marka: false, bolge: [], konu: ['montessori'], niyet: [] },
      { sorgu: 'tuzla anaokulu', tiklama: 10, gosterim: 300, ctr: 0.033, sira: 6, marka: false, bolge: ['tuzla'], konu: ['anaokulu'], niyet: [] },
      { sorgu: '<img src=x onerror=alert(1)> pendik', tiklama: 1, gosterim: 200, ctr: 0.005, sira: 15, marka: false, bolge: ['pendik'], konu: [], niyet: ['ucret'] },
      { sorgu: 'bir çiçek koleji', tiklama: 12, gosterim: 40, ctr: 0.3, sira: 1.2, marka: true, bolge: [], konu: [], niyet: [] },
    ],
    ilkSayfalar: [{ sayfa: 'https://www.bircicekkoleji.com/montessori', tiklama: 8, gosterim: 600, ctr: 0.013, sira: 12 }, { sayfa: 'javascript:alert(1)', tiklama: 1, gosterim: 1, ctr: 1, sira: 1 }],
    cihazlar: { mobile: { tiklama: 25, gosterim: 900, ctr: 0.027, sira: 9 }, desktop: { tiklama: 5, gosterim: 300, ctr: 0.016, sira: 11 } },
    kapsam: { sorguSatiri: 4, gizliSorguGosterimi: 260 },
    ...ek,
  },
});

test('Türkçe normalleştirme ve güvenli kimlik süzgeci', () => {
  assert.equal(m.normalizeTr("DARICA'da Kreş"), 'darica da kres');
  assert.equal(m.kimlikSuz("bolge:tuzla');alert(1);//"), 'bolge:tuzlaalert1');
  assert.equal(m.esc('<b a="1">\'</b>'), '&lt;b a=&quot;1&quot;&gt;&#39;&lt;/b&gt;');
  assert.equal(m.grupKimligi('Çayırova Merkez'), 'cayirova-merkez');
  assert.deepEqual(m.kaliplariAyristir('Çayırova, ÇAYIROVA\nŞekerpınar,,'), ['cayirova', 'sekerpinar']);
});

test('son 28 gün özeti gösterime göre ağırlıklı sıra hesaplar', () => {
  const gunler = [
    { tarih: '2026-10-18', tiklama: 10, gosterim: 100, sira: 5 },
    { tarih: '2026-10-01', tiklama: 0, gosterim: 300, sira: 13 },
    { tarih: '2026-09-15', tiklama: 4, gosterim: 50, sira: 20 },
  ];
  const o = m.pencereOzeti(gunler, '2026-10-18', 28);
  assert.equal(o.simdi.tiklama, 10);
  assert.equal(o.simdi.gosterim, 400);
  assert.equal(o.simdi.sira, 11);
  assert.equal(o.simdi.gunVar, 2);
  assert.equal(o.once.gosterim, 50);
  assert.equal(o.once.ctr, 0.08);
});

test('haftalık seri son tam haftada biter ve bir yıl önceki haftayı eşleştirir', () => {
  assert.equal(m.haftaBasi('2026-10-18'), '2026-10-12'); // pazar → o haftanın pazartesisi
  assert.equal(m.haftaBasi('2026-10-12'), '2026-10-12');
  const gunler = [
    { tarih: '2026-10-14', tiklama: 3, gosterim: 30 },  // çarşamba, son hafta eksik
    { tarih: '2026-10-08', tiklama: 2, gosterim: 20 },
    { tarih: '2026-10-05', tiklama: 1, gosterim: 10 },
    { tarih: '2025-10-07', tiklama: 9, gosterim: 90 },  // 52 hafta önce
  ];
  const seri = m.haftalikSeri(gunler, '2026-10-14', 3);
  assert.deepEqual(seri.map((s) => s.hafta), ['2026-09-21', '2026-09-28', '2026-10-05']);
  assert.equal(seri[2].tiklama, 3);
  assert.deepEqual(seri[2].gecenYil, { tiklama: 9, gosterim: 90 });
  assert.equal(seri[0].veriVar, false);
  assert.equal(seri[0].gecenYil, null);
});

test('değişim yüzdesi ve kenar durumlar', () => {
  assert.equal(m.degisim(120, 100), 0.2);
  assert.equal(m.degisim(0, 0), 0);
  assert.equal(m.degisim(5, 0), null);
  assert.equal(m.degisim(null, 3), null);
});

test('kelimeler önceki ayla karşılaştırılır ve gruba göre süzülür', () => {
  const bu = ayBelgesi('2026-09').searchConsole;
  const once = { ilkSorgular: [{ sorgu: 'tuzla anaokulu', gosterim: 150 }] };
  const liste = m.sorgulariKarsilastir(bu, once);
  const tuzla = liste.find((q) => q.sorgu === 'tuzla anaokulu');
  assert.equal(tuzla.gosterimDegisim, 1);
  assert.equal(liste.find((q) => q.sorgu === 'montessori nedir').yeni, true);
  assert.deepEqual(m.sorgulariSuz(liste, { grup: 'bolge:tuzla' }).map((q) => q.sorgu), ['tuzla anaokulu']);
  assert.deepEqual(m.sorgulariSuz(liste, { grup: 'marka' }).map((q) => q.sorgu), ['bir çiçek koleji']);
  assert.equal(m.sorgulariSuz(liste, { grup: 'markaDisi' }).length, 3);
  assert.deepEqual(m.sorgulariSuz(liste, { ara: 'ÇİÇEK' }).map((q) => q.sorgu), ['bir çiçek koleji']);
  assert.equal(m.sorgulariSuz(liste, { grup: 'bilinmeyen:x' }).length, 0);
});

test('kelime grubu doğrulaması gece göreviyle aynı sınırları uygular', () => {
  const v = JSON.parse(JSON.stringify(m.VARSAYILAN_GRUPLAR));
  assert.deepEqual(m.grupAyariniDogrula(v).hatalar, []);
  const kotu = JSON.parse(JSON.stringify(m.VARSAYILAN_GRUPLAR));
  kotu.bolgeler.push({ id: '', ad: '', kaliplar: [] });
  kotu.bolgeler.push({ id: '', ad: 'Tuzla', kaliplar: ['x'] });
  kotu.konular = Array.from({ length: 21 }, (_, i) => ({ id: `k${i}`, ad: `K${i}`, kaliplar: ['kk'] }));
  const { hatalar } = m.grupAyariniDogrula(kotu);
  assert.ok(hatalar.some((h) => h.includes('ad boş')));
  assert.ok(hatalar.some((h) => h.includes('aynı adda')));
  assert.ok(hatalar.some((h) => h.includes('2–40 harf')));
  assert.ok(hatalar.some((h) => h.includes('en çok 20 grup')));
  const yeni = JSON.parse(JSON.stringify(m.VARSAYILAN_GRUPLAR));
  yeni.bolgeler.push({ id: '', ad: 'Çayırova', kaliplar: ['Çayırova'] });
  const { temiz } = m.grupAyariniDogrula(yeni);
  assert.deepEqual(temiz.bolgeler.at(-1), { id: 'cayirova', ad: 'Çayırova', kaliplar: ['cayirova'] });
});

test('grafik piksel genişliğinde, sayılar geçerli ve iki çizgiyle çizilir', () => {
  const seri = m.haftalikSeri([{ tarih: '2026-10-11', tiklama: 4, gosterim: 40 }, { tarih: '2025-10-12', tiklama: 2, gosterim: 20 }], '2026-10-11', 52);
  const svg = m.grafikSvg(seri, 400, 'tiklama');
  assert.match(svg, /width="400"/);
  assert.equal((svg.match(/<path /g) || []).length, 2);
  assert.doesNotMatch(svg, /NaN|undefined/);
  const olcek = m.grafikOlcek(seri, 400);
  assert.equal(olcek.indeks(-50), 0);
  assert.equal(olcek.indeks(10000), 51);
});

test('veri hazırlanırken ekran açıklayıcı durum gösterir', async () => {
  veri = { 'gorunurlukDurum/searchConsole': { backfillTamam: false, sonGun: '2026-10-18', sonHata: null } };
  const d = kok();
  await m.panelRender('wsGorunurluk');
  assert.match(d.innerHTML, /Google verileri hazırlıyor/);
  assert.match(d.innerHTML, /Henüz gösterilecek arama verisi yok/);
});

test('verili ekran özet, semt tablosu ve güvenli kelime listesi çizer', async () => {
  veri = {
    'gorunurlukDurum/searchConsole': { backfillTamam: true, sonGun: '2026-10-18', sonHata: null },
    'gorunurlukAylik/2026-08': ayBelgesi('2026-08'),
    'gorunurlukAylik/2026-09': ayBelgesi('2026-09'),
    'gorunurlukGunluk/2026-10-18': gunlukBelge('2026-10-18', 10, 100, 5),
    'gorunurlukGunluk/2026-10-01': gunlukBelge('2026-10-01', 2, 300, 13),
  };
  await window._gorunurluk.yenile();
  const d = dugumler.get('wsGorunurluk');
  assert.match(d.innerHTML, /Veriler <b>18 Ekim<\/b>/);
  assert.match(d.innerHTML, /gr-kpi/);
  assert.match(d.innerHTML, /Tuzla/);
  assert.match(d.innerHTML, /Semt belirtilmeyen/);
  assert.match(d.innerHTML, /Okul adı olmadan/);
  assert.match(d.innerHTML, /Telefon/);
  window._gorunurluk.sekme('kelimeler');
  assert.match(d.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt; pendik/);
  assert.doesNotMatch(d.innerHTML, /<img src=x/);
  window._gorunurluk.grup('bolge:tuzla');
  assert.match(d.innerHTML, /tuzla anaokulu/);
  assert.doesNotMatch(d.innerHTML, /montessori nedir/);
  window._gorunurluk.sekme('sayfalar');
  assert.match(d.innerHTML, /href="https:\/\/www\.bircicekkoleji\.com\/montessori"/);
  assert.doesNotMatch(d.innerHTML, /href="javascript:/);
});

test('kelime grupları kaydı yetkili hesapla ve sunucu verisiyle yapılır', async () => {
  window._gorunurluk.sekme('gruplar');
  const d = dugumler.get('wsGorunurluk');
  assert.match(d.innerHTML, /Henüz kaydedilmedi/);
  window._gorunurluk.grupEkle('bolgeler');
  window._gorunurluk.grupAd('bolgeler', 5, 'Çayırova');
  window._gorunurluk.grupKalip('bolgeler', 5, 'Çayırova, Şekerpınar');
  window._gorunurluk.grupAd('bolgeler', 0, 'Tuzla merkez');   // kayıtlı grubun kimliği değişmez
  yazilanlar.length = 0;
  assert.equal(await window._gorunurluk.gruplariKaydet(), true);
  const { ref, v } = yazilanlar[0];
  assert.equal(ref.yol, 'gorunurlukAyarlar/kelimeGruplari');
  assert.equal(v.guncelleyen, 'emrahby@gmail.com');
  assert.equal(v.guncellendi, 'SUNUCU_ZAMANI');
  assert.deepEqual(Object.keys(v).sort(), ['bolgeler', 'guncellendi', 'guncelleyen', 'konular', 'marka', 'niyetler']);
  assert.deepEqual(v.bolgeler[0], { id: 'tuzla', ad: 'Tuzla merkez', kaliplar: m.VARSAYILAN_GRUPLAR.bolgeler[0].kaliplar });
  assert.deepEqual(v.bolgeler.at(-1), { id: 'cayirova', ad: 'Çayırova', kaliplar: ['cayirova', 'sekerpinar'] });
  assert.ok(v.bolgeler.every((g) => !('idSabit' in g)));
});

test('önbellekten okunan ayar üzerine kayıt yapılmaz; yetkisiz hesap ekranı göremez', async () => {
  onbellekten = true;
  await window._gorunurluk.yenile();
  yazilanlar.length = 0;
  assert.equal(await window._gorunurluk.gruplariKaydet(), false);
  assert.equal(yazilanlar.length, 0);
  onbellekten = false;
  girisEposta = 'ogretmen@bircicekkoleji.com';
  const d = kok();
  await window._gorunurluk.yenile();
  assert.match(d.innerHTML, /Bu bölüm kapalı/);
  girisEposta = 'emrahby@gmail.com';
});

test('başarılı okumadan sonra başarısız yenileme eski taslağın kaydına izin vermez', async () => {
  veri = {
    'gorunurlukDurum/searchConsole': { backfillTamam: true, sonGun: '2026-10-18', sonHata: null },
    'gorunurlukAylik/2026-09': ayBelgesi('2026-09'),
    'gorunurlukAyarlar/kelimeGruplari': { marka: ['bcka'], bolgeler: [{ id: 'tuzla', ad: 'Tuzla', kaliplar: ['tuzla'] }], konular: m.VARSAYILAN_GRUPLAR.konular, niyetler: m.VARSAYILAN_GRUPLAR.niyetler },
  };
  kok();
  await window._gorunurluk.yenile();
  window._gorunurluk.sekme('gruplar');
  window._gorunurluk.grupEkle('bolgeler');
  window._gorunurluk.grupAd('bolgeler', 1, 'Pendik');
  window._gorunurluk.grupKalip('bolgeler', 1, 'pendik');
  okumaHatasi = true;
  await window._gorunurluk.yenile();
  assert.match(dugumler.get('wsGorunurluk').innerHTML, /Rapor yüklenemedi/);
  yazilanlar.length = 0;
  assert.equal(await window._gorunurluk.gruplariKaydet(), false);
  assert.equal(yazilanlar.length, 0);
  okumaHatasi = false;
  await window._gorunurluk.yenile();
  window._gorunurluk.sekme('gruplar');
  const html = dugumler.get('wsGorunurluk').innerHTML;
  assert.match(html, /value="Tuzla"/);
  assert.doesNotMatch(html, /value="Pendik"/);
});

test('bir önceki yıl verisi kısmiyse grafik bunu açıklar', async () => {
  veri = {
    'gorunurlukDurum/searchConsole': { backfillTamam: true, sonGun: '2026-10-18', sonHata: null },
    'gorunurlukAylik/2026-09': ayBelgesi('2026-09'),
    'gorunurlukGunluk/2026-10-11': gunlukBelge('2026-10-11', 4, 40),
    'gorunurlukGunluk/2026-06-14': gunlukBelge('2026-06-14', 3, 30),
    'gorunurlukGunluk/2025-10-12': gunlukBelge('2025-10-12', 2, 20),
  };
  await window._gorunurluk.yenile();
  window._gorunurluk.sekme('ozet');
  assert.match(dugumler.get('wsGorunurluk').innerHTML, /Google arama verisini 16 ay saklar/);
});

test('Web Sitesi bölümü Görünürlük sekmesini ayrı modülden yükler', () => {
  const ws = readFileSync(new URL('../moduller/web-sitesi.js', import.meta.url), 'utf8');
  assert.match(ws, /\{ id: "gorunurluk", ad: "Görünürlük"/);
  assert.match(ws, /id === "yardim" \|\| id === "medya" \|\| id === "gorunurluk"\) return ""/);
  assert.match(ws, /modulYukle\?\.\("gorunurluk"\)\.then\(\(m\) => m && m\.panelRender\("wsGorunurluk"\)\)/);
  assert.equal(stiller.filter((s) => s.id === 'gr-stil').length, 1);
});
