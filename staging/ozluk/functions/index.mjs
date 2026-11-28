import {onRequest} from 'firebase-functions/v2/https';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getStorage} from 'firebase-admin/storage';
import {randomUUID} from 'node:crypto';
import {PROJECT, BUCKET, AccessError, assertProject, principal, assertRead, documentId, uploadBody} from './domain.mjs';

initializeApp({projectId: PROJECT});
const bucket = getStorage().bucket(BUCKET);
// The runtime has objectCreator + objectViewer only. It cannot overwrite/delete audit entries.
async function audit(actor, action, id, outcome) {
  await bucket.file(`audit/${randomUUID()}.json`).save(JSON.stringify({
    actor: actor?.uid || null, action, documentId: id || null, outcome,
    time: new Date().toISOString(), environment: 'staging'
  }), {resumable: false, preconditionOpts: {ifGenerationMatch: 0},
    metadata: {contentType: 'application/json', cacheControl: 'no-store'}});
}
export const ozlukBelgeStagingV1 = onRequest({
  region: 'europe-west3', minInstances: 0, maxInstances: 1, concurrency: 10,
  memory: '256MiB', timeoutSeconds: 30, invoker: 'public',
  serviceAccount: 'ozluk-docs-staging@bcka-site-staging.iam.gserviceaccount.com',
  cors: [/^https:\/\/bcka-site-staging--ozluk-[a-z0-9-]+\.web\.app$/]
}, async (req, res) => {
  res.set({'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'});
  let actor, id, action = 'unknown';
  try {
    assertProject(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT);
    if (req.method !== 'POST') throw new AccessError(405, 'Yalnız POST desteklenir.');
    const token = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '')?.[1];
    if (!token) throw new AccessError(401, 'Test hesabıyla giriş yapın.');
    let decoded, user;
    try {
      decoded = await getAuth().verifyIdToken(token, true);
      // Fresh claims prevent an old ID token from retaining a revoked role.
      user = await getAuth().getUser(decoded.uid);
    } catch { throw new AccessError(401, 'Oturum geçersiz veya süresi dolmuş.'); }
    actor = {uid: user.uid, role: "denied"};
    actor = principal(user);
    action = req.path.split('/').filter(Boolean).at(-1);
    if (action === 'upload') {
      const {bytes, type} = uploadBody(req.body);
      id = randomUUID();
      await audit(actor, action, id, 'authorized');
      await bucket.file(`documents/${id}`).save(bytes, {
        resumable: false, preconditionOpts: {ifGenerationMatch: 0},
        metadata: {contentType: type, cacheControl: 'private, no-store',
          metadata: {ownerUid: actor.uid, createdAt: new Date().toISOString()}}
      });
      await audit(actor, action, id, 'completed');
      return res.status(201).json({belgeId: id, belgeTipi: type, size: bytes.length});
    }
    if (action === 'read') {
      if (!req.body || Object.keys(req.body).some(k => k !== 'belgeId')) throw new AccessError(400, 'Geçersiz istek.');
      id = documentId(req.body.belgeId);
      const file = bucket.file(`documents/${id}`);
      let metadata;
      try { [metadata] = await file.getMetadata(); }
      catch (e) { if (e.code === 404) throw new AccessError(403, 'Bu belgeye erişim yetkiniz yok.'); throw e; }
      assertRead(actor, metadata.metadata?.ownerUid);
      await audit(actor, action, id, 'authorized');
      const [bytes] = await file.download();
      await audit(actor, action, id, 'completed');
      res.set({'Content-Type': metadata.contentType,
        'Content-Disposition': 'attachment; filename="sentetik-test-belgesi"'});
      return res.status(200).send(bytes);
    }
    throw new AccessError(404, 'İşlem bulunamadı.');
  } catch (e) {
    const status = e instanceof AccessError ? e.status : 503;
    console.info(JSON.stringify({event:"ozluk-document-denied",status,actor:actor?.uid || null,action}));
    // Fail closed if audit/storage is unavailable. Never return internal errors or document data.
    if (actor) { try { await audit(actor, action, id, 'denied'); } catch {} }
    return res.status(status).json({error: e instanceof AccessError ? e.message : 'Güvenli belge servisine şu anda erişilemiyor.'});
  }
});
