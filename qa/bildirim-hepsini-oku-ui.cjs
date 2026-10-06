// Synthetic cloud-browser QA. All requests are locally fulfilled or aborted;
// the real Portal, Firebase and user data are never loaded.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.resolve(process.env.NOTIFICATION_QA_OUTPUT||path.join(root,'..','qa-output','mark-all-read'));
const modules=['portal-bildirim-merkezi.js','portal-bildirim-basliklari.js','portal-bildirim-yerlesim.js','portal-mesaj-bildirim.js'];
const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bildirim QA</title><style>*{box-sizing:border-box}body{margin:0;font:16px Arial,sans-serif;background:#faf8fc;color:#202944}header{display:flex;justify-content:space-between;align-items:center;padding:16px;gap:12px;border-bottom:1px solid #dde2ee}h1{font-size:18px;margin:0}main{padding:18px}.synthetic{font-size:12px;color:#657080}</style></head><body><header><h1>Portal</h1><div id="bell"></div></header><main><p class="synthetic">Sentetik kontrol · Gerçek hesap veya veri yok</p><button id="outside">Diğer içerik</button></main><script type="module">
import {startNotificationCenter} from '/js/portal-bildirim-merkezi.js';
window.writes=[];window.navigations=[];window.waiting=[];window.currentEmail='reader@example.test';window.rows=[];window.mode='success';window.failIds=[];
const db={},fb={collection:(_db,...p)=>p.join('/'),where:(...p)=>p,query:(...p)=>p,doc:(_db,...p)=>p.join('/'),getDoc:async()=>({exists:()=>false}),
 onSnapshot:(q,o,next,error)=>{window.snapshot=next;window.listenerError=error;return()=>{};},
 updateDoc:async(path,patch)=>{writes.push({path,patch});if(mode==='pending')await new Promise((resolve,reject)=>waiting.push({resolve,reject}));if(failIds.includes(path.split('/').at(-1)))throw Error('synthetic-denied');}};
window.center=startNotificationCenter({fb,db,email:currentEmail,mounts:['bell'],getCurrentEmail:()=>currentEmail,navigate:item=>navigations.push(item.id)});
window.record=(id,extra={})=>({id,aliciEmail:currentEmail,tip:'galeri',okundu:false,baslik:'Sentetik galeri bildirimi '+id,olusturuldu:'2026-10-06T19:00:00Z',...extra});
window.emit=(data,cache=false)=>{rows=data;snapshot({metadata:{fromCache:cache},forEach:cb=>data.forEach(row=>cb({id:row.id,data:()=>row,metadata:{hasPendingWrites:!!row._pendingWrites}}))});};
window.release=()=>{mode='success';waiting.splice(0).forEach(x=>x.resolve());};window.fixtureReady=true;
</script></body></html>`;
(async()=>{
fs.mkdirSync(output,{recursive:true});
if(process.env.NOTIFICATION_QA_PREPARE_ONLY==='1'){
 const controls='<nav aria-label="Sentetik kontroller"><button onclick="emit([record(\'one\'),record(\'two\')]);">Başlangıç</button><button onclick="mode=\'pending\'">Beklet</button><button onclick="emit([...rows,record(\'new\')])">Yeni bildirim</button><button onclick="release()">Tamamla</button><button onclick="failIds=[\'two\'];emit([record(\'one\'),record(\'two\')])">Hata senaryosu</button><button onclick="failIds=[]">Hatayı kaldır</button><button onclick="listenerError(Error(\'synthetic\'))">Dinleyici hatası</button><button onclick="currentEmail=\'next@example.test\';center.stop();release()">Hesap değiştir</button></nav>';
 fs.writeFileSync(path.join(output,'fixture.html'),html.replace('<main>','<main>'+controls));console.log('Prepared isolated synthetic fixture');return;
}
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results=[];
try{for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:320,height:740}]){
 const page=await browser.newPage({viewport}),errors=[],blocked=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin==='http://notification-fixture.test'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});if(url.origin==='http://notification-fixture.test'&&modules.includes(path.basename(url.pathname)))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'js',path.basename(url.pathname)),'utf8')});blocked.push(url.href);return route.abort();});
 const reset=async()=>{await page.goto('http://notification-fixture.test/');await page.waitForFunction(()=>fixtureReady);};
 const action=()=>page.getByRole('button',{name:'Hepsini okundu yap',exact:true});
 await reset();await page.locator('.pbm-zil').click();assert.equal(await action().isDisabled(),true);await page.evaluate(()=>emit([record('one'),record('two'),record('read',{okundu:true})]));
 assert.equal(await action().isEnabled(),true);const box=await action().boundingBox();assert(box.width>=44&&box.height>=44);assert(box.x>=0&&box.x+box.width<=viewport.width);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,`before-${viewport.width}.png`),fullPage:true});
 // Keyboard activation, no page change and no optimistic read while pending.
 await page.evaluate(()=>mode='pending');await action().focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>writes.length===2);
 assert.equal(await page.locator('.pbm-hepsini-oku').isDisabled(),true);assert.equal(await page.evaluate(()=>center.getState().unreadCount),2);
 await page.evaluate(()=>{window.samePromise=center.markAllRead()===center.markAllRead();emit([...rows,record('new')]);});assert.equal(await page.evaluate(()=>samePromise),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.pbm-panel').isVisible(),false);await page.locator('.pbm-zil').click();assert.equal(await page.locator('.pbm-hepsini-oku').isDisabled(),true);
 await page.screenshot({path:path.join(output,`pending-${viewport.width}.png`),fullPage:true});await page.evaluate(()=>release());await page.waitForFunction(()=>!center.getState().markingAll);
 assert.equal(await page.evaluate(()=>center.getState().unreadCount),1);assert.equal(await page.evaluate(()=>writes.length),2);assert.deepEqual(await page.evaluate(()=>navigations),[]);
 await action().click();await page.waitForFunction(()=>!center.getState().markingAll);assert.equal(await page.evaluate(()=>center.getState().unreadCount),0);assert.equal(await page.locator('.pbm-sayac').isVisible(),false);
 assert.equal(await action().isDisabled(),true);await page.screenshot({path:path.join(output,`complete-${viewport.width}.png`),fullPage:true});
 // Partial failure and deliberate retry.
 await reset();await page.evaluate(()=>{emit([record('good'),record('bad')]);failIds=['bad'];});await page.locator('.pbm-zil').click();await action().click();await page.waitForFunction(()=>!center.getState().markingAll);
 assert.equal(await page.evaluate(()=>center.getState().unreadCount),1);assert.match(await page.locator('.pbm-durum').innerText(),/1 bildirim okundu\. 1 bildirim kaydedilemedi/);await page.screenshot({path:path.join(output,`partial-${viewport.width}.png`),fullPage:true});
 await page.evaluate(()=>failIds=[]);await action().click();await page.waitForFunction(()=>!center.getState().markingAll);assert.equal(await page.evaluate(()=>writes.length),3);
 // An unavailable root listener disables a misleading global action.
 await reset();await page.evaluate(()=>{emit([record('one')]);listenerError(Error('synthetic-unavailable'));});await page.locator('.pbm-zil').click();assert.equal(await action().isDisabled(),true);assert.match(await page.locator('.pbm-durum').innerText(),/alınamadı/);
 // Account switch while eight requests are pending must not start the queue tail.
 await reset();await page.evaluate(()=>{emit(Array.from({length:20},(_,i)=>record(String(i))));mode='pending';});await page.locator('.pbm-zil').click();await action().click();await page.waitForFunction(()=>writes.length===8);
 await page.evaluate(()=>{currentEmail='next@example.test';center.stop();release();});await page.waitForFunction(()=>center.status==='stopped');assert.equal(await page.evaluate(()=>writes.length),8);assert.equal(await page.locator('.pbm-panel').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);results.push({viewport,passed:true,cases:['44px target / no overflow','keyboard Enter and Escape','snapshot own unread only','pessimistic busy state','repeat-click coalescing','new arrival retained','close/reopen','success clears badge','partial failure/retry','listener unavailable','account switch cancels queue'],unexpectedNetwork:blocked,pageErrors:errors});await page.close();
}
fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,mode:'fully intercepted synthetic cloud browser',results},null,2));console.log('PASS mark-all-read browser QA at 1280px, 390px and 320px; screenshots: '+output);
}finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
