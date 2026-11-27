import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fn(name,next){return html.slice(html.indexOf('window.'+name+' ='),html.indexOf(next,html.indexOf('window.'+name+' =')));}
function setup(){const dom=new JSDOM('<div id="ozlukIzinDetayModal"><input id="ozlukIzinOnayGun"><textarea id="ozlukIzinKararNot">Geçerli gerekçe</textarea><div id="ozlukIzinKararHata"></div><button>Kaydet</button></div>');return dom;}
test('Portal boş ve kesirli günleri reddeder, gerçek sıfırı korur, ret gün istemez',async()=>{
 const dom=setup(),{window}=dom,{document}=window,calls=[];
 new Function('window','document',fn('ozlukIzinDetayKarar','// ── 4)'))(window,document);
 window.ozlukIzinKarar=async(...a)=>calls.push(a);
 const input=document.querySelector('input');
 for(const v of ['','1.5','-1','367']){input.value=v;await window.ozlukIzinDetayKarar('id','onaylandi');}
 assert.equal(calls.length,0);
 input.value='0';await window.ozlukIzinDetayKarar('id','onaylandi');assert.equal(calls[0][3],0);
 input.value='';await window.ozlukIzinDetayKarar('id','reddedildi');assert.equal(calls[1][3],null);dom.window.close();
});
test('Portal başarısız karar gerekçeyi korur ve denetimleri yeniden açar',async()=>{
 const dom=setup(),{window}=dom,{document}=window;document.querySelector('button').disabled=true;
 const write=async()=>{throw Error('Bağlantı hatası');};
 new Function('window','document','izinKararKaydet','db','doc','runTransaction','serverTimestamp','currentUser','ozlukYukle',fn('ozlukIzinKarar','window.ozlukIzinDetayAc'))(window,document,write,{},()=>{},()=>{},()=>{},{email:'test@example.test'},()=>{throw Error('Must not reload')});
 await window.ozlukIzinKarar('id','reddedildi','Geçerli gerekçe');
 assert.equal(document.querySelector('button').disabled,false);assert.equal(document.querySelector('textarea').value,'Geçerli gerekçe');assert.match(document.getElementById('ozlukIzinKararHata').textContent,/Bağlantı hatası/);dom.window.close();
});
