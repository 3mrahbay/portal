// Synthetic-only browser test. No Firebase or production network requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const bootstrap=`import {mountManagement} from '/js/kitap-kulubu/admin-ui.mjs';
const stamp={toDate:()=>new Date('2026-10-22T16:00:00Z'),toMillis:()=>1};
window.calls=[];window.denied=false;window.failed=false;window.delayed=false;
window.data={books:[{id:'b1',title:'Örnek Kitap',authors:'Örnek Yazar',leader:'PDR',place:'Okul',purpose:'Birlikte okuyoruz.',date:'2026-10-22T19:00:00+03:00',status:'active'},{id:'b2',title:'Geçmiş Kitap',authors:'Yazar',leader:'Lider',place:'Okul',purpose:'Sohbet',date:'2026-09-22T19:00:00+03:00',status:'archived'}],members:[{id:'m1',name:'Örnek Anne <img src=x onerror=alert(1)>',status:'pending',updatedAt:stamp},{id:'m2',name:'İkinci Anne',status:'approved',updatedAt:stamp}],posts:Array.from({length:22},(_,i)=>({id:'p'+i,bookId:i===21?'b2':'b1',authorName:'Örnek Anne',text:'Örnek paylaşım '+i,createdAt:stamp,deleted:false,image:i===0?'data:image/jpeg;base64,/9j/AA==':''}))};
window.store={identity:async()=>({manage:!window.denied}),managementData:async()=>{if(window.failed)throw Error('Sentetik bağlantı hatası');if(window.delayed)await new Promise(r=>window.release=r);return data;},setMember:async(id,status)=>{calls.push(['member',id,status]);data.members.find(m=>m.id===id).status=status;},archive:async(id,status)=>{calls.push(['archive',id,status]);data.books.find(b=>b.id===id).status=status;},remove:async(book,id)=>{calls.push(['remove',book,id]);const p=data.posts.find(p=>p.id===id&&p.bookId===book);p.deleted=true;p.image='';p.text='';},saveBook:async(id,values)=>{calls.push(['save',id,values]);const book=data.books.find(b=>b.id===id);if(book)Object.assign(book,values);else data.books.push({id,...values});}};
window.stop=await mountManagement(document.getElementById('club'),store);window.ready=true;`;
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {for(const width of [1280,390,320]) {
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!=='http://club.test')return route.abort();
  if(url.pathname==='/js/kitap-kulubu/admin-page.mjs')return route.fulfill({contentType:'text/javascript',body:bootstrap});
  const file=path.join(root,url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
  await route.fulfill({path:file,contentType:file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
 });
 await page.goto('http://club.test/kitap-kulubu-yonetim.html');await page.waitForFunction(()=>window.ready&&document.querySelector('[data-summary]').children.length===4);
 assert.equal(await page.locator('[data-content] img').count(),0,'member names are escaped');
 const fit=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);
 await fit();
 if(process.env.CLUB_QA_OUTPUT){fs.mkdirSync(process.env.CLUB_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.CLUB_QA_OUTPUT,'kitap-yonetimi-'+width+'.png'),fullPage:true});}
 await page.getByRole('button',{name:'Onayla',exact:true}).click();await page.waitForFunction(()=>calls.length===1&&!document.querySelector('[data-refresh]').disabled);
 assert.deepEqual(await page.evaluate(()=>calls[0]),['member','m1','approved']);
 await page.locator('[data-member="m1"]').click();await page.waitForFunction(()=>calls.length===2&&!document.querySelector('[data-refresh]').disabled);
 await page.getByRole('button',{name:'Üyeler',exact:true}).click();await fit();
 await page.getByRole('button',{name:'Paylaşımlar',exact:true}).click();assert.equal(await page.locator('[data-content] article').count(),20);
 await page.getByRole('button',{name:'Daha fazla göster'}).click();assert.equal(await page.locator('[data-content] article').count(),22);
 await page.locator('[data-book-filter]').selectOption('b2');assert.equal(await page.locator('[data-content] article').count(),1);
 await page.getByRole('button',{name:'Paylaşımı kaldır',exact:true}).click();await page.waitForFunction(()=>calls.length===3&&!document.querySelector('[data-refresh]').disabled);assert.deepEqual(await page.evaluate(()=>calls[2]),['remove','b2','p21']);
 assert.match(await page.locator('[data-content]').innerText(),/Bu paylaşım kaldırıldı/);await fit();
 await page.getByRole('button',{name:'Kitaplar & Buluşmalar'}).click();await page.locator('[data-edit="b1"]').click();
 assert.equal(await page.locator('[name=date]').inputValue(),'2026-10-22T19:00');await page.locator('[name=place]').fill('Yeni buluşma yeri');await page.getByRole('button',{name:'Kaydet',exact:true}).click();await page.waitForFunction(()=>calls.length===4&&!document.querySelector('[data-refresh]').disabled);
 assert.equal(await page.evaluate(()=>calls[3][1]),'b1');assert.equal(await page.evaluate(()=>calls[3][2].place),'Yeni buluşma yeri');
 await page.locator('[data-archive="b1"]').click();await page.waitForFunction(()=>calls.length===5&&!document.querySelector('[data-refresh]').disabled);
 await page.locator('[data-archive="b1"]').click();await page.waitForFunction(()=>calls.length===6&&!document.querySelector('[data-refresh]').disabled);
 await page.getByRole('button',{name:'Yeni okuma ekle'}).click();await fit();for(const [key,value] of Object.entries({title:'Yeni Kitap',authors:'Yazar',leader:'Lider',place:'Okul',purpose:'Amaç',date:'2026-11-22T19:00'}))await page.locator('[name='+key+']').fill(value);
 await page.getByRole('button',{name:'Kaydet',exact:true}).click();await page.waitForFunction(()=>calls.length===7&&!document.querySelector('[data-refresh]').disabled);assert.equal(await page.evaluate(()=>data.books.length),3);
 await page.evaluate(()=>window.denied=true);await page.locator('[data-archive="b1"]').click();await page.waitForFunction(()=>document.querySelector('[data-error]').textContent.includes('yetkiniz'));assert.equal(await page.evaluate(()=>calls.length),7);
 await page.evaluate(()=>{window.denied=false;window.failed=true;});await page.getByRole('button',{name:'Verileri yenile'}).click();await page.waitForFunction(()=>document.querySelector('[data-error]').textContent.includes('bağlantı'));assert.equal(await page.locator('[data-summary] article').count(),0);assert.equal(await page.locator('[data-content] button').count(),0);
 await page.evaluate(()=>window.failed=false);await page.getByRole('button',{name:'Verileri yenile'}).click();await page.waitForFunction(()=>document.querySelector('[data-summary]').children.length===4);
 await page.evaluate(()=>window.delayed=true);await page.getByRole('button',{name:'Verileri yenile'}).click();await page.waitForFunction(()=>!!window.release);await page.evaluate(()=>{stop();release();});await page.waitForTimeout(30);assert.equal(await page.locator('#club').innerHTML(),'');
 assert.deepEqual(errors,[]);await page.close();console.log('PASS management UI '+width+'px: moderation, filters, editing, refresh failure, role revocation, cleanup, overflow');
}
} finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
