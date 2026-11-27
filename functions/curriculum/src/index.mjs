import {initializeApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {isDeepStrictEqual} from 'node:util';
import {profileEmail,authorized,parseChanges,checkBase,validateMoves,migrate,programScope,assertProgramScope,auditChange} from './domain.mjs';
initializeApp();const db=getFirestore();
// Only curriculum content and deterministic key renames are accepted; no student values from clients.
export const mufredatIslemV1=onCall({region:'europe-west3',maxInstances:4,timeoutSeconds:120,memory:'512MiB',enforceAppCheck:true},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Giriş yapın.');
 const action=request.data?.action;
 if(!['status','load','save','history'].includes(action))throw new HttpsError('invalid-argument','Geçersiz işlem.');
 let changes;
 try{if(action==='save')changes=parseChanges(request.data);}catch(e){throw new HttpsError('invalid-argument',e.message);}
 return db.runTransaction(async tx=>{
  const identity=await tx.get(db.doc(`kullaniciKimlikleri/${request.auth.uid}`));
  let email;try{email=profileEmail(request.auth,identity.data());}catch{throw new HttpsError('permission-denied','Personel kimliği gerekli.');}
  const staff=await tx.get(db.doc(`personeller/${email}`));
  const allowed=authorized(request.auth,staff.data());
  if(action==='status')return {allowed,programs:programScope(request.auth,staff.data()),protocol:2};
  if(action==='history') {
   const program=request.data.disiplin;
   if(typeof program!=='string'||!/^[a-z][a-zA-Z0-9_-]{0,79}$/.test(program))throw new HttpsError('invalid-argument','Geçersiz program.');
   try { assertProgramScope(request.auth,staff.data(),[program],false); } catch(e) { throw new HttpsError('permission-denied',e.message); }
   const entryId=request.data.entryId;
   if(entryId!==undefined){
    if(typeof entryId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(entryId))throw new HttpsError('invalid-argument','Geçersiz geçmiş kaydı.');
    const entry=await tx.get(db.doc(`mufredatDenetim/${program}/kayitlar/${entryId}`));
    if(!entry.exists)throw new HttpsError('not-found','Geçmiş kaydı bulunamadı.');
    return {before:entry.data().before,after:entry.data().after};
   }
   const history=await tx.get(db.collection(`mufredatDenetim/${program}/kayitlar`).orderBy('time','desc').limit(30));
   return {entries:history.docs.map(d=>{const e=d.data();return {id:d.id,actor:e.actor,actorName:e.actorName,actorRole:e.actorRole,time:e.time?.toDate().toISOString(),addedCount:e.added?.length||0,removedCount:e.removed?.length||0,movedCount:e.moves?.length||0};})};
  }
  if(!allowed)throw new HttpsError('permission-denied','Müfredat düzenleme yetkiniz kapalı.');
  try { assertProgramScope(request.auth,staff.data(),action==='save'?changes.map(c=>c.disiplin):[request.data.disiplin]); } catch(e) { throw new HttpsError('permission-denied',e.message); }
  if(action==='load') {
   if(typeof request.data.disiplin!=='string'||!/^[a-z][a-zA-Z0-9_-]{0,79}$/.test(request.data.disiplin)) throw new HttpsError('invalid-argument','Geçersiz program.');
   const curriculum=await tx.get(db.doc(`mufredatlar/${request.data.disiplin}`));
   return {alanlar:curriculum.data()?.alanlar||[]};
  }
  let audits; try { audits=changes.map(auditChange); } catch(e) { throw new HttpsError('invalid-argument',e.message); }
  const docs=await tx.getAll(...changes.map(c=>db.doc(`mufredatlar/${c.disiplin}`)));
  try{changes.forEach((c,i)=>{checkBase(docs[i].data()?.alanlar||[],c.base);validateMoves(c);});}
  catch(e){throw new HttpsError('failed-precondition',e.message);}
  const moving=changes.map(c=>({...c,tasimalar:validateMoves(c)})).filter(c=>c.tasimalar.length);
  const students=moving.length?await tx.get(db.collection('ogrenciGelisim').limit(401)):null;
  if(students?.size>400)throw new HttpsError('failed-precondition','Bu büyüklükteki kayıt taşıması için yönetim desteği gerekli.');
  const updates=[];
  try{for(const student of students?.docs||[]){
   const patch={};for(const c of moving){const old=student.data()[c.disiplin],next=migrate(old,c.tasimalar);if(!isDeepStrictEqual(old,next))patch[c.disiplin]=next;}
   if(Object.keys(patch).length)updates.push({ref:student.ref,patch});
  }}catch(e){throw new HttpsError('failed-precondition',e.message);}
  // All reads precede writes. Concurrent edits, permission revocation and student marks retry atomically.
  changes.forEach((c,i)=>{
    tx.set(docs[i].ref,{alanlar:c.alanlar,sonGuncelleme:FieldValue.serverTimestamp()},{merge:true});
    tx.create(db.collection(`mufredatDenetim/${c.disiplin}/kayitlar`).doc(),{...audits[i],actor:email,actorUid:request.auth.uid,actorName:staff.data()?.adSoyad||email,actorRole:staff.data()?.rol||'kurucu_mudur',time:FieldValue.serverTimestamp(),migrated:updates.length});
  });
  for(const u of updates)tx.update(u.ref,u.patch);
  tx.set(db.collection('mufredatDenetim').doc(),{actor:email,programs:changes.map(c=>c.disiplin),migrated:updates.length,time:FieldValue.serverTimestamp()});
  return {saved:true,migrated:updates.length};
 });
});
