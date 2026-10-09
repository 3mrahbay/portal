import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function finansTarihGoster(');
const stop=html.indexOf('window.digerDegisti = function',start);
assert.ok(start>0&&stop>start,'Tarih yardimci fonksiyonlari bulunmali');
const source=html.slice(start,stop);
const changes=[],alerts=[];
const ctx=vm.createContext({
  finansBugunISO:()=> '2026-10-09',
  showToast:(m,t)=>alerts.push({m,t}),
  window:{
    aylikDegisti:(...args)=>changes.push(['aylik',...args]),
    digerDegisti:(...args)=>changes.push(['diger',...args])
  }
});
vm.runInContext(source,ctx);
const run=(fn,...args)=>vm.runInContext(fn+'('+args.map(x=>JSON.stringify(x)).join(',')+')',ctx);

test('gosterim: ISO -> GG.AA.YYYY; eski bozuk yil gorunur ama onaylanamaz',()=>{
  assert.equal(run('finansTarihGoster','2026-08-10'),'10.08.2026');
  assert.equal(run('finansTarihGoster','0006-08-10'),'10.08.0006');
  assert.equal(run('finansTarihISOgecerli','0006-08-10'),false);
});
test('farkli yazimlar dogru tarihe donusur',()=>{
  for(const s of ['10.08.2026','10/08/2026','10-08-2026','10082026','2026-08-10']){
    assert.equal(run('finansTarihMetniISO',s),'2026-08-10',s);
  }
});
test('eksik / imkansiz / ileri tarihler reddedilir',()=>{
  for(const s of ['10.08.0006','10.08.202','10.08.20','10.08.2027','31.02.2026','29.02.2026','31.04.2026','99.12.2026','']){
    assert.equal(run('finansTarihMetniISO',s),'',s);
  }
  assert.equal(run('finansTarihMetniISO','29.02.2024'),'2024-02-29');
});
test('uc finans odeme karti ortak metin girisi kullanir',()=>{
  assert.equal((html.match(/onchange="finansTarihGirisiKaydet\(this, '/g)||[]).length,3);
  assert.equal((html.match(/class="finans-tarih-input"/g)||[]).length,3);
  assert.match(html,/window\.aylikDegisti = function[\s\S]*?if \(alan === "odemeTarihi"\)[\s\S]*?!finansTarihISOgecerli\(deger\)/);
  assert.match(html,/window\.digerDegisti = function[\s\S]*?if \(alan === "odemeTarihi"\)[\s\S]*?!finansTarihISOgecerli\(deger\)/);
});
test('dogrudan tarih degisimi hareket gecmisini korur',()=>{
  assert.ok(html.includes('aylikOdemeler?.[ayKod]?.hareketler?.length'));
  assert.ok(html.includes('digerOdemeler?.[kalemKod]?.hareketler?.length'));
});
test('gecersiz tarih kaydedilmez; gecerli tarih sadece ilgili handlera gider',()=>{
  let focused=0,selected=0;
  const bad={value:'10.08.0006',focus(){focused++},select(){selected++}};
  ctx.finansTarihGirisiKaydet(bad,'aylik','__onOdeme');
  assert.equal(changes.length,0);
  assert.equal(alerts.at(-1).t,'error');
  assert.equal(focused,1);assert.equal(selected,1);
  const good={value:'10.08.2026',focus(){},select(){}};
  ctx.finansTarihGirisiKaydet(good,'aylik','__onOdeme');
  ctx.finansTarihGirisiKaydet(good,'diger','ormanKiyafeti');
  assert.deepEqual(changes,[['aylik','__onOdeme','odemeTarihi','2026-08-10'],['diger','ormanKiyafeti','odemeTarihi','2026-08-10']]);
});
