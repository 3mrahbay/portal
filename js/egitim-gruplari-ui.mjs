import {groupManager,groupTeacher,groupSession,distinctStudents} from './egitim-gruplari-core.mjs';
import {groupStyles} from './egitim-gruplari-styles.mjs';
import {loadGroups,saveGroup,assignStudents} from './egitim-gruplari-data.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=o=>o.ogrenciAdSoyad||o.adSoyad||'Öğrenci';
const primary=(o,s)=>s.ayarListesi?.[o.id]?.kayit?.sinif||o.sinif||o.sinifi||'';
const born=(o,s)=>String(o.dogumTarihi||s.ayarListesi?.[o.id]?.ogrenci?.dogumTarihi||'').match(/\b(?:19|20)\d{2}\b/)?.[0]||'';
const mounts=new WeakMap();
export function invalidateGroups(host){if(host)mounts.delete(host);}
export async function mountGroups(host,api,{students=[],notify=()=>{},onRetry}={}) {
  const token={};mounts.set(host,token);
  const session=groupSession(api.state),valid=()=>mounts.get(host)===token&&host.isConnected&&groupSession(api.state)===session;
  if(!groupManager(api.state)){host.textContent='İngilizce gruplarını yalnız okul yönetimi düzenleyebilir.';return;}
  let groups=[],members=[],teachers=[],selected=new Set(),filter='',birth='',q='',groupId='',busy=false;
  let draft={id:'',ad:'',teacher:'',active:true},status='',statusError=false;
  const roster=distinctStudents(students),baseCount=roster.length;
  const report=(message,error=false)=>{status=message;statusError=error;const el=host.querySelector('[data-status]');if(el){el.textContent=message;el.style.color=error?'#b91c1c':'#166534';}notify(message,error?'error':'success');};
  async function refresh(){
    const data=await loadGroups(api);if(!valid())return false;groups=data.groups;members=data.members;return true;
  }
  function draw(){
    if(!valid())return;
    const state=api.state,assigned=new Map(members.map(m=>[m.ogrenciId,m.grupId])),groupNames=new Map(groups.map(g=>[g.id,g.ad]));
    const visible=roster.filter(o=>(!q||name(o).toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))&&(!birth||born(o,state)===birth)&&(!filter||(filter==='__none'? !assigned.get(o.id):primary(o,state)===filter)));
    const classes=[...new Set(roster.map(o=>primary(o,state)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
    const years=[...new Set(roster.map(o=>born(o,state)).filter(Boolean))].sort();
    const hiddenSelected=[...selected].filter(id=>!visible.some(o=>o.id===id)).length;
    host.innerHTML=`<style>${groupStyles}</style>
      <section class="ig-panel" aria-label="İngilizce grupları">
      <header class="ig-header"><div><h3>İngilizce grupları</h3><p>${esc(state.aktifDonem)} · ${baseCount} öğrenci · ${groups.filter(g=>g.durum==='aktif').length} aktif grup</p></div><button type="button" data-close>Paneli kapat</button></header>
      <p class="ig-intro">Öğrencileri ana sınıflarını değiştirmeden İngilizce gruplarına ekleyin.</p>
      <section class="ig-card" aria-labelledby="ig-edit-title"><h4 id="ig-edit-title">Grup oluştur / düzenle</h4><div class="ig-fields">
        <label>Grup<select data-edit><option value="">Yeni grup</option>${groups.map(g=>`<option value="${esc(g.id)}" ${draft.id===g.id?'selected':''}>${esc(g.ad)}${g.durum==='pasif'?' (pasif)':''}</option>`).join('')}</select></label>
        <label>Grup adı<input data-name value="${esc(draft.ad)}" placeholder="Örn. İngilizce 4 Yaş A" maxlength="80"></label>
        <label>İngilizce öğretmeni<select data-teacher><option value="">Öğretmen seçin</option>${draft.teacher&&!teachers.some(t=>t.email===draft.teacher)?`<option selected value="${esc(draft.teacher)}">${esc(draft.teacher)} (aktif değil)</option>`:''}${teachers.map(t=>`<option value="${esc(t.email)}" ${draft.teacher===t.email?'selected':''}>${esc(t.adSoyad||t.email)}</option>`).join('')}</select></label>
      </div><div class="ig-row"><label class="ig-check"><input type="checkbox" data-active ${draft.active?'checked':''}> Aktif grup</label><button type="button" class="ig-primary" data-save>Grubu kaydet</button></div></section>
      <section class="ig-card" aria-labelledby="ig-students-title"><h4 id="ig-students-title">Öğrenci ekle / ata</h4><p class="ig-help">Öğrencileri seçin, hedef grubu belirleyin ve atamayı kaydedin. Her öğrenci bir İngilizce grubunda yer alabilir.</p>
      <div class="ig-fields"><label>Öğrenci ara<input data-search placeholder="Ad veya soyad" value="${esc(q)}"></label>
        <label>Ana sınıf / atama<select data-class><option value="">Tüm ana sınıflar</option><option value="__none" ${filter==='__none'?'selected':''}>İngilizce grubu atanmayanlar</option>${classes.map(c=>`<option ${filter===c?'selected':''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label>
        <label>Doğum yılı<select data-birth><option value="">Tüm doğum yılları</option>${years.map(y=>`<option ${birth===y?'selected':''}>${esc(y)}</option>`).join('')}</select></label></div>
      <div class="ig-row ig-selection"><button type="button" data-select>Görünenleri seç (${visible.length})</button><button type="button" data-clear>Seçimi temizle</button><strong data-selected>${selected.size} öğrenci seçili${hiddenSelected?` · ${hiddenSelected} seçim filtre dışında`:''}</strong></div>
      <div class="ig-table"><table><caption class="ig-help">${visible.length} / ${baseCount} öğrenci gösteriliyor</caption><thead><tr><th scope="col">Seç</th><th scope="col">Öğrenci</th><th scope="col">Ana sınıfı</th><th scope="col">İngilizce grubu</th></tr></thead><tbody>${visible.map(o=>`<tr class="${selected.has(o.id)?'ig-selected':''}"><td><input type="checkbox" data-child="${esc(o.id)}" aria-label="${esc(name(o))} seç" ${selected.has(o.id)?'checked':''}></td><td><strong>${esc(name(o))}</strong><br><small>${esc(born(o,state))}</small></td><td data-label="Ana sınıfı">${esc(primary(o,state)||'Belirtilmedi')}</td><td data-label="İngilizce grubu"><span class="ig-badge ${assigned.get(o.id)?'':'ig-unassigned'}">${esc(groupNames.get(assigned.get(o.id))||'Atanmadı')}</span></td></tr>`).join('')||'<tr><td colspan="4" class="ig-empty">Bu filtrelere uygun öğrenci bulunamadı. Aramayı veya filtreleri değiştirin.</td></tr>'}</tbody></table></div>
      <div class="ig-assignment"><label>Hedef İngilizce grubu<select data-target><option value="">Grup seçin</option>${groups.filter(g=>g.durum==='aktif').map(g=>`<option value="${esc(g.id)}" ${groupId===g.id?'selected':''}>${esc(g.ad)} (${members.filter(m=>m.grupId===g.id).length} öğrenci)</option>`).join('')}</select></label><button type="button" class="ig-primary" data-assign>Seçilenleri gruba ata</button><button type="button" class="ig-danger" data-remove>Gruptan çıkar</button></div>
      ${groups.some(g=>g.durum==='aktif')?'':'<p class="ig-help">Öğrenci atamak için önce aktif bir İngilizce grubu oluşturun.</p>'}
      <div data-status role="status" aria-live="polite" style="color:${statusError?'#b91c1c':'#166534'}">${esc(status)}</div></section></section>`;
    const get=k=>host.querySelector(`[data-${k}]`);
    const disable=()=>{
      host.querySelectorAll('button,input,select').forEach(el=>el.disabled=busy);
      get('assign').disabled=busy||!selected.size||!groupId;
      get('remove').disabled=busy||!selected.size;
      get('clear').disabled=busy||!selected.size;
      get('select').disabled=busy||!visible.length;
      host.querySelector('.ig-panel').setAttribute('aria-busy',String(busy));
    };
    get('close').onclick=()=>{host.hidden=true;const trigger=document.getElementById('egitimGruplariAc');trigger?.setAttribute('aria-expanded','false');trigger?.focus();};
    get('edit').onchange=()=>{const g=groups.find(x=>x.id===get('edit').value);draft={id:g?.id||'',ad:g?.ad||'',teacher:g?.ogretmenEmail||'',active:g?.durum!=='pasif'};draw();get('edit').focus();};
    get('name').oninput=e=>draft.ad=e.target.value;
    get('teacher').onchange=e=>draft.teacher=e.target.value;
    get('active').onchange=e=>draft.active=e.target.checked;
    get('save').onclick=async()=>{if(busy)return;const values={ad:get('name').value,ogretmenEmail:get('teacher').value,durum:get('active').checked?'aktif':'pasif'},id=get('edit').value;busy=true;disable();try{const savedId=await saveGroup(api,values,id);draft={id:savedId,ad:values.ad,teacher:values.ogretmenEmail,active:values.durum==='aktif'};if(await refresh()){draw();report('İngilizce grubu kaydedildi.');}}catch(e){if(valid())report(e.message,true);}finally{busy=false;if(valid())disable();}};
    get('search').oninput=e=>{const pos=e.target.selectionStart;q=e.target.value;draw();get('search').focus();get('search').setSelectionRange(pos,pos);};
    get('class').onchange=e=>{filter=e.target.value;draw();get('class').focus();};get('birth').onchange=e=>{birth=e.target.value;draw();get('birth').focus();};get('target').onchange=e=>{groupId=e.target.value;disable();};
    get('select').onclick=()=>{visible.forEach(o=>selected.add(o.id));draw();get('select').focus();};get('clear').onclick=()=>{selected.clear();draw();get('select').focus();};
    host.querySelectorAll('[data-child]').forEach(el=>el.onchange=()=>{el.checked?selected.add(el.dataset.child):selected.delete(el.dataset.child);const hidden=[...selected].filter(id=>!visible.some(o=>o.id===id)).length;get('selected').textContent=selected.size+' öğrenci seçili'+(hidden?' · '+hidden+' seçim filtre dışında':'');el.closest('tr').classList.toggle('ig-selected',el.checked);disable();});
    const assign=async remove=>{if(busy)return;if(!selected.size||(!remove&&!groupId)){report('Öğrenci ve hedef grup seçin.',true);return;}
      const destination=remove?'':groupId,ids=[...selected],expected=Object.fromEntries(ids.map(id=>[id,assigned.get(id)||'']));
      if(!globalThis.confirm(`${ids.length} öğrencinin İngilizce ${remove?'grup ataması kaldırılacak':'grubu değiştirilecek'}. Kaydedilsin mi?`))return;
      busy=true;disable();try{const r=await assignStudents(api,ids,destination,expected);if(await refresh()){selected=new Set(r.errors.map(e=>e.id));draw();report(`${r.changed} atama güncellendi, ${r.unchanged} atama zaten aynıydı.${r.errors.length?' '+r.errors.length+' atama yapılamadı: '+r.errors[0].message:''} Toplam öğrenci: ${baseCount}.`,!!r.errors.length);}}catch(e){if(valid())report(e.message,true);}finally{busy=false;if(valid())disable();}};
    get('assign').onclick=()=>assign(false);get('remove').onclick=()=>assign(true);disable();
  }
  host.textContent='İngilizce grupları yükleniyor…';
  try{const {fb,db}=api,s=await fb.getDocs(fb.collection(db,'personeller'));if(!valid())return;teachers=s.docs.map(d=>({...d.data(),email:d.id})).filter(p=>groupTeacher({currentUser:{uid:'candidate'},rol:p.rol,personel:p}));if(await refresh())draw();}
  catch(e){if(valid()){host.textContent='İngilizce grupları yüklenemedi. '+e.message;const retry=document.createElement('button');retry.textContent='Yeniden dene';retry.onclick=()=>onRetry?onRetry():mountGroups(host,api,{students,notify});host.append(retry);}}
  return {session,valid,refresh:async()=>{if(await refresh())draw();}};
}
