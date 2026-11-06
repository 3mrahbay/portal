import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const code=fs.readFileSync(new URL('../moduller/geri-bildirim.js',import.meta.url),'utf8').replaceAll('export ','');
for(const action of ['memnuniyetGonder','popupGonder'])test(action+' stores a named response even with stale anonymous UI',async()=>{
 const writes=[];const api={fb:{doc:(_db,...p)=>p.join('/'),setDoc:async(path,value)=>writes.push({path,value}),serverTimestamp:()=>1},db:{},state:{currentUser:{email:'Parent@Example.com'},veliAktifOgrenci:{id:'child',ogrenciAdSoyad:'Sample child',sinif:'A'},veliOgrenciler:[],ayarListesi:{}},toast:()=>{}};
 const ctx=vm.createContext({window:{PortalAPI:api},document:{getElementById:id=>id==='gbGizli'?{checked:true}:id==='gbYorum'?{value:'Feedback'}:null},console});
 vm.runInContext(code+'\nObject.assign(_puanlar,{iletisim:4,bakim:4,egitim:4,genel:4});globalThis.send='+action+';',ctx);
 await ctx.send('test');assert.equal(writes.length,1);assert.equal(writes[0].value.gizlilik,'acik');assert.equal(writes[0].value.ogrenciAd,'Sample child');assert.equal(writes[0].value.veliEmail,'parent@example.com');
});
