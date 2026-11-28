// No production endpoint is enabled until its server-side authorization is reviewed.
const STAGING_PROJECT = 'bcka-site-staging';
const STAGING_ENDPOINT = 'https://europe-west3-bcka-site-staging.cloudfunctions.net/ozlukBelgeStagingV1';
export function personelBelgeServisi(auth, request = fetch) {
  async function call(action, body) {
    if (auth?.app?.options?.projectId !== STAGING_PROJECT) {
      throw new Error('Güvenli belge servisi bu ortamda henüz etkin değil. Talep gönderilmedi.');
    }
    const user = auth.currentUser;
    if (!user) throw new Error('Belgeye erişmek için yeniden giriş yapın.');
    const token = await user.getIdToken();
    const res = await request(`${STAGING_ENDPOINT}/${action}`, {
      method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify(body), cache: 'no-store', credentials: 'omit', redirect: 'error',
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Güvenli belge işlemi tamamlanamadı.');
    }
    // Do not expose bytes after logout/account switch during an in-flight request.
    if (auth.currentUser?.uid !== user.uid) throw new Error('Oturum değişti; belge işlemini yeniden başlatın.');
    return res;
  }
  return {
    async upload(file) {
      if (!file || !['application/pdf','image/png','image/jpeg'].includes(file.type) || !file.size || file.size > 5*1024*1024) {
        throw new Error('En fazla 5 MB boyutunda PDF, PNG veya JPEG seçin.');
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw = '';
      for (let i=0; i<bytes.length; i+=8192) raw += String.fromCharCode(...bytes.subarray(i,i+8192));
      const res = await call('upload', {base64: btoa(raw), type: file.type});
      return res.json();
    },
    async read(id) {
      if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new Error('Belge kimliği geçersiz.');
      const expectedUid = auth.currentUser?.uid;
      const res = await call('read', {belgeId: id});
      const blob = await res.blob();
      if (auth.currentUser?.uid !== expectedUid) throw new Error('Oturum değişti; belge işlemini yeniden başlatın.');
      if (!['application/pdf','image/png','image/jpeg'].includes(blob.type)) throw new Error('Belge türü geçersiz.');
      return blob;
    }
  };
}

export async function personelBelgeAc(auth, id) {
  const blob = await personelBelgeServisi(auth).read(id);
  const url = URL.createObjectURL(blob);
  const dialog = document.createElement('dialog');
  const title = document.createElement('p'); title.textContent = 'Özel belge · İşiniz bitince kapatın.';
  const close = document.createElement('button'); close.textContent = 'Belgeyi kapat';
  const link = document.createElement('a'); link.href = url; link.textContent = 'Belgeyi cihazda aç / indir';
  link.download = 'ozel-belge'; link.style.display = 'block';
  dialog.style.cssText = 'width:min(90vw,600px);max-height:80vh;padding:20px;border:1px solid #d8e0dd;border-radius:16px;';
  dialog.append(title, link, close);
  if (blob.type.startsWith('image/')) {
    const img = document.createElement('img'); img.src = url; img.alt = 'Özel belge'; img.style.cssText = 'max-width:100%;max-height:60vh'; dialog.append(img);
  }
  let timer, sessionTimer;
  const viewerUid = auth.currentUser?.uid;
  const hide = () => { if (document.hidden) dialog.close(); };
  function cleanup() { clearTimeout(timer); clearInterval(sessionTimer); document.removeEventListener('visibilitychange', hide); URL.revokeObjectURL(url); dialog.remove(); window.removeEventListener('pagehide', cleanup); }
  close.onclick = () => dialog.close(); dialog.onclose = cleanup;
  window.addEventListener('pagehide', cleanup, {once:true});
  document.body.append(dialog); dialog.showModal(); timer = setTimeout(() => dialog.close(), 120000);
  sessionTimer = setInterval(() => {if (auth.currentUser?.uid !== viewerUid) dialog.close();}, 500);
  document.addEventListener('visibilitychange', hide);
}

export function personelBelgeButonu(record) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record?.belgeId || '')) {
    return `<button type="button" data-personel-belge="${record.belgeId}">Belgeyi güvenli aç</button>`;
  }
  return record?.belgeUrl ? '<span role="note">Eski belge için güvenli erişim geçişi bekleniyor.</span>' : '';
}
export function personelBelgeTiklamalariniBagla(auth, onError) {
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-personel-belge]');
    if (!button || button.disabled) return;
    button.disabled = true;
    try { await personelBelgeAc(auth, button.dataset.personelBelge); }
    catch (e) { onError(e.message); }
    finally { button.disabled = false; }
  });
}
