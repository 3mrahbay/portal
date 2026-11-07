console.log('Starting rules test');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const f=require('firebase/firestore'), fs=require('node:fs');
(async()=>{
 if(!process.env.BOOK_RULES || !process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');
 const env=await initializeTestEnvironment({projectId:'demo-club-interactions',firestore:{host:'127.0.0.1',port:Number(process.env.FIRESTORE_EMULATOR_HOST.split(":")[1]),rules:fs.readFileSync(process.env.BOOK_RULES,'utf8')}});
 console.log('Rules compiled');
 let checks=0;const ok=async p=>{await assertSucceeds(p);checks++},no=async p=>{await assertFails(p);checks++};
 const db=id=>env.authenticatedContext(id,{email:id+'@example.test'}).firestore();
 const path=['kitapKulubu','book','paylasimlar','photo'];
 const ref=(id,kind,key)=>f.doc(db(id),...path,kind,key);
 const reply=(id,extra={})=>({text:'Güzel bir paylaşım 🌸',authorUid:id,authorName:'Üye',createdAt:f.serverTimestamp(),...extra});
 const reaction=(extra={})=>({emoji:'❤️',updatedAt:f.serverTimestamp(),...extra});
 try{
 await env.clearFirestore();console.log("Emulator cleared");
 await env.withSecurityRulesDisabled(async c=>{
 const d=c.firestore();
 for(const [id,status] of [['member','approved'],['other','approved'],['pending','pending'],['blocked','blocked']]){
 await f.setDoc(f.doc(d,'veliler',id+'@example.test'),{yakinlik:'Anne',onaylandi:true});
 await f.setDoc(f.doc(d,'kitapKulubuUyeler',id),{uid:id,status});}
 await f.setDoc(f.doc(d,'personeller','pdr@example.test'),{rol:'pdr',durum:'aktif'});
 await f.setDoc(f.doc(d,'personeller','teacher@example.test'),{rol:'ogretmen',durum:'aktif'});
 await f.setDoc(f.doc(d,'kitapKulubu','book'),{status:'active'});
 await f.setDoc(f.doc(d,...path),{image:'data:image/jpeg;base64,YQ==',text:'photo',authorUid:'member',deleted:false});
 });
 await ok(f.setDoc(ref('member','yanitlar','r'),reply('member')));
 await ok(f.getDocs(f.query(f.collection(db('other'),...path,'yanitlar'),f.orderBy('createdAt','desc'),f.limit(20))));
 await ok(f.setDoc(ref('teacher','yanitlar','staff'),reply('teacher')));
 for(const id of ['pending','blocked','outsider']){
 await no(f.getDoc(ref(id,'yanitlar','r')));
 await no(f.setDoc(ref(id,'yanitlar','x'),reply(id)));
 await no(f.setDoc(ref(id,'tepkiler',id),reaction()));}
 await no(f.getDoc(f.doc(env.unauthenticatedContext().firestore(),...path,'yanitlar','r')));
 await no(f.getDocs(f.collection(db('member'),...path,'yanitlar')));
 await no(f.getDocs(f.query(f.collection(db('member'),...path,'yanitlar'),f.limit(21))));
 for(const extra of [{authorUid:'other'},{text:''},{text:' '.repeat(10)},{text:'a'.repeat(501)},{authorName:'a'.repeat(101)},{admin:true},{createdAt:f.Timestamp.fromMillis(0)}]) await no(f.setDoc(ref('member','yanitlar','bad'),reply('member',extra)));
 await no(f.updateDoc(ref('member','yanitlar','r'),{text:'edited'}));
 await no(f.deleteDoc(ref('other','yanitlar','r')));
 await no(f.deleteDoc(ref('teacher','yanitlar','r')));
 await ok(f.deleteDoc(ref('pdr','yanitlar','staff')));
 await ok(f.setDoc(ref('member','tepkiler','member'),reaction()));
 await ok(f.setDoc(ref('member','tepkiler','member'),reaction({emoji:'🌸'})));
 await ok(f.getDocs(f.query(f.collection(db('member'),...path,'tepkiler'),f.orderBy('updatedAt','desc'),f.limit(1000))));
 for(const extra of [{emoji:'😡'},{extra:1},{updatedAt:f.Timestamp.fromMillis(0)}]) await no(f.setDoc(ref('member','tepkiler','member'),reaction(extra)));
 await no(f.setDoc(ref('member','tepkiler','other'),reaction()));
 await no(f.deleteDoc(ref('other','tepkiler','member')));
 await ok(f.deleteDoc(ref('member','tepkiler','member')));
 for(const [bookId,postId] of [['missing','photo'],['book','missing'],['book','text'],['book','deleted']]){
 if(['text','deleted'].includes(postId))await env.withSecurityRulesDisabled(c=>f.setDoc(f.doc(c.firestore(),'kitapKulubu',bookId,'paylasimlar',postId),{image:postId==='text'?'':'data:image/jpeg;base64,YQ==',deleted:postId==='deleted'}));
 const p=['kitapKulubu',bookId,'paylasimlar',postId];
 await no(f.setDoc(f.doc(db('member'),...p,'yanitlar','x'),reply('member')));
 await no(f.setDoc(f.doc(db('member'),...p,'tepkiler','member'),reaction()));}
 await env.withSecurityRulesDisabled(c=>f.updateDoc(f.doc(c.firestore(),'kitapKulubu','book'),{status:'archived'}));
 await ok(f.getDoc(ref('member','yanitlar','r')));
 await no(f.setDoc(ref('member','yanitlar','new'),reply('member')));
 await no(f.setDoc(ref('member','tepkiler','member'),reaction()));
 await ok(f.deleteDoc(ref('member','yanitlar','r')));
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await f.updateDoc(f.doc(d,'kitapKulubu','book'),{status:'active'});await f.setDoc(f.doc(d,...path,'yanitlar','r'),{...reply('member'),createdAt:f.Timestamp.now()});});
 const batchDb=db('member'),batch=f.writeBatch(batchDb);batch.update(f.doc(batchDb,...path),{text:'',image:'',deleted:true});batch.set(f.doc(batchDb,...path,'yanitlar','race'),reply('member'));await no(batch.commit());
 await env.withSecurityRulesDisabled(c=>f.updateDoc(f.doc(c.firestore(),...path),{image:'',deleted:true}));
 await no(f.getDoc(ref('member','yanitlar','r')));
 console.log(`${checks} photo interaction rules checks passed`);
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
