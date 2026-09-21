import {yetkili} from './core.js';
export function pdrStore(fb,db,kullanici){
  function kontrol(){const k=kullanici();if(!yetkili(k)||!k.email)throw new Error('PDR kayıt yetkiniz yok.');return k;}
  async function oku(ad,donem){kontrol();const ref=fb.collection(db,ad);const snap=await fb.getDocs(ad==='pdrTakipKayitlari'?fb.query(ref,fb.where('donem','==',donem)):ref);return snap.docs.map(d=>({...d.data(),id:d.id}));}
  return {
    async yukle(donem){kontrol();const [gozlemler,testler,kayitlar]=await Promise.all([oku('pdrGozlemleri',donem),oku('pdrTestleri',donem),oku('pdrTakipKayitlari',donem)]);return {gozlemler,testler,kayitlar};},
    async kaydet(veri,id){const k=kontrol();const fields={...veri,veliylePaylas:false,guncelleyen:k.email.toLowerCase(),guncellendi:fb.serverTimestamp()};
      if(id){await fb.updateDoc(fb.doc(db,'pdrTakipKayitlari',id),fields);return id;}
      const ref=await fb.addDoc(fb.collection(db,'pdrTakipKayitlari'),{...fields,uzmanEmail:k.email.toLowerCase(),uzmanAd:k.ad||'PDR Uzmanı',olusturuldu:fb.serverTimestamp()});return ref.id;
    }
  };
}
