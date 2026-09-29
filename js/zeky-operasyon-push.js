// Portal -> ZEKY native push köprüsü.
// Alıcı/personel e-postası gönderilmez. Sunucu kayıt kimliğini Firestore'dan
// doğrular, hedef rolleri/sınıfı kendisi çözer ve tekil olay kaydıyla tekrarları önler.
const PUSH_PROXY = 'https://script.google.com/macros/s/AKfycby0oVMIP9LVl-rYbmnOpmL2Sa_2kmnVDgOP_wdGCBIqrtmJSSxOcNfaw3U5c6N8vuVr/exec';

export async function operasyonPushTetikle(olay, kayitId) {
  if (!olay || !kayitId) return false;
  try {
    const r = await fetch(PUSH_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ olay: String(olay), kayitId: String(kayitId) })
    });
    return r.ok;
  } catch (e) {
    console.warn('ZEKY operasyon push tetiklenemedi:', olay, e);
    return false;
  }
}
