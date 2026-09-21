import {odemePlani,kurus,bildirimOnayla} from './core.js';
export async function sinirliMap(items,fn){const results=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(6,items.length)},async()=>{while(next<items.length){const i=next++;results[i]=await fn(items[i],i);}}));return results;}
export async function okulVerisi({fb,db,donem}){
  const [students,expenses,notifications]=await Promise.all([fb.getDocs(fb.collection(db,'ogrenciler')),fb.getDocs(fb.collection(db,'giderler')),fb.getDocs(fb.collection(db,'odemeBildirimleri'))]);
  const ogrenciler=(await sinirliMap(students.docs,async d=>{const ds=await fb.getDoc(fb.doc(db,'ogrenciler',d.id,'donemler',donem));if(!ds.exists())return null;const o=d.data(),v=ds.data();return {id:d.id,ad:o.ogrenciAdSoyad||o.ad||d.id,sinif:v.kayit?.sinif||o.sinif||'',veli:o.veliAdSoyad||o.anneAdSoyad||o.babaAdSoyad||'',veri:v,plan:odemePlani(v)};})).filter(Boolean);
  const satirlar=ogrenciler.flatMap(o=>o.plan.satirlar.map(r=>({...r,ogrenciId:o.id,ogrenci:o.ad,sinif:o.sinif,veli:o.veli,kalem:r.ad,donem})));
  const gelirler=satirlar.flatMap(r=>{let moves=r.record.hareketler||[];if(!moves.length&&r.odenen>0)moves=[{tutar:r.odenen,tarih:r.record.odemeTarihi||'',yontem:r.record.odemeYontemi||r.record.yontem||'',eskiKayit:true}];return moves.map(m=>({...r,...m,tutar:Number(m.tutar)||0,kalem:r.ad}));});
  const giderler=expenses.docs.map(d=>({id:d.id,...d.data()}));
  const bildirimler=notifications.docs.map(d=>({id:d.id,...d.data()})).filter(b=>b.donem===donem||!b.donem);
  return {ogrenciler,satirlar,gelirler,giderler,bildirimler,donem};
}
export const onayla=bildirimOnayla;
export function toplam(rows,key){return rows.reduce((s,r)=>s+kurus(r[key]),0)/100;}
