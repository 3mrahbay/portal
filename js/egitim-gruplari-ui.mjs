import {groupManager,groupTeacher,groupSession,distinctStudents} from './egitim-gruplari-core.mjs';
import {loadGroups,saveGroup,assignStudents} from './egitim-gruplari-data.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=o=>o.ogrenciAdSoyad||o.adSoyad||'Öğrenci';
const primary=(o,s)=>s.ayarListesi?.[o.id]?.kayit?.sinif||o.sinif||o.sinifi||'';
const born=(o,s)=>String(o.dogumTarihi||s.ayarListesi?.[o.id]?.ogrenci?.dogumTarihi||'').match(/\b(?:19|20)\d{2}\b/)?.[0]||'';
export async function mountGroups(host,api,{students=[],notify=()=>{}}={}) {
  const session=groupSession(api.state),valid=()=>host.isConnected&&groupSession(api.state)===session;
  if(!groupManager(api.state)){host.textContent='İngilizce gruplarını yalnız okul yönetimi düzenleyebilir.';return;}
  let groups=[],members=[],teachers=[],selected=new Set(),filter='',birth='',q='',groupId='',busy=false;
  const roster=distinctStudents(students),baseCount=roster.length;
  const report=(message,error=false)=>{const el=host.querySelector('[data-status]');if(el){el.textContent=message;el.style.color=error?'#b91c1c':'#166534';}notify(message,error?'error':'success');};
  async function refresh(){
    const data=await loadGroups(api);if(!valid())return false;groups=data.groups;members=data.members;return true;
  }
  function draw(){
    if(!valid())return;
    const state=api.state,assigned=new Map(members.map(m=>[m.ogrenciId,m.grupId])),groupNames=new Map(groups.map(g=>[g.id,g.ad]));
    const visible=roster.filter(o=>(!q||name(o).toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))&&(!birth||born(o,state)===birth)&&(!filter||(filter==='__none'? !assigned.get(o.id):primary(o,state)===filter)));
    const classes=[...new Set(roster.map(o=>primary(o,state)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
    const years=[...new Set(roster.map(o=>born(o,state)).filter(Boolean))].sort();
    host.innerHTML=`<style>.ig-panel{font:14px/1.5 system-ui;color:#263647}.ig-panel input,.ig-panel select,.ig-panel button{font:inherit;border:1px solid #cbd5e1;border-radius:8px;padding:9px;max-width:100%;min-height:40px}.ig-panel button{cursor:pointer;background:#fff}.ig-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}.ig-panel table{width:100%;border-collapse:collapse}.ig-panel td,.ig-panel th{text-align:left;padding:9px;border-bottom:1px solid #e2e8f0}.ig-panel small{color:#64748b}.ig-panel button:disabled{opacity:.5;cursor:wait}.ig-card{border:1px solid #dbe5ee;border-radius:12px;padding:14px;margin:12px 0;background:#fff}</style>
      <section class="ig-panel"><h3>İngilizce grupları · ${esc(state.aktifDonem)}</h3>
      <p>${baseCount} öğrenci · Ana sınıfına ek olarak bir İngilizce grubuna atanabilir.</p>
      <div class="ig-card"><b>Grup oluştur / düzenle</b><div class="ig-row">
        <select data-edit aria-label="Düzenlenecek grup"><option value="">Yeni grup</option>${groups.map(g=>`<option value="${esc(g.id)}">${esc(g.ad)}${g.durum==='pasif'?' (pasif)':''}</option>`).join('')}</select>
        <input data-name aria-label="İngilizce grup adı" placeholder="İngilizce 4 Yaş A" maxlength="80">
        <select data-teacher aria-label="İngilizce öğretmeni"><option value="">Öğretmen seçin</option>${teachers.map(t=>`<option value="${esc(t.email)}">${esc(t.adSoyad||t.email)}</option>`).join('')}</select>
        <label><input type="checkbox" data-active checked> Aktif</label><button data-save>Grubu kaydet</button></div></div>
      <div class="ig-row"><input data-search placeholder="Öğrenci ara" aria-label="Öğrenci ara" value="${esc(q)}">
        <select data-class aria-label="Ana sınıfa göre süz"><option value="">Tüm ana sınıflar</option><option value="__none" ${filter==='__none'?'selected':''}>İngilizce grubu atanmayanlar</option>${classes.map(c=>`<option ${filter===c?'selected':''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
        <select data-birth aria-label="Doğum yılı"><option value="">Tüm doğum yılları</option>${years.map(y=>`<option ${birth===y?'selected':''}>${esc(y)}</option>`).join('')}</select></div>
      <div class="ig-row"><button data-select>Görünenleri seç (${visible.length})</button><button data-clear>Seçimi temizle</button><strong data-selected>${selected.size} öğrenci seçili</strong></div>
      <div class="ig-row"><select data-target aria-label="Atanacak İngilizce grubu"><option value="">Grup seçin</option>${groups.filter(g=>g.durum==='aktif').map(g=>`<option value="${esc(g.id)}" ${groupId===g.id?'selected':''}>${esc(g.ad)} (${members.filter(m=>m.grupId===g.id).length})</option>`).join('')}</select><button data-assign>Seçilenleri gruba ata</button><button data-remove>İngilizce grubundan çıkar</button></div>
      <div data-status role="status" aria-live="polite"></div><div style="overflow:auto"><table><thead><tr><th>Seç</th><th>Öğrenci</th><th>Ana sınıfı</th><th>İngilizce grubu</th></tr></thead><tbody>${visible.map(o=>`<tr><td><input type="checkbox" data-child="${esc(o.id)}" aria-label="${esc(name(o))} seç" ${selected.has(o.id)?'checked':''}></td><td>${esc(name(o))}<br><small>${esc(born(o,state))}</small></td><td>${esc(primary(o,state))}</td><td>${esc(groupNames.get(assigned.get(o.id))||'Atanmadı')}</td></tr>`).join('')}</tbody></table></div></section>`;
    const get=k=>host.querySelector(`[data-${k}]`);
    const disable=()=>host.querySelectorAll('button,input,select').forEach(el=>el.disabled=busy);
    get('edit').onchange=()=>{const g=groups.find(x=>x.id===get('edit').value);get('name').value=g?.ad||'';get('teacher').value=g?.ogretmenEmail||'';get('active').checked=g?.durum!=='pasif';};
    get('save').onclick=async()=>{if(busy)return;const values={ad:get('name').value,ogretmenEmail:get('teacher').value,durum:get('active').checked?'aktif':'pasif'},id=get('edit').value;busy=true;disable();try{await saveGroup(api,values,id);if(await refresh()){draw();report('İngilizce grubu kaydedildi.');}}catch(e){if(valid())report(e.message,true);}finally{busy=false;if(valid())disable();}};
    get('search').oninput=e=>{const pos=e.target.selectionStart;q=e.target.value;draw();get('search').focus();get('search').setSelectionRange(pos,pos);};
    get('class').onchange=e=>{filter=e.target.value;draw();};get('birth').onchange=e=>{birth=e.target.value;draw();};get('target').onchange=e=>groupId=e.target.value;
    get('select').onclick=()=>{visible.forEach(o=>selected.add(o.id));draw();};get('clear').onclick=()=>{selected.clear();draw();};
    host.querySelectorAll('[data-child]').forEach(el=>el.onchange=()=>{el.checked?selected.add(el.dataset.child):selected.delete(el.dataset.child);get('selected').textContent=selected.size+' öğrenci seçili';});
    const assign=async remove=>{if(busy)return;if(!selected.size||(!remove&&!groupId)){report('Öğrenci ve hedef grup seçin.',true);return;}
      const destination=remove?'':groupId,ids=[...selected],expected=Object.fromEntries(ids.map(id=>[id,assigned.get(id)||'']));
      if(!globalThis.confirm(`${ids.length} öğrencinin İngilizce ${remove?'grup ataması kaldırılacak':'grubu değiştirilecek'}. Kaydedilsin mi?`))return;
      busy=true;disable();try{const r=await assignStudents(api,ids,destination,expected);if(await refresh()){selected=new Set(r.errors.map(e=>e.id));draw();report(`${r.changed} atama güncellendi, ${r.unchanged} atama zaten aynıydı.${r.errors.length?' '+r.errors.length+' atama yapılamadı: '+r.errors[0].message:''} Toplam öğrenci: ${baseCount}.`,!!r.errors.length);}}catch(e){if(valid())report(e.message,true);}finally{busy=false;if(valid())disable();}};
    get('assign').onclick=()=>assign(false);get('remove').onclick=()=>assign(true);disable();
  }
  host.textContent='İngilizce grupları yükleniyor…';
  try{const {fb,db}=api,s=await fb.getDocs(fb.collection(db,'personeller'));if(!valid())return;teachers=s.docs.map(d=>({...d.data(),email:d.id})).filter(p=>groupTeacher({currentUser:{uid:'candidate'},rol:p.rol,personel:p}));if(await refresh())draw();}
  catch(e){if(valid()){host.textContent='İngilizce grupları yüklenemedi. '+e.message;const retry=document.createElement('button');retry.textContent='Yeniden dene';retry.onclick=()=>mountGroups(host,api,{students,notify});host.append(retry);}}
  return {refresh:async()=>{if(await refresh())draw();}};
}
