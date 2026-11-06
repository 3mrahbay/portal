// Presentation state is deliberately separate from notification acknowledgement.
// Seen state is scoped to this browser, signed-in parent, child and school period.
export const RAPOR_KAPALI_MESAJI = 'Dönem raporu, dönem sonu veli görüşmeniz tamamlandıktan sonra okul yönetimi tarafından paylaşılacaktır.';

export function bildirimKazaniminiBul(b, sunumlar, ogrenciId) {
  if (!b || (b.ogrenciId && b.ogrenciId !== ogrenciId) || b.tip === 'rozet') return null;
  const key = b.kazanimAnahtari || b.anahtar;
  if (b.program && key) return sunumlar.find(s => s.program === b.program && s.anahtar === key) || null;
  const source = String(b.galeriId || b.kaynakId || '');
  if (!source) return null;
  return sunumlar.find(s => s.galeriId && (s.galeriId === source || `egitim_${s.galeriId}` === source)) || null;
}

export function gorulmeDeposu({ storage, hesap, ogrenciId, donem }) {
  const key = 'veli-egitim-goruldu-v1:' + JSON.stringify([hesap, ogrenciId, donem]);
  let seen = new Set();
  try { const saved = JSON.parse(storage?.getItem(key) || '[]'); if (Array.isArray(saved)) seen = new Set(saved.filter(x => typeof x === 'string')); } catch (_) {}
  // Do not persist photos or teacher notes in browser storage.
  // A later stage/date or replacement gallery record becomes new again.
  const event = s => JSON.stringify([s.program, s.anahtar, s.durum, s.tarih, s.galeriId]);
  return {
    yeni: s => !seen.has(event(s)),
    goruldu(sunumlar) {
      for (const s of sunumlar) seen.add(event(s));
      try { storage?.setItem(key, JSON.stringify([...seen].slice(-3000))); } catch (_) {}
    }
  };
}
