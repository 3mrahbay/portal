// Read-only, user-triggered diagnostics. Never writes school records or logs tokens.
export const SURUM = 'OKUL-ZILI-TANI-1';
const email = v => typeof v === 'string' ? v.trim().toLowerCase() : '';
const guvenliId = v => typeof v === 'string' && v.length > 0 && v.length <= 512 && !v.includes('/');
const kod = e => /^[a-z0-9/-]{1,80}$/.test(e?.code || '') ? e.code : 'unknown';
const sinirla = (promise, ms) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject({ code: 'diagnostic/timeout' }), ms);
  Promise.resolve(promise).then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
});

export async function tanila(api, readServer, { handler = '', timeoutMs = 8000 } = {}) {
  const state = api?.state || {};
  const user = api?.auth?.currentUser;
  const child = state.veliAktifOgrenci || state.veliOgrenciler?.[0];
  const r = {
    surum: SURUM, proje: String(api?.app?.options?.projectId || 'unknown'),
    veritabani: String(api?.db?._databaseId?.database || 'unknown'),
    islem: 'salt-okunur', firebaseOturumuVar: !!user,
    portalOturumuAyni: !!user && state.currentUser?.uid === user.uid,
    ogrenciSecili: !!child,
    calisanGonderici: handler.includes('Gönderilemedi — ana çıkış kaydı:') ? 'module-v140'
      : handler.includes('writeBatch') ? 'batch-handler' : 'other-handler',
    kontroller: {}
  };
  if (!user || !child || !guvenliId(child.id) || !guvenliId(user.uid)) return r;
  const uid = user.uid;
  const alive = () => api.auth?.currentUser?.uid === uid &&
    (api.state?.veliAktifOgrenci || api.state?.veliOgrenciler?.[0])?.id === child.id;
  const checkAlive = () => { if (!alive()) throw { code: 'diagnostic/session-changed' }; };
  async function oku(label, collection, id) {
    checkAlive();
    if (!guvenliId(id)) { r.kontroller[label] = 'invalid-id'; return null; }
    try {
      const snap = await sinirla(readServer(api.fb.doc(api.db, collection, id)), timeoutMs);
      checkAlive();
      r.kontroller[label] = snap.exists() ? 'ok' : 'missing';
      return snap.exists() ? { id: snap.id, data: snap.data() } : null;
    } catch (e) {
      checkAlive();
      r.kontroller[label] = kod(e);
      return null;
    }
  }
  try {
    const t = await sinirla(user.getIdTokenResult(), timeoutMs);
    checkAlive();
    r.tokenEpostaDogrulanmis = t.claims?.email_verified === true;
    r.tokenProjesiEslesiyor = t.claims?.aud === api.app?.options?.projectId;
    r.kontroller.token = 'ok';
  } catch (e) { checkAlive(); r.kontroller.token = kod(e); }
  const [identity, settings] = await Promise.all([
    oku('kimlik', 'kullaniciKimlikleri', uid), oku('genelOkuma', 'ayarlar', 'donem')
  ]);
  const i = identity?.data || {};
  const nested = i.profiles?.veli || {};
  r.kimlikProfili = !identity ? 'missing-or-unreadable'
    : ['veli', 'personel'].includes(i.primaryProfile) ? i.primaryProfile : 'other';
  r.kimlikPasif = identity ? i.aktif === false || nested.aktif === false : null;
  r.donemEslesiyor = settings ? settings.data.aktif === state.aktifDonem : null;
  const authEmail = email(user.email);
  const flat = email(i.refEmail), legacy = email(nested.refEmail);
  const conflict = !!flat && !!legacy && flat !== legacy;
  r.kimlikEpostaCeliskisi = conflict;
  // Only inspect the mapped parent profile if it is active and unambiguous.
  const profileEmail = identity && i.primaryProfile === 'veli' && !r.kimlikPasif && !conflict
    ? flat || legacy : '';
  const [authParent, profileParent] = await Promise.all([
    oku('veliAuthKaydi', 'veliler', authEmail),
    profileEmail && profileEmail !== authEmail ? oku('veliProfilKaydi', 'veliler', profileEmail) : null
  ]);
  const ids = [...new Set([authParent, profileParent].flatMap(x =>
    Array.isArray(x?.data?.ogrenciIds) ? x.data.ogrenciIds.filter(guvenliId) : []))];
  r.onayliVeliKaydi = [authParent, profileParent].some(x => x?.data?.onaylandi === true);
  r.seciliKimlikVeliListesinde = ids.includes(child.id);
  r.bagliOgrenciSayisi = ids.length;
  const local = new Date();
  const date = [local.getFullYear(), String(local.getMonth()+1).padStart(2,'0'), String(local.getDate()).padStart(2,'0')].join('-');
  const recordId = child.id + '__' + date;
  const [student, pickup, queue, projection] = await Promise.all([
    oku('ogrenci', 'ogrenciler', child.id),
    oku('anaCikisOkuma', 'pickupBildirimleri', recordId),
    oku('siraOkuma', 'pickupKuyruk', date),
    oku('danismaOzetiOkuma', 'danismaPickupBildirimleri', recordId)
  ]);
  r.anaCikisOgrenciEslesiyor = pickup ? (pickup.data.ogrenciId || pickup.data.cocukId || '') === child.id : null;
  r.siradaKayitVar = queue ? Object.hasOwn(queue.data.ogrenciler || {}, child.id) : null;
  r.belgedekiIdFarkli = student && Object.hasOwn(student.data, 'id') ? student.data.id !== student.id : null;
  // Do not scan the school. Inspect at most eight IDs from this parent's authorized list.
  const candidates = [];
  const toRead = ids.filter(id => id !== child.id).slice(0,8);
  for (let offset=0; offset<toRead.length; offset+=2) {
    candidates.push(...await Promise.all(toRead.slice(offset,offset+2).map((id,j) =>
      oku('bagliOgrenci' + (offset+j+1), 'ogrenciler', id))));
  }
  r.idAlaniKaynakKimligiEzmis = candidates.some(x => x && x.id !== child.id && x.data.id === child.id);
  r.bagliOgrenciKontroluSinirli = ids.filter(id => id !== child.id).length > 8;
  checkAlive();
  return r;
}

export async function ac(api = window.PortalAPI, readServer = null) {
  if (!api?.auth?.currentUser || !(api.state.veliAktifOgrenci || api.state.veliOgrenciler?.[0])) {
    api?.toast?.('Önce veli hesabıyla giriş yapıp öğrenciyi seçin.', 'error'); return;
  }
  document.getElementById('okulZiliTaniPanel')?.remove();
  const overlay = document.createElement('div'); overlay.id = 'okulZiliTaniPanel';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:14px;';
  const panel = document.createElement('section');
  panel.style.cssText = 'box-sizing:border-box;background:white;color:#172033;border-radius:16px;padding:20px;width:100%;max-width:650px;max-height:88vh;overflow:auto;font-family:system-ui;';
  panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-label','Okul Zili tanı kontrolü');
  const title = document.createElement('h2'); title.textContent = 'Okul Zili tanı kontrolü';
  title.style.margin = '0 0 10px';
  const note = document.createElement('p');
  note.textContent = 'Bu kontrol bildirim göndermez; öğrenci verilerini ve güvenlik kurallarını değiştirmez. Raporda e-posta, öğrenci adı veya giriş anahtarı bulunmaz.';
  const output = document.createElement('pre'); output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;background:#f1f5f9;padding:14px;border-radius:8px;';
  output.textContent = 'Sunucu erişimleri kontrol ediliyor…';
  const copy = document.createElement('button'); copy.textContent = 'Tanı raporunu kopyala'; copy.disabled = true;
  const close = document.createElement('button'); close.textContent = 'Kapat';
  for (const button of [copy,close]) { button.type = 'button'; button.style.cssText = 'padding:12px 16px;margin:8px 8px 0 0;cursor:pointer;font:inherit;border:1px solid #94a3b8;border-radius:8px;background:#f8fafc;'; }
  const previous = document.activeElement;
  const dispose = () => { overlay.remove(); document.removeEventListener('keydown', keydown); previous?.focus?.(); };
  const keydown = e => {
    if (e.key === 'Escape') dispose();
    if (e.key === 'Tab') { const buttons = [copy,close].filter(x => !x.disabled); if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === buttons.at(-1)) {e.preventDefault();buttons[0].focus();} }
  };
  close.onclick = dispose; document.addEventListener('keydown', keydown);
  panel.append(title,note,output,copy,close); overlay.append(panel); document.body.append(overlay); close.focus();
  try {
    const read = readServer || (await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')).getDocFromServer;
    const report = await tanila(api, read, {handler: String(window.veliOkulZiliBildir || '')});
    if (!overlay.isConnected) return;
    const toast = document.getElementById('toast')?.textContent || '';
    report.sonGorunenHata = /Gönderilemedi|permissions/i.test(toast)
      ? /ana çıkış kaydı/i.test(toast) ? 'ana-cikis-permission-denied' : 'genel-gonderim-hatasi'
      : 'none-observed';
    output.textContent = JSON.stringify(report,null,2); copy.disabled = false;
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(output.textContent); copy.textContent = 'Kopyalandı'; }
      catch (_) { const range=document.createRange(); range.selectNodeContents(output); const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range); copy.textContent='Metin seçildi; kopyalayabilirsiniz'; }
    };
  } catch (e) { if (overlay.isConnected) output.textContent = SURUM + '\nKontrol tamamlanamadı: ' + kod(e); }
}
