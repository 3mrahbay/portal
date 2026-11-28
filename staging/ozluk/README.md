# Isolated personnel document verification

This codebase is **staging-only**, uses synthetic accounts and refuses a production project. It does not deploy Firestore rules or change the existing staging appointment functions. Deploy the hosting content exclusively to an expiring preview channel; do not deploy the Hosting live channel.

The shared `js/personel-belge-client.js` is identical in Portal, ZEKY and the staging test page. It authenticates every upload/read, uses opaque document IDs, disables HTTP caching and redirects, rejects account changes during requests, and clears temporary previews on close, backgrounding, session change or after two minutes. Medical forms no longer fall back to general media upload. Existing records remain untouched; legacy links are displayed as awaiting secure access migration.

## Access boundary

- The staging runtime uses a dedicated private bucket with public access prevention and uniform bucket IAM.
- Runtime permissions are object creator/viewer on that bucket and Firebase Auth viewer in the staging project. No runtime object update/delete permission is granted.
- Fresh server-side account lookup verifies active, verified and unexpired synthetic membership on every request. Only the owner or an explicit `medicalReviewer` can read a document; an accountant cannot read another user's document.
- Each authenticated decision/read/write has server-created audit objects; an audit failure prevents delivery. Audit objects contain identifiers and outcomes, not tokens, filenames or document content.
- The server accepts up to 5 MiB of PDF/PNG/JPEG with matching file signatures. Signature validation is not malware scanning. Use synthetic files only.
- Test document lifecycle: seven days. Audit lifecycle: thirty days. Synthetic authorizations and preview channel: seven days.
- App Check is not claimed as verified by this focused browser harness. Authentication and server-managed membership are enforced independently.

## Release gates

Do not merge or deploy these drafts to production yet. Production has deliberately no enabled document endpoint. Before enabling it: implement and review the production role adapter, bind document ownership to leave creation on the server, plan migration/revocation of legacy file references, validate malware/quarantine and retention requirements, complete native iPhone/App Check checks, then obtain production approval. Firestore candidate rules reject new public document URLs but preserve existing records; apply them in an explicitly reviewed compatibility rollout, not as part of this staging deployment.

The focused staging harness verifies document access; it is not a full Portal or native ZEKY build. No real personnel data is copied into it. Credentials, Firebase SDK configuration and operational provisioning scripts are excluded from this public source.

## Verification

`functions/domain.test.mjs` exercises server authorization and input boundaries. `tests/personel-belge-client.test.mjs` in the repository exercises client fail-closed behavior and Portal/ZEKY parity. `tests/ozluk-rules-emulator.cjs` covers candidate rules, including rejection of public URLs and malformed references. Run deployment and account-specific tests only against the explicitly named staging project; never use real medical files.

Source references: [private bucket access](https://docs.cloud.google.com/storage/docs/using-public-access-prevention), [bucket IAM](https://docs.cloud.google.com/storage/docs/json_api/v1/buckets/setIamPolicy).
