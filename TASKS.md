# Execution ledger

Tasks run sequentially. Each acceptance gate uses `npm run check` (format, lint/typecheck, unit tests), with browser/build checks added when applicable. Dependencies are preceding tasks.

- [x] 01 Inspect repository, runtime, installed Remix source and official docs. No existing app or user edits.
- [x] 02 Architecture and task documents created before implementation.
- [x] 03 Bootstrap pinned ESM TypeScript tooling; build/typecheck succeed.
- [x] 04 Types, controller and geometry; unit tests validate state, RTL, bounds and windowing.
- [x] 05 Abortable bounded media provider; cancellation and URL tests pass.
- [x] 06 Semantic SSR, layouts and DOM enhancement; build and unit gates pass.
- [x] 07 Modal, gestures, zoom, motion, navigation and fullscreen; browser tests pass.
- [x] 08 Virtualization, Remix lifecycle and routes; SSR/history/cleanup verified.
- [x] 09 Optional comparison and slideshow extensions; independent imports compile.
- [x] 10 Accessibility, browser integration and visual snapshots; automated checks and manual checklist recorded.
- [x] 11 Benchmarks, production build sizes and large datasets; measured report generated.
- [x] 12 Usage/demo documentation and final audit; all gates rerun, limitations explicit.

## Results

Initial inspection complete. Network npm metadata request pending; local verified package cache is available as fallback. Next: bootstrap.

03–05: pinned local dependencies copied from adjacent verified installation after offline npm ENOTCACHED. Installed Remix exports confirmed. Typecheck/lint, formatting, controller/geometry/media tests pass. Next: SSR and DOM.

06–09 implementation gates: strict build/lint/unit checks pass. Browser acceptance pending next task; these features are implemented, not yet browser-verified. Demo now uses actual Remix Handle props, renderToString and createRoot hydration with abortable ref. Comparison is basic side-by-side; deep zoom, synchronized compare, annotations, momentum, edge-swipe and measured thumbnail morph are deferred, not implemented.

10: Browser automation now passes actual Remix SSR/hydration, real Remix router routes, category filtering/history/sort, no-JS detail routes, keyboard focus and restoration, mouse pan, Chromium touch pinch, RTL, reduced motion, fullscreen fallback, rapid navigation, nested galleries and cleanup. Axe WCAG2 A/AA passes after text contrast correction. Desktop/mobile/lightbox PNG regression baselines generated and compared on a separate run. Manual real-device/screen-reader checklist is in README and remains unverified.

Hardening after browser evidence: media cache consumers cancel independently; modal image decode rejects stale generations, retries failures and keeps bounded URL state. Added frame-independent decaying momentum, cached gesture geometry, measured thumbnail opening, dynamic updates, controlled active/selection state, group/tag/query APIs, layout strategies, synchronized comparison, before/after and annotations. Earlier deferred list is superseded for these implemented features. Type/lint/unit gates pass (12 tests). Clean network `npm ci` succeeds; pinned transitive esbuild override removes the advisory, with zero npm audit vulnerabilities reported. No user files replaced; the original prompt's formatting was restored.

Next: final browser/performance measurements, documentation accuracy and final audit.

11: Benchmarks generated in artifacts/benchmarks.json, browser-performance.json and throttled-performance.json. Final Node run reports core 1,239 B gzip, DOM 6,504 B gzip and demo including Remix runtime 36,961 B gzip; 10k controller/layout p95 8.80 ms, p99 10.12 ms on this host. The 35 KiB budget applies to the gallery entry excluding optional framework runtime; the full demo is larger and reported separately. Windowing uses 24 tiles at the top in the fixed 4-column synthetic model and stays under 120 in real viewport tests. Throttled cold navigation 1.17 s, LCP 812 ms, CLS 0.0021 and synthetic JPEG decode p95 24.2 ms in the recorded run; the report includes test-generated long tasks and memory-estimation caveats. These values are observations, not promises. Dependency licenses inspected; final npm audit had zero vulnerabilities. Next: final browser regression and demo start.

12: Final audit passed npm ci (clean install), build, strict typecheck, lint, 13 Node unit/integration tests, complete Chromium browser suite including pinch, provider failure/retry, axe automation, independent visual regression comparison, benchmark commands and npm pack --dry-run. Demo started successfully at http://127.0.0.1:4187 (PORT override; normal npm run demo uses 4173). README documents APIs, exact Remix integration, commands, security, licenses and limitations. No commit created because this workspace has no writable initialized Git checkout. Optional deep zoom, reverse closing morph, rubber-band overscroll and additional animation profiles are not implemented. Real devices, Firefox/WebKit, native fullscreen browser UI and manual screen-reader audit remain unverified. No full production certification is claimed. All planned implementation/audit tasks are finished for this documented delivery.

## Completion pass requested by user

Execute in order, updating this ledger after each gate. Earlier limitation notes are historical and will be superseded by measured final results.

- [x] 13 Add separately loaded tiled deep zoom: validated pyramid math, viewport-only requests, bounded concurrent decode/cache, cancellation/retry, keyboard/pointer/touch and demo. Gate: unit, build, lint, format.
- [x] 14 Complete reversible close-to-thumbnail/fade transitions, configurable motion/zoom, rubber-band overscroll and cleanup under interruption. Gate: unit/build/lint and browser regression.
- [x] 15 Complete remaining product gaps: proximity/adjacent loading with reduced-data budgets, layout options, full thumbnail access, accessible ordering and extension demos. Gate: integration, security and accessibility tests.
- [x] 16 Audit all original requirements, run clean install/build/type/lint/unit/E2E/visual/accessibility/benchmarks/package/demo gates, and record exact remaining external/manual verification. No unsupported feature will be presented as complete.

13: Deep zoom module, planner tests and lazily imported 65,536×49,152 raster-tile atlas demo implemented. 15 unit/integration tests, strict build/lint and format pass. Browser budget/cancellation/retry assertions will run in task 16. No full-resolution atlas bitmap is constructed. Next: reverse close, overscroll and configurable motion.

14: Reverse close retains modality/scroll lock until measured thumbnail animation or fade completes. Reopen/navigation cancels obsolete completions; destroy bypasses animation. Added configurable motion profiles, zoom levels, reduced-motion updates, bounded rubber-band presentation and settling. 18 Node tests and the full Chromium regression suite pass. Browser-specific close interruption assertions will be added in final audit. Next: loading/layout/rail/order and extension UX gaps.

15: Added reduced-data-aware two-neighbor decode, bounded retained previews, a 40MP default decode budget and explicit tiled-viewer message, progressive preview/skeleton states, vertical and windowed full-access thumbnail rails, responsive container breakpoints/aspects/spans/alignment, optional ordering buttons, extension demos, configurable spring keyframes, and strict demo TypeScript checks. 19 Node tests and build/lint/format pass. Optional video/panorama/worker features remain intentionally outside core per prompt. Next: targeted adversarial browser tests and all verification gates.

16: Final completion audit: clean cached npm ci succeeded (the restricted sandbox initially blocked esbuild's executable check; rerun with execution permissions passed). Final npm run test:all exited 0: strict library/demo typecheck and lint, production build, 20 unit/integration tests, full Chromium E2E, independently compared desktop/mobile/grid/lightbox/zoom-pan/loading/reverse-close visual baselines, axe on gallery and deep zoom, Firefox SSR/modal/closing smoke, Node benchmarks and throttled browser/JPEG decode benchmark, and formatting. Package dry-run includes deep-zoom and motion declarations/modules. WebKit launch was attempted and explicitly unavailable because libavif.so.16 is missing; real devices, native fullscreen browser UI and manual screen-reader certification remain unverified. Optional video/panorama, arbitrary inline SVG uploads and variable-height virtual masonry are not claimed.

New feature assertions pass for lazy deep-zoom chunks, actual-pixel zoom, keyboard and two-finger pan/zoom, reverse measured close, offscreen fade fallback, interrupted close/reopen, destroy during close, scroll-lock lifetime, accessible ordering, reduced-data and preview origin restrictions, full-access bounded horizontal/vertical rails, and no full-resolution gigapixel thumbnail requests. Instrumented tile workload: 24 mounted tiles, at most 2 active jobs, 8 encoded cache entries (19,000 bytes), obsolete requests aborted and zero retained object URLs after destroy. Final gzip entries: core 1,252 bytes, DOM 9,001 bytes, standalone deep zoom 3,388 bytes; optional dynamic chunks reported separately. Final 10k state/layout p95 8.54 ms / p99 9.80 ms on this host. Throttled cold demo navigation 936 ms, LCP 708 ms, CLS 0.0022; synthetic JPEG decode p95 22.6 ms. These remain environment-specific observations with methodology in artifacts.

README and ARCHITECTURE now supersede the historical unsupported-feature notes above. The completed demo is started on port 4187; normal npm run demo uses 4173. No source work remains for this completion pass; remaining audit items require external runtime libraries, real devices or manual assistive-technology review.

## WebKit runtime follow-up

- [x] 17 Diagnose runtime and install official Ubuntu libavif16 with required libgav1/libyuv/libmanette/libhidapi packages locally. System sudo requires interactive authentication. Verified WebKit 27.2 launch using scoped LD_PRELOAD because Playwright's launcher resets LD_LIBRARY_PATH. Setup script pins versions and records package hashes; extracted libraries remain ignored runtime assets.
- [x] 18 Run dedicated WebKit gallery/deep zoom/closing/interaction tests, fix application failures and rerun affected regression checks. Update documentation and exact results.

18: Installed and verified the local WebKit runtime through npm run setup:webkit. WebKit 27.2 now launches and passes nine dedicated integration groups: SSR/hydration/routes, focus/history, keyboard zoom/pan, responsive/category/sort layout, deep-zoom PNG/JPEG tiles and retry/resource cleanup, comparison/annotations, reverse-close/reopen/destroy races, mobile touch/RTL/reduced motion, no-JS routes and axe accessibility. Found and fixed two issues: comparison pan capture intercepted real annotation button clicks; queued deep-zoom renders briefly advertised stale ready state. Added real-pointer Chromium regression coverage and explicit pending-render readiness assertions. npm run check passed build, strict library/demo lint and 20 unit/integration tests. npm run browser passed Chromium E2E/visual/accessibility, Firefox smoke, WebKit smoke and the required dedicated WebKit suite without skips. Results: artifacts/webkit-results.json. README/ARCHITECTURE describe local installation and now supersede the earlier missing-library limitation. Runtime packages are ignored, version-pinned and hash-recorded; system/Playwright-managed files were not modified.

## Full-suite verification follow-up

- [x] 19 Run the complete suite after WebKit compatibility fixes, including all browser targets, unchanged visual baselines and benchmarks. `npm run test:all` exited 0. Strict library/demo typecheck, lint, build, all 20 Node tests (zero failures/skips), Chromium E2E/feature/accessibility tests, Firefox SSR/modal/close smoke, WebKit smoke and nine dedicated WebKit 27.2 integration groups passed. All seven existing visual baselines matched without regeneration. Node bundle/layout/state benchmarks and the throttled browser/decode benchmark completed. No browser launch skips or remaining failures occurred. Fresh reports are under artifacts/, with an aggregate in artifacts/full-suite-results.json. No additional application fixes were needed in this run.

## Firefox integration parity

- [x] 20 Share the portable Chromium gallery/feature and WebKit integration scenarios with a required Firefox runner. Include per-engine visual baselines, mobile/touch viewport, gesture-recognizer coverage, deep-zoom budgets/failures/cancellation, modal lifecycle, accessibility, routing, controls and no-JS. Native multi-touch injection is Chromium CDP-only; Firefox will explicitly test the same Pointer Events recognizer using synthetic multi-pointer input rather than claim native device emulation.
- [x] 21 Run the Firefox suite, investigate/fix failures, review new Firefox-only baselines, then run the entire test/visual/accessibility/benchmark suite. Record coverage, results and browser-specific limits without skips.

20: Shared gallery, feature and codec/lifecycle scenarios now run in required Firefox mode, with no optional launch skips. Firefox 157.0 passed 27 scenario groups (10 gallery, 8 feature/resource, 9 shared codec/lifecycle) on the first expanded pass after fixing a redundant tab stop on the thumbnail scroll container. Added separate Firefox result/performance artifacts and seven per-engine visual baselines. Review caught Firefox's offscreen lazy images not being loaded by full-page screenshots; capture now scrolls/decodes each gallery image and validates its natural dimensions before restoring scroll. Native Chromium pinch injection remains unchanged; Firefox explicitly exercises synthetic multi-pointer recognition plus actual single-touch input. Next: regenerate/review Firefox captures, independent regression comparison and the full suite.

21: Completed the expanded Firefox 157.0 suite: 27 scenario groups (10 shared Chromium gallery, eight shared feature/resource, nine shared WebKit codec/lifecycle), with no skipped groups. Reviewed Firefox desktop/mobile/lightbox captures; all images load after the lazy-image capture correction. Fixed the real Firefox thumbnail scroll-container tab stop with tabindex=-1 on the rail, preserving focusable thumbnail buttons. The final npm run test:all exited 0: library/demo typecheck and lint, build, 20 Node tests, Chromium gallery/features, required Firefox gallery/features/codec integration, WebKit 27.2 integration, axe audits, Node benchmarks, throttled browser/decode benchmarks and format checks. All 14 Chromium/Firefox visual baselines matched; SHA-256 checks confirm the full run did not rewrite any baseline. No browser smoke-only fallback or launch skips remain. Aggregate report: artifacts/full-suite-results.json; Firefox coverage and automation limits: artifacts/firefox-results.json. Native Firefox multi-touch and genuine mobile device behavior remain manual checks, explicitly distinguished from synthetic recognizer tests.

- [x] 22 Expand WebKit to all shared gallery, feature and integration scenarios, with seven independently reviewed visual baselines.
- [x] 23 Fix parity failures and rerun the complete type/lint/unit/browser/visual/benchmark/format gate.

22: WebKit 27.2 passed all 27 shared scenario groups without skips. Reviewed all seven new WebKit visual captures, including decoded full-page images, loading placeholder and paused reverse-close midpoint. No application failures were found. Next: independent full-suite regression comparison and benchmarks.

23: npm run test:all exited 0: strict library/demo typecheck and lint, build, 20 Node tests, Chromium gallery/features, all 27 Firefox and all 27 WebKit shared groups, axe audits, visual comparisons, Node benchmarks, throttled browser/decode benchmarks and formatting. All 21 Chromium/Firefox/WebKit baselines remained byte-identical during verification (SHA-256 checked). No skips or remaining failures; no application changes were required. WebKit multi-pointer input remains explicitly synthetic. Aggregate report: artifacts/full-suite-results.json.

- [x] 24 Add required full-suite GitHub Actions CI, failure diagnostics and always-uploaded artifacts; verify the CI runner locally.

24: Added push/PR/manual GitHub Actions on fixed Ubuntu 24.04, Node 24, npm ci and Playwright browser/system dependency installation. CI runner executes all ten stages and preserves failures while continuing independent checks. Always-upload artifacts include logs, reports, actual/expected screenshots and visual diffs with 14-day retention. Local npm run test:ci passed all stages, including 20 Node tests, Chromium, 27-group Firefox and WebKit suites, all 21 unchanged visual baselines and both benchmark commands. Intentional failure checks verified screenshot/error capture and runner continuation/nonzero exit. Workflow YAML parses and formatting passes. Hosted Actions execution awaits pushing this workflow to GitHub; no remote run is claimed.

- [ ] 25 Publish curler7/remix3-image-gallery, inspect hosted Ubuntu CI failures and visual differences, then verify a complete successful hosted run with downloadable artifacts.
