import {
  callableCutoverAcikMi, dugme, istanbulMillis, istekIzleyiciOlustur,
  metinElemani, randevuOturumDegisimiDinle, randevuServisiGetir
} from './zeky-randevu-cutover-runtime.js';

const DURUMLAR = Object.freeze({
  talep: 'Onay bekliyor',
  dolu: 'Onaylandı',
  alternatif_teklif: 'Veli yanıtı bekleniyor',
  reddedildi: 'Reddedildi',
  teklif_reddedildi: 'Teklif reddedildi',
  iptal: 'İptal edildi'
});
const TIPLER = Object.freeze({
  ogretmen_veli: 'Öğretmen–Veli',
  pdr: 'PDR / Rehberlik',
  idare: 'Müdür / İdare'
});
const KAPALI_DURUMLAR = new Set(['reddedildi', 'teklif_reddedildi', 'iptal']);
const state = {
  api: null,
  appointments: [],
  children: [],
  filter: 'pending',
  target: '',
  type: '',
  time: 'future',
  search: '',
  management: false,
  busy: false,
  sessionActive: true,
  sessionVersion: 0
};
const requests = istekIzleyiciOlustur();
const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long',
  year: 'numeric', weekday: 'long'
});
const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false
});
const dateKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
});

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
  if (code.includes('resource-exhausted')) return 'Çok sayıda işlem yapıldı; kısa süre sonra yeniden deneyin.';
  if (code.includes('aborted')) return 'Randevu saati değişti; liste yenilendi.';
  return fallback;
}

function localDateKey(millis) {
  if (!Number.isSafeInteger(Number(millis))) return 'tarihsiz';
  return dateKeyFormat.format(new Date(Number(millis)));
}

function todayKey() {
  return dateKeyFormat.format(new Date());
}

function timeText(row) {
  const start = Number(row.baslangicMillis);
  if (!Number.isSafeInteger(start)) return 'Saat bilgisi yok';
  const end = start + (Number(row.sureDakika) || 30) * 60_000;
  return `${timeFormat.format(new Date(start))} – ${timeFormat.format(new Date(end))}`;
}

function dateText(millis) {
  return Number.isSafeInteger(Number(millis))
    ? dateFormat.format(new Date(Number(millis)))
    : 'Tarih bilgisi yok';
}

function normalizeSearch(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').trim();
}

function invalidateSession() {
  state.sessionActive = false;
  state.sessionVersion += 1;
  state.api = null;
  state.appointments = [];
  state.children = [];
  state.busy = false;
  node('ogrenciSec').replaceChildren();
  node('randevuListesi').replaceChildren();
  node('bekleyenKutusu').replaceChildren();
  node('uygulama').hidden = true;
  closeProposal();
  status('Oturum değişti. Randevu verileri temizlendi; sayfayı yeniden açın.', true);
}

function statusMatches(row) {
  if (state.filter === 'pending') return row.durum === 'talep';
  if (state.filter === 'approved') return row.durum === 'dolu';
  if (state.filter === 'proposal') return row.durum === 'alternatif_teklif';
  if (state.filter === 'closed') return KAPALI_DURUMLAR.has(row.durum);
  return true;
}

function filtered() {
  const today = todayKey();
  const search = normalizeSearch(state.search);
  return state.appointments.filter(row => {
    if (!statusMatches(row)) return false;
    if (state.target && row.hedefKodu !== state.target) return false;
    if (state.type && row.tip !== state.type) return false;
    const key = localDateKey(row.baslangicMillis);
    if (state.time === 'future' && key < today) return false;
    if (state.time === 'past' && key >= today) return false;
    if (search) {
      const haystack = normalizeSearch([
        row.ogrenciAd, row.veliAd, row.hedefAd, row.veliNotu,
        row.teklifNotu, DURUMLAR[row.durum], TIPLER[row.tip]
      ].join(' '));
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function summaryRender() {
  const count = durum => state.appointments.filter(row => row.durum === durum).length;
  node('ozetBekleyen').textContent = String(count('talep'));
  node('ozetOnaylanan').textContent = String(count('dolu'));
  node('ozetTeklif').textContent = String(count('alternatif_teklif'));
  node('ozetTum').textContent = String(state.appointments.length);
  document.querySelectorAll('[data-ozet-filtre]').forEach(button => {
    button.classList.toggle('aktif', button.dataset.ozetFiltre === state.filter);
  });
}

function targetFilterRender() {
  const select = node('hedefFiltre');
  const current = state.target;
  select.replaceChildren(new Option('Tüm personel', ''));
  const targets = new Map();
  for (const row of state.appointments) {
    if (row.hedefKodu && row.hedefAd) targets.set(row.hedefKodu, row.hedefAd);
  }
  [...targets].sort((a, b) => a[1].localeCompare(b[1], 'tr')).forEach(([code, name]) => {
    select.append(new Option(name, code));
  });
  if ([...select.options].some(option => option.value === current)) select.value = current;
  else state.target = '';
  select.hidden = !state.management && targets.size <= 1;
}

function pendingAlertRender() {
  const area = node('bekleyenKutusu');
  area.replaceChildren();
  const count = state.appointments.filter(row => row.durum === 'talep').length;
  if (!count || state.filter === 'pending') return;
  const box = document.createElement('div');
  box.className = 'bekleyen-kutu';
  const title = document.createElement('div');
  title.className = 'bekleyen-baslik';
  title.textContent = `🔔 ${count} veli randevu talebi onay bekliyor`;
  const show = dugme('Talepleri göster', () => setFilter('pending'), 'buton');
  box.append(title, show);
  area.append(box);
}

function actionButton(label, handler, className = '') {
  return dugme(label, handler, `buton ${className}`.trim());
}

function appointmentActions(row) {
  const actions = document.createElement('div');
  actions.className = 'islemler';
  if (row.durum === 'talep') {
    actions.append(
      actionButton('✓ Onayla', () => approve(row.id), 'birincil'),
      actionButton('Farklı saat', () => propose(row.id), 'mavi'),
      actionButton('Reddet', () => reject(row.id), 'tehlike')
    );
  }
  if (['talep', 'dolu', 'alternatif_teklif'].includes(row.durum)) {
    actions.append(actionButton('İptal et', () => cancel(row.id), 'tehlike'));
  }
  return actions;
}

function appointmentRow(row) {
  const item = document.createElement('article');
  item.className = `randevu-slot ${localDateKey(row.baslangicMillis) < todayKey() ? 'gecmis' : ''}`;

  const time = document.createElement('div');
  time.className = 'randevu-saat';
  time.append(document.createTextNode(timeText(row)));
  const duration = document.createElement('span');
  duration.className = 'randevu-sure';
  duration.textContent = `${Number(row.sureDakika) || 30} dakika`;
  time.append(duration);

  const detail = document.createElement('div');
  const top = document.createElement('div');
  top.className = 'randevu-ust';
  top.append(
    metinElemani('span', row.ogrenciAd || 'Öğrenci', 'randevu-ad'),
    metinElemani('span', DURUMLAR[row.durum] || 'Durum bilinmiyor', `rozet ${row.durum || ''}`),
    metinElemani('span', TIPLER[row.tip] || 'Görüşme', 'rozet tip-rozet')
  );
  detail.append(
    top,
    metinElemani(
      'div',
      `${row.veliAd || 'Veli'} · ${row.hedefAd || 'Personel'}`,
      'randevu-alt'
    )
  );
  if (row.veliNotu) detail.append(metinElemani('p', row.veliNotu, 'not'));
  if (row.durum === 'alternatif_teklif') {
    const proposed = Number(row.teklifBaslangicMillis);
    const text = Number.isSafeInteger(proposed)
      ? `Önerilen saat: ${dateText(proposed)} · ${timeFormat.format(new Date(proposed))}`
      : 'Farklı saat veli onayına gönderildi.';
    detail.append(metinElemani('p', `${text}${row.teklifNotu ? ` · ${row.teklifNotu}` : ''}`, 'not teklif-not'));
  }
  if (row.retNedeni) detail.append(metinElemani('p', `Ret nedeni: ${row.retNedeni}`, 'not'));
  if (row.teklifRetNedeni) detail.append(metinElemani('p', `Teklif ret nedeni: ${row.teklifRetNedeni}`, 'not'));
  if (row.iptalNedeni) detail.append(metinElemani('p', `İptal nedeni: ${row.iptalNedeni}`, 'not'));

  item.append(time, detail, appointmentActions(row));
  return item;
}

function appointmentsRender() {
  summaryRender();
  pendingAlertRender();
  const area = node('randevuListesi');
  area.replaceChildren();
  const rows = filtered().sort((a, b) => Number(a.baslangicMillis) - Number(b.baslangicMillis));
  if (!rows.length) {
    const empty = metinElemani('div', 'Seçili filtrelerde randevu bulunmuyor.', 'bos');
    area.append(empty);
    return;
  }
  const groups = new Map();
  for (const row of rows) {
    const key = localDateKey(row.baslangicMillis);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const [, groupRows] of groups) {
    const group = document.createElement('section');
    group.className = 'randevu-tarih-grubu';
    const heading = document.createElement('div');
    heading.className = 'randevu-tarih-baslik';
    heading.append(
      metinElemani('span', `📅 ${dateText(groupRows[0].baslangicMillis)}`),
      metinElemani(
        'span',
        `${groupRows.length} randevu · ${groupRows.filter(row => row.durum === 'talep').length} bekleyen · ${groupRows.filter(row => row.durum === 'dolu').length} onaylı`,
        'sayac'
      )
    );
    group.append(heading);
    groupRows.forEach(row => group.append(appointmentRow(row)));
    area.append(group);
  }
}

function childrenRender() {
  const select = node('ogrenciSec');
  select.replaceChildren();
  for (const child of state.children) select.append(new Option(child.ad, child.id));
  node('yeniRandevu').disabled = !state.children.length;
  node('yeniRandevuAc').disabled = !state.children.length;
}

function setFilter(value) {
  state.filter = value;
  node('durumFiltre').value = value;
  appointmentsRender();
}

async function loadInbox() {
  try {
    const inbox = await state.api.yonetimKutusu();
    state.management = inbox?.kapsam === 'okul';
    return inbox;
  } catch (_) {
    state.management = false;
    return state.api.personelKutusu();
  }
}

async function refresh({ quiet = false } = {}) {
  if (!state.sessionActive || !state.api || state.busy) return;
  const version = state.sessionVersion;
  state.busy = true;
  node('yenileBtn').disabled = true;
  try {
    const inbox = await loadInbox();
    if (!state.sessionActive || state.sessionVersion !== version) return;
    state.appointments = Array.isArray(inbox.randevular) ? inbox.randevular : [];
    node('kapsamRozeti').textContent = state.management
      ? 'Okul genelindeki randevular'
      : 'Size yönlendirilen randevular';
    targetFilterRender();
    appointmentsRender();
    if (!quiet) status('');
  } catch (error) {
    if (!state.sessionActive || state.sessionVersion !== version) return;
    state.appointments = [];
    targetFilterRender();
    appointmentsRender();
    if (!quiet) status(safeError(error, 'Randevu kutusu güvenli biçimde yüklenemedi.'), true);
  } finally {
    state.busy = false;
    node('yenileBtn').disabled = false;
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
    if (String(error?.code || '').includes('aborted')) await refresh({ quiet: true });
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
  const reason = globalThis.prompt('Ret nedeni (zorunlu ve veliye gösterilir):', '');
  if (reason === null || !reason.trim()) return;
  await command('reject', id, reason.trim(),
    key => state.api.reddet(key, id, reason.trim()), 'Randevu reddedildi.');
}

async function cancel(id) {
  const reason = globalThis.prompt('İptal nedeni (zorunlu ve veliye gösterilir):', '');
  if (reason === null || !reason.trim()) return;
  await command('cancel', id, reason.trim(),
    key => state.api.iptalEt(key, id, reason.trim()), 'Randevu iptal edildi.');
}

async function propose(id) {
  const local = globalThis.prompt('Yeni tarih ve saat (YYYY-AA-GGTHH:MM):', defaultLocalDateTime());
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

function defaultLocalDateTime() {
  const now = Math.ceil((Date.now() + 24 * 60 * 60_000) / 1_800_000) * 1_800_000;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date(now));
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function openProposal() {
  if (!state.children.length) {
    status('Randevu önermek için erişebildiğiniz aktif bir öğrenci bulunmuyor.', true);
    return;
  }
  node('yeniZaman').value = defaultLocalDateTime();
  const dialog = node('yeniRandevuModal');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeProposal() {
  const dialog = document.getElementById('yeniRandevuModal');
  if (!dialog) return;
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
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
  if (completed) {
    node('yeniNot').value = '';
    closeProposal();
    setFilter('proposal');
  }
}

function bindEvents() {
  node('yeniForm').addEventListener('submit', createAppointment);
  node('yeniRandevuAc').addEventListener('click', openProposal);
  node('yeniRandevuKapat').addEventListener('click', closeProposal);
  node('modalVazgec').addEventListener('click', closeProposal);
  node('yenileBtn').addEventListener('click', () => refresh());
  node('durumFiltre').addEventListener('change', event => {
    state.filter = event.target.value;
    appointmentsRender();
  });
  node('hedefFiltre').addEventListener('change', event => {
    state.target = event.target.value;
    appointmentsRender();
  });
  node('tipFiltre').addEventListener('change', event => {
    state.type = event.target.value;
    appointmentsRender();
  });
  node('zamanFiltre').addEventListener('change', event => {
    state.time = event.target.value;
    appointmentsRender();
  });
  node('aramaFiltre').addEventListener('input', event => {
    state.search = event.target.value;
    appointmentsRender();
  });
  document.querySelectorAll('[data-ozet-filtre]').forEach(button => {
    button.addEventListener('click', () => setFilter(button.dataset.ozetFiltre));
  });
  node('yeniRandevuModal').addEventListener('click', event => {
    if (event.target === event.currentTarget) closeProposal();
  });
}

async function start() {
  bindEvents();
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
