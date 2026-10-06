import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {classifyGalleryFile,validateStreamVideo,requestStreamAuthorization,uploadStreamVideo} from '../js/bunny-stream-upload.js';
import {installedPwa,assertPrecachedImport} from './helpers/portal-pwa.mjs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const file=(over={})=>({name:'synthetic.mp4',type:'',size:1024,...over});
const types={mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',m4v:'video/x-m4v',mkv:'video/x-matroska',avi:'video/x-msvideo',mpeg:'video/mpeg',mpg:'video/mpeg'};
function signerFixture() {
  const calls=[];
  const c={PropertiesService:{getScriptProperties:()=>({getProperty:name=>name==='BUNNY_STREAM_LIBRARY_ID'?'123456':'synthetic-secret'})},
    UrlFetchApp:{fetch:(url,options)=>{calls.push({url,options});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({guid:'synthetic-video'})};}},
    Utilities:{computeDigest:()=>[1,2,3],DigestAlgorithm:{SHA_256:'synthetic'},Charset:{UTF_8:'synthetic'}},Date,JSON,Error,Object,String,Number,encodeURIComponent};
  vm.runInNewContext(fs.readFileSync(new URL('../server/BCKA-Medya-bunny-stream-signer.gs',import.meta.url),'utf8'),c);
  return {calls,run:c.bckaStreamHazirla_};
}
test('supported extensions fill missing or generic MIME with the corresponding accepted type',()=>{
  for(const [ext,mimeType] of Object.entries(types))for(const type of ['', 'application/octet-stream','binary/octet-stream']){
    const f=file({name:`synthetic.${ext.toUpperCase()}`,type});
    assert.deepEqual(classifyGalleryFile(f),{kind:'video',mimeType});
    assert.deepEqual(validateStreamVideo(f),{ok:true,mimeType});
  }
});
test('specific accepted video MIME is normalized without requiring a filename extension',()=>{
  assert.deepEqual(classifyGalleryFile(file({name:'synthetic',type:' VIDEO/WEBM '})),{kind:'video',mimeType:'video/webm'});
});
test('specific incompatible MIME, unsupported MIME and disguised or inherited extensions are rejected',()=>{
  for(const f of [file({type:'application/pdf'}),file({type:'text/html'}),file({type:'video/x-unknown'}),file({name:'synthetic.exe'}),file({name:'synthetic.__proto__'}),file({name:'synthetic.constructor'}),file({name:'synthetic.mp4.exe'}),file({name:'mp4'})]){
    assert.equal(classifyGalleryFile(f),null);assert.equal(validateStreamVideo(f).ok,false);
  }
  assert.equal(validateStreamVideo(file({type:'image/png'})).ok,false);
  assert.deepEqual(classifyGalleryFile(file({name:'synthetic.jpg',type:'image/jpeg'})),{kind:'foto',mimeType:'image/jpeg'});
});
test('zero, negative, nonfinite and oversized video sizes fail before any signer request',async()=>{
  for(const size of [0,-1,NaN,Infinity,'bad',500*1024*1024+1]){
    let calls=0;await assert.rejects(requestStreamAuthorization(file({size}),{proxyUrl:'https://example.invalid',fetchImpl:()=>{calls++;throw Error('must not fetch');}}));assert.equal(calls,0);
  }
  assert.equal(validateStreamVideo(file({size:500*1024*1024})).ok,true);
});
test('all accepted extension fallbacks send MIME accepted by the unchanged signer and matching TUS metadata',async()=>{
  for(const [ext,mimeType] of Object.entries(types))for(const type of ['', 'application/octet-stream']){
    const f=file({name:`synthetic.${ext}`,type});const signer=signerFixture();let body,options;
    const auth=await requestStreamAuthorization(f,{proxyUrl:'https://example.invalid',sharedKey:'synthetic',fetchImpl:async(_url,request)=>{
      body=JSON.parse(request.body);const result=signer.run(body);
      return {ok:true,status:200,text:async()=>JSON.stringify(result)};
    }});
    assert.equal(body.mimeType,mimeType);assert.equal('icerikBase64' in body,false);assert.equal(signer.calls.length,1);
    class Upload {constructor(_file,opts){options=opts;}start(){options.onSuccess();}}
    await uploadStreamVideo(f,{authorization:auth,tusLoader:async()=>({Upload})});
    assert.equal(options.metadata.filetype,mimeType);assert.equal(options.metadata.filename,f.name);
  }
});
test('rejected type never invokes the signer transport or TUS loader',async()=>{
  const f=file({type:'application/pdf'});let calls=0;
  await assert.rejects(requestStreamAuthorization(f,{proxyUrl:'https://example.invalid',fetchImpl:()=>{calls++;}}));
  await assert.rejects(uploadStreamVideo(f,{authorization:{signature:'synthetic'},tusLoader:()=>{calls++;}}));
  assert.equal(calls,0);
});
test('unchanged signer rejects unnormalized unsupported MIME before Bunny creation',()=>{
  const f=signerFixture();assert.throws(()=>f.run({dosyaAdi:'synthetic.mp4',dosyaBoyutu:1024,mimeType:'application/octet-stream'}),/video türü/);assert.equal(f.calls.length,0);
});
test('actual Portal picker accepts missing/generic video MIME and rejects unsafe or empty videos',()=>{
  const selected=[],warnings=[];const c={classifyGalleryFile,validateStreamVideo,galeriSecilenDosyalar:selected,showToast:x=>warnings.push(x),renderGaleriSecilenDosyalar(){}};
  vm.runInNewContext(slice('function galeriDosyalarEkle(files)','function renderGaleriSecilenDosyalar()')+';this.pick=galeriDosyalarEkle;',c);
  const accepted=[file(),file({type:'application/octet-stream'}),file({name:'synthetic.jpg',type:'image/jpeg'})];
  c.pick([...accepted,file({type:'application/pdf'}),file({size:0})]);assert.deepEqual(selected,accepted);assert.equal(warnings.length,2);
});
test('actual Portal selected-file preview uses the same video classifier',()=>{
  const el={innerHTML:''};const c={classifyGalleryFile,galeriSecilenDosyalar:[file()],document:{getElementById:()=>el},escapeHtml:x=>x};
  vm.runInNewContext(slice('function renderGaleriSecilenDosyalar()', 'window.galeriDosyaKaldir')+';renderGaleriSecilenDosyalar();',c);
  assert.match(el.innerHTML,/🎥 synthetic.mp4/);
});
function uploadFixture(files) {
  const saved=[],routes=[],nodes=new Map();
  const values={galeriEtkinlik:'Synthetic',galeriEtkinlikTarih:'2026-10-06',galeriAciklama:'',galeriHedefTur:'sinif',galeriHedefSinif:'Synthetic class',galeriKategori:''};
  const c={window:{PortalAPI:{state:{}}},classifyGalleryFile,validateStreamVideo,galeriSecilenDosyalar:files,
    document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{value:values[id]||'',style:{},checked:false});return nodes.get(id);}},
    gallerySession:()=> 'synthetic-session',galleryText:x=>x,galeriProgramKodu:()=>'',currentUser:{email:'synthetic@example.invalid'},AKTIF_DONEM:'synthetic',isAdmin:false,aktifKullaniciRol:'ogretmen',
    db:{},doc:()=>({id:'synthetic-record'}),collection:()=>{},setDoc:async(ref,value)=>saved.push({ref,value}),
    galeriVideoYukle:async f=>{routes.push('video');assert.equal(validateStreamVideo(f).ok,true);return {embedUrl:'https://iframe.mediadelivery.net/embed/123/synthetic',videoId:'synthetic',libraryId:'123'};},
    resimSikistir:async f=>{routes.push('foto');return f;},medyaYukle:async()=>({url:'https://example.invalid/photo.jpg',yol:'photo.jpg'}),
    galeriBekliyorMu:()=>true,notifyGalleryApproval:async()=>({ok:true}),showToast(){},console:{error(){}},albumEkleMod:null,closeGaleriYuklemeModal(){},renderGaleri(){}};
  vm.runInNewContext(slice('window.galeriYukle = async function()', '// Lightbox\nlet aktifLightboxOge'),c);
  return {saved,routes,run:c.window.galeriYukle};
}
test('actual Portal upload routes missing/generic MIME videos to Stream and persists normalized MIME',async()=>{
  for(const type of ['', 'application/octet-stream']){
    const f=uploadFixture([file({name:'synthetic.mov',type})]);await f.run();
    assert.deepEqual(f.routes,['video']);assert.equal(f.saved.length,1);
    assert.equal(f.saved[0].value.dosyaTipi,'video');assert.equal(f.saved[0].value.mimeType,'video/quicktime');assert.equal(f.saved[0].value.mp4Url,'');
  }
});
test('actual Portal image upload stays on the photo path and unrecognized input has no write',async()=>{
  const f=uploadFixture([file({name:'synthetic.jpg',type:'image/jpeg'}),file({name:'synthetic.mp4',type:'application/pdf'})]);
  await f.run();assert.deepEqual(f.routes,['foto']);assert.equal(f.saved.length,1);assert.equal(f.saved[0].value.mimeType,'image/jpeg');
});
test('shared classifier import reuses the exact existing precached Stream module without a release bump',async()=>{
  const worker=await installedPwa();assertPrecachedImport(worker,'index.html','js/bunny-stream-upload.js');
});
