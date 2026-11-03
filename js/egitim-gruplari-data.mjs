import {GROUP_PROGRAM,groupManager,groupTeacher,groupSession,groupVisible,membershipId,uniqueIds,validId,groupAudience,clean} from './egitim-gruplari-core.mjs';
function context(api) {
  const session=groupSession(api.state);
  const current=()=>session===groupSession(api.state)&&(!api.auth||api.auth.currentUser?.uid===api.state.currentUser?.uid);
  const guard=()=>{if(!current())throw Error('Oturum veya dönem değişti; ekranı yenileyin.');};
  return {guard,current,session};
}
export async function loadGroups(api) {
  const {guard}=context(api),{fb,db}=api,state=api.state;guard();
  if(!groupManager(state)&&!groupTeacher(state))return {groups:[],members:[]};
  const filters=groupManager(state)?[fb.where('donem','==',state.aktifDonem)]:[fb.where('donem','==',state.aktifDonem),fb.where('program','==',GROUP_PROGRAM),fb.where('ogretmenEmail','==',clean(state.currentUser.email).toLowerCase()),fb.where('durum','==','aktif')];
  const snapshot=await fb.getDocs(fb.query(fb.collection(db,'egitimGruplari'),...filters));guard();
  const groups=snapshot.docs.map(d=>({...d.data(),id:d.id})).filter(g=>groupVisible(g,state));
  const snapshots=groupManager(state)
    ? [await fb.getDocs(fb.query(fb.collection(db,'egitimGrupUyelikleri'),fb.where('donem','==',state.aktifDonem)))]
    : await Promise.all(groups.map(g=>fb.getDocs(fb.query(fb.collection(db,'egitimGrupUyelikleri'),fb.where('grupId','==',g.id),fb.where('donem','==',state.aktifDonem)))));
  guard();
  return {groups,members:snapshots.flatMap(s=>s.docs.map(d=>({...d.data(),id:d.id}))).filter(m=>m.donem===state.aktifDonem&&m.program===GROUP_PROGRAM)};
}
export async function saveGroup(api,values,id='') {
  const {guard}=context(api),{fb,db}=api;guard();if(!groupManager(api.state))throw Error('Grup yönetimi yetkiniz yok.');
  const ad=clean(values.ad),email=clean(values.ogretmenEmail).toLowerCase();
  if(!ad||ad.length>80||!email||email.length>180)throw Error('Grup adı ve öğretmen seçimi gerekli.');
  const ref=id?fb.doc(db,'egitimGruplari',id):fb.doc(fb.collection(db,'egitimGruplari'));
  await fb.runTransaction(db,async tx=>{
    guard();const previous=await tx.get(ref),teacher=await tx.get(fb.doc(db,'personeller',email));guard();
    const p=teacher.exists()?teacher.data():{};
    if(!groupTeacher({currentUser:{uid:'candidate'},rol:p.rol,personel:p}))throw Error('Aktif bir öğretmen seçin.');
    const old=previous.exists()?previous.data():{};
    if(previous.exists()&&old.donem!==api.state.aktifDonem)throw Error('Bu grup farklı döneme ait.');
    tx.set(ref,{ad,ogretmenEmail:email,program:GROUP_PROGRAM,donem:api.state.aktifDonem,durum:values.durum==='pasif'?'pasif':'aktif',
      olusturan:old.olusturan||api.state.currentUser.uid,olusturuldu:old.olusturuldu||fb.serverTimestamp(),
      guncelleyen:api.state.currentUser.uid,guncellendi:fb.serverTimestamp()});
  });guard();return ref.id;
}
export async function assignStudent(api,studentId,groupId,{expectedGroup}={}) {
  const {guard}=context(api),{fb,db}=api;guard();if(!groupManager(api.state))throw Error('Öğrenci atama yetkiniz yok.');
  if(groupId&&!validId(groupId))throw Error('Grup kimliği geçersiz.');
  const period=api.state.aktifDonem,id=membershipId(period,studentId),ref=fb.doc(db,'egitimGrupUyelikleri',id);
  const history=fb.doc(fb.collection(db,'egitimGrupUyelikleri',id,'gecmis'));
  return fb.runTransaction(db,async tx=>{
    guard();const student=await tx.get(fb.doc(db,'ogrenciler',studentId)),previous=await tx.get(ref);
    const group=groupId?await tx.get(fb.doc(db,'egitimGruplari',groupId)):null;guard();
    if(!student.exists())throw Error('Mevcut öğrenci kaydı bulunamadı.');
    const old=previous.exists()?previous.data():{},before=old.grupId||'';
    if(expectedGroup!==undefined&&before!==expectedGroup)throw Error('Öğrencinin grubu başka bir yönetici tarafından değiştirildi. Listeyi yenileyin.');
    if(groupId&&(!group?.exists()||!groupVisible({...group.data(),id:groupId},api.state)||group.data().durum!=='aktif'))throw Error('Aktif dönemden bir İngilizce grubu seçin.');
    if(before===groupId)return {changed:false,id};
    const data={ogrenciId:studentId,donem:period,program:GROUP_PROGRAM,grupId:groupId,sonIslemId:history.id,
      olusturan:old.olusturan||api.state.currentUser.uid,olusturuldu:old.olusturuldu||fb.serverTimestamp(),guncelleyen:api.state.currentUser.uid,guncellendi:fb.serverTimestamp()};
    tx.set(ref,data);
    tx.set(history,{ogrenciId:studentId,donem:period,oncekiGrupId:before,yeniGrupId:groupId,degistiren:api.state.currentUser.uid,tarih:fb.serverTimestamp()});
    return {changed:true,id};
  });
}
export async function assignStudents(api,ids,groupId,expected={}) {
  const {guard}=context(api),result={changed:0,unchanged:0,errors:[]};
  for(const id of uniqueIds(ids)){
    guard();try{const r=await assignStudent(api,id,groupId,{expectedGroup:expected[id]});result[r.changed?'changed':'unchanged']++;}
    catch(e){guard();result.errors.push({id,message:e.message});}
  }
  return result;
}
export async function resolveGroupAudience(api,groupId) {
  const {guard}=context(api),{fb,db}=api;guard();
  const snapshot=await fb.getDoc(fb.doc(db,'egitimGruplari',groupId));guard();
  const group=snapshot.exists()?{...snapshot.data(),id:snapshot.id}:null;
  if(!groupVisible(group,api.state)||group.durum!=='aktif')throw Error('İngilizce grubu bulunamadı veya yetkiniz değişti.');
  const list=await fb.getDocs(fb.query(fb.collection(db,'egitimGrupUyelikleri'),fb.where('grupId','==',groupId),fb.where('donem','==',group.donem)));guard();
  const members=list.docs.map(d=>d.data());
  const ids=uniqueIds(members.map(m=>m.ogrenciId));
  const snapshots=await Promise.all(ids.map(id=>fb.getDoc(fb.doc(db,'ogrenciler',id))));guard();
  const students=snapshots.filter(s=>s.exists()).map(s=>({...s.data(),id:s.id})).filter(s=>s.aktifDonem===group.donem&&String(s.aktifDonemDurum||s.durum||'').toLocaleLowerCase('tr')==='aktif');
  return groupAudience(group,members,students,api.state);
}
