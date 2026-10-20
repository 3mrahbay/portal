// ÇOKLU ÖĞRENCİ SEÇİCİ — duyuru ve takvim formlarında "Öğrenciler" hedefi
//
// Arama, sınıfa göre süzme, "Görünenleri seç", "Temizle" ve "N öğrenci seçili"
// sayacı olan dokunmatik uyumlu onay kutusu listesi. ZEKY'deki tercih-olustur
// ekranıyla aynı davranış. Firebase'e dokunmaz; seçim yalnız bellekte tutulur.
//
//   const secici = ogrenciCokluSecici(kapEl, { ogrenciler: [{ id, ad, sinif }], secili: [id] });
//   secici.seciliIdler()      → ['id1', 'id2']
//   secici.seciliOgrenciler() → [{ id, ad, sinif }]
//   secici.ayarla(['id1'])    · secici.ogrencileriAyarla(liste) · secici.temizle()

const STIL_ID = 'ocs-stil';
const STIL = `
.ocs{border:1px solid var(--gray-200,#e5e7eb);border-radius:12px;background:#fff;overflow:hidden}
.ocs-ust{display:flex;flex-direction:column;gap:8px;padding:10px;border-bottom:1px solid var(--gray-100,#f3f4f6);background:#fafaf9}
.ocs .ocs-ara{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--gray-300,#d1d5db);border-radius:10px;font-size:14px;min-height:42px;background:#fff}
.ocs-siniflar{display:flex;gap:6px;flex-wrap:wrap}
.ocs-sinif{border:1px solid var(--gray-300,#d1d5db);background:#fff;color:var(--gray-700,#374151);border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;min-height:32px}
.ocs-sinif[aria-pressed="true"]{background:#2d6a4f;border-color:#2d6a4f;color:#fff}
.ocs-arac{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ocs-btn{border:1px solid var(--gray-300,#d1d5db);background:#fff;color:var(--gray-700,#374151);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;min-height:32px}
.ocs-sayac{margin-left:auto;font-size:12.5px;font-weight:700;color:#2d6a4f}
.ocs-liste{max-height:260px;overflow-y:auto;-webkit-overflow-scrolling:touch}
/* Portal .form-group label/input biçimleri seçicinin satırlarına sızmasın */
.ocs .ocs-satir{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:0;border-bottom:1px solid var(--gray-100,#f3f4f6);cursor:pointer;min-height:44px;box-sizing:border-box;text-transform:none;letter-spacing:normal;font-weight:400;font-size:14px;color:var(--gray-800,#1f2937)}
.ocs .ocs-satir:last-child{border-bottom:none}
.ocs .ocs-satir input[type=checkbox]{width:18px;height:18px;min-height:0;flex:none;accent-color:#2d6a4f;margin:0;padding:0;border:none}
.ocs-ad{flex:1;min-width:0;font-size:14px;color:var(--gray-800,#1f2937);overflow-wrap:anywhere}
.ocs-sinif-ad{flex:none;font-size:11.5px;color:var(--gray-500,#6b7280)}
.ocs-satir.secili{background:#f0fdf4}
.ocs-bos{padding:16px;text-align:center;font-size:13px;color:var(--gray-500,#6b7280)}
`;

function kacis(deger) {
  return String(deger ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function sade(deger) {
  return String(deger || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
}
function stilEkle(belge) {
  if (!belge || belge.getElementById(STIL_ID)) return;
  const st = belge.createElement('style');
  st.id = STIL_ID;
  st.textContent = STIL;
  belge.head.appendChild(st);
}
function hazirla(liste) {
  const gorulen = new Set();
  return (Array.isArray(liste) ? liste : [])
    .map(o => ({ id: String(o?.id || '').trim(), ad: String(o?.ad || '').trim(), sinif: String(o?.sinif || '').trim() }))
    .filter(o => o.id && !gorulen.has(o.id) && gorulen.add(o.id))
    .sort((a, b) => a.sinif.localeCompare(b.sinif, 'tr') || a.ad.localeCompare(b.ad, 'tr'));
}

export function ogrenciCokluSecici(kap, { ogrenciler = [], secili = [], bosMetin = 'Seçilebilecek öğrenci yok', onDegisti } = {}) {
  if (!kap) throw new Error('Öğrenci seçici için kap öğesi gerekli');
  const belge = kap.ownerDocument || document;
  stilEkle(belge);
  let liste = hazirla(ogrenciler);
  let secim = new Set((secili || []).map(String));
  let ara = '';
  let sinifSuzgeci = '';

  kap.innerHTML = `<div class="ocs">
    <div class="ocs-ust">
      <input type="search" class="ocs-ara" placeholder="Öğrenci ara…" aria-label="Öğrenci ara" autocomplete="off">
      <div class="ocs-siniflar" role="group" aria-label="Sınıfa göre süz"></div>
      <div class="ocs-arac">
        <button type="button" class="ocs-btn" data-islem="gorunenler">Görünenleri seç</button>
        <button type="button" class="ocs-btn" data-islem="temizle">Seçimi temizle</button>
        <span class="ocs-sayac" aria-live="polite"></span>
      </div>
    </div>
    <div class="ocs-liste" role="group" aria-label="Öğrenciler"></div>
  </div>`;
  const araEl = kap.querySelector('.ocs-ara');
  const sinifEl = kap.querySelector('.ocs-siniflar');
  const listeEl = kap.querySelector('.ocs-liste');
  const sayacEl = kap.querySelector('.ocs-sayac');

  const gorunenler = () => liste.filter(o =>
    (!sinifSuzgeci || o.sinif === sinifSuzgeci) && (!ara || sade(o.ad).includes(ara) || sade(o.sinif).includes(ara)));

  function sayaciYaz() {
    // Listede olmayan (ör. pasife alınmış ya da sınıfı değişmiş) seçimler de sayılır ve
    // kayıttan düşmez; kullanıcı fark etsin diye ayrıca belirtilir.
    const gizli = [...secim].filter(id => !liste.some(o => o.id === id)).length;
    sayacEl.textContent = secim.size
      ? `${secim.size} öğrenci seçili${gizli ? ` (${gizli} öğrenci listede yok)` : ''}`
      : 'Öğrenci seçilmedi';
  }
  function siniflariCiz() {
    const siniflar = [...new Set(liste.map(o => o.sinif).filter(Boolean))];
    if (siniflar.length < 2) { sinifEl.innerHTML = ''; sinifEl.style.display = 'none'; sinifSuzgeci = ''; return; }
    sinifEl.style.display = '';
    if (sinifSuzgeci && !siniflar.includes(sinifSuzgeci)) sinifSuzgeci = '';
    sinifEl.innerHTML = [['', 'Tümü'], ...siniflar.map(s => [s, s])]
      .map(([deger, ad]) => `<button type="button" class="ocs-sinif" data-sinif="${kacis(deger)}" aria-pressed="${deger === sinifSuzgeci}">${kacis(ad)}</button>`).join('');
  }
  function listeyiCiz() {
    const g = gorunenler();
    listeEl.innerHTML = g.length ? g.map(o => {
      const s = secim.has(o.id);
      return `<label class="ocs-satir${s ? ' secili' : ''}"><input type="checkbox" data-id="${kacis(o.id)}"${s ? ' checked' : ''}>`
        + `<span class="ocs-ad">${kacis(o.ad || 'Adsız öğrenci')}</span>${o.sinif ? `<span class="ocs-sinif-ad">${kacis(o.sinif)}</span>` : ''}</label>`;
    }).join('') : `<div class="ocs-bos">${kacis(liste.length ? 'Aramayla eşleşen öğrenci yok' : bosMetin)}</div>`;
    sayaciYaz();
  }
  function bildir() {
    sayaciYaz();
    if (typeof onDegisti === 'function') { try { onDegisti(api.seciliIdler()); } catch (e) { console.warn('öğrenci seçici:', e); } }
  }

  araEl.addEventListener('input', () => { ara = sade(araEl.value.trim()); listeyiCiz(); });
  sinifEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-sinif]');
    if (!btn) return;
    sinifSuzgeci = btn.getAttribute('data-sinif') || '';
    siniflariCiz();
    listeyiCiz();
  });
  listeEl.addEventListener('change', e => {
    const kutu = e.target.closest('input[data-id]');
    if (!kutu) return;
    const id = kutu.getAttribute('data-id');
    if (kutu.checked) secim.add(id); else secim.delete(id);
    kutu.closest('.ocs-satir')?.classList.toggle('secili', kutu.checked);
    bildir();
  });
  kap.querySelector('.ocs-arac').addEventListener('click', e => {
    const islem = e.target.closest('[data-islem]')?.getAttribute('data-islem');
    if (islem === 'gorunenler') gorunenler().forEach(o => secim.add(o.id));
    else if (islem === 'temizle') secim.clear();
    else return;
    listeyiCiz();
    bildir();
  });

  const api = {
    seciliIdler() {
      // Liste sırasıyla; listede olmayan eski seçimler sona eklenir.
      const sirali = liste.filter(o => secim.has(o.id)).map(o => o.id);
      return [...sirali, ...[...secim].filter(id => !sirali.includes(id))];
    },
    seciliOgrenciler() {
      return api.seciliIdler().map(id => liste.find(o => o.id === id) || { id, ad: '', sinif: '' });
    },
    ayarla(idler) { secim = new Set((idler || []).map(String).filter(Boolean)); listeyiCiz(); },
    ogrencileriAyarla(yeni) { liste = hazirla(yeni); siniflariCiz(); listeyiCiz(); },
    temizle() { secim.clear(); ara = ''; araEl.value = ''; sinifSuzgeci = ''; siniflariCiz(); listeyiCiz(); }
  };
  siniflariCiz();
  listeyiCiz();
  return api;
}
