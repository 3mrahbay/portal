# Parent gallery click and legacy media compatibility (offline candidate)

## Input and scope

Reader-only delta against the exact frozen `portal-topic-release-v174-local` copy recorded in the accompanying input SHA-256 manifest. The input remains unchanged. This candidate does not include the separate reviewed date patch, Bunny reader/backend work, upload changes, or the quarantined Firebase upload draft. No release/version/cache identifier is changed and nothing is published.

## Reproduced photo-click defect

Current Portal baseline 38871d6 uses `aktifKullaniciRol = null` for parents (index role declaration and authenticated nonstaff route). Its actual `PortalAPI.state` getter returns that null unchanged. The modern parent gallery lists approved targeted photo records, but `buyut` requires `state.rol === 'veli'` and returns before creating the dialog.

A synthetic execution of the unchanged getter and actual parent renderer produced:

- Actual Portal state role: null
- Synthetic approved photo card visible: true
- Lightbox after card click: false

The candidate preserves the global role contract. A gallery-only UID marker becomes available only after the existing assigned-child/current-period loader succeeds for the same authenticated UID, auth epoch, period and nonstaff context. The marker is cleared synchronously when authentication changes or logout starts. Null role alone, stale children, a foreign active child, and staff/admin contexts are insufficient.

Modern gallery open/download and shared parent tracking use this verified context. Tracking uses the selected assigned child, with first-child fallback only if no child is selected. Auth epoch, selected child, class and period are checked across pending tracking writes. This remains a client reader guard, not a replacement for Firestore rules.

## Display changes

- Tümü / Fotoğraflar / Videolar are local presentation filters above the existing category/program/topic hierarchy
- They use already-read authorized records; no upload destination, stored field, approval, audience, collection query, or media migration changes
- Recognizes explicit photo/video metadata, MIME types, valid `mp4Url`, decoded direct video path extensions and the same exact trusted player hosts
- Preserves Portal direct-source preference: mp4Url, bunnyUrl, url, then historical gorselUrl; embedUrl is used only for an existing allowlisted player host
- An unrecognized embed host is never loaded as an iframe; player pages and recognized manifests are not offered as direct downloadable media
- Video thumbnails remain visibly marked as video even with an image poster
- A zero-count type tab remains reachable and gives an empty-state message
- Program/topic folders, selected-child/period boundary and approval/target filtering remain intact

The photo dialog now has semantic buttons, dialog labeling, Escape/Back/close handling, keyboard focus cycling, focus return and scroll restoration. Repeated opens keep one overlay/history entry. Rapid reopen while close traversal is pending is ignored until that traversal finishes. A concurrent route push cannot leave the gallery permanently locked. Child/session/period/navigation invalidation clears old thumbnails and closes the dialog.

Pending individual/ZIP downloads abort before initiating a save after an auth/child/period change. A writable save is aborted before close if its context changed during writing. An OS save already committed cannot be retracted. The existing regression now requires zero save clicks and zero tracking writes on mid-fetch account replacement, rather than allowing the old account's bytes to save.

## What this does not establish

The user's approved video record was never inspected or fetched. Approval is user-reported; this candidate does not explain away the report as pending. No real child record, image/video or signed media URL was accessed.

An older row containing only `{sinif, url, tip:'video', durum:'onaylandi'}` with no explicit target fields remains outside the existing targeted Portal queries. This patch deliberately does not add class-only legacy queries or manufacture a school-wide audience. Missing/unknown audience, class-only audience, explicit foreign-child targets and inconsistent nonempty child-target IDs stay excluded. The latter is a fail-closed tightening of the inherited OR-across-child-IDs behavior; no query or fallback audience is added. Therefore the Video tab cannot make a record appear if it is never returned by the approved target queries. Query permission/index failures and a record's actual target still require separate evidence.

The current baseline's role mismatch definitively reproduces photo-click failure. The legacy type/source fixes reproduce compatibility gaps, but do not identify the user's particular missing video. Metadata support does not guarantee browser codec support, successful remote media delivery, or real-device/native playback.

## Verification

Run from the candidate directory:

`node --test --test-reporter=tap tests/*.test.mjs`

653/653 tests passed: 630 existing tests plus 23 new synthetic tests. The actual Portal getter, parent module, current-session child loader and logout start are executed with synthetic state. Covers denied contexts, delayed user-A/user-B and same-UID epoch loads, period changes, sibling-B attribution, class changes during pending writes, card click/open/close, Back/Escape/focus/repeated click and pending popstate races, media-type filters within program/topic folders, safe source aliases, and audience exclusions.

Existing assertions were retained except the documented stronger mid-fetch save-cancellation and contradictory-child-ID rejection expectations; independent historical ID fields still work when conflicting IDs are absent; the prior folder VM harness received the real additional imports.

These are offline source and synthetic DOM/history tests. There was no real-browser visual test, device test, live-media fetch or deployment in this work. Module syntax and an isolated patch replay/full-suite check are recorded in the artifact manifest.

## Combined release preparation

This reader delta is included with program/topic folders in the reviewed v175 candidate. The combined candidate synchronizes the service-worker cache, bootstrap URL and reload guard to v175. The old v174 release package was held before publication. No live deployment is implied.
