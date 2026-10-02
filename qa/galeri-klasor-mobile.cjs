let playwright;try{playwright=require('playwright')}catch(_){playwright=require('/opt/codex/cua_node/lib/node_modules/playwright')}const {chromium}=playwright;
const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'), output=path.join(__dirname,'topic-output');fs.mkdirSync(output,{recursive:true});
const rows=[
{id:'a',program:'jimnastik',etkinlikBaslik:'Denge Çalışması',hedefTur:'sinif',hedefDeger:'Test Sınıfı',donem:'2026-2027',dosyaTipi:'foto',bunnyUrl:'https://media.test/photo.svg',etkinlikTarih:'2026-09-30',durum:'onaylandi'},
{id:'b',program:'jimnastik',etkinlikBaslik:' DENGE  ÇALIŞMASI ',hedefTur:'sinif',hedefDeger:'Test Sınıfı',donem:'2026-2027',dosyaTipi:'video',bunnyUrl:'https://media.test/clip.mp4',kucukResim:'https://media.test/photo.svg',etkinlikTarih:'2026-10-02',durum:'beklemede'},
{id:'c',program:'jimnastik',etkinlikBaslik:'Denge Çalışması',hedefTur:'sinif',hedefDeger:'Diğer Sınıf',donem:'2026-2027',dosyaTipi:'foto',bunnyUrl:'https://media.test/photo.svg',durum:'onaylandi'},
{id:'d',program:'jimnastik',etkinlikBaslik:'Denge Çalışması',hedefTur:'sinif',hedefDeger:'Test Sınıfı',donem:'2025-2026',dosyaTipi:'foto',bunnyUrl:'https://media.test/photo.svg',durum:'onaylandi'},
{id:'e',program:'drama',etkinlikBaslik:`Kukla "Masalı" <img src=x onerror="window.injected=1">`,hedefTur:'ogrenci',hedefDeger:'child',donem:'2026-2027',dosyaTipi:'foto',bunnyUrl:'https://media.test/photo.svg',durum:'onaylandi'}];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:320,height:740}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='media.test'){if(u.pathname.endsWith('.svg'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect fill="#8abe90" width="320" height="180"/><text x="40" y="90">Sentetik Galeri</text></svg>'});return route.fulfill({status:404,body:'synthetic missing video'});}
 if(u.hostname!=='gallery.test')return route.abort();
 if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:16px;font-family:Arial;background:#faf8fc}button{font:inherit}</style><main id="gallery"></main><script type="module">
 window.PortalAPI={state:{rol:'ogretmen',currentUser:{uid:'teacher'}},toast(){}};
 window.galeriListesiVerisi=${JSON.stringify(rows)}; window.events=[];
 window.acGaleriLightbox=id=>window.events.push(['open',id]);window.veliAcGaleriLightbox=()=>{};window.closeGaleriLightbox=()=>{};
 const {createGalleryFolderView}=await import('./js/portal-galeri-klasor-ui.js');
 window.view=createGalleryFolderView();window.repaint=()=>view.render(document.getElementById('gallery'),galeriListesiVerisi,{management:true,activePeriod:'2026-2027',addProgram:p=>events.push(['program',p]),addTopic:m=>events.push(['topic',m.id,m.program])});
 window.galeriOnayla=id=>{events.push(['approve',id]);galeriListesiVerisi.find(m=>m.id===id).durum='onaylandi';repaint()};window.galeriReddet=id=>{events.push(['reject',id]);galeriListesiVerisi.find(m=>m.id===id).durum='reddedildi';repaint()};repaint();</script>`});
 const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.fulfill({status:404,body:'not found'});return route.fulfill({contentType:f.endsWith('.js')?'text/javascript':'text/plain',body:fs.readFileSync(f)});
 });
 await page.goto('http://gallery.test/');await page.locator('[data-program-index]').first().waitFor();assert.equal(await page.locator('[data-program-index]').count(),8);
 await page.locator('[data-program-index="5"]').click();assert.equal(await page.locator('[data-folder-index]').count(),3);
 await page.locator('[data-folder-index]').filter({hasText:'30.09.2026'}).click();assert.equal(await page.locator('[data-folder-media]').count(),2);
 assert.equal(await page.locator('[data-approve]').count(),1);await page.locator('[data-folder-add]').click();assert.deepEqual(await page.evaluate(()=>events.at(-1)),['topic','a','jimnastik']);
 await page.locator('[data-approve]').click();assert.equal(await page.locator('[data-approve]').count(),0);assert.ok(await page.evaluate(()=>events.some(e=>e[0]==='approve'&&e[1]==='b')));
 await page.screenshot({path:path.join(output,'portal-topic-mobile.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no mobile overflow');
 await page.locator('[data-folder-back]').click();assert.equal(await page.locator('[data-folder-index]').count(),3);await page.locator('[data-folder-back]').click();assert.equal(await page.locator('[data-program-index]').count(),8);
 await page.locator('[data-program-index="6"]').click();await page.locator('[data-folder-index]').click();assert.equal(await page.evaluate(()=>window.injected||0),0);assert.equal(await page.locator('#gallery > div img[src="x"]').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'long topic wraps on mobile');
 await page.locator('[data-folder-back]').click();await page.locator('[data-folder-back]').click();await page.locator('[data-program-index="7"]').click();await page.locator('[data-folder-add]').click();assert.deepEqual(await page.evaluate(()=>events.at(-1)),['program','kodlama']);
 await page.evaluate(()=>{view.reset();repaint()});assert.equal(await page.locator('[data-program-index]').count(),8);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,viewport:'320x740',programs:8,cases:['program/topic/back','batch mixed media','class/period separation','add topic/program','moderation refresh','hostile title safe','mobile overflow','empty program','reset'],pageErrors:errors},null,2));
 console.log('PASS synthetic mobile folder navigation, scope, moderation, escaping and overflow');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
