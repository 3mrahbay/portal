import fs from 'node:fs';

function read(path){ return fs.readFileSync(path,'utf8'); }
function write(path,content){ fs.writeFileSync(path,content); }
function replaceExact(path,before,after,expected=1){
  const source=read(path); const found=source.split(before).length-1;
  if(found!==expected) throw new Error(`${path}: expected ${expected} occurrence(s), found ${found}: ${before.slice(0,120)}`);
  write(path,source.replaceAll(before,after));
}
function replaceRegex(path,pattern,replacement,expected=1){
  const source=read(path); const matcher=new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'); const matches=[...source.matchAll(matcher)];
  if(matches.length!==expected) throw new Error(`${path}: expected ${expected} regex match(es), found ${matches.length}: ${pattern}`);
  write(path,source.replace(pattern,replacement));
}

// 1) Shared media renderer: thumbnails must stay visual-only; a status API outage
// must never add a second panel beside an otherwise playable video.
const mediaPath='js/portal-galeri-medya.js';
replaceExact(mediaPath,
`  function renderReadyVideo() {
    if (disposed) return;
    if (thumbnail && sources.poster) {
      renderImage(sources.poster, true);
      showStatus('▶ Video · açmak için dokunun');
    } else {
      directVideo();
    }
  }

  const bunnyStream = videoMode && Boolean(streamStatusUrl(media));`,
`  function renderReadyVideo() {
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
  }`);

replaceExact(mediaPath,
`      } catch (_) {
        if (disposed) return;
        // Ağ hatası kodlama hatası değildir. Kaydın yaşı her kontrolde ilerler;
        // tarih eksik/gelecekte olsa bile durum servisi oynatmayı sonsuza dek engellemez.
        if (eskiKayit() && streamChecks >= 2) {
          renderReadyVideo();
          showStatus(sources.direct.length || sources.player
            ? 'Video durumu doğrulanamadı; oynatmayı deneyebilirsiniz.'
            : 'Video durumu doğrulanamadı ve oynatılabilir kaynak bulunamadı.');
          return;
        }
        showStatus('Video durumu şu anda doğrulanamıyor. Yeniden deneniyor…');
        streamTimer = setTimeout(kontrol, 8000);
      }`,
`      } catch (_) {
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
      }`);

// 2) One deterministic media host in every lightbox and visual-only cards.
const livePath='js/portal-galeri-canli.js';
replaceExact(livePath,"import { renderMedia, downloadSource } from './portal-galeri-medya.js?v=188';","import { renderMedia, downloadSource } from './portal-galeri-medya.js?v=192';");
replaceExact(livePath,
`      const old = card.querySelector(':scope > img, :scope > video');
      if (old) { const fallback = old.nextElementSibling; if (fallback?.style.background.includes('31, 41, 55') || fallback?.style.background === '#1f2937') fallback.remove(); old.remove(); }
      const host = document.createElement('div'); host.style.cssText = 'width:100%;height:100%;background:#273449'; card.prepend(host);
      mountMedia(host, media, {thumbnail:true});`,
`      const old = card.querySelector(':scope > img, :scope > video, :scope > iframe');
      const oldPoster = old?.tagName === 'IMG' ? (old.currentSrc || old.src || old.getAttribute?.('src') || '') : '';
      if (old) { const fallback = old.nextElementSibling; if (fallback?.style?.background?.includes('31, 41, 55') || fallback?.style?.background === '#1f2937') fallback.remove(); old.remove(); }
      const host = document.createElement('div'); host.className = 'pg-gallery-card-media'; host.style.cssText = 'width:100%;height:100%;background:#273449;overflow:hidden'; card.prepend(host);
      const cardMedia = oldPoster && !media.kucukResim && !media.thumbnail ? {...media,kucukResim:oldPoster} : media;
      mountMedia(host, cardMedia, {thumbnail:true});`);

replaceRegex(livePath,/function replaceActivePlayer\(media, ticket\) \{[\s\S]*?\n\}\nexport function installLiveGallery/,
`function lightboxMediaHost(container) {
  const panel = container.querySelector('.zgo-medya') || container;
  const existing = Array.from(panel.children || []).filter(node => node?.dataset?.pgLightboxMediaHost === 'true');
  const host = existing.shift() || panel.ownerDocument.createElement('div');
  for (const duplicate of existing) { duplicate.__disposeMedia?.(); duplicate.remove(); }
  for (const child of Array.from(panel.children || [])) {
    if (child === host) continue;
    const mediaNode = ['VIDEO','IFRAME','IMG'].includes(child.tagName) || child.className === 'pg-media-status' || child?.dataset?.pgMedia;
    if (mediaNode) { child.__disposeMedia?.(); child.remove(); }
  }
  host.dataset.pgLightboxMediaHost = 'true';
  host.className = 'pg-lightbox-media-host';
  host.style.cssText = 'width:100%;height:100%;min-width:0;min-height:220px;display:grid;place-items:center;background:#111;overflow:hidden';
  if (!host.parentNode) panel.prepend(host);
  return host;
}
function replaceActivePlayer(media, ticket) {
  if (ticket !== sequence || active?.id !== media.id) return;
  const container = document.getElementById('galeriLightboxIcerik'); if (!container) return;
  const host = lightboxMediaHost(container);
  if (host.dataset.pgMedia === media.id) return;
  disposeMedia(host); mountMedia(host, media);
}
export function installLiveGallery`,1);

replaceExact(livePath,"  if (win.__portalGaleriCanli166) return true;","  if (win.__portalGaleriCanli192) return true;");
replaceExact(livePath,
`  if (!win.PortalAPI || typeof win.acGaleriLightbox !== 'function' || typeof win.veliAcGaleriLightbox !== 'function') return false;
  for (const [name, parent] of [['acGaleriLightbox', false], ['veliAcGaleriLightbox', true]]) {`,
`  if (!win.PortalAPI || typeof win.acGaleriLightbox !== 'function' || typeof win.veliAcGaleriLightbox !== 'function') return false;
  win.__portalGaleriCanliAktif = true;
  for (const [name, parent] of [['acGaleriLightbox', false], ['veliAcGaleriLightbox', true]]) {`);
replaceExact(livePath,
`    win[name] = function(id, ...args) {
      const media = currentMedia(id, parent); if (!media) return;
      disposeMedia(document.getElementById('galeriLightboxIcerik'));
      active = media; const ticket = ++sequence;
      const result = original.call(this, id, ...args);
      reportControl();
      downloadControl();
      replaceActivePlayer(media, ticket);
      // Existing education approval wrapper adds the details pane asynchronously.
      win.setTimeout(() => replaceActivePlayer(media, ticket), 0);
      if (parent) recordOpen(media);
      return result;
    };`,
`    const wrapped = function(id, ...args) {
      const media = currentMedia(id, parent); if (!media) return;
      disposeMedia(document.getElementById('galeriLightboxIcerik'));
      active = media; const ticket = ++sequence;
      const result = original.call(this, id, ...args);
      reportControl();
      downloadControl();
      replaceActivePlayer(media, ticket);
      // Existing education approval wrapper adds the details pane asynchronously.
      win.setTimeout(() => replaceActivePlayer(media, ticket), 0);
      if (parent) recordOpen(media);
      return result;
    };
    wrapped.__portalGaleriCanli = true;
    if (original.__zekyEgitimDetay) wrapped.__zekyEgitimDetay = true;
    wrapped.__eski = original;
    win[name] = wrapped;`);
replaceExact(livePath,
`  const close = win.closeGaleriLightbox;
  win.closeGaleriLightbox = function(...args) { ++sequence; active = null; reportControl(); downloadControl(); disposeMedia(document.getElementById('galeriLightboxIcerik')); return close?.apply(this, args); };`,
`  const close = win.closeGaleriLightbox;
  const wrappedClose = function(...args) { ++sequence; active = null; reportControl(); downloadControl(); disposeMedia(document.getElementById('galeriLightboxIcerik')); return close?.apply(this, args); };
  if (close?.__zekyEgitimKapat) wrappedClose.__zekyEgitimKapat = true;
  wrappedClose.__eski = close;
  win.closeGaleriLightbox = wrappedClose;`);
replaceExact(livePath,"  win.__portalGaleriCanli166 = true; return true;","  win.__portalGaleriCanli192 = true; return true;");

// 3) Upload metadata, a guaranteed edit action, and a clean lightbox handoff.
const corePath='portal-galeri-core.js';
replaceExact(corePath,'    opt.dataset.ad = o.ogrenciAdSoyad || "";','    opt.dataset.ad = o.ogrenciAdSoyad || "";\n    opt.dataset.sinif = sinif || "";');
replaceExact(corePath,'  let hedefDeger = "", hedefOgrenciAd = "";','  let hedefDeger = "", hedefOgrenciAd = "", hedefSinifAd = "";');
replaceExact(corePath,
`    hedefDeger = document.getElementById("galeriHedefSinif").value;
    if (!hedefDeger) return showToast("Sınıf seçin", "error");`,
`    const sinifSecici = document.getElementById("galeriHedefSinif");
    hedefDeger = sinifSecici.value;
    if (!hedefDeger) return showToast("Sınıf seçin", "error");
    hedefSinifAd = sinifSecici.options?.[sinifSecici.selectedIndex]?.textContent?.trim() || hedefDeger;`);
replaceExact(corePath,
`    hedefOgrenciAd = sel.options[sel.selectedIndex]?.dataset?.ad || "";`,
`    hedefOgrenciAd = sel.options[sel.selectedIndex]?.dataset?.ad || "";
    hedefSinifAd = sel.options[sel.selectedIndex]?.dataset?.sinif || "";`);
replaceExact(corePath,
`      let oge = {
        etkinlikBaslik: etkinlik,`,
`      const aktifKullanici = B.kullanici() || {};
      const yukleyenAd = aktifKullanici.adSoyad || aktifKullanici.displayName ||
        [aktifKullanici.ad, aktifKullanici.soyad].filter(Boolean).join(" ") ||
        aktifKullanici.email || "";
      const yukleyenRol = B.rol() || aktifKullanici.rol || "";
      const hedefEtiket = hedefTur === "tumOkul" ? "Tüm okul" :
        hedefTur === "sinif" ? (hedefSinifAd || hedefDeger) :
        (hedefOgrenciAd || hedefDeger);
      let oge = {
        etkinlikBaslik: etkinlik,`);
replaceExact(corePath,
`        hedefTur, hedefDeger, hedefOgrenciAd,
        // Öğrenci hedefliyse id'yi ayrıca yaz — okuma tarafı iki adı da destekler
        hedefOgrenciId: (hedefTur === "ogrenci" ? hedefDeger : ""),
        yukleyen: B.kullanici().email,`,
`        hedefTur, hedefDeger, hedefOgrenciAd, hedefSinifAd, hedefEtiket,
        // Öğrenci hedefliyse id'yi ayrıca yaz — okuma tarafı iki adı da destekler
        hedefOgrenciId: (hedefTur === "ogrenci" ? hedefDeger : ""),
        yukleyen: aktifKullanici.email || "",
        yukleyenAd,
        yukleyenRol,
        yukleyenUid: aktifKullanici.uid || "",`);
replaceExact(corePath,
`        oge.streamLibraryId = sonuc.libraryId;
        oge.videoSaglayici = "bunny-stream";`,
`        oge.streamLibraryId = sonuc.libraryId;
        oge.streamCdnHost = sonuc.cdnHost || "";
        oge.streamThumbnailFileName = sonuc.thumbnailFileName || "thumbnail.jpg";
        oge.videoSaglayici = "bunny-stream";`);

replaceRegex(corePath,/window\.acGaleriLightbox = function\(id\) \{[\s\S]*?\n\};\n\nwindow\.closeGaleriLightbox/,
`window.acGaleriLightbox = function(id) {
  const oge = galeriListesiVerisi.find(g => g.id === id);
  if (!oge) return;
  aktifLightboxOge = oge;
  document.getElementById("galeriLightbox").classList.add("active");

  const icerik = document.getElementById("galeriLightboxIcerik");
  if (window.__portalGaleriCanliAktif) {
    icerik.innerHTML = '<div data-pg-lightbox-media-host="true" class="pg-lightbox-media-host" style="width:100%;height:100%;min-height:220px;display:grid;place-items:center;background:#111;overflow:hidden"></div>';
  } else if (oge.dosyaTipi === "video") {
    const videoUrl = oge.embedUrl || oge.bunnyUrl || oge.url || "";
    const iframeVideo = /iframe\\.mediadelivery\\.net|player\\.bunnycdn\\.com|player\\.bunny\\.net/i.test(videoUrl);
    icerik.innerHTML = iframeVideo
      ? \`<iframe src="\${escapeHtml(videoUrl)}\${videoUrl.includes("?") ? "&" : "?"}autoplay=true" style="width:90vw; max-width:1200px; height:70vh; border:none; background:black;" allowfullscreen allow="autoplay; fullscreen"></iframe>\`
      : \`<video src="\${escapeHtml(videoUrl)}" controls autoplay playsinline preload="metadata" poster="\${escapeHtml(oge.kucukResim || oge.thumbnail || "")}" style="width:90vw; max-width:1200px; max-height:78vh; background:black; object-fit:contain;"></video>\`;
  } else {
    icerik.innerHTML = \`<img src="\${escapeHtml(oge.bunnyUrl || oge.url || "")}" style="max-width:95vw; max-height:90vh; object-fit:contain;">\`;
  }
  const duzenleBtn = document.getElementById("galeriLightboxDuzenleBtn");
  const yonetimMi = B.yoneticiMi() || ["kurucu_mudur", "mudur"].includes(B.rol());
  if (duzenleBtn) {
    duzenleBtn.style.display = yonetimMi ? "inline-flex" : "none";
    duzenleBtn.onclick = event => {
      event?.stopPropagation?.();
      window.galeriGonderiDuzenle?.(oge.id);
    };
  }
  if (window.lucideYenile) setTimeout(window.lucideYenile, 30);
};

window.closeGaleriLightbox`,1);
replaceExact(corePath,'window.galeriGonderiDuzenle = async function(id) {','window.galeriGonderiDuzenle = async function(id) {\n  id = id || aktifLightboxOge?.id || "";');

// 4) Education/detail panel uses stored labels and safe fallbacks for old rows.
const educationPath='js/zeky-galeri-onay-egitim.js';
replaceExact(educationPath,"const KURULUM='__zekyGaleriOnayEgitimV3';","const KURULUM='__zekyGaleriOnayEgitimV4';");
replaceExact(educationPath,
`function tarih(m){const d=new Date(m?.tarih||m?.yuklemeZamani||m?.olusturmaTarihi||'');return isNaN(d)?'':d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});}`,
`function tarih(m){const d=new Date(m?.tarih||m?.yuklemeZamani||m?.olusturmaTarihi||'');return isNaN(d)?'':d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});}
function hedefEtiketi(m){if(m?.hedefEtiket)return m.hedefEtiket;if(m?.hedefTur==='tumOkul')return'Tüm okul';if(m?.hedefTur==='sinif')return m.hedefSinifAd||m.sinifAdi||m.hedefDeger||'Sınıf';if(m?.hedefTur==='ogrenci')return m.hedefOgrenciAd||m.ogrenciAdSoyad||m.ogrenciAd||m.hedefDeger||'Öğrenci';return m?.hedefOgrenciAd||m?.hedefDeger||'—';}
function sinifEtiketi(m){return m?.hedefSinifAd||m?.sinifAdi||m?.sinif||m?.grupAd||((m?.hedefTur==='sinif'&&m?.hedefDeger)||'—');}
function yukleyenEtiketi(m){return m?.yukleyenAd||m?.yukleyenAdSoyad||m?.gonderenAd||m?.olusturanAd||m?.yukleyen||m?.yukleyenEmail||'—';}
function rolEtiketi(m){const r=String(m?.yukleyenRol||m?.gonderenRol||'').replace(/_/g,' ').trim();return r?r.replace(/(^|\\s)\\S/g,x=>x.toLocaleUpperCase('tr')):'—';}`);

replaceRegex(educationPath,/function detayHTML\(m\)\{[\s\S]*?\}\n\nfunction lightboxZenginlestir/,
`function detayHTML(m){
  const p=PROGRAM[programKodu(m)]||m.programAd||'Eğitim',a=ASAMA[m.gozlemDurum]||m.gozlemDurum||'Gelişim aşaması';
  const hedef=hedefEtiketi(m),sinif=sinifEtiketi(m),ogrenci=m.hedefOgrenciAd||m.ogrenciAdSoyad||m.ogrenciAd||(m.hedefTur==='ogrenci'?m.hedefDeger:'—');
  return\`<aside class="zgo-detay"><div style="font-size:10px;font-weight:850;letter-spacing:.8px;color:#738279">EĞİTİM ONAYI</div><h3>\${esc(m.baslik||m.kazanimAdi||m.etkinlikBaslik||'Eğitim kazanımı')}</h3><div class="zgo-rozetler"><span class="zgo-rozet">\${esc(p)}</span><span class="zgo-rozet" style="background:#FFF5D8;color:#9A6800">\${esc(a)}</span>\${m.alanAd?\`<span class="zgo-rozet" style="background:#EEF2F7;color:#536274">\${esc(m.alanAd)}</span>\`:''}</div>\${m.aciklama?\`<div class="zgo-aciklama"><b style="display:block;font-size:11px;color:#2D6A45;margin-bottom:5px">Gözlem açıklaması</b>\${esc(m.aciklama)}</div>\`:'<div class="zgo-aciklama" style="color:#8B9690">Bu gözlem için açıklama girilmemiş.</div>'}<div class="zgo-bilgi"><span>Gönderim hedefi</span><b>\${esc(hedef)}</b><span>Öğrenci</span><b>\${esc(ogrenci||'—')}</b><span>Sınıf</span><b>\${esc(sinif)}</b><span>Gelişim alanı</span><b>\${esc(m.alanAd||m.alanId||'—')}</b><span>Grup</span><b>\${esc(m.grupAd||'—')}</b><span>Gönderen</span><b>\${esc(yukleyenEtiketi(m))}</b><span>Gönderen rolü</span><b>\${esc(rolEtiketi(m))}</b><span>Tarih</span><b>\${esc(tarih(m)||'—')}</b></div>\${bekliyor(m)&&yonetimMi()?\`<div class="zgo-actions"><button type="button" data-zgo-red style="background:#DC2626">Reddet</button><button type="button" data-zgo-onay style="background:#168447">Onayla</button></div>\`:''}</aside>\`;
}

function lightboxZenginlestir`,1);

replaceRegex(educationPath,/function lightboxZenginlestir\(id\)\{[\s\S]*?\n\}\n\nfunction fonksiyonlariSar/,
`function lightboxZenginlestir(id){
  const m=veri(id),icerik=document.getElementById('galeriLightboxIcerik');if(!m||!icerik||!egitimMi(m))return;
  if(icerik.classList.contains('zgo-grid')&&icerik.querySelector('.zgo-detay'))return;
  const mediaHost=icerik.querySelector('[data-pg-lightbox-media-host]')||icerik.querySelector('[data-pg-media]');
  const medya=mediaHost?[mediaHost]:Array.from(icerik.childNodes).filter(n=>!n.classList?.contains?.('zgo-detay'));
  icerik.classList.add('zgo-grid');
  icerik.style.cssText='background:white;border-radius:16px;overflow:hidden;max-height:92vh;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;justify-content:center;max-width:94vw';
  icerik.innerHTML=\`<div class="zgo-medya" style="min-width:0;background:#111;display:grid;place-items:center;overflow:hidden"></div>\${detayHTML(m)}\`;
  const hedef=icerik.querySelector('.zgo-medya');hedef.append(...medya);
  const img=hedef.querySelector('img');if(img)img.style.cssText='width:100%;height:100%;max-width:min(64vw,980px);max-height:92vh;object-fit:contain';
  icerik.querySelector('[data-zgo-onay]')?.addEventListener('click',async()=>{window.closeGaleriLightbox?.();await window.galeriOnayla?.(id);});
  icerik.querySelector('[data-zgo-red]')?.addEventListener('click',async()=>{window.closeGaleriLightbox?.();await window.galeriReddet?.(id);});
}

function fonksiyonlariSar`,1);

// 5) Large mobile upload: smaller chunks above 500 MiB, same-authorisation
// resume on a manual retry, and exact progress diagnostics on failure.
const uploadPath='js/bunny-stream-upload.js';
replaceExact(uploadPath,
`export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;
export const DEFAULT_RETRY_DELAYS = Object.freeze([0,1000,3000,5000,10000,20000,30000,45000,60000,90000]);`,
`export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;
export const LARGE_VIDEO_THRESHOLD = 500 * 1024 * 1024;
export const LARGE_VIDEO_CHUNK_SIZE = 2 * 1024 * 1024;
export const DEFAULT_RETRY_DELAYS = Object.freeze([0,1000,3000,5000,10000,20000,30000,45000,60000,90000,120000]);
const activeAuthorizations = new Map();`);
replaceExact(uploadPath,
`    thumbnailUrl:data.thumbnailUrl||'',
    collectionId:data.collectionId||''`,
`    thumbnailUrl:data.thumbnailUrl||'',
    cdnHost:data.cdnHost||'',
    thumbnailFileName:data.thumbnailFileName||'thumbnail.jpg',
    collectionId:data.collectionId||''`);
replaceExact(uploadPath,
`export async function uploadStreamVideo(file, {
  authorization,
  onProgress=()=>{},
  tusLoader=()=>import(TUS_MODULE),
  chunkSize=DEFAULT_CHUNK_SIZE
}={}) {`,
`export function chunkSizeForVideo(file) {
  return Number(file?.size || 0) > LARGE_VIDEO_THRESHOLD ? LARGE_VIDEO_CHUNK_SIZE : DEFAULT_CHUNK_SIZE;
}
function uploadFingerprint(file, auth) {
  return ['bcka-stream',auth.libraryId,auth.videoId,file.name||'',file.type||'',file.size||0,file.lastModified||0].join('-');
}
function fileAuthorizationKey(file) {
  return [file?.name||'',file?.type||'',file?.size||0,file?.lastModified||0].join('|');
}
export async function uploadStreamVideo(file, {
  authorization,
  onProgress=()=>{},
  tusLoader=()=>import(TUS_MODULE),
  chunkSize
}={}) {`);
replaceExact(uploadPath,
`  return new Promise((resolve,reject)=>{
    const upload=new Upload(file,{
      endpoint:auth.endpoint||TUS_ENDPOINT,
      retryDelays:[...DEFAULT_RETRY_DELAYS],
      chunkSize,`,
`  const selectedChunkSize = Number(chunkSize) > 0 ? Number(chunkSize) : chunkSizeForVideo(file);
  let lastUploaded = 0, lastTotal = Number(file.size || 0);
  return new Promise((resolve,reject)=>{
    const upload=new Upload(file,{
      endpoint:auth.endpoint||TUS_ENDPOINT,
      retryDelays:[...DEFAULT_RETRY_DELAYS],
      chunkSize:selectedChunkSize,
      fingerprint:()=>Promise.resolve(uploadFingerprint(file,auth)),`);
replaceExact(uploadPath,
`      onError:error=>{
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
      },`,
`      onError:error=>{
        const source=error instanceof Error?error:new Error(String(error));
        const info=formatTusUploadError(source);
        const pct=lastTotal>0?(lastUploaded/lastTotal)*100:0;
        source.status=info.status;
        source.retryable=info.retryable;
        source.uploadedBytes=lastUploaded;
        source.totalBytes=lastTotal;
        source.uploadPercent=pct;
        source.technicalMessage=info.technicalMessage;
        source.userMessage=info.userMessage + (lastUploaded>0 ? \` Yükleme %\${Math.floor(pct)} (\${(lastUploaded/1024/1024).toFixed(1)}/\${(lastTotal/1024/1024).toFixed(1)} MB) aşamasında durdu.\` : '');
        reject(source);
      },
      onProgress:(uploaded,total)=>{
        lastUploaded=Number(uploaded||0);lastTotal=Number(total||file.size||0);
        const pct=lastTotal>0?(lastUploaded/lastTotal)*100:0;
        onProgress({uploaded:lastUploaded,total:lastTotal,percent:pct});
      },`);
replaceExact(uploadPath,
`        thumbnailUrl:auth.thumbnailUrl||''
      })`,
`        thumbnailUrl:auth.thumbnailUrl||'',
        cdnHost:auth.cdnHost||'',
        thumbnailFileName:auth.thumbnailFileName||'thumbnail.jpg'
      })`);
replaceExact(uploadPath,
`    try {
      upload.start();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }`,
`    Promise.resolve().then(async()=>{
      try {
        const previous = typeof upload.findPreviousUploads === 'function' ? await upload.findPreviousUploads() : [];
        if (previous?.length && typeof upload.resumeFromPreviousUpload === 'function') upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });`);
replaceExact(uploadPath,
`export async function bunnyStreamVideoYukle(file, options={}) {
  const authorization=await requestStreamAuthorization(file,options);
  return uploadStreamVideo(file,{...options,authorization});
}`,
`export async function bunnyStreamVideoYukle(file, options={}) {
  const key=fileAuthorizationKey(file),now=Math.floor(Date.now()/1000);
  let authorization=activeAuthorizations.get(key);
  if (!authorization || Number(authorization.expirationTime||0) <= now + 300) {
    authorization=await requestStreamAuthorization(file,options);
    activeAuthorizations.set(key,authorization);
  }
  try {
    const result=await uploadStreamVideo(file,{...options,authorization});
    activeAuthorizations.delete(key);
    return result;
  } catch (error) {
    if ([401,403,409,413].includes(Number(error?.status||0))) activeAuthorizations.delete(key);
    throw error;
  }
}`);

// 6) Signer returns an exact CDN thumbnail when configured.
const signerPath='server/BCKA-Medya-bunny-stream-signer.gs';
replaceExact(signerPath,
`  var apiKey = String(props.getProperty('BUNNY_STREAM_API_KEY') || '').trim();
  if (!libraryId || !apiKey) throw new Error('Bunny Stream Script Properties eksik.');`,
`  var apiKey = String(props.getProperty('BUNNY_STREAM_API_KEY') || '').trim();
  var cdnHost = String(props.getProperty('BUNNY_STREAM_CDN_HOST') || '').trim().toLowerCase();
  if (!libraryId || !apiKey) throw new Error('Bunny Stream Script Properties eksik.');
  if (cdnHost && !/^[a-z0-9.-]+$/.test(cdnHost)) throw new Error('BUNNY_STREAM_CDN_HOST geçersiz.');`);
replaceExact(signerPath,
`    expirationTime: expirationTime,
    embedUrl: 'https://iframe.mediadelivery.net/embed/' + libraryId + '/' + video.guid
  };`,
`    expirationTime: expirationTime,
    embedUrl: 'https://iframe.mediadelivery.net/embed/' + libraryId + '/' + video.guid,
    cdnHost: cdnHost,
    thumbnailFileName: 'thumbnail.jpg',
    thumbnailUrl: cdnHost ? ('https://' + cdnHost + '/' + video.guid + '/thumbnail.jpg') : ''
  };`);

// 7) Import/cache generation alignment.
replaceExact('js/zeky-galeri-filigran-koprusu.js',"import './zeky-galeri-onay-egitim.js?v=5';","import './zeky-galeri-onay-egitim.js?v=6';");
replaceExact('js/zeky-galeri-filigran-koprusu.js',"import './portal-galeri-canli.js?v=188';","import './portal-galeri-canli.js?v=192';");
replaceExact('js/portal-galeri-klasor-ui.js',"from './portal-galeri-canli.js?v=188';","from './portal-galeri-canli.js?v=192';");
replaceExact('moduller/veli-galeri.js',"from '../js/portal-galeri-canli.js?v=188';","from '../js/portal-galeri-canli.js?v=192';");
replaceExact('moduller/veli-galeri.js',"from '../js/portal-galeri-medya.js?v=188';","from '../js/portal-galeri-medya.js?v=192';");
replaceExact('serviceworker.js','const CACHE_VERSION = "v191-bunny-upload-resilience";','const CACHE_VERSION = "v192-gallery-media-ui";');
for (const [before,after] of [
  ['./js/portal-galeri-canli.js?v=188','./js/portal-galeri-canli.js?v=192'],
  ['./js/portal-galeri-medya.js?v=188','./js/portal-galeri-medya.js?v=192'],
  ['./js/portal-galeri-klasor-ui.js?v=188','./js/portal-galeri-klasor-ui.js?v=192'],
  ['./js/zeky-galeri-filigran-koprusu.js?v=188','./js/zeky-galeri-filigran-koprusu.js?v=192'],
  ['./js/zeky-galeri-onay-egitim.js?v=5','./js/zeky-galeri-onay-egitim.js?v=6'],
  ['./moduller/veli-galeri.js?v=v189','./moduller/veli-galeri.js?v=v192']
]) replaceExact('serviceworker.js',before,after);
replaceExact('index.html','window.PORTAL_SURUM = "v191";','window.PORTAL_SURUM = "v192";');
replaceExact('index.html','serviceworker.js?v=191','serviceworker.js?v=192');
replaceExact('index.html','portalSwReload_v191','portalSwReload_v192');

// Release-delivery tests follow the new exact URLs and generation.
replaceExact('tests/portal-media-release-delivery.test.mjs',"target==='js/bunny-stream-upload.js'?'?v=191':'?v=188'","['js/bunny-stream-upload.js','js/portal-galeri-canli.js','js/portal-galeri-medya.js'].includes(target)?'?v=192':'?v=188'");
replaceExact('tests/portal-media-release-delivery.test.mjs',"assert.equal(pwa.cacheVersion,'v191-bunny-upload-resilience');","assert.equal(pwa.cacheVersion,'v192-gallery-media-ui');");
replaceExact('tests/portal-media-release-delivery.test.mjs',"stored.get('portalSwReload_v191')","stored.get('portalSwReload_v192')");
replaceExact('tests/portal-media-release-delivery.test.mjs',"new Map([['portalSwReload_v188','1']])","new Map([['portalSwReload_v191','1']])");

// Status recovery contract: a status API outage may not block a playable source.
const recoveryTest=`import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {streamThumbnailUrl,mediaSources,downloadSource,renderMedia} from '../js/portal-galeri-medya.js';
const source=fs.readFileSync(new URL('../js/portal-galeri-medya.js',import.meta.url),'utf8').replace(/export /g,'');
const video={dosyaTipi:'video',streamLibraryId:'123456',streamVideoId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',embedUrl:'https://iframe.mediadelivery.net/embed/123456/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'};
class Element{constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.style={};this.events={};this.hidden=false;this.dataset={};this.className='';this.textContent='';}get parentNode(){return this.parent;}remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}append(...items){for(const x of items){x.remove();x.parent=this;this.children.push(x);}}prepend(x){x.remove();x.parent=this;this.children.unshift(x);}replaceChildren(...items){for(const x of this.children)x.parent=null;this.children=[];this.append(...items);}setAttribute(){}removeAttribute(key){if(key==='src')this.src='';}addEventListener(name,fn){this.events[name]=fn;}pause(){}load(){}}
async function fixture({status='error',thumbnail=false,extra={},fetchImpl}={}){let calls=0,next=0;const timers=new Map();const c={URL,Date,console,setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),fetch:async()=>{calls++;if(fetchImpl)return fetchImpl();if(status==='error')throw Error('synthetic offline');return{ok:true,json:async()=>({video:{status,encodeProgress:status===3?100:20,availableResolutions:status===3?'720p':''}})};}};vm.createContext(c);vm.runInContext(source,c);const doc={createElement:tag=>new Element(tag,doc)},host=new Element('div',doc);const dispose=c.renderMedia(host,{...video,...extra},{thumbnail});await new Promise(setImmediate);return{host,dispose,timers,get calls(){return calls;},get iframe(){return host.children.find(x=>x.tagName==='IFRAME');},get status(){return host.children.find(x=>x.className==='pg-media-status');}};}
test('status endpoint outage never blocks supplied Bunny player or adds a second status panel',async()=>{const f=await fixture();assert.ok(f.iframe);assert.equal(f.timers.size,0);assert.equal(f.status?.hidden,true);});
test('stream thumbnail is visual-only and never calls status endpoint',async()=>{const f=await fixture({thumbnail:true,extra:{kucukResim:'https://example.invalid/cover.jpg'}});assert.equal(f.calls,0);assert.equal(f.host.children[0].className,'pg-video-thumbnail');assert.equal(f.host.children.some(x=>x.className==='pg-media-status'),false);});
test('confirmed processing and encoder failure remain explicit',async()=>{const p=await fixture({status:2});assert.equal(p.iframe,undefined);assert.match(p.status.textContent,/hazırlanıyor.*%20/);assert.equal(p.timers.size,1);p.dispose();const e=await fixture({status:5});assert.equal(e.iframe,undefined);assert.match(e.status.textContent,/yeniden yüklemesi/);});
test('ready response renders supplied player',async()=>{const f=await fixture({status:3});assert.ok(f.iframe);assert.equal(f.timers.size,0);});
test('status outage without playable source remains bounded and truthful',async()=>{const f=await fixture({extra:{embedUrl:''}});assert.equal(f.iframe,undefined);assert.match(f.status.textContent,/hazırlanıyor/);assert.equal(f.timers.size,1);});
test('Stream thumbnails still require explicit host or supplied thumbnail',()=>{assert.equal(streamThumbnailUrl(video),'');assert.equal(mediaSources(video).poster,'');assert.equal(streamThumbnailUrl({...video,streamCdnHost:'https://bad.invalid'}),'');assert.equal(streamThumbnailUrl({...video,streamCdnHost:'vz-known.b-cdn.net'}),\`https://vz-known.b-cdn.net/\${video.streamVideoId}/thumbnail.jpg\`);assert.equal(mediaSources({...video,kucukResim:'https://example.invalid/provided.jpg'}).poster,'https://example.invalid/provided.jpg');});
test('Firebase legacy URL and download source remain unchanged',()=>{const url='https://firebasestorage.googleapis.com/v0/b/synthetic/o/movie.mp4?alt=media&token=synthetic';assert.deepEqual(mediaSources({dosyaTipi:'video',url}).direct,[url]);assert.equal(downloadSource({dosyaTipi:'video',url}),url);});
`;
write('tests/portal-stream-status-recovery.test.mjs',recoveryTest);

// Update TUS assertions for resume and large-file chunks.
replaceExact('tests/bunny-stream-upload.test.mjs',
`  MAX_VIDEO_BYTES, DEFAULT_CHUNK_SIZE, DEFAULT_RETRY_DELAYS, formatTusUploadError,
  validateStreamVideo, requestStreamAuthorization, uploadStreamVideo`,
`  MAX_VIDEO_BYTES, DEFAULT_CHUNK_SIZE, LARGE_VIDEO_CHUNK_SIZE, DEFAULT_RETRY_DELAYS, formatTusUploadError,
  validateStreamVideo, requestStreamAuthorization, uploadStreamVideo, chunkSizeForVideo`);
replaceExact('tests/bunny-stream-upload.test.mjs',
`test('TUS uploader uses presigned headers and starts a clean upload for each new video authorization',async()=>{`,
`test('TUS uploader resumes only the same video authorization and uses mobile-safe large chunks',async()=>{`);
replaceExact('tests/bunny-stream-upload.test.mjs','  assert.equal(calls.options.chunkSize,DEFAULT_CHUNK_SIZE);','  assert.equal(calls.options.chunkSize,DEFAULT_CHUNK_SIZE);\n  assert.equal(chunkSizeForVideo(file({size:501*1024*1024})),LARGE_VIDEO_CHUNK_SIZE);');
replaceExact('tests/bunny-stream-upload.test.mjs','  assert.equal(calls.resumed,0);','  assert.equal(calls.resumed,1);');

const contractTest=`import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const core=fs.readFileSync(new URL('../portal-galeri-core.js',import.meta.url),'utf8');
const live=fs.readFileSync(new URL('../js/portal-galeri-canli.js',import.meta.url),'utf8');
const media=fs.readFileSync(new URL('../js/portal-galeri-medya.js',import.meta.url),'utf8');
const education=fs.readFileSync(new URL('../js/zeky-galeri-onay-egitim.js',import.meta.url),'utf8');
const upload=fs.readFileSync(new URL('../js/bunny-stream-upload.js',import.meta.url),'utf8');
test('gallery cards are visual-only and lightbox has one stable media host',()=>{assert.match(media,/bunnyStream && thumbnail/);assert.match(media,/pg-video-thumbnail/);assert.doesNotMatch(media,/Video durumu doğrulanamadı; oynatmayı deneyebilirsiniz/);assert.match(live,/data\.pgLightboxMediaHost/);assert.match(core,/data-pg-lightbox-media-host/);});
test('upload records target and sender labels for parent teacher and management views',()=>{for(const field of ['hedefSinifAd','hedefEtiket','yukleyenAd','yukleyenRol','yukleyenUid'])assert.match(core,new RegExp(field));assert.match(education,/Gönderim hedefi/);assert.match(education,/Gönderen rolü/);assert.match(education,/yukleyenEtiketi/);});
test('edit action receives the active media id instead of relying on inline scope',()=>{assert.match(core,/duzenleBtn\.onclick[\s\S]*galeriGonderiDuzenle\?\.\(oge\.id\)/);assert.match(core,/id = id \|\| aktifLightboxOge\?\.id/);});
test('large uploads use 2 MiB chunks, same-authorization resume and progress diagnostics',()=>{assert.match(upload,/LARGE_VIDEO_CHUNK_SIZE = 2 \* 1024 \* 1024/);assert.match(upload,/resumeFromPreviousUpload/);assert.match(upload,/uploadPercent/);assert.match(upload,/activeAuthorizations/);});
`;
write('tests/gallery-media-ui-metadata.test.mjs',contractTest);

console.log('Gallery UI, metadata, edit action and large-video resilience patch prepared.');
