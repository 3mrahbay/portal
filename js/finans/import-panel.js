import {categoryOptions} from './import-approval.js';
import {esc} from './core.js';

export function importCallableAdapter(functions,httpsCallable) {
  if(!functions||typeof httpsCallable!=='function') throw Error('Onay servisi bağlantısı gerekli.');
  const call=name=>httpsCallable(functions,name,{limitedUseAppCheckTokens:true});
  const list=call('financeImportList'),review=call('financeImportReview'),approve=call('financeImportApprove');
  return {list:()=>list({}).then(r=>r.data),review:data=>review(data).then(r=>r.data),
    approve:reviewId=>approve({reviewId,action:'approve'}).then(r=>r.data)};
}
export async function importPanel(root,api) {
  root.innerHTML='<h2>Banka / fatura onayları</h2><p>Kaynağı ve muhasebe kalemini inceleyerek onaylayın.</p><div role="status"></div><div data-list></div><div data-review></div>';
  const status=root.querySelector('[role=status]'),list=root.querySelector('[data-list]'),detail=root.querySelector('[data-review]');
  if(!api){status.textContent='Onay servisi henüz etkin değil.';return;}
  let current=null,busy=false,generation=0;
  const money=c=>`${(c.amountMinor/100).toLocaleString('tr-TR')} ${c.currency}`;
  async function load(){try{const {rows}=await api.list();list.replaceChildren();for(const row of rows){
    const button=document.createElement('button');button.type='button';
    button.textContent=`${row.candidate.kind==='payment'?'Tahsilat':'Gider'} · ${money(row.candidate)} · ${row.candidate.description||row.candidate.paymentDate||'Tarih eksik'}`;
    button.onclick=()=>select(row);list.append(button);
  }if(!rows.length)list.textContent='Bekleyen kayıt yok.';}catch(e){status.textContent='Kayıtlar okunamadı: '+e.message;}}
  function select(row){
    if(busy)return;
    generation++;current=null;status.textContent='';const c=row.candidate;
    detail.innerHTML=`<h3>Kaynak kontrolü</h3><p>${esc(money(c))} · ${esc(c.paymentDate||'Ödeme tarihi eksik')}</p><p>${esc(c.paymentEvidence||'Ödeme kanıtı eksik')}</p><p>Posta hesabı: ${esc(c.source.mailbox)}<br>İleti: ${esc(c.source.messageId)}</p><p>${esc(c.description||'')}</p>
      ${c.kind==='expense'?`<label>Gider kategorisi<select data-category>${categoryOptions().map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></label>`:''}
      <label><input type="checkbox" data-duplicate> Mevcut kayıtları ve diğer posta hesaplarındaki kopyaları kontrol ettim.</label><button data-prepare>Güncel önizlemeyi getir</button><div data-preview></div>`;
    detail.querySelector('[data-prepare]').onclick=async()=>{
      if(busy)return;busy=true;current=null;const revision=generation;const preview=detail.querySelector('[data-preview]');preview.replaceChildren();
      try{
        if(!detail.querySelector('[data-duplicate]').checked)throw Error('Mükerrer kayıt kontrolü gerekli.');
        const category=detail.querySelector('[data-category]')?.value||null;
        if(c.kind==='expense'&&!category)throw Error('Gider kategorisi seçin.');
        const response=await api.review({queueId:row.id,category,duplicateReview:true});
        if(revision!==generation)return;
        current=response;
        const r=current.review,rc=r.candidate;
        preview.innerHTML=`<h3>Onaylanacak kayıt</h3><p>${esc(current.studentName||'Gider')} · ${esc(rc.period||'')} · ${esc(rc.item||r.category||'')}</p><p>${esc(money(rc))} · ${esc(rc.paymentDate)} · ${esc(rc.paymentMethod)}</p>${r.balance?`<p>Mevcut kalan: ${esc(r.balance.remaining)} TL · İşlem sonrası: ${esc(r.balance.remaining-rc.amountMinor/100)} TL</p>`:''}<p>Ödeme durumu: ${esc(rc.paymentStatus)}<br>Kanıt: ${esc(rc.paymentEvidence)}</p><p>Fatura: ${esc(rc.invoiceNumber||'—')} · ${esc(rc.invoiceDate||'—')}</p><p>Banka / fatura referansı: ${esc(rc.eventKey?.value||'Kaynakta yok')}</p><details><summary>İncelenen kaynak ve plan</summary><pre>${esc(JSON.stringify(r,null,2))}</pre></details><label><input data-confirm type="checkbox"> Bu kaydı gösterilen kaleme işlemeyi onaylıyorum.</label><button data-approve disabled>Muhasebeye kaydet</button>`;
        const approve=preview.querySelector('[data-approve]'),confirm=preview.querySelector('[data-confirm]');
        confirm.onchange=()=>approve.disabled=!confirm.checked||busy;
        approve.onclick=async()=>{
          if(busy||!confirm.checked||!current)return;
          busy=true;approve.disabled=true;
          try{const result=await api.approve(current.reviewId);status.textContent=result.alreadyProcessed?'Kayıt daha önce işlendi; tekrar eklenmedi.':'Kayıt muhasebeye işlendi.';current=null;detail.replaceChildren();await load();}
          catch(e){status.textContent='İşlem doğrulanamadı: '+e.message+' Aynı onayla tekrar deneyebilirsiniz.';}
          finally{busy=false;if(approve.isConnected)approve.disabled=!confirm.checked;}
        };
      }catch(e){status.textContent=e.message;}finally{busy=false;}
    };
    // Changed operator choices invalidate the preview and its action.
    detail.querySelectorAll('select,input[data-duplicate]').forEach(el=>el.onchange=()=>{generation++;current=null;detail.querySelector('[data-preview]').replaceChildren();});
  }
  await load();
}
