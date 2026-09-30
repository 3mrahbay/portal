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


export async function genelPushGonder(aliciEmailler, { baslik, metin = '', hedefSayfa = '', tip = 'genel' } = {}) {
  const emailler = [...new Set((aliciEmailler || [])
    .map(e => String(e || '').trim().toLowerCase())
    .filter(Boolean))];
  if (!emailler.length) return { ok:false, hata:'alici-yok' };
  try {
    const r = await fetch(PUSH_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        aliciEmailler: emailler,
        baslik: String(baslik || 'ZEKY'),
        metin: String(metin || ''),
        hedefSayfa: String(hedefSayfa || 'bildirimler.html'),
        tip: String(tip || 'genel')
      })
    });
    let sonuc = null;
    try {
      const t = await r.text();
      if (t) sonuc = JSON.parse(t);
    } catch (_) {}
    if (!r.ok || sonuc?.ok === false) {
      throw new Error(sonuc?.hata || ('push-http-' + r.status));
    }
    return sonuc || { ok:true };
  } catch (e) {
    console.warn('ZEKY genel push gönderilemedi:', e?.message || e);
    return { ok:false, hata:String(e?.message || e) };
  }
}
