// Galeri alıcısı (hedef kitle), alıcıyı düzenleme ve tam silme — Portal + ZEKY ortak sözleşmesi (A–E).
//
// Bu modülün saf işlevleri DOM ya da Firestore kullanmaz; Node'da birim testlenir.
// İşlem (orchestrator) işlevleri yalnız çağıranın verdiği bağımlılıklarla (fb, db,
// medyaSil, onay işlevleri …) çalışır; böylece Portal'daki gerçek akış ile testler
// aynı kodu yürütür. Veli okuma yolları burada değişmez.

const metin = deger => (typeof deger === 'string' ? deger : deger == null ? '' : String(deger)).trim();
const adAnahtari = deger => metin(deger).normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('tr');
const kacis = deger => String(deger ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hataKodu = hata => String(hata?.code || hata?.message || hata || 'bilinmeyen-hata');

export const GALERI_ADMIN_EPOSTA = 'emrahby@gmail.com';
export const GALERI_OKUL_TURLERI = Object.freeze(['tumOkul', 'okul', 'tum']);
export const GALERI_COCUK_TURLERI = Object.freeze(['ogrenci', 'cocuk']);
// Firestore kuralları: galeri update/delete yönetim + koordinatör + admin.
const YONETIM_ROLLERI = Object.freeze(['kurucu_mudur', 'mudur', 'egitim_koordinator']);
// Portal'ın mevcut onay yetkisi (galeriOnayla ile aynı): koordinatör onaylamaz.
const ONAY_ROLLERI = Object.freeze(['kurucu_mudur', 'mudur']);

// ───────────────────────── A. Alıcı etiketi ─────────────────────────

export function galeriOgrenciAdi(ogrenci = {}) {
  return metin(ogrenci.ogrenciAdSoyad) || metin(ogrenci.adSoyad) ||
    [metin(ogrenci.ad), metin(ogrenci.soyad)].filter(Boolean).join(' ');
}

// Portal'da güncel dönem sınıfı ayarListesi[id].kayit.sinif alanındadır.
export function galeriOgrenciSinifi(ogrenci = {}, ayarListesi = {}) {
  return metin(ayarListesi?.[ogrenci.id]?.kayit?.sinif) || metin(ogrenci._donemVeri?.kayit?.sinif) ||
    metin(ogrenci.sinif) || metin(ogrenci.sinifi);
}

/**
 * Canlı öğrenci rehberi: id → { id, ad, sinif }.
 * Dizi verilirse bir kez normalleştirilir; Map verilirse hazır rehber kabul edilir.
 * Listelerde her kart için yeniden kurmamak üzere çağıran bir kez oluşturup geçer.
 */
export function galeriAliciRehberi(ogrenciler = [], ayarListesi = {}) {
  if (ogrenciler instanceof Map) return ogrenciler;
  const rehber = new Map();
  for (const ogrenci of Array.isArray(ogrenciler) ? ogrenciler : []) {
    const id = metin(ogrenci?.id);
    if (!id || rehber.has(id)) continue;
    rehber.set(id, { id, ad: galeriOgrenciAdi(ogrenci), sinif: galeriOgrenciSinifi(ogrenci, ayarListesi) });
  }
  return rehber;
}

const belirsiz = uyari => ({ tur: 'belirsiz', ogrenciId: '', ad: '', sinif: '', uyari });

/**
 * galeriAlici(item, ogrenciler) → { tur:'ogrenci'|'sinif'|'okul'|'belirsiz', ogrenciId, ad, sinif, uyari }
 * - ogrenci/cocuk: kimlik hedefDeger || hedefOgrenciId || ogrenciId; dolu olanlar farklıysa belirsiz.
 *   Ad ve sınıf canlı öğrenci kaydından; kayıttaki hedefOgrenciAd farklıysa uyarı verilir.
 * - sinif: hedefDeger || sinif. tumOkul/okul/tum: Tüm okul. Diğer her şey belirsiz.
 */
export function galeriAlici(item = {}, ogrenciler = [], { ayarListesi = {} } = {}) {
  const tur = metin(item?.hedefTur);
  if (GALERI_OKUL_TURLERI.includes(tur)) return { tur: 'okul', ogrenciId: '', ad: 'Tüm okul', sinif: '', uyari: '' };
  if (tur === 'sinif') {
    const sinif = metin(item.hedefDeger) || metin(item.sinif);
    return sinif ? { tur: 'sinif', ogrenciId: '', ad: sinif, sinif, uyari: '' } : belirsiz('sınıf belirtilmemiş');
  }
  if (GALERI_COCUK_TURLERI.includes(tur)) {
    const idler = [...new Set([item.hedefDeger, item.hedefOgrenciId, item.ogrenciId].map(metin).filter(Boolean))];
    if (!idler.length) return belirsiz('çocuk kimliği yok');
    if (idler.length > 1) return belirsiz('çelişkili alıcı');
    const ogrenciId = idler[0];
    const kayitliAd = metin(item.hedefOgrenciAd);
    const saklananSinif = metin(item.sinifAdi) || metin(item.hedefSinifAd) || metin(item.sinif);
    const kayit = galeriAliciRehberi(ogrenciler, ayarListesi).get(ogrenciId);
    if (!kayit) return { tur: 'ogrenci', ogrenciId, ad: kayitliAd, sinif: saklananSinif, uyari: 'öğrenci kaydı bulunamadı' };
    const ad = kayit.ad || kayitliAd;
    const uyari = kayit.ad && kayitliAd && adAnahtari(kayit.ad) !== adAnahtari(kayitliAd) ? `kayıtta: ${kayitliAd}` : '';
    return { tur: 'ogrenci', ogrenciId, ad, sinif: kayit.sinif || saklananSinif, uyari };
  }
  return belirsiz(tur ? 'bilinmeyen alıcı türü' : 'alıcı türü yok');
}

export const galeriAliciBelirsizMi = alici => !alici || alici.tur === 'belirsiz';

// "👤 Ad Soyad · Sınıf" / "👥 Sınıf adı" / "🏫 Tüm okul" / "⚠️ Alıcı belirsiz — düzenleyin"
export function galeriAliciMetni(alici = {}) {
  if (alici.tur === 'ogrenci') return `👤 ${alici.ad || 'Adı bilinmeyen öğrenci'}${alici.sinif ? ` · ${alici.sinif}` : ''}`;
  if (alici.tur === 'sinif') return `👥 ${alici.sinif || alici.ad}`;
  if (alici.tur === 'okul') return '🏫 Tüm okul';
  return '⚠️ Alıcı belirsiz — düzenleyin';
}

// Etiket + (varsa) sarı uyarı notu (+ istenirse yükleyen satırı). Tüm metinler kaçışlıdır.
export function galeriAliciHtml(alici = {}, secenekler = {}) {
  const belirsizMi = galeriAliciBelirsizMi(alici);
  const renk = belirsizMi ? 'color:#B45309;font-weight:800' : 'color:#4C1D95;font-weight:700';
  const uyari = alici.uyari
    ? `<span class="galeri-alici-uyari" style="display:inline-block;margin-top:3px;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;border-radius:6px;padding:1px 6px;font-size:10.5px;font-weight:700">${kacis(alici.uyari)}</span>`
    : '';
  const kim = secenekler && Object.prototype.hasOwnProperty.call(secenekler, 'yukleyen')
    ? `<span class="galeri-alici-yukleyen" style="display:block;color:#64748B;font-size:10.5px;margin-top:2px;overflow-wrap:anywhere">Yükleyen: ${kacis(secenekler.yukleyen || 'bilinmiyor')}</span>`
    : '';
  return `<span class="galeri-alici" data-galeri-alici-tur="${kacis(alici.tur || 'belirsiz')}" style="display:block;font-size:11.5px;line-height:1.35;overflow-wrap:anywhere;${renk}">${kacis(galeriAliciMetni(alici))}</span>${uyari}${kim}`;
}

const sinifIfadesi = sinif => /sınıf(ı)?$/i.test(metin(sinif).toLocaleLowerCase('tr')) ? metin(sinif) : `${metin(sinif)} sınıfı`;

// Cümle içi ad: "Ad Soyad (Sınıf)" / "Papatyalar Sınıfı" / "tüm okul"
export function galeriAliciAdi(alici = {}) {
  if (alici.tur === 'ogrenci') return `${alici.ad || 'Adı bilinmeyen öğrenci'}${alici.sinif ? ` (${alici.sinif})` : ''}`;
  if (alici.tur === 'sinif') return sinifIfadesi(alici.sinif || alici.ad);
  if (alici.tur === 'okul') return 'tüm okul';
  return 'belirsiz alıcı';
}

// C. Kaydetmeden önceki onay metni.
export function galeriAliciDegisimOnayMetni(alici = {}, { video = false } = {}) {
  const medya = video ? 'video' : 'fotoğraf';
  if (alici.tur === 'ogrenci') return `Bu ${medya} artık yalnızca ${galeriAliciAdi(alici)} velisine görünecek.`;
  if (alici.tur === 'sinif') return `Bu ${medya} artık yalnızca ${galeriAliciAdi(alici)} velilerine görünecek.`;
  if (alici.tur === 'okul') return `Bu ${medya} artık tüm okul velilerine görünecek.`;
  return `Bu ${medya} için alıcı seçilmedi.`;
}

// E. Öğretmen yüklemesinde kaydetmeden önceki onay metni.
export function galeriYuklemeOnayMetni(alici = {}, { adet = 1, video = false } = {}) {
  const nesne = adet > 1 ? `Bu ${adet} dosya` : `Bu ${video ? 'video' : 'fotoğraf'}`;
  return `${nesne} ${galeriAliciAdi(alici)} için onaya gönderilecek.`;
}

// B. Yükleyen: ad (e-posta/genel etiket değilse) ya da e-posta.
export function galeriYukleyenEtiketi(item = {}) {
  const ad = [item.yukleyenAd, item.yukleyenAdSoyad, item.gonderenAd, item.olusturanAd].map(metin)
    .find(deger => deger && !/@/.test(deger) && !['-', '—', 'Öğretmen', 'Okul Personeli'].includes(deger));
  if (ad) return ad;
  return [item.yukleyenEmail, item.yukleyen, item.ekleyenEmail, item.gonderenEmail, item.olusturanEmail]
    .map(metin).find(deger => /@/.test(deger)) || '';
}

// ───────────────────────── Yetkiler (kurallarla aynı) ─────────────────────────

export function galeriYonetimMi({ email = '', rol = '', isAdmin = false } = {}) {
  return !!isAdmin || metin(email).toLowerCase() === GALERI_ADMIN_EPOSTA || YONETIM_ROLLERI.includes(metin(rol));
}
export function galeriOnaylayiciMi({ email = '', rol = '', isAdmin = false } = {}) {
  return !!isAdmin || metin(email).toLowerCase() === GALERI_ADMIN_EPOSTA || ONAY_ROLLERI.includes(metin(rol));
}
export function galeriYukleyenMi(item = {}, email = '') {
  const eposta = metin(email).toLowerCase();
  return !!eposta && [item.yukleyenEmail, item.yukleyen, item.ekleyenEmail].some(deger => metin(deger).toLowerCase() === eposta);
}
// D. Yönetim/koordinatör/admin her öğeyi; öğretmen yalnız kendi yüklediğini siler.
export function galeriSilmeYetkisi(item = {}, oturum = {}) {
  return galeriYonetimMi(oturum) || galeriYukleyenMi(item, oturum.email);
}

// ───────────────────────── Ortak kimlik yardımcıları ─────────────────────────

export function galeriEgitimKaydiMi(item = {}) {
  return Boolean(metin(item.kazanimAnahtari)) || item.egitimKaydi === true;
}
// Gelişim kaydında bu medyaya bağ taşıyabilecek tüm çocuk kimlikleri.
export function galeriCocukIdleri(item = {}) {
  const cocukHedefi = GALERI_COCUK_TURLERI.includes(metin(item.hedefTur));
  return [...new Set([cocukHedefi ? item.hedefDeger : '', item.hedefOgrenciId, item.ogrenciId].map(metin)
    .filter(id => id && !/[/\\]/.test(id)))];
}
export function galeriFotoUrlleri(item = {}) {
  return [...new Set([item.bunnyUrl, item.url, item.kucukResim].map(metin).filter(Boolean))];
}

// ───────────────────────── C. Alıcıyı düzenle ─────────────────────────

const ozet = alici => ({ tur: alici.tur, ogrenciId: alici.ogrenciId || '', ad: alici.ad || '', sinif: alici.sinif || '' });
const esit = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Yeni alıcı için yazılacak alanlar + denetim kaydı.
 * hedef: { tur:'ogrenci', ogrenciId } | { tur:'sinif', sinif } | { tur:'okul' }
 * Dönüş: { alanlar, denetim, onceki, yeni, degisti }. alanlar arrayUnion içermez:
 * çağıran `aliciDuzenlemeleri: arrayUnion(denetim)` ekleyerek tek updateDoc yapar.
 */
export function galeriAliciGuncellemesi(item = {}, hedef = {}, {
  yapan = '', zaman = new Date().toISOString(), ogrenciler = [], ayarListesi = {}, izinsizOgrenciler = null
} = {}) {
  const rehber = galeriAliciRehberi(ogrenciler, ayarListesi);
  const onceki = galeriAlici(item, rehber);
  const doluysa = (alanlar, alan, deger) => { if (metin(item[alan])) alanlar[alan] = deger; };
  let yeni, alanlar;
  if (hedef.tur === 'ogrenci') {
    const id = metin(hedef.ogrenciId), kayit = rehber.get(id);
    if (!id || !kayit) throw new Error('Seçilen öğrenci öğrenci listesinde bulunamadı');
    yeni = { tur: 'ogrenci', ogrenciId: id, ad: kayit.ad, sinif: kayit.sinif, uyari: '' };
    alanlar = { hedefTur: 'ogrenci', hedefDeger: id, hedefOgrenciId: id, ogrenciId: id, hedefOgrenciAd: kayit.ad };
    // Belgede dolu sınıf alanları yeni çocuğun sınıfıyla güncellenir; boşsa dokunulmaz.
    doluysa(alanlar, 'sinif', kayit.sinif);
    doluysa(alanlar, 'sinifAdi', kayit.sinif);
    doluysa(alanlar, 'hedefSinifAd', '');
  } else if (hedef.tur === 'sinif') {
    const sinif = metin(hedef.sinif);
    if (!sinif) throw new Error('Sınıf seçin');
    yeni = { tur: 'sinif', ogrenciId: '', ad: sinif, sinif, uyari: '' };
    alanlar = { hedefTur: 'sinif', hedefDeger: sinif, sinif, hedefOgrenciId: '', ogrenciId: '', hedefOgrenciAd: '' };
    doluysa(alanlar, 'sinifAdi', sinif);
    doluysa(alanlar, 'hedefSinifAd', sinif);
  } else if (hedef.tur === 'okul') {
    yeni = { tur: 'okul', ogrenciId: '', ad: 'Tüm okul', sinif: '', uyari: '' };
    alanlar = { hedefTur: 'tumOkul', hedefDeger: '', hedefOgrenciId: '', ogrenciId: '', hedefOgrenciAd: '' };
    // Okul hedefinde dolu sınıf alanı kalırsa ZEKY (normalizeGalleryMedia) kaydı çelişkili sayar
    // ve veli göremez; ZEKY ile aynı biçimde boşaltılır.
    doluysa(alanlar, 'sinif', '');
    doluysa(alanlar, 'sinifAdi', '');
    doluysa(alanlar, 'hedefSinifAd', '');
  } else {
    throw new Error('Geçersiz alıcı seçimi');
  }
  // Eski eğitim onay paneli hedefEtiket'i her şeyden önce gösterir; bayat kalmasın.
  doluysa(alanlar, 'hedefEtiket', yeni.tur === 'okul' ? 'Tüm okul' : yeni.ad);
  // ZEKY izinsizOgrenciler: tek çocuk hedefinde boş liste; sınıf/okulda çağıranın yeniden hesabı.
  if (Array.isArray(item.izinsizOgrenciler)) {
    if (yeni.tur === 'ogrenci') alanlar.izinsizOgrenciler = [];
    else if (Array.isArray(izinsizOgrenciler)) alanlar.izinsizOgrenciler = izinsizOgrenciler;
  }
  const degisti = Object.entries(alanlar).some(([alan, deger]) => !esit(item[alan] ?? (typeof deger === 'string' ? '' : undefined), deger));
  const denetim = { onceki: ozet(onceki), yeni: ozet(yeni), yapan: metin(yapan).toLowerCase(), zaman };
  return { alanlar: { ...alanlar, guncellendi: zaman }, denetim, onceki, yeni, degisti };
}

// Yan etki planı: eski çocuğun gelişim bağları/bildirimi temizlenir, yeni çocuğa senkron.
export function galeriAliciYanEtkiPlani(item = {}, guncelleme = {}) {
  const egitim = galeriEgitimKaydiMi(item);
  const yeniId = guncelleme.yeni?.tur === 'ogrenci' ? guncelleme.yeni.ogrenciId : '';
  const durum = metin(item.durum);
  const onayli = durum === 'onaylandi';
  const bekliyor = durum === 'beklemede' || durum === 'onayBekliyor';
  const kazanim = Boolean(metin(item.kazanimAnahtari));
  return {
    egitim, onayli, bekliyor, durum,
    temizlenecekCocuklar: egitim ? galeriCocukIdleri(item).filter(id => id !== yeniId) : [],
    yeniCocuk: kazanim && yeniId ? yeniId : '',
    senkronDurumu: kazanim && yeniId && (onayli || bekliyor) ? durum : '',
    // galeriOnayla ile aynı ayrım: çocuk + kazanım → eğitim bildirimi; aksi halde genel galeri bildirimi.
    egitimBildirimi: onayli && kazanim && Boolean(yeniId),
    genelBildirim: onayli && !(kazanim && yeniId),
    oncekiAileGormusOlabilir: onayli && guncelleme.onceki?.tur !== 'belirsiz'
  };
}

// ───────────────────────── Gelişim kaydı temizliği (C + D) ─────────────────────────

const nesneMi = deger => !!deger && typeof deger === 'object' && !Array.isArray(deger);

/**
 * ogrenciGelisim belgesinde bu galeriId'ye (ya da kimliksiz eski kayıtta aynı foto
 * URL'sine) bağlı fotoUrl/fotoYol/galeriId referanslarını temizleyen merge yaması.
 * Eğitim aşaması (S/T/U), not ve tarih korunur; yalnız fotoğraf bağı kalkar.
 * Değişiklik yoksa null.
 */
export function gelisimFotoTemizlikYamasi(veri = {}, galeriId = '', { urls = [], fotoDurum = 'silindi' } = {}) {
  const id = metin(galeriId);
  if (!id || !nesneMi(veri)) return null;
  const urlKumesi = new Set(urls.map(metin).filter(Boolean));
  const eslesir = kayit => nesneMi(kayit) && (metin(kayit.galeriId) === id ||
    (!metin(kayit.galeriId) && urlKumesi.has(metin(kayit.fotoUrl))));
  const temizle = kayit => ({ ...kayit, fotoUrl: '', fotoYol: '', galeriId: '', fotoDurum });
  const yama = {};
  for (const [program, dis] of Object.entries(veri)) {
    if (program === 'sonGozlem' || !nesneMi(dis) || (!nesneMi(dis.detay) && !nesneMi(dis.fotolar))) continue;
    let detayYama = null, fotolarYama = null;
    for (const [anahtar, kayit] of Object.entries(nesneMi(dis.detay) ? dis.detay : {})) {
      if (!nesneMi(kayit)) continue;
      let asamalar = null;
      for (const [kod, asama] of Object.entries(nesneMi(kayit.asamalar) ? kayit.asamalar : {})) {
        if (eslesir(asama)) { asamalar ||= { ...kayit.asamalar }; asamalar[kod] = temizle(asama); }
      }
      if (eslesir(kayit) || asamalar) {
        detayYama ||= {};
        detayYama[anahtar] = { ...(eslesir(kayit) ? temizle(kayit) : kayit), ...(asamalar ? { asamalar } : {}) };
      }
    }
    // Eski şemadaki program.fotolar[anahtar] yalnız aynı URL ise temizlenir.
    for (const [anahtar, url] of Object.entries(nesneMi(dis.fotolar) ? dis.fotolar : {})) {
      if (urlKumesi.has(metin(url))) { fotolarYama ||= {}; fotolarYama[anahtar] = ''; }
    }
    if (detayYama || fotolarYama) yama[program] = { ...(detayYama ? { detay: detayYama } : {}), ...(fotolarYama ? { fotolar: fotolarYama } : {}) };
  }
  if (eslesir(veri.sonGozlem)) yama.sonGozlem = { fotoUrl: '', fotoYol: '', galeriId: '', fotoDurum };
  return Object.keys(yama).length ? yama : null;
}

export async function gelisimFotoReferanslariniTemizle({ fb, db }, ogrenciId, galeriId, secenekler = {}) {
  const ref = fb.doc(db, 'ogrenciGelisim', ogrenciId);
  let degisti = false;
  const uygula = async islem => {
    const snap = await islem.get(ref);
    degisti = false;
    if (!snap.exists()) return;
    const yama = gelisimFotoTemizlikYamasi(snap.data() || {}, galeriId, secenekler);
    if (!yama) return;
    degisti = true;
    islem.set(ref, { ...yama, ...(fb.serverTimestamp ? { sonGuncelleme: fb.serverTimestamp() } : {}) }, { merge: true });
  };
  if (fb.runTransaction) await fb.runTransaction(db, uygula);
  else await uygula({ get: r => fb.getDoc(r), set: (...args) => fb.setDoc(...args) });
  return degisti;
}

export async function galeriEgitimBildiriminiSil({ fb, db }, ogrenciId, galeriId) {
  await fb.deleteDoc(fb.doc(db, 'ogrenciler', ogrenciId, 'bildirimler', `egitim_${galeriId}`));
}

/**
 * C. İşlem: belge okunur, alanlar tek updateDoc ile yazılır, sonra yan etkiler.
 * deps: { fb, db, yapan, ogrenciler, ayarListesi, izinsizHesapla(hedef),
 *         gelisimEsitle(oge, durum), egitimOnayEsitle(id, durum, {canliOnay}), genelBildirim(oge) }
 */
export async function galeriAliciniDegistir(id, hedef, deps = {}) {
  const { fb, db, yapan = '', ogrenciler = [], ayarListesi = {}, zaman = new Date().toISOString(),
    izinsizHesapla = null, gelisimEsitle = null, egitimOnayEsitle = null, genelBildirim = null } = deps;
  const uyarilar = [];
  const ref = fb.doc(db, 'galeri', id);
  const snap = await fb.getDoc(ref);
  if (!snap.exists()) return { ok: false, durum: 'yok', uyarilar };
  const item = { id, ...(snap.data() || {}) };
  let izinsiz = null;
  if (Array.isArray(item.izinsizOgrenciler) && hedef?.tur !== 'ogrenci' && typeof izinsizHesapla === 'function') {
    try { izinsiz = await izinsizHesapla(hedef, item); }
    catch (hata) { uyarilar.push(`Fotoğraf izni listesi yeniden hesaplanamadı: ${hataKodu(hata)}`); }
  }
  const guncelleme = galeriAliciGuncellemesi(item, hedef, { yapan, zaman, ogrenciler, ayarListesi, izinsizOgrenciler: izinsiz });
  if (!guncelleme.degisti) return { ok: true, durum: 'ayni', item, ...guncelleme, uyarilar };
  await fb.updateDoc(ref, { ...guncelleme.alanlar, aliciDuzenlemeleri: fb.arrayUnion(guncelleme.denetim) });
  const guncel = { ...item, ...guncelleme.alanlar };
  const plan = galeriAliciYanEtkiPlani(item, guncelleme);
  const urls = galeriFotoUrlleri(item);
  for (const cocukId of plan.temizlenecekCocuklar) {
    try { await gelisimFotoReferanslariniTemizle({ fb, db }, cocukId, id, { urls, fotoDurum: 'alici-degisti' }); }
    catch (hata) { uyarilar.push(`Önceki çocuğun gelişim kaydındaki fotoğraf bağı temizlenemedi: ${hataKodu(hata)}`); }
    try { await galeriEgitimBildiriminiSil({ fb, db }, cocukId, id); }
    catch (hata) { uyarilar.push(`Önceki ailenin eğitim bildirimi silinemedi: ${hataKodu(hata)}`); }
  }
  if (plan.senkronDurumu && typeof gelisimEsitle === 'function') {
    try { await gelisimEsitle(guncel, plan.senkronDurumu); }
    catch (hata) { uyarilar.push(`Yeni çocuğun gelişim kaydı eşitlenemedi: ${hataKodu(hata)}`); }
  }
  if (plan.egitimBildirimi) {
    if (typeof egitimOnayEsitle !== 'function') uyarilar.push('Yeni aileye eğitim bildirimi gönderilemedi: eğitim onay köprüsü yüklenmedi.');
    else {
      try { if (!(await egitimOnayEsitle(id, 'onaylandi', { canliOnay: true }))) uyarilar.push('Yeni aileye eğitim bildirimi doğrulanamadı.'); }
      catch (hata) { uyarilar.push(`Yeni aileye eğitim bildirimi gönderilemedi: ${hataKodu(hata)}`); }
    }
  } else if (plan.genelBildirim && typeof genelBildirim === 'function') {
    try { await genelBildirim(guncel); }
    catch (hata) { uyarilar.push(`Yeni aileye galeri bildirimi gönderilemedi: ${hataKodu(hata)}`); }
  }
  return { ok: true, durum: 'degisti', item, guncel, plan, ...guncelleme, uyarilar };
}

// ───────────────────────── D. Silme ─────────────────────────

// Bunny depolama yolunu URL'den yalnız bilinen yükleme köküne birebir uyarsa türetir.
export function galeriYolUrldenTuret(url = '', kokler = []) {
  const adres = metin(url).split(/[?#]/)[0];
  for (const kok of kokler) {
    const k = metin(kok);
    if (k && adres.startsWith(k) && adres.length > k.length) {
      try { return decodeURIComponent(adres.slice(k.length)).replace(/^\/+/, ''); } catch (_) { return ''; }
    }
  }
  return '';
}

export function galeriDepolamaPlani(item = {}, { yuklemeKokleri = [] } = {}) {
  const notlar = [];
  // NOT: Bunny Stream videosunu silen bir işlem medya vekilinde (BCKA-Medya) yok;
  // video belgesi silinir, Stream kopyası bilerek atlanır.
  const streamVideoId = metin(item.streamVideoId) || metin(item.bunnyVideoId);
  if (streamVideoId) notlar.push('Bunny Stream videosu silinmedi: medya vekilinde Stream silme işlemi yok.');
  // ZEKY'nin eski videolarında storagePath Firebase Storage yoludur; Portal Firebase Storage kullanmaz.
  const firebaseYolu = metin(item.storagePath) && metin(item.depolamaSaglayici) !== 'bunny' ? metin(item.storagePath) : '';
  if (firebaseYolu) notlar.push('Eski Firebase Storage dosyası Portal\'dan silinemez.');
  const bunnyYolu = metin(item.bunnyPath) || (!firebaseYolu ? metin(item.storagePath) : '') || metin(item.fotoYol) ||
    (!streamVideoId ? galeriYolUrldenTuret(item.bunnyUrl || item.url, yuklemeKokleri) : '');
  if (!bunnyYolu && !streamVideoId && !firebaseYolu) notlar.push('Depolama yolu kayıtlı değil; dosya depoda kalmış olabilir.');
  return { bunnyYolu, streamVideoId, firebaseYolu, notlar };
}

export function galeriSilmePlani(item = {}, oturum = {}, secenekler = {}) {
  const yonetim = galeriYonetimMi(oturum);
  const video = item.dosyaTipi === 'video' || item.tip === 'video';
  return {
    izin: yonetim || galeriYukleyenMi(item, oturum.email),
    yonetim, video,
    cocukIdleri: galeriEgitimKaydiMi(item) ? galeriCocukIdleri(item) : [],
    // etkilesimler delete kuralı yalnız yönetim/koordinatör/admin.
    etkilesimleriSil: yonetim,
    fotoUrlleri: galeriFotoUrlleri(item),
    depolama: galeriDepolamaPlani(item, secenekler),
    onayMetni: `Bu ${video ? 'video' : 'fotoğraf'} kalıcı olarak silinecek; veliler hiçbir ekranda göremeyecek.`
  };
}

export const GALERI_SILME_YETKI_HATASI = 'Bu fotoğrafı silme yetkiniz yok.';
const yetkiHatasiMi = hata => /permission|insufficient|yetki/i.test(`${hata?.code || ''} ${hata?.message || ''}`);

/**
 * D. Tek silme işlemi. Sıra:
 * 1 belge okunur → 2 gelişim bağları + egitim_{id} bildirimi → 3 etkileşimler (yalnız yönetim)
 * → 4 galeri/{id} (başarısızsa dur) → 5 depolama (en iyi çaba).
 * deps: { fb, db, oturum:{email,rol,isAdmin}, onayla(metin,item), medyaSil(yol), yuklemeKokleri }
 */
export async function galeriOgesiniSil(id, deps = {}) {
  const { fb, db, oturum = {}, onayla = () => true, medyaSil = null, yuklemeKokleri = [] } = deps;
  const uyarilar = [], notlar = [];
  const ref = fb.doc(db, 'galeri', id);
  const snap = await fb.getDoc(ref);
  if (!snap.exists()) return { ok: false, durum: 'yok', uyarilar, notlar };
  const item = { id, ...(snap.data() || {}) };
  const plan = galeriSilmePlani(item, oturum, { yuklemeKokleri });
  if (!plan.izin) return { ok: false, durum: 'yetki-yok', hata: GALERI_SILME_YETKI_HATASI, item, plan, uyarilar, notlar };
  if (!(await onayla(plan.onayMetni, item))) return { ok: false, durum: 'iptal', item, plan, uyarilar, notlar };

  for (const cocukId of plan.cocukIdleri) {
    // Gelişim bağı kalırsa veli eğitim ekranı fotoğrafı göstermeye devam eder: temizlenemezse
    // silme durur (ZEKY ile aynı, muhafazakâr davranış); galeri belgesi yerinde kalır.
    try { await gelisimFotoReferanslariniTemizle({ fb, db }, cocukId, id, { urls: plan.fotoUrlleri, fotoDurum: 'silindi' }); }
    catch (hata) {
      return { ok: false, durum: 'hata', hata: `Gelişim kaydındaki fotoğraf bağı temizlenemedi; fotoğraf silinmedi (${hataKodu(hata)}).`, item, plan, uyarilar, notlar };
    }
    try { await galeriEgitimBildiriminiSil({ fb, db }, cocukId, id); }
    catch (hata) { uyarilar.push(`Ailenin eğitim bildirimi silinemedi: ${hataKodu(hata)}`); }
  }
  if (plan.etkilesimleriSil) {
    try {
      const etkilesimler = await fb.getDocs(fb.collection(db, 'galeri', id, 'etkilesimler'));
      for (const kayit of etkilesimler.docs || []) await fb.deleteDoc(kayit.ref || fb.doc(db, 'galeri', id, 'etkilesimler', kayit.id));
    } catch (hata) { uyarilar.push(`Veli etkileşim kayıtları silinemedi: ${hataKodu(hata)}`); }
  }
  try { await fb.deleteDoc(ref); }
  catch (hata) {
    return { ok: false, durum: 'hata', hata: yetkiHatasiMi(hata) ? GALERI_SILME_YETKI_HATASI : `Silinemedi: ${hata?.message || hata}`, item, plan, uyarilar, notlar };
  }
  notlar.push(...plan.depolama.notlar);
  if (plan.depolama.bunnyYolu) {
    if (typeof medyaSil !== 'function') uyarilar.push('Depolama dosyası silinemedi: medya vekili hazır değil.');
    else {
      try { await medyaSil(plan.depolama.bunnyYolu); }
      catch (hata) { uyarilar.push(`Depolama dosyası silinemedi: ${hata?.message || hataKodu(hata)}`); }
    }
  }
  return { ok: true, durum: 'silindi', item, plan, uyarilar, notlar };
}
