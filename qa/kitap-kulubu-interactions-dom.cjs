const {JSDOM}=require('jsdom');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');const path=require('node:path');
(async()=>{
const dom=new JSDOM('<main><div data-photo-interactions="p"></div></main>',{url:'https://example.test'});
global.document=dom.window.document;global.confirm=()=>true;
const {createPhotoInteractions}=await import(pathToFileURL(path.resolve(__dirname,'../js/kitap-kulubu/interactions-ui.mjs')));
const root=document.querySelector('main');let reactionNext,ownNext,replyNext,stops=0,writes=[],fail=false;
const store={reactions:(b,p,n)=>{reactionNext=n;return()=>stops++},ownReaction:(b,p,n)=>{ownNext=n;return()=>stops++},replies:(b,p,n)=>{replyNext=n;return()=>stops++},react:async(...v)=>writes.push(v),reply:async(...v)=>{if(fail)throw Error('Bağlantı yok');writes.push(v)},removeReply:async()=>{},olderReplies:async()=>[]};
const control=createPhotoInteractions(root,store),book={id:'b',status:'active'},posts=new Map([['p',{id:'p',image:'photo',deleted:false}]]),access={uid:'u',read:true,staff:false,manage:false};
const sync=()=>control.sync(book,posts,access,{status:'approved'});sync();reactionNext([{emoji:'❤️'}]);ownNext('');
const click=s=>root.querySelector(s).click();const tick=()=>new Promise(r=>setTimeout(r,0));
click('[data-react="❤️"]');await tick();assert.deepEqual(writes.at(-1),['b','p','❤️']);ownNext('❤️');click('[data-react="❤️"]');await tick();assert.deepEqual(writes.at(-1),['b','p','']);
click('[data-open]');replyNext([{id:'r',authorUid:'other',authorName:'<img src=x>',text:'<script>bad</script>'}]);assert.equal(root.querySelectorAll('script,img').length,0);assert.equal(root.querySelector('[data-delete-reply]'),null);
let input=root.querySelector('textarea');input.value='Taslağım';const node=input;
root.innerHTML='<div data-photo-interactions="p"></div>';sync();assert.equal(root.querySelector('textarea'),node);assert.equal(node.value,'Taslağım');
fail=true;root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(node.value,'Taslağım');assert.match(root.querySelector('[role=alert]').textContent,/Bağlantı/);
fail=false;root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(node.value,'');assert.equal(writes.at(-1)[3],'Taslağım');
book.status='archived';sync();assert.equal(root.querySelector('form').hidden,true);assert.equal(root.querySelector('[data-react]').disabled,true);
control.sync(book,posts,access,{status:'blocked'});assert.equal(root.querySelector('.kc-interactions'),null);assert.equal(stops,3);
replyNext([{id:'late',text:'late'}]);assert.equal(root.querySelector('.kc-interactions'),null);control.clear();
console.log('DOM checks passed: reactions, undo, replies, XSS, retained draft, retry, archive, revoked access, cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});

// Feed snapshots must preserve the focused reply, not only its text.
(async()=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.test'}),root=dom.window.document.querySelector('main');
 const {mountClub}=await import(pathToFileURL(path.resolve(__dirname,'../js/kitap-kulubu/ui.mjs')));
 let postsNext;
 const photo={id:'p',authorUid:'a',authorName:'Anne',text:'Fotoğraf',image:'data:image/jpeg;base64,YQ=='};
 const store={identity:async()=>({uid:'u',read:true,staff:false,manage:false}),
  member:n=>{n({status:'approved'});return()=>{}},books:n=>{n([{id:'b',status:'active',title:'Kitap'}]);return()=>{}},
  posts:(_b,n)=>{postsNext=n;n([photo]);return()=>{}},reactions:(_b,_p,n)=>{n([]);return()=>{}},ownReaction:(_b,_p,n)=>{n('');return()=>{}},replies:(_b,_p,n)=>{n([]);return()=>{}}};
 const stop=await mountClub(root,store);root.querySelector('[data-open]').click();
 const input=root.querySelector('[data-reply-form] textarea');input.value='Yanıt taslağı';input.focus();input.setSelectionRange(3,5);
 postsNext([{...photo,text:'Güncellenmiş açıklama'}]);
 assert.equal(dom.window.document.activeElement,input);assert.equal(input.value,'Yanıt taslağı');assert.equal(input.selectionStart,3);assert.equal(input.selectionEnd,5);
 stop();dom.window.close();console.log('PASS live feed preserves reply focus and selection');
})().catch(e=>{console.error(e);process.exitCode=1});
