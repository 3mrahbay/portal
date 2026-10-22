import test from 'node:test';
import assert from 'node:assert/strict';
import { accessFor } from '../js/kitap-kulubu/core.mjs';
import { bookData, localDate, requestLabel, summary } from '../js/kitap-kulubu/admin-core.mjs';
import { createStore } from '../js/kitap-kulubu/store.mjs';
const stamp = {toDate:()=>new Date('2026-10-22T16:00:00Z'),toMillis:()=>1};
test('management allows only active management/PDR and existing admin exception',()=>{
  for(const rol of ['kurucu_mudur','mudur','pdr']) assert.equal(accessFor({staff:{rol,durum:'aktif'}}).manage,true);
  for(const rol of ['ogretmen','muhasebe','danisma','egitim_koordinator','pdr']) assert.equal(accessFor({staff:{rol,durum:rol==='pdr'?'pasif':'aktif'}}).manage,false);
  assert.equal(accessFor({parent:{yakinlik:'Anne',onaylandi:true}}).manage,false);
  assert.equal(accessFor({email:'emrahby@gmail.com'}).manage,true);
});
test('request timestamps never misrepresent a moderation timestamp',()=>{
  assert.match(requestLabel({status:'pending',updatedAt:stamp}),/19:00/);
  for(const status of ['approved','blocked']) assert.equal(requestLabel({status,updatedAt:stamp}),'Ayrı talep zamanı tutulmamış');
});
test('summary excludes blocked members, archived books and removed posts',()=>{
  assert.deepEqual(summary({members:[{status:'pending'},{status:'approved'},{status:'blocked'}],books:[{status:'active'},{status:'archived'}],posts:[{deleted:true},{deleted:false}]}).map(x=>x[1]),[1,1,1,1]);
});
const values={title:' Kitap ',authors:'Yazar',leader:'Lider',purpose:'Amaç',place:'Okul',date:'2026-10-22T19:00',status:'active'};
test('book validation preserves Istanbul time independent of browser timezone',()=>{
  assert.equal(bookData(values).date,'2026-10-22T19:00:00+03:00');
  assert.equal(bookData(values).title,'Kitap');
  assert.equal(localDate('2026-10-22T16:00:00Z'),values.date);
  for(const patch of [{title:' '},{purpose:'x'.repeat(1001)},{date:'2026-02-30T10:00'},{date:''},{status:'other'}]) assert.throws(()=>bookData({...values,...patch}));
});
function fixture({role='pdr',fail=false,changeSession=false}={}) {
  const auth={currentUser:{uid:'staff',email:'staff@test'}};
  const calls=[];
  const books=Array.from({length:101},(_,i)=>({id:`book-${String(i).padStart(3,'0')}`,date:'2026',status:'active'}));
  const members=Array.from({length:101},(_,i)=>({id:`member-${String(i).padStart(3,'0')}`,status:'pending'}));
  const posts=Array.from({length:41},(_,i)=>({id:`post-${String(i).padStart(3,'0')}`,deleted:false}));
  const fb={doc:(_,c,id)=>[c,id],collection:(_, ...path)=>path.join('/'),documentId:()=> '__name__',orderBy:key=>({order:key}),limit:n=>({limit:n}),startAfter:doc=>({after:doc.id}),query:(path,...constraints)=>({path,...Object.assign({},...constraints)}),getDocFromServer:async([c])=>({exists:()=>c==='personeller',data:()=>({rol:role,durum:'aktif'})}),getDocsFromServer:async q=>{
    calls.push(q);
    if(fail) throw Error('offline');
    if(changeSession) auth.currentUser={uid:'other'};
    const rows=q.path==='kitapKulubu'?books:q.path==='kitapKulubuUyeler'?members:q.path==='kitapKulubu/book-000/paylasimlar'?posts:[];
    return {docs:rows.filter(x=>!q.after||x.id>q.after).slice(0,q.limit).map(x=>({id:x.id,data:()=>x}))};
  }};
  return {store:createStore(fb,{},auth),calls};
}
test('management scans beyond 100 books/members and 20 posts using rule-compliant cursors',async()=>{
  const {store,calls}=fixture();const result=await store.managementData();
  assert.equal(result.books.length,101); assert.equal(result.members.length,101);assert.equal(result.posts.length,41);
  assert(calls.every(q=>q.order==='__name__' && q.limit===(q.path.endsWith('paylasimlar')?20:100)));
  assert.equal(new Set(result.posts.map(p=>p.id)).size,41);
  assert(result.posts.every(p=>p.bookId==='book-000'));
});
test('unauthorized users cannot trigger administrative collection scans',async()=>{
  const {store,calls}=fixture({role:'ogretmen'});await assert.rejects(store.managementData());assert.equal(calls.length,0);
});
test('failed, cancelled and changed-session loads do not return partial totals',async()=>{
  await assert.rejects(fixture({fail:true}).store.managementData(),/offline/);
  const signal=AbortSignal.abort();const {store,calls}=fixture();await assert.rejects(store.managementData({signal}),/iptal/);assert.equal(calls.length,0);
  const other=fixture({changeSession:true});await assert.rejects(other.store.managementData(),/iptal/);assert.equal(other.calls.length,1);
});

test('Portal management entry is under Kurum in the sidebar and hidden until identity check',async()=>{
  const {readFile}=await import('node:fs/promises');
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const sidebar=html.match(/<aside class="crm-sidebar"[\s\S]*?<\/aside>/)[0];
  const kurum=sidebar.split('>KURUM</div>')[1].split('>İLETİŞİM &amp; İŞLEYİŞ</div>')[0];
  assert.match(kurum,/<a class="side-item" data-bk-manage hidden href="kitap-kulubu-yonetim.html"/);
  assert.equal((html.match(/data-bk-manage hidden href=/g)||[]).length,1);
  assert(!html.includes('bk-management-entry'));
  assert.match(html,/\.side-item\[data-bk-manage\]\[hidden\] \{ display: none !important;/);
  assert(!html.includes('class="tab" data-bk-manage'));
  const ui=await readFile(new URL('../js/kitap-kulubu/ui.mjs',import.meta.url),'utf8');
  assert.match(ui,/access.manage \?/);assert.match(ui,/kitap-kulubu-yonetim.html/);
});

test('management loads the versioned store and precaches its exact URL',async()=>{
  const {installedPwa,assertPrecachedImport}=await import('./helpers/portal-pwa.mjs');
  const worker=await installedPwa();
  const {readFile: readHtml}=await import('node:fs/promises');
  const html=await readHtml(new URL('../kitap-kulubu-yonetim.html',import.meta.url),'utf8');
  const entry=html.match(/src="(js\/kitap-kulubu\/admin-page\.mjs\?v=\d+)"/)[1];
  assert(worker.precache.includes('./'+entry));
  assertPrecachedImport(worker,'js/kitap-kulubu/admin-page.mjs','js/kitap-kulubu/store.mjs');
  const {readFile}=await import('node:fs/promises');
  const page=await readFile(new URL('../js/kitap-kulubu/admin-page.mjs',import.meta.url),'utf8');
  assert.match(page,/from "\.\/store\.mjs\?v=\d+"/);
});
