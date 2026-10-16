// VELİ — ANI VİDEOLARI
// Sunucu (zeky-backend/prod-work/ani-video) her hafta çocuğun fotoğraflarından okul logolu,
// müzikli kısa bir video hazırlar ve aniVideolari/{ogrenciId}__{anahtar} belgesine yazar.
// Veli yalnız kendi çocuğunun yayındaki videolarını okuyabilir (Firestore kuralı).
// Kural henüz yoksa veya video yoksa bölümler gizli kalır; hata göstermez.
//
//   m.profilBolumu("caProfilVideoBolum")  → çocuk profilinde video şeridi
//   m.anaSayfaUyari("caHomeAniVideo")     → izlenmemiş yeni video varsa ana sayfada kısa kart

const P = () => window.PortalAPI;
const ONBELLEK_MS = 5 * 60 * 1000;
const _onbellek = new Map();   // ogrenciId → { zaman, liste }

function esc(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Yalnız Firebase Storage indirme adresleri oynatılır
export function guvenliAdres(url) {
  try {
    const u = new URL(String(url || ''));
    return u.protocol === 'https:' && u.hostname === 'firebasestorage.googleapis.com' ? u.href : '';
  } catch (_) { return ''; }
}

function zamanMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : 0;
}

export function videoNormalle(id, v = {}) {
  const url = guvenliAdres(v.url);
  if (!url || v.yayinda !== true) return null;
  return {
    id, url, kapak: guvenliAdres(v.kapakUrl),
    baslik: String(v.baslik || 'Anı videosu').slice(0, 80),
    alt: String(v.alt || '').slice(0, 80),
    sure: Math.round(Number(v.sureSn) || 0),
    tur: String(v.tur || ''),
    zaman: zamanMs(v.olusturuldu)
  };
}

function aktifOgrenci() {
  const s = P()?.state || {};
  return s.veliAktifOgrenci || s.veliOgrenciler?.[0] || null;
}

export async function videolariGetir(ogrenciId, { tazele = false } = {}) {
  if (!ogrenciId) return [];
  const o = _onbellek.get(ogrenciId);
  if (!tazele && o && Date.now() - o.zaman < ONBELLEK_MS) return o.liste;
  const { fb, db } = P();
  const snap = await fb.getDocs(fb.query(fb.collection(db, 'aniVideolari'),
    fb.where('ogrenciId', '==', ogrenciId), fb.where('yayinda', '==', true)));
  const liste = [];
  snap.forEach(d => { const v = videoNormalle(d.id, d.data()); if (v) liste.push(v); });
  liste.sort((a, b) => b.zaman - a.zaman || b.id.localeCompare(a.id));
  _onbellek.set(ogrenciId, { zaman: Date.now(), liste });
  return liste;
}

// ── izlendi bilgisi (yalnız bu tarayıcıda; kaybolursa en kötü ihtimalle kart bir kez daha görünür)
const gorulduAnahtari = (ogrId) => `aniVideoGoruldu_${ogrId}`;
function sonGorulen(ogrId) {
  try { return Number(localStorage.getItem(gorulduAnahtari(ogrId)) || 0); } catch (_) { return 0; }
}
function gorulduIsaretle(ogrId, zaman) {
  try { if (zaman > sonGorulen(ogrId)) localStorage.setItem(gorulduAnahtari(ogrId), String(zaman)); } catch (_) {}
}

function stilEkle() {
  if (document.getElementById('vav-stil')) return;
  const s = document.createElement('style');
  s.id = 'vav-stil';
  s.textContent = `
.vav-serit { display:flex; gap:10px; overflow-x:auto; padding:2px 2px 6px; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; }
.vav-kart { position:relative; flex:0 0 116px; aspect-ratio:9/16; border:0; padding:0; border-radius:16px; overflow:hidden; cursor:pointer;
  background:linear-gradient(160deg,#4A7C59,#2D5E3E); scroll-snap-align:start; color:#fff; font:inherit; text-align:left; }
.vav-kart img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
.vav-kart::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(20,45,28,.82) 100%); }
.vav-oynat { position:absolute; top:50%; left:50%; width:40px; height:40px; margin:-28px 0 0 -20px; border-radius:50%;
  background:rgba(255,255,255,.92); display:flex; align-items:center; justify-content:center; z-index:1; box-shadow:0 4px 14px rgba(0,0,0,.25); }
.vav-oynat svg { width:16px; height:16px; margin-left:3px; fill:#2D5E3E; }
.vav-yazi { position:absolute; left:9px; right:9px; bottom:9px; z-index:1; }
.vav-yazi b { display:block; font-size:12.5px; line-height:1.25; font-weight:700; }
.vav-yazi span { display:block; font-size:10.5px; opacity:.85; margin-top:2px; }
.vav-yeni { position:absolute; top:8px; left:8px; z-index:1; background:#F2C14E; color:#3D2E00; font-size:10px; font-weight:800;
  padding:3px 7px; border-radius:999px; letter-spacing:.02em; }
.vav-uyari { width:100%; display:flex; align-items:center; gap:12px; padding:10px 12px; border:1px solid #CFE6D3; border-radius:16px;
  background:#EEF6EF; color:#1F3F2A; font:inherit; text-align:left; cursor:pointer; }
.vav-uyari img, .vav-uyari .vav-mini { width:42px; height:56px; border-radius:10px; object-fit:cover; flex:0 0 auto; background:#4A7C59; }
.vav-uyari b { display:block; font-size:14px; }
.vav-uyari span { display:block; font-size:12px; color:#3F6B4C; margin-top:1px; }
.vav-uyari .vav-ok { margin-left:auto; font-size:18px; color:#4A7C59; }
.vav-perde { position:fixed; inset:0; z-index:10050; background:rgba(8,20,12,.94); display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:12px; padding:max(14px, env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-right, 0px))
  max(14px, env(safe-area-inset-bottom, 0px)) max(14px, env(safe-area-inset-left, 0px)); }
.vav-perde video { width:min(100%, calc((100dvh - 120px) * 9 / 16)); max-height:calc(100dvh - 120px); aspect-ratio:9/16;
  border-radius:18px; background:#000; display:block; }
.vav-perde-ust { width:min(100%, 520px); display:flex; align-items:center; gap:10px; color:#fff; }
.vav-perde-ust div { min-width:0; }
.vav-perde-ust b { display:block; font-size:15px; }
.vav-perde-ust span { display:block; font-size:12px; opacity:.75; }
.vav-kapat { margin-left:auto; width:40px; height:40px; border-radius:50%; border:0; background:rgba(255,255,255,.14); color:#fff;
  font-size:22px; line-height:1; cursor:pointer; flex:0 0 auto; }
.vav-kapat:focus-visible, .vav-kart:focus-visible, .vav-uyari:focus-visible { outline:3px solid #F2C14E; outline-offset:2px; }`;
  document.head.appendChild(s);
}

const OYNAT_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';

// Tam ekran oynatıcı
let _perde = null, _onceki = null;
function kapat() {
  if (!_perde) return;
  const v = _perde.querySelector('video');
  try { v.pause(); v.removeAttribute('src'); v.load(); } catch (_) {}
  _perde.remove(); _perde = null;
  document.body.style.overflow = '';
  document.removeEventListener('keydown', tusla);
  try { _onceki?.focus?.(); } catch (_) {}
}
function tusla(e) { if (e.key === 'Escape') kapat(); }

export function oynat(video, ogrId) {
  if (!video?.url) return;
  stilEkle();
  kapat();
  _onceki = document.activeElement;
  const perde = document.createElement('div');
  perde.className = 'vav-perde';
  perde.setAttribute('role', 'dialog');
  perde.setAttribute('aria-modal', 'true');
  perde.setAttribute('aria-label', video.baslik);
  perde.innerHTML = `
    <div class="vav-perde-ust"><div><b>${esc(video.baslik)}</b><span>${esc(video.alt)}</span></div>
      <button type="button" class="vav-kapat" aria-label="Kapat">×</button></div>
    <video controls playsinline autoplay preload="auto"></video>`;
  const v = perde.querySelector('video');
  v.src = video.url;
  if (video.kapak) v.poster = video.kapak;
  perde.querySelector('.vav-kapat').addEventListener('click', kapat);
  perde.addEventListener('click', (e) => { if (e.target === perde) kapat(); });
  document.body.appendChild(perde);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', tusla);
  _perde = perde;
  perde.querySelector('.vav-kapat').focus();
  gorulduIsaretle(ogrId, video.zaman);
  document.querySelectorAll(`[data-vav-yeni="${CSS.escape(video.id)}"]`).forEach(el => el.remove());
  const uyari = document.getElementById('caHomeAniVideo');
  if (uyari && uyari.dataset.vavId === video.id) { uyari.hidden = true; uyari.innerHTML = ''; }
}

function kartHTML(v, i, yeni) {
  return `<button type="button" class="vav-kart" data-vav="${i}" aria-label="${esc(v.baslik)} — oynat">
    ${v.kapak ? `<img src="${esc(v.kapak)}" alt="" loading="lazy">` : ''}
    ${yeni ? `<span class="vav-yeni" data-vav-yeni="${esc(v.id)}">YENİ</span>` : ''}
    <span class="vav-oynat">${OYNAT_SVG}</span>
    <span class="vav-yazi"><b>${esc(v.baslik)}</b><span>${esc(v.alt)}</span></span>
  </button>`;
}

export async function profilBolumu(hedefId) {
  const el = document.getElementById(hedefId);
  const ogr = aktifOgrenci();
  if (!el || !ogr?.id) return;
  let liste;
  try { liste = await videolariGetir(ogr.id); } catch (_) { el.hidden = true; return; }
  if (!el.isConnected || aktifOgrenci()?.id !== ogr.id) return;
  if (!liste.length) { el.hidden = true; el.innerHTML = ''; return; }
  stilEkle();
  const gorulen = sonGorulen(ogr.id);
  el.innerHTML = `
    <div class="ca-sectionhead"><h3 class="ca-head" style="font-size:15px;">Anı videoları</h3>
      <span class="ca-tile-sub">${liste.length} video</span></div>
    <div class="vav-serit">${liste.map((v, i) => kartHTML(v, i, v.zaman > gorulen)).join('')}</div>`;
  el.querySelectorAll('[data-vav]').forEach(b => b.addEventListener('click', () => oynat(liste[Number(b.dataset.vav)], ogr.id)));
  el.hidden = false;
}

export async function anaSayfaUyari(hedefId) {
  const el = document.getElementById(hedefId);
  const ogr = aktifOgrenci();
  if (!el || !ogr?.id) return;
  let liste;
  try { liste = await videolariGetir(ogr.id); } catch (_) { el.hidden = true; return; }
  if (!el.isConnected || aktifOgrenci()?.id !== ogr.id) return;
  const yeni = liste[0];
  if (!yeni || yeni.zaman <= sonGorulen(ogr.id)) { el.hidden = true; el.innerHTML = ''; return; }
  stilEkle();
  el.dataset.vavId = yeni.id;
  el.innerHTML = `<button type="button" class="vav-uyari">
    ${yeni.kapak ? `<img src="${esc(yeni.kapak)}" alt="">` : '<span class="vav-mini"></span>'}
    <span><b>${esc(yeni.baslik)} hazır</b><span>${esc(yeni.alt)}${yeni.sure ? ` · ${yeni.sure} sn` : ''} · İzlemek için dokunun</span></span>
    <span class="vav-ok">›</span></button>`;
  el.querySelector('button').addEventListener('click', () => oynat(yeni, ogr.id));
  el.hidden = false;
}
