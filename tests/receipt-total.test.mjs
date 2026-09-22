import test from 'node:test';import assert from 'node:assert/strict';
import {receiptTotal,validateReceipt,CATEGORIES} from '../js/expenses/receipt-core.js';
test('Turkish totals ignore tax and subtotal',()=>assert.equal(receiptTotal('ARA TOPLAM 1.000,00\nTOPLAM KDV 200,00\nGENEL TOPLAM *1.200,00\nNAKIT 1.500,00\nPARA ÜSTÜ 300,00').amount,1200));
test('amount on next line and English formatting',()=>{assert.equal(receiptTotal('TOPLAM\n*345,90').amount,345.9);assert.equal(receiptTotal('GRAND TOTAL 1,234.56').amount,1234.56);});
test('ambiguous totals do not silently choose an amount',()=>{assert.equal(receiptTotal('TOPLAM 100,00\nTOPLAM 200,00').amount,null);assert.equal(receiptTotal('KDV 15,00\nNAKIT 200,00').amount,null);assert.equal(receiptTotal('TOPLAM KDV 15,00').amount,null);});
test('explicit payable total outranks generic total',()=>assert.equal(receiptTotal('TOPLAM 500,00\nÖDENECEK TUTAR 450,00').amount,450));
test('repeated same total is accepted',()=>assert.equal(receiptTotal('TOPLAM 24,50\nTOPLAM 24,50').amount,24.5));
test('documents have a size/type limit and categories are unique',()=>{assert.throws(()=>validateReceipt({type:'text/html',size:1}));assert.throws(()=>validateReceipt({type:'image/jpeg',size:16*1024*1024}));assert.doesNotThrow(()=>validateReceipt({type:'image/jpeg',size:100}));assert.equal(new Set(CATEGORIES).size,CATEGORIES.length);});
