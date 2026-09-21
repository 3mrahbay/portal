import {panelKur} from '../js/pdr/panel.js';
import {pdrStore} from '../js/pdr/store.js';
const P=()=>window.PortalAPI;
export async function panelRender(hedefId){
  const root=document.getElementById(hedefId);if(!root)return;
  const kullanici=()=>({rol:P().state.rol,isAdmin:P().state.isAdmin,email:P().state.currentUser?.email,ad:P().state.personel?.adSoyad||P().state.currentUser?.displayName});
  const store=pdrStore(P().fb,P().db,kullanici);
  await panelKur(root,{kullanici,kaydet:store.kaydet,
    async yukle(){const s=P().state;if(!s.ogrenciVerileriHazirMi)throw new Error('Öğrenciler henüz yüklenmedi.');const ogrenciler=s.ogrenciList.filter(o=>{const a=s.ayarListesi[o.id];return a&&P().ogrenciDurum(o,a)==='aktif';}).map(o=>({id:o.id,ad:o.ogrenciAdSoyad||o.adSoyad||'Öğrenci',sinif:s.ayarListesi[o.id]?.kayit?.sinif||o.sinif||''}));return {donem:s.aktifDonem,ogrenciler,...await store.yukle(s.aktifDonem)};},
    async islem(alan,ogrenciId){
      if(alan==='fis'){window.giderTalepAc();return;}
      if(alan==='ihtiyac'){window.modulSec('profilim');setTimeout(()=>document.getElementById('profilIhtiyacKart')?.scrollIntoView({behavior:'smooth'}),500);return;}
      if(alan==='gozlem'||alan==='test'){
        const modal=document.createElement('dialog');modal.style.cssText='width:min(850px,96vw);max-height:90vh;border:1px solid #d9cfe3;border-radius:16px;padding:20px';
        modal.innerHTML='<button type="button" data-close>Kapat</button><div id="pdrEskiFormKap"></div>';
        document.body.append(modal);modal.showModal();modal.querySelector('[data-close]').onclick=()=>modal.close();modal.onclose=()=>{modal.remove();panelRender(hedefId);};
        const m=await window.modulYukle('pdr');await m.panelRender('pdrEskiFormKap');window._pdr.formAc(alan);
        const sel=document.getElementById('pdfOgr');if(sel)sel.value=ogrenciId;return;
      }
      window.modulSec(alan);
    }
  });
}
