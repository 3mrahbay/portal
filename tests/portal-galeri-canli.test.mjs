import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mediaSources, isPlayerUrl, playerUrl, downloadSource, renderMedia } from '../js/portal-galeri-medya.js';
import { createInteractionService, interactionPatch, targetChild, displayName, emailHash } from '../js/portal-galeri-etkilesim.js';
import { saveBlob, fetchMediaBlob } from '../js/portal-galeri-canli.js';
import {installedPwa,assertPrecachedImport} from './helpers/portal-pwa.mjs';
const url = 'https://firebasestorage.googleapis.com/v0/b/example/o/video.mp4?alt=media&token=synthetic';
const media = {id:'m', durum:'onaylandi', dosyaTipi:'video', url, hedefTur:'ogrenci', hedefDeger:'child'};
class Element {
  constructor(tag, ownerDocument) { this.tagName=tag.toUpperCase();this.ownerDocument=ownerDocument;this.children=[];this.style={};this.events={};this.hidden=false;this.attributes={}; }
  get parentNode(){return this.parent;}
  append(...items){for(const item of items){item.remove();item.parent=this;this.children.push(item);}}
  prepend(item){item.remove();item.parent=this;this.children.unshift(item);}
  replaceChildren(...items){for(const item of this.children)item.parent=null;this.children=[];this.append(...items);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  removeAttribute(key){delete this.attributes[key];if(key==='src')this.src='';}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(name,fn){(this.events[name] ||= []).push(fn);}
  fire(name){for(const fn of this.events[name]||[])fn();}
  pause(){this.paused=true;}
  load(){this.loaded=true;}
}
function host(){const document={createElement:tag=>new Element(tag,document)};return new Element('div',document);}
test('direct Firebase URL preserves token/query and uses video; embed only exact player hosts',()=>{
 assert.deepEqual(mediaSources(media).direct,[url]);assert.equal(downloadSource(media),url);
 assert.equal(isPlayerUrl(url),false);assert.equal(isPlayerUrl('https://iframe.mediadelivery.net.evil.invalid/x'),false);
 assert.equal(isPlayerUrl('https://iframe.mediadelivery.net/embed/1/2'),true);
 const embed=playerUrl('https://iframe.mediadelivery.net/embed/1/2?token=synthetic&autoplay=true');
 assert.equal(new URL(embed).searchParams.get('token'),'synthetic');assert.equal(new URL(embed).searchParams.get('autoplay'),'false');
 assert.deepEqual(mediaSources({url:'javascript:alert(1)',bunnyUrl:'https://u:p@example.invalid/v'}).direct,[]);
});
test('JPEG cover uses image and failed cover falls back to actual video, never cover as source',()=>{
 const h=host();renderMedia(h,{...media,kucukResim:'https://example.invalid/cover.jpg'},{thumbnail:true});
 assert.equal(h.children[0].tagName,'IMG');h.children[0].fire('error');
 const v=h.children.find(x=>x.tagName==='VIDEO');assert.equal(v.src,url);assert.equal(v.muted,true);assert.equal(v.controls,false);
 v.duration=4;v.fire('loadedmetadata');assert.equal(v.currentTime,.12);
});
test('direct player error becomes visible and retry works; disposal releases video',()=>{
 const h=host();const dispose=renderMedia(h,media);const v=h.children.find(x=>x.tagName==='VIDEO');
 assert.equal(v.controls,true);assert.equal(v.playsInline,true);assert.equal(h.children.some(x=>x.tagName==='IFRAME'),false);
 v.fire('loadeddata');assert.equal(h.children.find(x=>x.className==='pg-media-status').hidden,true);
 v.fire('error');const status=h.children.find(x=>x.className==='pg-media-status');assert.equal(status.hidden,false);assert.match(status.textContent,/oynatılamadı/);
 status.children[0].fire('click');assert.notEqual(h.children.find(x=>x.tagName==='VIDEO'),v);
 dispose();assert.equal(h.children.find(x=>x.tagName==='VIDEO').src,'');
});
test('native save completion versus anchor initiation is truthful, save failure never completes',async()=>{
 const blob=new Blob(['synthetic'],{type:'video/mp4'});let clicks=0,closed=0;
 const win={URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}},setTimeout(){},document:{createElement:()=>({remove(){},click(){clicks++;}}),body:{append(){}}}};
 assert.equal(await saveBlob(blob,'video.mp4',{win}),false);assert.equal(clicks,1);
 assert.equal(await saveBlob(blob,'video.mp4',{win,handle:{createWritable:async()=>({write:async()=>{},close:async()=>{closed++;}})}}),true);assert.equal(closed,1);
 await assert.rejects(saveBlob(blob,'video.mp4',{win,handle:{createWritable:async()=>({write:async()=>{throw Error('full')},abort:async()=>{}})}}),/full/);
});
test('HTML error payload and missing downloadable source cannot masquerade as downloaded video',async()=>{
 await assert.rejects(fetchMediaBlob(media,{fetch:async()=>({ok:true,blob:async()=>new Blob(['error'],{type:'text/html'})})}),/alınamadı/);
 await assert.rejects(fetchMediaBlob({...media,url:'https://iframe.mediadelivery.net/embed/1/2'},{fetch:()=>{throw Error('must not fetch')}}),/indirilebilir/);
});
function serviceFixture(role='veli') {
 let data={},writes=[],reads=[],state={rol:role,currentUser:{uid:'u',email:'parent@example.invalid'},veliOgrenciler:[{id:'child',sinif:'Mimoza'}],ogrenciList:[{id:'child',ogrenciAdSoyad:'Synthetic Child'}],ayarListesi:{}};
 const fb={doc:(_,...path)=>path.join('/'),collection:(_,...path)=>path.join('/'),
 runTransaction:async(_,fn)=>fn({get:async ref=>({exists:()=>!!Object.keys(data).length,data:()=>data}),set:(ref,value)=>{data={...data,...value};writes.push({ref,value});}}),
 getDocs:async ref=>{reads.push(ref);return {docs:[]};}};
 const api={db:{},fb,get state(){return state},ogrenciDurum:()=> 'aktif'};
 return {service:createInteractionService(()=>api),api,fb,writes,reads,get data(){return data},setState:s=>state=s};
}
test('explicit approved parent opens preserve first time and increment existing schema transactionally',async()=>{
 const f=serviceFixture();assert.equal(await f.service.record(media,'acma'),true);const first=f.data.ilkAcma;
 await f.service.record(media,'acma');assert.equal(f.data.acmaSayisi,2);assert.equal(f.data.ilkAcma,first);
 assert.equal(f.data.veliUid,'u');assert.equal(f.data.veliEmailHash.length,64);assert.equal(f.writes[0].ref,'galeri/m/etkilesimler/u');
 assert.equal('email' in f.data,false);assert.equal('eposta' in f.data,false);
 await f.service.record(media,'indirme',false);assert.equal(f.data.indirildi,false);
 await f.service.record(media,'indirme',true);assert.equal(f.data.indirildi,true);assert.equal(f.data.indirmeSayisi,2);
});
test('pending/rejected media, another child and staff never create parent interactions',async()=>{
 for(const role of ['ogretmen','mudur','egitim_koordinator']){const f=serviceFixture(role);assert.equal(await f.service.record(media,'acma'),false);assert.equal(f.writes.length,0);}
 const f=serviceFixture();for(const patch of [{durum:'beklemede'},{durum:'reddedildi'},{hedefDeger:'other'},{hedefTur:'unknown'}])assert.equal(await f.service.record({...media,...patch},'acma'),false);
 assert.equal(f.writes.length,0);assert.equal(targetChild({...media,hedefTur:'sinif',hedefDeger:'Other'},[{id:'child',sinif:'Mimoza'}]),null);
});
test('report role guard precedes all collection reads; denied reads propagate instead of zero count',async()=>{
 const parent=serviceFixture();await assert.rejects(parent.service.report(media),/yalnızca/);assert.equal(parent.reads.length,0);
 const teacher=serviceFixture('ogretmen');await assert.rejects(teacher.service.report(media),/yalnızca/);
 const admin=serviceFixture('mudur');admin.fb.getDocs=async()=>{throw Error('permission-denied')};await assert.rejects(admin.service.report(media),/permission-denied/);
});
test('report matches only approved target accounts and combines UID histories without leaking contact fields',async()=>{
 const f=serviceFixture('mudur');const hash=await emailHash('parent@example.invalid');
 f.fb.getDocs=async ref=>({docs:ref==='veliler' ? [
 {id:'parent@example.invalid',data:()=>({onaylandi:true,adSoyad:'parent@example.invalid',ogrenciIds:['child']})},
 {id:'other@example.invalid',data:()=>({onaylandi:true,adSoyad:'Other',ogrenciIds:['other']})},
 {id:'pending@example.invalid',data:()=>({onaylandi:false,adSoyad:'Pending',ogrenciIds:['child']})}]
 : [{data:()=>({veliEmailHash:hash,acmaSayisi:1,sonAcma:'2026-01-01T00:00:00Z'})},{data:()=>({veliEmailHash:hash,indirmeBaslatildi:true})}]});
 const rows=await f.service.report(media);assert.equal(rows.length,1);assert.equal(rows[0].name,'Veli');assert.equal(rows[0].opened,true);assert.equal(rows[0].started,true);assert.equal(rows[0].downloaded,false);
 assert.doesNotMatch(JSON.stringify(rows),/@/);assert.equal(displayName('+90 555 111 22 33'),'Veli');
});
test('active import chain and modern parent module use shared player and analytics',async()=>{
 const bridge=await readFile(new URL('../js/zeky-galeri-filigran-koprusu.js',import.meta.url),'utf8');
 const parent=await readFile(new URL('../moduller/veli-galeri.js',import.meta.url),'utf8');
 const education=await readFile(new URL('../js/zeky-galeri-onay-egitim.js',import.meta.url),'utf8');
 assertPrecachedImport(await installedPwa(),'js/zeky-galeri-filigran-koprusu.js','js/portal-galeri-canli.js');
 assert.match(parent,/mountMedia\(d.querySelector\('\[data-vg-media\]'\),m\);recordOpen\(m\)/);
 assert.match(parent,/downloadMedia\(m,button\)/);assert.match(parent,/disposeMedia\(d\)/);
 assert.match(education,/Array\.from\(icerik.childNodes\)/);assert.match(education,/append\(\.\.\.medya\)/);
});
