import {receiptTotal,validateReceipt} from './receipt-core.js';
let enginePromise;
function engine(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(!enginePromise)enginePromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';s.crossOrigin='anonymous';s.onload=()=>resolve(window.Tesseract);s.onerror=()=>{s.remove();enginePromise=null;reject(Error('Okuma aracı yüklenemedi.'));};document.head.append(s);});
 return enginePromise;
}
export function receiptInput({mount,amount}){
 mount.innerHTML=`<div class="receipt-actions"><label role="button" tabindex="0">📷 Resim çek<input data-camera type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden></label><label role="button" tabindex="0">▧ Resim / PDF ekle<input data-gallery type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden></label></div><small>JPG, PNG, WebP veya PDF · en fazla 15 MB</small><div data-preview></div><p data-status role="status" aria-live="polite">Fotoğraftaki toplam tutar otomatik okunur. Göndermeden önce kontrol edin.</p><label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:10px 0"><input data-review type="checkbox" style="width:18px;height:18px"> Tutarı fiş / faturayla karşılaştırdım</label><button type="button" data-retry hidden>Yeniden oku</button> <button type="button" data-remove hidden>Görseli kaldır</button>`;
 if(!document.getElementById('receipt-input-style')){const style=document.createElement('style');style.id='receipt-input-style';style.textContent='.receipt-actions{display:flex;gap:10px;margin-bottom:8px}.receipt-actions label{display:flex;flex:1;justify-content:center;align-items:center;min-height:48px;padding:12px;border:1px solid #d8ddef;border-radius:12px;background:#f3f5fc;color:#2b3674;font:600 13px system-ui;cursor:pointer}.receipt-actions input[hidden]{display:none!important}[data-preview] img{display:block;max-width:100%;max-height:220px;object-fit:contain;margin:12px auto;border-radius:12px}[data-status]{font:13px/1.6 system-ui;color:#4a5169}[data-remove],[data-retry]{padding:8px 12px;border:1px solid #d8ddef;background:#fff;border-radius:10px;cursor:pointer}';document.head.append(style);}
 let file=null,url=null,job=0,worker=null,suggestion='',running=false;
 const status=mount.querySelector('[data-status]'),preview=mount.querySelector('[data-preview]'),retry=mount.querySelector('[data-retry]'),remove=mount.querySelector('[data-remove]');
 const stop=()=>{job++;running=false;worker?.terminate().catch(()=>{});worker=null;};
 const reset=()=>{stop();file=null;if(url)URL.revokeObjectURL(url);url=null;preview.replaceChildren();retry.hidden=true;remove.hidden=true;mount.querySelectorAll('input[type=file]').forEach(x=>x.value='');mount.querySelector('[data-review]').checked=false;suggestion='';status.textContent='Fotoğraftaki toplam tutar otomatik okunur. Göndermeden önce kontrol edin.';};
 async function read(){
  if(!file||file.type==='application/pdf')return;stop();const id=job,before=amount.value;running=true;retry.hidden=true;
  status.textContent='Toplam tutar okunuyor… İlk kullanımda kısa bir hazırlık yapılır.';
  let own=null,timer;
  try{
   const result=await Promise.race([(async()=>{const api=await engine();if(id!==job)return null;own=await api.createWorker('tur+eng',1,{logger:m=>{if(id===job&&m.status==='recognizing text')status.textContent='Toplam tutar okunuyor · %'+Math.round(m.progress*100);}});if(id!==job){await own.terminate();return null;}worker=own;const res=await own.recognize(file);return receiptTotal(res.data.text);})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Okuma zaman aşımına uğradı.')),60000);})]);
   if(id!==job||!result)return;
   if(result.amount!==null&&amount.value===before){amount.value=result.amount.toFixed(2);mount.querySelector('[data-review]').checked=false;suggestion=amount.value;status.textContent='Toplam '+result.amount.toLocaleString('tr-TR',{style:'currency',currency:'TRY'})+' okundu. Fişle karşılaştırın; gerekiyorsa tutarı düzeltin.';}
   else status.textContent=result.amount!==null?'Tutar alanını değiştirdiğiniz için değeriniz korundu. Fişte okunan: '+result.amount.toLocaleString('tr-TR')+' TL.':'Toplam tutar net okunamadı. Tutarı elle girin veya daha net bir fotoğraf ekleyin.';
  }catch(e){if(id===job)status.textContent='Otomatik okuma tamamlanamadı. Tutarı elle girebilir veya yeniden deneyebilirsiniz.';}
  finally{clearTimeout(timer);if(own)own.terminate().catch(()=>{});if(id===job){worker=null;running=false;job++;retry.hidden=false;}}
 }
 async function select(e){mount.querySelector('[data-review]').checked=false;const selected=e.target.files?.[0];if(!selected)return;try{validateReceipt(selected);}catch(err){e.target.value='';status.textContent=err.message;return;}stop();if(suggestion&&amount.value===suggestion)amount.value='';suggestion='';file=selected;if(url)URL.revokeObjectURL(url);preview.replaceChildren();remove.hidden=false;if(file.type.startsWith('image/')){url=URL.createObjectURL(file);const img=document.createElement('img');img.src=url;img.alt='Eklenen fiş veya fatura';preview.append(img);await read();}else{preview.textContent=file.name;retry.hidden=true;status.textContent='PDF eklendi. PDF için tutarı elle girin; fotoğraflarda otomatik okuma kullanılabilir.';}}
 mount.querySelectorAll('.receipt-actions label').forEach(label=>label.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();label.querySelector('input').click();}});
 amount.addEventListener('input',()=>mount.querySelector('[data-review]').checked=false);
 mount.querySelectorAll('input[type=file]').forEach(x=>x.addEventListener('change',select));retry.onclick=read;remove.onclick=()=>{if(suggestion&&amount.value===suggestion)amount.value='';reset();};
 return {reset,get file(){return file;},get reviewed(){return mount.querySelector('[data-review]').checked;},get busy(){return running;},get source(){return suggestion&&amount.value===suggestion?'ocr-kontrol-edildi':'manuel';}};
}
export function fileDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Görsel okunamadı.'));r.readAsDataURL(file);});}
