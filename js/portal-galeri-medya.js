// Shared renderer for the live Portal approval and parent galleries.
// Direct media URLs must never be embedded as HTML player pages.
export function safeMediaUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : '';
  } catch (_) { return ''; }
}
export function isPlayerUrl(value) {
  try { return ['iframe.mediadelivery.net', 'player.bunnycdn.com', 'player.bunny.net'].includes(new URL(value).hostname); }
  catch (_) { return false; }
}
export function mediaSources(media = {}) {
  const urls = [...new Set([media.mp4Url, media.bunnyUrl, media.url].map(safeMediaUrl).filter(Boolean))];
  const direct = urls.filter(url => !isPlayerUrl(url));
  const player = urls.find(isPlayerUrl) || '';
  return { direct, player, poster:safeMediaUrl(media.kucukResim || media.thumbnail),
    image:safeMediaUrl(media.bunnyUrl || media.url) };
}
export function playerUrl(value) {
  if (!isPlayerUrl(value)) return '';
  const u = new URL(value); u.searchParams.set('autoplay', 'false'); return u.href;
}
export function downloadSource(media) {
  const sources = mediaSources(media);
  return media.dosyaTipi === 'video' ? sources.direct[0] || '' : sources.image;
}
export function renderMedia(host, media, { thumbnail = false } = {}) {
  const document = host.ownerDocument, sources = mediaSources(media);
  host.replaceChildren();
  host.style.position = 'relative';
  const status = document.createElement('div');
  status.className = 'pg-media-status'; status.setAttribute('role', 'status');
  status.style.cssText = 'padding:18px;color:#e5e7eb;text-align:center;font:13px system-ui;background:#273449;box-sizing:border-box';
  if (thumbnail) status.style.cssText += ';position:absolute;left:0;right:0;bottom:0;padding:10px;background:#273449dd;font-size:11px;pointer-events:none';
  const videoMode = media.dosyaTipi === 'video';
  const imageUrl = videoMode ? sources.poster : sources.image;
  let disposed = false, current = null;
  const showStatus = text => { status.textContent = text; status.hidden = false; if (!status.parentNode) host.append(status); };
  const dispose = () => { disposed = true; if (current?.tagName === 'VIDEO') { current.pause(); current.removeAttribute('src'); current.load(); } };
  host.__disposeMedia = dispose;
  function directVideo(index = 0) {
    if (disposed) return;
    current?.remove();
    const src = sources.direct[index];
    if (!src) {
      if (sources.player && !thumbnail) {
        const iframe = document.createElement('iframe'); current = iframe;
        iframe.src = playerUrl(sources.player); iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true; iframe.title = 'Video oynatıcı';
        iframe.style.cssText = 'width:100%;height:65vh;border:0;background:#111'; host.prepend(iframe); status.hidden = true;
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
  } else { directVideo(); }
  return dispose;
}
