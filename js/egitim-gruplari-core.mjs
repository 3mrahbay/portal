// Secondary memberships reference existing students. They never create a student.
export const GROUP_PROGRAM = 'ingilizce';
export const GROUP_MANAGERS = ['kurucu_mudur','mudur','egitim_koordinator'];
export const GROUP_TEACHERS = ['ogretmen','yardimci_ogretmen','ingilizce_ogretmeni','degerler_ogretmeni','orman_ogretmeni','brans_ogretmeni'];
export const clean = value => typeof value === 'string' ? value.trim() : '';
export const uniqueIds = values => [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
export function validId(id) { return typeof id === 'string' && id.length > 0 && id.length <= 180 && !/[\/\\\x00-\x1f]/.test(id) && !['.','..'].includes(id); }
export function membershipId(period, studentId) {
  if (!/^\d{4}-\d{4}$/.test(period) || !validId(studentId)) throw Error('Dönem veya öğrenci kimliği geçersiz.');
  return `${period}__ingilizce__${studentId}`;
}
export function groupManager(state={}) { return !!state.currentUser?.uid && state.personel?.durum === 'aktif' && state.personel?.aktif !== false && GROUP_MANAGERS.includes(state.rol); }
export function groupTeacher(state={}) { return !!state.currentUser?.uid && state.personel?.durum === 'aktif' && state.personel?.aktif !== false && GROUP_TEACHERS.includes(state.rol); }
export function groupSession(state={}) { return JSON.stringify([state.currentUser?.uid, clean(state.currentUser?.email).toLowerCase(), state.rol, state.personel?.durum, state.personel?.aktif, state.aktifDonem, state.galeriOturumSurumu]); }
export function groupVisible(group,state) {
  return !!group && group.program === GROUP_PROGRAM && group.donem === state.aktifDonem &&
    (groupManager(state) || (groupTeacher(state) && group.durum === 'aktif' && group.ogretmenEmail === clean(state.currentUser.email).toLowerCase()));
}
export function distinctStudents(students) { return [...new Map(students.filter(s=>validId(s?.id)).map(s=>[s.id,s])).values()]; }
// Explicit arrays are authoritative. Conflicting legacy aliases fail closed.
export function contentChildIds(content={}) {
  const fields=['ogrenciIds','ogrenciler'];
  const arrays=fields.filter(k=>k in content).map(k=>content[k]);
  if (arrays.some(a=>!Array.isArray(a)||a.some(id=>!validId(id)))) return [];
  const lists=arrays.map(uniqueIds);
  if (lists.length>1 && (lists[0].length!==lists[1].length || lists[0].some(id=>!lists[1].includes(id)))) return [];
  const aliases=[content.hedefDeger,content.hedefOgrenciId,content.ogrenciId].filter(v=>v!=null&&v!=='');
  if (aliases.some(id=>!validId(id)) || new Set(aliases).size>1) return [];
  const ids=lists.length?lists[0]:uniqueIds(aliases);
  return aliases.some(id=>!ids.includes(id)) ? [] : ids;
}
export function childAudience(ids,names={}) {
  const selected=uniqueIds(ids);
  if (!selected.length || selected.length>120 || selected.some(id=>!validId(id))) throw Error('1–120 öğrenci seçin.');
  return {hedefTur:'ogrenci',hedefDeger:selected[0],hedefOgrenciId:selected[0],
    ogrenciIds:selected,ogrenciler:selected,hedefOgrenciAd:selected.length===1?(names[selected[0]]||''):`${selected.length} öğrenci`};
}
export function groupAudience(group,members,students,state) {
  if (!groupVisible(group,state) || group.durum!=='aktif') throw Error('Bu İngilizce grubuna paylaşım yetkiniz yok.');
  const ids=uniqueIds(members.filter(m=>m.grupId===group.id&&m.donem===group.donem&&m.program===GROUP_PROGRAM).map(m=>m.ogrenciId));
  const active=distinctStudents(students).filter(s=>ids.includes(s.id));
  if(active.length!==ids.length) throw Error('Grubun öğrenci listesi eksik; yenileyip tekrar deneyin.');
  return {...childAudience(active.map(s=>s.id),Object.fromEntries(active.map(s=>[s.id,s.ogrenciAdSoyad||s.adSoyad||'']))),
    egitimGrupId:group.id,egitimGrupAdi:group.ad,donem:group.donem,program:GROUP_PROGRAM,egitimKaydi:false};
}
