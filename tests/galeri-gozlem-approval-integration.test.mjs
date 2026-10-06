import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {gallerySession} from '../js/galeri-onay-canli.js';
import {FakeElement,defer} from '../qa/galeri-onay-fixture.mjs';
const source=readFileSync(new URL('../moduller/ogretmen-egitim-gozlem.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export async function ','async function ').replaceAll('export function ','function ').replace("if(typeof window!=='undefined')kur();",'');
const KEY='synthetic-area__Synthetic group__Synthetic lesson';
function observationRuntime(options={}){
 const nodes=new Map(),root=new FakeElement('zegoArka'),button=new FakeElement(),progress=new FakeElement(),input=new FakeElement();nodes.set(root.id,root);root.querySelector=s=>s==='[data-act="kaydet"]'?button:s==='#zegoProgress'?progress:null;root.querySelectorAll=()=>[button,input];root.remove=()=>{nodes.delete(root.id);};
 const calls={events:[],committed:[],notices:[],parentNotices:[],toasts:[],revoked:[]},state={currentUser:{uid:'synthetic-teacher',email:'synthetic-teacher@example.test'},rol:options.role||'ogretmen',galeriOturumSurumu:1,aktifDonem:'2026-2027'};
 const pathRef=path=>({path,id:path.split('/').at(-1)});
 const BCK={db:{},rol:()=>state.rol,yoneticiMi:()=>false,kullanici:()=>state.currentUser,personel:()=>({ad:'Synthetic',soyad:'Teacher'}),
 collection:(_db,...parts)=>parts.join('/'),doc:(...args)=>args.length===1?pathRef(args[0]+'/synthetic-gallery-id'):pathRef(args.slice(1).join('/')),serverTimestamp:()=>({synthetic:true}),
 resimSikistir:async file=>{calls.events.push('compress');await options.compress?.();return file;},medyaYukle:async()=>{calls.events.push('upload');await options.upload?.();return{url:'https://synthetic-media.test/observation.jpg',yol:'synthetic/media.jpg'};},
 setDoc:async(ref,data)=>{calls.events.push('parent-notice-save');calls.parentNotices.push({ref,data});},
 runTransaction:async(_db,run)=>{calls.events.push('transaction-start');const staged=[];await run({get:async()=>{await options.transactionRead?.();return{exists:()=>false,data:()=>({})};},set:(ref,data,merge)=>{calls.events.push('transaction-stage:'+ref.path);staged.push({ref,data,merge});}});await options.beforeCommit?.();if(options.failCommit)throw Error('synthetic transaction rejected');calls.committed.push(...staged);calls.events.push('transaction-commit');await options.afterCommit?.();}};
 const context={gallerySession,console:{error(){},warn(){}},URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL:u=>calls.revoked.push(u)},Image:class{set src(_x){queueMicrotask(()=>this.onerror?.(Error('synthetic image decoder not needed')));}},setTimeout:()=>0,
 document:{getElementById:id=>nodes.get(id)||null,createElement:()=>new FakeElement()},
 BCK,PortalAPI:{state},showToast:(message,type)=>calls.toasts.push({message,type}),
 notifyGalleryApproval:async item=>{calls.events.push('approval-notice');assert.equal(calls.committed.filter(x=>['galeri/synthetic-gallery-id','ogrenciGelisim/synthetic-child'].includes(x.ref.path)).length,2,'both gallery and observation must already be committed before approval notice');calls.notices.push(item);return options.notify?await options.notify():{ok:true,push:{ok:true}};},
 hedefVeliEmailleri:()=>['synthetic-parent@example.test'],bildirimKaydetVePush:async()=>{calls.events.push('parent-push');return{ok:true,push:{ok:true}};}};
 context.window=context;vm.createContext(context);vm.runInContext(source+'\nglobalThis.fixture={save:kaydet,close:kapat,read:()=>S,initialize:x=>S=x};',context);
 context.fixture.initialize({ogrId:'synthetic-child',ogrAd:'Synthetic Child',sinif:'Synthetic Class',program:'montessori',alanlar:[{id:'synthetic-area',ad:'Synthetic area',gruplar:[{ad:'Synthetic group',dersler:['Synthetic lesson']}]}],alanIdx:0,grupIdx:0,dersIdx:0,durum:'S',not:'Synthetic observation',foto:options.photo===false?null:{synthetic:true},fotoOniz:options.photo===false?'':'blob:preview'});
 return {...context.fixture,calls,state,nodes,root,button,input,progress,switchAccount:()=>{state.currentUser={uid:'synthetic-other',email:'other@example.test'};state.galeriOturumSurumu++;}};
}
test('actual teacher save commits gallery + observation atomically before one approval notice, with no early parent notice',async()=>{
 const r=observationRuntime();await r.save();assert.deepEqual(r.calls.events,['compress','upload','transaction-start','transaction-stage:galeri/synthetic-gallery-id','transaction-stage:ogrenciGelisim/synthetic-child','transaction-commit','approval-notice']);
 const gallery=r.calls.committed.find(x=>x.ref.path.startsWith('galeri/')).data,observation=r.calls.committed.find(x=>x.ref.path.startsWith('ogrenciGelisim/')).data;
 assert.equal(gallery.durum,'beklemede');assert.equal(observation.montessori.detay[KEY].asamalar.S.galeriId,'synthetic-gallery-id');assert.equal(observation.montessori.detay[KEY].asamalar.S.fotoUrl,'');assert.equal(observation.sonGozlem.fotoDurum,'beklemede');assert.deepEqual(r.calls.parentNotices,[]);assert.equal(r.calls.notices.length,1);assert.equal(r.read(),null);assert(!r.nodes.has('zegoArka'));
});
test('failed observation transaction commits neither record, sends no notice, and leaves retry enabled',async()=>{
 const r=observationRuntime({failCommit:true});await r.save();assert.deepEqual(r.calls.committed,[]);assert.deepEqual(r.calls.notices,[]);assert.deepEqual(r.calls.parentNotices,[]);assert.equal(r.button.disabled,false);assert.equal(r.input.disabled,false);assert.equal(r.read().kaydediliyor,false);assert.match(r.calls.toasts[0].message,/kaydedilemedi/);assert(r.nodes.has('zegoArka'));
});
test('failed image upload has no database writes or notifications',async()=>{
 const r=observationRuntime({upload:()=>Promise.reject(Error('synthetic upload rejected'))});await r.save();assert.deepEqual(r.calls.committed,[]);assert.deepEqual(r.calls.notices,[]);assert(!r.calls.events.includes('transaction-start'));assert.equal(r.button.disabled,false);
});
for(const role of ['egitim_koordinator','mudur','kurucu_mudur'])test(`actual ${role} observation keeps autoapproved publishing and skips approval request`,async()=>{
 const r=observationRuntime({role});await r.save();assert.deepEqual(r.calls.notices,[]);assert.equal(r.calls.committed[0].data.durum,'onaylandi');assert.equal(r.calls.committed[1].data.sonGozlem.fotoUrl,'https://synthetic-media.test/observation.jpg');assert.equal(r.calls.parentNotices.length,1);assert.equal(r.calls.parentNotices[0].data.galeriId,'synthetic-gallery-id');assert(r.calls.events.indexOf('transaction-commit')<r.calls.events.indexOf('parent-notice-save'));
});
test('text-only observation retains its parent notification and does not create gallery or approval items',async()=>{
 const r=observationRuntime({photo:false});await r.save();assert.equal(r.calls.committed.length,1);assert.equal(r.calls.committed[0].ref.path,'ogrenciGelisim/synthetic-child');assert.equal(r.calls.parentNotices.length,1);assert.deepEqual(r.calls.notices,[]);assert(!r.calls.events.includes('upload'));
});
test('repeated save and close while upload is pending cannot duplicate or dismiss the active save',async()=>{
 const gate=defer();let reached;const entered=new Promise(resolve=>reached=resolve);const r=observationRuntime({upload:()=>{reached();return gate.promise;}});const first=r.save();await entered;await r.save();r.close();assert(r.read().kaydediliyor);assert(r.nodes.has('zegoArka'));assert.equal(r.calls.events.filter(x=>x==='upload').length,1);gate.resolve();await first;assert.equal(r.calls.notices.length,1);assert.equal(r.calls.committed.length,2);
});
for(const at of ['upload','transactionRead','afterCommit'])test(`account switch during ${at} suppresses stale notice and cleans original observation modal`,async()=>{
 const gate=defer();let reached;const entered=new Promise(r=>reached=r);const r=observationRuntime({[at]:()=>{reached();return gate.promise;}});const pending=r.save();await entered;r.switchAccount();gate.resolve();await pending;
 assert.deepEqual(r.calls.notices,[]);assert.deepEqual(r.calls.parentNotices,[]);assert.equal(r.read(),null);assert(!r.nodes.has('zegoArka'));assert(r.calls.revoked.includes('blob:preview'));assert.equal(r.calls.committed.length,at==='afterCommit'?2:0);
});
test('approval transport failure warns after successful save, without rolling back committed observation',async()=>{
 const r=observationRuntime({notify:()=>Promise.reject(Error('synthetic notify rejected'))});await r.save();assert.equal(r.calls.committed.length,2);assert.equal(r.calls.toasts.at(-1).type,'warning');assert.match(r.calls.toasts.at(-1).message,/yönetici onay bildirimi tam iletilemedi/);assert.equal(r.read(),null);
});
