// Canlı proje için fail-closed randevu geçiş yapılandırması. Üretim backend'i
// ve App Check sağlayıcısı doğrulandıktan sonra etkinleştirilmiştir.
// Tarayıcı depolaması, query-string veya uzak istemci verisi bu bayrağı değiştiremez.
export const RANDEVU_CALLABLE_CUTOVER = Object.freeze({
  enabled: true,
  // Çalışan Firebase uygulamasının projectId değeri bununla tam eşleşmelidir.
  expectedProjectId: 'bcka-site',
  region: 'europe-west3',
  allowedOrigins: Object.freeze([
    'https://portal.bircicekkoleji.com'
  ]),
  // Üretim reCAPTCHA Enterprise anahtarı yalnız portal alan adına sınırlandırılmıştır.
  recaptchaEnterpriseSiteKey: '6Lc0Tr0tAAAAAIT2yEC84rxZAQGhllylqNDK10Um',
  // Yalnız sayfa açıldığında başka bir modül Firebase'i başlatmamışsa
  // kullanılır. Bunlar Firebase'in web istemcisine verdiği herkese açık
  // üretim SDK yapılandırma değerleridir; servis hesabı anahtarı değildir.
  firebaseOptions: Object.freeze({
    apiKey: 'AIzaSyARlqAoh-HRBC9xPwj7qRgG-IuZFSH39Uc',
    authDomain: 'bcka-site.firebaseapp.com',
    projectId: 'bcka-site',
    storageBucket: 'bcka-site.firebasestorage.app',
    messagingSenderId: '736581475783',
    appId: '1:736581475783:web:5729a05ed4d05f1d1d0de2'
  }),
  legacyMode: 'read-only'
});
