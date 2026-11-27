import {isDeepStrictEqual} from 'node:util';
export const PROGRAMS=['montessori','orman','degerler','ingilizce','degerlerPlus'];
const TEACHERS=['ogretmen','yardimci_ogretmen','ingilizce_ogretmeni','degerler_ogretmeni','orman_ogretmeni','brans_ogretmeni'];
export function profileEmail(auth,identity){
 if(!auth?.uid || auth.token?.email_verified!==true)throw Error('Oturum gerekli.');
 let email=String(auth.token.email||'').trim().toLowerCase();
 if(identity){
  const nested=identity.profiles?.personel;
  const flat=identity.refEmail;
  const legacy=nested?.aktif!==false?nested?.refEmail:undefined;
  if(identity.aktif===false || identity.primaryProfile!=='personel' || (!flat&&!legacy) || (flat&&legacy&&flat.toLowerCase()!==legacy.toLowerCase()))throw Error('Personel kimliği gerekli.');
  email=String(flat||legacy).toLowerCase();
 }
 if(!email || email.includes('/') || email.length>254)throw Error('Kimlik geçersiz.');
 return email;
}
export function authorized(auth,staff){
 return auth?.token?.email_verified===true && (auth.token.email==='emrahby@gmail.com' ||
  (staff?.durum==='aktif' && (['kurucu_mudur','mudur','egitim_koordinator'].includes(staff.rol) ||
   (TEACHERS.includes(staff.rol) && staff.mufredatDuzenleme===true))));
}
function text(v,max=250,allowSeparators=false){return typeof v==='string'&&v.trim().length>0&&v.length<=max&&(allowSeparators||!v.includes('__'))&&!['__proto__','constructor','prototype'].includes(v);}
export function keys(areas){
 if(!Array.isArray(areas)||areas.length>100)throw Error('Alan listesi geçersiz.');
 const result=new Set(),ids=new Set();let count=0;
 for(const a of areas){
  const id=String(a?.id);
  if(!a||(a.id!==undefined&&!text(a.id))||!text(a.ad)||ids.has(id)||!Array.isArray(a.gruplar)||a.gruplar.length>100)throw Error('Alan kimlikleri ve adları geçerli ve benzersiz olmalı.');
  if(a.ikon!==undefined && (typeof a.ikon!=='string'||a.ikon.length>80||/[<>"'&]/.test(a.ikon)))throw Error('Alan simgesi geçersiz.');
  if(a.renk!==undefined && (typeof a.renk!=='string'||a.renk.length>80||!/^[-#a-zA-Z0-9(),.%\s]+$/.test(a.renk)))throw Error('Alan rengi geçersiz.');
  ids.add(id);const groups=new Set();
  for(const g of a.gruplar){
   if(!g||!text(g.ad)||groups.has(g.ad)||!Array.isArray(g.dersler)||g.dersler.length>300)throw Error('Grup adları geçerli ve benzersiz olmalı.');
   groups.add(g.ad);
   for(const lesson of g.dersler){
    const k=`${id}__${g.ad}__${lesson}`;
    if(!text(lesson,1000,true)||result.has(k)||++count>5000)throw Error('Kazanım adları geçerli ve benzersiz olmalı.');
    result.add(k);
   }
  }
 }
 return result;
}
export function parseChanges(data){
 if(!Array.isArray(data?.changes)||!data.changes.length||data.changes.length>5||JSON.stringify(data).length>1500000)throw Error('Geçersiz kayıt isteği.');
 const programs=new Set();
 return data.changes.map(c=>{
  if(typeof c.disiplin!=='string'||!(/^[a-z][a-zA-Z0-9_-]{0,79}$/).test(c.disiplin)||programs.has(c.disiplin))throw Error('Geçersiz program.');programs.add(c.disiplin);
  keys(c.alanlar);if(!Array.isArray(c.base)||!Array.isArray(c.tasimalar)||c.tasimalar.length>500)throw Error('Geçersiz değişiklik.');
  for(const t of c.tasimalar)if(typeof t.eski!=='string'||typeof t.yeni!=='string'||!t.eski||!t.yeni||t.eski.length>1600||t.yeni.length>1600)throw Error('Geçersiz ad değişikliği.');
  return {disiplin:c.disiplin,alanlar:c.alanlar,base:c.base,tasimalar:c.tasimalar};
 });
}
export function checkBase(current,base){if(!isDeepStrictEqual(current,base))throw Error('Müfredat başka bir kullanıcı tarafından değiştirildi. Kapatıp yeniden açın.');}
function rename(key,moves){for(const t of moves)if(key===t.eski||(t.eski.split('__').length<3&&key.startsWith(t.eski+'__')))key=t.yeni+key.slice(t.eski.length);return key;}
export function validateMoves(c){
 const old=keys(c.base),next=keys(c.alanlar),targets=new Set(),moves=[];
 for(const k of old){
  const dest=rename(k,c.tasimalar);
  // Deleted curriculum items retain their historical student marks.
  if(!next.has(dest))continue;
  if(targets.has(dest))throw Error('Ad değişikliği mevcut kazanımla çakışıyor.');
  targets.add(dest);
  if(dest!==k)moves.push({eski:k,yeni:dest});
 }
 return moves;
}
export function migrate(section,moves){
 if(!section||!moves.length)return section;
 const out={...section};
 for(const field of ['kayitlar','tarihler','detay']){
  if(!section[field])continue;
  const source=section[field],target={};
  for(const [k,v] of Object.entries(source)){
   const dest=moves.find(t=>t.eski===k)?.yeni || k;
   if(Object.hasOwn(target,dest))throw Error('Geçmiş kazanım kaydıyla çakışma var; hiçbir değişiklik kaydedilmedi.');
   Object.defineProperty(target,dest,{value:v,enumerable:true,writable:true,configurable:true});
  }
  out[field]=target;
 }
 return out;
}

// The existing per-person edit switch remains mandatory for teachers.
export function programScope(auth,staff){
 if(auth?.token?.email_verified!==true) return [];
 if(auth.token.email==='emrahby@gmail.com') return null;
 if(staff?.durum!=='aktif') return [];
 if(['kurucu_mudur','mudur','egitim_koordinator','pdr'].includes(staff.rol)) return null;
 if(!TEACHERS.includes(staff.rol)) return [];
 const defaults={ogretmen:['montessori','orman'],yardimci_ogretmen:['montessori','orman'],ingilizce_ogretmeni:['ingilizce'],degerler_ogretmeni:['degerler'],orman_ogretmeni:['orman']};
 return [...new Set((Array.isArray(staff.egitimProgramlari)?staff.egitimProgramlari:(defaults[staff.rol]||[])).filter(id=>typeof id==='string'&&/^[a-z][a-zA-Z0-9_-]{0,79}$/.test(id)))];
}
export function assertProgramScope(auth,staff,ids,write=true){
 const scope=programScope(auth,staff);
 if((write&&!authorized(auth,staff))||(scope!==null&&ids.some(id=>!scope.includes(id)))) throw Error('Bu program için yetkiniz yok.');
}
export function auditChange(c){
 const before=keys(c.base),after=keys(c.alanlar);
 const value={program:c.disiplin,before:c.base,after:c.alanlar,moves:validateMoves(c),added:[...after].filter(k=>!before.has(k)),removed:[...before].filter(k=>!after.has(k))};
 if(Buffer.byteLength(JSON.stringify(value),'utf8')>850000)throw Error('Değişiklik geçmişi sınırı aşıldı; daha küçük bir değişiklik kaydedin.');
 return value;
}
