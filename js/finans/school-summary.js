import {odemePlani, kurus, bugun} from './core.js';

// Summary of the same period payment plans used by parent and finance screens.
// Cash uses payment dates; installment allocation uses fee month codes.
const monthKey = date => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0,4))<2000) return '';
  const time = Date.parse(date + 'T12:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10) !== date) return '';
  return date.slice(0,7);
};
const add = (map, key, cents) => { map[key] = (map[key] || 0) + cents; };
const sum = (arr) => arr.reduce((s,n)=>s+n,0);
const tl = cents => cents/100;

export function sonAyKodlari(ayKod, adet=7) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ayKod)) return [];
  const [y,m] = ayKod.split('-').map(Number);
  return Array.from({length:adet},(_,i)=>{
    const d = new Date(Date.UTC(y,m-1-(adet-i-1),1));
    return d.toISOString().slice(0,7);
  });
}

export function okulFinansOzeti(ogrenciler, now=new Date()) {
  const ay = bugun(now).slice(0,7);
  const planlar = (ogrenciler||[]).filter(o=>o?.veri).map(o=>({...o,plan:odemePlani(o.veri,now)}));
  const aidatBeklenenKur = {}, aidatOdenenKur = {}, nakitKur = {};
  const hareketler = [], uyarilar = [];
  let tarihsizKur = 0;
  let buAyOdeyen = 0;
  for (const o of planlar) {
    if (o.plan.uyarilar?.length) uyarilar.push(...o.plan.uyarilar.map(m=>o.id+': '+m));
    const buAy = o.plan.satirlar.find(r=>r.id===ay);
    if (buAy && kurus(buAy.odenen)>0) buAyOdeyen++;
    for(const r of o.plan.satirlar) {
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(r.id)) {
        add(aidatBeklenenKur,r.id,kurus(r.beklenen));
        add(aidatOdenenKur,r.id,kurus(r.odenen));
      }
      const h = Array.isArray(r.record?.hareketler) && r.record.hareketler.length
        ? r.record.hareketler
        : kurus(r.odenen)>0 ? [{id:'eski',tutar:r.odenen,tarih:r.record?.odemeTarihi||'',yontem:r.record?.odemeYontemi||r.record?.odemeSekli||r.record?.yontem||'',eskiKayit:true}]
        : [];
      for(const move of h) {
        const tutar=kurus(move.tutar);
        if(!tutar) continue;
        const tarih=move.tarih||'';
        const nakitAy=monthKey(tarih);
        if(nakitAy) add(nakitKur,nakitAy,tutar);
        else tarihsizKur+=tutar;
        hareketler.push({ogrenciId:o.id,kalemId:r.id,kalem:r.ad,tarih,tutar:tl(tutar),yontem:move.yontem||'',hareketId:move.id||'',nakitAy,kaynakTahsilatId:move.kaynakTahsilatId||r.record?.kaynakTahsilatId||''});
      }
    }
  }
  const kurMap=src=>Object.fromEntries(Object.entries(src).map(([key,v])=>[key,tl(v)]));
  const toplamBeklenen=tl(sum(planlar.map(o=>kurus(o.plan.toplam))));
  const toplamOdenen=tl(sum(planlar.map(o=>kurus(o.plan.odenen))));
  const toplamKalan=tl(sum(planlar.map(o=>kurus(o.plan.kalan))));
  const gecikenTutar=tl(sum(planlar.map(o=>kurus(o.plan.geciken))));
  const buAyAidatBeklenen=tl(aidatBeklenenKur[ay]||0);
  const buAyAidataIslenen=tl(aidatOdenenKur[ay]||0);
  return {
    ay,ogrenciSayisi:planlar.length,planlar,
    toplamBeklenen,toplamOdenen,toplamKalan,gecikenTutar,
    gecikenOgrenci:planlar.filter(o=>o.plan.geciken>0).length,
    buAyAidatBeklenen,buAyAidataIslenen,buAyOdeyen,
    buAyAidatOrani:buAyAidatBeklenen>0?Math.min(100,Math.round(buAyAidataIslenen/buAyAidatBeklenen*100)):0,
    tahsilatOrani:toplamBeklenen>0?Math.min(100,Math.round(toplamOdenen/toplamBeklenen*100)):0,
    aidatBeklenen:kurMap(aidatBeklenenKur),aidatOdenen:kurMap(aidatOdenenKur),
    nakitAylar:kurMap(nakitKur),buAyNakit:tl(nakitKur[ay]||0),
    tarihsizTahsilat:tl(tarihsizKur),hareketler,uyarilar
  };
}
