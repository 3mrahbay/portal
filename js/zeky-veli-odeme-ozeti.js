// Compatibility API; all payment calculations now use the shared finance core.
import {kartOzeti,bugun} from './finans/core.js';
export function veliOdemeOzetiHesapla(veri,now=new Date()){
 const p=kartOzeti(veri,now),r=p.secilen;
 if(p.plansiz)return {durum:'plansiz',baslik:'Ödeme planı',rozet:'Hazırlanıyor',tutar:null,aciklama:'Gerçek ödeme planınız henüz oluşturulmamış.',eylem:'Ödemeleri Gör'};
 if(!r)return {durum:'tamamlandi',baslik:'Ödeme durumu',rozet:'Tamamlandı',tutar:0,aciklama:'Bekleyen ödeme bulunmuyor.',eylem:'Detayları Gör'};
 return {durum:r.durum,baslik:r.id==='__onOdeme'?'Kayıt ön ödemesi':r.gecikmis?'Gecikmiş ödeme':r.id===bugun(now).slice(0,7)?'Bu ay ödemesi':'Sıradaki ödeme',rozet:({odendi:'Ödendi',kismi:'Kısmi',gecikmis:'Gecikmiş',bekliyor:'Bekliyor',tanimsiz:'Tanımlanmamış'})[r.durum],tutar:r.durum==='odendi'?r.beklenen:r.kalan,aciklama:`${r.ad} · ${r.odenen.toLocaleString('tr-TR')} ₺ ödendi`,eylem:r.kalan>0?'Ödeme Bildir':'Detayları Gör'};
}
