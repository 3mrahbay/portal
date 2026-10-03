// Regenerates a self-contained UI fixture from current production UI code.
// Synthetic SVG geometry only. Never import the user's screenshot or child media.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const strip=s=>s.replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
const ui=strip(read('js/portal-galeri-lightbox-ui.js'));
const folders=strip(read('js/galeri-klasorleri.js'));
const dates=fs.existsSync(path.join(root,'js/galeri-tarih.js'))?strip(read('js/galeri-tarih.js')):'';
const interactions=strip(read('js/portal-galeri-etkilesim.js'));
const parent=strip(read('moduller/veli-galeri.js')).replace(/^function kucuk\(url.*$/m,'function kucuk(url){return url;}');
const fixture=`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Synthetic gallery lightbox QA</title><style>body{margin:0;background:#f4f7f3;color:#253d30;font:16px system-ui}main{max-width:760px;margin:48px auto;padding:20px}button{font:inherit;padding:10px 18px;margin:6px;border:1px solid #aac8b5;border-radius:14px;background:white;color:#253d30;cursor:pointer}#gallery{margin-top:20px}</style><main><h1>Synthetic lightbox layout QA</h1><p>No real children, media, authentication or network requests. Use resize, Tab, Escape and browser Back.</p><button onclick="openCase('portrait')">Portrait</button><button onclick="openCase('landscape')">Landscape</button><button onclick="openCase('long')">Long title/caption</button><button onclick="openCase('video')">Video frame</button><p id="result" role="status"></p><div id="gallery"></div></main><script type="module">
${ui}
${folders}
${dates}
${interactions}
function syntheticImage(kind){const tall=kind!=='landscape';return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+(tall?540:1440)+'" height="'+(tall?1080:810)+'" viewBox="0 0 540 1080"><rect width="540" height="1080" fill="#d8ece2"/><circle cx="270" cy="290" r="140" fill="#83b8a2"/><path d="M0 950 190 660 320 800 440 610 540 750v330H0" fill="#345e49"/><text x="270" y="510" text-anchor="middle" font-family="sans-serif" font-size="25" fill="#244b37">SYNTHETIC '+(tall?'PORTRAIT':'LANDSCAPE')+'</text></svg>');}
const sourceById={};
function galleryMediaType(m){return m.dosyaTipi==='video'?'video':'foto';}
function galleryDisplayUrl(m){return m.bunnyUrl||'';}
function disposeMedia(root){root?.querySelectorAll('video').forEach(v=>v.pause());}
function mountMedia(host,m){host.replaceChildren();host.style.position='relative';const el=document.createElement(m.dosyaTipi==='video'?'video':'img');if(el.tagName==='VIDEO'){el.controls=true;el.playsInline=true;el.poster=sourceById[m.id];el.style.cssText='display:block;width:100%;max-height:76vh;min-height:180px;object-fit:contain;background:#111';}else{el.alt='Synthetic geometry';el.src=sourceById[m.id];el.style.cssText='max-width:100%;max-height:76vh;object-fit:contain';}host.append(el);}
function recordOpen(){document.getElementById('result').textContent='Synthetic media opened; no tracking write';}
async function downloadMedia(m,button){button.disabled=true;const text=button.textContent;button.textContent='İndiriliyor…';await new Promise(r=>setTimeout(r,300));button.disabled=false;button.textContent=text;document.getElementById('result').textContent='Synthetic download button exercised; no file or network action';return true;}
const state={rol:null,currentUser:{uid:'synthetic-parent'},galeriVeliUid:'synthetic-parent',galeriOturumSurumu:1,veliAktifOgrenci:{id:'synthetic-child',sinif:'Synthetic class'},veliOgrenciler:[{id:'synthetic-child',sinif:'Synthetic class'}],aktifDonem:'2026-2027',ayarListesi:{}};
let rows=[];
window.PortalAPI={state,db:{},esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),lucide(){},fb:{collection:()=>'',where:()=>'',query:()=>'',getDocs:async()=>({forEach:fn=>rows.forEach(m=>fn({id:m.id,data:()=>m}))})}};
${parent}
window.openCase=async kind=>{window._vg.kapat();rows=[0,1].map(i=>({id:kind+'-'+i,durum:'onaylandi',hedefTur:'ogrenci',hedefDeger:'synthetic-child',donem:state.aktifDonem,bunnyUrl:syntheticImage(kind),dosyaTipi:kind==='video'?'video':'foto',program:'jimnastik',konuBaslik:kind==='long'?'Synthetic long title '.repeat(18):'Synthetic '+kind,aciklama:kind==='long'?'Only synthetic caption text. '.repeat(90):'',tarih:'2026-10-02T12:00:00Z'}));rows.forEach(m=>sourceById[m.id]=syntheticImage(kind));await render('gallery');window._vg.buyut(rows[0].id,'gallery',document.activeElement);};
</script></html>`;
fs.writeFileSync(process.argv[2] || path.join(root,'tests/fixtures/lightbox-visual.html'),fixture);
console.log('Generated self-contained synthetic UI fixture');
