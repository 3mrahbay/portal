import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptTotal} from '../js/expenses/receipt-core.js';

// Gerçek OCR çıktıları (Tesseract tur+eng). OCR modeli ₺ işaretini tanımadığı için ₺ bazen rakama dönüşüyor.
const FISLER=[
 [
  "Gerçek BİM fişi: ₺ işareti 1 okunmuş (₺650 → 1650)",
  "E-Arşiv Fatura\nBİM BİRLEŞİK MAĞAZALAR A.Ş.\nAYDINLI MAHALLESİ BAŞKOMUTAN CAD. NO:\n308-B-C-D TUZLA / İSTANBUL\nBüyük Mükellefler VD 1750051846\nFATURA NO:1T092026141226987\n22.09.2026 10:49 Sıra No : 44\nETTN: f54bc6a-a9d9-4a08-8575-b70e8f4fd635\nTCKN/VKN:11111111111-NİHAİ TÜKETİCİ\nALIŞVERİŞ POŞETİ BİM X20 $1.00\n2 ad X 89.50\nYEŞİL ZEYTİN 4006 Sl $179.00\n2 ad X 235.00\nBUGDAY UNU 10 KG %1 1470.00\nTOPLAM KDV 16.60\nÖdenecek KDV Dahil Tutar 1650.00\nBanka Kredi Kartı 1650.00\nYAPI KREDİ\n1:2601870065 T:00814198E 540063******883\n22.09.2026 10:50 B:1 S:6\nOnay No:034239 Ref .No: 1315034239\nKDV MATRAH KDV TUTAR KDV DAHİL\n%1 642.57 $6.43 $649.00\n%20 0.83 10.17 $1.00",
  650
 ],
 [
  "Gerçek BİM fişi: KDV tablosu satırı kaybolmuş, adet satırları sağlıyor",
  "E-Arşiv Fatura\nBİM BİRLEŞİK MAĞAZALAR A.Ş.\nAYDINLI MAHALLESİ BAŞKOMUTAN CAD. NO:\n308-B-C-D TUZLA / İSTANBUL\nBüyük Mükellefler VD 1750051846\nFATURA NO:T092026141226987\n22.09.2026 10:49 Sıra No : 44\nETTN:f54bc6a-a9d9-4a08-8575-b70e8f4fd635\nTCKN/VKN:11111111111-NİHAİ TÜKETİCİ\nALIŞVERİŞ POŞETİ BİM X20 £1.00\n2 ad X 89.50\nYEŞİL ZEYTİN 4006  %1 1179.00\n2 ad X 235.00\nBUĞDAYUNU10KG %1 1470.00\nTOPLAM KDV 16.60\nÖdenecek KDV Dahil Tutar 1650.00\nBanka Kredi Kartı 1650.00\nYAPI KREDİ\n1:2601870065 T:00814198E 540063******883\n22.09.2026 10:50 B:1 S:6\nOnay N0:034239  Ref.N0:1315034239\nKDV MATRAH KDV TUTAR KDV DAHİL\nYI 642.57 1643 1649.00\n%20 0.83 40.17 — 11.00",
  650
 ],
 [
  "Toplam gerçekten 1250 ise baştaki 1 atılmaz",
  "E-Arşiv Fatura\nBİM BİRLEŞİK MAĞAZALAR A.Ş.\nTUZLA / İSTANBUL\nFATURA NO:1092026141226987\n22.09.2026 10:49 Sıra No : 44\nTCKN/VKN:11111111111-NIHAI TUKETICI\nDETERJAN 5KG %1 4450.00\nZEYTINYAGI 2L %1 4800.00\nTOPLAM KDV $12.50\nÖdenecek KDV Dahil Tutar 1250.00\nBanka Kredi Kartı 11250.00\nKDV MATRAH KDV TUTAR KDV DAHİL\nYl 1237.50 412.50 1250.00\nE-Arşiv izni kapsamında",
  1250
 ],
 [
  "Binlik ayraçlı tutarda ₺ → 4",
  "E-Arşiv Fatura\nBİM BİRLEŞİK MAĞAZALAR A.Ş.\nTUZLA / İSTANBUL\nFATURA NO:1092026141226987\n22.09.2026 10:49 — Sıra No: 44\nTCKN/VKN:11111111111-NIHAI TUKETİCİ\nMASA Yol +1.500,00\nSANDALYE %1 4650,00\nTOPLAM KDV 421,50\nÖdenecek KDV Dahil Tutar  42.150,00\nBanka Kredi Kartı 12.150,00\nKDV MATRAH KDV TUTAR KDV DAHİL\n%1 2128,50 421,50 2.150,00\nE-Arşiv izni kapsamında",
  2150
 ],
 [
  "Nakit fişi, ödeme ve tablo 1 ile bozulmuş",
  "E-Arşiv Fatura\nBİM BİRLEŞİK MAĞAZALAR A.Ş.\nTUZLA / İSTANBUL\nFATURA NO:1092026141226987\n22.09.2026 10:49 Sıra No : 44\nTCKN/VKN:11111111111-NIHAI TUKETICI\nSUT %1 £42.50\nEKMEK %1 £15.00\nPEYNIR %1 £230.00\nTOPLAM KDV 12.88\nOdenecek KDV Dahil Tutar £287.50\nNAKİT 1287.50\nKDV MATRAH KDV TUTAR KDV DAHİL\nS1 284.62 12.88 1287.50\nE-Arşiv izni kapsamında",
  287.5
 ],
 [
  "\"TOPLAM KOV\" (KDV yanlış okunmuş) toplam sanılmaz; adet satırları sağlıyor",
  "E-Arşiv Fatura\nBİRLEŞİK MAĞAZALAR A.Ş.\nTUZLA / İSTANBUL\n10.09.2026 20:25 Fis No: 247\n3 ad X 20.45\nÇAY 1KG %20 161.35\n2 ad X 106.90\nEKMEK %20 £213.80\n3 ad X 189.20\nMAKARNA %20 1567.60\nTOPLAM KOV 1140.46\nÖdenecek KDV Dahil Tutar 1842.75\nNAKİT 1942.75\nPARA ÜSTÜ 1100.00\nKDV MATRAH KDV TUTAR KDV DAHİL\n%20 702.29 1140.46 1842.75",
  842.75
 ],
 [
  "Bozuk KDV tablosu satırı yanıltmaz",
  "E-Arşiv Fatura\nBİRLEŞİK MAĞAZALAR A.Ş.\nTUZLA / İSTANBUL\n08.09.2026 21:53 Fiş No: 609\n2 ad X 59,45\nMAKAS %1 +118,90\nBOYA 12Li %1 340,00\n3 ad X 270,00\nYUMURTA 30LU %10 810,00\nBEYAZ PEYNIR %20  +£724,64\nYUMURTA 30LU %10  $148,10\nCAY 1KG %1 +£710,60\nTOPLAM KDV +219,45\nTOPLAM 12852,24\nBanka Kredi Kartı 12852,24\n540063****8831 Onay No: 034239\nKDV MATRAH KDV TUTAR KDV DAHİL\n%1 1157,92 411,58 411169,50\n%10 871,00 487,10 4958,10\n%20 603,87 4120,77 1724,64",
  2852.24
 ],
 [
  "Kuruşu ayrılmış tutar (\"439, 30\")",
  "E-Arşiv Fatura\nBİRLEŞİK MAĞAZALAR A.Ş.\nTUZLA / İSTANBUL\n20.09.2026 08:06 Fis No: 130\nOYUN HAMURU %10 £260,00\nMAKAS %20 +179, 30\nTOPLAM KDV 453,52\nTOPLAM +439, 30\nNAKIT 1439,30",
  439.3
 ]
];
for(const [ad,metin,dogru] of FISLER)test(ad,()=>{const r=receiptTotal(metin);assert.equal(r.amount,dogru);assert.equal(r.verified,true);});

test('gerçekten 1650 olan toplam 650 yapılmaz',()=>{assert.equal(receiptTotal('Ödenecek KDV Dahil Tutar £1650.00\nBanka Kredi Kartı £1650.00').amount,1650);});
test('sağlama yoksa tutar olduğu gibi alınır ama doğrulanmış sayılmaz',()=>{const r=receiptTotal('TOPLAM 1650,00');assert.equal(r.amount,1650);assert.equal(r.verified,false);});
test('"Ödenecek KDV Dahil Tutar" satırı KDV satırı sanılmaz',()=>assert.equal(receiptTotal('TOPLAM KDV *6,50\nÖDENECEK KDV DAHİL TUTAR *650,00').amount,650));
test('toplam satırı okunamazsa kendi içinde tutarlı KDV tablosu kullanılır',()=>{const r=receiptTotal('KDV MATRAH KDV TUTAR KDV DAHIL\n%20 702.29 1140.46 1842.75');assert.equal(r.amount,842.75);assert.equal(r.verified,true);});
test('ödeme satırı toplamı destekler',()=>{const r=receiptTotal('TOPLAM *219,75\nKREDI KARTI *219,75');assert.equal(r.amount,219.75);assert.equal(r.verified,true);});
