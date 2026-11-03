export function groupFixture(){
 const period='2026-2027',state={currentUser:{uid:'manager',email:'manager@example.test'},rol:'mudur',personel:{durum:'aktif'},aktifDonem:period};
 const students=[['ada','Örnek Ada','Lavantalar','2022-04-12'],['ege','Örnek Ege','Papatyalar','2022-07-06'],['defne','Örnek Defne','Lavantalar','2021-03-20'],['mert','Örnek Mert','Kardelenler','2021-10-02']].map(([id,ogrenciAdSoyad,sinif,dogumTarihi])=>({id,ogrenciAdSoyad,sinif,dogumTarihi,aktifDonem:period,aktifDonemDurum:'aktif'}));
 const groups=[{id:'g4',ad:'İngilizce 4 Yaş',ogretmenEmail:'english@example.test'},{id:'g5',ad:'İngilizce 5 Yaş',ogretmenEmail:'teacher@example.test'}].map(g=>({...g,donem:period,program:'ingilizce',durum:'aktif',olusturan:'manager',olusturuldu:'2026-11-03'}));
 const records=new Map(),writes=[];let sequence=0;
 students.forEach(o=>records.set('ogrenciler/'+o.id,o));groups.forEach(g=>records.set('egitimGruplari/'+g.id,g));
 records.set('personeller/english@example.test',{adSoyad:'Örnek İngilizce Öğretmeni',rol:'ingilizce_ogretmeni',durum:'aktif'});
 records.set('personeller/teacher@example.test',{adSoyad:'Örnek Öğretmen',rol:'ogretmen',durum:'aktif'});
 for(const [ogrenciId,grupId]of [['ada','g4'],['defne','g5']])records.set('egitimGrupUyelikleri/'+period+'__ingilizce__'+ogrenciId,{ogrenciId,grupId,donem:period,program:'ingilizce',olusturan:'manager',olusturuldu:'2026-11-03'});
 const snap=path=>({id:path.split('/').at(-1),exists:()=>records.has(path),data:()=>structuredClone(records.get(path))});
 const fb={collection:(_,...parts)=>({path:parts.join('/')}),doc:(...args)=>{const path=args.length===1?args[0].path+'/new'+(++sequence):args.slice(1).join('/');return{path,id:path.split('/').at(-1)};},where:(field,op,value)=>({field,op,value}),query:(ref,...filters)=>({...ref,filters}),serverTimestamp:()=>new Date().toISOString(),getDoc:async ref=>snap(ref.path),getDocs:async q=>({docs:[...records.keys()].filter(path=>path.startsWith(q.path+'/')&&path.split('/').length===q.path.split('/').length+1&&(q.filters||[]).every(f=>records.get(path)[f.field]===f.value)).map(snap)}),runTransaction:async(_,callback)=>{const staged=[];const result=await callback({get:async ref=>snap(ref.path),set:(ref,data)=>staged.push([ref.path,structuredClone(data)])});staged.forEach(([path,data])=>{records.set(path,data);writes.push(path);});return result;}};
 const api={state,fb,db:{}};return {api,students,records,writes};
}
