import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const YETKILI = ['emrahby@gmail.com', 'eposta@bircicekkoleji.com'];

test('web sitesi modülü yalnız iki yetkili hesaba açılır (menü, sekme ve modül aynı liste)', () => {
  const html = read('index.html');
  const modul = read('moduller/web-sitesi.js');
  const listeHtml = html.match(/const WEB_SITESI_YETKILI = \[([^\]]+)\]/);
  assert.ok(listeHtml, 'index.html yetkili listesi tanımlı');
  assert.deepEqual(JSON.parse(`[${listeHtml[1]}]`), YETKILI);
  const listeModul = modul.match(/export const YETKILI = \[([^\]]+)\]/);
  assert.ok(listeModul, 'modül yetkili listesi tanımlı');
  assert.deepEqual(JSON.parse(`[${listeModul[1]}]`), YETKILI);
  // Admin kısayolundan ÖNCE kontrol edilir; admin olmak tek başına yetki vermez
  assert.match(html, /function modulErisim\(modulKey\) \{\n  if \(modulKey === "webSitesi"\) return webSitesiYetkili\(\);\n  if \(typeof isAdmin/);
  assert.match(html, /function sekmeyeErisim\(tabAdi\) \{\n  if \(tabAdi === "webSitesi"\) return webSitesiYetkili\(\);\n  if \(isAdmin\)/);
});

test('web sitesi modülü menüye, sekmeye, haritaya ve açılış kancasına bağlı', () => {
  const html = read('index.html');
  assert.match(html, /data-modul="webSitesi" onclick="modulSec\('webSitesi'\)"/);
  assert.match(html, /<button class="tab" data-tab="webSitesi" id="tab-webSitesi-btn" style="display:none;">/);
  assert.match(html, /<div class="tab-panel" id="tab-webSitesi">[\s\S]*?<div id="webSitesiIcerik">/);
  assert.match(html, /webSitesi:\s+\{ tablar: \["webSitesi"\],\s+varsayilan: "webSitesi",\s+ad: "Web Sitesi" \}/);
  assert.match(html, /tab\.dataset\.tab === "webSitesi"[\s\S]{0,200}modulYukle\("web-sitesi"\)\.then\(m => m && m\.panelRender\("webSitesiIcerik"\)\)/);
});

test('web sitesi modülü yalnız webSitesi koleksiyonuna yazar ve görselleri portal medya servisiyle yükler', () => {
  const modul = read('moduller/web-sitesi.js');
  const koleksiyonlar = [...modul.matchAll(/fb\.doc\(db, "([^"]+)"/g)].map(m => m[1]);
  assert.ok(koleksiyonlar.length >= 3);
  assert.deepEqual([...new Set(koleksiyonlar)], ['webSitesi']);
  assert.match(modul, /P\(\)\.medya\.yukle\(dosya, `web-sitesi\/\$\{ay\}`, true\)/);
  assert.doesNotMatch(modul, /deleteDoc/);
  // Kaydedilen her belge kimin kaydettiğini taşır; herkese açık belgeye e-posta değil görünen ad yazılır
  assert.match(modul, /guncellendi: fb\.serverTimestamp\(\), guncelleyen: guncelleyenEtiketi\(\)/);
  assert.doesNotMatch(modul, /(guncelleyen|yukleyen): email\(\)/);
});
