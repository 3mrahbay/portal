import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../js/kitap-kulubu/store.mjs';
function harness(role='mudur') {
 const records=new Map();let writes=0,queue=Promise.resolve();
 const snap=p=>({exists:()=>records.has(p),data:()=>records.get(p)});
 const auth={currentUser:{uid:'u',email:'staff@example.invalid',displayName:'Örnek'}};
 const fb={doc:(_,c,id)=>`${c}/${id}`,serverTimestamp:()=>123,
 getDocFromServer:async p=>p.startsWith('personeller/') ? {exists:()=>true,data:()=>({rol:role,durum:'aktif'})}:snap(p),
 runTransaction:(_,fn)=>{const result=queue.then(()=>fn({get:async p=>snap(p),set:(p,d)=>{records.set(p,d);writes++},update:(p,d)=>{records.set(p,{...records.get(p),...d});writes++}}));queue=result.catch(()=>{});return result;}};
 return {records,auth,get writes(){return writes},store:createStore(fb,{},auth)};
}
test('concurrent/repeated join persists once without browser side effects or approval reset',async()=>{
 const h=harness();await Promise.all([h.store.join(),h.store.join()]);assert.equal(h.writes,1);
 await h.store.setMember('u','approved');await h.store.setMember('u','approved');assert.equal(h.writes,2);
 await assert.rejects(h.store.join(),/durumunuz değişti/);assert.equal(h.records.get('kitapKulubuUyeler/u').status,'approved');
});
test('teacher and parent cannot approve; blocked membership does not send welcome',async()=>{
 for(const role of ['ogretmen','veli','danisma','muhasebe']){const h=harness(role);await h.store.join();await assert.rejects(h.store.setMember('u','approved'),/yetkisi/);assert.equal(h.writes,1)}
 const h=harness();await h.store.join();await h.store.setMember('u','blocked');
});
test('membership approval commits without browser email/push requests',async(t)=>{
 const network=t.mock.method(globalThis,'fetch',async()=>{throw Error('browser request forbidden')});
 const h=harness();await h.store.join();await h.store.setMember('u','approved');
 assert.equal(h.records.get('kitapKulubuUyeler/u').status,'approved');assert.equal(network.mock.callCount(),0);
});
