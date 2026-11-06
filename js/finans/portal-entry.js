import {importPanel,importCallableAdapter} from './import-panel.js';
import {OWNER_EMAIL} from './import-approval.js';
import {muhasebeAnaSayfa} from './staff-home.js';
import {dashboard} from './dashboard.js';
import {veliEkrani} from './parent.js';
function css(){if(document.getElementById('financeCss'))return;const l=document.createElement('link');l.id='financeCss';l.rel='stylesheet';l.href='./js/finans/ui.css';document.head.append(l);}
export async function portalFinans(root){css();const p=window.PortalAPI,s=p.state;if(!s.isAdmin&&!['kurucu_mudur','kurucu','mudur','mudur_yardimcisi','muhasebe'].includes(s.rol)){root.textContent='Bu bölüme erişim yetkiniz yok.';return;}const dashboardRoot=document.createElement('div');root.replaceChildren(dashboardRoot);await dashboard(dashboardRoot,{fb:p.fb,db:p.db,email:s.currentUser?.email||'',donem:s.aktifDonem});
if(s.currentUser?.email===OWNER_EMAIL){const section=document.createElement('section');section.className='finans-app';root.append(section);let api=null;
// Host opt-in requires an already configured Functions instance; never initialize
// production services or trust a page flag as server authorization.
if(p.financeImportFunctions){const {httpsCallable}=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js');api=importCallableAdapter(p.financeImportFunctions,httpsCallable);}
await importPanel(section,api);}}
export async function portalVeli(root){css();const p=window.PortalAPI,s=p.state;const students=[...(s.veliOgrenciler||[])].sort((a,b)=>a.id===s.veliAktifOgrenci?.id?-1:b.id===s.veliAktifOgrenci?.id?1:0);await veliEkrani(root,{fb:p.fb,db:p.db,email:s.currentUser?.email||'',donem:s.aktifDonem,ogrenciler:students,kartTalepAc:(id,donem)=>window.veliKartTalepAc(id,donem)});}

export async function portalMuhasebeAnaSayfa(root){css();const p=window.PortalAPI,s=p.state;if(s.rol!=='muhasebe'){root.textContent='Bu ekran muhasebe hesabına özeldir.';return;}await muhasebeAnaSayfa(root,{fb:p.fb,db:p.db,email:s.currentUser?.email||'',donem:s.aktifDonem,islem(k){const paths={mesaj:'mesajlasma',ozluk:'profilim',devam:'profilim',personel:'ozluk',gider:'muhasebe'};if(k==='fis')window.giderTalepAc();else if(paths[k])window.modulSec(paths[k]);}});}
