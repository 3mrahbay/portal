import test from 'node:test';
import assert from 'node:assert/strict';
import {createPollStore} from '../js/kitap-kulubu/polls-store.mjs';
test('poll store bounds pages, isolates own ballot, and rejects stale sessions',async()=>{
 const auth={currentUser:{uid:'member-a'}},subscriptions=[];let resolvePage,resolveCommand;
 const fb={collection:(...x)=>x,doc:(...x)=>x,query:(...x)=>x,orderBy:(...x)=>['order',...x],limit:n=>['limit',n],startAfter:c=>['after',c],onSnapshot:(...args)=>{subscriptions.push(args);return()=>{};},getDocsFromServer:()=>new Promise(r=>resolvePage=r)};
 const store=createPollStore(fb,'db',auth,()=>new Promise(r=>resolveCommand=r));
 let seen,ballot;store.polls((rows,meta)=>seen={rows,meta},()=>{});
 assert.deepEqual(subscriptions[0][0],[['db','kitapKulubuOylamalar'],['order','createdAt','desc'],['limit',20]]);
 subscriptions[0][2]({docs:[{id:'poll-a',data:()=>({total:2})}],metadata:{fromCache:true}});assert.equal(seen.meta.cached,true);assert.equal(seen.rows[0].id,'poll-a');
 store.pollVote('poll-a',v=>ballot=v,()=>{});assert.deepEqual(subscriptions[1][0],['db','kitapKulubuOylamalar','poll-a','oylar','member-a']);
 subscriptions[1][1]({exists:()=>true,data:()=>({optionId:'o1'})});assert.equal(ballot.optionId,'o1');
 const page=store.olderPolls('cursor'),command=store.pollCommand({action:'vote'});auth.currentUser={uid:'member-b'};
 subscriptions[1][1]({exists:()=>true,data:()=>({optionId:'o0'})});assert.equal(ballot.optionId,'o1');
 resolvePage({docs:[]});resolveCommand({});await assert.rejects(page,/Oturum değişti/);await assert.rejects(command,/Oturum değişti/);
 auth.currentUser=null;assert.throws(()=>store.pollVote('poll-a',()=>{},()=>{}),/giriş/);
});
