# Original requirement audit

Audit date: 2026-10-24. Specification: `CODEX_INTERACTIVE_IMAGE_GALLERY_PROMPT.md`.
This audit supersedes historical deferred-feature notes in `TASKS.md`. “Implemented”
means source and automated evidence exist; it does not certify real-device behavior.
Optional exclusions and manual checks are stated explicitly below.

## Product requirements

| Original requirement                                                                                          | Implementation / evidence                                                                                          | Status and limits                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Framework-independent engine; thin verified Remix adapter                                                     | `src/core.ts`, `src/remix3.ts`, actual Remix 3.1.0 Handle/ref/createRoot/createRouter APIs; SSR/router tests       | Implemented; compatibility pinned, no React assumption                                                         |
| Static/dynamic data, multiple instances, desktop/tablet/mobile, keyboard/pointer/touch/stylus/RTL             | Controller update APIs; shared gallery/feature/integration suites; Pointer Events and cancellation                 | Implemented; physical stylus/mobile behavior remains manual                                                    |
| Justified, masonry, grid, rows, columns, collage, featured hero, optional filmstrip                           | `src/layouts.ts`; all eight strategies exercised by shared gallery suite                                           | Implemented; no separate autoplay carousel required                                                            |
| Gutters, ratios, spans, alignment, breakpoints/container sizing, unknown dimensions                           | LayoutOptions/resolveLayout/mountResponsiveLayout, estimateImage, SSR intrinsic sizing; core/layout tests          | Implemented; callers explicitly estimate unknown metadata                                                      |
| Smooth measured reflow without hot-path layout reads                                                          | DOM mutation FLIP and demo layout switches, WAAPI motion; grid visual baselines                                    | Implemented; no FPS guarantee                                                                                  |
| Filter, sort, group, tags, selection, reorder with accessible alternatives                                    | Core query/groups/setSelection/reorder; demo filters/sort/FLIP and earlier/later buttons                           | Implemented; drag-and-drop intentionally omitted, keyboard ordering provided                                   |
| Optional thousands-item virtualization with overscan, stable identity, focus/scroll anchoring                 | mountWindow fixed rows, retained focused nodes; 10k DOM/performance and viewport tests                             | Implemented fixed-row grid; variable-height virtual masonry excluded; transition clones survive source removal |
| Modal backdrop, trap/restoration, scroll locking, inert background, Escape, optional back, nested overlays    | Native dialog + reference-counted locks + focus handling; shared modal/history/nesting tests                       | Implemented; fullscreen viewer covers backdrop; no promise of backdrop-click dismissal                         |
| Thumbnail open/close geometry and fade fallback                                                               | Measured opening and reverse clone; missing/offscreen target fallback; reverse-close visual and interruption tests | Implemented                                                                                                    |
| Fit, actual pixels, custom zoom levels, double click/tap, pinch, modifier wheel, keyboard, focal zoom         | dom.ts/geometry.ts/motion.ts; gesture and focal geometry tests                                                     | Implemented; maximum zoom configurable; native multi-touch injection only Chromium                             |
| Zoom pan/bounds/resistance/momentum/reset and gesture arbitration                                             | Pointer capture/map, velocity decay, bounds/rubberBand; shared input tests                                         | Implemented; cancelled touch does not become a double tap; zoom/keyboard interrupts inertia                    |
| Swipe direction and zoom-edge threshold                                                                       | Direction-aware image transition and edge threshold; RTL/touch tests                                               | Implemented                                                                                                    |
| Fullscreen fallback, resizing/rotation, safe areas/mobile chrome                                              | Fullscreen API, ResizeObserver, dvh and all-edge safe-area CSS; tablet/mobile/fullscreen tests                     | Implemented; native mobile fullscreen/browser chrome remains manual                                            |
| Rail orientations, filmstrip, previews, count, captions/metadata, authorized share/download hooks             | Bounded full-access rail, layout filmstrip, toolbar/renderMetadata/formatCount; shared feature tests               | Implemented; no automatic external transmission                                                                |
| Optional slideshow pauses on interaction/visibility/reduced motion                                            | Independently imported extensions slideshow; shared extension tests                                                | Implemented opt-in; explicit play resumes                                                                      |
| Optional side-by-side/synchronized compare, before/after, annotations                                         | extensions.ts; lazy demo, slider/buttons, real annotation pointer tests                                            | Implemented; comparison pan bounded for keyboard and pointer                                                   |
| Responsive srcset/sizes, art direction, alt/intrinsic dimensions                                              | SSR picture/source and rebuilt DOM picture; protocol validation; SSR/shared media tests                            | Implemented; viewer provider selects decoded primary asset; art direction applies to gallery thumbnails        |
| Proximity/priority lazy loading, decode, adjacent preload, cancellation/cache budgets                         | Native lazy/eager/fetchpriority SSR, MediaCache, generation guards, two-neighbor preload, decode limits            | Implemented; provider must honor AbortSignal for underlying request cancellation                               |
| Color/plugin/preview placeholders, skeleton, error/retry/offline resilience, flicker avoidance                | DOM placeholder lifecycle and decode-before-reveal; loading visual, provider failure/retry tests                   | Implemented; retry after connectivity recovery, no offline service-worker cache promised                       |
| Optional tiled deep zoom; never decode gigapixels by default                                                  | Separate deep-zoom export/planner/tile lifecycle; SSR oversize guard; bounded resource/codec tests                 | Implemented; no arbitrary DZI/IIIF manifest parser                                                             |
| Explicit remote provider, signed URL refresh, CORS, private URL diagnostics                                   | ImageProvider.resolve, retry cache clearing, safeURL/allowedOrigins, abortable CORS tile fetch; media/origin tests | Implemented; refresh logic supplied by provider; errors do not include private URLs                            |
| EXIF/orientation; optional sanitized zoomable SVG; optional videos/panoramas                                  | Native image orientation, oriented tile-provider contract, trusted demo SVG                                        | Native EXIF rendering used; untrusted inline SVG, video and panorama adapters excluded as optional             |
| Pointer capture/cancellation/touch-action, recognizer state, velocity/bounded physics                         | dom.ts/deep-zoom.ts; shared mouse/touch/pinch/cancel and geometry tests                                            | Implemented; recognition state uses scoped pointer maps/flags                                                  |
| Frame-independent, interruptible/reversible animation, no duplicate loops, transforms/opacity                 | motion.ts, cancelable WAAPI/RAF, teardown tests                                                                    | Implemented; pinch avoids computed-style reads in move path                                                    |
| Native CSS/WAAPI/decode; workers only if proven useful                                                        | Browser-native implementation; measured small entry sizes and synthetic workload                                   | Implemented; workers deliberately omitted                                                                      |
| Easing/springs/durations/profiles, reduced motion/data/high contrast                                          | motion options, media queries, reduced-data budgets; pure and browser tests                                        | Implemented                                                                                                    |
| Semantic captions/controls, roles, all keyboard controls, visible focus, restrained announcements             | SSR/native buttons/dialog/status, styles, axe and focus/navigation tests                                           | Implemented; manual screen-reader audit outstanding                                                            |
| Reading order, no keyboard traps/gesture-only actions                                                         | DOM order retained in masonry; keyboard alternatives; focus wrap includes custom inputs/links                      | Implemented; visual masonry order differs from row order as documented                                         |
| RTL, UI label localization and number formatting                                                              | DOM labels/formatCount, extension uiLabels, deep-zoom labels/instructions, Intl demo count                         | Implemented hooks; consumers provide translations                                                              |
| Reduced preferences, browser text zoom, high contrast, targets, non-JS                                        | CSS/media queries, no-JS routes, forced-colors/tablet tests                                                        | Automated responsive/forced-colors coverage; genuine 200–400% text zoom and device checks manual               |
| SSR-safe markup, meaningful links without JS                                                                  | Gallery SSR + /category and /image routes; no-JS and SSR tests                                                     | Implemented                                                                                                    |
| Browser-only initialization/dynamic imports, no window/document during server evaluation                      | ref island dynamically imports DOM; module import exercised in Node tests                                          | Implemented                                                                                                    |
| Verify actual Remix APIs, avoid assumed Remix2/React patterns                                                 | Installed pinned 3.1.0 imports in adapter/host/demo; strict demo typechecks/router/hydration tests                 | Implemented                                                                                                    |
| Route-driven viewer/deep links/back/scroll/rapid errors/unmount                                               | Demo URL handlers, optional gallery history, abortable refs and generations; shared route/cleanup tests            | Implemented; history-disabled instances ignore popstate; Home/End updates URL                                  |
| Stable IDs/serialized SSR, realistic gallery/category/detail routes                                           | immutable controller IDs, escaped JSON host, real router; routes/SSR/hydration tests                               | Implemented                                                                                                    |
| Strict TS/ESM/exports/config/hooks/events                                                                     | package subpath exports, strict TS, controller.subscribe and DOM/provider/transition hooks                         | Implemented                                                                                                    |
| Headless controller + optional DOM/styles; renderers/providers/layouts/transitions/toolbar/metadata/analytics | Independent exported modules; renderItem, transition, toolbarButtons, renderMetadata, subscribe                    | Implemented; analytics transport is application responsibility                                                 |
| Controlled/uncontrolled active/selection, pagination, append/remove/update/reorder, cancellation              | Core open/setSelection + snapshot/subscribe, paginate lifecycle; unit/shared integration tests                     | Implemented; controlled state is mirrored through APIs rather than framework props                             |
| Compatibility/versioning                                                                                      | README 0.x policy and pinned adapter compatibility; lockfile/public declarations                                   | Implemented; no broad backwards-compatibility promise before 1.0                                               |
| Optional modules must not inflate default bundle                                                              | Independent exports and dynamic deep-zoom/extension chunks; build benchmark per entry                              | Implemented                                                                                                    |

## Engineering, security and delivery

| Original requirement                                                                                               | Implementation / evidence                                                                               | Status and limits                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Inspect tooling/docs and architecture/tasks before code, ordered granular ledger                                   | ARCHITECTURE.md/TASKS.md historical ledger and pinned installed source                                  | Recorded historical process; chronology not newly recreated by this audit                     |
| Architecture covers boundaries, state/APIs, SSR/lifecycle, concurrency, budgets, a11y, security, testing/tradeoffs | ARCHITECTURE.md plus this table and README                                                              | Implemented; one package with separate exports documented instead of gratuitous fragmentation |
| Reproducible tooling, licenses, small/tree-shakable dependencies                                                   | Exact package/lock versions, license documentation, separate exports/build sizes                        | Implemented; versions are deliberately pinned, not a claim to newest releases                 |
| URLs, text/SVG security, redirects/origins, CSP/CORS                                                               | safeURL/safeSrcset, escaped SSR/textContent, tile redirect rejection, README deployment policy          | Implemented; origin restrictions now apply before SSR and atomically to dynamic updates       |
| No hydration mismatch/listener/observer/object-URL leak, stale async work, runaway caches                          | ref abort/ResizeObserver teardown, generation guards, tile URL instrumentation, bounded caches/tests    | Implemented; cache invalidation clears decoded neighbors when items change                    |
| Stable IDs and separation of rendering/layout/interaction/loading                                                  | Core and independent geometry/layout/media/pagination/DOM/adapter modules                               | Implemented                                                                                   |
| Measurable budgets; devices/throttle/slow-network/large-gallery measurements, no absolute FPS claim                | Node benchmarks, per-engine scroll/frame metrics, throttled browser/decode/interaction benchmark        | Implemented synthetic methodology; representative physical-device profiling remains external  |
| Build/typecheck/lint/unit/integration/E2E/visual/a11y/performance/demo                                             | npm run test:ci (all ten stages, continues independent checks); demo server exercised by browser suites | Required full verification recorded below                                                     |
| Package/distribution/docs                                                                                          | Public subpaths/declarations, README reproducible commands; npm pack --dry-run                          | Verified separately in final audit                                                            |
| CI reports/screenshots/failure artifacts                                                                           | .github/workflows/ci.yml and scripts/ci.mjs; all three browser runners                                  | Configured; this local change has not been pushed or hosted-tested                            |

## Test acceptance mapping

- Unit: geometry/focal bounds/decay/layout/windowing/RTL/state/identity/immutability,
  cancellation, media subscribers, pagination, motion/deep-zoom planner, URLs and SSR.
- Integration: actual Remix SSR/hydration/routes, history, multiple/nested galleries,
  cleanup, pagination unit integration, provider and tile errors/retry. All three
  engines now run the shared gallery, feature **and** codec/lifecycle suites.
- Input E2E: mouse, keyboard focus/restoration, touch activation, Chromium native
  pinch injection; explicitly synthetic Firefox/WebKit multi-pointer recognition.
- Visual: seven independent baselines per engine: desktop masonry, grid reflow,
  mobile, lightbox, zoom/pan, loading, reverse-close midpoint. Baselines must not
  be regenerated to conceal a difference.
- Accessibility: axe, keyboard interaction/focus, RTL, reduced motion, forced colors.
  Automated checks do not constitute certification.
- Performance: compressed entry/chunk bytes; 100/1k/10k state/layout p95/p99;
  scroll frame p95/p99, bounded DOM, LCP/CLS/long tasks/available JS heap; throttled
  JPEG decode and click-to-frame opportunity samples. Native decoded memory and
  actual display latency are explicitly not measured.

## Fixes from this audit

1. SSR now enforces the same configured origin allowlist and decode budget as DOM
   enhancement, including preview/srcset/picture sources.
2. Dynamic mutations reject disallowed origins before committing controller state.
3. History-disabled galleries ignore route events; Home/End keep deep links current;
   malformed URL encoding is ignored safely. Actual Back publishes closed state before route filtering; Forward restores ownership of pushed entries so closing returns correctly.
4. Custom metadata inputs retain editing keys; focus wrap includes links, inputs,
   selects and custom focusable elements, excluding hidden/disabled controls.
5. Invalid image IDs cannot cancel an in-progress close. Gesture cancellation cannot
   be interpreted as a touch tap; stale release velocity does not restart momentum.
6. Zoom/keyboard pan interrupt inertia; pinch avoids hot-path computed-style reads.
7. Changed items invalidate stale decoded neighbors/provider cache entries.
8. Comparison keyboard/pointer panning shares bounds and resize cleanup; localization
   hooks cover optional comparison controls and deep-zoom keyboard instructions.
9. Rapid extension toggles and page teardown invalidate pending imports.
10. Reusable controller updates/reordering now animate with cancelable FLIP; the demo no longer duplicates mutation animations. History owners preserve host state and direct deep-link ownership. All four safe-area edges are respected.
11. Chromium runs the shared codec/lifecycle suite through the actual Chromium
    launcher; browser benchmark now records explicit interaction samples.

## Final verification

`npm run test:ci` exited 0 after all final source edits on 2026-10-24.
All ten stages passed: strict library/demo typecheck, lint, build and 22 Node tests,
Chromium gallery plus feature/integration, Firefox, WebKit, Node benchmarks,
throttled browser/decode/interaction benchmarks and formatting. Each browser ran
10 gallery + nine feature/resource + nine codec/lifecycle groups (28 total), with
no launch or scenario skips. Chromium used Chromium 156.0.8078.4, Firefox 157.0,
and WebKit 27.2. All 21 tracked visual baselines are unchanged; visual regeneration
was disabled. The shared audit reproduced and corrected an actual browser Back
regression, then passed Back/Forward/close checks on all three engines.

Package dry-run verification passed with the expected public modules/declarations
(25 packaged files). `git diff --check` and an explicit Prettier check of this audit
also pass. Canonical stage results: `artifacts/ci/results.json`; consolidated evidence:
`artifacts/requirement-audit-results.json`; per-stage logs: `artifacts/ci/`.
Benchmark observations and their limits remain in the generated reports rather
than being represented as device-independent guarantees. These changes are local;
no new hosted GitHub Actions run is claimed.

## Remaining external/manual work

VoiceOver/NVDA; genuine browser text zoom at 200–400%; physical iOS/Android pinch,
stylus cancellation, mobile safe areas/chrome, native fullscreen UI and realistic
photographic/native-memory pressure. These cannot be certified by headless emulation.
Optional video/panorama, untrusted inline SVG, general manifest parsing and
variable-height virtual masonry are deliberate scope exclusions rather than
unfinished mandatory features. GitHub PR-template UI auto-prefill is a separate
repository workflow check still blocked by the in-app browser sign-in session.
