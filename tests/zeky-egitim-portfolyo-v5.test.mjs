import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onayliGaleriGetir, portfolyoOlustur } from '../js/zeky-egitim-portfolyo.js';
import { egitimOnayiniEsitle } from '../js/zeky-galeri-onay-egitim.js';

const kok = new URL('../', import.meta.url);
const anahtar = 'gunluk__On Calismalar__Sandalye Tasima';

test('yönetim onayı bekleyen fotoğraflı sunum veli portföyüne erken düşmez', () => {
  const gelisim = { montessori:{ kayitlar:{[anahtar]:'S'}, detay:{[anahtar]:{durum:'S',asamalar:{S:{durum:'S',tarih:'2026-09-18T09:00:00Z',not:'Dikkatle izledi',galeriId:'g1',fotoDurum:'beklemede',paylas:true}}}}}};
  assert.equal(portfolyoOlustur(gelisim,[]).length,0);
});

test('onaylanan galeri kaydı fotoğraf ve açıklamayla doğru aşamaya birleşir', () => {
  const gelisim = { montessori:{ kayitlar:{[anahtar]:'S'}, detay:{[anahtar]:{durum:'S',asamalar:{S:{durum:'S',tarih:'2026-09-18T09:00:00Z',galeriId:'g1',fotoDurum:'beklemede',paylas:true}}}}}};
  const galeri = [{id:'g1',durum:'onaylandi',egitimKaydi:true,program:'montessori',kazanimAnahtari:anahtar,gozlemDurum:'S',kazanimAdi:'Sandalye Taşıma',alanId:'gunluk',alanAd:'Günlük Yaşam',aciklama:'Çalışmayı bağımsız tamamladı.',bunnyUrl:'https://cdn.test/g1.jpg',tarih:'2026-09-18T10:00:00Z'}];
  const [sunum] = portfolyoOlustur(gelisim,galeri);
  assert.equal(sunum.galeriId,'g1');
  assert.equal(sunum.fotoUrl,'https://cdn.test/g1.jpg');
  assert.equal(sunum.not,'Çalışmayı bağımsız tamamladı.');
  assert.equal(sunum.alanAd,'Günlük Yaşam');
});

test('onaylı galeri okuyucusu yalnız seçili çocuğun eğitim kayıtlarını döndürür', async () => {
  const belgeler=[
    {id:'g1',data:()=>({durum:'onaylandi',ogrenciId:'o1',egitimKaydi:true,program:'montessori',kazanimAnahtari:anahtar,gozlemDurum:'S',bunnyUrl:'https://cdn.test/g1.jpg'})},
    {id:'g2',data:()=>({durum:'onaylandi',ogrenciId:'o2',egitimKaydi:true,program:'montessori',kazanimAnahtari:anahtar,gozlemDurum:'S',bunnyUrl:'https://cdn.test/g2.jpg'})},
    {id:'g3',data:()=>({durum:'onaylandi',ogrenciId:'o1',kategori:'etkinlik',bunnyUrl:'https://cdn.test/g3.jpg'})}
  ];
  const fb={collection:()=>({}),where:(...x)=>x,query:(...x)=>x,getDocs:async()=>({forEach:f=>belgeler.forEach(f)})};
  const sonuc=await onayliGaleriGetir('o1',{fb,db:{}});
  assert.deepEqual(sonuc.map(x=>x.id),['g1']);
});

test('veli eğitim ekranı son üç, son on, alan yüzdeleri ve kazanım ağını sunar', async () => {
  const s=await readFile(new URL('moduller/veli-egitim-gelisim.js',kok),'utf8');
  assert.match(s,/SON 3 SUNUM/);
  assert.match(s,/slice\(0,10\)/);
  assert.match(s,/Kazanım ağı/);
  assert.match(s,/Program ilerlemesi/);
  assert.match(s,/Alan ilerlemesi/);
  assert.match(s,/Dönem Raporu/);
});

test('yönetim onayı gelişim belgesini ve deterministik veli bildirimini eşitler', async () => {
  const s=await readFile(new URL('js/zeky-galeri-onay-egitim.js',kok),'utf8');
  assert.match(s,/galeriBelgesi\(id\)/);
  assert.match(s,/ogrenciGelisim/);
  assert.match(s,/`egitim_\$\{id\}`/);
  assert.match(s,/fotoDurum:'onaylandi'/);
  assert.match(s,/sonGozlem/);
  assert.match(s,/onayliKayitlariOnar/);
  assert.match(s,/onarilanKayitlar/);
});

test('onay eşitlemesi çekirdek galeri biçimini veli gelişimi ve bildirime yazar', async () => {
  const yazilan=[];
  const galeri={durum:'onaylandi',egitimKaydi:true,program:'montessori',ogrenciId:'o1',kazanimAnahtari:anahtar,gozlemDurum:'S',baslik:'Sandalye Taşıma',aciklama:'Bağımsız tamamladı.',bunnyUrl:'https://cdn.test/g1.jpg',tarih:'2026-09-18T10:00:00Z'};
  const fb={
    doc:(_db,...parcalar)=>parcalar.join('/'),
    getDoc:async yol=>yol==='galeri/g1'?{exists:()=>true,data:()=>galeri}:{exists:()=>false,data:()=>({})},
    setDoc:async(yol,veri,secenek)=>yazilan.push({yol,veri,secenek}),
    serverTimestamp:()=>({seconds:1})
  };
  const onceki=globalThis.window;
  globalThis.window={PortalAPI:{db:{},fb}};
  try{
    assert.equal(await egitimOnayiniEsitle('g1','onaylandi'),true);
  }finally{
    if(onceki===undefined)delete globalThis.window;else globalThis.window=onceki;
  }
  assert.deepEqual(yazilan.map(x=>x.yol),['ogrenciGelisim/o1','ogrenciler/o1/bildirimler/egitim_g1']);
  const gelisim=yazilan[0].veri.montessori;
  assert.equal(gelisim.kayitlar[anahtar],'S');
  assert.equal(gelisim.detay[anahtar].asamalar.S.fotoDurum,'onaylandi');
  assert.equal(gelisim.detay[anahtar].asamalar.S.fotoUrl,'https://cdn.test/g1.jpg');
  assert.equal(yazilan[1].veri.icerik,'Bağımsız tamamladı.');
});

test('öğretmen fotoğraflı sunumu onaydan önce veliye bildirmez', async () => {
  const s=await readFile(new URL('moduller/ogretmen-egitim-gozlem.js',kok),'utf8');
  assert.match(s,/\['beklemede','onayBekliyor'\]\.includes\(foto\.durum/);
  assert.match(s,/if\(foto&&.*\)return/);
});

test('günlük akış eğitim sunumlarıyla veli ve öğrenci hareketlerini birleştirir', async () => {
  const s=await readFile(new URL('js/zeky-veli-ogrenme-deneyimi.js',kok),'utf8');
  assert.match(s,/bugununSunumlari/);
  assert.match(s,/sabahGirisleri/);
  assert.match(s,/veliIzinleri/);
  assert.match(s,/bildirimler\|\|\[\]/);
  assert.match(s,/fotoDurum/);
});

test('dönem raporu akademik dil, alan görseli ve gelişim grafikleri üretir', async () => {
  const s=await readFile(new URL('js/zeky-veli-donem-raporu.js',kok),'utf8');
  assert.match(s,/PROGRAM_DILI/);
  assert.match(s,/Portföyden örnek/);
  assert.match(s,/Alan bazında gelişim grafiği/);
  assert.match(s,/PDF \/ Yazdır/);
  assert.match(s,/s\.fotoUrl/);
});
