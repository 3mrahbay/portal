import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// HTML raw-text parsing matters: a literal closing script tag ends a script
// even inside a JavaScript template string. Do not extract scripts with JS regex.
function parse(source) {
  const result = spawnSync('python3', ['-c', `
import json, sys
from html.parser import HTMLParser
class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.scripts, self.text, self.ids = [], [], []
        self.script = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'): self.ids.append(attrs['id'])
        if tag == 'script':
            self.script = dict(attrs=attrs, code='', line=self.getpos()[0])
            self.scripts.append(self.script)
    def handle_endtag(self, tag):
        if tag == 'script': self.script = None
    def handle_data(self, data):
        if self.script is not None: self.script['code'] += data
        else: self.text.append(data)
p = Parser()
p.feed(sys.stdin.read())
print(json.dumps(dict(scripts=p.scripts, text=''.join(p.text), ids=p.ids)))
`], { input: source, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function check(source) {
  const parsed = parse(source);
  const gates = parsed.scripts.filter(s => s.attrs.src === 'js/kitap-kulubu/gate.mjs?v=2');
  assert.equal(gates.length, 1, 'gate must be a real HTML script element');
  assert.equal(gates[0].attrs.type, 'module');
  assert.equal(parsed.scripts.at(-1), gates[0], 'gate belongs after the final inline script');
  assert.ok(!parsed.ids.includes('rezervasyonOverlay'), 'email markup must not escape into DOM');
  assert.ok(!parsed.text.includes('${cicekSvg}'), 'email placeholders must not escape into DOM');
  for (const script of parsed.scripts.filter(s => !s.attrs.src)) {
    const args = script.attrs.type === 'module' ? ['--input-type=module', '--check'] : ['--check'];
    const result = spawnSync(process.execPath, args, { input: script.code, encoding: 'utf8' });
    assert.equal(result.status, 0, `inline script at line ${script.line}: ${result.stderr}`);
  }
}

test('HTML parser preserves inline JavaScript and recognizes the footer gate module', () => check(html));

test('regression guard rejects a loader embedded inside the email template', () => {
  const loader = '<script type="module" src="js/kitap-kulubu/gate.mjs?v=2"></script>\n';
  const withoutLoader = html.replace(loader, '');
  const mailStart = withoutLoader.indexOf('function portalMailSablon');
  assert.ok(mailStart >= 0);
  const mailBodyEnd = withoutLoader.indexOf('</body>', mailStart);
  assert.ok(mailBodyEnd > mailStart);
  const broken = withoutLoader.slice(0, mailBodyEnd) + loader + withoutLoader.slice(mailBodyEnd);
  assert.throws(() => check(broken), /gate must be a real HTML script element/);
});
