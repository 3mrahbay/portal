// Server rules remain authoritative. Never turn a rejected read into an empty record.
const GLOBAL_ROLES = new Set(['kurucu_mudur', 'mudur', 'egitim_koordinator', 'pdr']);
const TEACHER_ROLES = new Set(['ogretmen', 'yardimci_ogretmen', 'ingilizce_ogretmeni', 'degerler_ogretmeni', 'orman_ogretmeni', 'brans_ogretmeni']);
export function educationReadScope(state) {
  if (!state.currentUser?.uid) throw new Error('Eğitim için oturum açılmalı.');
  if (!state.ogrenciVerileriHazirMi) throw new Error('Öğrenci listesi henüz yüklenmedi. Yeniden deneyin.');
  const global = !!state.isAdmin || GLOBAL_ROLES.has(state.rol);
  if (!global && !TEACHER_ROLES.has(state.rol)) throw new Error('Eğitim okuma yetkisi bulunamadı.');
  const p = state.personel || {};
  // Same precedence and exact class strings as ogretmenSiniflari() in released rules.
  const classes = Array.isArray(p.sinifAtamalari) ? p.sinifAtamalari : (Array.isArray(p.siniflar) ? p.siniflar : []);
  if (!global && !classes.length) throw new Error('Öğretmen sınıf ataması bulunamadı. Yönetimle iletişime geçin.');
  const students = (state.ogrenciList || []).filter(o => o.id && (global || classes.includes(o.sinif) || classes.includes(state.ayarListesi?.[o.id]?.kayit?.sinif)));
  const ids = [...new Set(students.map(o => o.id))].sort();
  const key = JSON.stringify([state.currentUser.uid, state.currentUser.email, state.galeriOturumSurumu, state.rol, global, state.aktifDonem, classes, ids]);
  return { global, students, ids, key };
}
export function createEducationReader({ scope, readAll, readOne, now = Date.now }) {
  let cached, pending, generation = 0;
  const invalidate = () => { generation++; cached = pending = undefined; };
  const read = async (force = false) => {
    const target = scope(), version = generation;
    if (!force && cached?.key === target.key && now() - cached.time < 300000) return cached.value;
    if (pending?.key === target.key && pending.version === version) return pending.promise;
    const job = { key: target.key, version };
    job.promise = (async () => {
      let value = {};
      if (target.global) value = await readAll();
      else {
        // Small independent document reads avoid both collection-list denial and rule call limits.
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(6, target.ids.length) }, async () => {
          while (next < target.ids.length) {
            const id = target.ids[next++];
            const data = await readOne(id);
            if (data !== null) value[id] = data;
          }
        }));
      }
      if (version !== generation || target.key !== scope().key) throw Object.assign(new Error('Eğitim okuma kapsamı değişti.'), {name:'AbortError'});
      cached = {key:target.key, value, time:now()};
      return value;
    })().catch(error => {
      if (cached?.key === target.key && version === generation) cached = undefined;
      throw error;
    }).finally(() => { if (pending === job) pending = undefined; });
    pending = job;
    return job.promise;
  };
  return {read, invalidate};
}
export function watchEducationRecords({target, listenAll, listenOne, current, update, error}) {
  let stopped = false;
  const stops = [], values = {}, ready = new Set();
  const stop = () => { stopped = true; stops.splice(0).forEach(fn => fn()); };
  const fail = err => { if (!stopped && current()) { stop(); error(err); } };
  if (target.global) {
    stops.push(listenAll(value => { if (!stopped && current()) update(value); }, fail));
  } else {
    for (const id of target.ids) {
      stops.push(listenOne(id, data => {
        if (stopped || !current()) return;
        if (data === null) delete values[id]; else values[id] = data;
        ready.add(id);
        // Do not publish a partial snapshot as though other students have no records.
        if (ready.size === target.ids.length) update({...values});
      }, fail));
    }
  }
  return stop;
}
