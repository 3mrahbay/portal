// Yönetim galeri onayında eğitim fotoğrafını kazanım bağlamıyla gösterir.

const KURULUM='__zekyGaleriOnayEgitimV3';
const PROGRAM={montessori:'Montessori',orman:'Orman Okulu',degerler:'Değerler Eğitimi',ingilizce:'İngilizce Eğitimi'};
const ASAMA={S:'Sunuldu',T:'Tekrar ediyor',U:'Ustalaştı'};
let gozlemci=null;
let onarimZamanlayici=0,onarimCalisiyor=false;
const onarilanKayitlar=new Set();

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function programKodu(m){const s=String(m?.program||m?.kategori||m?.etkinlikBaslik||'').toLocaleLowerCase('tr');if(s.includes('montessori'))return'montessori';if(s.includes('orman'))return'orman';if(s.includes('değer')||s.includes('deger'))return'degerler';if(s.includes('ingiliz')||s.includes('english'))return'ingilizce';return PROGRAM[s]?s:'';}
function egitimMi(m){return m?.egitimKaydi===true||m?.albumTuru==='egitim'||Boolean(m?.kazanimAnahtari&&programKodu(m));}
function bekliyor(m){return m?.durum==='beklemede'||m?.durum==='onayBekliyor';}
function yonetimMi(){const s=window.PortalAPI?.state||{};return!!s.isAdmin||['kurucu_mudur','mudur'].includes(String(s.rol||''));}
function veri(id){return(window.galeriListesiVerisi||[]).find(x=>x.id===id)||null;}
function kartId(k){const x=String(k?.getAttribute?.('onclick')||'').match(/acGaleriLightbox\('([^']+)'\)/);return x?.[1]||'';}
function tarih(m){const d=new Date(m?.tarih||m?.yuklemeZamani||m?.olusturmaTarihi||'');return isNaN(d)?'':d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});}

function stil(){if(document.getElementById('zeky-galeri-onay-egitim-stil'))return;const s=document.createElement('style');s.id='zeky-galeri-onay-egitim-stil';s.textContent=`.zgo-kisa{position:absolute;left:0;right:0;bottom:45px;padding:24px 8px 7px;background:linear-gradient(transparent,rgba(7,20,13,.86));color:#fff;pointer-events:none}.zgo-kisa b{display:block;font-size:10.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.zgo-kisa span{display:block;font-size:9px;opacity:.82;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.zgo-detay{width:min(390px,36vw);min-width:290px;padding:22px;overflow:auto;background:#fff;color:#26382E}.zgo-detay h3{font-size:18px;line-height:1.35;margin:6px 0 0}.zgo-rozetler{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}.zgo-rozet{font-size:10.5px;font-weight:800;padding:5px 9px;border-radius:999px;background:#EAF3EC;color:#2D6A45}.zgo-aciklama{font-size:13px;line-height:1.65;color:#526158;background:#F5F8F6;border-radius:13px;padding:12px;margin-top:14px}.zgo-bilgi{display:grid;grid-template-columns:92px 1fr;gap:7px;font-size:11.5px;margin-top:14px}.zgo-bilgi span{color:#89958E}.zgo-bilgi b{color:#35463C;overflow-wrap:anywhere}.zgo-actions{display:flex;gap:8px;margin-top:18px}.zgo-actions button{flex:1;border:0;border-radius:11px;padding:11px;color:#fff;font-weight:800;cursor:pointer}@media(max-width:760px){#galeriLightboxIcerik.zgo-grid{display:flex!important;flex-direction:column;overflow:auto!important;max-height:88vh!important}.zgo-detay{width:100%;min-width:0;box-sizing:border-box}.zgo-medya{min-height:42vh}.zgo-medya img{max-height:52vh!important}}`;document.head.appendChild(s);}

function kartlariZenginlestir(){
  const liste=document.getElementById('galeriListesi');if(!liste)return;
  liste.querySelectorAll("[onclick*='acGaleriLightbox(']").forEach(k=>{const id=kartId(k),m=veri(id);if(!m||!egitimMi(m)||!bekliyor(m)||k.querySelector('.zgo-kisa'))return;const d=document.createElement('div');d.className='zgo-kisa';d.innerHTML=`<b>${esc(m.baslik||m.kazanimAdi||'Eğitim kazanımı')}</b><span>${esc(PROGRAM[programKodu(m)]||m.programAd||'Eğitim')} · ${esc(ASAMA[m.gozlemDurum]||'Aşama')} ${m.aciklama?'· açıklamalı':''}</span>`;k.appendChild(d);});
}

function detayHTML(m){const p=PROGRAM[programKodu(m)]||m.programAd||'Eğitim',a=ASAMA[m.gozlemDurum]||m.gozlemDurum||'Gelişim aşaması';return`<aside class="zgo-detay"><div style="font-size:10px;font-weight:850;letter-spacing:.8px;color:#738279">EĞİTİM ONAYI</div><h3>${esc(m.baslik||m.kazanimAdi||m.etkinlikBaslik||'Eğitim kazanımı')}</h3><div class="zgo-rozetler"><span class="zgo-rozet">${esc(p)}</span><span class="zgo-rozet" style="background:#FFF5D8;color:#9A6800">${esc(a)}</span>${m.alanAd?`<span class="zgo-rozet" style="background:#EEF2F7;color:#536274">${esc(m.alanAd)}</span>`:''}</div>${m.aciklama?`<div class="zgo-aciklama"><b style="display:block;font-size:11px;color:#2D6A45;margin-bottom:5px">Gözlem açıklaması</b>${esc(m.aciklama)}</div>`:'<div class="zgo-aciklama" style="color:#8B9690">Bu gözlem için açıklama girilmemiş.</div>'}<div class="zgo-bilgi"><span>Öğrenci</span><b>${esc(m.hedefOgrenciAd||'—')}</b><span>Gelişim alanı</span><b>${esc(m.alanAd||m.alanId||'—')}</b><span>Grup</span><b>${esc(m.grupAd||'—')}</b><span>Öğretmen</span><b>${esc(m.yukleyenAd||'—')}</b><span>Tarih</span><b>${esc(tarih(m)||'—')}</b></div>${bekliyor(m)&&yonetimMi()?`<div class="zgo-actions"><button type="button" data-zgo-red style="background:#DC2626">Reddet</button><button type="button" data-zgo-onay style="background:#168447">Onayla</button></div>`:''}</aside>`;}

function lightboxZenginlestir(id){
  const m=veri(id),icerik=document.getElementById('galeriLightboxIcerik');if(!m||!icerik||!egitimMi(m))return;
  const medya=icerik.innerHTML;icerik.classList.add('zgo-grid');icerik.style.cssText='background:white;border-radius:16px;overflow:hidden;max-height:92vh;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;justify-content:center;max-width:94vw';icerik.innerHTML=`<div class="zgo-medya" style="min-width:0;background:#111;display:grid;place-items:center;overflow:hidden">${medya}</div>${detayHTML(m)}`;const img=icerik.querySelector('.zgo-medya img');if(img)img.style.cssText='width:100%;height:100%;max-width:min(64vw,980px);max-height:92vh;object-fit:contain';icerik.querySelector('[data-zgo-onay]')?.addEventListener('click',async()=>{window.closeGaleriLightbox?.();await window.galeriOnayla?.(id);});icerik.querySelector('[data-zgo-red]')?.addEventListener('click',async()=>{window.closeGaleriLightbox?.();await window.galeriReddet?.(id);});
}

function fonksiyonlariSar(){const eski=window.acGaleriLightbox;if(typeof eski!=='function'||eski.__zekyEgitimDetay)return false;const yeni=function(id,...args){const r=eski.call(this,id,...args);setTimeout(()=>lightboxZenginlestir(id),0);return r;};yeni.__zekyEgitimDetay=true;yeni.__eski=eski;window.acGaleriLightbox=yeni;return true;}

function api(){const p=window.PortalAPI||{},b=window.BCK||{};return{db:p.db||b.db,fb:p.fb||b};}
async function galeriBelgesi(id){const{db,fb}=api();if(!db||!fb?.getDoc||!fb?.doc)return null;const s=await fb.getDoc(fb.doc(db,'galeri',id));return s.exists()?{id,...(s.data()||{})}:null;}
export async function egitimOnayiniEsitle(id,durum){
  const{db,fb}=api();if(!db||!fb?.getDoc||!fb?.setDoc||!fb?.doc)return false;
  const m=await galeriBelgesi(id);if(!m||m.durum!==durum||!egitimMi(m))return false;
  const ogrenciId=m.ogrenciId||m.hedefOgrenciId||(m.hedefTur==='ogrenci'?m.hedefDeger:''),program=programKodu(m),anahtar=m.kazanimAnahtari||'',kod=m.gozlemDurum||'';
  if(!ogrenciId||!program||!anahtar||!ASAMA[kod])return false;
  const ref=fb.doc(db,'ogrenciGelisim',ogrenciId),snap=await fb.getDoc(ref),tum=snap.exists()?(snap.data()||{}):{},dis=tum[program]||{},detay={...(dis.detay||{})},onceki=detay[anahtar]||{},asamalar={...(onceki.asamalar||{})},eski=asamalar[kod]||{};
  const fotoUrl=durum==='onaylandi'?(m.url||m.bunnyUrl||''):'',simdi=new Date().toISOString(),tarih=m.tarih||m.yuklemeZamani||eski.tarih||simdi,not=m.aciklama||eski.not||onceki.not||'';
  asamalar[kod]={...eski,durum:kod,tarih,not,yazar:m.yukleyenAd||eski.yazar||'',paylas:durum==='onaylandi',fotoUrl,fotoDurum:durum,galeriId:id};
  detay[anahtar]={...onceki,durum:kod,dersAd:m.kazanimAdi||m.baslik||onceki.dersAd||'',alanId:m.alanId||onceki.alanId||'',alanAd:m.alanAd||onceki.alanAd||'',grupAd:m.grupAd||onceki.grupAd||'',not,tarih,yazar:m.yukleyenAd||onceki.yazar||'',paylas:durum==='onaylandi',fotoUrl,fotoDurum:durum,galeriId:id,asamalar};
  const kayitlar={...(dis.kayitlar||{}),[anahtar]:kod},tarihler={...(dis.tarihler||{}),[anahtar]:String(tarih).slice(0,10)};
  const yaz={[program]:{...dis,kayitlar,tarihler,detay,guncellendi:fb.serverTimestamp?fb.serverTimestamp():simdi}};
  if(durum==='onaylandi'&&(!tum.sonGozlem||tum.sonGozlem.galeriId===id||String(tarih)>=String(tum.sonGozlem.tarih||''))){yaz.sonGozlem={...(tum.sonGozlem||{}),disiplin:program,programAd:PROGRAM[program]||m.programAd||'Eğitim',anahtar,dersAd:m.kazanimAdi||m.baslik||'',alanId:m.alanId||'',alanAd:m.alanAd||'',grupAd:m.grupAd||'',not,fotoUrl,fotoDurum:durum,galeriId:id,durum:kod,tarih,yazar:m.yukleyenAd||'',paylas:true};}
  await fb.setDoc(ref,yaz,{merge:true});
  if(durum==='onaylandi'){
    const bildirimRef=fb.doc(db,'ogrenciler',ogrenciId,'bildirimler',`egitim_${id}`);
    try{await fb.setDoc(bildirimRef,{tip:'egitim_gelisim',baslik:`${m.kazanimAdi||m.baslik||'Eğitim sunumu'} · ${ASAMA[kod]}`,icerik:not||`${PROGRAM[program]||'Eğitim'} programında yeni bir gelişim aşaması onaylandı.`,program,programAd:PROGRAM[program]||m.programAd||'',alanId:m.alanId||'',alanAd:m.alanAd||'',grupAd:m.grupAd||'',kazanimAnahtari:anahtar,kazanimAdi:m.kazanimAdi||m.baslik||'',gozlemDurum:kod,galeriId:id,fotoDurum:'onaylandi',fotoUrl,tarih,olusturuldu:m.onayTarihi||simdi,gonderenAd:m.yukleyenAd||'',okundu:false,donem:m.donem||''},{merge:true});}
    catch(e){console.warn('Eğitim bildirimi oluşturulamadı; gelişim kaydı yayınlandı',e?.code||e?.message||e);}
  }
  return true;
}

// Önceki bir oturumda ek köprü kurulmadan onaylanmış fotoğrafları da onarır.
// Yönetim Galeri ekranını açtığında belleğe gelen onaylı eğitim kayıtları aynı
// id ile yeniden eşitlenir; işlem idempotenttir ve sayfa başına yalnız bir kez
// çalışır. Böylece yalnız yeni onaylar değil, mevcut kayıp yayınlar da düzelir.
async function onayliKayitlariOnar(){
  if(onarimCalisiyor||!yonetimMi())return;
  const liste=(window.galeriListesiVerisi||[]).filter(m=>m?.id&&m.durum==='onaylandi'&&egitimMi(m)&&!onarilanKayitlar.has(m.id));
  if(!liste.length)return;
  onarimCalisiyor=true;
  try{
    for(const m of liste){
      try{if(await egitimOnayiniEsitle(m.id,'onaylandi'))onarilanKayitlar.add(m.id);}
      catch(e){console.warn('Onaylı eğitim kaydı onarılamadı',m.id,e?.code||e?.message||e);}
    }
  }finally{onarimCalisiyor=false;}
}
function onarimiPlanla(){clearTimeout(onarimZamanlayici);onarimZamanlayici=setTimeout(onayliKayitlariOnar,450);}

function onayFonksiyonlariniSar(){
  let hazir=true;
  for(const [ad,durum] of [['galeriOnayla','onaylandi'],['galeriReddet','reddedildi']]){
    const eski=window[ad];if(typeof eski!=='function'){hazir=false;continue;}if(eski.__zekyEgitimOnayEsitle)continue;
    const yeni=async function(id,...args){const r=await eski.call(this,id,...args);try{if(await egitimOnayiniEsitle(id,durum))onarilanKayitlar.add(id);}catch(e){console.warn('Eğitim onayı veliye eşitlenemedi',e?.code||e?.message||e);}return r;};
    yeni.__zekyEgitimOnayEsitle=true;yeni.__eski=eski;window[ad]=yeni;
  }
  return hazir;
}

export function kur(win=window){if(!win||win[KURULUM])return false;stil();let n=0;const dene=()=>{const a=fonksiyonlariSar()||Boolean(win.acGaleriLightbox?.__zekyEgitimDetay),b=onayFonksiyonlariniSar();if(a&&b)return;if(++n<120)setTimeout(dene,100);};dene();gozlemci=new MutationObserver(()=>{kartlariZenginlestir();onarimiPlanla();});gozlemci.observe(document.body,{childList:true,subtree:true});setTimeout(()=>{kartlariZenginlestir();onarimiPlanla();},800);win[KURULUM]=true;return true;}

if(typeof window!=='undefined')kur();
