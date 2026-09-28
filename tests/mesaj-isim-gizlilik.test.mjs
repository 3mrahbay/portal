import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const path = fs.existsSync('www/js/zeky-data.js') ? 'www/js/zeky-data.js' : 'index.html';
const source = fs.readFileSync(path, 'utf8');
function extract(name) { const start=source.indexOf('function '+name+'('); assert.ok(start>=0); return source.slice(start,source.indexOf('\n}',start)+2); }
const context=vm.createContext({});
vm.runInContext((path==='index.html'?extract('mesajEpostaMi')+'\n':'')+extract('mesajGercekAd'),context);
for (const name of ['teacher@example.test','Ayşe teacher@example.test','0555 123 45 67','+90 (555) 123-45-67','Ayşe · 0555 123 45 67','Öğretmen 1','Öğretmen 2','Sınıf Öğretmeni']) assert.equal(context.mesajGercekAd(name),'');
for (const name of ['Ayşe Yılmaz','Nur Bay','İpek Şen']) assert.equal(context.mesajGercekAd(name),name);
console.log('11 messaging name/privacy checks passed');
