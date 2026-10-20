// ═══════════════════════════════════════════════════════════════════
// WEB SİTESİ YÖNETİMİ — moduller/web-sitesi.js
//
// bircicekkoleji.com içeriğini portaldan değiştirme:
//   Genel bilgiler · Duyuru şeridi · Ana sayfa slaytları · Program kutuları ·
//   Sık sorulan sorular · Görseller (yükle, düzenle, kaldır)
//
// Veri:   Firestore webSitesi/{genel|duyuru|slaytlar|kutular|sss|medya}
// Yetki:  yalnızca emrahby@gmail.com ve eposta@bircicekkoleji.com
//         (Firestore kuralı match /webSitesi/{belge} ile birebir)
// Yayın:  Sitenin sunucusu (Cloudflare) kaydedilen içeriği en geç 1 dakika içinde sayfalara uygular.
//         Panelde hiç kaydedilmemiş bölüm sitede olduğu gibi kalır.
// Varsayılanlar: <site>/site-varsayilan.json (sitenin bugünkü içeriği ve görsel listesi)
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
  { id: "medya",    ad: "Görseller",           ikon: "image",            aciklama: "Yükle, düzenle, kaldır" },
  { id: "gorunurluk", ad: "Görünürlük",       ikon: "trending-up",      aciklama: "Google aramaları, kelimeler, semtler" },
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

// ───────────────────────── veri ─────────────────────────
async function varsayilanlariAl() {
  const r = await fetch(SITE + "/site-varsayilan.json", { cache: "no-store" });
  if (!r.ok) throw new Error("Sitenin varsayılan içeriği alınamadı (HTTP " + r.status + ")");
  return r.json();
}

function bolumVarsayilani(id) {
  if (id === "medya") return { liste: [] };
  return kopya(V?.[id] || {});
}

async function yukle() {
  veriHazir = false;
  const { fb, db } = P();
  V = await varsayilanlariAl();
  const belgeler = ["genel", "duyuru", "slaytlar", "kutular", "sss", "medya"];
  // Hata, 'belge yok' anlamına gelmez. Eski önbellekle içerik ezilmesini de önle.
  const sonuc = await Promise.all(belgeler.map((id) => fb.getDoc(fb.doc(db, "webSitesi", id))));
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
    D[id] = d;
    K[id] = JSON.stringify(temizle(id, d));
  });
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
  const o = kopya(d) || {};
  if (id === "sss") {
    for (const g of o.gruplar || []) for (const q of g.sorular || []) delete q.cevapHtml;
  }
  return o;
}

function degisti(id) { return D[id] && JSON.stringify(temizle(id, D[id])) !== K[id]; }

async function kaydet(id) {
  if (!yetkiliMi()) { toast("Bu bölümü yalnızca yetkili hesaplar değiştirebilir.", "error"); return false; }
  if (!veriHazir) { toast("İçerik sunucudan yüklenmeden kaydedilemez. Tekrar yükleyin.", "error"); return false; }
  const hata = dogrula(id);
  if (hata) { toast(hata, "error"); return false; }
  const { fb, db } = P();
  const veri = temizle(id, D[id]);
  try {
    await fb.setDoc(fb.doc(db, "webSitesi", id), { ...veri, guncellendi: fb.serverTimestamp(), guncelleyen: email() });
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
  return "";
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
  if (id === "yardim" || id === "medya" || id === "gorunurluk") return "";
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
}

function bolumHtml(id) {
  const b = BOLUMLER.find((x) => x.id === id);
  const govde = { genel: genelHtml, duyuru: duyuruHtml, slaytlar: slaytlarHtml, kutular: kutularHtml, sss: sssHtml, medya: medyaHtml, gorunurluk: gorunurlukHtml, yardim: yardimHtml }[id]();
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
  // Görünürlük raporları ayrı modülde: moduller/gorunurluk.js
  if (id === "gorunurluk") window.modulYukle?.("gorunurluk").then((m) => m && m.panelRender("wsGorunurluk"));
}

function gorunurlukHtml() {
  return `<div id="wsGorunurluk"><div class="loading"><div class="spinner"></div><p>Görünürlük raporu yükleniyor...</p></div></div>`;
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
  const o = listeAl(bolum)[i];
  const g = o[alanAd];
  if (!g) return;
  secimHedef = { bolum, i, alanAd };
  const kaynak = g.url ? `${SITE}/api/ig-media?u=${encodeURIComponent(g.url)}` : `${SITE}/img/${encodeURIComponent(g.yerel)}-${V.gorseller[g.yerel]["1280"] ? "1280" : "640"}.webp`;
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
  const kullanimda = [...(D.slaytlar.liste || []).flatMap((s) => [s.gorsel, ...(s.kolaj || [])]), ...(D.kutular.liste || []).map((k) => k.gorsel)]
    .some((x) => x && x.url === g.url);
  onayla("Görsel kaldırılsın mı?", kullanimda
    ? "Bu görsel şu an bir slaytta ya da kutuda kullanılıyor. Kaldırırsanız orada boş görünür; önce başka bir görsel seçmeniz önerilir."
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
async function duzenleyici(kaynak, oran, sonra, dosyaAdi) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  const yuklendi = new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Görsel açılamadı")); });
  img.src = kaynak;
  try { await yuklendi; } catch (e) { toast(e.message + ". Görseli bilgisayarınızdan yeniden yükleyin.", "error"); return; }

  const S = { rot: 0, br: 100, ct: 100, sat: 100, oran, crop: null, bulanik: [], mod: "kirp", ad: dosyaAdi || "gorsel" };
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
            <button type="button" data-k="mod" data-v="kirp" class="secili"><i data-lucide="crop"></i> Kırp</button>
            <button type="button" data-k="mod" data-v="bulanik"><i data-lucide="scan-face"></i> Yüz bulanıklaştır</button>
          </div>
          <p class="ws-ipucu" id="wsEdModIpucu">Çerçeveyi sürükleyerek taşıyın, köşesinden büyütüp küçültün.</p>
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
  yenile() { if (kokEl) panelRender(kokEl.id); },
};

window.addEventListener("beforeunload", (e) => {
  if (kokEl && document.body.contains(kokEl) && Object.keys(D).some((id) => degisti(id))) { e.preventDefault(); e.returnValue = ""; }
});
