// Read-only inbox. Contact data stays in memory and is cleared on auth change.
let sequence = 0;
let currentRoot = null;
export function clearKayitDuyurulari() {
  sequence++;
  currentRoot?.replaceChildren();
  currentRoot = null;
}
export async function loadKayitDuyurulari({root, getUid, allowed, list}) {
  const ticket = ++sequence;
  currentRoot = root;
  root.replaceChildren();
  const uid = getUid();
  if (!uid || !allowed()) return;
  const el = (tag, text) => { const node = document.createElement(tag); node.textContent = text; return node; };
  const heading = el('h3','Kayıt duyurusu talepleri');
  const info = el('p','Tarih duyurusu için e-posta bırakan kişiler. Bu talepler öğrenci başvurusu değildir.');
  const controls = el('div',''); controls.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin:12px 0';
  const source = document.createElement('select'); source.setAttribute('aria-label','Bildirim kaynağı');
  for (const [value,text] of [['yenikayit','Yeni kayıt'],['kayityenileme','Kayıt yenileme']]) {
    const option=el('option',text); option.value=value; source.append(option);
  }
  const refresh=el('button','Yenile'); refresh.className='btn-mini'; refresh.type='button';
  const status=el('p',''); status.setAttribute('role','status');
  const rows=el('div',''); rows.style.cssText='display:grid;gap:8px;overflow-wrap:anywhere';
  const more=el('button','Sonraki sayfa'); more.className='btn-mini'; more.type='button'; more.hidden=true;
  controls.append(source,refresh); root.append(heading,info,controls,status,rows,more);
  let offset=0, next=null, requestNumber=0;
  const valid = () => sequence===ticket && getUid()===uid && allowed();
  async function read(reset=true) {
    if (!valid()) { clearKayitDuyurulari(); return; }
    const requestId=++requestNumber;
    if(reset) offset=0;
    source.disabled=true;refresh.disabled=true;more.hidden=true;rows.replaceChildren();status.textContent='Bildirim talepleri yükleniyor…';
    try {
      const data=await list({source:source.value,offset});
      if(!valid() || requestNumber!==requestId) return;
      for(const item of data.items) {
        const row=el('div','');row.style.cssText='padding:12px;border:1px solid #dce2d8;border-radius:10px';
        row.append(el('strong',item.email));
        const date=item.updatedAt ? new Date(item.updatedAt).toLocaleString('tr-TR') : '—';
        row.append(el('div',`${item.source==='yenikayit'?'Yeni kayıt':'Kayıt yenileme'} · Güncelleme: ${date}`));
        rows.append(row);
      }
      next=data.nextOffset;more.hidden=next===null;
      status.textContent=data.items.length ? `${data.items.length} talep gösteriliyor. Brevo’dan alınan son bildirimler gösteriliyor.` : 'Bu sayfada etkin bildirim talebi yok.';
    } catch {
      if(valid()) status.textContent='Bildirim listesi alınamadı. Bağlantı ve erişim yetkisini kontrol ederek yeniden deneyin.';
    } finally { if(valid()) {source.disabled=false;refresh.disabled=false;} }
  }
  source.addEventListener('change',()=>read());refresh.addEventListener('click',()=>read());
  more.addEventListener('click',()=>{offset=next;read(false);});
  await read();
}
