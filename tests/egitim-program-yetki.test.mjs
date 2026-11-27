import test from 'node:test';import assert from 'node:assert/strict';
import {educationPrograms,canObserveProgram} from '../js/egitim-program-yetki.mjs';
import {programScope,assertProgramScope,auditChange,migrate,checkBase} from '../functions/curriculum/src/domain.mjs';
const catalog=['montessori','orman','ingilizce','degerler','robotik'].map(id=>({id}));
const auth={uid:'teacher',token:{email:'teacher@example.test',email_verified:true}};
for(const [rol,expected] of Object.entries({ogretmen:['montessori','orman'],yardimci_ogretmen:['montessori','orman'],ingilizce_ogretmeni:['ingilizce'],degerler_ogretmeni:['degerler'],orman_ogretmeni:['orman'],brans_ogretmeni:[]})){
 test(`${rol}: navigation and server agree; cross-program load/save denied`,()=>{
  const personel={rol,durum:'aktif',mufredatDuzenleme:true},state={rol,personel,currentUser:auth};
  assert.deepEqual(educationPrograms(state,catalog).map(d=>d.id),expected);assert.deepEqual(programScope(auth,personel),expected);
  for(const id of expected)assert.doesNotThrow(()=>assertProgramScope(auth,personel,[id]));
  assert.throws(()=>assertProgramScope(auth,personel,[...expected,'foreign']),/yetkiniz/);
 });
}
test('explicit multi/custom programs, empty assignment, revocation, inactive and PDR',()=>{
 const staff={rol:'brans_ogretmeni',durum:'aktif',mufredatDuzenleme:true,egitimProgramlari:['robotik','orman']};
 assert.deepEqual(programScope(auth,staff),['robotik','orman']);assert.doesNotThrow(()=>assertProgramScope(auth,staff,['robotik','orman']));
 assert.throws(()=>assertProgramScope(auth,{...staff,egitimProgramlari:[]},['robotik']));
 assert.throws(()=>assertProgramScope(auth,{...staff,mufredatDuzenleme:false},['robotik']));
 assert.throws(()=>assertProgramScope(auth,{...staff,durum:'pasif'},['robotik'],false));
 const pdr={rol:'pdr',durum:'aktif',mufredatDuzenleme:true};
 assert.doesNotThrow(()=>assertProgramScope(auth,pdr,['robotik'],false));assert.throws(()=>assertProgramScope(auth,pdr,['robotik']));
 assert.equal(canObserveProgram({currentUser:auth,rol:'pdr',personel:pdr},'montessori',catalog),false);
 for(const rol of ['kurucu_mudur','mudur','egitim_koordinator'])assert.doesNotThrow(()=>assertProgramScope(auth,{rol,durum:'aktif'},['robotik','montessori']));
});
test('audit keeps before/after; renames preserve all STU stages, photo and note; stale base rejected',()=>{
 const base=[{id:'a',ad:'Alan',gruplar:[{ad:'Grup',dersler:['Eski']}]}],after=structuredClone(base);after[0].gruplar[0].dersler=['Yeni'];
 const old='a__Grup__Eski',next='a__Grup__Yeni',c={disiplin:'montessori',base,alanlar:after,tasimalar:[{eski:old,yeni:next}]};
 const audit=auditChange(c);assert.deepEqual(audit.before,base);assert.deepEqual(audit.after,after);
 const detail={S:{not:'Sunum',fotoUrl:'synthetic.jpg'},T:{not:'Tekrar'},U:{not:'Ustalık'}};
 const section={kayitlar:{[old]:'U'},tarihler:{[old]:'2026-11-27'},detay:{[old]:detail},other:'keep'};
 const migrated=migrate(section,audit.moves);assert.deepEqual(migrated.detay[next],detail);assert.equal(migrated.kayitlar[next],'U');assert.equal(section.kayitlar[old],'U');assert.equal(migrated.other,'keep');
 assert.throws(()=>checkBase(after,base),/başka/);
});
