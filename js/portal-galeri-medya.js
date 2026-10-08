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
  if (!explicitHost || !/^[a-z0-9.-]+$/.test(explicitHost)) return '';
  const host = explicitHost;
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
export function streamStatusUrl(media = {}) {
  const libraryId = String(media.streamLibraryId || '').trim();
  const videoId = String(media.streamVideoId || '').trim();
  if (!/^\d+$/.test(libraryId) || !/^[a-zA-Z0-9-]{8,}$/.test(videoId)) return '';
  return `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoId)}/play/heatmap`;
}
export async function streamPlaybackInfo(media = {}, fetchImpl = globalThis.fetch) {
  const url = streamStatusUrl(media);
  if (!url || typeof fetchImpl !== 'function') return null;
  const response = await fetchImpl(url, {method:'GET', credentials:'omit', cache:'no-store'});
  if (!response.ok) throw new Error('Stream durumu okunamadı (' + response.status + ')');
  const data = await response.json();
  const video = data?.video || {};
  const status = Number(video.status);
  const progress = Math.max(0, Math.min(100, Number(video.encodeProgress || 0)));
  const ready = [3,4,9,10].includes(status) ||
    (progress >= 100 && Boolean(String(video.availableResolutions || '').trim()));
  const failed = [5,8].includes(status);
  return {
    ready, failed, status, progress,
    thumbnailUrl: safeMediaUrl(data?.thumbnailUrl || ''),
    previewUrl: safeMediaUrl(data?.previewUrl || ''),
    availableResolutions: String(video.availableResolutions || '')
  };
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
  let disposed = false, current = null, streamTimer = null, streamChecks = 0;
  const showStatus = text => { status.textContent = text; status.hidden = false; if (!status.parentNode) host.append(status); };
  const dispose = () => {
    disposed = true;
    if (streamTimer) clearTimeout(streamTimer);
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
  function renderImage(url, fallbackToVideo = false) {
    if (disposed) return;
    current?.remove();
    const image = document.createElement('img'); current = image;
    image.alt = videoMode ? 'Video kapağı' : 'Galeri fotoğrafı';
    image.style.cssText = thumbnail ? 'width:100%;height:100%;object-fit:cover' : 'max-width:100%;max-height:76vh;object-fit:contain';
    image.addEventListener('load', () => { if (!disposed) status.hidden = true; });
    image.addEventListener('error', () => fallbackToVideo ? directVideo() : showStatus('Fotoğraf yüklenemedi.'));
    host.prepend(image); image.src = url;
  }

  function renderReadyVideo() {
    if (disposed) return;
    if (thumbnail && sources.poster) {
      renderImage(sources.poster, true);
      showStatus('▶ Video · açmak için dokunun');
    } else {
      directVideo();
    }
  }

  function renderStreamThumbnail() {
    if (disposed) return;
    current?.remove();
    status.remove?.();
    const shell = document.createElement('div'); current = shell;
    shell.className = 'pg-video-thumbnail';
    shell.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;background:#202c3d;display:grid;place-items:center';
    const play = document.createElement('span');
    play.setAttribute('aria-hidden', 'true'); play.textContent = '▶';
    play.style.cssText = 'position:relative;z-index:2;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:#fffffff0;color:#7c3aed;font:700 22px/1 system-ui;box-shadow:0 4px 16px #0003;padding-left:3px';
    shell.append(play); host.prepend(shell);
    if (!sources.poster) return;
    const image = document.createElement('img');
    image.alt = 'Video kapağı';
    image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1';
    image.addEventListener('load', () => { if (!disposed && !image.parentNode) shell.prepend(image); });
    image.addEventListener('error', () => image.remove());
    image.src = sources.poster;
    // Keep the play control visible while the image loads; append only after a
    // successful load so a broken thumbnail never exposes browser error text.
  }

  const bunnyStream = videoMode && Boolean(streamStatusUrl(media));
  if (bunnyStream && thumbnail) {
    renderStreamThumbnail();
    return dispose;
  }
  if (bunnyStream) {
    const yuklendi = Date.parse(media.yuklemeZamani || media.yuklenmeTarihi || media.olusturmaTarihi || '');
    const kontrolBaslangici = Date.now();
    const eskiKayit = () => Date.now() - Math.min(Number.isFinite(yuklendi) ? yuklendi : kontrolBaslangici, kontrolBaslangici) >= 5 * 60 * 1000;
    const kontrol = async () => {
      if (disposed) return;
      streamChecks++;
      try {
        const info = await streamPlaybackInfo(media);
        if (disposed) return;
        if (info?.thumbnailUrl) sources.poster = info.thumbnailUrl;
        if (info?.failed) {
          showStatus('Video işlenirken bir sorun oluştu. Yönetimin videoyu yeniden yüklemesi gerekiyor.');
          return;
        }
        if (info?.ready) {
          renderReadyVideo();
          return;
        }
        const yuzde = Number.isFinite(info?.progress) && info.progress > 0 ? ' · %' + Math.round(info.progress) : '';
        showStatus('Video hazırlanıyor' + yuzde + '…');
        streamTimer = setTimeout(kontrol, 5000);
      } catch (_) {
        if (disposed) return;
        // Status/heatmap endpoint is advisory. CORS, network or privacy controls
        // must not block an already supplied Bunny player or direct video URL.
        if (sources.direct.length || sources.player) {
          renderReadyVideo();
          status.hidden = true;
          return;
        }
        // With no playable source, keep the bounded retry behaviour so a newly
        // created record can still recover if its metadata arrives shortly after.
        if (eskiKayit() && streamChecks >= 2) {
          showStatus('Video kaynağı henüz hazır değil.');
          return;
        }
        showStatus('Video hazırlanıyor…');
        streamTimer = setTimeout(kontrol, 8000);
      }
    };
    showStatus('Video hazırlanıyor…');
    kontrol();
    return dispose;
  }

  if (!videoMode && !imageUrl) { showStatus('Fotoğraf kaynağı bulunamadı.'); return dispose; }
  if (!videoMode || (thumbnail && imageUrl)) {
    renderImage(imageUrl, videoMode);
    if(videoMode&&thumbnail)showStatus('▶ Video · açmak için dokunun');
  } else { directVideo(); }
  return dispose;
}
