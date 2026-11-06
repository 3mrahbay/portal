// Bunny Stream videolarında İndir/Paylaş ve galeride Beğen — çevrimdışı sentetik testler.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { downloadSource, downloadAvailable, resolveDownloadUrl, streamMp4Url, streamMp4Height } from '../js/portal-galeri-medya.js';
import { interactionPatch } from '../js/portal-galeri-etkilesim.js';

const stream = {
  id:'v1', dosyaTipi:'video', mp4Url:'',
  bunnyUrl:'https://iframe.mediadelivery.net/embed/123/abcd-efgh-1234',
  embedUrl:'https://iframe.mediadelivery.net/embed/123/abcd-efgh-1234',
  streamLibraryId:'123', streamVideoId:'abcd-efgh-1234', streamCdnHost:'vz-test.b-cdn.net'
};
const bilgi = (video, extra = {}) => async () => ({ ok:true, json:async () => ({ video, ...extra }) });

test('stream video: no stored file URL, but download/share is available', () => {
  assert.equal(downloadSource(stream), '');
  assert.equal(downloadAvailable(stream), true);
  assert.equal(downloadAvailable({ ...stream, streamVideoId:'' }), false);
  assert.equal(downloadAvailable({ dosyaTipi:'foto', bunnyUrl:'https://x.b-cdn.net/a.jpg' }), true);
});

test('MP4 fallback URL picks the highest encoded height up to 1080p', async () => {
  assert.equal(streamMp4Height('240p,360p,720p,1080p,1440p'), 1080);
  assert.equal(streamMp4Height('360p,480p'), 480);
  assert.equal(streamMp4Height(''), 0);
  assert.equal(streamMp4Url(stream), 'https://vz-test.b-cdn.net/abcd-efgh-1234/play_720p.mp4');
  assert.equal(streamMp4Url({ ...stream, streamCdnHost:'kötü host' }), '');
  const url = await resolveDownloadUrl(stream, bilgi({ status:4, encodeProgress:100, availableResolutions:'360p,480p' }));
  assert.equal(url, 'https://vz-test.b-cdn.net/abcd-efgh-1234/play_480p.mp4');
});

test('CDN host is taken from Bunny thumbnail when the record has none', async () => {
  const url = await resolveDownloadUrl({ ...stream, streamCdnHost:'' },
    bilgi({ status:3, encodeProgress:100, availableResolutions:'720p' }, { thumbnailUrl:'https://vz-zz9.b-cdn.net/abcd-efgh-1234/thumbnail.jpg' }));
  assert.equal(url, 'https://vz-zz9.b-cdn.net/abcd-efgh-1234/play_720p.mp4');
});

test('not ready, failed and MP4-disabled videos give clear errors instead of a broken file', async () => {
  await assert.rejects(resolveDownloadUrl(stream, bilgi({ status:2, encodeProgress:40 })), e => e.code === 'stream/not-ready');
  await assert.rejects(resolveDownloadUrl(stream, bilgi({ status:5 })), e => e.code === 'stream/failed');
  await assert.rejects(resolveDownloadUrl(stream, bilgi({ status:4, encodeProgress:100, availableResolutions:'720p', hasMP4Fallback:false })), e => e.code === 'stream/no-mp4');
});

test('status endpoint offline still tries the default 720p file; direct URLs never call Bunny', async () => {
  assert.equal(await resolveDownloadUrl(stream, async () => { throw new Error('offline'); }), 'https://vz-test.b-cdn.net/abcd-efgh-1234/play_720p.mp4');
  let calls = 0;
  const direct = { dosyaTipi:'video', mp4Url:'https://firebasestorage.googleapis.com/v0/b/x/o/a.mp4?alt=media' };
  assert.equal(await resolveDownloadUrl(direct, async () => { calls++; }), direct.mp4Url);
  assert.equal(calls, 0);
});

test('favorite interaction uses the same fields as ZEKY', () => {
  const on = interactionPatch({}, 'favori', '2026-11-07T00:00:00.000Z', true);
  assert.deepEqual(on, { favori:true, favoriDegisimZamani:'2026-11-07T00:00:00.000Z', favoriZamani:'2026-11-07T00:00:00.000Z' });
  const off = interactionPatch({ favoriZamani:'x' }, 'favori', 'y', false);
  assert.deepEqual(off, { favori:false, favoriDegisimZamani:'y' });
  // Firestore kuralı yalnız bu alanlara izin veriyor
  const izinli = ['favori', 'favoriDegisimZamani', 'favoriZamani'];
  for (const key of Object.keys(on)) assert.ok(izinli.includes(key));
});

test('parent lightbox wires Like and Share, and download uses stream availability', () => {
  const src = fs.readFileSync(new URL('../moduller/veli-galeri.js', import.meta.url), 'utf8');
  assert.match(src, /data-vg-like/);
  assert.match(src, /window\._vg\.begen\(m\.id,button\)/);
  assert.match(src, /window\._vg\.paylas\(m\.id,button\)/);
  assert.match(src, /const indirilebilir=downloadAvailable\(m\)/);
  const canli = fs.readFileSync(new URL('../js/portal-galeri-canli.js', import.meta.url), 'utf8');
  // Paylaşım dosyanın kendisiyle yapılır, çocuk videosunun bağlantısı paylaşılmaz.
  assert.match(canli, /navigator\.share\(\{ files:\[file\]/);
  assert.doesNotMatch(canli, /navigator\.share\(\{[^}]*url:/);
  assert.match(canli, /'kullaniciTercihleri'/);
  assert.match(canli, /galeriFavoriler/);
});

test('memory video player offers Download and file-only Share', () => {
  const src = fs.readFileSync(new URL('../moduller/veli-ani-video.js', import.meta.url), 'utf8');
  assert.match(src, /data-vav-indir/);
  assert.match(src, /data-vav-paylas/);
  assert.match(src, /navigator\.share\(\{ files: \[dosya\]/);
  assert.doesNotMatch(src, /navigator\.share\(\{[^}]*url:/);
});
