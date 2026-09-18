// Veli eğitim portföyünden Türkçe karakterleri koruyan, yazdırılabilir dönem raporu.

const PROGRAM_DILI = {
  montessori:'Montessori çalışmalarında bağımsızlık, dikkat sürekliliği, düzen duygusu ve işlevsel yaşam becerileri birlikte izlenmiştir.',
  orman:'Orman Okulu çalışmalarında doğayla ilişki, araştırma merakı, sorumluluk alma ve deneyim yoluyla öğrenme göstergeleri birlikte değerlendirilmiştir.',
  degerler:'Değerler Eğitimi çalışmalarında sosyal-duygusal farkındalık, sorumluluk, saygı, empati ve günlük yaşama aktarım göstergeleri izlenmiştir.',
  ingilizce:'İngilizce çalışmalarında alıcı dil, sözcük dağarcığı, yönerge takibi ve dili doğal iletişim bağlamında kullanma göstergeleri değerlendirilmiştir.'
};

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function bugun(){return new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});}
function donemYazi(v){return String(v||'').replace(/_/g,'–')||'Güncel dönem';}

function akademikOzet(program, i) {
  const giris=PROGRAM_DILI[program.id]||'Eğitim programındaki gelişim göstergeleri portföy kayıtları üzerinden değerlendirilmiştir.';
  if(!i.toplam)return`${giris} Bu dönem için ölçülebilir kazanım verisi henüz oluşmamıştır.`;
  const seviye=i.yuzde>=80?'program kazanımlarının büyük bölümünde deneyim oluşturmuştur':i.yuzde>=50?'program kazanımlarında düzenli ve çeşitlenen deneyimler oluşturmuştur':i.yuzde>0?'programla tanışma ve temel deneyim oluşturma sürecindedir':'program kayıtları henüz başlangıç aşamasındadır';
  const ustalik=i.u?` ${i.u} kazanımda bağımsız/ustalaşmış uygulama gözlenmiştir.`:' Bağımsız uygulama göstergeleri izleyen çalışmalarla değerlendirilmeye devam edecektir.';
  return`${giris} Öğrenci, kayıt altına alınan çalışmalar doğrultusunda ${seviye}.${ustalik}`;
}

function alanOzet(a) {
  const i=a.istatistik||{},ad=a.ad||'Bu alan';
  if(!i.toplam)return`${ad} için tanımlı kazanım bulunmadığından nicel değerlendirme oluşturulamamıştır.`;
  if(!i.calisilan)return`${ad} alanında portföye yansıyan bir çalışma henüz bulunmamaktadır. Planlanan sunumlarla çocuğun başlangıç göstergeleri izlenecektir.`;
  const duzey=i.ustalik>=60?'bağımsız uygulamanın belirginleştiğini':i.yuzde>=60?'sunulan çalışmaların pekiştirme sürecinde ilerlediğini':'temel sunum ve deneyim oluşturma sürecinin devam ettiğini';
  return`${ad} alanında ${i.calisilan}/${i.toplam} kazanım üzerinde çalışılmıştır. Kayıtlar, ${duzey} göstermektedir. İzleyen dönemde çocuğun bireysel ritmine uygun tekrarlar ve yeni sunumlarla gelişimin sürekliliği desteklenecektir.`;
}

function bar(a,renk){const i=a.istatistik||{};return`<div class="veg-report-bar"><span>${esc(a.ad)}</span><i><span style="width:${Math.max(0,Math.min(100,i.yuzde||0))}%;background:${renk}"></span></i><b>%${i.yuzde||0}</b></div>`;}

function alanBolumu(a,program){const s=a.sunum;return`<section class="veg-report-area"><h3>${esc(a.ad)}</h3><div class="veg-area-pcts" style="margin-bottom:10px"><span class="veg-pct">İlerleme %${a.istatistik?.yuzde||0}</span><span class="veg-pct" style="background:#E8F3E8;color:#2D7A2D">Ustalık %${a.istatistik?.ustalik||0}</span><span class="veg-pct">${a.istatistik?.calisilan||0}/${a.istatistik?.toplam||0} kazanım</span></div><div class="veg-report-grid">${s?.fotoUrl?`<img class="veg-report-photo" src="${esc(s.fotoUrl)}" alt="${esc(a.ad)} sunum fotoğrafı">`:'<div class="veg-report-photo" style="display:grid;place-items:center;color:#819087;font-size:13px">Bu alanda onaylı sunum fotoğrafı bulunmuyor.</div>'}<div><p class="veg-report-copy">${esc(alanOzet(a))}</p>${s?`<div style="background:${program.acik};border-radius:13px;padding:12px;margin-top:12px"><b style="font-size:12px;color:${program.renk}">Portföyden örnek · ${esc(s.dersAd||'Eğitim sunumu')}</b>${s.not?`<p style="font-size:11.5px;line-height:1.55;color:#526158;margin:6px 0 0">${esc(s.not)}</p>`:''}</div>`:''}</div></div></section>`;}

function programSayfasi(p){const i=p.istatistik||{};return`<section class="veg-report-page"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px"><div><div style="font-size:10px;font-weight:900;letter-spacing:1px;color:${p.renk}">PROGRAM DEĞERLENDİRMESİ</div><h2 style="font-size:27px;color:#243A2D;margin:7px 0">${esc(p.ad)}</h2></div><div style="font-size:24px;font-weight:900;color:${p.renk}">%${i.yuzde||0}</div></div><p class="veg-report-copy">${esc(akademikOzet(p,i))}</p><div class="veg-program-summary"><div class="veg-stat"><b>%${i.yuzde||0}</b><span>Program ilerlemesi</span></div><div class="veg-stat"><b>%${i.ustalik||0}</b><span>Ustalık oranı</span></div><div class="veg-stat"><b>${i.calisilan||0}</b><span>Çalışılan</span></div><div class="veg-stat"><b>${i.toplam||0}</b><span>Toplam kazanım</span></div></div><div class="veg-block" style="box-shadow:none"><div class="veg-block-head"><h3>Alan bazında gelişim grafiği</h3><span>Portföye kaydedilen aşamalar</span></div><div class="veg-report-bars">${(p.alanlar||[]).map(a=>bar(a,p.renk)).join('')}</div></div>${(p.alanlar||[]).map(a=>alanBolumu(a,p)).join('')}</section>`;}

export function donemRaporuAc(data) {
  document.getElementById('zekyDonemRaporu')?.remove();
  const d=document.createElement('div');d.id='zekyDonemRaporu';d.className='veg-report-overlay';
  d.innerHTML=`<div class="veg-report-shell"><div class="veg-report-tools"><button type="button" data-rapor-kapat style="background:#E8EEE9;color:#294234">Kapat</button><button type="button" data-rapor-yazdir style="background:#fff;color:#234B34">PDF / Yazdır</button></div><section class="veg-report-page veg-report-cover"><div><div class="veg-report-logo">BÇKA</div><div style="font-size:13px;letter-spacing:1.4px;margin-top:7px">BİR ÇİÇEK KOLEJİ ANAOKULU</div><h1>Dönem Sonu<br>Eğitim Gelişim Raporu</h1><p>${esc(data.ogrenci?.ad||'Öğrenci')}</p><p>${esc(data.ogrenci?.sinif||'')} · ${esc(donemYazi(data.donem))}</p><div style="margin-top:70px;font-size:12px;opacity:.7">${esc(bugun())}</div></div></section><section class="veg-report-page"><div style="font-size:10px;font-weight:900;letter-spacing:1px;color:#356B4A">PORTFÖY ÖZETİ</div><h2 style="font-size:27px;color:#243A2D;margin:7px 0">Bütüncül Gelişim Görünümü</h2><p class="veg-report-copy">Bu rapor, dönem boyunca öğretmen gözlemleriyle kayıt altına alınan eğitim sunumları, aşama geçişleri ve yönetim onaylı görsel portföy örnekleri temel alınarak hazırlanmıştır. Yüzdelik değerler bir başarı notu değil; çocuğun hangi kazanımlarla ne ölçüde deneyim kurduğunu gösteren gelişim göstergeleridir.</p><div class="veg-report-bars" style="margin-top:24px">${(data.programlar||[]).map(p=>bar({ad:p.ad,istatistik:p.istatistik},p.renk)).join('')}</div><div class="veg-program-summary" style="margin-top:25px">${(data.programlar||[]).map(p=>`<div class="veg-stat"><b style="color:${p.renk}">%${p.istatistik?.yuzde||0}</b><span>${esc(p.ad)}</span></div>`).join('')}</div></section>${(data.programlar||[]).map(programSayfasi).join('')}</div>`;
  d.querySelector('[data-rapor-kapat]').onclick=()=>d.remove();
  d.querySelector('[data-rapor-yazdir]').onclick=()=>window.print();
  d.onclick=e=>{if(e.target===d)d.remove();};
  document.body.appendChild(d);
}
