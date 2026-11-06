# Finance import approval host integration

The Portal panel uses only Firebase callable endpoints; it never writes accounting
or review documents directly. `portal-entry.js` registers the panel for the owner.
It remains unavailable until the host supplies `PortalAPI.financeImportFunctions`,
an already configured Functions instance using the deployment's actual region and
App Check. The UI owner check is presentation only.

`financeCallables` binds four real onCall handlers using injected official Firebase
Admin/Functions SDK exports. Export its result from the separately reviewed backend
entry point, with a server-configured owner UID and region. No UID or email is taken
from request.data. Every handler requires verified owner UID, verified owner email,
and valid unconsumed App Check. Owner UID configuration is mandatory and has no
fallback. This PR neither initializes nor deploys a production backend.

Before enabling production, independently review the deployed Firestore rules:
all client writes to finansIceriAktarimlari, finansOnayIncelemeleri,
finansKaynakKilitleri and imported accounting entries must be denied, including
through any broad matching allow clause. Review documents must not be client
readable either. Admin server access bypasses these rules. Adding a deny-only rule
cannot override a broader allow. The emulator test exercises Admin transactions, not production security rules.
The existing accounting routes and catch-all rules need a separate access review;
do not enable this feature until that review is complete. No IAM, OAuth, rules,
secrets or environment changes are made here.

Candidate ingestion: a trusted importer calls financeImportStage with an explicit
candidate (source mailbox/message ID, positive integer minor units, currency,
proof/status/date/method, and student/period/item or expense details). Staging does
not post. List returns up to 100 pending candidates. Review stores a 15-minute server
snapshot bound to the owner, choices, candidate and current balance. Approve accepts
only its review ID and the explicit action. The transaction rechecks source and
plan, consumes the review, and atomically writes the ledger, movement, strong source
lock when available, and owner-only notification. Exact retries reconcile an
unknown outcome, including after expiration. Expired unconsumed reviews require a
new preview. Cross-mailbox and legacy duplicate review stays mandatory.

No mailbox polling, source extraction, category inference, currency conversion,
invoice-as-payment assumption or automatic approval is implemented.

Tests (synthetic data only):

```
node --test tests/finans-import-approval.test.mjs tests/finans-import-server.test.mjs tests/finans-payment-plan.test.mjs tests/finans-mukerrer-muhasebe.test.mjs
FINANCE_TEST_DEPS=/path/to/test/node_modules node --test tests/finans-import-ui.test.mjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:8187 FINANCE_TEST_DEPS=/path/to/test/node_modules node --test tests/finans-import-emulator.test.mjs
```

UI tests use jsdom. Integration tests use firebase-admin against a localhost-only
emulator with a fixed demo project. Dependencies are isolated from production.
