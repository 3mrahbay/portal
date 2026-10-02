import { ogrenciListeYetkili, ogrenciListeHazirlik, ogrenciListeRaporu, ogrenciListeDosyaAdi } from './ogrenci-liste-core.js?v=170';
import { ogrenciListeXlsxOlustur } from './ogrenci-liste-xlsx.js?v=170';

let mesgul = false;
const api = () => window.PortalAPI;
const state = () => api()?.state || {};
const categoryName = scope => scope === 'arsiv' ? 'Arşiv öğrencileri' : 'Aktif öğrenciler';

export function ogrenciListeDisaAktarmaGuncelle() {
  const panel = document.getElementById('ogrenciListeDisaAktar');
  if (!panel) return;
  const s = state();
  panel.hidden = !ogrenciListeYetkili(s);
  if (panel.hidden) return;
  let problem = ogrenciListeHazirlik(s);
  const label = document.getElementById('ogrenciListeDisaAktarBilgi');
  const counts = { aktif: 0, arsiv: 0 };
  if (!problem) {
    try {
      for (const scope of Object.keys(counts)) counts[scope] = ogrenciListeRaporu(s, { durumKapsami: scope }).satirlar.length;
    }
    catch (_) { problem = 'Dönem bilgileri tutarsız. Sayfayı yenileyip tekrar deneyin.'; }
  }
  if (label) label.textContent = problem || '';
  for (const button of panel.querySelectorAll('[data-ogrenci-indir]')) {
    const scope = button.dataset.ogrenciKapsam || 'aktif';
    const count = counts[scope] || 0;
    button.disabled = mesgul || !!problem || !count;
    button.setAttribute('aria-busy', String(mesgul));
    button.title = problem || `${s.aktifDonem} · ${categoryName(scope)} · ${count} öğrenciyi indir`;
    if (!button.dataset.indirmeBagli) {
      button.dataset.indirmeBagli = '1';
      button.addEventListener('click', () => ogrenciListeIndir(button.dataset.ogrenciIndir, button.dataset.ogrenciKapsam || 'aktif'));
    }
  }
}

function ayniOturum(snapshot, current) {
  return !ogrenciListeHazirlik(current) && current.currentUser?.uid === snapshot.currentUser?.uid
    && current.aktifDonem === snapshot.aktifDonem
    && current.ogrenciDisAktarDurumu === snapshot.ogrenciDisAktarDurumu;
}

export async function ogrenciListeIndir(format, scope = 'aktif') {
  if (mesgul) return false;
  if (!['xlsx', 'pdf'].includes(format)) return false;
  const initial = state();
  let report;
  try {
    report = ogrenciListeRaporu(initial, { durumKapsami: scope });
    if (!report.satirlar.length) throw new Error(`Seçili dönemde ${categoryName(scope).toLocaleLowerCase('tr')} kategorisi boş.`);
  } catch (error) {
    api()?.toast(error.message, 'error');
    return false;
  }
  mesgul = true;
  ogrenciListeDisaAktarmaGuncelle();
  let url, anchor;
  try {
    // Yield before the synchronous XLSX work so the busy state is visible.
    await new Promise(resolve => setTimeout(resolve, 0));
    const bytes = format === 'xlsx' ? ogrenciListeXlsxOlustur(report)
      : await (await import('./ogrenci-liste-pdf.js?v=170')).ogrenciListePdfOlustur(report);
    // A logout, role/period change or fresh data load during generation must
    // never download a previous account/year's personal information.
    if (!ayniOturum(initial, state())) throw new Error('Oturum veya dönem değişti. Güncel listeden tekrar indirin.');
    const mime = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
    url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    anchor = document.createElement('a');
    anchor.href = url; anchor.download = ogrenciListeDosyaAdi(report, format);
    anchor.style.display = 'none'; document.body.appendChild(anchor); anchor.click();
    api()?.toast(`${report.donem} · ${categoryName(scope)} · ${report.satirlar.length} öğrencinin ${format === 'xlsx' ? 'Excel' : 'PDF'} dosyası hazır.`, 'success');
    return true;
  } catch (_) {
    // Do not log exceptions or records: identity values can appear in errors.
    api()?.toast(ayniOturum(initial, state())
      ? 'Dosya oluşturulamadı. Sayfayı yenileyip tekrar deneyin; hiçbir kayıt değiştirilmedi.'
      : 'Oturum veya dönem değişti. Güncel listeden tekrar indirin.', 'error');
    return false;
  } finally {
    anchor?.remove();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 30000);
    mesgul = false;
    report = null;
    ogrenciListeDisaAktarmaGuncelle();
  }
}
