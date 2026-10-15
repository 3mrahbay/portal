// ═══════════════════════════════════════════════════════════════════
// MEB DENETİM HAZIRLIĞI — moduller/meb-denetim.js
// ZEKY ile ORTAK veri: mebDenetim/durum (yalnız kurucu müdür ve müdür)
//
// Her madde için: durum, not, sorumlu, son kontrol tarihi, geçerlilik bitişi
// ve kanıt (belge yeri / bağlantı). Periyodik maddelerde (ör. "son 6 ay")
// sonraki kontrol tarihi hesaplanır; süresi geçen "Uyumlu" madde skorda eksik
// sayılır. Okula özel madde eklenebilir. Değişiklikler anında kaydedilir.
// Hesaplar ortak çekirdekte: js/meb-denetim-cekirdek.js (ZEKY'de birebir kopya).
//
// Kullanım: m.panelKur("denetimKok")
// ═══════════════════════════════════════════════════════════════════
import {
  DENETIM_BELGE, DENETIM_DURUMLAR, DURUM_SIRASI, ESKI_DENETIM_BELGE, FILTRELER, MEB_DENETIM_SURUM,
  OZEL_KATEGORI, PERIYOTLAR, SINIRLAR, bugunIstanbul, eskiKayitlariTasi, etkinDurum, filtreUyar,
  kategorileriTopla, kayitDuzenle, maddeIdGecerli, ozelMaddeDuzenle, ozelMaddeIdUret, ozetHesapla,
  sonrakiDurum, sureDurumu, tarihYazi
} from '../js/meb-denetim-cekirdek.js';

const P = () => window.PortalAPI;

export function esc(deger) {
  return String(deger ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const KURAL_PARCASI = `match /mebDenetim/{docId} {
  allow read, write: if isAdmin() || isYonetim();
}`;

const STIL = `
.md-hero{background:linear-gradient(135deg,#1F2A3F 0%,#2B3674 100%);border-radius:20px;padding:24px 28px;margin-bottom:18px;color:#fff;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}
.md-hero h2{font-family:var(--font-display);font-weight:700;font-size:25px;margin:6px 0 6px;letter-spacing:-.02em}
.md-hero p{margin:0;opacity:.9;font-size:13.5px;max-width:640px;line-height:1.5}
.md-etiket{font-size:11px;font-weight:700;letter-spacing:1.6px;opacity:.85}
.md-sayilar{display:flex;gap:10px;flex-wrap:wrap}
.md-sayi{background:rgba(255,255,255,.12);border-radius:14px;padding:12px 16px;min-width:96px;text-align:center}
.md-sayi b{display:block;font-size:26px;line-height:1.1}
.md-sayi span{font-size:11px;opacity:.85}
.md-sayi.uyari b{color:#FFB4B4}
.md-arac{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.md-arac input{flex:1;min-width:180px;padding:9px 12px;border:1px solid #DDE1EC;border-radius:10px;font:inherit;font-size:13px}
.md-cip{border:1px solid #DDE1EC;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:600;color:#3A4466;cursor:pointer}
.md-cip.aktif{background:#2B3674;border-color:#2B3674;color:#fff}
.md-btn{border:1px solid #DDE1EC;background:#fff;border-radius:10px;padding:8px 13px;font:inherit;font-size:13px;font-weight:700;color:#2B3674;cursor:pointer}
.md-btn.ana{background:#2B3674;border-color:#2B3674;color:#fff}
.md-btn.sil{color:#B42318;border-color:#F5C2C0;background:#FFF5F4}
.md-btn[disabled]{opacity:.55;cursor:wait}
.md-kat{background:#fff;border:1px solid #EDEEF3;border-radius:16px;margin-bottom:14px;overflow:hidden}
.md-kat-bas{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #EDEEF3}
.md-kat-bas .ad{flex:1;font-family:var(--font-display);font-weight:700;font-size:15.5px;color:var(--ink)}
.md-kat-bas .say{font-size:13px;font-weight:700}
.md-satir{border-bottom:1px solid #F3F4F8}
.md-satir:last-child{border-bottom:0}
.md-satir-ust{display:flex;align-items:flex-start;gap:12px;padding:11px 18px}
.md-durum{width:32px;height:32px;border-radius:9px;border:0;cursor:pointer;flex-shrink:0;font-weight:800;font-size:14px}
.md-govde{flex:1;min-width:0;cursor:pointer;background:none;border:0;text-align:left;font:inherit;padding:0;color:inherit}
.md-metin{font-size:13.5px;color:var(--ink);line-height:1.45}
.md-k{background:#FEE2E2;color:#991B1B;font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;margin-right:6px}
.md-alt{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;font-size:11.5px;color:#6B7280}
.md-rozet{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:#F1F2F7;color:#4B5563;font-weight:600}
.md-rozet.gecti{background:#FDECEF;color:#B42318}
.md-rozet.yaklasiyor{background:#FFF4D6;color:#8A5A00}
.md-rozet.tarihYok{background:#EEF2FF;color:#3949AB}
.md-rozet.tamam{background:#E4F5EC;color:#1F7A4A}
.md-durum-ad{font-size:11px;font-weight:700;white-space:nowrap;margin-top:8px}
.md-detay{padding:4px 18px 16px 62px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.md-detay label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#374151}
.md-detay .genis{grid-column:1/-1}
.md-detay input,.md-detay select,.md-detay textarea{padding:9px 11px;border:1px solid #DDE1EC;border-radius:10px;font:inherit;font-size:13px;font-weight:400;color:#1F2544;background:#FAFBFD}
.md-detay textarea{min-height:76px;resize:vertical}
.md-ipucu{font-size:11.5px;color:#6B7280;font-weight:400}
.md-detay-alt{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.md-detay-alt .bilgi{flex:1;font-size:11.5px;color:#6B7280}
.md-uyari{background:#FFF8E6;border:1px solid #F5D98B;color:#7A5200;border-radius:14px;padding:14px 16px;font-size:13px;line-height:1.55;margin-bottom:14px}
.md-uyari pre{background:#fff;border:1px solid #EDE3C4;border-radius:8px;padding:10px;font-size:12px;white-space:pre-wrap;margin:8px 0 0}
.md-bos{padding:18px;text-align:center;color:#6B7280;font-size:13px}
.md-ozel-form{background:#fff;border:1px dashed #C9CFE0;border-radius:16px;padding:16px;margin-bottom:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.md-ozel-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#374151}
.md-ozel-form .genis{grid-column:1/-1}
.md-ozel-form input,.md-ozel-form select{padding:9px 11px;border:1px solid #DDE1EC;border-radius:10px;font:inherit;font-size:13px;font-weight:400}
@media(max-width:700px){.md-hero{padding:20px}.md-detay{padding:4px 14px 14px;grid-template-columns:1fr}.md-satir-ust{padding:11px 14px}.md-ozel-form{grid-template-columns:1fr}.md-kat-bas{padding:12px 14px}}
`;

function stilEkle() {
  if (document.getElementById('mebDenetimStil')) return;
  const st = document.createElement('style');
  st.id = 'mebDenetimStil';
  st.textContent = STIL;
  document.head.appendChild(st);
}

// ─────────────────────────────────────────────────────────────────
// HTML (saf; test edilebilir)
// ─────────────────────────────────────────────────────────────────
function sureRozeti(sure) {
  if (sure.tur === 'gecti') return `<span class="md-rozet gecti">⚠ Süresi geçti · ${esc(tarihYazi(sure.son))}</span>`;
  if (sure.tur === 'yaklasiyor') return `<span class="md-rozet yaklasiyor">⏰ ${esc(sure.kalanGun)} gün kaldı · ${esc(tarihYazi(sure.son))}</span>`;
  if (sure.tur === 'tarihYok') return `<span class="md-rozet tarihYok">Son kontrol tarihi girilmedi</span>`;
  if (sure.tur === 'tamam') return `<span class="md-rozet tamam">✓ ${esc(tarihYazi(sure.son))}'e kadar</span>`;
  return '';
}

const periyotYazi = ay => (ay >= 12 && ay % 12 === 0 ? `${ay / 12} yılda bir` : `${ay} ayda bir`);

function detayHtml(m, kayit, bugun, yetkili) {
  const sure = sureDurumu(m, kayit, bugun);
  const kilit = yetkili ? '' : ' disabled';
  const sonraki = m.periyotAy
    ? `<span class="md-ipucu">Bu madde ${esc(periyotYazi(m.periyotAy))} yenilenir${sure.son && sure.kaynak === 'periyot' ? ` · sonraki: ${esc(tarihYazi(sure.son))}` : ''}.</span>`
    : '<span class="md-ipucu">Belgenin son geçerlilik günü (sigorta, ruhsat, sözleşme…).</span>';
  const guncelleme = kayit.guncellendi
    ? `Son güncelleme: ${esc(kayit.guncelleyenAd || kayit.guncelleyen || '—')} · ${esc(String(kayit.guncellendi).slice(0, 10).split('-').reverse().join('.'))}`
    : 'Henüz ayrıntı girilmedi.';
  return `<div class="md-detay" data-detay="${esc(m.id)}">
    <label>Durum<select data-alan="durum"${kilit}>${DURUM_SIRASI.map(d =>
      `<option value="${d}"${kayit.durum === d ? ' selected' : ''}>${esc(DENETIM_DURUMLAR[d].ad)}</option>`).join('')}</select></label>
    <label>Sorumlu<input data-alan="sorumlu" maxlength="${SINIRLAR.sorumlu}" value="${esc(kayit.sorumlu)}" placeholder="Ad soyad / görev"${kilit}></label>
    <label>Son kontrol tarihi<input type="date" data-alan="sonKontrol" value="${esc(kayit.sonKontrol)}"${kilit}>${m.periyotAy ? sonraki : ''}</label>
    <label>Geçerlilik bitişi<input type="date" data-alan="gecerlilikBitis" value="${esc(kayit.gecerlilikBitis)}"${kilit}>${m.periyotAy ? '' : sonraki}</label>
    <label class="genis">Not<textarea data-alan="not" maxlength="${SINIRLAR.not}" placeholder="Eksik ne, ne yapılacak, kimden bekleniyor…"${kilit}>${esc(kayit.not)}</textarea></label>
    <label class="genis">Kanıt / belge yeri<input data-alan="kanit" maxlength="${SINIRLAR.kanit}" value="${esc(kayit.kanit)}" placeholder="Ör. Personel dosyası klasör 3 · ya da Drive bağlantısı"${kilit}></label>
    <div class="md-detay-alt"><span class="bilgi">${guncelleme}</span>
      ${m.ozel && yetkili ? `<button type="button" class="md-btn sil" data-eylem="ozel-sil" data-id="${esc(m.id)}">Maddeyi kaldır</button>` : ''}
      <button type="button" class="md-btn" data-eylem="kapat" data-id="${esc(m.id)}">Kapat</button>
      ${yetkili ? `<button type="button" class="md-btn ana" data-eylem="kaydet" data-id="${esc(m.id)}">Kaydet</button>` : ''}
    </div>
  </div>`;
}

function satirHtml(m, kayitHam, bugun, { acikMadde, yetkili }) {
  const kayit = kayitDuzenle(kayitHam);
  const durum = etkinDurum(m, kayit, bugun);
  const d = DENETIM_DURUMLAR[durum] || DENETIM_DURUMLAR.bos;
  const sure = sureDurumu(m, kayit, bugun);
  const altlar = [
    m.kaynak && m.kaynak !== '—' ? `<span>⚖ ${esc(m.kaynak)}</span>` : '',
    m.periyotAy ? `<span class="md-rozet">↻ ${esc(periyotYazi(m.periyotAy))}</span>` : '',
    sureRozeti(sure),
    kayit.sorumlu ? `<span class="md-rozet">👤 ${esc(kayit.sorumlu)}</span>` : '',
    kayit.not ? `<span class="md-rozet">📝 Not</span>` : '',
    kayit.kanit ? `<span class="md-rozet">📎 Kanıt</span>` : '',
    durum !== kayit.durum ? `<span class="md-rozet gecti">Süre geçtiği için eksik sayılıyor</span>` : ''
  ].filter(Boolean).join('');
  const acik = acikMadde === m.id;
  return `<div class="md-satir" data-madde="${esc(m.id)}">
    <div class="md-satir-ust">
      <button type="button" class="md-durum" data-eylem="durum" data-id="${esc(m.id)}" title="Durumu değiştir"
        style="background:${d.bg};color:${d.renk}"${yetkili ? '' : ' disabled'}>${esc(d.et)}</button>
      <button type="button" class="md-govde" data-eylem="ac" data-id="${esc(m.id)}" aria-expanded="${acik}">
        <div class="md-metin">${m.k ? '<span class="md-k">K</span>' : ''}${esc(m.s)}</div>
        ${altlar ? `<div class="md-alt">${altlar}</div>` : ''}
      </button>
      <span class="md-durum-ad" style="color:${d.renk}">${esc(d.ad)}</span>
    </div>
    ${acik ? detayHtml(m, kayit, bugun, yetkili) : ''}
  </div>`;
}

export function panelHtml({ kategoriler, kayitlar, bugun, filtre = 'tum', arama = '', acikMadde = '',
  yetkili = true, ozelFormAcik = false, uyari = '' }) {
  const o = ozetHesapla(kategoriler, kayitlar, bugun);
  const kartlar = kategoriler.map(kat => {
    const gorunen = kat.maddeler.filter(m => filtreUyar(m, kayitlar[m.id], { filtre, arama }, bugun) || m.id === acikMadde);
    if (!gorunen.length) return '';
    const ko = o.kategoriler[kat.id] || { toplam: 0, uygun: 0 };
    return `<section class="md-kat">
      <div class="md-kat-bas" style="background:${kat.renk}0d">
        <span style="width:36px;height:36px;border-radius:11px;background:${kat.renk}1a;color:${kat.renk};display:flex;align-items:center;justify-content:center"><i data-lucide="${esc(kat.ikon)}" style="width:18px;height:18px"></i></span>
        <span class="ad">${esc(kat.ad)}</span>
        <span class="say" style="color:${kat.renk}">${ko.uygun}/${ko.toplam}</span>
      </div>
      ${gorunen.map(m => satirHtml(m, kayitlar[m.id], bugun, { acikMadde, yetkili })).join('')}
    </section>`;
  }).join('');
  const sureSayi = o.gecti + o.yaklasiyor;
  return `
    <div class="md-hero">
      <div>
        <div class="md-etiket">MEB DENETİM HAZIRLIĞI</div>
        <h2>Denetim Öz-Değerlendirme</h2>
        <p>MEB / Aile Bakanlığı / İSG mevzuatına göre kurum hazırlık listesi. Bir maddeye dokunun: not, sorumlu, son kontrol ve geçerlilik tarihi ekleyin. Değişiklikler hemen kaydedilir; ZEKY'den de görülür.</p>
      </div>
      <div class="md-sayilar">
        <div class="md-sayi"><b>%${o.yuzde}</b><span>Uyum skoru</span></div>
        <div class="md-sayi${o.kritikEksik ? ' uyari' : ''}"><b>${o.kritikEksik}</b><span>Kritik eksik</span></div>
        <div class="md-sayi${o.gecti ? ' uyari' : ''}"><b>${o.gecti}</b><span>Süresi geçen</span></div>
        <div class="md-sayi"><b>${o.yaklasiyor}</b><span>30 gün içinde</span></div>
      </div>
    </div>
    ${uyari}
    <div class="md-arac">
      ${Object.entries(FILTRELER).map(([k, ad]) => `<button type="button" class="md-cip${filtre === k ? ' aktif' : ''}" data-eylem="filtre" data-deger="${k}">${esc(ad)}${k === 'sure' && sureSayi ? ` · ${sureSayi}` : k === 'kritik' && o.kritikEksik ? ` · ${o.kritikEksik}` : ''}</button>`).join('')}
    </div>
    <div class="md-arac">
      <input type="search" data-arama placeholder="Madde, not veya sorumlu ara" value="${esc(arama)}" aria-label="Ara">
      ${yetkili ? '<button type="button" class="md-btn" data-eylem="ozel-ac">+ Okula özel madde</button>' : ''}
      <button type="button" class="md-btn ana" data-eylem="rapor">Rapor / PDF</button>
    </div>
    ${ozelFormAcik && yetkili ? ozelFormHtml() : ''}
    ${kartlar || '<div class="md-bos">Bu filtrede madde yok.</div>'}`;
}

function ozelFormHtml() {
  const kategoriler = [...kategorileriTopla({}).map(k => [k.id, k.ad]), [OZEL_KATEGORI.id, OZEL_KATEGORI.ad]];
  return `<div class="md-ozel-form" data-ozel-form>
    <label class="genis">Madde<input data-ozel="s" maxlength="${SINIRLAR.maddeMetni}" placeholder="Ör. Servis araçlarının muayenesi güncel mi?"></label>
    <label>Kategori<select data-ozel="kategori">${kategoriler.map(([id, ad]) => `<option value="${esc(id)}">${esc(ad)}</option>`).join('')}</select></label>
    <label>Yenileme<select data-ozel="periyotAy">${PERIYOTLAR.map(p => `<option value="${p}">${p ? esc(periyotYazi(p)) : 'Periyot yok'}</option>`).join('')}</select></label>
    <label>Önem<select data-ozel="k"><option value="0">Normal</option><option value="1">Kritik</option></select></label>
    <div class="md-detay-alt"><span class="bilgi">Okula özel maddeler yalnız bu okulun listesinde görünür.</span>
      <button type="button" class="md-btn" data-eylem="ozel-vazgec">Vazgeç</button>
      <button type="button" class="md-btn ana" data-eylem="ozel-kaydet">Ekle</button></div>
  </div>`;
}

export function raporHtml({ kategoriler, kayitlar, bugun, okulAdi = 'Bir Çiçek Koleji Anaokulu' }) {
  const o = ozetHesapla(kategoriler, kayitlar, bugun);
  const sinif = { uygun: 'u', eksik: 'e', bos: 'n', uygulanamaz: 'x' };
  let govde = '';
  for (const kat of kategoriler) {
    const ko = o.kategoriler[kat.id] || { toplam: 0, uygun: 0 };
    govde += `<div class="kat">${esc(kat.ad)} — ${ko.uygun}/${ko.toplam}</div><table>
      <tr><th></th><th>Madde</th><th>Sorumlu</th><th>Tarih</th><th>Not / kanıt</th></tr>`;
    for (const m of kat.maddeler) {
      const kayit = kayitDuzenle(kayitlar[m.id]);
      const durum = etkinDurum(m, kayit, bugun);
      const sure = sureDurumu(m, kayit, bugun);
      const tarih = [kayit.sonKontrol ? `Kontrol: ${tarihYazi(kayit.sonKontrol)}` : '',
        sure.son ? `${sure.tur === 'gecti' ? 'SÜRESİ GEÇTİ' : 'Geçerli'}: ${tarihYazi(sure.son)}` : ''].filter(Boolean).join('<br>');
      govde += `<tr><td class="et ${sinif[durum]}">${esc(DENETIM_DURUMLAR[durum].et)}</td>
        <td>${m.k ? '<span class="k">K</span> ' : ''}${esc(m.s)}${m.kaynak && m.kaynak !== '—' ? `<div class="kay">${esc(m.kaynak)}</div>` : ''}</td>
        <td>${esc(kayit.sorumlu)}</td><td class="tar">${tarih}</td>
        <td>${esc(kayit.not)}${kayit.kanit ? `<div class="kay">Kanıt: ${esc(kayit.kanit)}</div>` : ''}</td></tr>`;
    }
    govde += '</table>';
  }
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>MEB Denetim Raporu</title>
    <style>body{font-family:'Segoe UI',system-ui,sans-serif;color:#1F2544;padding:28px;font-size:11.5px}
    h1{font-size:18px;color:#2B3674;margin:0 0 4px}.ust{border-bottom:2px solid #2B3674;padding-bottom:12px;margin-bottom:14px}
    .skor{display:inline-block;background:#EDEFFB;color:#2B3674;padding:6px 14px;border-radius:8px;font-weight:800;font-size:14px;margin-right:8px}
    .kat{margin:16px 0 6px;font-size:13.5px;font-weight:700;color:#2B3674;border-left:4px solid #2B3674;padding-left:9px}
    table{width:100%;border-collapse:collapse;margin-bottom:10px;page-break-inside:auto}tr{page-break-inside:avoid}
    th{text-align:left;font-size:10.5px;color:#6B7280;border-bottom:1px solid #ccc;padding:4px 6px}
    td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top;white-space:pre-wrap}
    .et{width:20px;text-align:center;font-weight:800}.u{color:#2F9E63}.e{color:#C2445A}.n{color:#8A92A6}.x{color:#B45309}
    .k{background:#FEE2E2;color:#991B1B;font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px}
    .kay{color:#888;font-size:10px;margin-top:2px}.tar{white-space:nowrap}
    .imza{display:flex;gap:40px;margin-top:36px}.imza div{flex:1;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#666}</style></head><body>
    <div class="ust"><h1>${esc(okulAdi)} — MEB Denetim Öz-Değerlendirme Raporu</h1>
      <div style="color:#666">MEB / Aile Bakanlığı / İSG mevzuatına göre · Tarih: ${esc(tarihYazi(bugun))}</div>
      <div style="margin-top:10px"><span class="skor">Uyum Skoru: %${o.yuzde}</span>
      ${o.kritikEksik ? `<b style="color:#C2445A">${o.kritikEksik} kritik eksik</b> · ` : ''}${o.gecti ? `<b style="color:#C2445A">${o.gecti} maddenin süresi geçti</b> · ` : ''}${o.yaklasiyor} madde 30 gün içinde yenilenmeli</div></div>
    ${govde}
    <div class="imza"><div>Hazırlayan<br>Ad Soyad / İmza</div><div>Onaylayan (Yönetici)<br>Ad Soyad / İmza</div></div>
    </body></html>`;
}

// ─────────────────────────────────────────────────────────────────
// VERİ
// ─────────────────────────────────────────────────────────────────
function yetkiHatasiMi(e) {
  return String(e?.code || '').includes('permission-denied');
}

// Yeni belge yoksa eski ayarlar/mebDenetim durumları bir kez taşınır
// (işlem içinde: iki yönetici aynı anda açsa da yeni kayıtlar ezilmez).
export async function veriYukle(api = P()) {
  const { fb, db } = api;
  const ref = fb.doc(db, DENETIM_BELGE.koleksiyon, DENETIM_BELGE.belge);
  const snap = await fb.getDoc(ref);
  if (snap.exists()) return snap.data() || {};
  let eski = {};
  try {
    const es = await fb.getDoc(fb.doc(db, ESKI_DENETIM_BELGE.koleksiyon, ESKI_DENETIM_BELGE.belge));
    eski = es.exists() ? (es.data()?.kayitlar || {}) : {};
  } catch (_) { eski = {}; }
  const maddeler = eskiKayitlariTasi(eski);
  const kullanici = api.state?.currentUser?.email || '';
  return fb.runTransaction(db, async tx => {
    const tekrar = await tx.get(ref);
    if (tekrar.exists()) return tekrar.data() || {};
    const yeni = { surum: MEB_DENETIM_SURUM, maddeler, ozelMaddeler: {}, tasindi: true,
      tasinanMadde: Object.keys(maddeler).length, guncellendi: new Date().toISOString(),
      guncelleyen: String(kullanici).toLowerCase() };
    tx.set(ref, yeni);
    return yeni;
  });
}

function kullaniciBilgisi(api) {
  const u = api.state?.currentUser || {};
  const p = api.state?.personel || {};
  return {
    eposta: String(u.email || '').toLowerCase(),
    ad: String(p.adSoyad || [p.ad, p.soyad].filter(Boolean).join(' ') || u.displayName || '').trim()
  };
}

export async function kayitKaydet(api, id, ham) {
  if (!maddeIdGecerli(id)) throw new Error('Geçersiz madde.');
  const { fb, db } = api;
  const k = kullaniciBilgisi(api);
  const simdi = new Date().toISOString();
  const kayit = kayitDuzenle({ ...ham, guncelleyen: k.eposta, guncelleyenAd: k.ad, guncellendi: simdi });
  await fb.setDoc(fb.doc(db, DENETIM_BELGE.koleksiyon, DENETIM_BELGE.belge), {
    surum: MEB_DENETIM_SURUM, maddeler: { [id]: kayit }, guncellendi: simdi, guncelleyen: k.eposta
  }, { merge: true });
  return kayit;
}

export async function ozelMaddeKaydet(api, ham, rastgele = Math.random) {
  const { fb, db } = api;
  const k = kullaniciBilgisi(api);
  const id = ozelMaddeIdUret(rastgele);
  const madde = ozelMaddeDuzenle({ ...ham, olusturan: k.eposta, olusturuldu: new Date().toISOString() });
  await fb.setDoc(fb.doc(db, DENETIM_BELGE.koleksiyon, DENETIM_BELGE.belge), {
    surum: MEB_DENETIM_SURUM, ozelMaddeler: { [id]: madde }, guncellendi: madde.olusturuldu, guncelleyen: k.eposta
  }, { merge: true });
  return { id, madde };
}

export async function ozelMaddeSil(api, id) {
  if (!/^ozel_[a-z0-9]{6,20}$/.test(String(id))) throw new Error('Yalnız okula özel madde kaldırılabilir.');
  const { fb, db } = api;
  await fb.setDoc(fb.doc(db, DENETIM_BELGE.koleksiyon, DENETIM_BELGE.belge), {
    ozelMaddeler: { [id]: fb.deleteField() }, maddeler: { [id]: fb.deleteField() },
    guncellendi: new Date().toISOString(), guncelleyen: kullaniciBilgisi(api).eposta
  }, { merge: true });
}

// ─────────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────────
export async function panelKur(kokId = 'denetimKok', { api = P(), simdi = () => Date.now() } = {}) {
  const kok = document.getElementById(kokId);
  if (!kok) return null;
  // Sekme her açıldığında çağrılır: panel bir kez kurulur, sonra yalnız veri tazelenir.
  if (kok._mebDenetimPanel) { await kok._mebDenetimPanel.yenile(); return kok._mebDenetimPanel; }
  stilEkle();
  const rol = api.state?.rol;
  const yetkili = !!api.state?.isAdmin || ['kurucu_mudur', 'mudur'].includes(rol);
  const d = { veri: { maddeler: {}, ozelMaddeler: {} }, filtre: 'tum', arama: '', acikMadde: '',
    ozelFormAcik: false, mesgul: false, uyari: '' };

  const model = () => ({
    kategoriler: kategorileriTopla(d.veri.ozelMaddeler), kayitlar: d.veri.maddeler || {},
    bugun: bugunIstanbul(simdi()), filtre: d.filtre, arama: d.arama, acikMadde: d.acikMadde,
    yetkili, ozelFormAcik: d.ozelFormAcik, uyari: d.uyari
  });
  // Yeniden çizimde açık madde formundaki kaydedilmemiş yazılar korunur.
  const ciz = () => {
    const odak = document.activeElement?.hasAttribute?.('data-arama');
    const taslak = {};
    const acikPanel = d.acikMadde ? kok.querySelector(`[data-detay="${CSS.escape(d.acikMadde)}"]`) : null;
    acikPanel?.querySelectorAll('[data-alan]').forEach(el => { taslak[el.dataset.alan] = el.value; });
    kok.innerHTML = panelHtml(model());
    if (acikPanel) {
      const yeni = kok.querySelector(`[data-detay="${CSS.escape(d.acikMadde)}"]`);
      yeni?.querySelectorAll('[data-alan]').forEach(el => {
        if (Object.hasOwn(taslak, el.dataset.alan)) el.value = taslak[el.dataset.alan];
      });
    }
    if (odak) { const a = kok.querySelector('[data-arama]'); if (a) { a.focus(); a.setSelectionRange(a.value.length, a.value.length); } }
    api.lucide?.();
  };

  kok.innerHTML = '<div class="md-bos">Denetim listesi yükleniyor…</div>';
  try {
    d.veri = await veriYukle(api);
  } catch (e) {
    console.warn('meb denetim:', e?.code || e?.message);
    d.uyari = yetkiHatasiMi(e)
      ? `<div class="md-uyari"><b>Denetim kayıtlarına erişilemedi.</b> Bu ekranın notları ve tarihleri artık yalnız kurucu müdür ve müdürün görebildiği <code>mebDenetim</code> koleksiyonunda tutuluyor. Firebase konsolunda Firestore kurallarına şu blok eklenip yayınlanmalı:<pre>${esc(KURAL_PARCASI)}</pre></div>`
      : '<div class="md-uyari">Denetim kayıtları yüklenemedi. İnternet bağlantısını kontrol edip sekmeyi yeniden açın.</div>';
    ciz();
    return null;
  }
  d.veri.maddeler ||= {};
  d.veri.ozelMaddeler ||= {};
  ciz();

  const maddeBul = id => model().kategoriler.flatMap(k => k.maddeler).find(m => m.id === id);

  async function yaz(id, yeniKayit, basari) {
    const onceki = d.veri.maddeler[id];
    d.veri.maddeler[id] = kayitDuzenle(yeniKayit);
    ciz();
    try {
      d.veri.maddeler[id] = await kayitKaydet(api, id, yeniKayit);
      if (basari) api.toast?.(basari);
    } catch (e) {
      if (onceki === undefined) delete d.veri.maddeler[id]; else d.veri.maddeler[id] = onceki;
      api.toast?.(yetkiHatasiMi(e) ? 'Bu işlem için yetkiniz yok.' : 'Kaydedilemedi, tekrar deneyin.', 'error');
    }
    ciz();
  }

  kok.addEventListener('input', e => {
    if (!e.target.hasAttribute?.('data-arama')) return;
    d.arama = e.target.value.slice(0, 80);
    ciz();
  });

  kok.addEventListener('click', async e => {
    const el = e.target.closest?.('[data-eylem]');
    if (!el || !kok.contains(el) || d.mesgul) return;
    const eylem = el.dataset.eylem, id = el.dataset.id || '';
    if (eylem === 'filtre') { d.filtre = Object.hasOwn(FILTRELER, el.dataset.deger) ? el.dataset.deger : 'tum'; ciz(); return; }
    if (eylem === 'ac') { d.acikMadde = d.acikMadde === id ? '' : id; ciz(); return; }
    if (eylem === 'kapat') { d.acikMadde = ''; ciz(); return; }
    if (eylem === 'rapor') { raporAc(model()); return; }
    if (!yetkili) return;
    if (eylem === 'durum' && maddeBul(id)) {
      const k = kayitDuzenle(d.veri.maddeler[id]);
      await yaz(id, { ...k, durum: sonrakiDurum(k.durum) });
      return;
    }
    if (eylem === 'kaydet' && maddeBul(id)) {
      const panel = kok.querySelector(`[data-detay="${CSS.escape(id)}"]`);
      if (!panel) return;
      const deger = alan => panel.querySelector(`[data-alan="${alan}"]`)?.value ?? '';
      const ham = { durum: deger('durum'), not: deger('not'), sorumlu: deger('sorumlu'),
        sonKontrol: deger('sonKontrol'), gecerlilikBitis: deger('gecerlilikBitis'), kanit: deger('kanit') };
      if (ham.sonKontrol && ham.sonKontrol > bugunIstanbul(simdi())) {
        api.toast?.('Son kontrol tarihi ileri bir gün olamaz.', 'error');
        return;
      }
      d.mesgul = true;
      // Kaydedilen değerler taslak sayılmasın: önce form kapanır, sonra yazılır.
      d.acikMadde = '';
      try { await yaz(id, ham, '✓ Madde kaydedildi'); } finally { d.mesgul = false; }
      return;
    }
    if (eylem === 'ozel-ac') { d.ozelFormAcik = true; ciz(); kok.querySelector('[data-ozel="s"]')?.focus(); return; }
    if (eylem === 'ozel-vazgec') { d.ozelFormAcik = false; ciz(); return; }
    if (eylem === 'ozel-kaydet') {
      const form = kok.querySelector('[data-ozel-form]');
      const deger = alan => form?.querySelector(`[data-ozel="${alan}"]`)?.value ?? '';
      const ham = { s: deger('s'), kategori: deger('kategori'), periyotAy: Number(deger('periyotAy')), k: deger('k') === '1' };
      if (!String(ham.s).trim()) { api.toast?.('Madde metnini yazın.', 'error'); return; }
      d.mesgul = true;
      try {
        const { id: yeniId, madde } = await ozelMaddeKaydet(api, ham);
        d.veri.ozelMaddeler[yeniId] = madde;
        d.ozelFormAcik = false; d.acikMadde = yeniId;
        api.toast?.('✓ Madde eklendi');
      } catch (err) {
        api.toast?.(yetkiHatasiMi(err) ? 'Bu işlem için yetkiniz yok.' : 'Madde eklenemedi.', 'error');
      } finally { d.mesgul = false; }
      ciz();
      return;
    }
    if (eylem === 'ozel-sil' && /^ozel_/.test(id)) {
      if (!window.confirm('Bu okula özel madde ve kayıtları kaldırılsın mı?')) return;
      d.mesgul = true;
      try {
        await ozelMaddeSil(api, id);
        delete d.veri.ozelMaddeler[id]; delete d.veri.maddeler[id]; d.acikMadde = '';
        api.toast?.('Madde kaldırıldı');
      } catch (err) {
        api.toast?.('Madde kaldırılamadı.', 'error');
      } finally { d.mesgul = false; }
      ciz();
    }
  });

  const panel = {
    durum: d,
    yenidenCiz: ciz,
    async yenile() {
      try {
        const veri = await veriYukle(api);
        d.veri = { ...veri, maddeler: veri.maddeler || {}, ozelMaddeler: veri.ozelMaddeler || {} };
      } catch (e) { console.warn('meb denetim yenile:', e?.code || e?.message); }
      ciz();
    }
  };
  kok._mebDenetimPanel = panel;
  return panel;
}

function raporAc(m) {
  const w = window.open('', '_blank');
  if (!w) { P()?.toast?.('Rapor penceresi açılamadı (açılır pencere engelli olabilir).', 'error'); return; }
  w.document.write(raporHtml(m));
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 300);
}
