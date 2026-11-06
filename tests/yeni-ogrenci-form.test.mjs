import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const form = html.slice(html.indexOf('<div id="yeniOgrenciModal"'), html.indexOf('<div id="csvYukleModal"'));
const code = html.slice(html.indexOf('// ============ YENİ ÖĞRENCİ EKLE (manuel)'), html.indexOf('// Yeni dönem için standart diğer ödemeler'));
function setup() {
  const elements = Object.fromEntries([...form.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, {value:'', checked:false, textContent:'Kaydet', classList:{add(){},remove(){}}}]));
  const writes = [], messages = [];
  const ctx = {document:{getElementById:id=>elements[id]}, console, Number, Date,
    showToast:m=>messages.push(m), db:{}, currentUser:{email:'test@example.invalid'}, AKTIF_DONEM:'2026-2027',
    aktifDonemOzetAlanlari:()=>({}), collection:()=>({}), doc:(...args)=>({id:'test-student',args}),
    setDoc:async(ref,data)=>writes.push({ref,data}), loadOgrenciler:async()=>{}};
  ctx.window=ctx;
  vm.runInNewContext(code,ctx);
  ctx.yeniOgrenciAc();
  Object.entries({yoAdSoyad:'Test Öğrenci',yoDogumTarihi:'2022-01-01',yoCinsiyet:'Kız',yoSinif:'Test',yoProgram:'Tam Gün',yoAylikAidat:'37000',yoEvAdresi:'Ortak adres',yoAnneTcKimlik:'11111111111',yoBabaTcKimlik:'22222222222'}).forEach(([id,value])=>elements[id].value=value);
  return {ctx,elements,writes,messages};
}
test('save persists parent identity and shared address in the existing student/period schema',async()=>{
  const {ctx,writes}=setup(); await ctx.yeniOgrenciKaydet();
  assert.equal(writes.length,2);
  assert.equal(writes[0].data.evAdresi,'Ortak adres');
  const d=writes[1].data;
  assert.equal(d.ogrenci.evAdresi,'Ortak adres');
  assert.equal(d.anne.evAdresi,'Ortak adres'); assert.equal(d.baba.evAdresi,'Ortak adres');
  assert.equal(d.anne.tcKimlik,'11111111111'); assert.equal(d.baba.tcKimlik,'22222222222');
  assert.equal(d.aidatAyarlari.hesapTuru,'cift_donem');
  assert.equal(d.aidatAyarlari.onOdeme,37000);
  assert.equal(d.aidatAyarlari.iDonemAylik,32500); assert.equal(d.aidatAyarlari.iiDonemAylik,34100);
});
test('equal installments have no upfront payment and preserve the annual total including cents',async()=>{
  const {ctx,elements,writes}=setup(); elements.yoHesapTuru.value='esit'; elements.yoAylikAidat.value='37123.45';
  await ctx.yeniOgrenciKaydet(); const a=writes[1].data.aidatAyarlari;
  assert.equal(a.onOdeme,0); assert.equal(a.iDonemAylik,37123.45); assert.equal(a.iiDonemAylik,37123.45);
  assert.equal(a.yillikToplam,a.iDonemAylik*10); assert.equal(a.hesapTuru,'esit');
});
test('separate parent address is preserved while the linked address follows edits',async()=>{
  const {ctx,elements,writes}=setup();
  elements.yoAnneAyniAdres.checked=false; elements.yoAnneEvAdresi.value='Anne adresi';
  elements.yoEvAdresi.value='Yeni adres'; ctx.yeniOgrenciAdresEsitle();
  assert.equal(elements.yoAnneEvAdresi.readOnly,false); assert.equal(elements.yoBabaEvAdresi.readOnly,true);
  await ctx.yeniOgrenciKaydet();
  assert.equal(writes[1].data.anne.evAdresi,'Anne adresi'); assert.equal(writes[1].data.baba.evAdresi,'Yeni adres');
});
test('invalid identities and payment amounts stop before any write',async()=>{
  for(const [id,value] of [['yoAnneTcKimlik','123'],['yoBabaTcKimlik','1234567890x'],['yoTcKimlik','123'],['yoAylikAidat','Infinity'],['yoAylikAidat','-1'],['yoHesapTuru','invalid']]) {
    const {ctx,elements,writes,messages}=setup();elements[id].value=value;await ctx.yeniOgrenciKaydet();
    assert.equal(writes.length,0,id);assert.equal(messages.length,1,id);
  }
});
test('reopening clears identities, addresses and restores default plan and address linking',()=>{
  const {ctx,elements}=setup();elements.yoAnneAyniAdres.checked=false;elements.yoHesapTuru.value='esit';
  ctx.yeniOgrenciAc();
  for(const id of ['yoEvAdresi','yoAnneEvAdresi','yoBabaEvAdresi','yoAnneTcKimlik','yoBabaTcKimlik']) assert.equal(elements[id].value,'');
  assert.equal(elements.yoAnneAyniAdres.checked,true);assert.equal(elements.yoHesapTuru.value,'cift_donem');
});
