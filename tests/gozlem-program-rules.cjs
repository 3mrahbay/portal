// Run only against a local emulator with a read-only snapshot of released rules.
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const fb=require('firebase/firestore');
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
(async()=>{
  const endpoint=process.env.FIRESTORE_EMULATOR_HOST;
  if(!/^127\.0\.0\.1:\d+$/.test(endpoint||'')||!process.env.OBSERVATION_RULES_FILE)throw Error('Local emulator and released rules snapshot required');
  const [host,port]=endpoint.split(':');
  const env=await initializeTestEnvironment({projectId:'demo-outcome-review',firestore:{host,port:+port,rules:fs.readFileSync(process.env.OBSERVATION_RULES_FILE,'utf8')}});
  const source=fs.readFileSync(__dirname+'/../moduller/ogretmen-egitim-gozlem.js','utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','').replace("if(typeof window!=='undefined')kur();",'');
  const roles={ingilizce_ogretmeni:'ingilizce',degerler_ogretmeni:'degerler',orman_ogretmeni:'orman',ogretmen:'montessori'};
  try{
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async c=>{
      const db=c.firestore();
      for(const role of [...Object.keys(roles),'yardimci_ogretmen','mudur','egitim_koordinator','brans_ogretmeni','muhasebe'])await fb.setDoc(fb.doc(db,'personeller',role+'@example.test'),{rol:role,siniflar:['Synthetic Class']});
      if(process.env.OBSERVATION_UID_PROFILE==='1')for(const role of Object.keys(roles))await fb.setDoc(fb.doc(db,'kullaniciKimlikleri',role),{aktif:true,primaryProfile:'personel',refEmail:role+'@example.test'});
      for(const id of ['child','new-child','other-child'])await fb.setDoc(fb.doc(db,'ogrenciler',id),{sinif:id==='other-child'?'Other Class':'Synthetic Class'});
      await fb.setDoc(fb.doc(db,'ogrenciGelisim','child'),{montessori:{not:'preserve'},sonGozlem:{not:'preserve summary'}});
      await fb.setDoc(fb.doc(db,'ogrenciGelisim','other-child'),{});
    });
    for(const [role,program] of Object.entries(roles)){
      console.log('Checking role:',role);
      const db=env.authenticatedContext(role,{email:role+'@example.test'}).firestore();
      // Reproduce the old rejected payload, independently of the fixed implementation.
      if(role!=='ogretmen')await assertFails(fb.setDoc(fb.doc(db,'ogrenciGelisim','child'),{[program]:{},sonGozlem:{disiplin:program}},{merge:true}));
      const b={...fb,db,serverTimestamp:()=> 'synthetic-time',runTransaction:(_db,run)=>fb.runTransaction(_db,tx=>run({get:ref=>tx.get(ref),set:(ref,data,options)=>options?tx.set(ref,JSON.parse(JSON.stringify(data)),options):tx.set(ref,JSON.parse(JSON.stringify(data)))})),rol:()=>role,kullanici:()=>({uid:role,email:role+'@example.test'}),personel:()=>({ad:'Synthetic'})};
      const ctx={console,window:{BCK:b,PortalAPI:{state:{}}},gallerySession:()=> 'synthetic-session'};
      vm.createContext(ctx);
      vm.runInContext(source+`\nglobalThis.save=gelisimKaydet;globalThis.setState=x=>S=x;`,ctx);
      const state={ogrId:'child',program,durum:'S',not:'Synthetic observation'};
      ctx.setState(state);
      const gallery=fb.doc(db,'galeri',role);
      await assertFails(fb.setDoc(fb.doc(db,'galeri',role+'-autoapprove'),{durum:'onaylandi'}));
      await assertFails(fb.updateDoc(fb.doc(db,'personeller',role+'@example.test'),{rol:'mudur'}));
      await assertSucceeds(ctx.save('area__group__lesson','lesson',{id:'area',ad:'area'},{ad:'group'},{id:role,url:'https://example.test/synthetic.jpg',durum:'beklemede',galeriKaydi:{ref:gallery,veri:{durum:'beklemede',yukleyen:role+'@example.test'}}}));
      const saved=(await fb.getDoc(fb.doc(db,'ogrenciGelisim','child'))).data();
      assert.equal(saved[program].detay.area__group__lesson.asamalar.S.fotoUrl,'');
      if(role!=='ogretmen')assert.equal(saved.sonGozlem.not,'preserve summary');
      assert.equal((await fb.getDoc(gallery)).data().durum,'beklemede');
      if(role!=='ogretmen'){
        ctx.setState({...state,ogrId:'new-child'});
        await assert.rejects(ctx.save('key','lesson',{}, {},null));
        ctx.setState({...state,program:'montessori'});
        await assert.rejects(ctx.save('key','lesson',{}, {},null));
      }
      ctx.setState({...state,ogrId:'other-child'});
      await assert.rejects(ctx.save('key','lesson',{}, {},null));
    }
    for(const role of ['yardimci_ogretmen','mudur','egitim_koordinator','brans_ogretmeni','muhasebe']){
      const db=env.authenticatedContext(role,{email:role+'@example.test'}).firestore();
      const operation=fb.setDoc(fb.doc(db,'ogrenciGelisim','new-child'),{montessori:{not:'Synthetic'}},{merge:true});
      if(['yardimci_ogretmen','mudur','egitim_koordinator'].includes(role))await assertSucceeds(operation);else await assertFails(operation);
    }
    await env.withSecurityRulesDisabled(c=>fb.setDoc(fb.doc(c.firestore(),'kullaniciKimlikleri','disabled'),{aktif:false,primaryProfile:'personel',refEmail:'ogretmen@example.test'}));
    const disabled=env.authenticatedContext('disabled',{email:'ogretmen@example.test'}).firestore();
    await assertFails(fb.setDoc(fb.doc(disabled,'ogrenciGelisim','child'),{montessori:{}},{merge:true}));
    for(const db of [env.unauthenticatedContext().firestore(),env.authenticatedContext('outsider',{email:'outsider@example.test'}).firestore()]){
      await assertFails(fb.getDoc(fb.doc(db,'ogrenciGelisim','child')));
      await assertFails(fb.setDoc(fb.doc(db,'ogrenciGelisim','child'),{orman:{}},{merge:true}));
    }
    console.log('PASS: 4 teacher roles; legacy rejection reproduced; atomic pending photo saves; other programs/classes and uninitialized program records rejected.');
  }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
