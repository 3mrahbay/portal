const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const {execFileSync}=require('node:child_process');
execFileSync(process.execPath,[path.resolve(__dirname,'../qa/education-read-fixture.cjs')]);
const html=fs.readFileSync(path.resolve(__dirname,'../../fixture.html'),'utf8');
async function fixture(error){
 const helpers=await import('../js/egitim-gelisim-okuma.mjs');
 const dom=new JSDOM(html,{url:'http://education.test/'+(error?'?error=1':''),runScripts:'outside-only'});
 Object.assign(dom.window,helpers);dom.window.console={log(){},warn(){},error(){}};
 const script=dom.window.document.querySelector('script[type="module"]').textContent.replace(/^import .*;$/m,'');
 await dom.window.eval('(async()=>{'+script+'})()');return dom;
}
test('failed initial load has no cells or zero percentage; write blocked; retry renders original T/U',async()=>{
 const dom=await fixture(true),w=dom.window,d=w.document;
 assert.match(d.querySelector('[role=alert]').textContent,/Kazanım kayıtları okunamadı/);
 assert.equal(d.querySelectorAll('.matrix-stu-buton').length,0);assert.doesNotMatch(d.getElementById('egitimSeciciBilgi').textContent,/%0/);
 await w.matrixHucreTikla('a','practical','Ön Çalışmalar','Kaşıklama 1');assert.equal(w.calls.writes,0);
 await w.retrySynthetic();assert.equal(d.querySelector('[role=alert]'),null);
 assert.deepEqual([...d.querySelectorAll('.matrix-stu-buton')].map(x=>x.textContent),['U','T','·']);
 assert.match(d.getElementById('egitimSeciciBilgi').textContent,/%67/);assert.equal(d.querySelectorAll('.ogrenci-h').length,1);assert.equal(w.calls.writes,0);dom.window.close();
});
test('failed refresh removes old editable cells and retries without resetting saved values',async()=>{
 const dom=await fixture(false),w=dom.window,d=w.document;
 w.failRead=true;await w.egitimMatrixYenile();assert.ok(d.querySelector('[role=alert]'));assert.equal(d.querySelectorAll('.matrix-stu-buton').length,0);
 await w.retrySynthetic();assert.equal(d.querySelector('.matrix-stu-buton').textContent,'U');assert.equal(w.calls.writes,0);dom.window.close();
});
