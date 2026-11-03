// Isolated visual fixture: real selection renderer, synthetic files and deletion transport.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('index.html'),start=source.indexOf('window.galeriDosyalarSecildi = function(e)'),end=source.indexOf('// YÜKLE\n',start);
if(start<0||end<start)throw Error('Selection source missing');
const script=`
import {galleryDeleteButton} from './modules/galeri-silme.js';
import {classifyGalleryFile,validateStreamVideo} from './modules/bunny-stream-upload.js';
let galeriSecilenDosyalar=[],galeriYuklemeCalisiyor=false;
const galeriYuklenenDosyalar=new Map(),galeriOnizlemeAdresleri=new Map();
const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const showToast=text=>document.getElementById('result').textContent=text;
window.silGaleriOge=async id=>{showToast('Örnek fotoğraf galeriden silindi.');return true;};
${source.slice(start,end)}
const canvas=document.createElement('canvas');canvas.width=canvas.height=200;const ctx=canvas.getContext('2d');ctx.fillStyle='#eadff5';ctx.fillRect(0,0,200,200);ctx.fillStyle='#ad88cf';ctx.beginPath();ctx.arc(100,85,48,0,Math.PI*2);ctx.fill();ctx.fillStyle='#594170';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('Örnek fotoğraf',100,160);
const blob=await new Promise(resolve=>canvas.toBlob(resolve));
const one=new File([blob],'Lavantalar-ornek-1.png',{type:'image/png'}),two=new File([blob],'Lavantalar-ornek-2.png',{type:'image/png'});
galeriDosyalarEkle([one,two]);
window.ornekYuklemeyiTamamla=()=>{galeriYuklenenDosyalar.set(one,{id:'ornek'});renderGaleriSecilenDosyalar();showToast('Birinci örnek fotoğraf yüklendi.');};
document.getElementById('btnGaleriYukle').onclick=window.ornekYuklemeyiTamamla;document.getElementById('btnGaleriYukle').textContent='Örnek yüklemeyi tamamla';
const state={currentUser:{uid:'teacher',email:'teacher@example.test'},rol:'ogretmen',personel:{durum:'aktif'}};
document.getElementById('card').innerHTML='<img alt="Örnek galeri fotoğrafı" style="width:100%;height:100%;object-fit:cover" src="'+canvas.toDataURL()+'">'+galleryDeleteButton({id:'ornek',yukleyen:'teacher@example.test'},state);
`;
const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Öğretmen fotoğraf silme · yerel önizleme</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f7f5fa;color:#17212b;margin:0;padding:24px}main{max-width:680px;margin:auto}body.mobile main{width:320px;padding:8px;border:1px solid #ddd}button:disabled{opacity:.5;cursor:not-allowed!important}button{min-height:40px;cursor:pointer}#result{padding:12px;color:#166534;min-height:40px}h1{font-size:24px}h2{font-size:18px}.panel{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:16px 0}</style></head><body><main><small>YEREL ÖNİZLEME · Gerçek fotoğraf kullanılmaz</small><p><button onclick="document.body.classList.toggle('mobile')">320 px görünüm</button></p><h1>Fotoğraf yükleme</h1><section class="panel"><div id="galeriSecilenDosyalar"></div><p><button id="btnGaleriYukle" onclick="ornekYuklemeyiTamamla()">Örnek yüklemeyi tamamla</button></p></section><div id="result" role="status"></div><h2>Galeride kendi fotoğrafı</h2><div id="card" style="width:180px;height:180px;position:relative;border-radius:12px;overflow:hidden"></div></main><script type="module">${script}</script></body></html>`;
const dir=new URL('../../gallery-delete-preview/',import.meta.url);mkdirSync(new URL('modules/',dir),{recursive:true});
for(const file of ['galeri-silme.js','galeri-onay-canli.js','galeri-klasorleri.js','bunny-stream-upload.js'])copyFileSync(new URL('../js/'+file,import.meta.url),new URL('modules/'+file,dir));
writeFileSync(new URL('index.html',dir),html);console.log('Synthetic deletion preview prepared.');
