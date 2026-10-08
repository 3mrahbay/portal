// Bunny Stream direct TUS uploader for large gallery videos.
// The browser never receives the Bunny Stream API key.
// A trusted backend creates the video entry and returns a short-lived presigned TUS signature.

export const MAX_VIDEO_BYTES = 600 * 1024 * 1024;
export const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';
const TUS_MODULE = 'https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/+esm';
export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;
export const DEFAULT_RETRY_DELAYS = Object.freeze([0,1000,3000,5000,10000,20000,30000,45000,60000,90000]);
const VIDEO_MIME_BY_EXTENSION = Object.freeze({
  mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', m4v:'video/x-m4v',
  mkv:'video/x-matroska', avi:'video/x-msvideo', mpeg:'video/mpeg', mpg:'video/mpeg'
});
const ALLOWED_MIME = new Set(Object.values(VIDEO_MIME_BY_EXTENSION));
const GENERIC_MIME = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

function extension(name='') {
  const bits=String(name).toLowerCase().split('.');
  return bits.length>1?bits.pop():'';
}
// Selection, upload routing, signer requests and TUS metadata share one contract.
// An extension supplies a MIME only when the browser has no specific MIME.
export function classifyGalleryFile(file) {
  if (!file) return null;
  const type=String(file.type||'').trim().toLowerCase();
  if (type.startsWith('image/')) return {kind:'foto',mimeType:type};
  if (ALLOWED_MIME.has(type)) return {kind:'video',mimeType:type};
  const mimeType=VIDEO_MIME_BY_EXTENSION[extension(file.name)];
  return GENERIC_MIME.has(type) && ALLOWED_MIME.has(mimeType) ? {kind:'video',mimeType} : null;
}
export function validateStreamVideo(file) {
  if (!file) return {ok:false,error:'Video seçilmedi.'};
  const size=Number(file.size||0), classified=classifyGalleryFile(file);
  if (classified?.kind!=='video')
    return {ok:false,error:'Video türü desteklenmiyor. MP4, WEBM, MOV, M4V, MKV, AVI veya MPEG seçin.'};
  if (!Number.isFinite(size) || size<=0) return {ok:false,error:'Video dosyası boş veya boyutu geçersiz.'};
  if (size>MAX_VIDEO_BYTES)
    return {ok:false,error:`Video çok büyük (${(size/1024/1024).toFixed(1)} MB). En fazla 600 MB yüklenebilir.`};
  return {ok:true,mimeType:classified.mimeType};
}

async function jsonResponse(response) {
  const text=await response.text();
  let data=null;
  try { data=JSON.parse(text); } catch (_) {}
  if (!response.ok || !data?.ok) {
    const reason=data?.hata||data?.error||text.slice(0,180)||`HTTP ${response.status}`;
    throw new Error('Bunny Stream yükleme hazırlığı başarısız: '+reason);
  }
  return data;
}

export async function requestStreamAuthorization(file, {
  proxyUrl, sharedKey, fetchImpl=globalThis.fetch
}={}) {
  const valid=validateStreamVideo(file);
  if (!valid.ok) throw new Error(valid.error);
  if (!proxyUrl || typeof fetchImpl!=='function') throw new Error('Video yükleme servisi yapılandırılmamış.');

  const response=await fetchImpl(proxyUrl,{
    method:'POST',
    credentials:'omit',
    redirect:'follow',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({
      anahtar:sharedKey||'',
      islem:'stream_hazirla',
      dosyaAdi:file.name,
      dosyaBoyutu:Number(file.size||0),
      mimeType:valid.mimeType
    })
  });
  const data=await jsonResponse(response);
  for (const key of ['signature','expirationTime','videoId','libraryId']) {
    if (!data[key]) throw new Error('Bunny Stream imza yanıtı eksik: '+key);
  }
  return {
    endpoint:data.endpoint||TUS_ENDPOINT,
    signature:String(data.signature),
    expirationTime:String(data.expirationTime),
    videoId:String(data.videoId),
    libraryId:String(data.libraryId),
    embedUrl:data.embedUrl||`https://iframe.mediadelivery.net/embed/${data.libraryId}/${data.videoId}`,
    thumbnailUrl:data.thumbnailUrl||'',
    collectionId:data.collectionId||''
  };
}

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

export async function uploadStreamVideo(file, {
  authorization,
  onProgress=()=>{},
  tusLoader=()=>import(TUS_MODULE),
  chunkSize=DEFAULT_CHUNK_SIZE
}={}) {
  const valid=validateStreamVideo(file);
  if (!valid.ok) throw new Error(valid.error);
  const auth=authorization;
  if (!auth?.signature || !auth?.videoId || !auth?.libraryId) throw new Error('Bunny Stream yükleme imzası eksik.');

  const tus=await tusLoader();
  const Upload=tus.Upload||tus.default?.Upload;
  if (typeof Upload!=='function') throw new Error('TUS yükleyicisi başlatılamadı.');

  return new Promise((resolve,reject)=>{
    const upload=new Upload(file,{
      endpoint:auth.endpoint||TUS_ENDPOINT,
      retryDelays:[...DEFAULT_RETRY_DELAYS],
      chunkSize,
      removeFingerprintOnSuccess:true,
      metadata:{
        filename:file.name||'video',
        filetype:valid.mimeType,
        title:file.name||'video',
        ...(auth.collectionId?{collection:auth.collectionId}:{})
      },
      headers:{
        AuthorizationSignature:String(auth.signature),
        AuthorizationExpire:String(auth.expirationTime),
        VideoId:String(auth.videoId),
        LibraryId:String(auth.libraryId)
      },
      onError:error=>{
        const source=error instanceof Error?error:new Error(String(error));
        const info=formatTusUploadError(source);
        source.status=info.status;
        source.retryable=info.retryable;
        source.technicalMessage=info.technicalMessage;
        source.userMessage=info.userMessage;
        reject(source);
      },
      onProgress:(uploaded,total)=>{
        const pct=total>0?(uploaded/total)*100:0;
        onProgress({uploaded,total,percent:pct});
      },
      onSuccess:()=>resolve({
        uploadUrl:upload.url||'',
        videoId:String(auth.videoId),
        libraryId:String(auth.libraryId),
        embedUrl:auth.embedUrl||`https://iframe.mediadelivery.net/embed/${auth.libraryId}/${auth.videoId}`,
        thumbnailUrl:auth.thumbnailUrl||''
      })
    });

    // Her imza isteği Bunny'de YENİ bir videoId üretir. Dosya adına göre
    // önceki TUS oturumunu körlemesine resume etmek eski upload URL'sini yeni
    // VideoId/imza ile eşleştirip 4xx hatasına yol açabilir. Aynı sayfadaki
    // ağ kesintileri tus-js-client retryDelays ile zaten sürdürülür; yeni
    // denemede temiz bir TUS oturumu başlatmak daha güvenlidir.
    try {
      upload.start();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export async function bunnyStreamVideoYukle(file, options={}) {
  const authorization=await requestStreamAuthorization(file,options);
  return uploadStreamVideo(file,{...options,authorization});
}
