import {dashboard} from './dashboard.js';
import {esc,bugun,sirala} from './core.js';

export const MUHASEBE_HIZLI=[
 ['accounts','Öğrenci carileri','Borç, kısmi ödeme ve ay detayları'],
 ['approvals','Ödeme kontrolü','Veli bildirimleri ve dekontlar'],
 ['reports','Grafik raporlar','Tahsilat, gider ve alacak analizi'],
 ['bank','Banka mutabakatı','Döküm ile tahsilatı eşleştir'],
 ['calendar','Vade takibi','Yaklaşan ve gecikmiş ödemeler'],
 ['mesaj','Mesajlaşma','Tüm veli ve personelle yazış'],
 ['ozluk','Özlük işlemleri','Kendi bilgilerim, izin ve belgelerim'],
 ['devam','Giriş / çıkış','Kendi devam ve puantaj kayıtlarım'],
 ['personel','Personel mali işlemleri','Özlük ve personel kayıtları'],
 ['gider','Gider yönetimi','Harcama kayıtları ve masraflar'],
 ['fis','Fiş bildir','Yaptığım harcamayı bildir']
];
export async function muhasebeAnaSayfa(root,ctx){
 root.classList.add('finans-app');
 root.innerHTML=`<header><div class="muted">BİR ÇİÇEK KOLEJİ · MUHASEBE</div><h1>Mali işler çalışma alanı</h1><p>Tahsilatlar, okul giderleri ve personel işlemleri bir arada.</p></header><section class="section"><h2>Hızlı erişim</h2><div class="finance-shortcuts">${MUHASEBE_HIZLI.map(([k,ad,alt])=>`<button data-finance-action="${k}"><b>${ad}</b><small>${alt}</small></button>`).join('')}</div></section><div id="staffFinance"></div><div class="charts"><section class="section"><h2>Sınıf dağılımı</h2><div id="financeClasses">Kayıtlar yükleniyor…</div></section><section class="section"><h2>Son kayıtlar</h2><div id="financeRecent">Kayıtlar yükleniyor…</div></section></div><section class="section"><h2>Personel giriş / çıkış durumu</h2><p class="muted">Son kaydedilen durum ve güncelleme zamanı.</p><div class="toolbar"><label>Personel ara<input id="staffSearch"></label><label>Sırala<select id="staffSort"><option value="ad-asc">Ad · A–Z</option><option value="ad-desc">Ad · Z–A</option><option value="tarih-desc">Güncelleme · yeniden eskiye</option><option value="tarih-asc">Güncelleme · eskiden yeniye</option><option value="durum-asc">Durum · A–Z</option></select></label><button id="staffRefresh">Durumu yenile</button></div><div id="financeStaff">Personel bilgileri yükleniyor…</div></section>`;
 const finance=root.querySelector('#staffFinance');let chosen=null;
 root.querySelectorAll('[data-finance-action]').forEach(b=>b.onclick=()=>{const k=b.dataset.financeAction;if(['accounts','approvals','reports','bank','calendar'].includes(k)){chosen=k;finance.querySelector(`[data-view="${k}"]`)?.click();finance.scrollIntoView({block:'start'});}else ctx.islem(k);});
 let staff=[],staffReady=false;
 function relatedState(message){for(const id of ['financeClasses','financeRecent']){const node=root.querySelector('#'+id);if(node)node.textContent=message;}}
 function staffRender(){if(!staffReady)return;const term=root.querySelector('#staffSearch').value.toLocaleLowerCase('tr'),[key,dir]=root.querySelector('#staffSort').value.split('-');const rows=sirala(staff.filter(r=>[r.ad,r.rol,r.durum].join(' ').toLocaleLowerCase('tr').includes(term)),key,dir);root.querySelector('#financeStaff').innerHTML=`<div class="scroll"><table><thead><tr><th>Personel</th><th>Görev</th><th>Son durum</th><th>Güncelleme</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.ad)}</td><td>${esc(r.rol)}</td><td>${esc(r.durum)}</td><td>${esc(r.tarih||'Kayıt yok')}</td></tr>`).join('')||'<tr><td colspan="4">Eşleşen personel yok.</td></tr>'}</tbody></table></div>`;}
 async function staffLoad(){const button=root.querySelector('#staffRefresh');button.disabled=true;staffReady=false;root.querySelector('#financeStaff').textContent='Personel bilgileri yükleniyor…';try{staff=await personelOzeti(ctx);staffReady=true;if(root.isConnected)staffRender();}catch(e){staff=[];const node=root.querySelector('#financeStaff');if(node)node.textContent='Personel durumu okunamadı. Durumu yenile düğmesiyle yeniden deneyebilirsiniz.';}finally{button.disabled=false;}}
 root.querySelector('#staffSearch').oninput=staffRender;root.querySelector('#staffSort').onchange=staffRender;root.querySelector('#staffRefresh').onclick=staffLoad;
 await Promise.allSettled([staffLoad(),dashboard(finance,{...ctx,onLoading(){relatedState('Seçili dönemin kayıtları yükleniyor…');},onError(){relatedState('Kayıtlar okunamadı. Finans bölümündeki Yeniden dene düğmesini kullanın.');},onData(data){const groups=new Map();data.ogrenciler.forEach(o=>groups.set(o.sinif||'Sınıf atanmadı',(groups.get(o.sinif||'Sınıf atanmadı')||0)+1));const total=data.ogrenciler.length;root.querySelector('#financeClasses').innerHTML=[...groups].sort((a,b)=>b[1]-a[1]).map(([ad,n])=>`<div class="class-distribution"><span>${esc(ad)}</span><b>${n} öğrenci · %${Math.round(n/Math.max(total,1)*100)}</b><progress max="${Math.max(total,1)}" value="${n}" aria-label="${esc(ad)}"></progress></div>`).join('')||'<p>Bu dönemde öğrenci kaydı yok.</p>';
 const recent=sirala(data.ogrenciler.filter(o=>o.kayitTarihi),'kayitTarihi','desc').slice(0,8);root.querySelector('#financeRecent').innerHTML=recent.map(o=>`<div class="payment"><div><b>${esc(o.ad)}</b><small>${esc(o.sinif)}</small></div><time>${esc(o.kayitTarihi.slice(0,10))}</time></div>`).join('')||'<p>Kayıt tarihi bulunan öğrenci yok.</p>';root.querySelector('#financeRecent').innerHTML+=`<p class="muted">Kayıt tarihi eksik: ${data.ogrenciler.filter(o=>!o.kayitTarihi).length}</p>`;if(chosen)finance.querySelector(`[data-view="${chosen}"]`)?.click();}})]);
}
export async function personelOzeti({fb,db}){
 const [ps,ds]=await Promise.all([fb.getDocs(fb.collection(db,'personeller')),fb.getDocs(fb.collection(db,'personelDurum'))]);const states=new Map(ds.docs.map(d=>[d.id.toLowerCase(),d.data()]));const labels={iceride:'Çalışıyor',disarida:'Dışarıda',molada:'Molada',izinli:'İzinli'};
 return ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>!['arsiv','pasif','ayrildi'].includes(p.durum)).map(p=>{const s=states.get((p.email||p.id).toLowerCase());const tarih=personelZamani(s?.sonZaman||s?.guncellendi);return {ad:p.adSoyad||[p.ad,p.soyad].filter(Boolean).join(' ')||p.id,rol:p.gorev||p.rol||'Personel',tarih:typeof tarih==='string'?tarih:'',durum:s?(labels[s.durum]||'Durum bilinmiyor')+(typeof tarih==='string'&&Number.isFinite(Date.parse(tarih))&&bugun(new Date(tarih))!==bugun()?' · önceki kayıt':''):'Kayıt yok'};});
}

export function personelZamani(value){
 const date=value?.toDate?value.toDate():value&&Number.isFinite(value.seconds)?new Date(value.seconds*1000):typeof value==='string'&&value?new Date(value):null;
 return date&&Number.isFinite(date.getTime())?date.toISOString():'';
}
