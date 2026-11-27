// Pure, shared Portal/ZEKY reporting. Never writes or repairs attendance records.
export function okulGunu(value = new Date()) {
  const date = tarihOku(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Istanbul', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(k => parts.find(p => p.type === k).value).join('-');
}
export function tarihOku(value) {
  if (value == null || value === '') return null;
  let d;
  try { d = typeof value.toDate === 'function' ? value.toDate() :
    typeof value.seconds === 'number' ? new Date(value.seconds * 1000) : new Date(value); } catch { return null; }
  return Number.isFinite(d?.getTime()) ? d : null;
}
export function gunuHesapla(kayitlar = [], bugunMu = false, simdi = new Date()) {
  const dilimler = [], sorunlar = [];
  const s = kayitlar.map(k => ({...k, _t:tarihOku(k.zaman)})).filter(k => {
    if (!k._t) sorunlar.push('Geçersiz kayıt zamanı');
    return k._t;
  }).sort((a,b) => a._t-b._t);
  let durum = 'disarida', bas = null, giris = null, cikis = null;
  const kapat = (bit, acik = false) => {
    if (bas && bit >= bas) dilimler.push({tur:durum === 'molada' ? 'mola' : 'calisma',bas,bit,acik});
  };
  for (const k of s) {
    if (k._t > simdi) { sorunlar.push('Gelecek zamanlı kayıt'); continue; }
    if (k.tarih && okulGunu(k._t) !== k.tarih) { sorunlar.push('Tarih ve saat uyuşmuyor'); continue; }
    if (k.tip === 'giris' && durum === 'disarida') {
      durum='iceride'; bas=k._t; giris ||= k._t;
    } else if (k.tip === 'mola-basla' && durum === 'iceride') {
      kapat(k._t); durum='molada'; bas=k._t;
    } else if (k.tip === 'mola-bitir' && durum === 'molada') {
      kapat(k._t); durum='iceride'; bas=k._t;
    } else if (k.tip === 'cikis' && durum !== 'disarida') {
      kapat(k._t); durum='disarida'; bas=null; cikis=k._t;
    } else sorunlar.push('Tekrarlı veya sırasız hareket');
  }
  const acik = durum !== 'disarida' && bugunMu && okulGunu(bas) === okulGunu(simdi);
  const eksikCikis = durum !== 'disarida' && !acik;
  if (acik) kapat(simdi, true);
  if (eksikCikis) sorunlar.push('Çıkış kaydı eksik');
  const dk = tur => dilimler.filter(d => d.tur === tur).reduce((n,d) => n+(d.bit-d.bas)/60000,0);
  const calisma=dk('calisma'), mola=dk('mola');
  return {dilimler, calisma, net:calisma, mola, giris, cikis, acik, eksikCikis, durum, kayitlar:s, sorunlar:[...new Set(sorunlar)]};
}
export function dakikaYaz(value) {
  const n=Math.max(0,Math.round(Number(value)||0));
  return `${Math.floor(n/60)} sa ${String(n%60).padStart(2,'0')} dk`;
}
export function aylikOzet(personeller, kayitlar, ay, simdi=new Date()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ay)) throw Error('Geçerli bir ay seçin.');
  const bugun=okulGunu(simdi), gruplar=new Map();
  for (const k of kayitlar) {
    if (!String(k.tarih||'').startsWith(ay+'-')) continue;
    const e=String(k.personelEmail||'').trim().toLowerCase();
    if (!gruplar.has(e)) gruplar.set(e,new Map());
    const g=gruplar.get(e); if(!g.has(k.tarih)) g.set(k.tarih,[]); g.get(k.tarih).push(k);
  }
  return personeller.map(p => {
    const email=String(p.email||'').trim().toLowerCase(), gunler=[];
    for(const [tarih, hareketler] of gruplar.get(email)||[]) gunler.push({tarih,...gunuHesapla(hareketler,tarih===bugun,simdi)});
    gunler.sort((a,b)=>a.tarih.localeCompare(b.tarih));
    const sorunlu=gunler.filter(g=>g.sorunlar.length), acik=gunler.filter(g=>g.acik).length;
    return {email, ad:p.adSoyad||[p.ad,p.soyad].filter(Boolean).join(' ')||email, rol:p.unvan||p.rol||'Personel', gunler,
      net:gunler.reduce((n,g)=>n+g.net,0), mola:gunler.reduce((n,g)=>n+g.mola,0),
      gun:gunler.filter(g=>g.giris).length, sorunlu: sorunlu.length, acik,
      uzunGun:gunler.filter(g=>g.net>660).length};
  }).sort((a,b)=>b.sorunlu-a.sorunlu||a.ad.localeCompare(b.ad,'tr'));
}
export function csvHucre(value) {
  let s=String(value??'');
  if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
