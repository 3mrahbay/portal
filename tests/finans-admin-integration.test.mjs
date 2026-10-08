import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const staff=readFileSync(new URL('../js/finans/dashboard.js',import.meta.url),'utf8');
const home=index.slice(index.indexOf('function yonetimHomeHTML(ad) {'),index.indexOf('function hesaplaRaporVerileri() {'));
const report=index.slice(index.indexOf('function hesaplaRaporVerileri() {'),index.indexOf('function updateRaporMetrikler(d) {'));

test('main portal uses shared finance plan totals, not only already populated payment months',()=>{
 assert.match(index,/import \{okulFinansOzeti,sonAyKodlari\} from "\.\/js\/finans\/school-summary\.js";/);
 assert.match(home,/const finans = okulFinansOzeti\(aktifOgrenciler\.map/);
 assert.match(home,/const buAyTahsilat = finans\.buAyAidataIslenen/);
 assert.match(home,/const ayToplamlari = finans\.aidatOdenen/);
 assert.match(home,/const aidatAcik = finans\.toplamKalan/);
 assert.doesNotMatch(home.slice(0,home.indexOf('// 2) Son kayıt')),/Object\.keys\(aylikOd\)/);
 assert.match(home,/Aidatların Aylara Göre Tahsilat Durumu/);
 assert.match(home,/nakit akışı değildir/);
});

test('report and accounting staff module use the same payment-plan metric source',()=>{
 assert.match(report,/const finans = okulFinansOzeti\(aktif\.map/);
 assert.match(report,/buAyBeklenen:finans\.buAyAidatBeklenen,buAyOdenen:finans\.buAyAidataIslenen/);
 assert.match(staff,/import \{okulFinansOzeti\} from '\.\/school-summary\.js'/);
 assert.match(staff,/finans\.aidatOdenen\[month\]/);
 assert.match(staff,/finans\.nakitAylar\[month\]/);
 assert.match(staff,/net nakit tahsilatı/);
});
