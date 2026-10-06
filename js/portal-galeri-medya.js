// Prefer explicit type metadata; legacy fallback recognizes direct video extensions and exact known player hosts.
export function galleryMediaType(media = {}) {
  const explicit = String(media.dosyaTipi || '').toLowerCase();
  if (explicit === 'video' || explicit.startsWith('video/')) return 'video';
  if (['foto', 'image', 'photo'].includes(explicit) || explicit.startsWith('image/')) return 'foto';
  const tip = String(media.tip || media.mimeType || media.contentType || '').toLowerCase();
  if (tip === 'video' || tip.startsWith('video/')) return 'video';
  if (['foto', 'image', 'photo'].includes(tip) || tip.startsWith('image/')) return 'foto';
  if (safeMediaUrl(media.mp4Url)) return 'video';
  return [media.bunnyUrl, media.url, media.gorselUrl, isPlayerUrl(media.embedUrl) ? media.embedUrl : ''].some(value => {
    const url = safeMediaUrl(value);if (!url) return false;
    if (isPlayerUrl(url)) return true;
    try { return /\.(mp4|m4v|mov|webm|ogv|m3u8|mpd)$/i.test(decodeURIComponent(new URL(url).pathname)); } catch (_) { return false; }
  }) ? 'video' : 'foto';
}
export function galleryDisplayUrl(media = {}) {
  const sources = mediaSources(media);
  return galleryMediaType(media) === 'video' ? sources.direct[0] || sources.player : sources.image;
}
// Shared renderer for the live Portal approval and parent galleries.
// Direct media URLs must never be embedded as HTML player pages.
export function safeMediaUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : '';
  } catch (_) { return ''; }
}
export function isPlayerUrl(value) {
  try { return ['iframe.mediadelivery.net', 'player.mediadelivery.net', 'player.bunnycdn.com', 'player.bunny.net'].includes(new URL(value).hostname); }
  catch (_) { return false; }
}
export function streamThumbnailUrl(media = {}) {
  const libraryId = String(media.streamLibraryId || '').trim();
  const videoId = String(media.streamVideoId || '').trim();
  if (!/^\d+$/.test(libraryId) || !/^[a-zA-Z0-9-]{8,}$/.test(videoId)) return '';
  const explicitHost = String(media.streamCdnHost || '').trim().toLowerCase();
  const host = explicitHost && /^[a-z0-9.-]+$/.test(explicitHost) ? explicitHost : `vz-${libraryId}.b-cdn.net`;
  const file = String(media.streamThumbnailFileName || 'thumbnail.jpg').replace(/[^a-zA-Z0-9._-]/g, '') || 'thumbnail.jpg';
  return safeMediaUrl(`https://${host}/${videoId}/${file}`);
}
export function mediaSources(media = {}) {
  const urls = [...new Set([media.mp4Url, media.bunnyUrl, media.url, media.gorselUrl, isPlayerUrl(media.embedUrl) ? media.embedUrl : ''].map(safeMediaUrl).filter(Boolean))];
  const direct = urls.filter(url => !isPlayerUrl(url));
  const player = urls.find(isPlayerUrl) || '';
  const poster = safeMediaUrl(media.kucukResim || media.thumbnail) || streamThumbnailUrl(media);
  return { direct, player, poster,
    image:[media.bunnyUrl,media.url,media.gorselUrl].map(safeMediaUrl).find(url=>url&&!isPlayerUrl(url))||'' };
}
export function playerUrl(value) {
  if (!isPlayerUrl(value)) return '';
  const u = new URL(value); u.searchParams.set('autoplay', 'false'); return u.href;
}
export function downloadSource(media) {
  const sources = mediaSources(media);
  return galleryMediaType(media) === 'video' ? sources.direct.find(url => {
    try { return !/\.(m3u8|mpd)$/i.test(decodeURIComponent(new URL(url).pathname)); } catch (_) { return false; }
  }) || '' : sources.image;
}
export function renderMedia(host, media, { thumbnail = false } = {}) {
  const document = host.ownerDocument, sources = mediaSources(media);
  host.replaceChildren();
  host.style.position = 'relative';
  const status = document.createElement('div');
  status.className = 'pg-media-status'; status.setAttribute('role', 'status');
  status.style.cssText = 'padding:18px;color:#e5e7eb;text-align:center;font:13px system-ui;background:#273449;box-sizing:border-box';
  if (thumbnail) status.style.cssText += ';position:absolute;left:0;right:0;bottom:0;padding:10px;background:#273449dd;font-size:11px;pointer-events:none';
  const videoMode = galleryMediaType(media) === 'video';
  const imageUrl = videoMode ? sources.poster : sources.image;
  let disposed = false, current = null;
  const showStatus = text => { status.textContent = text; status.hidden = false; if (!status.parentNode) host.append(status); };
  const dispose = () => {
    disposed = true;
    if (current?.tagName === 'VIDEO') { current.pause(); current.removeAttribute('src'); current.load(); }
    if (current?.tagName === 'IFRAME') current.removeAttribute('src');
  };
  host.__disposeMedia = dispose;
  function directVideo(index = 0) {
    if (disposed) return;
    current?.remove();
    const src = sources.direct[index];
    if (!src) {
      if (sources.player) {
        const iframe = document.createElement('iframe'); current = iframe;
        iframe.src = playerUrl(sources.player);
        iframe.allow = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        iframe.loading = thumbnail ? 'lazy' : 'eager';
        iframe.title = thumbnail ? 'Video önizlemesi' : 'Video oynatıcı';
        iframe.style.cssText = thumbnail
          ? 'width:100%;height:100%;border:0;background:#111;pointer-events:none;display:block'
          : 'display:block;width:100%;aspect-ratio:16/9;min-height:220px;max-height:76vh;border:0;background:#111';
        host.prepend(iframe); status.hidden = true;
        return;
      }
      showStatus(thumbnail ? '▶ Video · açmak için dokunun' : 'Video kaynağı bulunamadı.'); return;
    }
    const video = document.createElement('video'); current = video;
    video.controls = !thumbnail; video.playsInline = true; video.muted = thumbnail;
    video.preload = 'metadata'; if (sources.poster && !thumbnail) video.poster = sources.poster;
    video.style.cssText = thumbnail ? 'width:100%;height:100%;object-fit:cover;pointer-events:none' : 'display:block;width:100%;max-height:76vh;min-height:180px;object-fit:contain;background:#111';
    video.addEventListener('loadeddata', () => { if (!disposed) status.hidden = true; });
    video.addEventListener('loadedmetadata', () => { if (thumbnail) { try { video.currentTime = Math.min(.12, Number.isFinite(video.duration) ? video.duration / 2 : .12); } catch (_) {} } });
    video.addEventListener('error', () => {
      if (disposed) return;
      if (index + 1 < sources.direct.length || sources.player) { directVideo(index + 1); return; }
      showStatus(thumbnail ? '▶ Önizleme kullanılamıyor' : 'Video oynatılamadı. Bağlantı, erişim veya video biçimi desteklenmiyor olabilir.');
      if (!thumbnail) {
        const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Yeniden dene';
        retry.style.cssText = 'display:block;margin:12px auto 0;padding:9px 16px;cursor:pointer';
        retry.addEventListener('click', () => directVideo(0)); status.append(retry);
      }
    });
    showStatus(thumbnail ? '▶ Video' : 'Video yükleniyor… Oynat düğmesini kullanın.');
    host.prepend(video); video.src = src;
  }
  if (!videoMode && !imageUrl) { showStatus('Fotoğraf kaynağı bulunamadı.'); return dispose; }
  if (!videoMode || (thumbnail && imageUrl)) {
    const image = document.createElement('img'); current = image;
    image.alt = videoMode ? 'Video kapağı' : 'Galeri fotoğrafı';
    image.style.cssText = thumbnail ? 'width:100%;height:100%;object-fit:cover' : 'max-width:100%;max-height:76vh;object-fit:contain';
    image.addEventListener('error', () => videoMode ? directVideo() : showStatus('Fotoğraf yüklenemedi.'));
    host.append(image); image.src = imageUrl;
    if(videoMode&&thumbnail)showStatus('▶ Video · açmak için dokunun');
  } else { directVideo(); }
  return dispose;
}
