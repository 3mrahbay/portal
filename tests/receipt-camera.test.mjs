import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {receiptType,validateReceipt} from '../js/expenses/receipt-core.js';

test('kamera girişi image/* ile açılır (Android uygulama içinde kamera için gerekli)',async()=>{
 const src=await readFile(new URL('../js/expenses/receipt-input.js',import.meta.url),'utf8');
 assert.match(src,/data-camera type="file" accept="image\/\*" capture="environment"/);
 assert.match(src,/await prepare\(selected\)/,'seçilen dosya hemen belleğe alınmalı');
});
test('türü boş/octet-stream gelen dosyada tür uzantıdan bulunur',()=>{
 assert.equal(receiptType({type:'',name:'IMG_1234.JPG'}),'image/jpeg');
 assert.equal(receiptType({type:'application/octet-stream',name:'fis.png'}),'image/png');
 assert.equal(receiptType({type:'image/jpg',name:'a'}),'image/jpeg');
 assert.equal(receiptType({type:'',name:'dosya'}),'');
 assert.doesNotThrow(()=>validateReceipt({type:'',name:'fis.jpeg',size:100}));
});
test('HEIC için anlaşılır uyarı verilir',()=>{
 assert.throws(()=>validateReceipt({type:'image/heic',name:'a.heic',size:100}),/HEIC/);
 assert.throws(()=>validateReceipt({type:'',name:'a.HEIC',size:100}),/HEIC/);
});
