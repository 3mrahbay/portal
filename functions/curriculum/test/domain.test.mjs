import {test} from 'node:test';import assert from 'node:assert/strict';
import {profileEmail,authorized,parseChanges,checkBase,validateMoves,migrate} from '../src/domain.mjs';
const auth={uid:'teacher',token:{email:'teacher@example.test',email_verified:true}};
const base=[{id:'area',ad:'Alan',gruplar:[{ad:'Grup',dersler:['Eski']}]}];
const next=[{id:'area',ad:'Alan',gruplar:[{ad:'Grup',dersler:['Yeni']}]}];
const changes={changes:[{disiplin:'montessori',base,alanlar:next,tasimalar:[{eski:'area__Grup__Eski',yeni:'area__Grup__Yeni'}]}]};
test('teacher permission is explicit, boolean, active and role limited',()=>{
 for(const rol of ['ogretmen','yardimci_ogretmen','ingilizce_ogretmeni','degerler_ogretmeni','orman_ogretmeni','brans_ogretmeni']){
  assert.equal(authorized(auth,{rol,durum:'aktif',mufredatDuzenleme:true}),true);
  for(const value of [undefined,false,'true',1])assert.equal(authorized(auth,{rol,durum:'aktif',mufredatDuzenleme:value}),false);
  assert.equal(authorized(auth,{rol,durum:'pasif',mufredatDuzenleme:true}),false);
 }
 for(const rol of ['veli','muhasebe','pdr','danisma'])assert.equal(authorized(auth,{rol,durum:'aktif',mufredatDuzenleme:true}),false);
});
test('UID identities fail closed, support flat and legacy matching aliases',()=>{
 assert.equal(profileEmail(auth),auth.token.email);
 assert.equal(profileEmail(auth,{primaryProfile:'personel',refEmail:'alias@example.test'}),'alias@example.test');
 assert.equal(profileEmail(auth,{primaryProfile:'personel',profiles:{personel:{refEmail:'alias@example.test'}}}),'alias@example.test');
 for(const identity of [{},{aktif:false,primaryProfile:'personel',refEmail:'teacher@example.test'},{primaryProfile:'veli',refEmail:'teacher@example.test'},{primaryProfile:'personel',refEmail:'a@example.test',profiles:{personel:{refEmail:'b@example.test'}}}])assert.throws(()=>profileEmail(auth,identity));
});
test('rename preserves scores, dates and unrelated fields',()=>{
 const c=parseChanges(changes)[0];validateMoves(c);
 const data={kayitlar:{area__Grup__Eski:'U',historical:'S'},tarihler:{area__Grup__Eski:'2026-01-01'},not:'keep'};
 const out=migrate(data,c.tasimalar);assert.equal(out.kayitlar.area__Grup__Yeni,'U');assert.equal(out.tarihler.area__Grup__Yeni,'2026-01-01');assert.equal(out.kayitlar.historical,'S');assert.equal(out.not,'keep');assert.ok(data.kayitlar.area__Grup__Eski);
});
test('conflicts and historical collisions reject instead of overwriting',()=>{
 assert.throws(()=>checkBase(next,base));
 assert.throws(()=>migrate({kayitlar:{area__Grup__Eski:'U',area__Grup__Yeni:'S'}},changes.changes[0].tasimalar));
 const bad=structuredClone(changes);bad.changes[0].tasimalar[0].eski='unrelated';assert.deepEqual(validateMoves(parseChanges(bad)[0]),[]);
});
test('add, delete, order and label changes preserve history',()=>{
 const c={...changes.changes[0],alanlar:[],tasimalar:[]};validateMoves(c);
 const data={kayitlar:{area__Grup__Eski:'U'}};assert.equal(migrate(data,[]),data);
 const a=structuredClone(base);a[0].ad='Yeni Alan';validateMoves({...c,alanlar:a});
});
test('input limits, duplicate names and path injection reject',()=>{
 const c=structuredClone(changes);c.changes[0].disiplin='a/b';assert.throws(()=>parseChanges(c));
 c.changes[0].disiplin='montessori';c.changes[0].alanlar[0].gruplar[0].dersler=['Yeni','Yeni'];assert.throws(()=>parseChanges(c));
 assert.throws(()=>parseChanges({changes:[]}));
});
test('legacy missing area ID and English fill-in blanks remain editable without losing marks',()=>{
 const base=[{ad:'Alan',gruplar:[{ad:'Grup',dersler:['My name is ___','My name is ___ too']}]}];
 const next=structuredClone(base);next[0].id='alan';
 const c={disiplin:'ingilizce',base,alanlar:next,tasimalar:base[0].gruplar[0].dersler.map(d=>({eski:'undefined__Grup__'+d,yeni:'alan__Grup__'+d}))};
 parseChanges({changes:[c]});const moves=validateMoves(c);assert.equal(moves.length,2);
 assert.equal(migrate({kayitlar:{'undefined__Grup__My name is ___':'U'}},moves).kayitlar['alan__Grup__My name is ___'],'U');
 const english={base:next,alanlar:structuredClone(next),tasimalar:[{eski:'alan__Grup__My name is ___',yeni:'alan__Grup__I am ___'}]};english.alanlar[0].gruplar[0].dersler[0]='I am ___';
 assert.equal(validateMoves(english).length,1);
});
