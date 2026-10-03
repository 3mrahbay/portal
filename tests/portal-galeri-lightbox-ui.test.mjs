import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {galleryLightboxStyles as css,galleryLightboxIcons as icons,lightboxDownload} from '../js/portal-galeri-lightbox-ui.js';
const source=fs.readFileSync(new URL('../moduller/veli-galeri.js',import.meta.url),'utf8');
const dialog=source.slice(source.indexOf('function buyut('),source.indexOf('function temizle('));

test('body-level gallery owns its visual scope independently from cicek-app and ca-back',()=>{
 assert.match(css,/#vgLightbox \{/);assert.doesNotMatch(css,/\.cicek-app/);assert.doesNotMatch(dialog,/class="ca-back"/);
 assert.match(dialog,/<style>\$\{galleryLightboxStyles\}<\/style>/);assert.match(dialog,/class="vg-lb-top"/);assert.match(dialog,/class="vg-lb-footer"/);
});
test('portrait, landscape and video stages center and fit the available grid row',()=>{
 assert.match(css,/grid-template-rows:auto minmax\(0,1fr\) auto/);
 assert.match(css,/\[data-vg-media\] \{display:flex;align-items:center;justify-content:center/);
 assert.match(css,/height:100%;min-height:0;min-width:0;overflow:hidden/);
 assert.match(css,/max-height:100%!important;object-fit:contain/);assert.match(css,/height:100%!important/);
 assert.doesNotMatch(dialog,/width:min\(960px/);
});
test('dynamic mobile viewport, safe areas, long captions and compact landscape have explicit layout rules',()=>{
 assert.match(css,/height:100vh;height:100dvh/);for(const side of ['top','right','bottom','left'])assert.ok(css.includes(`env(safe-area-inset-${side})`));
 assert.match(css,/max-height:min\(18dvh,112px\);overflow:auto/);assert.match(css,/overflow-wrap:anywhere/);
 assert.match(css,/@media\(max-width:600px\)/);assert.match(css,/@media\(max-height:500px\) and \(min-width:601px\)/);
});
test('modern controls have explicit resets, touch targets, focus indication and reduced-motion handling',()=>{
 assert.match(css,/appearance:none;-webkit-appearance:none/);assert.match(css,/min-width:44px;min-height:44px/);assert.match(css,/\.vg-lb-btn:focus-visible/);assert.match(css,/outline:3px solid/);assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(dialog,/aria-label="Kapat" title="Kapat \(Esc\)"/);assert.match(dialog,/aria-label="Medya işlemleri"/);
 for(const icon of Object.values(icons)){assert.match(icon,/aria-hidden="true" focusable="false"/);assert.doesNotMatch(icon,/<script|https?:|on\w+=/);}
});
test('download icon and label survive success/failure while duplicate disabled actions stay suppressed',async()=>{
 const button={innerHTML:'<svg></svg><span>İndir</span>',disabled:false,matches:s=>s==='.vg-lb-download'};const before=button.innerHTML;
 assert.equal(await lightboxDownload(button,async()=>{button.innerHTML='İndiriliyor…';return true;}),true);assert.equal(button.innerHTML,before);
 await assert.rejects(lightboxDownload(button,async()=>{button.innerHTML='Hata';throw new Error('synthetic');}),/synthetic/);assert.equal(button.innerHTML,before);
 button.disabled=true;let calls=0;assert.equal(await lightboxDownload(button,()=>{calls++;}),false);assert.equal(calls,0);
});
test('UI module is precached and contains no queries, session mutations or external sources',()=>{
 const sw=fs.readFileSync(new URL('../serviceworker.js',import.meta.url),'utf8');assert.match(sw,/"\.\/js\/portal-galeri-lightbox-ui\.js"/);
 const ui=fs.readFileSync(new URL('../js/portal-galeri-lightbox-ui.js',import.meta.url),'utf8');assert.doesNotMatch(ui,/\b(fetch|query|getDocs|setDoc|updateDoc|localStorage|sessionStorage)\s*[.(]/);
});
