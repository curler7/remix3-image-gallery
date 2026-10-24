# Fieldnotes interactive gallery

[![Full test suite (main)](https://github.com/curler7/remix3-image-gallery/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/curler7/remix3-image-gallery/actions/workflows/ci.yml)

A framework-independent TypeScript gallery with a Remix 3.1 server-rendered demo. No React. Local illustrated images keep the demo usable without third-party image services.

## Run

Node >=24.3.0:

```sh
npm ci
npm run demo
# http://127.0.0.1:4173
```

```sh
npm run test:all
# Or individual gates:
npm run typecheck
npm run lint
npm test
npx playwright install chromium firefox webkit
# Ubuntu 26.04 x64 local runtime, if WebKit dependencies are missing:
npm run setup:webkit
npm run test:webkit
npm run test:firefox
npm run browser
npm run bench
npm run bench:browser
npm run format:check
```

Browser tests need permission to bind localhost in restricted environments. Dependencies are pinned in the lockfile. A clean network `npm ci` was verified after the initial offline metadata lookup failed. Dependency licenses are MIT (Remix/esbuild/Prettier/pngjs), Apache-2.0 (TypeScript/Playwright), MPL-2.0 (axe-core), and ISC (pixelmatch).

## Use the engine

```ts
import { GalleryController } from "@gallery/interactive";
import { mountGallery } from "@gallery/interactive/dom";

const items = [
  {
    id: "coast",
    src: "/coast.jpg",
    alt: "Waves against a rocky coast",
    title: "The coast",
    category: "Travel",
    width: 1600,
    height: 1200,
  },
];
const controller = new GalleryController(items);
const unsubscribe = controller.subscribe((snapshot) =>
  console.log(snapshot.active),
);
controller.open("coast");
controller.update("coast", { title: "Evening on the coast" });
unsubscribe();
controller.destroy();

// Enhance a root containing semantic a[data-id] links; returns its own controller.
const mounted = mountGallery(element, items, { history: true });
mounted.destroy();
```

Import `@gallery/interactive/styles` in a bundler or serve `public/style.css`. The default core entry has no DOM or Remix runtime dependency. Image objects are copied and frozen. Selection uses IDs; consumers can mirror snapshots in external controlled state. Core accepts append, remove, replace, update and reorder. Async serial pagination lives in `/pagination`; cancellation prevents stale results from being appended.

## Remix 3.1 integration

`Gallery` receives a real Remix `Handle`, returns a render function, and renders figures and image-detail links on the server. `scripts/server.mjs` uses `createElement` and `renderToString` from the installed 3.1 APIs. The demo client hydrates with `createRoot` and an abortable `ref` mixin. Browser code is imported dynamically by the adapter. Dispose the root on route teardown; the ref abort signal destroys observers, dialog, animation and listeners. Do not reconcile island descendants while the DOM controller owns them.

Routes `/`, `/category/landscape`, `/category/architecture`, `/category/travel` and `/image/:id` respond with complete HTML. Category links work as ordinary document navigation without JavaScript; the enhanced client filters with FLIP and records category history. Enhanced thumbnails push an image URL; viewer navigation replaces that entry, Escape/back closes it. Reloading an image URL still renders a meaningful detail page. The Node HTTP host delegates gallery, category, image, asset and not-found dispatch to Remix's actual `createRouter().fetch()` API; `tests/routes.test.mjs` verifies response statuses directly without a socket. This is a small custom host rather than a generated CLI template.

## Interaction and layouts

Masonry/grid controls animate with FLIP; `/layouts` exposes grid, masonry, justified, rows, columns, collage, hero and filmstrip strategies. The modal supports arrows, Home/End, Escape, +/-/0, thumbnails, modifier-wheel zoom, double-click/tap, pinch, bounded pointer and keyboard pan, decaying momentum, swipe at fit and after a zoom-edge threshold, and Fullscreen API fallback. Native dialog handles inert background and modality. A nested-overlay scroll-lock counter prevents premature unlocking.

`mountWindow` uses fixed 240px rows, overscan and stable IDs. The demo's 10,000-item mode maintains bounded DOM. Variable-height masonry is not virtualized. Mounted tile identities are retained, focused tiles are pinned, and column-count changes anchor to the previous row. Real assistive-technology focus and scroll anchoring still require manual audit. The rail windows at most 100 thumbnails around the active image, so Home/End and navigation expose every item without mounting the entire dataset. Both horizontal and vertical rails are available.

Optional `/extensions` exports opt-in slideshow (pause on interaction/visibility/reduced motion) basic side-by-side comparison, synchronized zoom/pan, before/after slider and accessible annotation buttons. `/media` provides a bounded provider cache with independent consumer cancellation. Signed URL refresh belongs in the provider; do not log private URLs.

## Security and accessibility

Sources accept HTTP(S) and relative URLs, with optional origin restriction via `safeURL`. Text is rendered as text nodes/escaped SSR text. SVG files in the demo are trusted server-generated illustrations; arbitrary inline SVG uploads are not accepted. Accessible HTML annotation buttons are supported. Production CSP should restrict image origins and script/style origins. Responsive `srcset` and art-direction picture sources are validated for URL protocols; `allowedOrigins` also restricts providers and rendered sources. Call `estimateImage` when intrinsic metadata is missing. No automatic downloads or sharing.

Automated accessibility checks do not certify accessibility. Before deployment manually check VoiceOver/NVDA reading and modal announcements, touch pinch on real iOS/Android, text at 200–400%, forced colors, safe areas, stylus cancellation, nested dialogs and fullscreen browser UI. The screenshots in `artifacts/` cover desktop, lightbox and mobile.

## Measured validation and limitations

`artifacts/benchmarks.json` records actual compressed entry sizes and 100-run p95/p99 controller/layout timing for 100/1,000/10,000 items. `artifacts/browser-results.json` records browser checks. Results are environment-specific. `artifacts/browser-performance.json` records local browser LCP/CLS, scroll frame p95/p99, long tasks, bounded DOM and JS heap. `artifacts/throttled-performance.json` records 4x CPU, 150 ms latency, a 750 kB/s connection and twelve simultaneously retained 1500×1000 synthetic JPEG decodes. Pixel memory is explicitly estimated, not measured. Real photographic/device pressure is not represented by Node timings.

The previously deferred tiled deep zoom, reverse closing morph, rubber-band overscroll and configurable spring/motion profiles are implemented. The API remains 0.x; Remix adapter compatibility is pinned to 3.1.0. Real-device and manual assistive-technology validation remain separate from automated tests.

## Custom UI and providers

`DOMOptions` accepts `labels` keyed by toolbar actions plus dialog/thumbnails/loading/view/fullscreenUnavailable, `formatCount`, `allowedOrigins`, `provider`, `renderMetadata`, and `toolbarButtons`. Toolbar callbacks receive the active stable ID. Use those callbacks for application-authorized download/share operations; nothing sends data by default. A custom `provider.resolve(src, signal)` may refresh a signed URL. The viewer decodes before showing it, cancels stale generations, and exposes retry UI without logging source URLs. Core events are available through `subscribe`; do not send snapshots containing private URLs to analytics.

Keyboard: arrows navigate at fit, pan at zoom; Alt+arrows or PageUp/PageDown navigate at zoom; Home/End jump; +/- zoom; 0 fits; Escape closes. Fullscreen requires browser support and user activation. Supported automated targets include current Chromium, Firefox and WebKit (desktop and responsive/touch viewports). Firefox 157 runs the shared Chromium gallery/feature suite plus the shared WebKit codec/lifecycle suite, including seven Firefox-specific visual baselines. WebKit 27.2 runs the same shared gallery, feature/resource and codec/lifecycle suites, including seven WebKit-specific visual baselines, after local runtime installation. Older browsers without native dialog/Pointer Events/ResizeObserver and real mobile fullscreen are not certified.

The demo uses Google Fonts with system-font fallbacks; remove the stylesheet import for a fully self-hosted deployment. Screenshots use a 0.5% changed-pixel threshold and can be intentionally regenerated with `npm run browser:update` after visual review. No tests certify absolute FPS or accessibility compliance.

## Tiled deep zoom

Use the separate entrypoint; it is absent from the default gallery bundle. The demo's **Explore the deep atlas** button imports it on demand and constructs only individual 256px raster tiles for a 65,536 × 49,152 atlas.

```ts
const { mountDeepZoom } = await import("@gallery/interactive/deep-zoom");
const atlas = mountDeepZoom(
  element,
  {
    width: 100000,
    height: 80000,
    tileSize: 256,
    alt: "A high resolution map",
    tile: (level, column, row, signal) => {
      signal.throwIfAborted();
      return `/tiles/${level}/${column}_${row}.webp`;
    },
  },
  {
    maxTiles: 64,
    concurrency: 4,
    cacheEntries: 96,
    cacheBytes: 16 * 1024 * 1024,
  },
);
atlas.setView({ zoom: 8, x: 0, y: 0 });
// On route/overlay teardown:
atlas.destroy();
```

The no-overlap pyramid has levels 0 through `ceil(log2(max(width,height)))`; level L has dimensions `ceil(width / 2**(maxLevel-L))` by the analogous height. Edge tiles are cropped to those dimensions. Providers may return a PNG/JPEG/WebP/AVIF Blob or a safe URL; URL tiles use abortable CORS fetch, same-origin credentials and reject redirects. Authenticated/signed providers should honor the signal and never log URLs. Implement DZI/IIIF URL conversion in the tile callback after matching this no-overlap geometry; this module does not claim to parse arbitrary manifests. Budgets cap tiles, concurrent jobs, encoded cache bytes and entries; removed tiles revoke their object URLs. Retry requeues failed visible tiles. Keyboard, modifier wheel, double-click, pointer pan and two-finger pinch are supported.

Ordinary SSR and viewer thumbnails do not select full-resolution assets above the 40MP decode budget; provide `preview` for those images and mount the tiled adapter. No full-resolution gigapixel fallback is attempted. EXIF orientation follows native browser image rendering; tile providers must deliver a consistently oriented pyramid.

## Motion, loading and rendering controls

`motion` accepts `gentle`, `snappy`, `none`, or `{duration, zoomDuration, easing, decay, overscroll, spring: {stiffness, damping}}`; `zoomLevels` sets the supported range and keyboard stops. Closing animates to the currently displayed thumbnail when its geometry is compatible and visible, otherwise fades. `close()` returns a promise that settles when the close completes or is superseded by reopening; `destroy()` always cleans up synchronously. Reduced motion closes immediately and disables spring, momentum and overscroll motion. Close/reopen, back navigation and route teardown cannot leave stale callbacks or scroll locks.

`reducedData` overrides browser preferences; otherwise reduced-data media queries and Save-Data are respected. Normal-data mode conservatively decodes at most two adjacent images and retains at most four decoded neighbors, each under an 8MP preload budget. `maxDecodedPixels` defaults to 40MP. `preview` supports low-resolution placeholders, `color` supplies a dominant color, and `placeholder(container,item,signal)` can render a blurhash-style plugin and return cleanup. Skeleton/retry UI remains available on failures.

Custom DOM renderers use `renderItem(document,item)`, custom WAAPI animations use `transition(element,keyframes,timing)`, and `renderMetadata`/`toolbarButtons` customize the viewer. `reorderable` exposes named earlier/later buttons; these work with keyboard and do not require drag gestures. `rail: 'vertical'` changes orientation. `/layouts` accepts container-width `breakpoints`, `aspectRatio`, `spans`, `align`, gutters and row/column sizing; `mountResponsiveLayout` manages a ResizeObserver and returns teardown.

## Acceptance coverage

| Requirement family                                                            | Implementation and verification                                                                                                                                      |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headless state, stable IDs, selection, query/group/tags, ordering, pagination | Strict core APIs; state, immutable data, RTL, cancellation and pagination tests                                                                                      |
| All specified layouts, responsive media and progressive enhancement           | Layout strategies/options; SSR escaping/no-JS routes; desktop/grid/mobile/zoom/loading visual baselines                                                              |
| Modal, reverse geometry, gestures, zoom, physics and history                  | Shared Chromium/Firefox/WebKit suite; close interruption, offscreen fade, focus/locks, pinch recognition, pan, rapid navigation, reduced motion and nested galleries |
| Tiled large images and bounded resources                                      | Pure gigapixel planner tests; lazy atlas demo; concurrency/cache/DOM caps, failures, retry, abort and zero retained object URLs after destroy                        |
| Optional comparison, before/after, annotations, slideshow                     | Lazy extension demo and integration tests; interaction/visibility/motion pause; keyboard controls                                                                    |
| Accessibility and performance                                                 | Axe on gallery and deep zoom; forced colors/tablet rotation; Node and throttled browser benchmarks with explicit methodology                                         |
| Framework/build/distribution                                                  | Actual pinned Remix 3.1 APIs, SSR/hydration, router tests, strict demo checks, clean install and package dry-run                                                     |

Optional video/panorama adapters and worker processing are not part of this image gallery; no worker is needed for the measured main-thread workload. Arbitrary inline SVG uploads are deliberately not accepted, so no unsafe SVG sanitizer is implied. Virtualization uses fixed-height grid rows; variable-height virtual masonry is not claimed. Manual VoiceOver/NVDA, real stylus/mobile browsers, genuine browser text zoom and native fullscreen UI remain on the manual audit checklist. WebKit runs with scoped, repository-local runtime libraries; its shared suites fail on launch or test errors rather than silently skipping them.

## Local WebKit runtime

System installation requires interactive sudo authentication on this host. `npm run setup:webkit` instead downloads pinned official Ubuntu 26.04 x64 packages (`libavif16`, `libgav1-2`, `libyuv0`, `libmanette-0.2-0`, `libhidapi-hidraw0`) and extracts them under ignored `.runtime/webkit/`. It records archive SHA-256 hashes and versions in `.runtime/webkit/manifest.json` and preserves packaged copyright notices. No system libraries or Playwright cache files are modified. Other platforms should use Playwright's host-specific dependency installation.

WebKit's bundled launcher resets `LD_LIBRARY_PATH`, so `scripts/webkit-runtime.mjs` passes scoped `LD_PRELOAD` entries only to WebKit and its subprocesses. Chromium, Firefox and the gallery runtime keep their normal environments. `npm run test:webkit` builds and runs the required WebKit suite; `npm run browser` and `npm run test:all` include it. Results are saved in `artifacts/webkit-results.json`. The suite includes actual pointer clicks on annotations and verifies that queued deep-zoom renders report busy immediately; these checks caught and fixed the pointer-capture and readiness issues uncovered by WebKit.

## Firefox integration parity

`npm run test:firefox` is a required 27-group integration run: 10 shared gallery scenarios, eight shared feature/resource scenarios, and nine shared codec/lifecycle scenarios. `npm run browser` and `npm run test:all` always include it; launch errors fail the run. `tests/gallery-suite.mjs`, `tests/feature-suite.mjs` and `tests/integration-suite.mjs` hold the shared assertions so Firefox coverage follows future changes rather than a copied smoke test.

Coverage includes SSR/hydration, category/deep-link/history routes, mouse zoom/pan, keyboard navigation and focus containment/restoration, touch activation, RTL/reduced motion/forced colors/tablet resize, all layout APIs, dynamic updates and selection, multiple/nested galleries, provider retry, 10,000-item virtualization, lazy deep zoom, JPEG/PNG decoding, cancellation/concurrency/cache/object URL budgets, oversize-image guards, reverse-close/fade/interruption, comparison/annotations, no-JS and axe accessibility. Screenshot capture loads/decode-checks offscreen gallery images before restoring scroll.

Firefox has seven independent baselines in `tests/visual/firefox/` (desktop, mobile, grid, lightbox, zoom/pan, loading and reverse-close). To intentionally generate/review Firefox baselines only, use `npm run browser:firefox:update`; ordinary runs compare without rewriting them. Reports are `artifacts/firefox-results.json`, `firefox-browser-results.json`, `firefox-feature-results.json`, `firefox-integration-results.json` and `firefox-browser-performance.json`. Unsupported Firefox performance observer/heap metrics are reported as null.

Firefox uses genuine Playwright mouse and single-touch activation at responsive viewports. Playwright does not expose native multi-touch injection for Firefox, so multi-pointer zoom recognition is tested with explicitly labelled synthetic Pointer Events. Firefox's unsupported `isMobile` flag is omitted; mobile viewport, touch capability and reduced motion remain exercised. Native multi-touch/device behavior still needs manual device testing. Chromium retains its native CDP touch injection tests. The Firefox compatibility correction makes the scrollable thumbnail rail itself non-tabbable while leaving its thumbnail buttons in normal keyboard order.

## WebKit integration parity

`npm run test:webkit` runs all 27 scenario groups: 10 shared gallery, eight shared feature/resource and nine codec/lifecycle groups. The full suite requires WebKit and fails on launch errors. Seven independent baselines in `tests/visual/webkit/` cover desktop, mobile, grid, lightbox, zoom/pan, loading and reverse-close. Use `npm run browser:webkit:update` only for intentional baseline updates; normal runs compare without rewriting them.

WebKit uses Playwright mouse and single-touch input with mobile emulation. Multi-pointer recognition uses explicitly labelled synthetic Pointer Events because Playwright has no native WebKit multi-touch injector. Native device gestures remain a manual check. Aggregate coverage and capabilities are in `artifacts/webkit-results.json`; gallery, feature, integration and performance reports retain the `webkit-` prefix.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` on pushes, pull requests and manual dispatches using Ubuntu 24.04 and Node 24. It installs locked dependencies and all three browsers with Playwright system dependencies. `npm run test:ci` runs every full-suite stage sequentially, continues independent stages after failures and exits nonzero if any stage fails. Visual updates are disabled.

Every run uploads JSON reports, per-stage logs, captured screenshots, expected visual baselines and visual diffs as `gallery-reports-<run id>-<attempt>` with 14-day retention, including on failure. Assertion failures capture open browser pages under `artifacts/failures/`; launch/install failures remain in logs. `artifacts/ci/results.json` records stage exit codes and durations. Benchmark timings are observations, not hardware-independent performance guarantees. CI never regenerates baselines; rendering differences on the fixed runner require review.

Hosted visual checks install Noto Core and use `.github/fonts.conf` for Firefox/WebKit to match the Noto Serif/Sans fallback fonts used for the reviewed baselines. Chromium retains its native font configuration. This keeps fallback metrics consistent between Ubuntu releases without replacing visual expectations or changing the comparison threshold.

The project is published at [curler7/remix3-image-gallery](https://github.com/curler7/remix3-image-gallery). The first successful [hosted full-suite verification](https://github.com/curler7/remix3-image-gallery/actions/runs/40061201111) includes all three browser suites, all 21 existing visual baselines and both benchmark commands, with downloadable reports and screenshots.

## Contributing through protected main

All changes to `main` go through a pull request. The GitHub Actions `full-suite` check must pass on the current PR revision, and the branch must be up to date with `main`. These requirements also apply to administrators; force pushes and deletion of `main` are blocked. The badge above shows push CI on `main`; use the PR's checks to assess its own revision.

1. Start from an up-to-date `main` and create a topic branch:

   ```sh
   git switch main
   git pull --ff-only
   git switch -c your-topic
   ```

2. Make the change and run the checks. Follow the browser dependency setup in [Run](#run), then use `npm run test:ci` for the same stages as hosted CI. Review intentional visual changes before updating baselines; never regenerate them just to hide a regression.
3. Commit and push the topic branch, then open a PR targeting `main`:

   ```sh
   git add <changed-files>
   git commit -m "Describe the change"
   git push -u origin your-topic
   gh pr create --base main
   ```

4. Wait for `full-suite` to pass. If it fails, inspect the run's `gallery-reports-<run id>-<attempt>` artifact for per-stage logs, JSON results, screenshots and visual diffs. Fix the failure on the topic branch and push again; the new revision must pass its own CI checks.
5. If the PR falls behind `main`, update the topic branch and rerun CI:

   ```sh
   git fetch origin
   git merge origin/main
   git push
   ```

6. Once GitHub reports the PR ready to merge and its required checks pass, merge it. GitHub automatically deletes the merged topic branch on the remote; return to `main` and clean up the local branch:

   ```sh
   gh pr merge --squash
   git switch main
   git pull --ff-only
   git fetch --prune
   # Only after confirming the PR is merged (squash changes commit IDs):
   git branch -D your-topic
   ```

   Confirm the resulting push run on `main` also passes. Administrator overrides are not part of this workflow. The live pending/failing/passing protection checks are recorded in [the verification document](docs/branch-protection-verification.md).
