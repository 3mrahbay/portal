// Trusted-server boundary. Call only through Firebase's verified callable request.
import {randomUUID} from 'node:crypto';
import {OWNER_EMAIL, stageCandidate, prepareReview, approveCandidate, reviewSignature} from '../../js/finans/import-approval.js';

export function createApprovalService({db, fb, ownerUid, now=Date.now}) {
  if(typeof ownerUid!=='string'||!ownerUid.trim()) throw Error('Server owner UID configuration required.');
  function authorize(request) {
    if(!request?.app?.appId || request.app.alreadyConsumed) throw Error('Valid App Check required.');
    const a=request.auth;
    if(a?.uid!==ownerUid || a.token?.email!==OWNER_EMAIL || a.token?.email_verified!==true)
      throw Error('Verified owner authentication required.');
    return {db,fb,email:OWNER_EMAIL};
  }
  function key(value) {
    if(typeof value!=='string'||!value||value.length>200||value.includes('/')) throw Error('Invalid record ID.');
    return value;
  }
  return Object.freeze({
    async stage(request) {
      return stageCandidate(authorize(request),request.data?.candidate);
    },
    async list(request) {
      authorize(request);
      return {rows:await fb.listPending(db,100)};
    },
    async review(request) {
      authorize(request);
      const queueId=key(request.data?.queueId), reviewId=randomUUID();
      return fb.runTransaction(db,async tx=>{
        const q=await tx.get(fb.doc(db,'finansIceriAktarimlari',queueId));
        if(!q.exists()||q.data().status!=='onay_bekliyor') throw Error('Candidate is not pending.');
        const c=q.data().candidate;
        let period=null, studentName=null;
        if(c.kind==='payment') {
          const p=await tx.get(fb.doc(db,'ogrenciler',key(c.studentId),'donemler',key(c.period)));
          const s=await tx.get(fb.doc(db,'ogrenciler',c.studentId));
          if(!p.exists()||!s.exists()) throw Error('Student or period missing.');
          period=p.data();studentName=s.data().ogrenciAdSoyad||null;
        }
        const review=prepareReview(c,{
          category:request.data?.category??null,
          duplicateReview:request.data?.duplicateReview===true
        },period);
        const expiresAt=now()+15*60*1000;
        tx.set(fb.doc(db,'finansOnayIncelemeleri',reviewId),{
          queueId,ownerUid,review,expiresAt,status:'ready',createdAt:fb.serverTimestamp()
        });
        return {reviewId,expiresAt,review,studentName};
      });
    },
    async approve(request) {
      const ctx=authorize(request),reviewId=key(request.data?.reviewId);
      if(request.data?.action!=='approve') throw Error('Explicit approval action required.');
      // Accept only a server-created review ID. Never trust a client-supplied
      // candidate, signature, e-mail, balance, category or "confirmed" flag.
      const rr=fb.doc(db,'finansOnayIncelemeleri',reviewId);
      const first=await fb.getDoc(rr);
      if(!first.exists()||first.data().ownerUid!==ownerUid) throw Error('Review unavailable.');
      const saved=first.data();
      const guarded={...fb,runTransaction:(_db,fn)=>fb.runTransaction(db,async tx=>{
        const rs=await tx.get(rr);
        if(!rs.exists()||reviewSignature({...rs.data(),status:null})!==reviewSignature({...saved,status:null})) throw Error('Review changed.');
        if(saved.ownerUid!==request.auth.uid) throw Error('Review owner mismatch.');
        // An expired consumed review can still reconcile an uncertain response.
        if(rs.data().status!=='consumed'&&saved.expiresAt<=now()) throw Error('Review expired; review again.');
        if(!['ready','consumed'].includes(rs.data().status)) throw Error('Review unavailable.');
        const result=await fn(tx);
        tx.update(rr,{status:'consumed'});
        return result;
      })};
      return approveCandidate({...ctx,fb:guarded},{queueId:saved.queueId,review:saved.review,confirmed:true});
    }
  });
}

// Admin SDK mapping. No browser SDK or browser credentials enter this adapter.
export function adminAdapter(FieldValue) {
  const snapshot=s=>({exists:()=>s.exists,data:()=>s.data()});
  return {
    doc:(db,...path)=>db.doc(path.join('/')),
    serverTimestamp:()=>FieldValue.serverTimestamp(),
    getDoc:async ref=>snapshot(await ref.get()),
    listPending:async(db,limit)=>(await db.collection('finansIceriAktarimlari')
      .where('status','==','onay_bekliyor').limit(limit).get()).docs
      .map(s=>({id:s.id,...s.data()})),
    runTransaction:(db,fn)=>db.runTransaction(tx=>fn({
      get:async ref=>snapshot(await tx.get(ref)),
      set:(ref,value)=>tx.set(ref,value),update:(ref,value)=>tx.update(ref,value)
    }))
  };
}

// Host supplies official firebase-functions/v2/https exports and Admin SDK.
// No deployment entry point/config is created by this module.
export function financeCallables({onCall,HttpsError,db,FieldValue,ownerUid,region}) {
  if(!region) throw Error('Explicit server region required.');
  const service=createApprovalService({db,fb:adminAdapter(FieldValue),ownerUid});
  const options={region,enforceAppCheck:true,consumeAppCheckToken:true,maxInstances:5};
  const wrap=method=>onCall(options,async request=>{
    try{return await service[method](request);}
    catch(error){throw new HttpsError('failed-precondition',error.message);}
  });
  return {financeImportList:wrap('list'),financeImportStage:wrap('stage'),
    financeImportReview:wrap('review'),financeImportApprove:wrap('approve')};
}
