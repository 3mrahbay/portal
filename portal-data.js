// ══════════════════════════════════════════════════════════════════════════
// PORTAL ORTAK VERİ KATMANI  ·  portal-data.js
// ──────────────────────────────────────────────────────────────────────────
// ZEKY uygulamasındaki js/zeky-data.js dosyasının PORTAL İKİZİ.
// FONKSİYON ADLARI VE DÖNEN VERİ YAPISI ZEKY İLE BİREBİR AYNIDIR.
// Arayüz farklı olabilir, VERİ YAPISI ASLA (Kural K2).
//
// FARK: ZEKY doğrudan Firebase'i import eder; portal ise zaten kurulmuş olan
// window.BCK köprüsünü kullanır. Bu dosya Firebase'i YENİDEN BAŞLATMAZ.
//
// KULLANIM (index.html içinden veya başka bir modülden):
//   await PortalData.kazanimIsaretle(ogrId, "montessori", anahtar, "U");
//   const veri = await PortalData.egitimPanoVerisi();
//
// Faz 1 · 2026-08-09 · PORTAL-ZEKY-SENKRON-YOL-HARITASI.md
// Bu sürümde taşınan blok: EĞİTİM (müfredat, açıklama, kazanım, aşama,
// program özeti, sınıf detayı, yönetim panosu, aylık seri) + sınıf yardımcıları.
// Sonraki fazlarda bu dosyaya veli süreçleri ve yönetim/finans eklenecek.
// ══════════════════════════════════════════════════════════════════════════

const B = window.BCK;
if (!B) {
  console.error("portal-data.js: window.BCK bulunamadı — bu dosya çekirdekten SONRA yüklenmeli.");
}

const { db, doc, getDoc, getDocs, collection, setDoc, serverTimestamp } = B;

// ── Oturum (ZEKY'de localStorage'dan, portalda çekirdekten) ────────────────
// ZEKY: aktifKullanici() → { email, ad, soyad, rol, sinifAtamalari }
// Portal: aynı şekli B.kullanici() + B.personel() + B.rol() ile üretir.
export function aktifKullanici() {
  const u = B.kullanici && B.kullanici();
  if (!u) return null;
  const p = (B.personel && B.personel()) || {};
  return {
    email: (u.email || "").toLowerCase(),
    ad: p.ad || (u.displayName || "").split(" ")[0] || "",
    soyad: p.soyad || (u.displayName || "").split(" ").slice(1).join(" ") || "",
    rol: (B.rol && B.rol()) || "",
    sinifAtamalari: (B.siniflari && B.siniflari()) || []
  };
}

// ══════════════════════════════════════════════════════════════
// SINIF ADI STANDARDI  (ZEKY ile birebir aynı — kopyalanmadı, TAŞINDI)
// ══════════════════════════════════════════════════════════════
export const RESMI_SINIFLAR = ['Papatyalar Sınıfı', 'Kardelenler Sınıfı', 'Nar Çiçekleri Sınıfı'];

const SINIF_ESLEME = {
  papatya: 'Papatyalar Sınıfı', papatyalar: 'Papatyalar Sınıfı',
  toddler: 'Papatyalar Sınıfı', 'montessori1': 'Papatyalar Sınıfı',
  kardelen: 'Kardelenler Sınıfı', kardelenler: 'Kardelenler Sınıfı',
  'montessori2': 'Kardelenler Sınıfı',
  nar: 'Nar Çiçekleri Sınıfı', 'montessori3': 'Nar Çiçekleri Sınıfı'
};

export function sinifAnahtar(deger) {
  if (!deger) return '';
  let d = String(deger).toLocaleLowerCase('tr')
    .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i')
    .replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  const mont = d.match(/^montessori\s*([0-9])/);
  if (mont) return 'montessori' + mont[1];

  d = d.replace(/\b(cicekleri|cicegi|sinifi|sinif|grubu|grup|subesi|sube)\b/g,'').trim();
  const ilk = (d.split(' ')[0] || '');
  return ilk.replace(/(ler|lar)$/,'');
}

export function sinifResmiAd(deger) {
  if (!deger) return '';
  const a = sinifAnahtar(deger);
  return SINIF_ESLEME[a] || String(deger).trim();
}

export function sinifEslesirMi(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ka = sinifAnahtar(a), kb = sinifAnahtar(b);
  return !!ka && ka === kb;
}

export function ogrencileriSinifaGoreFiltrele(ogrenciler, sinif) {
  if (!sinif) return ogrenciler || [];
  return (ogrenciler || []).filter(o => sinifEslesirMi(o.sinif, sinif));
}

export function bugunTarih() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ── İletişim gizliliği (veli/personel birbirinin e-postasını GÖREMEZ) ──────
const _ROL_ETIKET = {
  ogretmen: 'Sınıf Öğretmeni', mudur: 'Okul Müdürü', kurucu_mudur: 'Kurucu Müdür',
  egitim_koordinator: 'Eğitim Koordinatörü', pdr: 'Rehberlik Birimi',
  veli: 'Veli', personel: 'Okul Personeli'
};

export function gorunenAd(ad, rol = '', yedek = '') {
  const t = String(ad || '').trim();
  const epostaGibi = /@/.test(t);
  const telefonGibi = /^[+\d][\d\s()\-]{7,}$/.test(t);
  if (t && !epostaGibi && !telefonGibi) return t;
  return yedek || _ROL_ETIKET[String(rol || '').toLowerCase()] || 'Okul Personeli';
}

// ══════════════════════════════════════════════════════════════
// ÖĞRENCİ SORGULARI
// ══════════════════════════════════════════════════════════════
// NOT: Portal öğrencileri zaten belleğe yüklüyor (B.ogrenciler()).
// Varsa oradan verilir — gereksiz Firestore okuması yapılmaz.
export async function ogrencileriGetir({ sadeceAktif = true, bellektenAl = true } = {}) {
  if (bellektenAl && B.ogrenciler) {
    const bellek = B.ogrenciler() || [];
    if (bellek.length) {
      return sadeceAktif ? bellek.filter(o => (o.durum || 'aktif') === 'aktif') : bellek.slice();
    }
  }
  const snap = await getDocs(collection(db, 'ogrenciler'));
  const liste = [];
  snap.forEach(d => {
    const o = { id: d.id, ...d.data() };
    if (!sadeceAktif || o.durum === 'aktif') liste.push(o);
  });
  return liste;
}

export async function ogrenciGetir(ogrenciId) {
  if (!ogrenciId) return null;
  try {
    const snap = await getDoc(doc(db, 'ogrenciler', ogrenciId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) { console.warn('ogrenci getir', e); return null; }
}

// ══════════════════════════════════════════════════════════════
// MÜFREDAT
// ══════════════════════════════════════════════════════════════
export async function mufredatAlanlariGetir(disiplin) {
  try {
    const snap = await getDoc(doc(db, 'mufredatlar', disiplin));
    if (snap.exists() && Array.isArray(snap.data().alanlar)) return snap.data().alanlar;
  } catch (e) { console.warn('mufredat alanlari', disiplin, e); }
  return [];
}

// ══════ KAZANIM AÇIKLAMALARI ("Bu kazanım neden önemli?") ══════
// İki katmanlı sistem:
//   1) ALAN açıklaması    → mufredatlar/{disiplin}.alanAciklamalari[alanId]
//   2) KAZANIM açıklaması → mufredatlar/{disiplin}.kazanimAciklamalari[anahtar]
// Veliye gösterirken önce kazanım, yoksa alan açıklaması kullanılır.
export async function mufredatAciklamalariGetir(disiplin) {
  try {
    const snap = await getDoc(doc(db, 'mufredatlar', disiplin));
    if (snap.exists()) {
      const v = snap.data();
      return { alan: v.alanAciklamalari || {}, kazanim: v.kazanimAciklamalari || {} };
    }
  } catch (e) { console.warn('mufredat aciklamalari', disiplin, e); }
  return { alan: {}, kazanim: {} };
}

export async function alanAciklamaKaydet(disiplin, alanId, metin) {
  if (!disiplin || !alanId) return;
  return setDoc(doc(db, 'mufredatlar', disiplin),
    { alanAciklamalari: { [alanId]: String(metin || '').trim() }, guncellendi: serverTimestamp() },
    { merge: true });
}

export async function kazanimAciklamaKaydet(disiplin, anahtar, metin) {
  if (!disiplin || !anahtar) return;
  const temiz = String(metin || '').trim();
  const ref = doc(db, 'mufredatlar', disiplin);
  // Boş bırakılırsa kayıt silinir (alan açıklamasına geri döner)
  if (!temiz) {
    const snap = await getDoc(ref);
    const mevcut = (snap.exists() && snap.data().kazanimAciklamalari) || {};
    delete mevcut[anahtar];
    return setDoc(ref, { kazanimAciklamalari: mevcut, guncellendi: serverTimestamp() }, { merge: true });
  }
  return setDoc(ref,
    { kazanimAciklamalari: { [anahtar]: temiz }, guncellendi: serverTimestamp() },
    { merge: true });
}

export function aciklamaCoz(aciklamalar, anahtar, alanId) {
  if (!aciklamalar) return { metin: '', kaynak: '' };
  const k = (aciklamalar.kazanim || {})[anahtar];
  if (k && k.trim()) return { metin: k, kaynak: 'kazanim' };
  const a = (aciklamalar.alan || {})[alanId];
  if (a && a.trim()) return { metin: a, kaynak: 'alan' };
  return { metin: '', kaynak: '' };
}

export async function aciklamaDurumu() {
  const disiplinler = ['montessori', 'orman', 'degerler', 'ingilizce'];
  const sonuc = [];
  for (const d of disiplinler) {
    const [alanlar, ac] = await Promise.all([
      mufredatAlanlariGetir(d).catch(() => []),
      mufredatAciklamalariGetir(d)
    ]);
    let kazanimSayisi = 0;
    alanlar.forEach(a => (a.gruplar || []).forEach(g => { kazanimSayisi += (g.dersler || []).length; }));
    const yazilanAlan = alanlar.filter(a => (ac.alan[a.id] || '').trim()).length;
    sonuc.push({
      disiplin: d,
      alanToplam: alanlar.length, alanYazilan: yazilanAlan,
      kazanimToplam: kazanimSayisi, kazanimYazilan: Object.keys(ac.kazanim || {}).length
    });
  }
  return sonuc;
}

// ══════════════════════════════════════════════════════════════
// ÖĞRENCİ GELİŞİMİ
// ══════════════════════════════════════════════════════════════
export async function ogrenciGelisimTumGetir(ogrenciId) {
  if (!ogrenciId) return {};
  try {
    const snap = await getDoc(doc(db, 'ogrenciGelisim', ogrenciId));
    return snap.exists() ? snap.data() : {};
  } catch (e) { console.warn('ogrenci gelisim', e); return {}; }
}

// ★ KAZANIM İŞARETLEME — ZEKY ile birebir aynı yazma biçimi.
// ogrenciGelisim/{id}.{disiplin}.kayitlar[anahtar] = 'S'|'T'|'U'
// ogrenciGelisim/{id}.{disiplin}.tarihler[anahtar] = 'YYYY-MM-DD'
// anahtar: "alanId__grupAd__dersAd"
//
// ÖNEMLİ: Portalın eski yazma biçimi TARİH KAYDETMİYORDU; bu yüzden portaldan
// işaretlenen kazanımlar ZEKY'deki aylık gelişim grafiğinde görünmüyordu.
// Artık iki taraf da aynı şekilde yazar.
export async function kazanimIsaretle(ogrenciId, disiplin, anahtar, durum) {
  if (!ogrenciId || !disiplin || !anahtar) return;
  const ref = doc(db, 'ogrenciGelisim', ogrenciId);
  const snap = await getDoc(ref);
  const tum = snap.exists() ? snap.data() : {};
  const dis = tum[disiplin] || {};
  const kayitlar = Object.assign({}, dis.kayitlar || {});
  const tarihler = Object.assign({}, dis.tarihler || {});
  if (durum) {
    kayitlar[anahtar] = durum;
    tarihler[anahtar] = new Date().toISOString().slice(0, 10);
  } else {
    delete kayitlar[anahtar];
    delete tarihler[anahtar];
  }
  await setDoc(ref, { [disiplin]: { ...dis, kayitlar, tarihler, guncellendi: serverTimestamp() } }, { merge: true });
}

export async function ogretmenYorumuEkle(ogrenciId, yorum) {
  if (!ogrenciId) return;
  const k = aktifKullanici() || {};
  const ref = doc(db, 'ogrenciGelisim', ogrenciId);
  const snap = await getDoc(ref);
  const mevcut = snap.exists() ? (snap.data().ogretmenYorumlari || []) : [];
  mevcut.push({
    tarih: new Date().toISOString(),
    baslik: yorum.baslik || '',
    metin: yorum.metin || '',
    yazar: ((k.ad || '') + ' ' + (k.soyad || '')).trim() || k.email || 'Öğretmen',
    paylas: yorum.paylas !== false
  });
  await setDoc(ref, { ogretmenYorumlari: mevcut }, { merge: true });
}

// ══════════════════════════════════════════════════════════════
// AŞAMA / ROZET SİSTEMİ  (%80 eşik · ayarlar/egitimAsama)
// ══════════════════════════════════════════════════════════════
export const ASAMA_VARSAYILAN_ESIK = 80;

let _asamaEsikCache = null;
export async function asamaEsigiGetir() {
  if (_asamaEsikCache != null) return _asamaEsikCache;
  try {
    const snap = await getDoc(doc(db, 'ayarlar', 'egitimAsama'));
    if (snap.exists()) {
      const v = Number(snap.data().esikYuzde);
      if (!isNaN(v) && v > 0 && v <= 100) { _asamaEsikCache = v; return v; }
    }
  } catch (e) {}
  _asamaEsikCache = ASAMA_VARSAYILAN_ESIK;
  return _asamaEsikCache;
}

// Eşik yönetim ekranından değiştirilirse önbelleği düşür
export function asamaEsikOnbellegiTemizle() { _asamaEsikCache = null; }

export function asamalariHesapla(kayitlar, alanlar, disiplin, esik = ASAMA_VARSAYILAN_ESIK) {
  if (!alanlar || !alanlar.length) return [];
  const k = kayitlar || {};
  return alanlar.map(alan => {
    let toplam = 0, ustalasti = 0;
    (alan.gruplar || []).forEach(g => {
      (g.dersler || []).forEach(d => {
        toplam++;
        if (k[`${alan.id}__${g.ad}__${d}`] === 'U') ustalasti++;
      });
    });
    const yuzde = toplam ? Math.round((ustalasti / toplam) * 100) : 0;
    return {
      alanId: alan.id, ad: alan.ad, ikon: alan.ikon || 'award',
      renk: alan.renk || '#4A7C59', disiplin,
      toplam, ustalasti, yuzde, tamam: toplam > 0 && yuzde >= esik
    };
  });
}

export async function ogrenciAsamalariGetir(ogrenciId) {
  if (!ogrenciId) return { kazanilan: [], yoldaki: [], toplamKazanilan: 0 };
  const disiplinler = ['montessori', 'orman', 'degerler', 'ingilizce'];
  const [gelisim, esik] = await Promise.all([
    ogrenciGelisimTumGetir(ogrenciId),
    asamaEsigiGetir()
  ]);
  const alanListeleri = await Promise.all(disiplinler.map(d => mufredatAlanlariGetir(d).catch(() => [])));
  const kazanilan = [], yoldaki = [];
  disiplinler.forEach((dis, i) => {
    const kayitlar = (gelisim[dis] && gelisim[dis].kayitlar) || {};
    asamalariHesapla(kayitlar, alanListeleri[i], dis, esik).forEach(a => {
      if (a.toplam === 0) return;
      (a.tamam ? kazanilan : yoldaki).push(a);
    });
  });
  kazanilan.sort((a, b) => b.yuzde - a.yuzde);
  yoldaki.sort((a, b) => b.yuzde - a.yuzde);
  return { kazanilan, yoldaki, toplamKazanilan: kazanilan.length };
}

// ══════════════════════════════════════════════════════════════
// DİSİPLİN BİLGİSİ
// ══════════════════════════════════════════════════════════════
const DISIPLIN_BILGI = {
  orman:      { ad: 'Orman Okulu', ikon: 'trees', renk: '#5C8B5A' },
  montessori: { ad: 'Montessori', ikon: 'shapes', renk: '#4A7C59' },
  ingilizce:  { ad: 'İngilizce', ikon: 'languages', renk: '#2E5C8A' },
  degerler:   { ad: 'Değerler', ikon: 'heart', renk: '#7B5EA7' }
};

export function disiplinBilgisi(disiplin) {
  return DISIPLIN_BILGI[disiplin] || { ad: disiplin || '', ikon: 'book-open', renk: '#4A7C59' };
}

// S/T/U sayımı — alan bazlı istatistik (ZEKY: ormanIstatistik)
export function ormanIstatistik(kayitlar, alanlar) {
  if (!alanlar) return [];
  return alanlar.map(alan => {
    let toplam = 0, sunuldu = 0, tekrar = 0, uzmanlasti = 0;
    (alan.gruplar || []).forEach(g => {
      (g.dersler || []).forEach(d => {
        toplam++;
        const v = (kayitlar || {})[`${alan.id}__${g.ad}__${d}`];
        if (v === 'S') sunuldu++; else if (v === 'T') tekrar++; else if (v === 'U') uzmanlasti++;
      });
    });
    const calisilan = sunuldu + tekrar + uzmanlasti;
    return { alanId: alan.id, ad: alan.ad, ikon: alan.ikon, renk: alan.renk,
      toplam, sunuldu, tekrar, uzmanlasti, calisilan,
      yuzde: toplam ? Math.round(calisilan/toplam*100) : 0,
      uzmanlikYuzde: toplam ? Math.round(uzmanlasti/toplam*100) : 0 };
  });
}

// ══════════════════════════════════════════════════════════════
// PROGRAM GÖRÜNÜMÜ (tek disiplin · okul geneli + sınıflar + alanlar)
// ══════════════════════════════════════════════════════════════
export async function programOzetiGetir(disiplin) {
  const [ogrenciler, alanlar, esik] = await Promise.all([
    ogrencileriGetir({ sadeceAktif: true }),
    mufredatAlanlariGetir(disiplin).catch(() => []),
    asamaEsigiGetir()
  ]);
  const bos = { disiplin, alanSayisi: 0, kazanimSayisi: 0,
                okul: { sunuldu: 0, tekrar: 0, ustalasti: 0, yuzde: 0, ogrenciSayisi: ogrenciler.length },
                siniflar: [], alanlar: [] };
  if (!alanlar.length) return bos;

  const gelisimler = await Promise.all(
    ogrenciler.map(o => ogrenciGelisimTumGetir(o.id).catch(() => ({})))
  );

  let kazanimSayisi = 0;
  alanlar.forEach(a => (a.gruplar || []).forEach(g => { kazanimSayisi += (g.dersler || []).length; }));

  let toplamHucre = 0, S = 0, T = 0, U = 0;
  const sinifMap = {};
  const alanMap = {};
  alanlar.forEach(a => { alanMap[a.id] = { alanId: a.id, ad: a.ad, ikon: a.ikon || 'circle',
    renk: a.renk || '#4A7C59', asamaTamamlayan: 0, ogrenciSayisi: 0, calisilan: 0, toplam: 0 }; });

  ogrenciler.forEach((o, i) => {
    const kayitlar = ((gelisimler[i] || {})[disiplin] || {}).kayitlar || {};
    const sinif = o.sinif || '(sınıfsız)';
    if (!sinifMap[sinif]) sinifMap[sinif] = { ad: sinif, ogrenciSayisi: 0, calisilan: 0, ustalasti: 0, toplam: 0, ogretmenler: [] };
    const Sf = sinifMap[sinif];
    Sf.ogrenciSayisi++;

    const istat = asamalariHesapla(kayitlar, alanlar, disiplin, esik);
    istat.forEach(a => {
      const A = alanMap[a.alanId];
      if (!A) return;
      A.ogrenciSayisi++;
      A.toplam += a.toplam;
      A.calisilan += a.ustalasti;
      if (a.tamam) A.asamaTamamlayan++;
    });

    alanlar.forEach(alan => {
      (alan.gruplar || []).forEach(g => {
        (g.dersler || []).forEach(d => {
          toplamHucre++; Sf.toplam++;
          const v = kayitlar[`${alan.id}__${g.ad}__${d}`];
          if (v === 'S') { S++; Sf.calisilan++; }
          else if (v === 'T') { T++; Sf.calisilan++; }
          else if (v === 'U') { U++; Sf.calisilan++; Sf.ustalasti++; }
        });
      });
    });
  });

  const yuzde = (n) => toplamHucre ? Math.round((n / toplamHucre) * 100) : 0;
  const siniflar = Object.values(sinifMap).map(s => ({
    ad: s.ad, ogrenciSayisi: s.ogrenciSayisi,
    yuzde: s.toplam ? Math.round((s.ustalasti / s.toplam) * 100) : 0,
    calisilanYuzde: s.toplam ? Math.round((s.calisilan / s.toplam) * 100) : 0
  })).sort((a, b) => b.yuzde - a.yuzde);

  const alanListe = Object.values(alanMap).map(a => ({
    ...a,
    yuzde: a.toplam ? Math.round((a.calisilan / a.toplam) * 100) : 0
  }));

  return {
    disiplin, alanSayisi: alanlar.length, kazanimSayisi,
    okul: { sunuldu: yuzde(S), tekrar: yuzde(T), ustalasti: yuzde(U),
            yuzde: yuzde(U), ogrenciSayisi: ogrenciler.length },
    siniflar, alanlar: alanListe
  };
}

// ══════════════════════════════════════════════════════════════
// SINIF GÖRÜNÜMÜ (bir sınıf × bir program · öğrenci listesi)
// ══════════════════════════════════════════════════════════════
export async function sinifProgramDetayi(sinif, disiplin) {
  const [tumOgrenciler, alanlar, esik] = await Promise.all([
    ogrencileriGetir({ sadeceAktif: true }),
    mufredatAlanlariGetir(disiplin).catch(() => []),
    asamaEsigiGetir()
  ]);
  const ogrenciler = ogrencileriSinifaGoreFiltrele(tumOgrenciler, sinif);
  const bos = { sinif, disiplin, alanlar: [], ogrenciler: [],
                ozet: { ogrenciSayisi: ogrenciler.length, ortalama: 0, ustalasan: 0, tekrar: 0, sunuldu: 0 } };
  if (!alanlar.length || !ogrenciler.length) return bos;

  const gelisimler = await Promise.all(
    ogrenciler.map(o => ogrenciGelisimTumGetir(o.id).catch(() => ({})))
  );

  let ortToplam = 0, ustalasan = 0, tekrarEden = 0, sunulan = 0;
  const liste = ogrenciler.map((o, i) => {
    const kayitlar = ((gelisimler[i] || {})[disiplin] || {}).kayitlar || {};
    const istat = ormanIstatistik(kayitlar, alanlar);
    let toplam = 0, calisilan = 0, u = 0, t = 0, s = 0;
    istat.forEach(a => { toplam += a.toplam; calisilan += a.calisilan;
      u += a.uzmanlasti; t += a.tekrar; s += a.sunuldu; });
    const yuzde = toplam ? Math.round((calisilan / toplam) * 100) : 0;
    ortToplam += yuzde;
    let durum = 'Kayıt yok';
    if (u >= t && u >= s && u > 0) { durum = 'Ustalaştı'; ustalasan++; }
    else if (t >= s && t > 0) { durum = 'Tekrar ediyor'; tekrarEden++; }
    else if (s > 0) { durum = 'Sunuldu'; sunulan++; }
    return {
      id: o.id, ad: o.ogrenciAdSoyad || o.adSoyad || ((o.ad || '') + ' ' + (o.soyad || '')).trim() || o.id,
      yuzde, durum, ustalasti: u, tekrar: t, sunuldu: s,
      alanlar: istat.map(a => ({
        alanId: a.alanId, ad: a.ad, renk: a.renk,
        yuzde: a.toplam ? Math.round((a.calisilan / a.toplam) * 100) : 0,
        ustalastiYuzde: a.toplam ? Math.round((a.uzmanlasti / a.toplam) * 100) : 0
      }))
    };
  }).sort((a, b) => b.yuzde - a.yuzde);

  return {
    sinif, disiplin,
    alanlar: alanlar.map(a => ({ id: a.id, ad: a.ad, renk: a.renk || '#4A7C59' })),
    ogrenciler: liste,
    ozet: {
      ogrenciSayisi: liste.length,
      ortalama: liste.length ? Math.round(ortToplam / liste.length) : 0,
      ustalasan, tekrar: tekrarEden, sunuldu: sunulan
    }
  };
}

// ══════════════════════════════════════════════════════════════
// YÖNETİM EĞİTİM PANOSU: Sınıf × Program ısı haritası
// ══════════════════════════════════════════════════════════════
export async function egitimPanoVerisi() {
  const disiplinler = ['montessori', 'orman', 'degerler', 'ingilizce'];
  const [ogrenciler, esik] = await Promise.all([
    ogrencileriGetir({ sadeceAktif: true }),
    asamaEsigiGetir()
  ]);
  const alanListeleri = {};
  await Promise.all(disiplinler.map(async d => {
    alanListeleri[d] = await mufredatAlanlariGetir(d).catch(() => []);
  }));

  const gelisimler = await Promise.all(
    ogrenciler.map(o => ogrenciGelisimTumGetir(o.id).catch(() => ({})))
  );

  const siniflar = {};
  let toplamKazanim = 0, toplamAsama = 0;
  const kayitsizlar = [];
  const simdi = Date.now();

  ogrenciler.forEach((o, i) => {
    const g = gelisimler[i] || {};
    const sinif = o.sinif || '(sınıfsız)';
    if (!siniflar[sinif]) {
      siniflar[sinif] = { ad: sinif, ogrenciSayisi: 0, asama: 0, programlar: {} };
      disiplinler.forEach(d => { siniflar[sinif].programlar[d] = { toplam: 0, adet: 0 }; });
    }
    const S = siniflar[sinif];
    S.ogrenciSayisi++;

    let sonKayitZamani = 0;
    disiplinler.forEach(d => {
      const kayitlar = (g[d] && g[d].kayitlar) || {};
      const alanlar = alanListeleri[d] || [];
      if (!alanlar.length) return;
      const istat = asamalariHesapla(kayitlar, alanlar, d, esik);
      const gecerli = istat.filter(a => a.toplam > 0);
      if (!gecerli.length) return;
      const top = gecerli.reduce((t, a) => t + a.toplam, 0);
      const ust = gecerli.reduce((t, a) => t + a.ustalasti, 0);
      const yuzde = top ? Math.round((ust / top) * 100) : 0;
      S.programlar[d].toplam += yuzde;
      S.programlar[d].adet++;
      toplamKazanim += ust;
      const kazanilanAsama = gecerli.filter(a => a.tamam).length;
      S.asama += kazanilanAsama;
      toplamAsama += kazanilanAsama;
      const gt = g[d] && g[d].guncellendi;
      const ms = gt && gt.seconds ? gt.seconds * 1000 : (gt ? Date.parse(gt) : 0);
      if (ms && ms > sonKayitZamani) sonKayitZamani = ms;
    });
    if (sonKayitZamani && (simdi - sonKayitZamani) > 14 * 24 * 3600 * 1000) {
      kayitsizlar.push({ id: o.id, ad: o.ogrenciAdSoyad || o.adSoyad || '', sinif });
    }
  });

  const sinifListesi = Object.values(siniflar).map(S => {
    const satir = { ad: S.ad, ogrenciSayisi: S.ogrenciSayisi, asama: S.asama, degerler: {} };
    let genelTop = 0, genelAdet = 0;
    disiplinler.forEach(d => {
      const p = S.programlar[d];
      const ort = p.adet ? Math.round(p.toplam / p.adet) : null;
      satir.degerler[d] = ort;
      if (ort != null) { genelTop += ort; genelAdet++; }
    });
    satir.ortalama = genelAdet ? Math.round(genelTop / genelAdet) : 0;
    return satir;
  }).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

  const genelOrtalama = sinifListesi.length
    ? Math.round(sinifListesi.reduce((t, s) => t + s.ortalama, 0) / sinifListesi.length) : 0;

  const dikkat = [];
  sinifListesi.forEach(s => {
    disiplinler.forEach(d => {
      const v = s.degerler[d];
      if (v != null && v < Math.max(50, genelOrtalama - 15)) {
        dikkat.push({
          tip: 'dusuk', sinif: s.ad, disiplin: d,
          baslik: s.ad + ' · ' + disiplinBilgisi(d).ad,
          metin: '%' + v + ' — okul ortalamasının altında'
        });
      }
    });
  });
  if (kayitsizlar.length) {
    const grup = {};
    kayitsizlar.forEach(k => { grup[k.sinif] = (grup[k.sinif] || 0) + 1; });
    Object.entries(grup).forEach(([sinif, adet]) => {
      dikkat.push({ tip: 'kayitsiz', sinif, baslik: sinif,
        metin: adet + ' öğrenci 14 gündür kayıtsız' });
    });
  }

  return {
    ogrenciSayisi: ogrenciler.length,
    sinifSayisi: sinifListesi.length,
    genelOrtalama, toplamKazanim, toplamAsama,
    disiplinler, siniflar: sinifListesi, dikkat: dikkat.slice(0, 8)
  };
}

// ══════════════════════════════════════════════════════════════
// AYLIK GELİŞİM SERİSİ (rapor grafiği)
// Kazanım tarihlerinden kümülatif aylık ilerleme üretir.
// ══════════════════════════════════════════════════════════════
export async function aylikGelisimSerisi(ogrenciId, disiplin, ayAdedi = 5) {
  const bos = { aylar: [], seriler: [], veriVar: false };
  if (!ogrenciId || !disiplin) return bos;
  const [gelisim, alanlar] = await Promise.all([
    ogrenciGelisimTumGetir(ogrenciId).catch(() => ({})),
    mufredatAlanlariGetir(disiplin).catch(() => [])
  ]);
  const dis = gelisim[disiplin] || {};
  const kayitlar = dis.kayitlar || {};
  const tarihler = dis.tarihler || {};
  if (!alanlar.length) return bos;

  const tarihliAdet = Object.keys(tarihler).length;
  const aylar = [];
  const simdi = new Date();
  for (let i = ayAdedi - 1; i >= 0; i--) {
    const d = new Date(simdi.getFullYear(), simdi.getMonth() - i, 1);
    aylar.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  const seriler = alanlar.map(alan => {
    const dersler = [];
    (alan.gruplar || []).forEach(g => (g.dersler || []).forEach(d => dersler.push(`${alan.id}__${g.ad}__${d}`)));
    const toplam = dersler.length;
    const degerler = aylar.map(ay => {
      if (!toplam) return 0;
      let sayac = 0;
      dersler.forEach(k => {
        if (kayitlar[k] !== 'U') return;
        const t = tarihler[k];
        // Tarihi olmayan eski kayıtlar en başta varsayılır (grafiği bozmasın)
        if (!t || t.slice(0, 7) <= ay) sayac++;
      });
      return Math.round((sayac / toplam) * 100);
    });
    return { alanId: alan.id, ad: alan.ad, renk: alan.renk || '#4A7C59', degerler,
             simdiki: degerler[degerler.length - 1] || 0 };
  }).filter(s => s.degerler.some(v => v > 0));

  return { aylar, seriler, veriVar: seriler.length > 0, tarihliAdet };
}

// ══════════════════════════════════════════════════════════════
// DIŞA AÇILIM
// index.html içindeki gömülü kod modül import'u kullanamadığı için
// aynı fonksiyonlar window.PortalData altında da sunulur.
// ══════════════════════════════════════════════════════════════
window.PortalData = {
  aktifKullanici,
  // sınıf
  RESMI_SINIFLAR, sinifAnahtar, sinifResmiAd, sinifEslesirMi,
  ogrencileriSinifaGoreFiltrele, bugunTarih, gorunenAd,
  // öğrenci
  ogrencileriGetir, ogrenciGetir,
  // müfredat + açıklama
  mufredatAlanlariGetir, mufredatAciklamalariGetir,
  alanAciklamaKaydet, kazanimAciklamaKaydet, aciklamaCoz, aciklamaDurumu,
  // gelişim
  ogrenciGelisimTumGetir, kazanimIsaretle, ogretmenYorumuEkle,
  // aşama
  ASAMA_VARSAYILAN_ESIK, asamaEsigiGetir, asamaEsikOnbellegiTemizle,
  asamalariHesapla, ogrenciAsamalariGetir,
  // raporlama
  disiplinBilgisi, ormanIstatistik,
  programOzetiGetir, sinifProgramDetayi, egitimPanoVerisi, aylikGelisimSerisi
};

window.PortalData.hazir = true;
document.dispatchEvent(new CustomEvent("portal-data-hazir"));
console.log("Portal veri katmanı hazır ·", Object.keys(window.PortalData).length, "giriş");
