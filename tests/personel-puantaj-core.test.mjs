import test from 'node:test';
import assert from 'node:assert/strict';
import {gunuHesapla, okulGunu, aylikOzet, dakikaYaz, csvHucre} from '../js/personel-puantaj-core.js';
import {izinGunSayisi, izinSaatSayisi, izinMetrikleri, izinTalebiDogrula} from '../js/personel-izin-core.js';
const record=(tip,time)=>({tip,zaman:`2026-11-27T${time}:00+03:00`,tarih:'2026-11-27'});
test('molada çıkış, iki mesai ve tekrarlı giriş net süreyi bozmaz',()=>{
 const r=gunuHesapla([record('giris','08:00'),record('giris','08:30'),record('mola-basla','12:00'),record('cikis','13:00'),record('giris','14:00'),record('cikis','17:00')]);
 assert.equal(r.net,420);assert.equal(r.mola,60);assert.equal(r.sorunlar.length,1);
});
test('geçmiş açık kayıt kısmi toplam ve eksik çıkış olarak raporlanır',()=>{
 const r=gunuHesapla([record('giris','08:00'),record('mola-basla','12:00')]);
 assert.equal(r.net,240);assert.equal(r.eksikCikis,true);assert.equal(r.acik,false);
});
test('Türkiye gün sınırı ve canlı süre cihaz saat diliminden bağımsız',()=>{
 assert.equal(okulGunu('2026-11-27T22:30:00Z'),'2026-11-28');
 const r=gunuHesapla([record('giris','08:00')],true,new Date('2026-11-27T09:00:00+03:00'));
 assert.equal(r.net,60);assert.equal(r.acik,true);
});
test('geçersiz, sırasız ve gelecek hareketler toplam şişirmez',()=>{
 const r=gunuHesapla([{tip:'giris',zaman:'x'},record('cikis','07:00'),record('giris','10:00')],true,new Date('2026-11-27T09:00:00+03:00'));
 assert.equal(r.net,0);assert.equal(r.sorunlar.length,3);
});
test('ay filtresi geçmiş ayları ve gelecek ayları karıştırmaz',()=>{
 const r=aylikOzet([{email:'a@test',ad:'A'}],[{...record('giris','08:00'),personelEmail:'a@test'},{...record('cikis','17:00'),personelEmail:'a@test'}],'2026-10');
 assert.equal(r[0].net,0);assert.equal(r[0].gun,0);
});
test('süre yuvarlama 60 dakika göstermez; CSV formül çalıştırmaz',()=>{
 assert.equal(dakikaYaz(119.9),'2 sa 00 dk');assert.equal(csvHucre('=1+1'),'"\'=1+1"');assert.equal(csvHucre('a"b'),'"a""b"');
});
test('izinlerde null onay günü, sıfır hak ve geçersiz tarih/saat',()=>{
 assert.equal(izinMetrikleri([{tur:'yillik',durum:'onaylandi',gun:3,onaylananGun:null}],14).kullanilan,3);
 assert.equal(izinMetrikleri([],0).toplam,0);
 assert.equal(izinGunSayisi('2026-02-30'),0);assert.equal(izinSaatSayisi('09:75','11:00'),0);
 assert.throws(()=>izinTalebiDogrula({tur:'saatlik',baslangic:'2026-02-30',baslangicSaat:'09:00',bitisSaat:'10:00'}));
});
