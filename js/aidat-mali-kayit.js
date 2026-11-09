// Yalnız aidat kartını kaydet; öğrenci/veli erişimi ve sözleşme alanlarına dokunma.
function sirali(v) {
  if (Array.isArray(v)) return v.map(sirali);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sirali(v[k])]));
  return v;
}
export function maliKayitImzasi(v = {}) {
  return JSON.stringify(sirali({aidatAyarlari:v.aidatAyarlari||{}, aylikOdemeler:v.aylikOdemeler||{}, digerOdemeler:v.digerOdemeler||{}, notlar:v.notlar||''}));
}
export function maliKayitYamasi(eski, form, aylikOdemeler, digerOdemeler, notlar) {
  const toplamOdenen = [...Object.values(aylikOdemeler), ...Object.values(digerOdemeler)]
    .reduce((toplam, o) => toplam + Math.round((Number(o.odenenTutar)||0)*100), 0)/100;
  return {
    aidatAyarlari:{...eski.aidatAyarlari, ...form, toplamOdenen, kalan:Math.max(0, form.toplamBeklenen-toplamOdenen)},
    aylikOdemeler, digerOdemeler, notlar
  };
}
