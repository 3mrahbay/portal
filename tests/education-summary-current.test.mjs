import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('window.egitimIlerlemeDoldur = async function() {');
const code=source.slice(start,source.indexOf('// Ana sayfa görevleri',start));
function fixture(fail=false){
 const nodes={egitimIlerlemeListe:{innerHTML:''},egitimIlerlemeOzet:{textContent:'stale %99'}};
 const context={window:{},document:{getElementById:id=>nodes[id]},console:{warn(){}},DISIPLINLER:[{id:'montessori',ad:'Montessori',ikon:'',renk:'#123'}],db:{},doc:(_,c,id)=>({c,id}),aktifMufredatlar:{montessori:[{id:'wrong-cache'}]},egitimMatrixVerisi:{ogrenciler:[{id:'a'},{id:'b'}],gelisim:{a:{montessori:{kayitlar:{'area__Group__One':'S','area__Group__Two':'U'}}},b:{montessori:{kayitlar:{'area__Group__One':'T','area__Group__Two':'bad'}}}}},getDocFromServer:async()=>{if(fail)throw Error('denied');return {exists:()=>true,data:()=>({alanlar:[{id:'area',gruplar:[{ad:'Group',dersler:['One','Two']}]}]})};},egitimMatrixVeriYukle:async fresh=>{assert.equal(fresh,true);}};
 vm.createContext(context);vm.runInContext(code,context);return {context,nodes};
}
test('summary counts current server curriculum and fresh records with explicit all-area scope',async()=>{const {context,nodes}=fixture();await context.window.egitimIlerlemeDoldur();assert.match(nodes.egitimIlerlemeOzet.textContent,/Program ort. %75.*2 öğrenci.*tüm alanlar/);assert.match(nodes.egitimIlerlemeListe.innerHTML,/3 \/ 4 öğrenci-kazanım/);assert.match(nodes.egitimIlerlemeListe.innerHTML,/U%25/);});
test('failed curriculum read clears stale percentage and offers retry without falling back',async()=>{const {context,nodes}=fixture(true);await context.window.egitimIlerlemeDoldur();assert.equal(nodes.egitimIlerlemeOzet.textContent,'Oran hesaplanamadı');assert.match(nodes.egitimIlerlemeListe.innerHTML,/Yeniden Dene/);assert.doesNotMatch(nodes.egitimIlerlemeListe.innerHTML,/%0/);});
test('no registered curriculum is skipped rather than auto-created',async()=>{const {context,nodes}=fixture();context.getDocFromServer=async()=>({exists:()=>false});await context.window.egitimIlerlemeDoldur();assert.equal(nodes.egitimIlerlemeOzet.textContent,'Müfredat tanımlı değil');});
