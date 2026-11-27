# Program-scoped curriculum service

Updates the existing `mufredatIslemV1` callable in `bcka-site`, `europe-west3`. This directory is the **curriculum codebase only**, not the project's other functions. Node 22, App Check retained. Never deploy all project functions using an incomplete local configuration.

## Source provenance

On 2026-11-27 the v2 Cloud Functions metadata and its referenced Cloud Storage source generation were read using the existing authenticated Firebase account. The deployed ZIP's source matched the prior local deployment archive byte for byte before these changes:

- `src/index.mjs`: SHA256 `e9ec43cc53fc4ebac72930b6cc09aea0a8ecc8be76c7e7c72c805bf0a0ed87ca`
- `src/domain.mjs`: SHA256 `36c17cfc681dad10303a82d2ac703a946c99de42df8ea77da37635a6b01b4db1`
- `package.json`: SHA256 `e25d4096c065338c86f3361b8d2a0c537b228b8ef4bb63cad510815df81d90df`

The lockfile comes from that deployed source. No live records or permissions were changed during development.

## Authorization and history

- Active classroom/assistant teachers default to Montessori + Orman; English, Values and Forest teachers default to their program. Generic branch teachers require explicit `personeller/{email}.egitimProgramlari`.
- An explicit array overrides defaults, including an empty array. Multiple assignments are supported. Program assignments are managed by the existing authorized personnel administration; never inferred from job title.
- Teachers still need the existing person-level `mufredatDuzenleme === true` switch. Management retains its existing edit permission. PDR reads history but cannot load the editor or save.
- Both load and every member of a multi-program save are checked in the transaction against current personnel data. UID/email mapping, active/verified identity and App Check remain intact.
- Curriculum and `mufredatDenetim/{program}/kayitlar/{id}` snapshots commit together. The server supplies actor UID, email, name, role, time, before/after, and changed keys. Student data is not accepted in requests or copied to history. Renames preserve marks, dates **and detail/stage/photo metadata**.
- History shows the latest 30 entries; older entries remain stored. Details are fetched separately to bound callable payload size. History begins with this release; older minimal root audit documents remain untouched.
- Audit applies to this callable. Existing management direct-write paths and console/admin SDK writes are not automatically audited. Client history access is entirely through the callable.
- Program selection is a UI/navigation restriction. Existing student documents include multiple programs: this change does not claim field-level read isolation or change class/student Firestore permissions. Branch observation write permissions are not expanded by a curriculum assignment.

## Release order — approval required, not deployed

1. Fetch the current active rules again. Run `node security/prepare-curriculum-audit-rules.mjs CURRENT.rules CANDIDATE.rules`; inspect the two changes and rerun the history rules test. This adds a deny-all client match for history and excludes it from the existing management catch-all. No other access rule is broadened. The generated rules are a review candidate, not an automatically deployable policy.
2. With explicit production approval, publish that narrow rules patch, then update **only** the existing `mufredatIslemV1` in its verified curriculum codebase. Recheck current deployed source before overwriting if it changed since the hashes above. Preserve all other functions/configuration.
3. Publish Portal v243 after backend readiness; the editor requires `status.protocol === 2` and otherwise displays an update-needed error. Web alone cannot enable this feature. PR142's landing header change is separate.
4. Management reviews each person's actual role and program assignment. Do not silently change live staff records. Validate real teacher/PDR/management sessions after approval using reads; test actual saves only against an explicitly approved test curriculum.
5. ZEKY was not adapted or released. The shared callable will enforce scope for existing clients too; check ZEKY compatibility before releasing the shared service if deployed clients load unrelated programs.

## Validation

Pure domain/editor/matrix tests use Node + jsdom. Emulator tests require `firebase-admin`, `firebase`, `@firebase/rules-unit-testing` available in NODE_PATH and refuse non-loopback Firestore endpoints.

```
node --test functions/curriculum/test/domain.test.mjs tests/egitim-program-yetki.test.mjs tests/mufredat-alan-adi.test.mjs tests/mufredat-yetki-editor.test.mjs qa/egitim-calisma-runtime.cjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:8296 node tests/mufredat-callable-emulator.cjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:8296 CURRICULUM_RULES_FILE=CANDIDATE.rules node tests/mufredat-gecmisi-rules.cjs
```

Use Java `-Duser.language=en -Duser.country=US` for emulator 1.22.0; its Turkish locale can fail compiling warnings. Verified: 27 domain/editor/matrix tests; callable integration covering scope/atomic rename/history/conflict/PDR/branch; 75 rules isolation checks. Synthetic Chrome preview covers single-program routing, limited classroom picker, PDR disabled marks and history; mobile history at 390px. Production behavior remains unverified until authorized release.
