import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  root, RENDERERS, ROLES, PHASES, WIDTHS, LONG_TOKEN,
  extractRenderer, createHarness, renderScenario, buildScenarios,
  productionCss, lateReceptionCss, sanitizeMarkup, assertNoCredentials
} from './helpers/mobile-loaded-fixture.mjs';
import { buildVisualFixture } from './fixtures/build-mobile-loaded-visual.mjs';

const read = name => readFileSync(new URL(name, root), 'utf8');
// These tests execute real selected renderers, but do not contain a browser or
// layout engine. CSS declarations and DOM strings cannot prove pixel geometry.

test('allowlisted production renderers compile independently without full app/backend startup', () => {
  for (const name of RENDERERS) {
    const source=extractRenderer(name);
    assert.ok(source.length > 500);
    assertNoCredentials(source);
    assert.doesNotMatch(source,/initializeApp\(|getFirestore\(|onAuthStateChanged\(/);
  }
  assert.throws(()=>extractRenderer('devamKaydet'),/not allowlisted/);
  assert.throws(()=>extractRenderer('caHomeHTML','function caHomeHTML() {\nconst authkey="synthetic";\n}'),/credential-like/);
  assert.throws(()=>extractRenderer('caHomeHTML','function caHomeHTML() {\n return `unfinished;\n}'),SyntaxError);
  const h=createHarness();
  assert.equal(h.context.fetch,undefined);
  assert.equal(h.context.db,undefined);
  assert.throws(()=>h.context.window.okulZiliDoldur(),/Live network startup/);
});

test('loading and populated homes differ across management, teacher and parent renderers', () => {
  const scenarios=buildScenarios();
  const expected={admin:'yonetimHomeHTML',staff:'ogretmenHomeHTML',parent:'caHomeHTML'};
  for (const role of ROLES) {
    assert.equal(scenarios[role].loading.renderer,expected[role]);
    assert.equal(Object.keys(scenarios[role].loading.patches).length,0);
    assert.match(scenarios[role].loading.html,/Yükleniyor|yükleniyor/);
    const loaded=scenarios[role].populated;
    assert.ok(Object.keys(loaded.patches).length>=8);
    for (const id of Object.keys(loaded.patches)) assert.ok(loaded.html.includes(`id="${id}"`),`${role}: real target ${id} exists`);
    assert.match(JSON.stringify(loaded),/Synthetic/);
    assert.notEqual(JSON.stringify(scenarios[role].loading),JSON.stringify(loaded));
  }
});

test('production birthday renderer replaces an empty card with bounded synthetic long-name rows', () => {
  const h=createHarness('admin','stress');
  const target=h.node('ozetDogumGunleri');
  assert.equal(target.innerHTML,'');
  h.context.window.dogumGunleriDoldur();
  assert.match(target.innerHTML,/ozet-dg-ad/);
  assert.match(target.innerHTML,/Bugün 🎉/);
  assert.ok(target.innerHTML.includes(LONG_TOKEN));
  assert.equal((target.innerHTML.match(/class="ozet-dg-satir"/g)||[]).length,5);
  assert.match(target.innerHTML,/kişi daha/);
  h.context.ogrenciList=[];
  h.context.personelListesi=[];
  h.context.window.dogumGunleriDoldur();
  assert.equal(target.innerHTML,'','later empty data clears the previously loaded card');
});

test('production pickup snapshot replacements retain shrink/wrap hooks and update actions in place', () => {
  const h=createHarness('staff','stress'),target=h.node('okulZiliListe');
  const row={...h.data.pickup[0]};
  const snapshot=()=>({forEach:fn=>fn({id:'synthetic-live-id',data:()=>row})});
  const outputs=[];
  for(const state of ['yolda','hazir','teslim']) {
    row.durum=state;
    h.context.window.okulZiliDoldur(snapshot());
    const html=target.innerHTML;outputs.push(html);
    for(const cls of ['portal-pickup-row','portal-pickup-body','portal-pickup-name','portal-pickup-actions'])assert.ok(html.includes(`class="${cls}"`),`${state} retains ${cls}`);
    assert.ok(html.includes(LONG_TOKEN));
    assert.equal(h.node('okulZiliListe'),target,'snapshot replaces content, not the card identity');
    if(state==='yolda')assert.match(html,/Hazırla/);
    if(state==='hazir')assert.match(html,/Teslim Et/);
    if(state==='teslim'){assert.match(html,/Teslim edildi/);assert.doesNotMatch(html,/<button/);}
  }
  assert.equal(new Set(outputs).size,3);
  h.context.window.okulZiliDoldur({forEach(){}});
  assert.match(target.innerHTML,/çıkış bildirimi yok/);
  assert.doesNotMatch(target.innerHTML,/portal-pickup-row/);
});

test('pickup stress card uses genuine row cap and teacher class filtering', () => {
  const h=createHarness('admin','stress');
  const snap={forEach:fn=>h.data.pickup.forEach(row=>fn({id:row.id,data:()=>row}))};
  h.context.window.okulZiliDoldur(snap);
  assert.equal((h.node('okulZiliListe').innerHTML.match(/class="portal-pickup-row"/g)||[]).length,6);
  assert.match(h.node('okulZiliListe').innerHTML,/\+4 bildirim daha/);
  h.context.ogretmenRolMu=()=>true;
  h.context.aktifKullaniciSiniflari=['Synthetic unrelated class'];
  h.context.window.okulZiliDoldur(snap);
  assert.match(h.node('okulZiliListe').innerHTML,/çıkış bildirimi yok/);
});

test('production attendance renderer transitions outside/inside/break with all four controls intact', () => {
  const h=createHarness('staff'),target=h.node('ozetDevamKart');
  const events=[];
  for(const [event,state] of [[null,'Dışarıdasınız'],['giris','Çalışıyorsunuz'],['mola-basla','Moladasınız'],['mola-bitir','Çalışıyorsunuz'],['cikis','Dışarıdasınız']]){
    if(event)events.push({tip:event,zaman:'2026-10-05T09:00:00Z'});
    h.context.window.devamKartiCiz({kayitlar:events},'ozetDevamKart');
    assert.ok(target.innerHTML.includes(state));
    assert.match(target.innerHTML,/class="portal-attendance-actions"/);
    assert.equal((target.innerHTML.match(/<button /g)||[]).length,4);
    assert.ok((target.innerHTML.match(/disabled/g)||[]).length>=2);
  }
});

test('stress/realtime role fixtures contain long tokens and safe synthetic updates without stale role markup', () => {
  for(const role of ROLES){
    const stress=renderScenario(role,'stress'),realtime=renderScenario(role,'realtime');
    assert.ok(stress.html.includes(LONG_TOKEN));
    assert.notEqual(JSON.stringify(stress.patches),JSON.stringify(realtime.patches));
    for(const state of [stress,realtime]){
      for(const html of [state.html,...Object.values(state.patches).map(p=>p.html||p.text)]){
        assert.doesNotMatch(html,/\son\w+\s*=/i);
        assert.doesNotMatch(html,/<script\b|\s(?:src|srcset|href|action|poster)\s*=/i);
        assertNoCredentials(html);
      }
    }
    if(role==='parent'){assert.ok(stress.html.includes('veliOkulZiliKart'));assert.ok(!stress.html.includes('id="okulZiliListe"'));}
    else assert.ok(stress.html.includes('id="okulZiliListe"'));
  }
});

test('new loaded-layout CSS fixes track sizing and wrapping rather than masking new overflow', () => {
  const css=read('stil/arayuz-duzeltmeleri.css');
  const loaded=css.slice(css.indexOf('/* ── 9)')).replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(loaded.length>2000);
  assert.doesNotMatch(loaded,/overflow(?:-x)?\s*:\s*(?:hidden|clip)/);
  assert.match(loaded,/\.ozet-orta-grid\s*\{[^}]*minmax\(0, 1\.7fr\) minmax\(0, 1fr\)/);
  assert.match(loaded,/\.ozet-kpi-grid\s*\{[^}]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(loaded,/\.ca-hero-row\s*\{[^}]*minmax\(0, 1\.3fr\) minmax\(0, 1fr\)/);
  assert.match(loaded,/\.portal-pickup-row\s*\{[^}]*grid-template-columns:\s*28px 42px minmax\(0, 1fr\)/);
  assert.match(loaded,/\.portal-pickup-actions\s*\{[^}]*flex-wrap:\s*wrap[^}]*min-width:\s*0/);
  assert.match(loaded,/\.ozet-dg-ad\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/);
  assert.match(loaded,/\.portal-attendance-actions > button\s*\{[^}]*min-width:\s*0\s*!important/);
  for(const cls of ['portal-form-grid','portal-week-navigation','portal-week-days','portal-profile-leave-summary','veli-card-grid-2'])assert.ok(loaded.includes('.'+cls));
  assert.match(loaded,/\.portal-form-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(loaded,/\.portal-profile-leave-summary\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
});

test('pickup wrap override has greater selector specificity than actual late-injected reception nowrap rule', () => {
  const late=lateReceptionCss(),css=read('stil/arayuz-duzeltmeleri.css');
  assert.match(late,/#okulZiliListe button\s*\{[^}]*white-space:nowrap !important/);
  assert.match(css,/#okulZiliListe \.portal-pickup-actions > button\s*\{[^}]*white-space:\s*normal !important/);
  // Both rules are !important. Added class specificity wins even when the module
  // inserts its rule later. Runtime computed style is also checked by the fixture.
  const specificity=s=>[...(s.match(/#[\w-]+/g)||[])].length*100+[...(s.match(/\.[\w-]+/g)||[])].length*10;
  assert.ok(specificity('#okulZiliListe .portal-pickup-actions > button')>specificity('#okulZiliListe button'));
});

test('offline fixture covers all requested widths, phases and roles with honest geometry instrumentation', () => {
  assert.deepEqual(WIDTHS,[320,360,375,390,414,430,844,1280,1440]);
  assert.equal(ROLES.length*PHASES.length*WIDTHS.length*2,216);
  const html=buildVisualFixture();
  assertNoCredentials(html);
  assert.match(html,/Browser geometry NOT RUN/);
  assert.match(html,/getBoundingClientRect\(\)/);
  assert.match(html,/getClientRects\(\)/);
  assert.match(html,/scrollWidth/);
  assert.match(html,/control clipped by ancestor/);
  assert.match(html,/late CSS defeated pickup action wrapping/);
  assert.match(html,/applyPatches\(scenario\)/);
  assert.match(html,/mountedPhase!=='stress'/);
  assert.match(html,/connect-src 'none'/);
  assert.doesNotMatch(html,/fetch\(|XMLHttpRequest|WebSocket\(|serviceWorker\.register/);
  assert.doesNotMatch(html,/function yonetimHomeHTML\(|window\.devamKartiCiz\s*=/,'fixture embeds rendered snapshots, never production scripts');
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,2);
  const payload=JSON.parse(scripts[0][2]);
  assert.equal(Object.keys(payload.scenarios).length,3);
  for(const role of ROLES)assert.deepEqual(Object.keys(payload.scenarios[role]),PHASES);
  assert.doesNotThrow(()=>new vm.Script(scripts[1][2]),'browser instrumentation parses; NOT browser execution');
  assert.doesNotMatch(productionCss(),/url\(|@import\s/i);
});

test('markup sanitizer strips executable handlers and remote resource attributes', () => {
  const clean=sanitizeMarkup('<div onclick="write()"><img src="https://synthetic.invalid/test.png" onerror="write()"><button formaction="https://synthetic.invalid">Safe</button><script>write()</script></div>');
  assert.equal(clean,'<div><img><button>Safe</button></div>');
});
