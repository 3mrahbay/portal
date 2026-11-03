// Uses synthetic records only. Refuses any non-emulator endpoint.
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const fb=require('firebase/firestore');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const endpoint=process.env.FIRESTORE_EMULATOR_HOST;
 if(!/^127\.0\.0\.1:\d+$/.test(endpoint||'')||!process.env.GROUP_RULES_FILE)throw Error('Local emulator and candidate rules required');
 const [host,port]=endpoint.split(':');
 const env=await initializeTestEnvironment({projectId:'demo-english-groups',firestore:{host,port:+port,rules:fs.readFileSync(process.env.GROUP_RULES_FILE,'utf8')}});
 const roles=['kurucu_mudur','mudur','egitim_koordinator','ogretmen','ingilizce_ogretmeni','pdr','muhasebe','danisma','inactive'];
 const db=role=>env.authenticatedContext(role,{email:role+'@example.test'}).firestore();
 const api=role=>({db:db(role),fb,state:{currentUser:{uid:role,email:role+'@example.test'},rol:role,personel:{durum:'aktif'},aktifDonem:'2026-2027'}});
 const {saveGroup,assignStudent,assignStudents,loadGroups,resolveGroupAudience}=await import('../js/egitim-gruplari-data.mjs');
 let checks=0; const ok=async p=>{const r=await assertSucceeds(p);checks++;return r;},no=async p=>{await assertFails(p);checks++;};
 try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();
  for(const role of roles)await fb.setDoc(fb.doc(d,'personeller',role+'@example.test'),{rol:role==='inactive'?'mudur':role,durum:role==='inactive'?'pasif':'aktif',siniflar:[]});
  await fb.setDoc(fb.doc(d,'ayarlar','donem'),{aktif:'2026-2027'});
  for(const id of ['childA','childB','childC']){
   await fb.setDoc(fb.doc(d,'ogrenciler',id),{ogrenciAdSoyad:'Örnek '+id,sinif:'Ana sınıf',aktifDonem:'2026-2027',aktifDonemDurum:'aktif'});
   await fb.setDoc(fb.doc(d,'ogrenciler',id,'donemler','2026-2027'),{kayit:{sinif:'Ana sınıf'},ucret:100});
  }
 });
 const founder=api('kurucu_mudur'),manager=api('mudur'),coord=api('egitim_koordinator');
 const g1=await ok(saveGroup(founder,{ad:'İngilizce 4 Yaş',ogretmenEmail:'ingilizce_ogretmeni@example.test'}));
 const g2=await ok(saveGroup(manager,{ad:'İngilizce 5 Yaş',ogretmenEmail:'ogretmen@example.test'}));
 await ok(saveGroup(coord,{ad:'İngilizce 4 Yaş A',ogretmenEmail:'ingilizce_ogretmeni@example.test'},g1));
 for(const r of roles.slice(3)){
  await no(fb.setDoc(fb.doc(db(r),'egitimGruplari','unauthorized'),{ad:'Yetkisiz'}));
  await no(fb.updateDoc(fb.doc(db(r),'egitimGruplari',g1),{ad:'Yetkisiz'}));
 }
 await ok(assignStudent(founder,'childA',g1,{expectedGroup:''}));
 await ok(assignStudent(manager,'childB',g1,{expectedGroup:''}));
 const duplicate=await ok(assignStudents(coord,['childA','childA'],g1,{}));assert.equal(duplicate.unchanged,1);checks++;
 const roster=await ok(fb.getDocs(fb.collection(manager.db,'ogrenciler')));assert.equal(roster.size,3);checks++;
 const memberships=await ok(fb.getDocs(fb.collection(manager.db,'egitimGrupUyelikleri')));assert.equal(memberships.size,2);checks++;
 const owner=api('ingilizce_ogretmeni');
 const own=await ok(loadGroups(owner));assert.equal(own.groups.length,1);assert.equal(own.members.length,2);checks+=2;
 const audience=await ok(resolveGroupAudience(owner,g1));assert.deepEqual(audience.ogrenciIds.sort(),['childA','childB']);checks++;
 await no(fb.getDoc(fb.doc(db('ogretmen'),'egitimGruplari',g1)));
 await no(fb.getDocs(fb.collection(owner.db,'egitimGruplari')));
 await no(fb.getDocs(fb.collection(owner.db,'egitimGrupUyelikleri')));
 await no(fb.getDoc(fb.doc(owner.db,'ogrenciler','childA','donemler','2026-2027')));
 const mid='2026-2027__ingilizce__childA',mref=fb.doc(manager.db,'egitimGrupUyelikleri',mid);
 const original=(await fb.getDoc(mref)).data();
 for(const role of ['ingilizce_ogretmeni','ogretmen','pdr','muhasebe','danisma','parent','inactive']){
  await no(fb.updateDoc(fb.doc(db(role),'egitimGrupUyelikleri',mid),{grupId:g2}));
  await no(fb.getDocs(fb.collection(db(role),'egitimGrupUyelikleri',mid,'gecmis')));
 }
 for(const role of ['parent','pdr','muhasebe','danisma','inactive'])await no(fb.getDoc(fb.doc(db(role),'egitimGrupUyelikleri',mid)));
 await no(fb.getDoc(fb.doc(env.unauthenticatedContext().firestore(),'egitimGruplari',g1)));
 // Founder fallback must not bypass validators or immutable history.
 for(const d of [{grupId:g2},{ogrenciId:'childC'},{donem:'2025-2026'},{unexpected:true},{sonIslemId:'forged'}])await no(fb.updateDoc(fb.doc(founder.db,'egitimGrupUyelikleri',mid),{...d,guncelleyen:'kurucu_mudur',guncellendi:fb.serverTimestamp()}));
 await no(fb.setDoc(fb.doc(founder.db,'egitimGrupUyelikleri','random-id'),original));
 await no(fb.deleteDoc(fb.doc(founder.db,'egitimGrupUyelikleri',mid)));
 const history=await ok(fb.getDocs(fb.collection(manager.db,'egitimGrupUyelikleri',mid,'gecmis')));
 assert.equal(history.size,1);checks++;
 for(const h of history.docs){await no(fb.updateDoc(fb.doc(founder.db,h.ref.path),{yeniGrupId:g2}));await no(fb.deleteDoc(fb.doc(founder.db,h.ref.path)));}
 await no(fb.setDoc(fb.doc(founder.db,'egitimGruplari','bad'),{ad:'bad',program:'ingilizce'}));
 await no(fb.setDoc(fb.doc(founder.db,'egitimGruplari',g1,'private','bad'),{a:1}));
 await ok(assignStudent(coord,'childA',g2,{expectedGroup:g1}));
 await assert.rejects(()=>assignStudent(manager,'childA',g1,{expectedGroup:g1}),/başka bir yönetici/);checks++;
 await no(fb.getDoc(fb.doc(owner.db,'egitimGrupUyelikleri',mid)));
 await ok(assignStudent(manager,'childA','',{expectedGroup:g2}));
 await ok(saveGroup(manager,{ad:'Kapalı',ogretmenEmail:'ingilizce_ogretmeni@example.test',durum:'pasif'},g1));
 await no(fb.getDoc(fb.doc(owner.db,'egitimGruplari',g1)));
 await assert.rejects(()=>assignStudent(manager,'childC',g1),/Aktif dönem/);checks++;
 // The second selected child's parent can interact; unrelated parents cannot.
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();
  await fb.setDoc(fb.doc(d,'veliler','parentB@example.test'.toLowerCase()),{ogrenciIds:['childB'],onay:true});
  await fb.setDoc(fb.doc(d,'veliler','parentC@example.test'.toLowerCase()),{ogrenciIds:['childC'],onay:true});
  await fb.setDoc(fb.doc(d,'galeri','multi'),{hedefTur:'ogrenci',hedefDeger:'childA',ogrenciIds:['childA','childB'],durum:'onaylandi'});
 });
 const interaction=uid=>({veliUid:uid,veliEmailHash:'a'.repeat(64),ogrenciId:uid==='parentB'?'childB':'childC',uygulama:'portal',favori:true,guncellendi:fb.serverTimestamp()});
 const parentB=env.authenticatedContext('parentB',{email:'parentb@example.test'}).firestore(),parentC=env.authenticatedContext('parentC',{email:'parentc@example.test'}).firestore();
 await ok(fb.setDoc(fb.doc(parentB,'galeri','multi','etkilesimler','parentB'),interaction('parentB')));
 await no(fb.setDoc(fb.doc(parentC,'galeri','multi','etkilesimler','parentC'),interaction('parentC')));
 console.log(`PASS ${checks} group security/transaction checks; student count remains 3`);
 } finally {await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
