import {esc,para,bugun} from './core.js';
const SCHOOL='Bir Çiçek Koleji Anaokulu';
export const planDurumu=r=>r.beklenen<=0?'Tanımlanmamış':r.kalan<=0?'Ödendi':r.odenen>0?'Kısmen ödendi':'Bekliyor';
export function planGruplari(plan){return [
 ['Ön ödeme',plan.satirlar.filter(r=>r.id==='__onOdeme')],
 ['Aylık ödemeler',plan.satirlar.filter(r=>!r.id.startsWith('diger-')&&r.id!=='__onOdeme')],
 ['Diğer ödemeler',plan.satirlar.filter(r=>r.id.startsWith('diger-'))]
].filter(([,rows])=>rows.length);}
export function planTablosu(plan){return `<table class="payment-plan-table"><thead><tr><th>Ödeme kalemi</th><th>Planlanan</th><th>Ödenen</th><th>Kalan</th><th>Durum</th></tr></thead><tbody>${planGruplari(plan).map(([name,rows])=>`<tr class="plan-group"><th colspan="5">${name}</th></tr>${rows.map(r=>`<tr><td>${esc(r.ad)}</td><td>${para(r.beklenen)}</td><td>${para(r.odenen)}</td><td>${para(r.kalan)}</td><td><span class="plan-status ${r.beklenen>0&&r.kalan===0?'paid':''}">${planDurumu(r)}</span></td></tr>`).join('')}`).join('')||'<tr><td colspan="5">Ödeme planı henüz oluşturulmadı.</td></tr>'}</tbody><tfoot><tr><th>TOPLAM</th><td>${para(plan.toplam)}</td><td>${para(plan.odenen)}</td><td>${para(plan.kalan)}</td><td></td></tr></tfoot></table>`;}
// The PDF uses the same immutable plan snapshot as the dialog, without
// recalculating amounts or including another student's or period's records.
export function planPdfCiz(pdf,{plan,student,period,logo,date=bugun()}){
 const groups=planGruplari(plan),count=plan.satirlar.length+groups.length+2;
 const rh=Math.min(8,205/Math.max(count,1)),fs=Math.min(9,Math.max(5.5,rh*1.65));
 const money=v=>para(v).replace('₺','TL');
 pdf.setFont('Carlito','normal');
 pdf.setFillColor(36,88,64);pdf.rect(0,0,210,4,'F');
 const props=pdf.getImageProperties(logo),h=20,w=h*props.width/props.height;
 pdf.addImage(logo,'PNG',13,12,Math.min(w,28),h);
 pdf.setTextColor(32,56,42);pdf.setFont('Carlito','bold');pdf.setFontSize(16);pdf.text(SCHOOL,46,19);
 pdf.setFontSize(12);pdf.text('ÖDEME PLANI',46,27);
 pdf.setFont('Carlito','normal');pdf.setFontSize(9);pdf.text(`${period} Eğitim ve Öğretim Yılı`,46,33);
 pdf.text(pdf.splitTextToSize(`Öğrenci: ${student}`,180),13,43);
 pdf.setFontSize(8);pdf.text(`Düzenleme: ${date.split('-').reverse().join('.')}`,197,52,{align:'right'});
 let y=57;
 const draw=(cells,{group=false,total=false,header=false}={})=>{
  pdf.setFillColor(...(header?[36,88,64]:group||total?[234,241,236]:[255,255,255]));pdf.rect(13,y,184,rh,'F');
  pdf.setTextColor(...(header?[255,255,255]:[32,56,42]));pdf.setFont('Carlito',header||group||total?'bold':'normal');pdf.setFontSize(fs);
  if(group)pdf.text(cells[0],16,y+rh*.67);
  else cells.forEach((cell,i)=>{
   const widths=[58,28,28,28,39],positions=[16,98,126,154,158];
   let text=String(cell);while(pdf.getTextWidth(text)>widths[i]-3&&text.length>1)text=text.slice(0,-2)+'…';
   pdf.text(text,positions[i],y+rh*.67,{align:i>0&&i<4?'right':'left'});
  });
  pdf.setDrawColor(218,228,222);pdf.line(13,y+rh,197,y+rh);y+=rh;
 };
 draw(['Ödeme kalemi','Planlanan','Ödenen','Kalan','Durum'],{header:true});
 for(const [name,rows]of groups){draw([name],{group:true});for(const r of rows)draw([r.ad,money(r.beklenen),money(r.odenen),money(r.kalan),planDurumu(r)]);}
 draw(['TOPLAM',money(plan.toplam),money(plan.odenen),money(plan.kalan),''],{total:true});
 pdf.setFont('Carlito','normal');pdf.setFontSize(8);pdf.setTextColor(96,113,102);
 pdf.text('Ödenen tutarlar muhasebe tarafından kaydedilmiş tahsilatları gösterir.',13,y+8);
 pdf.text('Onay bekleyen ödeme bildirimleri ödenen toplama dahil değildir. Bu belge makbuz değildir.',13,y+13);
 pdf.setDrawColor(218,228,222);pdf.line(13,281,197,281);pdf.text(SCHOOL,13,287);pdf.text('1 / 1',197,287,{align:'right'});
 return pdf;
}
async function pdfHazirla(data){
 await window.portalAracYukle('pdf');
 if(!window.pdfTurkceFont)await import('../../portal-pdf-font.js');
 const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});
 if(!window.pdfTurkceFont?.(pdf))throw Error('Türkçe yazı tipi yüklenemedi. Lütfen yeniden deneyin.');
 const res=await fetch(new URL('../../okul_logo.png',import.meta.url));
 if(!res.ok)throw Error('Okul logosu yüklenemedi. Lütfen yeniden deneyin.');
 const logo=new Uint8Array(await res.arrayBuffer());
 return planPdfCiz(pdf,{...data,logo});
}
export function odemePlaniAc(root,data){
 const opener=document.activeElement,d=document.createElement('dialog');d.className='payment-plan-dialog';d.setAttribute('aria-label','Ödeme planı');
 d.innerHTML=`<div class="plan-heading"><div><h2>Ödeme planı</h2><p>${esc(data.student)} · ${esc(data.period)}</p></div><button type="button" data-close aria-label="Ödeme planını kapat">Kapat</button></div><div class="plan-school"><img src="${new URL('../../okul_logo.png',import.meta.url).href}" alt="Bir Çiçek Koleji logosu"><strong>${SCHOOL}</strong></div><div class="plan-table-scroll">${planTablosu(data.plan)}</div><p class="muted">Onay bekleyen bildirimler ödenen toplama dahil değildir. Bu belge makbuz değildir.</p><p class="plan-error" role="status"></p><div class="toolbar"><button type="button" class="primary" data-download>PDF indir</button><button type="button" data-print>Yazdır</button></div>`;
 root.append(d);d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>{d.remove();opener?.focus();};
 for(const action of ['download','print'])d.querySelector(`[data-${action}]`).onclick=async()=>{
  const status=d.querySelector('.plan-error'),buttons=d.querySelectorAll('[data-download],[data-print]');
  let printWindow=null;status.textContent='Belge hazırlanıyor…';buttons.forEach(b=>b.disabled=true);
  try{
   if(action==='print'){printWindow=window.open('','_blank');if(!printWindow)throw Error('Yazdırma penceresi engellendi. Açılır pencerelere izin verin veya PDF indir seçeneğini kullanın.');printWindow.opener=null;printWindow.document.title='Ödeme planı';printWindow.document.body.textContent='Yazdırılabilir ödeme planı hazırlanıyor…';}
   const pdf=await pdfHazirla(data);
   if(action==='download')pdf.save(`Odeme-Plani-${data.period}-${data.student.replace(/[^\p{L}\p{N}-]+/gu,'-')}.pdf`);
   else {pdf.autoPrint();const url=URL.createObjectURL(pdf.output('blob'));printWindow.location.replace(url);setTimeout(()=>URL.revokeObjectURL(url),300000);}
   status.textContent='';
  }catch(e){printWindow?.close();status.textContent=e.message||'Belge hazırlanamadı. Lütfen yeniden deneyin.';}finally{buttons.forEach(b=>b.disabled=false);}
 };
}
