import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('window.okulZiliDoldur = async function()');
const pickup=html.slice(start,html.indexOf('// Özet sayfası hızlı işlem',start));
function pickupFixture(fail=false, rows=[]){
  const list={innerHTML:''}, summary={}, calls=[];
  const context=vm.createContext({window:{},document:{getElementById:id=>id==='okulZiliListe'?list:summary},
    okulZiliCanliBaslat:()=>calls.push('listen'),okulZiliKoleksiyonu:()=> 'pickupBildirimleri',
    db:{},collection:()=>{},where:()=>{},query:()=>{},getDocs:async()=>{if(fail)throw Error('offline');return {forEach:fn=>rows.forEach(r=>fn({id:r.ogrenciId+'__2026-09-28',data:()=>r}))};},
    ogrenciList:[],danismaRolMu:()=>true,console:{warn(){}},Date});
  vm.runInContext(pickup,context);return {context,list,summary,calls};
}
test('empty pickup queue starts listening before first notice',async()=>{
  const f=pickupFixture();await f.context.window.okulZiliDoldur();assert.equal(f.calls[0],'listen');assert.match(f.list.innerHTML,/Bugün için çıkış bildirimi yok/);
});
test('pickup read failure is visible and retryable, never presented as no notices',async()=>{
  const f=pickupFixture(true);await f.context.window.okulZiliDoldur();assert.equal(f.summary.textContent,'Yüklenemedi');assert.match(f.list.innerHTML,/Tekrar Dene/);assert.doesNotMatch(f.list.innerHTML,/Bugün için çıkış bildirimi yok/);
});
const decode=s=>s.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
test('pickup action retains quoted names and uses Hazırlandı for ready action',async()=>{
  const name=`Ali O'Neil "A"`;
  const f=pickupFixture(false,[{ogrenciId:'child',ogrenciAd:name,alanKisi:"O'Neil",durum:'hazir'},{ogrenciId:'child2',durum:'yolda'}]);
  await f.context.window.okulZiliDoldur();assert.match(f.list.innerHTML,/>Hazırlandı<\/button>/);
  const action=f.list.innerHTML.match(/onclick="(pickupTeslimEt[^\n]*?)"/)[1];let args;
  vm.runInNewContext(decode(action),{pickupTeslimEt:(...v)=>args=v});assert.equal(args[2],name);assert.equal(args[3],"O'Neil");
});
test('morning list shows all waiting children and disables false state after read error',async()=>{
  const source=fs.readFileSync('moduller/sabah-girisi.js','utf8');
  const retry={};const el={innerHTML:'',querySelector:()=>retry};let fail=false;
  const RealDate=Date;
  globalThis.Date=class extends RealDate{constructor(...a){super(...(a.length?a:['2026-09-28T09:00:00Z']));}};
  globalThis.document={getElementById:()=>el};
  const students=Array.from({length:12},(_,i)=>({id:'child'+i,ogrenciAdSoyad:'Child '+i}));
  globalThis.window={PortalAPI:{db:{},state:{rol:'danisma',siniflar:[],ogrenciList:students,ayarListesi:Object.fromEntries(students.map(o=>[o.id,{kayit:{sinif:"A'nın sınıfı"}}])),veliAktifOgrenci:students[0]},
    esc:s=>String(s),bugun:()=> '2026-09-28',ogrenciDurum:()=> 'aktif',lucide:()=>{},
    fb:{collection:()=>{},query:()=>{},where:()=>{},doc:()=>{},getDoc:async()=>{throw Error('offline');},getDocs:async()=>{if(fail)throw Error('offline');return {forEach:()=>{}};},onSnapshot:()=>()=>{}}}};
  const oldWarn=console.warn;console.warn=()=>{};
  try{
    const m=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    await m.ogretmenKart('morning');assert.equal((el.innerHTML.match(/>Teslim Al<\/button>/g)||[]).length,12);
    const action=el.innerHTML.match(/onclick="(window\._sabahGirisi.onayla.*?)"/)[1];let args;
    vm.runInNewContext(decode(action),{window:{_sabahGirisi:{onayla:(...v)=>args=v}}});assert.equal(args[1],"A'nın sınıfı");
    fail=true;await m.ogretmenKart('morning');assert.match(el.innerHTML,/yüklenemedi/);assert.doesNotMatch(el.innerHTML,/Teslim Al/);assert.equal(typeof retry.onclick,'function');
    await m.veliKart('morning');assert.match(el.innerHTML,/yüklenemedi/);assert.doesNotMatch(el.innerHTML,/Yola çıktık/);
  }finally{globalThis.Date=RealDate;delete globalThis.document;delete globalThis.window;console.warn=oldWarn;}
});
test('PDR messages quick action routes to the messaging module',async()=>{
  const source=fs.readFileSync('moduller/pdr-calisma.js','utf8').replace(/^import .*;$/gm,'').replace('export async function','async function');let api,route;
  const context=vm.createContext({window:{PortalAPI:{state:{},fb:{},db:{}},modulSec:k=>route=k},document:{getElementById:()=>({})},panelKur:async(_,a)=>api=a,pdrStore:()=>({})});
  vm.runInContext(source,context);await context.panelRender('pdr');await api.islem('mesajlasma');assert.equal(route,'mesaj');
});
