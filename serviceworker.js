/* ============================================================
   BİR ÇİÇEK KOLEJİ — PWA SERVICE WORKER
   ------------------------------------------------------------
   Strateji (güvenli / "eski sürüme takılma" önleyici):
   - Navigasyon (HTML) ve uygulama kodu: NETWORK-FIRST
     → her zaman en güncel sürüm; internet yoksa cache'e düş.
   - Statik varlıklar (logo, fontlar, CDN kütüphaneleri): CACHE-FIRST
     → hızlı açılış, tekrar indirme yok.
   - Firebase/Firestore/Auth istekleri: HİÇ cache'lenmez (canlı veri).
   - Her dağıtımda CACHE_VERSION'ı artır → eski cache otomatik silinir.
   ============================================================ */

const CACHE_VERSION = "v138-okul-zili";
const CACHE_NAME = `bircicek-portal-${CACHE_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./aidat-donem-genislet.js",
  "./veli-randevu.html",
  "./veli-randevu-callable.html",
  "./randevu-talepleri.html",
  "./randevu-talepleri-callable.html",
  "./randevu-ayarlar.html",
  "./js/zeky-randevu-cutover-config.js",
  "./js/zeky-randevu-cutover-runtime.js",
  "./js/zeky-randevu-callable-adapter.js",
  "./js/zeky-randevu-parent-page.js",
  "./js/zeky-randevu-staff-page.js",
  "./js/zeky-randevu-modal-koprusu.js?v=10",
  "./js/zeky-veli-odeme-ozeti.js",
  "./js/zeky-galeri-filigran-koprusu.js?v=10",
  "./js/zeky-galeri-onay-egitim.js?v=4",
  "./js/zeky-veli-egitim-koprusu.js?v=9",
  "./js/zeky-veli-ogrenme-deneyimi.js?v=3",
  "./js/zeky-egitim-portfolyo.js?v=2",
  "./js/zeky-veli-donem-raporu.js?v=1",
  "./js/zeky-ogrenci-guvenlik-koprusu.js?v=7",
  "./js/zeky-aktif-donem-senkron.js?v=3",
  "./js/zeky-gozlem-modal-modern.js?v=1",
  "./moduller/veli-egitim-gelisim.js?v=8",
  "./portal-data.js?v=8",
  "./moduller/ogretmen-egitim-gozlem.js?v=6",
  "./moduller/sabah-girisi.js",
  "./moduller/veli-izinleri.js",
  "./moduller/pickup-yetkilileri.js",
  "./moduller/danisma-randevulari.js",
  "./moduller/pdr.js",
  "./moduller/program-belgeleme.js",
  "./moduller/geri-bildirim.js",
  "./moduller/veli-galeri.js",
  "./okul_logo.png",
  "./manifest.json",
];

const NO_CACHE_HOSTS = [
  "firestore.googleapis.com",
  "firebaseinstallations.googleapis.com",
  "firebaseappcheck.googleapis.com",
  "recaptchaenterprise.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "www.googleapis.com",
  "script.google.com",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;
  if (NO_CACHE_HOSTS.some((h) => url.hostname.includes(h))) return;

  const isNavigation =
    req.mode === "navigate" || req.destination === "document" ||
    url.pathname.endsWith(".html") || url.pathname.endsWith(".js");

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
