// Approval queue only: no notification backfill, media mutation or parent reads.
const OWNER = 'emrahby@gmail.com';
const APPROVERS = new Set(['kurucu_mudur', 'mudur']);
const clean = value => String(value ?? '').trim();
export const pendingGallery = value => ['beklemede', 'onayBekliyor'].includes(value?.durum ?? value);
export function galleryApprover(state = {}) {
  const email = clean(state.currentUser?.email).toLowerCase();
  return !!state.currentUser?.uid && (email === OWNER ||
    (state.personel?.durum === 'aktif' && APPROVERS.has(clean(state.rol))));
}
export function gallerySession(state = {}) {
  return JSON.stringify([state.currentUser?.uid || '', clean(state.currentUser?.email).toLowerCase(),
    state.galeriOturumSurumu ?? '', state.rol || '', state.personel?.durum || '']);
}
export function galleryApprovalTarget(record = {}) {
  const target = clean(record.hedefSayfa);
  const local = /^(?:\.\/|\/)?galeri-onay\.html(?:\?[^#]*)?$/.test(target);
  if (record.tip !== 'galeri_onay' && !local) return null;
  let id = clean(record.kaynakId);
  if (!id && local && target.includes('?')) {
    const values = new URLSearchParams(target.split('?')[1]).getAll('medya');
    if (values.length === 1) id = clean(values[0]);
  }
  if (/[\u0000-\u001f/\\]/.test(id) || id.length > 1500) id = '';
  return { id }; // Legacy ZEKY notices have no ID: open the pending queue.
}
export function startGalleryApprovalFeed({ fb, db, getState, onChange = () => {} } = {}) {
  const initial = getState?.() || {};
  const owner = gallerySession(initial);
  let stopped = false, unsubscribe = null;
  let state = { status:'idle', items:[], error:'', fromCache:false };
  const active = () => !stopped && gallerySession(getState?.() || {}) === owner && galleryApprover(getState?.() || {});
  const emit = next => { state = next; if (active()) onChange({...state, items:[...state.items]}); };
  const controller = {
    getState:() => ({...state,items:[...state.items]}),
    stop() { stopped = true; unsubscribe?.(); unsubscribe = null; state = {status:'stopped',items:[],error:'',fromCache:false}; }
  };
  if (!galleryApprover(initial) || !fb?.onSnapshot || !db) return controller;
  emit({status:'loading',items:[],error:'',fromCache:false});
  try {
    const query = fb.query(fb.collection(db,'galeri'),fb.where('durum','in',['beklemede','onayBekliyor']));
    unsubscribe = fb.onSnapshot(query,{includeMetadataChanges:true},snapshot => {
      if (!active()) return;
      const items = snapshot.docs.map(item => ({...item.data(),id:item.id})).filter(pendingGallery);
      const fromCache = snapshot.metadata?.fromCache === true;
      emit({status:fromCache ? 'cached' : 'ready',items,error:'',fromCache});
    }, error => {
      if (!active()) return;
      emit({...state,status:'error',error:clean(error?.code) || 'unavailable'});
    });
  } catch (error) {
    if (active()) emit({...state,status:'error',error:clean(error?.code) || 'unavailable'});
  }
  return controller;
}
