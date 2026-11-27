const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,updateDoc,deleteDoc,getDoc,getDocs,collection}=require('firebase/firestore');
const fs=require('node:fs');
(async()=>{
 const endpoint=process.env.FIRESTORE_EMULATOR_HOST;if(!/^127\.0\.0\.1:\d+$/.test(endpoint||''))throw Error('Local emulator only');
 const [host,port]=endpoint.split(':');
 const env=await initializeTestEnvironment({projectId:'demo-curriculum-scope',firestore:{host,port:+port,rules:fs.readFileSync(process.env.CURRICULUM_RULES_FILE,'utf8')}});
 let checks=0;
 try{
  await env.clearFirestore();
  const roles=['kurucu_mudur','mudur','egitim_koordinator','ogretmen','ingilizce_ogretmeni','brans_ogretmeni','pdr'];
  await env.withSecurityRulesDisabled(async ctx=>{for(const rol of roles)await setDoc(doc(ctx.firestore(),'personeller',rol+'@example.test'),{rol,durum:'aktif',mufredatDuzenleme:true});await setDoc(doc(ctx.firestore(),'mufredatDenetim','montessori','kayitlar','history'),{actor:'teacher',time:new Date()});});
  for(const email of [...roles.map(r=>r+'@example.test'),'emrahby@gmail.com']){
   const db=env.authenticatedContext(email,{email,email_verified:true}).firestore();
   for(const path of [['mufredatDenetim','forged'],['mufredatDenetim','montessori','kayitlar','history']]){
    const ref=doc(db,...path);for(const op of [()=>setDoc(ref,{actor:'forged'}),()=>updateDoc(ref,{actor:'forged'}),()=>deleteDoc(ref),()=>getDoc(ref)]){await assertFails(op());checks++;}
   }
   await assertFails(getDocs(collection(db,'mufredatDenetim','montessori','kayitlar')));checks++;
  }
  const teacher=env.authenticatedContext('ogretmen@example.test',{email:'ogretmen@example.test',email_verified:true}).firestore();
  await assertFails(setDoc(doc(teacher,'mufredatlar','montessori'),{alanlar:[]}));checks++;
  await assertFails(updateDoc(doc(teacher,'personeller','ogretmen@example.test'),{egitimProgramlari:['ingilizce']}));checks++;
  await env.withSecurityRulesDisabled(async ctx=>assertSucceeds(setDoc(doc(ctx.firestore(),'mufredatDenetim','montessori','kayitlar','server'),{actor:'server'})));checks++;
  console.log(`${checks} audit isolation checks passed`);
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
