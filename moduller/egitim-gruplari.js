import {mountGroups,invalidateGroups} from '../js/egitim-gruplari-ui.mjs';
import {loadGroups,resolveGroupAudience} from '../js/egitim-gruplari-data.mjs';
import {groupManager,groupTeacher,groupSession,childAudience,distinctStudents} from '../js/egitim-gruplari-core.mjs';
const api=()=>window.PortalAPI;
let managerPanel=null,pendingOpen=null;
export async function open(){
 const p=api(),host=document.getElementById('egitimGruplariPanel');if(!host)return;
 const trigger=document.getElementById('egitimGruplariAc');
 if(managerPanel?.valid()&&host.querySelector('.ig-panel')){host.hidden=!host.hidden;trigger?.setAttribute('aria-expanded',String(!host.hidden));return managerPanel;}
 host.hidden=false;trigger?.setAttribute('aria-expanded','true');
 if(pendingOpen?.session===groupSession(p.state))return pendingOpen.promise;
 if(p.state.ogrenciVerileriHazirMi===false){host.textContent='Öğrenci listesi henüz hazır değil. ';const retry=document.createElement('button');retry.textContent='Yeniden dene';retry.onclick=open;host.append(retry);return;}
 const students=p.state.ogrenciList.filter(o=>p.state.ayarListesi[o.id]&&p.ogrenciDurum(o,p.state.ayarListesi[o.id])==='aktif');
 const request={session:groupSession(p.state)};pendingOpen=request;
 request.promise=mountGroups(host,p,{students,notify:p.toast,onRetry:open});
 try{const panel=await request.promise;if(pendingOpen===request)managerPanel=panel;return panel;}finally{if(pendingOpen===request)pendingOpen=null;}
}
const generations=new Map();
export async function fillGroupSelect(id){
 const p=api(),session=groupSession(p.state),gen=(generations.get(id)||0)+1,select=document.getElementById(id);generations.set(id,gen);
 if(!select)return;const current=()=>session===groupSession(p.state)&&generations.get(id)===gen;
 select.replaceChildren(new Option('Gruplar yükleniyor…',''));select.disabled=true;
 try{const {groups}=await loadGroups(p);if(!current())return;
  select.replaceChildren(new Option('İngilizce grubu seçin',''));
  groups.filter(g=>g.durum==='aktif').forEach(g=>select.add(new Option(g.ad,g.id)));select.disabled=false;
  if(!groups.some(g=>g.durum==='aktif'))select.options[0].text='Atanmış aktif İngilizce grubu yok';
 }catch(e){if(current()){select.replaceChildren(new Option('Gruplar yüklenemedi; ekranı yeniden açın',''));p.toast('İngilizce grupları yüklenemedi.','error');}}
}
export async function selectedAudience(type,groupId,selectedOptions,{announcement=false}={}){
 const p=api();if(type==='egitimGrup')return resolveGroupAudience(p,groupId);if(type!=='ogrenci')return {};
 const selected=[...(selectedOptions||[])].filter(o=>o.value),ids=selected.map(o=>o.value);
 let allowed=p.state.ogrenciList||[];
 if(groupTeacher(p.state)){
   const own=primaryChildren(p),{members}=await loadGroups(p);
   const allowedIds=new Set([...own.map(o=>o.id),...members.map(m=>m.ogrenciId)]);
   if(ids.some(id=>!allowedIds.has(id)))throw Error('Yalnız kendi öğrencilerinizi seçebilirsiniz.');
 }else if(!groupManager(p.state)&&(!(announcement&&p.state.rol==='pdr'&&p.state.personel?.durum==='aktif')||ids.some(id=>!allowed.some(o=>o.id===id))))throw Error('Yalnız erişiminiz olan öğrencileri seçebilirsiniz.');
 return childAudience(ids,Object.fromEntries(selected.map(o=>[o.value,o.dataset.ad||o.textContent])));
}
export function clear(){managerPanel=null;pendingOpen=null;const host=document.getElementById('egitimGruplariPanel');if(host){invalidateGroups(host);host.hidden=true;}document.getElementById('egitimGruplariAc')?.setAttribute('aria-expanded','false');document.getElementById('egitimGruplariPanel')?.replaceChildren();for(const id of ['galeriHedefGrup','duyuruHedefGrup','galeriHedefOgrenci','duyuruHedefOgrenci']){generations.set(id,(generations.get(id)||0)+1);const el=document.getElementById(id);if(el){el.replaceChildren();el.disabled=true;}}}

function primaryChildren(p){return (p.state.ogrenciList||[]).filter(o=>(p.state.siniflar||[]).includes(p.state.ayarListesi?.[o.id]?.kayit?.sinif||o.sinif||o.sinifi||''));}
export async function fillTeacherChildren(id){
 const p=api();if(!groupTeacher(p.state))return;
 const session=groupSession(p.state),select=document.getElementById(id),generation=(generations.get(id)||0)+1;generations.set(id,generation);
 try{const {members}=await loadGroups(p),ids=[...new Set(members.map(m=>m.ogrenciId))];
  const docs=await Promise.all(ids.map(id=>p.fb.getDoc(p.fb.doc(p.db,'ogrenciler',id))));
  if(groupSession(p.state)!==session||generations.get(id)!==generation)return;
  const children=distinctStudents([...primaryChildren(p),...docs.filter(d=>d.exists()).map(d=>({...d.data(),id:d.id})).filter(o=>o.aktifDonem===p.state.aktifDonem&&String(o.aktifDonemDurum||o.durum||'').toLocaleLowerCase('tr')==='aktif')]);
  const selected=new Set([...select.selectedOptions].map(o=>o.value));select.replaceChildren();
  children.sort((a,b)=>(a.ogrenciAdSoyad||'').localeCompare(b.ogrenciAdSoyad||'','tr')).forEach(o=>{const opt=new Option(o.ogrenciAdSoyad||o.adSoyad||'Öğrenci',o.id,false,selected.has(o.id));opt.dataset.ad=o.ogrenciAdSoyad||o.adSoyad||'';select.add(opt);});
 }catch(_){p.toast('İngilizce grubu öğrencileri yüklenemedi.','error');}
}

if(globalThis.window)window.egitimGrupTemizle=clear;
