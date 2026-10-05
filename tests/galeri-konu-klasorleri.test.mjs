import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GALLERY_PROGRAMS, galleryText, galleryProgram, galleryTopic, galleryTopicKey, galleryFolderKey, galleryIsObservation, galleryTopicGroups} from '../js/galeri-klasorleri.js';
import {folderDateRange, managementTopicFolders} from '../js/portal-galeri-klasor-ui.js';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const row=(extra={})=>({id:'synthetic',program:'jimnastik',etkinlikBaslik:'Denge Çalışması',hedefTur:'sinif',hedefDeger:'Test Sınıfı',donem:'2026-2027',...extra});

test('all upload programs include Jimnastik, Drama and Kodlama for the shared photo/video form',()=>{
 for(const code of ['jimnastik','drama','kodlama']) { assert.ok(GALLERY_PROGRAMS[code]);assert.match(source,new RegExp(`<option value="${code}">${GALLERY_PROGRAMS[code]}</option>`)); }
 assert.equal(galleryProgram({kategori:'Dram'}),'drama');
 assert.equal(galleryProgram({kategori:'Değerler+'}),'degerlerPlus');
});
test('same topic across repeated/new batches and dates groups mixed media without mutation',()=>{
 const input=[row({id:'1',dosyaTipi:'foto',etkinlikTarih:'2026-09-30'}),row({id:'2',dosyaTipi:'video',etkinlikBaslik:'  DENGE   ÇALIŞMASI ',etkinlikTarih:'2026-10-02'})];
 const before=JSON.stringify(input);assert.equal(galleryTopicGroups(input).length,1);assert.equal(folderDateRange(input),'30.09.2026 – 02.10.2026');assert.equal(JSON.stringify(input),before);
});
test('topic, program, audience type/value and period each keep separate folders',()=>{
 const base=row();for(const change of [{etkinlikBaslik:'Koordinasyon'},{program:'drama'},{hedefTur:'ogrenci'},{hedefDeger:'Başka Sınıf'},{donem:'2027-2028'},{donem:''}])assert.notEqual(galleryTopicKey(base),galleryTopicKey({...base,...change}));
 assert.notEqual(galleryTopicKey(row({hedefDeger:'Sınıf 1'})),galleryTopicKey(row({hedefDeger:'sinif 1'})));
});
test('punctuation, Unicode, long titles and malicious strings do not collide or become markup',()=>{
 assert.equal(galleryText('  I\u0307ki\n çocuk '),'İki çocuk');
 assert.equal(galleryTopicKey(row({etkinlikBaslik:'İki çocuk'})),galleryTopicKey(row({etkinlikBaslik:'I\u0307ki çocuk'})));
 const titles=['__proto__','a|b','a/b','a-b',"O'Brian \"robot\"",'<img src=x onerror=alert(1)>','a'.repeat(100)+'x','a'.repeat(100)+'y'];
 assert.equal(new Set(titles.map(etkinlikBaslik=>galleryTopicKey(row({etkinlikBaslik})))).size,titles.length);
});
test('historical manual child titles recover without moving true observations into topics',()=>{
 assert.equal(galleryTopic(row({baslik:'Robot Köprüsü',etkinlikBaslik:'Kodlama'})),'Robot Köprüsü');
 assert.equal(galleryTopic(row({etkinlikBaslik:'',baslik:''})),'Genel');
 const obs=row({kazanimAnahtari:'hareket__denge',alanAd:'Hareket',baslik:'Denge gözlemi'});assert.equal(galleryIsObservation(obs),true);assert.equal(galleryFolderKey(obs),'alan:hareket');
 assert.equal(managementTopicFolders([obs])[0].title,'Hareket');
 const m=row({konuAnahtari:'fake',albumId:'same'}),n=row({hedefDeger:'Other',konuAnahtari:'fake',albumId:'same'});assert.notEqual(galleryFolderKey(m),galleryFolderKey(n));
});
function uploadFixture({topic='Denge Çalışması',program='jimnastik',admin=false,files=[{name:'synthetic.jpg',type:'image/jpeg',size:100}],audience='sinif'}={}) {
 const nodes=new Map(), writes=[], notifications=[], toasts=[],uploads=[];
 const values={galeriEtkinlik:topic,galeriEtkinlikTarih:'2026-10-02',galeriAciklama:'Sentetik',galeriHedefTur:audience,galeriKategori:program,galeriHedefSinif:'Test Sınıfı',galeriHedefOgrenci:'child-1'};
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{value:values[id]||'',style:{},options:[{dataset:{ad:'Test Çocuk'}}],selectedIndex:0,checked:false});return nodes.get(id);}};
 let count=0;
 const ctx=vm.createContext({window:{},document,console:{error(){},warn(){}},galeriSecilenDosyalar:files,activeKullaniciRol:admin?'mudur':'ogretmen',aktifKullaniciRol:admin?'mudur':'ogretmen',isAdmin:admin,currentUser:{email:'synthetic@example.invalid'},AKTIF_DONEM:'2026-2027',db:{},galleryText,galeriProgramKodu:galleryProgram,ogretmenRolMu:()=>!admin,aktifKullaniciSiniflari:['Test Sınıfı'],isoTarih:()=> '2026-10-02',showToast:(...v)=>toasts.push(v),resimSikistir:async f=>f,medyaYukle:async(f,path,tur)=>{uploads.push({path,tur});return{url:'https://example.invalid/'+f.name,yol:path};},galeriVideoYukle:async(f,{onProgress}={})=>{uploads.push({path:'stream',tur:'video'});onProgress?.({percent:100});return{embedUrl:'https://iframe.mediadelivery.net/embed/lib/video',videoId:'video',libraryId:'lib',thumbnailUrl:''};},collection:()=>({}),doc:()=>({id:'new-'+(++count)}),setDoc:async(ref,data)=>writes.push({id:ref.id,...data}),galeriGuncellemeBildirimi:async data=>notifications.push(data),galeriBildirimMailGonder:async()=>{throw Error('Unrequested email');},albumEkleMod:null,closeGaleriYuklemeModal(){},renderGaleri(){}});
 const start=source.indexOf('window.galeriYukle = async function() {'),end=source.indexOf('// Lightbox',start);vm.runInContext(source.slice(start,end),ctx);
 return{run:()=>ctx.window.galeriYukle(),writes,notifications,toasts,uploads};
}
test('blank program topic aborts before upload/write, while historical/general behavior remains',async()=>{
 const f=uploadFixture({topic:' \n '});await f.run();assert.equal(f.uploads.length,0);assert.equal(f.writes.length,0);assert.match(f.toasts[0][0],/konu/);
 const g=uploadFixture({topic:'',program:''});await g.run();assert.equal(g.writes[0].etkinlikBaslik,'Genel');
});
test('teacher batch stores one topic and pending status without notifications',async()=>{
 const f=uploadFixture({files:[{name:'a.jpg',type:'image/jpeg',size:100},{name:'b.jpg',type:'image/jpeg',size:100}]});await f.run();assert.equal(f.writes.length,2);assert.equal(new Set(f.writes.map(galleryTopicKey)).size,1);
 for(const m of f.writes){assert.equal(m.konuBaslik,'Denge Çalışması');assert.equal(m.konuAnahtari,'denge çalışması');assert.equal(m.program,'jimnastik');assert.equal(m.durum,'beklemede');assert.equal(m.egitimKaydi,false);assert.equal(m.donem,'2026-2027');}assert.equal(f.notifications.length,0);
});
test('management photo batch preserves exactly one published batch notification',async()=>{
 const f=uploadFixture({admin:true,files:[{name:'a.jpg',type:'image/jpeg',size:100},{name:'b.jpg',type:'image/jpeg',size:100}]});await f.run();assert.equal(f.writes.length,2);assert.equal(f.notifications.length,1);assert.equal(f.notifications[0].fotoSayisi,2);assert.equal(f.notifications[0].olayAnahtari,'galeri-yayin:new-1:new-2');
});
test('Portal video upload stores Bunny metadata and publishes one video notification',async()=>{
 const f=uploadFixture({admin:true,files:[{name:'movie.mp4',type:'video/mp4',size:200}]});await f.run();
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].dosyaTipi,'video');assert.equal(f.writes[0].mimeType,'video/mp4');
 assert.equal(f.writes[0].bunnyUrl,'https://iframe.mediadelivery.net/embed/lib/video');assert.equal(f.writes[0].embedUrl,f.writes[0].bunnyUrl);
 assert.equal(f.writes[0].mp4Url,'');assert.equal(f.writes[0].streamVideoId,'video');assert.equal(f.writes[0].streamLibraryId,'lib');
 assert.equal(f.uploads.length,1);assert.equal(f.uploads[0].tur,'video');
 assert.equal(f.notifications.length,1);assert.equal(f.notifications[0].fotoSayisi,0);assert.equal(f.notifications[0].videoSayisi,1);
 assert.equal(f.notifications[0].olayAnahtari,'galeri-yayin:new-1');
});
test('moderation changes do not alter folder identity and none are written by folder helpers',()=>{
 const base=row();for(const durum of ['beklemede','reddedildi','taslak','onaylandi'])assert.equal(galleryTopicKey({...base,durum}),galleryTopicKey(base));
 assert.match(source,/galeriKlasorGorunumu\.render\(el, liste/);assert.match(source,/kategoriSel\.disabled = false/);assert.match(source,/kategoriSel\.value = program; kategoriSel\.disabled = Boolean\(program\)/);
});


test('add-to-topic entry blocks legacy/prior period while preserving current topic and program',()=>{
 const start=source.indexOf('window.galeriKonuEEkle = function(id)'),end=source.indexOf('window.galeriKonuZipIndir',start),calls=[],toasts=[];
 const rows=[row({id:'current'}),row({id:'old',donem:'2025-2026'}),row({id:'legacy',donem:''})];
 const ctx=vm.createContext({window:{albumEEkle:(...args)=>calls.push(args)},galeriListesiVerisi:rows,AKTIF_DONEM:'2026-2027',galleryTopic,galeriProgramKodu:galleryProgram,isoTarih:()=> '2026-10-02',showToast:(...args)=>toasts.push(args)});vm.runInContext(source.slice(start,end),ctx);
 ctx.window.galeriKonuEEkle('legacy');ctx.window.galeriKonuEEkle('old');assert.equal(calls.length,0);assert.equal(toasts.length,2);ctx.window.galeriKonuEEkle('current');assert.equal(calls.length,1);assert.equal(calls[0][5],'jimnastik');
});
