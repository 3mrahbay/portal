import {mufredatIslem} from './mufredat-servis.js';
// Read-only history. Identity and snapshots are produced by the server transaction.
export async function ac(program) {
  document.getElementById('mufredatGecmisi')?.remove();
  const dialog=document.createElement('dialog');
  dialog.id='mufredatGecmisi';
  dialog.setAttribute('aria-label','Müfredat değişiklik geçmişi');
  dialog.style.cssText='width:min(700px,calc(100vw - 32px));max-height:80dvh;box-sizing:border-box;border:1px solid #dce5df;border-radius:18px;padding:20px;color:#243c31;font-family:inherit;overflow:auto';
  const heading=document.createElement('h3');heading.textContent='Müfredat Değişiklik Geçmişi';
  const close=document.createElement('button');close.className='btn-mini';close.textContent='Kapat';close.onclick=()=>dialog.close();
  const content=document.createElement('div');content.setAttribute('aria-live','polite');
  dialog.append(heading,close,content);document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();
  const roles={ogretmen:'Sınıf öğretmeni',yardimci_ogretmen:'Yardımcı öğretmen',ingilizce_ogretmeni:'İngilizce öğretmeni',degerler_ogretmeni:'Değerler öğretmeni',orman_ogretmeni:'Orman öğretmeni',brans_ogretmeni:'Branş öğretmeni',kurucu_mudur:'Kurucu müdür',mudur:'Müdür',egitim_koordinator:'Eğitim koordinatörü'};
  const esc=x=>window.BCK.escapeHtml(String(x??''));
  async function load(){
    content.textContent='Geçmiş yükleniyor…';
    try {
      const result=await mufredatIslem({action:'history',disiplin:program});
      if(!dialog.isConnected)return;
      if(!Array.isArray(result.entries))throw Error('Geçmiş servisi henüz güncellenmedi.');
      content.innerHTML=result.entries.length ? '<p>Son 30 değişiklik gösteriliyor. Önceki kayıtlar saklanır.</p>'+result.entries.map(e=>`<details style="margin-top:12px;padding:12px;border:1px solid #dce5df;border-radius:12px;overflow-wrap:anywhere"><summary>${esc(e.actorName||e.actor)} · ${esc(new Date(e.time).toLocaleString('tr-TR'))}</summary><p>${esc(e.actor)} · ${esc(roles[e.actorRole]||e.actorRole)}</p><p>${e.addedCount} eklenen, ${e.removedCount} çıkarılan, ${e.movedCount} taşınan kazanım anahtarı.</p><p>Ad değişiklikleri eklenen ve çıkarılan sayısına da dahildir. Çıkarılan kazanımların öğrenci geçmişi korunur.</p><button class="btn-mini" data-entry="${esc(e.id)}">Önceki ve yeni içeriği göster</button></details>`).join('') : '<p>Bu program için ayrıntılı geçmiş henüz yok. Geçmiş kaydı özelliği etkinleştirildikten sonraki değişiklikler burada gösterilir.</p>';
      content.querySelectorAll('[data-entry]').forEach(button=>{button.onclick=async()=>{
        button.disabled=true;
        try { const data=await mufredatIslem({action:'history',disiplin:program,entryId:button.dataset.entry});
          const comparison=document.createElement('div');
          for(const [title,areas] of [['Önceki içerik',data.before],['Yeni içerik',data.after]]){
            const section=document.createElement('section'),titleEl=document.createElement('h4');titleEl.textContent=title;section.append(titleEl);
            if(!areas?.length){const empty=document.createElement('p');empty.textContent='Kazanım yok';section.append(empty);}
            for(const area of areas||[]){const h=document.createElement('strong');h.textContent=area.ad;section.append(h);
              for(const group of area.gruplar||[]){const p=document.createElement('p');p.textContent=group.ad;section.append(p);const list=document.createElement('ul');
                for(const lesson of group.dersler||[]){const li=document.createElement('li');li.textContent=lesson;list.append(li);}section.append(list);}
            } comparison.append(section);
          }button.replaceWith(comparison);
        } catch(e) { button.disabled=false;button.textContent='İçerik yüklenemedi · Yeniden dene'; }
      };});
    } catch(e) {
      if(!dialog.isConnected)return;
      content.textContent='Geçmiş yüklenemedi: '+(e.message||'Bağlantı hatası');
      const retry=document.createElement('button');retry.className='btn-mini';retry.textContent='Yeniden dene';retry.onclick=load;content.append(retry);
    }
  }
  await load();
}
