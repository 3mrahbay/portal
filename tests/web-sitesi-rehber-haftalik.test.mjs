// Web Sitesi paneli: Veli Rehberi düzenleme ve haftalık görseller (moduller/web-sitesi.js)
// Sözleşme: webSitesi/rehber yalnız varsayılandan farklı alanları taşır; webSitesi/haftalik
// sunucunun seçimidir (panel kareyi gizler/düzeltir), webSitesi/haftalikAyar aç/kapa ve hariç listesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// vm içinde oluşan nesneler başka bir gerçeklikten gelir; karşılaştırmadan önce sade JSON'a çevrilir.
const j = (x) => JSON.parse(JSON.stringify(x));
const source = readFileSync(new URL('../moduller/web-sitesi.js', import.meta.url), 'utf8');

const SITE_VARS = {genel:{},duyuru:{aktif:false,metin:''},slaytlar:{liste:[]},kutular:{liste:[]},sss:{gruplar:[]},gorseller:{'orman-sirt':{'640':[640,800]}}};
const REHBER_VARS = {
  kategoriler:[{anahtar:'montessori',baslik:"Montessori'yi anlamak"},{anahtar:'orman',baslik:'Orman okulu ve doğa'}],
  yazilar:[
    {slug:'maria-montessori-kimdir',kat:'montessori',baslik:'Maria Montessori kimdir?',ozet:'Hayatı ve yöntemin doğuşu.',
      govde:'<p>Maria Montessori bir <a href="/montessori">hekimdi</a>.</p><h2>Yöntem</h2><ul><li>Gözlem</li></ul>',gorsel:{yerel:'montessori-silindir-blok',alt:'Silindir bloklar'},adres:'/veli-rehberi/maria-montessori-kimdir'},
    {slug:'orman-okulu-nedir',kat:'orman',baslik:'Orman okulu nedir?',ozet:'Dışarıda öğrenmek.',govde:'<p>Orman okulu…</p>',gorsel:{yerel:'orman-sirt',alt:'Ormanda'},adres:'/veli-rehberi/orman-okulu-nedir'},
    {slug:'Kotu Slug!',kat:'orman',baslik:'atlanır',ozet:'',govde:''},
  ],
};

function harness({saved = {}, rehberVars = REHBER_VARS, failWrite = false} = {}) {
  const writes = [], tx = [], messages = [];
  const store = structuredClone(saved);
  const fb = {
    doc:(_db,col,id)=>({col,id}), serverTimestamp:()=> 'SERVER_TIME',
    getDoc:async(ref)=>({metadata:{fromCache:false},exists:()=>ref.id in store,data:()=>structuredClone(store[ref.id])}),
    setDoc:async(ref,value,opt)=>{if(failWrite)throw Error('permission-denied');writes.push({ref,value,opt});store[ref.id]=opt&&opt.merge?{...(store[ref.id]||{}),...value}:value;},
    runTransaction:async(_db,fn)=>{
      const pending=[];
      await fn({
        get:async(ref)=>({exists:()=>ref.id in store,data:()=>structuredClone(store[ref.id])}),
        update:(ref,value)=>pending.push(['update',ref,value]),
        set:(ref,value,opt)=>pending.push(['set',ref,value,opt]),
      });
      if(failWrite)throw Error('permission-denied');
      for(const [tur,ref,value,opt] of pending){
        tx.push({tur,ref,value,opt});
        if(tur==='update'){const d=store[ref.id];for(const [k,v] of Object.entries(value)){if(k.includes('.')){const [a,b]=k.split('.');d[a]={...(d[a]||{}),[b]:v};}else d[k]=v;}}
        else store[ref.id]=opt&&opt.merge?{...(store[ref.id]||{}),...value}:value;
      }
    },
  };
  const context = vm.createContext({console,structuredClone,
    fetch:async(url)=>({ok:true,json:async()=>structuredClone(String(url).endsWith('/rehber-varsayilan.json')?rehberVars:SITE_VARS)}),
    window:{addEventListener(){},PortalAPI:{auth:{currentUser:{email:'emrahby@gmail.com'}},db:{},toast:(m)=>messages.push(m),fb}}});
  vm.runInContext(source.replace(/export /g,'') + `
window.testing={yukle,kaydet,dogrula,degisti,temizle,rehberTemizle,guvenliHref,rehberFark,rehberBoyutHatasi,utf8Boyut,haricEkle,haricCikar,
  haftalikOzetMetni,alanBasinaCoz,haftalikAcikMi,haftalikOgeGuncelle,haftalikAyarYaz,HAFTALIK_ALANLAR,RB_SINIR,
  D:()=>D,RV:()=>RV,H:()=>H,HA:()=>HA,setRS:(x)=>{RS=x;}};`, context);
  return {api:context.window.testing,writes,tx,messages,store};
}

// ───────── temizleyici ─────────
test('temizleyici: izinli etiketler aynen kalır', () => {
  const {api} = harness();
  const html = '<h2>Başlık</h2><h3>Alt</h3><p>Bir <strong>kalın</strong>, <em>italik</em>, <b>b</b> ve <i>i</i>.<br>Satır</p><ul><li>bir</li><li>iki</li></ul><ol><li>1</li></ol><blockquote><p>alıntı</p></blockquote><p><a href="/montessori">iç</a> <a href="https://example.com/x?a=1&amp;b=2">dış</a> <a href="mailto:eposta@bircicekkoleji.com">e</a> <a href="tel:+902163935457">t</a> <a href="#kaynak">#</a></p>';
  assert.equal(api.rehberTemizle(html), html);
});

test('temizleyici: betik, stil, olay öznitelikleri ve tehlikeli adresler atılır', () => {
  const {api} = harness();
  const kirli = '<p onclick="alert(1)" style="color:red" class="x">Merhaba<script>alert(1)</script><style>p{}</style></p>'
    + '<img src=x onerror="alert(1)"><iframe src="https://kotu"></iframe><svg/><svg onload=alert(1)><circle/></svg>'
    + '<a href="javascript:alert(1)">js</a> <a href="JaVaScRiPt&#58;alert(1)">ent</a> <a href=" java\tscript:alert(1)">tab</a>'
    + ' <a href="data:text/html,x">data</a> <a href="//kotu.com">pr</a> <a href="vbscript:x">vb</a><!-- yorum --><p>son</p>';
  const temiz = api.rehberTemizle(kirli);
  assert.doesNotMatch(temiz, /script|style|onclick|onerror|onload|iframe|svg|img|javascript|data:|vbscript|kotu|yorum|class=/i);
  assert.match(temiz, /^<p>Merhaba<\/p>/);
  assert.match(temiz, /js ent tab data pr vb/);   // geçersiz bağlantının yazısı kalır
  assert.match(temiz, /<p>son<\/p>$/);
});

test('temizleyici: düzenleyici artıkları paragraflara dönüşür, dengesiz etiketler kapanır', () => {
  const {api} = harness();
  assert.equal(api.rehberTemizle('<div>bir</div><div>iki</div><div><br></div>'), '<p>bir</p><p>iki</p>');
  assert.equal(api.rehberTemizle('<h1>Ana</h1><h4>Ara</h4>'), '<h2>Ana</h2><h3>Ara</h3>');
  assert.equal(api.rehberTemizle('<p><strong>açık kaldı<p>yeni'), '<p><strong>açık kaldı</strong></p><p>yeni</p>');
  assert.equal(api.rehberTemizle('<li>tek madde</li>'), '<p>tek madde</p>');
  assert.equal(api.rehberTemizle('<span style="x">düz <font>yazı</font></span> 1 < 2 > 0'), 'düz yazı 1 &lt; 2 &gt; 0');
  assert.equal(api.rehberTemizle('<a href="/a"><a href="/b">iç içe</a></a>'), '<a href="/a">iç içe</a>');
  assert.equal(api.rehberTemizle('<a href="https://x.com/&quot;onmouseover=&quot;">q</a>'), '<a href="https://x.com/&quot;onmouseover=&quot;">q</a>');
});

test('temizleyici: sitedeki tablo, numaralı liste başlangıcı ve not paragrafı korunur', () => {
  const {api} = harness();
  const tablo = '<div class="table-wrap"><table><thead><tr><th></th><th>Klasik</th></tr></thead><tbody><tr><td><strong>Kim?</strong></td><td>Öğretmen</td></tr></tbody></table></div><p class="muted small">Not</p><ol start="4"><li>dört</li></ol>';
  assert.equal(api.rehberTemizle(tablo), tablo);
  assert.equal(api.rehberTemizle('<table><tr><td>a<td>b<tr><th>c</table>'), '<table><tr><td>a</td><td>b</td></tr><tr><th>c</th></tr></table>');
  assert.equal(api.rehberTemizle('<div class="evil table-wrap" onclick="x">t</div>'), '<div class="table-wrap">t</div>');
  assert.equal(api.rehberTemizle('<p class="muted evil" id="x">m</p><ol start="-3"><li>a</li></ol><ol start="2x"><li>b</li></ol>'), '<p class="muted">m</p><ol><li>a</li></ol><ol><li>b</li></ol>');
  assert.equal(api.rehberTemizle('<td>x</td><td>y</td><tr>z'), 'x y<p>z</p>');
});

test('güvenli bağlantı adresi yalnız http(s), mailto, tel, / ve # kabul eder', () => {
  const {api} = harness();
  for (const ok of ['https://a.com', 'http://a.com/x', 'mailto:a@b.co', 'tel:+90', '/orman-okulu', '#x']) assert.ok(api.guvenliHref(ok), ok);
  for (const kotu of ['javascript:x', ' javascript:x', 'jav&#x61;script:x', 'data:x', '//a.com', '/\\a.com', 'https://', 'ftp://a', 'orman-okulu', '']) assert.equal(api.guvenliHref(kotu), '', kotu);
});

// ───────── değişiklik farkı ve kayıt ─────────
test('yalnız değişen alanlar kaydedilir; değişmeyen yazı belgeye girmez', async () => {
  const h = harness();
  await h.api.yukle();
  const D = h.api.D();
  assert.deepEqual(j(Object.keys(h.api.RV().harita).sort()), ['maria-montessori-kimdir', 'orman-okulu-nedir']); // geçersiz slug atlandı
  assert.equal(h.api.degisti('rehber'), false);
  // aynı değerleri yazmak değişiklik sayılmaz (boşluk farkı dahil)
  D.rehber.yazilar['orman-okulu-nedir'] = {baslik:'  Orman okulu nedir? ', ozet:'Dışarıda öğrenmek.', govde:'<div>Orman okulu…</div>'};
  assert.equal(h.api.degisti('rehber'), false);
  D.rehber.yazilar['maria-montessori-kimdir'] = {baslik:'Maria Montessori kimdir? Hayatı', ozet:'Hayatı ve yöntemin doğuşu.',
    govde:'<p>Maria Montessori bir <a href="/montessori">hekimdi</a>.</p><h2>Yöntem</h2><ul><li>Gözlem</li></ul>',
    gorsel:{url:'https://bcka.b-cdn.net/web-sitesi/2026-10/a.jpg',en:1280,boy:1600,alt:'Silindir bloklar'}};
  assert.equal(h.api.degisti('rehber'), true);
  assert.equal(await h.api.kaydet('rehber'), true);
  assert.equal(h.writes.length, 1);
  const w = h.writes[0];
  assert.deepEqual([w.ref.col, w.ref.id], ['webSitesi', 'rehber']);
  assert.deepEqual(j(Object.keys(w.value.yazilar)), ['maria-montessori-kimdir']);
  const y = w.value.yazilar['maria-montessori-kimdir'];
  assert.deepEqual(j(Object.keys(y).sort()), ['baslik', 'gorsel', 'guncellendi']);
  assert.equal(y.baslik, 'Maria Montessori kimdir? Hayatı');
  assert.deepEqual(j(y.gorsel), {url:'https://bcka.b-cdn.net/web-sitesi/2026-10/a.jpg',alt:'Silindir bloklar',en:1280,boy:1600});
  assert.match(y.guncellendi, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(w.value.guncelleyen, 'emrahby@gmail.com');
  assert.equal(w.value.guncellendi, 'SERVER_TIME');
  assert.equal(h.api.degisti('rehber'), false);
});

test('kayıtlı değişiklikler yüklenir; değişmeyen yazının zamanı korunur, metin yeniden temizlenir', async () => {
  const h = harness({saved:{rehber:{yazilar:{'orman-okulu-nedir':{ozet:'Yeni özet',guncellendi:'2026-10-01T00:00:00.000Z'}}}}});
  await h.api.yukle();
  assert.equal(h.api.degisti('rehber'), false);
  h.api.D().rehber.yazilar['maria-montessori-kimdir'] = {govde:'<p onclick="x">Yeni <script>kötü()</script>metin</p>'};
  assert.equal(await h.api.kaydet('rehber'), true);
  const y = h.writes[0].value.yazilar;
  assert.equal(y['orman-okulu-nedir'].guncellendi, '2026-10-01T00:00:00.000Z');
  assert.equal(y['maria-montessori-kimdir'].govde, '<p>Yeni metin</p>');
});

test('boş başlık / özet / metin kaydedilmez', async () => {
  const h = harness();
  await h.api.yukle();
  h.api.D().rehber.yazilar['orman-okulu-nedir'] = {baslik:'   '};
  assert.match(h.api.dogrula('rehber'), /başlığı boş/);
  h.api.D().rehber.yazilar['orman-okulu-nedir'] = {govde:'<p><br></p>'};
  assert.match(h.api.dogrula('rehber'), /metni boş/);
  assert.equal(await h.api.kaydet('rehber'), false);
  assert.equal(h.writes.length, 0);
});

test('900 KB sınırını aşan Veli Rehberi belgesi kaydedilmez', async () => {
  const h = harness();
  await h.api.yukle();
  assert.equal(h.api.rehberBoyutHatasi({yazilar:{a:{govde:'x'.repeat(1000)}}}), '');
  assert.match(h.api.rehberBoyutHatasi({yazilar:{a:{govde:'ğ'.repeat(470 * 1024)}}}), /çok büyüdü \(\d+ KB\)/); // 2 bayt/karakter
  assert.equal(h.api.utf8Boyut('aç🌳'), 1 + 2 + 4);
  h.api.D().rehber.yazilar['orman-okulu-nedir'] = {govde:'<p>' + 'ö'.repeat(h.api.RB_SINIR / 2 + 10) + '</p>'};
  assert.match(h.api.dogrula('rehber'), /çok büyüdü/);
  assert.equal(await h.api.kaydet('rehber'), false);
  assert.equal(h.writes.length, 0);
});

test('varsayılanlar alınamazsa Veli Rehberi kaydedilmez, diğer bölümler çalışır', async () => {
  const h = harness({rehberVars:{bozuk:true}, saved:{rehber:{yazilar:{'orman-okulu-nedir':{ozet:'Kayıtlı'}}}}});
  await h.api.yukle();
  assert.equal(h.api.RV(), null);
  assert.equal(h.api.D().rehber.yazilar['orman-okulu-nedir'].ozet, 'Kayıtlı');
  assert.equal(h.api.degisti('rehber'), false);
  h.api.D().rehber.yazilar['orman-okulu-nedir'].ozet = 'Değişti';
  assert.equal(await h.api.kaydet('rehber'), false);
  h.api.D().duyuru.metin = 'Duyuru';
  assert.equal(await h.api.kaydet('duyuru'), true);
  assert.deepEqual(j(h.writes.map((w) => w.ref.id)), ['duyuru']);
});

// ───────── haftalık görseller ─────────
test('alan listesi sözleşmedeki yedi alanla birebir ve sırayla aynı', () => {
  const {api} = harness();
  assert.deepEqual(j(api.HAFTALIK_ALANLAR.map((a) => a.anahtar)), ['montessori', 'orman', 'degerler', 'ingilizce', 'ahsap', 'piyano', 'branslar']);
  assert.deepEqual(j(api.HAFTALIK_ALANLAR.map((a) => a.sayfa)), ['/montessori', '/orman-okulu', '/degerler-egitimi', '/atolyeler-ve-dersler', '/atolyeler-ve-dersler', '/piyano', '/brans-dersleri']);
});

test('hariç listesi en yeni 500 kaydı tutar, tekrar etmez', () => {
  const {api} = harness();
  const eski = Array.from({length: 500}, (_, i) => 'g' + i);
  const yeni = api.haricEkle(eski, 'yeni');
  assert.equal(yeni.length, 500);
  assert.equal(yeni[0], 'g1');
  assert.equal(yeni.at(-1), 'yeni');
  assert.deepEqual(j(api.haricEkle(['a', 'b'], 'a')), ['b', 'a']);
  assert.deepEqual(j(api.haricEkle(undefined, 'a')), ['a']);
  assert.deepEqual(j(api.haricCikar(['a', 'b', 'a'], 'a')), ['b']);
});

test('ayar varsayılanları: belge yoksa açık, alan başına 3', () => {
  const {api} = harness();
  assert.equal(api.haftalikAcikMi(undefined), true);
  assert.equal(api.haftalikAcikMi({}), true);
  assert.equal(api.haftalikAcikMi({acik:false}), false);
  assert.deepEqual([undefined, 0, 1, 4, 5, '2', 'x'].map((v) => api.alanBasinaCoz(v)), [3, 3, 1, 4, 3, 2, 3]);
  assert.equal(api.haftalikOzetMetni({aday:41, secilen:9, yazili:3, yuzFazla:2, izin:1}),
    '41 onaylı fotoğraf incelendi, 9 kare seçildi; 3 yazılı görsel, 2 kalabalık ya da yüzü çok yakın kare, 1 fotoğraf izni nedeniyle kare atlandı.');
  assert.equal(api.haftalikOzetMetni({secilen:0}), '0 kare seçildi.');
});

const HAFTALIK = {surum:1, hafta:'2026-10-19', aralik:'19–25 Ekim 2026', kaynak:'otomatik', alanlar:{
  montessori:[{id:'g1',u640:'https://x/1-640.webp',u1280:'https://x/1-1280.webp',alt:'Montessori',tarih:'2026-10-20',hafta:'2026-10-19',gizli:false},
              {id:'g2',u640:'https://x/2-640.webp',u1280:'',alt:'Montessori',tarih:'2026-10-21',hafta:'2026-10-19',gizli:false}],
  orman:[{id:'g3',u640:'https://x/3-640.webp',alt:'Orman',tarih:'2026-10-20',hafta:'2026-10-12'}]}};

test('Kaldır: kare gizlenir, hariç listesine eklenir; diğer kareler ve alanlar korunur', async () => {
  const h = harness({saved:{haftalik:HAFTALIK, haftalikAyar:{acik:true, haric:['eski']}}});
  await h.api.yukle();
  await h.api.haftalikOgeGuncelle('montessori', 'g2', (o) => ({...o, gizli:true}), (ayar) => ({haric:h.api.haricEkle(ayar.haric, 'g2')}));
  const s = h.store;
  assert.equal(s.haftalik.alanlar.montessori[1].gizli, true);
  assert.equal(s.haftalik.alanlar.montessori[0].gizli, false);
  assert.equal(s.haftalik.alanlar.montessori[1].u640, 'https://x/2-640.webp');
  assert.deepEqual(j(s.haftalik.alanlar.orman), HAFTALIK.alanlar.orman);
  assert.equal(s.haftalik.kaynak, 'panel');
  assert.deepEqual(j(s.haftalikAyar.haric), ['eski', 'g2']);
  assert.equal(s.haftalikAyar.acik, true);
  assert.equal(s.haftalikAyar.guncelleyen, 'emrahby@gmail.com');
  assert.deepEqual(h.tx.map((x) => [x.tur, x.ref.id, Object.keys(x.value).sort().join(',')]),
    [['update', 'haftalik', 'alanlar.montessori,guncellendi,guncelleyen,kaynak'], ['set', 'haftalikAyar', 'guncellendi,guncelleyen,haric']]);
  assert.equal(h.api.H().alanlar.montessori[1].gizli, true);
  assert.deepEqual(j(h.api.HA().haric), ['eski', 'g2']);
});

test('Yüzleri düzelt: yalnız url (ve boyut) değişir; olmayan kare ve bilinmeyen alan reddedilir', async () => {
  const h = harness({saved:{haftalik:HAFTALIK}});
  await h.api.yukle();
  await h.api.haftalikOgeGuncelle('montessori', 'g1', (x) => ({...x, url:'https://bcka.b-cdn.net/web-sitesi/2026-10/duz.jpg', en:1600, boy:1200}));
  const o = h.store.haftalik.alanlar.montessori[0];
  assert.equal(o.url, 'https://bcka.b-cdn.net/web-sitesi/2026-10/duz.jpg');
  assert.equal(o.u640, 'https://x/1-640.webp');
  assert.equal(o.id, 'g1');
  assert.equal(h.tx.length, 1); // ayar belgesine dokunmaz
  await assert.rejects(h.api.haftalikOgeGuncelle('montessori', 'yok', (x) => x), /artık listede yok/);
  await assert.rejects(h.api.haftalikOgeGuncelle('alanlar', 'g1', (x) => x), /Bilinmeyen alan/);
});

test('aç/kapa ve alan başına görsel haftalikAyar belgesine birleştirerek yazılır', async () => {
  const h = harness({saved:{haftalikAyar:{haric:['a'], acik:true}}});
  await h.api.yukle();
  await h.api.haftalikAyarYaz({acik:false});
  assert.deepEqual(j(h.writes.at(-1).opt), {merge:true});
  assert.equal(h.store.haftalikAyar.acik, false);
  assert.deepEqual(j(h.store.haftalikAyar.haric), ['a']);
  assert.equal(h.api.HA().acik, false);
});

test('haftalık yazımlar da yalnız webSitesi koleksiyonuna ve işlem içinde yapılır', () => {
  assert.match(source, /fb\.runTransaction\(db, async \(tx\) => \{/);
  assert.match(source, /tx\.update\(ref, \{ \[`alanlar\.\$\{alanAd\}`\]: liste, kaynak: "panel"/);
  assert.match(source, /fb\.doc\(db, "webSitesi", "haftalikAyar"\)/);
  assert.match(source, /fb\.doc\(db, "webSitesi", "haftalik"\)/);
  assert.match(source, /SITE \+ "\/rehber-varsayilan\.json"/);
});
