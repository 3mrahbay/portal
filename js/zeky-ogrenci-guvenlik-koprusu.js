// ZEKY Portal · Öğrenci aktif dönem + iletişim gizliliği + gözlem giriş köprüsü
// Amaç:
// 1) Öğretmen/personel ekranında yalnız aktif dönemdeki öğrencileri göstermek.
// 2) Gözlem butonunu gelişmiş S/T/U + not + fotoğraf penceresine bağlamak.
// 3) Veli e-posta adresini toast/DOM butonlarında göstermemek.
//
// NOT: Bu katman arayüz sızıntısını kapatır. Firestore'da ogrenciler ana belgesindeki
// e-posta alanlarının öğretmene hiç okunmaması ayrıca Rules/veri modeli ile sertleştirilmelidir.

const KURULUM = '__zekyOgrenciGuvenlikV1';
const YONETIM = new Set(['kurucu_mudur','mudur','egitim_koordinator']);
let gozlemAc = null;
let observer = null;

const bekle = (kosul, adet = 120, ms = 100) => new Promise((resolve, reject) => {
  let n = 0;
  const bak = () => {
    try { if (kosul()) return resolve(true); } catch (_) {}
    if (++n >= adet) return reject(new Error('Portal çekirdeği hazır olmadı.'));
    setTimeout(bak, ms);
  };
  bak();
});

function P(){ return window.PortalAPI; }
function B(){ return window.BCK; }
function durumNorm(v){
  const d = String(v || 'aktif').toLocaleLowerCase('tr').trim();
  return ['arsiv','arşiv','pasif','ayrildi','ayrıldı'].includes(d) ? 'arsiv' : 'aktif';
}
function yonetimMi(s = P()?.state || {}){
  return !!s.isAdmin || YONETIM.has(String(s.rol || ''));
}
function ogrAd(o){ return o?.ogrenciAdSoyad || o?.adSoyad || [o?.ad,o?.soyad].filter(Boolean).join(' ') || 'Öğrenci'; }
function ogrSinif(o, s = P()?.state || {}){
  const a = s.ayarListesi?.[o?.id];
  return a?.kayit?.sinif || o?.sinif || o?.sinifi || '';
}
function aktifMi(o, s = P()?.state || {}){
  if (!o?.id) return false;
  const donem = String(s.aktifDonem || '');
  if (yonetimMi(s)) {
    const ayar = s.ayarListesi?.[o.id];
    return !!ayar && durumNorm(ayar.durum) === 'aktif';
  }
  return !!donem && String(o.aktifDonem || '') === donem && durumNorm(o.aktifDonemDurum) === 'aktif';
}
function sinifEslesir(a,b){
  try { return window.PortalData?.sinifEslesirMi ? window.PortalData.sinifEslesirMi(a,b) : String(a||'')===String(b||''); }
  catch (_) { return String(a||'')===String(b||''); }
}
function gorulebilirOgrenciler(){
  const s = P()?.state || {};
  let liste = (s.ogrenciList || []).filter(o => aktifMi(o,s));
  if (!yonetimMi(s) && Array.isArray(s.siniflar) && s.siniflar.length) {
    liste = liste.filter(o => s.siniflar.some(x => sinifEslesir(ogrSinif(o,s), x)));
  }
  return liste;
}
function toast(m, tip='info'){
  try { if (window.showToast) window.showToast(m, tip); } catch (_) {}
}

async function aktifDonemIsaretleriniSenkronla(){
  const s = P()?.state || {};
  if (!yonetimMi(s)) return;
  if (!s.aktifDonem || !s.ogrenciList?.length || !Object.keys(s.ayarListesi || {}).length) return;
  const anahtar = `zeky-aktif-donem-sync-${s.aktifDonem}`;
  try { if (sessionStorage.getItem(anahtar) === '1') return; } catch (_) {}
  const b = B();
  if (!b?.setDoc || !b?.doc || !b?.db) return;
  const isler = [];
  for (const o of s.ogrenciList) {
    const ayar = s.ayarListesi?.[o.id];
    if (!ayar) continue;
    const yeniDurum = durumNorm(ayar.durum);
    if (String(o.aktifDonem || '') === String(s.aktifDonem) && durumNorm(o.aktifDonemDurum) === yeniDurum) continue;
    isler.push(b.setDoc(b.doc(b.db,'ogrenciler',o.id), {
      aktifDonem: s.aktifDonem,
      aktifDonemDurum: yeniDurum,
      aktifDonemGuncellendi: new Date().toISOString()
    }, { merge:true }).catch(e => console.warn('aktif dönem işareti',o.id,e)));
  }
  for (let i=0;i<isler.length;i+=12) await Promise.all(isler.slice(i,i+12));
  try { sessionStorage.setItem(anahtar,'1'); } catch (_) {}
}

function kartId(el){
  const onclick = el?.getAttribute?.('onclick') || '';
  const m = onclick.match(/ogrenciEgitimPopup\('([^']+)'\)/);
  return m ? m[1] : '';
}
function ogrenciKartlariniFiltrele(){
  const s = P()?.state || {};
  const izinli = new Set(gorulebilirOgrenciler().map(o=>o.id));
  const tiklar = document.querySelectorAll("[onclick*='ogrenciEgitimPopup(']");
  let gorunen = 0;
  tiklar.forEach(t => {
    const id = kartId(t);
    if (!id) return;
    const kart = t.parentElement;
    if (!kart) return;
    const ok = izinli.has(id);
    kart.style.display = ok ? '' : 'none';
    if (ok) gorunen++;
  });
  const tab = document.getElementById('tab-ogrenciler');
  if (tab) {
    tab.querySelectorAll('div').forEach(el => {
      if (/\d+\s+öğrenci listeleniyor\.?/.test(el.textContent || '') && el.children.length === 0) {
        el.textContent = `${gorunen} öğrenci listeleniyor.`;
      }
    });
  }
}

function gozlemSeciciAc(){
  document.getElementById('zekyGozlemSecici')?.remove();
  const liste = gorulebilirOgrenciler();
  const s = P()?.state || {};
  const arka = document.createElement('div');
  arka.id = 'zekyGozlemSecici';
  arka.style.cssText='position:fixed;inset:0;z-index:9650;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;padding:18px;';
  arka.innerHTML = `<div style="width:min(520px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:20px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.24)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:13px"><div style="flex:1"><b style="font-size:17px;color:#2D5E3E">Yeni Eğitim Gözlemi</b><div style="font-size:12px;color:#64748B;margin-top:2px">Aktif dönem öğrencisini seçin</div></div><button data-kapat style="border:0;background:#F1F5F9;border-radius:50%;width:38px;height:38px;font-size:20px;cursor:pointer">×</button></div>
    <div id="zekyGozlemOgrenciler" style="display:grid;gap:8px"></div></div>`;
  const kap = arka.querySelector('#zekyGozlemOgrenciler');
  if (!liste.length) kap.innerHTML='<div style="padding:20px;text-align:center;color:#64748B">Aktif dönem öğrencisi bulunamadı. Yönetim hesabında Öğrenciler ekranını bir kez açıp yenileyin.</div>';
  liste.forEach(o => {
    const b = document.createElement('button');
    b.type='button';
    b.style.cssText='display:flex;align-items:center;gap:11px;width:100%;padding:11px 12px;border:1px solid #E2E8F0;border-radius:12px;background:#fff;text-align:left;cursor:pointer;font-family:inherit';
    const ad = ogrAd(o), sinif = ogrSinif(o,s);
    b.innerHTML=`<span style="width:36px;height:36px;border-radius:50%;background:#EAF3EC;color:#2D5E3E;display:grid;place-items:center;font-weight:800">${(ad[0]||'?').toLocaleUpperCase('tr')}</span><span style="flex:1"><strong style="display:block;font-size:13.5px;color:#1E293B"></strong><small style="color:#64748B"></small></span>`;
    b.querySelector('strong').textContent=ad;
    b.querySelector('small').textContent=sinif;
    b.onclick=()=>{ arka.remove(); if (gozlemAc) gozlemAc(o.id,ad,sinif); else if (typeof window.caGozlemAc==='function') window.caGozlemAc(o.id,ad,sinif); };
    kap.appendChild(b);
  });
  arka.querySelector('[data-kapat]').onclick=()=>arka.remove();
  arka.onclick=e=>{if(e.target===arka)arka.remove();};
  document.body.appendChild(arka);
}

function egitimYeniKartEkle(){
  const tab = document.getElementById('tab-egitim');
  if (!tab || document.getElementById('zekyYeniGozlemKart')) return;
  const kart = document.createElement('div');
  kart.id='zekyYeniGozlemKart';
  kart.style.cssText='background:linear-gradient(135deg,#2D5E3E,#4A7C59);color:#fff;border-radius:18px;padding:18px 20px;margin-bottom:18px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 24px rgba(45,94,62,.18)';
  kart.innerHTML='<div style="width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.16);display:grid;place-items:center;font-size:22px">📷</div><div style="flex:1"><div style="font-weight:800;font-size:16px">Yeni Eğitim Gözlemi</div><div style="font-size:12px;opacity:.9;margin-top:3px">Sunuldu · Tekrar Ediyor · Ustalaştı + açıklama + fotoğraf</div></div><button type="button" style="border:1px solid rgba(255,255,255,.45);background:#fff;color:#2D5E3E;border-radius:11px;padding:10px 14px;font-weight:800;cursor:pointer">Öğrenci Seç</button>';
  kart.querySelector('button').onclick=gozlemSeciciAc;
  tab.insertBefore(kart,tab.firstChild);
}

function veliTopla(o,s){
  const ayar=s.ayarListesi?.[o.id] || {};
  const ham=[
    {ad:o.veli1AdSoyad||ayar.anne?.adSoyad||ayar.veli?.adSoyad||'',email:o.veli1Eposta||ayar.anne?.email||ayar.veli?.email||'',rol:o.veli1Yakinlik||'Veli'},
    {ad:o.veli2AdSoyad||ayar.baba?.adSoyad||'',email:o.veli2Eposta||ayar.baba?.email||'',rol:o.veli2Yakinlik||'Veli'}
  ];
  const seen=new Set();
  return ham.filter(v=>{const e=String(v.email||'').trim().toLowerCase();if(!e||seen.has(e))return false;seen.add(e);v.email=e;return true;});
}

function mesajGizlilikKur(){
  // Öğrenci seçimi: e-posta DOM onclick'ine yazılmaz; event listener closure içinde kalır.
  const eskiSec = window.mesajYeniOgrenciSec;
  if (typeof eskiSec==='function' && !eskiSec.__zekyGizli) {
    const yeniSec = function(ogrenciId){
      const s=P()?.state||{}; const o=(s.ogrenciList||[]).find(x=>x.id===ogrenciId); if(!o)return;
      const el=document.getElementById('mesajYeniOgrenciListesi'); if(!el)return eskiSec.apply(this,arguments);
      const veliler=veliTopla(o,s); const sinif=ogrSinif(o,s);
      el.innerHTML='';
      const ust=document.createElement('div'); ust.style.cssText='font-size:13px;color:#6b7280;margin-bottom:10px';
      const st=document.createElement('strong');st.textContent=ogrAd(o);ust.append('👶 ',st, sinif?` · ${sinif}`:'');el.appendChild(ust);
      const ac=document.createElement('div');ac.textContent='Mesaj göndereceğiniz veliyi seçin:';ac.style.cssText='font-size:12px;color:#9ca3af;margin-bottom:8px';el.appendChild(ac);
      if(!veliler.length){const bos=document.createElement('div');bos.textContent='Tanımlı veli bulunamadı.';bos.style.cssText='padding:12px;color:#64748B';el.appendChild(bos);return;}
      veliler.forEach(v=>{const hedefEmail=v.email;const btn=document.createElement('button');btn.type='button';btn.className='mesaj-yeni-veli-btn';btn.textContent=`👤 ${v.ad||v.rol} (${v.rol})`;btn.onclick=()=>{if(typeof window.mesajYeniBaslat==='function')window.mesajYeniBaslat(hedefEmail,v.ad||v.rol,ogrenciId);};el.appendChild(btn);});
    };
    yeniSec.__zekyGizli=true; yeniSec.__eski=eskiSec; window.mesajYeniOgrenciSec=yeniSec;
  }

  const eskiAc=window.veliyeMesajAc;
  if(typeof eskiAc==='function'&&!eskiAc.__zekyGizli){
    const yeniAc=function(email){
      try{window.modulSec?.('mesaj');setTimeout(()=>{if(typeof window.mesajYeniThreadBaslat==='function')window.mesajYeniThreadBaslat(email);else toast('Mesajlaşma ekranı açıldı.','info');},350);}catch(_){toast('Mesajlaşma ekranı açılamadı.','error');}
    };
    yeniAc.__zekyGizli=true;window.veliyeMesajAc=yeniAc;
  }
}

function islemlerKur(){
  const eskiPopup=window.ogrenciEgitimPopup;
  if(typeof eskiPopup==='function'&&!eskiPopup.__zekyAktif){
    const yeniPopup=function(id){const s=P()?.state||{},o=(s.ogrenciList||[]).find(x=>x.id===id);if(!aktifMi(o,s)){toast('Bu öğrenci aktif eğitim döneminde değil.','info');return;}return eskiPopup.apply(this,arguments);};
    yeniPopup.__zekyAktif=true;window.ogrenciEgitimPopup=yeniPopup;
  }
  const eskiIslem=window.ogrenciEgitimIslem;
  if(typeof eskiIslem==='function'&&!eskiIslem.__zekyGuvenli){
    const yeniIslem=function(id,islem){
      const s=P()?.state||{},o=(s.ogrenciList||[]).find(x=>x.id===id);if(!aktifMi(o,s)){toast('Bu öğrenci aktif eğitim döneminde değil.','info');return;}
      if(islem==='gozlem'){document.getElementById('egitimPopupArka')?.remove();const ad=ogrAd(o),sinif=ogrSinif(o,s);if(gozlemAc)return gozlemAc(id,ad,sinif);if(typeof window.caGozlemAc==='function')return window.caGozlemAc(id,ad,sinif);toast('Gözlem ekranı yüklenemedi.','error');return;}
      if(islem==='mesaj'){document.getElementById('egitimPopupArka')?.remove();window.modulSec?.('mesaj');setTimeout(()=>{if(typeof window.mesajYeniOgrenciSec==='function')window.mesajYeniOgrenciSec(id);else toast('Mesajlaşma ekranı açıldı.','info');},350);return;}
      return eskiIslem.apply(this,arguments);
    };
    yeniIslem.__zekyGuvenli=true;window.ogrenciEgitimIslem=yeniIslem;
  }
}

function navigasyonKur(){
  const eski=window.modulSec;
  if(typeof eski!=='function'||eski.__zekyGuvenli)return;
  const yeni=function(modulKey,...args){const r=eski.call(this,modulKey,...args);setTimeout(()=>{if(modulKey==='ogrencilerM')ogrenciKartlariniFiltrele();if(modulKey==='egitim')egitimYeniKartEkle();mesajGizlilikKur();islemlerKur();},80);setTimeout(()=>{if(modulKey==='ogrencilerM')ogrenciKartlariniFiltrele();if(modulKey==='egitim')egitimYeniKartEkle();},450);return r;};
  yeni.__zekyGuvenli=true;yeni.__eski=eski;window.modulSec=yeni;
}

async function gozlemKur(){
  try{
    delete window.__zekyGelismisGozlemV1;
    const m=await import('../moduller/ogretmen-egitim-gozlem.js?v5');
    m.kur(window);
    await bekle(()=>window.__zekyGelismisGozlemV1===true&&typeof window.caGozlemAc==='function',80,100);
    gozlemAc=window.caGozlemAc;
    window.zekyGelismisGozlemAc=gozlemAc;
  }catch(e){console.error('Gelişmiş gözlem kurulamadı',e);}
}

function observerKur(){
  if(observer)return;
  observer=new MutationObserver(()=>{ogrenciKartlariniFiltrele();egitimYeniKartEkle();mesajGizlilikKur();islemlerKur();});
  observer.observe(document.body,{childList:true,subtree:true});
}

export async function kur(){
  if(window[KURULUM])return true;
  await bekle(()=>!!window.BCK&&!!window.PortalAPI&&typeof window.modulSec==='function');
  await gozlemKur();
  navigasyonKur();mesajGizlilikKur();islemlerKur();observerKur();
  setTimeout(aktifDonemIsaretleriniSenkronla,700);
  setTimeout(()=>{ogrenciKartlariniFiltrele();egitimYeniKartEkle();},900);
  window.zekyGozlemOgrenciSeciciAc=gozlemSeciciAc;
  window[KURULUM]=true;
  return true;
}

if(typeof window!=='undefined')kur().catch(e=>console.error('Öğrenci güvenlik köprüsü',e));
