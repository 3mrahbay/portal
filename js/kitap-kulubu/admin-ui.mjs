import { welcomeStatusText } from './mail-status.mjs';
import { escapeHTML as esc, dateLabel } from './core.mjs';
import { memberLabels, timestampLabel, requestLabel, summary, localDate, bookData } from './admin-core.mjs';

export async function mountManagement(root, store) {
  let alive = true, busy = false, data = null, tab = 'requests', filter = 'all', bookFilter = '', shown = 20;
  let editId = null, draftId = null;
  const controller = new AbortController();
  const stop = () => {
    alive = false;
    controller.abort();
    root.removeEventListener('click', click);
    root.removeEventListener('change', change);
    root.removeEventListener('submit', submit);
    data = null;
    root.replaceChildren();
  };
  const error = (e) => {
    if (!alive) return;
    root.querySelector('[data-error]').textContent = e.code === 'permission-denied'
      ? 'Erişiminiz değişmiş olabilir. Sayfayı yenileyip hesabınızı kontrol edin.'
      : e.message || 'İşlem tamamlanamadı. Yeniden deneyin.';
  };
  let access;
  try { access = await store.identity(); }
  catch { root.textContent = 'Yönetim alanı yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.'; return stop; }
  if (!access.manage) {
    root.innerHTML = '<section class="kc-state"><h1>Kitap Kulübü Yönetimi</h1><p>Bu alan yalnız kurucu müdür, müdür ve PDR hesaplarına açıktır.</p><a href="index.html">Portala dön</a></section>';
    return stop;
  }
  root.innerHTML = `<header class="kc-heading"><p class="bk-eyebrow">OKUL YÖNETİMİ · PDR</p><h1>Kitap Kulübü Yönetimi</h1><p>Katılımları, paylaşımları ve buluşmaları tek yerden yönetin.</p></header>
    <div class="kc-admin-toolbar"><a href="kitap-kulubu.html">← Kulüp alanı</a><button data-refresh>Verileri yenile</button></div>
    <p role="alert" data-error class="kc-error"></p><p role="status" data-status></p>
    <div data-summary class="kc-summary"></div><p class="kc-muted">Toplam paylaşım, kaldırılmamış paylaşımlardır. Sayılar son yenilemede okunan kayıtlara aittir.</p>
    <nav class="kc-tabs kc-admin-tabs" aria-label="Kulüp yönetimi">${[['requests','Katılım Talepleri'],['members','Üyeler'],['posts','Paylaşımlar'],['books','Kitaplar & Buluşmalar']].map(([id,label]) => `<button data-section="${id}" aria-pressed="${id === tab}">${label}</button>`).join('')}</nav>
    <section data-content></section>`;
  const content = () => root.querySelector('[data-content]');
  function render() {
    if (!alive || !data) return;
    root.querySelector('[data-summary]').innerHTML = summary(data).map(([label,n]) => `<article class="kc-summary-card"><strong>${n}</strong><span>${label}</span></article>`).join('');
    root.querySelectorAll('[data-section]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.section === tab)));
    if (tab === 'requests' || tab === 'members') {
      const rows = data.members.filter(m => filter === 'all' || m.status === filter);
      content().innerHTML = `<h2>${tab === 'requests' ? 'Katılım Talepleri' : 'Üyeler'}</h2><label>Üyelik durumu<select data-member-filter>${[['all','Tüm durumlar'],...Object.entries(memberLabels)].map(([v,l]) => `<option value="${v}" ${v===filter?'selected':''}>${l}</option>`).join('')}</select></label><p class="kc-muted">Eski kayıtlarda ayrı talep zamanı tutulmamıştır; son güncelleme talep tarihi yerine kullanılmaz. E-posta durum kontrolü, varsa sunucu kayıt oluşturma zamanını ayrıca gösterir.</p>${rows.slice(0,shown).map(m => `<article class="kc-post"><h3>${esc(m.name)}</h3><p><span class="kc-badge">${esc(memberLabels[m.status] || 'Bilinmeyen durum')}</span></p><p>Talep zamanı: ${esc(requestLabel(m))}<br>Son güncelleme: ${esc(timestampLabel(m.updatedAt))}</p><div class="kc-actions">${m.status!=='approved'?`<button data-member="${esc(m.id)}" data-status="approved">Onayla</button>`:`<button data-mail-status="${esc(m.id)}">Hoş geldiniz durumunu kontrol et</button>`}${m.status!=='blocked'?`<button data-member="${esc(m.id)}" data-status="blocked">Paylaşımı kapat</button>`:''}</div><p data-mail-result="${esc(m.id)}" role="status" style="white-space:pre-line"></p></article>`).join('') || '<p class="kc-empty">Bu durumda bir katılım kaydı yok.</p>'}${more(rows)}`;
    } else if (tab === 'posts') {
      const rows = data.posts.filter(p => !bookFilter || p.bookId === bookFilter);
      content().innerHTML = `<h2>Paylaşımlar</h2><label>Kitap / buluşma<select data-book-filter><option value="">Tüm kitaplar ve buluşmalar</option>${data.books.map(b => `<option value="${esc(b.id)}" ${bookFilter===b.id?'selected':''}>${esc(b.title)} · ${esc(dateLabel(b.date))}</option>`).join('')}</select></label>${rows.slice(0,shown).map(p => `<article class="kc-post"><p class="kc-muted">${esc(data.books.find(b=>b.id===p.bookId)?.title)}</p><div class="kc-post-head"><strong>${esc(p.authorName)}</strong><time>${esc(timestampLabel(p.createdAt))}</time></div>${p.deleted?'<p class="kc-muted">Bu paylaşım kaldırıldı.</p>':`<p class="kc-text">${esc(p.text)}</p>${/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.image || '')?`<img src="${p.image}" alt="${esc(p.authorName)} tarafından paylaşılan fotoğraf" loading="lazy">`:''}<button data-remove="${esc(p.id)}" data-book="${esc(p.bookId)}">Paylaşımı kaldır</button>`}</article>`).join('') || '<p class="kc-empty">Bu seçime ait paylaşım yok.</p>'}${more(rows)}`;
    } else {
      content().innerHTML = `<h2>Kitaplar & Buluşmalar</h2><button data-new>Yeni okuma ekle</button><div data-editor></div>${['active','archived'].map(status => `<h3>${status==='active'?'Aktif okumalar':'Geçmiş okumalar'}</h3>${data.books.filter(b=>b.status===status).map(b => `<article class="kc-post"><h3>${esc(b.title)}</h3><p>${esc(b.authors)}</p><p>${esc(dateLabel(b.date))}<br>${esc(b.leader)}<br>${esc(b.place)}</p><p class="kc-text">${esc(b.purpose)}</p><div class="kc-actions"><button data-edit="${esc(b.id)}">Düzenle</button><button data-archive="${esc(b.id)}" data-status="${status==='active'?'archived':'active'}">${status==='active'?'Arşive al':'Yeniden aç'}</button></div></article>`).join('') || '<p class="kc-empty">Bu bölümde okuma yok.</p>'}`).join('')}`;
    }
  }
  function more(rows) { return rows.length > shown ? '<button data-more>Daha fazla göster</button>' : ''; }
  function lock(value) {
    busy = value;
    root.querySelectorAll('button, input, select, textarea').forEach(el => el.disabled = value);
  }
  async function refresh() {
    lock(true);
    root.querySelector('[data-error]').textContent = '';
    root.querySelector('[data-status]').textContent = 'Tüm kayıtlar yükleniyor…';
    // Never leave stale totals or moderation controls actionable after a failed refresh.
    data = null;
    root.querySelector('[data-summary]').replaceChildren();
    content().replaceChildren();
    try {
      const next = await store.managementData({signal:controller.signal});
      if (!alive) return;
      data = next;
      render();
      root.querySelector('[data-status]').textContent = `Son yenileme: ${dateLabel(new Date())}`;
    } catch (e) {
      error(e);
      if (alive) root.querySelector('[data-status]').textContent = 'Kayıtlar yüklenemedi. Verileri yenile ile tekrar deneyin.';
    } finally { if (alive) lock(false); }
  }
  function editor(book = {}) {
    editId = book.id || null;
    draftId = book.id || crypto.randomUUID();
    const el = root.querySelector('[data-editor]');
    el.innerHTML = `<form data-book-form class="kc-post"><h3>${editId?'Okumayı düzenle':'Yeni okuma'}</h3>${[['title','Kitabın adı',160],['authors','Yazarlar',160],['leader','Buluşma lideri',120],['place','Yer / katılım bilgisi',300],['purpose','Buluşmanın amacı',1000]].map(([k,l,max]) => `<label>${l}<input name="${k}" required maxlength="${max}" value="${esc(book[k] || '')}"></label>`).join('')}<label>Tarih ve saat (Türkiye)<input name="date" type="datetime-local" required value="${esc(localDate(book.date))}"></label><label>Kitaplık bölümü<select name="status"><option value="active">Aktif okuma</option><option value="archived" ${book.status==='archived'?'selected':''}>Geçmiş okuma</option></select></label><div class="kc-actions"><button type="submit">Kaydet</button><button type="button" data-cancel>Vazgeç</button></div></form>`;
    el.querySelector('input').focus();
  }
  async function mutate(action) {
    lock(true);
    root.querySelector('[data-error]').textContent = '';
    try {
      // Re-check current server profile before every administrative write.
      if (!(await store.identity()).manage) throw Error('Yönetim yetkiniz bulunmuyor.');
      if (!alive) return;
      await action();
      if (alive) await refresh();
    } catch (e) { error(e); }
    finally { if (alive) lock(false); }
  }
  async function click(event) {
    const b = event.target.closest('button');
    if (!b || busy) return;
    if (b.hasAttribute('data-refresh')) return refresh();
    if (!data) return;
    if (b.dataset.section) { tab=b.dataset.section; shown=20; render(); }
    if (b.hasAttribute('data-more')) { shown+=20; render(); }
    if (b.hasAttribute('data-new')) editor();
    if (b.dataset.edit) editor(data.books.find(book => book.id===b.dataset.edit));
    if (b.hasAttribute('data-cancel')) root.querySelector('[data-editor]').replaceChildren();
    if (b.dataset.mailStatus) {
      lock(true);root.querySelector('[data-error]').textContent='';
      const resultElement=[...root.querySelectorAll('[data-mail-result]')].find(el=>el.dataset.mailResult===b.dataset.mailStatus);
      if(resultElement)resultElement.textContent='E-posta durumu sorgulanıyor…';
      try {
        const status=await store.mailStatus(b.dataset.mailStatus);
        if(alive) {
          const result=[...root.querySelectorAll('[data-mail-result]')].find(el=>el.dataset.mailResult===b.dataset.mailStatus);
          if(result)result.textContent=welcomeStatusText(status);
        }
      } catch(e) { if(alive && resultElement)resultElement.textContent='E-posta durumu doğrulanamadı.';error(e); }
      finally {if(alive)lock(false);}
      return;
    }
    if (b.dataset.member) {
      if (b.dataset.status==='blocked' && !confirm('Bu üyenin mesaj ve fotoğraf paylaşma yetkisi kapatılsın mı?')) return;
      await mutate(() => store.setMember(b.dataset.member,b.dataset.status));
    }
    if (b.dataset.archive) await mutate(() => store.archive(b.dataset.archive,b.dataset.status));
    if (b.dataset.remove && confirm('Bu paylaşımın metni ve fotoğrafı kalıcı olarak kaldırılsın mı?')) await mutate(() => store.remove(b.dataset.book,b.dataset.remove));
  }
  function change(event) {
    if (busy || !data) return;
    if (event.target.matches('[data-member-filter]')) { filter=event.target.value; shown=20; render(); }
    if (event.target.matches('[data-book-filter]')) { bookFilter=event.target.value; shown=20; render(); }
  }
  async function submit(event) {
    if (!event.target.matches('[data-book-form]')) return;
    event.preventDefault();
    if (busy || !data) return;
    try {
      const values = bookData(Object.fromEntries(new FormData(event.target)));
      const id = editId || draftId;
      await mutate(() => store.saveBook(id,values));
    } catch (e) { error(e); }
  }
  root.addEventListener('click',click);
  root.addEventListener('change',change);
  root.addEventListener('submit',submit);
  // Return cleanup immediately so logout cancels an in-flight paginated load.
  void refresh();
  return stop;
}
