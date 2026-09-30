import { genelPushGonder } from './zeky-operasyon-push.js';

function temizEmail(e){ return String(e || '').trim().toLowerCase(); }
function durumNorm(v){ return String(v || '').trim().toLocaleLowerCase('tr'); }
function altyapi(){
  const p=window.PortalAPI || {}, b=window.BCK || {};
  return { db:p.db || b.db, fb:p.fb || b, state:p.state || {}, p, b };
}

// Yalnız bu sayfa oturumundaki yeniden tıklamaları/eşzamanlı çağrıları birleştirir.
// Gönderenin alıcı bildirimlerini okuma yetkisi varsayılmaz. Sunucu tarafında
// create-once sağlanmadıkça sekmeler/yeniden yüklemeler arası exactly-once değildir.
function olayOnbellegi(){
  return window.__zekyBildirimOlayOnbellegi ||= new Map();
}

export async function bildirimKaydetVePush(aliciEmailler, {
  tip='genel', baslik='ZEKY', metin='', hedefSayfa='bildirimler.html', kaynakId='', ogrenciId='',
  olayAnahtari='', pushBaslik=baslik, pushMetin=metin, sessizUyari=false
} = {}) {
  const {db,fb,state}=altyapi();
  const emailler=[...new Set((aliciEmailler || []).map(temizEmail).filter(Boolean))];
  if (!emailler.length) return { ok:false, adet:0, istenen:0, hata:'alici-yok', kayitHatalari:[] };
  const olay=String(olayAnahtari || '');
  // Hesap değişimi aynı tarayıcıdaki başka göndericinin olayını bastırmamalı.
  const anahtar=JSON.stringify([state.currentUser?.uid || state.currentUser?.email || '',tip,olay]);
  const onbellek=olay ? olayOnbellegi() : new Map();
  if (!onbellek.has(anahtar)) onbellek.set(anahtar,new Map());
  const alicilar=onbellek.get(anahtar), yeniler=[], cozumler=new Map();
  for (const email of emailler) {
    if (alicilar.has(email)) continue;
    yeniler.push(email);
    alicilar.set(email,new Promise(resolve=>cozumler.set(email,resolve)));
  }
  if (yeniler.length) {
    const simdi=new Date().toISOString();
    const kayitIsi=Promise.allSettled(yeniler.map(email=>Promise.resolve().then(()=>{
      if (!db || !fb?.addDoc || !fb?.collection) throw new Error('Portal bildirim altyapısı hazır değil');
      return fb.addDoc(fb.collection(db,'bildirimler'), {
        aliciEmail:email, tip, baslik, metin, hedefSayfa, kaynakId, ogrenciId,
        ...(olay ? {olayAnahtari:olay} : {}), ...(sessizUyari ? {sessizUyari:true} : {}), okundu:false, olusturuldu:simdi
      });
    })));
    // Kayıt ve push birbirinden bağımsızdır; bir kanaldaki hata diğerini engellemez.
    const pushIsi=Promise.resolve().then(()=>genelPushGonder(yeniler,{
      tip,baslik:pushBaslik,metin:pushMetin,hedefSayfa
    })).catch(e=>({ok:false,hata:String(e?.message || e)}));
    const [kayitlar,push]=await Promise.all([kayitIsi,pushIsi]);
    for (let i=0;i<yeniler.length;i++) cozumler.get(yeniler[i])({kayit:kayitlar[i],push});
    const hatali=kayitlar.filter(x=>x.status==='rejected').length;
    if (hatali) console.warn('ZEKY bildirim kaydı kısmen/tamamen oluşturulamadı:',hatali,'/',yeniler.length);
    if (push?.ok!==true) console.warn('ZEKY push teslimi doğrulanamadı:',push?.hata || 'sonuç-belirsiz');
  }
  const sonuclar=await Promise.all(emailler.map(email=>alicilar.get(email)));
  const adet=sonuclar.filter(x=>x.kayit.status==='fulfilled').length;
  const kayitHatalari=sonuclar.flatMap((x,i)=>x.kayit.status==='rejected'
    ? [{email:emailler[i],hata:String(x.kayit.reason?.code || x.kayit.reason?.message || x.kayit.reason)}] : []);
  const pushSonuclari=[...new Set(sonuclar.map(x=>x.push))];
  const push=pushSonuclari.length===1 ? pushSonuclari[0] : {
    ok:pushSonuclari.every(x=>x?.ok===true), sonuclar:pushSonuclari
  };
  return {ok:adet===emailler.length,adet,istenen:emailler.length,kayitHatalari,push,tekrar:emailler.length-yeniler.length};
}

export function hedefVeliEmailleri({ hedefTur='tumOkul', hedefDeger='', sinifEsle=null } = {}) {
  const {state,p,b}=altyapi();
  const ogrenciler=state.ogrenciList ?? b.ogrenciler?.() ?? [];
  const ayarlar=state.ayarListesi ?? b.ayarlar?.() ?? {};
  const donem=String(state.aktifDonem ?? b.donem?.() ?? '');
  // Bilinmeyen/boşaltılmış hedef hiçbir zaman tüm okula genişletilmez.
  if (!['tumOkul','sinif','ogrenci'].includes(hedefTur)) return [];
  if (hedefTur!=='tumOkul' && !String(hedefDeger || '').trim()) return [];
  const emailler=[];
  for (const o of ogrenciler) {
    if (!o?.id) continue;
    const a=ayarlar[o.id];
    let durum='';
    if (a) {
      const durumFn=p.ogrenciDurum || b.getOgrenciDurum || window.getOgrenciDurum;
      durum=typeof durumFn==='function' ? durumFn(o,a) : (a.durum || a.kayit?.durum || o.durum || 'aktif');
    } else {
      // Aktif dönem alt belgesi yoksa yalnız eşleşen güvenli ana kayıt özeti.
      if (!donem || String(o.aktifDonem || '')!==donem) continue;
      durum=o.aktifDonemDurum || o.durum || 'aktif';
    }
    if (durumNorm(durum)!=='aktif') continue;
    const sinif=a?.kayit?.sinif || o.sinif || o.sinifi || '';
    let dahil=hedefTur==='tumOkul';
    if (hedefTur==='sinif') dahil=!!sinif && (sinifEsle ? !!sinifEsle(sinif,hedefDeger) : sinif===hedefDeger);
    if (hedefTur==='ogrenci') dahil=o.id===hedefDeger;
    if (!dahil) continue;
    // Yalnız uygun öğrencinin kendi kayıtlarındaki veli alanları okunur.
    // Bağımsız veli/personel rehberi sorgulanmaz veya kapsama eklenmez.
    for (const kaynak of [a,o]) {
      if (!kaynak) continue;
      for (const v of [kaynak.anne,kaynak.baba,kaynak.vasi,kaynak.veli,...(Array.isArray(kaynak.veliler)?kaynak.veliler:[])]) {
        const e=temizEmail(v?.eposta || v?.email); if(e) emailler.push(e);
      }
      for (const e0 of [kaynak.veliEposta,kaynak.veliEmail,kaynak.veli1Eposta,kaynak.veli2Eposta,kaynak.veli1Email,kaynak.veli2Email]) {
        const e=temizEmail(e0); if(e) emailler.push(e);
      }
    }
  }
  return [...new Set(emailler)];
}
