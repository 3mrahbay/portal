import { genelPushGonder } from './zeky-operasyon-push.js';

function temizEmail(e){ return String(e || '').trim().toLowerCase(); }

export async function bildirimKaydetVePush(aliciEmailler, {
  tip='genel', baslik='ZEKY', metin='', hedefSayfa='bildirimler.html', kaynakId='', ogrenciId=''
} = {}) {
  const B = window.BCK;
  if (!B?.db || !B?.addDoc || !B?.collection) throw new Error('Portal bildirim altyapısı hazır değil');
  const emailler=[...new Set((aliciEmailler || []).map(temizEmail).filter(Boolean))];
  if (!emailler.length) return { ok:false, adet:0, hata:'alici-yok' };

  const simdi=new Date().toISOString();
  const sonuc=await Promise.allSettled(emailler.map(email => B.addDoc(B.collection(B.db,'bildirimler'), {
    aliciEmail:email, tip, baslik, metin, hedefSayfa, kaynakId, ogrenciId,
    okundu:false, olusturuldu:simdi
  })));

  const yazilan=sonuc.filter(x=>x.status==='fulfilled').length;
  const push=await genelPushGonder(emailler,{tip,baslik,metin,hedefSayfa});
  return { ok:yazilan>0, adet:yazilan, push };
}

export function hedefVeliEmailleri({ hedefTur='tumOkul', hedefDeger='', sinifEsle=null } = {}) {
  const B=window.BCK;
  const ogrenciler=B?.ogrenciler?.() || [];
  const ayarlar=B?.ayarlar?.() || {};
  const emailler=[];
  for(const o of ogrenciler){
    const a=ayarlar[o.id] || {};
    const durum = (typeof window.getOgrenciDurum === 'function')
      ? window.getOgrenciDurum(o,a)
      : (a?.kayit?.durum || o.durum || 'aktif');
    if(String(durum || '').toLowerCase()==='arsiv') continue;
    const sinif=a?.kayit?.sinif || o.sinif || o.sinifi || '';
    let dahil=false;
    if(hedefTur==='tumOkul' || !hedefTur) dahil=true;
    else if(hedefTur==='sinif') dahil = sinifEsle ? !!sinifEsle(sinif,hedefDeger) : sinif===hedefDeger;
    else if(hedefTur==='ogrenci') dahil = o.id===hedefDeger;
    if(!dahil) continue;
    for(const v of [a.anne,a.baba,a.vasi,a.veli]){
      const e=temizEmail(v?.eposta || v?.email);
      if(e) emailler.push(e);
    }
    for(const e0 of [o.veliEposta,o.veliEmail,o.veli1Eposta,o.veli2Eposta]){
      const e=temizEmail(e0); if(e) emailler.push(e);
    }
  }
  return [...new Set(emailler)];
}
