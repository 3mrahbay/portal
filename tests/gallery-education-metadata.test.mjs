import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as metadata from '../js/galeri-gozlem-metadata.js';
import {gallerySession} from '../js/galeri-onay-canli.js';
import {FakeElement, defer} from '../qa/galeri-onay-fixture.mjs';
const legacy={id:'old',hedefTur:'ogrenci',hedefDeger:'child',program:'montessori',egitimKaydi:true,kazanimAnahtari:'practical__Care__Shoe__polishing',yukleyen:'TEACHER@example.test',yukleyenAd:'teacher@example.test',donem:'2026-2027'};
const sources={student:{ogrenciAdSoyad:'Synthetic Child',sinif:'Class B'},settings:{kayit:{sinif:'Class A'}},personnel:{adSoyad:'Synthetic Teacher',rol:'ogretmen'},areas:[{id:'practical',ad:'Practical Life'}],currentPeriod:'2026-2027'};
test('sparse legacy metadata resolves real labels and preserves individual target fields',()=>{
 const before=structuredClone(legacy),m=metadata.galleryEducationMetadata(legacy,sources);
 assert.equal(m.sinifAdi,'Class A');assert.equal(m.alanAd,'Practical Life');assert.equal(m.grupAd,'Care');assert.equal(m.kazanimAdi,'Shoe__polishing');assert.equal(m.yukleyenAd,'Synthetic Teacher');assert.equal(m.yukleyenRol,'ogretmen');assert.equal(m.hedefDeger,'child');assert.equal(m.hedefTur,'ogrenci');assert.equal(m.sinif,undefined);assert.deepEqual(legacy,before);
});
test('stored display snapshots win and curriculum group is never used as a class',()=>{
 const m=metadata.galleryEducationMetadata({...legacy,sinifAdi:'Historic Class',alanAd:'Historic Area',grupAd:'Historic Group',yukleyenAd:'Historic Teacher'},sources);
 assert.equal(m.sinifAdi,'Historic Class');assert.equal(m.alanAd,'Historic Area');assert.equal(m.grupAd,'Historic Group');assert.equal(m.yukleyenAd,'Historic Teacher');
 assert.equal(metadata.galleryEducationMetadata({grupAd:'Not a classroom'}).sinifAdi,'');
});
test('historical media never falls back to the child current class',()=>{
 assert.equal(metadata.galleryEducationMetadata({...legacy,donem:'2025-2026'},{student:sources.student,currentPeriod:'2026-2027'}).sinifAdi,'');
});
test('missing identity stays unknown; email/generic labels cannot become a full name',()=>{
 for(const name of ['teacher@example.test','—','-','Öğretmen','Okul Personeli'])assert.equal(metadata.galleryPersonName(name),'');
 assert.equal(metadata.galleryEducationMetadata(legacy).yukleyenAd,'');
 assert.equal(metadata.galleryEducationMetadata(legacy).yukleyenRol,'');
 assert.equal(metadata.galleryPersonName('teacher@example.test','Ada Lovelace'),'Ada Lovelace');
});
test('only the observation stage attached to this exact gallery image hydrates a missing stage',()=>{
 const observation={montessori:{detay:{[legacy.kazanimAnahtari]:{galeriId:'newer',durum:'U',asamalar:{S:{galeriId:'old'},U:{galeriId:'newer'}}}}}};
 assert.equal(metadata.galleryEducationMetadata(legacy,{observation}).gozlemDurum,'S');
 assert.equal(metadata.galleryEducationMetadata({...legacy,id:'unrelated'},{observation}).gozlemDurum,'');
});
function readFixture(records,options={}){const reads=[];return{reads,fb:{doc:(_db,...path)=>path.join('/'),getDoc:async path=>{reads.push(path);await options.beforeRead?.(path);if(options.denied)throw Error('permission-denied');return{exists:()=>path in records,data:()=>records[path]};}},db:{}};}
test('hydration uses bounded exact reads for original sender, student, period, curriculum and observation',async()=>{
 const f=readFixture({'personeller/teacher@example.test':sources.personnel,'ogrenciler/child':sources.student,'ogrenciler/child/donemler/2026-2027':sources.settings,'mufredatlar/montessori':{alanlar:sources.areas}});
 const m=await metadata.hydrateGalleryEducationMetadata(legacy,{...f,state:{aktifDonem:'2026-2027',currentUser:{email:'viewer@example.test'}}});
 assert.equal(m.yukleyenAd,'Synthetic Teacher');assert.equal(m.sinifAdi,'Class A');assert.equal(m.alanAd,'Practical Life');assert.deepEqual(f.reads.sort(),['mufredatlar/montessori','ogrenciGelisim/child','ogrenciler/child','ogrenciler/child/donemler/2026-2027','personeller/teacher@example.test'].sort());
});
test('old period reads its own enrollment and skips current settings cache',async()=>{
 const f=readFixture({'ogrenciler/child/donemler/2025-2026':{kayit:{sinif:'Old class'}}});
 const m=await metadata.hydrateGalleryEducationMetadata({...legacy,donem:'2025-2026'},{...f,state:{aktifDonem:'2026-2027',ayarListesi:{child:{kayit:{sinif:'New class'}}},ogrenciList:[{id:'child',sinif:'New class'}]}});
 assert.equal(m.sinifAdi,'Old class');assert(f.reads.includes('ogrenciler/child/donemler/2025-2026'));
});
test('denied reads stay safe and do not fall back to a directory scan or viewer identity',async()=>{
 const f=readFixture({}, {denied:true});const m=await metadata.hydrateGalleryEducationMetadata(legacy,{...f,state:{personel:{adSoyad:'Viewer Name',rol:'mudur'}}});
 assert.equal(m.yukleyenAd,'');assert.equal(m.yukleyenRol,'');assert.equal(m.sinifAdi,'');assert.equal(f.reads.length,5);
});
test('session invalidation discards all in-flight hydration output',async()=>{
 const gate=defer();let current=true;const f=readFixture({'personeller/teacher@example.test':sources.personnel},{beforeRead:()=>gate.promise});
 const pending=metadata.hydrateGalleryEducationMetadata(legacy,{...f,isCurrent:()=>current});current=false;gate.resolve();assert.equal(await pending,null);
});
const bridge=fs.readFileSync(new URL('../js/zeky-galeri-onay-egitim.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','').replace("if(typeof window!=='undefined')kur();",'');
function uiFixture(){
 const reads=[],timers=[],box=new FakeElement(),container=new FakeElement();container.childNodes=[];
 const host=new FakeElement(),buttons=[new FakeElement(),new FakeElement()];let rendered='',replacements=0;
 const aside=html=>({html,replaceWith:other=>{rendered=other.html;replacements++;}});
 Object.defineProperty(container,'innerHTML',{get:()=>rendered,set:html=>{rendered=html;container.aside=aside(html);}});
 container.querySelector=selector=>selector==='.zgo-detay'?container.aside:selector==='[data-pg-lightbox-media-host]'||selector==='.zgo-medya'?host:selector==='[data-zgo-onay]'?buttons[0]:selector==='[data-zgo-red]'?buttons[1]:null;
 const state={currentUser:{uid:'viewer',email:'viewer@example.test'},rol:'mudur',isAdmin:true,galeriOturumSurumu:1};
 const context={...metadata,gallerySession,console,setTimeout:fn=>timers.push(fn),clearTimeout(){},
 hydrateGalleryEducationMetadata:()=>{const d=defer();reads.push(d);return d.promise;},
 document:{getElementById:id=>id==='galeriLightbox'?box:id==='galeriLightboxIcerik'?container:null,createElement:()=>({set innerHTML(html){this.firstElementChild=aside(html);}})},
 PortalAPI:{state},galeriListesiVerisi:[legacy,{...legacy,id:'second'}],
 acGaleriLightbox:()=>{box.classList.add('active');container.aside=null;},closeGaleriLightbox:()=>box.classList.remove('active')};context.window=context;
 vm.createContext(context);vm.runInContext(bridge+'\nfonksiyonlariSar();',context);
 return{context,state,reads,open:id=>{context.acGaleriLightbox(id);timers.shift()();},html:()=>rendered,replacements:()=>replacements};
}
for(const action of ['close','navigate','reopen','account'])test(`slow metadata cannot repaint after ${action}`,async()=>{
 const f=uiFixture();f.open('old');assert.equal(f.reads.length,1);
 if(action==='close')f.context.closeGaleriLightbox();
 if(action==='navigate')f.open('second');
 if(action==='reopen'){f.context.closeGaleriLightbox();f.open('old');}
 if(action==='account'){f.state.currentUser={uid:'other',email:'other@example.test'};f.state.galeriOturumSurumu++;}
 f.reads[0].resolve({...legacy,yukleyenAd:'Old result'});await Promise.resolve();await Promise.resolve();assert.equal(f.replacements(),0);assert(!f.html().includes('Old result'));
});
test('active metadata refresh replaces details once and escapes sender HTML',async()=>{
 const f=uiFixture();f.open('old');f.reads[0].resolve({...legacy,yukleyenAd:'<Teacher Name>',sinifAdi:'Class A'});await Promise.resolve();await Promise.resolve();assert.equal(f.replacements(),1);assert(f.html().includes('&lt;Teacher Name&gt;'));assert(!f.html().includes('teacher@example.test'));assert(f.html().includes('Class A'));
});
test('contradictory aliases cannot read metadata belonging to an arbitrary child or sender',async()=>{
 assert.equal(metadata.galleryStudentId({hedefTur:'cocuk',hedefDeger:'child'}),'child');
 assert.equal(metadata.galleryStudentId({...legacy,ogrenciId:'other'}),'');
 assert.equal(metadata.gallerySenderEmail({...legacy,yukleyenEmail:'other@example.test'}),'');
 const f=readFixture({});await metadata.hydrateGalleryEducationMetadata({...legacy,ogrenciId:'other',yukleyenEmail:'other@example.test'},f);
 assert.deepEqual(f.reads,['mufredatlar/montessori']);
});
test('malformed curriculum cannot prevent safe student and personnel labels',()=>{
 const m=metadata.galleryEducationMetadata(legacy,{...sources,areas:{unexpected:true}});
 assert.equal(m.alanAd,'');assert.equal(m.yukleyenAd,'Synthetic Teacher');assert.equal(m.sinifAdi,'Class A');
});
test('the active inline Portal producer writes selected labels, sender and class fallback',async()=>{
 const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),start=index.indexOf('async function caGozlemFotoYukle('),end=index.indexOf('\nasync function caGozlemDetayKaydet',start),writes=[];
 const c={caGozlemFiligranliDosya:async()=>({size:10,name:'synthetic.jpg'}),medyaYukle:async()=>({url:'https://example.invalid/photo.jpg'}),isAdmin:false,aktifKullaniciRol:'ogretmen',aktifPersonel:{ad:'Synthetic',soyad:'Teacher'},currentUser:{uid:'teacher',email:'teacher@example.test'},AKTIF_DONEM:'2026-2027',ayarListesi:{child:{kayit:{sinif:'Canonical class'}}},ogrenciList:[{id:'child',sinif:'Legacy class'}],caGozlemProgramAdi:()=> 'Montessori',doc:()=>({id:'gallery'}),collection:()=>({}),db:{},setDoc:async(_ref,value)=>writes.push(value)};
 vm.createContext(c);vm.runInContext(index.slice(start,end),c);await c.caGozlemFotoYukle({foto:{},ogrId:'child',ogrAd:'Synthetic Child',disiplin:'montessori',seviye:'T'},legacy.kazanimAnahtari,'Shoe polishing','note',{id:'practical',ad:'Practical Life'},{ad:'Care'});
 const m=writes[0];assert.equal(m.sinifAdi,'Canonical class');assert.equal(m.sinif,'');assert.equal(m.alanAd,'Practical Life');assert.equal(m.grupAd,'Care');assert.equal(m.yukleyenAd,'Synthetic Teacher');assert.equal(m.yukleyenRol,'ogretmen');assert.equal(m.hedefTur,'ogrenci');assert.equal(m.hedefDeger,'child');assert.equal(m.yukleyenUid,'teacher');
});
test('supported legacy program display labels use the canonical curriculum and stage paths',async()=>{
 for(const [label,code] of [['Montessori','montessori'],['Orman Okulu','orman'],['Değerler Eğitimi','degerler'],['İngilizce Eğitimi','ingilizce'],['Değerler+','degerlerPlus']]){
  const f=readFixture({['mufredatlar/'+code]:{alanlar:sources.areas},'ogrenciGelisim/child':{[code]:{detay:{[legacy.kazanimAnahtari]:{asamalar:{T:{galeriId:'old'}}}}}}});
  const m=await metadata.hydrateGalleryEducationMetadata({...legacy,program:label},f);assert.equal(m.alanAd,'Practical Life');assert.equal(m.gozlemDurum,'T');assert(f.reads.includes('mufredatlar/'+code));
 }
});
