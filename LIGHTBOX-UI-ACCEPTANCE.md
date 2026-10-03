# Parent lightbox alignment and controls (offline UI-only candidate)

## Evidence and input

The supplied screenshot was viewed as pixels. It shows a portrait image against the left edge of the wide image host, while the text/actions are centered. The body-level dialog uses `ca-back` classes but is outside `.cicek-app`, so its controls receive native browser styling.

This candidate starts from the exact final v175 `portal-gallery-v175-reviewed-local` snapshot, with all 235 input file hashes frozen in the artifact manifest. Reference styling was inspected in accepted ZEKY `www/galeri.html` modal CSS: dark overlay, rounded media, translucent 44–56px circular buttons.

The screenshot contains children's media. It has not been copied into the candidate, visual fixture or any output attachment. The fixture contains only generated SVG shapes and synthetic text/state.

## Narrow change

- New pure `portal-galeri-lightbox-ui.js` module supplies `#vgLightbox`-scoped CSS and decorative SVG icons
- Dialog uses a viewport-bounded grid: top close/count bar, flexible centered media area, bounded caption plus bottom navigation/download controls
- Portrait and landscape content uses centered `object-fit: contain`; video/iframe dimensions fit the same media area
- Mobile safe-area padding and dynamic viewport height, compact landscape layout, independently styled 44px+ touch controls, visible keyboard focus and reduced-motion handling
- Existing close/Escape/Back/history, focus return, session/child/period guards and tracking logic remain intact
- UI wrapper restores the static download icon/label after the existing downloader's temporary text status, without changing save or tracking behavior
- Serviceworker precaches the added local UI module; release/cache version selection remains with the release process

No query, audience, approval, auth binding, date normalization, URL resolution, source priority, upload or Bunny changes are included.

## Verification and remaining visual gap

From the candidate directory: `node --test --test-reporter=tap tests/*.test.mjs`

659/659 tests passed: all 653 v175 tests plus 6 focused UI contract tests. Existing VM tests receive the actual additional pure UI imports; no existing assertions were relaxed. Existing click/close/Back/focus/repeated click/context regressions pass.

Changed modules and the generated fixture script pass syntax checks. Independent code review confirms the screenshot's source-level causes are addressed.

Actual browser/device layout has not been measured. CUA inventory found an existing cloud Chromium window, but its documented browser API provides no supported local fixture injection. The previously denied shell Chromium socket and cloud file-URL routes were not retried or bypassed. Therefore desktop/mobile visual acceptance, native video controls, long-caption scrollbar behavior and iframe focus boundaries still need permitted browser execution. Tests assert CSS/layout contracts, not pixels.

## Synthetic visual fixture

Generate a standalone fixture from current production markup/style:

`node tests/fixtures/build-lightbox-visual.mjs /tmp/lightbox-visual.html`

A generated copy is alongside the patch artifacts. It makes no Firebase or external media requests. The actual parent lightbox markup, scoped styles and lifecycle code are exercised with synthetic state; image/video surfaces are synthetic layout substitutes, not playback tests. Cases: portrait, landscape, very long title/caption, video frame. Check 1440×900, 390×844 and landscape 844×390; open/close/Escape/Back, focus return, resize, no overflow and repeated download-button restoration.

The generated HTML is separate from the production patch; the generator is included for reproducibility.
