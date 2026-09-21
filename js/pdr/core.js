// Portal ve ZEKY aynı dosyayı kullanır. Klinik puan/teşhis üretmez.
export const ALANLAR = {sosyal:'Sosyal-duygusal',dil:'Dil ve iletişim',bilissel:'Bilişsel',motor:'Motor',ozbakim:'Özbakım',davranis:'Davranış ve oyun'};
export const TURLER = {gorusme:'Görüşme',destek:'Destek planı',rapor:'Dönem değerlendirmesi'};
export const DURUMLAR = {planlandi:'Planlandı',suruyor:'Sürüyor',tamamlandi:'Tamamlandı'};
export const SEVIYELER = {takip:'Yakın takip',destek:'Destek',tipik:'Yaşına uygun'};
export function yetkili(k) {return !!k?.isAdmin || ['pdr','kurucu_mudur','kurucu','mudur'].includes(k?.rol);}
export function bugun() {const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function tarihGecerli(s) {return /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;}
export function kacis(s) {return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function sirala(liste) {return [...liste].sort((a,b)=>String(b.tarih||'').localeCompare(String(a.tarih||'')) || (b.olusturuldu?.seconds||0)-(a.olusturuldu?.seconds||0) || String(b.id||'').localeCompare(String(a.id||'')));}
export function sonAlanlar(gozlemler) {const sonuc={};for(const g of sirala(gozlemler)){if(ALANLAR[g.alan]&&!sonuc[g.alan])sonuc[g.alan]=g;}return sonuc;}
export function oncelik(gozlemler) {const son=Object.values(sonAlanlar(gozlemler));return son.some(g=>g.seviye==='takip')?'takip':son.some(g=>g.seviye==='destek')?'destek':son.length?'tipik':'yok';}
export function geciken(k,t=bugun()) {return k.durum!=='tamamlandi' && !!k.takipTarihi && k.takipTarihi<t;}
export function kayitDogrula(girdi, ogrenciler, kullanici, donem) {
  if(!yetkili(kullanici))throw new Error('PDR kayıt yetkiniz yok.');
  const o=ogrenciler.find(x=>x.id===girdi.ogrenciId);
  if(!o)throw new Error('Aktif dönemden bir öğrenci seçin.');
  if(!donem)throw new Error('Aktif dönem yüklenemedi.');
  if(!TURLER[girdi.tur]||!DURUMLAR[girdi.durum])throw new Error('Kayıt türü ve durum seçin.');
  if(!tarihGecerli(girdi.tarih))throw new Error('Geçerli bir kayıt tarihi girin.');
  if(girdi.takipTarihi&&(!tarihGecerli(girdi.takipTarihi)||girdi.takipTarihi<girdi.tarih))throw new Error('Takip tarihi kayıt tarihinden önce olamaz.');
  if(!String(girdi.baslik||'').trim()||!String(girdi.ozet||'').trim())throw new Error('Başlık ve açıklama zorunludur.');
  if(girdi.tur==='destek'&&(!String(girdi.hedef||'').trim()||!girdi.takipTarihi))throw new Error('Destek planında gözlenebilir hedef ve takip tarihi zorunludur.');
  if(girdi.durum==='tamamlandi'&&!String(girdi.sonuc||'').trim())throw new Error('Tamamlanan çalışmanın sonucunu yazın.');
  const sonuc={ogrenciId:o.id,ogrenciAd:o.ad,sinif:o.sinif||'',donem,tur:girdi.tur,durum:girdi.durum,tarih:girdi.tarih,takipTarihi:girdi.takipTarihi||'',veliylePaylas:false,semaSurumu:1};
  for(const key of ['baslik','ozet','katilimcilar','hedef','uygulama','aileOnerisi','ogretmenOnerisi','sonuc']) {
    const deger=String(girdi[key]||'').trim(); if(deger.length>(key==='baslik'?160:5000))throw new Error('Metin çok uzun: '+key); sonuc[key]=deger;
  }
  return sonuc;
}
export function raporHTML(o,gozlemler,testler,kayitlar,{baslangic='',bitis=''}={}) {
  const filtre=x=>(!baslangic||x.tarih>=baslangic)&&(!bitis||x.tarih<=bitis);
  const gs=sirala(gozlemler.filter(filtre)),ts=sirala(testler.filter(filtre)),ks=sirala(kayitlar.filter(filtre));
  const alanlar=sonAlanlar(gs),e=kacis;
  return `<h1>PDR Öğrenci Takip Raporu</h1><h2>${e(o.ad)}</h2><p>${e(o.sinif)} · ${e(baslangic||'İlk kayıt')} — ${e(bitis||bugun())}</p><p><strong>Kurum içi · Gizli</strong> — Uzman değerlendirme kaydıdır; otomatik tanı veya standart test puanı üretmez.</p><h2>Gelişim alanları</h2><table><tr><th>Alan</th><th>Son gözlem</th><th>Tarih</th></tr>${Object.entries(ALANLAR).map(([id,ad])=>`<tr><td>${ad}</td><td>${e(SEVIYELER[alanlar[id]?.seviye]||'Kayıt yok')}</td><td>${e(alanlar[id]?.tarih||'—')}</td></tr>`).join('')}</table><h2>Gözlemler (${gs.length})</h2>${gs.map(g=>`<article><h3>${e(g.tarih)} · ${e(ALANLAR[g.alan]||g.alan)}</h3><p>${e(g.not)}</p><p>${e((g.oneriler||[]).join(' · '))}</p></article>`).join('')||'<p>Kayıt yok.</p>'}<h2>Test sonuçları (${ts.length})</h2>${ts.map(t=>`<article><h3>${e(t.tarih)} · ${e(t.testAd||t.testKod)}</h3><p>${e(t.ozet)}</p><p>${e(t.uzmanYorumu)}</p></article>`).join('')||'<p>Kayıt yok.</p>'}<h2>Görüşme, destek ve değerlendirme (${ks.length})</h2>${ks.map(k=>`<article><h3>${e(k.tarih)} · ${e(TURLER[k.tur])}: ${e(k.baslik)}</h3><p>${e(DURUMLAR[k.durum])} · Takip: ${e(k.takipTarihi||'—')}</p>${[['Özet','ozet'],['Katılımcılar','katilimcilar'],['Hedef','hedef'],['Uygulama','uygulama'],['Aile önerisi','aileOnerisi'],['Öğretmen önerisi','ogretmenOnerisi'],['Sonuç','sonuc']].map(([ad,key])=>k[key]?`<p><b>${ad}:</b> ${e(k[key])}</p>`:'').join('')}<p>Kaydeden: ${e(k.uzmanAd)}</p></article>`).join('')||'<p>Kayıt yok.</p>'}`;
}
