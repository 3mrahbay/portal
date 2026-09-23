import {odemePlani,kurus,bildirimOnayla} from './core.js';

// Öğrenci listesindeki dönem durumu kuralı: dönem belgesinin varlığı tek
// başına aktif kayıt anlamına gelmez. Eski, durum alanı olmayan dönem
// belgeleri mevcut öğrenci listesiyle uyumlu olarak aktif kabul edilir.
const PASIF_DURUMLAR = new Set(['arsiv','arşiv','pasif','ayrildi','ayrıldı']);
export function aktifDonemKaydi(veri){
  if(!veri || typeof veri!=='object')return false;
  const durum=String(veri.durum||'aktif').toLocaleLowerCase('tr').replace(/ı/g,'i').trim();
  return !PASIF_DURUMLAR.has(durum);
}

export async function sinirliMap(items,fn){const results=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(6,items.length)},async()=>{while(next<items.length){const i=next++;results[i]=await fn(items[i],i);}}));return results;}
export async function okulVerisi({fb,db,donem}){
  const [students,expenses,notifications,accounting]=await Promise.all([fb.getDocs(fb.collection(db,'ogrenciler')),fb.getDocs(fb.collection(db,'giderler')),fb.getDocs(fb.collection(db,'odemeBildirimleri')),fb.getDocs(fb.collection(db,'odemeler'))]);
  const ogrenciler=(await sinirliMap(students.docs,async d=>{
    const ds=await fb.getDoc(fb.doc(db,'ogrenciler',d.id,'donemler',donem));
    if(!ds.exists())return null;
    const o=d.data(),v=ds.data();
    if(!aktifDonemKaydi(v))return null;
    return {id:d.id,ad:o.ogrenciAdSoyad||o.ad||d.id,sinif:v.kayit?.sinif||o.sinif||'',kayitTarihi:kayitZamani(v,o),veli:v.anne?.adSoyad||v.baba?.adSoyad||v.veli?.adSoyad||o.veliAdSoyad||o.anneAdSoyad||o.babaAdSoyad||'',veri:v,plan:odemePlani(v)};
  })).filter(Boolean);
  // Öğrenci sayısı, cariler, sınıflar ve veli bildirimleri aynı ID kümesini
  // kullanır. Filtre salt okunurdur; arşiv ve geçmiş mali kayıtlar silinmez.
  const ogrenciIdleri=new Set(ogrenciler.map(o=>o.id));
  const satirlar=ogrenciler.flatMap(o=>o.plan.satirlar.map(r=>({...r,ogrenciId:o.id,ogrenci:o.ad,sinif:o.sinif,veli:o.veli,kalem:r.ad,donem})));
  const gelirler=satirlar.flatMap(r=>{let moves=r.record.hareketler||[];if(!moves.length&&r.odenen>0)moves=[{tutar:r.odenen,tarih:r.record.odemeTarihi||'',yontem:r.record.odemeYontemi||r.record.yontem||'',eskiKayit:true}];return moves.map(m=>({...r,...m,kalemId:r.id,hareketId:m.id||'',tutar:Number(m.tutar)||0,kalem:r.ad}));});
  const giderler=expenses.docs.map(d=>({id:d.id,...d.data()}));
  const bildirimler=notifications.docs.map(d=>({id:d.id,...d.data()})).filter(b=>ogrenciIdleri.has(b.ogrenciId)&&(b.donem===donem||!b.donem));
  const mutabakatlar=accounting.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.tur==='banka_mutabakati'&&r.donem===donem);
  return {ogrenciler,satirlar,gelirler,giderler,bildirimler,mutabakatlar,donem};
}
export const onayla=bildirimOnayla;
export function toplam(rows,key){return rows.reduce((s,r)=>s+kurus(r[key]),0)/100;}

export function kayitZamani(v,o){for(const value of [v.olusturuldu,v.onayTarihi,v.kayitTarihi,v.kayit?.kayitTarihi,o.olusturuldu,o.kayitTarihi,o.okulaKayitTarihi]){let date=value;if(value?.toDate)date=value.toDate().toISOString();else if(value?.seconds)date=new Date(value.seconds*1000).toISOString();if(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}/.test(date)&&Number.isFinite(Date.parse(date)))return date;}return '';}
