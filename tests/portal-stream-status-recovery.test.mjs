import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {streamThumbnailUrl,mediaSources,downloadSource} from '../js/portal-galeri-medya.js';

const source=fs.readFileSync(new URL('../js/portal-galeri-medya.js',import.meta.url),'utf8').replace(/export /g,'');
const video={dosyaTipi:'video',streamLibraryId:'123456',streamVideoId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',embedUrl:'https://iframe.mediadelivery.net/embed/123456/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'};
class Element {
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.style={};this.events={};this.hidden=false;}
  get parentNode(){return this.parent;}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  append(...items){for(const x of items){x.remove();x.parent=this;this.children.push(x);}}
  prepend(x){x.remove();x.parent=this;this.children.unshift(x);}
  replaceChildren(...items){for(const x of this.children)x.parent=null;this.children=[];this.append(...items);}
  setAttribute(){} removeAttribute(key){if(key==='src')this.src='';}
  addEventListener(name,fn){this.events[name]=fn;}
  pause(){} load(){}
}
async function fixture({ageMinutes=1,status='error',timestamp=true,extra={},fetchImpl}={}) {
  let now=Date.parse('2026-10-06T20:00:00Z'),calls=0,next=0;
  const timers=new Map();class FakeDate extends Date{static now(){return now;}}
  const c={URL,Date:FakeDate,console,setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),fetch:async()=>{
    calls++;if(fetchImpl)return fetchImpl();if(status==='error')throw Error('synthetic offline');
    return {ok:true,json:async()=>({video:{status,encodeProgress:status===3?100:20,availableResolutions:status===3?'720p':''}})};
  }};
  vm.createContext(c);vm.runInContext(source,c);
  const doc={createElement:tag=>new Element(tag,doc)},host=new Element('div',doc);
  const dispose=c.renderMedia(host,{...video,...timestamp?{yuklemeZamani:new Date(now-ageMinutes*60000).toISOString()}:{},...extra});
  await new Promise(setImmediate);
  return {host,dispose,timers,get calls(){return calls;},get iframe(){return host.children.find(x=>x.tagName==='IFRAME');},get status(){return host.children.find(x=>x.className==='pg-media-status')?.textContent;},
    advance:ms=>{now+=ms;},tick:async()=>{const [id,fn]=timers.entries().next().value||[];assert.ok(fn,'pending timer');timers.delete(id);await fn();await new Promise(setImmediate);}};
}
test('initially fresh video can use its supplied player when status outage continues past five minutes',async()=>{
  const f=await fixture();assert.equal(f.iframe,undefined);assert.match(f.status,/doğrulanamıyor/);
  f.advance(4*60000);await f.tick();assert.equal(f.iframe.src,video.embedUrl+'?autoplay=false');
  assert.match(f.status,/doğrulanamadı/);assert.equal(f.timers.size,0);
});
test('old rows still require two status attempts before network-error fallback',async()=>{
  const f=await fixture({ageMinutes:6});assert.equal(f.iframe,undefined);await f.tick();
  assert.ok(f.iframe);assert.equal(f.calls,2);
});
test('missing, malformed and future timestamps cannot leave status outages waiting forever',async()=>{
  for(const options of [{timestamp:false},{extra:{yuklemeZamani:'invalid'}},{ageMinutes:-60}]){
    const f=await fixture(options);assert.equal(f.iframe,undefined);f.advance(5*60000);await f.tick();
    assert.ok(f.iframe);assert.equal(f.timers.size,0);
  }
});
test('confirmed processing remains processing even after the network-error fallback age',async()=>{
  const f=await fixture({status:2});f.advance(20*60000);await f.tick();
  assert.equal(f.iframe,undefined);assert.match(f.status,/hazırlanıyor.*%20/);assert.equal(f.timers.size,1);f.dispose();
});
test('explicit encoder failure never falls back to playback, even on old rows',async()=>{
  for(const status of [5,8]){const f=await fixture({status,ageMinutes:60});
    assert.equal(f.iframe,undefined);assert.match(f.status,/yeniden yüklemesi/);assert.equal(f.timers.size,0);}
});
test('ready response immediately renders the supplied player',async()=>{
  const f=await fixture({status:3});assert.ok(f.iframe);assert.equal(f.timers.size,0);
});
test('status outage with no actual playable URL does not manufacture one',async()=>{
  const f=await fixture({ageMinutes:6,extra:{embedUrl:''}});await f.tick();
  assert.equal(f.iframe,undefined);assert.match(f.status,/kaynak bulunamadı/);assert.equal(f.timers.size,0);
});
test('dispose cancels further polling and ignores a late status response',async()=>{
  const f=await fixture();f.dispose();assert.equal(f.timers.size,0);
  let resolve;const pending=new Promise(r=>{resolve=r;});
  const g=await fixture({fetchImpl:()=>pending});g.dispose();
  resolve({ok:true,json:async()=>({video:{status:3}})});await new Promise(setImmediate);
  assert.equal(g.iframe,undefined);assert.equal(g.timers.size,0);
});
test('Stream thumbnails require an explicit host or supplied thumbnail, never a library-ID guess',()=>{
  assert.equal(streamThumbnailUrl(video),'');assert.equal(mediaSources(video).poster,'');
  assert.equal(streamThumbnailUrl({...video,streamCdnHost:'https://bad.invalid'}),'');
  assert.equal(streamThumbnailUrl({...video,streamCdnHost:'vz-known.b-cdn.net'}),`https://vz-known.b-cdn.net/${video.streamVideoId}/thumbnail.jpg`);
  assert.equal(mediaSources({...video,kucukResim:'https://example.invalid/provided.jpg'}).poster,'https://example.invalid/provided.jpg');
});
test('Firebase legacy URL, query token and download source remain unchanged',()=>{
  const url='https://firebasestorage.googleapis.com/v0/b/synthetic/o/movie.mp4?alt=media&token=synthetic';
  assert.deepEqual(mediaSources({dosyaTipi:'video',url}).direct,[url]);assert.equal(downloadSource({dosyaTipi:'video',url}),url);
});
