const {JSDOM}=require('jsdom');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');const path=require('node:path');
(async()=>{
 const prefix=process.env.CLUB_WEB_PREFIX||'';
 const url=p=>pathToFileURL(path.resolve(__dirname,'..',prefix,'js/kitap-kulubu',p));
 const {clubTarget,renderClubNotices}=await import(url('notices.mjs'));
 const dom=new JSDOM('<section></section><main></main>',{url:'https://example.test/kitap-kulubu.html?book=older-book&post=older-photo'});
 const root=dom.window.document.querySelector('section');let clicked='';let active=true;
 const notice={id:'n',tip:'kitap_kulubu_yanit',kitapId:'older-book',paylasimId:'older-photo',baslik:'<img src=x>',metin:'<script>bad</script>',olusturuldu:'2026-11-09T10:00:00Z'};
 assert.equal(clubTarget({...notice,kitapId:'a/b'}),'');assert.equal(clubTarget({...notice,tip:'duyuru'}),'');
 renderClubNotices(root,[notice],{isActive:()=>active,open:async(r,target)=>{clicked=target;}});
 assert.equal(root.querySelector('img,script'),null);root.querySelector('button').click();await new Promise(r=>setTimeout(r,0));assert.equal(clicked,'kitap-kulubu.html?book=older-book&post=older-photo');
 active=false;renderClubNotices(root,[notice],{isActive:()=>active});assert.equal(root.textContent,'');assert(root.hidden);
 const {mountClub}=await import(url('ui.mjs'));let targetNext,memberNext,feedNext,stopped=0,opened=0;
 const noop=()=>()=>{};
 const store={identity:async()=>({uid:'u',read:true,staff:false}),
 member:n=>{memberNext=n;n({status:'pending'});return()=>{};},books:n=>{n([{id:'new-book',status:'active'},{id:'older-book',status:'active'}]);return()=>{};},
 posts:(id,n)=>{assert.equal(id,'older-book');feedNext=n;n([{id:'new-photo',image:'data:image/jpeg;base64,YQ=='}]);return()=>{};},
 postById:(b,p,n)=>{assert.equal(p,'older-photo');targetNext=n;n({id:p,image:'data:image/jpeg;base64,YQ=='});return()=>stopped++;},
 reactions:noop,ownReaction:noop,replies:()=>{opened++;return()=>{};}};
 const main=dom.window.document.querySelector('main');const stop=await mountClub(main,store);
 assert.equal(opened,0);memberNext({status:'approved'});assert.equal(opened,1);
 assert.equal(main.querySelector('[data-photo-interactions="older-photo"] [data-open]').getAttribute('aria-expanded'),'true');
 feedNext([{id:'newer-photo',image:'data:image/jpeg;base64,YQ=='}]);assert(main.querySelector('[data-photo-interactions="older-photo"]'));
 targetNext(null);assert.match(main.querySelector('[data-error]').textContent,/kaldırılmış/);assert.equal(main.querySelector('[data-photo-interactions="older-photo"]'),null);
 stop();assert.equal(stopped,1);targetNext({id:'older-photo',image:'x'});assert.equal(main.textContent,'');dom.window.close();
 console.log('PASS: safe notice DOM, direct older photo, delayed membership, deletion, session cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
