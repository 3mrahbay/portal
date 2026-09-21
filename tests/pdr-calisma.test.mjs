import test from 'node:test';
import assert from 'node:assert/strict';
import {yetkili,kayitDogrula,oncelik,geciken,raporHTML,tarihGecerli} from '../js/pdr/core.js';
import {prepare} from '../security/prepare-pdr-rules.mjs';
import {readFileSync} from 'node:fs';
const ogrenciler=[{id:'a',ad:'Örnek Çocuk',sinif:'Çiçekler'}];
const k={rol:'pdr',email:'pdr@example.test'};
const base={ogrenciId:'a',tur:'destek',durum:'suruyor',tarih:'2026-09-21',takipTarihi:'2026-09-28',baslik:'Uyum desteği',ozet:'Gözlenen durum',hedef:'Gruba katılım',veliylePaylas:true};
test('PDR ve yetkili yönetim; veli, öğretmen, danışma, koordinatör hariç',()=>{for(const rol of ['pdr','mudur','kurucu_mudur'])assert.equal(yetkili({rol}),true);for(const rol of ['veli','ogretmen','danisma','egitim_koordinator','muhasebe',null])assert.equal(yetkili({rol}),false);});
test('Özel kayıt veliye açılmaz; aktif öğrenci ve dönem doğrulanır',()=>{const r=kayitDogrula(base,ogrenciler,k,'2026-2027');assert.equal(r.veliylePaylas,false);assert.equal(r.ogrenciAd,'Örnek Çocuk');assert.throws(()=>kayitDogrula({...base,ogrenciId:'eski'},ogrenciler,k,'2026-2027'));assert.throws(()=>kayitDogrula(base,ogrenciler,k,''));assert.throws(()=>kayitDogrula(base,ogrenciler,{rol:'veli'},'2026-2027'));});
test('Destek planı hedef/takip gerektirir; sonuç olmadan kapanmaz',()=>{for(const patch of [{hedef:''},{takipTarihi:''},{takipTarihi:'2026-09-20'},{durum:'tamamlandi'},{tarih:'2026-02-30'}])assert.throws(()=>kayitDogrula({...base,...patch},ogrenciler,k,'2026-2027'));assert.equal(kayitDogrula({...base,durum:'tamamlandi',sonuc:'Hedef gözlendi'},ogrenciler,k,'2026-2027').durum,'tamamlandi');});
test('Alan bazında takip kaybolmaz; aynı alandaki yeni gözlem önceliklidir',()=>{const gs=[{alan:'sosyal',seviye:'takip',tarih:'2026-09-01'},{alan:'dil',seviye:'tipik',tarih:'2026-09-21'}];assert.equal(oncelik(gs),'takip');gs.push({alan:'sosyal',seviye:'tipik',tarih:'2026-09-22'});assert.equal(oncelik(gs),'tipik');assert.equal(oncelik([]),'yok');});
test('Tamamlanan plan gecikmiş sayılmaz',()=>{assert.equal(geciken({durum:'tamamlandi',takipTarihi:'2026-09-01'},'2026-09-21'),false);assert.equal(geciken({durum:'suruyor',takipTarihi:'2026-09-01'},'2026-09-21'),true);assert.equal(tarihGecerli('2026-02-30'),false);});
test('Rapor tarih filtresi ve HTML kaçışı; uydurma puan yok',()=>{const html=raporHTML(ogrenciler[0],[{tarih:'2026-09-21',alan:'sosyal',seviye:'takip',not:'<script>test</script>'},{tarih:'2026-08-01',alan:'dil',not:'ESKI_KAYIT'}],[],[],{baslangic:'2026-09-01'});assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('ESKI_KAYIT'));assert.ok(html.includes('Yakın takip'));});
test('Kural hazırlayıcı mevcut kuralları korur ve ikinci eklemeyi reddeder',()=>{const snippet=readFileSync(new URL('../security/pdr.rules.snippet',import.meta.url),'utf8');const source="rules_version = '2';\nmatch /duyurular/{id} { allow read: if isSignedIn(); }\nmatch /etkinlikler/{id} { allow read: if true; }\nmatch /takvim/{id} { allow read: if isSignedIn(); }\n    // ====== PDR — ÖZEL NİTELİKLİ KİŞİSEL VERİ (KVKK md.6) ======\n";const result=prepare(source,snippet);assert.ok(result.includes('allow read: if true;'));assert.equal((result.match(/allow create: if isPdr\(\)/g)||[]).length,3);assert.throws(()=>prepare(result,snippet));assert.throws(()=>prepare('different rules',snippet));});

test('Kayıt adaptörü kimliği oturumdan alır; güncelleme oluşturanı değiştirmez',async()=>{
  const {pdrStore}=await import('../js/pdr/store.js');const writes=[];
  const fb={collection:(_,name)=>name,doc:(_,name,id)=>({name,id}),serverTimestamp:()=>'<server>',addDoc:async(ref,data)=>{writes.push({ref,data});return {id:'new'};},updateDoc:async(ref,data)=>writes.push({ref,data})};
  const store=pdrStore(fb,{},()=>({...k,ad:'Uzman'}));const veri=kayitDogrula(base,ogrenciler,k,'2026-2027');await store.kaydet(veri);await store.kaydet({...veri,veliylePaylas:true},'new');
  assert.equal(writes[0].data.uzmanEmail,k.email);assert.equal(writes[1].data.veliylePaylas,false);assert.ok(!('uzmanEmail' in writes[1].data));assert.equal(writes[1].data.guncelleyen,k.email);
});
