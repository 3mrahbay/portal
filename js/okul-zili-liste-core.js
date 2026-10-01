// Ortak, salt okunur liste yardımcıları. Sıralama yalnız ilk/son veli
// bildiriminin kendi zamanını kullanır; durum güncellemeleri sırayı değiştirmez.
export function bildirimZamani(value) {
  try {
    if (value == null || value === '') return 0;
    let ms;
    if (typeof value.toMillis === 'function') ms = value.toMillis();
    else if (typeof value.toDate === 'function') ms = value.toDate().getTime();
    else if (Number.isFinite(value.seconds)) {
      const ns = value.nanoseconds ?? 0;
      if (!Number.isFinite(ns) || ns < 0 || ns >= 1e9) return 0;
      ms = value.seconds * 1000 + ns / 1e6;
    } else if (value instanceof Date) ms = value.getTime();
    else if (typeof value === 'number') ms = value;
    else if (typeof value === 'string') ms = Date.parse(value);
    return Number.isFinite(ms) && Math.abs(ms) <= 8.64e15 ? ms : 0;
  } catch (_) { return 0; }
}

export function enYeniBildirimOnce(a, b, alan = 'olusturuldu') {
  const fark = bildirimZamani(b?.[alan]) - bildirimZamani(a?.[alan]);
  if (fark) return fark;
  // Aynı veya eksik saatte Firestore dönüş sırasına bağlı titreme olmasın.
  const ak = String(a?.id || a?.ogrenciId || '');
  const bk = String(b?.id || b?.ogrenciId || '');
  return ak < bk ? -1 : ak > bk ? 1 : 0;
}

// Tek abonelik, doğrudan snapshot render'ı. Her snapshot için getDocs yapılmaz;
// eski ekran/oturum cevapları, yinelenen abonelik ve boş-liste kör noktası yoktur.
// Ses/push veya Firestore yazma işlemi yapmaz.
export function canliListeOlustur() {
  let current = null;
  function durdur() {
    const previous = current;
    current = null;
    if (previous?.unsubscribe) previous.unsubscribe();
  }
  function baslat({ key, target, subscribe, isCurrent, render, onError, onStart }) {
    if (current?.key === key && current.target === target) {
      current.render = render;
      if (current.hasSnapshot && isCurrent()) render(current.snapshot);
      return;
    }
    durdur();
    const run = { key, target, render, unsubscribe: null, hasSnapshot: false };
    current = run;
    const active = () => {
      if (current !== run) return false;
      if (!isCurrent()) { durdur(); return false; }
      return true;
    };
    const error = e => {
      if (!active()) return;
      durdur(); // onSnapshot hatadan sonra kapanır; yeniden denemeye izin ver.
      onError(e);
    };
    try {
      onStart?.();
      const unsubscribe = subscribe(snapshot => {
        if (!active()) return;
        run.snapshot = snapshot;
        run.hasSnapshot = true;
        run.render(snapshot);
      }, error);
      if (current === run) run.unsubscribe = unsubscribe;
      else unsubscribe?.(); // Senkron hata/ekran değişimi de abonelik sızdırmasın.
    } catch (e) { error(e); }
  }
  return { baslat, durdur };
}
