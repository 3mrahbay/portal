import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('index.html', 'utf8');
const start = source.indexOf('window.mufredatAlanAdDegistir = function(');
assert.ok(start >= 0);
const handler = source.slice(start, source.indexOf('\n};', start) + 3);
const saveStart = source.indexOf('async function mufredatKaydet(');
const save = source.slice(saveStart, source.indexOf('\n}', saveStart) + 2);
const original = { id: 'speaking', ad: 'Speaking (Konuşma)', ikon: '💬',
  gruplar: [{ ad: 'Selamlaşma & Tanışma', dersler: ['Hello / Hi / Bye'] }] };
let answer, saved, renders = 0;
const context = vm.createContext({
  window: {}, aktifEditorDisiplin: 'ingilizce',
  aktifMufredatlar: { ingilizce: [structuredClone(original)] },
  prompt: () => answer, showToast: () => {},
  renderMufredatEditor: () => renders++,
  db: {}, doc: (...args) => args.slice(1), serverTimestamp: () => 'timestamp',
  setDoc: async (path, data) => { saved = structuredClone({ path, data }); }, console
});
vm.runInContext(handler + '\n' + save, context);
const rename = () => context.window.mufredatAlanAdDegistir(0);
for (answer of [null, '', '   ', original.ad]) rename();
assert.equal(renders, 0);
assert.deepEqual(context.aktifMufredatlar.ingilizce[0], original);
answer = '  Konuşma ve İletişim  ';
rename();
await context.mufredatKaydet('ingilizce');
assert.equal(saved.data.alanlar[0].ad, 'Konuşma ve İletişim');
assert.equal(saved.data.alanlar[0].id, 'speaking');
assert.deepEqual(saved.data.alanlar[0].gruplar, original.gruplar);
assert.equal(saved.path.join('/'), 'mufredatlar/ingilizce');
assert.equal(renders, 1);
assert.match(source, /onclick="mufredatAlanAdDegistir\(\$\{ai\}\)"/);
console.log('Curriculum rename: cancel, blank, unchanged, persistence and stable record keys passed');
