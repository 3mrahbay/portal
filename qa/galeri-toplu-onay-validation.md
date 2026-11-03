# Portal gallery bulk approval and notice grouping

Prepared 2026-11-03 against main f92f1da. No real media were approved and no parent notifications were sent during testing.

## Behavior

- The pending queue offers a class/recipient-target filter and “Görünenleri toplu onayla”. Confirmation captures the displayed IDs; later uploads are not included.
- Each decision rechecks the pending state in a Firestore transaction. Concurrent approve/reject decisions cannot overwrite a completed decision. Partial failures remain visible; remaining items continue.
- Ordinary gallery approvals create at most one root notification per target/active period in ten minutes. Child-specific educational approvals use a separate ten-minute group per child; their individual learning records remain intact.
- A hashed `ayarlar/galeriOnayBildirim_<sha256>` document stores only the server timestamp. It is committed with the root notices; it contains no names, emails, or media. This uses the existing settings collection and the currently released principal/owner write permissions. No rule changes or backend deployment are required.
- Recipient notices are created without reading or updating parents’ existing records. The first group preserves the existing child notification channel; later approvals do not repeat it. No historical notice is changed.
- Push is attempted after the notification transaction commits. An ambiguous FCM response is not retried. A browser closing between commit and push can leave an in-app notice without a push; device receipt/sound is not claimed by the tests.
- The behavior applies to approvals made in the updated Portal. The v223 service worker, runtime label, import chain and reload guard are synchronized.

## Verification

- 105 focused runtime/integration/release tests passed, including 13 new grouping/decision/bulk cases and three added precache dependency checks.
- Tested five individual class approvals, simultaneous managers, reloads, other targets, the ten-minute boundary, denied transaction, uncertain push, inactive/unauthorized actors, exact recipient scope, child education, competing decisions, late uploads, cancellation, cached/error queue, partial failure, double submission and account switch.
- All three nonempty inline script blocks parse with Node. `git diff --check` passes.
- Local synthetic browser: selecting Lavantalar displayed five of six items; bulk confirmation published those five and left the other class pending. Desktop and 320 px content-width layouts were inspected. No production APIs or media were used. A later repeat browser check stalled in the browser tool; it is not counted as another passed interaction.
- Baseline full suite: 1211 passed / 11 failed. Existing failures include stale fixed-version assertions, missing `pdftotext`, and a message-test dynamic-import harness failure. Final broad-suite comparison is recorded separately in the PR.

Preview: `node qa/galeri-toplu-onay-preview.mjs` writes a synthetic fixture outside the repository under `../gallery-preview/`. It mocks persistence/notifications; focused runtime tests execute the real transaction and grouping helpers against synthetic adapters.
