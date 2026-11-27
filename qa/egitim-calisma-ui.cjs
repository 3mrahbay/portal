const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=process.env.EDUCATION_QA_PREPARE_ONLY?{}:require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const markup=source.slice(source.indexOf('<div id="egitimMatrixContainer"'),source.indexOf('<!-- YENİ BRANŞ EKLEME MODALI -->'));
const matrix=source.slice(source.indexOf('let egitimAktifDisiplin ='),source.indexOf('// ============ SINIF RAPORU MODALI ============'));
const click=source.slice(source.indexOf('// Both modes use the same transaction'),source.indexOf('\n};',source.indexOf('// Both modes use the same transaction'))+4);
const scopeCode=fs.readFileSync(path.join(root,'js/egitim-gelisim-okuma.mjs'),'utf8').replaceAll('export ','');
const bootstrap=`
${scopeCode}
window.calls={writes:0,pushes:0};window.messages=[];window.showToast=(m)=>messages.push(m);
const escapeHtmlGelisim=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const aktifMufredatlar={montessori:[{id:'area',ad:'Günlük Yaşam',gruplar:[{ad:'Grup',dersler:Array.from({length:60},(_,i)=>'Kazanım '+i)}]}]};
const ogrenciList=Array.from({length:25},(_,i)=>({id:'child-'+i,ogrenciAdSoyad:'Örnek Öğrenci '+i,sinif:'Örnek Sınıf'})),ayarListesi={};
window.records={'child-4':{montessori:{kayitlar:{'area__Grup__Kazanım 15':'S'},detay:{'area__Grup__Kazanım 15':{asamalar:{S:{durum:'S',not:'Önceki gözlem',tarih:'2026-11-01'}}}}}}};
const tumGelisimYukle=async()=>{if(window.failReload)throw Error('synthetic read failure');return records},tumGelisimOnbelleginiTemizle=()=>{};
window.PortalAPI={state:{currentUser:{uid:'synthetic',email:'synthetic@example.test'},rol:'ogretmen',personel:{sinifAtamalari:['Örnek Sınıf']},ogrenciVerileriHazirMi:true,ogrenciList,ayarListesi,siniflar:['Örnek Sınıf'],aktifDonem:'2026-2027'}};
window.BCK={db:{},rol:()=>PortalAPI.state.rol,personel:()=>({adSoyad:'Örnek Öğretmen'}),kullanici:()=>PortalAPI.state.currentUser,yoneticiMi:()=>false,
 doc:(...x)=>({id:x.at(-1)}),collection:(...x)=>x.at(-1),getDoc:async r=>({exists:()=>!!records[r.id],data:()=>records[r.id]}),serverTimestamp:()=> 'now',setDoc:async()=>{},
 runTransaction:async(db,fn)=>{await fn({get:async r=>({exists:()=>!!records[r.id],data:()=>records[r.id]}),set:(r,v)=>{records[r.id]={...records[r.id],...v};calls.writes++;}});}};
window.PortalData={mufredatAlanlariGetir:async()=>aktifMufredatlar.montessori,mufredatAciklamalariGetir:async()=>({}),aciklamaCoz:()=>({}),sinifEslesirMi:(a,b)=>a===b};
`;
const init=`egitimOkumaDurumu='ready';egitimOkumaKapsami=educationReadScope(PortalAPI.state).key;egitimAktifDisiplin='montessori';egitimAktifSinif='Örnek Sınıf';egitimMatrixVerisi={ogrenciler:ogrenciList.map(o=>({...o,_sinif:o.sinif})),gelisim:records};document.getElementById('egitimMatrixContainer').style.display='block';egitimSinifSeciciDoldur();egitimAlanSeciciDoldur();egitimMatrixRender();window.ready=true;`;
const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><div style="height:150px">Sentetik eğitim testi</div><section id="tab-egitim" class="active">${markup}</section><script>${bootstrap}\n${matrix}\n${click}\n${init}</script></body></html>`;
const out=process.env.EDUCATION_QA_OUTPUT||path.resolve(root,'../qa-output');fs.mkdirSync(out,{recursive:true});
if(process.env.EDUCATION_QA_PREPARE_ONLY){fs.writeFileSync(path.join(out,'fixture.html'),html);process.exit(0);}
(async()=>{const results=[];for(const [name,type] of (process.env.EDUCATION_QA_WEBKIT_ONLY?[['webkit',webkit]]:[['chromium',chromium],['webkit',webkit]])){const browser=await type.launch({headless:true});try{for(const size of [{width:1440,height:900},{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:768,height:1024}]){const page=await browser.newPage({viewport:size}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://education.test')return route.abort();if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});if(u.pathname.endsWith('zeky-bildirim-koprusu.js'))return route.fulfill({contentType:'text/javascript',body:'export const hedefVeliEmailleri=()=>[];export async function bildirimKaydetVePush(){window.calls.pushes++;return {ok:true,push:{ok:true}}}'});if(u.pathname.endsWith('galeri-onay-bildirimi.js'))return route.fulfill({contentType:'text/javascript',body:'export async function notifyGalleryApproval(){return {ok:true,push:{ok:true}}}'});if(u.pathname.endsWith('galeri-onay-canli.js'))return route.fulfill({contentType:'text/javascript',body:'export const gallerySession=s=>s.currentUser.uid;'});if(u.pathname==='/js/egitim-onay-sonucu.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,u.pathname),'utf8')});if(u.pathname==='/moduller/ogretmen-egitim-gozlem.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,u.pathname),'utf8')});return route.abort();});
await page.goto('http://education.test');await page.waitForFunction(()=>window.ready);await page.getByRole('button',{name:'Tam Sayfa Yap'}).click();
assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).overflow),'hidden');
const dims=await page.locator('#egitimMatrixWrap').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,width:el.clientWidth,sw:el.scrollWidth}));assert(dims.height>100,JSON.stringify(dims));assert(dims.scroll>dims.height);assert(dims.sw>dims.width);
await page.locator('#egitimMatrixWrap').evaluate(el=>{el.scrollTop=450;el.scrollLeft=100});
const before=await page.locator('#egitimMatrixWrap').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft}));
await page.evaluate(()=>egitimMatrixRender());assert.deepEqual(await page.locator('#egitimMatrixWrap').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft})),before);
await page.evaluate(()=>matrixHucreTikla('child-4','area','Grup','Kazanım 15'));
await page.locator('#zegoArka select').first().waitFor();assert.equal(await page.locator('#zegoDers').inputValue(),'15');assert.equal(await page.locator('#zegoAlan').isDisabled(),true);
await page.locator('#zegoArka summary').click();assert.match(await page.locator('#zegoArka').innerText(),/Önceki gözlem/);
await page.locator('[data-durum="T"]').click();await page.locator('[data-act="geri"]').click();assert.equal(await page.locator('.zego-durum.on').count(),0);
await page.locator('[data-durum="T"]').click();await page.locator('#zegoNot').fill('Yeni gözlem');await page.locator('[data-act="kaydet"]').click();await page.locator('#zegoArka').waitFor({state:'detached'});
assert.equal(await page.evaluate(()=>calls.writes),1);assert.deepEqual(await page.locator('#egitimMatrixWrap').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft})),before);
await page.locator('#egitimGorunum summary').click();await page.locator('#egitimIsaretlemeModu').selectOption('hizli');await page.locator('#egitimGorunum summary').click();await page.evaluate(()=>matrixHucreTikla('child-4','area','Grup','Kazanım 15'));await page.locator('#zegoArka select').first().waitFor();assert.equal(await page.locator('.zego-ayrinti').isVisible(),false);await page.getByRole('button',{name:'Açıklama / fotoğraf ekle'}).click();assert.equal(await page.locator('.zego-ayrinti').isVisible(),true);await page.getByRole('button',{name:'Vazgeç',exact:true}).click();
await page.locator('#egitimOgrenciAra').fill('Öğrenci 4');assert.equal(await page.locator('.ogrenci-h').count(),1);await page.locator('#egitimKazanimAra').fill('Kazanım 15');assert.equal(await page.locator('.matrix-grup-icerik-tr').count(),1);
await page.locator('#egitimOgrenciAra').fill('');await page.locator('#egitimKazanimAra').fill('');await page.screenshot({path:path.join(out,name+'-'+size.width+'.png')});await page.getByRole('button',{name:'Normal Görünüme Dön'}).click();assert.equal(await page.locator('.egitim-tam-sayfa').count(),0);assert.deepEqual(errors,[]);results.push({engine:name,viewport:size,passed:true});await page.close();}}finally{await browser.close();}}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));})().catch(e=>{console.error(e);process.exitCode=1});
