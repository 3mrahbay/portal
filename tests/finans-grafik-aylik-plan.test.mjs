import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('charts use actual contract months and month-specific fee overrides', () => {
  const charts = [];
  const mockCanvas = {getContext:()=>({})};
  const student = {id:'s1'};
  const period = {
    aidatAyarlari:{baslangicAyi:'2026-09',gercekAySayisi:2,aylikAidat:100,iDonemAylik:100},
    aylikOdemeler:{'2026-09':{beklenenTutar:0},'2026-10':{beklenenTutar:80}}
  };
  class FakeDate extends Date {
    constructor(...args){super(...(args.length?args:['2026-10-08T12:00:00Z']));}
  }
  class Chart {constructor(canvas,config){charts.push(config);this.config=config;}destroy(){}}
  const B = {
    db:{},collection(){},doc(){},getDoc(){},getDocs(){},setDoc(){},updateDoc(){},deleteDoc(){},
    escapeHtml:s=>s,getOgrenciDurum:()=> 'aktif',isoTarih(){},
    haftaBaslangic(){},haftaKodu(){},haftaEtiketi(){},
    AY_ISIMLERI:['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
    YEMEK_GUNLER:[],YEMEK_OGUNLER:[],
    ogrenciler:()=>[student],ayarlar:()=>({s1:period}),gelirler:()=>[],giderler:()=>[]
  };
  const window={BCK:B};const context={window,document:{getElementById:()=>mockCanvas},Chart,Date:FakeDate,console};
  runInNewContext(readFileSync(new URL('../portal-finans-grafik.js',import.meta.url),'utf8'),context);
  window.cizAylikTahsilatVsHedef();
  assert.deepEqual(Array.from(charts.at(-1).data.datasets[0].data),[0,80,0,0,0,0,0,0,0,0,0,0]);
  window.cizTahsilatTrendi();
  assert.deepEqual(Array.from(charts.at(-1).data.datasets[1].data),[0,80,80,80,80,80,80,80,80,80,80,80]);
});
