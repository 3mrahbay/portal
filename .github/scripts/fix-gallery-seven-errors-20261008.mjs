import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceRequired(path, pattern, replacement, label) {
  const source = read(path);
  let next;
  let matched = false;
  if (typeof pattern === 'string') {
    matched = source.includes(pattern);
    next = source.split(pattern).join(replacement);
  } else {
    pattern.lastIndex = 0;
    matched = pattern.test(source);
    pattern.lastIndex = 0;
    next = source.replace(pattern, replacement);
  }
  if (!matched) throw new Error(`${path}: required replacement not found (${label})`);
  write(path, next);
}

// Keep every changed browser import and the service-worker precache on one
// release generation. This prevents old/new gallery modules being mixed.
replaceRequired('index.html', /bunny-stream-upload\.js\?v=191/g,
  'bunny-stream-upload.js?v=192', 'index Bunny upload v192');
replaceRequired('index.html', /portal-galeri-klasor-ui\.js\?v=188/g,
  'portal-galeri-klasor-ui.js?v=192', 'index gallery folder UI v192');
replaceRequired('js/zeky-randevu-modal-koprusu.js', /zeky-galeri-filigran-koprusu\.js\?v=188/g,
  'zeky-galeri-filigran-koprusu.js?v=192', 'gallery bridge v192');
replaceRequired('serviceworker.js', /bunny-stream-upload\.js\?v=191/g,
  'bunny-stream-upload.js?v=192', 'precache Bunny upload v192');

// The first patch writes this focused contract test from a template literal.
// String.raw preserves regex escapes such as \s, \S and \* exactly.
const contractTest = String.raw`import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const core=fs.readFileSync(new URL('../portal-galeri-core.js',import.meta.url),'utf8');
const live=fs.readFileSync(new URL('../js/portal-galeri-canli.js',import.meta.url),'utf8');
const media=fs.readFileSync(new URL('../js/portal-galeri-medya.js',import.meta.url),'utf8');
const education=fs.readFileSync(new URL('../js/zeky-galeri-onay-egitim.js',import.meta.url),'utf8');
const upload=fs.readFileSync(new URL('../js/bunny-stream-upload.js',import.meta.url),'utf8');
test('gallery cards are visual-only and lightbox has one stable media host',()=>{assert.match(media,/bunnyStream && thumbnail/);assert.match(media,/pg-video-thumbnail/);assert.doesNotMatch(media,/Video durumu doğrulanamadı; oynatmayı deneyebilirsiniz/);assert.match(live,/dataset(?:\?\.)?pgLightboxMediaHost/);assert.match(core,/data-pg-lightbox-media-host/);});
test('upload records target and sender labels for parent teacher and management views',()=>{for(const field of ['hedefSinifAd','hedefEtiket','yukleyenAd','yukleyenRol','yukleyenUid'])assert.match(core,new RegExp(field));assert.match(education,/Gönderim hedefi/);assert.match(education,/Gönderen rolü/);assert.match(education,/yukleyenEtiketi/);});
test('edit action receives the active media id instead of relying on inline scope',()=>{assert.match(core,/duzenleBtn\.onclick[\s\S]*galeriGonderiDuzenle\?\.\(oge\.id\)/);assert.match(core,/id = id \|\| aktifLightboxOge\?\.id/);});
test('large uploads use 2 MiB chunks, same-authorization resume and progress diagnostics',()=>{assert.match(upload,/LARGE_VIDEO_CHUNK_SIZE\s*=\s*2\s*\*\s*1024\s*\*\s*1024/);assert.match(upload,/resumeFromPreviousUpload/);assert.match(upload,/uploadPercent/);assert.match(upload,/activeAuthorizations/);});
`;
write('tests/gallery-media-ui-metadata.test.mjs', contractTest);

// Align the release-delivery expectations with the actual v192 import graph.
const releasePath = 'tests/portal-media-release-delivery.test.mjs';
let release = read(releasePath);
const edgeAssertion = " assert.equal(url.search,new Set(['js/bunny-stream-upload.js','js/portal-galeri-klasor-ui.js','js/zeky-galeri-filigran-koprusu.js','js/portal-galeri-canli.js','js/portal-galeri-medya.js']).has(target)?'?v=192':'?v=188');";
if (!/assert\.equal\(url\.search,[^\n]+\);/.test(release)) {
  throw new Error(`${releasePath}: edge version assertion not found`);
}
release = release.replace(/ assert\.equal\(url\.search,[^\n]+\);/, edgeAssertion);
if (!release.includes('window.PORTAL_SURUM = "v191";')) {
  throw new Error(`${releasePath}: v191 runtime expectation not found`);
}
release = release.replaceAll('window.PORTAL_SURUM = "v191";', 'window.PORTAL_SURUM = "v192";');
release = release.replace('new controller generation reloads once after an earlier v188 reload',
  'new controller generation reloads once after an earlier v191 reload');
write(releasePath, release);

console.log('Seven remaining gallery/PWA contract errors repaired.');
