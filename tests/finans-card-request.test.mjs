import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {odemePlani} from '../js/finans/core.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('window.veliKartTalepAc ='),html.indexOf('window.closeVeliKartTalep ='));
function setup(fail=false){
 const wrap={innerHTML:''},paths=[],messages=[];
 const w={history:{replaceState(){}},location:{pathname:'/'},lucideYenile(){}};
 const document={title:'Portal',getElementById:()=>wrap};
 const data={aidatAyarlari:{baslangicAyi:'2024-09',taksitSayisi:1,aylikAidat:1000},aylikOdemeler:{'2024-09':{odenenTutar:400}}};
 new Function('window','veliOgrenciler','AKTIF_DONEM','document','getDoc','doc','db','ortakOdemePlani','escapeHtml','showToast',code)(w,[{id:'child',ogrenciAdSoyad:'Örnek'}],'2026-2027',document,async()=>{if(fail)throw Error('offline');return {exists:()=>true,data:()=>data};},(...p)=>{paths.push(p);return p;},{},odemePlani,String,(...x)=>messages.push(x));
 return {w,wrap,paths,messages};
}
test('card request uses selected period and only the unpaid part of overdue fees',async()=>{
 const t=setup();await t.w.veliKartTalepAc('child','2024-2025');
 assert.equal(t.paths[0].at(-1),'2024-2025');
 assert.match(t.wrap.innerHTML,/kartTalepOlustur\('child', 600, 1, '2024-2025'\)/);
});
test('card request does not present a debt-free result after a failed read',async()=>{
 const t=setup(true);await t.w.veliKartTalepAc('child');assert.equal(t.wrap.innerHTML,'');assert.equal(t.messages[0][1],'error');
});
test('card request rejects an unrelated student before reading',async()=>{
 const t=setup();await t.w.veliKartTalepAc('other');assert.equal(t.paths.length,0);assert.equal(t.wrap.innerHTML,'');
});
