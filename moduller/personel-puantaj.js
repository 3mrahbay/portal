import { aylikOzet, okulGunu, dakikaYaz, csvHucre } from '../js/personel-puantaj-core.js?v=1';
const esc = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let generation=0;
export async function panelRender(kapId, personeller, ay = okulGunu().slice(0,7)) {
  const kap=document.getElementById(kapId), api=window.PortalAPI, seq=++generation;
  if (!kap) return;
  if (!api?.state?.isAdmin && !['kurucu_mudur','mudur','muhasebe'].includes(api?.state?.rol)) {kap.textContent='Bu alan için yetkiniz yok.';return;}
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ay)) {kap.textContent='Geçerli bir ay seçin.';return;}
  stilEkle();
  const arac=document.getElementById('ozlukAraclar');
  arac.innerHTML=`<label class="pp-ay">Rapor dönemi <input aria-label="Rapor dönemi" type="month" value="${ay}"></label>`;
  arac.querySelector('input').addEventListener('change',e=>window.ozlukPuantajAyDegis(e.target.value));
  kap.innerHTML='<div class="pp-bos" role="status">Seçilen ayın kayıtları yükleniyor…</div>';
  try {
    const {fb,db}=api;
    const snap=await fb.getDocs(fb.query(fb.collection(db,'puantaj'),fb.where('tarih','>=',ay+'-01'),fb.where('tarih','<=',ay+'-31')));
    if (seq!==generation || arac.querySelector('input')?.value!==ay) return;
    const satirlar=aylikOzet(personeller,snap.docs.map(d=>d.data()),ay);
    let ara='',yalnizSorun=false;
    const toplam=k=>satirlar.reduce((n,s)=>n+s[k],0);
    const ciz=()=>{
      const filtre=satirlar.filter(s=>(!yalnizSorun||s.sorunlu||s.uzunGun) && `${s.ad} ${s.rol}`.toLocaleLowerCase('tr').includes(ara.toLocaleLowerCase('tr')));
      const odak=kap.querySelector('input:focus')?.selectionStart;
      kap.innerHTML=`<section class="pp-rapor" aria-label="Aylık puantaj raporu">
        <header class="pp-bas"><div><span class="pp-kucuk">PERSONEL • ${esc(ay)}</span><h2>Aylık çalışma özeti</h2><p>Kayıtlı süreleri inceleyin, eksik hareketleri tamamlayın.</p></div><button type="button" data-export>CSV indir</button></header>
        <div class="pp-kartlar">${[['Kayıtlı net süre',dakikaYaz(toplam('net'))],['Mola',dakikaYaz(toplam('mola'))],['Kontrol gereken gün',toplam('sorunlu')],['Açık mesai',toplam('acik')]].map(([l,v])=>`<div class="pp-kart"><span>${l}</span><strong>${v}</strong></div>`).join('')}</div>
        <div class="pp-not">Bu rapor bordro değildir. Açık mesailer raporun açıldığı ana kadardır; eksik hareket içeren günler kısmi toplamdır. Kayıt bulunmaması devamsızlık kararı değildir. İzin bakiyesi ve ücret hesabı ayrı değerlendirilir.</div>
        <div class="pp-arac"><label>Çalışan ara<input type="search" placeholder="Ad veya görev" value="${esc(ara)}"></label><label class="pp-check"><input type="checkbox" ${yalnizSorun?'checked':''}> Yalnız kontrol gerekenler</label><span role="status">${filtre.length} / ${satirlar.length} çalışan</span><button type="button" data-correct>Düzeltmeleri aç</button></div>
        <div class="pp-liste">${filtre.length?filtre.map(s=>`<article class="pp-kisi"><div class="pp-kim"><strong>${esc(s.ad)}</strong><span>${esc(s.rol)}</span></div><dl>${[['Net süre',dakikaYaz(s.net)],['Mola',dakikaYaz(s.mola)],['Giriş olan gün',s.gun]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><div class="pp-durum ${s.sorunlu||s.uzunGun?'pp-uyari':''}">${s.sorunlu?`${s.sorunlu} gün kontrol gerekli`:s.acik?'Mesai açık':s.gun?'Kayıtlar eşleşiyor':'Kayıt yok'}${s.uzunGun?`<small>${s.uzunGun} gün 11 saati aşıyor · inceleyin</small>`:''}</div>
          ${s.gunler.length?`<details><summary>Günlük hareketleri incele</summary><div class="pp-gunler">${s.gunler.map(g=>`<div><strong>${esc(g.tarih)}</strong><span>${dakikaYaz(g.net)} net · ${dakikaYaz(g.mola)} mola</span><span>${esc(g.sorunlar.join(' · ')||(g.acik?'Açılış anındaki süre':'Giriş-çıkış tamam'))}</span></div>`).join('')}</div></details>`:''}</article>`).join(''):'<p class="pp-bos">Bu filtreye uygun çalışan bulunamadı.</p>'}</div>
        <p class="pp-dip">Saat dilimi: Türkiye (Europe/Istanbul). 11 saat uyarısı inceleme içindir; sözleşme, haftalık çalışma, yasal istisnalar ve izinler ayrıca değerlendirilmelidir.</p></section>`;
      kap.querySelector('input[type=search]').addEventListener('input',e=>{ara=e.target.value;ciz();});
      kap.querySelector('input[type=checkbox]').addEventListener('change',e=>{yalnizSorun=e.target.checked;ciz();kap.querySelector('input[type=checkbox]').focus();});
      kap.querySelector('[data-correct]').addEventListener('click',()=>window.ozlukSekme('duzeltme'));
      kap.querySelector('[data-export]').addEventListener('click',()=>{
        const rows=[['Dönem','Personel','Net dakika','Mola dakika','Giriş olan gün','Kontrol gereken gün','Açık mesai'],...filtre.map(s=>[ay,s.ad,Math.round(s.net),Math.round(s.mola),s.gun,s.sorunlu,s.acik])];
        const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvHucre).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`puantaj-${ay}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      });
      if(odak!=null){const input=kap.querySelector('input[type=search]');input.focus();input.setSelectionRange(odak,odak);}
    };
    ciz();
  } catch(e) {
    if(seq!==generation)return;
    kap.innerHTML='<div class="pp-bos" role="alert">Puantaj yüklenemedi. Eksik veriyle rapor üretilmedi. Bağlantınızı ve erişim yetkinizi kontrol edip yeniden deneyin. <button type="button">Yeniden dene</button></div>';
    kap.querySelector('button').addEventListener('click',()=>panelRender(kapId,personeller,ay));
  }
}
export function panelDurdur(){generation++;}
function stilEkle(){
  if(document.getElementById('puantajRaporStil'))return;
  const s=document.createElement('style');s.id='puantajRaporStil';s.textContent=`
.pp-rapor{color:#243b31;max-width:1440px;margin:auto}.pp-rapor *,.pp-ay *{box-sizing:border-box}.pp-bas{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:18px 0}.pp-bas h2{font-size:24px;margin:5px 0}.pp-bas p,.pp-dip{color:#56685e;font-size:13px;line-height:1.6}.pp-kucuk{font-size:11px;letter-spacing:1.2px;font-weight:750}.pp-rapor button,.pp-ay input{min-height:44px;padding:10px 15px;border:1px solid #c8d7cd;border-radius:12px;background:#fff;color:#264f38;font:inherit;cursor:pointer}.pp-bas button{background:#2d5e3e;color:#fff}.pp-kartlar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.pp-kart{padding:18px;border:1px solid #dce5df;border-radius:16px;background:linear-gradient(130deg,#f2f7f3,#fff);display:flex;flex-direction:column;gap:12px}.pp-kart span{font-size:13px;color:#56685e}.pp-kart strong{font-size:23px;font-variant-numeric:tabular-nums}.pp-not{border-left:3px solid #b58b37;background:#fff9ec;padding:14px 16px;margin:18px 0;font-size:13px;line-height:1.6;color:#715018;border-radius:4px 12px 12px 4px}.pp-arac{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin:18px 0}.pp-arac label{display:flex;gap:7px;font-size:13px;align-items:center}.pp-arac input[type=search]{min-height:44px;border:1px solid #c8d7cd;border-radius:12px;padding:10px;font:inherit;max-width:100%}.pp-arac input[type=checkbox]{width:20px;height:20px;accent-color:#2d5e3e}.pp-arac>span{font-size:12px;color:#56685e}.pp-liste{display:grid;gap:10px}.pp-kisi{display:grid;grid-template-columns:minmax(180px,1fr) minmax(300px,1.7fr) minmax(150px,.8fr);align-items:center;gap:16px;padding:18px;border:1px solid #dce5df;border-radius:15px;background:#fff}.pp-kim{display:flex;flex-direction:column;gap:5px;overflow-wrap:anywhere}.pp-kim>span{font-size:12px;color:#56685e}.pp-kisi dl{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0}.pp-kisi dt{font-size:11px;color:#56685e}.pp-kisi dd{margin:5px 0 0;font-weight:700;font-size:14px}.pp-durum{font-size:12px;color:#346347;background:#edf6ef;padding:10px;border-radius:10px}.pp-durum small{display:block;margin-top:5px}.pp-uyari{background:#fff2d9;color:#805300}.pp-kisi details{grid-column:1/-1;font-size:13px;border-top:1px solid #edf0ed;padding-top:10px}.pp-kisi summary{cursor:pointer;min-height:36px;display:list-item;padding:8px}.pp-gunler>div{display:grid;grid-template-columns:110px 1fr 1fr;gap:12px;border-top:1px solid #edf0ed;padding:10px 0;font-size:12px}.pp-bos{padding:32px;text-align:center;color:#56685e}.pp-ay{display:flex;align-items:center;gap:12px;font-size:13px}.pp-rapor :focus-visible{outline:3px solid #6a9980;outline-offset:3px}@media(max-width:900px){.pp-kisi{grid-template-columns:1fr auto}.pp-kisi dl{grid-row:2;grid-column:1/-1}.pp-kartlar{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.pp-bas{align-items:flex-start;flex-direction:column}.pp-bas h2{font-size:22px}.pp-kart{padding:13px}.pp-kart strong{font-size:19px}.pp-arac{gap:12px}.pp-arac label:first-child{flex-direction:column;align-items:stretch;width:100%}.pp-kisi{grid-template-columns:minmax(0,1fr);padding:14px}.pp-kisi dl{grid-row:auto;gap:8px}.pp-durum{grid-row:3}.pp-gunler>div{grid-template-columns:1fr}.pp-rapor{padding-bottom:env(safe-area-inset-bottom)}}`;document.head.appendChild(s);
}
