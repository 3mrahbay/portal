import test from 'node:test';
import assert from 'node:assert/strict';
import {dekontHazirla,DEKONT_LIMIT} from '../js/finans/receipts.js';
import {csvOku,csvTutar,csvTarih} from '../js/finans/reconciliation.js';
test('receipts reject renamed HTML and oversized files',async()=>{await assert.rejects(dekontHazirla(new File(['<html>unsafe</html>'],'fake.pdf',{type:'application/pdf'})));await assert.rejects(dekontHazirla({size:DEKONT_LIMIT+1}));});
test('receipt is split and hash covers original bytes',async()=>{const file=new File(['%PDF-1.4\n'+'x'.repeat(200000)],'bank.pdf'),r=await dekontHazirla(file);assert.equal(r.meta.boyut,file.size);assert.equal(r.chunks.length,2);assert.equal(atob(r.chunks.join('')),await file.text());assert.match(r.meta.sha256,/^[a-f0-9]{64}$/);});
test('CSV handles Turkish amounts, quotes and embedded newlines',()=>{const csv='Referans;Tarih;Tutar;Açıklama\r\nx;20.09.2026;1.234,56;"iki; parça\nyeni satır"';const p=csvOku(csv);assert.equal(p.rows[0][3],'iki; parça\nyeni satır');assert.equal(csvTutar(p.rows[0][2]),1234.56);assert.equal(csvTutar('-20.50','en'),-20.5);assert.equal(csvTarih(p.rows[0][1]),'2026-09-20');});
test('CSV rejects malformed rows, ambiguity and impossible dates',()=>{assert.throws(()=>csvOku('A;B\nx;y;z'));assert.throws(()=>csvOku('A;B\nx;"unfinished'));assert.throws(()=>csvTutar('1,234.56'));assert.throws(()=>csvTarih('31.02.2026'));});
