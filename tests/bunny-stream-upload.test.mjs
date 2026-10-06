import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_VIDEO_BYTES, validateStreamVideo, requestStreamAuthorization, uploadStreamVideo
} from '../js/bunny-stream-upload.js';

const file=(over={})=>({name:'movie.mp4',type:'video/mp4',size:100*1024*1024,...over});

test('Bunny Stream gallery videos allow up to 500 MB',()=>{
  assert.equal(MAX_VIDEO_BYTES,500*1024*1024);
  assert.equal(validateStreamVideo(file({size:500*1024*1024})).ok,true);
  assert.equal(validateStreamVideo(file({size:500*1024*1024+1})).ok,false);
  assert.equal(validateStreamVideo(file({name:'movie.pdf',type:'application/pdf'})).ok,false);
});

test('signer request sends metadata only, never video bytes/base64',async()=>{
  let request;
  const auth=await requestStreamAuthorization(file(),{
    proxyUrl:'https://proxy.example.invalid',
    sharedKey:'synthetic',
    fetchImpl:async(url,options)=>{
      request={url,options,body:JSON.parse(options.body)};
      return {ok:true,status:200,text:async()=>JSON.stringify({
        ok:true,signature:'sig',expirationTime:123,videoId:'vid',libraryId:'lib',
        endpoint:'https://video.bunnycdn.com/tusupload',
        embedUrl:'https://iframe.mediadelivery.net/embed/lib/vid'
      })};
    }
  });
  assert.equal(request.body.islem,'stream_hazirla');
  assert.equal(request.body.dosyaBoyutu,file().size);
  assert.ok(!('icerikBase64' in request.body));
  assert.equal(auth.videoId,'vid');
});

test('TUS uploader uses presigned headers and starts a clean upload for each new video authorization',async()=>{
  const calls={started:0,resumed:0,progress:[]};
  class Upload {
    constructor(f,options){this.file=f;this.options=options;this.url='https://video.bunnycdn.com/tusupload/example';calls.options=options;}
    async findPreviousUploads(){return [{uploadUrl:'prior'}];}
    resumeFromPreviousUpload(){calls.resumed++;}
    start(){calls.started++;this.options.onProgress(8,16);this.options.onSuccess();}
  }
  const result=await uploadStreamVideo(file(),{
    authorization:{
      signature:'sig',expirationTime:'123',videoId:'vid',libraryId:'lib',
      endpoint:'https://video.bunnycdn.com/tusupload',
      embedUrl:'https://iframe.mediadelivery.net/embed/lib/vid'
    },
    tusLoader:async()=>({Upload}),
    onProgress:p=>calls.progress.push(p)
  });
  assert.equal(calls.options.chunkSize,8*1024*1024);
  assert.equal(calls.options.headers.AuthorizationSignature,'sig');
  assert.equal(calls.options.headers.VideoId,'vid');
  assert.equal(calls.options.headers.LibraryId,'lib');
  assert.equal(calls.resumed,0);
  assert.equal(calls.started,1);
  assert.equal(Math.round(calls.progress[0].percent),50);
  assert.equal(result.embedUrl,'https://iframe.mediadelivery.net/embed/lib/vid');
});
