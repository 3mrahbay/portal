import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
import { RANDEVU_CALLABLE_CUTOVER } from './zeky-randevu-cutover-config.js';
import {
  randevuCallableAdapter,
  yeniRandevuIstekAnahtari
} from './zeky-randevu-callable-adapter.js';

const REGION_RE = /^[a-z]+-[a-z]+[0-9]$/;
const PROJECT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const SITE_KEY_RE = /^[A-Za-z0-9_-]{20,200}$/;
const FIREBASE_OPTION_KEYS = Object.freeze([
  'apiKey', 'authDomain', 'projectId', 'storageBucket',
  'messagingSenderId', 'appId'
]);
let adapter = null;
let auth = null;
let appCheck = null;
let appCheckHazirlama = null;
let sessionUid = '';
let sessionInvalidated = false;
let sessionWatchStop = null;
const sessionInvalidators = new Set();

function originDogrula() {
  const origins = RANDEVU_CALLABLE_CUTOVER.allowedOrigins;
  const current = String(globalThis.location?.origin || '');
  if (!Array.isArray(origins) || origins.length !== 1 ||
      origins[0] !== 'https://portal.bircicekkoleji.com' ||
      current !== origins[0]) {
    throw new Error('Randevu ekranı bu alan adında kullanılamaz.');
  }
  return true;
}

function firebaseAppGetir() {
  originDogrula();
  const expectedProjectId = String(
    RANDEVU_CALLABLE_CUTOVER.expectedProjectId || ''
  );
  if (!PROJECT_ID_RE.test(expectedProjectId)) {
    throw new Error('Firebase proje sınırı hazır değil.');
  }

  const options = RANDEVU_CALLABLE_CUTOVER.firebaseOptions;
  if (!options || typeof options !== 'object' ||
      options.projectId !== expectedProjectId ||
      FIREBASE_OPTION_KEYS.some(key =>
        typeof options[key] !== 'string' || !options[key]
      )) {
    throw new Error('Firebase proje sınırı uyuşmuyor.');
  }

  const existingApps = getApps();
  if (existingApps.length) {
    if (existingApps.length !== 1 ||
        FIREBASE_OPTION_KEYS.some(key =>
          existingApps[0]?.options?.[key] !== options[key]
        )) {
      throw new Error('Firebase proje sınırı uyuşmuyor.');
    }
    return existingApps[0];
  }
  return initializeApp(options);
}

function firebaseAuthGetir() {
  if (!auth) auth = getAuth(firebaseAppGetir());
  return auth;
}

function appCheckHazirla() {
  if (appCheckHazirlama) return appCheckHazirlama;
  const siteKey = RANDEVU_CALLABLE_CUTOVER.recaptchaEnterpriseSiteKey;
  if (!SITE_KEY_RE.test(siteKey)) {
    throw new Error('App Check sağlayıcısı hazır değil.');
  }
  if (Object.prototype.hasOwnProperty.call(
    globalThis,
    'FIREBASE_APPCHECK_DEBUG_TOKEN'
  )) {
    throw new Error('Dağıtım ortamında App Check debug sağlayıcısı yasaktır.');
  }
  appCheck = initializeAppCheck(firebaseAppGetir(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true
  });
  appCheckHazirlama = getToken(appCheck, false).then(result => {
    if (!result || typeof result.token !== 'string' || !result.token) {
      throw new Error('App Check tokenı alınamadı.');
    }
    return appCheck;
  }).catch(() => {
    appCheck = null;
    appCheckHazirlama = null;
    throw new Error('App Check doğrulaması tamamlanamadı.');
  });
  return appCheckHazirlama;
}

function oturumuGecersizKil() {
  if (sessionInvalidated) return;
  sessionInvalidated = true;
  adapter = null;
  for (const callback of sessionInvalidators) {
    try { callback(); } catch (_) { /* güvenli kapanışı bozma */ }
  }
  sessionInvalidators.clear();
}

function kaliciOturumDenetimiKur(firebaseAuth) {
  if (sessionWatchStop) return;
  sessionWatchStop = onAuthStateChanged(firebaseAuth, user => {
    const currentUid = String(user?.uid || '');
    if (sessionUid && currentUid !== sessionUid) oturumuGecersizKil();
  }, oturumuGecersizKil);
}

export function callableCutoverAcikMi() {
  const expectedProjectId = String(
    RANDEVU_CALLABLE_CUTOVER.expectedProjectId || ''
  );
  const options = RANDEVU_CALLABLE_CUTOVER.firebaseOptions;
  const optionsProjectMatches = typeof options === 'object' &&
    options?.projectId === expectedProjectId;
  let originAllowed = false;
  try { originAllowed = originDogrula(); } catch (_) { /* fail closed */ }
  return originAllowed &&
    RANDEVU_CALLABLE_CUTOVER.enabled === true &&
    RANDEVU_CALLABLE_CUTOVER.legacyMode === 'read-only' &&
    PROJECT_ID_RE.test(expectedProjectId) &&
    optionsProjectMatches &&
    REGION_RE.test(RANDEVU_CALLABLE_CUTOVER.region) &&
    SITE_KEY_RE.test(RANDEVU_CALLABLE_CUTOVER.recaptchaEnterpriseSiteKey);
}

export function oturumKullaniciBekle() {
  return new Promise((resolve, reject) => {
    if (sessionInvalidated) {
      reject(new Error('Oturum değişti; sayfa yeniden açılmalıdır.'));
      return;
    }
    const firebaseAuth = firebaseAuthGetir();
    let kaldir = () => {};
    kaldir = onAuthStateChanged(firebaseAuth, kullanici => {
      kaldir();
      const currentUid = String(kullanici?.uid || '');
      if (!currentUid) {
        reject(new Error('Oturum gerekli.'));
      } else if (sessionUid && currentUid !== sessionUid) {
        oturumuGecersizKil();
        reject(new Error('Oturum değişti; sayfa yeniden açılmalıdır.'));
      } else {
        sessionUid = currentUid;
        kaliciOturumDenetimiKur(firebaseAuth);
        resolve(kullanici);
      }
    }, () => {
      kaldir();
      reject(new Error('Oturum doğrulanamadı.'));
    });
  });
}

export function randevuOturumDegisimiDinle(onInvalidated) {
  if (typeof onInvalidated !== 'function') {
    throw new Error('Oturum değişimi dinleyicisi gerekli.');
  }
  const firebaseAuth = firebaseAuthGetir();
  const currentUid = String(firebaseAuth.currentUser?.uid || '');
  if (!sessionUid || !currentUid || currentUid !== sessionUid || sessionInvalidated) {
    try { onInvalidated(); } catch (_) { /* güvenli kapanışı bozma */ }
    return () => {};
  }
  sessionInvalidators.add(onInvalidated);
  kaliciOturumDenetimiKur(firebaseAuth);
  return () => sessionInvalidators.delete(onInvalidated);
}

export async function randevuServisiGetir() {
  if (!callableCutoverAcikMi()) {
    throw new Error('Randevu servisi güvenli geçiş tamamlanana kadar kapalıdır.');
  }
  await oturumKullaniciBekle();
  if (sessionInvalidated) {
    throw new Error('Oturum değişti; sayfa yeniden açılmalıdır.');
  }
  await appCheckHazirla();
  if (!adapter) {
    adapter = randevuCallableAdapter(getFunctions(
      firebaseAppGetir(),
      RANDEVU_CALLABLE_CUTOVER.region
    ));
  }
  return adapter;
}

// Aynı App Check ve oturum çerçevesini randevu dışındaki callable'lar
// (ör. personelDevamKomutV1) için paylaşır; App Check sayfada bir kez kurulur.
export async function guvenliFunctionsGetir() {
  if (!callableCutoverAcikMi()) {
    throw new Error('Güvenli sunucu bağlantısı bu sayfada kullanılamıyor.');
  }
  await oturumKullaniciBekle();
  if (sessionInvalidated) {
    throw new Error('Oturum değişti; sayfa yeniden açılmalıdır.');
  }
  await appCheckHazirla();
  return getFunctions(firebaseAppGetir(), RANDEVU_CALLABLE_CUTOVER.region);
}

export function istekIzleyiciOlustur() {
  const anahtarlar = new Map();
  return Object.freeze({
    anahtar(action, subject, payload = '') {
      const imza = `${action}\u0000${subject}\u0000${payload}`;
      if (!anahtarlar.has(imza)) {
        anahtarlar.set(imza, yeniRandevuIstekAnahtari());
      }
      return anahtarlar.get(imza);
    },
    tamamla(action, subject, payload = '') {
      anahtarlar.delete(`${action}\u0000${subject}\u0000${payload}`);
    }
  });
}

export function guvenliId(value, max = 120) {
  const text = String(value || '').trim();
  return text && text.length <= max && /^[A-Za-z0-9_-]+$/.test(text)
    ? text
    : '';
}

export function istanbulMillis(localValue) {
  const match = String(localValue || '').match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );
  if (!match) return Number.NaN;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const millis = Date.UTC(year, month - 1, day, hour - 3, minute);
  const check = new Date(millis + 3 * 60 * 60_000);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day || check.getUTCHours() !== hour ||
      check.getUTCMinutes() !== minute || millis % 1_800_000 !== 0) {
    return Number.NaN;
  }
  return millis;
}

const dateTime = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const dateOnly = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric',
  month: 'long', year: 'numeric'
});
const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function zamanYazi(millis) {
  return Number.isSafeInteger(millis) ? dateTime.format(new Date(millis)) : '—';
}

export function gunYazi(millis) {
  return Number.isSafeInteger(millis) ? dateOnly.format(new Date(millis)) : '—';
}

export function gunAnahtari(millis) {
  return Number.isSafeInteger(millis) ? dayKey.format(new Date(millis)) : '';
}

export function dugme(yazi, tikla, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = yazi;
  button.addEventListener('click', tikla);
  return button;
}

export function metinElemani(tag, yazi, className = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = String(yazi || '');
  return node;
}
