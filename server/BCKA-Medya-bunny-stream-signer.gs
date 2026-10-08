/**
 * BCKA-Medya · Bunny Stream signer patch
 * ---------------------------------------
 * Add this to the existing Apps Script project. Do NOT hard-code Bunny credentials.
 *
 * Required Script Properties:
 * - BUNNY_STREAM_LIBRARY_ID
 * - BUNNY_STREAM_API_KEY
 *
 * Existing request authentication should continue to validate PAYLASIM_ANAHTARI
 * before this function is called.
 */

const BCKA_STREAM_MAX_BYTES = 600 * 1024 * 1024;
const BCKA_STREAM_TYPES = [
  'video/mp4','video/webm','video/quicktime','video/x-m4v',
  'video/x-matroska','video/x-msvideo','video/mpeg'
];

function bckaStreamHex_(bytes) {
  return bytes.map(function(b) {
    var v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function bckaStreamJson_(code, data) {
  // Existing BCKA-Medya projects may already have a JSON response helper.
  // If so, return that helper's result instead.
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ok: code >= 200 && code < 300}, data || {})))
    .setMimeType(ContentService.MimeType.JSON);
}

function bckaStreamHazirla_(istek) {
  var props = PropertiesService.getScriptProperties();
  var libraryId = String(props.getProperty('BUNNY_STREAM_LIBRARY_ID') || '').trim();
  var apiKey = String(props.getProperty('BUNNY_STREAM_API_KEY') || '').trim();
  var cdnHost = String(props.getProperty('BUNNY_STREAM_CDN_HOST') || '').trim().toLowerCase();
  if (!libraryId || !apiKey) throw new Error('Bunny Stream Script Properties eksik.');
  if (cdnHost && !/^[a-z0-9.-]+$/.test(cdnHost)) throw new Error('BUNNY_STREAM_CDN_HOST geçersiz.');

  var ad = String(istek.dosyaAdi || '').trim();
  var boyut = Number(istek.dosyaBoyutu || 0);
  var mime = String(istek.mimeType || '').toLowerCase();

  if (!ad) throw new Error('Video dosya adı eksik.');
  if (!(boyut > 0) || boyut > BCKA_STREAM_MAX_BYTES)
    throw new Error('Video en fazla 600 MB olabilir.');
  if (mime && BCKA_STREAM_TYPES.indexOf(mime) === -1)
    throw new Error('Desteklenmeyen video türü.');

  var createUrl = 'https://video.bunnycdn.com/library/' + encodeURIComponent(libraryId) + '/videos';
  var createRes = UrlFetchApp.fetch(createUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { AccessKey: apiKey },
    payload: JSON.stringify({ title: ad.slice(0, 180) }),
    muteHttpExceptions: true
  });

  var status = createRes.getResponseCode();
  var text = createRes.getContentText();
  var video = {};
  try { video = JSON.parse(text); } catch (_) {}
  if (status < 200 || status >= 300 || !video.guid)
    throw new Error('Bunny Stream video kaydı oluşturulamadı (HTTP ' + status + ').');

  // 6 hours: large mobile uploads need a comfortable authorization window.
  var expirationTime = Math.floor(Date.now() / 1000) + (6 * 60 * 60);
  var signingText = libraryId + apiKey + expirationTime + video.guid;
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    signingText,
    Utilities.Charset.UTF_8
  );
  var signature = bckaStreamHex_(digest);

  return {
    ok: true,
    endpoint: 'https://video.bunnycdn.com/tusupload',
    libraryId: libraryId,
    videoId: String(video.guid),
    signature: signature,
    expirationTime: expirationTime,
    embedUrl: 'https://iframe.mediadelivery.net/embed/' + libraryId + '/' + video.guid,
    cdnHost: cdnHost,
    thumbnailFileName: 'thumbnail.jpg',
    thumbnailUrl: cdnHost ? ('https://' + cdnHost + '/' + video.guid + '/thumbnail.jpg') : ''
  };
}

/**
 * Integrate into the existing doPost after the current shared-key check:
 *
 * if (veri.islem === 'stream_hazirla') {
 *   try {
 *     return bckaStreamJson_(200, bckaStreamHazirla_(veri));
 *   } catch (err) {
 *     return bckaStreamJson_(400, { hata: String(err && err.message || err) });
 *   }
 * }
 *
 * IMPORTANT:
 * - Never return BUNNY_STREAM_API_KEY to the browser.
 * - Keep the existing role/origin/rate validation in front of this operation.
 * - The video bytes do not pass through Apps Script; only the small signing request does.
 */
