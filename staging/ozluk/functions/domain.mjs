export const PROJECT = 'bcka-site-staging';
export const MAX_BYTES = 5 * 1024 * 1024;
export const BUCKET = 'bcka-site-staging-ozluk-private-20261128';
export class AccessError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function assertProject(project) {
  if (project !== PROJECT) throw new Error('This test service cannot run outside staging.');
}
export function principal(user, now = Date.now()) {
  const c = user.customClaims || {};
  if (user.disabled || !user.emailVerified || c.ozlukStageActive !== true ||
      !Number.isFinite(c.ozlukStageExpires) || c.ozlukStageExpires <= now ||
      !['staff', 'medicalReviewer', 'accountant'].includes(c.ozlukStageRole)) {
    throw new AccessError(403, 'Bu test hesabının belge erişimi yok.');
  }
  return { uid: user.uid, role: c.ozlukStageRole };
}
export function assertRead(actor, owner) {
  if (actor.uid !== owner && actor.role !== 'medicalReviewer') {
    throw new AccessError(403, 'Bu belgeye erişim yetkiniz yok.');
  }
}
export function documentId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw new AccessError(400, 'Belge kimliği geçersiz.');
  }
  return value;
}
export function uploadBody(body) {
  if (!body || Object.keys(body).some(k => !['base64', 'type'].includes(k)) ||
      typeof body.base64 !== 'string' || body.base64.length > Math.ceil(MAX_BYTES / 3) * 4 ||
      (body.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64))) {
    throw new AccessError(400, 'Belge biçimi geçersiz veya dosya çok büyük.');
  }
  const bytes = Buffer.from(body.base64, 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES || bytes.toString('base64') !== body.base64) {
    throw new AccessError(400, 'Belge boyutu geçersiz.');
  }
  const pdf = bytes.subarray(0, 5).toString() === '%PDF-';
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const allowed = {'application/pdf': pdf, 'image/png': png, 'image/jpeg': jpg};
  if (!Object.hasOwn(allowed, body.type) || !allowed[body.type]) {
    throw new AccessError(400, 'Yalnız PDF, PNG veya JPEG test dosyası kullanılabilir.');
  }
  return {bytes, type: body.type};
}
