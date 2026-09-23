const QR_ON_EKI = 'ZEKY-DEVAM';

export function okulQrMetni(ayar = {}) {
  const okulId = String(ayar.okulId || '').trim();
  const jeton = String(ayar.jeton || '').trim();
  if (!okulId || !jeton) return '';
  return `${QR_ON_EKI}:${okulId}:${jeton}`;
}

export function okulQrAyarDogrula(ayar = {}) {
  const metin = okulQrMetni(ayar);
  const enlemVar = ayar.enlem !== null && ayar.enlem !== undefined && ayar.enlem !== '';
  const boylamVar = ayar.boylam !== null && ayar.boylam !== undefined && ayar.boylam !== '';
  const enlem = enlemVar ? Number(ayar.enlem) : NaN;
  const boylam = boylamVar ? Number(ayar.boylam) : NaN;
  const yaricapMetre = Math.max(20, Number(ayar.yaricapMetre) || 100);
  return {
    qrHazir: !!metin,
    konumHazir: Number.isFinite(enlem) && Number.isFinite(boylam),
    metin,
    okulId: String(ayar.okulId || 'BCKA').trim() || 'BCKA',
    enlem: Number.isFinite(enlem) ? enlem : null,
    boylam: Number.isFinite(boylam) ? boylam : null,
    yaricapMetre
  };
}

export function okulQrYeniJeton(cryptoApi = globalThis.crypto) {
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Güvenli QR anahtarı bu tarayıcıda üretilemiyor.');
  }
  const bytes = new Uint8Array(18);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function okulQrPosterDosyaAdi(okulId = 'BCKA') {
  const temiz = String(okulId || 'BCKA')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'BCKA';
  return `${temiz}-personel-giris-cikis-QR.png`;
}
