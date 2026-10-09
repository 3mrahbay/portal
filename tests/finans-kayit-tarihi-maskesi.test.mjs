import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = source.indexOf('function finansTarihMaskeliMetin(');
const end = source.indexOf('function finansTarihGirisiKaydet(', start);
assert.ok(start > 0 && end > start, 'Mask helper must exist in portal');
const code = source.slice(start, end);
const ctx = vm.createContext({finansTarihGoster:iso=>iso==='2026-08-10'?'10.08.2026':'',Date});
vm.runInContext(code, ctx);
const format = v=>ctx.finansTarihMaskeliMetin(v);

test('automatic dot insertion during typing, paste and edit', ()=>{
 const partial = ['1','10','100','1008','10082','100820','1008202','10082026'];
 const expected = ['1','10','10.0','10.08','10.08.2','10.08.20','10.08.202','10.08.2026'];
 assert.deepEqual(partial.map(format),expected);
 assert.equal(format('10.08.2026'),'10.08.2026');
 assert.equal(format('2026-08-10'),'10.08.2026');
 assert.equal(format('10082026000'),'10.08.2026');
});
test('cursor formatting and year text lower case in three payment cards', ()=>{
 for(let i=1;i<=8;i++){
  const input={value:'10082026'.slice(0,i),selectionStart:i,setSelectionRange(a,b){this.caret=a;}};
  ctx.finansTarihMaskele(input);
  assert.equal(input.value,format('10082026'.slice(0,i)));
  assert.ok(input.caret <= input.value.length);
 }
 assert.equal((source.match(/oninput="finansTarihMaskele\(this\)"/g)||[]).length,3);
 assert.equal((source.match(/placeholder="gg\.aa\.yyyy"/g)||[]).length,3);
});
test('registration native calendar field retains auto dots and maps to correct Firestore date property', ()=>{
 assert.match(source,/<input type="date" id="kayitAyarIlkKayitTarihi">/);
 assert.match(source,/ilkKayitTarihi: document\.getElementById\("kayitAyarIlkKayitTarihi"\)\.value/);
 assert.ok(source.includes('formatDateForInput(kayit.ilkKayitTarihi || o.okulaKayitTarihi)'));
 assert.ok(source.includes('kayit: kayitData'));
 assert.ok(source.includes('getDocFromServer(ref)'));
 assert.ok(source.includes('kayitSaved.ilkKayitTarihi !== kayitData.ilkKayitTarihi'));
 assert.ok(source.includes('okulaKayitTarihi:kayitData.ilkKayitTarihi'));
});
test('registration date rejects malformed year and invalid days, allows valid future start', ()=>{
 const fn=ctx.kayitFormTarihGecerli;
 assert.equal(fn('0006-08-10'),false);
 assert.equal(fn('2026-02-30'),false);
 assert.equal(fn('2026-08-10'),true);
 assert.equal(fn('2027-09-01'),true);
});

test('incomplete edits cannot silently erase enrollment dates', ()=>{
 assert.ok(source.includes('el.dataset.kayitTarihDegisti = "0"'));
 assert.ok(source.includes('el.addEventListener("input", mark)'));
 assert.ok(source.includes('el.addEventListener("change", mark)'));
 assert.ok(source.includes('touched || eski || el?.validity?.badInput'));
 assert.ok(source.includes('tarihi eksik veya geçersiz'));
 assert.ok(source.includes('el?.focus()'));
});
test('all registration fields remain in the saved nested document', ()=>{
 for(const field of ['sinif','program','ilkKayitTarihi','donemBaslangic','oncekiOkul','servisKullanim','servisGuzergah','servisDurakAdres','servisNot','kaynak','referansKod','kaynakNot']){
   assert.match(source,new RegExp('(?:^|\\n)\\s*'+field+': document\\.getElementById\\(', 'm'));
 }
 assert.ok(source.includes('kayit: kayitData'));
 assert.ok(source.includes('kayitSaved.ilkKayitTarihi !== kayitData.ilkKayitTarihi'));
 assert.ok(source.includes('kayitSaved.donemBaslangic !== kayitData.donemBaslangic'));
});
