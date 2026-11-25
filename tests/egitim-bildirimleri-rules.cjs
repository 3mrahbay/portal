// Synthetic records only; refuses every non-local endpoint.
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const fb=require('firebase/firestore');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const endpoint=process.env.FIRESTORE_EMULATOR_HOST;
 if(!/^127\.0\.0\.1:\d+$/.test(endpoint||'')||!process.env.NOTICE_RULES_FILE)throw Error('Local emulator and rules snapshot required');
 const [host,port]=endpoint.split(':');
 const env=await initializeTestEnvironment({projectId:'demo-outcome-review',firestore:{host,port:+port,rules:fs.readFileSync(process.env.NOTICE_RULES_FILE,'utf8')}});
 const source=fs.readFileSync(__dirname+'/../moduller/ogretmen-egitim-gozlem.js','utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','').replace("if(typeof window!=='undefined')kur();",'');
 const photo={id:'synthetic-photo',durum:'onaylandi'},key='area__group__lesson';
 try{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c=>{
   const db=c.firestore();
   for(const role of ['egitim_koordinator','ogretmen','muhasebe','ingilizce_ogretmeni'])await fb.setDoc(fb.doc(db,'personeller',role+'@example.test'),{rol:role,siniflar:['Synthetic Class']});
   await fb.setDoc(fb.doc(db,'kullaniciKimlikleri','egitim_koordinator'),{aktif:true,primaryProfile:'personel',refEmail:'egitim_koordinator@example.test'});
   for(const child of ['child','other'])await fb.setDoc(fb.doc(db,'ogrenciler',child),{sinif:child==='child'?'Synthetic Class':'Other Class'});
   await fb.setDoc(fb.doc(db,'kullaniciKimlikleri','parent'),{aktif:true,primaryProfile:'veli',refEmail:'parent@example.test'});
   await fb.setDoc(fb.doc(db,'veliler','parent@example.test'),{ogrenciIds:['child'],onaylandi:true});
   await fb.setDoc(fb.doc(db,'galeri',photo.id),{durum:'onaylandi',egitimKaydi:true,ogrenciId:'child',program:'montessori',kazanimAnahtari:key,gozlemDurum:'S',url:'https://example.test/photo.jpg'});
  });
  const db=env.authenticatedContext('egitim_koordinator',{email:'egitim_koordinator@example.test'}).firestore();
  let pushes=0;
  const b={...fb,db,personel:()=>({ad:'Synthetic',soyad:'Coordinator'}),kullanici:()=>({uid:'egitim_koordinator'}),setDoc:(ref,data,options)=>fb.setDoc(ref,JSON.parse(JSON.stringify(data)),options)};
  const ctx={console,window:{BCK:b,PortalAPI:{state:{aktifDonem:'2026-2027'}}},hedefVeliEmailleri:()=>['parent@example.test'],bildirimKaydetVePush:async()=>{pushes++;return{ok:true,push:{ok:true}};}};
  vm.createContext(ctx);vm.runInContext(source+`\nS={ogrId:'child',program:'montessori',durum:'S',not:'Synthetic observation'};globalThis.notify=bildirimOlustur;`,ctx);
  const pending=ctx.notify(key,'lesson',{id:'area',ad:'area'},{ad:'group'},photo);
  if(process.env.EXPECT_NOTICE_DENIED==='1'){
   await assertFails(pending);assert.equal(pushes,0);
   console.log('PASS: released rules reject coordinator child notice before push; screenshot warning reproduced.');return;
  }
  await assertSucceeds(pending);assert.equal(pushes,1);
  const ref=fb.doc(db,'ogrenciler','child','bildirimler','egitim_'+photo.id),data=(await fb.getDoc(ref)).data();
  await assertSucceeds(fb.setDoc(ref,{...data,fotoUrl:'https://example.test/photo.jpg'},{merge:true}));
  const parent=env.authenticatedContext('parent',{email:'parent@example.test'}).firestore();
  const parentRef=fb.doc(parent,ref.path);
  await assertSucceeds(fb.getDocs(fb.collection(parent,'ogrenciler','child','bildirimler')));
  await assertSucceeds(fb.updateDoc(parentRef,{okundu:true}));
  await assertFails(fb.updateDoc(parentRef,{icerik:'tampered'}));
  await assertFails(fb.getDocs(fb.collection(parent,'ogrenciler','other','bildirimler')));
  await assertFails(fb.setDoc(fb.doc(parent,'ogrenciler','child','bildirimler','fake'),data));
  for(const patch of [{extra:true},{tip:'other'},{icerik:'x'.repeat(20001)},{fotoUrl:'https://evil.test/photo.jpg'},{fotoDurum:'beklemede'},{kazanimAnahtari:'wrong'},{program:'orman'},{okundu:false},{olusturuldu:'changed'}])await assertFails(fb.setDoc(ref,{...data,okundu:true,...patch},{merge:true}));
  for(const role of ['muhasebe','outsider']){
   const d=env.authenticatedContext(role,{email:role+'@example.test'}).firestore();
   await assertFails(fb.setDoc(fb.doc(d,'ogrenciler','child','bildirimler','text'),{...data,galeriId:'',fotoDurum:''}));
  }
  await assertFails(fb.setDoc(fb.doc(db,'ogrenciler','missing-child','bildirimler','text'),{...data,galeriId:'',fotoDurum:''}));
  const teacher=env.authenticatedContext('ogretmen',{email:'ogretmen@example.test'}).firestore();
  const text={...data,galeriId:'',fotoDurum:''};
  await assertSucceeds(fb.setDoc(fb.doc(teacher,'ogrenciler','child','bildirimler','text'),text));
  await assertFails(fb.setDoc(fb.doc(teacher,'ogrenciler','other','bildirimler','text'),text));
  const program=env.authenticatedContext('ingilizce_ogretmeni',{email:'ingilizce_ogretmeni@example.test'}).firestore();
  await assertFails(fb.setDoc(fb.doc(program,'ogrenciler','child','bildirimler','wrong-program'),text));
  await assertSucceeds(fb.setDoc(fb.doc(program,'ogrenciler','child','bildirimler','english'),{...text,program:'ingilizce'}));
  await assertFails(fb.getDoc(fb.doc(env.unauthenticatedContext().firestore(),ref.path)));
  await env.withSecurityRulesDisabled(c=>fb.updateDoc(fb.doc(c.firestore(),'galeri',photo.id),{durum:'beklemede'}));
  await assertFails(fb.setDoc(ref,{...data,okundu:true},{merge:true}));
  console.log('PASS: coordinator production notification function reaches push after save; parent reads/marks own child; scope, approval, schema, size, URL and immutable fields enforced.');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
