# Admin loaded-mobile source audit

Scope: all 28 admin `tab-panel` roots found in the current index, their static markup, width-related styles, and relevant populated render templates. This is source coverage, not a claim that every page or branch was visually exercised. Empty/loading shells cannot establish loaded-layout correctness.

## Coverage inventory

| Admin root | Source reviewed | Loaded-layout treatment / preserved behavior |
|---|---|---|
| `tab-anasayfa` | `index.html` management home; `.ozet-*` and `.ca-*` in late stylesheet | Shared patch handles zero-minimum tracks, loaded calendar, summary rows and pickup cards. Independently reviewed late shared rules for min-content and breakpoint regression risk |
| `tab-ogrenciler` | `index.html` student toolbar/list, role-specific student renderers; late stylesheet | Existing toolbar wrap and search shrink retained; role card auto-fill minima now bounded by available width; genuine student table keeps internal horizontal scrolling |
| `tab-ozluk` | `index.html` personnel/leave/QR subviews; `moduller/personel-ozluk.js` | Card minima bounded in index; table subviews already have local overflow owners; personnel nested icon/text KPI grid now uses a zero-minimum text track; drawer and long heading/email content shrink and wrap; drawer tab strip retains local scrolling |
| `tab-oryantasyon` | `index.html` `oryYonetimCiz` | Shared patch adds semantic form-grid class, mobile one-column layout and width-constrained inputs; targeted both week time fields and seminar time/speaker grid |
| `tab-siniflar` | `index.html` class list and class-edit modal | Existing row/actions wrap; name has bounded flex minimum; inherited long-token wrapping preserves populated names/descriptions |
| `tab-veliler` | `index.html` parent filters, summary strip, duplicate and populated table | Existing scroll wrapper preserved; shared root/text contract guards loaded content; filters already wrap |
| `tab-onay` | `index.html` application-pool markup and renderer | Existing tabular flow retained with local table scrolling; loading-to-populated output remains within tab shell |
| `tab-finans` | `js/finans/ui.css`, `dashboard.js`, `analytics.js`, `payment-workspace.css`; legacy finance templates | Fixed due-day 270px minimum with `min(100%,270px)`; KPI totals and analytic labels wrap; dialog heading/close rows shrink/wrap; local table owners and nowrap data tables preserved; SVG viewBox and accessible values unchanged |
| `tab-egitim` | `index.html` discipline/branch/matrix; `portal-egitim-pano.js`, `portal-mufredat.js`; shared education styles | Shared patch bounds discipline/branch card minima. Large education matrix/table retains a dedicated scroll owner. Curriculum/detail modal structure inspected for fixed controls and wrap |
| `tab-geriBildirim` | `moduller/geri-bildirim.js` | Existing mobile scoped 300px grid override retained; populated flex-text children already min-width zero; inherited long text wrapping added by the shared patch |
| `tab-veliKatilim` | `moduller/veli-katilim.js` | Existing responsive KPI, list and timeline layouts retained; body-mounted modal title/email now shrink/wrap while close control stays fixed; KPI long tokens and modal body wrap |
| `tab-gorusmeNotlari` | `moduller/gorusme-notlari.js` | Added narrow-phone single-column rating layout; all five score choices retain their width and can wrap; long modal headings/notes/people names wrap; search input shrinks |
| `tab-programBelgeleme` | `moduller/program-belgeleme.js` | Existing scoped mobile two-column form collapse retained; populated document/evaluation table remains locally scrollable; 220px auto-fit form minimum fits the supported phone inner width; shared grid-child shrink applies |
| `tab-pdr` | `moduller/pdr-calisma.js`, `moduller/pdr.js`, `js/pdr/panel.js`, `panel.css` | Existing 720px layout/form collapse retained. Shared patch addresses generic `.hero` collision and loaded PDR grids/content. Existing report table behavior retained |
| `tab-danismaRandevu` | `moduller/danisma-randevulari.js` | Existing status/filter rows and populated appointment actions wrap; main content minimum 200px fits phone card; form uses 200px auto-fit tracks; inherited long-text wrapping guards notes and names |
| `tab-gunlukRapor` | `index.html` `gunlukRaporRender` | Shared patch changes 240px auto-fit lower bound to available-width-clamped minimum; populated rows already use wrap/shrink primitives; shared text contract guards descriptions |
| `tab-haftalikPlan` | `index.html` `haftalikPlanRender` | Shared patch bounds 300px cards, gives date navigation shrinkable text/fixed arrows, and five short-day buttons zero-minimum tracks with wrapping; counts no longer set track minima |
| `tab-profilim` | `index.html` `profilimRender`, attendance/leave cards and leave modal | Shared patch bounds 300px cards, handles narrow leave-summary grid and wrapped attendance actions; existing dedicated leave-modal responsive styles retained |
| `tab-galeri` | `index.html` gallery shell/modals; `js/portal-galeri-klasor-ui.js`, `portal-galeri-lightbox-ui.js`; gallery QA source | Folder grid already uses `minmax(min(180px,100%),1fr)`, title/summary wrapping and zero-minimum cells; lightbox uses bounded responsive media, detail scroll, reachable controls. Existing gallery tests are useful contracts, not rerun visual proof |
| `tab-raporlar` | `index.html` report renderers; `.rapor-*` in base and late styles | Existing single-column breakpoints retained; main task adds zero-minimum loaded card children, money/title wrapping and wrapping headers; canvas/SVG responsive sizing preserved |
| `tab-gelisim` | `index.html` development/quality cards and `bccmAlanlarGrid` | Shared patch bounds auto-fit 280px cards; smaller skill-area grid retains intent; inherited long-description wrapping applies |
| `tab-denetim` | `index.html` MEB checklist renderer and signature grid | Main task collapses signature grid on mobile; checklist text already zero-minimum flex child; shared long-token wrapping applies to regulation references and populated status content |
| `tab-etkinlik` | `index.html` event/timetable/appointment shells; `portal-etkinlik.js`, `portal-takvim.js` | Shared patch owns dedicated calendar fix; existing wrapping toolbars and locally navigable appointment lists retained |
| `tab-mesajlasma` | `index.html` chat markup; `.mesaj-*` responsive styles | Existing mobile list/chat switch retained; main task shrinks composer input and wraps long messages/recipient text so send/attachment controls remain reachable |
| `tab-duyurular` | `portal-duyurular.js` populated cards; shell/modal markup | Card headers/actions already wrap; inherited anywhere wrapping guards long announcement URLs/identifiers while preserving pre-wrap/newline behavior |
| `tab-yemek` | `portal-yemek.js` weekly table and edit renderer; index date controls | Weekly min-700px table retains local scrolling. Added named meal-editor classes, zero-minimum desktop ratio tracks, one column at <=640px, full-width shrinkable inputs and modest phone padding. Date label minimum handled in shared stylesheet |
| `tab-devamsizlik` | `portal-devamsizlik.js` summary and loaded student rows; index date controls | Existing attendance buttons wrap and retain touch size; populated name/note long tokens inherit wrapping; monthly summary label min-width handled in shared stylesheet |
| `tab-personel` | `index.html` personnel card/feature-toggle markup; `.personel-*` styles | Existing <=640px single-column list and wrapped filter/hero behavior retained, shared minimum protections retained; index auto-fill minimum bounded; feature text already min-width zero |

## Changes made during this audit

- `js/finans/ui.css`
- `portal-yemek.js`
- `moduller/gorusme-notlari.js`
- `moduller/veli-katilim.js`
- `moduller/personel-ozluk.js`
- `tests/finans-mobile-layout.test.mjs` (5 source/render checks)
- `tests/admin-loaded-module-layout.test.mjs` (3 source/synthetic-DOM checks)

No data mutations, external data calls, publication, or uploads were performed. No embedded credentials were output.

## Verification

- 56 targeted tests passed: the 8 new source/render contracts plus existing finance core/workspace/payment-workspace/payment-plan tests
- Changed JavaScript files passed `node --check`
- `git diff --check` passed
- Synthetic meal editor rendered all 45 fields across 15 meal grids; reopening did not duplicate its stylesheet
- Synthetic populated analytics retained complete long category label, large monetary value, accessible chart title and table scroll markup
- Source review of current main-task late stylesheet and index: no identified breakpoint regression or inappropriate removal of intentional wide data scrolling

## What remains unverified

Actual 320/375/390px browser geometry, pixel layout, real authenticated loading→populated transitions, native date/time input sizing, charts after asynchronous load, and repeated modal open/close/reflow. Local Chromium could not launch because the runtime rejected its socket; no screenshot or visual pass is asserted. All located high-risk source issues were fixed or passed to the main task and included in its current edit set. A source audit cannot guarantee absence of additional runtime-only defects.

## Final cross-review

Reviewed the final staff/parent compact-sheet, parent education report, pickup/leave form, standalone student/personnel/appointment page, shared stylesheet, and cache/link changes. No blocking source-level cascade/runtime regression identified. Specifically checked:

- Body-mounted compact sheets now keep `cicek-app` theme inheritance and retain original moved-node identity; repeat-open behavior is covered by existing synthetic lifecycle tests
- Radio inputs remain excluded from the new full-width parent form-control selectors
- Intentional education-tree/presentation scrolling and report/finance table scrolling remain intact
- Existing desktop/phone breakpoint intents remain consistent; zero-minimum tracks replace automatic content minima rather than hiding data
- Standalone responsive stylesheet links use the updated version, and cache generation changes are consistent with source-contract tests
- 20 additional compact-sheet, staff/parent mobile, and parent education tests passed

This cross-review and the extra tests still do not establish actual browser visual acceptance.
