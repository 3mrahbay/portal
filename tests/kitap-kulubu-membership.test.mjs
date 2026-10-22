import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../js/kitap-kulubu/store.mjs';
import {membershipEffects} from '../js/kitap-kulubu/membership-effects.mjs';
function harness(role='mudur') {
 const records=new Map();let writes=0,queue=Promise.resolve();const effects=[];
 const snap=p=>({exists:()=>records.has(p),data:()=>records.get(p)});
 const auth={currentUser:{uid:'u',email:'staff@example.invalid',displayName:'Örnek'}};
 const fb={doc:(_,c,id)=>`${c}/${id}`,serverTimestamp:()=>123,
 getDocFromServer:async p=>p.startsWith('personeller/') ? {exists:()=>true,data:()=>({rol:role,durum:'aktif'})}:snap(p),
 runTransaction:(_,fn)=>{const result=queue.then(()=>fn({get:async p=>snap(p),set:(p,d)=>{records.set(p,d);writes++},update:(p,d)=>{records.set(p,{...records.get(p),...d});writes++}}));queue=result.catch(()=>{});return result;}};
 return {records,auth,effects,get writes(){return writes},store:createStore(fb,{},auth,async(u,id,phase)=>effects.push({id,phase}))};
}
test('concurrent/repeated join persists once and retries effects without resetting approval',async()=>{
 const h=harness();await Promise.all([h.store.join(),h.store.join()]);assert.equal(h.writes,1);assert.equal(h.effects.length,2);
 await h.store.setMember('u','approved');await h.store.setMember('u','approved');assert.equal(h.writes,2);
 await assert.rejects(h.store.join(),/durumunuz değişti/);assert.equal(h.records.get('kitapKulubuUyeler/u').status,'approved');
});
test('teacher and parent cannot approve; blocked membership does not send welcome',async()=>{
 for(const role of ['ogretmen','veli','danisma','muhasebe']){const h=harness(role);await h.store.join();await assert.rejects(h.store.setMember('u','approved'),/yetkisi/);assert.equal(h.writes,1)}
 const h=harness();await h.store.join();await h.store.setMember('u','blocked');assert.deepEqual(h.effects.map(e=>e.phase),['pending']);
});
test('effects use only member id, verified server action and session token; partial errors remain visible',async()=>{
 const bodies=[];const send=async(url,options)=>{const b=JSON.parse(options.body);bodies.push(b);return {ok:true,json:async()=>b.action ? {success:true}:{kalici:true}}};
 await membershipEffects({getIdToken:async()=> 'synthetic'},'u','pending',send);
 assert.equal(bodies.length,2);assert(bodies.every(b=>b.idToken==='synthetic'&&!('to'in b)&&!('htmlContent'in b)&&!('aliciEmailler'in b)));
 await assert.rejects(membershipEffects({getIdToken:async()=> 'synthetic'},'u','approved',async()=>({ok:true,json:async()=>({success:false,state:'uncertain'})})),/Üyelik onaylandı/);
});
