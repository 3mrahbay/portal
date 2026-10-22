// Existing school endpoints. No client recipient, subject or HTML parameters.
const MAIL = "https://script.google.com/macros/s/AKfycbwUNvVhTCvxUKOMtbFJ4_UASBo8-sgT13qT_9tWeYKZR3IYaYKUhGdSaGgGaaqMaZLf/exec";
const PUSH = "https://script.google.com/macros/s/AKfycby0oVMIP9LVl-rYbmnOpmL2Sa_2kmnVDgOP_wdGCBIqrtmJSSxOcNfaw3U5c6N8vuVr/exec";
export async function membershipEffects(user, uid, phase, send = globalThis.fetch) {
  const idToken = await user.getIdToken();
  async function post(url, body) {
    const response = await send(url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...body,idToken})});
    if (!response.ok) throw Error("Sunucu yanıtı alınamadı");
    return response.json();
  }
  const jobs = [post(MAIL,{action:"kitapKulubuUyelik",uid,phase})];
  if (phase === "pending") jobs.push(post(PUSH,{olay:"kitap-kulubu-talep",kayitId:uid}));
  const results = await Promise.allSettled(jobs);
  if (results.some((r,i) => r.status !== "fulfilled" || (i === 0 ? r.value.success !== true : r.value.kalici !== true && r.value.durum !== "legacy-skipped"))) {
    throw Error(phase === "prepare" ? "Onay öncesi e-posta hazırlığı doğrulanamadı. Üyenin bildirimleri yeniden denemesi gerekebilir; üyelik değiştirilmedi." : phase === "pending" ? "Talebiniz kaydedildi; yönetici bildirimi veya e-posta hazırlığı doğrulanamadı. Bildirimleri yeniden deneyebilirsiniz." : "Üyelik onaylandı; hoş geldiniz e-postası doğrulanamadı. Gönderim durumunu yeniden kontrol edebilirsiniz.");
  }
  return results.map(r=>r.value);
}
