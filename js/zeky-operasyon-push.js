// Portal -> ZEKY native push köprüsü.
// Operasyon isteğinde alıcı/personel e-postası gönderilmez. Sunucu kayıt kimliğini
// Firestore'dan doğrular, hedef rolleri/sınıfı çözer ve tekrarları önler.
const PUSH_PROXY = 'https://script.google.com/macros/s/AKfycby0oVMIP9LVl-rYbmnOpmL2Sa_2kmnVDgOP_wdGCBIqrtmJSSxOcNfaw3U5c6N8vuVr/exec';

// Eski sunucunun üst düzey ok/gonderilen alanları yalnız isteğin işlendiğini ve
// denenen token sayısını bildiriyordu. FCM kabulü ancak token sonuçlarıyla bilinir.
// ok=true bütün bildirilen tokenların FCM tarafından kabul edildiğini ifade eder;
// telefonun bildirimi aldığı, gösterdiği veya ses çaldığı anlamına GELMEZ.
export function pushSonucunuDogrula(yanit, { httpOk = true, status = 200, yanitHatasi = '' } = {}) {
  const veri = yanit && typeof yanit === 'object' && !Array.isArray(yanit) ? yanit : null;
  const sonuclar = Array.isArray(veri?.sonuclar) ? veri.sonuclar : null;
  const gonderilen = sonuclar?.filter(s => s?.ok === true).length || 0;
  const basarisiz = sonuclar ? sonuclar.filter(s => s?.ok === false).length : null;
  const belirsiz = sonuclar ? sonuclar.length - gonderilen - basarisiz : null;
  // Yeni sunucu sözleşmesi istek kabulünü FCM sonucundan ayrı bildirebilir.
  const kabul = typeof veri?.istekKabulEdildi === 'boolean' ? veri.istekKabulEdildi : veri?.ok === true;
  const istekKabulEdildi = httpOk && kabul;
  const ok = istekKabulEdildi && veri?.ok === true && !!sonuclar?.length && gonderilen === sonuclar.length;
  const sunucuHatasi = typeof veri?.hata === 'string' ? veri.hata : '';
  const tokenHatasi = sonuclar?.find(s => s?.ok === false && typeof s.hata === 'string')?.hata;
  let hata = '';
  if (!httpOk) hata = sunucuHatasi || ('push-http-' + status);
  else if (!veri) hata = yanitHatasi || 'push-yanit-gecersiz';
  else if (veri.ok === false) hata = sunucuHatasi || 'push-istek-reddedildi';
  else if (veri.ok !== true) hata = 'push-yanit-gecersiz';
  else if (!sonuclar) hata = 'push-fcm-sonucu-yok';
  else if (!sonuclar.length) hata = sunucuHatasi || 'push-fcm-gonderim-yok';
  else if (!ok) hata = gonderilen > 0 ? 'push-kismi-basarisizlik'
    : tokenHatasi || (belirsiz > 0 ? 'push-fcm-sonucu-gecersiz' : 'push-fcm-basarisiz');

  return {
    ...(veri || {}),
    ok,
    istekKabulEdildi,
    // Bunlar alıcı/telefon sayısı değil, doğrulanmış token sonuçlarının sayılarıdır.
    gonderilen,
    denenen: sonuclar ? sonuclar.length : null,
    basarisiz,
    belirsiz,
    durum: ok ? 'fcm-kabul-edildi' : gonderilen > 0 ? 'kismi'
      : istekKabulEdildi && !sonuclar ? 'kabul-edildi'
      : basarisiz > 0 || veri?.ok === false || !httpOk ? 'basarisiz' : 'dogrulanamadi',
    hata
  };
}

async function pushIstegiGonder(veri) {
  try {
    const r = await fetch(PUSH_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(veri)
    });
    const metin = await r.text();
    let yanit = null;
    let yanitHatasi = 'push-bos-yanit';
    if (metin.trim()) {
      try { yanit = JSON.parse(metin); yanitHatasi = 'push-yanit-gecersiz'; }
      catch (_) { yanitHatasi = 'push-json-olmayan-yanit'; }
    }
    return pushSonucunuDogrula(yanit, { httpOk: r.ok, status: r.status, yanitHatasi });
  } catch (e) {
    // Otomatik yeniden deneme yok: bağlantı kesilmeden önce FCM kabul etmiş olabilir.
    return pushSonucunuDogrula({ ok: false, hata: String(e?.message || e || 'push-ag-hatasi') });
  }
}

// Ayrıntılı sonuç isteyen yeni çağıranlar bu işlevi kullanabilir.
export async function operasyonPushGonder(olay, kayitId) {
  if (!olay || !kayitId) return pushSonucunuDogrula({ ok: false, hata: 'olay-veya-kayit-yok' });
  const sonuc = await pushIstegiGonder({ olay: String(olay), kayitId: String(kayitId) });
  if (!sonuc.ok) console.warn('ZEKY operasyon push FCM kabulü doğrulanamadı:', olay, sonuc.hata);
  return sonuc;
}

// Mevcut boolean API korunur; HTTP 200 tek başına artık başarı sayılmaz.
export async function operasyonPushTetikle(olay, kayitId) {
  return (await operasyonPushGonder(olay, kayitId)).ok;
}

export async function genelPushGonder(aliciEmailler, { baslik, metin = '', hedefSayfa = '', tip = 'genel' } = {}) {
  const emailler = [...new Set((aliciEmailler || [])
    .map(e => String(e || '').trim().toLowerCase())
    .filter(Boolean))];
  if (!emailler.length) return pushSonucunuDogrula({ ok: false, hata: 'alici-yok' });
  const sonuc = await pushIstegiGonder({
    aliciEmailler: emailler,
    baslik: String(baslik || 'ZEKY'),
    metin: String(metin || ''),
    hedefSayfa: String(hedefSayfa || 'bildirimler.html'),
    tip: String(tip || 'genel')
  });
  if (!sonuc.ok) console.warn('ZEKY genel push FCM kabulü doğrulanamadı:', sonuc.hata);
  return sonuc;
}
