// ═══════════════════════════════════════════════════════════════════
// WEB SİTESİ YÖNETİMİ — moduller/web-sitesi.js
//
// bircicekkoleji.com içeriğini portaldan değiştirme:
//   Genel bilgiler · Duyuru şeridi · Ana sayfa slaytları · Program kutuları ·
//   Sık sorulan sorular · Veli Rehberi (yazı başlığı, özeti, metni, görseli) ·
//   Haftalık görseller (otomatik seçimi aç/kapa, kareyi kaldır, yüzleri düzelt) ·
//   Görseller (yükle, düzenle, kaldır)
//
// Veri:   Firestore webSitesi/{genel|duyuru|slaytlar|kutular|sss|medya|rehber}
//         webSitesi/haftalik     → sunucunun haftalık seçimi (panel yalnız kareyi gizler / düzeltir)
//         webSitesi/haftalikAyar → aç/kapa, alan başına görsel, kaldırılan kareler, yeniden seçim isteği
// Yetki:  yalnızca emrahby@gmail.com ve eposta@bircicekkoleji.com
//         (Firestore kuralı match /webSitesi/{belge} ile birebir)
// Yayın:  Sitenin sunucusu (Cloudflare) kaydedilen içeriği en geç 1 dakika içinde sayfalara uygular.
//         Panelde hiç kaydedilmemiş bölüm sitede olduğu gibi kalır.
// Varsayılanlar: <site>/site-varsayilan.json (sitenin bugünkü içeriği ve görsel listesi)
//                <site>/rehber-varsayilan.json (Veli Rehberi yazılarının sitedeki hâli)
// Veli Rehberi: webSitesi/rehber yalnız varsayılandan FARKLI alanları taşır; metin her kayıtta
//         izinli etiketlere (p h2 h3 ul ol li strong em b i a br blockquote) indirgenir.
//
// Kullanım: m.panelRender("webSitesiIcerik")
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;

export const YETKILI = ["emrahby@gmail.com", "eposta@bircicekkoleji.com"];
// Cloudflare Pages üzerinde yayındaki ana alan adı.
const SITE = "https://www.bircicekkoleji.com";
const BOLUMLER = [
  { id: "genel",    ad: "Genel bilgiler",      ikon: "contact",          aciklama: "Telefon, adres, saatler, bağlantılar" },
  { id: "duyuru",   ad: "Duyuru şeridi",       ikon: "megaphone",        aciklama: "Sitenin en üstündeki kısa duyuru" },
  { id: "slaytlar", ad: "Ana sayfa slaytları", ikon: "gallery-horizontal", aciklama: "Karşılama alanındaki 10 saniyelik slaytlar" },
  { id: "kutular",  ad: "Program kutuları",    ikon: "layout-grid",      aciklama: "Slaytların altındaki küçük kutular" },
  { id: "sss",      ad: "Sık sorulan sorular", ikon: "circle-help",      aciklama: "Soru ekle, düzenle, ana sayfada göster" },
  { id: "rehber",   ad: "Veli Rehberi",        ikon: "book-open-text",   aciklama: "Yazıların başlığı, özeti, metni ve görseli" },
  { id: "haftalik", ad: "Haftalık görseller",  ikon: "calendar-range",   aciklama: "Her pazartesi galeriden seçilen kareler" },
  { id: "medya",    ad: "Görseller",           ikon: "image",            aciklama: "Yükle, düzenle, kaldır" },
  { id: "yardim",   ad: "Nasıl çalışır?",      ikon: "book-open",        aciklama: "Kısa kullanım rehberi" },
];
const SAYFALAR = [
  ["/okulu-ziyaret", "Randevu sayfası"], ["/montessori", "Montessori"], ["/orman-okulu", "Orman okulu"],
  ["/degerler-egitimi", "Değerler eğitimi"], ["/atolyeler-ve-dersler", "Branş dersleri ve atölyeler"],
  ["/atolyeler-ve-dersler#ingilizce", "İngilizce bölümü"], ["/atolyeler-ve-dersler#piyano", "Piyano bölümü"],
  ["/atolyeler-ve-dersler#ahsap", "Ahşap atölyesi bölümü"], ["/atolyeler-ve-dersler#branslar", "Branş dersleri bölümü"],
  ["/programlar", "Programlar"], ["/kayit-ve-basvurular", "Kayıt ve başvurular"], ["/zeky", "ZEKY uygulaması"],
  ["/sss", "Sık sorulan sorular"], ["/veli-rehberi", "Veli rehberi"], ["/hakkimizda", "Hakkımızda"], ["/iletisim", "İletişim"],
];

let V = null;          // site varsayılanları
let D = {};            // ekranda düzenlenen veri (bölüm başına)
let K = {};            // son kaydedilen hâl (JSON metni) — değişiklik takibi için
let Z = {};            // Firestore'daki son güncelleme bilgisi { zaman, kim }
let aktif = "genel";
let acikSlayt = null;  // düzenleme formu açık olan slayt/kutu sırası
let acikKutu = null;
let kokEl = null;
let veriHazir = false; // Başarısız/çevrimdışı okumadan sonra kayıt yapılamaz.

// Veli Rehberi
let RV = null;         // rehber varsayılanları { kategoriler, yazilar, harita: {slug: yazı} } — alınamazsa null
let RVhata = "";       // varsayılanlar alınamadıysa nedeni
let RS = {};           // son kaydedilen yazı değişiklikleri (slug → alanlar + guncellendi)
let acikRehber = null; // düzenleme formu açık olan yazının slug'ı
let rbAra = "";        // yazı listesi araması

// Haftalık görseller (dirty-tracking dışında; her işlem tek küçük yazımdır)
let H = null;          // webSitesi/haftalik (sunucunun seçimi) — yoksa null
let HA = {};           // webSitesi/haftalikAyar
let hfMesgul = false;  // aynı anda iki haftalık işlem yapılmasın

// ───────────────────────── yardımcılar ─────────────────────────
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const kopya = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
const email = () => (P().auth?.currentUser?.email || "").toLowerCase();
export function yetkiliMi() { return YETKILI.includes(email()); }
function toast(m, t) { try { P().toast(m, t); } catch (_) {} }
function lucide() { try { P().lucide(); } catch (_) {} }
function yeniId(on) { return on + "-" + Math.random().toString(36).slice(2, 8); }
function gorselUrl(g, en = 640) {
  if (!g) return "";
  if (g.url) return g.url + (g.url.includes("?") ? "&" : "?") + "width=" + en;
  if (g.yerel) return `${SITE}/img/${encodeURIComponent(g.yerel)}-640.webp`;
  return "";
}
function tarihYaz(z) {
  if (!z) return "";
  const d = z.toDate ? z.toDate() : new Date(z);
  if (isNaN(d)) return "";
  return d.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
function rakam(t) { return String(t || "").replace(/\D/g, ""); }

// ───────────────────────── Veli Rehberi: metin temizleyici ─────────────────────────
// Tarayıcıdan bağımsız (testlerde de aynı kod çalışır). Çıktı yalnız izinli etiketleri taşır ve dengelidir.
// Öznitelikler: a[href], ol[start], p[class=muted|small], div[class=table-wrap] (sitenin mevcut yazılarında
// kullanılanlar; karşılaştırma tablosu bozulmasın). Bilinmeyen biçim etiketleri açılır (yazısı kalır),
// betik/stil gibi etiketler içerikleriyle silinir.
const RB_ETIKET = new Set(["p", "h2", "h3", "ul", "ol", "li", "strong", "em", "b", "i", "a", "br", "blockquote",
  "div", "table", "thead", "tbody", "tr", "th", "td"]);
const RB_BLOK = new Set(["p", "h2", "h3", "ul", "ol", "blockquote", "table"]);
const RB_PARAGRAF = new Set(["p", "h2", "h3"]);
const RB_SATIR_ICI = new Set(["strong", "em", "b", "i", "a"]);
const RB_P_SINIF = new Set(["muted", "small"]);
const RB_ESLE = { h1: "h2", h4: "h3", h5: "h3", h6: "h3", section: "p", article: "p", header: "p", footer: "p", aside: "p",
  main: "p", figcaption: "p", pre: "p", address: "p", center: "p", dd: "p", dt: "p", caption: "p", tfoot: "tbody" };
function ozDeger(ozellikler, ad) {
  const m = new RegExp(`(?:^|[\\s"'\\/])${ad}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\x60]+))`, "i").exec(ozellikler);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;     // ham değer; href'i guvenliHref çözer
}
const RB_ICERIKLE_SIL = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript", "svg", "math", "head",
  "title", "textarea", "select", "option", "button", "video", "audio", "canvas", "map", "frameset", "frame", "applet", "xmp", "plaintext", "noembed", "noframes"]);
export const RB_SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;
export const RB_SINIR = 900 * 1024;

function varlikCoz(s) {
  return String(s).replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Math.min(Number(d), 0x10ffff)))
    .replace(/&colon;/gi, ":").replace(/&tab;/gi, "\t").replace(/&newline;/gi, "\n")
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&");
}
// Bağlantı adresi: http(s), mailto, tel, site içi (/…) ve sayfa içi (#…). Diğerleri boş döner.
export function guvenliHref(deger) {
  const ham = varlikCoz(String(deger == null ? "" : deger)).trim();
  const sade = ham.replace(/[\u0000- \u007f-\u009f]/g, "");
  if (!sade) return "";
  if (/^(https?:|mailto:|tel:)/i.test(sade)) return /^https?:\/\/[^/\s]/i.test(sade) || /^(mailto|tel):./i.test(sade) ? ham : "";
  if (sade.startsWith("/") && !sade.startsWith("//") && !sade.startsWith("/\\")) return ham;
  if (sade.startsWith("#")) return ham;
  return "";
}
const ozEsc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function rehberTemizle(html) {
  const s = String(html == null ? "" : html);
  const out = [], yigin = [];
  const kapat = (n) => { out.push(`</${n}>`); };
  const ustuneKadarKapat = (sart) => {        // sart(eleman) doğru olana kadar (o dahil) kapatır
    const i = yigin.map(sart).lastIndexOf(true);
    if (i < 0) return false;
    while (yigin.length > i) kapat(yigin.pop());
    return true;
  };
  const satirIciKapat = () => { while (yigin.length && RB_SATIR_ICI.has(yigin[yigin.length - 1])) kapat(yigin.pop()); };
  const yaz = (t) => { if (t) out.push(t.replace(/</g, "&lt;").replace(/>/g, "&gt;")); };
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) { yaz(s.slice(i)); break; }
    yaz(s.slice(i, lt));
    if (s.startsWith("<!--", lt)) { const son = s.indexOf("-->", lt + 4); i = son < 0 ? s.length : son + 3; continue; }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/.exec(s.slice(lt, lt + 64));
    if (!m) {
      if (/^<[!?]/.test(s.slice(lt, lt + 2))) { const son = s.indexOf(">", lt); i = son < 0 ? s.length : son + 1; continue; }
      out.push("&lt;"); i = lt + 1; continue;
    }
    // etiketin sonunu tırnaklara dikkat ederek bul
    let j = lt + m[0].length, tirnak = "";
    while (j < s.length) {
      const c = s[j];
      if (tirnak) { if (c === tirnak) tirnak = ""; }
      else if (c === '"' || c === "'") tirnak = c;
      else if (c === ">") break;
      j++;
    }
    const kapanis = m[1] === "/";
    const ham = m[2].toLowerCase();
    const ozellikler = s.slice(lt + m[0].length, j);
    i = j + 1;
    if (!kapanis && RB_ICERIKLE_SIL.has(ham)) {      // içeriğiyle birlikte at
      if (/\/\s*$/.test(ozellikler) || ham === "embed" || ham === "frame") continue; // kendini kapatan / boş öğe
      const re = new RegExp(`</${ham}\\s*>`, "i");
      const kalan = s.slice(i), k = re.exec(kalan);
      i = k ? i + k.index + k[0].length : s.length;
      continue;
    }
    let ad = RB_ESLE[ham] || ham;
    if (!RB_ETIKET.has(ad)) continue;                 // bilinmeyen etiket: aç, yazısı kalsın
    if (kapanis) {
      if (ad === "br") continue;
      if (ad === "div") {                             // </div>: en yakın açık div ya da paragraf kapanır
        const d = yigin.lastIndexOf("div"), pp = yigin.lastIndexOf("p");
        if (d > pp) ustuneKadarKapat((e) => e === "div"); else if (pp >= 0) ustuneKadarKapat((e) => e === "p");
        continue;
      }
      if (yigin.includes(ad)) ustuneKadarKapat((e) => e === ad);
      continue;
    }
    if (ad === "br") { out.push("<br>"); continue; }
    const tablo = yigin.lastIndexOf("table");
    if (ad === "div") {
      if (!/(^|\s)table-wrap(\s|$)/.test(ozDeger(ozellikler, "class") || "")) ad = "p";   // sıradan div → paragraf
      else {
        ustuneKadarKapat((e) => RB_PARAGRAF.has(e)); satirIciKapat();
        out.push('<div class="table-wrap">'); yigin.push("div"); continue;
      }
    }
    if (ad === "thead" || ad === "tbody" || ad === "tr" || ad === "th" || ad === "td") {
      if (tablo < 0) {                                // tablosuz hücre/satır: satır paragrafa, hücre yazıya
        if (ad === "tr") { ustuneKadarKapat((e) => RB_PARAGRAF.has(e)); satirIciKapat(); out.push("<p>"); yigin.push("p"); }
        else if (ad === "th" || ad === "td") out.push(" ");
        continue;
      }
      const ebeveyn = ad === "thead" || ad === "tbody" ? ["table"] : ad === "tr" ? ["table", "thead", "tbody"] : ["tr"];
      let k = -1;
      for (let n = yigin.length - 1; n > tablo - 1; n--) if (ebeveyn.includes(yigin[n])) { k = n; break; }
      if (k < 0) {                                    // eksik satır: hücre için satır aç
        if (ad !== "th" && ad !== "td") continue;
        while (yigin.length > tablo + 1 && !["thead", "tbody"].includes(yigin[yigin.length - 1])) kapat(yigin.pop());
        out.push("<tr>"); yigin.push("tr"); k = yigin.length - 1;
      }
      while (yigin.length > k + 1) kapat(yigin.pop());
      out.push(`<${ad}>`); yigin.push(ad); continue;
    }
    if (RB_BLOK.has(ad)) {
      ustuneKadarKapat((e) => RB_PARAGRAF.has(e));    // açık paragraf/başlık bloğu kapanır
      satirIciKapat();
      let oz = "";
      if (ad === "ol") { const st = Number(ozDeger(ozellikler, "start")); if (Number.isInteger(st) && st > 1 && st < 1000) oz = ` start="${st}"`; }
      if (ad === "p") { const sn = (ozDeger(ozellikler, "class") || "").split(/\s+/).filter((c) => RB_P_SINIF.has(c)); if (sn.length) oz = ` class="${[...new Set(sn)].join(" ")}"`; }
      out.push(`<${ad}${oz}>`); yigin.push(ad); continue;
    }
    if (ad === "li") {
      const liste = yigin.map((e) => e === "ul" || e === "ol").lastIndexOf(true);
      if (liste < 0) {                                 // listesiz madde: paragraf olur
        ustuneKadarKapat((e) => RB_PARAGRAF.has(e)); satirIciKapat();
        out.push("<p>"); yigin.push("p"); continue;
      }
      while (yigin.length > liste + 1) kapat(yigin.pop()); // önceki maddeyi kapat
      out.push("<li>"); yigin.push("li"); continue;
    }
    if (ad === "a") {
      const href = guvenliHref(ozDeger(ozellikler, "href") || "");
      if (!href || yigin.includes("a")) continue;      // geçersiz ya da iç içe bağlantı: yalnız yazı kalır
      out.push(`<a href="${ozEsc(href)}">`); yigin.push("a"); continue;
    }
    out.push(`<${ad}>`); yigin.push(ad);                // strong em b i
  }
  while (yigin.length) kapat(yigin.pop());
  let sonuc = out.join("");
  // boş öğeleri at (<p><br></p> gibi düzenleyici artıkları)
  for (let n = 0; n < 6; n++) {
    const once = sonuc;
    sonuc = sonuc.replace(/<(p|h2|h3|strong|em|b|i|a|li|blockquote|ul|ol)(?:\s[^>]*)?>(?:\s|&nbsp;|<br>)*<\/\1>/g, "");
    if (sonuc === once) break;
  }
  return sonuc.trim();
}

// UTF-8 bayt sayısı (Firestore belge sınırı için)
export function utf8Boyut(s) {
  let n = 0;
  for (const ch of String(s)) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  return n;
}

function gorselSade(g) {
  if (!g || typeof g !== "object") return null;
  const alt = String(g.alt || "").trim().slice(0, 160);
  if (g.url && /^https:\/\//.test(g.url)) {
    const o = { url: String(g.url), alt };
    if (Number(g.en) > 0) o.en = Number(g.en);
    if (Number(g.boy) > 0) o.boy = Number(g.boy);
    return o;
  }
  if (g.yerel && /^[a-z0-9][a-z0-9-]*$/i.test(g.yerel)) return { yerel: String(g.yerel), alt };
  return null;
}

// Bir yazının değişikliğinden yalnız varsayılandan farklı alanları bırakır. v: varsayılan yazı (yoksa null).
export function rehberFark(o, v) {
  if (!o || typeof o !== "object") return null;
  const n = {};
  for (const k of ["baslik", "ozet"]) {
    if (typeof o[k] !== "string") continue;
    const t = o[k].replace(/\s+/g, " ").trim();
    if (!v || t !== String(v[k] || "").replace(/\s+/g, " ").trim()) n[k] = t;
  }
  if (typeof o.govde === "string") {
    const t = rehberTemizle(o.govde);
    if (!v || t !== (v._temizGovde ?? (v._temizGovde = rehberTemizle(v.govde)))) n.govde = t;
  }
  const g = gorselSade(o.gorsel);
  if (g && (!v || JSON.stringify(g) !== JSON.stringify(gorselSade(v.gorsel)))) n.gorsel = g;
  return Object.keys(n).length ? n : null;
}

// rehber-varsayilan.json → { kategoriler, yazilar, harita } (geçersiz yazılar atlanır)
export function rehberVarsayilanHazirla(veri) {
  if (!veri || !Array.isArray(veri.yazilar)) throw new Error("Veli Rehberi varsayılanları beklenen biçimde değil.");
  const yazilar = veri.yazilar.filter((y) => y && RB_SLUG.test(y.slug || "") && typeof y.baslik === "string")
    .map((y) => ({ slug: y.slug, kat: String(y.kat || ""), baslik: y.baslik, ozet: String(y.ozet || ""), govde: String(y.govde || ""),
      gorsel: gorselSade(y.gorsel), adres: /^\/veli-rehberi\/[a-z0-9-]+$/.test(y.adres || "") ? y.adres : `/veli-rehberi/${y.slug}` }));
  if (!yazilar.length) throw new Error("Veli Rehberi varsayılanlarında yazı yok.");
  const kategoriler = (Array.isArray(veri.kategoriler) ? veri.kategoriler : [])
    .filter((k) => k && typeof k.anahtar === "string").map((k) => ({ anahtar: k.anahtar, baslik: String(k.baslik || k.anahtar) }));
  for (const y of yazilar) if (!kategoriler.some((k) => k.anahtar === y.kat)) kategoriler.push({ anahtar: y.kat, baslik: y.kat || "Diğer" });
  return { kategoriler, yazilar, harita: Object.fromEntries(yazilar.map((y) => [y.slug, y])) };
}

// ───────────────────────── Haftalık görseller: sabitler ─────────────────────────
// Sözleşme: alan anahtarı → paneldeki ad → sitedeki sayfa
export const HAFTALIK_ALANLAR = [
  { anahtar: "montessori", ad: "Montessori",        sayfa: "/montessori" },
  { anahtar: "orman",      ad: "Orman okulu",       sayfa: "/orman-okulu" },
  { anahtar: "degerler",   ad: "Değerler eğitimi",  sayfa: "/degerler-egitimi" },
  { anahtar: "ingilizce",  ad: "İngilizce",         sayfa: "/atolyeler-ve-dersler" },
  { anahtar: "ahsap",      ad: "Ahşap atölyesi",    sayfa: "/atolyeler-ve-dersler" },
  { anahtar: "piyano",     ad: "Piyano",            sayfa: "/piyano" },
  { anahtar: "branslar",   ad: "Branş dersleri",    sayfa: "/brans-dersleri" },
];
export const HARIC_SINIR = 500;
// Kaldırılan kareyi listeye ekler; en yeniler sonda, en çok `sinir` kayıt.
export function haricEkle(liste, id, sinir = HARIC_SINIR) {
  const l = (Array.isArray(liste) ? liste : []).filter((x) => typeof x === "string" && x && x !== id);
  if (id) l.push(String(id));
  return l.slice(-sinir);
}
export function haricCikar(liste, id) { return (Array.isArray(liste) ? liste : []).filter((x) => x !== id); }
export function alanBasinaCoz(v) { const n = Math.round(Number(v)); return n >= 1 && n <= 4 ? n : 3; }
export function haftalikAcikMi(ayar) { return !ayar || ayar.acik !== false; }
// Sunucunun özet sayıları → düz Türkçe
export function haftalikOzetMetni(o) {
  if (!o || typeof o !== "object") return "";
  const s = (k) => Number(o[k]) > 0 ? Number(o[k]) : 0;
  const parca = [];
  if (s("aday")) parca.push(`${s("aday")} onaylı fotoğraf incelendi`);
  parca.push(`${s("secilen")} kare seçildi`);
  const atlanan = [];
  if (s("yazili")) atlanan.push(`${s("yazili")} yazılı görsel`);
  if (s("yuzFazla")) atlanan.push(`${s("yuzFazla")} kalabalık ya da yüzü çok yakın kare`);
  if (s("izin")) atlanan.push(`${s("izin")} fotoğraf izni nedeniyle kare`);
  return parca.join(", ") + (atlanan.length ? `; ${atlanan.join(", ")} atlandı.` : ".");
}
function zamanMs(z) {
  if (!z) return 0;
  if (typeof z.toMillis === "function") return z.toMillis();
  if (typeof z.toDate === "function") return z.toDate().getTime();
  const t = new Date(z).getTime();
  return isNaN(t) ? 0 : t;
}
function haftalikGorselUrl(o, en = 640) {
  if (!o) return "";
  if (o.url && /^https:\/\//.test(o.url)) return gorselUrl({ url: o.url }, en);
  const u = en > 640 ? (o.u1280 || o.u640) : (o.u640 || o.u1280);
  return /^https:\/\//.test(u || "") ? u : "";
}

// ───────────────────────── veri ─────────────────────────
async function varsayilanlariAl() {
  const r = await fetch(SITE + "/site-varsayilan.json", { cache: "no-store" });
  if (!r.ok) throw new Error("Sitenin varsayılan içeriği alınamadı (HTTP " + r.status + ")");
  return r.json();
}

// Veli Rehberi varsayılanları sitenin ayrı dosyasındadır. Alınamazsa (ör. site henüz bu sürümle
// yayınlanmadıysa) diğer bölümler çalışmaya devam eder; yalnız Veli Rehberi kaydedilemez.
async function rehberVarsayilanlariAl() {
  try {
    const r = await fetch(SITE + "/rehber-varsayilan.json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    RV = rehberVarsayilanHazirla(await r.json());
    RVhata = "";
  } catch (e) {
    RV = null;
    RVhata = e && e.message ? e.message : String(e);
  }
}

function bolumVarsayilani(id) {
  if (id === "medya") return { liste: [] };
  if (id === "rehber") return { yazilar: {} };
  return kopya(V?.[id] || {});
}

async function yukle() {
  veriHazir = false;
  const { fb, db } = P();
  const rvSozu = rehberVarsayilanlariAl();
  V = await varsayilanlariAl();
  await rvSozu;
  const belgeler = ["genel", "duyuru", "slaytlar", "kutular", "sss", "medya", "rehber"];
  const ekBelgeler = ["haftalik", "haftalikAyar"];
  // Hata, 'belge yok' anlamına gelmez. Eski önbellekle içerik ezilmesini de önle.
  const sonuc = await Promise.all([...belgeler, ...ekBelgeler].map((id) => fb.getDoc(fb.doc(db, "webSitesi", id))));
  if (sonuc.some((snap) => snap.metadata?.fromCache)) throw new Error("Sunucuya ulaşılamadı. Bağlantıyı kontrol edip tekrar yükleyin.");
  belgeler.forEach((id, i) => {
    const snap = sonuc[i];
    const veri = snap && snap.exists() ? snap.data() : null;
    let d = bolumVarsayilani(id);
    if (veri) {
      const { guncellendi, guncelleyen, ...icerik } = veri;
      Z[id] = { zaman: guncellendi, kim: guncelleyen };
      d = id === "genel" ? Object.assign(d, icerik) : Object.assign(d, icerik);
    } else {
      Z[id] = null;
    }
    if (id === "sss") d = sssHazirla(d);
    if (id === "rehber") {
      d = { yazilar: d.yazilar && typeof d.yazilar === "object" && !Array.isArray(d.yazilar) ? kopya(d.yazilar) : {} };
      RS = kopya(d.yazilar);
    }
    D[id] = d;
    K[id] = JSON.stringify(temizle(id, d));
  });
  const [hSnap, haSnap] = sonuc.slice(belgeler.length);
  H = hSnap && hSnap.exists() ? (hSnap.data() || {}) : null;
  HA = haSnap && haSnap.exists() ? (haSnap.data() || {}) : {};
  veriHazir = true;
}

// SSS: düzenleme için düz metin cevap; site, değişmeyen cevaplarda bağlantılı orijinali kullanır
function sssHazirla(d) {
  const vg = {};
  for (const g of V?.sss?.gruplar || []) for (const q of g.sorular || []) vg[q.id] = q;
  for (const g of d.gruplar || []) {
    g.sorular = (g.sorular || []).map((q) => {
      const v = vg[q.id];
      return { id: q.id || yeniId("soru"), gorunur: q.gorunur !== false, soru: q.soru || "", anasayfa: !!q.anasayfa,
        cevap: q.cevap != null ? q.cevap : (v ? v.cevap : "") };
    });
  }
  return d;
}

// Firestore'a yazılacak sade biçim
function temizle(id, d) {
  if (id === "rehber") return rehberNormal(d);
  const o = kopya(d) || {};
  if (id === "sss") {
    for (const g of o.gruplar || []) for (const q of g.sorular || []) delete q.cevapHtml;
  }
  return o;
}

// Veli Rehberi: yalnız varsayılandan farklı alanları taşıyan yazılar (anahtar sırası sabit)
function rehberNormal(d) {
  const yazilar = {};
  for (const slug of Object.keys(d?.yazilar || {}).sort()) {
    if (!RB_SLUG.test(slug)) continue;
    const n = rehberFark(d.yazilar[slug], RV ? (RV.harita[slug] || null) : null);
    if (n) yazilar[slug] = n;
  }
  return { yazilar };
}

// Kaydedilecek belge: değişen yazıya şimdiki zaman, değişmeyene önceki zaman yazılır
function rehberYazilacak(veri, simdi = new Date().toISOString()) {
  const yazilar = {};
  for (const [slug, o] of Object.entries(veri.yazilar || {})) {
    const onceki = RS[slug];
    const ayni = onceki && JSON.stringify(rehberFark(onceki, RV ? (RV.harita[slug] || null) : null)) === JSON.stringify(o);
    yazilar[slug] = { ...o, guncellendi: ayni && typeof onceki.guncellendi === "string" ? onceki.guncellendi : simdi };
  }
  return { yazilar };
}

function degisti(id) { return D[id] && JSON.stringify(temizle(id, D[id])) !== K[id]; }

async function kaydet(id) {
  if (!yetkiliMi()) { toast("Bu bölümü yalnızca yetkili hesaplar değiştirebilir.", "error"); return false; }
  if (!veriHazir) { toast("İçerik sunucudan yüklenmeden kaydedilemez. Tekrar yükleyin.", "error"); return false; }
  const hata = dogrula(id);
  if (hata) { toast(hata, "error"); return false; }
  const { fb, db } = P();
  const veri = temizle(id, D[id]);
  const yazilacak = id === "rehber" ? rehberYazilacak(veri) : veri;
  try {
    await fb.setDoc(fb.doc(db, "webSitesi", id), { ...yazilacak, guncellendi: fb.serverTimestamp(), guncelleyen: email() });
    if (id === "rehber") { RS = kopya(yazilacak.yazilar); D.rehber = { yazilar: kopya(veri.yazilar) }; }
    K[id] = JSON.stringify(veri);
    Z[id] = { zaman: new Date(), kim: email() };
    toast("✓ Firestore'a kaydedildi. Yayını Siteyi aç bağlantısından kontrol edin.");
    return true;
  } catch (e) {
    console.error("web sitesi kaydet:", e);
    toast("Kaydedilemedi: " + (e.code === "permission-denied" ? "bu hesabın yetkisi yok." : e.message), "error");
    return false;
  }
}

function dogrula(id) {
  const d = D[id];
  if (id === "genel") {
    if (rakam(d.telefon).length < 10) return "Telefon numarası eksik görünüyor.";
    if (rakam(d.cep).length < 10) return "WhatsApp numarası eksik görünüyor.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.eposta || "")) return "E-posta adresi geçerli değil.";
    for (const k of ["instagram", "yenikayit", "kayityenileme", "etkinlikler", "isbasvurusu", "portal", "zekyWeb", "turTakvim", "onlineTakvim", "harita"]) {
      if (d[k] && !/^https:\/\//.test(d[k])) return `"${ALAN_ADLARI[k] || k}" https:// ile başlamalı.`;
    }
  }
  if (id === "duyuru" && d.aktif && !(d.metin || "").trim()) return "Duyuru açıkken metin boş olamaz.";
  if (id === "slaytlar") {
    const g = (d.liste || []).filter((s) => s.gorunur !== false);
    if (!g.length) return "En az bir slayt görünür olmalı.";
    for (const s of d.liste) {
      if (!(s.baslik || "").trim()) return "Her slaytın bir başlığı olmalı.";
      if (!s.gorsel && !(s.kolaj || []).length) return `"${s.baslik}" slaytına bir görsel seçin.`;
    }
  }
  if (id === "kutular") {
    for (const k of d.liste || []) {
      if (!(k.baslik || "").trim()) return "Her kutunun bir başlığı olmalı.";
      if (!k.gorsel) return `"${k.baslik}" kutusuna bir görsel seçin.`;
    }
  }
  if (id === "sss") {
    for (const g of d.gruplar || []) for (const q of g.sorular || []) {
      if (!(q.soru || "").trim() || !(q.cevap || "").trim()) return `"${g.baslik}" grubunda soru ya da cevabı boş bir satır var.`;
    }
  }
  if (id === "rehber") return rehberDogrula(temizle("rehber", d));
  return "";
}

// Veli Rehberi kayıt denetimi: varsayılanlar okunmuş olmalı, alanlar boş olamaz, belge 900 KB'yi aşamaz
function rehberDogrula(veri) {
  if (!RV) return "Veli Rehberi yazılarının sitedeki hâli alınamadı; bu bölüm şimdilik kaydedilemez. Sayfayı yenileyip tekrar deneyin.";
  for (const [slug, o] of Object.entries(veri.yazilar || {})) {
    const ad = (RV.harita[slug] && RV.harita[slug].baslik) || slug;
    if ("baslik" in o && !o.baslik) return `“${ad}” yazısının başlığı boş olamaz.`;
    if ("baslik" in o && o.baslik.length > 120) return `“${ad}” yazısının başlığı en çok 120 karakter olabilir.`;
    if ("ozet" in o && !o.ozet) return `“${ad}” yazısının özeti boş olamaz.`;
    if ("ozet" in o && o.ozet.length > 220) return `“${ad}” yazısının özeti en çok 220 karakter olabilir.`;
    if ("govde" in o && !o.govde.replace(/<[^>]*>/g, "").trim()) return `“${ad}” yazısının metni boş olamaz.`;
  }
  return rehberBoyutHatasi(rehberYazilacak(veri));
}
export function rehberBoyutHatasi(belge, sinir = RB_SINIR) {
  const boyut = utf8Boyut(JSON.stringify(belge));
  if (boyut <= sinir) return "";
  return `Veli Rehberi değişiklikleri çok büyüdü (${Math.ceil(boyut / 1024)} KB). En çok ${Math.floor(sinir / 1024)} KB kaydedilebilir; bazı yazıları “Varsayılana dön” ile sitenin hâline döndürün.`;
}

const ALAN_ADLARI = {
  telefon: "Telefon", cep: "WhatsApp / cep telefonu", eposta: "E-posta", adres: "Adres (sokak, numara)",
  adresTam: "Açık adres", saatler: "Çalışma saatleri", instagram: "Instagram adresi", harita: "Harita bağlantısı",
  googlePuan: "Google puanı", googleYorum: "Yorum sayısı", googleTarih: "Puanın tarihi",
  yenikayit: "Ön kayıt sitesi", kayityenileme: "Kayıt yenileme sitesi", etkinlikler: "Etkinlikler sitesi",
  isbasvurusu: "İş başvurusu sitesi", portal: "Veli portalı", zekyWeb: "ZEKY web sitesi",
  turTakvim: "Okul turu takvimi (Google Takvim)", onlineTakvim: "Online görüşme takvimi (Google Takvim)",
};

// ───────────────────────── ana çizim ─────────────────────────
export async function panelRender(hedefId) {
  kokEl = document.getElementById(hedefId);
  if (!kokEl) return;
  stilEkle();
  if (!yetkiliMi()) {
    kokEl.innerHTML = `<div class="ws-kart ws-uyari"><h3>Bu bölüm kapalı</h3><p>Web sitesi ayarlarını yalnızca ${YETKILI.map(esc).join(" ve ")} hesapları değiştirebilir.</p></div>`;
    return;
  }
  kokEl.innerHTML = `<div class="loading"><div class="spinner"></div><p>Sitenin içeriği yükleniyor...</p></div>`;
  try {
    await yukle();
  } catch (e) {
    kokEl.innerHTML = `<div class="ws-kart ws-uyari"><h3>İçerik yüklenemedi</h3><p>${esc(e.message)}</p><button class="ws-btn" onclick="window._webSitesi.yenile()">Tekrar dene</button></div>`;
    return;
  }
  ciz();
}

function ciz() {
  if (!kokEl) return;
  const nav = BOLUMLER.map((b) => `<button type="button" class="ws-nav-btn${b.id === aktif ? " aktif" : ""}" onclick="window._webSitesi.git('${b.id}')">
      <i data-lucide="${b.ikon}"></i><span><b>${esc(b.ad)}</b><small>${esc(b.aciklama)}</small></span>${b.id !== "yardim" && degisti(b.id) ? '<em class="ws-nokta" title="Kaydedilmemiş değişiklik"></em>' : ""}</button>`).join("");
  kokEl.innerHTML = `<div class="ws">
    <div class="ws-ust">
      <p>Kayıt hedefi: Firestore. Yayın kontrolü: <b>${SITE}</b>. Kaydetme sonucu yayının doğrulandığı anlamına gelmez. Değiştirmediğiniz bölümler korunur.</p>
      <a class="ws-btn ws-btn-ikincil" href="${SITE}/" target="_blank" rel="noopener"><i data-lucide="external-link"></i> Siteyi aç</a>
    </div>
    <div class="ws-duzen">
      <nav class="ws-nav" aria-label="Web sitesi bölümleri">${nav}</nav>
      <div class="ws-icerik" id="wsIcerik">${bolumHtml(aktif)}</div>
    </div>
  </div>`;
  lucide();
  bolumSonrasi(aktif);
}

function kaydetCubugu(id) {
  if (id === "yardim" || id === "medya" || id === "haftalik") return "";
  const z = Z[id];
  const bilgi = z ? `Son kayıt: ${esc(tarihYaz(z.zaman))}${z.kim ? " · " + esc(z.kim) : ""}` : "Bu bölüm henüz panelden değiştirilmedi; sitedeki içerik gösteriliyor.";
  return `<div class="ws-kaydet" id="wsKaydetCubugu">
    <span class="ws-kaydet-bilgi">${degisti(id) ? '<b class="ws-degisti">Kaydedilmemiş değişiklik var.</b> ' : ""}${bilgi}</span>
    <span class="ws-kaydet-dugmeler">
      <button type="button" class="ws-btn ws-btn-hafif" onclick="window._webSitesi.varsayilan('${id}')" title="Sitenin ilk hâline döndürür">Varsayılana dön</button>
      <button type="button" class="ws-btn ws-btn-ikincil" onclick="window._webSitesi.vazgec('${id}')" ${degisti(id) ? "" : "disabled"}>Vazgeç</button>
      <button type="button" class="ws-btn" onclick="window._webSitesi.kaydet('${id}')" ${degisti(id) ? "" : "disabled"}>Kaydet ve yayınla</button>
    </span>
  </div>`;
}

function cubuguYenile() {
  const c = document.getElementById("wsKaydetCubugu");
  if (c) c.outerHTML = kaydetCubugu(aktif);
  document.querySelectorAll(".ws-nav-btn").forEach((b, i) => {
    const id = BOLUMLER[i].id;
    const n = b.querySelector(".ws-nokta");
    const lazim = id !== "yardim" && degisti(id);
    if (lazim && !n) b.insertAdjacentHTML("beforeend", '<em class="ws-nokta" title="Kaydedilmemiş değişiklik"></em>');
    if (!lazim && n) n.remove();
  });
  if (aktif === "rehber") rehberSatirGuncelle();
}

// Açık yazının satır başlığı, "Değiştirildi" rozeti ve "varsayılana döndür" düğmesi yazarken güncellenir
function rehberSatirGuncelle() {
  if (!RV || !acikRehber || !RV.harita[acikRehber]) return;
  const satir = document.querySelector(`[data-rb="${acikRehber}"]`);
  if (!satir) return;
  const e = rbEtkin(acikRehber), d = rbDegistiMi(acikRehber);
  const katAd = (RV.kategoriler.find((k) => k.anahtar === e.kat) || {}).baslik || e.kat;
  const ad = satir.querySelector(".ws-oge-ad");
  if (ad) ad.innerHTML = `<b>${esc(e.baslik)}</b><small>${esc(katAd)}${d ? ' · <span class="ws-rozet">Değiştirildi</span>' : ""}</small>`;
  const b = satir.querySelector("[data-rb-varsayilan]");
  if (b) b.disabled = !d;
}

function bolumHtml(id) {
  const b = BOLUMLER.find((x) => x.id === id);
  const govde = { genel: genelHtml, duyuru: duyuruHtml, slaytlar: slaytlarHtml, kutular: kutularHtml, sss: sssHtml,
    rehber: rehberHtml, haftalik: haftalikHtml, medya: medyaHtml, yardim: yardimHtml }[id]();
  return `<header class="ws-baslik"><h3>${esc(b.ad)}</h3><p>${esc(b.aciklama)}</p></header>${govde}${kaydetCubugu(id)}`;
}

function icerikYenile() {
  const el = document.getElementById("wsIcerik");
  if (!el) return;
  const y = window.scrollY;
  el.innerHTML = bolumHtml(aktif);
  lucide();
  bolumSonrasi(aktif);
  window.scrollTo(0, y);
}

function bolumSonrasi(id) {
  if (id === "duyuru") duyuruOnizle();
  if (id === "rehber") rehberDuzenleyiciBagla();
}

// Form alanı değişince veriyi günceller (data-yol="a.b.0.c")
function alanBagla(el) {
  const yol = el.getAttribute("data-yol");
  const bolum = el.getAttribute("data-bolum") || aktif;
  if (!yol) return;
  const parcalar = yol.split(".");
  let o = D[bolum];
  for (let i = 0; i < parcalar.length - 1; i++) {
    const k = /^\d+$/.test(parcalar[i]) ? Number(parcalar[i]) : parcalar[i];
    if (o[k] == null) o[k] = /^\d+$/.test(parcalar[i + 1]) ? [] : {};
    o = o[k];
  }
  const son = parcalar[parcalar.length - 1];
  o[son] = el.type === "checkbox" ? el.checked : el.value;
  const sayac = el.parentElement?.querySelector(".ws-sayac");
  if (sayac && el.maxLength > 0) sayac.textContent = `${el.value.length}/${el.maxLength}`;
  if (bolum === "duyuru") duyuruOnizle();
  if (el.hasAttribute("data-yenile")) icerikYenile(); else cubuguYenile();
}

function alan(bolum, yol, etiket, deger, { tip = "text", ipucu = "", max = 0, satir = 0, liste = "", yer = "" } = {}) {
  const id = "ws-" + bolum + "-" + yol.replace(/\./g, "-");
  const ortak = `id="${id}" data-bolum="${bolum}" data-yol="${esc(yol)}" oninput="window._webSitesi.alan(this)"${max ? ` maxlength="${max}"` : ""}${liste ? ` list="${liste}"` : ""}${yer ? ` placeholder="${esc(yer)}"` : ""}`;
  const giris = satir
    ? `<textarea ${ortak} rows="${satir}">${esc(deger)}</textarea>`
    : `<input type="${tip}" ${ortak} value="${esc(deger)}">`;
  return `<div class="ws-alan"><label for="${id}">${esc(etiket)}</label>${giris}${max ? `<span class="ws-sayac">${String(deger || "").length}/${max}</span>` : ""}${ipucu ? `<p class="ws-ipucu">${ipucu}</p>` : ""}</div>`;
}

function sayfaListesi() {
  return `<datalist id="ws-sayfalar">${SAYFALAR.map(([u, a]) => `<option value="${u}">${esc(a)}</option>`).join("")}</datalist>`;
}

// ───────────────────────── Genel bilgiler ─────────────────────────
function genelHtml() {
  const d = D.genel;
  const grup = (baslik, aciklama, alanlar) => `<section class="ws-kart"><h4>${baslik}</h4>${aciklama ? `<p class="ws-ipucu">${aciklama}</p>` : ""}<div class="ws-izgara">${alanlar}</div></section>`;
  return `
  ${grup("İletişim", "Bu bilgiler sitenin üst çubuğunda, alt bilgisinde, iletişim sayfasında ve randevu formunda kullanılır.",
    alan("genel", "telefon", ALAN_ADLARI.telefon, d.telefon, { tip: "tel", yer: "0216 393 54 57" }) +
    alan("genel", "cep", ALAN_ADLARI.cep, d.cep, { tip: "tel", yer: "0555 103 54 57", ipucu: "WhatsApp düğmeleri bu numaraya yazdırır." }) +
    alan("genel", "eposta", ALAN_ADLARI.eposta, d.eposta, { tip: "email", ipucu: "Web sitesindeki randevu talepleri de bu adrese gelir." }) +
    alan("genel", "saatler", ALAN_ADLARI.saatler, d.saatler, { yer: "Pazartesi–Cuma 08:00–18:00" }) +
    alan("genel", "adres", ALAN_ADLARI.adres, d.adres) +
    alan("genel", "adresTam", ALAN_ADLARI.adresTam, d.adresTam, { ipucu: "Posta kodu, ilçe ve il dahil." }))}
  ${grup("Google puanı", "Ana sayfadaki veli yorumları bölümünde görünür. Google'daki puanınızı ayda bir güncellemeniz yeterli.",
    alan("genel", "googlePuan", ALAN_ADLARI.googlePuan, d.googlePuan, { yer: "4,7" }) +
    alan("genel", "googleYorum", ALAN_ADLARI.googleYorum, d.googleYorum, { yer: "88" }) +
    alan("genel", "googleTarih", ALAN_ADLARI.googleTarih, d.googleTarih, { yer: "Ekim 2026" }))}
  ${grup("Sosyal medya ve harita", "",
    alan("genel", "instagram", ALAN_ADLARI.instagram, d.instagram, { tip: "url" }) +
    alan("genel", "harita", ALAN_ADLARI.harita, d.harita, { tip: "url", ipucu: "Google Haritalar'da okulunuzu açıp “Paylaş” bağlantısını yapıştırabilirsiniz." }))}
  ${grup("Diğer sitelerin bağlantıları", "Üst çubuk, menü ve “Ne yapmak istersiniz?” kutularındaki bağlantılar.",
    ["yenikayit", "kayityenileme", "etkinlikler", "isbasvurusu", "portal", "zekyWeb", "turTakvim", "onlineTakvim"]
      .map((k) => alan("genel", k, ALAN_ADLARI[k], d[k], { tip: "url" })).join(""))}`;
}

// ───────────────────────── Duyuru şeridi ─────────────────────────
function duyuruHtml() {
  const d = D.duyuru;
  return `${sayfaListesi()}
  <section class="ws-kart">
    <label class="ws-anahtar"><input type="checkbox" data-bolum="duyuru" data-yol="aktif" ${d.aktif ? "checked" : ""} onchange="window._webSitesi.alan(this)"><span></span><b>Duyuru şeridi sitede görünsün</b></label>
    <p class="ws-ipucu">Şerit tüm sayfaların en üstünde görünür. Ziyaretçi kapatırsa aynı duyuru ona tekrar gösterilmez; metni değiştirirseniz yeniden görünür.</p>
    <div class="ws-izgara">
      ${alan("duyuru", "metin", "Duyuru metni", d.metin, { max: 160, satir: 2, yer: "Örn. 2026–2027 kayıtlarımız devam ediyor." })}
      ${alan("duyuru", "dugmeMetni", "Bağlantı yazısı (isteğe bağlı)", d.dugmeMetni, { max: 30, yer: "Örn. Randevu alın" })}
      ${alan("duyuru", "dugmeAdresi", "Bağlantı adresi (isteğe bağlı)", d.dugmeAdresi, { liste: "ws-sayfalar", yer: "/okulu-ziyaret", ipucu: "Listeden bir sayfa seçin ya da https:// ile başlayan bir adres yazın." })}
    </div>
    <div class="ws-alan"><span class="ws-etiket">Renk</span>
      <div class="ws-secenekler">
        <label><input type="radio" name="ws-renk" value="sari" ${d.renk !== "yesil" ? "checked" : ""} data-bolum="duyuru" data-yol="renk" onchange="window._webSitesi.alan(this)"> Sarı</label>
        <label><input type="radio" name="ws-renk" value="yesil" ${d.renk === "yesil" ? "checked" : ""} data-bolum="duyuru" data-yol="renk" onchange="window._webSitesi.alan(this)"> Yeşil</label>
      </div>
    </div>
  </section>
  <section class="ws-kart"><h4>Önizleme</h4><div id="wsDuyuruOnizleme"></div></section>`;
}

function duyuruOnizle() {
  const el = document.getElementById("wsDuyuruOnizleme");
  if (!el) return;
  const d = D.duyuru;
  if (!d.aktif || !(d.metin || "").trim()) { el.innerHTML = `<p class="ws-ipucu">Şerit kapalı ya da metin boş; sitede görünmez.</p>`; return; }
  el.innerHTML = `<div class="ws-duyuru ${d.renk === "yesil" ? "yesil" : ""}"><span>${esc(d.metin)}</span>${(d.dugmeMetni || "").trim() && (d.dugmeAdresi || "").trim() ? `<u>${esc(d.dugmeMetni)}</u>` : ""}<b aria-hidden="true">×</b></div>`;
}

// ───────────────────────── Slaytlar ─────────────────────────
function slaytlarHtml() {
  const liste = D.slaytlar.liste || [];
  const kartlar = liste.map((s, i) => {
    const acik = acikSlayt === i;
    const kapak = s.gorsel || (s.kolaj || [])[0];
    return `<article class="ws-oge${s.gorunur === false ? " gizli" : ""}${acik ? " acik" : ""}">
      <div class="ws-oge-ust">
        <span class="ws-sira">${i + 1}</span>
        <img class="ws-kucuk" src="${esc(gorselUrl(kapak, 320))}" alt="" loading="lazy">
        <div class="ws-oge-ad"><b>${esc(s.baslik || "Başlıksız slayt")}</b><small>${esc(s.sekme || "")}${s.gorunur === false ? " · gizli" : ""}</small></div>
        <div class="ws-oge-dugmeler">
          <button type="button" class="ws-ikon-btn" title="Yukarı taşı" onclick="window._webSitesi.tasi('slaytlar',${i},-1)" ${i === 0 ? "disabled" : ""}><i data-lucide="arrow-up"></i></button>
          <button type="button" class="ws-ikon-btn" title="Aşağı taşı" onclick="window._webSitesi.tasi('slaytlar',${i},1)" ${i === liste.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down"></i></button>
          <button type="button" class="ws-ikon-btn" title="${s.gorunur === false ? "Göster" : "Gizle"}" onclick="window._webSitesi.gorunur('slaytlar',${i})"><i data-lucide="${s.gorunur === false ? "eye-off" : "eye"}"></i></button>
          <button type="button" class="ws-btn ws-btn-ikincil" onclick="window._webSitesi.ac('slaytlar',${i})">${acik ? "Kapat" : "Düzenle"}</button>
        </div>
      </div>
      ${acik ? slaytFormu(s, i) : ""}
    </article>`;
  }).join("");
  return `${sayfaListesi()}
  <p class="ws-not">Slaytlar sırayla 10'ar saniye görünür. <b>İlk görünen slaytın başlığı</b> ana sayfanın ana başlığıdır (Google bu başlığı okur). Bir slaytı silmeden geçici olarak <b>gizleyebilirsiniz</b>.</p>
  <div class="ws-liste">${kartlar}</div>
  <button type="button" class="ws-btn ws-btn-ikincil ws-ekle" onclick="window._webSitesi.ekle('slaytlar')"><i data-lucide="plus"></i> Yeni slayt ekle</button>`;
}

function slaytFormu(s, i) {
  const y = (k) => `liste.${i}.${k}`;
  const bilgiler = [0, 1, 2].map((n) => {
    const b = (s.bilgiler || [])[n] || { etiket: "", deger: "" };
    return `<div class="ws-ikili">${alan("slaytlar", y(`bilgiler.${n}.etiket`), `Bilgi ${n + 1} · başlık`, b.etiket, { max: 24, yer: n === 0 ? "Örn. Yaş" : "" })}${alan("slaytlar", y(`bilgiler.${n}.deger`), `Bilgi ${n + 1} · değer`, b.deger, { max: 32, yer: n === 0 ? "Örn. 24–72 ay" : "" })}</div>`;
  }).join("");
  const kolaj = (s.kolaj || []);
  return `<div class="ws-form">
    <div class="ws-form-izgara">
      <div>
        ${alan("slaytlar", y("baslik"), "Başlık (slogan)", s.baslik, { max: 70, satir: 2, ipucu: "Kısa ve akılda kalıcı olsun. Örn. “Montessori sınıfında öğrenir, ormanda büyür.”" })}
        ${alan("slaytlar", y("aciklama"), "Açıklama", s.aciklama, { max: 320, satir: 4 })}
        ${alan("slaytlar", y("sekme"), "Kısa ad", s.sekme, { max: 24, ipucu: "Ekran okuyucular slayt noktalarını bu adla okur. Örn. “Orman okulu”." })}
        <div class="ws-ikili">${alan("slaytlar", y("dugmeMetni"), "Düğme yazısı", s.dugmeMetni, { max: 32 })}${alan("slaytlar", y("dugmeAdresi"), "Düğmenin açacağı sayfa", s.dugmeAdresi, { liste: "ws-sayfalar" })}</div>
        <p class="ws-ipucu">Yanındaki ikinci düğme otomatik eklenir: düğme randevu sayfasını açıyorsa “WhatsApp'tan yazın”, değilse “Okuldan randevu al”.</p>
      </div>
      <div>
        <div class="ws-alan"><span class="ws-etiket">Görsel</span>
          ${kolaj.length ? `<div class="ws-kolaj">${kolaj.map((g, k) => `<figure><img src="${esc(gorselUrl(g, 320))}" alt=""><figcaption><button type="button" class="ws-link" onclick="window._webSitesi.gorselSec('slaytlar',${i},'kolaj',${k})">Değiştir</button> · <button type="button" class="ws-link" onclick="window._webSitesi.kolajCikar(${i},${k})">Çıkar</button></figcaption></figure>`).join("")}</div>
            <p class="ws-ipucu">Bu slayt ${kolaj.length} görselden oluşan bir kolaj. ${kolaj.length < 3 ? `<button type="button" class="ws-link" onclick="window._webSitesi.gorselSec('slaytlar',${i},'kolaj',${kolaj.length})">Görsel ekle</button> · ` : ""}<button type="button" class="ws-link" onclick="window._webSitesi.kolajKapat(${i})">Tek görsele dön</button></p>`
          : `<div class="ws-gorsel-alan">${s.gorsel ? `<img src="${esc(gorselUrl(s.gorsel, 640))}" alt="">` : `<div class="ws-bos">Görsel seçilmedi</div>`}
              <div class="ws-gorsel-dugmeler">
                <button type="button" class="ws-btn" onclick="window._webSitesi.gorselSec('slaytlar',${i},'gorsel')"><i data-lucide="image"></i> ${s.gorsel ? "Görseli değiştir" : "Görsel seç"}</button>
                ${s.gorsel ? `<button type="button" class="ws-btn ws-btn-ikincil" onclick="window._webSitesi.gorseliDuzenle('slaytlar',${i},'gorsel')"><i data-lucide="crop"></i> Düzenle</button>` : ""}
                <button type="button" class="ws-link" onclick="window._webSitesi.kolajAc(${i})">Kolaj yap (2–3 görsel)</button>
              </div></div>`}
          <p class="ws-ipucu">Dikey (4:5) görseller en iyi sonucu verir. Çocukların yüzü görünüyorsa düzenleyicide bulanıklaştırın.</p>
        </div>
        ${s.gorsel && !kolaj.length ? alan("slaytlar", y("gorsel.alt"), "Görselin kısa açıklaması", s.gorsel.alt, { max: 160, ipucu: "Görme engelli ziyaretçiler ve Google için. Örn. “Ormanda yaprak toplayan bir çocuk”." }) : ""}
        <div class="ws-ikili">${alan("slaytlar", y("notBaslik"), "Görsel notu · başlık", s.notBaslik, { max: 40 })}${alan("slaytlar", y("notMetin"), "Görsel notu · metin", s.notMetin, { max: 110 })}</div>
      </div>
    </div>
    <h5>Başlığın altındaki üç kısa bilgi</h5>
    ${bilgiler}
    <div class="ws-form-alt">
      <button type="button" class="ws-btn ws-btn-tehlike" onclick="window._webSitesi.sil('slaytlar',${i})"><i data-lucide="trash-2"></i> Bu slaytı sil</button>
    </div>
  </div>`;
}

// ───────────────────────── Kutular ─────────────────────────
function kutularHtml() {
  const liste = D.kutular.liste || [];
  const kartlar = liste.map((k, i) => {
    const acik = acikKutu === i;
    return `<article class="ws-oge${k.gorunur === false ? " gizli" : ""}${acik ? " acik" : ""}">
      <div class="ws-oge-ust">
        <span class="ws-sira">${i + 1}</span>
        <img class="ws-kucuk kare" src="${esc(gorselUrl(k.gorsel, 320))}" alt="" loading="lazy">
        <div class="ws-oge-ad"><b>${esc(k.baslik || "Başlıksız kutu")}</b><small>${esc(k.metin || "")}${k.gorunur === false ? " · gizli" : ""}</small></div>
        <div class="ws-oge-dugmeler">
          <button type="button" class="ws-ikon-btn" title="Yukarı taşı" onclick="window._webSitesi.tasi('kutular',${i},-1)" ${i === 0 ? "disabled" : ""}><i data-lucide="arrow-up"></i></button>
          <button type="button" class="ws-ikon-btn" title="Aşağı taşı" onclick="window._webSitesi.tasi('kutular',${i},1)" ${i === liste.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down"></i></button>
          <button type="button" class="ws-ikon-btn" title="${k.gorunur === false ? "Göster" : "Gizle"}" onclick="window._webSitesi.gorunur('kutular',${i})"><i data-lucide="${k.gorunur === false ? "eye-off" : "eye"}"></i></button>
          <button type="button" class="ws-btn ws-btn-ikincil" onclick="window._webSitesi.ac('kutular',${i})">${acik ? "Kapat" : "Düzenle"}</button>
        </div>
      </div>
      ${acik ? `<div class="ws-form"><div class="ws-form-izgara"><div>
          ${alan("kutular", `liste.${i}.baslik`, "Başlık", k.baslik, { max: 28 })}
          ${alan("kutular", `liste.${i}.metin`, "Kısa açıklama", k.metin, { max: 48, ipucu: "Tek satır yeterli. Örn. “Haftada 2 saat, her mevsim.”" })}
          ${alan("kutular", `liste.${i}.adres`, "Tıklanınca açılacak sayfa", k.adres, { liste: "ws-sayfalar" })}
        </div><div>
          <div class="ws-alan"><span class="ws-etiket">Görsel (kare)</span><div class="ws-gorsel-alan kare">${k.gorsel ? `<img src="${esc(gorselUrl(k.gorsel, 640))}" alt="">` : `<div class="ws-bos">Görsel seçilmedi</div>`}
            <div class="ws-gorsel-dugmeler"><button type="button" class="ws-btn" onclick="window._webSitesi.gorselSec('kutular',${i},'gorsel')"><i data-lucide="image"></i> ${k.gorsel ? "Görseli değiştir" : "Görsel seç"}</button>
            ${k.gorsel ? `<button type="button" class="ws-btn ws-btn-ikincil" onclick="window._webSitesi.gorseliDuzenle('kutular',${i},'gorsel')"><i data-lucide="crop"></i> Düzenle</button>` : ""}</div></div></div>
          ${k.gorsel ? alan("kutular", `liste.${i}.gorsel.alt`, "Görselin kısa açıklaması", k.gorsel.alt, { max: 160 }) : ""}
        </div></div>
        <div class="ws-form-alt"><button type="button" class="ws-btn ws-btn-tehlike" onclick="window._webSitesi.sil('kutular',${i})"><i data-lucide="trash-2"></i> Bu kutuyu sil</button></div>
      </div>` : ""}
    </article>`;
  }).join("");
  return `${sayfaListesi()}
  <p class="ws-not">Kutular ana sayfada slaytların hemen altında küçük kareler olarak görünür. Bilgisayarda tek satırda 7 kutu sığar; telefonda yana kaydırılır.</p>
  <div class="ws-liste">${kartlar}</div>
  <button type="button" class="ws-btn ws-btn-ikincil ws-ekle" onclick="window._webSitesi.ekle('kutular')"><i data-lucide="plus"></i> Yeni kutu ekle</button>`;
}

// ───────────────────────── SSS ─────────────────────────
function sssHtml() {
  const gruplar = D.sss.gruplar || [];
  const anaSay = gruplar.reduce((t, g) => t + (g.sorular || []).filter((q) => q.anasayfa && q.gorunur !== false).length, 0);
  return `<p class="ws-not">Soruların hepsi <b>Sık sorulan sorular</b> sayfasında grupları altında görünür. “Ana sayfada göster” işaretli olanlar ana sayfadaki kısa listede de yer alır (şu an ${anaSay} soru; 3–5 soru idealdir).</p>
  ${gruplar.map((g, gi) => `<section class="ws-kart">
    <h4>${esc(g.baslik)} <small>${(g.sorular || []).length} soru</small></h4>
    ${(g.sorular || []).map((q, qi) => `<div class="ws-soru${q.gorunur === false ? " gizli" : ""}">
      <div class="ws-soru-ust">
        ${alan("sss", `gruplar.${gi}.sorular.${qi}.soru`, `Soru ${qi + 1}`, q.soru, { max: 140 })}
        <div class="ws-oge-dugmeler">
          <button type="button" class="ws-ikon-btn" title="Yukarı taşı" onclick="window._webSitesi.soruTasi(${gi},${qi},-1)" ${qi === 0 ? "disabled" : ""}><i data-lucide="arrow-up"></i></button>
          <button type="button" class="ws-ikon-btn" title="Aşağı taşı" onclick="window._webSitesi.soruTasi(${gi},${qi},1)" ${qi === g.sorular.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down"></i></button>
          <button type="button" class="ws-ikon-btn" title="Sil" onclick="window._webSitesi.soruSil(${gi},${qi})"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      ${alan("sss", `gruplar.${gi}.sorular.${qi}.cevap`, "Cevap", q.cevap, { satir: 3, max: 900, ipucu: "Paragrafları boş bir satırla ayırın. https:// ile başlayan adresler bağlantıya dönüşür." })}
      <div class="ws-secenekler">
        <label><input type="checkbox" data-bolum="sss" data-yol="gruplar.${gi}.sorular.${qi}.anasayfa" ${q.anasayfa ? "checked" : ""} onchange="window._webSitesi.alan(this)" data-yenile> Ana sayfada göster</label>
        <label><input type="checkbox" data-bolum="sss" data-yol="gruplar.${gi}.sorular.${qi}.gorunur" ${q.gorunur !== false ? "checked" : ""} onchange="window._webSitesi.alan(this)" data-yenile> Sitede yayında</label>
      </div>
    </div>`).join("")}
    <button type="button" class="ws-btn ws-btn-ikincil ws-ekle" onclick="window._webSitesi.soruEkle(${gi})"><i data-lucide="plus"></i> Bu gruba soru ekle</button>
  </section>`).join("")}`;
}

// ───────────────────────── Veli Rehberi ─────────────────────────
function rbDegisiklik(slug, olustur = false) {
  const y = D.rehber.yazilar || (D.rehber.yazilar = {});
  if (!y[slug] && olustur) y[slug] = {};
  return y[slug] || null;
}
// Ekranda görünen hâl: değişiklik varsa o, yoksa sitenin varsayılanı
function rbEtkin(slug) {
  const v = (RV && RV.harita[slug]) || {};
  const o = (D.rehber.yazilar || {})[slug] || {};
  return {
    baslik: typeof o.baslik === "string" ? o.baslik : (v.baslik || ""),
    ozet: typeof o.ozet === "string" ? o.ozet : (v.ozet || ""),
    govde: typeof o.govde === "string" ? o.govde : (v.govde || ""),
    gorsel: gorselSade(o.gorsel) || v.gorsel || null,
    adres: v.adres || `/veli-rehberi/${slug}`,
    kat: v.kat || "",
  };
}
function rbDegistiMi(slug) { return !!rehberFark((D.rehber.yazilar || {})[slug], RV ? (RV.harita[slug] || null) : null); }
function trKucuk(t) { return String(t || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i"); }

function rehberHtml() {
  if (!RV) {
    const n = Object.keys(D.rehber.yazilar || {}).length;
    return `<section class="ws-kart ws-uyari"><h4>Yazılar şu an düzenlenemiyor</h4>
      <p class="ws-ipucu">Veli Rehberi yazılarının sitedeki hâli alınamadı (${esc(RVhata || "bilinmeyen hata")}). Site Veli Rehberi düzenlemesini destekleyen sürümle yayınlandığında bu bölüm açılır.${n ? ` Panelde kayıtlı ${n} yazı değişikliği korunuyor.` : ""}</p>
      <button type="button" class="ws-btn ws-btn-ikincil" onclick="window._webSitesi.yenile()"><i data-lucide="refresh-cw"></i> Tekrar dene</button></section>`;
  }
  const degisen = RV.yazilar.filter((y) => rbDegistiMi(y.slug)).length;
  return `<p class="ws-not">Sitedeki ${RV.yazilar.length} yazının başlığını, özetini, metnini ve görselini buradan düzeltebilirsiniz. Değiştirmediğiniz yazılar sitedeki hâliyle kalır.${degisen ? ` Şu an <b>${degisen} yazıda</b> değişiklik var.` : ""}</p>
  <div class="ws-alan ws-rb-ara"><label for="wsRbAra">Yazı ara</label>
    <input type="search" id="wsRbAra" value="${esc(rbAra)}" placeholder="Başlık ya da özetten bir kelime" oninput="window._webSitesi.rehberAra(this.value)" autocomplete="off"></div>
  <div id="wsRbListe" class="ws-rb">${rehberListeHtml()}</div>`;
}

function rehberListeHtml() {
  const q = trKucuk(rbAra.trim());
  const uyan = (y) => { if (!q) return true; const e = rbEtkin(y.slug); return trKucuk(e.baslik + " " + e.ozet).includes(q); };
  const katAd = Object.fromEntries(RV.kategoriler.map((k) => [k.anahtar, k.baslik]));
  const bolumler = RV.kategoriler.map((k) => {
    const yazilar = RV.yazilar.filter((y) => y.kat === k.anahtar && (uyan(y) || acikRehber === y.slug));
    if (!yazilar.length) return "";
    return `<section class="ws-kart ws-rb-kat"><h4>${esc(k.baslik)} <small>${yazilar.length} yazı</small></h4>
      <div class="ws-liste">${yazilar.map((y) => rehberSatirHtml(y, katAd)).join("")}</div></section>`;
  }).join("");
  return bolumler || `<div class="ws-bos">“${esc(rbAra)}” ile eşleşen yazı yok.</div>`;
}

function rehberSatirHtml(y, katAd) {
  const e = rbEtkin(y.slug), acik = acikRehber === y.slug, degisti_ = rbDegistiMi(y.slug);
  return `<article class="ws-oge${acik ? " acik" : ""}" data-rb="${esc(y.slug)}">
    <div class="ws-oge-ust">
      <img class="ws-kucuk" src="${esc(gorselUrl(e.gorsel, 320))}" alt="" loading="lazy">
      <div class="ws-oge-ad"><b>${esc(e.baslik)}</b><small>${esc(katAd[y.kat] || y.kat)}${degisti_ ? ' · <span class="ws-rozet">Değiştirildi</span>' : ""}</small></div>
      <div class="ws-oge-dugmeler"><button type="button" class="ws-btn ws-btn-ikincil" data-slug="${esc(y.slug)}" onclick="window._webSitesi.rehberAc(this.dataset.slug)">${acik ? "Kapat" : "Düzenle"}</button></div>
    </div>
    ${acik ? rehberFormu(y.slug, e) : ""}
  </article>`;
}

const RB_ARACLAR = [
  ["p", "pilcrow", "Normal metin"], ["h2", "heading-2", "Başlık"], ["h3", "heading-3", "Alt başlık"],
  ["bold", "bold", "Kalın"], ["italic", "italic", "İtalik"],
  ["ul", "list", "Madde listesi"], ["ol", "list-ordered", "Numaralı liste"],
  ["link", "link", "Bağlantı"], ["unlink", "unlink", "Bağlantıyı kaldır"],
];

function rehberFormu(slug, e) {
  const y = (k) => `yazilar.${slug}.${k}`;
  const varsayilanMi = !rbDegistiMi(slug);
  return `<div class="ws-form ws-rb-form">
    <div class="ws-form-izgara">
      <div>
        ${alan("rehber", y("baslik"), "Başlık", e.baslik, { max: 120, satir: 2, ipucu: "Sayfanın ana başlığı; Google'da da bu görünür." })}
        ${alan("rehber", y("ozet"), "Özet", e.ozet, { max: 220, satir: 3, ipucu: "Başlığın altındaki kısa giriş ve Google açıklaması." })}
      </div>
      <div>
        <div class="ws-alan"><span class="ws-etiket">Görsel</span>
          <div class="ws-gorsel-alan">${e.gorsel ? `<img src="${esc(gorselUrl(e.gorsel, 640))}" alt="">` : `<div class="ws-bos">Görsel yok</div>`}
            <div class="ws-gorsel-dugmeler">
              <button type="button" class="ws-btn" data-slug="${esc(slug)}" onclick="window._webSitesi.gorselSec('rehber',this.dataset.slug,'gorsel')"><i data-lucide="image"></i> Görseli değiştir</button>
              ${e.gorsel ? `<button type="button" class="ws-btn ws-btn-ikincil" data-slug="${esc(slug)}" onclick="window._webSitesi.gorseliDuzenle('rehber',this.dataset.slug,'gorsel')"><i data-lucide="crop"></i> Düzenle</button>` : ""}
            </div></div>
          <p class="ws-ipucu">Dikey (4:5) görseller en iyi sonucu verir. Çocukların yüzü görünüyorsa düzenleyicide bulanıklaştırın.</p>
        </div>
        ${e.gorsel ? `<div class="ws-alan"><label for="wsRbAlt">Görselin kısa açıklaması</label><input type="text" id="wsRbAlt" maxlength="160" value="${esc(e.gorsel.alt || "")}" data-slug="${esc(slug)}" oninput="window._webSitesi.rehberAlt(this)"></div>` : ""}
      </div>
    </div>
    <div class="ws-alan"><span class="ws-etiket" id="wsRbMetinEtiket">Metin</span>
      <div class="ws-rb-arac" role="toolbar" aria-label="Metin biçimi">${RB_ARACLAR.map(([k, ikon, ad]) =>
        `<button type="button" class="ws-ikon-btn" data-rb-arac="${k}" title="${esc(ad)}" aria-label="${esc(ad)}" onmousedown="event.preventDefault()"><i data-lucide="${ikon}"></i></button>`).join("")}</div>
      <div class="ws-rb-metin" id="wsRbMetin" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="wsRbMetinEtiket" data-slug="${esc(slug)}" spellcheck="true" lang="tr">${rehberTemizle(e.govde)}</div>
      <p class="ws-ipucu">Yapıştırılan metin düz yazı olarak eklenir. Kaydederken yalnız başlık, paragraf, liste, kalın/italik ve bağlantı biçimleri korunur.</p>
    </div>
    <div class="ws-form-alt ws-rb-alt">
      <a class="ws-btn ws-btn-hafif" href="${esc(SITE + e.adres)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i> Sitede gör</a>
      <button type="button" class="ws-btn ws-btn-tehlike" data-slug="${esc(slug)}" onclick="window._webSitesi.rehberVarsayilan(this.dataset.slug)" data-rb-varsayilan ${varsayilanMi ? "disabled" : ""}><i data-lucide="rotate-ccw"></i> Bu yazıyı varsayılana döndür</button>
    </div>
  </div>`;
}

// Açık yazının metin düzenleyicisine olayları bağlar (her çizimden sonra)
function rehberDuzenleyiciBagla() {
  const el = document.getElementById("wsRbMetin");
  if (!el || el.dataset.bagli) return;
  el.dataset.bagli = "1";
  const slug = el.dataset.slug;
  const guncelle = () => {
    rbDegisiklik(slug, true).govde = rehberTemizle(el.innerHTML);
    cubuguYenile();
  };
  el.addEventListener("focus", () => { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (_) {} });
  el.addEventListener("input", guncelle);
  el.addEventListener("paste", (e) => {
    e.preventDefault();
    const metin = (e.clipboardData || window.clipboardData)?.getData("text/plain") || "";
    document.execCommand("insertText", false, metin);
  });
  el.addEventListener("drop", (e) => e.preventDefault());
  const arac = el.parentElement.querySelector(".ws-rb-arac");
  arac?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rb-arac]");
    if (!b) return;
    const k = b.dataset.rbArac;
    el.focus();
    if (k === "p" || k === "h2" || k === "h3") document.execCommand("formatBlock", false, k.toUpperCase());
    else if (k === "bold" || k === "italic") document.execCommand(k);
    else if (k === "ul") document.execCommand("insertUnorderedList");
    else if (k === "ol") document.execCommand("insertOrderedList");
    else if (k === "unlink") document.execCommand("unlink");
    else if (k === "link") { baglantiSor(el, guncelle); return; }
    guncelle();
  });
}

// Bağlantı adresi küçük bir pencerede sorulur; seçim pencere açılmadan önce saklanır.
function baglantiSor(el, sonra) {
  const sec = window.getSelection();
  const aralik = sec && sec.rangeCount ? sec.getRangeAt(0).cloneRange() : null;
  if (!aralik || aralik.collapsed || !el.contains(aralik.commonAncestorContainer)) { toast("Önce bağlantı yapmak istediğiniz yazıyı seçin.", "info"); return; }
  const kap = document.createElement("div");
  kap.className = "ws-modal";
  kap.innerHTML = `<div class="ws-modal-kutu" role="dialog" aria-modal="true" aria-labelledby="wsBagBaslik">
    <h3 id="wsBagBaslik">Bağlantı ekle</h3>
    <div class="ws-alan"><label for="wsBagAdres">Adres</label><input type="url" id="wsBagAdres" placeholder="/montessori ya da https://…" list="ws-sayfalar-rb"></div>
    <datalist id="ws-sayfalar-rb">${SAYFALAR.map(([u, a]) => `<option value="${esc(u)}">${esc(a)}</option>`).join("")}</datalist>
    <p class="ws-ipucu">Sitedeki bir sayfa için / ile başlayın (örn. /orman-okulu). Dış adresler https:// ile başlamalı.</p>
    <div class="ws-modal-alt"><button type="button" class="ws-btn ws-btn-ikincil" data-k="vazgec">Vazgeç</button><button type="button" class="ws-btn" data-k="tamam">Bağlantı ekle</button></div></div>`;
  document.body.appendChild(kap);
  const giris = kap.querySelector("#wsBagAdres");
  const kapat = () => kap.remove();
  const uygula = () => {
    const href = guvenliHref(giris.value);
    if (!href) { toast("Adres / ya da https:// ile başlamalı.", "error"); giris.focus(); return; }
    kapat();
    el.focus();
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(aralik);
    document.execCommand("createLink", false, href);
    sonra();
  };
  kap.addEventListener("click", (e) => {
    const k = e.target.closest("[data-k]")?.dataset.k;
    if (e.target === kap || k === "vazgec") kapat();
    if (k === "tamam") uygula();
  });
  giris.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); uygula(); } });
  giris.focus();
}

function rehberAc(slug) {
  if (!RV || !RV.harita[slug]) return;
  acikRehber = acikRehber === slug ? null : slug;
  icerikYenile();
  if (acikRehber) document.querySelector(`[data-rb="${CSS.escape(slug)}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
}
function rehberAra(deger) {
  rbAra = String(deger || "").slice(0, 80);
  const l = document.getElementById("wsRbListe");
  if (!l) return;
  l.innerHTML = rehberListeHtml();
  lucide();
  rehberDuzenleyiciBagla();
}
function rehberAlt(el) {
  const slug = el.dataset.slug;
  const o = rbDegisiklik(slug, true);
  if (!gorselSade(o.gorsel)) o.gorsel = kopya(rbEtkin(slug).gorsel) || null;
  if (!o.gorsel) return;
  o.gorsel.alt = el.value;
  cubuguYenile();
}
function rehberVarsayilan(slug) {
  onayla("Bu yazı varsayılana dönsün mü?", "Başlık, özet, metin ve görsel sitenin ilk hâline döner. Sitede uygulanması için ardından “Kaydet ve yayınla”ya basın.", "Varsayılana dön", () => {
    delete D.rehber.yazilar[slug];
    icerikYenile();
  });
}

// ───────────────────────── Haftalık görseller ─────────────────────────
function haftalikHtml() {
  const acik = haftalikAcikMi(HA);
  const sayi = alanBasinaCoz(HA.alanBasina);
  const son = H && H.olusturuldu ? tarihYaz(H.olusturuldu) : "";
  const istekMs = zamanMs(HA.yenileIste), sonMs = zamanMs(H && H.olusturuldu);
  const bekliyor = istekMs && istekMs > sonMs;
  const ozet = H ? haftalikOzetMetni(H.ozet) : "";
  const alanlar = (H && H.alanlar && typeof H.alanlar === "object") ? H.alanlar : {};
  return `<section class="ws-kart ws-hf">
    <p class="ws-ipucu ws-hf-giris">Her pazartesi sistem, onaylanmış galeri fotoğraflarından her alan için birkaç kare seçer; çocukların yüzlerini bulanıklaştırır, okul filigranını kırpar ve sitedeki <b>“Bu hafta okulumuzda”</b> bölümlerinde yayınlar. Beğenmediğiniz kareyi kaldırabilir ya da kaçan bir yüzü elle bulanıklaştırabilirsiniz.</p>
    <div class="ws-hf-ayar">
      <label class="ws-anahtar"><input type="checkbox" ${acik ? "checked" : ""} onchange="window._webSitesi.haftalikAcik(this.checked)" ${hfMesgul ? "disabled" : ""}><span></span><b>Haftalık otomatik güncelleme</b></label>
      <div class="ws-alan ws-hf-sayi"><label for="wsHfSayi">Alan başına görsel</label>
        <select id="wsHfSayi" onchange="window._webSitesi.haftalikSayi(this.value)" ${hfMesgul ? "disabled" : ""}>${[1, 2, 3, 4].map((n) => `<option value="${n}" ${n === sayi ? "selected" : ""}>${n}</option>`).join("")}</select></div>
    </div>
    ${acik ? "" : `<p class="ws-uyari-satir">Otomatik güncelleme kapalı: yeni seçim yapılmaz, sitede son seçilen görseller kalır. Bir kareyi sitede istemiyorsanız “Kaldır”ı kullanın.</p>`}
    <div class="ws-hf-durum">
      <div><b>Son seçim:</b> ${H ? `${esc(H.aralik || H.hafta || "")}${son ? ` · ${esc(son)}` : ""}${H.kaynak === "panel" ? " · panelde düzenlendi" : ""}` : "Henüz yapılmadı. İlk seçim, özellik açıldıktan sonraki pazartesi sabahı yapılır."}</div>
      ${ozet ? `<div class="ws-ipucu">${esc(ozet)}</div>` : ""}
      ${bekliyor ? `<div class="ws-ipucu"><b>Yeniden seçim istendi</b> (${esc(tarihYaz(HA.yenileIste))}); en geç 1 saat içinde yapılır.</div>` : ""}
    </div>
    <button type="button" class="ws-btn ws-btn-ikincil" onclick="window._webSitesi.haftalikYenile()" ${hfMesgul || !acik ? "disabled" : ""}><i data-lucide="refresh-cw"></i> Bu haftayı yeniden seç</button>
  </section>
  ${HAFTALIK_ALANLAR.map((a) => haftalikAlanHtml(a, Array.isArray(alanlar[a.anahtar]) ? alanlar[a.anahtar] : [])).join("")}`;
}

function haftalikAlanHtml(a, liste) {
  const gecerli = liste.filter((o) => o && o.id && haftalikGorselUrl(o));
  const gorunen = gecerli.filter((o) => o.gizli !== true).length;
  return `<section class="ws-kart ws-hf-alan">
    <div class="ws-kart-ust"><h4>${esc(a.ad)} <small>${gorunen} görsel sitede</small></h4>
      <a class="ws-link" href="${esc(SITE + a.sayfa)}" target="_blank" rel="noopener">Sayfada gör</a></div>
    ${gecerli.length ? `<div class="ws-hf-izgara">${gecerli.map((o) => `<figure class="${o.gizli === true ? "gizli" : ""}">
        <img src="${esc(haftalikGorselUrl(o, 640))}" alt="${esc(o.alt || "")}" loading="lazy">
        <figcaption>
          <small>${esc(o.tarih || "")}${H && o.hafta && o.hafta !== H.hafta ? " · önceki haftadan" : ""}${o.url ? " · elle düzeltildi" : ""}${o.gizli === true ? " · <b>sitede gizli</b>" : ""}</small>
          <span class="ws-hf-dugmeler">
            ${o.gizli === true
              ? `<button type="button" class="ws-btn ws-btn-ikincil" data-alan="${esc(a.anahtar)}" data-id="${esc(o.id)}" onclick="window._webSitesi.haftalikGoster(this.dataset.alan,this.dataset.id)" ${hfMesgul ? "disabled" : ""}><i data-lucide="eye"></i> Geri göster</button>`
              : `<button type="button" class="ws-btn ws-btn-ikincil" data-alan="${esc(a.anahtar)}" data-id="${esc(o.id)}" onclick="window._webSitesi.haftalikDuzelt(this.dataset.alan,this.dataset.id)" ${hfMesgul ? "disabled" : ""}><i data-lucide="scan-face"></i> Yüzleri düzelt</button>
                 <button type="button" class="ws-btn ws-btn-tehlike" data-alan="${esc(a.anahtar)}" data-id="${esc(o.id)}" onclick="window._webSitesi.haftalikKaldir(this.dataset.alan,this.dataset.id)" ${hfMesgul ? "disabled" : ""}><i data-lucide="eye-off"></i> Kaldır</button>`}
          </span>
        </figcaption></figure>`).join("")}</div>`
      : `<div class="ws-bos">Bu alan için henüz görsel seçilmedi. Galeride bu alana yüklenmiş onaylı fotoğraf olduğunda pazartesi seçilir.</div>`}
  </section>`;
}

function hfHazirMi() {
  if (!yetkiliMi()) { toast("Bu bölümü yalnızca yetkili hesaplar değiştirebilir.", "error"); return false; }
  if (!veriHazir) { toast("İçerik sunucudan yüklenmeden değişiklik yapılamaz. Tekrar yükleyin.", "error"); return false; }
  if (hfMesgul) { toast("Önceki işlem sürüyor, birkaç saniye bekleyin.", "info"); return false; }
  return true;
}
async function hfIslem(is, basari) {
  hfMesgul = true; icerikYenile();
  try {
    await is();
    if (basari) toast(basari);
    return true;
  } catch (e) {
    console.error("haftalık görseller:", e);
    toast("Kaydedilemedi: " + (e.code === "permission-denied" ? "bu hesabın yetkisi yok." : (e.message || e)), "error");
    return false;
  } finally {
    hfMesgul = false; icerikYenile();
  }
}
async function haftalikAyarYaz(alanlar) {
  const { fb, db } = P();
  await fb.setDoc(fb.doc(db, "webSitesi", "haftalikAyar"), { ...alanlar, guncellendi: fb.serverTimestamp(), guncelleyen: email() }, { merge: true });
  Object.assign(HA, alanlar);
}
function haftalikAcik(acik) {
  if (!hfHazirMi()) return icerikYenile();
  hfIslem(() => haftalikAyarYaz({ acik: !!acik }), acik ? "✓ Haftalık otomatik güncelleme açıldı." : "✓ Haftalık otomatik güncelleme kapatıldı.");
}
function haftalikSayi(v) {
  if (!hfHazirMi()) return icerikYenile();
  hfIslem(() => haftalikAyarYaz({ alanBasina: alanBasinaCoz(v) }), "✓ Kaydedildi; bir sonraki seçimde uygulanır.");
}
function haftalikYenile() {
  if (!hfHazirMi()) return;
  onayla("Bu hafta yeniden seçilsin mi?", "Sistem en geç 1 saat içinde galeriden yeni kareler seçer ve sitedeki “Bu hafta okulumuzda” bölümlerini günceller. Kaldırdığınız kareler yeniden seçilmez.", "Yeniden seç", () => {
    const { fb } = P();
    hfIslem(async () => { await haftalikAyarYaz({ yenileIste: fb.serverTimestamp() }); HA.yenileIste = new Date(); }, "✓ İstek gönderildi; en geç 1 saat içinde güncellenir.");
  });
}

// Bir kareyi sunucunun belgesinde değiştirir (sunucunun eşzamanlı yazımını ezmemek için işlem içinde).
// ayarDegistir verilirse aynı işlemde haftalikAyar da güncellenir.
async function haftalikOgeGuncelle(alanAd, id, degistir, ayarDegistir) {
  if (!HAFTALIK_ALANLAR.some((a) => a.anahtar === alanAd)) throw new Error("Bilinmeyen alan");
  const { fb, db } = P();
  const ref = fb.doc(db, "webSitesi", "haftalik");
  const ayarRef = fb.doc(db, "webSitesi", "haftalikAyar");
  let yeniBelge = null, yeniAyar = null;
  await fb.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const ayarSnap = ayarDegistir ? await tx.get(ayarRef) : null;
    if (!snap.exists()) throw new Error("Haftalık görsel kaydı bulunamadı; sayfayı yenileyin.");
    const veri = snap.data() || {};
    const liste = Array.isArray(veri.alanlar?.[alanAd]) ? veri.alanlar[alanAd].map((x) => ({ ...x })) : [];
    const i = liste.findIndex((x) => x && x.id === id);
    if (i < 0) throw new Error("Bu kare artık listede yok (yeni seçim yapılmış olabilir); sayfayı yenileyin.");
    liste[i] = degistir(liste[i]);
    tx.update(ref, { [`alanlar.${alanAd}`]: liste, kaynak: "panel", guncellendi: fb.serverTimestamp(), guncelleyen: email() });
    yeniBelge = { ...veri, alanlar: { ...(veri.alanlar || {}), [alanAd]: liste }, kaynak: "panel" };
    if (ayarDegistir) {
      const ayar = ayarSnap && ayarSnap.exists() ? (ayarSnap.data() || {}) : {};
      const ek = ayarDegistir(ayar);
      tx.set(ayarRef, { ...ek, guncellendi: fb.serverTimestamp(), guncelleyen: email() }, { merge: true });
      yeniAyar = { ...ayar, ...ek };
    }
  });
  if (yeniBelge) H = yeniBelge;
  if (yeniAyar) HA = yeniAyar;
}
function haftalikKaldir(alanAd, id) {
  if (!hfHazirMi()) return;
  onayla("Bu kare sitede gizlensin mi?", "Kare “Bu hafta okulumuzda” bölümünden en geç 1 dakika içinde kalkar ve sonraki haftalarda bir daha seçilmez. İsterseniz “Geri göster” ile geri alabilirsiniz.", "Kaldır", () => {
    hfIslem(() => haftalikOgeGuncelle(alanAd, id, (o) => ({ ...o, gizli: true }), (ayar) => ({ haric: haricEkle(ayar.haric, id) })), "✓ Kare sitede gizlendi.");
  });
}
function haftalikGoster(alanAd, id) {
  if (!hfHazirMi()) return;
  hfIslem(() => haftalikOgeGuncelle(alanAd, id, (o) => ({ ...o, gizli: false }), (ayar) => ({ haric: haricCikar(ayar.haric, id) })), "✓ Kare yeniden sitede.");
}
function haftalikDuzelt(alanAd, id) {
  if (!hfHazirMi()) return;
  const o = ((H && H.alanlar && H.alanlar[alanAd]) || []).find((x) => x && x.id === id);
  const kaynakUrl = o && (o.url || o.u1280 || o.u640);
  if (!kaynakUrl || !/^https:\/\//.test(kaynakUrl)) { toast("Bu karenin görseli bulunamadı.", "error"); return; }
  secimHedef = null;
  // Görsel tuvalde işlenebilsin diye sitenin medya aktarıcısından açılır (Bunny / Firebase Storage).
  duzenleyici(`${SITE}/api/ig-media?u=${encodeURIComponent(kaynakUrl)}`, "serbest", (yeni) => {
    hfIslem(() => haftalikOgeGuncelle(alanAd, id, (x) => ({ ...x, url: yeni.url, en: yeni.en || x.en, boy: yeni.boy || x.boy })),
      "✓ Düzeltilmiş kare sitede.");
  }, `haftalik-${alanAd}`, { mod: "bulanik" });
}

// ───────────────────────── Görseller ─────────────────────────
function medyaHtml() {
  const liste = D.medya.liste || [];
  const yerel = Object.keys(V?.gorseller || {});
  return `<section class="ws-kart">
    <div class="ws-kart-ust"><h4>Yüklediğiniz görseller <small>${liste.length}</small></h4>
      <button type="button" class="ws-btn" onclick="window._webSitesi.yeniGorsel()"><i data-lucide="upload"></i> Görsel yükle</button></div>
    <p class="ws-ipucu">Yüklediğiniz her görsel önce düzenleyicide açılır: kırpabilir, döndürebilir, ışığını ayarlayabilir ve yüzleri bulanıklaştırabilirsiniz. Görseller okulun medya sunucusuna (Bunny) yüklenir.</p>
    ${liste.length ? `<div class="ws-galeri">${liste.map((g, i) => `<figure>
        <img src="${esc(gorselUrl(g, 320))}" alt="" loading="lazy">
        <figcaption><span>${esc(g.ad || "Görsel")}</span><small>${esc(tarihYaz(g.tarih))}</small>
          <span class="ws-galeri-dugmeler">
            <button type="button" class="ws-link" onclick="window._webSitesi.medyaDuzenle(${i})">Düzenle</button> ·
            <button type="button" class="ws-link ws-kirmizi" onclick="window._webSitesi.medyaKaldir(${i})">Kaldır</button>
          </span></figcaption></figure>`).join("")}</div>` : `<div class="ws-bos">Henüz görsel yüklemediniz.</div>`}
  </section>
  <section class="ws-kart"><h4>Sitedeki hazır görseller <small>${yerel.length}</small></h4>
    <p class="ws-ipucu">Sitenin kendi fotoğrafları (çocuk yüzleri bulanıklaştırılmış). Slayt ve kutularda doğrudan seçebilirsiniz; düzenlerseniz yeni bir kopya olarak yüklenir.</p>
    <div class="ws-galeri kucuk">${yerel.map((n) => `<figure><img src="${SITE}/img/${encodeURIComponent(n)}-640.webp" alt="" loading="lazy"><figcaption><span>${esc(n)}</span></figcaption></figure>`).join("")}</div>
  </section>`;
}

// ───────────────────────── Yardım ─────────────────────────
function yardimHtml() {
  return `<section class="ws-kart ws-yardim">
    <h4>Kısaca nasıl çalışır?</h4>
    <ol>
      <li><b>Bölümü seçin.</b> Soldaki listeden değiştirmek istediğiniz bölümü açın.</li>
      <li><b>Değiştirin.</b> Yazıları düzenleyin, görsel seçin ya da yükleyin. Kaydedilmemiş değişiklik olan bölümün yanında turuncu bir nokta görünür.</li>
      <li><b>Kaydet ve yayınla.</b> Alttaki düğme içeriği Firestore'a kaydeder. Cloudflare sitesinde görünmesi hedeflenen süre yaklaşık 1 dakikadır; “Siteyi aç” ile kontrol edin. Ana alan adının da bu siteye bağlı olması gerekir.</li>
      <li><b>Geri almak isterseniz</b> “Vazgeç” kaydetmediğiniz değişiklikleri siler; “Varsayılana dön” bölümü sitenin ilk hâline getirir (kaydetmeniz gerekir).</li>
    </ol>
    <h4>Görseller</h4>
    <ul>
      <li>Slaytlarda dikey (4:5), kutularda kare (1:1) görseller kullanın. Düzenleyicide oranı seçip kırpabilirsiniz.</li>
      <li>Çocukların yüzü görünüyorsa düzenleyicide <b>Yüz bulanıklaştır</b> ile yüzün üzerine bir kutu çizin.</li>
      <li>Görseller en fazla 1600 piksel genişliğe küçültülerek yüklenir; sayfanın hızlı açılmasına yardımcı olur.</li>
    </ul>
    <h4>Veli Rehberi</h4>
    <ul>
      <li>Yazıyı listeden bulun (arama kutusu başlık ve özette arar), <b>Düzenle</b> ile açın.</li>
      <li>Başlığı, özeti, metni ve görseli düzeltin. Metin araç çubuğuyla başlık, alt başlık, kalın, italik, liste ve bağlantı yapabilirsiniz; başka yerden yapıştırılan yazı düz metin olarak eklenir.</li>
      <li><b>Kaydet ve yayınla</b> yalnız değiştirdiğiniz yazıları kaydeder. “Bu yazıyı varsayılana döndür” tek yazıyı sitenin ilk hâline getirir.</li>
    </ul>
    <h4>Haftalık görseller</h4>
    <ul>
      <li>Her pazartesi sistem onaylı galeri fotoğraflarından her alan için kare seçer, yüzleri bulanıklaştırır, filigranı kırpar ve alan sayfalarındaki “Bu hafta okulumuzda” bölümüne koyar.</li>
      <li>Kaçan bir yüz görürseniz <b>Yüzleri düzelt</b> ile yüzün üzerine kutu çizin; düzeltilmiş kare siteye geçer. Kareyi hiç istemiyorsanız <b>Kaldır</b>: bir daha seçilmez.</li>
      <li>Otomatik güncellemeyi kapatırsanız yeni seçim yapılmaz; sitedeki son kareler kalır.</li>
    </ul>
    <h4>Kimler değiştirebilir?</h4>
    <p>Yalnızca ${YETKILI.map((e) => `<b>${esc(e)}</b>`).join(" ve ")} hesapları. Bu sınır Firestore güvenlik kuralıyla da korunur.</p>
    <h4>Instagram bölümü</h4>
    <p>Ana sayfadaki Instagram paylaşımları kendiliğinden güncellenir (Behold servisi, günde bir kez); burada ayar gerekmez.</p>
  </section>`;
}

// ───────────────────────── liste işlemleri ─────────────────────────
function listeAl(bolum) { return D[bolum].liste || (D[bolum].liste = []); }

function tasi(bolum, i, yon) {
  const l = listeAl(bolum), j = i + yon;
  if (j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]];
  if (bolum === "slaytlar" && acikSlayt === i) acikSlayt = j;
  if (bolum === "kutular" && acikKutu === i) acikKutu = j;
  icerikYenile();
}
function gorunur(bolum, i) { const o = listeAl(bolum)[i]; o.gorunur = o.gorunur === false; icerikYenile(); }
function ac(bolum, i) {
  if (bolum === "slaytlar") acikSlayt = acikSlayt === i ? null : i;
  else acikKutu = acikKutu === i ? null : i;
  icerikYenile();
}
function ekle(bolum) {
  const l = listeAl(bolum);
  if (bolum === "slaytlar") {
    l.push({ anahtar: yeniId("slayt"), gorunur: true, sekme: "Yeni slayt", baslik: "Yeni slayt başlığı", aciklama: "", notBaslik: "", notMetin: "",
      bilgiler: [{ etiket: "", deger: "" }, { etiket: "", deger: "" }, { etiket: "", deger: "" }], gorsel: null, kolaj: [],
      dugmeMetni: "Okuldan randevu al", dugmeAdresi: "/okulu-ziyaret" });
    acikSlayt = l.length - 1;
  } else {
    l.push({ gorunur: true, baslik: "Yeni kutu", metin: "", adres: "/", gorsel: null });
    acikKutu = l.length - 1;
  }
  icerikYenile();
}
function sil(bolum, i) {
  onayla(`Bu ${bolum === "slaytlar" ? "slayt" : "kutu"} silinsin mi?`, "Kaydetmeden önce “Vazgeç” ile geri alabilirsiniz.", "Sil", () => {
    listeAl(bolum).splice(i, 1);
    acikSlayt = null; acikKutu = null;
    icerikYenile();
  });
}
function kolajAc(i) { const s = D.slaytlar.liste[i]; s.kolaj = s.gorsel ? [s.gorsel] : []; icerikYenile(); gorselSec("slaytlar", i, "kolaj", s.kolaj.length); }
function kolajKapat(i) { const s = D.slaytlar.liste[i]; s.gorsel = s.gorsel || (s.kolaj || [])[0] || null; s.kolaj = []; icerikYenile(); }
function kolajCikar(i, k) { const s = D.slaytlar.liste[i]; s.kolaj.splice(k, 1); if (s.kolaj.length < 2) { s.gorsel = s.kolaj[0] || s.gorsel; s.kolaj = []; } icerikYenile(); }

function soruTasi(gi, qi, yon) {
  const l = D.sss.gruplar[gi].sorular, j = qi + yon;
  if (j < 0 || j >= l.length) return;
  [l[qi], l[j]] = [l[j], l[qi]];
  icerikYenile();
}
function soruSil(gi, qi) {
  onayla("Bu soru silinsin mi?", "Kaydetmeden önce “Vazgeç” ile geri alabilirsiniz. Yalnızca gizlemek isterseniz “Sitede yayında” işaretini kaldırın.", "Sil", () => {
    D.sss.gruplar[gi].sorular.splice(qi, 1);
    icerikYenile();
  });
}
function soruEkle(gi) {
  D.sss.gruplar[gi].sorular.push({ id: yeniId("soru"), gorunur: true, soru: "", cevap: "", anasayfa: false });
  icerikYenile();
  const alanlar = document.querySelectorAll(`[data-yol^="gruplar.${gi}.sorular."][data-yol$=".soru"]`);
  alanlar[alanlar.length - 1]?.focus();
}

// ───────────────────────── onay penceresi ─────────────────────────
function onayla(baslik, metin, dugme, tamam) {
  const kap = document.createElement("div");
  kap.className = "ws-modal";
  kap.innerHTML = `<div class="ws-modal-kutu ws-onay" role="dialog" aria-modal="true" aria-labelledby="wsOnayBaslik">
    <h3 id="wsOnayBaslik">${esc(baslik)}</h3><p>${esc(metin)}</p>
    <div class="ws-modal-alt"><button type="button" class="ws-btn ws-btn-ikincil" data-k="vazgec">Vazgeç</button><button type="button" class="ws-btn ws-btn-tehlike" data-k="tamam">${esc(dugme)}</button></div></div>`;
  document.body.appendChild(kap);
  const kapat = () => kap.remove();
  kap.addEventListener("click", (e) => {
    const k = e.target.closest("[data-k]")?.dataset.k;
    if (e.target === kap || k === "vazgec") kapat();
    if (k === "tamam") { kapat(); tamam(); }
  });
  kap.querySelector('[data-k="vazgec"]').focus();
}

// ───────────────────────── görsel seçici ─────────────────────────
let secimHedef = null; // { bolum, i, alanAd, k }

function gorselSec(bolum, i, alanAd, k) {
  secimHedef = { bolum, i, alanAd, k };
  const yuklenen = D.medya.liste || [];
  const yerel = Object.keys(V?.gorseller || {});
  const kap = document.createElement("div");
  kap.className = "ws-modal";
  kap.innerHTML = `<div class="ws-modal-kutu ws-secici" role="dialog" aria-modal="true" aria-labelledby="wsSeciciBaslik">
    <div class="ws-modal-ust"><h3 id="wsSeciciBaslik">Görsel seçin</h3><button type="button" class="ws-ikon-btn" data-k="kapat" title="Kapat"><i data-lucide="x"></i></button></div>
    <div class="ws-secici-yukle"><button type="button" class="ws-btn" data-k="yukle"><i data-lucide="upload"></i> Bilgisayardan / telefondan yükle</button><span class="ws-ipucu">Yüklenen görsel önce düzenleyicide açılır.</span></div>
    ${yuklenen.length ? `<h4>Yüklediklerim</h4><div class="ws-galeri secim">${yuklenen.map((g, n) => `<button type="button" data-k="medya" data-n="${n}"><img src="${esc(gorselUrl(g, 320))}" alt="${esc(g.ad || "")}" loading="lazy"></button>`).join("")}</div>` : ""}
    <h4>Sitedeki hazır görseller</h4>
    <div class="ws-galeri secim">${yerel.map((n) => `<button type="button" data-k="yerel" data-n="${esc(n)}"><img src="${SITE}/img/${encodeURIComponent(n)}-640.webp" alt="${esc(n)}" loading="lazy"></button>`).join("")}</div>
  </div>`;
  document.body.appendChild(kap);
  lucide();
  const kapat = () => kap.remove();
  kap.addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (e.target === kap) return kapat();
    if (!b) return;
    const k2 = b.dataset.k;
    if (k2 === "kapat") kapat();
    if (k2 === "yukle") { kapat(); dosyaSec((g) => secimiUygula(g)); }
    if (k2 === "medya") { const g = yuklenen[Number(b.dataset.n)]; kapat(); secimiUygula({ url: g.url, en: g.en, boy: g.boy, alt: "" }); }
    if (k2 === "yerel") { kapat(); secimiUygula({ yerel: b.dataset.n, alt: "" }); }
  });
}

function secimiUygula(g) {
  const h = secimHedef;
  if (!h) return;
  if (h.bolum === "rehber") {
    const o = rbDegisiklik(h.i, true);
    const onceki = gorselSade(o.gorsel) || rbEtkin(h.i).gorsel;
    o.gorsel = { ...g, alt: (onceki && onceki.alt) || g.alt || "" };
    secimHedef = null;
    icerikYenile();
    return;
  }
  const o = listeAl(h.bolum)[h.i];
  if (h.alanAd === "kolaj") {
    o.kolaj = o.kolaj || [];
    o.kolaj[h.k] = { ...g, alt: (o.kolaj[h.k] && o.kolaj[h.k].alt) || g.alt || "" };
  } else {
    o.gorsel = { ...g, alt: (o.gorsel && o.gorsel.alt) || g.alt || "" };
  }
  secimHedef = null;
  icerikYenile();
}

function gorseliDuzenle(bolum, i, alanAd) {
  const g = bolum === "rehber" ? rbEtkin(i).gorsel : listeAl(bolum)[i][alanAd];
  if (!g) return;
  secimHedef = { bolum, i, alanAd };
  const kaynak = g.url ? `${SITE}/api/ig-media?u=${encodeURIComponent(g.url)}` : `${SITE}/img/${encodeURIComponent(g.yerel)}-${V?.gorseller?.[g.yerel]?.["1280"] ? "1280" : "640"}.webp`;
  duzenleyici(kaynak, bolum === "kutular" ? "1:1" : "4:5", (yeni) => secimiUygula({ ...yeni, alt: g.alt || "" }));
}

function dosyaSec(sonra) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp,image/heic";
  inp.addEventListener("change", () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast("Lütfen bir görsel dosyası seçin.", "error"); return; }
    const oran = secimHedef ? (secimHedef.bolum === "kutular" ? "1:1" : "4:5") : "serbest";
    duzenleyici(URL.createObjectURL(f), oran, sonra, f.name);
  });
  inp.click();
}

// ───────────────────────── görsel kütüphanesi ─────────────────────────
function yeniGorsel() { secimHedef = null; dosyaSec(() => icerikYenile()); }

function medyaDuzenle(n) {
  const g = D.medya.liste[n];
  secimHedef = null;
  duzenleyici(`${SITE}/api/ig-media?u=${encodeURIComponent(g.url)}`, "serbest", () => icerikYenile(), g.ad);
}

function medyaKaldir(n) {
  const g = D.medya.liste[n];
  const kullanimda = [...(D.slaytlar.liste || []).flatMap((s) => [s.gorsel, ...(s.kolaj || [])]), ...(D.kutular.liste || []).map((k) => k.gorsel),
    ...Object.values(D.rehber?.yazilar || {}).map((o) => o && o.gorsel),
    ...Object.values(H?.alanlar || {}).flatMap((l) => Array.isArray(l) ? l.filter((o) => o && o.gizli !== true) : [])]
    .some((x) => x && x.url === g.url);
  onayla("Görsel kaldırılsın mı?", kullanimda
    ? "Bu görsel şu an bir slaytta, kutuda, Veli Rehberi yazısında ya da haftalık görsellerde kullanılıyor. Kaldırırsanız orada boş görünür; önce başka bir görsel seçmeniz önerilir."
    : "Görsel kütüphaneden ve medya sunucusundan kalıcı olarak silinir.", "Kaldır", async () => {
    try {
      if (g.yol) await P().medya.sil(g.yol);
    } catch (e) { console.warn("Bunny silme:", e); }
    D.medya.liste.splice(n, 1);
    await medyaKaydet();
    icerikYenile();
  });
}

async function medyaKaydet() {
  if (!yetkiliMi() || !veriHazir) throw new Error("Görsel listesi için yetkili hesap ve güncel sunucu verisi gerekli.");
  const { fb, db } = P();
  try {
    await fb.setDoc(fb.doc(db, "webSitesi", "medya"), { liste: D.medya.liste, guncellendi: fb.serverTimestamp(), guncelleyen: email() });
    K.medya = JSON.stringify(temizle("medya", D.medya));
  } catch (e) {
    toast("Görsel listesi kaydedilemedi: " + e.message, "error");
    throw e; // Yükleme akışı başarısız kaydı başarı olarak gösteremez.
  }
}

// ───────────────────────── görsel düzenleyici ─────────────────────────
// Kırp (oranlı/serbest), 90° döndür, parlaklık / kontrast / doygunluk, yüz bulanıklaştırma.
// Çıktı: en fazla 1600 px genişlikte JPEG → portal medya servisiyle Bunny'ye yüklenir.
async function duzenleyici(kaynak, oran, sonra, dosyaAdi, { mod = "kirp" } = {}) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  const yuklendi = new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Görsel açılamadı")); });
  img.src = kaynak;
  try { await yuklendi; } catch (e) { toast(e.message + ". Görseli bilgisayarınızdan yeniden yükleyin.", "error"); return; }

  const S = { rot: 0, br: 100, ct: 100, sat: 100, oran, crop: null, bulanik: [], mod: mod === "bulanik" ? "bulanik" : "kirp", ad: dosyaAdi || "gorsel" };
  const ORANLAR = { "serbest": 0, "4:5": 4 / 5, "1:1": 1, "16:9": 16 / 9 };
  let dondurulmus = null; // döndürülmüş tam boy kaynak (en fazla 2400 px)

  const kap = document.createElement("div");
  kap.className = "ws-modal";
  kap.innerHTML = `<div class="ws-modal-kutu ws-editor" role="dialog" aria-modal="true" aria-labelledby="wsEdBaslik">
    <div class="ws-modal-ust"><h3 id="wsEdBaslik">Görseli düzenle</h3><button type="button" class="ws-ikon-btn" data-k="kapat" title="Kapat"><i data-lucide="x"></i></button></div>
    <div class="ws-ed-govde">
      <div class="ws-ed-sahne" id="wsEdSahne"><canvas id="wsEdTuval"></canvas><canvas id="wsEdUst"></canvas></div>
      <div class="ws-ed-araclar">
        <div class="ws-ed-grup"><span class="ws-etiket">Mod</span>
          <div class="ws-secenekler dugme">
            <button type="button" data-k="mod" data-v="kirp" class="${S.mod === "kirp" ? "secili" : ""}"><i data-lucide="crop"></i> Kırp</button>
            <button type="button" data-k="mod" data-v="bulanik" class="${S.mod === "bulanik" ? "secili" : ""}"><i data-lucide="scan-face"></i> Yüz bulanıklaştır</button>
          </div>
          <p class="ws-ipucu" id="wsEdModIpucu">${S.mod === "kirp" ? "Çerçeveyi sürükleyerek taşıyın, köşesinden büyütüp küçültün." : "Bulanıklaştırmak istediğiniz yüzün üzerine parmağınızla ya da farenizle bir kutu çizin. Birden fazla yüz için tekrarlayın."}</p>
        </div>
        <div class="ws-ed-grup"><span class="ws-etiket">Oran</span>
          <div class="ws-secenekler dugme">${Object.keys(ORANLAR).map((o) => `<button type="button" data-k="oran" data-v="${o}" class="${o === oran ? "secili" : ""}">${o === "serbest" ? "Serbest" : o === "4:5" ? "4:5 slayt" : o === "1:1" ? "1:1 kutu" : "16:9"}</button>`).join("")}</div>
        </div>
        <div class="ws-ed-grup"><span class="ws-etiket">Döndür</span>
          <div class="ws-secenekler dugme"><button type="button" data-k="dondur" data-v="-90"><i data-lucide="rotate-ccw"></i> Sola</button><button type="button" data-k="dondur" data-v="90"><i data-lucide="rotate-cw"></i> Sağa</button></div>
        </div>
        <div class="ws-ed-grup">
          <label class="ws-kaydirici">Parlaklık <input type="range" min="50" max="150" value="100" data-k="br"></label>
          <label class="ws-kaydirici">Kontrast <input type="range" min="50" max="150" value="100" data-k="ct"></label>
          <label class="ws-kaydirici">Renk canlılığı <input type="range" min="0" max="180" value="100" data-k="sat"></label>
        </div>
        <div class="ws-ed-grup">
          <button type="button" class="ws-btn ws-btn-hafif" data-k="geri"><i data-lucide="undo-2"></i> Son bulanıklaştırmayı geri al</button>
          <button type="button" class="ws-btn ws-btn-hafif" data-k="sifirla"><i data-lucide="refresh-ccw"></i> Hepsini sıfırla</button>
        </div>
      </div>
    </div>
    <div class="ws-modal-alt"><span class="ws-ipucu" id="wsEdDurum"></span><button type="button" class="ws-btn ws-btn-ikincil" data-k="kapat">Vazgeç</button><button type="button" class="ws-btn" data-k="kaydet"><i data-lucide="upload"></i> Kaydet ve yükle</button></div>
  </div>`;
  document.body.appendChild(kap);
  lucide();
  const tuval = kap.querySelector("#wsEdTuval"), ust = kap.querySelector("#wsEdUst"), sahne = kap.querySelector("#wsEdSahne");
  const durum = kap.querySelector("#wsEdDurum");

  function dondur() {
    const sinir = 2400;
    const olcek = Math.min(1, sinir / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * olcek), h = Math.round(img.naturalHeight * olcek);
    const yan = S.rot % 180 !== 0;
    const c = document.createElement("canvas");
    c.width = yan ? h : w; c.height = yan ? w : h;
    const x = c.getContext("2d");
    x.translate(c.width / 2, c.height / 2);
    x.rotate((S.rot * Math.PI) / 180);
    x.drawImage(img, -w / 2, -h / 2, w, h);
    dondurulmus = c;
  }
  function cropSifirla() {
    const W = dondurulmus.width, H = dondurulmus.height, r = ORANLAR[S.oran];
    if (!r) { S.crop = { x: 0, y: 0, w: W, h: H }; return; }
    let w = W, h = w / r;
    if (h > H) { h = H; w = h * r; }
    S.crop = { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }
  // Yüz bulanıklaştırma: kutu, kaynakta (tam boy) birkaç piksele küçültülüp hedefte oval bir alana büyütülür.
  function bulanikUygula(ctx, kaynakC, rects, olcek = 1) {
    for (const b of rects) {
      const x = b.x * olcek, y = b.y * olcek, w = b.w * olcek, h = b.h * olcek;
      if (b.w < 4 || b.h < 4) continue;
      const kucuk = document.createElement("canvas");
      const k = Math.max(2, Math.round(Math.min(b.w, b.h) / 12));
      kucuk.width = Math.max(1, Math.round(b.w / k)); kucuk.height = Math.max(1, Math.round(b.h / k));
      const kx = kucuk.getContext("2d");
      kx.imageSmoothingEnabled = true;
      kx.drawImage(kaynakC, b.x, b.y, b.w, b.h, 0, 0, kucuk.width, kucuk.height);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.clip();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(kucuk, 0, 0, kucuk.width, kucuk.height, x, y, w, h);
      ctx.restore();
    }
  }
  let olcekV = 1;
  function ciz2() {
    const maxW = Math.min(sahne.clientWidth || 600, 900), maxH = Math.max(260, Math.min(window.innerHeight * 0.58, 640));
    olcekV = Math.min(maxW / dondurulmus.width, maxH / dondurulmus.height, 1);
    const w = Math.round(dondurulmus.width * olcekV), h = Math.round(dondurulmus.height * olcekV);
    for (const c of [tuval, ust]) { c.width = w; c.height = h; c.style.width = w + "px"; c.style.height = h + "px"; }
    const x = tuval.getContext("2d");
    x.drawImage(dondurulmus, 0, 0, w, h);
    bulanikUygula(x, dondurulmus, S.bulanik, olcekV);
    tuval.style.filter = `brightness(${S.br}%) contrast(${S.ct}%) saturate(${S.sat}%)`;
    ustCiz();
  }
  function ustCiz(gecici) {
    const x = ust.getContext("2d"), w = ust.width, h = ust.height;
    x.clearRect(0, 0, w, h);
    const c = S.crop, cx = c.x * olcekV, cy = c.y * olcekV, cw = c.w * olcekV, ch = c.h * olcekV;
    x.fillStyle = "rgba(10,20,14,.55)";
    x.fillRect(0, 0, w, cy); x.fillRect(0, cy + ch, w, h - cy - ch); x.fillRect(0, cy, cx, ch); x.fillRect(cx + cw, cy, w - cx - cw, ch);
    x.strokeStyle = "#fff"; x.lineWidth = 2; x.strokeRect(cx + 1, cy + 1, cw - 2, ch - 2);
    x.strokeStyle = "rgba(255,255,255,.45)"; x.lineWidth = 1;
    for (let n = 1; n < 3; n++) { x.beginPath(); x.moveTo(cx + (cw * n) / 3, cy); x.lineTo(cx + (cw * n) / 3, cy + ch); x.moveTo(cx, cy + (ch * n) / 3); x.lineTo(cx + cw, cy + (ch * n) / 3); x.stroke(); }
    if (S.mod === "kirp") { x.fillStyle = "#fff"; for (const [px, py] of [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]]) { x.fillRect(px - 7, py - 7, 14, 14); } }
    x.strokeStyle = "#F2B300"; x.lineWidth = 2; x.setLineDash([6, 4]);
    for (const b of S.bulanik.concat(gecici ? [gecici] : [])) { x.beginPath(); x.ellipse((b.x + b.w / 2) * olcekV, (b.y + b.h / 2) * olcekV, (b.w / 2) * olcekV, (b.h / 2) * olcekV, 0, 0, Math.PI * 2); x.stroke(); }
    x.setLineDash([]);
  }
  function yenidenKur(cropKoru) { dondur(); if (!cropKoru || !S.crop) cropSifirla(); ciz2(); }

  // İşaretçi (fare / dokunma)
  let surukle = null;
  function nokta(e) { const r = ust.getBoundingClientRect(); return { x: (e.clientX - r.left) / olcekV, y: (e.clientY - r.top) / olcekV }; }
  ust.addEventListener("pointerdown", (e) => {
    ust.setPointerCapture(e.pointerId);
    const p = nokta(e), c = S.crop, tol = 14 / olcekV;
    if (S.mod === "bulanik") { surukle = { tur: "bulanik", x0: p.x, y0: p.y }; return; }
    const kose = [["sol-ust", c.x, c.y], ["sag-ust", c.x + c.w, c.y], ["sol-alt", c.x, c.y + c.h], ["sag-alt", c.x + c.w, c.y + c.h]]
      .find(([, kx, ky]) => Math.abs(p.x - kx) < tol && Math.abs(p.y - ky) < tol);
    if (kose) surukle = { tur: "kose", kose: kose[0], c0: { ...c } };
    else if (p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h) surukle = { tur: "tasi", dx: p.x - c.x, dy: p.y - c.y };
  });
  ust.addEventListener("pointermove", (e) => {
    if (!surukle) return;
    const p = nokta(e), W = dondurulmus.width, H = dondurulmus.height, r = ORANLAR[S.oran];
    if (surukle.tur === "bulanik") {
      ustCiz({ x: Math.min(surukle.x0, p.x), y: Math.min(surukle.y0, p.y), w: Math.abs(p.x - surukle.x0), h: Math.abs(p.y - surukle.y0) });
      return;
    }
    const c = S.crop;
    if (surukle.tur === "tasi") {
      c.x = Math.max(0, Math.min(W - c.w, p.x - surukle.dx));
      c.y = Math.max(0, Math.min(H - c.h, p.y - surukle.dy));
    } else {
      const c0 = surukle.c0, sag = surukle.kose.includes("sag"), alt = surukle.kose.includes("alt");
      const sabitX = sag ? c0.x : c0.x + c0.w, sabitY = alt ? c0.y : c0.y + c0.h;
      let w = Math.max(40, Math.abs(Math.max(0, Math.min(W, p.x)) - sabitX));
      let h = Math.max(40, Math.abs(Math.max(0, Math.min(H, p.y)) - sabitY));
      if (r) { if (w / h > r) w = h * r; else h = w / r; }
      w = Math.min(w, sag ? W - sabitX : sabitX); h = Math.min(h, alt ? H - sabitY : sabitY);
      if (r) { if (w / h > r) w = h * r; else h = w / r; }
      c.w = w; c.h = h; c.x = sag ? sabitX : sabitX - w; c.y = alt ? sabitY : sabitY - h;
    }
    ustCiz();
  });
  ust.addEventListener("pointerup", (e) => {
    if (surukle && surukle.tur === "bulanik") {
      const p = nokta(e);
      const b = { x: Math.min(surukle.x0, p.x), y: Math.min(surukle.y0, p.y), w: Math.abs(p.x - surukle.x0), h: Math.abs(p.y - surukle.y0) };
      if (b.w > 8 && b.h > 8) { S.bulanik.push(b); ciz2(); }
      else ustCiz();
    }
    surukle = null;
  });

  kap.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (["br", "ct", "sat"].includes(k)) { S[k] = Number(e.target.value); tuval.style.filter = `brightness(${S.br}%) contrast(${S.ct}%) saturate(${S.sat}%)`; }
  });
  const kapat = () => { kap.remove(); window.removeEventListener("resize", ciz2); if (kaynak.startsWith("blob:")) URL.revokeObjectURL(kaynak); };
  kap.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-k]");
    if (!b || b.tagName === "INPUT") return;
    const k = b.dataset.k, v = b.dataset.v;
    if (k === "kapat") kapat();
    if (k === "mod") {
      S.mod = v;
      kap.querySelectorAll('[data-k="mod"]').forEach((x) => x.classList.toggle("secili", x.dataset.v === v));
      kap.querySelector("#wsEdModIpucu").textContent = v === "kirp"
        ? "Çerçeveyi sürükleyerek taşıyın, köşesinden büyütüp küçültün."
        : "Bulanıklaştırmak istediğiniz yüzün üzerine parmağınızla ya da farenizle bir kutu çizin. Birden fazla yüz için tekrarlayın.";
      ustCiz();
    }
    if (k === "oran") { S.oran = v; kap.querySelectorAll('[data-k="oran"]').forEach((x) => x.classList.toggle("secili", x.dataset.v === v)); cropSifirla(); ustCiz(); }
    if (k === "dondur") {
      const W = dondurulmus.width;
      S.rot = (S.rot + Number(v) + 360) % 360;
      // bulanıklaştırma kutularını yeni yöne çevir
      S.bulanik = S.bulanik.map((r) => Number(v) > 0
        ? { x: dondurulmus.height - r.y - r.h, y: r.x, w: r.h, h: r.w }
        : { x: r.y, y: W - r.x - r.w, w: r.h, h: r.w });
      yenidenKur(false);
    }
    if (k === "geri") { S.bulanik.pop(); ciz2(); }
    if (k === "sifirla") { S.rot = 0; S.br = S.ct = S.sat = 100; S.bulanik = []; kap.querySelectorAll('input[type="range"]').forEach((x) => { x.value = 100; }); yenidenKur(false); }
    if (k === "kaydet") {
      b.disabled = true; durum.textContent = "Görsel hazırlanıyor…";
      try {
        const sonuc = await disaAktarVeYukle();
        kapat();
        sonra(sonuc);
      } catch (err) {
        console.error("görsel yükleme:", err);
        durum.textContent = "";
        b.disabled = false;
        toast("Görsel yüklenemedi: " + (err.message || err), "error");
      }
    }
  });

  async function disaAktarVeYukle() {
    // tam boy: döndürülmüş + bulanık + ışık ayarları, sonra kırp ve küçült
    const W = dondurulmus.width, H = dondurulmus.height;
    const tam = document.createElement("canvas"); tam.width = W; tam.height = H;
    const tx = tam.getContext("2d");
    tx.drawImage(dondurulmus, 0, 0);
    bulanikUygula(tx, dondurulmus, S.bulanik, 1);
    const c = S.crop, maks = 1600;
    const olcek = Math.min(1, maks / c.w);
    const out = document.createElement("canvas");
    out.width = Math.round(c.w * olcek); out.height = Math.round(c.h * olcek);
    const ox = out.getContext("2d");
    ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = "high";
    ox.drawImage(tam, c.x, c.y, c.w, c.h, 0, 0, out.width, out.height);
    if (S.br !== 100 || S.ct !== 100 || S.sat !== 100) isikAyarla(ox, out.width, out.height, S.br / 100, S.ct / 100, S.sat / 100);
    const blob = await new Promise((res) => out.toBlob(res, "image/jpeg", 0.86));
    if (!blob) throw new Error("Görsel oluşturulamadı");
    const temizAd = String(S.ad).replace(/\.[^.]+$/, "").toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşıöç]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "gorsel";
    const dosya = new File([blob], `${temizAd}-${Date.now().toString(36)}.jpg`, { type: "image/jpeg" });
    durum.textContent = "Yükleniyor…";
    const ay = new Date().toISOString().slice(0, 7);
    const yuk = await P().medya.yukle(dosya, `web-sitesi/${ay}`, true);
    const kayit = { url: yuk.url, yol: yuk.yol, ad: temizAd, en: out.width, boy: out.height, tarih: new Date().toISOString(), yukleyen: email() };
    D.medya.liste = D.medya.liste || [];
    D.medya.liste.unshift(kayit);
    await medyaKaydet();
    toast("✓ Görsel yüklendi");
    return { url: kayit.url, en: kayit.en, boy: kayit.boy };
  }

  window.addEventListener("resize", ciz2);
  requestAnimationFrame(() => yenidenKur(false));
}

// Parlaklık, kontrast ve doygunluğu piksel düzeyinde uygular (tüm tarayıcılarda aynı sonuç)
function isikAyarla(ctx, w, h, br, ct, sat) {
  const d = ctx.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i] * br, g = p[i + 1] * br, b = p[i + 2] * br;
    r = (r - 128) * ct + 128; g = (g - 128) * ct + 128; b = (b - 128) * ct + 128;
    const gri = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gri + (r - gri) * sat; g = gri + (g - gri) * sat; b = gri + (b - gri) * sat;
    p[i] = r < 0 ? 0 : r > 255 ? 255 : r; p[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; p[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(d, 0, 0);
}

// ───────────────────────── stil ─────────────────────────
function stilEkle() {
  if (document.getElementById("ws-stil")) return;
  const st = document.createElement("style");
  st.id = "ws-stil";
  st.textContent = `
  .ws,.ws-modal{--ws-yesil:#1E4A31;--ws-yaprak:#2F7D45;--ws-sari:#F2B300;--ws-cizgi:#E2E8E0;--ws-zemin:#F6F8F4;--ws-yazi:#17241B;--ws-soluk:#5B6B5F;--ws-kirmizi:#B42318;color:var(--ws-yazi);font-size:14.5px}
  .ws *,.ws-modal *{box-sizing:border-box}
  .ws-ust{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid var(--ws-cizgi);border-radius:14px;padding:12px 16px;margin-bottom:14px}
  .ws-ust p{margin:0;flex:1 1 320px;color:var(--ws-soluk)}
  .ws-duzen{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px;align-items:start}
  @media (max-width:900px){.ws-duzen{grid-template-columns:1fr}.ws-nav{display:flex;overflow-x:auto;gap:8px;padding-bottom:6px}.ws-nav-btn{flex:none;width:auto}.ws-nav-btn small{display:none}}
  .ws-nav{display:grid;gap:6px;position:sticky;top:12px}
  .ws-nav-btn{position:relative;display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:#fff;border:1px solid var(--ws-cizgi);border-radius:12px;padding:10px 12px;cursor:pointer;color:inherit;font:inherit}
  .ws-nav-btn svg{width:18px;height:18px;flex:none;color:var(--ws-yaprak)}
  .ws-nav-btn span{display:grid;gap:1px;min-width:0}
  .ws-nav-btn b{font-weight:700;color:var(--ws-yesil)}
  .ws-nav-btn small{color:var(--ws-soluk);font-size:12px;line-height:1.3}
  .ws-nav-btn.aktif{background:var(--ws-yesil);border-color:var(--ws-yesil)}
  .ws-nav-btn.aktif b,.ws-nav-btn.aktif small,.ws-nav-btn.aktif svg{color:#fff}
  .ws-nokta{position:absolute;top:8px;right:8px;width:9px;height:9px;border-radius:50%;background:#EA8A0C}
  .ws-icerik{min-width:0;display:grid;gap:14px;padding-bottom:90px}
  .ws-baslik h3{margin:0;font-size:20px;color:var(--ws-yesil)}
  .ws-baslik p{margin:2px 0 0;color:var(--ws-soluk)}
  .ws-kart{background:#fff;border:1px solid var(--ws-cizgi);border-radius:14px;padding:16px}
  .ws-kart h4{margin:0 0 6px;font-size:15.5px;color:var(--ws-yesil);display:flex;align-items:center;gap:8px}
  .ws-kart h4 small{font-weight:600;color:var(--ws-soluk);font-size:12px;background:var(--ws-zemin);padding:2px 8px;border-radius:99px}
  .ws-kart-ust{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
  .ws-uyari{border-color:#F5C26B;background:#FFFBEB}
  .ws-not{margin:0;background:var(--ws-zemin);border-radius:12px;padding:10px 14px;color:var(--ws-soluk);line-height:1.5}
  .ws-izgara{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;margin-top:8px}
  @media (max-width:640px){.ws-izgara,.ws-ikili,.ws-form-izgara{grid-template-columns:1fr!important}}
  .ws-alan{display:grid;gap:5px;position:relative;min-width:0}
  .ws-alan label,.ws-etiket{font-weight:700;font-size:13px;color:var(--ws-yazi)}
  .ws-alan input[type=text],.ws-alan input[type=tel],.ws-alan input[type=email],.ws-alan input[type=url],.ws-alan textarea{width:100%;border:1.5px solid var(--ws-cizgi);border-radius:10px;padding:9px 11px;font:inherit;color:inherit;background:#fff;min-height:42px}
  .ws-alan textarea{resize:vertical;line-height:1.5}
  .ws-alan input:focus,.ws-alan textarea:focus{outline:3px solid rgba(47,125,69,.25);border-color:var(--ws-yaprak)}
  .ws-sayac{position:absolute;right:8px;top:0;font-size:11px;color:var(--ws-soluk)}
  .ws-ipucu{margin:0;color:var(--ws-soluk);font-size:12.5px;line-height:1.45}
  .ws-ikili{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .ws-secenekler{display:flex;flex-wrap:wrap;gap:8px 16px}
  .ws-secenekler label{display:inline-flex;align-items:center;gap:6px;font-weight:600;cursor:pointer}
  .ws-secenekler.dugme{gap:6px}
  .ws-secenekler.dugme button{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--ws-cizgi);background:#fff;border-radius:10px;padding:7px 11px;font:inherit;font-weight:600;cursor:pointer;color:inherit}
  .ws-secenekler.dugme button svg{width:16px;height:16px}
  .ws-secenekler.dugme button.secili{border-color:var(--ws-yaprak);background:#EAF4EC;color:var(--ws-yesil)}
  .ws-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:8px 15px;border-radius:10px;border:0;background:var(--ws-yesil);color:#fff;font:inherit;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap}
  .ws-btn svg{width:16px;height:16px}
  .ws-btn:disabled{opacity:.45;cursor:default}
  .ws-btn-ikincil{background:#fff;color:var(--ws-yesil);border:1.5px solid var(--ws-yesil)}
  .ws-btn-hafif{background:var(--ws-zemin);color:var(--ws-yazi)}
  .ws-btn-tehlike{background:#fff;color:var(--ws-kirmizi);border:1.5px solid #F3B5AE}
  .ws-onay .ws-btn-tehlike{background:var(--ws-kirmizi);color:#fff;border-color:var(--ws-kirmizi)}
  .ws-link{background:none;border:0;padding:0;color:var(--ws-yaprak);font:inherit;font-weight:700;text-decoration:underline;cursor:pointer}
  .ws-kirmizi{color:var(--ws-kirmizi)}
  .ws-ikon-btn{width:36px;height:36px;display:inline-grid;place-items:center;border:1px solid var(--ws-cizgi);border-radius:10px;background:#fff;cursor:pointer;color:var(--ws-yesil);padding:0}
  .ws-ikon-btn svg{width:17px;height:17px}
  .ws-ikon-btn:disabled{opacity:.35;cursor:default}
  .ws-anahtar{display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-size:15px}
  .ws-anahtar input{position:absolute;opacity:0;width:1px;height:1px}
  .ws-anahtar span{width:44px;height:26px;border-radius:99px;background:#CBD5CC;position:relative;transition:background .2s}
  .ws-anahtar span::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
  .ws-anahtar input:checked+span{background:var(--ws-yaprak)}
  .ws-anahtar input:checked+span::after{transform:translateX(18px)}
  .ws-anahtar input:focus-visible+span{outline:3px solid rgba(47,125,69,.35)}
  .ws-duyuru{display:flex;align-items:center;gap:14px;background:var(--ws-sari);color:#1F2A10;border-radius:10px;padding:10px 14px;font-weight:600}
  .ws-duyuru.yesil{background:var(--ws-yesil);color:#FAFBF6}
  .ws-duyuru span{flex:1}
  .ws-liste{display:grid;gap:10px}
  .ws-oge{background:#fff;border:1px solid var(--ws-cizgi);border-radius:14px;overflow:hidden}
  .ws-oge.gizli .ws-oge-ust{opacity:.55}
  .ws-oge.acik{border-color:var(--ws-yaprak);box-shadow:0 0 0 3px rgba(47,125,69,.12)}
  .ws-oge-ust{display:flex;align-items:center;gap:12px;padding:10px 12px}
  .ws-sira{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:var(--ws-zemin);font-weight:800;font-size:12px;color:var(--ws-yesil);flex:none}
  .ws-kucuk{width:52px;height:64px;object-fit:cover;border-radius:8px;background:var(--ws-zemin);flex:none}
  .ws-kucuk.kare{height:52px}
  .ws-oge-ad{display:grid;min-width:0;flex:1}
  .ws-oge-ad b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ws-yesil)}
  .ws-oge-ad small{color:var(--ws-soluk);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ws-oge-dugmeler{display:flex;gap:6px;align-items:center;flex:none}
  @media (max-width:640px){.ws-oge-ust{flex-wrap:wrap}.ws-oge-dugmeler{width:100%;justify-content:flex-end}}
  .ws-form{border-top:1px solid var(--ws-cizgi);padding:14px;display:grid;gap:12px;background:#FCFDFB}
  .ws-form h5{margin:6px 0 0;font-size:14px;color:var(--ws-yesil)}
  .ws-form-izgara{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:16px}
  .ws-form-izgara>div{display:grid;gap:12px;align-content:start}
  .ws-form-alt{display:flex;justify-content:flex-end}
  .ws-gorsel-alan{display:grid;gap:10px}
  .ws-gorsel-alan img{width:100%;max-width:280px;aspect-ratio:4/5;object-fit:cover;border-radius:12px;background:var(--ws-zemin)}
  .ws-gorsel-alan.kare img{aspect-ratio:1}
  .ws-gorsel-dugmeler{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .ws-bos{display:grid;place-items:center;min-height:120px;border:2px dashed var(--ws-cizgi);border-radius:12px;color:var(--ws-soluk);padding:14px;text-align:center}
  .ws-kolaj{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .ws-kolaj figure{margin:0;display:grid;gap:4px}
  .ws-kolaj img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px}
  .ws-kolaj figcaption{font-size:12px}
  .ws-ekle{justify-self:start}
  .ws-soru{border-top:1px solid var(--ws-cizgi);padding:12px 0;display:grid;gap:8px}
  .ws-soru.gizli{opacity:.6}
  .ws-soru-ust{display:flex;gap:10px;align-items:end}
  .ws-soru-ust .ws-alan{flex:1}
  .ws-galeri{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:10px}
  .ws-galeri.kucuk{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}
  .ws-galeri figure{margin:0;display:grid;gap:4px}
  .ws-galeri img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:var(--ws-zemin)}
  .ws-galeri figcaption{display:grid;font-size:12px;color:var(--ws-soluk)}
  .ws-galeri figcaption span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ws-yazi);font-weight:600}
  .ws-galeri.secim button{padding:0;border:2px solid transparent;border-radius:12px;background:none;cursor:pointer}
  .ws-galeri.secim button:hover,.ws-galeri.secim button:focus-visible{border-color:var(--ws-yaprak)}
  .ws-kaydet{position:sticky;bottom:10px;z-index:5;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid var(--ws-cizgi);border-radius:14px;padding:10px 14px;box-shadow:0 10px 28px rgba(20,40,25,.14)}
  .ws-kaydet-bilgi{color:var(--ws-soluk);font-size:13px;flex:1 1 260px}
  .ws-degisti{color:#B45309}
  .ws-kaydet-dugmeler{display:flex;flex-wrap:wrap;gap:8px}
  .ws-yardim ol,.ws-yardim ul{margin:6px 0 12px;padding-left:20px;line-height:1.6}
  .ws-modal{position:fixed;inset:0;z-index:10050;background:rgba(10,20,14,.55);display:grid;place-items:center;padding:16px}
  .ws-modal-kutu{background:#fff;border-radius:16px;padding:18px;width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;display:grid;gap:12px;color:#17241B}
  .ws-modal-kutu h3{margin:0;font-size:18px;color:#1E4A31}
  .ws-modal-kutu h4{margin:6px 0 0;font-size:14px;color:#1E4A31}
  .ws-modal-ust{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .ws-modal-alt{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px}
  .ws-modal-alt .ws-ipucu{margin-right:auto}
  .ws-secici{width:min(860px,100%)}
  .ws-secici-yukle{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
  .ws-editor{width:min(1100px,100%)}
  .ws-ed-govde{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;align-items:start}
  @media (max-width:860px){.ws-ed-govde{grid-template-columns:1fr}}
  .ws-ed-sahne{position:relative;display:grid;place-items:center;background:#1B241E;border-radius:12px;min-height:260px;padding:10px;overflow:hidden}
  .ws-ed-sahne canvas{grid-area:1/1;max-width:100%;touch-action:none;position:relative}
  #wsEdTuval{z-index:1}
  #wsEdUst{z-index:2;cursor:crosshair}
  .ws-ed-araclar{display:grid;gap:14px}
  .ws-ed-grup{display:grid;gap:6px}
  .ws-kaydirici{display:grid;gap:4px;font-weight:600;font-size:13px}
  .ws-kaydirici input{width:100%;accent-color:#2F7D45}
  .ws-rozet{display:inline-block;background:#FEF3C7;color:#92400E;border-radius:99px;padding:0 7px;font-weight:700;font-size:11.5px}
  .ws-rb-ara input{width:100%;border:1.5px solid var(--ws-cizgi);border-radius:10px;padding:10px 12px;font:inherit;min-height:44px;background:#fff}
  .ws-rb{display:grid;gap:14px}
  .ws-rb .ws-btn,.ws-hf .ws-btn,.ws-hf-alan .ws-btn,.ws-rb-form .ws-btn{min-height:44px}
  .ws-rb .ws-ikon-btn{width:44px;height:44px}
  .ws-rb-form .ws-alan textarea{min-height:44px}
  .ws-rb-arac{display:flex;flex-wrap:wrap;gap:6px;padding:6px;border:1.5px solid var(--ws-cizgi);border-bottom:0;border-radius:10px 10px 0 0;background:var(--ws-zemin)}
  .ws-rb-metin{min-height:260px;max-height:62vh;overflow:auto;border:1.5px solid var(--ws-cizgi);border-radius:0 0 10px 10px;padding:12px 14px;background:#fff;line-height:1.6;overflow-wrap:break-word}
  .ws-rb-metin .table-wrap{overflow-x:auto;margin:0 0 10px}
  .ws-rb-metin table{border-collapse:collapse;min-width:480px;width:100%;font-size:13.5px}
  .ws-rb-metin th,.ws-rb-metin td{border:1px solid var(--ws-cizgi);padding:6px 8px;vertical-align:top;text-align:left;overflow-wrap:normal}
  .ws-rb-metin th{background:var(--ws-zemin)}
  .ws-rb-metin .muted{color:var(--ws-soluk)}
  .ws-rb-metin .small{font-size:12.5px}
  .ws-rb-metin:focus{outline:3px solid rgba(47,125,69,.25);border-color:var(--ws-yaprak)}
  .ws-rb-metin h2{font-size:18px;margin:16px 0 6px;color:var(--ws-yesil)}
  .ws-rb-metin h3{font-size:16px;margin:14px 0 4px;color:var(--ws-yesil)}
  .ws-rb-metin p{margin:0 0 10px}
  .ws-rb-metin ul,.ws-rb-metin ol{margin:0 0 10px;padding-left:22px}
  .ws-rb-metin blockquote{margin:0 0 10px;padding-left:12px;border-left:3px solid var(--ws-cizgi);color:var(--ws-soluk)}
  .ws-rb-metin a{color:var(--ws-yaprak)}
  .ws-rb-alt{flex-wrap:wrap;gap:8px;justify-content:space-between}
  .ws-hf{display:grid;gap:12px}
  .ws-hf-ayar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 20px}
  .ws-anahtar{min-height:44px}
  .ws-hf-sayi{display:flex;align-items:center;gap:10px}
  .ws-hf-sayi select{min-height:44px;min-width:72px;border:1.5px solid var(--ws-cizgi);border-radius:10px;padding:8px 10px;font:inherit;background:#fff;color:inherit}
  .ws-hf-durum{display:grid;gap:4px;background:var(--ws-zemin);border-radius:12px;padding:10px 14px;line-height:1.5}
  .ws-uyari-satir{margin:0;background:#FFFBEB;border:1px solid #F5C26B;border-radius:10px;padding:8px 12px;font-size:13px}
  .ws-hf .ws-btn{justify-self:start;white-space:normal}
  .ws-hf-izgara{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:10px}
  .ws-hf-izgara figure{margin:0;display:grid;gap:6px;align-content:start}
  .ws-hf-izgara figure.gizli img{opacity:.4;filter:grayscale(1)}
  .ws-hf-izgara img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;background:var(--ws-zemin)}
  .ws-hf-izgara figcaption{display:grid;gap:6px;font-size:12px;color:var(--ws-soluk)}
  .ws-hf-dugmeler{display:grid;gap:6px}
  .ws-hf-dugmeler .ws-btn{width:100%;white-space:normal}
  @media (max-width:640px){.ws-hf-izgara{grid-template-columns:repeat(2,minmax(0,1fr))}.ws-rb-alt .ws-btn{width:100%}}
  /* Telefonda bölüm menüsü yatay kayar ve içeriğin üstünde sabit durmaz (temel .ws-nav kuralından sonra gelmeli) */
  @media (max-width:900px){.ws-nav{display:flex;position:static;overflow-x:auto;gap:8px;padding-bottom:6px;-webkit-overflow-scrolling:touch}.ws-nav-btn{flex:none;width:auto;min-height:44px}.ws-nav-btn small{display:none}}
  `;
  document.head.appendChild(st);
}

// ───────────────────────── dış erişim ─────────────────────────
window._webSitesi = {
  git(id) {
    if (aktif !== id && degisti(aktif)) toast("Önceki bölümde kaydedilmemiş değişiklik var; daha sonra kaydedebilirsiniz.", "info");
    aktif = id; acikSlayt = null; acikKutu = null; ciz();
  },
  alan: alanBagla,
  async kaydet(id) { if (await kaydet(id)) icerikYenile(); },
  vazgec(id) { D[id] = JSON.parse(K[id]); if (id === "sss") D[id] = sssHazirla(D[id]); acikSlayt = null; acikKutu = null; icerikYenile(); cubuguYenile(); },
  varsayilan(id) {
    onayla("Varsayılana dönülsün mü?", "Bu bölüm sitenin ilk hâline getirilir. Sitede uygulanması için ardından “Kaydet ve yayınla”ya basmanız gerekir.", "Varsayılana dön", () => {
      D[id] = bolumVarsayilani(id); if (id === "sss") D[id] = sssHazirla(D[id]); acikSlayt = null; acikKutu = null; icerikYenile();
    });
  },
  tasi, gorunur, ac, ekle, sil, kolajAc, kolajKapat, kolajCikar, soruTasi, soruSil, soruEkle,
  gorselSec, gorseliDuzenle, yeniGorsel, medyaDuzenle, medyaKaldir,
  rehberAc, rehberAra, rehberAlt, rehberVarsayilan,
  haftalikAcik, haftalikSayi, haftalikYenile, haftalikKaldir, haftalikGoster, haftalikDuzelt,
  yenile() { if (kokEl) panelRender(kokEl.id); },
};

window.addEventListener("beforeunload", (e) => {
  if (kokEl && document.body.contains(kokEl) && Object.keys(D).some((id) => degisti(id))) { e.preventDefault(); e.returnValue = ""; }
});
