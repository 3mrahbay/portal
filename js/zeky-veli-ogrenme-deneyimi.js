// Veli ana sayfası: son eğitim sunumu, günlük akış ve çocuk bildirimleri.
// Yalnız seçili çocuğun doğrudan belgelerini / alt koleksiyonunu okur.

const KURULUM = '__zekyVeliOgrenmeDeneyimiV1';
const PROGRAM = {
  montessori:{ ad:'Montessori', renk:'#2D6A45', acik:'#EAF3EC' },
  orman:{ ad:'Orman Okulu', renk:'#4E7A4B', acik:'#EDF4ED' },
  degerler:{ ad:'Değerler Eğitimi', renk:'#74549C', acik:'#F0EAF6' },
  ingilizce:{ ad:'İngilizce Eğitimi', renk:'#2E5C8A', acik:'#E4EEF6' }
};
const ASAMA = {
  S:{ ad:'Sunuldu', ikon:'sparkles', renk:'#64748B', acik:'#F1F5F9' },
  T:{ ad:'Tekrar ediyor', ikon:'repeat-2', renk:'#A66F00', acik:'#FFF6D8' },
  U:{ ad:'Ustalaştı', ikon:'circle-check-big', renk:'#2D7A2D', acik:'#E8F3E8' }
};

let gozlemci = null;
let bildirimYukleme = null;
let bildirimCache = [];
let bildirimZenginlestirme = false;
let anaSayfaIstek = 0;
let anaSayfaPlanli = false;

function P(){ return window.PortalAPI; }
function esc(v){const p=P();return p?.esc?p.esc(String(v==null?'':v)):String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function ogrenci(){const s=P()?.state||{};return s.veliAktifOgrenci||(s.veliOgrenciler||[])[0]||null;}
function sinif(o){const s=P()?.state||{};return s.ayarListesi?.[o?.id]?.kayit?.sinif||o?.sinif||'';}
function tarihHam(v){if(!v)return'';if(typeof v?.toDate==='function')return v.toDate().toISOString();return String(v);}
function tarihYazi(v,saat=false){const d=new Date(tarihHam(v));if(isNaN(d))return'';return d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric',...(saat?{hour:'2-digit',minute:'2-digit'}:{})});}
function bugun(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function bugunMu(v){return tarihHam(v).slice(0,10)===bugun();}
function ikon(){try{if(window.lucideYenile)setTimeout(window.lucideYenile,30);}catch(_){}}

function stil(){
  if(document.getElementById('zeky-veli-ogrenme-stil'))return;
  const s=document.createElement('style');s.id='zeky-veli-ogrenme-stil';s.textContent=`
    .zvo-son{border:1px solid #DCE7DF;border-radius:18px;overflow:hidden;background:linear-gradient(145deg,#F5FAF6,#fff);margin-bottom:14px;cursor:pointer;transition:.18s}.zvo-son:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(34,74,48,.10)}.zvo-son-ic{display:grid;grid-template-columns:142px 1fr;min-height:142px}.zvo-son-gorsel{background:linear-gradient(135deg,#DCEADF,#F5F8F5);min-height:142px;position:relative}.zvo-son-gorsel img{width:100%;height:100%;position:absolute;inset:0;object-fit:cover}.zvo-son-govde{padding:15px 16px;display:flex;flex-direction:column;min-width:0}.zvo-ustetiket{font-size:10px;font-weight:850;letter-spacing:.8px;color:#62806C}.zvo-baslik{font-size:16px;font-weight:850;color:#23382B;line-height:1.35;margin-top:5px}.zvo-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.zvo-pill{font-size:10.5px;font-weight:800;padding:4px 8px;border-radius:999px}.zvo-not{font-size:12.5px;line-height:1.55;color:#506057;margin-top:9px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.zvo-ac{font-size:11px;font-weight:850;color:#2D6A45;margin-top:auto;padding-top:8px}.zvo-akis{position:relative;padding-left:30px}.zvo-adim{position:relative;padding:0 0 13px 10px}.zvo-adim:last-child{padding-bottom:0}.zvo-adim:before{content:'';position:absolute;left:-15px;top:21px;bottom:-2px;width:2px;background:#E3EAE5}.zvo-adim:last-child:before{display:none}.zvo-nokta{position:absolute;left:-22px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;border:4px solid #4A7C59}.zvo-adim b{display:block;font-size:12.5px;color:#2A3A31}.zvo-adim span{display:block;font-size:11.5px;color:#7B8981;margin-top:2px;line-height:1.45}.zvo-popup{position:fixed;inset:0;z-index:10020;background:rgba(21,42,29,.48);backdrop-filter:blur(5px);display:grid;place-items:center;padding:18px}.zvo-popup-kart{width:min(450px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 28px 80px rgba(0,0,0,.25);padding:22px}.zvo-popup-ikon{width:54px;height:54px;border-radius:17px;background:#EAF3EC;color:#2D6A45;display:grid;place-items:center}.zvo-popup-ikon svg{width:26px;height:26px}.zvo-bildirim{border:1px solid #DDE8E0;background:linear-gradient(145deg,#F6FAF7,#fff);border-radius:15px;padding:14px;margin-bottom:9px;cursor:pointer}.zvo-bildirim:hover{border-color:#AFC8B7}.zvo-bildirim b{font-size:13.5px;color:#26382E}.zvo-bildirim p{font-size:12.5px;color:#5F6E65;line-height:1.5;margin:5px 0 0}.zvo-bildirim small{display:block;color:#94A19A;margin-top:7px}
    @media(max-width:560px){.zvo-son-ic{grid-template-columns:104px 1fr}.zvo-son-gorsel{min-height:166px}.zvo-son-govde{padding:13px}.zvo-baslik{font-size:14px}}
  `;document.head.appendChild(s);
}

async function gelisimGetir(o){const p=P();if(!p?.fb||!p?.db||!o?.id)return{};const s=await p.fb.getDoc(p.fb.doc(p.db,'ogrenciGelisim',o.id));return s.exists()?(s.data()||{}):{};}

function sonSunumHTML(gel){
  const g=gel?.sonGozlem;if(!g||g.paylas===false)return`<div class="zvo-son" style="cursor:default"><div style="padding:18px;text-align:center;color:#7C8B82;font-size:12.5px"><div style="font-size:28px;margin-bottom:6px">🌱</div>Henüz veliyle paylaşılan bir eğitim sunumu yok.</div></div>`;
  const pr=PROGRAM[g.disiplin]||{ad:g.programAd||'Eğitim',renk:'#2D6A45',acik:'#EAF3EC'},as=ASAMA[g.durum]||{ad:'Gelişim kaydı',renk:'#64748B',acik:'#F1F5F9'};
  const foto=(!g.galeriId||!g.fotoDurum||g.fotoDurum==='onaylandi')?(g.fotoUrl||''):'';
  return`<div class="zvo-son" role="button" tabindex="0" data-zvo-son data-program="${esc(g.disiplin||'')}" data-key="${esc(g.anahtar||'')}"><div class="zvo-son-ic"><div class="zvo-son-gorsel" style="background:${pr.acik}">${foto?`<img src="${esc(foto)}" alt="${esc(g.dersAd||'Son eğitim sunumu')}" loading="lazy">`:`<div style="height:100%;display:grid;place-items:center;color:${pr.renk};font-size:34px">🌿</div>`}</div><div class="zvo-son-govde"><div class="zvo-ustetiket">SON EĞİTİM SUNUMU</div><div class="zvo-baslik">${esc(g.dersAd||'Yeni kazanım')}</div><div class="zvo-meta"><span class="zvo-pill" style="background:${pr.acik};color:${pr.renk}">${esc(pr.ad)}</span><span class="zvo-pill" style="background:${as.acik};color:${as.renk}">${esc(as.ad)}</span></div>${g.not?`<div class="zvo-not">${esc(g.not)}</div>`:''}<div class="zvo-ac">Sunumu ve tüm aşamaları gör →</div></div></div></div>`;
}

function duz(v){if(v==null)return'';if(typeof v==='string'||typeof v==='number')return String(v);if(typeof v==='object'){const x=v.deger??v.miktar??v.durum??v.metin??v.ad??v.yuzde??v.sure;if(x!=null)return String(x);const ilk=Object.values(v).find(y=>typeof y==='string'||typeof y==='number');return ilk==null?'':String(ilk);}return'';}
const YEMEK={tamami:'Tamamını yedi',yarisi:'Yarısını yedi',az:'Az yedi',yemedi:'Yemedi'};
const UYKU={uyudu:'Uyudu',kisa:'Kısa uyudu',uyumadi:'Uyumadı'};
const TUVALET={kendi:'Kendi yaptı',yardimla:'Yardımla yaptı',kaza:'Kaza oldu',bez:'Bez'};
function akisAdimlari(rapor,gel,etkinlikler){
  const a=[];(etkinlikler||[]).forEach(e=>a.push({b:e.baslik||'Bugünün etkinliği',m:[e.baslangicSaat,e.konum].filter(Boolean).join(' · ')||e.aciklama||'Takvim etkinliği'}));
  const y=rapor?.yemek||{};[['Kahvaltı',y.kahvalti],['Öğle yemeği',y.ogle||y.anaYemek],['İkindi',y.ikindi]].forEach(([b,v])=>{v=duz(v);if(v)a.push({b,m:YEMEK[v]||v});});
  const u=duz(rapor?.uyku?.durum??rapor?.uyku);if(u)a.push({b:'Dinlenme ve uyku',m:UYKU[u]||u});
  const t=duz(rapor?.tuvalet);if(t)a.push({b:'Tuvalet',m:TUVALET[t]||t});
  const g=gel?.sonGozlem;if(g&&g.paylas!==false&&bugunMu(g.tarih)){const p=PROGRAM[g.disiplin]?.ad||g.programAd||'Eğitim';a.push({b:`${p} · ${ASAMA[g.durum]?.ad||'Yeni aşama'}`,m:g.dersAd||g.not||'Yeni kazanım kaydı'});}
  if(rapor?.not)a.push({b:'Öğretmen notu',m:rapor.not});
  return a;
}

function etkinlikUygun(e,o){const h=e?.hedefTur||'tumOkul';return h==='tumOkul'||(h==='ogrenci'&&(e.hedefDeger===o.id||e.hedefOgrenciId===o.id))||(h==='sinif'&&String(e.hedefDeger||'')===String(sinif(o)));}
async function bugununEtkinlikleri(o){const p=P();if(!p?.fb||!p?.db)return[];const oku=async ad=>{try{const q=p.fb.query(p.fb.collection(p.db,ad),p.fb.where('tarih','==',bugun()));const s=await p.fb.getDocs(q),l=[];s.forEach(d=>{const v=d.data()||{};if(!v.arsiv&&etkinlikUygun(v,o))l.push({id:d.id,...v});});return l;}catch(e){console.warn('günlük akış etkinlik',ad,e?.code||e?.message);return[];}};const [a,b]=await Promise.all([oku('etkinlikler'),oku('takvim')]);return [...a,...b];}

async function anaSayfayiZenginlestir(){
  const o=ogrenci(),ozet=document.getElementById('caHomeEgitimOzet'),dash=document.querySelector('.ca-page .ca-dash');if(!o?.id||!ozet||!dash)return;
  const istek=++anaSayfaIstek;const p=P();
  let son=document.getElementById('zekyHomeSonSunum');if(!son){son=document.createElement('div');son.id='zekyHomeSonSunum';ozet.parentElement.insertBefore(son,ozet);}
  let bas=document.getElementById('zekyHomeTumKazanimlar');if(!bas){bas=document.createElement('div');bas.id='zekyHomeTumKazanimlar';bas.style.cssText='font-size:11px;font-weight:850;color:#6F7F76;letter-spacing:.65px;margin:2px 1px 9px';bas.textContent='TÜM KAZANIMLAR';ozet.parentElement.insertBefore(bas,ozet);}
  let akis=document.getElementById('zekyHomeGunlukAkisBolum');if(!akis){akis=document.createElement('div');akis.id='zekyHomeGunlukAkisBolum';dash.insertBefore(akis,dash.firstChild);}
  if(son.dataset.zvoOgrenci===o.id&&son.dataset.zvoDurum==='hazir'&&akis.dataset.zvoOgrenci===o.id&&akis.dataset.zvoDurum==='hazir')return;
  son.dataset.zvoOgrenci=o.id;son.dataset.zvoDurum='yukleniyor';akis.dataset.zvoOgrenci=o.id;akis.dataset.zvoDurum='yukleniyor';
  son.innerHTML='<div class="zvo-son" style="cursor:default;padding:18px;text-align:center;color:#7C8B82;font-size:12px">Son eğitim sunumu yükleniyor…</div>';
  akis.innerHTML='<div class="ca-sectionhead"><h3 class="ca-head" style="font-size:15px">Günlük Akış</h3></div><div class="ca-card" style="padding:18px;text-align:center;color:var(--c-muted);font-size:12px">Bugünün adımları yükleniyor…</div>';
  try{
    const [gel,raporS,etkinlikler]=await Promise.all([gelisimGetir(o),p.fb.getDoc(p.fb.doc(p.db,'gunlukRaporlar',`${o.id}__${bugun()}`)).catch(()=>null),bugununEtkinlikleri(o)]);if(istek!==anaSayfaIstek||ogrenci()?.id!==o.id)return;
    son.innerHTML=sonSunumHTML(gel);const r=raporS?.exists?.()?raporS.data():null,adimlar=akisAdimlari(r,gel,etkinlikler);
    akis.innerHTML=`<div class="ca-sectionhead"><h3 class="ca-head" style="font-size:15px">Günlük Akış</h3><button class="ca-link" data-zvo-gunluk>Tüm gün →</button></div><div class="ca-card" style="padding:15px 16px">${adimlar.length?`<div class="zvo-akis">${adimlar.map(x=>`<div class="zvo-adim"><i class="zvo-nokta"></i><b>${esc(x.b)}</b><span>${esc(x.m)}</span></div>`).join('')}</div>`:`<div style="text-align:center;padding:12px;color:#7D8A83;font-size:12.5px">Bugünün akışı henüz paylaşılmadı.</div>`}</div>`;
    son.dataset.zvoDurum='hazir';akis.dataset.zvoDurum='hazir';son.querySelector('[data-zvo-son]')?.addEventListener('click',e=>sunumAc(e.currentTarget.dataset.program,e.currentTarget.dataset.key));son.querySelector('[data-zvo-son]')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')sunumAc(e.currentTarget.dataset.program,e.currentTarget.dataset.key);});akis.querySelector('[data-zvo-gunluk]')?.addEventListener('click',()=>window.caGo?.('gunluk'));ikon();
  }catch(e){console.warn('veli öğrenme özeti',e);son.dataset.zvoDurum='hazir';akis.dataset.zvoDurum='hazir';son.innerHTML='<div class="zvo-son" style="cursor:default;padding:18px;text-align:center;color:#7C8B82;font-size:12px">Eğitim özeti şu anda yüklenemedi.</div>';}
}

function anaSayfayiPlanla(){if(anaSayfaPlanli)return;anaSayfaPlanli=true;setTimeout(()=>{anaSayfaPlanli=false;anaSayfayiZenginlestir();},80);}

function sunumAc(program,anahtar){window.__zekyEgitimBaslangic={program,anahtar};window.veliSwitchTab?.('yeniapp');setTimeout(()=>window.caGo?.('egitim'),30);}
function galeriAc(){window.__zekyGaleriBaslangicFiltre='egitim';window.veliSwitchTab?.('yeniapp');setTimeout(()=>window.caGo?.('galeri'),30);}

async function ogrenciBildirimleriGetir(force=false){
  if(bildirimYukleme&&!force)return bildirimYukleme;const o=ogrenci(),p=P();if(!o?.id||!p?.fb||!p?.db)return[];
  bildirimYukleme=(async()=>{try{const s=await p.fb.getDocs(p.fb.collection(p.db,'ogrenciler',o.id,'bildirimler')),l=[];s.forEach(d=>l.push({id:d.id,...(d.data()||{})}));const donem=String(p.state?.aktifDonem||'');bildirimCache=l.filter(x=>!x.donem||!donem||String(x.donem)===donem).sort((a,b)=>tarihHam(b.olusturuldu||b.tarih).localeCompare(tarihHam(a.olusturuldu||a.tarih)));return bildirimCache;}catch(e){console.warn('veli öğrenci bildirimleri',e?.code||e?.message);return[];}finally{bildirimYukleme=null;}})();return bildirimYukleme;
}

async function etkinlikBildirimleriGetir(o){
  const p=P();if(!o?.id||!p?.fb||!p?.db)return[];const oku=async ad=>{try{const s=await p.fb.getDocs(p.fb.collection(p.db,ad)),l=[];s.forEach(d=>{const v=d.data()||{};if(v.arsiv||!v.tarih||v.tarih<bugun()||!etkinlikUygun(v,o))return;l.push({id:`etkinlik:${ad}:${d.id}`,tip:'etkinlik_yeni',baslik:`Yeni etkinlik · ${v.baslik||'Okul etkinliği'}`,icerik:[tarihYazi(v.tarih),v.baslangicSaat,v.konum].filter(Boolean).join(' · '),olusturuldu:v.olusturuldu||v.guncellendi||`${v.tarih}T00:00:00`,etkinlikTarih:v.tarih});});return l;}catch(e){console.warn('veli etkinlik bildirimi',ad,e?.code||e?.message);return[];}};const [a,b]=await Promise.all([oku('etkinlikler'),oku('takvim')]);return[...a,...b].sort((x,y)=>tarihHam(y.olusturuldu).localeCompare(tarihHam(x.olusturuldu))).slice(0,15);
}

async function duyuruPopupGetir(o){const p=P();if(!o?.id||!p?.fb||!p?.db)return[];try{const s=await p.fb.getDocs(p.fb.collection(p.db,'duyurular')),l=[];s.forEach(d=>{const v=d.data()||{};if(v.arsiv||v.simsek||!etkinlikUygun(v,o))return;l.push({id:`duyuru:${d.id}`,tip:'duyuru_yeni',baslik:v.baslik||'Yeni duyuru',icerik:v.icerik||'',olusturuldu:v.olusturuldu||v.olusturulmaTarihi||v.guncellendi||''});});return l;}catch(e){console.warn('veli duyuru popup',e?.code||e?.message);return[];}}

async function sonGozlemBildirimiGetir(o){try{const gel=await gelisimGetir(o),g=gel?.sonGozlem;if(!g||g.paylas===false)return[];return[{id:`gelisim:${g.disiplin||''}:${g.anahtar||''}:${g.durum||''}:${tarihHam(g.tarih)}`,tip:'egitim_gelisim',baslik:`${g.dersAd||'Yeni kazanım'} · ${ASAMA[g.durum]?.ad||'Yeni aşama'}`,icerik:g.not||`${PROGRAM[g.disiplin]?.ad||g.programAd||'Eğitim'} programında yeni bir gelişim kaydı var.`,program:g.disiplin,kazanimAnahtari:g.anahtar,gozlemDurum:g.durum,olusturuldu:g.tarih}];}catch(_){return[];}}

async function bildirimHavuzuGetir(){const o=ogrenci();if(!o?.id)return[];const [ogr,etk,son]=await Promise.all([ogrenciBildirimleriGetir(),etkinlikBildirimleriGetir(o),sonGozlemBildirimiGetir(o)]);const gelisimVar=ogr.some(x=>x.tip==='egitim_gelisim'&&x.kazanimAnahtari===son[0]?.kazanimAnahtari&&x.gozlemDurum===son[0]?.gozlemDurum);return[...ogr,...etk,...(gelisimVar?[]:son)].sort((a,b)=>tarihHam(b.olusturuldu||b.tarih).localeCompare(tarihHam(a.olusturuldu||a.tarih)));}

function bildirimEylemi(b){if(b.tip==='egitim_gelisim')sunumAc(b.program,b.kazanimAnahtari);else if(String(b.tip||'').includes('galeri'))galeriAc();else if(String(b.tip||'').includes('etkinlik')){window.veliSwitchTab?.('yeniapp');setTimeout(()=>window.caGo?.('takvim'),30);}else window.veliSwitchTab?.('bildirimler');}
function bildirimIkon(b){return b.tip==='egitim_gelisim'?'sprout':String(b.tip||'').includes('galeri')?'images':String(b.tip||'').includes('etkinlik')?'calendar-heart':'bell';}
async function bildirimleriZenginlestir(){
  const el=document.getElementById('veliBildirimlerContent');if(!el||document.getElementById('zekyOgrenciBildirimleri')||bildirimZenginlestirme)return;bildirimZenginlestirme=true;const l=await bildirimHavuzuGetir().finally(()=>{bildirimZenginlestirme=false;});if(!el.isConnected||document.getElementById('zekyOgrenciBildirimleri')||!l.length)return;
  const d=document.createElement('div');d.id='zekyOgrenciBildirimleri';d.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div><div style="font-size:10.5px;font-weight:850;letter-spacing:.7px;color:#708078">ÇOCUĞUNUZDAN YENİLİKLER</div><h3 style="font-size:16px;margin:3px 0 0;color:#26382E">Eğitim, galeri ve öğrenci bildirimleri</h3></div><span style="font-size:11px;color:#8A9890">${l.length} kayıt</span></div>${l.slice(0,30).map(b=>`<div class="zvo-bildirim" data-zvo-bildirim="${esc(b.id)}"><b>${esc(b.baslik||'Yeni bildirim')}</b>${b.icerik?`<p>${esc(b.icerik)}</p>`:''}<small>${tarihYazi(b.olusturuldu||b.tarih,true)}</small></div>`).join('')}<div style="height:10px"></div>`;el.insertBefore(d,el.firstChild);d.querySelectorAll('[data-zvo-bildirim]').forEach(x=>x.onclick=()=>{const b=l.find(y=>y.id===x.dataset.zvoBildirim);if(b)bildirimEylemi(b);});[...el.children].forEach(x=>{if(x!==d&&x.textContent?.includes('Henüz bildiriminiz yok'))x.style.display='none';});
}

function seenAnahtar(o){const mail=window.BCK?.kullanici?.()?.email||'veli';return`zeky-bildirim-seen:${mail.toLowerCase()}:${o.id}`;}
function popupSeenOku(o){try{return new Set(JSON.parse(localStorage.getItem(seenAnahtar(o))||'[]'));}catch(_){return new Set();}}
function popupSeenYaz(o,s){try{localStorage.setItem(seenAnahtar(o),JSON.stringify([...s].slice(-180)));}catch(_){}}
function popupGoster(kuyruk,idx,o,seen){if(idx>=kuyruk.length)return;if(document.getElementById('simsekOverlay')||document.getElementById('zekyVeliBildirimPopup')){setTimeout(()=>popupGoster(kuyruk,idx,o,seen),900);return;}const b=kuyruk[idx],d=document.createElement('div');d.id='zekyVeliBildirimPopup';d.className='zvo-popup';d.innerHTML=`<div class="zvo-popup-kart"><div style="display:flex;align-items:flex-start;gap:13px"><div class="zvo-popup-ikon"><i data-lucide="${bildirimIkon(b)}"></i></div><div style="flex:1;min-width:0"><div style="font-size:10.5px;font-weight:850;letter-spacing:.75px;color:#65816E">YENİ BİLDİRİM</div><h3 style="font-size:18px;line-height:1.35;margin:5px 0 0;color:#23382B">${esc(b.baslik||'Yeni gelişme')}</h3></div><button type="button" data-kapat style="border:0;background:#F1F5F2;border-radius:50%;width:38px;height:38px;font-size:21px;cursor:pointer">×</button></div>${b.icerik?`<div style="margin-top:15px;background:#F5F9F6;border:1px solid #E1EAE3;border-radius:14px;padding:13px 14px;font-size:13px;line-height:1.6;color:#4C5D53">${esc(b.icerik)}</div>`:''}<div style="font-size:11px;color:#8C9991;margin-top:10px">${tarihYazi(b.olusturuldu||b.tarih,true)}${kuyruk.length>1?` · ${idx+1}/${kuyruk.length}`:''}</div><div style="display:flex;gap:9px;margin-top:17px"><button type="button" data-sonra style="flex:1;border:0;border-radius:12px;padding:12px;background:#EDF1EE;color:#546159;font-weight:750;cursor:pointer">Kapat</button><button type="button" data-detay style="flex:1;border:0;border-radius:12px;padding:12px;background:#2D6A45;color:#fff;font-weight:800;cursor:pointer">Detayı Gör</button></div></div>`;const bitir=detay=>{seen.add(b.id);popupSeenYaz(o,seen);d.remove();if(detay)bildirimEylemi(b);else setTimeout(()=>popupGoster(kuyruk,idx+1,o,seen),180);};d.querySelector('[data-kapat]').onclick=()=>bitir(false);d.querySelector('[data-sonra]').onclick=()=>bitir(false);d.querySelector('[data-detay]').onclick=()=>bitir(true);d.onclick=e=>{if(e.target===d)bitir(false);};document.body.appendChild(d);ikon();}
async function popupKontrol(){const o=ogrenci();if(!o?.id)return;const [l,duy]=await Promise.all([bildirimHavuzuGetir(),duyuruPopupGetir(o)]),seen=popupSeenOku(o),esik=Date.now()-7*86400000;const kuyruk=[...l,...duy].filter(b=>!seen.has(b.id)&&new Date(tarihHam(b.olusturuldu||b.tarih)).getTime()>=esik).sort((a,b)=>tarihHam(b.olusturuldu||b.tarih).localeCompare(tarihHam(a.olusturuldu||a.tarih))).slice(0,5);if(kuyruk.length)popupGoster(kuyruk,0,o,seen);}

function sekmeKopru(){const eski=window.veliSwitchTab;if(typeof eski!=='function'||eski.__zekyOgrenme)return;const yeni=function(tab,...args){const r=eski.call(this,tab,...args);if(tab==='bildirimler'){[450,1100,2100].forEach(ms=>setTimeout(bildirimleriZenginlestir,ms));}if(tab==='yeniapp')setTimeout(anaSayfayiZenginlestir,180);return r;};yeni.__zekyOgrenme=true;yeni.__eski=eski;window.veliSwitchTab=yeni;}

export function kur(win=window){if(!win||win[KURULUM])return false;stil();sekmeKopru();gozlemci=new MutationObserver(()=>{if(document.getElementById('caHomeEgitimOzet'))anaSayfayiPlanla();if(document.getElementById('veliBildirimlerContent')&&!document.getElementById('zekyOgrenciBildirimleri'))setTimeout(bildirimleriZenginlestir,350);});gozlemci.observe(document.body,{childList:true,subtree:true});setTimeout(anaSayfayiPlanla,700);setTimeout(popupKontrol,2300);win.zekySonSunumAc=sunumAc;win.zekyEgitimGalerisiAc=galeriAc;win[KURULUM]=true;return true;}

if(typeof window!=='undefined')kur();
