import { GALLERY_PROGRAMS, galleryProgram, galleryTopic, galleryFolderKey, galleryIsObservation } from './galeri-klasorleri.js';
import { mountMedia, disposeMedia, refreshGalleryCards, downloadAlbum } from './portal-galeri-canli.js?v=166';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const handler = (name, id) => escape(`${name}(${JSON.stringify(String(id))})`);
const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:12px';
const button = 'border:1px solid #e9d5ff;border-radius:12px;padding:10px 14px;background:white;color:#6b21a8;cursor:pointer';
export function folderDateRange(items) {
  const dates = items.map(m => String(m.etkinlikTarih || m.tarih || m.yuklemeZamani || '').slice(0,10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const format = d => d.split('-').reverse().join('.');
  return dates.length ? format(dates[0]) + (dates.at(-1) !== dates[0] ? ' – ' + format(dates.at(-1)) : '') : '';
}
export function managementTopicFolders(items) {
  const groups = new Map();
  for (const media of items) {
    const key = galleryFolderKey(media);
    if (!groups.has(key)) groups.set(key, {key, title: galleryIsObservation(media)
      ? (media.alanAd || String(media.alanId || media.kazanimAnahtari).split('__')[0].replace(/[-_]+/g,' '))
      : galleryTopic(media), observation:galleryIsObservation(media), media:[]});
    groups.get(key).media.push(media);
  }
  return [...groups.values()].sort((a,b) => {
    const latest = g => g.media.map(m => String(m.yuklemeZamani || m.tarih || m.etkinlikTarih || '')).sort().at(-1) || '';
    return latest(b).localeCompare(latest(a));
  });
}
function scopeLabel(media) {
  return [media.hedefTur === 'sinif' ? media.hedefDeger || media.sinif : media.hedefTur === 'ogrenci' ? media.hedefOgrenciAd || 'Öğrenciye özel' : 'Tüm okul', media.donem || ''].filter(Boolean).join(' · ');
}
function folderCard(title, summary, count, attr) {
  return `<button type="button" ${attr} style="${button};text-align:left;min-width:0;padding:18px"><span style="font-size:30px" aria-hidden="true">📁</span><strong style="display:block;margin:9px 0 5px;overflow-wrap:anywhere">${escape(title)}</strong><span style="display:block;font-size:12px;line-height:1.5;overflow-wrap:anywhere">${escape(summary)}</span><span style="display:block;font-size:12px;margin-top:7px">${count} fotoğraf / video</span></button>`;
}
export function createGalleryFolderView() {
  let program = '', folder = '';
  return {
    reset() { program = ''; folder = ''; },
    render(host, items, options = {}) {
      // Rebuild only from the caller's current authorized list after each refresh.
      disposeMedia(host);
      const programs = Object.entries(GALLERY_PROGRAMS).map(([code,label]) => ({code,label,media:items.filter(m => galleryProgram(m) === code)}));
      const selected = programs.find(p => p.code === program);
      const groups = selected ? managementTopicFolders(selected.media) : [];
      let current = groups.find(g => g.key === folder);
      if (!current) folder = '';
      const repaint = () => this.render(host, items, options);
      const back = program ? `<button type="button" data-folder-back style="${button}" aria-label="${folder ? 'Program klasörlerine dön' : 'Programlara dön'}">← ${folder ? escape(selected.label) : 'Programlar'}</button>` : '';
      const title = current ? current.title : selected?.label || 'Eğitim programları';
      const appendAllowed = !current || current.observation || Boolean(current.media[0].donem && current.media[0].donem === options.activePeriod);
      host.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:15px">${back}<div style="min-width:0;flex:1"><h3 style="margin:0;overflow-wrap:anywhere">${escape(title)}</h3><div style="font-size:12px;color:#64748b;margin-top:5px">${current ? escape(scopeLabel(current.media[0]) + ' · ' + folderDateRange(current.media)) : 'Program → konu klasörleri'}</div></div>${program && appendAllowed ? `<button type="button" data-folder-add style="${button}">+ İçerik Ekle</button>` : ''}${current ? `<button type="button" data-folder-download style="${button}">ZIP İndir</button>` : ''}</div>`;
      if (current && !appendAllowed) host.insertAdjacentHTML('beforeend','<p style="font-size:12px;color:#64748b">Bu klasörün dönemi seçili dönemle eşleşmiyor. Yeni yükleme için program ekranını kullanın.</p>');
      if (!program) {
        host.insertAdjacentHTML('beforeend',`<div style="${grid}">${programs.map((p,i) => folderCard(p.label,`${managementTopicFolders(p.media).length} konu / gelişim alanı`,p.media.length,`data-program-index="${i}"`)).join('')}</div>`);
      } else if (!current) {
        host.insertAdjacentHTML('beforeend',groups.length ? `<div style="${grid}">${groups.map((g,i) => folderCard(g.title,[g.observation ? 'Gelişim alanı' : scopeLabel(g.media[0]),folderDateRange(g.media)].filter(Boolean).join(' · '),g.media.length,`data-folder-index="${i}"`)).join('')}</div>` : '<p style="padding:22px;color:#64748b">Bu programda henüz içerik yok. Konu adıyla yeni içerik ekleyebilirsiniz.</p>');
      } else {
        const sorted = [...current.media].sort((a,b) => String(b.yuklemeZamani || b.etkinlikTarih || '').localeCompare(String(a.yuklemeZamani || a.etkinlikTarih || '')));
        host.insertAdjacentHTML('beforeend',`<div style="${grid}">${sorted.map((m,i) => {
          const pending = ['beklemede','onayBekliyor'].includes(m.durum);
          const state = pending ? 'Onay bekliyor' : m.durum === 'reddedildi' ? 'Reddedildi' : m.durum && m.durum !== 'onaylandi' ? m.durum : '';
          return `<div style="min-width:0"><div style="position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#f1f5f9;cursor:pointer" data-gallery-media-id="${escape(m.id)}" onclick="${handler('acGaleriLightbox',m.id)}"><div data-folder-media="${i}" style="width:100%;height:100%"></div>${state ? `<span style="position:absolute;top:6px;right:6px;background:#fff;padding:4px 7px;border-radius:7px;font-size:11px">${escape(state)}</span>` : ''}</div>${pending && options.management ? `<div style="display:flex;gap:5px;margin-top:5px"><button type="button" data-approve="${i}" style="${button};flex:1">Onayla</button><button type="button" data-reject="${i}" style="${button};flex:1">Reddet</button></div>` : ''}<button type="button" data-folder-delete="${i}" style="${button};font-size:12px;margin-top:5px;color:#b91c1c">Sil</button></div>`;
        }).join('')}</div>`);
        host.querySelectorAll('[data-folder-media]').forEach(el => mountMedia(el,sorted[Number(el.dataset.folderMedia)],{thumbnail:true}));
        host.querySelectorAll('[data-approve]').forEach(el => el.onclick = () => window.galeriOnayla?.(sorted[Number(el.dataset.approve)].id));
        host.querySelectorAll('[data-reject]').forEach(el => el.onclick = () => window.galeriReddet?.(sorted[Number(el.dataset.reject)].id));
        host.querySelectorAll('[data-folder-delete]').forEach(el => el.onclick = () => window.silGaleriOge?.(sorted[Number(el.dataset.folderDelete)].id));
        refreshGalleryCards(host);
      }
      host.querySelectorAll('[data-program-index]').forEach(el => el.onclick = () => {program = programs[Number(el.dataset.programIndex)].code;folder = '';repaint();});
      host.querySelectorAll('[data-folder-index]').forEach(el => el.onclick = () => {folder = groups[Number(el.dataset.folderIndex)].key;repaint();});
      const backButton = host.querySelector('[data-folder-back]');
      if (backButton) backButton.onclick = () => {if(folder) folder = '';else program = '';repaint();};
      const addButton = host.querySelector('[data-folder-add]');
      if (addButton) addButton.onclick = () => current && !current.observation ? options.addTopic?.(current.media[0]) : options.addProgram?.(program);
      const downloadButton = host.querySelector('[data-folder-download]');
      if (downloadButton) downloadButton.onclick = () => downloadAlbum(current.title,'','','',{program,folderKey:current.key});
    }
  };
}
