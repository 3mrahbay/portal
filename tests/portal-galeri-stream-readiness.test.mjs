import test from 'node:test';
import assert from 'node:assert/strict';
import { streamStatusUrl, streamPlaybackInfo } from '../js/portal-galeri-medya.js';

const media={streamLibraryId:'123456',streamVideoId:'12345678-abcd-4abc-9abc-123456789012',videoSaglayici:'bunny-stream'};

test('Bunny Stream readiness URL uses public heatmap status endpoint',()=>{
  assert.equal(streamStatusUrl(media),'https://video.bunnycdn.com/library/123456/videos/12345678-abcd-4abc-9abc-123456789012/play/heatmap');
  assert.equal(streamStatusUrl({streamLibraryId:'bad',streamVideoId:'x'}),'');
});

test('processing Stream video is not marked ready and keeps encode progress',async()=>{
  const fake=async()=>({ok:true,json:async()=>({video:{status:2,encodeProgress:47,availableResolutions:''},thumbnailUrl:''})});
  const info=await streamPlaybackInfo(media,fake);
  assert.equal(info.ready,false);
  assert.equal(info.failed,false);
  assert.equal(info.progress,47);
});

test('finished Stream video is ready and exposes Bunny thumbnail URL',async()=>{
  const fake=async()=>({ok:true,json:async()=>({video:{status:3,encodeProgress:100,availableResolutions:'360p,720p'},thumbnailUrl:'https://vz-test.b-cdn.net/video/thumbnail.jpg'})});
  const info=await streamPlaybackInfo(media,fake);
  assert.equal(info.ready,true);
  assert.equal(info.failed,false);
  assert.equal(info.thumbnailUrl,'https://vz-test.b-cdn.net/video/thumbnail.jpg');
});

test('failed Stream status is explicit',async()=>{
  const fake=async()=>({ok:true,json:async()=>({video:{status:5,encodeProgress:61}})});
  const info=await streamPlaybackInfo(media,fake);
  assert.equal(info.ready,false);
  assert.equal(info.failed,true);
});
