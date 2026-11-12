import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('function simsekPopupGoster('), html.indexOf('// Popup kapatıldı:'));
function popup(n, save) {
  const elements = new Map(); let rendered = '';
  const document = {getElementById: id => elements.get(id),body:{insertAdjacentHTML(_, h) {
    rendered = h;
    for (const [,id] of h.matchAll(/id="([^"]+)"/g)) elements.set(id,{disabled:false,textContent:'',remove(){elements.delete(id);}});
  }}};
  const ctx = vm.createContext({document,window:{},currentUser:{email:'veli@example.com'},escapeHtmlGelisim:x=>String(x || ''),setTimeout,
    modulYukle:async()=>({simsekTopluKapat:save}),simsekKapat:async()=>{}});
  vm.runInContext(source,ctx);
  ctx.simsekPopupGoster(Array.from({length:n},(_,i)=>({id:'d'+i,baslik:'Duyuru'})),0);
  return {elements,rendered};
}
test('Portal: 3 duyuruda yok, 4/50 duyuruda yalnız kuyruk kapanır',async()=>{
  for (const n of [3,4,50]) {
    let saved=[];
    const p=popup(n,async ds=>{saved=ds.map(d=>d.id);});
    const btn=p.elements.get('simsekTumunuOku');
    assert.equal(!!btn,n>3);
    if(btn){assert.match(p.rendered,/Duyurular bölümünden/);await btn.onclick();assert.equal(saved.length,n);assert.equal(p.elements.has('simsekOverlay'),false);}
  }
});
test('Portal: kayıt hatası pencereyi korur, tekrar denenebilir',async()=>{
  const p=popup(4,async()=>{throw new Error('offline');});
  await p.elements.get('simsekTumunuOku').onclick();
  assert.equal(p.elements.has('simsekOverlay'),true);
  assert.equal(p.elements.get('simsekTumunuOku').disabled,false);
  assert.match(p.elements.get('simsekTopluHata').textContent,/Kaydedilemedi/);
});
test('Portal: aynı anda iki toplu kayıt başlatılmaz',async()=>{
  let release,calls=0;
  const p=popup(4,()=>{calls++;return new Promise(r=>release=r);});
  const b=p.elements.get('simsekTumunuOku'), first=b.onclick();
  await Promise.resolve();await b.onclick();assert.equal(calls,1);release();await first;
});
test('Portal: sunucu hatasında yerel okundu yazılmaz; başarıda tekrar yüklemede kapanır',async()=>{
  const store=new Map(), writes=[];let fail=true;
  globalThis.localStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  const state={currentUser:{email:'veli@example.com'}};
  globalThis.window={PortalAPI:{state,db:{},fb:{doc:(_, ...p)=>p.join('/'),arrayUnion:(...ids)=>ids,
    getDoc:async()=>({exists:()=>false}),setDoc:async(p,v)=>{if(fail)throw new Error('offline');writes.push([p,v]);}}}};
  const code=await fs.readFile(new URL('../moduller/duyuru-okunma.js',import.meta.url),'utf8');
  const m=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  await assert.rejects(m.simsekTopluKapat([{id:'a'}]));assert.equal(store.size,0);
  fail=false;await m.simsekTopluKapat([{id:'a'},{id:'b'},{id:'a'}]);
  const status=await m.veliDurumuYukle();assert.equal(m.simsekKapatildiMi('a',status),true);
  assert.equal(status.okunan.has('b'),true);assert.equal(status.okunan.has('future'),false);
  const prefs=writes.filter(([p])=>p.startsWith('kullaniciTercihleri/'));
  assert.equal(prefs.length,1);assert.deepEqual(prefs[0][1].kapatilanSimsekler,['a','b']);
  delete globalThis.window;delete globalThis.localStorage;
});
