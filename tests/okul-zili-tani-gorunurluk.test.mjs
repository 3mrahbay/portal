import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Okul Zili tanı düğmesi velilere varsayılan olarak gösterilmez',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const satirlar=html.split('\n').filter(l=>l.includes('onclick="okulZiliTaniAc()"'));
  assert.equal(satirlar.length,1,'tanı düğmesi tek yerde tanımlı olmalı');
  assert.ok(satirlar[0].includes('get("tani") === "okulzili"'),'düğme yalnız ?tani=okulzili bağlantısıyla görünmeli');
  assert.ok(html.includes('window.okulZiliTaniAc = async function'),'tanı aracı destek için erişilebilir kalmalı');
});
