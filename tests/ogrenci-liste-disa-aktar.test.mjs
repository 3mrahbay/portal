import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ogrenciListeYetkili, ogrenciListeHazirlik, ogrenciListeRaporu, okulTakvimTarihi, dogumTakvimi, yasMetni, ogrenciListeDosyaAdi } from '../js/ogrenci-liste-core.js';
import { ogrenciListeXlsxOlustur } from '../js/ogrenci-liste-xlsx.js';
const now = new Date('2026-10-01T09:00:00Z');
function state(extra={}) {
  return {currentUser:{uid:'synthetic-admin'},isAdmin:false,rol:'mudur',aktifDonem:'2026-2027',
    ogrenciVerileriHazirMi:true,ogrenciDisAktarDurumu:{donem:'2026-2027',uid:'synthetic-admin',hazir:true,hataSayisi:0},
    ogrenciList:[{id:'fixture-a',ogrenciAdSoyad:'Çağrı Şimşek',tcKimlik:'00000000001',dogumTarihi:'2021-10-02',cinsiyet:'Erkek',aktifDonem:'2026-2027',sinif:'Papatyalar'}],
    ayarListesi:{'fixture-a':{donemYili:'2026-2027',durum:'aktif',ogrenci:{adSoyad:'Çağrı İpek Şimşek'},kayit:{sinif:'Nar Çiçekleri'},anne:{adSoyad:'Şule Şimşek',tcKimlik:'00000000002'},baba:{adSoyad:'İlker Şimşek',tcKimlik:'00000000003'}}},...extra};
}
const report=s=>ogrenciListeRaporu(s,{now});
function unzipStored(bytes) {
  const output={},v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),d=new TextDecoder();let p=0;
  while(v.getUint32(p,true)===0x04034b50){const n=v.getUint16(p+26,true),e=v.getUint16(p+28,true),size=v.getUint32(p+18,true);assert.equal(v.getUint16(p+8,true),0);const name=d.decode(bytes.slice(p+30,p+30+n));output[name]=d.decode(bytes.slice(p+30+n+e,p+30+n+e+size));p+=30+n+e+size;}
  assert.equal(v.getUint32(p,true),0x02014b50);return output;
}

test('all requested columns, named parents, Turkish names and zero-prefixed identity strings',()=>{
  const r=report(state());assert.equal(r.basliklar.length,11);assert.deepEqual(r.satirlar[0],[1,'Çağrı İpek Şimşek','00000000001','02.10.2021','4 yaş 11 ay','Erkek','Nar Çiçekleri','Şule Şimşek','00000000002','İlker Şimşek','00000000003']);
  assert.equal(r.donem,'2026-2027');assert.equal(r.tarih,'2026-10-01');assert.match(ogrenciListeDosyaAdi(r,'xlsx'),/2026-2027_aktif_1-ogrenci_2026-10-01\.xlsx$/);
});
test('export excludes other years and archived/applicant records by default, ignores list filters',()=>{
  const s=state();s.filteredList=[];s.search='nobody';s.activeFilter='missing';
  s.ogrenciList.push({id:'other',aktifDonem:'2026-2027'},{id:'archived'},{id:'applicant'});
  s.ayarListesi.archived={durum:'arsiv'};s.ayarListesi.applicant={durum:'basvuru'};
  assert.equal(report(s).satirlar.length,1);assert.equal(ogrenciListeRaporu(s,{now,durumKapsami:'arsiv'}).satirlar.length,1);assert.throws(()=>ogrenciListeRaporu(s,{now,durumKapsami:'tumu'}));
});
test('active and archive categories are separate, year-scoped, and exclude applicants and renewal stages',()=>{
  const s=state({ogrenciList:[],ayarListesi:{}});
  const statuses=['aktif',' AKTIF ','AKTİF','arsiv','ARŞİV','pasif','PASIF','ayrildi','AYRILDI','ayrıldı','basvuru','yenileme','unknown'];
  statuses.forEach((durum,index)=>{const id=`category-${index}`;s.ogrenciList.push({id,ogrenciAdSoyad:`Kategori ${index}`});s.ayarListesi[id]={donemYili:s.aktifDonem,durum};});
  s.ogrenciList.push({id:'old-archive',durum:'arsiv',aktifDonem:'2025-2026'});
  const active=report(s),archive=ogrenciListeRaporu(s,{now,durumKapsami:'arsiv'});
  assert.equal(active.satirlar.length,3);assert.equal(archive.satirlar.length,7);
  assert.ok(active.satirlar.every(row=>!archive.satirlar.some(other=>other[1]===row[1])));
  for(const [r,scope,title] of [[active,'aktif','Aktif öğrenciler'],[archive,'arsiv','Arşiv öğrencileri']]){
    assert.equal(r.kapsam,title);assert.equal(r.satirlar[0][0],1);
    const files=unzipStored(ogrenciListeXlsxOlustur(r));assert.ok(files['xl/worksheets/sheet1.xml'].includes(title));
    assert.match(ogrenciListeDosyaAdi(r,'xlsx'),new RegExp(`2026-2027_${scope}_`));assert.match(ogrenciListeDosyaAdi(r,'pdf'),new RegExp(`2026-2027_${scope}_`));
  }
  s.ayarListesi['category-3'].durum='aktif';assert.equal(report(s).satirlar.length,4);assert.equal(ogrenciListeRaporu(s,{now,durumKapsami:'arsiv'}).satirlar.length,6);
});
test('explicit blanks never resurrect identities, unknown parents never borrow unlabeled contacts',()=>{
  const s=state();s.ogrenciList[0].veli1AdSoyad='Guardian';s.ogrenciList[0].veli2AdSoyad='Other Guardian';
  s.ayarListesi['fixture-a']={ogrenci:{adSoyad:'',tcKimlik:'',dogumTarihi:''},kayit:{sinif:''}};
  const row=report(s).satirlar[0];assert.deepEqual(row.slice(1,5),['','','','']);assert.deepEqual(row.slice(6),['','','','','']);
});
test('historical class comes only from that year, not newer master class',()=>{
  const s=state();s.aktifDonem='2025-2026';s.ogrenciDisAktarDurumu.donem=s.aktifDonem;s.ayarListesi['fixture-a']={durum:'aktif'};
  assert.equal(report(s).satirlar[0][6],'');s.ayarListesi['fixture-a'].kayit={sinif:'Tarihi Sınıf'};assert.equal(report(s).satirlar[0][6],'Tarihi Sınıf');
});
test('all nonmanagement and logged-out callers fail closed',()=>{
  for(const rol of ['muhasebe','egitim_koordinator','ogretmen','brans_ogretmeni','danisma','halkla_iliskiler','veli',null,'unknown']) {
    const s=state({rol});assert.equal(ogrenciListeYetkili(s),false);assert.throws(()=>report(s),/yetkiniz/);
  }
  assert.equal(ogrenciListeYetkili(state({rol:'kurucu_mudur'})),true);
  assert.equal(ogrenciListeYetkili(state({rol:null,isAdmin:true})),true);
  assert.throws(()=>report(state({currentUser:null})),/yetkiniz/);
});
test('partial, loading, stale-account and stale-year data cannot be exported',()=>{
  for(const patch of [{hazir:false},{hataSayisi:1},{donem:'2025-2026'},{uid:'other'}]){const s=state();Object.assign(s.ogrenciDisAktarDurumu,patch);assert.ok(ogrenciListeHazirlik(s));assert.throws(()=>report(s));}
  assert.throws(()=>report(state({ogrenciVerileriHazirMi:false})));const s=state();s.ayarListesi['fixture-a'].donemYili='2025-2026';assert.throws(()=>report(s),/uyuşmazlık/);
});
test('calendar dates do not shift across time zones; invalid/future dates remain blank',()=>{
  assert.equal(okulTakvimTarihi(new Date('2026-09-30T22:00:00Z')),'2026-10-01');
  assert.equal(dogumTakvimi('2021-10-02T00:00:00+03:00').iso,'2021-10-02');assert.equal(dogumTakvimi('2.10.2021').iso,'2021-10-02');
  for(const value of ['','abc','2021-02-29','2020-13-01','00.10.2021',null,0])assert.equal(dogumTakvimi(value),null);
  assert.equal(yasMetni(dogumTakvimi('2026-10-01'),dogumTakvimi('2026-10-01')),'0 yaş 0 ay');
  assert.equal(yasMetni(dogumTakvimi('2020-02-29'),dogumTakvimi('2026-02-28')),'5 yaş 11 ay');
  for(const dob of ['2027-01-01','bad','2021-02-29']){const s=state();s.ayarListesi['fixture-a'].ogrenci.dogumTarihi=dob;assert.deepEqual(report(s).satirlar[0].slice(3,5),['','']);}
});
test('sorting is Turkish class/name order, large lists are never paginated or truncated',()=>{
  const s=state({ogrenciList:[],ayarListesi:{}});for(let i=0;i<750;i++){const id=`synthetic-${i}`;s.ogrenciList.push({id,ogrenciAdSoyad:`Öğrenci ${String(i).padStart(4,'0')}`});s.ayarListesi[id]={durum:'aktif',kayit:{sinif:'Sınıf'}};}
  const r=report(s);assert.equal(r.satirlar.length,750);assert.equal(r.satirlar[749][0],750);const files=unzipStored(ogrenciListeXlsxOlustur(r));assert.match(files['xl/worksheets/sheet1.xml'],/r="K754"/);assert.match(files['xl/worksheets/sheet1.xml'],/autoFilter ref="A4:K754"/);
});
test('XLSX is actual OOXML with safe strings, freeze panes, print headers and full column range',()=>{
  const r=report(state());r.satirlar[0][1]='=HYPERLINK("https://example.invalid","Şule & <İpek>")';r.satirlar[0][7]='+1+2';r.satirlar[0][9]='@SUM(A1:A2)';
  const files=unzipStored(ogrenciListeXlsxOlustur(r)),sheet=files['xl/worksheets/sheet1.xml'];assert.equal(Object.keys(files).length,6);
  assert.match(sheet,/t="inlineStr"><is><t xml:space="preserve">00000000001/);assert.match(sheet,/=HYPERLINK/);assert.match(sheet,/&amp; &lt;İpek&gt;/);assert.doesNotMatch(sheet,/<f[ >]/);assert.match(sheet,/ySplit="4"/);assert.match(sheet,/orientation="landscape"/);assert.match(files['xl/workbook.xml'],/Print_Titles/);
});

function loaderFixture(){
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');const source=html.slice(html.indexOf('async function loadAyarlar() {'),html.indexOf('\nfunction ogrenciSekmesiAktifMi()'));
  const reads=[];const context=vm.createContext({AKTIF_DONEM:'2025-2026',currentUser:{uid:'synthetic-admin'},ogrenciDonemYuklemeSurumu:0,ogrenciDisAktarDurumu:{},ogrenciList:Array.from({length:6},(_,i)=>({id:`fixture-${i}`})),isAdmin:true,aktifKullaniciRol:'mudur',db:{},ogrenciListeDisaAktarmaGuncelle(){},setTimeout,
    doc:(_db,...parts)=>parts.join('/'),getDoc(path){return new Promise((resolve,reject)=>reads.push({path,resolve,reject}));}});
  vm.runInContext(source,context);return {context,reads,load:()=>vm.runInContext('loadAyarlar()',context)};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
test('year change during period reads never mixes old/new years and publishes only latest load',async()=>{
  const f=loaderFixture(),old=f.load();assert.equal(f.reads.length,3);f.context.AKTIF_DONEM='2026-2027';const current=f.load();assert.equal(f.reads.length,6);
  for(const read of f.reads.slice(0,3))read.resolve({exists:()=>true,data:()=>({donemYili:'2025-2026'})});await old;
  for(const read of f.reads.slice(3,6))read.resolve({exists:()=>true,data:()=>({donemYili:'2026-2027'})});await tick();
  for(const read of f.reads.slice(6))read.resolve({exists:()=>true,data:()=>({donemYili:'2026-2027'})});await current;
  assert.equal(f.reads.length,9);assert.equal(Object.keys(f.context.ayarListesi).length,6);assert.ok(Object.values(f.context.ayarListesi).every(v=>v.donemYili==='2026-2027'));assert.equal(f.context.ogrenciDisAktarDurumu.donem,'2026-2027');
});
test('period read errors block export completeness; explicit retry can restore it',async()=>{
  const f=loaderFixture();f.context.ogrenciList=f.context.ogrenciList.slice(0,2);let done=f.load();f.reads[0].reject(Error('fixture-permission-denied'));f.reads[1].resolve({exists:()=>false});await done;
  assert.equal(f.context.ogrenciDisAktarDurumu.hataSayisi,1);assert.equal(f.context.ogrenciDisAktarDurumu.hazir,true);
  done=f.load();for(const read of f.reads.slice(2))read.resolve({exists:()=>true,data:()=>({})});await done;assert.equal(f.context.ogrenciDisAktarDurumu.hataSayisi,0);
});
