// VELİ GALERİSİ — güvenli sınıf hedefleme + gerçek albüm/klasör görünümü
const P = () => window.PortalAPI;
let _filtre = 'tumu';
let _medya = [];
let _albumler = [];
let _tekiller = [];
let _acikAlbum = '';

const KATEGORILER = [
  { k:'tumu', ad:'Tümü' },
  { k:'orman', ad:'Orman', esle:['orman','doğa','doga','bahçe','bahce','yürüyüş'] },
  { k:'sanat', ad:'Sanat', esle:['sanat','atölye','atolye','boya','resim','el işi'] },
  { k:'oyun', ad:'Oyun', esle:['oyun','hareket','jimnastik','dans','müzik','muzik'] },
  { k:'etkinlik', ad:'Etkinlikler', esle:['şenlik','senlik','kutlama','bayram','gösteri','gezi'] }
];
const RENK = [['#F9A8D4','#EC4899'],['#86EFAC','#22C55E'],['#FDE68A','#F59E0B'],['#C4B5FD','#8B5CF6'],['#93C5FD','#3B82F6'],['#FCA5A5','#EF4444']];

function kucuk(url,w=600){if(!url)return'';return url.includes('?')?`${url}&width=${w}`:`${url}?width=${w}`;}
function kategoriEsle(m){const s=((m.etkinlikBaslik||'')+' '+(m.kategori||'')+' '+(m.aciklama||'')).toLocaleLowerCase('tr');for(const k of KATEGORILER){if(k.esle?.some(x=>s.includes(x)))return k.k;}return'etkinlik';}
function sinifAnahtar(v){let s=String(v||'').toLocaleLowerCase('tr').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]/g,'');s=s.replace(/ciceklerisinifi|cicekler|sinifi|sinif/g,'');if(s.includes('papatya')||s.includes('mimoza')||s==='montessori1'||s==='toddler')return'mimoza';if(s.includes('kardelen')||s.includes('yasemin')||s==='montessori2')return'yasemin';if(s.includes('nar')||s.includes('lavanta')||s==='montessori3')return'lavanta';if(s.includes('ilkadim'))return'ilkadimlar';return s;}
function sinifEslesir(a,b){return !!a&&!!b&&sinifAnahtar(a)===sinifAnahtar(b);}
function albumKey(m){return String(m.albumId||'').trim()||[String(m.etkinlikTarih||'').slice(0,10),(m.etkinlikBaslik||'Diğer').trim(),m.hedefTur||'',m.hedefDeger||''].join('|');}
function tarih(m){return String(m.etkinlikTarih||m.yuklemeZamani||'').slice(0,10);}
function tarihYazi(t){if(!t)return'';const d=new Date(t+'T12:00:00');return isNaN(d)?t:d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});}

async function yukle(){
  const {fb,db,state}=P();
  const ogr=state.veliAktifOgrenci||state.veliOgrenciler[0];
  if(!ogr){_medya=[];_albumler=[];_tekiller=[];return;}
  const sinif=(state.ayarListesi[ogr.id]?.kayit?.sinif)||ogr.sinif||'';
  _medya=[];
  try{
    const snap=await fb.getDocs(fb.query(fb.collection(db,'galeri'),fb.where('durum','==','onaylandi')));
    snap.forEach(d=>{
      const v=d.data()||{};
      const kapsam=v.hedefTur==='tumOkul'||(v.hedefTur==='sinif'&&sinifEslesir(v.hedefDeger,sinif))||(v.hedefTur==='ogrenci'&&(v.hedefDeger===ogr.id||v.hedefOgrenciId===ogr.id));
      if(!kapsam||!v.bunnyUrl)return;
      _medya.push({id:d.id,...v});
    });
  }catch(e){console.warn('veli galeri',e.code||e.message);}
  _medya.sort((a,b)=>String(b.etkinlikTarih||b.yuklemeZamani||'').localeCompare(String(a.etkinlikTarih||a.yuklemeZamani||'')));
  const gruplar=new Map();
  _medya.forEach(m=>{const k=albumKey(m);if(!gruplar.has(k))gruplar.set(k,{id:k,ad:(m.etkinlikBaslik||'Albüm').trim()||'Albüm',tarih:tarih(m),medya:[]});gruplar.get(k).medya.push(m);});
  _albumler=[];_tekiller=[];
  gruplar.forEach(g=>{if(g.medya.length>1)_albumler.push(g);else _tekiller.push(g.medya[0]);});
  _albumler.sort((a,b)=>String(b.tarih).localeCompare(String(a.tarih)));
}

export async function render(hedefId){
  const el=document.getElementById(hedefId);if(!el)return;
  const {esc,lucide}=P();
  el.innerHTML='<div class="ca-card" style="text-align:center;padding:24px;color:var(--c-muted);font-size:13px">Yükleniyor…</div>';
  await yukle();
  if(!_medya.length){el.innerHTML='<div class="ca-card" style="text-align:center;padding:36px 22px"><div style="font-size:38px">📷</div><div style="font-weight:700;margin-top:8px">Henüz paylaşılan anı yok</div><div class="ca-tile-sub" style="margin-top:5px">Öğretmenler fotoğraf paylaştığında ve yönetim onayladığında burada görünecek.</div></div>';return;}
  if(_acikAlbum){albumDetay(el,hedefId);lucide();return;}
  const medyaFiltre=m=>_filtre==='tumu'||kategoriEsle(m)===_filtre;
  const albumler=_albumler.map(a=>({...a,medya:a.medya.filter(medyaFiltre)})).filter(a=>a.medya.length>1);
  const tekiller=_tekiller.filter(medyaFiltre);
  el.innerHTML=`<div class="ca-chips" style="overflow-x:auto;padding-bottom:4px">${KATEGORILER.map(k=>{const n=k.k==='tumu'?_medya.length:_medya.filter(m=>kategoriEsle(m)===k.k).length;if(!n&&k.k!=='tumu')return'';return`<button class="ca-chip ${_filtre===k.k?'active':''}" onclick="window._vg.filtre('${k.k}','${hedefId}')">${k.ad} <span style="opacity:.6">${n}</span></button>`;}).join('')}</div>
  ${albumler.length?`<div class="ca-sectionhead" style="margin-top:15px"><h3 class="ca-head" style="font-size:15px">Albümler</h3><span class="ca-tile-sub">${albumler.length} klasör</span></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px">${albumler.map((a,i)=>albumKart(a,i,hedefId,esc)).join('')}</div>`:''}
  ${tekiller.length?`<div class="ca-sectionhead" style="margin-top:16px"><h3 class="ca-head" style="font-size:15px">Fotoğraflar</h3><span class="ca-tile-sub">${tekiller.length} tek içerik</span></div>${masonry(tekiller,hedefId)}`:''}`;
  lucide();
}
function albumKart(a,i,hedefId,esc){const[c1,c2]=RENK[i%RENK.length];const kapak=a.medya.find(m=>m.dosyaTipi!=='video')||a.medya[0];return`<button onclick="window._vg.albumAc('${String(a.id).replace(/'/g,'')}','${hedefId}')" style="border:0;background:#fff;border-radius:16px;overflow:hidden;padding:0;text-align:left;box-shadow:0 2px 10px rgba(15,23,42,.06);cursor:pointer"><div style="height:126px;background:linear-gradient(135deg,${c1},${c2});position:relative;overflow:hidden">${kapak?.bunnyUrl?`<img src="${esc(kucuk(kapak.kucukResim||kapak.bunnyUrl,420))}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`:''}<span style="position:absolute;right:9px;top:9px;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800">📁 ${a.medya.length}</span></div><div style="padding:10px 11px"><div style="font-size:13px;font-weight:800;color:var(--c-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.ad)}</div><div class="ca-tile-sub" style="font-size:10.5px;margin-top:2px">${tarihYazi(a.tarih)}</div></div></button>`;}
function masonry(liste,hedefId){const{esc}=P();return`<div style="column-count:3;column-gap:8px" class="vg-masonry">${liste.map(m=>`<div style="break-inside:avoid;margin-bottom:8px;border-radius:12px;overflow:hidden;background:var(--c-tint,#F1F5F9);cursor:pointer" onclick="window._vg.buyut('${m.id}','${hedefId}')"><img src="${esc(kucuk(m.kucukResim||m.bunnyUrl,700))}" loading="lazy" alt="${esc(m.etkinlikBaslik||'Anı')}" style="width:100%;display:block" onerror="this.style.display='none';this.parentElement.style.minHeight='120px'"></div>`).join('')}</div>`;}
function albumDetay(el,hedefId){const{esc}=P();const a=_albumler.find(x=>x.id===_acikAlbum);if(!a){_acikAlbum='';render(hedefId);return;}el.innerHTML=`<div class="ca-row" style="margin-bottom:12px"><button class="ca-back" onclick="window._vg.albumKapat('${hedefId}')">←</button><div><div class="ca-tile-sub">ALBÜM</div><h3 class="ca-head" style="font-size:16px">${esc(a.ad)}</h3><div class="ca-tile-sub">${tarihYazi(a.tarih)}</div></div><span class="ca-tile-sub" style="margin-left:auto">${a.medya.length} fotoğraf</span></div>${masonry(a.medya,hedefId)}`;}
function buyut(id,hedefId){const{esc}=P();const havuz=_acikAlbum?(_albumler.find(a=>a.id===_acikAlbum)?.medya||[]):_medya;const i=havuz.findIndex(m=>m.id===id);if(i<0)return;const m=havuz[i];document.getElementById('vgLightbox')?.remove();const d=document.createElement('div');d.id='vgLightbox';d.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.96);z-index:3000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px';d.onclick=e=>{if(e.target===d)d.remove()};d.innerHTML=`<img src="${esc(m.bunnyUrl)}" style="max-width:100%;max-height:76vh;border-radius:12px;object-fit:contain"><div style="color:#fff;text-align:center;margin-top:12px"><div style="font-weight:800">${esc(m.etkinlikBaslik||'')}</div><div style="font-size:11.5px;opacity:.65;margin-top:4px">${tarihYazi(tarih(m))} · ${i+1}/${havuz.length}</div></div><div style="display:flex;gap:10px;margin-top:14px">${i>0?`<button onclick="window._vg.buyut('${havuz[i-1].id}','${hedefId}')" class="ca-back">‹</button>`:''}<button onclick="document.getElementById('vgLightbox').remove()" class="ca-back">×</button>${i<havuz.length-1?`<button onclick="window._vg.buyut('${havuz[i+1].id}','${hedefId}')" class="ca-back">›</button>`:''}</div>`;document.body.appendChild(d);}
window._vg={filtre:(k,h)=>{_filtre=k;_acikAlbum='';render(h)},albumAc:(id,h)=>{_acikAlbum=id;render(h)},albumKapat:h=>{_acikAlbum='';render(h)},buyut};
