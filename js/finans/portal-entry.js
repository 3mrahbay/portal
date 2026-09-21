import {dashboard} from './dashboard.js';
import {veliEkrani} from './parent.js';
function css(){if(document.getElementById('financeCss'))return;const l=document.createElement('link');l.id='financeCss';l.rel='stylesheet';l.href='./js/finans/ui.css';document.head.append(l);}
export async function portalFinans(root){css();const p=window.PortalAPI,s=p.state;if(!s.isAdmin&&!['kurucu_mudur','kurucu','mudur','mudur_yardimcisi','muhasebe'].includes(s.rol)){root.textContent='Bu bölüme erişim yetkiniz yok.';return;}await dashboard(root,{fb:p.fb,db:p.db,email:s.currentUser?.email||'',donem:s.aktifDonem});}
export async function portalVeli(root){css();const p=window.PortalAPI,s=p.state;const students=[...(s.veliOgrenciler||[])].sort((a,b)=>a.id===s.veliAktifOgrenci?.id?-1:b.id===s.veliAktifOgrenci?.id?1:0);await veliEkrani(root,{fb:p.fb,db:p.db,email:s.currentUser?.email||'',donem:s.aktifDonem,ogrenciler:students});}
