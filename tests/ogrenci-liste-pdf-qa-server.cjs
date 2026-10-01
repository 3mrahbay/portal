/* Fallback for managed browsers where Playwright cannot launch its own process.
 * node tests/ogrenci-liste-pdf-qa-server.cjs [output-dir]
 * Open the printed localhost URL, then click the synthetic-test button.
 * This test-only server accepts synthetic PDFs; production code never posts data.
 */
const { createServer } = require('node:http');
const { readFile, mkdir, writeFile } = require('node:fs/promises');
const { join, resolve, extname } = require('node:path');
const { tmpdir } = require('node:os');
const root = resolve(__dirname, '..');
const output = resolve(process.argv[2] || join(tmpdir(), 'ogrenci-liste-pdf-qa'));
const requests = [];
const harness = `<!doctype html><html lang="tr"><meta charset="utf-8"><title>Synthetic PDF QA</title><link rel="icon" href="data:,">
<h1>Synthetic PDF QA</h1><p>Only fictional fixtures. No real school data or account connection.</p>
<button id="run">Run synthetic PDF checks</button><pre id="result">Ready</pre>
<script type="module">
import { ogrenciListePdfOlustur } from '/js/ogrenci-liste-pdf.js';
import { syntheticReport, edgeReport, oversizeReport } from '/tests/ogrenci-liste-pdf-fixtures.mjs';
const fetchCalls = [], consoleCalls = [], errors = [];
const originalFetch = window.fetch;
window.fetch = (...args) => { fetchCalls.push({ url: String(args[0]), method: args[1]?.method || 'GET', body: !!args[1]?.body }); return originalFetch(...args); };
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = () => { consoleCalls.push(method); };
window.addEventListener('error', () => errors.push('pageerror'));
window.addEventListener('unhandledrejection', () => errors.push('unhandledrejection'));
for (const name of ['jspdf', 'jsPDF', 'PDFLib', 'fontkit']) Object.defineProperty(window, name, { configurable: true, get() { throw new Error('Legacy PDF global was consulted'); } });
document.querySelector('#run').onclick = async () => {
  document.querySelector('#run').disabled = true;
  document.querySelector('#result').textContent = 'Running…';
  try {
    const results = [];
    for (const [name, report] of [['edges', edgeReport()], ['500-rows', syntheticReport(500)], ['oversized-row', oversizeReport()], ['empty', syntheticReport(0)]]) {
      const start = performance.now();
      const bytes = await ogrenciListePdfOlustur(report);
      results.push({ name, bytes: Array.from(bytes), milliseconds: Math.round(performance.now() - start) });
    }
    if (consoleCalls.length || errors.length || fetchCalls.length !== 2 || !fetchCalls.every(call => call.url.startsWith(location.origin + '/js/vendor/ogrenci-liste-pdf/') && call.method === 'GET' && !call.body)) throw new Error('Browser isolation check failed');
    // The test harness persists synthetic output after the exporter has finished.
    const response = await originalFetch('/synthetic-results', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ results, fetchCalls, consoleCalls, errors }) });
    if (!response.ok) throw new Error('Could not persist synthetic result');
    document.querySelector('#result').textContent = 'PASS\\n' + JSON.stringify({ files: results.map(({ name, bytes, milliseconds }) => ({ name, bytes: bytes.length, milliseconds })), localFontRequests: fetchCalls.length, consoleMessages: consoleCalls.length, pageErrors: errors.length }, null, 2);
  } catch (error) { document.querySelector('#result').textContent = 'FAIL: ' + error.message; }
};
</script>`;
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  requests.push({ method: request.method, path });
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'");
  if (path === '/' && request.method === 'GET') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(harness); return; }
  if (path === '/synthetic-results' && request.method === 'POST') {
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of request) { length += chunk.length; if (length > 8000000) throw new Error('too large'); chunks.push(chunk); }
      const { results, fetchCalls, consoleCalls, errors } = JSON.parse(Buffer.concat(chunks).toString());
      await mkdir(output, { recursive: true });
      if (!Array.isArray(results) || results.length !== 4 || !results.every(row => ['edges', '500-rows', 'oversized-row', 'empty'].includes(row.name))) throw new Error('unexpected fixture');
      for (const { name, bytes } of results) await writeFile(join(output, name + '.pdf'), new Uint8Array(bytes));
      const metadata = { files: results.map(({ name, bytes, milliseconds }) => ({ name, bytes: bytes.length, milliseconds })), fetchCalls, consoleMessages: consoleCalls.length, pageErrors: errors.length, requests };
      await writeFile(join(output, 'browser-qa.json'), JSON.stringify(metadata, null, 2));
      response.end('ok');
    } catch { response.writeHead(400); response.end('invalid result'); }
    return;
  }
  const permitted = path === '/js/ogrenci-liste-pdf.js' || path === '/tests/ogrenci-liste-pdf-fixtures.mjs' || path.startsWith('/js/vendor/ogrenci-liste-pdf/');
  if (!permitted || path.includes('..') || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
  try { response.setHeader('Content-Type', ['.js', '.mjs'].includes(extname(path)) ? 'text/javascript' : 'font/ttf'); response.end(await readFile(join(root, path))); }
  catch { response.writeHead(404); response.end(); }
});
server.listen(0, '127.0.0.1', () => process.stdout.write('http://127.0.0.1:' + server.address().port + '\n'));
