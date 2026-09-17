const AY_ADLARI = Object.freeze([
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
]);

function pozitifSayi(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function tarihBilgisi(now) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return {
    gunKodu: `${parts.year}-${parts.month}-${parts.day}`,
    ayKodu: `${parts.year}-${parts.month}`
  };
}

function ayListesi(baslangicAyi, taksitSayisi) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(baslangicAyi || ''))) return [];
  const adet = Number(taksitSayisi);
  if (!Number.isInteger(adet) || adet < 1 || adet > 24) return [];
  const [yil, ay] = baslangicAyi.split('-').map(Number);
  return Array.from({ length: adet }, (_, index) => {
    const date = new Date(Date.UTC(yil, ay - 1 + index, 1));
    const itemYil = date.getUTCFullYear();
    const itemAy = date.getUTCMonth() + 1;
    return Object.freeze({
      yil: itemYil,
      ay: itemAy,
      ayKodu: `${itemYil}-${String(itemAy).padStart(2, '0')}`,
      ad: `${AY_ADLARI[itemAy - 1]} ${itemYil}`
    });
  });
}

function gecikmeSiniri(ay) {
  // Portalın mevcut finans ekranıyla aynı davranış: ilgili ay bittikten
  // sonra 15 günlük tolerans. Tarih yalnız durum etiketi için kullanılır.
  const date = new Date(Date.UTC(ay.yil, ay.ay, 15));
  return date.toISOString().slice(0, 10);
}

function ayTutari(ayarlar, kayit, ay) {
  const kayitTutari = pozitifSayi(kayit?.beklenenTutar);
  if (kayitTutari) return kayitTutari;
  const varsayilan = pozitifSayi(ayarlar.aylikAidat);
  return (ay.ay >= 9 || ay.ay <= 1)
    ? (pozitifSayi(ayarlar.iDonemAylik) || varsayilan)
    : (pozitifSayi(ayarlar.iiDonemAylik) || varsayilan);
}

function odemeSatiri(ayarlar, aylikOdemeler, ay, gunKodu) {
  const kayit = aylikOdemeler[ay.ayKodu] || {};
  const beklenen = ayTutari(ayarlar, kayit, ay);
  const kayitliOdenen = pozitifSayi(kayit.odenenTutar);
  const odenen = kayit.odendi === true && kayitliOdenen === 0
    ? beklenen
    : Math.min(beklenen, kayitliOdenen);
  const kalan = Math.max(0, beklenen - odenen);
  let durum = 'bekliyor';
  if (kalan === 0 && beklenen > 0) durum = 'odendi';
  else if (odenen > 0) durum = 'kismi';
  else if (gunKodu > gecikmeSiniri(ay)) durum = 'gecikmis';
  return Object.freeze({ ...ay, beklenen, odenen, kalan, durum });
}

function sonuc(veri) {
  return Object.freeze(veri);
}

export function veliOdemeOzetiHesapla(donemVeri, now = new Date()) {
  const ayarlar = donemVeri?.aidatAyarlari || {};
  const aylikOdemeler = donemVeri?.aylikOdemeler || {};
  const baslangicAyi = String(ayarlar.baslangicAyi || '');
  const taksitSayisi = Number(ayarlar.gercekAySayisi || ayarlar.taksitSayisi || 0);
  const { gunKodu, ayKodu } = tarihBilgisi(now);
  const aylar = ayListesi(baslangicAyi, taksitSayisi);
  const aylikAidat = pozitifSayi(ayarlar.aylikAidat);

  if (!donemVeri || !aylar.length || aylikAidat <= 0) {
    return sonuc({
      durum: 'plansiz', baslik: 'Ödeme planı', rozet: 'Hazırlanıyor',
      tutar: null, aciklama: 'Gerçek ödeme planınız henüz oluşturulmamış.',
      eylem: 'Ödemeleri Gör'
    });
  }

  if (ayarlar.pesinOdeme === true) {
    return sonuc({
      durum: 'tamamlandi', baslik: 'Ödeme durumu', rozet: 'Tamamlandı',
      tutar: 0, aciklama: 'Bu dönem için peşin ödeme tamamlandı.',
      eylem: 'Detayları Gör'
    });
  }

  const onOdeme = pozitifSayi(ayarlar.onOdeme);
  if (onOdeme > 0) {
    const kayit = aylikOdemeler.__onOdeme || {};
    const kayitliOdenen = pozitifSayi(kayit.odenenTutar);
    const odenen = kayit.odendi === true && kayitliOdenen === 0
      ? onOdeme
      : Math.min(onOdeme, kayitliOdenen);
    const kalan = Math.max(0, onOdeme - odenen);
    if (kalan > 0) {
      const kismi = odenen > 0;
      return sonuc({
        durum: kismi ? 'kismi' : 'bekliyor', baslik: 'Kayıt ön ödemesi',
        rozet: kismi ? 'Kısmi' : 'Bekliyor', tutar: kalan,
        aciklama: kismi
          ? `Toplam ${onOdeme.toLocaleString('tr-TR')} ₺ · ${odenen.toLocaleString('tr-TR')} ₺ ödendi`
          : 'Ödeme planınızdaki kayıt ön ödemesi',
        eylem: 'Ödeme Bildir'
      });
    }
  }

  const satirlar = aylar
    .map(ay => odemeSatiri(ayarlar, aylikOdemeler, ay, gunKodu))
    .filter(row => row.beklenen > 0);
  const geciken = satirlar.find(row => row.durum === 'gecikmis');
  const buAy = satirlar.find(row => row.ayKodu === ayKodu);
  const ilkAcik = satirlar.find(row => row.durum !== 'odendi');
  const secilen = geciken || buAy || ilkAcik;

  if (!secilen) {
    return sonuc({
      durum: 'tamamlandi', baslik: 'Ödeme durumu', rozet: 'Tamamlandı',
      tutar: 0, aciklama: 'Bu dönem için bekleyen ödeme bulunmuyor.',
      eylem: 'Detayları Gör'
    });
  }

  const baslik = secilen.durum === 'gecikmis'
    ? 'Gecikmiş ödeme'
    : secilen.ayKodu === ayKodu
      ? 'Bu ay ödemesi'
      : 'Sıradaki ödeme';
  const rozetler = {
    odendi: 'Ödendi', kismi: 'Kısmi', gecikmis: 'Gecikmiş', bekliyor: 'Bekliyor'
  };
  const tutar = secilen.durum === 'odendi' ? secilen.beklenen : secilen.kalan;
  let aciklama = `${secilen.ad} · Toplam ${secilen.beklenen.toLocaleString('tr-TR')} ₺`;
  if (secilen.durum === 'kismi') {
    aciklama = `${secilen.ad} · ${secilen.odenen.toLocaleString('tr-TR')} ₺ ödendi`;
  }

  return sonuc({
    durum: secilen.durum, baslik, rozet: rozetler[secilen.durum],
    tutar, aciklama,
    eylem: secilen.durum === 'odendi' ? 'Detayları Gör' : 'Ödeme Bildir'
  });
}
