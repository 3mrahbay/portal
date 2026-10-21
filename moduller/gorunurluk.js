// ═══════════════════════════════════════════════════════════════════
// GÖRÜNÜRLÜK — moduller/gorunurluk.js
//
// bircicekkoleji.com'un Google aramasındaki görünürlüğü:
//   Özet (son 28 gün, haftalık grafik, semtler, konular, niyetler, cihazlar) ·
//   Kelimeler · Sayfalar · Kelime grupları (ayar)
//
// Veri:   Firestore gorunurlukDurum/searchConsole, gorunurlukGunluk/{YYYY-MM-DD},
//         gorunurlukAylik/{YYYY-MM}  — her gece 05:30'da zeky-backend
//         prod-work/gorunurluk (gorunurlukSearchConsoleGece) yazar; istemci yazamaz.
//         gorunurlukAyarlar/kelimeGruplari — bu ekrandan düzenlenir, gece görevi okur.
// Yetki:  yalnızca emrahby@gmail.com ve eposta@bircicekkoleji.com
//         (Firestore kuralları ile birebir; Web Sitesi bölümünün içinden açılır)
//
// Kullanım: m.panelRender("wsGorunurluk")
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

export const YETKILI = ["emrahby@gmail.com", "eposta@bircicekkoleji.com"];
const KOL = { durum: "gorunurlukDurum", gunluk: "gorunurlukGunluk", aylik: "gorunurlukAylik", ayarlar: "gorunurlukAyarlar" };
const AYAR_BELGE = "kelimeGruplari";
const SITE = "https://www.bircicekkoleji.com";
const RENK = { buYil: "#2F7D45", gecenYil: "#8E4EC6" };
const YENILEME_MS = 5 * 60 * 1000;

// Gece görevindeki varsayılanlarla aynı (zeky-backend prod-work/gorunurluk/functions/src/domain.mjs)
export const VARSAYILAN_GRUPLAR = Object.freeze({
  marka: ["bir cicek", "bircicek", "bcka"],
  bolgeler: [
    { id: "tuzla", ad: "Tuzla", kaliplar: ["tuzla", "aydintepe", "icmeler", "orhanli", "akfirat", "tepeoren"] },
    { id: "pendik", ad: "Pendik", kaliplar: ["pendik", "kurtkoy", "velibaba", "camcesme", "esenyali", "dolayoba"] },
    { id: "kartal", ad: "Kartal", kaliplar: ["kartal", "soganlik", "yakacik", "kordonboyu", "topselvi"] },
    { id: "gebze", ad: "Gebze", kaliplar: ["gebze"] },
    { id: "darica", ad: "Darıca", kaliplar: ["darica", "bayramoglu"] },
  ],
  konular: [
    { id: "anaokulu", ad: "Anaokulu / kreş", kaliplar: ["anaokul", "ana okul", "kres", "yuva", "okul oncesi", "okuloncesi", "anasinif", "ana sinif", "kindergarten", "preschool", "gunduz bakim"] },
    { id: "montessori", ad: "Montessori", kaliplar: ["montessori", "montesori", "montessory"] },
    { id: "orman-okulu", ad: "Orman okulu", kaliplar: ["orman", "doga okul", "doga temelli", "forest school"] },
    { id: "atolye", ad: "Atölyeler", kaliplar: ["atolye", "marangoz", "ahsap"] },
    { id: "yaz-okulu", ad: "Yaz okulu", kaliplar: ["yaz okul", "yaz kamp"] },
  ],
  niyetler: [
    { id: "ucret", ad: "Ücret", kaliplar: ["ucret", "fiyat", "taksit"] },
    { id: "kayit", ad: "Kayıt", kaliplar: ["kayit", "basvuru", "on kayit"] },
    { id: "iletisim", ad: "İletişim / konum", kaliplar: ["iletisim", "telefon", "adres", "nerede", "konum", "yol tarifi"] },
    { id: "yorum", ad: "Yorum", kaliplar: ["yorum", "sikayet", "eksi", "tavsiye"] },
  ],
});
const LIMIT = Object.freeze({ grup: 20, kalip: 30, kalipMin: 2, kalipMax: 40, ad: 40 });
const GRUP_LISTELERI = [
  { anahtar: "bolgeler", ad: "Semtler", tekil: "semt", ornek: "Çayırova" },
  { anahtar: "konular", ad: "Konular", tekil: "konu", ornek: "Değerler eğitimi" },
  { anahtar: "niyetler", ad: "Niyetler", tekil: "niyet", ornek: "Servis" },
];
const SEKMELER = [
  { id: "ozet", ad: "Özet", ikon: "layout-dashboard" },
  { id: "kelimeler", ad: "Kelimeler", ikon: "search" },
  { id: "sayfalar", ad: "Sayfalar", ikon: "file-text" },
  { id: "gruplar", ad: "Kelime grupları", ikon: "tags" },
];

// ───────────────────────── saf yardımcılar (testlerde kullanılır) ─────────────────────────
const TR_HARF = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
export function normalizeTr(t) {
  return String(t ?? "").toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, (c) => TR_HARF[c])
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
export const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// onclick içindeki JS argümanları için: yalnız grup kimliği karakterleri geçer (HTML kaçışı JS'i korumaz).
export const kimlikSuz = (t) => String(t == null ? "" : t).replace(/[^a-z0-9:-]/g, "");

function gunNo(ymd) { const [y, m, d] = ymd.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; }
function ymdNo(no) { return new Date(no * 864e5).toISOString().slice(0, 10); }
export function gunEkle(ymd, n) { return ymdNo(gunNo(ymd) + n); }
export function haftaBasi(ymd) { const no = gunNo(ymd); const gun = (new Date(no * 864e5).getUTCDay() + 6) % 7; return ymdNo(no - gun); }

export function metrik(tiklama, gosterim, siraToplam) {
  return {
    tiklama, gosterim,
    ctr: gosterim > 0 ? tiklama / gosterim : 0,
    sira: gosterim > 0 ? siraToplam / gosterim : null,
  };
}

// gunler: [{ tarih, tiklama, gosterim, sira }] — tarih sırası önemsiz
export function pencereOzeti(gunler, bitis, uzunluk = 28) {
  const harita = new Map(gunler.map((g) => [g.tarih, g]));
  const topla = (son) => {
    let t = 0, g = 0, s = 0, var_ = 0;
    for (let i = 0; i < uzunluk; i++) {
      const v = harita.get(gunEkle(son, -i));
      if (!v) continue;
      var_++; t += v.tiklama || 0; g += v.gosterim || 0; s += (v.sira || 0) * (v.gosterim || 0);
    }
    return { ...metrik(t, g, s), gunVar: var_ };
  };
  return { bitis, simdi: topla(bitis), once: topla(gunEkle(bitis, -uzunluk)) };
}

// Son tam haftaya kadar haftalık toplamlar; aynı haftanın bir yıl (52 hafta) önceki değeri ile.
export function haftalikSeri(gunler, sonGun, haftaSayisi = 52) {
  const harita = new Map(gunler.map((g) => [g.tarih, g]));
  const sonHafta = gunEkle(haftaBasi(gunEkle(sonGun, 1)), -7); // sonGun pazar ise o hafta, değilse bir önceki
  const hafta = (bas) => {
    let t = 0, g = 0, var_ = 0;
    for (let i = 0; i < 7; i++) {
      const v = harita.get(gunEkle(bas, i));
      if (v) { var_++; t += v.tiklama || 0; g += v.gosterim || 0; }
    }
    return var_ ? { tiklama: t, gosterim: g } : null;
  };
  const seri = [];
  for (let i = haftaSayisi - 1; i >= 0; i--) {
    const bas = gunEkle(sonHafta, -7 * i);
    const bu = hafta(bas);
    seri.push({ hafta: bas, tiklama: bu ? bu.tiklama : 0, gosterim: bu ? bu.gosterim : 0, veriVar: !!bu, gecenYil: hafta(gunEkle(bas, -364)) });
  }
  return seri;
}

export function degisim(simdi, once) {
  if (once == null || simdi == null || !isFinite(once) || !isFinite(simdi)) return null;
  if (once === 0) return simdi === 0 ? 0 : null;
  return (simdi - once) / once;
}

export function ayEtiketi(ay) {
  const [y, m] = ay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Seçili ay sorgularına bir önceki ayın değerlerini ekler
export function sorgulariKarsilastir(buAy, oncekiAy) {
  const once = new Map((oncekiAy?.ilkSorgular || []).map((q) => [q.sorgu, q]));
  return (buAy?.ilkSorgular || []).map((q) => {
    const o = once.get(q.sorgu);
    return { ...q, oncekiGosterim: o ? o.gosterim : null, gosterimDegisim: o ? degisim(q.gosterim, o.gosterim) : null, yeni: !o && !!oncekiAy };
  });
}

export function sorgulariSuz(sorgular, { grup = "hepsi", ara = "" } = {}) {
  const n = normalizeTr(ara);
  return sorgular.filter((q) => {
    if (n && !normalizeTr(q.sorgu).includes(n)) return false;
    if (grup === "hepsi") return true;
    if (grup === "marka") return q.marka === true;
    if (grup === "markaDisi") return q.marka !== true;
    const [tur, id] = grup.split(":");
    const alan = { bolge: "bolge", konu: "konu", niyet: "niyet" }[tur];
    return !!alan && Array.isArray(q[alan]) && q[alan].includes(id);
  });
}

export function grupKimligi(ad) { return normalizeTr(ad).replace(/ /g, "-").slice(0, 30).replace(/-+$/, ""); }

export function kaliplariAyristir(metin) {
  return [...new Set(String(metin || "").split(/[,\n]/).map(normalizeTr).filter(Boolean))];
}

// Gece görevindeki sanitizeGroups ile aynı sınırlar; hatalar Türkçe, satır bazında.
export function grupAyariniDogrula(taslak) {
  const hatalar = [];
  const temiz = { marka: [], bolgeler: [], konular: [], niyetler: [] };
  const kaliplar = (liste, yer) => {
    if (!liste.length) { hatalar.push(`${yer}: en az bir kalıp yazın.`); return liste; }
    if (liste.length > LIMIT.kalip) hatalar.push(`${yer}: en çok ${LIMIT.kalip} kalıp olabilir.`);
    for (const k of liste) {
      if (k.length < LIMIT.kalipMin || k.length > LIMIT.kalipMax) hatalar.push(`${yer}: “${k}” ${LIMIT.kalipMin}–${LIMIT.kalipMax} harf olmalı.`);
    }
    return liste;
  };
  temiz.marka = kaliplar((taslak.marka || []).map(normalizeTr).filter(Boolean), "Okul adı kalıpları");
  for (const { anahtar, ad } of GRUP_LISTELERI) {
    const liste = taslak[anahtar] || [];
    if (!liste.length) hatalar.push(`${ad}: en az bir grup olmalı.`);
    if (liste.length > LIMIT.grup) hatalar.push(`${ad}: en çok ${LIMIT.grup} grup olabilir.`);
    const gorulen = new Set();
    temiz[anahtar] = liste.map((g, i) => {
      const grupAdi = String(g.ad || "").trim();
      const id = g.id && /^[a-z0-9][a-z0-9-]{0,29}$/.test(g.id) ? g.id : grupKimligi(grupAdi);
      const yer = `${ad} ${i + 1}${grupAdi ? ` (${grupAdi})` : ""}`;
      if (!grupAdi) hatalar.push(`${yer}: ad boş olamaz.`);
      else if (grupAdi.length > LIMIT.ad) hatalar.push(`${yer}: ad en çok ${LIMIT.ad} karakter olabilir.`);
      if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(id)) hatalar.push(`${yer}: ad harf veya rakamla başlamalı.`);
      else if (gorulen.has(id)) hatalar.push(`${yer}: aynı adda iki grup var.`);
      gorulen.add(id);
      return { id, ad: grupAdi, kaliplar: kaliplar((g.kaliplar || []).map(normalizeTr).filter(Boolean), yer) };
    });
  }
  return { hatalar, temiz };
}

// Firestore belgelerini ekran verisine çevirir
export function gunlukDuzle(belgeler) {
  return belgeler.map((d) => ({ tarih: d.tarih, ...(d.searchConsole || {}) }))
    .filter((g) => typeof g.tarih === "string").sort((a, b) => a.tarih.localeCompare(b.tarih));
}
export function aylikDuzle(belgeler) {
  return belgeler.map((d) => ({ ay: d.ay, ...(d.searchConsole || {}) }))
    .filter((a) => typeof a.ay === "string").sort((a, b) => a.ay.localeCompare(b.ay));
}

// ───────────────────────── biçimlendirme ─────────────────────────
const sayi = (n) => (n == null ? "—" : Math.round(n).toLocaleString("tr-TR"));
const oran = (n) => (n == null ? "—" : "%" + (n * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 }));
const siraYaz = (n) => (n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
function degisimYaz(d, { tersYon = false } = {}) {
  if (d == null) return `<span class="gr-degisim">—</span>`;
  if (Math.abs(d) < 0.005) return `<span class="gr-degisim">değişmedi</span>`;
  const iyi = tersYon ? d < 0 : d > 0;
  const ok = d > 0 ? "▲" : "▼";
  return `<span class="gr-degisim ${iyi ? "iyi" : "kotu"}"><span aria-hidden="true">${ok}</span> %${Math.abs(d * 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>`;
}
function tarihSaatYaz(z) {
  if (!z) return "";
  const d = z.toDate ? z.toDate() : new Date(z);
  if (isNaN(d)) return "";
  return d.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
function gunYaz(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });
}
function sayfaYolu(url) {
  try { const u = new URL(url); return (u.pathname + u.hash) || "/"; } catch (_) { return url; }
}

// ───────────────────────── durum ─────────────────────────
let kokEl = null;
let V = null;           // { durum, gunler, aylar, ayar, yuklendi }
let sekme = "ozet";
let seciliAy = null;
let olcu = "tiklama";
let filtre = { grup: "hepsi", ara: "" };
let taslak = null;      // kelime grupları düzenleme taslağı
let ayarHazir = false;  // ayar belgesi sunucudan okunmadan kayıt yapılmaz

const email = () => (P().auth?.currentUser?.email || "");
export function yetkiliMi() { return YETKILI.includes(email().toLowerCase()); }
function toast(m, t) { try { P().toast(m, t); } catch (_) {} }
function lucide() { try { P().lucide(); } catch (_) {} }

async function yukle() {
  // Başarısız bir yenilemeden sonra eski okuma ve eski taslak üzerine kayıt yapılamasın.
  ayarHazir = false;
  taslak = null;
  const { fb, db } = P();
  const [durumSnap, gunSnap, aySnap, ayarSnap] = await Promise.all([
    fb.getDoc(fb.doc(db, KOL.durum, "searchConsole")),
    fb.getDocs(fb.query(fb.collection(db, KOL.gunluk), fb.orderBy("tarih", "desc"), fb.limit(500))),
    fb.getDocs(fb.query(fb.collection(db, KOL.aylik), fb.orderBy("ay", "desc"), fb.limit(14))),
    fb.getDoc(fb.doc(db, KOL.ayarlar, AYAR_BELGE)),
  ]);
  ayarHazir = !ayarSnap.metadata?.fromCache;
  V = {
    durum: durumSnap.exists() ? durumSnap.data() : null,
    gunler: gunlukDuzle(gunSnap.docs.map((d) => d.data())),
    aylar: aylikDuzle(aySnap.docs.map((d) => d.data())),
    ayar: ayarSnap.exists() ? ayarSnap.data() : null,
    yuklendi: Date.now(),
  };
  const aylar = V.aylar.map((a) => a.ay);
  if (!seciliAy || !aylar.includes(seciliAy)) seciliAy = varsayilanAy(V.aylar);
  taslak = null;
}

// Varsayılan ay: verisi olan son tam ay (içinde bulunulan ay eksiktir)
function varsayilanAy(aylar) {
  if (!aylar.length) return null;
  const buAy = new Date().toISOString().slice(0, 7);
  const tam = aylar.filter((a) => a.ay < buAy && (a.toplam?.gosterim || 0) > 0);
  return (tam.length ? tam[tam.length - 1] : aylar[aylar.length - 1]).ay;
}

// ───────────────────────── ana çizim ─────────────────────────
export async function panelRender(hedefId) {
  kokEl = document.getElementById(hedefId);
  if (!kokEl) return;
  stilEkle();
  if (!yetkiliMi()) {
    kokEl.innerHTML = `<div class="ws-kart ws-uyari"><h4>Bu bölüm kapalı</h4><p>Görünürlük raporlarını yalnızca ${YETKILI.map(esc).join(" ve ")} hesapları görebilir.</p></div>`;
    return;
  }
  if (V && Date.now() - V.yuklendi < YENILEME_MS) { ciz(); return; }
  kokEl.innerHTML = `<div class="loading"><div class="spinner"></div><p>Görünürlük raporu yükleniyor...</p></div>`;
  try {
    await yukle();
  } catch (e) {
    console.error("görünürlük yükle:", e);
    const izin = /permission|insufficient/i.test(String(e?.code || e?.message));
    kokEl.innerHTML = `<div class="ws-kart ws-uyari"><h4>Rapor yüklenemedi</h4><p>${izin
      ? "Firestore bu hesaba görünürlük raporlarını okuma izni vermedi. Görünürlük kurallarının yayınlanmış olması gerekir."
      : esc(e?.message || "Bilinmeyen hata")}</p><button type="button" class="ws-btn" onclick="window._gorunurluk.yenile()">Tekrar dene</button></div>`;
    return;
  }
  ciz();
}

function ciz() {
  if (!kokEl || !V) return;
  const sekmeler = SEKMELER.map((s) => `<button type="button" role="tab" aria-selected="${s.id === sekme}" class="gr-sekme${s.id === sekme ? " aktif" : ""}" onclick="window._gorunurluk.sekme('${s.id}')"><i data-lucide="${s.ikon}"></i>${esc(s.ad)}</button>`).join("");
  kokEl.innerHTML = `<div class="gr">
    ${durumSeridi()}
    <div class="gr-sekmeler" role="tablist" aria-label="Görünürlük bölümleri">${sekmeler}</div>
    <div class="gr-govde">${{ ozet: ozetHtml, kelimeler: kelimelerHtml, sayfalar: sayfalarHtml, gruplar: gruplarHtml }[sekme]()}</div>
  </div>`;
  lucide();
  if (sekme === "ozet") grafikBagla();
}

function durumSeridi() {
  const d = V.durum;
  const yenile = `<button type="button" class="ws-btn ws-btn-hafif" onclick="window._gorunurluk.yenile()"><i data-lucide="refresh-cw"></i> Yenile</button>`;
  if (!d) {
    return `<div class="ws-kart ws-uyari gr-durum"><div><h4>Rapor henüz oluşmadı</h4><p class="ws-ipucu">Gece görevi ilk kez çalıştığında burada Google arama verileri görünecek. Görev her gece 05:30'da çalışır.</p></div>${yenile}</div>`;
  }
  const hata = d.sonHata ? `<p class="gr-hata"><b>Son çalışmada hata:</b> ${esc(d.sonHata.mesaj || d.sonHata.kod)} (${esc(d.sonHata.tarih || "")})</p>` : "";
  if (d.backfillTamam !== true) {
    return `<div class="ws-kart ws-uyari gr-durum"><div><h4>Google verileri hazırlıyor</h4>
      <p class="ws-ipucu">bircicekkoleji.com alan adı Search Console'a yeni eklendiği için Google geçmiş arama verilerini birkaç gün içinde hazırlıyor. Gece görevi her gece yeniden deniyor; veri geldiği gece son 16 ay kendiliğinden dolacak. Bu sırada aşağıdaki sayılar sıfır görünebilir.</p>
      <p class="ws-ipucu">Son deneme: ${esc(tarihSaatYaz(d.guncellendi))}</p>${hata}</div>${yenile}</div>`;
  }
  return `<div class="ws-kart gr-durum"><div><p class="gr-durum-metin">Veriler <b>${esc(gunYaz(d.sonGun))}</b> tarihine kadar. Google arama verisi 2–3 gün geriden gelir; rapor her gece 05:30'da güncellenir.</p>
    <p class="ws-ipucu">Son güncelleme: ${esc(tarihSaatYaz(d.guncellendi))}</p>${hata}</div>${yenile}</div>`;
}

function aySecici() {
  const secenekler = [...V.aylar].reverse().map((a) => `<option value="${esc(a.ay)}"${a.ay === seciliAy ? " selected" : ""}>${esc(ayEtiketi(a.ay))}${a.ay === new Date().toISOString().slice(0, 7) ? " (devam ediyor)" : ""}</option>`).join("");
  return `<label class="gr-ay"><span>Ay</span><select onchange="window._gorunurluk.ay(this.value)">${secenekler}</select></label>`;
}
function ayVerisi(ay) { return V.aylar.find((a) => a.ay === ay) || null; }
function oncekiAyVerisi(ay) {
  const i = V.aylar.findIndex((a) => a.ay === ay);
  return i > 0 ? V.aylar[i - 1] : null;
}

// ───────────────────────── Özet ─────────────────────────
function ozetHtml() {
  if (!V.gunler.length && !V.aylar.length) return bosHtml();
  const sonGun = V.durum?.sonGun || V.gunler[V.gunler.length - 1]?.tarih;
  const pen = sonGun ? pencereOzeti(V.gunler, sonGun, 28) : null;
  const kart = (baslik, deger, d, aciklama, tersYon) => `<div class="gr-kpi"><span class="gr-kpi-ad">${baslik}</span><b>${deger}</b>${degisimYaz(d, { tersYon })}<small>${aciklama}</small></div>`;
  const kpi = pen ? `<section class="gr-kpiler" aria-label="Son 28 gün">
      ${kart("Tıklama", sayi(pen.simdi.tiklama), degisim(pen.simdi.tiklama, pen.once.tiklama), "Google'dan siteye gelen ziyaret")}
      ${kart("Gösterim", sayi(pen.simdi.gosterim), degisim(pen.simdi.gosterim, pen.once.gosterim), "Arama sonuçlarında görünme")}
      ${kart("Tıklama oranı", oran(pen.simdi.ctr), degisim(pen.simdi.ctr, pen.once.ctr), "Gösterimlerin tıklanan payı")}
      ${kart("Ortalama sıra", siraYaz(pen.simdi.sira), degisim(pen.simdi.sira, pen.once.sira), "Küçük sayı daha üstte demek", true)}
    </section><p class="ws-ipucu gr-kpi-not">Son 28 gün (${esc(gunYaz(gunEkle(sonGun, -27)))} – ${esc(gunYaz(sonGun))}); oklar önceki 28 güne göre değişimi gösterir.</p>` : "";
  const a = ayVerisi(seciliAy);
  const o = oncekiAyVerisi(seciliAy);
  return `${kpi}
    ${grafikHtml(sonGun)}
    <div class="gr-filtre-satiri">${aySecici()}<span class="ws-ipucu">Aşağıdaki tablolar seçili ayın verisidir; değişim bir önceki aya göredir.</span></div>
    ${a ? `${grupTablosu("Semtler", "Aramada semt adı geçen sorgular. Bir sorgu birden fazla semte sayılabilir.", a, o, "bolgeler", "bolge")}
    ${markaKarti(a, o)}
    ${grupTablosu("Konular", "Program ve okul türüyle ilgili aramalar.", a, o, "konular", "konu")}
    ${grupTablosu("Niyetler", "Velinin karar aşamasını gösteren kelimeler (ücret, kayıt, konum…).", a, o, "niyetler", "niyet")}
    ${cihazKarti(a)}` : bosHtml()}`;
}

function bosHtml() {
  return `<div class="ws-kart"><p class="ws-not">Henüz gösterilecek arama verisi yok. Google verileri hazırladıktan sonraki ilk gece burası dolacak.</p></div>`;
}

function grupTablosu(baslik, aciklama, a, o, anahtar, filtreTuru) {
  const etiketler = a.etiketler?.[anahtar] || Object.keys(a[anahtar] || {}).map((id) => ({ id, ad: id }));
  if (!etiketler.length) return "";
  const enCok = Math.max(1, ...etiketler.map((e) => a[anahtar]?.[e.id]?.gosterim || 0));
  const satirlar = etiketler.map((e) => {
    const m = a[anahtar]?.[e.id] || {};
    const om = o?.[anahtar]?.[e.id];
    const pay = Math.round(((m.gosterim || 0) / enCok) * 100);
    return `<tr>
      <th scope="row"><button type="button" class="ws-link" onclick="window._gorunurluk.kelimeleriAc('${kimlikSuz(`${filtreTuru}:${e.id}`)}')" title="Bu grubun kelimelerini göster">${esc(e.ad)}</button></th>
      <td class="gr-sayi"><span class="gr-cubuk" style="--pay:${pay}%" aria-hidden="true"></span>${sayi(m.gosterim)}</td>
      <td class="gr-sayi">${sayi(m.tiklama)}</td>
      <td class="gr-sayi">${oran(m.ctr)}</td>
      <td class="gr-sayi">${siraYaz(m.sira)}</td>
      <td class="gr-sayi">${o ? degisimYaz(degisim(m.gosterim, om?.gosterim ?? 0)) : "—"}</td>
    </tr>`;
  }).join("");
  const disi = anahtar === "bolgeler" && a.bolgeDisi ? `<tr class="gr-soluk"><th scope="row">Semt belirtilmeyen</th><td class="gr-sayi">${sayi(a.bolgeDisi.gosterim)}</td><td class="gr-sayi">${sayi(a.bolgeDisi.tiklama)}</td><td class="gr-sayi">${oran(a.bolgeDisi.ctr)}</td><td class="gr-sayi">${siraYaz(a.bolgeDisi.sira)}</td><td class="gr-sayi">${o ? degisimYaz(degisim(a.bolgeDisi.gosterim, o.bolgeDisi?.gosterim ?? 0)) : "—"}</td></tr>` : "";
  return `<section class="ws-kart"><h4>${esc(baslik)}</h4><p class="ws-ipucu">${esc(aciklama)}</p>
    <div class="gr-tablo-kap"><table class="gr-tablo"><thead><tr><th scope="col">${esc(baslik.replace(/lar$|ler$/, ""))}</th><th scope="col" class="gr-sayi">Gösterim</th><th scope="col" class="gr-sayi">Tıklama</th><th scope="col" class="gr-sayi">Oran</th><th scope="col" class="gr-sayi">Ort. sıra</th><th scope="col" class="gr-sayi">Gösterim değişimi</th></tr></thead>
    <tbody>${satirlar}${disi}</tbody></table></div></section>`;
}

function markaKarti(a, o) {
  const m = a.marka || {}, d = a.markaDisi || {};
  const toplam = (m.gosterim || 0) + (d.gosterim || 0);
  const pay = toplam ? Math.round(((d.gosterim || 0) / toplam) * 100) : 0;
  const satir = (ad, v, ov, aciklama) => `<tr><th scope="row">${ad}<small>${aciklama}</small></th><td class="gr-sayi">${sayi(v.gosterim)}</td><td class="gr-sayi">${sayi(v.tiklama)}</td><td class="gr-sayi">${oran(v.ctr)}</td><td class="gr-sayi">${siraYaz(v.sira)}</td><td class="gr-sayi">${o ? degisimYaz(degisim(v.gosterim, ov?.gosterim ?? 0)) : "—"}</td></tr>`;
  return `<section class="ws-kart"><h4>Okul adıyla ve okul adı olmadan</h4>
    <p class="ws-ipucu">Okulu adıyla arayanlar bizi zaten tanıyor. Asıl görünürlük, okul adını yazmadan arayıp bizi bulan velilerdir: bu ay gösterimlerin <b>%${pay}</b>'i okul adı geçmeyen aramalardan.</p>
    <div class="gr-tablo-kap"><table class="gr-tablo"><thead><tr><th scope="col">Arama türü</th><th scope="col" class="gr-sayi">Gösterim</th><th scope="col" class="gr-sayi">Tıklama</th><th scope="col" class="gr-sayi">Oran</th><th scope="col" class="gr-sayi">Ort. sıra</th><th scope="col" class="gr-sayi">Gösterim değişimi</th></tr></thead>
    <tbody>${satir("Okul adıyla", m, o?.marka, "“bir çiçek koleji” gibi")}${satir("Okul adı olmadan", d, o?.markaDisi, "“tuzla anaokulu” gibi")}</tbody></table></div></section>`;
}

function cihazKarti(a) {
  const c = a.cihazlar || {};
  const ad = { mobile: "Telefon", desktop: "Bilgisayar", tablet: "Tablet" };
  const toplam = Object.values(c).reduce((s, v) => s + (v.gosterim || 0), 0);
  if (!toplam) return "";
  const satirlar = ["mobile", "desktop", "tablet"].filter((k) => c[k]).map((k) => {
    const pay = c[k].gosterim / toplam;
    return `<tr><th scope="row">${ad[k]}</th><td class="gr-sayi"><span class="gr-cubuk" style="--pay:${Math.round(pay * 100)}%" aria-hidden="true"></span>${oran(pay)}</td><td class="gr-sayi">${sayi(c[k].gosterim)}</td><td class="gr-sayi">${sayi(c[k].tiklama)}</td><td class="gr-sayi">${siraYaz(c[k].sira)}</td></tr>`;
  }).join("");
  return `<section class="ws-kart"><h4>Cihazlar</h4><p class="ws-ipucu">Velilerin hangi cihazla aradığı. Telefon payı yüksekse sayfaların telefonda hızlı ve okunaklı olması önceliklidir.</p>
    <div class="gr-tablo-kap"><table class="gr-tablo"><thead><tr><th scope="col">Cihaz</th><th scope="col" class="gr-sayi">Gösterim payı</th><th scope="col" class="gr-sayi">Gösterim</th><th scope="col" class="gr-sayi">Tıklama</th><th scope="col" class="gr-sayi">Ort. sıra</th></tr></thead><tbody>${satirlar}</tbody></table></div></section>`;
}

// ───────────────────────── haftalık grafik (SVG) ─────────────────────────
let seriOnbellek = [];
function grafikHtml(sonGun) {
  if (!sonGun || !V.gunler.length) return "";
  const seri = haftalikSeri(V.gunler, sonGun, 52);
  seriOnbellek = seri;
  const gecenVar = seri.some((s) => s.gecenYil);
  const gecenKismi = gecenVar && seri.some((s) => s.veriVar && !s.gecenYil);
  const olcuAd = olcu === "tiklama" ? "Tıklama" : "Gösterim";
  const secim = ["tiklama", "gosterim"].map((k) => `<button type="button" class="${k === olcu ? "secili" : ""}" aria-pressed="${k === olcu}" onclick="window._gorunurluk.olcu('${k}')">${k === "tiklama" ? "Tıklama" : "Gösterim"}</button>`).join("");
  const lejant = `<span class="gr-lejant"><span><i style="background:${RENK.buYil}"></i>Son 12 ay</span>${gecenVar ? `<span><i class="kesik" style="--renk:${RENK.gecenYil}"></i>Bir önceki yılın aynı haftası</span>` : ""}</span>`;
  const tablo = seri.filter((s) => s.veriVar).map((s) => `<tr><th scope="row">${esc(gunYaz(s.hafta))}</th><td class="gr-sayi">${sayi(s[olcu])}</td><td class="gr-sayi">${s.gecenYil ? sayi(s.gecenYil[olcu]) : "—"}</td></tr>`).join("");
  return `<section class="ws-kart"><div class="ws-kart-ust"><h4>Haftalık ${olcuAd.toLocaleLowerCase("tr-TR")}</h4><div class="ws-secenekler dugme" role="group" aria-label="Ölçü">${secim}</div></div>
    ${lejant}
    ${gecenKismi ? `<p class="ws-ipucu gr-kismi">Google arama verisini 16 ay saklar. Bu yüzden bir önceki yılın çizgisi şimdilik yalnız son haftalarda görünür; gece görevi veriyi her gece biriktirdikçe karşılaştırma tamamlanacak.</p>` : ""}
    <div class="gr-grafik" id="grGrafik"><div id="grSvg" class="gr-svg"></div><div class="gr-ipucu" id="grIpucu" role="status" aria-live="polite" hidden></div></div>
    <details class="gr-tablo-ac"><summary>Tablo olarak göster</summary><div class="gr-tablo-kap"><table class="gr-tablo"><thead><tr><th scope="col">Hafta başı</th><th scope="col" class="gr-sayi">${olcuAd}</th><th scope="col" class="gr-sayi">Bir yıl önce</th></tr></thead><tbody>${tablo}</tbody></table></div></details>
  </section>`;
}

const G = { boy: 230, sol: 46, sag: 12, ust: 12, alt: 28 };
// Eksen: 1-2-5 dizisinden tam sayı adım, en çok 5 çizgi (0, 10, 20… gibi okunur değerler)
export function eksenAdimi(enBuyuk) {
  if (!(enBuyuk > 0)) return { adim: 1, ust: 4 };
  const ham = enBuyuk / 5;
  const us = Math.pow(10, Math.floor(Math.log10(ham)));
  const k = ham / us;
  const adim = Math.max(1, (k <= 1 ? 1 : k <= 2 ? 2 : k <= 5 ? 5 : 10) * us);
  return { adim, ust: Math.ceil(enBuyuk / adim) * adim };
}
// Grafik kutunun gerçek piksel genişliğinde çizilir (viewBox = piksel); yazılar çarpılmaz.
export function grafikOlcek(seri, en, olcuAdi = "tiklama") {
  const { adim, ust: enCok } = eksenAdimi(Math.max(0, ...seri.map((s) => s[olcuAdi] || 0), ...seri.map((s) => (s.gecenYil ? s.gecenYil[olcuAdi] : 0))));
  const genislik = Math.max(1, en - G.sol - G.sag);
  return {
    enCok, adim,
    x: (i) => G.sol + (i / Math.max(1, seri.length - 1)) * genislik,
    y: (v) => G.ust + (1 - v / enCok) * (G.boy - G.ust - G.alt),
    indeks: (px) => Math.min(seri.length - 1, Math.max(0, Math.round(((px - G.sol) / genislik) * (seri.length - 1)))),
  };
}
export function grafikSvg(seri, en, olcuAdi = "tiklama") {
  const { enCok, adim, x, y } = grafikOlcek(seri, en, olcuAdi);
  const deger = (s) => s[olcuAdi];
  const gecen = (s) => (s.gecenYil ? s.gecenYil[olcuAdi] : null);
  const degerler = [];
  for (let v = 0; v <= enCok; v += adim) degerler.push(v);
  const izgara = degerler.map((v) => {
    return `<line x1="${G.sol}" x2="${en - G.sag}" y1="${y(v)}" y2="${y(v)}" class="gr-izgara"/><text x="${G.sol - 6}" y="${y(v) + 4}" text-anchor="end" class="gr-eksen">${sayi(v)}</text>`;
  }).join("");
  const aylar = seri.map((s, i) => ({ s, i })).filter(({ s, i }) => i === 0 || s.hafta.slice(5, 7) !== seri[i - 1].hafta.slice(5, 7));
  const etiketAdimi = Math.max(1, Math.ceil(aylar.length / Math.max(2, Math.floor((en - G.sol) / 56))));
  const etiket = aylar.filter((_, k) => k % etiketAdimi === 0).map(({ s, i }) => {
    const [yy, mm] = s.hafta.split("-").map(Number);
    const ad = new Date(Date.UTC(yy, mm - 1, 1)).toLocaleDateString("tr-TR", { month: "short", timeZone: "UTC" });
    return `<text x="${x(i)}" y="${G.boy - 8}" text-anchor="middle" class="gr-eksen">${esc(ad)}</text>`;
  }).join("");
  const yol = (al) => {
    let d = "", acik = false;
    seri.forEach((s, i) => {
      const v = al(s);
      if (v == null) { acik = false; return; }
      d += `${acik ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      acik = true;
    });
    return d;
  };
  const gecenYol = seri.some((s) => s.gecenYil) ? `<path d="${yol(gecen)}" fill="none" stroke="${RENK.gecenYil}" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>` : "";
  const buYol = `<path d="${yol((s) => (s.veriVar ? deger(s) : null))}" fill="none" stroke="${RENK.buYil}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  return `<svg width="${en}" height="${G.boy}" viewBox="0 0 ${en} ${G.boy}" role="img" aria-label="Son 52 haftanın haftalık ${olcuAdi === "tiklama" ? "tıklama" : "gösterim"} grafiği">
    ${izgara}${etiket}${gecenYol}${buYol}
    <line id="grCizgi" x1="0" x2="0" y1="${G.ust}" y2="${G.boy - G.alt}" class="gr-crosshair" visibility="hidden"/>
    <circle id="grNokta" r="4.5" fill="${RENK.buYil}" stroke="#fff" stroke-width="2" visibility="hidden"/>
    <rect id="grAlan" x="${G.sol}" y="${G.ust}" width="${Math.max(1, en - G.sol - G.sag)}" height="${G.boy - G.ust - G.alt}" fill="transparent" tabindex="0" aria-label="Haftaları gezmek için sağ ve sol ok tuşlarını kullanın"/>
  </svg>`;
}

let grafikGozlemci = null;
function grafikBagla() {
  const kap = document.getElementById("grGrafik");
  const yer = document.getElementById("grSvg");
  if (!kap || !yer || !seriOnbellek.length) return;
  let en = 0, secili = -1, olcek = null;
  const ciz_ = () => {
    const yeniEn = Math.max(280, Math.round(kap.clientWidth || 720));
    if (yeniEn === en) return;
    en = yeniEn;
    yer.innerHTML = grafikSvg(seriOnbellek, en, olcu);
    olcek = grafikOlcek(seriOnbellek, en, olcu);
    bagla();
  };
  const goster = (i) => {
    if (!olcek || i < 0 || i >= seriOnbellek.length) return;
    secili = i;
    const s = seriOnbellek[i];
    const xv = olcek.x(i), yv = olcek.y(s[olcu] || 0);
    const cizgi = document.getElementById("grCizgi"), nokta = document.getElementById("grNokta");
    cizgi.setAttribute("x1", xv); cizgi.setAttribute("x2", xv); cizgi.setAttribute("visibility", "visible");
    nokta.setAttribute("cx", xv); nokta.setAttribute("cy", yv); nokta.setAttribute("visibility", s.veriVar ? "visible" : "hidden");
    const ipucu = document.getElementById("grIpucu");
    const olcuAd = olcu === "tiklama" ? "tıklama" : "gösterim";
    ipucu.replaceChildren();
    const baslik = document.createElement("small");
    baslik.textContent = `${gunYaz(s.hafta)} haftası`;
    const satir = (renk, deger, ad, kesik) => {
      const p = document.createElement("div");
      const anahtar = document.createElement("i");
      if (kesik) anahtar.className = "kesik";
      anahtar.style.setProperty("--renk", renk);
      if (!kesik) anahtar.style.background = renk;
      const b = document.createElement("b"); b.textContent = deger;
      const sp = document.createElement("span"); sp.textContent = ad;
      p.append(anahtar, b, sp);
      return p;
    };
    ipucu.append(baslik, satir(RENK.buYil, s.veriVar ? sayi(s[olcu]) : "veri yok", ` ${olcuAd}`));
    if (s.gecenYil) ipucu.append(satir(RENK.gecenYil, sayi(s.gecenYil[olcu]), " bir yıl önce", true));
    ipucu.hidden = false;
    ipucu.style.left = Math.min(Math.max(xv - 75, 0), Math.max(0, en - 160)) + "px";
    ipucu.style.top = Math.max(0, yv - 78) + "px";
  };
  const gizle = () => {
    document.getElementById("grCizgi")?.setAttribute("visibility", "hidden");
    document.getElementById("grNokta")?.setAttribute("visibility", "hidden");
    const ipucu = document.getElementById("grIpucu"); if (ipucu) ipucu.hidden = true;
  };
  const enYakin = (ev) => {
    const kutu = yer.firstElementChild.getBoundingClientRect();
    return olcek.indeks(ev.clientX - kutu.left);
  };
  function bagla() {
    const alan = document.getElementById("grAlan");
    if (!alan) return;
    alan.addEventListener("pointermove", (ev) => goster(enYakin(ev)));
    alan.addEventListener("pointerdown", (ev) => goster(enYakin(ev)));
    alan.addEventListener("pointerleave", gizle);
    alan.addEventListener("blur", gizle);
    alan.addEventListener("focus", () => goster(secili >= 0 ? secili : seriOnbellek.length - 1));
    alan.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft") { ev.preventDefault(); goster(Math.max(0, secili - 1)); }
      if (ev.key === "ArrowRight") { ev.preventDefault(); goster(Math.min(seriOnbellek.length - 1, secili + 1)); }
    });
  }
  ciz_();
  try { grafikGozlemci?.disconnect(); } catch (_) {}
  if (typeof ResizeObserver !== "undefined") {
    grafikGozlemci = new ResizeObserver(() => { gizle(); ciz_(); });
    grafikGozlemci.observe(kap);
  }
}

// ───────────────────────── Kelimeler ─────────────────────────
function kelimelerHtml() {
  const a = ayVerisi(seciliAy);
  if (!a) return bosHtml();
  const tumu = sorgulariKarsilastir(a, oncekiAyVerisi(seciliAy));
  const liste = sorgulariSuz(tumu, filtre);
  const etiketAd = (tur, id) => {
    const anahtar = { bolge: "bolgeler", konu: "konular", niyet: "niyetler" }[tur];
    return (a.etiketler?.[anahtar] || []).find((e) => e.id === id)?.ad || id;
  };
  const cip = (deger, ad) => `<button type="button" class="${filtre.grup === deger ? "secili" : ""}" aria-pressed="${filtre.grup === deger}" onclick="window._gorunurluk.grup('${kimlikSuz(deger)}')">${esc(ad)}</button>`;
  const cipler = [cip("hepsi", "Hepsi"), cip("marka", "Okul adıyla"), cip("markaDisi", "Okul adı olmadan"),
    ...(a.etiketler?.bolgeler || []).map((e) => cip(`bolge:${e.id}`, e.ad)),
    ...(a.etiketler?.konular || []).map((e) => cip(`konu:${e.id}`, e.ad)),
    ...(a.etiketler?.niyetler || []).map((e) => cip(`niyet:${e.id}`, e.ad))].join("");
  const satirlar = liste.map((q) => {
    const etiketler = [...(q.bolge || []).map((id) => etiketAd("bolge", id)), ...(q.konu || []).map((id) => etiketAd("konu", id)), ...(q.niyet || []).map((id) => etiketAd("niyet", id))];
    return `<tr><th scope="row" class="gr-sorgu">${esc(q.sorgu)}${q.marka ? '<em class="gr-etiket marka">okul adı</em>' : ""}${etiketler.map((e) => `<em class="gr-etiket">${esc(e)}</em>`).join("")}</th>
      <td class="gr-sayi">${sayi(q.gosterim)}</td><td class="gr-sayi">${sayi(q.tiklama)}</td><td class="gr-sayi">${oran(q.ctr)}</td><td class="gr-sayi">${siraYaz(q.sira)}</td>
      <td class="gr-sayi">${q.yeni ? '<span class="gr-degisim iyi">yeni</span>' : degisimYaz(q.gosterimDegisim)}</td></tr>`;
  }).join("");
  const gizli = a.kapsam?.gizliSorguGosterimi || 0;
  return `<div class="gr-filtre-satiri">${aySecici()}<label class="gr-ara"><span>Kelime ara</span><input type="search" value="${esc(filtre.ara)}" placeholder="ör. tuzla" oninput="window._gorunurluk.ara(this.value)"></label></div>
    <div class="ws-secenekler dugme gr-cipler" role="group" aria-label="Kelime grubu">${cipler}</div>
    <section class="ws-kart"><h4>${esc(ayEtiketi(seciliAy))} — en çok görünen ${sayi(tumu.length)} kelime <small>${sayi(liste.length)} gösteriliyor</small></h4>
      <p class="ws-ipucu">Gösterime göre sıralı. Google nadir aramaları gizlilik için listelemez${gizli ? `; bu ay toplam gösterimin ${sayi(gizli)} kadarı bu gizli aramalardan` : ""}. Değişim bir önceki aya göredir.</p>
      ${liste.length ? `<div class="gr-tablo-kap"><table class="gr-tablo"><thead><tr><th scope="col">Kelime</th><th scope="col" class="gr-sayi">Gösterim</th><th scope="col" class="gr-sayi">Tıklama</th><th scope="col" class="gr-sayi">Oran</th><th scope="col" class="gr-sayi">Ort. sıra</th><th scope="col" class="gr-sayi">Değişim</th></tr></thead><tbody>${satirlar}</tbody></table></div>` : `<p class="ws-not">Bu filtreyle eşleşen kelime yok.</p>`}
    </section>`;
}

// ───────────────────────── Sayfalar ─────────────────────────
function sayfalarHtml() {
  const a = ayVerisi(seciliAy);
  if (!a) return bosHtml();
  const satirlar = (a.ilkSayfalar || []).map((s) => {
    const guvenli = /^https:\/\//.test(s.sayfa || "");
    const yol = sayfaYolu(s.sayfa);
    return `<tr><th scope="row" class="gr-sorgu">${guvenli ? `<a href="${esc(s.sayfa)}" target="_blank" rel="noopener">${esc(yol)}</a>` : esc(yol)}</th>
      <td class="gr-sayi">${sayi(s.gosterim)}</td><td class="gr-sayi">${sayi(s.tiklama)}</td><td class="gr-sayi">${oran(s.ctr)}</td><td class="gr-sayi">${siraYaz(s.sira)}</td></tr>`;
  }).join("");
  return `<div class="gr-filtre-satiri">${aySecici()}</div>
    <section class="ws-kart"><h4>${esc(ayEtiketi(seciliAy))} — Google'da en çok görünen sayfalar</h4>
      <p class="ws-ipucu">Tıklamaya göre sıralı, en çok 50 sayfa. Gösterimi yüksek ama oranı düşük sayfaların başlık ve açıklaması aranan kelimeye göre yeniden yazılabilir.</p>
      ${satirlar ? `<div class="gr-tablo-kap"><table class="gr-tablo"><thead><tr><th scope="col">Sayfa</th><th scope="col" class="gr-sayi">Gösterim</th><th scope="col" class="gr-sayi">Tıklama</th><th scope="col" class="gr-sayi">Oran</th><th scope="col" class="gr-sayi">Ort. sıra</th></tr></thead><tbody>${satirlar}</tbody></table></div>` : `<p class="ws-not">Bu ay için sayfa verisi yok.</p>`}
    </section>`;
}

// ───────────────────────── Kelime grupları (ayar) ─────────────────────────
function taslakHazirla() {
  if (taslak) return taslak;
  const kaynak = V.ayar || VARSAYILAN_GRUPLAR;
  // Kayıtlı grupların kimliği sabit kalır; ad değişse de geçmiş aylarla bağı kopmaz.
  const kopya = (liste, yedek) => (Array.isArray(liste) && liste.length ? liste : yedek).map((g) => ({ id: g.id, ad: g.ad, kaliplar: [...(g.kaliplar || [])], idSabit: true }));
  taslak = {
    marka: [...(Array.isArray(kaynak.marka) && kaynak.marka.length ? kaynak.marka : VARSAYILAN_GRUPLAR.marka)],
    bolgeler: kopya(kaynak.bolgeler, VARSAYILAN_GRUPLAR.bolgeler),
    konular: kopya(kaynak.konular, VARSAYILAN_GRUPLAR.konular),
    niyetler: kopya(kaynak.niyetler, VARSAYILAN_GRUPLAR.niyetler),
  };
  return taslak;
}

function gruplarHtml() {
  const t = taslakHazirla();
  const { hatalar } = grupAyariniDogrula(t);
  const kim = V.ayar?.guncelleyen ? ` · ${esc(V.ayar.guncelleyen)}` : "";
  const bilgi = V.ayar ? `Son kayıt: ${esc(tarihSaatYaz(V.ayar.guncellendi))}${kim}` : "Henüz kaydedilmedi; gece görevi varsayılan grupları kullanıyor.";
  const liste = ({ anahtar, ad, tekil, ornek }) => `<section class="ws-kart"><div class="ws-kart-ust"><h4>${esc(ad)} <small>${t[anahtar].length}/${LIMIT.grup}</small></h4>
      <button type="button" class="ws-btn ws-btn-ikincil" onclick="window._gorunurluk.grupEkle('${anahtar}')" ${t[anahtar].length >= LIMIT.grup ? "disabled" : ""}><i data-lucide="plus"></i> ${esc(tekil[0].toLocaleUpperCase("tr-TR") + tekil.slice(1))} ekle</button></div>
      <div class="gr-gruplar">${t[anahtar].map((g, i) => `<div class="gr-grup">
        <div class="ws-alan"><label for="gr-${anahtar}-${i}-ad">Ad</label><input type="text" id="gr-${anahtar}-${i}-ad" maxlength="${LIMIT.ad}" value="${esc(g.ad)}" placeholder="ör. ${esc(ornek)}" oninput="window._gorunurluk.grupAd('${anahtar}',${i},this.value)"></div>
        <div class="ws-alan"><label for="gr-${anahtar}-${i}-k">Aramada geçen kelimeler <span class="ws-ipucu">(virgülle ayırın)</span></label><input type="text" id="gr-${anahtar}-${i}-k" value="${esc(g.kaliplar.join(", "))}" placeholder="ör. ${esc(normalizeTr(ornek))}" onchange="window._gorunurluk.grupKalip('${anahtar}',${i},this.value)"></div>
        <button type="button" class="ws-ikon-btn" title="Grubu kaldır" aria-label="${esc(g.ad || "Grubu")} kaldır" onclick="window._gorunurluk.grupSil('${anahtar}',${i})"><i data-lucide="trash-2"></i></button>
      </div>`).join("")}</div></section>`;
  return `<section class="ws-kart"><h4>Kelime grupları nasıl çalışır?</h4>
      <p class="ws-ipucu">Gece görevi her aramayı burada yazan kelimelerle karşılaştırır. Kelimenin başında eşleşme yeterlidir: “tuzla” yazınca “tuzlada”, “Tuzla'daki” de sayılır. Büyük-küçük harf ve Türkçe harfler fark etmez. Değişiklikler bir sonraki gece işlenen aylara uygulanır; geçmiş ayların yeniden hesaplanması için gece görevinin baştan doldurulması gerekir.</p></section>
    <section class="ws-kart"><h4>Okul adı</h4><p class="ws-ipucu">Bu kelimelerden biri geçen aramalar “okul adıyla” sayılır.</p>
      <div class="ws-alan"><label for="gr-marka">Okul adı kalıpları <span class="ws-ipucu">(virgülle ayırın)</span></label><input type="text" id="gr-marka" value="${esc(t.marka.join(", "))}" onchange="window._gorunurluk.marka(this.value)"></div></section>
    ${GRUP_LISTELERI.map(liste).join("")}
    ${hatalar.length ? `<div class="ws-kart ws-uyari"><h4>Kaydetmeden önce düzeltin</h4><ul class="gr-hatalar">${hatalar.slice(0, 8).map((h) => `<li>${esc(h)}</li>`).join("")}</ul></div>` : ""}
    <div class="ws-kaydet"><span class="ws-kaydet-bilgi">${bilgi}</span><span class="ws-kaydet-dugmeler">
      <button type="button" class="ws-btn ws-btn-hafif" onclick="window._gorunurluk.varsayilan()">Varsayılanlara dön</button>
      <button type="button" class="ws-btn" onclick="window._gorunurluk.gruplariKaydet()" ${hatalar.length ? "disabled" : ""}>Grupları kaydet</button></span></div>`;
}

async function gruplariKaydet() {
  if (!yetkiliMi()) { toast("Kelime gruplarını yalnızca yetkili hesaplar değiştirebilir.", "error"); return false; }
  if (!V || !ayarHazir) { toast("Ayar sunucudan okunmadan kaydedilemez. Yenile'ye basıp tekrar deneyin.", "error"); return false; }
  const { hatalar, temiz } = grupAyariniDogrula(taslakHazirla());
  if (hatalar.length) { toast(hatalar[0], "error"); return false; }
  const { fb, db } = P();
  try {
    await fb.setDoc(fb.doc(db, KOL.ayarlar, AYAR_BELGE), { ...temiz, guncellendi: fb.serverTimestamp(), guncelleyen: email() });
    V.ayar = { ...temiz, guncellendi: new Date(), guncelleyen: email() };
    taslak = null;
    toast("✓ Kelime grupları kaydedildi. Bir sonraki gece işlenen aylara uygulanacak.");
    ciz();
    return true;
  } catch (e) {
    console.error("görünürlük grup kaydet:", e);
    toast("Kaydedilemedi: " + (e?.message || e), "error");
    return false;
  }
}

// ───────────────────────── olaylar ─────────────────────────
let araZamani = null;
function gruplariYenidenCiz() {
  const y = window.scrollY;
  ciz();
  window.scrollTo(0, y);
}
const OLAYLAR = {
  yenile: async () => { V = null; ayarHazir = false; taslak = null; await panelRender(kokEl?.id || "wsGorunurluk"); },
  sekme: (id) => { sekme = SEKMELER.some((s) => s.id === id) ? id : "ozet"; ciz(); },
  ay: (ay) => { seciliAy = ay; ciz(); },
  olcu: (k) => { olcu = k === "gosterim" ? "gosterim" : "tiklama"; ciz(); },
  grup: (g) => { filtre.grup = g; ciz(); },
  ara: (metin) => {
    filtre.ara = metin;
    clearTimeout(araZamani);
    araZamani = setTimeout(() => {
      const el = document.activeElement;
      const konum = el && el.selectionStart;
      ciz();
      const yeni = kokEl?.querySelector(".gr-ara input");
      if (yeni) { yeni.focus(); try { yeni.setSelectionRange(konum, konum); } catch (_) {} }
    }, 250);
  },
  kelimeleriAc: (g) => { filtre = { grup: g, ara: "" }; sekme = "kelimeler"; ciz(); },
  marka: (metin) => { taslakHazirla().marka = kaliplariAyristir(metin); gruplariYenidenCiz(); },
  grupAd: (anahtar, i, deger) => {
    const g = taslakHazirla()[anahtar][i];
    if (!g) return;
    g.ad = deger;
    if (!g.idSabit) g.id = grupKimligi(deger);
  },
  grupKalip: (anahtar, i, metin) => { const g = taslakHazirla()[anahtar][i]; if (g) { g.kaliplar = kaliplariAyristir(metin); gruplariYenidenCiz(); } },
  grupEkle: (anahtar) => { const l = taslakHazirla()[anahtar]; if (l.length < LIMIT.grup) { l.push({ id: "", ad: "", kaliplar: [] }); gruplariYenidenCiz(); } },
  grupSil: (anahtar, i) => { taslakHazirla()[anahtar].splice(i, 1); gruplariYenidenCiz(); },
  varsayilan: () => {
    const v = JSON.parse(JSON.stringify(VARSAYILAN_GRUPLAR));
    for (const { anahtar } of GRUP_LISTELERI) v[anahtar].forEach((g) => { g.idSabit = true; });
    taslak = v;
    gruplariYenidenCiz();
    toast("Varsayılan gruplar yüklendi. Kalıcı olması için kaydedin.");
  },
  gruplariKaydet,
};
if (typeof window !== "undefined") window._gorunurluk = OLAYLAR;

// ───────────────────────── stil ─────────────────────────
function stilEkle() {
  if (document.getElementById("gr-stil")) return;
  const st = document.createElement("style");
  st.id = "gr-stil";
  st.textContent = `
  .gr{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;min-width:0;contain:inline-size}
  .gr-durum{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
  .gr-durum>div{flex:1 1 320px;min-width:0}
  .gr-durum h4{margin-bottom:4px}
  .gr-durum-metin{margin:0}
  .gr-hata{margin:6px 0 0;color:var(--ws-kirmizi,#B42318);font-size:13px}
  .gr-sekmeler{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
  .gr-sekme{display:inline-flex;align-items:center;gap:7px;border:1.5px solid var(--ws-cizgi,#E2E8E0);background:#fff;border-radius:10px;padding:8px 13px;font:inherit;font-weight:700;color:var(--ws-yesil,#1E4A31);cursor:pointer;white-space:nowrap}
  .gr-sekme svg{width:16px;height:16px}
  .gr-sekme.aktif{background:var(--ws-yesil,#1E4A31);border-color:var(--ws-yesil,#1E4A31);color:#fff}
  .gr-sekme:focus-visible,.gr-grafik rect:focus-visible{outline:3px solid rgba(47,125,69,.35);outline-offset:2px}
  .gr-govde{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;min-width:0}
  .gr-kpiler{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
  @media (max-width:900px){.gr-kpiler{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .gr-kpi{background:#fff;border:1px solid var(--ws-cizgi,#E2E8E0);border-radius:14px;padding:12px 14px;display:grid;gap:2px;min-width:0}
  .gr-kpi-ad{font-size:12.5px;font-weight:700;color:var(--ws-soluk,#5B6B5F)}
  .gr-kpi b{font-size:24px;color:var(--ws-yesil,#1E4A31);font-variant-numeric:tabular-nums;line-height:1.2}
  .gr-kpi small{color:var(--ws-soluk,#5B6B5F);font-size:12px}
  .gr-kpi-not{margin-top:-6px}
  .gr-degisim{font-size:12.5px;font-weight:700;color:var(--ws-soluk,#5B6B5F);font-variant-numeric:tabular-nums;white-space:nowrap}
  .gr-degisim.iyi{color:#1F7A3A}
  .gr-degisim.kotu{color:var(--ws-kirmizi,#B42318)}
  .gr-lejant{display:flex;flex-wrap:wrap;gap:6px 16px;margin:6px 0 2px;font-size:12.5px;color:var(--ws-soluk,#5B6B5F)}
  .gr-lejant span,.gr-ipucu div{display:inline-flex;align-items:center;gap:6px}
  .gr-lejant i,.gr-ipucu i{display:inline-block;width:16px;height:2px;border-radius:2px}
  .gr-lejant i.kesik,.gr-ipucu i.kesik{background:repeating-linear-gradient(90deg,var(--renk) 0 5px,transparent 5px 9px)}
  .gr-grafik{position:relative;width:100%;max-width:100%}
  .gr-grafik{min-height:230px}
  .gr-svg svg{display:block;max-width:100%}
  .gr-izgara{stroke:#E6ECE5;stroke-width:1}
  .gr-eksen{font-size:11px;fill:#6B7A6F;font-variant-numeric:tabular-nums}
  .gr-crosshair{stroke:#9AA89D;stroke-width:1}
  .gr-ipucu{position:absolute;pointer-events:none;background:#fff;border:1px solid var(--ws-cizgi,#E2E8E0);border-radius:10px;padding:8px 10px;box-shadow:0 6px 18px rgba(23,36,27,.12);display:grid;gap:3px;min-width:140px;font-size:12.5px}
  .gr-ipucu small{color:var(--ws-soluk,#5B6B5F);font-weight:600}
  .gr-ipucu b{color:var(--ws-yazi,#17241B);font-variant-numeric:tabular-nums}
  .gr-ipucu span{color:var(--ws-soluk,#5B6B5F)}
  .gr-kismi{margin:2px 0 4px}
  .gr-tablo-ac{margin-top:8px}
  .gr-tablo-ac summary{cursor:pointer;font-weight:700;color:var(--ws-yaprak,#2F7D45);font-size:13px}
  .gr-filtre-satiri{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}
  .gr-ay,.gr-ara{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:13px}
  .gr-ay select,.gr-ara input{border:1.5px solid var(--ws-cizgi,#E2E8E0);border-radius:10px;padding:8px 10px;font:inherit;font-weight:600;background:#fff;min-height:40px;max-width:100%}
  .gr-ara input{width:min(260px,60vw)}
  .gr-cipler{gap:6px}
  .gr-tablo-kap{overflow-x:auto;margin-top:8px}
  .gr-tablo{width:100%;border-collapse:collapse;font-size:13.5px}
  .gr-tablo th,.gr-tablo td{padding:8px 10px;border-bottom:1px solid var(--ws-cizgi,#E2E8E0);text-align:left;vertical-align:middle}
  .gr-tablo thead th{font-size:12px;color:var(--ws-soluk,#5B6B5F);font-weight:700;white-space:nowrap}
  .gr-tablo tbody th{font-weight:600}
  .gr-tablo th .ws-link{text-align:left}
  .gr-tablo tbody th small{display:block;font-weight:500;color:var(--ws-soluk,#5B6B5F);font-size:12px}
  .gr-sayi{text-align:right!important;font-variant-numeric:tabular-nums;white-space:nowrap}
  .gr-cubuk{display:inline-block;width:64px;height:6px;margin-right:8px;border-radius:3px;background:linear-gradient(90deg,${RENK.buYil} var(--pay),#EEF2ED var(--pay));vertical-align:middle}
  @media (max-width:640px){.gr-cubuk{display:none}}
  .gr-soluk th,.gr-soluk td{color:var(--ws-soluk,#5B6B5F)}
  .gr-sorgu{min-width:180px}
  .gr-sorgu a{color:var(--ws-yaprak,#2F7D45);font-weight:700;word-break:break-all}
  .gr-etiket{display:inline-block;margin-left:6px;font-style:normal;font-size:11px;font-weight:700;color:var(--ws-yesil,#1E4A31);background:#EAF4EC;border-radius:99px;padding:1px 7px}
  .gr-etiket.marka{background:#F3EAFB;color:#5B2F86}
  .gr-gruplar{display:grid;gap:10px;margin-top:8px}
  .gr-grup{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,2fr) auto;gap:10px;align-items:end;padding:10px;border:1px solid var(--ws-cizgi,#E2E8E0);border-radius:12px;background:#FCFDFB}
  @media (max-width:640px){.gr-grup{grid-template-columns:1fr}.gr-grup .ws-ikon-btn{justify-self:end}}
  .gr-hatalar{margin:4px 0 0;padding-left:18px;color:var(--ws-kirmizi,#B42318);font-size:13px}
  `;
  document.head.appendChild(st);
}
