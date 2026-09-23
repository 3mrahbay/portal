const DURUM_ESLEME = {
  onaylandi: 'onaylandi',
  'onaylandı': 'onaylandi',
  onayli: 'onaylandi',
  'onaylı': 'onaylandi',
  reddedildi: 'reddedildi',
  ret: 'reddedildi',
  bekliyor: 'bekliyor',
  onaybekliyor: 'bekliyor',
  beklemede: 'bekliyor',
  iptal: 'iptal',
  iptal_edildi: 'iptal'
};

export const IZIN_TURLERI = {
  yillik: {
    ad: 'Yıllık İzin', alt: 'Ücretli · yıllıktan', ikon: 'palmtree',
    renk: '#20985A', acik: '#E7F8EE', sureTipi: 'gunluk', bakiyedenDuser: true
  },
  mazeret: {
    ad: 'Mazeret İzni', alt: 'Yönetim değerlendirmesi', ikon: 'clock-3',
    renk: '#987000', acik: '#FFF7D9', sureTipi: 'gunluk', bakiyedenDuser: false
  },
  saatlik: {
    ad: 'Saatlik İzin', alt: 'Kısa süreli', ikon: 'timer',
    renk: '#40865B', acik: '#EAF7EF', sureTipi: 'saatlik', bakiyedenDuser: false
  },
  dogum: {
    ad: 'Doğum İzni', alt: 'Ücretli', ikon: 'baby',
    renk: '#C83278', acik: '#FDEAF3', sureTipi: 'gunluk', bakiyedenDuser: false
  },
  vefat: {
    ad: 'Vefat İzni', alt: 'Ücretli · 3 gün', ikon: 'flower-2',
    renk: '#7152C6', acik: '#F0EBFF', sureTipi: 'gunluk', bakiyedenDuser: false
  },
  sut: {
    ad: 'Süt İzni', alt: 'Ücretli · günlük 1,5 sa.', ikon: 'droplets',
    renk: '#2E6A9E', acik: '#E9F3FC', sureTipi: 'saatlik-donem', bakiyedenDuser: false
  },
  rapor: {
    ad: 'Sağlık Raporu', alt: 'SGK · yıllıktan düşmez', ikon: 'briefcase-medical',
    renk: '#6849BF', acik: '#F0EBFF', sureTipi: 'gunluk', bakiyedenDuser: false, belgeGerekli: true
  },
  hastane: {
    ad: 'Hastane Randevusu', alt: 'Saatlik mazeret', ikon: 'stethoscope',
    renk: '#2E6A9E', acik: '#E9F3FC', sureTipi: 'saatlik', bakiyedenDuser: false
  }
};

const TUR_ESLEME = {
  yillik: 'yillik', 'yıllık': 'yillik', 'yıllık izin': 'yillik',
  mazeret: 'mazeret', 'mazeret izni': 'mazeret',
  saatlik: 'saatlik', 'saatlik izin': 'saatlik',
  dogum: 'dogum', 'doğum': 'dogum', 'doğum izni': 'dogum',
  vefat: 'vefat', olum: 'vefat', 'ölüm': 'vefat', 'vefat izni': 'vefat',
  sut: 'sut', 'süt': 'sut', 'süt izni': 'sut',
  rapor: 'rapor', raporlu: 'rapor', 'sağlık raporu': 'rapor', saglik_raporu: 'rapor',
  hastane: 'hastane', 'hastane randevusu': 'hastane'
};

function sade(metin) {
  return String(metin || '').trim().toLocaleLowerCase('tr-TR').replace(/[\s-]+/g, ' ');
}

export function izinDurumKodu(durum) {
  const anahtar = sade(durum).replace(/\s+/g, '');
  return DURUM_ESLEME[anahtar] || DURUM_ESLEME[sade(durum)] || 'bekliyor';
}

export function izinTurKodu(tur) {
  return TUR_ESLEME[sade(tur)] || sade(tur).replace(/\s+/g, '_');
}

function tarihDegeri(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  const tarih = new Date(Date.UTC(y, m - 1, d, 12));
  return Number.isNaN(tarih.getTime()) ? null : tarih;
}

export function izinGunSayisi(baslangic, bitis = baslangic) {
  const bas = tarihDegeri(baslangic);
  const bit = tarihDegeri(bitis || baslangic);
  if (!bas || !bit || bit < bas) return 0;
  return Math.floor((bit - bas) / 86400000) + 1;
}

export function izinSaatSayisi(baslangicSaat, bitisSaat) {
  const cozum = deger => {
    const es = /^(\d{2}):(\d{2})$/.exec(String(deger || ''));
    if (!es) return null;
    const dakika = Number(es[1]) * 60 + Number(es[2]);
    return dakika >= 0 && dakika < 1440 ? dakika : null;
  };
  const bas = cozum(baslangicSaat), bit = cozum(bitisSaat);
  return bas == null || bit == null || bit <= bas ? 0 : Math.round(((bit - bas) / 60) * 100) / 100;
}

function kayitGun(kayit) {
  const onaylanan = Number(kayit?.onaylananGun);
  if (Number.isFinite(onaylanan) && onaylanan >= 0) return onaylanan;
  const gun = Number(kayit?.gun);
  if (Number.isFinite(gun) && gun >= 0) return gun;
  return izinGunSayisi(kayit?.baslangic, kayit?.bitis || kayit?.baslangic);
}

export function izinMetrikleri(izinler = [], yillikHak = 14) {
  const toplam = Math.max(0, Number(yillikHak) || 14);
  let kullanilan = 0, bekleyen = 0, raporGun = 0;
  for (const kayit of izinler || []) {
    const tur = izinTurKodu(kayit?.tur || kayit?.izinTuru);
    const durum = izinDurumKodu(kayit?.durum);
    const gun = kayitGun(kayit);
    if (tur === 'yillik' && durum === 'onaylandi') kullanilan += gun;
    if (tur === 'yillik' && durum === 'bekliyor') bekleyen += gun;
    if (tur === 'rapor' && durum === 'onaylandi') raporGun += gun;
  }
  kullanilan = Math.max(0, kullanilan);
  bekleyen = Math.max(0, bekleyen);
  raporGun = Math.max(0, raporGun);
  const kalan = Math.max(0, toplam - kullanilan);
  return {
    toplam, kullanilan, bekleyen, raporGun, kalan,
    kalanYuzde: toplam ? Math.max(0, Math.min(100, Math.round(kalan / toplam * 100))) : 0
  };
}

export function izinSureOzeti(kayit = {}) {
  const tur = izinTurKodu(kayit.tur || kayit.izinTuru);
  const meta = IZIN_TURLERI[tur];
  if (meta?.sureTipi === 'saatlik') {
    const saat = Number(kayit.saat) || izinSaatSayisi(kayit.baslangicSaat, kayit.bitisSaat);
    return `${kayit.baslangic || ''}${kayit.baslangicSaat ? ` · ${kayit.baslangicSaat}–${kayit.bitisSaat}` : ''}${saat ? ` · ${saat.toLocaleString('tr-TR')} saat` : ''}`;
  }
  if (meta?.sureTipi === 'saatlik-donem') {
    const gun = kayitGun(kayit);
    return `${gun} gün · günlük ${(Number(kayit.gunlukSaat) || 1.5).toLocaleString('tr-TR')} saat`;
  }
  return `${kayitGun(kayit)} gün`;
}

export function izinTalebiDogrula(talep, kalanYillik = Infinity) {
  const tur = izinTurKodu(talep?.tur);
  const meta = IZIN_TURLERI[tur];
  if (!meta) throw new Error('İzin türü seçin.');
  if (!talep?.baslangic) throw new Error(meta.sureTipi === 'saatlik' ? 'İzin tarihini seçin.' : 'Başlangıç tarihini seçin.');
  if (meta.sureTipi === 'saatlik') {
    const saat = izinSaatSayisi(talep.baslangicSaat, talep.bitisSaat);
    if (!saat) throw new Error('Geçerli bir başlangıç ve bitiş saati seçin.');
    return { tur, meta, gun: 0, saat };
  }
  const gun = izinGunSayisi(talep.baslangic, talep.bitis || talep.baslangic);
  if (!gun) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.');
  if (tur === 'yillik' && gun > Number(kalanYillik)) throw new Error(`Talep ${gun} gün; kalan yıllık izin ${Number(kalanYillik)} gün.`);
  if (tur === 'vefat' && gun > 3) throw new Error('Vefat izni en fazla 3 gün olarak gönderilebilir.');
  return { tur, meta, gun, saat: meta.sureTipi === 'saatlik-donem' ? 1.5 : 0 };
}
