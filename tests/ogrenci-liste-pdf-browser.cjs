/* Synthetic-only browser QA. Run: node tests/ogrenci-liste-pdf-browser.cjs [output-dir] */
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile, mkdir, writeFile } = require('node:fs/promises');
const { join, resolve, extname } = require('node:path');
const { tmpdir } = require('node:os');
const { chromium } = require('playwright');

(async () => {
  const root = resolve(__dirname, '..');
  const output = resolve(process.argv[2] || join(tmpdir(), 'ogrenci-liste-pdf-qa'));
  await mkdir(output, { recursive: true });
  const requests = [];
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html lang="tr"><meta charset="utf-8"><title>Synthetic PDF QA</title><link rel="icon" href="data:,">');
      return;
    }
    const permitted = path === '/js/ogrenci-liste-pdf.js' || path === '/tests/ogrenci-liste-pdf-fixtures.mjs' || path.startsWith('/js/vendor/ogrenci-liste-pdf/');
    if (!permitted || path.includes('..')) { response.writeHead(404); response.end(); return; }
    try {
      const content = await readFile(join(root, path));
      response.setHeader('Content-Type', ['.js', '.mjs'].includes(extname(path)) ? 'text/javascript' : 'font/ttf');
      response.end(content);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath() });
    const page = await browser.newPage();
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', message => consoleMessages.push(message.type()));
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      requests.push({ origin: url.origin, method: request.method(), path: url.pathname, query: url.search, body: request.postData() });
      if (url.origin !== origin) { await route.abort(); return; }
      await route.continue();
    });
    await page.goto(origin);
    const results = await page.evaluate(async () => {
      for (const name of ['jspdf', 'jsPDF', 'PDFLib', 'fontkit']) {
        Object.defineProperty(window, name, { configurable: true, get() { throw new Error('Legacy PDF global was consulted'); } });
      }
      const { ogrenciListePdfOlustur } = await import('/js/ogrenci-liste-pdf.js');
      const { syntheticReport, edgeReport, oversizeReport } = await import('/tests/ogrenci-liste-pdf-fixtures.mjs');
      const results = [];
      for (const [name, report] of [['edges', edgeReport()], ['500-rows', syntheticReport(500)], ['oversized-row', oversizeReport()], ['empty', syntheticReport(0)]]) {
        const start = performance.now();
        const bytes = await ogrenciListePdfOlustur(report);
        results.push({ name, bytes: Array.from(bytes), milliseconds: Math.round(performance.now() - start) });
      }
      return results;
    });
    for (const { name, bytes } of results) await writeFile(join(output, `${name}.pdf`), new Uint8Array(bytes));
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleMessages, [], 'no student-list content or errors may be logged');
    assert.ok(requests.every(request => request.origin === origin && request.method === 'GET' && !request.body && !request.query));
    assert.equal(requests.filter(request => request.path.endsWith('.ttf')).length, 2);
    const metadata = { files: results.map(({ name, bytes, milliseconds }) => ({ name, bytes: bytes.length, milliseconds })), requests: requests.map(({ path }) => path), consoleMessages: 0, pageErrors: 0 };
    await writeFile(join(output, 'browser-qa.json'), JSON.stringify(metadata, null, 2));
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
