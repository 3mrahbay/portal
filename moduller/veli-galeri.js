import { galleryLightboxStyles, galleryLightboxIcons, lightboxDownload } from '../js/portal-galeri-lightbox-ui.js';
import { mountMedia, disposeMedia, recordOpen, downloadMedia } from '../js/portal-galeri-canli.js?v=181';
import { targetChild, isGalleryParent, childTargetMatches, galleryChildClass, galleryParentKey } from '../js/portal-galeri-etkilesim.js?v=166';
import { GALLERY_PROGRAMS, galleryProgram, galleryTopic, galleryIsObservation, galleryFolderKey } from '../js/galeri-klasorleri.js';
import { galleryMediaType, galleryDisplayUrl } from '../js/portal-galeri-medya.js?v=181';
// VELİ GALERİSİ — hedefli okuma; klasör anahtarları erişim yetkisi vermez.
const P = () => window.PortalAPI;
let _filtre = 'tumu';
let _tur = 'tumu';
let _dialog = null, _dialogOrigin = null, _dialogHistory = '', _closingHistory = false;
let _bodyOverflow = '', _dialogPriorState = null;
let _hedefEl = null;
let _dialogNo = 0;
let _medya = [];
let _albumler = [];
let _tekiller = [];
let _acikAlbum = '';
let _egitimProgram = '';
let _egitimAlan = '';
let _aktifKapsam = '';
let _yuklenenKapsam = '';
let _renderNo = 0;
let _eylemNo = 0;
let _okumaEksik = false;
let _teknikDurum = null;
const _eylemler = new Map();

const PROGRAM_RENKLERI = {
  montessori:['#4A7C59','#EAF3EC'], orman:['#5C8B5A','#EDF4ED'],
  degerler:['#7B5EA7','#F0EAF6'], ingilizce:['#2E5C8A','#E4EEF6'],
  degerlerPlus:['#A65C83','#F8EAF2'], jimnastik:['#C56D2D','#FFF0DF'],
  drama:['#9656A7','#F4EAF8'], kodlama:['#286E95','#E6F2FA']
};
const PROGRAMLAR = Object.fromEntries(Object.entries(GALLERY_PROGRAMS).map(([k,ad])=>{
  const [renk,acik]=PROGRAM_RENKLERI[k]||['#64748B','#F1F5F9'];return[k,{ad,renk,acik}];
}));
const DIGER_PROGRAM = {ad:'Diğer Eğitimler',renk:'#64748B',acik:'#F1F5F9'};
const ASAMA = { S:'Sunuldu', T:'Tekrar ediyor', U:'Ustalaştı' };
const KATEGORILER = [
  { k:'tumu', ad:'Tümü' },
  { k:'egitim', ad:'Eğitim' },
  { k:'orman', ad:'Orman', esle:['orman','doğa','doga','bahçe','bahce','yürüyüş'] },
  { k:'sanat', ad:'Sanat', esle:['sanat','atölye','atolye','boya','resim','el işi'] },
  { k:'oyun', ad:'Oyun', esle:['oyun','hareket','jimnastik','dans','müzik','muzik'] },
  { k:'etkinlik', ad:'Etkinlikler', esle:['şenlik','senlik','kutlama','bayram','gösteri','gezi'] }
];
const RENK = [['#F9A8D4','#EC4899'],['#86EFAC','#22C55E'],['#FDE68A','#F59E0B'],['#C4B5FD','#8B5CF6'],['#93C5FD','#3B82F6'],['#FCA5A5','#EF4444']];
const IZGARA = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px';

function kucuk(url,w=600){if(!url)return'';return url.includes('?')?`${url}&width=${w}`:`${url}?width=${w}`;}
function programKodu(m){return galleryProgram(m);}
function egitimMi(m){return Boolean(programKodu(m))||galleryIsObservation(m)||m?.egitimKaydi===true||m?.albumTuru==='egitim';}
function kategoriEsle(m){if(egitimMi(m))return'egitim';const s=((m.etkinlikBaslik||'')+' '+(m.kategori||'')+' '+(m.aciklama||'')).toLocaleLowerCase('tr');for(const k of KATEGORILER){if(k.esle?.some(x=>s.includes(x)))return k.k;}return'etkinlik';}
function sinifAnahtar(v){let s=String(v||'').toLocaleLowerCase('tr').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]/g,'');s=s.replace(/ciceklerisinifi|cicekler|sinifi|sinif/g,'');if(s.includes('papatya')||s.includes('mimoza')||s==='montessori1'||s==='toddler')return'mimoza';if(s.includes('kardelen')||s.includes('yasemin')||s==='montessori2')return'yasemin';if(s.includes('nar')||s.includes('lavanta')||s==='montessori3')return'lavanta';if(s.includes('ilkadim'))return'ilkadimlar';return s;}
function sinifEslesir(a,b){return !!a&&!!b&&sinifAnahtar(a)===sinifAnahtar(b);}
function sinifAdaylari(s){const h={mimoza:['Mimoza Çiçekleri Sınıfı','Mimoza','Papatyalar Sınıfı','Montessori 1','Toddler'],yasemin:['Yasemin Çiçekleri Sınıfı','Yasemin','Kardelenler Sınıfı','Montessori 2'],lavanta:['Lavanta Çiçekleri Sınıfı','Lavanta','Nar Çiçekleri Sınıfı','Montessori 3'],ilkadimlar:['İlk Adımlar','İlk Adımlar Sınıfı']};return[...new Set([s,...(h[sinifAnahtar(s)]||[])].filter(Boolean))];}
function aktifOgrenci(){const s=P().state;return s.veliAktifOgrenci||s.veliOgrenciler?.[0];}
function aktifSinif(ogr){return galleryChildClass(ogr,P().state);}
function kapsamAnahtari(){return galleryParentKey(P().state);}
function secimleriSifirla(){_acikAlbum='';_egitimProgram='';_egitimAlan='';}
function erisebilir(m){const ogr=aktifOgrenci();return _yuklenenKapsam===kapsamAnahtari()&&isGalleryParent(P().state)&&!!ogr&&!!targetChild(m,[ogr],P().state);}
// Only local numbers enter handlers; titles, IDs, targets and JSON keys stay in closures.
function eylem(fn){const id=++_eylemNo,kapsam=_yuklenenKapsam;_eylemler.set(id,button=>{if(kapsam===kapsamAnahtari())return fn(button);});return`window._vg.eylem(${id},this)`;}
function albumKey(m){return String(m.albumId||'').trim()||JSON.stringify([String(m.etkinlikTarih||'').slice(0,10),(m.etkinlikBaslik||'Diğer').trim(),m.hedefTur||'',m.hedefDeger||'']);}
function tarih(m){return String(m?.etkinlikTarih||m?.yuklemeZamani||'').slice(0,10);}
function tarihYazi(t){if(!t)return'';const d=new Date(t+'T12:00:00');return isNaN(d)?t:d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});}
function alanKodu(m){return String(m?.alanId||m?.kazanimAnahtari||'').split('__')[0]||'genel';}
function alanAdi(m){const ad=String(m?.alanAd||'').trim();if(ad)return ad;return alanKodu(m).replace(/[-_]+/g,' ').replace(/\b\w/g,x=>x.toLocaleUpperCase('tr'));}
function klasorAdi(m){return galleryIsObservation(m)?alanAdi(m):galleryTopic(m);}
function programListe(){return _medya.filter(m=>turEslesir(m)&&egitimMi(m)&&(programKodu(m)||'diger')===_egitimProgram);}
function turEslesir(m){return _tur==='tumu'||galleryMediaType(m)===_tur;}
function medyaFiltre(m){return turEslesir(m)&&(_filtre==='tumu'||kategoriEsle(m)===_filtre);}
function albumMedya(){return(_albumler.find(a=>a.id===_acikAlbum)?.medya||[]).filter(medyaFiltre);}
function gorunenMedya(){return _egitimAlan?programListe().filter(m=>galleryFolderKey(m)===_egitimAlan):_acikAlbum?albumMedya():_medya.filter(medyaFiltre);}

async function hedefliGaleriOku(fb,db,ogr,sinif){
  const ortak=[fb.where('durum','==','onaylandi')];
  const sorgular=[
    fb.query(fb.collection(db,'galeri'),...ortak,fb.where('hedefTur','==','tumOkul')),
    ...sinifAdaylari(sinif).map(ad=>fb.query(fb.collection(db,'galeri'),...ortak,fb.where('hedefTur','==','sinif'),fb.where('hedefDeger','==',ad))),
    fb.query(fb.collection(db,'galeri'),...ortak,fb.where('hedefTur','==','ogrenci'),fb.where('hedefDeger','==',ogr.id)),
    fb.query(fb.collection(db,'galeri'),...ortak,fb.where('hedefOgrenciId','==',ogr.id)),
    fb.query(fb.collection(db,'galeri'),...ortak,fb.where('ogrenciId','==',ogr.id))
  ];
  const sonuclar=await Promise.allSettled(sorgular.map(q=>fb.getDocs(q)));
  const benzersiz=new Map();
  sonuclar.forEach(r=>{
    if(r.status!=='fulfilled')return;
    r.value.forEach(d=>{const v=d.data()||{};if(v.durum!=='onaylandi')return;benzersiz.set(d.id,{...v,id:d.id,bunnyUrl:galleryDisplayUrl(v),dosyaTipi:galleryMediaType(v)});});
  });
  const izinliKodlar=['permission-denied','failed-precondition','unavailable','deadline-exceeded','unauthenticated','resource-exhausted','cancelled'];
  const hatalar=sonuclar.filter(r=>r.status!=='fulfilled').map(r=>izinliKodlar.includes(r.reason?.code)?r.reason.code:'unknown');
  return {medya:[...benzersiz.values()],eksik:hatalar.length>0,sorgular:{toplam:sonuclar.length,basarili:sonuclar.length-hatalar.length,hataKodlari:[...new Set(hatalar)]}};
}

async function yukle(ogr,sinif,donem){
  if(!ogr)return{medya:[],eksik:false};
  const {fb,db}=P();
  let medya=[],eksik=false,tani={sinifDogrulandi:!!sinif,sorgular:{toplam:0,basarili:0,hataKodlari:[]},donem:{ayni:0,belirsiz:0,farkli:0}};
  try{
    const hedefli=await hedefliGaleriOku(fb,db,ogr,sinif);
    eksik=hedefli.eksik;tani.sorgular=hedefli.sorgular;
    medya=hedefli.medya.filter(v=>{
      const kapsam=v.hedefTur==='tumOkul'||(v.hedefTur==='sinif'&&sinifEslesir(v.hedefDeger,sinif))||(v.hedefTur==='ogrenci'&&childTargetMatches(v,ogr.id));
      if(!kapsam||!v.bunnyUrl)return false;
      tani.donem[!v.donem||!donem?'belirsiz':v.donem===donem?'ayni':'farkli']++;
      return !v.donem||!donem||v.donem===donem;
    });
  }catch(e){eksik=true;tani.sorgular.hataKodlari=['unknown'];}
  tani.gorunen={toplam:medya.length,foto:medya.filter(m=>galleryMediaType(m)==='foto').length,video:medya.filter(m=>galleryMediaType(m)==='video').length};
  tani.programlar=Object.fromEntries([...Object.keys(GALLERY_PROGRAMS),'diger'].map(k=>[k,medya.filter(m=>(programKodu(m)||'diger')===k).length]));
  return {tani,medya:medya.sort((a,b)=>String(b.etkinlikTarih||b.yuklemeZamani||'').localeCompare(String(a.etkinlikTarih||a.yuklemeZamani||''))),eksik};
}
function albumleriHazirla(){
  const gruplar=new Map();
  // Program media live in topic/development folders, not duplicate date albums.
  _medya.filter(m=>!egitimMi(m)).forEach(m=>{const k=albumKey(m);if(!gruplar.has(k))gruplar.set(k,{id:k,ad:(m.etkinlikBaslik||'Albüm').trim()||'Albüm',tarih:tarih(m),medya:[]});gruplar.get(k).medya.push(m);});
  _albumler=[];_tekiller=[];
  gruplar.forEach(g=>{if(g.medya.length>1)_albumler.push(g);else _tekiller.push(g.medya[0]);});
  _albumler.sort((a,b)=>String(b.tarih).localeCompare(String(a.tarih)));
}

export async function render(hedefId){
  const el=document.getElementById(hedefId);if(!el)return;_hedefEl=el;
  const {esc,lucide}=P(),renderNo=++_renderNo,kapsam=kapsamAnahtari(),ogr=aktifOgrenci();
  kapat();disposeMedia(el);_eylemler.clear();
  if(_aktifKapsam!==kapsam){secimleriSifirla();_tur='tumu';_aktifKapsam=kapsam;}
  _medya=[];_albumler=[];_tekiller=[];_yuklenenKapsam='';_teknikDurum=null;
  el.innerHTML='<div class="ca-card" style="text-align:center;padding:24px;color:var(--c-muted);font-size:13px">Yükleniyor…</div>';
  const sonuc=isGalleryParent(P().state)?await yukle(ogr,aktifSinif(ogr),P().state.aktifDonem):{medya:[],eksik:false};
  if(renderNo!==_renderNo||kapsam!==kapsamAnahtari())return;
  _medya=sonuc.medya;_okumaEksik=sonuc.eksik;_teknikDurum=sonuc.tani||null;_yuklenenKapsam=kapsam;albumleriHazirla();
  if(window.__zekyGaleriBaslangicFiltre==='egitim'){_filtre='egitim';secimleriSifirla();window.__zekyGaleriBaslangicFiltre='';}
  if(!_medya.length&&(sonuc.eksik||(isGalleryParent(P().state)&&!aktifSinif(ogr)))){el.innerHTML=okumaUyarisi(hedefId)+teknikDurum();return;}
  if(!_medya.length){el.innerHTML='<div class="ca-card" style="text-align:center;padding:36px 22px"><div style="font-size:38px">📷</div><div style="font-weight:700;margin-top:8px">Henüz paylaşılan anı yok</div><div class="ca-tile-sub" style="margin-top:5px">Öğretmenler fotoğraf veya video paylaştığında ve yönetim onayladığında burada görünecek.</div></div>'+teknikDurum();return;}
  if(_acikAlbum&&!_albumler.some(a=>a.id===_acikAlbum))_acikAlbum='';
  if(_acikAlbum){albumDetay(el,hedefId);videoKapaklari(el);lucide();return;}
  if(_filtre==='egitim'){egitimKlasorleri(el,hedefId);videoKapaklari(el);lucide();return;}
  // A mixed album reduced to one matching item must remain reachable.
  const albumler=_albumler.map(a=>({...a,medya:a.medya.filter(medyaFiltre)})).filter(a=>a.medya.length>0);
  const tekiller=_tekiller.filter(medyaFiltre),egitim=_medya.filter(m=>turEslesir(m)&&egitimMi(m));
  el.innerHTML=turCubugu(hedefId)+`<div class="ca-chips" style="overflow-x:auto;padding-bottom:4px">${KATEGORILER.map(k=>{const n=k.k==='tumu'?_medya.filter(turEslesir).length:_medya.filter(m=>turEslesir(m)&&kategoriEsle(m)===k.k).length;if(!n&&k.k!=='tumu')return'';return`<button class="ca-chip ${_filtre===k.k?'active':''}" onclick="${eylem(()=>window._vg.filtre(k.k,hedefId))}">${k.ad} <span style="opacity:.6">${n}</span></button>`;}).join('')}</div>
  ${_filtre==='tumu'&&egitim.length?`<div class="ca-sectionhead" style="margin-top:15px"><h3 class="ca-head" style="font-size:15px">Programlar</h3></div>${programKartlari(egitim,hedefId)}`:''}
  ${albumler.length?`<div class="ca-sectionhead" style="margin-top:15px"><h3 class="ca-head" style="font-size:15px">Albümler</h3><span class="ca-tile-sub">${albumler.length} klasör</span></div><div style="${IZGARA}">${albumler.map((a,i)=>albumKart(a,i,hedefId,esc)).join('')}</div>`:''}
  ${tekiller.length?`<div class="ca-sectionhead" style="margin-top:16px"><h3 class="ca-head" style="font-size:15px">Fotoğraflar ve videolar</h3><span class="ca-tile-sub">${tekiller.length} tek içerik</span></div>${masonry(tekiller,hedefId)}`:''}`;
  if(!_medya.some(medyaFiltre))el.innerHTML+='<div role="status" class="ca-card" style="padding:20px">Bu görünümde seçilen türde içerik yok.</div>';
  videoKapaklari(el);lucide();
}

function okumaUyarisi(hedefId){
  const sinifEksik=isGalleryParent(P().state)&&!aktifSinif(aktifOgrenci());
  if(!_okumaEksik&&!sinifEksik)return'';
  const mesaj=_okumaEksik?'Bazı galeri sorguları tamamlanamadı. Görünen içerik ve sayılar eksik olabilir.':'Güncel dönem sınıfı doğrulanamadı. Sınıf paylaşımları gösterilemiyor; görünen içerik eksik olabilir.';
  return `<div role="status" class="ca-card" style="padding:14px;margin-bottom:12px"><div>${mesaj}</div><button type="button" class="ca-link" onclick="${eylem(()=>window._vg.tekrar(hedefId))}">Tekrar dene</button></div>`;
}
function teknikDurum(){
  if(!_teknikDurum)return'';
  return `<div style="margin-bottom:12px"><button type="button" class="ca-link" aria-expanded="false" onclick="${eylem(button=>window._vg.teknik(button))}">Teknik durum</button><pre hidden data-vg-diagnostic style="white-space:pre-wrap;font-size:11px">${P().esc(JSON.stringify(_teknikDurum,null,2))}</pre></div>`;
}
function turCubugu(hedefId){
  return okumaUyarisi(hedefId)+teknikDurum()+`<div class="ca-chips" role="group" aria-label="Medya türü" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${[['tumu','Tümü'],['foto','Fotoğraflar'],['video','Videolar']].map(([k,ad])=>`<button type="button" class="ca-chip ${_tur===k?'active':''}" aria-pressed="${_tur===k}" onclick="${eylem(()=>window._vg.tur(k,hedefId))}">${ad} <span style="opacity:.6">${_medya.filter(m=>k==='tumu'||galleryMediaType(m)===k).length}</span></button>`).join('')}</div>`;
}

function klasorKart(ad,alt,sayi,renk,acik,onclick,kapak){const{esc}=P();return`<button type="button" onclick="${onclick}" style="min-width:0;border:0;background:#fff;border-radius:18px;overflow:hidden;padding:0;text-align:left;box-shadow:0 2px 12px rgba(15,23,42,.07);cursor:pointer"><div style="height:118px;background:linear-gradient(135deg,${acik},#fff);position:relative;overflow:hidden">${kapak?`<img src="${esc(kucuk(kapak,480))}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`:''}<span style="position:absolute;left:13px;bottom:12px;width:42px;height:42px;border-radius:14px;background:${renk};color:#fff;display:grid;place-items:center;font-size:20px">📁</span><span style="position:absolute;right:10px;top:10px;background:rgba(15,23,42,.68);color:#fff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800">${sayi}</span></div><div style="padding:11px 13px;overflow-wrap:anywhere"><div style="font-size:13.5px;font-weight:850;color:var(--c-ink)">${esc(ad)}</div><div class="ca-tile-sub" style="font-size:10.5px;margin-top:3px">${esc(alt)}</div></div></button>`;}
function klasorTarihleri(ms){const tarihler=[...new Set(ms.map(tarih).filter(Boolean))].sort();if(!tarihler.length)return'';return tarihler.length===1?tarihYazi(tarihler[0]):`${tarihYazi(tarihler[0])} – ${tarihYazi(tarihler.at(-1))}`;}
function kapakUrl(ms){const m=ms.find(m=>m.dosyaTipi!=='video'||m.kucukResim);return m?.dosyaTipi==='video'?m.kucukResim:m?.bunnyUrl;}
function programKartlari(liste,hedefId){
  const gr=new Map();liste.forEach(m=>{const k=programKodu(m)||'diger';if(!gr.has(k))gr.set(k,[]);gr.get(k).push(m);});
  return`<div style="${IZGARA}">${[...gr].map(([k,ms])=>{const p=PROGRAMLAR[k]||DIGER_PROGRAM,alan=new Set(ms.filter(galleryIsObservation).map(galleryFolderKey)).size,konu=new Set(ms.filter(m=>!galleryIsObservation(m)).map(galleryFolderKey)).size;const alt=[konu?`${konu} konu klasörü`:'',alan?`${alan} gelişim alanı`:''].filter(Boolean).join(' · ');return klasorKart(p.ad,alt,ms.length,p.renk,p.acik,eylem(()=>window._vg.egitimProgramAc(k,hedefId)),kapakUrl(ms));}).join('')}</div>`;
}
function egitimKlasorleri(el,hedefId){
  const {esc}=P(),liste=_medya.filter(m=>turEslesir(m)&&egitimMi(m));
  if(_egitimProgram&&!_medya.some(m=>egitimMi(m)&&(programKodu(m)||'diger')===_egitimProgram)){_egitimProgram='';_egitimAlan='';}
  if(_egitimAlan&&!_medya.some(m=>galleryFolderKey(m)===_egitimAlan))_egitimAlan='';
  const ust=turCubugu(hedefId)+`<div class="ca-row" style="margin-bottom:13px">${_egitimProgram?`<button class="ca-back" onclick="${eylem(()=>window._vg.egitimGeri(hedefId))}" aria-label="Geri">←</button>`:''}<div style="min-width:0;overflow-wrap:anywhere"><div class="ca-tile-sub">EĞİTİM GALERİSİ</div><h3 class="ca-head" style="font-size:17px">${_egitimProgram?esc((PROGRAMLAR[_egitimProgram]||DIGER_PROGRAM).ad):'Programlar ve gelişim alanları'}</h3><div class="ca-tile-sub">Yalnızca yönetimce onaylanan fotoğraf ve videolar</div></div>${!_egitimProgram?`<button class="ca-link" style="margin-left:auto" onclick="${eylem(()=>window._vg.filtre('tumu',hedefId))}">Tüm Galeri</button>`:''}</div>`;
  if(!liste.length){el.innerHTML=ust+'<div class="ca-card" style="text-align:center;padding:34px 20px"><div style="font-size:34px">📚</div><div style="font-weight:800;margin-top:8px">Eğitim galerisi henüz boş</div><div class="ca-tile-sub" style="margin-top:5px">Onaylanan paylaşımlar program, konu ve gelişim alanı klasörlerinde görünür.</div></div>';return;}
  if(!_egitimProgram){el.innerHTML=ust+programKartlari(liste,hedefId);return;}
  const medya=programListe();
  if(!_egitimAlan){
    const gr=new Map();medya.forEach(m=>{const k=galleryFolderKey(m);if(!gr.has(k))gr.set(k,[]);gr.get(k).push(m);});
    const p=PROGRAMLAR[_egitimProgram]||DIGER_PROGRAM;
    el.innerHTML=ust+`<div style="${IZGARA}">${[...gr].map(([k,ms])=>{const gozlem=galleryIsObservation(ms[0]),hedef=ms[0].hedefTur==='sinif'?ms[0].hedefDeger:ms[0].hedefTur==='tumOkul'?'Tüm okul':'';const alt=gozlem?`${ms.length} aşama kaydı`:[`${ms.length} içerik`,hedef,ms[0].donem,klasorTarihleri(ms)].filter(Boolean).join(' · ');return klasorKart(klasorAdi(ms[0]),alt,ms.length,p.renk,p.acik,eylem(()=>window._vg.egitimAlanAc(k,hedefId)),kapakUrl(ms));}).join('')}</div>`;return;
  }
  const alanListe=medya.filter(m=>galleryFolderKey(m)===_egitimAlan);
  el.innerHTML=ust+`<div class="ca-row" style="justify-content:space-between;margin:2px 0 10px;gap:10px"><strong style="font-size:14px;min-width:0;overflow-wrap:anywhere">${esc(klasorAdi(alanListe[0]||_medya.find(m=>galleryFolderKey(m)===_egitimAlan)||{}))}</strong><span class="ca-tile-sub">${alanListe.length} kayıt</span></div>${masonry(alanListe,hedefId)}`;
}
function albumKart(a,i,hedefId,esc){const[c1,c2]=RENK[i%RENK.length];const kapak=a.medya.find(m=>m.dosyaTipi!=='video')||a.medya[0];return`<button onclick="${eylem(()=>window._vg.albumAc(a.id,hedefId))}" style="min-width:0;border:0;background:#fff;border-radius:16px;overflow:hidden;padding:0;text-align:left;box-shadow:0 2px 10px rgba(15,23,42,.06);cursor:pointer"><div style="height:126px;background:linear-gradient(135deg,${c1},${c2});position:relative;overflow:hidden">${kapak?.bunnyUrl?`<div data-vg-thumbnail="${esc(kapak.id)}" style="width:100%;height:100%"><img src="${esc(kucuk(kapak.kucukResim||kapak.bunnyUrl,420))}" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>`:''}<span style="position:absolute;right:9px;top:9px;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800">📁 ${a.medya.length}</span></div><div style="padding:10px 11px"><div style="font-size:13px;font-weight:800;color:var(--c-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.ad)}</div><div class="ca-tile-sub" style="font-size:10.5px;margin-top:2px">${esc(tarihYazi(a.tarih))}</div></div></button>`;}
function masonry(liste,hedefId){const{esc}=P();return`<div style="column-count:3;column-gap:8px" class="vg-masonry">${liste.map(m=>`<button type="button" aria-label="${esc(galleryMediaType(m)==='video'?'Videoyu aç':'Fotoğrafı büyüt')}" style="width:100%;border:0;padding:0;text-align:left;break-inside:avoid;margin-bottom:8px;border-radius:12px;overflow:hidden;background:var(--c-tint,#F1F5F9);cursor:pointer" data-vg-thumbnail="${esc(m.id)}" onclick="${eylem(button=>buyut(m.id,hedefId,button))}"><img src="${esc(kucuk(m.kucukResim||m.bunnyUrl,700))}" loading="lazy" alt="${esc(galleryTopic(m)||'Anı')}" style="width:100%;display:block" onerror="this.style.display='none';this.parentElement.style.minHeight='120px'"></button>`).join('')}</div>`;}
function albumDetay(el,hedefId){const{esc}=P(),a=_albumler.find(x=>x.id===_acikAlbum),medya=albumMedya();el.innerHTML=turCubugu(hedefId)+`<div class="ca-row" style="margin-bottom:12px"><button class="ca-back" onclick="${eylem(()=>window._vg.albumKapat(hedefId))}" aria-label="Geri">←</button><div style="min-width:0;overflow-wrap:anywhere"><div class="ca-tile-sub">ALBÜM</div><h3 class="ca-head" style="font-size:16px">${esc(a.ad)}</h3><div class="ca-tile-sub">${esc(tarihYazi(a.tarih))}</div></div><span class="ca-tile-sub" style="margin-left:auto">${medya.length} içerik</span></div>${masonry(medya,hedefId)}`;}
function buyut(id,hedefId,origin){
  if(_closingHistory)return;
  const{esc}=P(),havuz=gorunenMedya(),i=havuz.findIndex(m=>m.id===id);if(i<0)return;
  const m=havuz[i],gozlem=galleryIsObservation(m);if(!erisebilir(m))return;
  const replacing=!!_dialog;
  if(!replacing){_dialogOrigin=origin||document.activeElement;_bodyOverflow=document.body.style?.overflow||'';if(document.body.style)document.body.style.overflow='hidden';}
  temizle(false);const d=document.createElement('div');_dialog=d;d.id='vgLightbox';d.className='vg-lightbox';d.setAttribute?.('role','dialog');d.setAttribute?.('aria-modal','true');d.setAttribute?.('aria-label',galleryMediaType(m)==='video'?'Video':'Fotoğraf');d.tabIndex=-1;d.onclick=e=>{if(e.target===d)kapat()};
  d.innerHTML=`<style>${galleryLightboxStyles}</style>
    <div class="vg-lb-top"><span class="vg-lb-position">${galleryMediaType(m)==='video'?'Video':'Fotoğraf'} · ${i+1}/${havuz.length}</span><button type="button" class="vg-lb-btn" onclick="${eylem(kapat)}" aria-label="Kapat" title="Kapat (Esc)">${galleryLightboxIcons.close}</button></div>
    <div data-vg-media></div>
    <div class="vg-lb-footer"><div class="vg-lb-details"><div class="vg-lb-title">${esc(gozlem?m.baslik||m.etkinlikBaslik||'':galleryTopic(m))}</div>${egitimMi(m)?`<div class="vg-lb-subtitle">${esc(PROGRAMLAR[programKodu(m)]?.ad||m.programAd||'Eğitim')}${gozlem?` · ${esc(alanAdi(m))}${m.gozlemDurum?` · ${esc(ASAMA[m.gozlemDurum]||m.gozlemDurum)}`:''}`:''}</div>${m.aciklama?`<div class="vg-lb-caption">${esc(m.aciklama)}</div>`:''}`:''}<div class="vg-lb-date">${esc(tarihYazi(tarih(m)))}</div></div>
    <div class="vg-lb-actions" role="group" aria-label="Medya işlemleri">${i>0?`<button type="button" data-vg-prev class="vg-lb-btn" onclick="${eylem(()=>buyut(havuz[i-1].id,hedefId))}" aria-label="Önceki" title="Önceki">${galleryLightboxIcons.previous}</button>`:'<span aria-hidden="true"></span>'}<button type="button" class="vg-lb-btn vg-lb-download" onclick="${eylem(button=>window._vg.indir(m.id,button))}" aria-label="İndir">${galleryLightboxIcons.download}<span>İndir</span></button>${i<havuz.length-1?`<button type="button" data-vg-next class="vg-lb-btn" onclick="${eylem(()=>buyut(havuz[i+1].id,hedefId))}" aria-label="Sonraki" title="Sonraki">${galleryLightboxIcons.next}</button>`:'<span aria-hidden="true"></span>'}</div></div>`;
  document.body.appendChild(d);mountMedia(d.querySelector('[data-vg-media]'),m);recordOpen(m);
  (d.querySelector('[aria-label="Kapat"]')||d).focus?.();
  if(!replacing&&window.history?.pushState){try{_dialogPriorState=window.history.state;const token='vg-'+(++_dialogNo);window.history.pushState({...window.history.state,__portalGalleryDialog:token},'');_dialogHistory=token;}catch(_){_dialogHistory='';}}
}
function temizle(restore=true){const d=document.getElementById('vgLightbox');disposeMedia(d);d?.remove();_dialog=null;if(restore){if(document.body.style)document.body.style.overflow=_bodyOverflow;if(_dialogOrigin?.isConnected!==false)_dialogOrigin?.focus?.();_dialogOrigin=null;}}
function kapat(){
  if(!_dialog)return;
  temizle();
  if(_dialogHistory&&window.history?.state?.__portalGalleryDialog===_dialogHistory){_closingHistory=true;try{window.history.back();}catch(_){_closingHistory=false;_dialogHistory='';}}
  else _dialogHistory='';
}
function invalidate(){++_renderNo;_yuklenenKapsam='';_eylemler.clear();kapat();disposeMedia(_hedefEl);if(_hedefEl)_hedefEl.innerHTML='';_medya=[];_albumler=[];_tekiller=[];_teknikDurum=null;}
window.addEventListener?.('popstate',()=>{
  if(_closingHistory){
    if(window.history?.state?.__portalGalleryDialog===_dialogHistory){try{window.history.replaceState?.(_dialogPriorState,'');}catch(_){}}
    _closingHistory=false;_dialogHistory='';return;
  }
  if(_dialogHistory&&window.history?.state?.__portalGalleryDialog!==_dialogHistory){temizle();_dialogHistory='';}
});
window.addEventListener?.('pagehide',invalidate);
window.addEventListener?.('keydown',event=>{
  if(!_dialog)return;
  if(event.key==='Escape'){event.preventDefault();kapat();return;}
  if(event.key==='Tab'){
    const controls=[..._dialog.querySelectorAll('button:not([disabled]),video[controls],iframe')],first=controls[0],last=controls.at(-1);
    if(!first){event.preventDefault();_dialog.focus?.();}
    else if(event.shiftKey&&(document.activeElement===first||document.activeElement===_dialog)){event.preventDefault();last.focus?.();}
    else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===_dialog)){event.preventDefault();first.focus?.();}
  }
});
window._vg={
  kapat,buyut,invalidate,
  teknik:button=>{
    if(_yuklenenKapsam!==kapsamAnahtari())return;
    const panel=button?.nextElementSibling;if(!panel?.hasAttribute?.('data-vg-diagnostic'))return;
    panel.hidden=!panel.hidden;button.setAttribute?.('aria-expanded',String(!panel.hidden));
  },
  tekrar:async h=>{
    const s=P().state,ogr=aktifOgrenci(),user=s.currentUser,oturum=s.galeriOturumSurumu,donem=s.aktifDonem;
    if(!isGalleryParent(s))return;
    if(!aktifSinif(ogr)&&P().galeriSinifYenile)await P().galeriSinifYenile();
    const son=P().state;
    if(son.currentUser!==user||son.galeriOturumSurumu!==oturum||son.aktifDonem!==donem||aktifOgrenci()?.id!==ogr?.id)return;
    return render(h);
  },
  tur:(k,h)=>{if(!['tumu','foto','video'].includes(k))return;_tur=k;return render(h);},
  eylem:(id,button)=>_eylemler.get(id)?.(button),
  indir:(id,button)=>{const m=_medya.find(x=>x.id===id);if(m&&erisebilir(m))return lightboxDownload(button,()=>downloadMedia(m,button));},
  filtre:(k,h)=>{_filtre=k;secimleriSifirla();return render(h);},
  albumAc:(id,h)=>{_acikAlbum=id;_egitimProgram='';_egitimAlan='';return render(h);},
  albumKapat:h=>{_acikAlbum='';return render(h);},
  egitimProgramAc:(k,h)=>{_filtre='egitim';_acikAlbum='';_egitimProgram=k;_egitimAlan='';return render(h);},
  egitimAlanAc:(k,h)=>{_egitimAlan=k;return render(h);},
  egitimGeri:h=>{if(_egitimAlan)_egitimAlan='';else _egitimProgram='';return render(h);}
};
function videoKapaklari(el){el.querySelectorAll('[data-vg-thumbnail]').forEach(host=>{const m=_medya.find(x=>x.id===host.dataset.vgThumbnail);if(m?.dosyaTipi==='video'){host.style.aspectRatio='1';mountMedia(host,m,{thumbnail:true});}});}
