import assert from 'node:assert/strict';
import {OWNER_EMAIL} from '../js/finans/import-approval.js';
export function store() {
  const data=new Map(); let serial=Promise.resolve(), failCommit=false;
  const snapshot=v=>({exists:()=>v!==undefined,data:()=>structuredClone(v)});
  const fb={
    getDoc:async ref=>snapshot(data.get(ref)),
    listPending:async()=>[...data].filter(([k,v])=>k.startsWith('finansIceriAktarimlari/')&&v.status==='onay_bekliyor').map(([k,v])=>({id:k.split('/')[1],...structuredClone(v)})),
    doc:(_db,...parts)=>parts.join('/'),serverTimestamp:()=> 'synthetic-timestamp',
    runTransaction(_db,fn) {
      const result=serial.then(async()=>{
        const pending=new Map(); let wrote=false;
        const tx={
          async get(ref){assert.equal(wrote,false,'Firestore reads must precede writes');const v=data.get(ref);return {exists:()=>v!==undefined,data:()=>structuredClone(v)};},
          set(ref,value){wrote=true;pending.set(ref,structuredClone(value));},
          update(ref,value){wrote=true;assert.ok(data.has(ref));pending.set(ref,{...structuredClone(data.get(ref)),...structuredClone(value)});}
        };
        const output=await fn(tx);
        if(failCommit) throw Error('synthetic commit failure');
        for(const [key,value] of pending) data.set(key,value);
        return output;
      });
      serial=result.catch(()=>{}); return result;
    }
  };
  return {data,ctx:{fb,db:{},email:OWNER_EMAIL},failCommit:value=>{failCommit=value;}};
}
