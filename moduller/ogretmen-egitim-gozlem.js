// ═══════════════════════════════════════════════════════════════════
// PORTAL GELİŞMİŞ EĞİTİM GÖZLEMİ
// ZEKY mobildeki S/T/U + aşama notu + fotoğraf zincirinin portal karşılığı.
// Mevcut caGozlemAc giriş noktasını korur; veri yapısı ogrenciGelisim ile aynıdır.
// ═══════════════════════════════════════════════════════════════════

const B = () => window.BCK;
const D = () => window.PortalData;
const DURUMLAR = [
  { kod:'S', ad:'Sunuldu', acik:'Çalışma ilk kez sunuldu.', renk:'#8A9691', bg:'#F0F2F1', ikon:'sparkles' },
  { kod:'T', ad:'Tekrar ediyor', acik:'Çocuk çalışmayı tekrar ederek pekiştiriyor.', renk:'#B98500', bg:'#FFF6D8', ikon:'repeat-2' },
  { kod:'U', ad:'Ustalaştı', acik:'Çocuk beceriyi bağımsız ve güvenli kullanıyor.', renk:'#2D7A2D', bg:'#E8F3E8', ikon:'circle-check-big' }
];
const PROGRAMLAR = [
  { id:'montessori', ad:'Montessori' },
  { id:'orman', ad:'Orman Okulu' },
  { id:'degerler', ad:'Değerler Eğitimi' },
  { id:'ingilizce', ad:'İngilizce Eğitimi' }
];
const SIRA = { S:1, T:2, U:3 };

let S = null;
let eskiCaGozlemAc = null;
const KURULUM = '__zekyGelismisGozlemV1';

function esc(t) { return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function toast(m,t='success'){ try{ if(window.showToast) window.showToast(m,t); else alert(m); }catch(_){} }
function ikon(){ try{ if(window.lucideYenile) setTimeout(window.lucideYenile,30); else if(window.lucide) window.lucide.createIcons(); }catch(_){} }
function programBilgi(id){ return PROGRAMLAR.find(x=>x.id===id)||PROGRAMLAR[0]; }
function ogrAd(){ return S?.ogrAd || 'Öğrenci'; }
function personelAd(){ const b=B(); const p=b?.personel?.()||{}; const u=b?.kullanici?.()||{}; return [p.ad,p.soyad].filter(Boolean).join(' ') || u.displayName || 'Öğretmen'; }
function yonetimMi(){ const b=B(); const r=b?.rol?.()||''; return b?.yoneticiMi?.() || ['kurucu_mudur','mudur','egitim_koordinator'].includes(r); }

function stil(){
  if(document.getElementById('zego-stil'))return;
  const x=document.createElement('style');x.id='zego-stil';x.textContent=`
    .zego-arka{position:fixed;inset:0;z-index:9700;background:rgba(14,25,19,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px}.zego-kart{width:min(620px,100%);max-height:92vh;overflow:auto;background:#FAFAF7;border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.25);padding:20px}.zego-ust{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}.zego-bas{flex:1}.zego-bas b{display:block;font-size:18px;color:#2D5E3E}.zego-bas span{font-size:12px;color:#7E8B84}.zego-kapat{width:40px;height:40px;border:0;border-radius:50%;background:#fff;font-size:23px;cursor:pointer}.zego-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.zego-field{margin-bottom:12px}.zego-field label{display:block;font-size:10.5px;font-weight:850;color:#7C8882;letter-spacing:.4px;text-transform:uppercase;margin-bottom:5px}.zego-field select,.zego-field textarea{width:100%;border:1.5px solid #E4E9E5;border-radius:11px;background:#fff;padding:10px 11px;font:500 13px inherit;color:#28342D}.zego-field textarea{resize:vertical;min-height:92px}.zego-durumlar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.zego-durum{border:2px solid transparent;border-radius:13px;padding:10px 8px;background:#fff;cursor:pointer;text-align:center;font-family:inherit}.zego-durum.on{border-color:currentColor}.zego-durum i,.zego-durum svg{width:18px;height:18px}.zego-durum b{display:block;font-size:12px;margin-top:4px}.zego-durum span{display:block;font-size:9.5px;line-height:1.35;margin-top:2px;color:#748078}.zego-foto{border:2px dashed #C9D8CF;border-radius:14px;padding:13px;background:#F6FAF7;text-align:center;cursor:pointer}.zego-foto img{display:block;width:100%;max-height:240px;object-fit:contain;border-radius:10px;margin-bottom:8px}.zego-foto b{font-size:12.5px;color:#2D5E3E}.zego-foto span{display:block;font-size:10.5px;color:#849089;margin-top:3px}.zego-notice{border-radius:11px;padding:10px 12px;background:#F0EAF6;color:#5B4189;font-size:11.5px;line-height:1.5;margin:10px 0}.zego-actions{display:flex;gap:9px;margin-top:14px}.zego-btn{flex:1;border:0;border-radius:13px;min-height:46px;font:750 13px inherit;cursor:pointer}.zego-btn.iptal{background:#EEF1EF;color:#526059}.zego-btn.kaydet{background:#2D5E3E;color:#fff}.zego-btn:disabled{opacity:.55}.zego-progress{display:none;margin-top:10px;padding:9px 11px;background:#EAF3EC;color:#2D5E3E;border-radius:10px;font-size:11.5px;font-weight:700}.zego-progress.on{display:block}@media(max-width:560px){.zego-arka{padding:0;align-items:flex-end}.zego-kart{border-radius:22px 22px 0 0;max-height:95vh}.zego-grid{grid-template-columns:1fr}.zego-durumlar{grid-template-columns:1fr}.zego-durum{text-align:left;display:grid;grid-template-columns:28px 100px 1fr;align-items:center;gap:6px}.zego-durum b,.zego-durum span{margin:0}}
  `;document.head.appendChild(x);
}

async function mufredatYukle(){
  S.alanlar=await D().mufredatAlanlariGetir(S.program).catch(()=>[]);
  if(S.alanIdx>=S.alanlar.length)S.alanIdx=0;
  const alan=S.alanlar[S.alanIdx]||null;
  if(S.grupIdx>=(alan?.gruplar||[]).length)S.grupIdx=0;
  const grup=(alan?.gruplar||[])[S.grupIdx]||null;
  if(S.dersIdx>=(grup?.dersler||[]).length)S.dersIdx=0;
}

function secenekler(){
  const alan=S.alanlar[S.alanIdx]||null, gruplar=alan?.gruplar||[], grup=gruplar[S.grupIdx]||null, dersler=grup?.dersler||[];
  return {alan,gruplar,grup,dersler,ders:dersler[S.dersIdx]||''};
}

function ciz(){
  const arka=document.getElementById('zegoArka');if(!arka)return;
  const {alan,gruplar,dersler}=secenekler();
  const fotoUrl=S.fotoOniz||'';
  arka.querySelector('.zego-kart').innerHTML=`
    <div class="zego-ust"><div class="zego-bas"><b>${esc(ogrAd())} · Eğitim Gözlemi</b><span>${esc(S.sinif||'')} · Aşamayı, notu ve varsa fotoğrafı birlikte kaydedin.</span></div><button class="zego-kapat" data-act="kapat">×</button></div>
    <div class="zego-grid"><div class="zego-field"><label>Program</label><select id="zegoProgram">${PROGRAMLAR.map(p=>`<option value="${p.id}" ${p.id===S.program?'selected':''}>${esc(p.ad)}</option>`).join('')}</select></div><div class="zego-field"><label>Gelişim alanı</label><select id="zegoAlan">${S.alanlar.map((a,i)=>`<option value="${i}" ${i===S.alanIdx?'selected':''}>${esc(a.ad)}</option>`).join('')}</select></div></div>
    <div class="zego-grid"><div class="zego-field"><label>Grup</label><select id="zegoGrup">${gruplar.map((g,i)=>`<option value="${i}" ${i===S.grupIdx?'selected':''}>${esc(g.ad)}</option>`).join('')}</select></div><div class="zego-field"><label>Eğitim / kazanım</label><select id="zegoDers">${dersler.map((d,i)=>`<option value="${i}" ${i===S.dersIdx?'selected':''}>${esc(d)}</option>`).join('')}</select></div></div>
    <div class="zego-field"><label>Aşama</label><div class="zego-durumlar">${DURUMLAR.map(d=>`<button type="button" class="zego-durum ${S.durum===d.kod?'on':''}" data-durum="${d.kod}" style="color:${d.renk};background:${d.bg}"><i data-lucide="${d.ikon}"></i><b>${d.ad}</b><span>${d.acik}</span></button>`).join('')}</div></div>
    <div class="zego-field"><label>Gözlem notu</label><textarea id="zegoNot" placeholder="Bu aşamada gözlemlediğiniz gelişimi yazın…">${esc(S.not||'')}</textarea></div>
    <div class="zego-field"><label>Fotoğraf (opsiyonel)</label><input type="file" id="zegoFotoInput" accept="image/*" hidden><div class="zego-foto" id="zegoFotoSec">${fotoUrl?`<img src="${esc(fotoUrl)}" alt="Seçilen fotoğraf">`:''}<b>${S.foto?'Fotoğraf seçildi':'Fotoğraf ekle'}</b><span>Fotoğraf ilgili S/T/U aşamasında ve Eğitim Galerisi'nde görünür.</span></div></div>
    <div class="zego-notice">${yonetimMi()?'Yönetim hesabından eklenen fotoğraf doğrudan yayınlanır.':'Öğretmen fotoğrafı yönetim onayından sonra veliye ve Eğitim Galerisi’ne açılır.'}</div>
    <div class="zego-progress" id="zegoProgress">Kaydediliyor…</div><div class="zego-actions"><button class="zego-btn iptal" data-act="kapat">Vazgeç</button><button class="zego-btn kaydet" data-act="kaydet">Gözlemi Kaydet</button></div>`;
  bagla();ikon();
}

function bagla(){
  const root=document.getElementById('zegoArka');if(!root)return;
  root.querySelectorAll('[data-act="kapat"]').forEach(b=>b.onclick=kapat);
  root.querySelector('[data-act="kaydet"]').onclick=kaydet;
  root.querySelectorAll('[data-durum]').forEach(b=>b.onclick=()=>{S.durum=b.dataset.durum;ciz();});
  root.querySelector('#zegoProgram').onchange=async e=>{S.program=e.target.value;S.alanIdx=S.grupIdx=S.dersIdx=0;await mufredatYukle();ciz();};
  root.querySelector('#zegoAlan').onchange=e=>{S.alanIdx=+e.target.value;S.grupIdx=S.dersIdx=0;ciz();};
  root.querySelector('#zegoGrup').onchange=e=>{S.grupIdx=+e.target.value;S.dersIdx=0;ciz();};
  root.querySelector('#zegoDers').onchange=e=>{S.dersIdx=+e.target.value;};
  root.querySelector('#zegoNot').oninput=e=>{S.not=e.target.value;};
  root.querySelector('#zegoFotoSec').onclick=()=>root.querySelector('#zegoFotoInput').click();
  root.querySelector('#zegoFotoInput').onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>10*1024*1024){toast('Fotoğraf en fazla 10 MB olabilir.','error');return;}S.foto=f;if(S.fotoOniz)URL.revokeObjectURL(S.fotoOniz);S.fotoOniz=URL.createObjectURL(f);ciz();};
}

function kapat(){if(S?.fotoOniz)try{URL.revokeObjectURL(S.fotoOniz)}catch(_){};document.getElementById('zegoArka')?.remove();S=null;}

async function blobResim(blob){return new Promise((resolve,reject)=>{const u=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=e=>{URL.revokeObjectURL(u);reject(e)};img.src=u;});}
async function filigranla(blob){
  try{const img=await blobResim(blob),c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;const x=c.getContext('2d');x.drawImage(img,0,0,c.width,c.height);const k=Math.min(c.width,c.height),pay=Math.max(12,Math.round(k*.035)),ust=Math.max(16,Math.round(k*.055));let alt=Math.max(9,Math.round(ust*.36));x.globalAlpha=.40;x.fillStyle='#fff';x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=Math.max(2,Math.round(ust*.10));x.textAlign='right';x.textBaseline='alphabetic';x.font=`600 ${alt}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;const met='Bir Çiçek Koleji Anaokulu',max=Math.max(80,c.width-pay*2),ol=x.measureText(met).width;if(ol>max)alt=Math.max(8,Math.floor(alt*max/ol));x.font=`600 ${alt}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;x.fillText(met,c.width-pay,c.height-pay);x.font=`800 ${ust}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;x.fillText('BÇKA',c.width-pay,c.height-pay-alt-Math.round(ust*.18));x.globalAlpha=1;return await new Promise(r=>c.toBlob(b=>r(b||blob),'image/jpeg',.9));}catch(e){console.warn('gözlem filigranı',e);return blob;}
}

async function fotoYukle(anahtar,ders){
  if(!S.foto)return null;const b=B();
  if(!b?.resimSikistir||!b?.medyaYukle)throw new Error('Medya yükleyici hazır değil.');
  const sik=await b.resimSikistir(S.foto,1920,.85);const isaretli=await filigranla(sik);
  const tarih=new Date().toISOString().slice(0,10),klasor=`galeri/ogrenci/${S.ogrId}/${S.program}/${tarih}`;
  const sonuc=await b.medyaYukle(isaretli,klasor);const dogrudan=yonetimMi(),durum=dogrudan?'onaylandi':'beklemede';
  const ref=b.doc(b.collection(b.db,'galeri'));
  const p=programBilgi(S.program),simdi=new Date().toISOString();
  await b.setDoc(ref,{url:sonuc.url,bunnyUrl:sonuc.url,bunnyPath:sonuc.yol||'',dosyaTipi:'foto',tip:'image',baslik:ders,etkinlikBaslik:p.ad,aciklama:(S.not||'').trim(),sinif:S.sinif||'',hedefTur:'ogrenci',hedefDeger:S.ogrId,hedefOgrenciId:S.ogrId,hedefOgrenciAd:ogrAd(),kategori:S.program,program:S.program,albumTuru:'egitim',egitimKaydi:true,durum,kazanimAnahtari:anahtar,gozlemDurum:S.durum,ogrenciId:S.ogrId,yukleyen:b.kullanici?.()?.email||'',yukleyenAd:personelAd(),tarih:simdi,yuklemeZamani:simdi,olusturuldu:b.serverTimestamp?b.serverTimestamp():simdi},{merge:true});
  return {id:ref.id,url:sonuc.url,durum,yol:sonuc.yol||''};
}

async function gelisimKaydet(anahtar,ders,foto){
  const b=B(),ref=b.doc(b.db,'ogrenciGelisim',S.ogrId),snap=await b.getDoc(ref),tum=snap.exists()?(snap.data()||{}):{},dis=tum[S.program]||{};
  const kayitlar={...(dis.kayitlar||{})},tarihler={...(dis.tarihler||{})},detay={...(dis.detay||{})},onceki=detay[anahtar]||{},asamalar={...(onceki.asamalar||{})},eski=asamalar[S.durum]||{};
  const simdi=new Date().toISOString(),not=(S.not||'').trim(),onayli=!foto||foto.durum==='onaylandi';
  const yeni={...eski,durum:S.durum,not:not||eski.not||'',tarih:simdi,yazar:personelAd(),paylas:true,...(foto?{fotoUrl:onayli?foto.url:'',fotoDurum:foto.durum,galeriId:foto.id,fotoYol:foto.yol||''}:{})};
  asamalar[S.durum]=yeni;const mevcut=kayitlar[anahtar]||onceki.durum||'',guncel=!mevcut||(SIRA[S.durum]||0)>=(SIRA[mevcut]||0);
  if(guncel){kayitlar[anahtar]=S.durum;tarihler[anahtar]=simdi.slice(0,10);}
  detay[anahtar]={...onceki,...(guncel?{durum:S.durum,not:yeni.not,tarih:yeni.tarih,yazar:yeni.yazar,paylas:true,fotoUrl:yeni.fotoUrl||'',fotoDurum:yeni.fotoDurum||'',galeriId:yeni.galeriId||'',dersAd:ders}:{}),asamalar};
  const yaz={[S.program]:{...dis,kayitlar,tarihler,detay,guncellendi:b.serverTimestamp?b.serverTimestamp():simdi}};
  if(guncel)yaz.sonGozlem={disiplin:S.program,anahtar,dersAd:ders,not:yeni.not,fotoUrl:yeni.fotoUrl||'',fotoDurum:yeni.fotoDurum||'',galeriId:yeni.galeriId||'',durum:S.durum,tarih:simdi,yazar:yeni.yazar,paylas:true};
  await b.setDoc(ref,yaz,{merge:true});
}

async function kaydet(){
  if(!S.durum){toast('Önce Sunuldu, Tekrar ediyor veya Ustalaştı aşamasını seçin.','error');return;}
  const {alan,grup,ders}=secenekler();if(!alan||!grup||!ders){toast('Bir eğitim/kazanım seçin.','error');return;}
  const root=document.getElementById('zegoArka'),btn=root?.querySelector('[data-act="kaydet"]'),pr=root?.querySelector('#zegoProgress');if(btn)btn.disabled=true;if(pr){pr.classList.add('on');pr.textContent=S.foto?'Fotoğraf işleniyor ve gözlem kaydediliyor…':'Gözlem kaydediliyor…';}
  const anahtar=`${alan.id}__${grup.ad||''}__${ders}`;
  try{const foto=await fotoYukle(anahtar,ders);await gelisimKaydet(anahtar,ders,foto);toast(foto&&foto.durum==='beklemede'?'Gözlem kaydedildi · fotoğraf yönetim onayında':'✓ Gözlem kaydedildi','success');const geriSinif=S.sinif;kapat();try{if(typeof window.caAdminGo==='function')window.caAdminGo('egitim',geriSinif);}catch(_){}}
  catch(e){console.error('gelişmiş gözlem',e);toast('Gözlem kaydedilemedi: '+(e.message||e),'error');if(btn)btn.disabled=false;if(pr){pr.textContent='Kayıt tamamlanamadı.';}}
}

export async function gozlemAc(ogrId,ogrAdValue,sinif){
  if(!ogrId)return;stil();S={ogrId,ogrAd:ogrAdValue||'Öğrenci',sinif:sinif||'',program:'montessori',alanlar:[],alanIdx:0,grupIdx:0,dersIdx:0,durum:'',not:'',foto:null,fotoOniz:''};
  const d=document.createElement('div');d.id='zegoArka';d.className='zego-arka';d.innerHTML='<div class="zego-kart"><div style="padding:30px;text-align:center;color:#7C8882">Müfredat yükleniyor…</div></div>';d.onclick=e=>{if(e.target===d)kapat()};document.body.appendChild(d);
  try{await mufredatYukle();ciz();}catch(e){console.error(e);toast('Eğitim programı yüklenemedi.','error');kapat();}
}

export function kur(win=window){
  if(!win||win[KURULUM])return false;
  let deneme=0;const dene=()=>{if(typeof win.caGozlemAc==='function'){eskiCaGozlemAc=win.caGozlemAc;win.caGozlemAc=gozlemAc;win[KURULUM]=true;return;}deneme++;if(deneme<60)setTimeout(dene,100);};dene();return true;
}

kur();
