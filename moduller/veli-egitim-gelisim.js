// ═══════════════════════════════════════════════════════════════════
// VELİ EĞİTİM GELİŞİMİ — ZEKY mobil ile aynı veri modeli
// Kaynaklar:
//   ogrenciGelisim/{ogrenciId}
//   mufredatlar/{montessori|orman|degerler|ingilizce}
//   galeri (yalnız onaylı + seçili öğrencinin gözlem kayıtları)
//
// Hedef akış: Program → Alan → Kazanım → Sunuldu / Tekrar ediyor / Ustalaştı
// Her aşama kendi tarih, not, öğretmen ve fotoğrafını taşır.
// ═══════════════════════════════════════════════════════════════════

const P = () => window.PortalAPI;
const D = () => window.PortalData;

const PROGRAMLAR = [
  { id:'montessori', ad:'Montessori', ikon:'shapes', renk:'#4A7C59', acik:'#EAF3EC' },
  { id:'orman', ad:'Orman Okulu', ikon:'trees', renk:'#5C8B5A', acik:'#EDF4ED' },
  { id:'degerler', ad:'Değerler Eğitimi', ikon:'heart', renk:'#7B5EA7', acik:'#F0EAF6' },
  { id:'ingilizce', ad:'İngilizce Eğitimi', ikon:'languages', renk:'#2E5C8A', acik:'#E4EEF6' }
];

const DURUM = {
  S: { ad:'Sunuldu', renk:'#8A9691', bg:'#F0F2F1', ikon:'sparkles' },
  T: { ad:'Tekrar ediyor', renk:'#B98500', bg:'#FFF6D8', ikon:'repeat-2' },
  U: { ad:'Ustalaştı', renk:'#2D7A2D', bg:'#E8F3E8', ikon:'circle-check-big' }
};
const SIRA = ['S','T','U'];

let hedefId = 'cicekAppRoot';
let veri = null;
let ekran = { tur:'programlar', program:'', alanId:'', anahtar:'' };

function esc(t) {
  const p = P();
  if (p && typeof p.esc === 'function') return p.esc(String(t == null ? '' : t));
  return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function attr(t) { return esc(t); }
function ikonYenile() {
  try { if (P()?.lucide) P().lucide(); else if (window.lucideYenile) window.lucideYenile(); } catch (_) {}
}
function programBilgi(id) { return PROGRAMLAR.find(x => x.id === id) || PROGRAMLAR[0]; }
function trTarih(iso) {
  if (!iso) return '';
  const ham = String(iso);
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(ham) ? ham + 'T12:00:00' : ham);
  return isNaN(d) ? '' : d.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
}
function ogrAd(o) { return o?.ogrenciAdSoyad || o?.adSoyad || [o?.ad,o?.soyad].filter(Boolean).join(' ') || 'Çocuğunuz'; }
function ogrSinif(o) { return o?.sinif || o?.sinifi || ''; }
function programKodu(m) {
  const ham = String(m?.program || m?.kategori || m?.etkinlikBaslik || '').toLocaleLowerCase('tr');
  if (ham.includes('montessori')) return 'montessori';
  if (ham.includes('orman')) return 'orman';
  if (ham.includes('değer') || ham.includes('deger')) return 'degerler';
  if (ham.includes('ingiliz') || ham.includes('english')) return 'ingilizce';
  return m?.program || '';
}
function fotoOnayli(x) {
  return !x?.galeriId || !x?.fotoDurum || x.fotoDurum === 'onaylandi' || x.fotoDurum === 'onayli';
}

// Eğitim kazanımı için galeri yedeği yalnız SEÇİLİ ÇOCUĞUN gözlem kayıtlarını ister.
// Sınıf / tüm okul galeri kayıtları burada sorgulanmaz; eğitim aşamasına fotoğraf
// bağlamak için öğrenciye özel kazanimAnahtari + gozlemDurum kaydı gerekir.
async function galeriGetir(ogr) {
  const p = P();
  if (!p?.fb || !p?.db || !ogr?.id) return [];
  const { fb, db } = p;
  try {
    const q = fb.query(
      fb.collection(db,'galeri'),
      fb.where('durum','==','onaylandi'),
      fb.where('ogrenciId','==',ogr.id)
    );
    const snap = await fb.getDocs(q);
    const liste = [];
    snap.forEach(d => {
      const v = d.data() || {};
      if (v.ogrenciId !== ogr.id) return;
      const url = v.url || v.bunnyUrl || '';
      if (!url || !v.kazanimAnahtari || !SIRA.includes(v.gozlemDurum || '')) return;
      liste.push({ id:d.id, ...v, url });
    });
    return liste;
  } catch (e) {
    // Fotoğraf yedeği okunamazsa gelişim belgesindeki onaylı fotoğraflar yine çalışır.
    // Geniş galeri sorgusuna geri düşülmez: gizlilik, eski veri kurtarmadan önceliklidir.
    console.warn('veli eğitim öğrenci galerisi', e);
    return [];
  }
}

function dersleriDuzlestir(alanlar) {
  const sonuc = [];
  (alanlar || []).forEach(alan => (alan.gruplar || []).forEach(grup => (grup.dersler || []).forEach(ders => {
    sonuc.push({
      alanId: alan.id, alanAd: alan.ad || '', alanRenk: alan.renk || '', alanIkon: alan.ikon || '',
      grupAd: grup.ad || '', dersAd: ders,
      anahtar: `${alan.id}__${grup.ad || ''}__${ders}`
    });
  })));
  return sonuc;
}

function asamalariCoz(program, anahtar) {
  const dis = veri?.gelisim?.[program] || {};
  const kayitlar = dis.kayitlar || {};
  const tarihler = dis.tarihler || {};
  const detay = (dis.detay || {})[anahtar] || {};
  const galeriFotolari = (veri?.galeri || []).filter(m =>
    (m.kazanimAnahtari || '') === anahtar && programKodu(m) === program
  ).sort((a,b) => String(a.tarih || a.yuklemeZamani || '').localeCompare(String(b.tarih || b.yuklemeZamani || '')));
  const galeriDurum = (galeriFotolari[galeriFotolari.length - 1] || {}).gozlemDurum || '';
  const durum = kayitlar[anahtar] || detay.durum || galeriDurum || '';
  const asamalar = { ...(detay.asamalar || {}) };

  // Eski kayıt biçimini yeni aşama modeline uyarlamaya devam et.
  if (durum && !asamalar[durum]) {
    const notHarita = !Array.isArray(dis.notlar) && dis.notlar && typeof dis.notlar === 'object' ? dis.notlar : {};
    const eskiNot = notHarita[anahtar];
    const eskiFoto = (dis.fotolar || {})[anahtar] || '';
    asamalar[durum] = {
      durum,
      tarih: detay.tarih || tarihler[anahtar] || '',
      not: detay.not || (typeof eskiNot === 'string' ? eskiNot : (eskiNot?.metin || '')),
      yazar: detay.yazar || eskiNot?.ogretmenAd || '',
      fotoUrl: detay.fotoUrl || eskiFoto,
      fotoDurum: detay.fotoDurum || '', galeriId: detay.galeriId || '', paylas: detay.paylas
    };
  }

  // Galeri onayı gerçek yayın kaynağıdır: yalnız seçili öğrencinin onaylı
  // kazanım fotoğrafı doğru aşamaya bağlanır.
  galeriFotolari.forEach(m => {
    const kod = m.gozlemDurum || '';
    if (!SIRA.includes(kod)) return;
    const onceki = asamalar[kod] || {};
    asamalar[kod] = {
      ...onceki, durum:kod,
      tarih: onceki.tarih || m.tarih || m.yuklemeZamani || '',
      not: onceki.not || m.aciklama || '',
      yazar: onceki.yazar || m.yukleyenAd || '',
      fotoUrl: m.url || m.bunnyUrl || onceki.fotoUrl || '',
      fotoDurum: 'onaylandi', galeriId: m.id || onceki.galeriId || '',
      paylas: onceki.paylas
    };
  });
  return { durum, asamalar, detay, tarihler, dis };
}

function istatistik(program) {
  const pd = veri?.programlar?.[program] || { dersler:[] };
  let s=0,t=0,u=0;
  pd.dersler.forEach(k => {
    const d = asamalariCoz(program, k.anahtar).durum;
    if (d === 'S') s++; else if (d === 'T') t++; else if (d === 'U') u++;
  });
  const calisilan = s+t+u, toplam = pd.dersler.length;
  return { s,t,u,calisilan,toplam,yuzde: toplam ? Math.round(calisilan*100/toplam) : 0, ustalik: toplam ? Math.round(u*100/toplam) : 0 };
}

function stilEkle() {
  if (document.getElementById('zeky-veli-egitim-stil')) return;
  const s = document.createElement('style');
  s.id = 'zeky-veli-egitim-stil';
  s.textContent = `
    .veg{max-width:1100px;margin:0 auto;padding:2px 0 30px}.veg-top{display:flex;align-items:center;gap:12px;margin-bottom:16px}.veg-back{width:42px;height:42px;border:1px solid #E5E7EB;background:#fff;border-radius:13px;display:grid;place-items:center;cursor:pointer;color:#2D5E3E}.veg-title{font-size:20px;font-weight:800;color:#25362D}.veg-sub{font-size:12px;color:#839088;margin-top:2px}.veg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.veg-card{border:0;border-radius:20px;background:#fff;padding:16px;text-align:left;cursor:pointer;box-shadow:0 2px 12px rgba(25,55,40,.07);font-family:inherit;transition:.18s}.veg-card:hover{transform:translateY(-2px);box-shadow:0 7px 22px rgba(25,55,40,.11)}.veg-prog-ust{display:flex;align-items:center;gap:11px}.veg-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center}.veg-icon svg{width:22px;height:22px}.veg-prog-ad{font-size:15px;font-weight:800;flex:1}.veg-yuzde{font-size:18px;font-weight:900}.veg-bar{height:7px;background:#EEF1EF;border-radius:99px;overflow:hidden;margin:13px 0 10px}.veg-bar>span{height:100%;display:block;border-radius:99px}.veg-ist{display:flex;gap:7px;flex-wrap:wrap}.veg-pill{font-size:10.5px;font-weight:800;padding:4px 8px;border-radius:8px}.veg-hero{background:linear-gradient(135deg,#2D5E3E,#4A7C59);border-radius:22px;padding:18px;color:#fff;margin-bottom:16px;display:flex;align-items:center;gap:15px}.veg-hero-avatar{width:54px;height:54px;border-radius:18px;background:rgba(255,255,255,.17);display:grid;place-items:center;font-size:22px;font-weight:900}.veg-hero b{display:block;font-size:18px}.veg-hero span{display:block;font-size:12px;opacity:.82;margin-top:2px}.veg-gallery-btn{margin-left:auto;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.13);color:#fff;border-radius:12px;padding:10px 12px;font:700 12px inherit;cursor:pointer}.veg-section{display:grid;gap:10px}.veg-area{width:100%;border:0;background:#fff;border-radius:16px;padding:14px 15px;box-shadow:0 1px 8px rgba(25,55,40,.055);display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;font-family:inherit}.veg-area-ikon{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;font-weight:900}.veg-area-govde{flex:1;min-width:0}.veg-area-ad{font-size:14px;font-weight:800;color:#25362D}.veg-area-alt{font-size:11.5px;color:#88948D;margin-top:3px}.veg-mini{width:82px;height:6px;background:#EEF1EF;border-radius:99px;overflow:hidden}.veg-mini span{display:block;height:100%;border-radius:99px}.veg-group{font-size:11px;font-weight:900;color:#87928C;text-transform:uppercase;letter-spacing:.55px;margin:15px 2px 7px}.veg-lesson{width:100%;border:0;background:#fff;border-radius:14px;padding:12px 13px;display:flex;align-items:center;gap:11px;text-align:left;box-shadow:0 1px 6px rgba(25,55,40,.05);cursor:pointer;font-family:inherit;margin-bottom:8px}.veg-status-dot{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex-shrink:0}.veg-status-dot svg{width:17px;height:17px}.veg-lesson-body{flex:1;min-width:0}.veg-lesson-ad{font-size:13.5px;font-weight:750;color:#2E3832;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.veg-lesson-alt{font-size:11px;color:#8A9691;margin-top:3px}.veg-status{font-size:10.5px;font-weight:800;padding:4px 7px;border-radius:8px;white-space:nowrap}.veg-detail-head{background:#fff;border-radius:20px;padding:18px;margin-bottom:13px;box-shadow:0 2px 10px rgba(25,55,40,.06)}.veg-current{display:flex;align-items:center;gap:11px;margin-top:12px}.veg-current-icon{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;color:#fff}.veg-current-icon svg{width:23px;height:23px}.veg-current-ad{font-size:17px;font-weight:900}.veg-why{background:linear-gradient(135deg,#EEF5EF,#F8FAF8);border-left:4px solid #4A7C59;border-radius:16px;padding:15px;margin:13px 0}.veg-why b{font-size:13.5px;color:#2D5E3E}.veg-why p{font-size:13px;line-height:1.65;color:#3C4A42;margin:8px 0 0}.veg-road{background:#fff;border-radius:18px;padding:17px;box-shadow:0 1px 8px rgba(25,55,40,.05)}.veg-step{position:relative;padding:0 0 22px 35px}.veg-step:last-child{padding-bottom:0}.veg-step:before{content:'';position:absolute;left:10px;top:21px;bottom:0;width:2px;background:#E7ECE8}.veg-step:last-child:before{display:none}.veg-node{position:absolute;left:1px;top:2px;width:20px;height:20px;border-radius:50%;background:#fff;border:4px solid #D7DFDA}.veg-step.done .veg-node{background:#2D7A2D;border-color:#2D7A2D}.veg-step.now .veg-node{background:#fff;border-color:#2D7A2D;box-shadow:0 0 0 4px rgba(45,122,45,.13)}.veg-step-title{font-size:14px;font-weight:850}.veg-step-date{font-size:11.5px;color:#8A9691;margin-top:2px}.veg-step-img{display:block;width:min(100%,560px);max-height:360px;object-fit:contain;background:#F2F5F3;border-radius:14px;margin-top:10px;cursor:pointer}.veg-note{margin-top:9px;background:#F7F9F7;border-radius:12px;padding:11px 12px;font-size:12.5px;line-height:1.55;color:#3C4A42}.veg-author{font-size:10.5px;color:#8A9691;margin-top:5px}.veg-empty{text-align:center;background:#fff;border-radius:18px;padding:38px 20px;color:#87928C}.veg-photo-modal{position:fixed;inset:0;z-index:9800;background:rgba(5,10,7,.94);display:flex;align-items:center;justify-content:center;padding:22px}.veg-photo-modal img{max-width:min(1100px,94vw);max-height:88vh;border-radius:14px;object-fit:contain}.veg-photo-close{position:absolute;right:20px;top:20px;width:46px;height:46px;border:0;border-radius:50%;background:#fff;font-size:25px;cursor:pointer}
    @media(max-width:700px){.veg-grid{grid-template-columns:1fr}.veg{padding:0 2px 24px}.veg-hero{align-items:flex-start;flex-wrap:wrap}.veg-gallery-btn{margin-left:0}.veg-mini{display:none}.veg-lesson-ad{white-space:normal}.veg-status{font-size:9.5px}.veg-step{padding-left:32px}}
  `;
  document.head.appendChild(s);
}

async function veriYukle() {
  const p = P(), d = D();
  const state = p?.state || {};
  const ogr = state.veliAktifOgrenci || (state.veliOgrenciler || [])[0];
  if (!ogr?.id) throw new Error('Önce bir çocuk seçilmeli.');
  if (!d?.ogrenciGelisimTumGetir || !d?.mufredatAlanlariGetir) throw new Error('Eğitim veri katmanı hazır değil.');

  const gelisimPromise = d.ogrenciGelisimTumGetir(ogr.id);
  const galeriPromise = galeriGetir(ogr);
  const programPromise = Promise.all(PROGRAMLAR.map(async pr => {
    const [alanlar, aciklamalar] = await Promise.all([
      d.mufredatAlanlariGetir(pr.id).catch(() => []),
      d.mufredatAciklamalariGetir(pr.id).catch(() => ({alan:{},kazanim:{}}))
    ]);
    return [pr.id, { alanlar, aciklamalar, dersler:dersleriDuzlestir(alanlar) }];
  }));
  const [gelisim, galeri, programPairs] = await Promise.all([gelisimPromise, galeriPromise, programPromise]);
  return { ogr, gelisim, galeri, programlar:Object.fromEntries(programPairs) };
}

function loading() {
  return `<div class="veg"><div class="veg-top"><div><div class="veg-sub">EĞİTİM</div><div class="veg-title">Gelişim yolculuğu</div></div></div><div class="veg-empty">Eğitim gelişimi yükleniyor…</div></div>`;
}
function topbar(baslik, alt, geri) {
  return `<div class="veg-top">${geri ? '<button type="button" class="veg-back" data-act="geri" aria-label="Geri">←</button>' : ''}<div><div class="veg-sub">${esc(alt || 'EĞİTİM')}</div><div class="veg-title">${esc(baslik)}</div></div></div>`;
}
function hero() {
  const o = veri.ogr, ad = ogrAd(o), harf=(ad[0]||'?').toLocaleUpperCase('tr');
  return `<div class="veg-hero"><div class="veg-hero-avatar">${esc(harf)}</div><div><b>${esc(ad)}</b><span>${esc(ogrSinif(o))} · Eğitim gelişim yolculuğu</span></div><button type="button" class="veg-gallery-btn" data-act="galeri"><i data-lucide="images" style="width:15px;height:15px;vertical-align:-3px"></i> Eğitim Galerisi</button></div>`;
}

function programlarCiz() {
  const kartlar = PROGRAMLAR.map(pr => {
    const i=istatistik(pr.id);
    return `<button type="button" class="veg-card" data-act="program" data-program="${pr.id}"><div class="veg-prog-ust"><div class="veg-icon" style="background:${pr.acik};color:${pr.renk}"><i data-lucide="${pr.ikon}"></i></div><div class="veg-prog-ad" style="color:${pr.renk}">${esc(pr.ad)}</div><div class="veg-yuzde" style="color:${pr.renk}">%${i.yuzde}</div></div><div class="veg-bar"><span style="width:${i.yuzde}%;background:${pr.renk}"></span></div><div class="veg-ist"><span class="veg-pill" style="background:${DURUM.S.bg};color:${DURUM.S.renk}">Sunuldu ${i.s}</span><span class="veg-pill" style="background:${DURUM.T.bg};color:${DURUM.T.renk}">Tekrar ${i.t}</span><span class="veg-pill" style="background:${DURUM.U.bg};color:${DURUM.U.renk}">Ustalaştı ${i.u}</span><span class="veg-pill" style="background:#F4F6F5;color:#6E7B74">${i.calisilan}/${i.toplam}</span></div></button>`;
  }).join('');
  return `<div class="veg">${topbar('Eğitim Gelişimi','ÇOCUĞUNUZUN PROGRAMLARI',true)}${hero()}<div class="veg-grid">${kartlar}</div></div>`;
}

function programCiz(program) {
  const pr=programBilgi(program), pd=veri.programlar[program] || {alanlar:[],dersler:[]};
  const alanlar=(pd.alanlar||[]).map(a=>{
    const dersler=pd.dersler.filter(x=>x.alanId===a.id); let u=0,cal=0;
    dersler.forEach(x=>{const d=asamalariCoz(program,x.anahtar).durum;if(d){cal++;if(d==='U')u++;}});
    const y=dersler.length?Math.round(cal*100/dersler.length):0;
    return `<button type="button" class="veg-area" data-act="alan" data-program="${program}" data-alan="${attr(a.id)}"><div class="veg-area-ikon" style="background:${pr.acik};color:${pr.renk}">${a.ikon?`<i data-lucide="${esc(a.ikon)}"></i>`:'•'}</div><div class="veg-area-govde"><div class="veg-area-ad">${esc(a.ad||'Gelişim Alanı')}</div><div class="veg-area-alt">${cal}/${dersler.length} çalışıldı · ${u} ustalaştı</div></div><div class="veg-mini"><span style="width:${y}%;background:${pr.renk}"></span></div><span style="font-size:12px;font-weight:900;color:${pr.renk}">%${y}</span></button>`;
  }).join('');
  return `<div class="veg">${topbar(pr.ad,'PROGRAM',true)}${hero()}${alanlar?`<div class="veg-section">${alanlar}</div>`:'<div class="veg-empty">Bu program için henüz müfredat bulunmuyor.</div>'}</div>`;
}

function alanCiz(program, alanId) {
  const pr=programBilgi(program), pd=veri.programlar[program]||{};
  const alan=(pd.alanlar||[]).find(a=>a.id===alanId);
  if(!alan) return programCiz(program);
  let html='';
  (alan.gruplar||[]).forEach(g=>{
    html+=`<div class="veg-group">${esc(g.ad||'Çalışmalar')}</div>`;
    (g.dersler||[]).forEach(ders=>{
      const anahtar=`${alan.id}__${g.ad||''}__${ders}`; const r=asamalariCoz(program,anahtar); const st=DURUM[r.durum];
      const asamaSayisi=SIRA.filter(k=>r.asamalar[k]).length;
      html+=`<button type="button" class="veg-lesson" data-act="kazanim" data-program="${program}" data-key="${attr(anahtar)}"><div class="veg-status-dot" style="background:${st?.bg||'#F2F4F3'};color:${st?.renk||'#A1AAA5'}"><i data-lucide="${st?.ikon||'circle-dashed'}"></i></div><div class="veg-lesson-body"><div class="veg-lesson-ad">${esc(ders)}</div><div class="veg-lesson-alt">${asamaSayisi?asamaSayisi+' aşama kaydı':'Henüz gözlem yok'}${SIRA.some(k=>r.asamalar[k]?.fotoUrl&&fotoOnayli(r.asamalar[k]))?' · Fotoğraflı':''}</div></div>${st?`<span class="veg-status" style="background:${st.bg};color:${st.renk}">${st.ad}</span>`:'<span class="veg-status" style="background:#F3F5F4;color:#8A9691">Başlanmadı</span>'}</button>`;
    });
  });
  return `<div class="veg">${topbar(alan.ad||pr.ad,pr.ad,true)}${html||'<div class="veg-empty">Bu alanda çalışma bulunmuyor.</div>'}</div>`;
}

function kazanimiBul(program, anahtar) {
  return (veri.programlar[program]?.dersler||[]).find(x=>x.anahtar===anahtar) || null;
}
function detayCiz(program, anahtar) {
  const pr=programBilgi(program), k=kazanimiBul(program,anahtar), r=asamalariCoz(program,anahtar);
  if(!k) return programCiz(program);
  const st=DURUM[r.durum] || {ad:'Henüz başlanmadı',renk:'#8A9691',bg:'#F2F4F3',ikon:'circle-dashed'};
  const ac=D()?.aciklamaCoz ? D().aciklamaCoz(veri.programlar[program]?.aciklamalar,anahtar,k.alanId) : {metin:'',kaynak:''};
  const suan=SIRA.indexOf(r.durum);
  const steps=SIRA.map((kod,i)=>{
    const d=DURUM[kod], a=r.asamalar[kod]||null; const paylas=!a||a.paylas!==false;
    const done=Boolean(a)||(suan>=0&&i<suan), now=kod===r.durum;
    const url=a&&paylas&&fotoOnayli(a)?(a.fotoUrl||''):'';
    const not=a&&paylas?(a.not||''):''; const yazar=a&&paylas?(a.yazar||''):'';
    const tarih=a?.tarih||(now?r.tarihler[anahtar]:'');
    return `<div class="veg-step ${now?'now':done?'done':''}"><div class="veg-node"></div><div class="veg-step-title" style="color:${done||now?d.renk:'#A5AEA9'}">${d.ad}</div><div class="veg-step-date">${tarih?trTarih(tarih):(done?'Tamamlandı':'Henüz değil')}</div>${url?`<img class="veg-step-img" src="${attr(url)}" alt="${esc(d.ad)} fotoğrafı" data-photo="${attr(url)}" loading="lazy">`:''}${a&&paylas&&a.galeriId&&(a.fotoDurum==='beklemede'||a.fotoDurum==='onayBekliyor')?'<div class="veg-step-date" style="color:#B98500;margin-top:6px">Fotoğraf yönetim onayında</div>':''}${not?`<div class="veg-note">${esc(not)}${yazar?`<div class="veg-author">${esc(yazar)}</div>`:''}</div>`:''}</div>`;
  }).join('');
  return `<div class="veg">${topbar(k.dersAd,pr.ad+' · '+k.alanAd,true)}<div class="veg-detail-head"><div style="font-size:12px;color:#87928C;font-weight:750">GÜNCEL DURUM</div><div class="veg-current"><div class="veg-current-icon" style="background:${st.renk}"><i data-lucide="${st.ikon}"></i></div><div><div class="veg-current-ad" style="color:${st.renk}">${st.ad}</div><div class="veg-sub">${r.durum&&r.tarihler[anahtar]?trTarih(r.tarihler[anahtar]):'Aşama geçmişi aşağıda'}</div></div></div></div>${ac?.metin?`<div class="veg-why"><b>💡 Bu kazanım neden önemli?</b><p>${esc(ac.metin)}</p>${ac.kaynak==='alan'?`<div class="veg-author">${esc(k.alanAd)} alanı hakkında</div>`:''}</div>`:''}<div class="veg-road">${steps}</div></div>`;
}

function ciz() {
  const root=document.getElementById(hedefId); if(!root||!veri)return;
  if(ekran.tur==='program') root.innerHTML=programCiz(ekran.program);
  else if(ekran.tur==='alan') root.innerHTML=alanCiz(ekran.program,ekran.alanId);
  else if(ekran.tur==='detay') root.innerHTML=detayCiz(ekran.program,ekran.anahtar);
  else root.innerHTML=programlarCiz();
  bagla(root); ikonYenile();
}

function geri() {
  if(ekran.tur==='detay'){ekran={tur:'alan',program:ekran.program,alanId:kazanimiBul(ekran.program,ekran.anahtar)?.alanId||''};ciz();return;}
  if(ekran.tur==='alan'){ekran={tur:'program',program:ekran.program,alanId:'',anahtar:''};ciz();return;}
  if(ekran.tur==='program'){ekran={tur:'programlar',program:'',alanId:'',anahtar:''};ciz();return;}
  if(typeof window.caGo==='function') window.caGo('home');
}
function fotoAc(url) {
  document.getElementById('vegPhotoModal')?.remove();
  const d=document.createElement('div');d.id='vegPhotoModal';d.className='veg-photo-modal';d.innerHTML=`<button class="veg-photo-close" aria-label="Kapat">×</button><img src="${attr(url)}" alt="Eğitim aşaması fotoğrafı">`;d.onclick=e=>{if(e.target===d)d.remove()};d.querySelector('button').onclick=()=>d.remove();document.body.appendChild(d);
}
function bagla(root) {
  root.querySelectorAll('[data-act]').forEach(btn=>btn.addEventListener('click',()=>{
    const a=btn.dataset.act;
    if(a==='geri') geri();
    else if(a==='galeri') { if(typeof window.caGo==='function') window.caGo('galeri'); }
    else if(a==='program'){ekran={tur:'program',program:btn.dataset.program,alanId:'',anahtar:''};ciz();}
    else if(a==='alan'){ekran={tur:'alan',program:btn.dataset.program,alanId:btn.dataset.alan,anahtar:''};ciz();}
    else if(a==='kazanim'){ekran={tur:'detay',program:btn.dataset.program,alanId:'',anahtar:btn.dataset.key};ciz();}
  }));
  root.querySelectorAll('[data-photo]').forEach(img=>img.addEventListener('click',()=>fotoAc(img.dataset.photo)));
}

export async function render(id='cicekAppRoot') {
  hedefId=id;stilEkle();const root=document.getElementById(hedefId);if(!root)return;
  root.innerHTML=loading();ikonYenile();
  try { veri=await veriYukle(); ekran={tur:'programlar',program:'',alanId:'',anahtar:''}; ciz(); }
  catch(e){console.error('veli eğitim gelişimi',e);root.innerHTML=`<div class="veg"><div class="veg-empty">${esc(e.message||'Eğitim gelişimi yüklenemedi.')}</div></div>`;}
}

export function seciliCocuguYenile() { return render(hedefId); }
