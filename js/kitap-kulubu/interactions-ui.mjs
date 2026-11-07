import { escapeHTML as esc, dateLabel } from './core.mjs';
import { REACTIONS } from './interactions-store.mjs';

// Keep the same nodes/listeners across feed snapshots so typing is not lost.
export function createPhotoInteractions(root, store) {
  const cards = new Map();
  function clear() { for (const card of cards.values()) card.stop(); cards.clear(); }
  function sync(book, posts, access, member) {
    const canRead = access?.read && (access.staff || member?.status === 'approved');
    const wanted = new Set();
    if (book && canRead) for (const post of posts.values()) {
      if (post.deleted || !post.image) continue;
      const host = [...root.querySelectorAll('[data-photo-interactions]')]
        .find(el => el.dataset.photoInteractions === post.id);
      if (!host) continue;
      const key = book.id + '/' + post.id;
      wanted.add(key);
      if (!cards.has(key)) cards.set(key, mount(book.id, post.id, access));
      const card = cards.get(key);
      if (host.firstElementChild !== card.el) host.replaceChildren(card.el);
      card.writable(book.status === 'active');
    }
    for (const [key, card] of cards) if (!wanted.has(key)) {card.stop(); cards.delete(key);}
  }
  function mount(book, post, access) {
    const el = root.ownerDocument.createElement('section');
    el.className = 'kc-interactions';
    el.setAttribute('aria-label','Fotoğraf yanıtları ve tepkileri');
    el.innerHTML = `<div class="kc-reactions">${REACTIONS.map((emoji,i)=>`<button type="button" data-react="${emoji}" aria-pressed="false" aria-label="${['Kalp','Alkış','Çiçek','Çok beğendim'][i]} tepkisi">${emoji} <span>–</span></button>`).join('')}</div><small data-reaction-limit hidden>Gösterilen sayılar son 1000 tepkiyi kapsar.</small><button type="button" class="kc-text-button" data-open aria-expanded="false">Cevapla · Yanıtları gör</button><div data-discussion hidden><p class="kc-muted">Yanıtlar kulüp üyelerine görünür.</p><div data-replies aria-live="polite"></div><button type="button" data-more hidden>Daha eski yanıtlar</button><form data-reply-form><label>Fotoğrafa cevabınız<textarea maxlength="500" rows="2" placeholder="Düşüncenizi paylaşın…" required></textarea></label><div class="kc-reply-actions"><div>${['❤️','🌸','📖'].map(e=>`<button type="button" data-insert="${e}" aria-label="Mesaja ${e} ekle">${e}</button>`).join('')}</div><button type="submit" class="bk-button">Gönder</button></div></form><p data-archived class="kc-muted" hidden>Bu okuma arşivde. Yeni yanıt ve tepki eklenemez.</p></div><p data-interaction-status role="status"></p><p data-interaction-error role="alert" class="kc-error"></p>`;
    const find = selector => el.querySelector(selector);
    const input = find('textarea'), form = find('form');
    const unsub = [];
    let live = true, denied = false, writable = false, sending = false, reacting = false, draftId = null,
      own = '', ready = false, opened = false, cursor = null, more = false, loadingMore = false;
    const latest = new Map(), older = new Map();
    const report = e => {
      if (!live) return;
      if (e.code === 'permission-denied') {
        denied = true; writable = false; ready = false; own = '';
        latest.clear(); older.clear(); find('[data-replies]').replaceChildren();
        el.querySelectorAll('[data-react] span').forEach(node => node.textContent = '–');
        controls();
      }
      find('[data-interaction-error]').textContent = e.code === 'permission-denied'
        ? 'Erişiminiz değişmiş olabilir. Sayfayı yenileyin.'
        : e.message || 'İşlem tamamlanamadı. Yeniden deneyin.';
    };
    const controls = () => {
      el.querySelectorAll('[data-react]').forEach(b => {b.disabled = !writable || reacting || !ready; b.setAttribute('aria-pressed', String(b.dataset.react === own));});
      form.hidden = !writable;
      form.querySelectorAll('button,textarea').forEach(b => b.disabled = sending || !writable);
      find('[data-archived]').hidden = writable;
    };
    function renderReplies() {
      const rows = new Map([...older, ...latest]);
      find('[data-replies]').innerHTML = [...rows.values()].sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)||b.id.localeCompare(a.id)).map(r=>`<article class="kc-reply"><div><strong>${esc(r.authorName)}</strong> <time>${r.createdAt?.toDate ? esc(dateLabel(r.createdAt.toDate())) : 'Gönderiliyor…'}</time></div><p class="kc-text">${esc(r.text)}</p>${access.manage || r.authorUid===access.uid ? `<button type="button" class="kc-text-button" data-delete-reply="${esc(r.id)}">Yanıtı kaldır</button>`:''}</article>`).join('') || '<p class="kc-muted">İlk yanıtı siz yazın.</p>';
      find('[data-more]').hidden = !more;
    }
    unsub.push(store.reactions(book, post, rows => {
      if (!live) return;
      el.querySelectorAll('[data-react]').forEach(b => b.querySelector('span').textContent = rows.filter(r=>r.emoji===b.dataset.react).length);
      find('[data-reaction-limit]').hidden = rows.length < 1000;
    }, report));
    unsub.push(store.ownReaction(book, post, emoji => {if(live){own=emoji; ready=true; controls();}}, report));
    el.addEventListener('input', e => {if(e.target===input) draftId=null;});
    el.addEventListener('click', async e => {
      const button=e.target.closest('button');
      if(!button || button.disabled || !live) return;
      try {
        if(button.hasAttribute('data-open')) {
          const show=find('[data-discussion]').hidden;
          find('[data-discussion]').hidden=!show;
          button.setAttribute('aria-expanded',String(show));
          if(!opened) {
            opened=true;
            find('[data-replies]').textContent='Yanıtlar yükleniyor…';
            unsub.push(store.replies(book,post,rows=>{
              if(!live)return;
              // Remove vanished live-window rows instead of keeping deleted replies.
              latest.clear(); rows.forEach(r=>{latest.set(r.id,r);older.delete(r.id);});
              if(!cursor) {more=rows.length===20;}
              renderReplies();
            },report));
          }
          if(show && writable) input.focus();
        }
        if(button.dataset.react && writable && ready && !reacting) {
          reacting=true; controls();
          try {await store.react(book,post,own===button.dataset.react?'':button.dataset.react);}
          finally {reacting=false;if(live)controls();}
        }
        if(button.dataset.insert && writable && !sending) {
          const emoji=button.dataset.insert;
          if(input.value.length+emoji.length<=500){input.setRangeText(emoji,input.selectionStart,input.selectionEnd,'end');draftId=null;input.focus();}
        }
        if(button.dataset.deleteReply && confirm('Bu yanıt kaldırılsın mı?')) {
          button.disabled=true;
          await store.removeReply(book,post,button.dataset.deleteReply);
          if(live){latest.delete(button.dataset.deleteReply);older.delete(button.dataset.deleteReply);renderReplies();}
        }
        if(button.hasAttribute('data-more') && !loadingMore) {
          loadingMore=true;button.disabled=true;
          try {
            const tail=cursor || [...latest.values()].at(-1)?.cursor;
            if(tail){const rows=await store.olderReplies(book,post,tail);if(!live)return;
              rows.forEach(r=>older.set(r.id,r));cursor=rows.at(-1)?.cursor||tail;more=rows.length===20;renderReplies();}
          } finally {loadingMore=false;button.disabled=false;}
        }
      } catch(err){button.disabled=false;report(err);}
    });
    form.addEventListener('submit',async e=>{
      e.preventDefault(); e.stopPropagation();
      if(!writable || sending || !input.value.trim())return;
      sending=true;draftId ||= crypto.randomUUID();controls();
      find('[data-interaction-error]').textContent='';
      try {
        await store.reply(book,post,draftId,input.value);
        if(!live)return;
        input.value='';draftId=null;find('[data-interaction-status]').textContent='Yanıtınız eklendi.';
      } catch(err){report(err);} finally {sending=false;if(live){controls();input.focus();}}
    });
    controls();
    return {el, writable(value){writable=value && !denied;controls();}, stop(){live=false;unsub.forEach(f=>f());el.remove();}};
  }
  return {sync, clear};
}
