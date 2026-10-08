import {kurus, odemePlani} from './core.js';

// Pure planner: no Firestore writes. Transaction and audit are performed by caller.
export function planlaTahsilatTarihDuzeltmesi(veri,{aylar,eskiTarih,yeniTarih,aylikTutar,toplamTutar,bankaReferans}) {
  const date = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
  if (!date(eskiTarih)||!date(yeniTarih)||eskiTarih===yeniTarih) throw Error('Geçerli ve farklı iki ödeme tarihi gerekli.');
  if (!Array.isArray(aylar)||aylar.length<1||aylar.length>36||new Set(aylar).size!==aylar.length||!aylar.every(k=>/^\d{4}-(0[1-9]|1[0-2])$/.test(k))) throw Error('Ay listesi eksik, tekrarlı veya geçersiz.');
  if (!/^[A-Za-z0-9_-]{6,120}$/.test(bankaReferans||''))throw Error('Benzersiz banka referansı gerekli.');
  const amount=kurus(aylikTutar),total=kurus(toplamTutar);
  if (amount<=0||total<=0||amount*aylar.length!==total) throw Error('Aylık tutar ve toplam uyuşmuyor.');
  const source=veri?.aylikOdemeler;
  if (!source || typeof source!=='object')throw Error('Öğrenci dönem kaydı ve aylık ödemeleri bulunamadı.');
  const before={},changes={},after=structuredClone(source);
  let got=0;
  for(const key of aylar){
    const r=source[key];
    if (!r||r.odendi!==true||kurus(r.odenenTutar)!==amount) throw Error(key+': kayıt tam ödenmiş veya beklenen tutarda değil.');
    if (r.odemeTarihi!==eskiTarih)throw Error(key+': eski ödeme tarihi uyuşmuyor.');
    let moves;
    if(Array.isArray(r.hareketler) && r.hareketler.length){
      if(!r.hareketler.every(h=>h.tarih===eskiTarih&&kurus(h.tutar)>0))throw Error(key+': hareketlerin tarihlerinde/türlerinde uyuşmazlık var.');
      if(r.hareketler.reduce((s,h)=>s+kurus(h.tutar),0)!==amount)throw Error(key+': hareket toplamı aylık tutara eşit değil.');
      moves=r.hareketler.map(h=>({...h,tarih:yeniTarih,kaynakTahsilatId:bankaReferans}));
    }
    before[key]=structuredClone(r);
    after[key]={...r,odemeTarihi:yeniTarih,kaynakTahsilatId:bankaReferans,
      ...(moves?{hareketler:moves}:{}),
      tarihDuzeltme:{eskiTarih,yeniTarih,neden:'Geçmiş tarihli toplu havalenin gerçek tahsilat tarihinin düzeltilmesi'}};
    got+=amount;
    changes[key]={odenenTutar:amount/100,eskiTarih,yeniTarih};
  }
  if(got!==total)throw Error('Toplam tahsilat beklenen tutarı karşılamıyor.');
  const originalPlan=odemePlani(veri),correctedPlan=odemePlani({...veri,aylikOdemeler:after});
  if(kurus(originalPlan.odenen)!==kurus(correctedPlan.odenen)||kurus(originalPlan.kalan)!==kurus(correctedPlan.kalan)||kurus(originalPlan.toplam)!==kurus(correctedPlan.toplam))throw Error('Borç/alacak toplamı değişiyor; işlem durduruldu.');
  return {yeniAylikOdemeler:after,eskiKayitlar:before,degisiklikler:changes,tutar:got/100,referans:bankaReferans,eskiTarih,yeniTarih,aySayisi:aylar.length};
}
