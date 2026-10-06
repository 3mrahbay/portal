// Bunny Stream direct TUS uploader for large gallery videos.
// The browser never receives the Bunny Stream API key.
// A trusted backend creates the video entry and returns a short-lived presigned TUS signature.

export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';
const TUS_MODULE = 'https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/+esm';
const ALLOWED_EXTENSIONS = new Set(['mp4','webm','mov','m4v','mkv','avi','mpeg','mpg']);
const ALLOWED_MIME = new Set([
  'video/mp4','video/webm','video/quicktime','video/x-m4v',
  'video/x-matroska','video/x-msvideo','video/mpeg'
]);

function extension(name='') {
  const bits=String(name).toLowerCase().split('.');
  return bits.length>1?bits.pop():'';
}
export function validateStreamVideo(file) {
  if (!file) return {ok:false,error:'Video seçilmedi.'};
  const size=Number(file.size||0), type=String(file.type||'').toLowerCase(), ext=extension(file.name);
  if (!ALLOWED_MIME.has(type) && !ALLOWED_EXTENSIONS.has(ext))
    return {ok:false,error:'Video türü desteklenmiyor. MP4, WEBM, MOV, M4V, MKV, AVI veya MPEG seçin.'};
  if (size<=0) return {ok:false,error:'Video dosyası boş.'};
  if (size>MAX_VIDEO_BYTES)
    return {ok:false,error:`Video çok büyük (${(size/1024/1024).toFixed(1)} MB). En fazla 500 MB yüklenebilir.`};
  return {ok:true};
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
      mimeType:file.type||'application/octet-stream'
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

export async function uploadStreamVideo(file, {
  authorization,
  onProgress=()=>{},
  tusLoader=()=>import(TUS_MODULE),
  chunkSize=8*1024*1024
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
      retryDelays:[0,1000,3000,5000,10000,20000],
      chunkSize,
      removeFingerprintOnSuccess:true,
      metadata:{
        filename:file.name||'video',
        filetype:file.type||'video/mp4',
        title:file.name||'video',
        ...(auth.collectionId?{collection:auth.collectionId}:{})
      },
      headers:{
        AuthorizationSignature:String(auth.signature),
        AuthorizationExpire:String(auth.expirationTime),
        VideoId:String(auth.videoId),
        LibraryId:String(auth.libraryId)
      },
      onError:error=>reject(error instanceof Error?error:new Error(String(error))),
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
