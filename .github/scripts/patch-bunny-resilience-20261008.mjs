import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function occurrences(source, needle) { return source.split(needle).length - 1; }
function replaceExact(path, before, after, expected = 1) {
  const source = read(path);
  const count = occurrences(source, before);
  if (count !== expected) throw new Error(`${path}: expected ${expected} occurrence(s), found ${count}`);
  write(path, source.replace(before, after));
}
function replaceOptional(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) return false;
  write(path, source.replace(before, after));
  return true;
}

const uploader = 'js/bunny-stream-upload.js';
replaceExact(
  uploader,
  "const TUS_MODULE = 'https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/+esm';",
  "const TUS_MODULE = 'https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/+esm';\nexport const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;\nexport const DEFAULT_RETRY_DELAYS = Object.freeze([0,1000,3000,5000,10000,20000,30000,45000,60000,90000]);"
);

const formatter = String.raw`
function uploadStatus(error) {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.originalResponse?.getStatus?.()
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isInteger(value) && value >= 100 && value <= 599) return value;
  }
  const match = String(error?.message || error || '').match(/(?:HTTP\s*)?([45]\d{2})/i);
  return match ? Number(match[1]) : 0;
}

export function formatTusUploadError(error) {
  const technicalMessage = String(error?.message || error || 'Bilinmeyen TUS yükleme hatası').trim();
  const status = uploadStatus(error);
  let retryable = false;
  let userMessage = '';

  if (status === 409 || /conflict|resumeFromPreviousUpload|upload url[^.]{0,80}(?:used|invalid|expired)/i.test(technicalMessage)) {
    userMessage = 'Önceki video yükleme oturumu çakıştı. Yeni temiz yükleme ile tekrar deneyin.';
  } else if (status === 401 || status === 403 || /authorization|signature|forbidden|unauthori[sz]ed|expired signature/i.test(technicalMessage)) {
    userMessage = 'Bunny video yükleme yetkilendirmesi kabul edilmedi. Sayfayı yenileyip yeniden deneyin.';
  } else if (status === 413 || /payload too large|request entity too large|too large|çok büyük/i.test(technicalMessage)) {
    userMessage = 'Video boyutu servis sınırını aşıyor.';
  } else if ([408,425,429,500,502,503,504].includes(status)) {
    retryable = true;
    userMessage = 'Video servisi geçici olarak yanıt vermedi. Bağlantı korunarak yeniden denendi; lütfen tekrar deneyin.';
  } else if (/network|failed to fetch|load failed|connection|internet|offline|timeout|timed out/i.test(technicalMessage)) {
    retryable = true;
    userMessage = 'İnternet bağlantısı kesildi veya Bunny yükleme servisine ulaşılamadı.';
  } else {
    userMessage = 'Video yüklenemedi: ' + technicalMessage.slice(0, 180);
  }

  return { status, retryable, technicalMessage, userMessage };
}
`;
replaceExact(uploader, '\nexport async function uploadStreamVideo(file, {', `${formatter}\nexport async function uploadStreamVideo(file, {`);
replaceExact(uploader, '  chunkSize=8*1024*1024\n}={}) {', '  chunkSize=DEFAULT_CHUNK_SIZE\n}={}) {');
replaceExact(uploader, '      retryDelays:[0,1000,3000,5000,10000,20000],', '      retryDelays:[...DEFAULT_RETRY_DELAYS],');
replaceExact(
  uploader,
  "      onError:error=>reject(error instanceof Error?error:new Error(String(error))),",
  String.raw`      onError:error=>{
        const source=error instanceof Error?error:new Error(String(error));
        const info=formatTusUploadError(source);
        source.status=info.status;
        source.retryable=info.retryable;
        source.technicalMessage=info.technicalMessage;
        source.userMessage=info.userMessage;
        reject(source);
      },`
);

const index = 'index.html';
replaceExact(index, 'import("./js/bunny-stream-upload.js?v=190")', 'import("./js/bunny-stream-upload.js?v=191")');
const oldMap = String.raw`      const hamHata = String(e?.message || e || "Bilinmeyen yükleme hatası");
      const kullaniciHatasi =
        /network|failed to fetch|load failed|connection|internet/i.test(hamHata)
          ? "İnternet bağlantısı kesildi veya Bunny yükleme servisine ulaşılamadı."
        : /401|403|authorization|signature|expire/i.test(hamHata)
          ? "Bunny video yükleme yetkilendirmesi kabul edilmedi. Sayfayı yenileyip yeniden deneyin."
        : /409|resume|upload url|tus/i.test(hamHata)
          ? "Önceki video yükleme oturumu çakıştı. Yeni temiz yükleme ile tekrar deneyin."
        : /413|too large|çok büyük/i.test(hamHata)
          ? "Video boyutu servis sınırını aşıyor."
        : hamHata.slice(0, 220);`;
const newMap = String.raw`      const hamHata = String(e?.technicalMessage || e?.message || e || "Bilinmeyen yükleme hatası");
      const durumKodu = Number(e?.status || e?.statusCode || 0);
      const kullaniciHatasi = String(e?.userMessage || "").trim() ||
        (durumKodu === 409 || /409|conflict|resumeFromPreviousUpload/i.test(hamHata)
          ? "Önceki video yükleme oturumu çakıştı. Yeni temiz yükleme ile tekrar deneyin."
        : durumKodu === 401 || durumKodu === 403 || /authorization|signature|forbidden|unauthori[sz]ed/i.test(hamHata)
          ? "Bunny video yükleme yetkilendirmesi kabul edilmedi. Sayfayı yenileyip yeniden deneyin."
        : durumKodu === 413 || /payload too large|request entity too large|too large|çok büyük/i.test(hamHata)
          ? "Video boyutu servis sınırını aşıyor."
        : /network|failed to fetch|load failed|connection|internet|offline|timeout/i.test(hamHata)
          ? "İnternet bağlantısı kesildi veya Bunny yükleme servisine ulaşılamadı."
        : "Video/dosya yüklenemedi: " + hamHata.slice(0, 180));`;
replaceExact(index, oldMap, newMap);

const legacy = 'portal-galeri-core.js';
const legacyCatch = String.raw`    } catch (e) {
      console.error("Yükleme hatası:", e);
      hatali++;
      // Proxy 404 / HTML dönerse "not valid JSON" hatası gelir.
      // Kullanıcı sebebini görsün, sessizce kaybolmasın.
      const m = String(e && e.message || "");
      if (m.includes("not valid JSON") || m.includes("Unexpected token")) {
        window._galeriProxyHatasi = true;
      }
    }`;
const legacyCatchNew = String.raw`    } catch (e) {
      console.error("Yükleme hatası:", e);
      hatali++;
      const m = String(e?.technicalMessage || e?.message || e || "Bilinmeyen yükleme hatası");
      const mesaj = String(e?.userMessage || "").trim() || ("Video/dosya yüklenemedi: " + m.slice(0, 180));
      yuklemeHatalari.push(f.name + ": " + mesaj);
      const durum = document.getElementById("galeriYuklemeDurum");
      if (durum) durum.textContent = "✗ " + f.name + ": " + mesaj;
      if (m.includes("not valid JSON") || m.includes("Unexpected token")) {
        window._galeriProxyHatasi = true;
      }
    }`;
replaceOptional(legacy, legacyCatch, legacyCatchNew);

replaceExact('serviceworker.js', 'v190-gallery-video-600mb-final', 'v191-bunny-upload-resilience');
replaceExact('serviceworker.js', './js/bunny-stream-upload.js?v=190', './js/bunny-stream-upload.js?v=191');

const testFile = 'tests/bunny-stream-upload.test.mjs';
replaceExact(
  testFile,
  '  MAX_VIDEO_BYTES, validateStreamVideo, requestStreamAuthorization, uploadStreamVideo\n',
  '  MAX_VIDEO_BYTES, DEFAULT_CHUNK_SIZE, DEFAULT_RETRY_DELAYS, formatTusUploadError,\n  validateStreamVideo, requestStreamAuthorization, uploadStreamVideo\n'
);
replaceExact(testFile, '  assert.equal(calls.options.chunkSize,8*1024*1024);', '  assert.equal(calls.options.chunkSize,DEFAULT_CHUNK_SIZE);\n  assert.deepEqual(calls.options.retryDelays,[...DEFAULT_RETRY_DELAYS]);');
let tests = read(testFile);
const extraTests = String.raw`

test('TUS hata açıklaması yalnız gerçek 409 durumunu oturum çakışması sayar',()=>{
  const generic=formatTusUploadError(new Error('tus: unexpected response while creating upload'));
  assert.doesNotMatch(generic.userMessage,/oturumu çakıştı/i);
  assert.match(generic.userMessage,/Video yüklenemedi/i);

  const forbidden=new Error('unexpected response');
  forbidden.originalResponse={getStatus:()=>403};
  assert.match(formatTusUploadError(forbidden).userMessage,/yetkilendirmesi kabul edilmedi/i);

  const conflict=new Error('unexpected response');
  conflict.originalResponse={getStatus:()=>409};
  assert.match(formatTusUploadError(conflict).userMessage,/oturumu çakıştı/i);
});

test('geçici servis ve bağlantı hataları yeniden denenebilir olarak işaretlenir',()=>{
  const unavailable=new Error('HTTP 503 Service Unavailable');
  const serviceInfo=formatTusUploadError(unavailable);
  assert.equal(serviceInfo.status,503);
  assert.equal(serviceInfo.retryable,true);

  const networkInfo=formatTusUploadError(new Error('network connection lost'));
  assert.equal(networkInfo.retryable,true);
});
`;
if (!tests.includes("TUS hata açıklaması yalnız gerçek 409")) {
  tests += extraTests;
  write(testFile, tests);
}

console.log('Portal Bunny upload resilience patch applied.');
