import {candidates} from './core.js?v=246';
import {odemePlani} from '../core.js';
export const DRAFT_COLLECTION='faturaHazirlik';
export const hashText=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
export const draftFingerprint=d=>JSON.stringify([d.source,d.amountMinor,d.date,d.item,d.recipient,d.blockers]);
export function draftIssues(d,p){
 const issues=[...d.blockers];const r=d.recipient;
 if(r?.kind!=='student'||r.studentId!==d.source.ogrenciId||!r.name?.trim()||!/^\S+\s+\S/.test(r.name)||!/^[1-9]\d{10}$/.test(r.tckn)||r.conflict)issues.push('Öğrencinin adı ve T.C. kimliği tamamlanmalı');
 if(p.requirement==='review')issues.push('Fatura gerekliliği belirlenmeli');
 if(p.requirement==='excluded'&&!p.reason.trim())issues.push('İstisna gerekçesi gerekli');
 if(p.requirement==='required'&&(!p.servicePeriod||!p.productCode||p.taxRateBps===null||!p.taxApproved))issues.push('Hizmet dönemi, hizmet kodu ve vergi kontrolü tamamlanmalı');
 return issues;
}
export function draftDecision(p){
 const allowed=['requirement','reason','servicePeriod','productCode','taxRateBps','taxApproved','reviewed'];
 if(Object.keys(p).some(k=>!allowed.includes(k)))throw Error('Alıcı, fatura numarası veya gönderim bilgisi değiştirilemez.');
 if(!['review','required','excluded'].includes(p.requirement)||typeof p.taxApproved!=='boolean'||typeof p.reviewed!=='boolean')throw Error('Geçersiz taslak kararı.');
 for(const [k,n] of [['reason',500],['servicePeriod',40],['productCode',80]])if(typeof p[k]!=='string'||p[k].length>n)throw Error('Alan uzunluğu veya türü geçersiz.');
 if(p.taxRateBps!==null&&(!Number.isInteger(p.taxRateBps)||p.taxRateBps<0||p.taxRateBps>10000))throw Error('KDV oranı geçersiz.');
 if(p.requirement==='excluded'&&!p.reason.trim())throw Error('İstisna gerekçesi gerekli.');
 return {...p};
}
export async function draftRows(data,saved=[]){
 const map=new Map(saved.map(d=>[d.id,d]));
 const rows=await Promise.all(candidates(data).map(async d=>{
 const id=await hashText(d.key),fingerprint=await hashText(draftFingerprint(d)),s=map.get(id);
 const decision=s?.decision||{requirement:'review',reason:'',servicePeriod:'',productCode:'',taxRateBps:null,taxApproved:false,reviewed:false};
 const stale=!!s&&s.fingerprint!==fingerprint;
 return {...d,id,fingerprint,saved:s,decision,version:s?.version||0,stale,status:stale?'source_changed':decision.reviewed?'reviewed':s?'draft':'candidate',reason:stale?'Öğrenci veya tahsilat bilgisi değişti; yeniden kontrol edin':decision.requirement==='excluded'?'Gerekçeli istisna · '+decision.reason:undefined};
 }));
 // Retain saved drafts whose source is no longer present; never silently lose them.
 const ids=new Set(rows.map(r=>r.id));
 for(const s of saved.filter(s=>!ids.has(s.id)))rows.push({id:s.id,key:s.sourceKey,source:s.source,name:'Kaynağı bulunamayan öğrenci',item:'Kaynak tahsilat bu dönem listesinde yok',amountMinor:0,date:'',recipient:null,blockers:['Güncel kaynak bulunamadı'],decision:s.decision,saved:s,version:s.version,stale:true,status:'source_changed',reason:'Kayıt korunuyor; öğrenci/tahsilat kaynağı tekrar doğrulanmalı',unavailable:true});
 return rows;
}
export async function readDrafts({fb,db,donem}){
 const snap=await fb.getDocs(fb.query(fb.collection(db,DRAFT_COLLECTION),fb.where('donem','==',donem)));
 return snap.docs.map(d=>({...d.data(),id:d.id}));
}
export async function saveDraft(ctx,d,patch){
 const {fb,db}=ctx,p=draftDecision(patch);
 if(d.unavailable||!d.source.hareketId||d.source.hareketId==='devir')throw Error('Tekil kaynak hareketi olmadan taslak kaydedilemez.');
 if(p.reviewed&&draftIssues(d,p).length)throw Error(draftIssues(d,p).join(' · '));
 const ref=fb.doc(db,DRAFT_COLLECTION,d.id);
 return fb.runTransaction(db,async tx=>{
 const [old,student,period,accounting]=await Promise.all([tx.get(ref),tx.get(fb.doc(db,'ogrenciler',d.source.ogrenciId)),tx.get(fb.doc(db,'ogrenciler',d.source.ogrenciId,'donemler',d.source.donem)),fb.getDocs(fb.query(fb.collection(db,'odemeler'),fb.where('tur','==','banka_mutabakati')))]);
 const prev=old.exists()?old.data():null;
 if((prev?.version||0)!==d.version)throw Error('Taslak başka bir kullanıcı tarafından değiştirildi. Listeyi yenileyin.');
 if(!student.exists()||!period.exists())throw Error('Öğrenci veya dönem kaydı bulunamadı.');
 const o=student.data(),v=period.data(),plan=odemePlani(v);
 const movements=plan.satirlar.flatMap(r=>(r.record.hareketler||[]).map(m=>({...m,ogrenciId:d.source.ogrenciId,donem:d.source.donem,kalemId:r.id,hareketId:m.id,kalem:r.ad})));
 const current=candidates({gelirler:movements,ogrenciler:[{id:d.source.ogrenciId,ogrenciKimlik:{adSoyad:o.ogrenciAdSoyad||o.ad||'',tcKimlik:o.tcKimlik||''},veri:v,plan}],mutabakatlar:accounting.docs.map(x=>x.data())}).find(x=>x.key===d.key);
 if(!current||await hashText(draftFingerprint(current))!==d.fingerprint)throw Error('Öğrenci veya tahsilat değişti. Listeyi yenileyip yeniden kontrol edin.');
 const actor=ctx.uid;if(!actor)throw Error('Oturum kimliği doğrulanamadı.');
 const version=d.version+1,stamp=fb.serverTimestamp();
 const row={schemaVersion:1,donem:d.source.donem,source:d.source,sourceKey:d.key,recipientKind:'student',fingerprint:d.fingerprint,decision:p,version,createdBy:prev?.createdBy||actor,createdAt:prev?.createdAt||stamp,updatedBy:actor,updatedAt:stamp};
 tx.set(ref,row);
 tx.set(fb.doc(db,DRAFT_COLLECTION,d.id,'history',String(version)),{version,actor,at:stamp,decision:p,fingerprint:d.fingerprint});
 return version;
 });
}
