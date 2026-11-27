// Program navigation is distinct from student/class read scope.
export const EDUCATION_TEACHERS = ['ogretmen','yardimci_ogretmen','ingilizce_ogretmeni','degerler_ogretmeni','orman_ogretmeni','brans_ogretmeni'];
export function educationPrograms(state, catalog) {
  const role=state.rol, p=state.personel||{};
  if(!state.currentUser?.uid) return [];
  if(state.isAdmin||['kurucu_mudur','mudur','egitim_koordinator','pdr'].includes(role)) return catalog;
  if(!EDUCATION_TEACHERS.includes(role)||p.durum==='arsiv'||p.durum==='pasif') return [];
  const defaults={ogretmen:['montessori','orman'],yardimci_ogretmen:['montessori','orman'],ingilizce_ogretmeni:['ingilizce'],degerler_ogretmeni:['degerler'],orman_ogretmeni:['orman']};
  const ids=Array.isArray(p.egitimProgramlari)?p.egitimProgramlari:(defaults[role]||[]);
  return catalog.filter(d=>ids.includes(d.id));
}
export function canObserveProgram(state,id,catalog){return state.rol!=='pdr'&&educationPrograms(state,catalog).some(d=>d.id===id);}
