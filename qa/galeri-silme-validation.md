# Teacher gallery photo removal — 2026-11-03

The active `silGaleriOge` handler called removed `bunnyDeleteFile` / `bunnyDeleteVideo` globals. The photo's Firestore deletion was after that call, so an exception prevented removal. Both gallery views also hid their delete controls until mouse hover.

The update uses the existing authenticated `PortalAPI.medya.sil` transport, shows visible owner-aware controls in grid, albums and education folders, and rechecks the authoritative gallery record inside a transaction before deletion. Teachers keep their existing own-uploader permission; no Firestore rules are changed. Concurrent clicks coalesce. Storage failure is reported separately from a completed gallery-record removal; unavailable Stream cleanup also produces a warning rather than pretending the blob was removed.

The upload picker renders local image previews and separates `Listeden çıkar` from `Galeriden sil`. A saved file retains its gallery ID. Uploads operate on a snapshot, reject concurrent submission/list edits, and skip already uploaded files during retry. Failed files remain available for retry. Account changes clear the selection, local preview URLs and modal. Educational cleanup removes only matching photo references and preserves learning stages, notes, assessments, dates and newer photos; a denied linked-record cleanup is reported, without widening teacher permissions.

Validation:

- 166 focused tests passed: teacher roles and ownership, stale ownership, denied deletion, session changes, duplicate clicks, no notification fan-out from deletion, picker removal, saved-file removal, failure/retry, gallery/folder visibility, existing approval/notification flows, and PWA delivery.
- All executable inline scripts parse; new/changed JavaScript modules parse; `git diff --check` passed.
- Full suite: 1,257 tests, 1,249 passed, 8 pre-existing failures (two v219 release assertions, five PDF tests lacking `pdftotext`, one message fixture requiring VM dynamic-import support). Same failure categories as main before this update; no newly failing test.
- Local browser QA uses synthetic photos and the actual selection renderer: preview, list removal, saved-photo removal and 320px layout checked. No school media, account writes or real notifications were used.
- Cache/runtime/registration/reload guard move together to v224; the new helper and updated folder view have exact precache entries.

Limits: Production code delivery can be verified by readback, but a real teacher-owned photo has not been deleted to test the live media service. This fixture does not establish a live storage deletion result.
