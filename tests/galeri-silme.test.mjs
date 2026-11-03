import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { canDeleteGalleryMedia, galleryDeleteButton, removeGalleryMedia } from '../js/galeri-silme.js';
import { galleryRuntime, defer } from '../qa/galeri-onay-fixture.mjs';
const teacher=()=>({currentUser:{uid:'teacher',email:'teacher@example.test'},rol:'ogretmen',personel:{durum:'aktif'}});
const media=(id='photo')=>({id,yukleyen:'teacher@example.test',dosyaTipi:'foto',bunnyPath:'galeri/class/photo.jpg',durum:'beklemede'});
function fixture(extra={}) {
 const docs=new Map([['galeri/photo',media()]]),calls=[],state=teacher();
 const fb={doc:(_db,...parts)=>parts.join('/'),runTransaction:async(_db,fn)=>{
  const changes=[];
  const result=await fn({get:async ref=>{await extra.read?.(ref);return{exists:()=>docs.has(ref),data:()=>structuredClone(docs.get(ref))};},delete:ref=>changes.push(['delete',ref]),set:(ref,data)=>changes.push(['set',ref,data])});
  if(extra.denied)throw Error('permission-denied');
  for(const [kind,ref,data] of changes){calls.push([kind,ref]);if(kind==='delete')docs.delete(ref);else docs.set(ref,{...docs.get(ref),...data});}
  return result;
 }};
 const api={state,fb,db:{},medya:{sil:async path=>{calls.push(['storage',path]);if(extra.storageError)throw Error('storage failed');}}};
 return {api,docs,calls};
}
test('all six teacher roles can delete only their own recognized uploader identities',()=>{
 for(const rol of ['ogretmen','yardimci_ogretmen','ingilizce_ogretmeni','degerler_ogretmeni','orman_ogretmeni','brans_ogretmeni']){
  for(const key of ['yukleyen','yukleyenEmail','ekleyenEmail'])assert(canDeleteGalleryMedia({[key]:'teacher@example.test'},{...teacher(),rol}));
  assert.equal(canDeleteGalleryMedia({yukleyen:'other@example.test'},{...teacher(),rol}),false);
 }
 for(const state of [{...teacher(),rol:'veli'},{...teacher(),personel:{durum:'pasif'}},{...teacher(),personel:{durum:'aktif',aktif:false}},{...teacher(),currentUser:null}])assert.equal(canDeleteGalleryMedia(media(),state),false);
 assert.equal(canDeleteGalleryMedia({yukleyenUid:'teacher'},teacher()),false,'do not invent ownership unsupported by live rules');
});
test('management retains deletion authority; own photo button is visible on touch screens',()=>{
 for(const rol of ['mudur','kurucu_mudur','egitim_koordinator'])assert(canDeleteGalleryMedia({yukleyen:'other@example.test'},{...teacher(),rol}));
 const button=galleryDeleteButton(media(),teacher());assert.match(button,/>Sil<\/button>/);assert.doesNotMatch(button,/opacity:0|onmouseover/);
 assert.equal(galleryDeleteButton({yukleyen:'other@example.test'},teacher()),'');
});
test('fresh authorized record is deleted before calling the existing secure storage API',async()=>{
 const f=fixture();const r=await removeGalleryMedia('photo',f.api);
 assert.equal(r.removed,true);assert.deepEqual(f.calls,[['delete','galeri/photo'],['storage','galeri/class/photo.jpg']]);assert.deepEqual(r.warnings,[]);
 assert.equal((await removeGalleryMedia('photo',f.api)).missing,true);assert.equal(f.calls.length,2);
});
test('other ownership, permission denial and session switch never delete the physical file',async()=>{
 const f=fixture();f.docs.set('galeri/photo',{...media(),yukleyen:'other@example.test'});await assert.rejects(removeGalleryMedia('photo',f.api),/kendi/);assert.deepEqual(f.calls,[]);
 const denied=fixture({denied:true});await assert.rejects(removeGalleryMedia('photo',denied.api),/permission/);assert.deepEqual(denied.calls,[]);assert(denied.docs.has('galeri/photo'));
 let switched;switched=fixture({read:()=>{switched.api.state.currentUser={uid:'other',email:'other@example.test'};}});await assert.rejects(removeGalleryMedia('photo',switched.api),/Oturum/);assert.deepEqual(switched.calls,[]);
});
test('storage failure is distinguished from successful gallery removal',async()=>{
 const f=fixture({storageError:true});const r=await removeGalleryMedia('photo',f.api);
 assert.equal(r.removed,true);assert.equal(f.docs.has('galeri/photo'),false);assert.match(r.warnings.join(' '),/depodan temizlenmesi tamamlanamadı/);
});
test('education removal clears only this photo while preserving milestones, text and newer photos',async()=>{
 const f=fixture(),key='area__group__lesson';f.docs.set('galeri/photo',{...media(),ogrenciId:'child',program:'montessori',kazanimAnahtari:key});
 const detail={galeriId:'new-photo',fotoUrl:'new.jpg',durum:'U',not:'keep observation',asamalar:{S:{galeriId:'photo',fotoUrl:'old.jpg',not:'keep early note',durum:'S'},U:{galeriId:'new-photo',fotoUrl:'new.jpg',durum:'U'}}};
 f.docs.set('ogrenciGelisim/child',{montessori:{kayitlar:{[key]:'U'},tarihler:{[key]:'2026-11-03'},detay:{[key]:detail}},sonGozlem:{galeriId:'new-photo',fotoUrl:'new.jpg'}});
 await removeGalleryMedia('photo',f.api);const saved=f.docs.get('ogrenciGelisim/child');
 assert.equal(saved.montessori.detay[key].asamalar.S.fotoUrl,'');assert.equal(saved.montessori.detay[key].asamalar.S.not,'keep early note');assert.equal(saved.montessori.kayitlar[key],'U');assert.equal(saved.montessori.detay[key].fotoUrl,'new.jpg');assert.equal(saved.sonGozlem.fotoUrl,'new.jpg');
});
test('gallery cards expose deletion only for teacher-owned media',async()=>{
 const r=galleryRuntime({state:teacher(),rows:[{...media(),bunnyUrl:'https://example.test/a.jpg'},{...media('other'),yukleyen:'other@example.test'}]});await r.render();
 assert.equal((r.html().match(/class="galeri-sil-btn"/g)||[]).length,1);assert.match(r.html(),/silGaleriOge\(&quot;photo&quot;\)/);assert.doesNotMatch(r.html(),/silGaleriOge\(&quot;other/);
});
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a);return html.slice(a,b);}
export function uploadFixture(){
 const revoked=[],removed=[],nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',disabled:false,value:''});return nodes.get(id);};
 const context={document:{getElementById:node},URL:{createObjectURL:file=>'blob:'+file.name,revokeObjectURL:url=>revoked.push(url)},classifyGalleryFile:file=>({kind:file.type.startsWith('image/')?'foto':'video'}),validateStreamVideo:()=>({ok:true}),escapeHtml:x=>String(x).replaceAll('<','&lt;'),showToast(){},silGaleriOge:async id=>{removed.push(id);return true;}};context.window=context;
 vm.createContext(context);vm.runInContext(`let galeriSecilenDosyalar=[];let galeriYuklemeCalisiyor=false;const galeriYuklenenDosyalar=new Map(),galeriOnizlemeAdresleri=new Map();\n${section('window.galeriDosyalarSecildi = function(e)', '// YÜKLE\n')}\nthis.fixture={add:galeriDosyalarEkle,files:()=>galeriSecilenDosyalar,save:(f,id)=>{galeriYuklenenDosyalar.set(f,{id});renderGaleriSecilenDosyalar();},busy:value=>{galeriYuklemeCalisiyor=value;renderGaleriSecilenDosyalar();}}`,context);
 return {...context.fixture,window:context,node,revoked,removed};
}
test('selection shows image previews and removes the correct file without any server deletion',()=>{
 const r=uploadFixture(),a={name:'a.jpg',type:'image/jpeg',size:100},b={name:'b.jpg',type:'image/jpeg',size:100};r.add([a,b]);
 assert.match(r.node('galeriSecilenDosyalar').innerHTML,/blob:a.jpg/);assert.match(r.node('galeriSecilenDosyalar').innerHTML,/Listeden çıkar/);
 r.window.galeriDosyaKaldir(0);assert.deepEqual(Array.from(r.files()),[b]);assert.deepEqual(r.revoked,['blob:a.jpg']);assert.deepEqual(r.removed,[]);
 r.window.galeriDosyaKaldir(-1);assert.equal(r.files().length,1);
});
test('completed upload uses actual gallery deletion then removes its selection row',async()=>{
 const r=uploadFixture(),f={name:'saved.jpg',type:'image/jpeg',size:100};r.add([f]);r.save(f,'saved-id');assert.match(r.node('galeriSecilenDosyalar').innerHTML,/Galeriden sil/);
 await r.window.galeriYuklenenDosyaSil(0);assert.deepEqual(r.removed,['saved-id']);assert.equal(r.files().length,0);
});
test('busy upload cannot have its queue changed, and rejected deletion retains the selected row',async()=>{
 const r=uploadFixture(),f={name:'saved.jpg',type:'image/jpeg',size:100};r.add([f]);r.busy(true);r.window.galeriDosyaKaldir(0);r.add([{...f,name:'new.jpg'}]);assert.equal(r.files().length,1);assert.match(r.node('galeriSecilenDosyalar').innerHTML,/disabled/);
 r.busy(false);r.save(f,'id');r.window.silGaleriOge=async()=>false;await r.window.galeriYuklenenDosyaSil(0);assert.equal(r.files().length,1);
});
test('file input resets so a removed file can be selected again',()=>{
 const r=uploadFixture(),input={files:[{name:'a.jpg',type:'image/jpeg',size:10}],value:'a.jpg'};r.window.galeriDosyalarSecildi({target:input});assert.equal(input.value,'');
});
test('active delete handler coalesces duplicate clicks, refreshes gallery and sends no notifications',async()=>{
 const gate=defer();let confirmations=0;
 const r=galleryRuntime({state:teacher(),rows:[media()],confirm:()=>{confirmations++;return true;},storage:()=>gate.promise});
 await r.render();const first=r.window.silGaleriOge('photo'),second=r.window.silGaleriOge('photo');
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(confirmations,1);assert.equal(r.calls.writes.length,1);assert.equal(r.calls.storage.length,1);
 gate.resolve();assert.equal(await first,true);assert.equal(await second,true);assert.equal(r.read().items.length,0);assert.deepEqual(r.calls.notices,[]);
});
test('active handler cancellation or unauthorized teacher never reaches deletion',async()=>{
 const canceled=galleryRuntime({state:teacher(),rows:[media()],confirm:()=>false});assert.equal(await canceled.window.silGaleriOge('photo'),false);assert.equal(canceled.calls.writes.length,0);
 const other=galleryRuntime({state:teacher(),rows:[{...media(),yukleyen:'other@example.test'}],confirm:()=>{throw Error('must not ask');}});assert.equal(await other.window.silGaleriOge('photo'),false);assert.equal(other.calls.storage.length,0);assert.equal(other.calls.writes.length,0);
});
test('ownership is checked again inside the delete transaction after the confirmation read',async()=>{
 let reads=0;const r=galleryRuntime({state:teacher(),rows:[media()],getMedia:()=>++reads===1?media():{...media(),yukleyen:'other@example.test'}});
 assert.equal(await r.window.silGaleriOge('photo'),false);assert.equal(r.calls.writes.length,0);assert.equal(r.calls.storage.length,0);
});
test('logout discards photo selections, preview URLs, and the upload modal',()=>{
 const r=galleryRuntime({state:teacher()});vm.runInContext("galeriSecilenDosyalar.push({name:'private.jpg'});galeriYuklenenDosyalar.set(galeriSecilenDosyalar[0],{id:'private'});galeriOnizlemeAdresleri.set(galeriSecilenDosyalar[0],'blob:private')",r.window);
 r.stop();assert.equal(vm.runInContext('galeriSecilenDosyalar.length + galeriYuklenenDosyalar.size + galeriOnizlemeAdresleri.size',r.window),0);
});
