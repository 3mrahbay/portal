// Offline structural test harness. Never evaluate the full application script.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const root = new URL('../../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
export const ROLES = ['admin', 'staff', 'parent'];
export const PHASES = ['loading', 'populated', 'stress', 'realtime'];
export const WIDTHS = [320, 360, 375, 390, 414, 430, 844, 1280, 1440];
export const RENDERERS = ['yonetimHomeHTML', 'dogumGunleriDoldur', 'okulZiliDoldur', 'devamKartiCiz', 'caHomeHTML', 'ogretmenHomeHTML'];
export const FIXED_NOW = '2026-10-05T09:30:00.000Z';
export const LONG_TOKEN = 'SyntheticUnbrokenLayoutProbe'.repeat(8);

export function assertNoCredentials(text) {
  if (/authkey|firebaseConfig|AIza[\w-]{15,}|(?:api[_-]?key|access[_-]?token)\s*[:=]/i.test(text)) {
    throw new Error('Refusing to use or emit credential-like content');
  }
}

export function extractRenderer(name, source = read('index.html')) {
  if (!RENDERERS.includes(name)) throw new Error(`Renderer not allowlisted: ${name}`);
  const named = `function ${name}(`;
  const assigned = `window.${name} = function(`;
  const start = source.indexOf(named) >= 0 ? source.indexOf(named) : source.indexOf(assigned);
  if (start < 0) throw new Error(`Missing renderer: ${name}`);
  // Production top-level functions end at column zero. Compile the selected
  // block independently; an unexpected formatting change fails closed.
  const end = /^};?\s*$/m.exec(source.slice(start));
  if (!end) throw new Error(`Missing renderer end: ${name}`);
  const selected = source.slice(start, start + end.index + end[0].trimEnd().length);
  assertNoCredentials(selected);
  new vm.Script(selected, { filename: `selected-${name}.js` });
  return selected;
}

export function sanitizeMarkup(html) {
  const result = String(html)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\s+on[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:src|srcset|href|action|formaction|poster)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<\/?(?:iframe|object|embed|link|base)\b[^>]*>/gi, '');
  assertNoCredentials(result);
  return result;
}

export function productionCss() {
  const head = read('index.html').split('</head>')[0];
  const styles = [...head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
  if (styles.length < 2) throw new Error('Expected both production head style blocks');
  styles.push(read('stil/arayuz-duzeltmeleri.css'));
  // Fonts and decorative images remain offline; no copied network resources.
  const css = styles.join('\n').replace(/@import\s+[^;]+;/gi, '').replace(/url\([^)]*\)/gi, 'none');
  assertNoCredentials(css);
  return css;
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [FIXED_NOW])); }
  static now() { return Date.parse(FIXED_NOW); }
}

export function syntheticData(phase = 'populated') {
  const stress = phase === 'stress' || phase === 'realtime';
  const label = stress ? `Synthetic long name ${LONG_TOKEN}` : 'Synthetic learner';
  const className = stress ? `Synthetic class ${LONG_TOKEN}` : 'Synthetic class A';
  const students = Array.from({ length: phase === 'loading' ? 0 : stress ? 18 : 4 }, (_, i) => ({
    id: `synthetic-student-${i}`, ogrenciAdSoyad: `${label} ${i + 1}`, sinif: className,
    dogumTarihi: `2021-10-${String(5 + i % 7).padStart(2, '0')}`, olusturuldu: `2026-10-0${1 + i % 4}T08:00:00Z`
  }));
  const settings = Object.fromEntries(students.map((o, i) => [o.id, {
    durum:'aktif', kayit:{sinif:o.sinif}, ogrenci:{dogumTarihi:o.dogumTarihi},
    anne:{adSoyad: stress ? `Synthetic guardian ${LONG_TOKEN}` : 'Synthetic guardian'},
    aidatAyarlari:{aylikAidat:stress ? 123456789 : 4500},
    aylikOdemeler:Object.fromEntries(['2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10'].map(k => [k, {odendi:i % 2 === 0, odenenTutar:i % 2 === 0 ? stress ? 123456789 : 4500 : 0, beklenenTutar:stress ? 123456789 : 4500}]))
  }]));
  const staff = students.slice(0,3).map((o,i) => ({adSoyad:`Synthetic staff ${stress ? LONG_TOKEN : i + 1}`, dogumTarihi:'1990-10-05', gorev:stress ? `Synthetic teacher ${LONG_TOKEN}` : 'Öğretmen', rol:'ogretmen', durum:i === 1 ? 'izinli' : 'aktif'}));
  const pickup = students.slice(0, stress ? 10 : 3).map((o,i) => ({
    id:`pickup-${i}`, ogrenciId:o.id, ogrenciAd:o.ogrenciAdSoyad, sinif:o.sinif,
    tarih:'2026-10-05', hedefSaat:'09:15', alanKisi:stress ? `Synthetic collector ${LONG_TOKEN}` : 'Synthetic guardian',
    durum:phase === 'realtime' && i === 0 ? 'teslim' : ['yolda','hazir','teslim'][i % 3],
    olusturuldu:`2026-10-05T09:${String(20-i).padStart(2,'0')}:00Z`,
    hazirZamani:i ? '2026-10-05T09:25:00Z' : '',
    teslimZamani:(i % 3 === 2 || phase === 'realtime' && i === 0) ? '2026-10-05T09:29:00Z' : '',
    teslimEden:stress ? `Synthetic teacher ${LONG_TOKEN}` : 'Synthetic teacher',
    danismaNotu:stress ? `Synthetic note ${LONG_TOKEN}` : '',
    kapida:phase === 'realtime', kimlikKontrol:phase === 'realtime', veliOnay:phase === 'realtime'
  }));
  const attendance = phase === 'realtime' ? [{tip:'giris',zaman:'2026-10-05T08:00:00Z'},{tip:'mola-basla',zaman:'2026-10-05T09:20:00Z'}] : phase === 'loading' ? [] : [{tip:'giris',zaman:'2026-10-05T08:00:00Z'}];
  return {stress,label,className,students,settings,staff,pickup,attendance};
}

export function createHarness(role = 'admin', phase = 'populated') {
  if (!ROLES.includes(role) || !PHASES.includes(phase)) throw new Error('Unknown fixture scenario');
  const data = syntheticData(phase);
  const nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, {id,innerHTML:'',textContent:''}); return nodes.get(id); };
  const context = vm.createContext({
    Date:FixedDate, URLSearchParams, location:{search:''}, console:{log(){},warn(){}}, window:{},
    document:{getElementById:node},
    ogrenciList:data.students, ayarListesi:data.settings, personelListesi:data.staff,
    AKTIF_DONEM:'2026-2027', currentUser:{displayName:phase === 'loading' ? 'Synthetic parent' : `Synthetic${data.stress ? LONG_TOKEN : ''} parent`},
    aktifKullaniciSiniflari:[data.className], veliAktifOgrenci:data.students[0] || null, veliOgrenciler:data.students.slice(0,3),
    takvimEtkinlikler:[{tarih:'2026-10-05',baslangicSaat:'10:30',baslik:`Synthetic event ${data.stress ? LONG_TOKEN : 'activity'}`}],
    randevuListesi:[{tarih:'2026-10-05',saat:'11:30',baslik:`Synthetic appointment ${data.stress ? LONG_TOKEN : 'meeting'}`,ad:'Synthetic family'}],
    basvuruListesi:data.students.map(() => ({durum:'beklemede'})),
    getOgrenciDurum:()=>'aktif', escapeHtml:esc, escapeHtmlGelisim:esc, hesaplaYas:()=> '5 yaş',
    danismaRolMu:()=>false, ogretmenRolMu:()=>role === 'staff', danismaProjeksiyonYonetebilirMi:()=>role === 'admin',
    bildirimZamani:value => Date.parse(value), enYeniBildirimOnce:(a,b)=> Date.parse(b.olusturuldu)-Date.parse(a.olusturuldu),
    // Only the parent favorites helper is a synthetic stub; the home renderer is production.
    caHizliIslemlerHTML:()=> ['Günlük Rapor','Galeri','Mesajlar','Takvim','Ödemeler','Çocuğum'].map(t=>`<button class="ca-qbtn"><span class="ca-qicon">◇</span><span class="ca-qlabel">${t}</span></button>`).join('')
  });
  context.window.lucideYenile = () => {};
  context.window.okulZiliCanliBaslat = () => { throw new Error('Live network startup must never run in the fixture'); };
  context.window.okulZiliCanliDurdur = () => {};
  for (const name of RENDERERS) new vm.Script(extractRenderer(name)).runInContext(context, {timeout:1000});
  return {context,nodes,node,data,role,phase};
}

function loadedPatches(h) {
  const {context:c,data:d,node,role,phase} = h;
  const notice = `<p class="ca-tile-sub">Synthetic ${phase === 'realtime' ? 'realtime revision 2' : 'loaded'} content ${d.stress ? LONG_TOKEN : 'ready'}</p>`;
  if (role !== 'parent') {
    c.window.okulZiliDoldur({forEach:fn=>d.pickup.forEach(row=>fn({id:row.id,data:()=>row}))});
    c.window.devamKartiCiz({kayitlar:d.attendance}, 'ozetDevamKart');
  }
  if (role === 'admin') c.window.dogumGunleriDoldur();
  // Nonselected asynchronous modules use visibly synthetic representative bodies.
  const ids = role === 'parent'
    ? ['veliSabahGirisiKart','veliOkulZiliKart','veliIzinKart','veliPickupYetkiKart','caHomeGunluk','caHomeTakvimOnizleme','caHomeMesajlar','caHomeEgitimOzet']
    : role === 'staff' ? ['ogrHomePlan','ogrSabahGirisiKart','ogrVeliIzinKart','ogrHomeMesajlar','ogrHomeRandevu','ogrHomeYemek','ogrHomeSinif','ogrHomeDuyuru']
    : ['yonSabahGirisiKart','ozetDanismaKart','yonVeliIzinKart','egitimIlerlemeListe','ozetYemekBugun'];
  ids.forEach(id => { node(id).innerHTML = `<div data-synthetic-module="${id}" style="padding:12px;">${notice}</div>`; });
  if (role === 'staff') node('ogrHomeYoklama').innerHTML = '<div><strong>18</strong><div>geldi</div></div><div><strong>2</strong><div>izinli</div></div>';
  return Object.fromEntries([...h.nodes].filter(([,v])=>v.innerHTML || v.textContent).map(([id,v]) => [id,v.textContent ? {text: v.textContent} : {html:sanitizeMarkup(v.innerHTML)}]));
}

export function renderScenario(role, phase) {
  const h = createHarness(role, phase);
  const fn = role === 'admin' ? 'yonetimHomeHTML' : role === 'staff' ? 'ogretmenHomeHTML' : 'caHomeHTML';
  const html = sanitizeMarkup(h.context[fn](`Synthetic staff ${h.data.stress ? LONG_TOKEN : 'member'}`));
  const patches = phase === 'loading' ? {} : loadedPatches(h);
  return {role, phase, html, patches, renderer:fn};
}

export function buildScenarios() {
  return Object.fromEntries(ROLES.map(role => [role,Object.fromEntries(PHASES.map(phase=>[phase,renderScenario(role,phase)]))]));
}

export function lateReceptionCss() {
  const source = read('moduller/personel-anlik-bildirim.js');
  const start = source.indexOf('function danismaMobilStilEkle()');
  const match = /st\.textContent\s*=\s*`([\s\S]*?)`/.exec(source.slice(start));
  if (!match || match[1].includes('${')) throw new Error('Expected literal reception CSS');
  assertNoCredentials(match[1]);
  return match[1];
}
