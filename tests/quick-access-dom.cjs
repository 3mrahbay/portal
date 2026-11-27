const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const slice = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
const navigation = slice('const MODUL_HARITASI =', 'document.querySelectorAll(".tab").forEach(tab => {');
function fixture(role, denied = []) {
  const dom = new JSDOM(html.match(/<aside class="crm-sidebar"[\s\S]*?<\/aside>/)[0], {runScripts:'outside-only'});
  dom.window.eval(`let aktifKullaniciRol=${JSON.stringify(role)};
    window.setRole=r=>{aktifKullaniciRol=r;};
    const rolNormalize=r=>String(r||'').toLowerCase();
    const isAdmin=true, currentUser={uid:'test'};
    let galeriOnayGezinmeSurumu=0;
    const sekmeyeErisim=t=>true;
    const modulErisim=k=>!${JSON.stringify(denied)}.includes(k);
    const setTimeout=()=>{};
    ${slice('function hizliErisimMenuyuAyarla()', '// Bir sekmeye erişim var mı?')}
    ${navigation}`);
  return dom.window;
}
test('shortcuts follow summary, exact requested order, original routes/icons and groups retained', () => {
  const w=fixture('mudur'), d=w.document;
  const group=d.querySelector('.side-grup[data-hizli-erisim-grup]');
  assert.equal(group.previousElementSibling.previousElementSibling.querySelector('button').dataset.modul,'ozet');
  assert.deepEqual([...group.querySelectorAll('.side-ad')].map(x=>x.textContent),['Duyurular','Eğitim','Galeri','Mesajlar','Muhasebe','Öğrenciler','Özlük & Puantaj','Personel','Veliler','Yemek Listesi']);
  for(const btn of group.querySelectorAll('button')) {
    const original=d.querySelector(`.side-item:not([data-hizli-erisim])[data-modul="${btn.dataset.modul}"]`);
    assert.ok(original);
    assert.equal(btn.getAttribute('onclick'),original.getAttribute('onclick'));
    assert.equal(btn.querySelector('i').dataset.lucide,original.querySelector('i').dataset.lucide);
  }
  assert.ok(group.hidden, 'hidden before role initialization');
});
test('both refresh paths preserve manager-only visibility, including admin with other roles', () => {
  for(const role of ['mudur','kurucu_mudur','egitim_koordinator','muhasebe','ogretmen','danisma','pdr','ingilizce_ogretmeni',null]) {
    const w=fixture(role); const allowed=['mudur','kurucu_mudur'].includes(role);
    for(const refresh of ['solMenuyuRoleGoreAyarla','modulBarYenile']) {
      w[refresh]();
      for(const el of w.document.querySelectorAll('[data-hizli-erisim-grup]')) assert.equal(el.hidden,!allowed,`${role}/${refresh}`);
      assert.equal(w.document.querySelector('.side-item:not([data-hizli-erisim])[data-modul="egitim"]').style.display,'');
    }
  }
});
test('module denial survives both refresh paths and blocks shortcut navigation', () => {
  const w=fixture('mudur',['egitim']);
  for(const refresh of ['solMenuyuRoleGoreAyarla','modulBarYenile']) {
    w[refresh](); w.modulSec('egitim',false);
    const btn=w.document.querySelector('[data-hizli-erisim][data-modul="egitim"]');
    assert.equal(btn.style.display,'none'); assert.equal(btn.classList.contains('active'),false);
  }
});
test('same-route buttons activate together and clear on next navigation', () => {
  const w=fixture('kurucu_mudur'); w.solMenuyuRoleGoreAyarla();
  for(const btn of w.document.querySelectorAll('[data-hizli-erisim]')) {
    w.modulSec(btn.dataset.modul,false);
    const active=[...w.document.querySelectorAll('.side-item.active')];
    assert.equal(active.length,2);
    assert.ok(active.every(x=>x.dataset.modul===btn.dataset.modul));
  }
  w.modulSec('ozet',false);
  assert.equal(w.document.querySelectorAll('[data-hizli-erisim].active').length,0);
});
test('switching away from management hides shortcuts on refresh', () => {
  const w=fixture('mudur'); w.solMenuyuRoleGoreAyarla();
  w.setRole("ogretmen");w.modulBarYenile();w.solMenuyuRoleGoreAyarla();
  assert.ok([...w.document.querySelectorAll('[data-hizli-erisim-grup]')].every(x=>x.hidden));
  w.setRole('mudur'); w.modulBarYenile();
  assert.ok([...w.document.querySelectorAll('[data-hizli-erisim-grup]')].every(x=>!x.hidden && x.style.display===''));
});
