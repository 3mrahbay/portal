import { dateLabel } from './core.mjs';
export const memberLabels = { pending: 'Onay bekliyor', approved: 'Onaylı', blocked: 'Paylaşım kapalı' };
export function timestampLabel(value) {
  return value?.toDate ? dateLabel(value.toDate()) : 'Kayıtlı değil';
}
export function requestLabel(member) {
  // Legacy schema only retains updatedAt, which moderation overwrites.
  return member.status === 'pending' ? timestampLabel(member.updatedAt) : 'Ayrı talep zamanı tutulmamış';
}
export function summary(data) {
  return [
    ['Bekleyen talepler', data.members.filter(m => m.status === 'pending').length],
    ['Aktif üyeler', data.members.filter(m => m.status === 'approved').length],
    ['Toplam paylaşım', data.posts.filter(p => !p.deleted).length],
    ['Aktif kitap', data.books.filter(b => b.status === 'active').length],
  ];
}
export function localDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Date(Date.parse(value) + 3 * 3600000).toISOString().slice(0, 16);
}
export function bookData(values) {
  const data = {};
  for (const [key, max] of Object.entries({title:160, authors:160, leader:120, place:300, purpose:1000})) {
    data[key] = String(values[key] || '').trim();
    if (!data[key] || data[key].length > max) throw Error('Kitap ve buluşma bilgilerini belirtilen uzunluklarda doldurun.');
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(values.date || '')) throw Error('Geçerli bir tarih girin.');
  data.date = values.date + ':00+03:00';
  if (localDate(data.date) !== values.date) throw Error('Geçerli bir tarih girin.');
  if (!['active', 'archived'].includes(values.status)) throw Error('Geçerli bir kitaplık bölümü seçin.');
  data.status = values.status;
  return data;
}
