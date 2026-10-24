# Codex master prompt — Remix 3 Interactive Image Gallery

You are Codex operating in the CURRENT DIRECTORY. Build a production-grade, highly interactive, accessible, extensible image-gallery system from scratch, primarily for a Remix 3 application, using TypeScript.

## Mandatory execution order

1. Inspect the directory, tooling, installed Remix version, and available documentation. Do not assume Remix 3 uses React or Remix 2 APIs. Verify the real framework APIs and component conventions against installed source and official docs; document uncertainties.
2. BEFORE writing implementation code, create `ARCHITECTURE.md` at repository root. Include architectural diagrams, package boundaries, data models, public APIs, Remix 3 integration, SSR/hydration approach, lifecycle, concurrency, performance budgets, accessibility, testing strategy, security, alternatives and explicit trade-offs.
3. NEXT create `TASKS.md` at repository root, an ordered, granular checklist with dependencies, acceptance criteria, test commands, and status. No implementation before both documents exist.
4. Execute tasks **one at a time**, in dependency order. After each task, run relevant formatting, lint, type-check and tests; update `TASKS.md` with results, completed items, and next task. Never claim success without running verification. Continue autonomously through all feasible tasks. If blocked, record exact cause and proceed only to independent tasks; never silently skip.
5. Finish with a working demo, tests, benchmarks, documented usage, and a truthful final summary including unverified items. Commit only if repository policy allows; never overwrite existing user work.

## Product requirements

Create a reusable, framework-agnostic TypeScript gallery engine with a **thin, verified Remix 3 adapter** and polished demonstration application. The engine should support static and dynamically loaded images, multiple gallery instances, desktop/mobile/tablet, keyboard, pointer, touch, stylus, RTL, and varying input devices. Design it for e-commerce product galleries, portfolios, editorial collections, media libraries, and large image datasets.

### Layouts and animated reflow
- Responsive justified, masonry, CSS grid, rows, columns, collage, featured hero, and optional carousel/filmstrip layouts.
- Configurable gutters, aspect ratios, spans, alignment, breakpoints and container queries; robust handling of unknown image dimensions and mixed portrait/landscape media.
- Smooth layout transitions using measured FLIP / Web Animations API when necessary; avoid layout thrashing, cumulative layout shift and animation glitches.
- Filtering, sorting, grouping, tagging, selection and reordering with animated repositioning. Provide drag-and-drop only when accessible keyboard alternatives exist.
- Optional virtualized/windowed gallery for thousands of items; overscan, stable identity, scroll anchoring and image dimension estimation. Avoid virtualizing elements that need to remain mounted for focus or active transitions.

### Lightbox and immersive viewer
- Accessible modal lightbox with backdrop, focus trap, focus restoration, scroll locking, inert background, escape close, browser back integration when enabled, and correct nested-overlay handling.
- Open/close transitions from clicked thumbnail using measured geometry; gracefully degrade to fade when source is missing, virtualized, offscreen, or incompatible.
- Zoom-to-fit, actual pixels, custom zoom levels, double-click/tap, pinch-to-zoom, wheel+modifier zoom, keyboard zoom, and animated zoom around the focal point.
- One-finger pan at zoom, bounded pan, overscroll resistance, momentum with controlled decay, gesture conflict arbitration, and reset-to-fit.
- Swipe navigation with direction-aware transitions; don't navigate while a zoomed image is being panned until edge thresholds are satisfied.
- Fullscreen API integration with clear fallback when unavailable; support browser UI, viewport changes, device rotation, safe areas, and mobile browser chrome.
- Thumbnail rail (horizontal/vertical), filmstrip, previews, index/count, captions, metadata, download/share hooks with authorization-safe defaults, optional slideshow/autoplay with pause on interaction/visibility/reduced motion.
- Compare mode (side-by-side and synchronized zoom/pan), optional before/after slider, and optional image annotations/hotspots as separately loadable extensions.

### Loading, media and image quality
- Responsive images via srcset/sizes and modern formats; art direction via picture sources where appropriate; preserve alt text and intrinsic dimensions.
- Lazy load based on proximity and priority, decode images before display where practical, preload adjacent images conservatively, cancel stale requests where possible, and manage decode/cache budgets.
- Progressive placeholders (dominant color, blurhash-like plugin, low-res preview), skeletons, error and retry UI, offline/error resilience; prevent placeholder-to-image flicker.
- Optional tiled/deep-zoom adapter for very large images; never decode full-resolution gigapixel assets by default.
- Support remote asset providers through an explicit image-loader interface; signed URL refresh hooks, CORS handling, and strict avoidance of leaking private URLs in diagnostics.
- Metadata and EXIF orientation considerations; optional zoomable SVG support with sanitization/security rules. Videos or panoramas are optional adapters, not core requirements.

### Gestures and animation quality
- Pointer Events with pointer capture, robust cancellation, touch-action strategy, gesture recognizer state machine, velocity sampling and bounded physics.
- Frame-rate-independent motion, interruptible/reversible animations, no duplicate animation loops, transform/opacity-first animations, compositor-friendly effects, no forced synchronous layout in hot paths.
- Prefer native CSS/WAAPI and browser image decode APIs; use requestAnimationFrame only when needed. Do NOT use a worker to mutate DOM. Use workers only for proven heavy calculations (e.g., image processing or layout computation), with cancellation and transferable data when useful.
- Configurable easing/springs, durations, motion profiles, reduced-motion behavior, high-contrast support and reduced-data mode.

### Accessibility and internationalization
- Semantic figures/images/captions, descriptive controls, clear accessible names, sensible gallery vs dialog roles, keyboard arrows/home/end/escape/tab, visible focus, screen reader announcements without excessive noise.
- WAI-ARIA dialog practices; preserve reading order even with masonry layout; avoid keyboard traps and gesture-only features.
- RTL navigation and layout, localization hooks for UI labels, number formatting, and dynamic content.
- Respect prefers-reduced-motion and prefers-reduced-data, support zoomed browser text, high contrast, touch target sizes, and non-JS image visibility.

### Remix 3 integration
- SSR-safe initial markup and meaningful no-JS progressive enhancement: image grid remains usable, links open images or detail routes without JavaScript.
- Keep browser-only code behind client initialization and dynamic imports; avoid referencing window/document during server evaluation.
- Confirm actual Remix 3 APIs from installed package/docs before using route navigation, links, loaders, components, hydration or event lifecycle. Do not copy Remix 2 / React patterns unless verified compatible.
- Provide idiomatic integration for route-driven lightbox/deep linking, history and back navigation without corrupting scroll restoration or route transitions; handle rapid navigation, errors and unmount cleanup.
- Stable image IDs and serialized SSR data to avoid hydration mismatch. Demonstrate usage in a realistic Remix 3 app with routes for gallery, category, and image details.

### API and extensibility
- Strict TypeScript, ESM, side-effect-free modules where possible, clear public exports, typed configuration, lifecycle hooks and events.
- Headless gallery controller plus optional DOM UI components and styles. Allow custom renderers, image providers, layout algorithms, transitions, toolbar buttons, metadata panels and analytics hooks.
- Support controlled/uncontrolled selection and active image, async data pagination, append/remove/update/reorder, cancellation and cleanup. Document compatibility and versioning policy.
- Optional integrations must not inflate the default bundle; code-split deep zoom, comparison, advanced effects, and worker processing.

## Suggested repository structure (adjust only with documented rationale)

```
ARCHITECTURE.md
TASKS.md
README.md
package.json
packages/
  gallery-core/
  gallery-layouts/
  gallery-motion/
  gallery-gestures/
  gallery-lightbox/
  gallery-media/
  gallery-accessibility/
  gallery-dom/
  gallery-remix3/
  gallery-styles/
apps/
  remix3-demo/
tests/
  e2e/
  performance/
  visual/
```

Avoid gratuitous package fragmentation: use the smallest number of packages that yields clean boundaries. Explain final decisions in ARCHITECTURE.md.

## Engineering and security requirements

- Choose current stable tooling and pin reproducible versions; verify dependency availability and licenses. Prefer small dependencies and tree-shaking; avoid unnecessary animation frameworks.
- Safe URL handling; never interpolate untrusted captions as HTML, sanitize optional SVG, avoid open redirects, constrain external image origins when configured, and document CSP/CORS considerations.
- Avoid hydration mismatch, event listener leaks, stale async image results, duplicate observers, retained object URLs, runaway caches, and incorrect focus restoration.
- Track per-image state with stable IDs; keep layout, interaction, media loading, and rendering responsibilities separated.
- Do not promise absolute 60/120 FPS. Define measurable budgets and test representative devices, throttled CPUs, slow networks and large galleries.

## Testing and acceptance gates

Implement and run:
- Unit tests for layout math, geometry, zoom focal point, bounds, inertia, navigation, state machines, virtualization, cancellation, RTL and edge cases.
- Integration tests for SSR/hydration, Remix 3 route changes, history/deep links, cleanup, async pagination, image failures and multiple galleries.
- Playwright browser E2E tests for mouse, touch emulation, keyboard, focus trap/restoration, pinch (where automation supports it), fullscreen fallback, responsive viewports, reduced motion, RTL and rapid repeated interactions.
- Visual regression for grid/masonry reflow, thumbnail-to-lightbox transitions, image loading, zoom/pan, and mobile layouts.
- Accessibility automation plus manual audit checklist; no automated test alone constitutes accessibility certification.
- Performance benchmarks: production compressed JS by entrypoint, cold start, LCP/CLS impact, image decode and memory pressure, p95/p99 frame duration, long tasks, interaction latency, scroll responsiveness, virtualization DOM count, and 100/1,000/10,000-item cases with realistic image sizes. Record methodology and measured results, not fabricated numbers.
- Verify build, typecheck, lint, unit, E2E and demo start; provide reproducible commands in README.

## Required implementation sequence for TASKS.md

Break down into independently verifiable tasks in approximately this order: project/bootstrap; architecture & task docs; types/contracts; headless state engine; image loader and cache; layouts; responsive SSR markup; DOM adapter; gestures; motion; lightbox; zoom/pan; thumbnails/navigation; fullscreen; virtualization; Remix 3 adapter and routing; advanced extensions; accessibility hardening; testing; performance optimization; docs/demo; final audit. Adjust dependencies where needed, but always execute one task at a time and update TASKS.md immediately.

## Definition of done

The repository is complete only when a user can install/build it, run the Remix 3 demo, browse a responsive animated masonry gallery, open a lightbox from a thumbnail, zoom/pan smoothly with mouse/touch/keyboard, navigate by thumbnails and swipe, use fullscreen where supported, and access the same core experience with reduced motion and keyboard navigation. Demonstrate large datasets without unbounded DOM growth, route navigation without broken history, and documented test/benchmark results. Clearly mark optional features and unsupported browsers. If the environment prevents verification, state exactly what was not verified.

**Start now by creating ARCHITECTURE.md, then TASKS.md, before any implementation. Continue implementing tasks sequentially until finished or genuinely blocked. Do not stop after planning.**
