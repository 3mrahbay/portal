// Node-only generation for parser/visual QA when a browser is unavailable.
// This deliberately uses local fictional fixtures, never live portal data.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ogrenciListePdfOlustur } from '../js/ogrenci-liste-pdf.js';
import { edgeReport, syntheticReport, oversizeReport } from './ogrenci-liste-pdf-fixtures.mjs';
const output = resolve(process.argv[2] || '/tmp/ogrenci-liste-pdf-qa');
await mkdir(output, { recursive: true });
globalThis.fetch = async url => {
  if (url.protocol !== 'file:' || !url.pathname.includes('/js/vendor/ogrenci-liste-pdf/')) throw new Error('Only local font fixtures are allowed');
  return { ok: true, arrayBuffer: async () => new Uint8Array(await readFile(url)).buffer };
};
const results = [];
for (const [name, report] of [['edges', edgeReport()], ['500-rows', syntheticReport(500)], ['oversized-row', oversizeReport()], ['empty', syntheticReport(0)]]) {
  const start = performance.now();
  const bytes = await ogrenciListePdfOlustur(report);
  await writeFile(resolve(output, `${name}.pdf`), bytes);
  results.push({ name, bytes: bytes.length, milliseconds: Math.round(performance.now() - start) });
}
await writeFile(resolve(output, 'node-generation-qa.json'), JSON.stringify({ runtime: 'Node (browser unavailable)', files: results }, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
