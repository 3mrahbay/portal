// FIRESTORE_EMULATOR_HOST=127.0.0.1:8787 PDR_RULES_FILE=/path/to/review.rules node tests/pdr-rules-emulator.cjs
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection,query,where,updateDoc,deleteDoc,serverTimestamp}=require('firebase/firestore');
const fs=require('fs');
(async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.PDR_RULES_FILE)throw Error('Emulator host ve kural dosyası zorunlu. Canlıya bağlanılmaz.');
 const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
 const env=await initializeTestEnvironment({projectId:'demo-pdr-review',firestore:{host,port:Number(port),rules:fs.readFileSync(process.env.PDR_RULES_FILE,'utf8')}});
 let checks=0; const ok=async p=>{await assertSucceeds(p);checks++;},no=async p=>{await assertFails(p);checks++;};
 const roles=['pdr','mudur','kurucu_mudur','ogretmen','danisma','egitim_koordinator','muhasebe'];
 const db=role=>env.authenticatedContext(role,{email:role+'@example.test'}).firestore();
 try{
 await env.withSecurityRulesDisabled(async c=>{for(const rol of roles)await setDoc(doc(c.firestore(),'personeller',rol+'@example.test'),{rol,durum:'aktif'});
 for(const id of ['veli','veli2'])await setDoc(doc(c.firestore(),'veliler',id+'@example.test'),{ogrenciIds:['child']});
 await setDoc(doc(c.firestore(),'danismaPersonelRehberi','ogretmen@example.test'),{adSoyad:'Örnek Öğretmen',rol:'ogretmen',durum:'aktif'});
 await setDoc(doc(c.firestore(),'duyurular','other'),{olusturan:'mudur@example.test',baslik:'Örnek duyuru'});
 await setDoc(doc(c.firestore(),'mesajlar','other'),{katilimcilar:['veli@example.test','ogretmen@example.test']});
 });
 const data={ogrenciId:'child',ogrenciAd:'Örnek Çocuk',sinif:'Örnek',donem:'2026-2027',tur:'destek',durum:'suruyor',tarih:'2026-09-21',takipTarihi:'2026-09-28',baslik:'Uyum',ozet:'Örnek',katilimcilar:'',hedef:'Katılım',uygulama:'',aileOnerisi:'',ogretmenOnerisi:'',sonuc:'',veliylePaylas:false,semaSurumu:1,uzmanEmail:'pdr@example.test',uzmanAd:'Uzman',olusturuldu:serverTimestamp(),guncelleyen:'pdr@example.test',guncellendi:serverTimestamp()};
 await ok(setDoc(doc(db('pdr'),'pdrTakipKayitlari','record'),data));
 for(const rol of ['pdr','mudur','kurucu_mudur']){await ok(getDoc(doc(db(rol),'pdrTakipKayitlari','record')));await ok(getDocs(query(collection(db(rol),'pdrTakipKayitlari'),where('donem','==','2026-2027'))));}
 for(const rol of ['veli','veli2','ogretmen','danisma','egitim_koordinator','muhasebe']){await no(getDoc(doc(db(rol),'pdrTakipKayitlari','record')));await no(setDoc(doc(db(rol),'pdrTakipKayitlari',rol),{...data,uzmanEmail:rol+'@example.test',guncelleyen:rol+'@example.test'}));}
 await no(getDoc(doc(env.unauthenticatedContext().firestore(),'pdrTakipKayitlari','record')));
 await ok(updateDoc(doc(db('pdr'),'pdrTakipKayitlari','record'),{durum:'tamamlandi',sonuc:'Hedef gözlendi',guncellendi:serverTimestamp()}));
 for(const change of [{veliylePaylas:true},{ogrenciId:'another'},{donem:'2025-2026'},{tur:'gorusme'},{uzmanEmail:'other@example.test'},{uzmanAd:'other'},{beklenmeyen:'extra'},{sonuc:''}])await no(updateDoc(doc(db('pdr'),'pdrTakipKayitlari','record'),{...change,guncellendi:serverTimestamp()}));
 await no(updateDoc(doc(db('kurucu_mudur'),'pdrTakipKayitlari','record'),{veliylePaylas:true,guncelleyen:'kurucu_mudur@example.test',guncellendi:serverTimestamp()}));
 await no(deleteDoc(doc(db('kurucu_mudur'),'pdrTakipKayitlari','record')));
 await ok(getDocs(collection(db('pdr'),'danismaPersonelRehberi')));await no(getDocs(collection(db('veli'),'danismaPersonelRehberi')));
 for(const col of ['duyurular','etkinlikler','takvim']){await ok(setDoc(doc(db('pdr'),col,'mine'),{olusturan:'pdr@example.test',baslik:'PDR'}));await ok(updateDoc(doc(db('pdr'),col,'mine'),{baslik:'PDR güncel'}));await no(updateDoc(doc(db('pdr'),col,'mine'),{olusturan:'other@example.test'}));await ok(deleteDoc(doc(db('pdr'),col,'mine')));}
 await no(updateDoc(doc(db('pdr'),'duyurular','other'),{baslik:'Yetkisiz'}));await no(deleteDoc(doc(db('pdr'),'duyurular','other')));
 await no(getDoc(doc(db('pdr'),'mesajlar','other')));
 await ok(setDoc(doc(db('pdr'),'mesajlar','pdr-parent'),{katilimcilar:['pdr@example.test','veli@example.test']}));
 await ok(setDoc(doc(db('pdr'),'mesajlar','pdr-staff'),{katilimcilar:['pdr@example.test','ogretmen@example.test']}));
 console.log(`PASS ${checks} Firestore Emulator doğrulaması`);
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
