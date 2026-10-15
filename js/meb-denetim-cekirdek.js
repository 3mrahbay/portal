// MEB DENETİM ÖZ-DEĞERLENDİRME · ortak çekirdek
// ─────────────────────────────────────────────────────────────────────
// Portal (js/meb-denetim-cekirdek.js) ve ZEKY (www/js/meb-denetim-cekirdek.js)
// bu dosyanın BİREBİR kopyasını kullanır. DOM veya Firebase içe aktarmaz;
// madde kataloğu, süre (periyot / geçerlilik) ve skor hesapları buradadır.
//
// Veri: mebDenetim/durum  (yalnız kurucu müdür ve müdür okur/yazar)
//   { surum:2, maddeler:{ <maddeId>: KAYIT }, ozelMaddeler:{ <ozelId>: OZEL },
//     tasindi:bool, guncellendi, guncelleyen }
//   KAYIT = { durum, not, sorumlu, sonKontrol, gecerlilikBitis, kanit,
//             baslik, periyotAy, kritik,              ← maddeden kopya (hatırlatma
//             guncelleyen, guncelleyenAd, guncellendi }  sunucusu katalog bilmez)
//   OZEL  = { kategori, s, k, periyotAy, olusturan, olusturuldu }
// Eski sürüm: ayarlar/mebDenetim.kayitlar (yalnız durum; her oturum açmış
// kullanıcı okuyabiliyordu). İlk açılışta durumlar buraya taşınır.
//
// Madde kimlikleri eski "<kategori>_<sıra>" anahtarlarıyla aynıdır; bu yüzden
// mevcut maddelerin sırası DEĞİŞTİRİLMEZ, yeni madde yalnız sona eklenir.
// ─────────────────────────────────────────────────────────────────────

export const MEB_DENETIM_SURUM = 2;
export const DENETIM_BELGE = Object.freeze({ koleksiyon: 'mebDenetim', belge: 'durum' });
export const ESKI_DENETIM_BELGE = Object.freeze({ koleksiyon: 'ayarlar', belge: 'mebDenetim' });
export const YAKLASAN_GUN = 30;
export const SINIRLAR = Object.freeze({ not: 2000, sorumlu: 80, kanit: 500, maddeMetni: 300 });
export const PERIYOTLAR = Object.freeze([0, 1, 3, 6, 12, 24, 36]);

export const DENETIM_DURUMLAR = Object.freeze({
  bos:         Object.freeze({ et: '?', ad: 'Cevapsız',    renk: '#8A92A6', bg: '#F1F2F7' }),
  uygun:       Object.freeze({ et: '✓', ad: 'Uyumlu',      renk: '#2F9E63', bg: '#E4F5EC' }),
  eksik:       Object.freeze({ et: '✕', ad: 'Eksik',       renk: '#C2445A', bg: '#FDECEF' }),
  uygulanamaz: Object.freeze({ et: '—', ad: 'Uygulanamaz', renk: '#B45309', bg: '#FCF7E1' })
});
export const DURUM_SIRASI = Object.freeze(['bos', 'uygun', 'eksik', 'uygulanamaz']);

// periyotAy: madde metninde açıkça yazan yenileme süresi ("son 6 ay içinde").
// Son kontrol tarihi girilince bir sonraki kontrol tarihi buradan hesaplanır.
export const DENETIM_KATEGORILERI = Object.freeze([
  {
    id: 'yemek', ad: "Yemek Numunesi & Saklama", ikon: 'utensils-crossed', renk: '#3D8A5F',
    maddeler: [
      { id: 'yemek_0', k: true, s: "Her öğün için 100 gr yemek numunesi alınıyor mu?", kaynak: "Sağlık Bakanlığı Toplu Tüketim Yön." },
      { id: 'yemek_1', k: false, s: "Numuneler etiketli mi? (tarih, saat, öğün, alan kişi)", kaynak: "Sağlık Bakanlığı" },
      { id: 'yemek_2', k: false, s: "Numune saklama buzdolabı sıcaklığı +4°C ± 2°C aralığında mı?", kaynak: "Sağlık Bakanlığı" },
      { id: 'yemek_3', k: true, s: "Numuneler 72 saat saklanıyor mu?", kaynak: "Sağlık Bakanlığı Toplu Tüketim Yön." },
      { id: 'yemek_4', k: false, s: "Saklama süresi dolan numuneler için imha kaydı tutuluyor mu?", kaynak: "—" },
      { id: 'yemek_5', k: false, s: "Son numune fotoğrafı yüklendi mi?", kaynak: "—" },
      { id: 'yemek_6', k: false, s: "Mutfak günlük temizlik checklist'i dolduruluyor mu?", kaynak: "Sağlık Bakanlığı Hijyen" },
      { id: 'yemek_7', k: true, s: "Mutfak personeli sağlık karnesi/portör muayeneleri güncel mi?", kaynak: "Sağlık Bakanlığı" },
      { id: 'yemek_8', k: false, s: "Mutfakta haşere kontrol sözleşmesi/raporu mevcut mu?", kaynak: "—" },
      { id: 'yemek_9', k: false, s: "Yemek tedarikçisi gıda güvenliği belgesi yüklü mü? (dış catering)", kaynak: "—" },
      { id: 'yemek_10', k: false, s: "Aylık yemek menüsü beslenme uzmanı/diyetisyen onaylı mı?", kaynak: "MEB ÖÖKY" },
      { id: 'yemek_11', k: false, s: "Günlük yemek menüsü panoda/uygulamada veliye gösteriliyor mu?", kaynak: "MEB ÖÖKY" }
    ]
  },
  {
    id: 'evrak', ad: "Resmi Evrak & Personel Dokümantasyon", ikon: 'folder-open', renk: '#5A6ACF',
    maddeler: [
      { id: 'evrak_0', k: true, s: "Kurum açılış izin belgesi yüklü ve geçerli mi?", kaynak: "MEB / Aile Bakanlığı" },
      { id: 'evrak_1', k: true, s: "Açılış izin belgesindeki toplam öğrenci kapasitesi sistemde kayıtlı mı?", kaynak: "—" },
      { id: 'evrak_2', k: true, s: "Mali mesuliyet sigorta poliçesi yüklü mü?", kaynak: "İşyeri Sigorta" },
      { id: 'evrak_3', k: true, s: "Öğrenci kaza sigortası yapıldı mı?", kaynak: "—" },
      { id: 'evrak_4', k: false, s: "Yangın/işyeri sigorta poliçesi geçerli mi?", kaynak: "—" },
      { id: 'evrak_5', k: false, s: "Tüm personelin diploma fotokopisi sistemde yüklü mü?", kaynak: "MEB ÖÖKY" },
      { id: 'evrak_6', k: true, s: "Tüm personelin sağlık raporu güncel (son 6 ay) mi?", kaynak: "İSG / MEB", periyotAy: 6 },
      { id: 'evrak_7', k: false, s: "Tüm personelin akciğer (PA) röntgen raporu son 1 yıl içinde mi?", kaynak: "Sağlık Bakanlığı", periyotAy: 12 },
      { id: 'evrak_8', k: true, s: "Tüm personelin adli sicil belgesi son 1 yıl içinde mi?", kaynak: "MEB ÖÖKY md. 26", periyotAy: 12 },
      { id: 'evrak_9', k: false, s: "Tüm personel için ilk yardım eğitim sertifikası var mı?", kaynak: "İSG" },
      { id: 'evrak_10', k: true, s: "Tüm personelin SGK kayıtları aktif mi?", kaynak: "SGK" },
      { id: 'evrak_11', k: false, s: "İmzalı iş sözleşmesi her personel için mevcut mu?", kaynak: "İş Kanunu" },
      { id: 'evrak_12', k: false, s: "Öğretmenlerin pedagojik formasyon belgesi yüklü mü?", kaynak: "MEB ÖÖKY" },
      { id: 'evrak_13', k: false, s: "Personel devamsızlık (PDKS) kayıtları tutuluyor mu?", kaynak: "İş Kanunu" },
      { id: 'evrak_14', k: true, s: "Tüm aktif öğrencilerin aşı kartı sisteme yüklü mü?", kaynak: "Sağlık Bakanlığı aşı takvimi" },
      { id: 'evrak_15', k: false, s: "Tüm aktif öğrencilerin sağlık raporu (kayıt anında) yüklü mü?", kaynak: "—" },
      { id: 'evrak_16', k: false, s: "Veli kayıt sözleşmesi her öğrenci için imzalı mı?", kaynak: "—" },
      { id: 'evrak_17', k: true, s: "KVKK açık rıza belgesi her veli için alındı mı?", kaynak: "KVKK md. 5/6" },
      { id: 'evrak_18', k: false, s: "MEB ders günlüğü / etkinlik defteri tutuluyor mu?", kaynak: "MEB ÖÖKY" },
      { id: 'evrak_19', k: false, s: "Yoklama kayıtları günlük tutuluyor ve denetlenebilir mi?", kaynak: "MEB ÖÖKY" },
      { id: 'evrak_20', k: false, s: "Aylık eğitim programı dosyada arşivli mi?", kaynak: "MEB ÖÖKY" },
      { id: 'evrak_21', k: false, s: "Veli bilgilendirme/duyuru kayıtları arşivli mi?", kaynak: "—" },
      { id: 'evrak_22', k: false, s: "Kayıt-defter incelemesi (öğrenci giriş-çıkış) tutuluyor mu?", kaynak: "MEB ÖÖKY" },
      { id: 'evrak_23', k: false, s: "Aidat tahsilat kayıtları (e-arşiv fatura) düzenli kesiliyor mu?", kaynak: "Vergi Usul Kanunu" },
      { id: 'evrak_24', k: false, s: "Vergi levhası asılı / yüklü mü?", kaynak: "VUK" },
      { id: 'evrak_25', k: false, s: "Mali müşavir sözleşmesi mevcut mu?", kaynak: "—" },
      { id: 'evrak_26', k: false, s: "Aylık beyannameler düzenli veriliyor mu?", kaynak: "Maliye" },
      { id: 'evrak_27', k: true, s: "İşletme ruhsatı / faaliyet belgesi geçerli mi?", kaynak: "—" }
    ]
  },
  {
    id: 'guvenlik', ad: "Tatbikat, Güvenlik & Bina Kontrolü", ikon: 'shield-alert', renk: '#C2445A',
    maddeler: [
      { id: 'guvenlik_0', k: true, s: "Yangın tatbikatı son 6 ay içinde yapıldı mı?", kaynak: "İtfaiye Yönetmeliği", periyotAy: 6 },
      { id: 'guvenlik_1', k: false, s: "Deprem tatbikatı son 6 ay içinde yapıldı mı?", kaynak: "AFAD", periyotAy: 6 },
      { id: 'guvenlik_2', k: false, s: "Tahliye tatbikatı son 12 ay içinde yapıldı mı?", kaynak: "İSG", periyotAy: 12 },
      { id: 'guvenlik_3', k: true, s: "Yangın söndürücüler son 6 ayda kontrol edildi mi?", kaynak: "İtfaiye", periyotAy: 6 },
      { id: 'guvenlik_4', k: false, s: "Yangın algılama sistemi yıllık kontrol yapıldı mı?", kaynak: "İtfaiye", periyotAy: 12 },
      { id: 'guvenlik_5', k: false, s: "Asansör periyodik muayenesi (varsa) son 1 yıl içinde mi?", kaynak: "Asansör Yön.", periyotAy: 12 },
      { id: 'guvenlik_6', k: false, s: "Elektrik tesisat kontrol raporu (EMO) son 1 yıl içinde mi?", kaynak: "EMO", periyotAy: 12 },
      { id: 'guvenlik_7', k: false, s: "Doğalgaz tesisat kontrol (İGDAŞ vs.) son 1 yıl içinde mi?", kaynak: "Doğalgaz dağıtım", periyotAy: 12 },
      { id: 'guvenlik_8', k: false, s: "Su deposu temizlik son 3 ay içinde mi?", kaynak: "Sağlık Bakanlığı", periyotAy: 3 },
      { id: 'guvenlik_9', k: false, s: "Klima/havalandırma temizlik son 6 ay içinde mi?", kaynak: "—", periyotAy: 6 },
      { id: 'guvenlik_10', k: false, s: "Bina periyodik bakım sözleşmesi güncel mi?", kaynak: "—" },
      { id: 'guvenlik_11', k: true, s: "İlk yardım dolabı dolu, son kullanım tarihleri geçmemiş mi?", kaynak: "İSG" },
      { id: 'guvenlik_12', k: false, s: "Acil çıkış levhaları her bölümde görünür mü?", kaynak: "İtfaiye" },
      { id: 'guvenlik_13', k: false, s: "Acil çıkış aydınlatması çalışıyor mu?", kaynak: "İtfaiye" },
      { id: 'guvenlik_14', k: true, s: "Yangın merdiveni engelsiz, kullanılabilir durumda mı?", kaynak: "İtfaiye" },
      { id: 'guvenlik_15', k: false, s: "Çocuk parkı oyuncakları TS EN 1176 uyumlu mu?", kaynak: "TS EN 1176" },
      { id: 'guvenlik_16', k: false, s: "Pencere çocuk-güvenlik kilitleri takılı mı?", kaynak: "İSG" },
      { id: 'guvenlik_17', k: false, s: "Elektrik prizleri çocuk-güvenlikli (kapaklı) mı?", kaynak: "İSG" },
      { id: 'guvenlik_18', k: false, s: "Kapı zili / kamera / ziyaretçi defteri ile giriş kontrolü var mı?", kaynak: "MEB ÖÖKY" },
      { id: 'guvenlik_19', k: true, s: "Çocuk teslim güvenliği (PIN/yetkili kişi) sistemi aktif mi?", kaynak: "MEB ÖÖKY" },
      { id: 'guvenlik_20', k: false, s: "Olay/kaza raporu prosedürü tanımlı ve kayıt tutuluyor mu?", kaynak: "İSG" },
      { id: 'guvenlik_21', k: false, s: "Risk değerlendirme raporu (İSG) hazır ve güncel mi?", kaynak: "6331 sayılı İSG Kanunu" },
      { id: 'guvenlik_22', k: true, s: "Çocuk ilaç talepleri reçeteli mi (reçetesiz ilaç verilmiyor)?", kaynak: "MEB ÖÖKY" },
      { id: 'guvenlik_23', k: false, s: "İlaç verme logu kayıt altında mı?", kaynak: "—" },
      { id: 'guvenlik_24', k: false, s: "İlaçlar çocuğun ulaşamayacağı kilitli alanda mı saklanıyor?", kaynak: "İSG" }
    ]
  },
  {
    id: 'kapasite', ad: "Kapasite & Operasyonel Hazırlık", ikon: 'clipboard-list', renk: '#B45309',
    maddeler: [
      { id: 'kapasite_0', k: true, s: "Açılış izin belgesindeki toplam kapasite sistemde kayıtlı mı?", kaynak: "MEB / Aile Bakanlığı" },
      { id: 'kapasite_1', k: true, s: "Aktif öğrenci sayısı bakanlık kapasitesinin altında mı?", kaynak: "MEB / Aile Bakanlığı" },
      { id: 'kapasite_2', k: false, s: "Her sınıfın metre kare ölçüsü sistemde kayıtlı mı?", kaynak: "MEB ÖÖKY md. 4-5" },
      { id: 'kapasite_3', k: false, s: "Açık oyun alanı m² ölçüsü sisteme girildi mi?", kaynak: "MEB ÖÖKY" },
      { id: 'kapasite_4', k: false, s: "Günlük temizlik checklist'i dolduruluyor mu?", kaynak: "Sağlık Bakanlığı Hijyen" },
      { id: 'kapasite_5', k: false, s: "Tuvalet/lavabo temizlik logu tutuluyor mu (günde min 2)?", kaynak: "Hijyen" },
      { id: 'kapasite_6', k: false, s: "Çocuk ölçüm (boy/kilo) takibi aylık yapılıyor mu?", kaynak: "Sağlık Bakanlığı" },
      { id: 'kapasite_7', k: false, s: "Çocuk uyku takibi günlük yapılıyor mu?", kaynak: "—" },
      { id: 'kapasite_8', k: false, s: "Beslenme takibi (yedi/yemedi) günlük yapılıyor mu?", kaynak: "—" },
      { id: 'kapasite_9', k: false, s: "Ziyaretçi giriş-çıkış defteri tutuluyor mu?", kaynak: "MEB ÖÖKY" },
      { id: 'kapasite_10', k: false, s: "Sınıflarda yeterli sayıda öğretmen/yardımcı personel görevli mi?", kaynak: "İyi pratik" },
      { id: 'kapasite_11', k: false, s: "Sınıf öğretmenlerinin nöbet/izin durumu önceden planlı mı?", kaynak: "İş Kanunu" },
      { id: 'kapasite_12', k: false, s: "Yedek/destek öğretmen tanımı mevcut mu?", kaynak: "—" },
      { id: 'kapasite_13', k: false, s: "Veli memnuniyet anketi son 6 ay içinde yapıldı mı?", kaynak: "—", periyotAy: 6 },
      { id: 'kapasite_14', k: false, s: "Aile katılımı (etkinlik, açık ders) düzenli planlı mı?", kaynak: "MEB ÖÖKY" }
    ]
  }
].map(kat => Object.freeze({ ...kat, maddeler: Object.freeze(kat.maddeler.map(m => Object.freeze(m))) })));

export const OZEL_KATEGORI = Object.freeze({
  id: 'ozel', ad: 'Okula Özel Maddeler', ikon: 'list-plus', renk: '#4B5563'
});

// ── Tarih yardımcıları (İstanbul takvim günü, "YYYY-AA-GG") ───────────
const GUN_MS = 86400000;

export function tarihGecerli(deger) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(deger || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// Türkiye sabit UTC+3: bugünün İstanbul tarihi.
export function bugunIstanbul(simdi = Date.now()) {
  return new Date(simdi + 3 * 3600000).toISOString().slice(0, 10);
}

const gunSayisi = t => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / GUN_MS;

export function gunFarki(bas, bit) {
  return Math.round(gunSayisi(bit) - gunSayisi(bas));
}

// 31 Ağustos + 6 ay = 28/29 Şubat (ay sonuna kırpılır).
export function ayEkle(tarih, ay) {
  if (!tarihGecerli(tarih)) return '';
  const yil = +tarih.slice(0, 4), a = +tarih.slice(5, 7) - 1 + Number(ay || 0), gun = +tarih.slice(8, 10);
  const hedefYil = yil + Math.floor(a / 12), hedefAy = ((a % 12) + 12) % 12;
  const aySonu = new Date(Date.UTC(hedefYil, hedefAy + 1, 0)).getUTCDate();
  return new Date(Date.UTC(hedefYil, hedefAy, Math.min(gun, aySonu))).toISOString().slice(0, 10);
}

export function tarihYazi(tarih) {
  return tarihGecerli(tarih) ? tarih.split('-').reverse().join('.') : '';
}

// ── Kayıt ve özel madde doğrulama ────────────────────────────────────
const metin = (deger, sinir) => String(deger ?? '').replace(/\r\n?/g, '\n').trim().slice(0, sinir);

export function kayitDuzenle(ham = {}) {
  const durum = DURUM_SIRASI.includes(ham?.durum) ? ham.durum : 'bos';
  return {
    durum,
    not: metin(ham?.not, SINIRLAR.not),
    sorumlu: metin(ham?.sorumlu, SINIRLAR.sorumlu).replace(/\s+/g, ' '),
    sonKontrol: tarihGecerli(ham?.sonKontrol) ? ham.sonKontrol : '',
    gecerlilikBitis: tarihGecerli(ham?.gecerlilikBitis) ? ham.gecerlilikBitis : '',
    kanit: metin(ham?.kanit, SINIRLAR.kanit),
    baslik: metin(ham?.baslik, SINIRLAR.maddeMetni),
    periyotAy: PERIYOTLAR.includes(Number(ham?.periyotAy)) ? Number(ham.periyotAy) : 0,
    kritik: ham?.kritik === true,
    guncelleyen: metin(ham?.guncelleyen, 200).toLowerCase(),
    guncelleyenAd: metin(ham?.guncelleyenAd, 120),
    guncellendi: metin(ham?.guncellendi, 40)
  };
}

export function ozelMaddeDuzenle(ham = {}) {
  const s = metin(ham?.s, SINIRLAR.maddeMetni).replace(/\s+/g, ' ');
  if (!s) throw new Error('Madde metni boş olamaz.');
  const kategori = [...DENETIM_KATEGORILERI.map(k => k.id), OZEL_KATEGORI.id].includes(ham?.kategori)
    ? ham.kategori : OZEL_KATEGORI.id;
  const periyotAy = PERIYOTLAR.includes(Number(ham?.periyotAy)) ? Number(ham.periyotAy) : 0;
  return {
    kategori, s, k: ham?.k === true, periyotAy,
    olusturan: metin(ham?.olusturan, 200).toLowerCase(),
    olusturuldu: metin(ham?.olusturuldu, 40)
  };
}

export function ozelMaddeIdUret(rastgele = Math.random) {
  let ek = '';
  while (ek.length < 10) ek += Math.floor(rastgele() * 36).toString(36);
  return 'ozel_' + ek.slice(0, 10);
}

export const maddeIdGecerli = id => /^(?:yemek|evrak|guvenlik|kapasite)_\d{1,3}$|^ozel_[a-z0-9]{6,20}$/.test(String(id || ''));

// Katalog + okula özel maddeler; özel maddeler kendi kategorisinin sonunda.
export function kategorileriTopla(ozelMaddeler = {}) {
  const ozel = Object.entries(ozelMaddeler || {})
    .filter(([id]) => /^ozel_[a-z0-9]{6,20}$/.test(id))
    .map(([id, ham]) => {
      try { return { id, ...ozelMaddeDuzenle(ham), kaynak: 'Okul', ozel: true }; } catch (_) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.olusturuldu).localeCompare(String(b.olusturuldu)));
  const kategoriler = DENETIM_KATEGORILERI.map(kat => ({
    ...kat, maddeler: [...kat.maddeler, ...ozel.filter(m => m.kategori === kat.id)]
  }));
  const kendi = ozel.filter(m => m.kategori === OZEL_KATEGORI.id);
  if (kendi.length) kategoriler.push({ ...OZEL_KATEGORI, maddeler: kendi });
  return kategoriler;
}

// ── Süre ve durum ────────────────────────────────────────────────────
// tur: 'yok' (takip yok) | 'tarihYok' (periyodik ama son kontrol girilmemiş)
//      | 'tamam' | 'yaklasiyor' (≤30 gün) | 'gecti'
export function sureDurumu(madde, kayit, bugun) {
  const k = kayitDuzenle(kayit);
  if (k.durum === 'uygulanamaz') return { tur: 'yok', son: '', kalanGun: null, kaynak: '' };
  const adaylar = [];
  if (madde?.periyotAy && k.sonKontrol) adaylar.push({ son: ayEkle(k.sonKontrol, madde.periyotAy), kaynak: 'periyot' });
  if (k.gecerlilikBitis) adaylar.push({ son: k.gecerlilikBitis, kaynak: 'gecerlilik' });
  if (!adaylar.length) {
    return { tur: madde?.periyotAy ? 'tarihYok' : 'yok', son: '', kalanGun: null, kaynak: '' };
  }
  adaylar.sort((a, b) => a.son.localeCompare(b.son));
  const { son, kaynak } = adaylar[0];
  const kalanGun = gunFarki(bugun, son);
  const tur = kalanGun < 0 ? 'gecti' : kalanGun <= YAKLASAN_GUN ? 'yaklasiyor' : 'tamam';
  return { tur, son, kalanGun, kaynak };
}

// "Uyumlu" işaretli ama süresi geçmiş madde skorda eksik sayılır.
export function etkinDurum(madde, kayit, bugun) {
  const k = kayitDuzenle(kayit);
  if (k.durum === 'uygun' && sureDurumu(madde, k, bugun).tur === 'gecti') return 'eksik';
  return k.durum;
}

export function sonrakiDurum(durum) {
  const i = DURUM_SIRASI.indexOf(durum);
  return DURUM_SIRASI[(i < 0 ? 0 : i + 1) % DURUM_SIRASI.length];
}

export function ozetHesapla(kategoriler, kayitlar = {}, bugun) {
  const o = { toplam: 0, uygun: 0, eksik: 0, bos: 0, uygulanamaz: 0, kritikEksik: 0,
    gecti: 0, yaklasiyor: 0, tarihYok: 0, notlu: 0, yuzde: 0, kategoriler: {} };
  for (const kat of kategoriler) {
    const ko = { toplam: 0, uygun: 0 };
    for (const m of kat.maddeler) {
      const kayit = kayitDuzenle(kayitlar?.[m.id]);
      const durum = etkinDurum(m, kayit, bugun);
      const sure = sureDurumu(m, kayit, bugun);
      if (kayit.not) o.notlu++;
      if (sure.tur === 'gecti') o.gecti++;
      if (sure.tur === 'yaklasiyor') o.yaklasiyor++;
      if (sure.tur === 'tarihYok') o.tarihYok++;
      o[durum]++;
      if (durum === 'uygulanamaz') continue;
      o.toplam++; ko.toplam++;
      if (durum === 'uygun') ko.uygun++;   // o.uygun yukarıda o[durum]++ ile sayıldı
      if (m.k && durum !== 'uygun') o.kritikEksik++;
    }
    o.kategoriler[kat.id] = ko;
  }
  o.yuzde = o.toplam ? Math.round(o.uygun / o.toplam * 100) : 0;
  return o;
}

export const FILTRELER = Object.freeze({
  tum: 'Tümü', eksik: 'Eksik', kritik: 'Kritik eksik', sure: 'Süresi yaklaşan / geçen',
  bos: 'Cevapsız', notlu: 'Notlu'
});

const kucuk = s => String(s || '').toLocaleLowerCase('tr-TR');

export function filtreUyar(madde, kayit, { filtre = 'tum', arama = '' } = {}, bugun) {
  const k = kayitDuzenle(kayit);
  const durum = etkinDurum(madde, k, bugun);
  const sure = sureDurumu(madde, k, bugun);
  if (filtre === 'eksik' && durum !== 'eksik') return false;
  if (filtre === 'kritik' && !(madde.k && durum !== 'uygun' && durum !== 'uygulanamaz')) return false;
  // Hatırlatma bildirimi bu filtreyle açılır: yalnız süresi geçen ve 30 gün içinde dolanlar.
  if (filtre === 'sure' && !['gecti', 'yaklasiyor'].includes(sure.tur)) return false;
  if (filtre === 'bos' && durum !== 'bos') return false;
  if (filtre === 'notlu' && !k.not) return false;
  const aranan = kucuk(arama).trim();
  if (aranan && !kucuk([madde.s, madde.kaynak, k.not, k.sorumlu, k.kanit].join(' ')).includes(aranan)) return false;
  return true;
}

// Eski ayarlar/mebDenetim.kayitlar → yeni kayıtlar (yalnız tanınan maddeler, yalnız durum).
export function eskiKayitlariTasi(eski = {}) {
  const bilinen = new Set(DENETIM_KATEGORILERI.flatMap(k => k.maddeler.map(m => m.id)));
  const sonuc = {};
  for (const [id, ham] of Object.entries(eski || {})) {
    if (!bilinen.has(id) || !DURUM_SIRASI.includes(ham?.durum) || ham.durum === 'bos') continue;
    sonuc[id] = kayitDuzenle({ durum: ham.durum, guncellendi: ham.tarih || '' });
  }
  return sonuc;
}

// Süre hatırlatmaları (Apps Script ile aynı eşikler): geçti, 7 gün, 30 gün.
export function hatirlatmaEsigi(sure) {
  if (!sure || sure.kalanGun == null) return '';
  if (sure.kalanGun < 0) return 'gecti';
  if (sure.kalanGun <= 7) return '7gun';
  if (sure.kalanGun <= YAKLASAN_GUN) return '30gun';
  return '';
}
