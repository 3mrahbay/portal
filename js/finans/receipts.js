// Private, bounded Firestore attachments. No public media URL is created.
export const DEKONT_LIMIT=2*1024*1024;
const CHUNK=180000;
export async function dekontHazirla(file){
 if(!file)return null;
 if(file.size<=0||file.size>DEKONT_LIMIT)throw Error('Dekont en fazla 2 MB olmalı. PDF, JPG veya PNG seçin.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const pdf=String.fromCharCode(...bytes.slice(0,5))==='%PDF-',png=[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!pdf&&!png&&!jpg)throw Error('Dosya içeriği PDF, JPG veya PNG değil.');
 const mime=pdf?'application/pdf':png?'image/png':'image/jpeg',sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));
 const base64=btoa(binary),chunks=[];for(let i=0;i<base64.length;i+=CHUNK)chunks.push(base64.slice(i,i+CHUNK));
 return {meta:{ad:String(file.name||'dekont').slice(0,120),boyut:bytes.length,mime,sha256,parcaSayisi:chunks.length},chunks};
}
export async function dekontluBildirim({fb,db,ref,data,receipt}){
 const batch=fb.writeBatch(db);batch.set(ref,{...data,dekontVar:!!receipt});
 if(receipt){
 const meta={...receipt.meta,veliEmail:data.veliEmail,ogrenciId:data.ogrenciId,bildirimId:ref.id};
 batch.set(fb.doc(db,'odemeDekontlari',ref.id),meta);
 receipt.chunks.forEach((icerik,i)=>batch.set(fb.doc(db,'odemeDekontlari',ref.id,'parcalar',String(i)),{sira:i,icerik}));
 }
 await batch.commit();
}
export async function dekontOku({fb,db,id}){
 const snap=await fb.getDoc(fb.doc(db,'odemeDekontlari',id));if(!snap.exists())throw Error('Dekont bulunamadı.');
 const m=snap.data();if(!Number.isInteger(m.parcaSayisi)||m.parcaSayisi<1||m.parcaSayisi>16||m.boyut>DEKONT_LIMIT)throw Error('Dekont bilgileri geçersiz.');
 const docs=await Promise.all(Array.from({length:m.parcaSayisi},(_,i)=>fb.getDoc(fb.doc(db,'odemeDekontlari',id,'parcalar',String(i)))));
 if(docs.some(d=>!d.exists()))throw Error('Dekont eksik yüklenmiş.');
 const binary=atob(docs.map(d=>d.data().icerik).join('')),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(bytes.length!==m.boyut||hash!==m.sha256)throw Error('Dekont bütünlüğü doğrulanamadı.');
 return {meta:m,bytes};
}
export async function dekontIndir(ctx,id){
 const {meta,bytes}=await dekontOku({...ctx,id}),url=URL.createObjectURL(new Blob([bytes],{type:meta.mime})),a=document.createElement('a');
 a.href=url;a.download='dekont-'+id+(meta.mime==='application/pdf'?'.pdf':meta.mime==='image/png'?'.png':'.jpg');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
