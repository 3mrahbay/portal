// Synthetic integration fixture. Reads only selected active gallery code; never serves index.html.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as approval from '../js/galeri-onay-canli.js';
import * as folders from '../js/galeri-klasorleri.js';
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function selected(start, end) {
  const a=index.indexOf(start), b=index.indexOf(end,a);
  if(a<0||b<a)throw new Error('Active gallery fixture boundary missing');
  return index.slice(a,b);
}
export const gallerySource = selected('let galeriListesiVerisi = [];','// Yükleme Modalı') + '\n' + selected('let aktifLightboxOge = null;','window.galeriGonderiDuzenle =');
export const navigationSource = selected('window.modulSec = function(modulKey, tabTikla = true)','// Bir sekme adına göre modül vurgusunu güncelle') + "\n" + selected('document.querySelectorAll(".tab").forEach(tab => {','// Etkinlik & Takvim iç alt-sekme geçişi');
export const lightboxMarkup = selected('<div class="modal-overlay" id="galeriLightbox"','<!-- ============ SCRIPTS ============ -->');
export const selectedStyles = selected('.modal-overlay {','@keyframes fadeIn') + selected('.btn-mini {','.sozlesme-empty {');
export const galleryControls = selected('          <!-- Üst bar: başlık + filtreler -->','          <div id="galeriListesi">');
export const exposeGallery = '\nglobalThis.fixtureAPI={render:renderGaleri,start:galeriOnayTakibiniBaslat,stop:galeriOnayTakibiniDurdur,notice:galeriOnayBildirimiAc,read:()=>({filter:aktifGaleriFilter,items:galeriListesiVerisi,feed:galeriOnayDurumu,active:aktifLightboxOge})};';
export const media=(id,extra={})=>({id,durum:'beklemede',dosyaTipi:'foto',bunnyUrl:`https://synthetic-media.test/${id}.svg`,etkinlikBaslik:'Sentetik Galeri',hedefTur:'sinif',hedefDeger:'Sentetik Sınıf',...extra});
export const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
export const settle=async()=>{await Promise.resolve();await Promise.resolve();};
export class FakeElement {
  constructor(id=''){this.id=id;this._html='';this._text='';this.children=[];this.style={};this.dataset={};this.attributes={};this.listeners={};this.value='';this.disabled=false;const values=new Set();this.classList={add:(...xs)=>xs.forEach(x=>values.add(x)),remove:(...xs)=>xs.forEach(x=>values.delete(x)),contains:x=>values.has(x),toggle:(x,force)=>{const on=force??!values.has(x);if(on)values.add(x);else values.delete(x);return on;}};}
  set innerHTML(x){this._html=String(x);this._text='';this.children=[];this.parsedRetry=null;}
  get innerHTML(){return this._html;}
  set textContent(x){this._text=String(x);this._html='';this.children=[];}
  get textContent(){return this._text+this.children.map(x=>typeof x==='string'?x:x.textContent).join('');}
  replaceChildren(...xs){this.innerHTML='';this.children=[...xs];}
  append(...xs){this.children.push(...xs);}
  appendChild(x){this.append(x);return x;}
  addEventListener(name,fn){this.listeners[name]=fn;}
  click(){return this.onclick?.({target:this})??this.listeners.click?.({target:this});}
  querySelector(selector){if(selector==='[data-gallery-retry]'&&this.innerHTML.includes('data-gallery-retry'))return this.parsedRetry??=new FakeElement();return null;}
  querySelectorAll(){return[];}
  setAttribute(k,v){this.attributes[k]=v;}
}
export function galleryRuntime(options={}){
 const nodes=new Map();for(const id of ['tab-galeri','galeriListesi','galeriOnayCanliDurum','galeriOnayBekleyenRozet','galeriMenuOnayRozet','galeriOnayFiltreBtn','galeriLightbox','galeriLightboxIcerik','galeriLightboxDuzenleBtn'])nodes.set(id,new FakeElement(id));nodes.get('tab-galeri').classList.add('active');nodes.set('tab-profilim',new FakeElement('tab-profilim'));const tabs=['galeri','profilim'].map(name=>{const tab=new FakeElement();tab.dataset.tab=name;return tab;});
 const calls={reads:[],writes:[],listeners:[],toasts:[],modules:[]};let rows=options.rows||[];
 const state={currentUser:{uid:'synthetic-admin-a',email:'admin-a@example.test'},rol:'mudur',personel:{durum:'aktif'},galeriOturumSurumu:1,...options.state};
 const snap=rows=>({docs:rows.map(row=>({id:row.id,data:()=>row})),metadata:{fromCache:false}});
 const fb={collection:(_db,name)=>name,where:(field,op,value)=>({field,op,value}),query:(collection,...constraints)=>({collection,constraints}),
 onSnapshot(query,_options,next,error){const entry={query,next,error,stopped:false};calls.listeners.push(entry);return()=>{entry.stopped=true;};},
 getDocs:async query=>{calls.reads.push({type:'list',query});return snap(await(options.getRows?options.getRows(query):rows));},
 doc:(_db,collection,id)=>({collection,id}),getDoc:async ref=>{calls.reads.push({type:'doc',ref});const row=options.getMedia?await options.getMedia(ref.id):rows.find(x=>x.id===ref.id);return{id:ref.id,exists:()=>!!row,data:()=>row};},
 updateDoc:async(ref,data)=>calls.writes.push({ref,data}),setDoc:async(...args)=>calls.writes.push(args)};
 const context={...approval,...folders,...fb,db:{},console:{warn(){},error(){}},setTimeout:()=>0,clearTimeout,URLSearchParams,Date,MODUL_HARITASI:{galeri:{tablar:['galeri'],varsayilan:'galeri'},profilim:{tablar:['profilim'],varsayilan:'profilim'}},aktifModul:'galeri',sekmeyeErisim:()=>true,mesajlasmaDurdur(){},egitimArkaPlanCalismasiniDurdur(){},adminHomeArkaPlanCalismasiniDurdur(){},
 document:{getElementById:id=>nodes.get(id)||null,querySelector:selector=>selector.startsWith('.tab[data-tab=')?tabs.find(t=>selector.includes(t.dataset.tab)):null,querySelectorAll:selector=>['.tab','.tabs .tab'].includes(selector)?tabs:selector==='.tab-panel'?[nodes.get('tab-galeri'),nodes.get('tab-profilim')]:[],createElement:()=>new FakeElement()},
 PortalAPI:{state,fb},currentUser:state.currentUser,aktifKullaniciRol:state.rol,isAdmin:false,AKTIF_DONEM:'2026-2027',
 createGalleryFolderView:()=>({reset(){},render(){throw new Error('Education view outside approval fixture');}}),escapeHtml:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 showToast:(message,type)=>calls.toasts.push({message,type}),modulSec:id=>{calls.modules.push(id);nodes.get('tab-galeri').classList.add('active');},confirm:()=>true};
 context.window=context;vm.createContext(context);vm.runInContext(gallerySource+'\n'+navigationSource+exposeGallery,context);const moduleSelect=context.modulSec;context.modulSec=(...args)=>{calls.modules.push(args[0]);return moduleSelect(...args);};
 return{...context.fixtureAPI,window:context,state,calls,nodes,tabs,html:()=>nodes.get('galeriListesi').innerHTML,
 setRows:x=>{rows=x;},switchAccount:(uid='synthetic-admin-b')=>{state.currentUser={uid,email:`${uid}@example.test`};state.galeriOturumSurumu++;context.currentUser=state.currentUser;},
 emit:(items,fromCache=false,index=calls.listeners.length-1)=>calls.listeners[index].next({...snap(items),metadata:{fromCache}}),
 fail:(code='permission-denied',index=calls.listeners.length-1)=>calls.listeners[index].error({code}),
 isOpen:()=>nodes.get('galeriLightbox').classList.contains('active')};
}
