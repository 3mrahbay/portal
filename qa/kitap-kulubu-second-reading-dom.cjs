// NODE_PATH=<test dependencies>/node_modules node qa/kitap-kulubu-second-reading-dom.cjs
const {JSDOM}=require('jsdom');
const assert=require('node:assert/strict');
(async()=>{
  const {mountClub}=await import('../js/kitap-kulubu/ui.mjs');
  const {INITIAL_ID,INITIAL_BOOK,SECOND_ID,SECOND_BOOK}=await import('../js/kitap-kulubu/core.mjs');
  const dom=new JSDOM('<div id="club"></div>',{url:'https://fixture.invalid'});
  const root=dom.window.document.getElementById('club');
  const books=[{id:SECOND_ID,...SECOND_BOOK},{id:INITIAL_ID,...INITIAL_BOOK,status:'archived'}];
  const calls=[];
  const store={identity:async()=>({read:true,staff:false,manage:false}),member:next=>{next({status:'approved'});return()=>{};},books:next=>{next(books);return()=>{};},posts:(id,next)=>{calls.push(id);next(id===INITIAL_ID?[{id:'old-post',authorName:'Anne',text:'İlk buluşmadan anımız',image:'data:image/jpeg;base64,YQ=='}]:[]);return()=>{};}};
  const stop=await mountClub(root,store);
  assert.match(root.querySelector('[data-book]').textContent,/Ebeveynliği Hissetmek/);
  assert.match(root.textContent,/26 Kasım 2026/);
  assert.match(root.textContent,/iç sesimize/);
  assert.equal(root.querySelector('[data-compose]').hidden,false);
  root.querySelector('[data-tab=archive]').click();
  assert.match(root.querySelector('[data-book]').textContent,/Çocuklar İçin Beş Sevgi Dili/);
  assert.match(root.textContent,/beş sevgi dili/);
  assert.match(root.textContent,/İlk buluşmadan anımız/);
  assert.equal(root.querySelectorAll('[data-posts] img').length,1);
  assert.equal(root.querySelector('[data-compose]').hidden,true);
  assert.doesNotMatch(root.querySelector('[data-book]').textContent,/iç sesimize/);
  root.querySelector('[data-tab=active]').click();
  assert.equal(root.querySelector('[data-compose]').hidden,false);
  assert.deepEqual(calls,[SECOND_ID,INITIAL_ID,SECOND_ID]);
  stop();assert.equal(root.innerHTML,'');
  // Portal management must show both books and keep the second book's stable ID when editing.
  if(process.env.CLUB_PLATFORM!=='zeky') {
    const {mountManagement}=await import('../js/kitap-kulubu/admin-ui.mjs');
    global.FormData=dom.window.FormData;
    const stopAdmin=await mountManagement(root,{identity:async()=>({manage:true}),managementData:async()=>({books,members:[],posts:[]})});
    root.querySelector('[data-section=books]').click();
    assert.match(root.textContent,/Ebeveynliği Hissetmek/);
    assert.match(root.textContent,/Çocuklar İçin Beş Sevgi Dili/);
    assert.match(root.textContent,/iç sesimize/);
    root.querySelector(`[data-edit="${SECOND_ID}"]`).click();
    assert.equal(root.querySelector('[name=date]').value,'2026-11-26T19:00');
    assert.equal(root.querySelector('[name=title]').value,SECOND_BOOK.title);
    stopAdmin();
  }
  dom.window.close();
  console.log('PASS second reading DOM: active/detail/archive/post preservation/composer/management');
})().catch(e=>{console.error(e);process.exitCode=1;});
