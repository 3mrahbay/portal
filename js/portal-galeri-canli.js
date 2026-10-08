import { galleryProgram, galleryFolderKey } from './galeri-klasorleri.js';
export { galleryProgram } from './galeri-klasorleri.js';
import { renderMedia, downloadSource } from './portal-galeri-medya.js?v=192';
import { createInteractionService, management, targetChild, isGalleryParent, galleryParentKey } from './portal-galeri-etkilesim.js?v=166';

const api = () => window.PortalAPI;
const service = createInteractionService(api);
let active = null, sequence = 0, reportOwner = '';
const downloadOperations = new WeakMap();
const toast = (text, type) => api()?.toast?.(text, type);
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentMedia = (id, parent = false) => (parent ? window.veliGaleriVerisi : window.galeriListesiVerisi)?.find(item => item.id === id);

let trackingWarningOwner = '';
function trackingFailure(owner) {
  if (owner && api()?.state?.currentUser?.uid === owner && trackingWarningOwner !== owner) {
    trackingWarningOwner = owner;
    toast('İçerik açılabilir; etkileşim kaydı kaydedilemedi. Bağlantı ve galeri etkileşim kuralları kontrol edilmeli.', 'warning');
  }
}
export function recordOpen(media) {
  const owner = api()?.state?.currentUser?.uid;
  service.record(media, 'acma').catch(() => trackingFailure(owner));
}
async function recordDownload(media, completed, owner) {
  if (!owner || api()?.state?.currentUser?.uid !== owner) return false;
  return service.record(media, 'indirme', completed).catch(() => { trackingFailure(owner); return false; });
}
export function disposeMedia(root) {
  if (!root) return;
  [root, ...root.querySelectorAll('[data-pg-media]')].forEach(host => { host.__disposeMedia?.(); delete host.__disposeMedia; if (host.dataset) delete host.dataset.pgMedia; });
}
export function mountMedia(host, media, options) {
  host.dataset.pgMedia = media.id || 'media';
  return renderMedia(host, media, options);
}
function fileName(media) {
  const fallback = media.dosyaTipi === 'video' ? 'video.mp4' : 'fotograf.jpg';
  return String(media.orjinalAd || fallback).replace(/[\\/\x00-\x1f:*?"<>|]/g, '-').slice(0, 160) || fallback;
}
export async function fetchMediaBlob(media, win = window) {
  const url = downloadSource(media);
  if (!url) throw new Error('Bu video için indirilebilir dosya bağlantısı bulunamadı');
  const response = await win.fetch(url);
  if (!response.ok) throw new Error('Medya indirilemedi');
  const blob = await response.blob();
  if (!blob.size || /text\/html|application\/json/.test(blob.type)) throw new Error('Medya dosyası alınamadı');
  return blob;
}
export async function saveBlob(blob, name, {win = window, handle = null, guard = () => true} = {}) {
  const check = () => { if (!guard()) throw Object.assign(new Error('Galeri bağlamı değişti'), {name:'AbortError'}); };
  check();
  if (handle) {
    const writer = await handle.createWritable();
    try { check(); await writer.write(blob); check(); await writer.close(); }
    catch (error) { try { await writer.abort?.(); } catch (_) {} throw error; }
    return true;
  }
  check();
  const url = win.URL.createObjectURL(blob), anchor = win.document.createElement('a');
  anchor.href = url; anchor.download = name; win.document.body.append(anchor);
  try { anchor.click(); } finally { anchor.remove(); win.setTimeout(() => win.URL.revokeObjectURL(url), 60000); }
  return false; // Browser initiation is not evidence of disk completion.
}
export async function downloadMedia(media, button = null) {
  if (!media || button?.disabled) return false;
  const operation = {mediaId:media.id};
  if (button) downloadOperations.set(button, operation);
  const label = button?.textContent, initial = api()?.state || {}, owner = initial.currentUser?.uid;
  const parent = isGalleryParent(initial), context = galleryParentKey(initial);
  const guard = () => { const state=api()?.state || {}; return state.currentUser?.uid===owner && (!parent || (isGalleryParent(state)&&galleryParentKey(state)===context&&!!targetChild(media,[state.veliAktifOgrenci||state.veliOgrenciler?.[0]].filter(Boolean),state))); };
  const check = () => { if(!guard())throw Object.assign(new Error('Galeri bağlamı değişti'),{name:'AbortError'}); };
  try {
    if (button) { button.disabled = true; button.textContent = 'İndiriliyor…'; }
    check();
    if (!downloadSource(media)) throw new Error('Bu medya için indirilebilir dosya bulunamadı');
    const handle = window.showSaveFilePicker ? await window.showSaveFilePicker({suggestedName:fileName(media)}) : null;
    check();
    const blob = await fetchMediaBlob(media);check();
    const completed = await saveBlob(blob, fileName(media), {handle,guard});check();
    await recordDownload(media, completed, owner);check();
    toast(completed ? 'Dosya kaydedildi' : 'İndirme başlatıldı');
    return true;
  } catch (error) {
    if (error?.name !== 'AbortError') toast(error.message || 'İndirilemedi', 'error');
    return false;
  } finally {
    if (button && downloadOperations.get(button) === operation) {
      downloadOperations.delete(button);
      if (button.id === 'galeriLightboxIndirBtn') downloadControl();
      else { button.disabled = false; button.textContent = label; }
    }
  }
}
export function reportTime(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('tr-TR', { timeZone:'Europe/Istanbul', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : 'Zaman kaydı yok';
}
export function interactionRowHtml(row) {
  const download = row.lastDownloadStatus === 'tamamlandi' ? 'Kaydetme doğrulandı' : 'İndirme başlatıldı';
  return `<div style="padding:12px 0;border-bottom:1px solid #eee"><strong>${escape(row.name)}</strong><div style="font-size:12px;color:#687385">${row.children.map(escape).join(', ')}</div><div style="font-size:12px;line-height:1.7;margin-top:6px">${row.opened ? `İlk açılış: ${escape(reportTime(row.firstOpen))}<br>Son açılış: ${escape(reportTime(row.lastOpen))}<br>Açılış sayısı: ${Number(row.openCount) || 0}` : 'Açılış kaydı yok'}${row.started ? `<br>Son indirme: ${escape(reportTime(row.lastDownload))}<br>${download} · ${Number(row.downloadCount) || 0} işlem` : '<br>İndirme kaydı yok'}${row.favorite ? '<br>♥ Favori' : ''}</div></div>`;
}
function downloadControl() {
  const button = document.getElementById('galeriLightboxIndirBtn'); if (!button) return;
  if (!('pgDownloadLabel' in button.dataset)) button.dataset.pgDownloadLabel = button.innerHTML;
  const available = Boolean(active && downloadSource(active));
  const busy = available && downloadOperations.get(button)?.mediaId === active.id;
  button.disabled = !available || busy;
  button.setAttribute('aria-disabled', String(button.disabled));
  button.title = available ? '' : 'İndirilebilir dosya bağlantısı yok';
  if (busy) button.textContent = 'İndiriliyor…';
  else if (available) button.innerHTML = button.dataset.pgDownloadLabel;
  else button.textContent = 'İndirme bağlantısı yok';
}
function reportControl() {
  const anchor = document.getElementById('galeriLightboxIndirBtn'); if (!anchor) return;
  let button = document.getElementById('pgInteractionButton');
  if (!button) {
    button = document.createElement('button'); button.id = 'pgInteractionButton'; button.type = 'button';
    button.textContent = 'Kim açtı? · Veli etkileşimleri';
    button.style.cssText = 'padding:10px 15px;margin-right:8px;background:#eef2ff;color:#303b70;border:1px solid #c7d2fe;border-radius:10px;font-weight:700;cursor:pointer';
    button.onclick = () => { if (active?.durum === 'onaylandi' && management(api()?.state)) reportPanel(active); };
    anchor.before(button);
  }
  button.hidden = !(active?.durum === 'onaylandi' && management(api()?.state));
}
async function reportPanel(media) {
  if (!management(api()?.state)) return;
  document.getElementById('pgInteractionPanel')?.remove();
  reportOwner = api()?.state?.currentUser?.uid || '';
  const panel = document.createElement('div'); panel.id = 'pgInteractionPanel';
  panel.style.cssText = 'position:fixed;inset:0;z-index:10030;background:#0f172a99;display:grid;place-items:center;padding:16px';
  panel.innerHTML = '<section role="dialog" aria-modal="true" aria-label="Veli etkileşimleri" style="background:white;border-radius:18px;padding:22px;width:min(640px,95vw);max-height:85vh;overflow:auto;box-sizing:border-box"><button type="button" aria-label="Kapat" style="float:right">×</button><h3>Veli etkileşimleri</h3><div data-pg-report>Yükleniyor…</div></section>';
  panel.querySelector('button').onclick = () => panel.remove();
  panel.onclick = event => { if (event.target === panel) panel.remove(); };
  document.body.append(panel); panel.querySelector('button').focus();
  try {
    const rows = await service.report(media);
    if (!panel.isConnected) return;
    const opened = rows.filter(row => row.opened), missing = rows.filter(row => !row.opened);
    const rowHtml = interactionRowHtml;
    panel.querySelector('[data-pg-report]').innerHTML = `<div style="font-size:13px;margin-bottom:12px">${opened.length}/${rows.length} veli hesabı açtı · ${rows.filter(r => r.started).length} indirme başlattı</div><p style="font-size:12px;color:#687385">Açtı, içeriğin açıldığını gösterir; videonun izlendiğini veya bitirildiğini kanıtlamaz. Tarayıcı indirmesinde kaydın tamamlandığı her zaman doğrulanamaz. Eski sürümlerdeki açılışlar kaydedilmemiş olabilir. Tarih ve saatler Türkiye saatidir.</p><h4>Açanlar</h4>${opened.map(rowHtml).join('') || '<p>Henüz kayıt yok</p>'}<h4>Açılış kaydı olmayanlar</h4>${missing.map(rowHtml).join('') || '<p>Hedefteki tüm hesapların açılış kaydı var</p>'}`;
  } catch (_) {
    if (panel.isConnected) panel.querySelector('[data-pg-report]').textContent = 'Etkileşim kayıtları okunamadı. Galeri etkileşim kurallarını ve bağlantıyı kontrol edin; bu durum hiç kimsenin açmadığı anlamına gelmez.';
  }
}
let albumBusy = false;
export async function downloadAlbum(title, date, targetType, targetValue, folderScope = null) {
  if (albumBusy) return false;
  const state = api()?.state || {}, parent = isGalleryParent(state), owner = state.currentUser?.uid, context = galleryParentKey(state);
  const guard = () => { const latest=api()?.state || {}; return latest.currentUser?.uid===owner && (!parent || (isGalleryParent(latest)&&galleryParentKey(latest)===context)); };
  const check = () => { if(!guard())throw Object.assign(new Error('Galeri bağlamı değişti'),{name:'AbortError'}); };
  const list = parent ? window.veliGaleriVerisi || [] : window.galeriListesiVerisi || [];
  const media = list.filter(item => {
    if (parent && !targetChild(item, [state.veliAktifOgrenci || state.veliOgrenciler?.[0]].filter(Boolean), state)) return false;
    if (folderScope) return galleryProgram(item) === folderScope.program && galleryFolderKey(item) === folderScope.folderKey;
    if (targetType === '__egitim__') return galleryProgram(item) === targetValue;
    return item.etkinlikBaslik === title && item.etkinlikTarih === date &&
      (!targetType || item.hedefTur === targetType) && (!targetType || String(item.hedefDeger || '') === String(targetValue || ''));
  });
  if (!media.length) { toast('Dosya bulunamadı', 'error'); return false; }
  const downloadable = media.filter(item => downloadSource(item));
  const unavailable = media.length - downloadable.length;
  if (!downloadable.length) { toast(`Bu albümde indirilebilir dosya bağlantısı yok (${unavailable} dosya).`, 'error'); return false; }
  if (unavailable) toast(`${downloadable.length} dosya ZIP'e alınabilir; ${unavailable} dosyanın indirme bağlantısı yok, atlanacak.`, 'warning');
  if (downloadable.some(item => item.dosyaTipi === 'video') && !window.confirm('Bu albüm video içeriyor. ZIP indirmesi zaman alabilir. Devam edilsin mi?')) return false;
  albumBusy = true;
  try {
    const name = String(title || 'Album').replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ-]/g, '-').slice(0, 80) + '.zip';
    const handle = window.showSaveFilePicker ? await window.showSaveFilePicker({suggestedName:name}) : null;
    check();await window.portalAracYukle('zip');check();
    const zip = new window.JSZip(), included = [];
    toast('Albüm hazırlanıyor…');
    for (const item of downloadable) {
      check();
      try { const blob = await fetchMediaBlob(item);check();zip.file(`${String(included.length + 1).padStart(3, '0')}_${fileName(item)}`, blob); included.push(item); }
      catch (_) { /* Only successfully included media receive a download event. */ }
    }
    check();
    if (!included.length) throw new Error(`İndirilebilir ${downloadable.length} dosya alınamadı${unavailable ? `; ${unavailable} dosyanın indirme bağlantısı yok` : ''}.`);
    const blob = await zip.generateAsync({type:'blob', compression:'STORE'});
    check();
    const completed = await saveBlob(blob, name, {handle,guard});check();
    await Promise.allSettled(included.map(item => recordDownload(item, completed, owner)));check();
    const failed = downloadable.length - included.length;
    toast(`${completed ? 'Albüm kaydedildi' : 'Albüm indirmesi başlatıldı'} (${included.length} dosya${unavailable ? `, ${unavailable} bağlantı yok (atlandı)` : ''}${failed ? `, ${failed} alınamadı` : ''})`);
    return true;
  } catch (error) { if (error?.name !== 'AbortError') toast(error.message || 'Albüm indirilemedi', 'error'); return false; }
  finally { albumBusy = false; }
}
function cardId(card) { return /(?:veliAcGaleriLightbox|acGaleriLightbox)\(['"]([^'"]+)['"]/.exec(card.getAttribute('onclick') || '')?.[1]; }
export function refreshGalleryCards(root = document) {
  if (!management(api()?.state) || api()?.state?.currentUser?.uid !== reportOwner) document.getElementById('pgInteractionPanel')?.remove();
  root.querySelectorAll('[onclick*="acGaleriLightbox("],[onclick*="veliAcGaleriLightbox("]').forEach(card => {
    const id = cardId(card), parent = /veliAcGaleriLightbox/.test(card.getAttribute('onclick') || '');
    const media = currentMedia(id, parent); if (!media) return;
    if (media.dosyaTipi === 'video' && !card.querySelector('[data-pg-media]')) {
      const old = card.querySelector(':scope > img, :scope > video, :scope > iframe');
      const oldPoster = old?.tagName === 'IMG' ? (old.currentSrc || old.src || old.getAttribute?.('src') || '') : '';
      if (old) { const fallback = old.nextElementSibling; if (fallback?.style?.background?.includes('31, 41, 55') || fallback?.style?.background === '#1f2937') fallback.remove(); old.remove(); }
      const host = document.createElement('div'); host.className = 'pg-gallery-card-media'; host.style.cssText = 'width:100%;height:100%;background:#273449;overflow:hidden'; card.prepend(host);
      const cardMedia = oldPoster && !media.kucukResim && !media.thumbnail ? {...media,kucukResim:oldPoster} : media;
      mountMedia(host, cardMedia, {thumbnail:true});
    }
    const badge = card.querySelector('[data-pg-report-button]');
    if (!parent && management(api()?.state) && media.durum === 'onaylandi' && !badge) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.pgReportButton = id;
      button.textContent = 'Veli etkileşimleri'; button.style.cssText = 'position:absolute;bottom:6px;left:6px;right:6px;z-index:4;border:0;border-radius:7px;background:#1f2544e8;color:white;font-size:10px;padding:6px;cursor:pointer';
      button.onclick = event => { event.stopPropagation(); reportPanel(media); }; card.append(button);
    } else if (badge && (!management(api()?.state) || media.durum !== 'onaylandi')) badge.remove();
  });
}
function lightboxMediaHost(container) {
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
export function installLiveGallery(win = window) {
  if (win.__portalGaleriCanli192) return true;
  if (!win.PortalAPI || typeof win.acGaleriLightbox !== 'function' || typeof win.veliAcGaleriLightbox !== 'function') return false;
  win.__portalGaleriCanliAktif = true;
  for (const [name, parent] of [['acGaleriLightbox', false], ['veliAcGaleriLightbox', true]]) {
    const original = win[name];
    const wrapped = function(id, ...args) {
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
    win[name] = wrapped;
  }
  const close = win.closeGaleriLightbox;
  const wrappedClose = function(...args) { ++sequence; active = null; reportControl(); downloadControl(); disposeMedia(document.getElementById('galeriLightboxIcerik')); return close?.apply(this, args); };
  if (close?.__zekyEgitimKapat) wrappedClose.__zekyEgitimKapat = true;
  wrappedClose.__eski = close;
  win.closeGaleriLightbox = wrappedClose;
  win.albumZipIndir = downloadAlbum;
  win.galeriLightboxIndir = () => downloadMedia(active, document.getElementById('galeriLightboxIndirBtn'));
  const observer = new win.MutationObserver(() => refreshGalleryCards());
  observer.observe(document.body, {childList:true, subtree:true}); refreshGalleryCards();
  win.__portalGaleriCanli192 = true; return true;
}
if (typeof window !== 'undefined') {
  let tries = 0;
  const install = () => { if (!installLiveGallery() && ++tries < 120) window.setTimeout(install, 100); };
  install();
}
