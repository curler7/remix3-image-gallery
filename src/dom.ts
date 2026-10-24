import {
  motionProfile,
  rubberBand,
  springFrames,
  zoomLevels,
  nextZoom,
  type MotionProfile,
} from "./motion.js";
import { MediaCache, type ImageProvider } from "./media.js";
import {
  GalleryController,
  safeURL,
  safeSrcset,
  type GalleryImage,
} from "./core.js";
import { bounds, clamp, decay, focalZoom, windowRange } from "./geometry.js";
const locks = new WeakMap<Document, { count: number; overflow: string }>();
export interface DOMOptions {
  history?: boolean;
  motion?: MotionProfile;
  zoomLevels?: readonly number[];
  rail?: "horizontal" | "vertical";
  provider?: ImageProvider;
  reducedData?: boolean;
  reorderable?: boolean;
  maxDecodedPixels?: number;
  labels?: Partial<Record<string, string>>;
  allowedOrigins?: readonly string[];
  formatCount?: (index: number, count: number) => string;
  toolbarButtons?: readonly {
    id: string;
    label: string;
    text: string;
    activate: (id: string | null) => void | Promise<void>;
  }[];
  renderMetadata?: (container: HTMLElement, item: GalleryImage) => void;
  renderItem?: (document: Document, item: GalleryImage) => HTMLElement;
  placeholder?: (
    container: HTMLElement,
    item: GalleryImage,
    signal: AbortSignal,
  ) => void | (() => void);
  transition?: (
    element: HTMLElement,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) => Animation;
}
export function mountGallery(
  root: HTMLElement,
  items: readonly GalleryImage[],
  options: DOMOptions = {},
) {
  const doc = root.ownerDocument,
    win = doc.defaultView!,
    life = new AbortController(),
    signal = life.signal;
  for (const item of items) {
    safeURL(item.src, options.allowedOrigins);
    if (item.preview) safeURL(item.preview, options.allowedOrigins);
    if (item.srcset) safeSrcset(item.srcset, options.allowedOrigins);
    for (const source of item.sources ?? [])
      safeSrcset(source.srcset, options.allowedOrigins);
  }
  const controller = new GalleryController(items);
  items = controller.snapshot.items;
  const media = new MediaCache(6, options.provider);
  const reducedData =
    options.reducedData ??
    (win.matchMedia("(prefers-reduced-data: reduce)").matches ||
      Boolean(
        (win.navigator as Navigator & { connection?: { saveData?: boolean } })
          .connection?.saveData,
      ));
  const maxPixels = options.maxDecodedPixels ?? 40_000_000;
  if (!Number.isFinite(maxPixels) || maxPixels < 1)
    throw Error("Invalid image decode budget");
  let adjacent: AbortController | undefined;
  const decodedNeighbors = new Map<string, HTMLImageElement>();
  let preview: HTMLImageElement | undefined;
  async function preloadNeighbors(id: string) {
    adjacent?.abort();
    if (reducedData || doc.hidden) return;
    adjacent = new AbortController();
    const neighborSignal = adjacent.signal,
      index = items.findIndex((i) => i.id === id);
    const neighbors = [items[index - 1], items[index + 1]].filter(
      (item): item is GalleryImage =>
        Boolean(
          item && item.width * item.height <= Math.min(maxPixels, 8_000_000),
        ),
    );
    await Promise.allSettled(
      neighbors.map(async (item) => {
        if (decodedNeighbors.has(item.id)) return;
        const url = await media.load(item.src, neighborSignal);
        safeURL(url, options.allowedOrigins);
        neighborSignal.throwIfAborted();
        const decoded = new win.Image();
        const cancel = () => {
          decoded.src = "";
        };
        neighborSignal.addEventListener("abort", cancel, { once: true });
        try {
          decoded.src = url;
          await decoded.decode();
          neighborSignal.throwIfAborted();
          decodedNeighbors.set(item.id, decoded);
          while (decodedNeighbors.size > 4) {
            const key = decodedNeighbors.keys().next().value!;
            decodedNeighbors.get(key)!.src = "";
            decodedNeighbors.delete(key);
          }
        } finally {
          neighborSignal.removeEventListener("abort", cancel);
        }
      }),
    );
  }

  let mediaRequest: AbortController | undefined,
    generation = 0;
  let thumbnailRect: DOMRect | undefined,
    openingAnimation: Animation | undefined,
    openingDialogAnimation: Animation | undefined,
    zoomAnimation: Animation | undefined;
  let navigationDirection = 0,
    placeholderCleanup: (() => void) | undefined,
    placeholderElement: HTMLElement | undefined;
  const animate = (
    element: HTMLElement,
    frames: Keyframe[],
    timing: KeyframeAnimationOptions,
  ) =>
    options.transition?.(element, frames, timing) ??
    element.animate(frames, timing);
  function clearPlaceholder() {
    placeholderCleanup?.();
    placeholderCleanup = undefined;
    placeholderElement?.remove();
    placeholderElement = undefined;
  }
  async function loadImage(item: GalleryImage) {
    const direction = navigationDirection;
    navigationDirection = 0;
    mediaRequest?.abort();
    const mine = ++generation;
    mediaRequest = new AbortController();
    const loadSignal = mediaRequest.signal;
    clearPlaceholder();
    if (options.placeholder) {
      placeholderElement = doc.createElement("div");
      placeholderElement.className = "plugin-placeholder";
      placeholderElement.setAttribute("aria-hidden", "true");
      stage.append(placeholderElement);
      const cleanup = options.placeholder(placeholderElement, item, loadSignal);
      placeholderCleanup = cleanup || undefined;
    }
    preview?.remove();
    preview = undefined;
    stage.style.backgroundColor = /^#[a-f0-9]{3,8}$/i.test(item.color ?? "")
      ? item.color!
      : "#141914";
    if (item.preview) {
      safeURL(item.preview, options.allowedOrigins);
      preview = doc.createElement("img");
      preview.className = "progressive-preview";
      preview.alt = "";
      preview.setAttribute("aria-hidden", "true");
      preview.src = item.preview;
      stage.prepend(preview);
    }
    image.style.opacity = "0";
    stage.setAttribute("aria-busy", "true");
    dialog.querySelector(".viewer-status")!.textContent = label(
      "loading",
      "Loading image…",
    );
    try {
      if (item.width * item.height > maxPixels)
        throw Error("Use tiled deep zoom");
      const url = await media.load(item.src, loadSignal);
      safeURL(url, options.allowedOrigins);
      const decoded = new win.Image();
      const cancel = () => {
        decoded.src = "";
      };
      loadSignal.addEventListener("abort", cancel, { once: true });
      decoded.src = url;
      try {
        await decoded.decode();
      } finally {
        loadSignal.removeEventListener("abort", cancel);
      }
      if (loadSignal.aborted || signal.aborted || mine !== generation) return;
      clearPlaceholder();
      preview?.remove();
      preview = undefined;
      image.src = url;
      image.style.opacity = "1";
      if (thumbnailRect && !reduced && dialog.open) {
        const to = image.getBoundingClientRect();
        const from = thumbnailRect;
        thumbnailRect = undefined;
        if (
          to.width > 0 &&
          to.height > 0 &&
          Math.abs(from.width / from.height - to.width / to.height) < 0.3
        ) {
          openingAnimation?.cancel();
          openingAnimation = animate(
            image,
            [
              {
                transform: `translate(${from.left + from.width / 2 - to.left - to.width / 2}px,${from.top + from.height / 2 - to.top - to.height / 2}px) scale(${from.width / to.width},${from.height / to.height})`,
                opacity: 0.4,
              },
              { transform: "translate(0,0) scale(1)", opacity: 1 },
            ],
            { duration: motion.duration, easing: motion.easing },
          );
        }
      }

      if (direction && !reduced && motion.duration)
        openingAnimation = animate(
          image,
          [
            {
              transform: `translate(${direction * rect.width * 0.08}px,0)`,
              opacity: 0,
            },
            { transform: image.style.transform, opacity: 1 },
          ],
          { duration: motion.duration, easing: motion.easing },
        );
      stage.setAttribute("aria-busy", "false");
      dialog.querySelector(".viewer-status")!.textContent = "";
      measure();
      transform();
      void preloadNeighbors(item.id);
    } catch {
      if (loadSignal.aborted || signal.aborted || mine !== generation) return;
      stage.setAttribute("aria-busy", "false");
      dialog.querySelector(".viewer-status")!.textContent =
        item.width * item.height > maxPixels
          ? label(
              "deepZoomRequired",
              "This image requires the tiled deep zoom viewer.",
            )
          : label(
              "error",
              "Image unavailable. Use Retry image or choose another image.",
            );
    }
  }
  const label = (key: string, fallback: string) =>
    options.labels?.[key] ?? fallback;
  const motionQuery = win.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motionQuery.matches;
  const levels = zoomLevels(options.zoomLevels);
  let motion = motionProfile(options.motion, reduced);
  if (!win.CSS.supports("animation-timing-function", motion.easing))
    throw Error("Invalid motion easing");
  const dialog = doc.createElement("dialog");
  dialog.className = "viewer";
  dialog.setAttribute("aria-label", label("dialog", "Image viewer"));
  dialog.innerHTML =
    '<div class="viewer-toolbar"><span class="counter" aria-live="polite"></span><div><button data-action="previous" aria-label="Previous image">←</button><button data-action="next" aria-label="Next image">→</button><button data-action="zoom" aria-label="Zoom image">＋</button><button data-action="select" aria-label="Select image" aria-pressed="false">✓</button><button data-action="retry" aria-label="Retry image">↻</button><button data-action="actual" aria-label="Actual pixels">1:1</button><button data-action="reset" aria-label="Reset zoom">Fit</button><button data-action="fullscreen" aria-label="Fullscreen">⛶</button><button data-action="close" aria-label="Close viewer">✕</button></div></div><div class="stage"><img alt="" draggable="false"></div><div class="viewer-caption"><h2></h2><p></p></div><nav class="rail" aria-label="Image thumbnails"></nav><p class="viewer-status" role="status"></p>';
  if (options.rail === "vertical") dialog.classList.add("vertical-rail");
  doc.body.append(dialog);
  const image = dialog.querySelector("img")!,
    stage = dialog.querySelector<HTMLElement>(".stage")!,
    rail = dialog.querySelector(".rail")!;
  // Firefox otherwise tabs to the scroll container before its thumbnail controls.
  rail.setAttribute("tabindex", "-1");
  for (const button of dialog.querySelectorAll<HTMLElement>("[data-action]")) {
    const text = options.labels?.[button.dataset.action!];
    if (text) button.setAttribute("aria-label", text);
  }
  rail.setAttribute("aria-label", label("thumbnails", "Image thumbnails"));
  for (const extension of options.toolbarButtons ?? []) {
    const button = doc.createElement("button");
    button.dataset.custom = extension.id;
    button.setAttribute("aria-label", extension.label);
    button.textContent = extension.text;
    dialog
      .querySelector(".viewer-toolbar>div")!
      .insertBefore(button, dialog.querySelector("[data-action=close]"));
  }
  if (options.reorderable) {
    for (const [action, text] of [
      ["earlier", "Move image earlier"],
      ["later", "Move image later"],
    ]) {
      const button = doc.createElement("button");
      button.dataset.action = action;
      button.setAttribute("aria-label", label(action!, text!));
      button.textContent = action === "earlier" ? "⇤" : "⇥";
      dialog
        .querySelector(".viewer-toolbar>div")!
        .insertBefore(button, dialog.querySelector("[data-action=close]"));
    }
  }
  const metadata = doc.createElement("div");
  metadata.className = "viewer-metadata";
  dialog.querySelector(".viewer-caption")!.append(metadata);
  let scale = 1,
    x = 0,
    y = 0,
    source: HTMLElement | null = null,
    ownedHistory = false,
    displayed: string | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let start = { x: 0, y: 0, time: 0 },
    distance = 0;
  const rtl = () => win.getComputedStyle(root).direction === "rtl";
  let rect = { left: 0, top: 0, width: 0, height: 0 },
    fitted = { width: 0, height: 0 },
    frame = 0,
    velocity = { x: 0, y: 0 },
    sampleTime = 0,
    pinched = false,
    lastTap = 0,
    edgeDrag = 0,
    elasticX = 0,
    elasticY = 0;
  function measure() {
    rect = stage.getBoundingClientRect();
    const fit = Math.min(
      rect.width / (image.width || 1),
      rect.height / (image.height || 1),
    );
    fitted = { width: image.width * fit, height: image.height * fit };
  }
  function stopMotion() {
    win.cancelAnimationFrame(frame);
    frame = 0;
  }
  function transform(overscroll = false) {
    const rawX = x,
      rawY = y;
    ({ x, y } = bounds(
      x,
      y,
      Math.max(0, (fitted.width * scale - rect.width) / (scale - 1) || 0),
      Math.max(0, (fitted.height * scale - rect.height) / (scale - 1) || 0),
      scale,
    ));
    const displayX =
        x +
        (overscroll && !reduced ? rubberBand(rawX - x, motion.overscroll) : 0),
      displayY =
        y +
        (overscroll && !reduced ? rubberBand(rawY - y, motion.overscroll) : 0);
    image.style.transform = `translate(${displayX}px,${displayY}px) scale(${scale})`;
    image.style.cursor = scale > 1 ? "grab" : "zoom-in";
  }
  function zoom(next: number, fx = 0, fy = 0, animate = true) {
    const from = win.getComputedStyle(image).transform;
    zoomAnimation?.cancel();
    openingAnimation?.cancel();
    ({ x, y, scale } = focalZoom(
      x,
      y,
      scale,
      clamp(next, 1, levels.at(-1)!),
      fx,
      fy,
    ));
    if (scale === 1) {
      x = 0;
      y = 0;
    }
    transform();
    if (animate && motion.zoomDuration && !pointers.size)
      zoomAnimation = image.animate(
        motion.spring
          ? springFrames(1, motion.spring.stiffness, motion.spring.damping).map(
              (remaining) => {
                const old = new win.DOMMatrix(
                    from === "none" ? undefined : from,
                  ),
                  progress = 1 - remaining;
                return {
                  transform: `translate(${old.e + (x - old.e) * progress}px,${old.f + (y - old.f) * progress}px) scale(${old.a + (scale - old.a) * progress})`,
                };
              },
            )
          : [{ transform: from }, { transform: image.style.transform }],
        { duration: motion.zoomDuration, easing: motion.easing },
      );
  }
  function finishClose(fromHistory = false) {
    if (!dialog.open) return;
    dialog.close();
    dialog.dataset.transition = "closed";
    if (doc.fullscreenElement === dialog)
      void doc.exitFullscreen().catch(() => {});
    stopMotion();
    openingAnimation?.cancel();
    clearPlaceholder();
    mediaRequest?.abort();
    adjacent?.abort();
    generation++;
    pointers.clear();
    const lock = locks.get(doc);
    if (lock && --lock.count === 0) {
      doc.documentElement.style.overflow = lock.overflow;
      locks.delete(doc);
    }
    displayed = null;
    controller.open(null);
    if (ownedHistory && !fromHistory) {
      ownedHistory = false;
      win.history.back();
    }
    const restore = source?.isConnected
      ? source
      : [...root.querySelectorAll<HTMLElement>("[data-id]")].find(
          (el) => el.dataset.id === source?.dataset.id,
        );
    if (restore) restore.focus({ preventScroll: true });
    else {
      root.tabIndex = -1;
      root.focus({ preventScroll: true });
    }
  }
  type Closing = {
    fromHistory: boolean;
    promise: Promise<void>;
    resolve: () => void;
    animations: Animation[];
    clone?: HTMLImageElement;
  };
  let closing: Closing | undefined;
  function cancelClosing() {
    const current = closing;
    if (!current) return;
    closing = undefined;
    for (const animation of current.animations) animation.cancel();
    current.clone?.remove();
    image.style.visibility = "";
    dialog.dataset.transition = "open";
    current.resolve();
  }
  function close(fromHistory = false, immediate = false): Promise<void> {
    if (!dialog.open) return Promise.resolve();
    if (immediate || !motion.duration) {
      cancelClosing();
      finishClose(fromHistory);
      return Promise.resolve();
    }
    if (closing) return closing.promise;
    const target = [...root.querySelectorAll<HTMLElement>("[data-id]")]
      .find((el) => el.dataset.id === displayed)
      ?.querySelector("img");
    const from = image.getBoundingClientRect(),
      to = target?.getBoundingClientRect();
    openingAnimation?.cancel();
    openingDialogAnimation?.cancel();
    zoomAnimation?.cancel();
    stopMotion();
    mediaRequest?.abort();
    adjacent?.abort();
    generation++;
    pointers.clear();
    let resolve!: () => void;
    const current: Closing = {
      fromHistory,
      promise: new Promise<void>((r) => (resolve = r)),
      resolve: () => resolve(),
      animations: [],
    };
    closing = current;
    const compatible =
      to &&
      to.top < win.innerHeight &&
      to.bottom > 0 &&
      to.left < win.innerWidth &&
      to.right > 0 &&
      from.width > 0 &&
      from.height > 0 &&
      image.style.opacity === "1" &&
      Math.abs(to.width / to.height - from.width / from.height) < 0.3;
    if (compatible) {
      const clone = doc.createElement("img");
      clone.className = "closing-image";
      clone.alt = "";
      clone.src = image.currentSrc || image.src;
      clone.style.cssText = `position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;max-width:none;max-height:none;object-fit:fill;pointer-events:none;transform-origin:center;z-index:2`;
      dialog.append(clone);
      current.clone = clone;
      image.style.visibility = "hidden";
      current.animations.push(
        animate(
          clone,
          [
            { transform: "none", opacity: 1 },
            {
              transform: `translate(${to.left + to.width / 2 - from.left - from.width / 2}px,${to.top + to.height / 2 - from.top - from.height / 2}px) scale(${to.width / from.width},${to.height / from.height})`,
              opacity: 0.85,
            },
          ],
          { duration: motion.duration, easing: motion.easing, fill: "both" },
        ),
      );
      dialog.dataset.transition = "closing-thumbnail";
    } else dialog.dataset.transition = "closing-fade";
    current.animations.push(
      animate(dialog, [{ opacity: 1 }, { opacity: 0 }], {
        duration: motion.duration,
        easing: motion.easing,
        fill: "both",
      }),
    );
    void Promise.allSettled(current.animations.map((a) => a.finished)).then(
      () => {
        if (closing !== current) return;
        cancelClosing();
        finishClose(fromHistory);
      },
    );
    return current.promise;
  }
  motionQuery.addEventListener(
    "change",
    () => {
      reduced = motionQuery.matches;
      motion = motionProfile(options.motion, reduced);
      if (reduced) {
        openingAnimation?.cancel();
        openingDialogAnimation?.cancel();
        zoomAnimation?.cancel();
        stopMotion();
        if (closing) void close(closing.fromHistory, true);
      }
    },
    { signal },
  );
  function open(id: string, push = true) {
    cancelClosing();
    const wasOpen = dialog.open;
    if (wasOpen) thumbnailRect = undefined;
    const item = controller.snapshot.items.find((i) => i.id === id);
    if (!item) return;
    if (!dialog.open && source?.dataset.id === id) {
      const r = source.querySelector("img")?.getBoundingClientRect();
      if (r && r.bottom > 0 && r.top < win.innerHeight) thumbnailRect = r;
    }
    openingAnimation?.cancel();
    displayed = id;
    controller.open(id);
    stopMotion();
    pointers.clear();
    scale = 1;
    x = 0;
    y = 0;
    void loadImage(item);
    image.alt = item.alt;
    image.width = item.width;
    image.height = item.height;
    transform();
    dialog.querySelector("h2")!.textContent = item.title;
    dialog.querySelector(".viewer-caption p")!.textContent = item.category;
    metadata.replaceChildren();
    options.renderMetadata?.(metadata, item);
    dialog.querySelector(".counter")!.textContent =
      options.formatCount?.(
        items.findIndex((i) => i.id === id) + 1,
        items.length,
      ) ?? `${items.findIndex((i) => i.id === id) + 1} / ${items.length}`;
    if (
      ![...rail.querySelectorAll<HTMLButtonElement>("button")].some(
        (b) => b.dataset.id === id,
      )
    )
      renderRail();
    rail
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute("aria-current", String(b.dataset.id === id)),
      );
    if (!dialog.open) {
      const lock = locks.get(doc) ?? {
        count: 0,
        overflow: doc.documentElement.style.overflow,
      };
      lock.count++;
      locks.set(doc, lock);
      doc.documentElement.style.overflow = "hidden";
      dialog.showModal();
      measure();
      transform();
      dialog.querySelector<HTMLButtonElement>('[data-action="close"]')!.focus();
      if (!reduced)
        openingDialogAnimation = dialog.animate(
          [
            { opacity: 0, transform: "scale(.97)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: motion.duration, easing: motion.easing },
        );
    }
    if (options.history && push) {
      const url = `/image/${encodeURIComponent(id)}`;
      if (wasOpen) win.history.replaceState({ gallery: true, id }, "", url);
      else win.history.pushState({ gallery: true, id }, "", url);
      ownedHistory = true;
    }
  }
  function navigate(n: number) {
    navigationDirection = n * (rtl() ? -1 : 1);
    controller.navigate(n, rtl());
    if (options.history && controller.snapshot.active)
      win.history.replaceState(
        { gallery: true, id: controller.snapshot.active },
        "",
        `/image/${encodeURIComponent(controller.snapshot.active)}`,
      );
  }
  function renderRail() {
    rail.replaceChildren();
    const activeIndex = Math.max(
        0,
        items.findIndex((i) => i.id === displayed),
      ),
      start = Math.max(0, Math.min(items.length - 100, activeIndex - 50));
    for (const item of items.slice(start, start + 100)) {
      const b = doc.createElement("button");
      b.dataset.id = item.id;
      b.setAttribute("aria-label", `${label("view", "View")} ${item.title}`);
      const img = doc.createElement("img");
      const thumbnail =
        item.width * item.height > Math.min(maxPixels, 8_000_000)
          ? item.preview
          : item.src;
      if (thumbnail) img.src = thumbnail;
      img.alt = "";
      img.loading = "lazy";
      b.append(img);

      rail.append(b);
    }
  }
  renderRail();
  rail.addEventListener(
    "click",
    (e) => {
      const id = (e.target as Element).closest<HTMLElement>("button[data-id]")
        ?.dataset.id;
      if (id) {
        open(id, false);
        if (options.history)
          win.history.replaceState(
            { gallery: true, id },
            "",
            `/image/${encodeURIComponent(id)}`,
          );
      }
    },
    { signal },
  );
  root.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-id]");
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      source = a;
      open(a.dataset.id!);
    },
    { signal },
  );
  dialog.addEventListener(
    "cancel",
    (e) => {
      e.preventDefault();
      close();
    },
    { signal },
  );
  dialog.addEventListener(
    "click",
    async (e) => {
      const custom = (e.target as Element).closest<HTMLElement>("[data-custom]")
        ?.dataset.custom;
      if (custom) {
        try {
          await options.toolbarButtons
            ?.find((b) => b.id === custom)
            ?.activate(displayed);
        } catch {
          dialog.querySelector(".viewer-status")!.textContent = label(
            "actionError",
            "Action unavailable.",
          );
        }
      }
      const action = (e.target as Element).closest<HTMLElement>("[data-action]")
        ?.dataset.action;
      if ((action === "earlier" || action === "later") && displayed) {
        const ids = items.map((i) => i.id),
          index = ids.indexOf(displayed),
          to = index + (action === "earlier" ? -1 : 1);
        if (to >= 0 && to < ids.length) {
          [ids[index], ids[to]] = [ids[to]!, ids[index]!];
          controller.reorder(ids);
        }
      }
      if (action === "select" && displayed) controller.select(displayed);
      if (action === "retry") {
        const item = items.find((i) => i.id === displayed);
        if (item) {
          media.clear();
          void loadImage(item);
        }
      }
      if (action === "close") close();
      if (action === "previous") navigate(-1);
      if (action === "next") navigate(1);
      if (action === "zoom") zoom(scale === 1 ? nextZoom(scale, levels, 1) : 1);
      if (action === "actual")
        zoom(image.naturalWidth / Math.max(1, fitted.width));
      if (action === "reset") zoom(1);
      if (action === "fullscreen") {
        try {
          if (doc.fullscreenElement) await doc.exitFullscreen();
          else if (dialog.requestFullscreen) await dialog.requestFullscreen();
          else throw Error();
        } catch {
          dialog.querySelector(".viewer-status")!.textContent = label(
            "fullscreenUnavailable",
            "Fullscreen is unavailable in this browser.",
          );
        }
      }
    },
    { signal },
  );
  dialog.addEventListener(
    "keydown",
    (e) => {
      if (
        scale > 1 &&
        !e.altKey &&
        ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 80 : 30;
        if (e.key === "ArrowRight") x -= step;
        if (e.key === "ArrowLeft") x += step;
        if (e.key === "ArrowUp") y += step;
        if (e.key === "ArrowDown") y -= step;
        transform();
        return;
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        navigate(1);
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        navigate(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigate(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate(-1);
      }
      if (e.key === "Home") open(items[0]!.id, false);
      if (e.key === "End") open(items.at(-1)!.id, false);
      if (e.key === "+" || e.key === "=") zoom(nextZoom(scale, levels, 1));
      if (e.key === "-") zoom(nextZoom(scale, levels, -1));
      if (e.key === "0") zoom(1);
      if (e.key === "Tab") {
        const buttons = [
          ...dialog.querySelectorAll<HTMLButtonElement>("button"),
        ];
        const first = buttons[0]!,
          last = buttons.at(-1)!;
        if (e.shiftKey && doc.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && doc.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    { signal },
  );
  stage.addEventListener(
    "dblclick",
    (e) => {
      const r = rect;
      zoom(
        scale === 1 ? 2 : 1,
        e.clientX - r.left - r.width / 2,
        e.clientY - r.top - r.height / 2,
      );
    },
    { signal },
  );
  stage.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = rect;
      zoom(
        scale * Math.exp(-e.deltaY * 0.005),
        e.clientX - r.left - r.width / 2,
        e.clientY - r.top - r.height / 2,
      );
    },
    { signal, passive: false },
  );
  stage.addEventListener(
    "pointerdown",
    (e) => {
      stopMotion();
      zoomAnimation?.cancel();
      openingAnimation?.cancel();
      measure();
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = { x: e.clientX, y: e.clientY, time: performance.now() };
      distance = 0;
      edgeDrag = 0;
      elasticX = 0;
      elasticY = 0;
      velocity = { x: 0, y: 0 };
      sampleTime = performance.now();
      if (pointers.size === 2) {
        pinched = true;
        const [a, b] = [...pointers.values()];
        distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      }
    },
    { signal },
  );
  stage.addEventListener(
    "pointermove",
    (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (distance)
          zoom(
            (scale * d) / distance,
            (a!.x + b!.x) / 2 - rect.left - rect.width / 2,
            (a!.y + b!.y) / 2 - rect.top - rect.height / 2,
          );
        distance = d;
      } else if (scale > 1) {
        const now = performance.now(),
          dt = Math.max(1, now - sampleTime);
        velocity = {
          x: (e.clientX - prev.x) / dt,
          y: (e.clientY - prev.y) / dt,
        };
        sampleTime = now;
        x += e.clientX - prev.x + elasticX;
        y += e.clientY - prev.y + elasticY;
        const desired = x,
          desiredY = y;
        transform(true);
        const overflow = desired - x;
        elasticX = overflow;
        elasticY = desiredY - y;
        edgeDrag = overflow;
      }
    },
    { signal },
  );
  const release = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    if (
      e.type === "pointerup" &&
      pointers.size === 1 &&
      !pinched &&
      scale === 1 &&
      Math.abs(e.clientX - start.x) > 65 &&
      performance.now() - start.time < 700
    )
      navigate(e.clientX < start.x ? 1 : -1);
    if (
      e.type === "pointerup" &&
      !pinched &&
      scale > 1 &&
      Math.abs(edgeDrag) > 100 &&
      performance.now() - start.time < 900
    )
      navigate(edgeDrag < 0 ? 1 : -1);
    const wasPinched = pinched;
    pointers.delete(e.pointerId);
    if (!pointers.size) {
      pinched = false;
      elasticX = 0;
      elasticY = 0;
      if (scale > 1) {
        const from = image.style.transform;
        transform();
        if (motion.zoomDuration)
          zoomAnimation = image.animate(
            [{ transform: from }, { transform: image.style.transform }],
            { duration: motion.zoomDuration, easing: motion.easing },
          );
      }
      if (e.type === "pointerup" && !wasPinched && scale > 1 && !reduced) {
        let last = performance.now();
        const tick = (now: number) => {
          const dt = Math.min(32, now - last);
          last = now;
          velocity = {
            x: motion.decay ? decay(velocity.x, (dt * 180) / motion.decay) : 0,
            y: motion.decay ? decay(velocity.y, (dt * 180) / motion.decay) : 0,
          };
          x += velocity.x * dt;
          y += velocity.y * dt;
          transform();
          if (Math.hypot(velocity.x, velocity.y) > 0.01)
            frame = win.requestAnimationFrame(tick);
        };
        frame = win.requestAnimationFrame(tick);
      }
      if (
        e.pointerType === "touch" &&
        Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10 &&
        !wasPinched
      ) {
        const now = performance.now();
        if (now - lastTap < 320) {
          zoom(
            scale === 1 ? 2 : 1,
            e.clientX - rect.left - rect.width / 2,
            e.clientY - rect.top - rect.height / 2,
          );
          ((lastTap = 0), (edgeDrag = 0));
        } else lastTap = now;
      }
    }
    distance = 0;
  };
  stage.addEventListener("pointerup", release, { signal });
  stage.addEventListener("pointercancel", release, { signal });
  stage.addEventListener("lostpointercapture", release, { signal });
  image.addEventListener(
    "load",
    () => {
      measure();
      transform();
      dialog.querySelector(".viewer-status")!.textContent = "";
    },
    { signal },
  );
  image.addEventListener(
    "error",
    () => {
      dialog.querySelector(".viewer-status")!.textContent =
        "Image unavailable. Select another image or try again.";
    },
    { signal },
  );
  win.addEventListener(
    "popstate",
    () => {
      const id = win.location.pathname.match(/^\/image\/([^/]+)$/)?.[1];
      if (id) open(decodeURIComponent(id), false);
      else {
        ownedHistory = false;
        close(true);
      }
    },
    { signal },
  );
  const unsubscribe = controller.subscribe((state) => {
    const changed =
      state.items.length !== items.length ||
      state.items.some((item, i) => item !== items[i]);
    if (changed) {
      for (const item of state.items) {
        safeURL(item.src, options.allowedOrigins);
        if (item.preview) safeURL(item.preview, options.allowedOrigins);
        if (item.srcset) safeSrcset(item.srcset, options.allowedOrigins);
        for (const source of item.sources ?? [])
          safeSrcset(source.srcset, options.allowedOrigins);
      }
      const focused = (doc.activeElement as HTMLElement)?.dataset.id;
      items = state.items;
      const fragment = doc.createDocumentFragment();
      for (const item of items) {
        if (options.renderItem) {
          const element = options.renderItem(doc, item);
          if (element.ownerDocument !== doc)
            throw Error("Renderer returned an element from another document");
          element.dataset.id = item.id;
          fragment.append(element);
          continue;
        }
        const a = doc.createElement("a");
        a.className = "tile";
        a.dataset.id = item.id;
        a.href = `/image/${encodeURIComponent(item.id)}`;
        const figure = doc.createElement("figure"),
          img = doc.createElement("img"),
          caption = doc.createElement("figcaption"),
          title = doc.createElement("span"),
          category = doc.createElement("small");
        const source =
          item.width * item.height > maxPixels ? item.preview : item.src;
        if (source) img.src = source;
        img.alt = item.alt;
        img.width = item.width;
        img.height = item.height;
        img.loading = "lazy";
        img.decoding = "async";
        if (item.srcset && item.width * item.height <= maxPixels)
          img.srcset = item.srcset;
        if (item.sizes) img.sizes = item.sizes;
        img.style.aspectRatio = String(item.width / item.height);
        title.textContent = item.title;
        category.textContent = item.category;
        caption.append(title, category);
        const picture = doc.createElement("picture");
        for (const source of item.width * item.height > maxPixels
          ? []
          : (item.sources ?? [])) {
          const el = doc.createElement("source");
          el.srcset = source.srcset;
          if (source.media) el.media = source.media;
          if (source.type) el.type = source.type;
          picture.append(el);
        }
        picture.append(img);
        figure.append(picture, caption);
        a.append(figure);
        fragment.append(a);
      }
      root.replaceChildren(fragment);
      if (focused)
        for (const a of root.querySelectorAll<HTMLElement>("[data-id]"))
          if (a.dataset.id === focused) a.focus({ preventScroll: true });
      renderRail();
      if (state.active) open(state.active, false);
    }
    dialog
      .querySelector("[data-action=select]")!
      .setAttribute(
        "aria-pressed",
        String(state.active !== null && state.selected.includes(state.active)),
      );
    for (const tile of root.querySelectorAll<HTMLElement>("[data-id]"))
      tile.classList.toggle(
        "selected",
        state.selected.includes(tile.dataset.id!),
      );
    if (state.active !== displayed) {
      if (state.active) open(state.active, false);
      else close(true);
    }
  });
  const resize = new ResizeObserver(() => {
    measure();
    transform();
  });
  resize.observe(stage);
  return {
    controller,
    open,
    close,
    destroy: () => {
      unsubscribe();
      void close(true, true);
      zoomAnimation?.cancel();
      openingDialogAnimation?.cancel();
      stopMotion();
      life.abort();
      mediaRequest?.abort();
      media.clear();
      adjacent?.abort();
      for (const decoded of decodedNeighbors.values()) decoded.src = "";
      decodedNeighbors.clear();
      clearPlaceholder();
      preview?.remove();
      resize.disconnect();
      dialog.remove();
      controller.destroy();
    },
  };
}
/** Fixed-row windowing for large datasets. Focused tiles are retained by stable ID. */
export function mountWindow(
  root: HTMLElement,
  items: readonly GalleryImage[],
  render: (item: GalleryImage) => HTMLElement,
) {
  const life = new AbortController();
  root.classList.add("window");
  const spacer = root.ownerDocument.createElement("div");
  spacer.style.position = "relative";
  root.replaceChildren(spacer);
  const mounted = new Map<number, HTMLElement>();
  let previousColumns = 0;
  const draw = () => {
    const columns = Math.max(1, Math.floor(root.clientWidth / 240));
    if (previousColumns && columns !== previousColumns) {
      const anchor = Math.floor(root.scrollTop / 240) * previousColumns;
      root.scrollTop = Math.floor(anchor / columns) * 240;
    }
    previousColumns = columns;
    const range = windowRange(
      items.length,
      root.scrollTop,
      root.clientHeight,
      240,
      columns,
    );
    spacer.style.height = `${range.total}px`;
    const active = root.ownerDocument.activeElement;
    const focused =
      active && root.contains(active)
        ? active.closest<HTMLElement>("[data-id]")
        : null;
    const indices = new Set(
      Array.from(
        { length: range.end - range.start },
        (_, i) => i + range.start,
      ),
    );
    if (focused) {
      const index = items.findIndex((item) => item.id === focused.dataset.id);
      if (index >= 0) indices.add(index);
    }
    for (const [index, tile] of mounted)
      if (!indices.has(index)) {
        tile.remove();
        mounted.delete(index);
      }
    let cursor = spacer.firstElementChild;
    for (const index of [...indices].sort((a, b) => a - b)) {
      const item = items[index]!;
      let tile = mounted.get(index);
      if (!tile) {
        tile = render(item);
        tile.dataset.id = item.id;
        mounted.set(index, tile);
      }
      tile.style.cssText = `position:absolute;left:${((index % columns) * 100) / columns}%;top:${Math.floor(index / columns) * 240}px;width:${100 / columns}%;height:240px`;
      if (tile !== cursor) spacer.insertBefore(tile, cursor);
      cursor = tile.nextElementSibling;
    }
    if (focused?.isConnected && root.ownerDocument.activeElement !== focused)
      focused.focus({ preventScroll: true });
  };
  root.addEventListener("scroll", draw, { signal: life.signal, passive: true });
  const observer = new ResizeObserver(draw);
  observer.observe(root);
  draw();
  return () => {
    life.abort();
    observer.disconnect();
    mounted.clear();
    root.replaceChildren();
  };
}
