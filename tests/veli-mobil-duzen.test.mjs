// Veli ekranları · mobil düzen (16 Ekim 2026): iPhone ekran görüntülerinden gelen düzeltmeler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPortal } from './helpers/portal-pwa.mjs';

const index = readPortal('index.html');
const fonk = (ad) => {
  const bas = index.indexOf(`function ${ad}(`);
  assert.ok(bas >= 0, ad);
  return index.slice(bas, index.indexOf('\n}\n', bas) + 2);
};

test('sayfa kenar boşluğu ve üst bardaki sağ simgeler sağa yaslı', () => {
  assert.match(index, /#veliPanel #cicekAppRoot > \.ca-page \{ box-sizing:border-box; padding:16px 20px 28px; \}/);
  assert.match(index, /@media \(max-width:560px\) \{ #veliPanel #cicekAppRoot > \.ca-page \{ padding:12px max\(14px, env\(safe-area-inset-right, 0px\)\) 24px max\(14px, env\(safe-area-inset-left, 0px\)\); \} \}/);
  assert.match(index, /\.cicek-app \.ca-topbar > \.ca-row \+ \.ca-row \{ flex:0 0 auto; margin-left:auto; justify-content:flex-end; \}/);
});

test('günün özeti çocuk kartının altında; ayrı "Bugünün günlüğü" kartı ve "dokun" yazısı yok', () => {
  const ev = fonk('caHomeHTML');
  const kart = ev.slice(ev.indexOf('<div class="ca-card-green"'), ev.indexOf('<div class="ca-card ca-pay">'));
  assert.match(kart, /<div class="ca-hero-gunluk" id="caHomeGunluk" role="button" tabindex="0" aria-label="Günlük raporu aç"/);
  assert.match(kart, /onclick="event\.stopPropagation\(\); caGo\('gunluk'\)"/);
  assert.doesNotMatch(ev, /Profili ve eğitim gelişimini görmek için dokun/);
  assert.doesNotMatch(ev, /<h3 class="ca-head" style="font-size:15px;">Bugünün günlüğü<\/h3>/);
  const doldur = index.slice(index.indexOf('async function caHomeGunlukDoldur()'), index.indexOf('window.caHomeGunlukDoldur = caHomeGunlukDoldur;'));
  assert.match(doldur, /import\("\.\/js\/gunluk-ozet\.js\?v=1"\)/);
  assert.match(doldur, /pil\(oz\.yemek, "Yemek"\) \+ pil\(oz\.uyku, "Uyku"\) \+ pil\(oz\.ruhHali, "Ruh hali"\)/);
  assert.match(doldur, /oz\.bugunMu \? "Bugünün günlüğü" : "Son günlük"/);
});

test('onay bekleyen belgeler veli profilinde; çocuk profilinde yok; ana sayfada kısa uyarı', () => {
  assert.doesNotMatch(fonk('caProfilHTML'), /veliBelgeOnayKart/);
  const ayarlar = index.slice(index.indexOf('<div class="veli-tab-panel" id="veliPanel-ayarlar">'));
  assert.match(ayarlar.slice(0, 400), /<div class="cicek-app vbo-sarici"><div id="veliBelgeOnayKart" class="ca-card"/);
  assert.match(index, /if \(arguments\[0\] === "ayarlar"\) \{\s*setTimeout\(function \(\) \{ modulYukle\("geri-bildirim"\)\.then\(m => m && m\.veliBelgeOnayKart\("veliBelgeOnayKart"\)\); \}, 100\);/);
  assert.match(fonk('caHomeHTML'), /<div id="caHomeBelgeUyari" hidden><\/div>/);
  assert.match(index, /m\.veliBelgeUyari\?\.\("caHomeBelgeUyari"\)/);
  const gb = readPortal('moduller/geri-bildirim.js');
  assert.match(gb, /export async function veliBelgeUyari\(hedefId\)/);
  assert.match(gb, /onclick="veliSwitchTab\('ayarlar'\)"/);
});

test('Okul Zili: saat ve kişi alanı iPhone\'da üst üste binmez', () => {
  assert.match(index, /<div class="vz-alanlar" style="padding:14px 18px; display:grid; grid-template-columns:repeat\(2, minmax\(0, 1fr\)\); gap:10px;">/);
  assert.match(index, /#veliOkulZiliKart \.vz-alanlar input\[type="time"\] \{ -webkit-appearance:none; appearance:none; display:block; min-width:0;/);
});

test('mesajlaşma: gönder ve ek simgeleri satır içi SVG; okul logosu renkleri', () => {
  const m = fonk('caMesajlarHTML');
  assert.match(m, /<button class="wa-bar-send" id="caMsgGonderBtn" onclick="caMsgGonder\(\)" title="Gönder" aria-label="Gönder"><svg /);
  assert.match(m, /<button class="wa-bar-atac" onclick="caMsgAtacToggle\(\)" title="Dosya ekle" aria-label="Dosya ekle"><svg /);
  assert.doesNotMatch(m, /data-lucide="send"/);
  assert.match(index, /padding:10px 12px; padding-top:max\(10px, env\(safe-area-inset-top, 0px\)\); background:#2D5E3E;/);
  assert.match(index, /background:#4A7C59; color:#fff; border:none;/);
});

test('duyurular: zaman çizgisi yok; gün başlığı ve tam genişlik kartlar', () => {
  const f = index.slice(index.indexOf('async function veliRenderBildirimler()'), index.indexOf('// ============ VELİ: OKUL HAYATI (Tur 3 / Opsiyon A) ============'));
  assert.doesNotMatch(f, /border-left:2px solid #E2E8F0/);
  assert.match(f, /<div class="vbd-liste">/);
  assert.match(f, /<div class="vbd-gun">/);
  assert.match(f, /<article class="vbd-kart"/);
  assert.match(f, /if \(fark === 0\) return "Bugün";/);
  assert.match(index, /\.vbd-kart::before \{ content:""; position:absolute; left:0; top:0; bottom:0; width:4px;/);
  assert.doesNotMatch(index, /Bildirimler ve Talepler<\/div>/);
});
