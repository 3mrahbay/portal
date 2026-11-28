import {escapeHTML as esc} from './core.mjs';
const millis=value=>value?.toMillis?.()??(value?.toDate?+value.toDate():Date.parse(value));
const date=value=>new Date(millis(value)).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'long',timeStyle:'short'});
export function localIso(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||''))throw Error('Tarih ve saati doldurun.');
 const d=new Date(value+':00+03:00');
 if(!Number.isFinite(+d)||new Date(+d+3*3600000).toISOString().slice(0,16)!==value)throw Error('Geçerli bir tarih seçin.');
 return d.toISOString();
}
export function mountPolls(root,store,{manage=false,now=Date.now}={}){
 const requested=new URLSearchParams(root.ownerDocument.defaultView?.location.search||'').getAll('poll');
 const targetPoll=requested.length===1&&/^[A-Za-z0-9_-]{8,100}$/.test(requested[0])?requested[0]:'';
 let targetState=targetPoll?'loading':requested.length?'invalid':'',targetFocused=false;
 let alive=true,enabled=null,epoch=0,feedStop=null,timer=null,cached=true,loadingOlder=false,cursor=null,hasOlder=false,paged=false;
 const polls=new Map(),votes=new Map(),voteStops=new Map(),pollStops=new Map(),choices=new Map(),busy=new Set(),requests=new Map();
 let createId=null,creating=false;
 root.innerHTML=`<div class="kc-poll-heading"><h2>${manage?'Oylama Yönetimi':'Birlikte seçelim'}</h2><p>Her oylamada tek seçim yapabilirsiniz. Süre dolmadan oyunuzu değiştirebilir veya geri çekebilirsiniz. Kimin hangi seçeneğe oy verdiği paylaşılmaz.</p></div><p data-poll-error role="alert" class="kc-error"></p><p data-poll-status role="status"></p>${manage?'<button type="button" data-poll-new>Yeni oylama oluştur</button><div data-poll-editor></div>':''}<div data-poll-list></div><button type="button" data-poll-more hidden>Geçmiş oylamaları göster</button><button type="button" data-poll-retry hidden>Oylamaları yeniden yükle</button>`;
 const message=text=>{if(alive)root.querySelector('[data-poll-error]').textContent=text;};
 const targetStatus=root.ownerDocument.createElement('p');targetStatus.setAttribute('role','status');root.querySelector('[data-poll-list]').before(targetStatus);
 const ended=p=>p.status==='closed'||millis(p.closesAt)<=now();
 function render(){
  if(!alive||!enabled)return;
  const focus=root.ownerDocument.activeElement;const focusPoll=focus?.closest('[data-poll-id]')?.dataset.pollId;const focusValue=focus?.value;
  root.querySelector('[data-poll-status]').textContent=cached?'Kayıtlı sonuçlar gösteriliyor; bağlantı doğrulanınca oy verebilirsiniz.':'Sonuçlar canlı güncelleniyor. Tarihler Türkiye saatidir.';
  targetStatus.textContent=targetState==='loading'?'Bildirimdeki oylama yükleniyor…':targetState==='missing'?'Bildirimdeki oylama artık bulunamıyor.':targetState==='invalid'?'Oylama bağlantısı geçersiz.':'';
  root.querySelector('[data-poll-list]').innerHTML=[...polls.values()].sort((a,b)=>(b.id===targetPoll)-(a.id===targetPoll)||millis(b.createdAt)-millis(a.createdAt)).map(p=>{
   const closed=ended(p),v=votes.get(p.id),ready=votes.has(p.id),chosen=choices.has(p.id)?choices.get(p.id):v?.optionId;
   const disabled=closed||cached||!ready||busy.has(p.id),max=Math.max(0,...Object.values(p.counts||{}));
   return `<article class="kc-post kc-poll" data-poll-id="${esc(p.id)}"><span class="kc-badge">${p.type==='time'?'Buluşma zamanı':'Sıradaki kitap'} · ${closed?'Sona erdi':'Oylama açık'}</span><h3>${esc(p.title)}</h3><p>Son oy: ${esc(date(p.closesAt))}</p><form data-poll-vote><fieldset ${disabled?'disabled':''}><legend>Tercihiniz</legend>${p.options.map(o=>`<label class="kc-poll-option"><input type="radio" name="optionId" value="${esc(o.id)}" ${chosen===o.id?'checked':''}><span>${esc(o.label)}${v?.optionId===o.id?' <strong>· Oyunuz</strong>':''}<small>${Number(p.counts?.[o.id]||0)} oy${closed&&max>0&&p.counts?.[o.id]===max?' · En çok oy alan':''}</small><progress max="${Math.max(1,p.total||0)}" value="${Number(p.counts?.[o.id]||0)}" aria-label="${esc(o.label)} oy oranı"></progress></span></label>`).join('')}</fieldset><p>${Number(p.total||0)} katılımcı oy kullandı${!p.total?' · Henüz oy yok.':''}</p>${!closed?`<div class="kc-actions"><button type="submit" ${disabled?'disabled':''}>${busy.has(p.id)?'Kaydediliyor…':v?.optionId?'Oyumu değiştir':'Oy ver'}</button>${v?.optionId?`<button type="button" data-poll-withdraw ${disabled?'disabled':''}>Oyumu geri çek</button>`:''}${manage?`<button type="button" data-poll-close ${cached||busy.has(p.id)?'disabled':''}>Oylamayı bitir</button>`:''}</div>`:'<p>Oylama kapandı. Bu sonuç kitap veya buluşma kaydını kendiliğinden değiştirmez.</p>'}</form></article>`;
  }).join('')||'<p class="kc-empty">Henüz oylama yok. Yeni seçenekler burada görünecek.</p>';
  root.querySelector('[data-poll-more]').hidden=!hasOlder;root.querySelector('[data-poll-more]').disabled=loadingOlder;
  const target=[...root.querySelectorAll('[data-poll-id]')].find(el=>el.dataset.pollId===targetPoll);
  if(target){target.setAttribute('tabindex','-1');target.setAttribute('aria-label','Bildirimdeki oylama');target.classList.add('kc-poll-target');if(!targetFocused&&votes.has(targetPoll)){targetFocused=true;target.focus({preventScroll:true});target.scrollIntoView?.({block:'start'});}}
  if(focusPoll&&focus?.matches('input[type=radio]'))[...root.querySelectorAll('[data-poll-id]')].find(el=>el.dataset.pollId===focusPoll)?.querySelector(`input[value="${focusValue}"]`)?.focus();
 }
 function cancelFeeds(){epoch++;feedStop?.();feedStop=null;for(const stop of voteStops.values())stop();voteStops.clear();for(const stop of pollStops.values())stop();pollStops.clear();clearInterval(timer);timer=null;polls.clear();votes.clear();choices.clear();requests.clear();targetStatus.textContent='';targetFocused=false;}
 function failure(e){if(!alive)return;cancelFeeds();cached=true;root.querySelector('[data-poll-list]').replaceChildren();root.querySelector('[data-poll-more]').hidden=true;root.querySelector('[data-poll-status]').textContent='Oylamalar yüklenemedi.';root.querySelector('[data-poll-retry]').hidden=false;message(e.code==='permission-denied'?'Kulüp erişiminiz değişmiş olabilir. Hesabınızı kontrol edin.':e.message||'Bağlantı kurulamadı.');}
 function watchOne(id,turn){if(!store.pollById||pollStops.has(id))return;pollStops.set(id,()=>{});const stop=store.pollById(id,value=>{
  if(!alive||!enabled||turn!==epoch)return;
  if(id===targetPoll)targetState=value?'found':'missing';
  if(value)watch([{...value,cursor:polls.get(id)?.cursor}],turn);else polls.delete(id);
  render();
 },e=>{if(turn===epoch)failure(e);});if(turn===epoch)pollStops.set(id,stop);else stop();}
 function watch(rows,turn){for(const p of rows){if(turn!==epoch)return;polls.set(p.id,p);watchOne(p.id,turn);if(turn!==epoch)return;if(!voteStops.has(p.id)){
   voteStops.set(p.id,()=>{});const stop=store.pollVote(p.id,v=>{if(alive&&enabled&&turn===epoch){votes.set(p.id,v);render();}},e=>{if(turn===epoch)failure(e);});
   if(turn===epoch)voteStops.set(p.id,stop);else stop();
  }}}
 function start(){cancelFeeds();message('');root.querySelector('[data-poll-retry]').hidden=true;cached=true;hasOlder=false;paged=false;cursor=null;if(targetPoll)targetState='loading';const turn=epoch;
  const unsub=store.polls((rows,meta={})=>{if(!alive||!enabled||turn!==epoch)return;cached=!!meta.cached;watch(rows,turn);if(!paged){cursor=rows.at(-1)?.cursor;hasOlder=rows.length===20;}render();},e=>{if(turn===epoch)failure(e);});
  if(turn!==epoch||!alive){unsub();return;}feedStop=unsub;
  if(targetPoll)watchOne(targetPoll,turn);
  if(turn!==epoch||!alive)return;
  timer=setInterval(()=>{if(alive&&enabled)render();},30000);
 }
 function setEnabled(value){if(!alive||enabled===value)return;enabled=value;if(enabled)start();else{cancelFeeds();root.querySelector('[data-poll-list]').replaceChildren();root.querySelector('[data-poll-more]').hidden=true;root.querySelector('[data-poll-retry]').hidden=true;root.querySelector('[data-poll-status]').textContent='Oylamalara katılmak için kulüp üyeliğinizin onaylanması gerekiyor.';}}
 async function vote(id,optionId){
  const p=polls.get(id);if(!p||ended(p)||cached||busy.has(id)||!votes.has(id))return;
  if(!optionId&&optionId!==null){message('Önce bir seçenek seçin.');return;}
  let command=requests.get(id);const revision=votes.get(id)?.revision||0;
  if(!command||command.optionId!==optionId||command.revision!==revision)command={action:'vote',pollId:id,optionId,revision,requestId:crypto.randomUUID()};
  requests.set(id,command);busy.add(id);message('');render();const turn=epoch;
  try{await store.pollCommand(command);if(alive&&turn===epoch){requests.delete(id);choices.delete(id);}}
  catch(e){if(alive&&turn===epoch)message(e.message||'Oy kaydedilemedi. Yeniden deneyin.');}
  finally{busy.delete(id);if(alive&&turn===epoch)render();}
 }
 function editor(){createId=crypto.randomUUID();root.querySelector('[data-poll-editor]').innerHTML=`<form data-poll-create class="kc-post"><h3>Yeni oylama</h3><label>Oylama türü<select name="type"><option value="book">Sıradaki kitap</option><option value="time">Buluşma zamanı</option></select></label><label>Başlık<input name="title" required maxlength="160" placeholder="Bir sonraki buluşmada ne okuyalım?"></label><label>Son oy verme zamanı (Türkiye)<input name="closesAt" type="datetime-local" required></label><p>2–8 seçenek girin. Yayımlandıktan sonra seçenekler değişmez; gerekirse oylamayı kapatıp yenisini oluşturun.</p><div data-poll-options>${Array.from({length:8},(_,i)=>`<label>Seçenek ${i+1}${i<2?' (zorunlu)':' (isteğe bağlı)'}<input name="option${i}" maxlength="160" ${i<2?'required':''}></label>`).join('')}</div><button type="submit">Oylamayı aç</button><button type="button" data-poll-cancel>Vazgeç</button></form>`;}
 async function click(e){const button=e.target.closest('button');if(!button||!alive||!enabled)return;
  if(button.hasAttribute('data-poll-new')&&!creating)editor();
  if(button.hasAttribute('data-poll-cancel')&&!creating)root.querySelector('[data-poll-editor]').replaceChildren();
  if(button.hasAttribute('data-poll-retry'))start();
  const id=button.closest('[data-poll-id]')?.dataset.pollId;
  if(button.hasAttribute('data-poll-withdraw'))return vote(id,null);
  if(button.hasAttribute('data-poll-close')&&manage&&!busy.has(id)&&confirm('Oylama hemen kapatılsın mı? Sonrasında oylar değiştirilemez.')){
   busy.add(id);render();const turn=epoch;try{await store.pollCommand({action:'close',pollId:id});}catch(e){if(turn===epoch)message(e.message);}finally{busy.delete(id);if(turn===epoch)render();}
  }
  if(button.hasAttribute('data-poll-more')&&!loadingOlder&&cursor){loadingOlder=true;render();const turn=epoch;try{const rows=await store.olderPolls(cursor);if(turn!==epoch||!alive)return;watch(rows,turn);paged=true;cursor=rows.at(-1)?.cursor;hasOlder=rows.length===20;render();}catch(e){if(turn===epoch)message(e.message);}finally{loadingOlder=false;if(turn===epoch)render();}}
 }
 function change(e){if(e.target.name==='optionId'){choices.set(e.target.closest('[data-poll-id]').dataset.pollId,e.target.value);}
  if(e.target.name==='type'){for(const input of root.querySelectorAll('[data-poll-options] input')){input.type=e.target.value==='time'?'datetime-local':'text';input.value='';}}
 }
 async function submit(e){if(e.target.matches('[data-poll-vote]')){e.preventDefault();const selected=new FormData(e.target).get('optionId');if(selected===null){message('Önce bir seçenek seçin.');return;}return vote(e.target.closest('[data-poll-id]').dataset.pollId,selected);}
  if(!e.target.matches('[data-poll-create]'))return;e.preventDefault();if(creating||!manage||!enabled)return;
  const form=e.target,values=new FormData(form),type=values.get('type');let command;
  try{command={action:'create',pollId:createId,type,title:values.get('title'),closesAt:localIso(values.get('closesAt')),options:Array.from({length:8},(_,i)=>values.get('option'+i)).filter(x=>x?.trim()).map(x=>type==='time'?localIso(x):x.trim())};}catch(e){message(e.message);return;}
  creating=true;form.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);const turn=epoch;
  try{await store.pollCommand(command);if(alive&&turn===epoch){root.querySelector('[data-poll-editor]').replaceChildren();message('');}}
  catch(e){if(alive&&turn===epoch)message(e.message||'Oylama açılamadı. Yeniden deneyin.');}
  finally{creating=false;if(alive&&turn===epoch)form.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);}
 }
 root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('submit',submit);
 return {setEnabled,stop(){alive=false;cancelFeeds();root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('submit',submit);root.replaceChildren();}};
}
