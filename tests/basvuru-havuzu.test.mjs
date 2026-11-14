import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const block = html.slice(html.indexOf('let basvuruListesi = [];'), html.indexOf('// ============ FİNANSAL YÖNETİM'));
const escape = html.slice(html.indexOf('function escapeHtml(s)'),html.indexOf('window.yukleVarsayilanSozlesme'));
function setup() {
  const elements = new Map(['onayListesiWrap','ozetBasvuruSayisi','ozetBasvuruBekliyor','ozetBasvuruAciklama','hbRozetBasvuru','onaySayacRozet','modulOnayRozet'].map(id=>[id,{style:{},textContent:'',innerHTML:'',classList:{toggle(k,v){this[k]=v;}}}]));
  const writes=[], messages=[], prompts=[];
  const records = {basvurular:[],yenikayit:[{id:'same',data:()=>({childAd:'Selected',childSoyad:'Candidate',kayitTarihi:'2026-05-01',durum:'beklemede'})}],kayitYenileme:[{id:'same',data:()=>({childFirstName:'Other',childLastName:'Candidate',kayitTarihi:'2026-06-01',durum:'reddedildi'})}]};
  const c=vm.createContext({window:{},document:{getElementById:id=>elements.get(id),querySelectorAll:()=>[]},db:{},console:{log(){},warn(){},error(){}},
    collection:(_,name)=>name,doc:(_,collection,id)=>({collection,id}),getDocs:async name=>({docs:records[name]}),
    updateDoc:async(ref,data)=>writes.push({ref,data}),currentUser:{email:'admin@example.test'},
    prompt:s=>{prompts.push(s);return '';},confirm:s=>{prompts.push(s);return false;},alert:s=>messages.push(s),showToast:(...s)=>messages.push(s),formatTarih:x=>x});
  vm.runInContext(block+'\n'+escape,c);
  return {c,elements,records,writes,messages,prompts};
}
test('login count updates summary and both badges without opening pool or replacing loaded details',async()=>{
  const {c,elements}=setup();
  await c.initOnayBekleyenler();
  assert.equal(vm.runInContext('basvuruBekleyenSayisi',c),1);
  assert.equal(vm.runInContext('basvuruListesi.length',c),0);
  for(const id of ['ozetBasvuruSayisi','onaySayacRozet','modulOnayRozet','hbRozetBasvuru'])assert.equal(elements.get(id).textContent,1);
  assert.equal(elements.get('hbRozetBasvuru').classList.dolu,true);
  assert.match(elements.get('ozetBasvuruAciklama').textContent,/1 yeni/);
  c.updateOnaySayac(0);
  assert.equal(elements.get('ozetBasvuruSayisi').textContent,0);
  assert.equal(elements.get('hbRozetBasvuru').textContent,'');
  assert.equal(elements.get('modulOnayRozet').style.display,'none');
});
test('duplicate IDs: rejection writes selected source even when the other source sorts first',async()=>{
  const {c,writes,prompts}=setup();await c.loadOnayBekleyenler();
  await c.window.basvuruReddet('same','yenikayit');
  assert.match(prompts[0],/Selected Candidate/);assert.equal(writes.length,1);
  assert.equal(writes[0].ref.collection,'yenikayit');assert.equal(writes[0].data.durum,'reddedildi');
});
test('cold list fallback retains collection and does not choose other candidate',async()=>{
  const {c,writes}=setup();await c.window.basvuruReddet('same','yenikayit');
  assert.equal(writes.length,1);assert.equal(writes[0].ref.collection,'yenikayit');
});
test('ambiguous old ID-only calls fail closed without opening confirmation or writing',async()=>{
  const {c,writes,prompts}=setup();await c.loadOnayBekleyenler();
  await c.window.basvuruReddet('same');await c.window.basvuruOnayla('same');
  assert.equal(writes.length,0);assert.equal(prompts.length,0);
});
test('approval and detail select same card as rejection; cancel leaves data intact',async()=>{
  const {c,writes,prompts,messages}=setup();await c.loadOnayBekleyenler();
  await c.window.basvuruOnayla('same','yenikayit');
  c.window.basvuruDetayGoster('same','yenikayit');
  assert.match(prompts[0],/Selected Candidate/);assert.match(messages[0],/Selected Candidate/);assert.equal(writes.length,0);
});
test('rejection cancellation and failed writes do not report success',async()=>{
  const {c,writes,messages}=setup();await c.loadOnayBekleyenler();c.prompt=()=>null;
  await c.window.basvuruReddet('same','yenikayit');assert.equal(writes.length,0);
  c.prompt=()=>'';c.updateDoc=async()=>{throw Error('offline');};
  await c.window.basvuruReddet('same','yenikayit');
  assert.match(messages.at(-1)[0],/Reddedilemedi/);assert.equal(vm.runInContext('basvuruBekleyenSayisi',c),1);
});
test('rendered action handlers carry both source and ID; metadata cannot override document identity',async()=>{
  const {c,records,elements}=setup();records.basvurular=[{id:'actual',data:()=>({id:'spoofed',_koleksiyon:'ogrenciler',durum:'beklemede'})}];
  await c.loadOnayBekleyenler();
  const b=c.basvuruBul('actual','basvurular');assert.equal(b.id,'actual');assert.equal(c.basvuruBul('spoofed','ogrenciler'),null);
  const rendered=elements.get('onayListesiWrap').innerHTML;
  for(const fn of ['basvuruOnayla','basvuruReddet','basvuruDetayGoster'])assert.ok(rendered.includes(`${fn}(&quot;same&quot;,&quot;yenikayit&quot;)`));
});
test('permanent deletion targets exact source and updates counters only after server verification',async()=>{
  const {c,elements}=setup();await c.loadOnayBekleyenler();const deleted=[];
  c.prompt=()=> 'SİL';c.deleteDoc=async r=>deleted.push(r);c.getDocFromServer=async()=>({exists:()=>false});
  await c.window.basvuruSil('same','yenikayit');
  assert.equal(deleted.length,1);assert.equal(deleted[0].collection,'yenikayit');
  assert.equal(c.basvuruBul('same','yenikayit'),null);assert.ok(c.basvuruBul('same','kayitYenileme'));
  assert.equal(elements.get('ozetBasvuruSayisi').textContent,0);
});
test('delete cancellation, missing source and invalid confirmation never delete',async()=>{
  const {c}=setup();await c.loadOnayBekleyenler();let calls=0;c.deleteDoc=async()=>calls++;
  for(const value of [null,'','evet']){c.prompt=()=>value;await c.window.basvuruSil('same','yenikayit');}
  c.prompt=()=> 'SİL';await c.window.basvuruSil('same');await c.window.basvuruSil('same','ogrenciler');
  assert.equal(calls,0);assert.ok(c.basvuruBul('same','yenikayit'));
});
test('failed deletion or verification keeps local card and allows retry',async()=>{
  const {c,messages}=setup();await c.loadOnayBekleyenler();c.prompt=()=> 'SİL';
  c.deleteDoc=async()=>{throw Error('permission denied');};
  await c.window.basvuruSil('same','yenikayit');assert.ok(c.basvuruBul('same','yenikayit'));
  c.deleteDoc=async()=>{};c.getDocFromServer=async()=>({exists:()=>true});
  await c.window.basvuruSil('same','yenikayit');assert.ok(c.basvuruBul('same','yenikayit'));
  assert.match(messages.at(-1)[0],/doğrulanamadı/);
  c.getDocFromServer=async()=>({exists:()=>false});await c.window.basvuruSil('same','yenikayit');
  assert.equal(c.basvuruBul('same','yenikayit'),null);
});
test('parallel delete clicks issue only one request',async()=>{
  const {c}=setup();await c.loadOnayBekleyenler();let release,calls=0;c.prompt=()=> 'SİL';
  c.deleteDoc=()=>{calls++;return new Promise(r=>release=r);};c.getDocFromServer=async()=>({exists:()=>false});
  const first=c.window.basvuruSil('same','yenikayit');await c.window.basvuruSil('same','yenikayit');
  assert.equal(calls,1);release();await first;
});
test('rejected legacy records retain reason/date and offer separate delete action',async()=>{
  const {c,records,elements}=setup();records.yenikayit=[{id:'old',data:()=>({durum:'reddedildi',retNedeni:'Gelecek yıl görüşülecek',retTarihi:'2026-11-12'})}];
  await c.loadOnayBekleyenler();c.window.onayFilter('reddedildi');
  assert.match(elements.get('onayListesiWrap').innerHTML,/Gelecek yıl görüşülecek/);
  assert.match(elements.get('onayListesiWrap').innerHTML,/Başvuru geçmişte saklanıyor/);
  assert.match(elements.get('onayListesiWrap').innerHTML,/basvuruSil\(&quot;old&quot;,&quot;yenikayit&quot;\)/);
  assert.equal(c.basvuruBul('old','yenikayit').retTarihi,'2026-11-12');
});
