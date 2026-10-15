import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as C from '../js/meb-denetim-cekirdek.js';
import { panelHtml, raporHtml, veriYukle, kayitKaydet, ozelMaddeKaydet, ozelMaddeSil, zamanAsimli, KURAL_PARCASI, esc } from '../moduller/meb-denetim.js';

const kok = new URL('../', import.meta.url);
const BUGUN = '2026-10-14';
const madde = id => C.DENETIM_KATEGORILERI.flatMap(k => k.maddeler).find(m => m.id === id);

test('katalog: eski "<kategori>_<sıra>" anahtarlarıyla aynı kimlikler, 80 madde, sıra korunur', () => {
  assert.deepEqual(C.DENETIM_KATEGORILERI.map(k => [k.id, k.maddeler.length]),
    [['yemek', 12], ['evrak', 28], ['guvenlik', 25], ['kapasite', 15]]);
  for (const kat of C.DENETIM_KATEGORILERI) {
    kat.maddeler.forEach((m, i) => assert.equal(m.id, `${kat.id}_${i}`));
  }
  assert.equal(madde('guvenlik_0').s, 'Yangın tatbikatı son 6 ay içinde yapıldı mı?');
  assert.equal(madde('guvenlik_0').periyotAy, 6);
  assert.equal(madde('evrak_8').periyotAy, 12);
  assert.equal(madde('guvenlik_8').periyotAy, 3);
  assert.equal(madde('yemek_0').periyotAy, undefined);
  // Periyot yalnız metinde süre yazan maddelerde var.
  for (const m of C.DENETIM_KATEGORILERI.flatMap(k => k.maddeler).filter(x => x.periyotAy)) {
    assert.match(m.s, /son \d+ (ay|yıl)|yıllık/, m.id);
  }
  assert.throws(() => { C.DENETIM_KATEGORILERI[0].maddeler.push({}); });
});

test('tarih: geçerlilik, ay ekleme (ay sonuna kırpma), İstanbul bugünü, gün farkı', () => {
  assert.equal(C.tarihGecerli('2026-02-29'), false);
  assert.equal(C.tarihGecerli('2028-02-29'), true);
  assert.equal(C.tarihGecerli('14.10.2026'), false);
  assert.equal(C.ayEkle('2026-08-31', 6), '2027-02-28');
  assert.equal(C.ayEkle('2026-10-14', 12), '2027-10-14');
  assert.equal(C.ayEkle('2026-11-30', 3), '2027-02-28');
  assert.equal(C.bugunIstanbul(Date.parse('2026-10-14T21:30:00Z')), '2026-10-15');
  assert.equal(C.gunFarki('2026-10-14', '2026-11-13'), 30);
  assert.equal(C.tarihYazi('2026-10-14'), '14.10.2026');
});

test('süre: periyot ve geçerlilikten en yakını; 30 gün eşiği; uygulanamaz takip edilmez', () => {
  const tatbikat = madde('guvenlik_0'); // 6 ayda bir
  assert.deepEqual(C.sureDurumu(tatbikat, { durum: 'uygun', sonKontrol: '2026-05-01' }, BUGUN),
    { tur: 'yaklasiyor', son: '2026-11-01', kalanGun: 18, kaynak: 'periyot' });
  assert.equal(C.sureDurumu(tatbikat, { durum: 'uygun', sonKontrol: '2026-03-01' }, BUGUN).tur, 'gecti');
  assert.equal(C.sureDurumu(tatbikat, { durum: 'uygun', sonKontrol: '2026-10-01' }, BUGUN).tur, 'tamam');
  assert.equal(C.sureDurumu(tatbikat, { durum: 'uygun' }, BUGUN).tur, 'tarihYok');
  assert.equal(C.sureDurumu(tatbikat, { durum: 'uygulanamaz', sonKontrol: '2020-01-01' }, BUGUN).tur, 'yok');
  const sigorta = madde('evrak_2');
  assert.deepEqual(C.sureDurumu(sigorta, { gecerlilikBitis: '2026-10-20' }, BUGUN), { tur: 'yaklasiyor', son: '2026-10-20', kalanGun: 6, kaynak: 'gecerlilik' });
  assert.equal(C.sureDurumu(sigorta, {}, BUGUN).tur, 'yok');
  // İkisi birden varsa önce dolan esas alınır.
  assert.equal(C.sureDurumu(tatbikat, { sonKontrol: '2026-10-01', gecerlilikBitis: '2026-10-10' }, BUGUN).son, '2026-10-10');
  assert.equal(C.hatirlatmaEsigi({ kalanGun: -1 }), 'gecti');
  assert.equal(C.hatirlatmaEsigi({ kalanGun: 7 }), '7gun');
  assert.equal(C.hatirlatmaEsigi({ kalanGun: 30 }), '30gun');
  assert.equal(C.hatirlatmaEsigi({ kalanGun: 31 }), '');
});

test('skor: süresi geçmiş "uyumlu" eksik sayılır, uygulanamaz paydadan çıkar, kritik eksik sayılır', () => {
  const kategoriler = C.kategorileriTopla({});
  const kayitlar = {
    guvenlik_0: { durum: 'uygun', sonKontrol: '2026-01-01' },     // kritik, süresi geçti
    yemek_1: { durum: 'uygun' },
    yemek_2: { durum: 'uygulanamaz' },
    yemek_4: { durum: 'eksik', not: 'Defter alınacak' }
  };
  assert.equal(C.etkinDurum(madde('guvenlik_0'), kayitlar.guvenlik_0, BUGUN), 'eksik');
  const o = C.ozetHesapla(kategoriler, kayitlar, BUGUN);
  assert.equal(o.toplam, 79);
  assert.equal(o.uygun, 1);
  assert.equal(o.uygulanamaz, 1);
  assert.equal(o.eksik, 2);
  assert.equal(o.gecti, 1);
  assert.equal(o.notlu, 1);
  assert.equal(o.kritikEksik, C.DENETIM_KATEGORILERI.flatMap(k => k.maddeler).filter(m => m.k).length);
  assert.equal(o.yuzde, 1);
});

test('tarihsiz periyodik "uyumlu" madde ayrıca sayılır ve "Tarih girilmeli" filtresinde çıkar', () => {
  const kategoriler = C.kategorileriTopla({});
  const kayitlar = {
    guvenlik_0: { durum: 'uygun' },                           // 6 ayda bir, tarih yok
    guvenlik_8: { durum: 'eksik' },                           // periyodik ama eksik: tarih beklenmez
    evrak_8: { durum: 'uygun', sonKontrol: '2026-09-01' },    // tarihli
    yemek_0: { durum: 'uygun' }                               // periyot yok
  };
  assert.equal(C.tarihBekliyor(madde('guvenlik_0'), kayitlar.guvenlik_0, BUGUN), true);
  assert.equal(C.tarihBekliyor(madde('guvenlik_8'), kayitlar.guvenlik_8, BUGUN), false);
  assert.equal(C.tarihBekliyor(madde('evrak_8'), kayitlar.evrak_8, BUGUN), false);
  assert.equal(C.tarihBekliyor(madde('yemek_0'), kayitlar.yemek_0, BUGUN), false);
  const o = C.ozetHesapla(kategoriler, kayitlar, BUGUN);
  assert.equal(o.tarihsiz, 1);
  assert.equal(o.uygun, 3, 'skorda uyumlu kalır');
  assert.equal(C.filtreUyar(madde('guvenlik_0'), kayitlar.guvenlik_0, { filtre: 'tarihsiz' }, BUGUN), true);
  assert.equal(C.filtreUyar(madde('evrak_8'), kayitlar.evrak_8, { filtre: 'tarihsiz' }, BUGUN), false);
  const html = panelHtml({ kategoriler, kayitlar, bugun: BUGUN });
  assert.match(html, /<b>1<\/b><span>Tarih girilmeli<\/span>/);
  assert.match(html, /data-deger="tarihsiz">Tarih girilmeli · 1/);
  assert.match(html, /Uyumlu işaretli, son kontrol tarihi girilmeli/);
  const temiz = panelHtml({ kategoriler, kayitlar: {}, bugun: BUGUN });
  assert.doesNotMatch(temiz, /data-deger="tarihsiz"/, 'tarihsiz madde yoksa filtre gizli');
  assert.doesNotMatch(temiz, /Tarih girilmeli<\/span>/);
});

test('filtreler ve Türkçe arama', () => {
  const k = { durum: 'eksik', not: 'İtfaiye RAPORU bekleniyor', sorumlu: 'Ayşe Işık' };
  const m = madde('guvenlik_3');
  assert.equal(C.filtreUyar(m, k, { filtre: 'eksik' }, BUGUN), true);
  assert.equal(C.filtreUyar(m, k, { filtre: 'kritik' }, BUGUN), true);
  assert.equal(C.filtreUyar(madde('guvenlik_1'), { durum: 'eksik' }, { filtre: 'kritik' }, BUGUN), false);
  assert.equal(C.filtreUyar(m, k, { filtre: 'notlu', arama: 'itfaiye rapor' }, BUGUN), true);
  assert.equal(C.filtreUyar(m, k, { arama: 'ışık' }, BUGUN), true);
  assert.equal(C.filtreUyar(m, k, { filtre: 'sure' }, BUGUN), false, 'tarih girilmemiş madde süre filtresine girmez');
  assert.equal(C.filtreUyar(m, { durum: 'uygun', sonKontrol: '2026-04-20' }, { filtre: 'sure' }, BUGUN), true);
  assert.equal(C.filtreUyar(madde('yemek_0'), {}, { filtre: 'sure' }, BUGUN), false);
});

test('kayıt ve özel madde doğrulama; eski kayıtların taşınması', () => {
  const k = C.kayitDuzenle({ durum: 'hack', not: 'x'.repeat(5000), sorumlu: '  Ali   Veli ', sonKontrol: '2026-13-01', kanit: ' klasör 3 ', guncelleyen: 'A@B.COM' });
  assert.equal(k.durum, 'bos');
  assert.equal(k.not.length, C.SINIRLAR.not);
  assert.equal(k.sorumlu, 'Ali Veli');
  assert.equal(k.sonKontrol, '');
  assert.equal(k.kanit, 'klasör 3');
  assert.equal(k.guncelleyen, 'a@b.com');
  assert.deepEqual([k.baslik, k.periyotAy, k.kritik], ['', 0, false]);
  const kopya = C.kayitDuzenle({ baslik: 'Yangın tatbikatı', periyotAy: 6, kritik: true });
  assert.deepEqual([kopya.baslik, kopya.periyotAy, kopya.kritik], ['Yangın tatbikatı', 6, true]);
  assert.equal(C.kayitDuzenle({ periyotAy: 7 }).periyotAy, 0);
  assert.throws(() => C.ozelMaddeDuzenle({ s: '   ' }));
  assert.deepEqual(C.ozelMaddeDuzenle({ s: 'Servis muayenesi', kategori: 'yok', periyotAy: 5, k: 'evet' }),
    { kategori: 'ozel', s: 'Servis muayenesi', k: false, periyotAy: 0, olusturan: '', olusturuldu: '' });
  const id = C.ozelMaddeIdUret(() => 0.5);
  assert.match(id, /^ozel_[a-z0-9]{10}$/);
  assert.equal(C.maddeIdGecerli(id), true);
  assert.equal(C.maddeIdGecerli('maddeler.x'), false);
  const kat = C.kategorileriTopla({
    ozel_aaaaaa1: { kategori: 'guvenlik', s: 'Servis muayenesi', periyotAy: 12, olusturuldu: '2' },
    ozel_bbbbbb2: { kategori: 'ozel', s: 'Bahçe kapısı kilidi', olusturuldu: '1' },
    'kotu.anahtar': { s: 'x' }, ozel_cccccc3: { s: '' }
  });
  assert.equal(kat.find(k => k.id === 'guvenlik').maddeler.at(-1).s, 'Servis muayenesi');
  assert.deepEqual(kat.at(-1).maddeler.map(m => m.s), ['Bahçe kapısı kilidi']);
  assert.deepEqual(C.eskiKayitlariTasi({
    yemek_0: { durum: 'uygun', tarih: '2026-09-01T10:00:00Z' }, yemek_1: { durum: 'bos' },
    evrak_99: { durum: 'eksik' }, 'x_1': { durum: 'uygun' }, kapasite_2: { durum: 'baska' }
  }), { yemek_0: C.kayitDuzenle({ durum: 'uygun', guncellendi: '2026-09-01T10:00:00Z' }) });
});

test('panel ve rapor kullanıcı metnini kaçışlar; süre ve not rozetleri görünür', () => {
  const kategoriler = C.kategorileriTopla({ ozel_aaaaaa1: { kategori: 'ozel', s: '<img src=x onerror=alert(1)>' } });
  const kayitlar = {
    guvenlik_0: { durum: 'uygun', sonKontrol: '2026-05-01', sorumlu: '<b>Ali</b>', not: '"tırnak" & <script>' },
    ozel_aaaaaa1: { durum: 'eksik', kanit: "javascript:'x'" }
  };
  const html = panelHtml({ kategoriler, kayitlar, bugun: BUGUN, acikMadde: 'guvenlik_0' });
  assert.doesNotMatch(html, /<img src=x|<script>|<b>Ali<\/b>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /⏰ 18 gün kaldı · 01\.11\.2026/);
  assert.match(html, /👤 &lt;b&gt;Ali&lt;\/b&gt;/);
  assert.match(html, /data-detay="guvenlik_0"/);
  assert.match(html, /&quot;tırnak&quot; &amp; &lt;script&gt;<\/textarea>/);
  assert.match(html, /sonraki: 01\.11\.2026/);
  const kapali = panelHtml({ kategoriler, kayitlar, bugun: BUGUN, filtre: 'eksik' });
  assert.doesNotMatch(kapali, /data-madde="yemek_0"/);
  assert.match(kapali, /data-madde="ozel_aaaaaa1"/);
  assert.match(html, /data-eylem="rapor"/);
  assert.doesNotMatch(panelHtml({ kategoriler, kayitlar, bugun: BUGUN, rapor: false }), /data-eylem="rapor"/);
  const okuma = panelHtml({ kategoriler, kayitlar, bugun: BUGUN, acikMadde: 'guvenlik_0', yetkili: false });
  assert.doesNotMatch(okuma, /data-eylem="kaydet"/);
  const rapor = raporHtml({ kategoriler, kayitlar, bugun: BUGUN });
  assert.doesNotMatch(rapor, /<img src=x|<script>|<b>Ali/);
  assert.match(rapor, /Uyum Skoru: %/);
  assert.match(rapor, /Kontrol: 01\.05\.2026<br>Geçerli: 01\.11\.2026/);
  assert.equal(esc(`<a href='x'>&"`), '&lt;a href=&#39;x&#39;&gt;&amp;&quot;');
});

function sahteFb(depo, { okumaHatasi = {} } = {}) {
  const yazilan = [];
  const SIL = Symbol('sil');
  const fb = {
    doc: (db, k, b) => `${k}/${b}`,
    getDoc: async yol => ({ exists: () => depo.has(yol), data: () => depo.get(yol) }),
    setDoc: async (yol, veri, sec) => { yazilan.push([yol, veri, sec]); },
    deleteField: () => SIL,
    runTransaction: async (db, fn) => {
      // Gerçek işlem gibi: hata olursa yazmalar uygulanmaz.
      const bekleyen = [];
      const sonuc = await fn({
        get: async yol => {
          if (okumaHatasi[yol]) throw okumaHatasi[yol];
          return { exists: () => depo.has(yol), data: () => depo.get(yol) };
        },
        set: (yol, veri) => bekleyen.push(() => { yazilan.push([yol, veri, 'tx']); depo.set(yol, veri); }),
        delete: yol => bekleyen.push(() => { yazilan.push([yol, null, 'tx-sil']); depo.delete(yol); })
      });
      bekleyen.forEach(f => f());
      return sonuc;
    }
  };
  return { api: { fb, db: {}, state: { currentUser: { email: 'Mudur@Okul.com' }, personel: { adSoyad: 'Emrah Bay' } } }, yazilan, SIL };
}

test('ilk açılış: eski durumlar işlem içinde bir kez taşınır, herkese açık eski belge silinir; yeni belge varsa dokunulmaz', async () => {
  const depo = new Map([['ayarlar/mebDenetim', { kayitlar: { yemek_0: { durum: 'eksik', tarih: 't' }, evrak_1: { durum: 'uygun' } }, guncelleyen: 'ogretmen@okul.com' }]]);
  const { api, yazilan } = sahteFb(depo);
  const veri = await veriYukle(api);
  assert.deepEqual(Object.keys(veri.maddeler).sort(), ['evrak_1', 'yemek_0']);
  assert.equal(veri.tasindi, true);
  assert.deepEqual(yazilan.map(([yol, , tur]) => [yol, tur]), [['mebDenetim/durum', 'tx'], ['ayarlar/mebDenetim', 'tx-sil']]);
  assert.equal(depo.has('ayarlar/mebDenetim'), false, 'veliler dahil herkesin okuyabildiği belge kalmaz');
  const ikinci = await veriYukle(api);
  assert.equal(ikinci, veri);
  assert.equal(yazilan.length, 2, 'ikinci açılışta yazma yok');
});

test('ilk açılış: eski belge yoksa boş başlar ve silme denenmez; okunamazsa taşıma yapılmaz', async () => {
  const bos = sahteFb(new Map());
  const veri = await veriYukle(bos.api);
  assert.deepEqual(veri.maddeler, {});
  assert.deepEqual(bos.yazilan.map(([yol, , tur]) => [yol, tur]), [['mebDenetim/durum', 'tx']]);
  // Ağ / yetki hatası "boş" sayılmaz: yeni belge oluşmaz, sonraki açılışta yeniden denenir.
  const depo = new Map([['ayarlar/mebDenetim', { kayitlar: { yemek_0: { durum: 'uygun' } } }]]);
  const hatali = sahteFb(depo, { okumaHatasi: { 'ayarlar/mebDenetim': Object.assign(new Error('ağ'), { code: 'unavailable' }) } });
  await assert.rejects(veriYukle(hatali.api), /ağ/);
  assert.equal(hatali.yazilan.length, 0);
  assert.equal(depo.has('mebDenetim/durum'), false);
});

test('kayıt yalnız ilgili maddeyi birleştirerek yazar; özel madde silme alanları kaldırır', async () => {
  const { api, yazilan, SIL } = sahteFb(new Map());
  const k = await kayitKaydet(api, 'guvenlik_0', { durum: 'uygun', sonKontrol: '2026-10-01', not: ' tamam ' });
  assert.equal(k.guncelleyenAd, 'Emrah Bay');
  const [yol, veri, sec] = yazilan[0];
  assert.equal(yol, 'mebDenetim/durum');
  assert.deepEqual(sec, { merge: true });
  assert.deepEqual(Object.keys(veri.maddeler), ['guvenlik_0']);
  assert.equal(veri.maddeler.guvenlik_0.not, 'tamam');
  assert.equal(veri.guncelleyen, 'mudur@okul.com');
  // Durum düğmesi: yalnız durum + madde kopyası + son güncelleyen (not, tarih ezilmez).
  await kayitKaydet(api, 'guvenlik_0', { durum: 'eksik', baslik: 'Yangın tatbikatı', periyotAy: 6, kritik: true }, ['durum']);
  const kismi = yazilan.at(-1)[1].maddeler.guvenlik_0;
  assert.deepEqual(Object.keys(kismi).sort(), ['baslik', 'durum', 'guncellendi', 'guncelleyen', 'guncelleyenAd', 'kritik', 'periyotAy']);
  assert.equal(kismi.durum, 'eksik');
  yazilan.pop();
  await assert.rejects(kayitKaydet(api, 'maddeler.x', {}), /Geçersiz madde/);
  const { id } = await ozelMaddeKaydet(api, { s: 'Servis muayenesi', kategori: 'guvenlik', periyotAy: 12 }, () => 0.1);
  assert.equal(yazilan[1][1].ozelMaddeler[id].s, 'Servis muayenesi');
  await ozelMaddeSil(api, id);
  assert.equal(yazilan[2][1].ozelMaddeler[id], SIL);
  assert.equal(yazilan[2][1].maddeler[id], SIL);
  await assert.rejects(ozelMaddeSil(api, 'guvenlik_0'), /Yalnız okula özel/);
});

test('index.html: satır içi denetim kodu kaldırıldı, sekme modülü yükler; kural parçası yönetimle sınırlı', async () => {
  const html = await readFile(new URL('index.html', kok), 'utf8');
  assert.doesNotMatch(html, /const DENETIM_KATEGORILERI|let denetimKayitlari|window\.denetimKaydet|denetimSekmesiAcildi/);
  assert.match(html, /<div id="denetimKok"><\/div>/);
  assert.match(html, /modulYukle\("meb-denetim"\)\.then\(m => m && m\.panelKur\("denetimKok"\)\)/);
  assert.match(KURAL_PARCASI, /match \/mebDenetim\/\{docId\} \{\n  allow read, write: if isAdmin\(\) \|\| isYonetim\(\);\n\}/);
  const modul = await readFile(new URL('moduller/meb-denetim.js', kok), 'utf8');
  assert.doesNotMatch(modul, /ayarlar\/mebDenetim'?\s*,\s*\{[^}]*kayitlar/, 'eski herkese açık belgeye yazılmaz');
  assert.doesNotMatch(modul, /setDoc\(fb\.doc\(db, ESKI_DENETIM_BELGE/);
  // Hatırlatma sunucusu katalog bilmez: madde metni, periyot ve önem kayda kopyalanır.
  assert.match(modul, /const madde = \{ baslik: m\?\.s \|\| '', periyotAy: m\?\.periyotAy \|\| 0, kritik: m\?\.k === true \}/);
  assert.match(modul, /kayitKaydet\(api, id, \{ \.\.\.degisen, \.\.\.madde \}, alanlar\)/);
  // Kurulum işareti await'ten önce, senkron konur (çift dokunuşta olaylar iki kez bağlanmaz).
  assert.match(modul, /const kurulum = panelOlustur\(kok, secenek\)[^\n]*\n\s*kok\._mebDenetimKurulum = kurulum;/);
  // Çekirdek sürümlü içe aktarılır: tarayıcı önbelleği eski çekirdeği vermesin.
  assert.match(modul, /from '\.\.\/js\/meb-denetim-cekirdek\.js\?v=\d+'/);
});

test('çevrimdışı yazma ekranı kilitlemez: süre dolunca "bekliyor" döner, sonuç sonra gelir', async () => {
  assert.deepEqual(await zamanAsimli(Promise.resolve(5), 50), { sonuc: 5 });
  assert.deepEqual(await zamanAsimli(new Promise(() => {}), 10), { bekliyor: true });
  await assert.rejects(zamanAsimli(Promise.reject(new Error('red')), 50), /red/);
});

test('portal bildirimi: meb-denetim hatırlatması MEB Denetim sekmesini süre filtresiyle açar', async () => {
  const html = await readFile(new URL('index.html', kok), 'utf8');
  assert.match(html, /if \(personelMi && \/\^meb-denetim\/\.test\(tip\)\) \{[\s\S]{0,260}window\.modulSec\("denetim"\);[\s\S]{0,200}panelKur\("denetimKok", \{ filtre: "sure" \}\)/);
});
