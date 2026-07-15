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

const CACHE_VERSION = "v11";
const CACHE_NAME = `bircicek-portal-${CACHE_VERSION}`;

// Açılışta önceden cache'lenecek temel kabuk varlıkları
const PRECACHE = [
  "./",
  "./index.html",
  "./okul_logo.png",
  "./manifest.json",
];

// Asla cache'lenmeyecek host'lar (canlı veri / kimlik)
const NO_CACHE_HOSTS = [
  "firestore.googleapis.com",
  "firebaseinstallations.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "www.googleapis.com",
  "script.google.com", // Brevo mail proxy
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Sadece GET'i yönet; POST vb. doğrudan ağa gider
  if (req.method !== "GET") return;

  // Canlı veri / kimlik istekleri: dokunma
  if (NO_CACHE_HOSTS.some((h) => url.hostname.includes(h))) return;

  const isNavigation =
    req.mode === "navigate" ||
    (req.destination === "document") ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js");

  if (isNavigation) {
    // NETWORK-FIRST: güncel sürüm önce, yoksa cache
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

  // CACHE-FIRST: statik varlıklar (resim, font, css, CDN)
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
