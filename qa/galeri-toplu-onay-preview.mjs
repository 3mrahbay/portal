// Builds a local-only synthetic screen from the active Portal handlers.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {gallerySource,galleryControls,selectedStyles,lightboxMarkup,media} from './galeri-onay-fixture.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const plain=s=>s.replace(/^import .*;\n/gm,'').replaceAll('export ','');
const helpers=plain(read('js/galeri-onay-canli.js'))+'\n'+plain(read('js/galeri-klasorleri.js'))+'\n'+plain(read('js/galeri-toplu-onay.js')).split('// Commit the shared cooldown')[0];
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#e7dff8"/><circle cx="200" cy="170" r="80" fill="#b4a0d3"/><text x="200" y="300" text-anchor="middle" font-size="22" fill="#524164">Örnek medya</text></svg>')+'#preview';
const rows=Array.from({length:6},(_,i)=>media('ornek-'+i,{bunnyUrl:image,hedefDeger:i<5?'Lavantalar':'Papatyalar',etkinlikBaslik:'Sınıf etkinliği',dosyaTipi:i===4?'video':'foto',kucukResim:image}));
const bootstrap=`
const state={currentUser:{uid:'synthetic-manager',email:'manager@example.test'},rol:'mudur',personel:{durum:'aktif'},aktifDonem:'2026-2027'};
let rows=${JSON.stringify(rows)},next=null;
const snap=()=>({docs:rows.filter(x=>pendingGallery(x.durum)).map(x=>({id:x.id,data:()=>x})),metadata:{fromCache:false}});
const db={},fb={collection:(_db,name)=>name,where:()=>null,query:()=>null,onSnapshot:(_q,_o,n)=>{next=n;queueMicrotask(()=>n(snap()));return()=>{};},doc:(_db,c,id)=>({c,id}),getDocs:async()=>snap(),getDoc:async ref=>{const row=rows.find(x=>x.id===ref.id);return{exists:()=>!!row,data:()=>row};},runTransaction:async(_db,fn)=>{const edits=[];const value=await fn({get:ref=>fb.getDoc(ref),update:(ref,data)=>edits.push({ref,data})});edits.forEach(({ref,data})=>Object.assign(rows.find(x=>x.id===ref.id),data));next?.(snap());return value;}};
const {collection,where,query,getDocs,doc,getDoc,runTransaction}=fb;
window.PortalAPI={state,fb,db};let currentUser=state.currentUser,aktifKullaniciRol=state.rol,isAdmin=false,AKTIF_DONEM='2026-2027';
const createGalleryFolderView=()=>({reset(){},render(){}});
const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const showToast=(text)=>{document.getElementById('result').textContent=text;};
const notifyGalleryPublication=async()=>({ok:true,birlestirildi:true});
`;
const deletion=`const {galleryDeleteButton,canDeleteGalleryMedia,removeGalleryMedia}=(()=>{${plain(read('js/galeri-silme.js'))};return {galleryDeleteButton,canDeleteGalleryMedia,removeGalleryMedia};})();`;
const script=helpers+'\n'+deletion+'\n'+bootstrap+'\n'+gallerySource+'\ngaleriFilter("onayBekliyor");';
new vm.Script(script);
const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Galeri toplu onay · yerel önizleme</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#faf8fc;color:#17212b;margin:0;padding:24px}main{max-width:1100px;margin:auto}body.mobile main{width:320px;padding:8px;border:1px solid #ddd}button:disabled{opacity:.5;cursor:not-allowed!important}#result{padding:12px;color:#166534}${selectedStyles}</style></head><body><main><small>YEREL ÖNİZLEME · Örnek medya, gerçek veri kullanılmaz</small><button onclick="document.body.classList.toggle('mobile')" style="float:right">320 px görünüm</button><h1>Galeri</h1><section id="tab-galeri" class="active">${galleryControls}<div id="galeriListesi"></div></section><div id="result" role="status"></div>${lightboxMarkup}</main><script>${script}</script></body></html>`;
const dir=new URL('../../gallery-preview/',import.meta.url);mkdirSync(dir,{recursive:true});writeFileSync(new URL('index.html',dir),html);console.log('Synthetic gallery preview prepared.');
