// Observation persistence and notification delivery are separate outcomes.
export function onayBildirimMesaji(result) {
  if (!result) return '';
  if (result.recipientLookupFailed) return 'Gözlem ve fotoğraf kayıtlı. Yönetici alıcı listesi okunamadı; bildirim eksik kalmış olabilir.';
  if (result.ok !== true) return 'Gözlem ve fotoğraf kayıtlı. Yönetici bildirim kaydı tamamlanamadı. Gözlemi tekrar kaydetmeyin.';
  if (result.push?.ok === false) return 'Gözlem ve fotoğraf kayıtlı; yönetici onay kuyruğunda. Telefon bildirimi doğrulanamadı. Aynı bildirim otomatik tekrar gönderilmez.';
  return '';
}
export function onayBildirimUyarisi(result, { retry, active, host = document.body } = {}) {
  const message = onayBildirimMesaji(result);
  if (!message) return;
  const box = document.createElement('aside');
  box.className = 'egitim-onay-uyari';box.setAttribute('role','status');
  box.style.cssText='position:fixed;bottom:max(12px,env(safe-area-inset-bottom));left:12px;right:12px;z-index:9800;padding:12px;background:#fff5d8;color:#5b4710;border:1px solid #d9c984;border-radius:12px;font-size:13px;box-shadow:0 4px 20px #0002';
  const text=document.createElement('span');text.textContent=message;box.append(text);
  if(result.ok!==true && retry){
    const button=document.createElement('button');button.type='button';button.style.cssText='min-height:44px;margin:4px;padding:8px';button.textContent='Yalnız bildirimi yeniden dene';box.append(button);
    button.onclick=async()=>{
      if(active && !active()){text.textContent='Oturum değişti. Bu işlem yeniden denenmedi.';button.disabled=true;return;}
      button.disabled=true;
      try{const next=await retry();text.textContent=onayBildirimMesaji(next)||'Yönetici bildirim kaydı tamamlandı.';button.disabled=next.ok===true;}
      catch(_){text.textContent='Bildirim yeniden denenemedi. Gözlem ve fotoğraf kayıtlı.';button.disabled=false;}
    };
  }
  const close=document.createElement('button');close.type='button';close.style.cssText='min-height:44px;margin:4px;padding:8px';close.textContent='Kapat';close.onclick=()=>box.remove();box.append(close);host.append(box);
}
