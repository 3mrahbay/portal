const MAIL='https://script.google.com/macros/s/AKfycbwUNvVhTCvxUKOMtbFJ4_UASBo8-sgT13qT_9tWeYKZR3IYaYKUhGdSaGgGaaqMaZLf/exec';
const unavailable='E-posta durum servisi henüz kullanılamıyor. Üyelik değiştirilmedi; bu kontrol e-posta göndermez.';
export async function readWelcomeStatus(user,uid,send=globalThis.fetch) {
  try {
    const response=await send(MAIL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'kitapKulubuDurum',uid,idToken:await user.getIdToken()})});
    if(!response.ok)throw Error(unavailable);
    const data=await response.json();if(data.success!==true)throw Error(unavailable);
    return data;
  } catch {throw Error(unavailable);}
}
export function welcomeStatusText(data={}) {
  const labels={
    inactive:'Otomatik karşılama servisi henüz etkin değil. Gönderim kanıtı bulunmuyor.',
    legacy_excluded:'Bu üyelik otomatik karşılama başlangıcından önce oluşturulmuş. Geriye dönük e-posta gönderilmeyecek.',
    awaiting_scan:'Üyelik onaylı; henüz kalıcı gönderim kuyruğu kaydı bulunmuyor.',
    waiting_approval:'Üyelik onayı bekleniyor. E-posta gönderim kaydı yok.',
    blocked:'Üyelik kapalı. E-posta gönderim kaydı yok.',
    queued:'E-posta kalıcı kuyrukta; sağlayıcı kabulü henüz doğrulanmadı.',
    retry:'E-posta kalıcı kuyrukta yeniden denenecek; sağlayıcı kabulü henüz doğrulanmadı.',
    sending:'Gönderim denemesi sürüyor veya sonucu henüz kesinleşmedi.',
    waiting_address:'Bu adres için önceki gönderim işleminin sonucu bekleniyor.',
    accepted:'E-posta sağlayıcısı gönderimi kabul etmiş. Teslim edildiği doğrulanmadı.',
    duplicate:'Bu adres için önceki karşılama sağlayıcı tarafından kabul edilmiş; tekrar gönderilmedi. Teslim edildiği doğrulanmadı.',
    needs_review:'Önceki gönderimin sonucu belirsiz; inceleme gerekiyor. Mükerrer olmaması için yeniden gönderilmedi.',
    cancelled:'Kuyruktaki gönderim güncel üyelik durumuna göre iptal edilmiş.'
  };
  let text=labels[data.state] || 'E-posta durumu doğrulanamadı.';
  if(data.providerAccepted===true && !['accepted','duplicate'].includes(data.state))text+=' Sağlayıcı kabul kaydı var; teslim kanıtı yok.';
  if(data.recordCreatedAt && Number.isFinite(Date.parse(data.recordCreatedAt)))text+='\nSunucu kayıt oluşturma zamanı: '+new Date(data.recordCreatedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'});
  return text+'\nBu kontrol üyeliği değiştirmez ve e-posta göndermez.';
}
