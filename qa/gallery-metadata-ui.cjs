// Synthetic local browser fixture: no production login, child data or outbound requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../qa-output');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const strip=s=>s.replace(/^import .*;\n/gm,'').replaceAll('export ','');
const metadata=strip(read('js/galeri-gozlem-metadata.js'));
const bridge=strip(read('js/zeky-galeri-onay-egitim.js')).replace("if(typeof window!=='undefined')kur();",'');
const stamp=strip(read('js/zeky-galeri-filigran-koprusu.js')).replace('otomatikKur();','');
const session=strip(read('js/galeri-onay-canli.js'));
const bootstrap=`
 window.PortalAPI={db:{},state:{currentUser:{uid:'reviewer',email:'viewer@example.test'},rol:'mudur',isAdmin:true,aktifDonem:'2026-2027',galeriOturumSurumu:1},fb:{doc:(_db,...p)=>p.join('/'),getDoc:async p=>({exists:()=>!!records[p],data:()=>records[p]})}};
 const records={'personeller/teacher@example.test':{adSoyad:'Deniz Örnek',rol:'ogretmen'},'ogrenciler/child':{ogrenciAdSoyad:'Örnek Öğrenci'},'ogrenciler/child/donemler/2026-2027':{kayit:{sinif:'Örnek Sınıf'}},'mufredatlar/montessori':{alanlar:[{id:'practical',ad:'Günlük Yaşam'}]},'ogrenciGelisim/child':{montessori:{detay:{'practical__Öz bakım__Ayakkabı cilalama':{asamalar:{T:{galeriId:'example'}}}}}}};
 window.galeriListesiVerisi=[{id:'example',durum:'beklemede',hedefTur:'ogrenci',hedefDeger:'child',egitimKaydi:true,kategori:'Montessori',kazanimAnahtari:'practical__Öz bakım__Ayakkabı cilalama',baslik:'Ayakkabı cilalama',aciklama:'Tamamen sentetik gözlem açıklaması. Gerçek öğrenci veya fotoğraf içermez.',yukleyen:'teacher@example.test',donem:'2026-2027',tarih:'2026-10-09'}];
 const picture=document.createElement('canvas');picture.width=800;picture.height=700;const pc=picture.getContext('2d');pc.fillStyle='#7DA893';pc.fillRect(0,0,800,700);pc.fillStyle='#E3F1E9';pc.beginPath();pc.arc(400,260,140,0,Math.PI*2);pc.fill();pc.font='bold 42px Arial';pc.textAlign='center';pc.fillStyle='#fff';pc.fillText('SENTETİK MEDYA',400,505);galeriFiligraniCiz(picture);
 window.acGaleriLightbox=()=>{document.getElementById('galeriLightbox').classList.add('active');document.getElementById('galeriLightboxIcerik').innerHTML='<div data-pg-lightbox-media-host><img alt="Sentetik medya" src="'+picture.toDataURL()+'"></div>';};window.closeGaleriLightbox=()=>document.getElementById('galeriLightbox').classList.remove('active');window.galeriOnayla=()=>{};window.galeriReddet=()=>{};
 stil();fonksiyonlariSar();document.getElementById('open').onclick=()=>acGaleriLightbox('example');document.getElementById('close').onclick=()=>closeGaleriLightbox();
 window.ready=true;
 `;
const html=`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{font-family:Arial;background:#eef4f0;margin:0;padding:12px}#galeriLightbox{display:none;position:fixed;inset:0;padding:42px 10px 12px;background:#dae5de;align-items:center;justify-content:center}#galeriLightbox.active{display:flex}#close{position:absolute;top:7px;right:14px;padding:7px 15px}.note{position:absolute;top:13px;left:14px;font-size:11px;color:#526158}</style><button id="open">Gözlemi aç</button><div id="galeriLightbox"><span class="note">SENTETİK QA · Gerçek veri içermez</span><button id="close">Kapat</button><div id="galeriLightboxIcerik"></div></div><script>${metadata}\n${session}\n${bridge}\n${stamp}\n${bootstrap}</script></html>`;
new (require('node:vm').Script)(metadata+'\n'+session+'\n'+bridge+'\n'+stamp+'\n'+bootstrap);
(async()=>{fs.mkdirSync(out,{recursive:true});if(process.env.GALLERY_METADATA_PREPARE_ONLY==='1'){fs.writeFileSync(path.join(out,'synthetic-metadata.html'),html);console.log('Synthetic fixture prepared');return;}const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results=[];
 try{for(const viewport of [{width:1366,height:900},{width:390,height:844},{width:320,height:740}]){
  const page=await browser.newPage({viewport});const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{if(r.request().url()==='http://synthetic-gallery.test/')return r.fulfill({contentType:'text/html',body:html});network.push(r.request().url());return r.abort();});
  await page.goto('http://synthetic-gallery.test/');await page.locator('#open').click();await page.waitForFunction(()=>document.querySelector('.zgo-detay')?.textContent.includes('Deniz Örnek'));
  const details=await page.locator('.zgo-detay').innerText();for(const label of ['Deniz Örnek','Öğretmen','Örnek Sınıf','Günlük Yaşam','Öz bakım','Tekrar ediyor'])assert(details.includes(label),label);assert(!details.includes('@'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
  assert(await page.locator('.zgo-detay').evaluate(el=>el.scrollWidth<=el.clientWidth),'detail overflow');
  await page.screenshot({path:path.join(out,`metadata-${viewport.width}.png`),fullPage:true});
  await page.locator('#close').click();assert.equal(await page.locator('#galeriLightbox').evaluate(e=>e.classList.contains('active')),false);
  await page.locator('#open').click();await page.waitForFunction(()=>document.querySelector('.zgo-detay')?.textContent.includes('Deniz Örnek'));assert.equal(await page.locator('.zgo-detay').count(),1);
  const pixels=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=700;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,800,700);galeriFiligraniCiz(c);const d=x.getImageData(0,0,800,700).data;let max=0;for(let i=0;i<d.length;i+=4)max=Math.max(max,d[i],d[i+1],d[i+2]);return{max,corner:[...d.slice(0,4)]};});
  assert.deepEqual(pixels.corner,[0,0,0,255]);assert.equal(pixels.max,128,'watermark entire layer maximum 50%, not stacked .75 opacity');assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  results.push({viewport,passed:true,watermark:pixels,pageErrors:errors,unexpectedNetwork:network});await page.close();
 }fs.writeFileSync(path.join(out,'metadata-browser-results.json'),JSON.stringify(results,null,2));console.log('PASS synthetic gallery metadata desktop/mobile, close/reopen, no overflow/network, pixel opacity128/255');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
