import {
  callableCutoverAcikMi, dugme, istanbulMillis, istekIzleyiciOlustur,
  metinElemani, randevuOturumDegisimiDinle, randevuServisiGetir, zamanYazi
} from './zeky-randevu-cutover-runtime.js';

const DURUMLAR = Object.freeze({
  talep: 'Onay bekliyor',
  dolu: 'Onaylandı',
  alternatif_teklif: 'Veli yanıtı bekleniyor',
  reddedildi: 'Reddedildi',
  teklif_reddedildi: 'Teklif reddedildi',
  iptal: 'İptal edildi'
});
const state = {
  api: null,
  appointments: [],
  children: [],
  filter: 'pending',
  busy: false,
  sessionActive: true,
  sessionVersion: 0
};
const requests = istekIzleyiciOlustur();

function node(id) {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Eksik sayfa öğesi: ${id}`);
  return value;
}

function status(text, error = false) {
  const area = node('durumMesaji');
  area.textContent = text;
  area.classList.toggle('hata', error);
  area.hidden = !text;
}

function safeError(error, fallback) {
  const code = String(error?.code || '');
  if (code.includes('permission-denied')) return 'Bu randevuya erişim izniniz yok.';
  if (code.includes('unauthenticated')) return 'Oturum doğrulanamadı.';
  if (code.includes('failed-precondition')) return 'Randevu servisi şu anda hazır değil.';
  return fallback;
}

function invalidateSession() {
  state.sessionActive = false;
  state.sessionVersion += 1;
  state.api = null;
  state.appointments = [];
  state.children = [];
  state.busy = false;
  node('bekleyenRozet').textContent = '';
  node('bekleyenRozet').hidden = true;
  node('ogrenciSec').replaceChildren();
  node('randevuListesi').replaceChildren();
  node('uygulama').hidden = true;
  status('Oturum değişti. Randevu verileri temizlendi; sayfayı yeniden açın.', true);
}

function filtered() {
  if (state.filter === 'pending') {
    return state.appointments.filter(row => row.durum === 'talep');
  }
  if (state.filter === 'approved') {
    return state.appointments.filter(row => row.durum === 'dolu');
  }
  if (state.filter === 'closed') {
    return state.appointments.filter(row =>
      ['reddedildi', 'teklif_reddedildi', 'iptal'].includes(row.durum));
  }
  return state.appointments;
}

function filtersRender() {
  const area = node('filtreler');
  area.replaceChildren();
  for (const [key, label] of [
    ['pending', 'Bekleyen'], ['approved', 'Onaylanan'],
    ['closed', 'Ret / İptal'], ['all', 'Tümü']
  ]) {
    area.append(dugme(label, () => {
      state.filter = key;
      filtersRender();
      appointmentsRender();
    }, `secim${state.filter === key ? ' aktif' : ''}`));
  }
}

function appointmentCard(row) {
  const card = document.createElement('article');
  card.className = 'kart';
  const statusClass = Object.hasOwn(DURUMLAR, row.durum) ? row.durum : '';
  const top = document.createElement('div');
  top.className = 'kart-ust';
  top.append(
    metinElemani('strong', zamanYazi(row.baslangicMillis)),
    metinElemani('span', DURUMLAR[row.durum] || 'Durum bilinmiyor', `rozet ${statusClass}`)
  );
  card.append(
    top,
    metinElemani('div', row.ogrenciAd || 'Öğrenci', 'ad'),
    metinElemani('div', row.veliAd || 'Veli', 'ikincil')
  );
  if (row.veliNotu) card.append(metinElemani('p', row.veliNotu, 'not'));
  if (row.retNedeni) card.append(metinElemani('p', `Ret nedeni: ${row.retNedeni}`, 'not'));
  if (row.iptalNedeni) card.append(metinElemani('p', `İptal nedeni: ${row.iptalNedeni}`, 'not'));
  if (row.durum === 'alternatif_teklif') {
    card.append(metinElemani(
      'p', `Önerilen saat: ${zamanYazi(row.teklifBaslangicMillis)}`, 'teklif'
    ));
  }

  const actions = document.createElement('div');
  actions.className = 'islemler';
  if (row.durum === 'talep') {
    actions.append(
      dugme('Onayla', () => approve(row.id), 'birincil'),
      dugme('Reddet', () => reject(row.id), 'tehlike'),
      dugme('Farklı saat', () => propose(row.id), 'ikincil-buton')
    );
  }
  if (['talep', 'dolu', 'alternatif_teklif'].includes(row.durum)) {
    actions.append(dugme('İptal et', () => cancel(row.id), 'ikincil-buton'));
  }
  if (actions.childElementCount) card.append(actions);
  return card;
}

function appointmentsRender() {
  const area = node('randevuListesi');
  area.replaceChildren();
  const rows = filtered();
  if (!rows.length) {
    area.append(metinElemani('p', 'Bu bölümde randevu bulunmuyor.', 'bos'));
    return;
  }
  for (const row of rows) area.append(appointmentCard(row));
}

function childrenRender() {
  const select = node('ogrenciSec');
  select.replaceChildren();
  for (const child of state.children) {
    const option = document.createElement('option');
    option.value = child.id;
    option.textContent = child.ad;
    select.append(option);
  }
  node('yeniRandevu').disabled = !state.children.length;
}

async function refresh({ quiet = false } = {}) {
  if (!state.sessionActive || !state.api || state.busy) return;
  const version = state.sessionVersion;
  state.busy = true;
  try {
    const inbox = await state.api.personelKutusu();
    if (!state.sessionActive || state.sessionVersion !== version) return;
    state.appointments = Array.isArray(inbox.randevular) ? inbox.randevular : [];
    node('bekleyenRozet').textContent = String(Number(inbox.bekleyenAdet) || 0);
    node('bekleyenRozet').hidden = !(Number(inbox.bekleyenAdet) > 0);
    appointmentsRender();
    if (!quiet) status('');
  } catch (error) {
    if (!state.sessionActive || state.sessionVersion !== version) return;
    state.appointments = [];
    appointmentsRender();
    node('bekleyenRozet').textContent = '';
    node('bekleyenRozet').hidden = true;
    if (!quiet) status(safeError(error, 'Randevu kutusu güvenli biçimde yüklenemedi.'), true);
  } finally {
    state.busy = false;
  }
}

async function command(action, id, payload, execute, success) {
  if (!state.sessionActive || !state.api || state.busy) return false;
  const version = state.sessionVersion;
  const requestId = requests.anahtar(action, id, payload);
  state.busy = true;
  try {
    await execute(requestId);
  } catch (error) {
    if (!state.sessionActive || state.sessionVersion !== version) return false;
    status(safeError(error, 'İşlem tamamlanamadı; tekrar deneyebilirsiniz.'), true);
    state.busy = false;
    return false;
  }
  state.busy = false;
  if (!state.sessionActive || state.sessionVersion !== version) return false;
  requests.tamamla(action, id, payload);
  status(success);
  await refresh({ quiet: true });
  return true;
}

async function approve(id) {
  if (!globalThis.confirm('Randevu onaylansın mı?')) return;
  await command('approve', id, '', key => state.api.onayla(key, id), 'Randevu onaylandı.');
}

async function reject(id) {
  const reason = globalThis.prompt('Ret nedeni (zorunlu):', '');
  if (reason === null || !reason.trim()) return;
  await command('reject', id, reason.trim(),
    key => state.api.reddet(key, id, reason.trim()), 'Randevu reddedildi.');
}

async function cancel(id) {
  const reason = globalThis.prompt('İptal nedeni (zorunlu):', '');
  if (reason === null || !reason.trim()) return;
  await command('cancel', id, reason.trim(),
    key => state.api.iptalEt(key, id, reason.trim()), 'Randevu iptal edildi.');
}

async function propose(id) {
  const local = globalThis.prompt('Yeni tarih ve saat (YYYY-AA-GGTHH:MM):', '');
  if (local === null) return;
  const millis = istanbulMillis(local.trim());
  if (!Number.isSafeInteger(millis) || millis <= Date.now()) {
    status('Gelecekte ve yarım saatlik ızgarada bir saat seçin.', true);
    return;
  }
  const note = globalThis.prompt('Farklı saat açıklaması (zorunlu):', '');
  if (note === null || !note.trim()) return;
  const payload = `${millis}|${note.trim()}`;
  await command('propose', id, payload, key => state.api.farkliSaatOner({
    requestId: key, randevuId: id, baslangicMillis: millis, not: note.trim()
  }), 'Farklı saat veli onayına gönderildi.');
}

async function createAppointment(event) {
  event.preventDefault();
  if (state.busy) return;
  const childId = node('ogrenciSec').value;
  const local = node('yeniZaman').value;
  const note = node('yeniNot').value.trim();
  const millis = istanbulMillis(local);
  if (!state.children.some(row => row.id === childId) ||
      !Number.isSafeInteger(millis) || millis <= Date.now()) {
    status('Öğrenci ile gelecekte, yarım saatlik ızgarada bir saat seçin.', true);
    return;
  }
  const payload = `${childId}|${millis}|${note}`;
  const completed = await command('create_staff', childId, payload, key =>
    state.api.personelRandevuOlustur({
      requestId: key, ogrenciId: childId, baslangicMillis: millis, not: note
    }), 'Randevu veli onayına gönderildi.');
  if (completed) node('yeniNot').value = '';
}

async function start() {
  filtersRender();
  appointmentsRender();
  if (!callableCutoverAcikMi()) {
    node('uygulama').hidden = true;
    status('Randevu sistemi güvenli geçiş tamamlanana kadar kapalıdır.', true);
    return;
  }
  const version = state.sessionVersion;
  try {
    const api = await randevuServisiGetir();
    if (!state.sessionActive || state.sessionVersion !== version) return;
    state.api = api;
    randevuOturumDegisimiDinle(invalidateSession);
    if (!state.sessionActive || state.sessionVersion !== version) return;
    const children = await api.personelOgrencileri();
    if (!state.sessionActive || state.sessionVersion !== version) return;
    state.children = children;
    childrenRender();
    node('yeniForm').addEventListener('submit', createAppointment);
    node('uygulama').hidden = false;
    await refresh();
    globalThis.setInterval(() => refresh({ quiet: true }), 60_000);
  } catch (error) {
    if (!state.sessionActive || state.sessionVersion !== version) return;
    node('uygulama').hidden = true;
    status(safeError(error, 'Randevu servisine güvenli bağlantı kurulamadı.'), true);
  }
}

start();
