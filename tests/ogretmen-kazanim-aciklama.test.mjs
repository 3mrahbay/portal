import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../moduller/ogretmen-egitim-gozlem.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'').replace("if(typeof window!=='undefined')kur();",'');
function setup(loader){
 const card={innerHTML:''};
 const ctx=vm.createContext({console,document:{getElementById:()=>({querySelector:()=>card})},window:{PortalData:{mufredatAlanlariGetir:async()=>[{id:'practical',gruplar:[{ad:'Ön Çalışmalar',dersler:['Kapı Açma/Kapama',"I'm fine",'Diğer']}]}],mufredatAciklamalariGetir:loader,aciklamaCoz:(ac,key,area)=>({metin:ac?.kazanim?.[key]||ac?.alan?.[area]||''})}}});
 vm.runInContext(source+`;bagla=()=>{};ikon=()=>{};S={program:'montessori',alanlar:[],alanIdx:0,grupIdx:0,dersIdx:0,not:'Öğretmenin notu'};globalThis.api={load:mufredatYukle,draw:ciz,set:(v)=>Object.assign(S,v),close:()=>S=null};`,ctx);
 return {ctx,card,api:ctx.api};
}
test('teacher sees exact slash/apostrophe descriptions and area fallback without replacing observation',async()=>{
 const {api,card}=setup(async()=>({kazanim:{'practical__Ön Çalışmalar__Kapı Açma/Kapama':'Kapı açıklaması <test>',"practical__Ön Çalışmalar__I'm fine":'İngilizce açıklama'},alan:{practical:'Alan açıklaması'}}));
 await api.load();api.draw();assert.match(card.innerHTML,/Kapı açıklaması &lt;test&gt;/);assert.match(card.innerHTML,/>Öğretmenin notu<\/textarea>/);
 api.set({dersIdx:1});api.draw();assert.match(card.innerHTML,/İngilizce açıklama/);assert.doesNotMatch(card.innerHTML,/Kapı açıklaması/);
 api.set({dersIdx:2});api.draw();assert.match(card.innerHTML,/Alan açıklaması/);
});
test('late program loads and closed dialogs cannot replace current explanations',async()=>{
 const pending={};const {api,card}=setup(p=>new Promise(resolve=>pending[p]=resolve));
 const first=api.load();api.set({program:'orman'});const second=api.load();
 pending.orman({alan:{practical:'Orman açıklaması'}});assert.equal(await second,true);
 pending.montessori({alan:{practical:'Eski açıklama'}});assert.equal(await first,false);api.draw();assert.match(card.innerHTML,/Orman açıklaması/);
 const closing=api.load();api.close();pending.orman({});assert.equal(await closing,false);
});
