# Local student-list PDF dependencies

Verified against the official project documentation on 2026-10-01.
All runtime imports are same-origin files. No CDN, telemetry or remote font loader is used.
`SHA256SUMS.json` pins the shipped JavaScript and font files.

- **pdf-lib 1.17.1**: official `dist/pdf-lib.esm.min.js` from the preinstalled npm package. The dev-only source-map URL was removed; all library code is unchanged. MIT license in `pdf-lib-LICENSE.txt`. Official source: https://github.com/Hopding/pdf-lib and https://pdf-lib.js.org/
- **@pdf-lib/fontkit 1.1.1**: official complete `dist/fontkit.umd.js` from the npm registry tarball. Tarball SHA-512 integrity: `sha512-KjMd7grNapIWS/Dm0gvfHEilSyAmeLvrEGVcqLGi0VYebuqqzTbgF29efCx7tvx+IEbG3zQciRSWl3GkUSvjZg==`. The unchanged UMD source and its inline notices are wrapped by a module-local `module`/`exports` binding and an ESM default export. It neither reads nor writes `window.fontkit`, `window.PDFLib` or any jsPDF object. Official fork: https://github.com/Hopding/fontkit. Upstream author: Devon Govett; fork maintainer: Andrew Dillon. The upstream archive declares MIT in its README and package metadata but omits a standalone license file; both originals are included, alongside the MIT terms in `fontkit-LICENSE.txt`. The official non-minified bundle retains its bundled component notices (including Apache-licensed Brotli and MIT components).
- **DejaVu Sans / DejaVu Sans Bold 2.37**: unmodified TTF files from the system's DejaVu font package. Official font project and full notices: https://dejavu-fonts.github.io/ and https://github.com/dejavu-fonts/dejavu-fonts/blob/version_2_37/LICENSE. License in `DejaVu-LICENSE.txt`. Fonts are embedded as subsets in the PDF for portable Turkish characters and searchable text.

Do not replace these files with global script tags. The existing portal's legacy PDF patches must remain isolated from this exporter. Upgrade deliberately, update checksums, and rerun `tests/ogrenci-liste-pdf.test.mjs` and `tests/ogrenci-liste-pdf-browser.cjs`.

The exporter rejects characters missing from the bundled font with a generic, data-free error rather than silently dropping them. It supports Turkish and the other characters covered by DejaVu Sans, not every Unicode script. Wrapped rows that exceed a page continue on the next page with an explicit continuation label. No student-list content is retained between calls.

For parser and visual QA without a browser, run `node tests/ogrenci-liste-pdf-samples.mjs /tmp/ogrenci-liste-pdf-qa`, then `python tests/ogrenci-liste-pdf-verify.py /tmp/ogrenci-liste-pdf-qa`. Dependencies for the latter: pypdf, pdfplumber and Poppler. Inspect its rendered first/middle/last PNGs as well as its assertions. A manual synthetic browser harness is available as `node tests/ogrenci-liste-pdf-qa-server.cjs`; open its printed localhost URL. If browser/network policy blocks localhost, record that limit rather than claiming browser verification.
