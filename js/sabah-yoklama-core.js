import { bildirimZamani } from './okul-zili-liste-core.js?v=168';

// Yoklama ekranının isoTarih(new Date()) ile aynı yerel takvim günü.
export function sabahBugun(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function yoklamaDurumu(value) {
  const code = String(value || '').toLocaleLowerCase('tr-TR').trim();
  if (['geldi', 'var'].includes(code)) return 'geldi';
  if (['gelmedi', 'yok', 'devamsiz', 'devamsız'].includes(code)) return 'gelmedi';
  if (['izin', 'izinli'].includes(code)) return 'izinli';
  if (['hasta', 'raporlu'].includes(code)) return 'hasta';
  if (code === 'gec') return 'gec';
  return '';
}
export function sabahDurumu(giris = {}, yoklama = {}, izinli = false, yoklamaHazir = true) {
  // Öğretmenin açık kaydı onaylı veli izninden üstündür; ekrana uyumlu.
  const durum = yoklamaDurumu(yoklama.durum) || (!yoklama.durum && izinli ? 'izinli' : '');
  if (yoklama.durum && !yoklamaDurumu(yoklama.durum)) return { grup: 'kontrol', durum: 'diger', teslim: !!giris.sinifaGirisOnayi, eylem: false };
  const gelmiyor = ['gelmedi', 'izinli', 'hasta'].includes(durum);
  const teslim = !!giris.sinifaGirisOnayi;
  const yolda = giris.veliBildirdi === true;
  const bildirim = bildirimZamani(giris.veliBildirimSaati);
  const isaret = bildirimZamani(yoklama.kayitZamani);
  // Fiziksel teslim onayı gizlenmez. Yeni/belirsiz geliş bildirimi de eski
  // devamsızlık kaydının altında kaybolmaz; iki kayıt açıkça birlikte gösterilir.
  const celiski = gelmiyor && (teslim || (yolda && (!bildirim || !isaret || bildirim > isaret)));
  if (celiski) return { grup: 'kontrol', durum, teslim, eylem: false };
  if (teslim || ['geldi', 'gec'].includes(durum)) return { grup: 'tamam', durum: teslim ? 'teslim' : durum, teslim, eylem: false };
  if (gelmiyor) return { grup: 'gelmeyen', durum, teslim: false, eylem: false };
  return { grup: 'aktif', durum: yolda ? 'yolda' : yoklamaHazir ? 'bekliyor' : 'belirsiz', teslim: false, eylem: yoklamaHazir };
}

// Okuma dışında işlem yapmaz. Yoklama notu, izin nedeni, sağlık açıklaması,
// e-posta veya veli iletişim alanları birleşik arayüz durumuna alınmaz.
export function sabahVerileriniDinle({ fb, db, kaynak, tarih, yoklamaYetkisi }, next, error) {
  let stopped = false;
  const unsubscribes = [];
  const state = { sabah: null, yoklama: {}, izinliler: new Set(),
    yoklamaDurum: yoklamaYetkisi ? 'bekleniyor' : 'kapali', izinDurum: yoklamaYetkisi ? 'bekleniyor' : 'kapali' };
  const emit = () => { if (!stopped && state.sabah) next({ ...state }); };
  const listen = (ref, receive, fail) => {
    if (stopped) return;
    try {
      const unsubscribe = fb.onSnapshot(ref, snap => { if (!stopped) { receive(snap); emit(); } }, e => { if (!stopped) fail(e); });
      if (stopped) unsubscribe?.(); else unsubscribes.push(unsubscribe);
    } catch (e) { if (!stopped) fail(e); }
  };
  const stop = () => { stopped = true; unsubscribes.splice(0).forEach(fn => fn?.()); };
  listen(fb.query(fb.collection(db, kaynak), fb.where('tarih', '==', tarih)),
    snap => { state.sabah = snap; }, e => { stop(); error(e); });
  if (yoklamaYetkisi) {
    listen(fb.doc(db, 'devamsizlik', tarih), snap => {
      const data = snap.exists() ? snap.data()?.kayitlar || {} : {};
      state.yoklama = Object.fromEntries(Object.entries(data).map(([id, v]) => [id,
        { durum: v?.durum === 'geldi' && v?.gecGeldi === true ? 'gec' : v?.durum || '', kayitZamani: v?.kayitZamani || '' }]));
      state.yoklamaDurum = 'hazir';
    }, () => { state.yoklama = {}; state.yoklamaDurum = 'hata'; emit(); });
    listen(fb.query(fb.collection(db, 'veliIzinleri'), fb.where('durum', '==', 'onayli')), snap => {
      const ids = new Set();
      snap.forEach(doc => {
        const v = doc.data() || {};
        if (v.durum === 'onayli' && v.ogrenciId && v.baslangic <= tarih && (v.bitis || v.baslangic) >= tarih) ids.add(v.ogrenciId);
      });
      state.izinliler = ids;
      state.izinDurum = 'hazir';
    }, () => { state.izinliler = new Set(); state.izinDurum = 'hata'; emit(); });
  }
  return stop;
}
