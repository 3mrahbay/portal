import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const assignments=[...html.matchAll(/document\.getElementById\("ayarNotlar"\)\.value = ([^;]+);/g)].map(x=>x[0]);
function reopen(ayar,withSettings=true){
 const field={value:'stale'};
 vm.runInNewContext(assignments[withSettings?0:1],{ayar,a:ayar?.aidatAyarlari,document:{getElementById:()=>field}});
 return field.value;
}
test('saved top-level note survives reopening alongside existing settings',()=>{
 const note='Banka 37000; materyal 36000; mahsup 555; bakiye 445.';
 const saved={aidatAyarlari:{aylikAidat:35800,notlar:'old'},notlar:note};
 assert.equal(reopen(JSON.parse(JSON.stringify(saved))),note);
});
test('explicitly cleared top-level note does not revive legacy note',()=>{
 assert.equal(reopen({notlar:'',aidatAyarlari:{notlar:'old'}}),'');
});
test('legacy note remains available until migrated by saving',()=>{
 assert.equal(reopen({aidatAyarlari:{notlar:'legacy'}}),'legacy');
});
test('note remains visible without aidat settings',()=>{
 assert.equal(reopen({notlar:'saved'},false),'saved');
 assert.equal(reopen(undefined,false),'');
});
