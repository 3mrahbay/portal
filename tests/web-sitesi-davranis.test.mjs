import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../moduller/web-sitesi.js', import.meta.url), 'utf8');
function harness({email = 'emrahby@gmail.com', failRead = false, failWrite = false, fromCache = false, saved = {}} = {}) {
  const writes = [], messages = [], reads = [];
  let broken = failRead;
  const defaults = {duyuru:{aktif:false,metin:'Özgün duyuru'},medya:{liste:[]},genel:{},slaytlar:{liste:[]},kutular:{liste:[]},sss:{gruplar:[]}};
  const context = vm.createContext({console, fetch:async()=>({ok:true,json:async()=>structuredClone(defaults)}),
    window:{addEventListener(){},PortalAPI:{auth:{currentUser:email ? {email} : null},db:{},toast:(m)=>messages.push(m),fb:{
      doc:(_db,col,id)=>({col,id}),serverTimestamp:()=> 'SERVER_TIME',
      getDoc:async(ref)=>{reads.push(ref);if(broken)throw Error('unavailable');return {metadata:{fromCache},exists:()=>ref.id in saved,data:()=>structuredClone(saved[ref.id])};},
      setDoc:async(ref,value)=>{if(failWrite)throw Error('permission-denied');writes.push({ref,value});}
    }}}});
  vm.runInContext(source.replace(/export /g,'') + '\nwindow.testing={yukle,kaydet,medyaKaydet,change:()=>{D.duyuru.metin="Yeni";},data:()=>JSON.stringify(D)};',context);
  return {api:context.window.testing,writes,messages,reads,breakRead:()=>{broken=true;}};
}
test('sunucu okuma hatası varsayılanlarla kayıt yapılmasına izin vermez',async()=>{
  const h=harness({failRead:true});await assert.rejects(h.api.yukle(),/unavailable/);
  assert.equal(await h.api.kaydet('duyuru'),false);assert.equal(h.writes.length,0);
});
test('başarılı yüklemeden sonraki başarısız yenileme eski veriyi yazamaz',async()=>{
  const h=harness();await h.api.yukle();h.breakRead();await assert.rejects(h.api.yukle());
  assert.equal(await h.api.kaydet('duyuru'),false);assert.equal(h.writes.length,0);
});
for(const email of ['emrahby@gmail.com','eposta@bircicekkoleji.com'])test(`yetkili kayıt akışı: ${email}`,async()=>{
  const h=harness({email,saved:{duyuru:{aktif:false,metin:'Kaydedilmiş metin',baglanti:'/montessori'}}});
  await h.api.yukle();assert.equal(JSON.parse(h.api.data()).duyuru.metin,'Kaydedilmiş metin');h.api.change();
  assert.equal(await h.api.kaydet('duyuru'),true);assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].value.baglanti,'/montessori');assert.equal(h.writes[0].value.guncelleyen,email);
  assert.ok(h.messages.every(m=>!m.includes('en geç 1 dakika')));
});
for(const email of ['other-admin@example.com',null])test(`yetkisiz istemci kaydı engellenir: ${email}`,async()=>{
  const h=harness({email});await h.api.yukle();assert.equal(await h.api.kaydet('duyuru'),false);
  await assert.rejects(h.api.medyaKaydet());assert.equal(h.writes.length,0);
});
test('yalnız gerçekten olmayan belgeler varsayılanı kullanır',async()=>{
  const h=harness();await h.api.yukle();assert.equal(JSON.parse(h.api.data()).duyuru.metin,'Özgün duyuru');assert.equal(h.reads.length,6);
});
test('medya kayıt hatası çağırana ulaşır ve başarı mesajı verilmez',async()=>{
  const h=harness({failWrite:true});await h.api.yukle();await assert.rejects(h.api.medyaKaydet(),/permission-denied/);
  assert.ok(h.messages.some(m=>m.includes('kaydedilemedi')));assert.equal(h.writes.length,0);
});

test("önbellekten gelen sonuç mevcut içeriği ezemez",async()=>{const h=harness({fromCache:true});await assert.rejects(h.api.yukle(),/Sunucuya/);assert.equal(await h.api.kaydet("duyuru"),false);assert.equal(h.writes.length,0);});
