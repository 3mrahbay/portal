import test from 'node:test';
import assert from 'node:assert/strict';
import {membershipId,distinctStudents,groupAudience,groupVisible,groupManager,contentChildIds,childAudience} from '../js/egitim-gruplari-core.mjs';
import {childTargetMatches} from '../js/portal-galeri-etkilesim.js';
import {galleryApprovalScopeKey} from '../js/galeri-toplu-onay.js';
import {galleryFolderKey} from '../js/galeri-klasorleri.js';
import {prepare} from '../security/prepare-egitim-gruplari-rules.mjs';
const state={currentUser:{uid:'teacher',email:'teacher@example.test'},rol:'ingilizce_ogretmeni',personel:{durum:'aktif'},aktifDonem:'2026-2027'};
const group={id:'g1',program:'ingilizce',donem:'2026-2027',ad:'4 Yaş A',ogretmenEmail:'teacher@example.test',durum:'aktif'};
const students=[{id:'a',sinif:'Papatyalar'},{id:'b',sinif:'Lavantalar'}];
const members=students.map(s=>({ogrenciId:s.id,program:'ingilizce',donem:group.donem,grupId:group.id}));
test('one membership ID per student and term; primary roster remains unique',()=>{
 assert.equal(membershipId(group.donem,'a'),'2026-2027__ingilizce__a');assert.notEqual(membershipId('2027-2028','a'),membershipId(group.donem,'a'));
 assert.equal(distinctStudents([...students,students[0]]).length,2);assert.throws(()=>membershipId(group.donem,'a/b'));
});
test('group audience references existing IDs and leaves primary classrooms unchanged',()=>{
 const before=structuredClone(students),audience=groupAudience(group,[...members,members[0]],students,state);
 assert.deepEqual(audience.ogrenciIds,['a','b']);assert.deepEqual(students,before);assert.equal(audience.egitimKaydi,false);
 assert.equal(audience.egitimGrupId,'g1');assert.equal(audience.hedefTur,'ogrenci');
});
test('only the three active management roles manage assignments',()=>{
 for(const rol of ['kurucu_mudur','mudur','egitim_koordinator'])assert.equal(groupManager({...state,rol}),true);
 for(const rol of ['ingilizce_ogretmeni','pdr','muhasebe','danisma','veli'])assert.equal(groupManager({...state,rol}),false);
 assert.equal(groupManager({...state,rol:'mudur',personel:{durum:'pasif'}}),false);
});
test('own active current-term group only; missing members fail closed',()=>{
 assert.equal(groupVisible(group,state),true);
 for(const g of [{...group,ogretmenEmail:'other@example.test'},{...group,durum:'pasif'},{...group,donem:'2025-2026'}])assert.equal(groupVisible(g,state),false);
 assert.throws(()=>groupAudience(group,members,students.slice(0,1),state));
});
test('every selected child matches; unrelated children do not',()=>{
 const m=childAudience(['a','b','a']);assert.deepEqual(contentChildIds(m),['a','b']);
 assert.equal(childTargetMatches(m,'a'),true);assert.equal(childTargetMatches(m,'b'),true);assert.equal(childTargetMatches(m,'c'),false);
 assert.deepEqual(contentChildIds({hedefDeger:'legacy'}),['legacy']);
});
test('empty, conflicting or malformed recipient arrays never broaden an audience',()=>{
 for(const m of [{hedefDeger:'a',ogrenciIds:[]},{hedefDeger:'x',ogrenciIds:['a','b']},{hedefDeger:'a',hedefOgrenciId:'b',ogrenciIds:['a','b']},{ogrenciIds:'a'},{ogrenciIds:['a',null]},{ogrenciIds:['a'],ogrenciler:['b']}])assert.deepEqual(contentChildIds(m),[]);
 assert.throws(()=>childAudience([]));assert.throws(()=>childAudience(Array.from({length:121},(_,i)=>'child'+i)));
});
test('notification and album keys are order independent but distinguish audiences',()=>{
 const a={...childAudience(['a','b']),egitimGrupId:'g1',etkinlikBaslik:'Colors'},b={...childAudience(['b','a']),egitimGrupId:'g1',etkinlikBaslik:'Colors'};
 assert.equal(galleryApprovalScopeKey(a),galleryApprovalScopeKey(b));assert.equal(galleryFolderKey(a),galleryFolderKey(b));
 assert.notEqual(galleryFolderKey(a),galleryFolderKey({...a,egitimGrupId:'g2'}));
 assert.notEqual(galleryApprovalScopeKey(a),galleryApprovalScopeKey(childAudience(['a'])));
 assert.equal(galleryApprovalScopeKey({hedefTur:'ogrenci',hedefDeger:'a'}),'["ogrenci","a"]');
});
test('rules preparation preserves literal regex dollar signs and excludes generic fallback',()=>{
 const src="before\n|| (tur == 'ogrenci' && hedef == ogrenciId)\n    // ====== SINIFLAR (ZEKY) ======\nkeep\nallow read, write: if collection != 'config' && false;\nend";
 const out=prepare(src);assert.equal(out.split('\nend').length,2);assert.match(out,/egitimGrupUyelikleri/);assert.match(out,/\[\.\]\[\^@ \/\]\+\$'/);
 assert.throws(()=>prepare(out));assert.throws(()=>prepare('changed baseline'));
});

test('teacher selection includes own primary and English members without exposing other classrooms',async t=>{
 const {selectedAudience}=await import('../moduller/egitim-gruplari.js');const before=globalThis.window;
 t.after(()=>{if(before===undefined)delete globalThis.window;else globalThis.window=before;});
 const roster=[{id:'a',sinif:'A'},{id:'b',sinif:'B'},{id:'c',sinif:'C'}];
 const api={db:{},state:{...state,siniflar:['A'],ogrenciList:roster,ayarListesi:{}},fb:{
 collection:(_db,name)=>({name}),where:(...args)=>args,query:(ref,...filters)=>({...ref,filters}),
 getDocs:async ref=>({docs:(ref.name==='egitimGruplari'?[group]:[{id:'membership',ogrenciId:'b',grupId:group.id,program:'ingilizce',donem:state.aktifDonem}]).map(d=>({id:d.id,data:()=>d}))})
 }};globalThis.window={PortalAPI:api};
 const options=ids=>ids.map(value=>({value,dataset:{ad:value}}));
 assert.deepEqual((await selectedAudience('ogrenci','',options(['a','b']))).ogrenciIds,['a','b']);
 await assert.rejects(selectedAudience('ogrenci','',options(['c'])),/kendi öğrencilerinizi/);
 assert.deepEqual(roster.map(s=>s.sinif),['A','B','C']);
});
