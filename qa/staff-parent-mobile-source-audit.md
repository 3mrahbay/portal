# Staff and parent mobile layout source audit

Scope: current local checkout based on main `6493f6a`, reviewed 2026-10-03. This is a source-coverage ledger, not a claim that every page has been rendered successfully on a phone.

## What was and was not verified

- Enumerated all 28 shared staff/management panel roots and all 11 parent panel roots declared in `index.html`; reviewed their shell sizing and relevant layout declarations. Panel visibility is role-dependent; this does not mean every role can access every panel.
- Reviewed the parent app's routed views and the dynamic module layout sources listed below, emphasizing late data, unbroken names/notes, counts, native controls, and reparented cards.
- Reviewed all seven additional HTML routes in the checkout: five substantive standalone pages and two redirect shims.
- Executed Node DOM-lifecycle/structural checks for the compact sheets, plus scoped source contracts for PDR and standalone pages. Existing data/security tests were also run as described in the task results.
- No authenticated production session, live Firestore mutation, real role switch, browser geometry pass, screenshot comparison, or native mobile date/select behavior was executed by this review. The task's browser restriction was respected. Zero-page-overflow cannot be concluded from source regex tests.
- A source scan is not exhaustive functional testing of every action, dialog, export, permission combination, or data shape in a panel.

## Shared ownership and remedies

The actual main-page cascade is the inline base/theme styles in `index.html`, followed by `stil/arayuz-duzeltmeleri.css`. The old `portal-stil.css` and `portal-tema.css` were inspected as reference copies; no HTML page in this checkout imports them. Fixing those copies alone would not fix the main page.

The prior page-level `overflow-x:hidden` rules can hide broken descendants. The current patch instead addresses the causal grid/flex minima: `minmax(0,1fr)`, `min-width:0`, long-token wrapping, responsive action rows, explicit local table scroll, and bounded auto-fit minima. Desktop column counts and intentional table/media scroll are preserved except where an explicitly mobile layout changes.

## Declared staff / management panels

Every row below received a source shell/layout scan. “Shared” means the main shell or theme rules apply; it is not a pixel-test result.

| Panel root | Layout sources inspected / ownership |
|---|---|
| `tab-anasayfa` | Role-specific home renderers in index; shared `.ozet-*` and `.ca-*` grids; teacher compact flow, reception queue, accounting home and PDR workspace reviewed separately |
| `tab-ogrenciler` | Toolbar/search controls, intentionally wide student table, reception/teacher card renderers; shared shell/local table scroll and bounded auto-fill grids |
| `tab-ozluk` | Personnel, live status, QR, entry logs, leave, timesheet, corrections, payroll and details shell; index render grids plus `personel-ozluk.js`'s own list/drawer breakpoints |
| `tab-oryantasyon` | `oryYonetimAlan` and index orientation templates; shared shell, inline card/forms source scan |
| `tab-siniflar` | `sinifListesi`, class-management heading/actions and index renderer; shared shell with wrapping controls |
| `tab-veliler` | Parent-summary strip, filters, data-table host and active-period parent renderer; shared shell/local table scroll |
| `tab-onay` | Application-pool shell, detail grids and action rows; shared shell plus bounded `.basvuru-detay-grid` |
| `tab-finans` | Legacy finance shell plus `js/finans/ui.css`, dashboard, staff home, parent, payment-workspace and payment-plan layout; dedicated finance rules |
| `tab-egitim` | Curriculum/disciplines, branch selector, summary/class cards and observation dialogs; bounded selector/card grids and shared theme; observation overlay needs separate ownership |
| `tab-geriBildirim` | `geri-bildirim.js`; prior 300px auto-fit cards and existing scoped mobile collapse reviewed |
| `tab-veliKatilim` | `veli-katilim.js`; explicit 1100/900/640px layouts, zero-minimum summary/list tracks, local charts |
| `tab-gorusmeNotlari` | `gorusme-notlari.js`; list, score grids, drawer/body layout; dedicated 640/480px rules and local patch for narrow score controls |
| `tab-programBelgeleme` | `program-belgeleme.js`; inline form/card grids and wide document matrix; existing scoped mobile collapse and local table scrolling |
| `tab-pdr` | Legacy `pdr.js` plus `pdr-calisma.js` / `js/pdr/panel.js` / `panel.css`; dedicated fix for landing `.hero` collision, zero-minimum grids and screen-only report-table scroll |
| `tab-danismaRandevu` | `danisma-randevulari.js`; wrapping appointment rows, 150/200px auto-fit forms, shared shell |
| `tab-gunlukRapor` | Index daily-report card/field renderer; 240px minimum changed to bounded auto-fit in main-page patch |
| `tab-haftalikPlan` | Index weekly-plan controls/activity/material cards; 300px minimum changed to bounded auto-fit |
| `tab-profilim` | Index personal work/leave/request/attendance cards; bounded auto-fit and responsive attendance action group |
| `tab-galeri` | Main gallery shell, `portal-galeri-klasor-ui.js`, `portal-galeri-lightbox-ui.js`, gallery module views; dedicated shrinkable media/folder cards and explicit lightbox detail scroll |
| `tab-raporlar` | Index report selectors/download cards and report layouts; bounded auto-fit cards, intentional data-table scroll |
| `tab-gelisim` | Static quality/development cards and source layout; bounded 280px auto-fit grid |
| `tab-denetim` | Audit/checklist shell and inline multi-column content; main-page mobile grid collapse |
| `tab-etkinlik` | Event/calendar shell, `portal-etkinlik.js`, `portal-takvim.js`, calendar/slot CSS; wrapping filters and distinct calendar/list layouts |
| `tab-mesajlasma` | Legacy conversation list/header/composer; dedicated min-width reset on textarea and long-recipient header/body wrapping |
| `tab-duyurular` | `portal-duyurular.js`, `duyuru-ekleri.js`, `duyuru-okunma.js`; wrapping toolbar, attachment grids and read-receipt sheet's own breakpoint |
| `tab-yemek` | `portal-yemek.js`; intentional 700px menu table remains locally scrollable; editor receives dedicated narrow grid behavior |
| `tab-devamsizlik` | `portal-devamsizlik.js`, date/summary controls, daily rows and monthly table; shared shell/local table scroll and monthly-label minimum override |
| `tab-personel` | Main personnel list/form, `.personel-*` rules; bounded auto-fill list, narrow list collapse, role/status controls |

## Declared parent panels

| Panel root | Layout sources inspected / ownership |
|---|---|
| `veliPanel-dashboard` | Legacy dashboard host and index dashboard card renderers; parent shell, legacy card rules |
| `veliPanel-odemeler` | `veliOdemelerContent`, finance parent module and payment dialogs; dedicated finance shrink/wrap/local-table rules |
| `veliPanel-sozlesme` | Contract host and index contract renderer; legacy parent shell, document/table containment; print/export layout is distinct from phone layout |
| `veliPanel-ogrenci` | `veliRenderOgrenci`: late child/parent details in an inline two-column grid; flagged and main-page fix assigns the existing responsive card-grid class |
| `veliPanel-okul` | Timeline, meals, events and attendance hosts; date-label minimum overrides, card wrappers and local wide-table scroll |
| `veliPanel-iletisim` | Legacy parent chat, same composer/header fixes as staff chat |
| `veliPanel-galeri` | Legacy gallery host, current `veli-galeri.js`, gallery folder/media/lightbox helpers; dedicated two-column zero-minimum cards and bounded media |
| `veliPanel-raporlar` | Parent report host, discipline/radar/report components; mobile single-column grids and local tables |
| `veliPanel-bildirimler` | Notification/announcement host and renderers; legacy `.veli-card` wrap coverage distinct from `.cicek-app` |
| `veliPanel-ayarlar` | Photo/settings/account fields; long loaded email was outside modern theme and is covered by main-page legacy-card wrapping |
| `veliPanel-yeniapp` | Modern root `cicekAppRoot`; all routes below enumerated and layout-scanned |

### Modern parent app route coverage

- Home: child/class hero, payment summary, daily log, education, appointments, messages and calendar cards; shared zero-minimum theme plus compact-sheet fixes
- Menu: module grid, favorites count, search; search input intrinsic minimum addressed by main-page shared rule
- Child profile: child name/class, attendance counters, badges and development rings; dedicated counter/ring minimum/wrapping rules in shared patch
- Daily log: late text and three metric pills; shared cards/pill tracks
- Gallery: modern route delegates to gallery module; local grid/media handling
- Messages: modern `.wa-*` and `.ca-conv-*` layout inspected alongside legacy chat; explicit existing min-width text wrappers/local conversation sizing retained
- Education/growth: index fallback plus `veli-egitim-gelisim.js`, `zeky-veli-egitim-koprusu.js`, `zeky-veli-ogrenme-deneyimi.js`; dedicated 700px layout, intentional horizontally scrolling tree; report layout has separately owned narrow fix
- Guidance/PDR: `caPdrHTML`/`caPdrYukle`; shared cards and education/guidance components, no PDR-workspace access implication
- Orientation: `caOryantasyonHTML` and loaded progression/cards; shared theme and orientation banner's explicit ellipsis
- Appointments: `caRandevularHTML`, `zeky-randevu-veli-arayuz.js`; dedicated 520px picker/summary layout and body-level dialog
- Events: `caEtkinliklerHTML`/render; shared cards and calendar event rows
- Calendar: `caTakvimHTML`, `portal-takvim.js`; calendar cell grid and event detail layouts
- Meals: `caYemekHTML`/`caYemekYukle`; parent daily cards/controls separate from staff wide weekly table
- Daily operations: `sabah-girisi.js`, `veli-izinleri.js`, `pickup-yetkilileri.js`, school-bell renderer; compact tiles plus body-level details, date and pickup forms

## Dedicated module checks

- `ogretmen-anasayfa.js`, `veli-kompakt.js`: direct-body sheets previously lost the `.cicek-app` namespace and shell constraints. Fixed all three overlay paths, text/control/media/table bounds, wrapping footer actions and teacher single-column override. Runtime tests check original-card identity during late updates and removal after its old root is detached.
- `veli-izinleri.js`, `pickup-yetkilileri.js`: dynamically opened forms now inject their own CSS, use zero-minimum tracks and stack below 420px. Reopening does not duplicate style tags.
- `ogretmen-sinifim.js`: dedicated 420/560px student/menu grids; class chips intentionally scroll. Names intentionally ellipsize in student tiles.
- `personel-ozluk.js`: dedicated list and drawer breakpoints; long detail text in body-level drawer requires wrapping independently from main-page theme.
- `personel-anlik-bildirim.js`: late injected ID-scoped queue styles reviewed; its `white-space:nowrap!important` required a higher-specificity pickup-action override.
- `duyuru-ekleri.js`, `duyuru-okunma.js`: responsive attachment grids/read-receipt layout inspected; explicit preview/email ellipsis is intentional.
- `gorusme-notlari.js`, `ogretmen-egitim-gozlem.js`, `zeky-randevu-veli-arayuz.js`: body-level sheets do not inherit `.cicek-app`; their root/text/control constraints must be assessed separately.
- `js/finans/ui.css`, `payment-workspace.css`: finance lives outside `.cicek-app`; due-day 270px minimum, large currency and native control minima receive module-specific fixes. Existing `.scroll`/`.plan-table-scroll` preserve wide account tables.
- `js/pdr/panel.css`: independent namespace fix and controls/grids described above; print layout retained.
- `veli-egitim-gelisim.js`: deliberate tree/media scrollers distinguished from unintended report overflow.

## Standalone route coverage and changes

| Route | Source finding and local remedy |
|---|---|
| `ogrenciler.html` | Flex search input's intrinsic width and detail text lacked shrink/wrap; own CSS now covers search, loaded detail values and wrapping contact actions |
| `personel-ekle.html` | Two-column native-input form persisted on narrow phones, with nested 24px padding; own zero-minimum grids, <=560px form stack, narrower padding, wrapping account header and list action row |
| `randevu-talepleri-callable.html` | Loaded summary/filter/appointment cards use shared appointment theme; theme now owns zero-minimum tracks, wrapping values/actions, and phone icon placement avoiding 60px left padding pressure |
| `randevu-ayarlar.html` | Same shared theme; form/target/date rows own zero minima and narrow stack, long selected names stay bounded |
| `veli-randevu-callable.html` | Independent parent appointment cards/person-name buttons had no long-token constraint; own card/header/selector/action wrapping added |
| `randevu-talepleri.html` | Redirect shim inspected; destination unchanged |
| `veli-randevu.html` | Redirect shim inspected; destination unchanged |

`stil/randevu-sayfalari.css` is loaded by the two staff appointment pages and its URL changed from v1 to v2. These routes do not import the main portal's correction stylesheet.

## Review cautions and required browser acceptance

- No existing phone-only `.ca-grid-2` collapse was found in the current loaded main source. Its new minmax override retains the existing two columns; any desired phone collapse must be explicit rather than assumed.
- More-specific explicit declarations defeat inherited wrap rules: the greeting h2's old `overflow-wrap:normal` and the injected school-bell button's `nowrap!important` were reported to the shared patch.
- Distinguish body-level `.po-cekmece`, `.dok-panel`, `.gn-pencere`, `.zrv-pencere`, `.zego-kart` from main themed cards. Long names/notes there need root wrapping plus shrinkable text columns; fixed close/icon controls should remain fixed. These were reported for shared correction.
- Source fixes do not establish live role-switch cleanup for every module. Compact-sheet tests cover detached original roots only; authentication/navigation lifecycle across the whole app remains a browser acceptance case.
- Required future browser matrix: 320/360/390/430px and tablet/desktop, empty → delayed populated data, unbroken long names/class names/emails/notes, three-to-six digit counts and large currency, card/sheet open → realtime update → close → reopen, narrow date/select fields, message recipient/composer, child change, actual role switch, and intentional table/tree scrolling. Check both document scrollWidth and each content/control bounding rectangle; page-level overflow-hidden alone is not a pass.
