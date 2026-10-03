import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../moduller/veli-egitim-gelisim.js',import.meta.url),'utf8');
const css=()=>{
 const nodes=new Map(),head={appendChild(el){nodes.set(el.id,el);}};
 const context={document:{head,getElementById:id=>nodes.get(id)||null,createElement:()=>({})}};
 const start=source.indexOf('function stilEkle()'),end=source.indexOf('async function veriYukle()',start);
 vm.runInNewContext(source.slice(start,end)+';stilEkle();stilEkle();',context);
 assert.equal(nodes.size,1,'style injection remains idempotent');
 return [...nodes.values()][0].textContent;
};
test('parent education loaded text owns shrink and wrap rules outside the dashboard theme',()=>{
 const style=css();
 assert.match(style,/\.veg,\.veg-report-shell\{min-width:0;overflow-wrap:anywhere\}/);
 for(const selector of ['.veg-hero>*','.veg-prog-ust>*','.veg-block-head>*','.veg-report-grid>*'])assert.ok(style.includes(selector));
 assert.match(style,/\.veg-program-summary\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});
test('parent education report mobile reflow keeps label and value and preserves intentional tree scrolling',()=>{
 const style=css();
 assert.match(style,/@media screen and \(max-width:480px\)[\s\S]*\.veg-report-bar>span\{grid-column:1\/-1\}/);
 assert.match(style,/\.veg-report-tools\{flex-wrap:wrap;gap:8px\}/);
 assert.match(style,/\.veg-tree\{[^}]*overflow:auto/);
 assert.match(style,/\.veg-tree-branches\{[^}]*min-width:560px/);
 assert.match(style,/@media print\{/);
});
