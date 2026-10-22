import test from 'node:test';
import assert from 'node:assert/strict';
import {readWelcomeStatus,welcomeStatusText} from '../js/kitap-kulubu/mail-status.mjs';
import {readFile} from 'node:fs/promises';
test('status request uses a distinct read-only action and no approval, address, or content parameters',async()=>{
 let body;const user={getIdToken:async()=> 'fixture'};
 const value=await readWelcomeStatus(user,'synthetic',async(_,opts)=>{body=JSON.parse(opts.body);return {ok:true,json:async()=>({success:true,state:'queued'})}});
 assert.deepEqual(body,{action:'kitapKulubuDurum',uid:'synthetic',idToken:'fixture'});assert.equal(value.state,'queued');
});
test('old or unavailable backend reports status unavailable, never approval preflight or send failure',async()=>{
 await assert.rejects(readWelcomeStatus({getIdToken:async()=> 'fixture'},'u',async()=>({ok:true,json:async()=>({success:false,error:'Bilinmeyen işlem'})})),e=>/durum servisi/.test(e.message)&&!e.message.includes('Onay öncesi'));
});
test('queue, provider acceptance and delivery evidence are not conflated',()=>{
 assert.match(welcomeStatusText({state:'queued'}),/kuyrukta/);assert.match(welcomeStatusText({state:'queued'}),/kabulü henüz doğrulanmadı/);
 assert.match(welcomeStatusText({state:'accepted'}),/Teslim edildiği doğrulanmadı/);
 assert.match(welcomeStatusText({state:'legacy_excluded'}),/Geriye dönük e-posta gönderilmeyecek/);
 assert.match(welcomeStatusText({state:'inactive'}),/henüz etkin değil/);
 assert.match(welcomeStatusText({state:'needs_review'}),/sonucu belirsiz/);
});
test('server creation metadata is separately labelled, not invented as historical request time',()=>{
 const text=welcomeStatusText({state:'accepted',recordCreatedAt:'2026-10-22T16:51:00Z'});assert.match(text,/Sunucu kayıt oluşturma zamanı/);assert(!text.includes('Talep zamanı:'));
});
test('management status button uses its own handler and never moderation dispatch',async()=>{
 const code=await readFile(new URL('../js/kitap-kulubu/admin-ui.mjs',import.meta.url),'utf8');
 assert.match(code,/data-mail-status=/);
 const handler=code.slice(code.indexOf('if (b.dataset.mailStatus)'),code.indexOf('if (b.dataset.member)'));
 assert.match(handler,/store\.mailStatus/);assert(!/setMember|mutate\(/.test(handler));assert.match(handler,/return;/);
});
