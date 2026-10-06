# Gallery approval validation (synthetic only)

Date: 2026-10-06

## Passed

- `node --test tests/galeri-onay-integration.test.mjs tests/galeri-gozlem-approval-integration.test.mjs`: 31/31
- `node --check qa/galeri-onay-ui.cjs`
- `GALLERY_QA_PREPARE_ONLY=1 node qa/galeri-onay-ui.cjs`: assembled browser JavaScript compiles

The integration fixtures execute selected active index handlers and the actual observation module. Firebase, upload, notification, document, and session state are synthetic. No real users, media, credentials, writes, login, or network calls are used.

Gallery coverage (19 cases): both pending statuses; initial loading; cached/error/confirmed-empty distinctions; live counts; retries; old getDocs and session completions; logout/player cleanup; known and legacy notification routing; processed/deleted no-op; interrupted and competing deep links; actual module/tab leave-and-return handlers.

Observation coverage (12 cases): atomic gallery plus observation commit before approval notice; transaction/upload failure without notification; teacher privacy before approval; coordinator/principal/founder autoapproval; text-only notification; repeated Save and blocked Close while saving; account switch during upload, transaction read, and after commit; notice-delivery failure warning after successful persistence.

## Browser execution blocked, not passed

`node qa/galeri-onay-ui.cjs` could not launch installed Chromium: `process_singleton_posix.cc` reports `socket() failed: Operation not permitted`. A second launch attempt produced the same failure. Own-cloud-browser fallback could open a blank tab, but its URL policy rejected the local `file://` fixture. No user computer or browser was used.

Consequently desktop/mobile rendering, browser interactions, and screenshots have **not** been verified. No screenshots were produced. The ready-to-run Playwright script intercepts every request and covers desktop 1280×900 and mobile 320×740, pending/error/empty states, retry, deep links, interruptions, and overflow when run in a supported browser executor.

Default generated artifacts live outside the repository at `../qa-output/gallery-approval/`; override with `GALLERY_QA_OUTPUT`. Run prepare-only mode to build a synthetic fixture without launching Chromium. Do not treat that generated fixture as screenshot evidence.
