// Yönetim oturumunda aktif dönem üyeliğini öğrenci ana kaydına güvenli iki alanla yansıtır.
// Öğretmen finans/dönem alt belgesini okumadan yalnız aktif öğrenciyi ayırt edebilir.
const YONETIM = new Set(['kurucu_mudur','mudur','egitim_koordinator']);

function norm(v){
  const d=String(v||'aktif').toLocaleLowerCase('tr').trim();
  return ['arsiv','arşiv','pasif','ayrildi','ayrıldı'].includes(d)?'arsiv':'aktif';
}
function bekle(ms){return new Promise(r=>setTimeout(r,ms));}

export async function aktifDonemSenkronla(){
  for(let deneme=0;deneme<15;deneme++){
    const p=window.PortalAPI,b=window.BCK,s=p?.state||{};
    const yonetim=!!s.isAdmin||YONETIM.has(String(s.rol||''));
    if(!yonetim)return false;
    const ayarlar=s.ayarListesi||{},ogrenciler=s.ogrenciList||[],donem=String(s.aktifDonem||'');
    if(!b?.setDoc||!b?.doc||!b?.db||!donem||!ogrenciler.length||!Object.keys(ayarlar).length){await bekle(800);continue;}
    const anahtar=`zeky-aktif-donem-sync-v2-${donem}`;
    try{if(sessionStorage.getItem(anahtar)==='1')return true;}catch(_){}
    const isler=[];
    for(const o of ogrenciler){
      const ayar=ayarlar[o.id];if(!ayar)continue;
      const durum=norm(ayar.durum);
      if(String(o.aktifDonem||'')===donem&&norm(o.aktifDonemDurum)===durum)continue;
      o.aktifDonem=donem;o.aktifDonemDurum=durum;
      isler.push(b.setDoc(b.doc(b.db,'ogrenciler',o.id),{
        aktifDonem:donem,aktifDonemDurum:durum,aktifDonemGuncellendi:new Date().toISOString()
      },{merge:true}).catch(e=>console.warn('Aktif dönem senkronu',o.id,e)));
    }
    for(let i=0;i<isler.length;i+=12)await Promise.all(isler.slice(i,i+12));
    try{sessionStorage.setItem(anahtar,'1');}catch(_){}
    return true;
  }
  return false;
}

if(typeof window!=='undefined')aktifDonemSenkronla().catch(e=>console.warn('Aktif dönem senkronu',e));
