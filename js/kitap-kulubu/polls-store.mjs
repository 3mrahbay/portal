export function createPollStore(fb,db,auth,callPoll){
 const {collection,doc,query,orderBy,limit,startAfter,onSnapshot,getDocsFromServer}=fb;
 const rows=s=>s.docs.map(d=>({...d.data(),id:d.id,cursor:d}));
 const current=()=>{if(!auth.currentUser)throw Error('Lütfen yeniden giriş yapın.');return auth.currentUser.uid;};
 return {
  polls(next,error){return onSnapshot(query(collection(db,'kitapKulubuOylamalar'),orderBy('createdAt','desc'),limit(20)),{includeMetadataChanges:true},s=>next(rows(s),{cached:s.metadata.fromCache}),error);},
  async olderPolls(cursor){const uid=current();const s=await getDocsFromServer(query(collection(db,'kitapKulubuOylamalar'),orderBy('createdAt','desc'),startAfter(cursor),limit(20)));if(current()!==uid)throw Error('Oturum değişti.');return rows(s);},
  pollById(id,next,error){return onSnapshot(doc(db,'kitapKulubuOylamalar',id),s=>next(s.exists()?{...s.data(),id:s.id}:null),error);},
  pollVote(id,next,error){const uid=current();return onSnapshot(doc(db,'kitapKulubuOylamalar',id,'oylar',uid),s=>{if(auth.currentUser?.uid===uid)next(s.exists()?s.data():null);},error);},
  async pollCommand(data){const uid=current();if(!callPoll)throw Error('Oylama servisi bu sürümde kullanılamıyor.');const result=await callPoll(data);if(current()!==uid)throw Error('Oturum değişti.');return result;}
 };
}
