const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const fb=require('firebase/firestore'), fs=require('node:fs');
(async()=>{
 const endpoint=process.env.FIRESTORE_EMULATOR_HOST||'';
 if(!/^127\.0\.0\.1:\d+$/.test(endpoint)||!process.env.OZLUK_RULES_FILE)throw Error('Local emulator and explicit rules required');
 const [host,port]=endpoint.split(':');
 const env=await initializeTestEnvironment({projectId:'demo-ozluk',firestore:{host,port:Number(port),rules:fs.readFileSync(process.env.OZLUK_RULES_FILE,'utf8')}});
 const db=n=>env.authenticatedContext(n,{email:n+'@test.example',email_verified:true}).firestore();
 const ref=(d,id)=>fb.doc(d,'izinTalepleri',id);
 const sample={personelEmail:'teacher@test.example',tur:'yillik',baslangic:'2026-11-27',bitis:'2026-11-28',gun:2,durum:'bekliyor'};
 let checks=0; const ok=async p=>{await assertSucceeds(p);checks++},no=async p=>{await assertFails(p);checks++};
 try {
 await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
  for(const [name,rol] of [['teacher','ogretmen'],['other','ogretmen'],['manager','mudur'],['accountant','muhasebe'],['coordinator','egitim_koordinator']])await fb.setDoc(fb.doc(c.firestore(),'personeller',name+'@test.example'),{rol});
 });
 await ok(fb.setDoc(ref(db('teacher'),'one'),sample));
 await no(fb.setDoc(ref(db('teacher'),'approved'),{...sample,durum:'onaylandi'}));
 await no(fb.setDoc(ref(db('outsider'),'outside'),{...sample,personelEmail:'outsider@test.example'}));
 await no(fb.setDoc(ref(db('teacher'),'spoof'),{...sample,personelEmail:'other@test.example'}));
 await no(fb.setDoc(ref(db('teacher'),'oversize'),{...sample,aciklama:'x'.repeat(2001)}));
 await no(fb.setDoc(ref(db('teacher'),'schema'),{...sample,admin:true}));
 await no(fb.setDoc(ref(db('teacher'),'type'),{...sample,gun:'2'}));
 await no(fb.getDoc(ref(db('other'),'one')));
 await no(fb.getDocs(fb.collection(db('teacher'),'izinTalepleri')));
 await no(fb.getDocs(fb.collection(env.unauthenticatedContext().firestore(),'izinTalepleri')));
 await ok(fb.getDocs(fb.query(fb.collection(db('teacher'),'izinTalepleri'),fb.where('personelEmail','==','teacher@test.example'))));
 await ok(fb.getDocs(fb.collection(db('accountant'),'izinTalepleri')));
 await no(fb.updateDoc(ref(db('teacher'),'one'),{durum:'onaylandi'}));
 await no(fb.updateDoc(ref(db('manager'),'one'),{personelEmail:'other@test.example'}));
 await no(fb.updateDoc(ref(db('manager'),'one'),{durum:'onaylandi',kararVeren:'manager@test.example',kararNotu:'',kararTarihi:new Date().toISOString()}));
 const {izinKararKaydet}=await import('../js/personel-izin-karar.js');
 await ok(izinKararKaydet({db:db('manager'),fb},{id:'one',actor:'manager@test.example',karar:'onaylandi',kaynak:'portal',onaylananGun:2}));
 await no(fb.updateDoc(fb.doc(db('manager'),'ozlukIslemKayitlari','izin_one'),{actor:'other@test.example'}));
 await no(fb.deleteDoc(fb.doc(db('manager'),'ozlukIslemKayitlari','izin_one')));
 await no(fb.deleteDoc(ref(db('manager'),'one')));
 await no(fb.setDoc(fb.doc(db('teacher'),'puantaj','fake'),{personelEmail:'teacher@test.example',tip:'giris'}));
 const d=db('manager'),id='teacher@test.example_2026-11-27_cikis_duzeltme';
 const event={personelEmail:'teacher@test.example',personelAd:'Test',tip:'cikis',tarih:'2026-11-27',zaman:'2026-11-27T14:00:00.000Z',yontem:'duzeltme',duzelten:'manager@test.example',onayli:true};
 await no(fb.setDoc(fb.doc(d,'puantaj',id),event));
 const batch=fb.writeBatch(d);batch.set(fb.doc(d,'puantaj',id),event);batch.set(fb.doc(d,'puantajDuzeltmeleri',id),{personelEmail:'teacher@test.example',personelAd:'Test',tarih:'2026-11-27',tur:'cikis-eklendi',eklenenSaat:'17:00',aciklama:'Eksik çıkış',duzelten:'manager@test.example',olusturuldu:fb.serverTimestamp()});
 await ok(batch.commit());await no(fb.deleteDoc(fb.doc(d,'puantaj',id)));
 await no(fb.updateDoc(fb.doc(db('teacher'),'puantajDuzeltmeleri',id),{personelEmail:'other@test.example'}));
 await ok(fb.getDocs(fb.query(fb.collection(db('accountant'),'puantaj'),fb.where('tarih','>=','2026-11-01'),fb.where('tarih','<=','2026-11-31'))));
 const admin=env.authenticatedContext('admin',{email:'emrahby@gmail.com',email_verified:true}).firestore();
 await no(fb.deleteDoc(fb.doc(admin,'puantaj',id)));
 await no(fb.deleteDoc(fb.doc(admin,'ozlukIslemKayitlari','izin_one')));
 await no(fb.setDoc(fb.doc(admin,'ozlukIslemKayitlari','izin_forged'),{tur:'izin-karar',talepId:'one',personelEmail:'teacher@test.example',actor:'emrahby@gmail.com',oncekiDurum:'onaylandi',yeniDurum:'onaylandi',zaman:fb.serverTimestamp(),kaynak:'portal'}));
 await no(fb.updateDoc(ref(admin,'one'),{personelEmail:'other@test.example'}));
 await no(fb.setDoc(fb.doc(db('teacher'),'personelDurum','teacher@test.example'),{durum:'iceride'}));
 await no(fb.setDoc(fb.doc(admin,'personelDurum','teacher@test.example'),{durum:'iceride'}));
 await ok(fb.setDoc(ref(db('teacher'),'concurrent'),sample));
 const outcomes=await Promise.allSettled(['onaylandi','reddedildi'].map(karar=>izinKararKaydet({db:db('manager'),fb},{id:'concurrent',actor:'manager@test.example',karar,not:'İncelendi',kaynak:'portal'})));
 require('node:assert/strict').equal(outcomes.filter(r=>r.status==='fulfilled').length,1);checks++;
 // Exercise the actual Portal create expression, including guncellendi and document metadata.
 const portal=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 const expression=portal.split('await addDoc(collection(db, "izinTalepleri"), ')[1].split('\n    });')[0]+'\n    }';
 const talep={baslangic:'2026-11-27',bitis:'2026-11-28',baslangicSaat:'',bitisSaat:'',aciklama:'Test'};
 const payload=new Function('email','aktifPersonel','currentUser','dogrulama','meta','talep','gunlukSaat','belgeUrl','belgeYol','belge','simdi','return '+expression)(
 'teacher@test.example',{adSoyad:'Test'},{},{tur:'yillik',gun:2,saat:0},{ad:'Yıllık',sureTipi:'gunluk',alt:'Ücretli'},talep,8,'','',null,new Date().toISOString());
 await ok(fb.setDoc(ref(db('teacher'),'portal-payload'),payload));
 // Companion form + create service are exercised when the ZEKY checkout is supplied.
 if(process.env.ZEKY_REPO_PATH){
  const path=require('node:path');
  const screen=fs.readFileSync(path.join(process.env.ZEKY_REPO_PATH,'www/personel-izin-rapor.html'),'utf8');
  const object=screen.split('const veri = {')[1].split('\n    };')[0];
  const form=new Function('seciliTur','T','bas','bit','gun','saat','miktarMetin','tarihMetin','etki','etkiMetin','belgeUrl','document','return {'+object+'}')( 'yillik',{ad:'Yıllık'},'2026-11-27','2026-11-28',2,0,'2 gün','27–28 Kasım','yillik','Yıllıktan düşecek','',{getElementById:()=>null});
  const source=fs.readFileSync(path.join(process.env.ZEKY_REPO_PATH,'www/js/zeky-data.js'),'utf8');
  const begin=source.indexOf('export async function izinTalebiOlustur');
  const code=source.slice(begin,source.indexOf('\n}\n',begin)+2).replace('export ','');
  const create=new Function('aktifKullanici','addDoc','collection','db','yoneticiEmailleri','bildirimYazCoklu',code+';return izinTalebiOlustur;')(()=>({email:'teacher@test.example',ad:'Test'}),fb.addDoc,fb.collection,db('teacher'),async()=>[],async()=>{});
  const created=await create({...form,personelEmail:'other@test.example',durum:'onaylandi'});checks++;
  require('node:assert/strict').equal(created.personelEmail,'teacher@test.example');
  require('node:assert/strict').equal(created.durum,'bekliyor');checks++;
  await ok(izinKararKaydet({db:db('manager'),fb},{id:created.id,actor:'manager@test.example',karar:'reddedildi',not:'Uygun değil',kaynak:'portal'}));
 }
 await no(fb.setDoc(ref(db('teacher'),'timestamp-type'),{...payload,guncellendi:42}));
 await env.withSecurityRulesDisabled(c=>fb.setDoc(ref(c.firestore(),'legacy-null'),{...sample,onaylananGun:null}));
 await ok(izinKararKaydet({db:db('manager'),fb},{id:'legacy-null',actor:'manager@test.example',karar:'reddedildi',not:'Uygun değil',kaynak:'zeky'}));
 const unverified=env.authenticatedContext('unverified',{email:'manager@test.example',email_verified:false}).firestore();
 await no(izinKararKaydet({db:unverified,fb},{id:'portal-payload',actor:'manager@test.example',karar:'onaylandi',kaynak:'portal'}));
 await no(izinKararKaydet({db:db('accountant'),fb},{id:'portal-payload',actor:'accountant@test.example',karar:'onaylandi',kaynak:'zeky'}));
 await ok(izinKararKaydet({db:db('coordinator'),fb},{id:'portal-payload',actor:'coordinator@test.example',karar:'onaylandi',kaynak:'zeky',onaylananGun:0}));
 for(const [key,value] of [['tarih','2026-11-25'],['duzelten','other@test.example']]){
   const pairId='teacher@test.example_2026-11-26_cikis_duzeltme';
   const b=fb.writeBatch(d);b.set(fb.doc(d,'puantaj',pairId),{...event,tarih:'2026-11-26'});
   b.set(fb.doc(d,'puantajDuzeltmeleri',pairId),{personelEmail:'teacher@test.example',personelAd:'Test',tarih:'2026-11-26',tur:'cikis-eklendi',eklenenSaat:'17:00',aciklama:'Eksik çıkış',duzelten:'manager@test.example',olusturuldu:fb.serverTimestamp(),[key]:value});await no(b.commit());
 }
 const staleId='teacher@test.example_2026-11-24_cikis_duzeltme';
 await env.withSecurityRulesDisabled(c=>fb.setDoc(fb.doc(c.firestore(),'puantaj',staleId),{...event,tarih:'2026-11-24'}));
 await no(fb.setDoc(fb.doc(d,'puantajDuzeltmeleri',staleId),{personelEmail:'teacher@test.example',personelAd:'Test',tarih:'2026-11-24',tur:'cikis-eklendi',eklenenSaat:'17:00',aciklama:'Eksik çıkış',duzelten:'manager@test.example',olusturuldu:fb.serverTimestamp()}));
 // Inactive staff must lose both own-record and role-based access.
 await env.withSecurityRulesDisabled(async c=>{
   for(const [name,rol,durum] of [['archived','ogretmen','arsiv'],['departed','mudur','ayrildi'],['inactive','muhasebe','pasif']])await fb.setDoc(fb.doc(c.firestore(),'personeller',name+'@test.example'),{rol,durum});
   await fb.setDoc(fb.doc(c.firestore(),'kullaniciKimlikleri','alias'),{aktif:true,primaryProfile:'personel',refEmail:'teacher@test.example'});
   await fb.setDoc(fb.doc(c.firestore(),'kullaniciKimlikleri','disabledAlias'),{aktif:false,primaryProfile:'personel',refEmail:'teacher@test.example'});
   await fb.setDoc(fb.doc(c.firestore(),'kullaniciKimlikleri','parentProfile'),{aktif:true,primaryProfile:'veli',refEmail:'teacher@test.example'});
 });
 for(const name of ['archived','departed','inactive']){
   await no(fb.getDocs(fb.collection(db(name),'izinTalepleri')));
   await no(fb.setDoc(ref(db(name),'inactive-'+name),{...sample,personelEmail:name+'@test.example'}));
   await no(fb.getDocs(fb.collection(db(name),'puantaj')));
 }
 for(const name of ['outsider','disabledAlias','parentProfile'])await no(fb.getDoc(ref(db(name),'one')));
 await ok(fb.getDoc(ref(db('alias'),'one')));
 await ok(fb.setDoc(ref(db('alias'),'alias-request'),sample));
 await no(fb.updateDoc(fb.doc(db('teacher'),'personeller','teacher@test.example'),{rol:'mudur'}));
 await no(izinKararKaydet({db:db('departed'),fb},{id:'alias-request',actor:'departed@test.example',karar:'onaylandi',kaynak:'zeky'}));
 for(const name of ['teacher','accountant']){
   const unverifiedReader=env.authenticatedContext('unverified-'+name,{email:name+'@test.example',email_verified:false}).firestore();
   await no(fb.getDoc(ref(unverifiedReader,'one')));
 }
 console.log(`${checks} authorization and atomic-audit checks passed`);
 } finally {await env.cleanup();}
})().catch(e=>{console.error(e);process.exit(1)});
