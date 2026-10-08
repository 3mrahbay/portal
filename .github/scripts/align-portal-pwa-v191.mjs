import fs from 'node:fs';

function replaceExact(path, before, after, expected = 1) {
  const source = fs.readFileSync(path, 'utf8');
  const found = source.split(before).length - 1;
  if (found !== expected) throw new Error(`${path}: expected ${expected} occurrence(s) of ${before}, found ${found}`);
  fs.writeFileSync(path, source.replaceAll(before, after));
}

replaceExact('index.html', 'serviceworker.js?v=189', 'serviceworker.js?v=191');
replaceExact('index.html', 'portalSwReload_v189', 'portalSwReload_v191');
replaceExact('index.html', 'window.PORTAL_SURUM = "v189";', 'window.PORTAL_SURUM = "v191";');
replaceExact('serviceworker.js', './moduller/veli-galeri.js?v=v189', './moduller/veli-galeri.js?v=v191');

replaceExact('tests/portal-media-release-delivery.test.mjs', "target==='js/bunny-stream-upload.js'?'?v=189':'?v=188'", "target==='js/bunny-stream-upload.js'?'?v=191':'?v=188'");
replaceExact('tests/portal-media-release-delivery.test.mjs', "assert.equal(pwa.cacheVersion,'v189-gallery-video-600mb');", "assert.equal(pwa.cacheVersion,'v191-bunny-upload-resilience');");
replaceExact('tests/portal-media-release-delivery.test.mjs', 'window.PORTAL_SURUM = "v189";', 'window.PORTAL_SURUM = "v191";');
replaceExact('tests/portal-media-release-delivery.test.mjs', "stored.get('portalSwReload_v189')", "stored.get('portalSwReload_v191')");

console.log('Portal PWA v191 registration, runtime, reload guard and parent gallery delivery aligned.');
