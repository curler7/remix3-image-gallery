import { safeURL } from "./core.js";
import { clamp, focalZoom } from "./geometry.js";
export interface Pyramid {
  width: number;
  height: number;
  tileSize: number;
  alt: string;
  tile: (
    level: number,
    column: number,
    row: number,
    signal: AbortSignal,
  ) => string | Blob | Promise<string | Blob>;
}
export interface DeepView {
  zoom: number;
  x: number;
  y: number;
}
export interface Tile {
  key: string;
  level: number;
  column: number;
  row: number;
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface TilePlan {
  level: number;
  tiles: Tile[];
  view: DeepView;
  fit: number;
}
export function validatePyramid(
  p: Pick<Pyramid, "width" | "height" | "tileSize">,
) {
  if (
    !Number.isSafeInteger(p.width) ||
    !Number.isSafeInteger(p.height) ||
    p.width < 1 ||
    p.height < 1 ||
    p.width > 2 ** 40 ||
    p.height > 2 ** 40 ||
    !Number.isInteger(p.tileSize) ||
    p.tileSize < 32 ||
    p.tileSize > 1024
  )
    throw Error("Invalid image pyramid");
}
export function planTiles(
  p: Pick<Pyramid, "width" | "height" | "tileSize">,
  width: number,
  height: number,
  view: DeepView,
  dpr = 1,
  budget = 64,
): TilePlan {
  validatePyramid(p);
  if (
    !(
      width > 0 &&
      height > 0 &&
      Number.isFinite(width + height + dpr + view.zoom + view.x + view.y)
    ) ||
    dpr <= 0 ||
    !Number.isInteger(budget) ||
    budget < 4
  )
    throw Error("Invalid tile viewport");
  const fit = Math.min(width / p.width, height / p.height),
    zoom = clamp(view.zoom, 1, Math.max(8, 1 / fit)),
    pixelScale = fit * zoom;
  const x = clamp(
      view.x,
      -Math.max(0, p.width * pixelScale - width) / 2,
      Math.max(0, p.width * pixelScale - width) / 2,
    ),
    y = clamp(
      view.y,
      -Math.max(0, p.height * pixelScale - height) / 2,
      Math.max(0, p.height * pixelScale - height) / 2,
    );
  const left = (width - p.width * pixelScale) / 2 + x,
    top = (height - p.height * pixelScale) / 2 + y,
    maxLevel = Math.ceil(Math.log2(Math.max(p.width, p.height)));
  let level = clamp(
    Math.ceil(maxLevel + Math.log2(pixelScale * dpr)),
    0,
    maxLevel,
  );
  function region(l: number) {
    const divisor = 2 ** (maxLevel - l),
      w = Math.ceil(p.width / divisor),
      h = Math.ceil(p.height / divisor),
      size = p.tileSize * divisor * pixelScale;
    return {
      divisor,
      w,
      h,
      size,
      c0: Math.max(0, Math.floor(-left / size) - 1),
      r0: Math.max(0, Math.floor(-top / size) - 1),
      c1: Math.min(
        Math.ceil(w / p.tileSize) - 1,
        Math.floor((width - left) / size) + 1,
      ),
      r1: Math.min(
        Math.ceil(h / p.tileSize) - 1,
        Math.floor((height - top) / size) + 1,
      ),
    };
  }
  let regionInfo = region(level);
  while (
    level > 0 &&
    (regionInfo.c1 - regionInfo.c0 + 1) * (regionInfo.r1 - regionInfo.r0 + 1) >
      budget
  )
    regionInfo = region(--level);
  const tiles: Tile[] = [];
  for (let row = regionInfo.r0; row <= regionInfo.r1; row++)
    for (let column = regionInfo.c0; column <= regionInfo.c1; column++)
      tiles.push({
        key: `${level}/${column}/${row}`,
        level,
        column,
        row,
        left: left + column * regionInfo.size,
        top: top + row * regionInfo.size,
        width:
          Math.min(p.tileSize, regionInfo.w - column * p.tileSize) *
          regionInfo.divisor *
          pixelScale,
        height:
          Math.min(p.tileSize, regionInfo.h - row * p.tileSize) *
          regionInfo.divisor *
          pixelScale,
      });
  tiles.sort(
    (a, b) =>
      Math.hypot(
        a.left + a.width / 2 - width / 2,
        a.top + a.height / 2 - height / 2,
      ) -
      Math.hypot(
        b.left + b.width / 2 - width / 2,
        b.top + b.height / 2 - height / 2,
      ),
  );
  return { level, tiles, fit, view: { zoom, x, y } };
}
export interface DeepZoomOptions {
  maxTiles?: number;
  concurrency?: number;
  cacheEntries?: number;
  cacheBytes?: number;
  allowedOrigins?: readonly string[];
  labels?: Partial<
    Record<
      | "in"
      | "out"
      | "fit"
      | "actual"
      | "retry"
      | "loading"
      | "error"
      | "ready"
      | "instructions",
      string
    >
  >;
}
export function mountDeepZoom(
  root: HTMLElement,
  pyramid: Pyramid,
  options: DeepZoomOptions = {},
) {
  validatePyramid(pyramid);
  const doc = root.ownerDocument,
    win = doc.defaultView!,
    life = new AbortController(),
    signal = life.signal;
  const maxTiles = options.maxTiles ?? 64,
    concurrency = options.concurrency ?? 4,
    maxEntries = options.cacheEntries ?? 96,
    maxBytes = options.cacheBytes ?? 16 * 1024 * 1024;
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 16 ||
    !Number.isInteger(maxTiles) ||
    maxTiles < 4 ||
    maxTiles > 256 ||
    !Number.isInteger(maxEntries) ||
    maxEntries < 0 ||
    !Number.isFinite(maxBytes) ||
    maxBytes < 0
  )
    throw Error("Invalid tile budget");
  const section = doc.createElement("section");
  section.className = "deep-zoom";
  section.setAttribute("aria-label", pyramid.alt);
  const toolbar = doc.createElement("div");
  toolbar.className = "deep-toolbar";
  const scene = doc.createElement("div");
  scene.className = "deep-scene";
  scene.tabIndex = 0;
  scene.setAttribute("role", "img");
  scene.setAttribute(
    "aria-label",
    `${pyramid.alt}. ${options.labels?.instructions ?? "Arrow keys pan; plus and minus zoom; zero fits."}`,
  );
  const status = doc.createElement("p");
  status.setAttribute("role", "status");
  section.append(toolbar, scene, status);
  root.append(section);
  let view: DeepView = { zoom: 1, x: 0, y: 0 },
    rect = { width: 0, height: 0, left: 0, top: 0 },
    frame = 0,
    active = 0,
    disposed = false,
    cacheBytes = 0;
  const cache = new Map<string, Blob>();
  type Entry = {
    tile: Tile;
    image: HTMLImageElement;
    abort: AbortController;
    state: "queued" | "loading" | "ready" | "error";
    url?: string;
  };
  const entries = new Map<string, Entry>();
  const points = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const text = (
    key: keyof NonNullable<DeepZoomOptions["labels"]>,
    fallback: string,
  ) => options.labels?.[key] ?? fallback;
  function release(entry: Entry) {
    entry.abort.abort();
    entry.image.remove();
    if (entry.url) {
      win.URL.revokeObjectURL(entry.url);
      entry.url = undefined;
    }
  }
  function remember(key: string, blob: Blob) {
    if (blob.size > maxBytes || maxEntries === 0) return;
    const previous = cache.get(key);
    if (previous) cacheBytes -= previous.size;
    cache.delete(key);
    cache.set(key, blob);
    cacheBytes += blob.size;
    while (cache.size > maxEntries || cacheBytes > maxBytes) {
      const key = cache.keys().next().value!,
        old = cache.get(key)!;
      cache.delete(key);
      cacheBytes -= old.size;
    }
  }
  function announce() {
    if (disposed) return;
    const states = [...entries.values()];
    scene.setAttribute(
      "aria-busy",
      String(
        frame !== 0 ||
          states.some((e) => e.state === "queued" || e.state === "loading"),
      ),
    );
    if (states.some((e) => e.state === "error"))
      status.textContent = text(
        "error",
        "Some tiles could not load. Use Retry tiles.",
      );
    else if (!frame && states.every((e) => e.state === "ready"))
      status.textContent = text("ready", "Image tiles ready.");
    else status.textContent = text("loading", "Loading image tiles…");
  }
  async function load(entry: Entry) {
    active++;
    entry.state = "loading";
    const tileSignal = entry.abort.signal;
    try {
      let blob = cache.get(entry.tile.key);
      if (blob) {
        cache.delete(entry.tile.key);
        cache.set(entry.tile.key, blob);
      } else {
        const result = await pyramid.tile(
          entry.tile.level,
          entry.tile.column,
          entry.tile.row,
          tileSignal,
        );
        tileSignal.throwIfAborted();
        if (typeof result === "string") {
          safeURL(result, options.allowedOrigins);
          const response = await win.fetch(result, {
            signal: tileSignal,
            credentials: "same-origin",
            mode: "cors",
            redirect: "error",
          });
          if (!response.ok) throw Error("Tile unavailable");
          blob = await response.blob();
        } else blob = result;
        if (
          blob.size > 2 * 1024 * 1024 ||
          !/^image\/(png|jpeg|webp|avif)$/.test(blob.type)
        )
          throw Error("Invalid tile media");
        tileSignal.throwIfAborted();
      }
      tileSignal.throwIfAborted();
      entry.url = win.URL.createObjectURL(blob);
      entry.image.src = entry.url;
      await entry.image.decode();
      tileSignal.throwIfAborted();
      if (
        entry.image.naturalWidth > pyramid.tileSize ||
        entry.image.naturalHeight > pyramid.tileSize
      )
        throw Error("Tile exceeds dimensions");
      remember(entry.tile.key, blob);
      entry.state = "ready";
      entry.image.style.opacity = "1";
    } catch {
      if (!tileSignal.aborted && !disposed) {
        entry.state = "error";
        entry.image.style.opacity = "0";
      }
      if (entry.url && entry.state !== "ready") {
        win.URL.revokeObjectURL(entry.url);
        entry.url = undefined;
      }
    } finally {
      active--;
      if (!disposed) {
        pump();
        announce();
      }
    }
  }
  function pump() {
    if (disposed) return;
    for (const entry of entries.values()) {
      if (active >= concurrency) break;
      if (entry.state === "queued") void load(entry);
    }
  }
  function draw() {
    frame = 0;
    if (disposed || rect.width <= 0 || rect.height <= 0) return;
    const plan = planTiles(
      pyramid,
      rect.width,
      rect.height,
      view,
      Math.min(win.devicePixelRatio || 1, 2),
      maxTiles,
    );
    view = plan.view;
    scene.dataset.zoom = String(view.zoom);
    scene.dataset.level = String(plan.level);
    const keys = new Set(plan.tiles.map((t) => t.key));
    for (const [key, entry] of entries)
      if (!keys.has(key)) {
        release(entry);
        entries.delete(key);
      }
    for (const tile of plan.tiles) {
      let entry = entries.get(tile.key);
      if (!entry) {
        const image = doc.createElement("img");
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        image.draggable = false;
        image.style.opacity = "0";
        entry = { tile, image, abort: new AbortController(), state: "queued" };
        entries.set(tile.key, entry);
        scene.append(image);
      }
      entry.tile = tile;
      entry.image.style.cssText += `;left:${tile.left}px;top:${tile.top}px;width:${tile.width + 0.25}px;height:${tile.height + 0.25}px`;
    }
    pump();
    announce();
  }
  function schedule() {
    if (!disposed && !frame) {
      scene.setAttribute("aria-busy", "true");
      frame = win.requestAnimationFrame(draw);
    }
  }
  function setView(next: Partial<DeepView>) {
    if (disposed) return;
    view = { ...view, ...next };
    schedule();
  }
  function zoom(next: number, fx = 0, fy = 0) {
    const max = Math.max(
      8,
      1 / Math.min(rect.width / pyramid.width, rect.height / pyramid.height),
    );
    const z = focalZoom(view.x, view.y, view.zoom, clamp(next, 1, max), fx, fy);
    setView({ zoom: z.scale, x: z.x, y: z.y });
  }
  const actions = {
    in: () => zoom(view.zoom * 2),
    out: () => zoom(view.zoom / 2),
    fit: () => setView({ zoom: 1, x: 0, y: 0 }),
    actual: () =>
      zoom(
        1 / Math.min(rect.width / pyramid.width, rect.height / pyramid.height),
      ),
    retry: () => {
      for (const entry of entries.values())
        if (entry.state === "error") {
          release(entry);
          entries.delete(entry.tile.key);
        }
      schedule();
    },
  };
  for (const [action, label] of Object.entries({
    in: "Zoom in",
    out: "Zoom out",
    fit: "Fit deep image",
    actual: "Deep image actual pixels",
    retry: "Retry tiles",
  })) {
    const button = doc.createElement("button");
    button.textContent = text(action as keyof typeof actions, label);
    button.addEventListener("click", actions[action as keyof typeof actions], {
      signal,
    });
    toolbar.append(button);
  }
  scene.addEventListener(
    "keydown",
    (e) => {
      if (
        [
          "+",
          "=",
          "-",
          "0",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
        ].includes(e.key)
      )
        e.preventDefault();
      if (e.key === "+" || e.key === "=") zoom(view.zoom * 1.5);
      if (e.key === "-") zoom(view.zoom / 1.5);
      if (e.key === "0") actions.fit();
      const step = e.shiftKey ? 120 : 40;
      if (e.key === "ArrowLeft") setView({ x: view.x + step });
      if (e.key === "ArrowRight") setView({ x: view.x - step });
      if (e.key === "ArrowUp") setView({ y: view.y + step });
      if (e.key === "ArrowDown") setView({ y: view.y - step });
    },
    { signal },
  );
  scene.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoom(
        view.zoom * Math.exp(-e.deltaY * 0.005),
        e.clientX - rect.left - rect.width / 2,
        e.clientY - rect.top - rect.height / 2,
      );
    },
    { signal, passive: false },
  );
  scene.addEventListener(
    "dblclick",
    (e) =>
      zoom(
        view.zoom === 1 ? 2 : 1,
        e.clientX - rect.left - rect.width / 2,
        e.clientY - rect.top - rect.height / 2,
      ),
    { signal },
  );
  scene.addEventListener(
    "pointerdown",
    (e) => {
      rect = scene.getBoundingClientRect();
      scene.setPointerCapture(e.pointerId);
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        const [a, b] = [...points.values()];
        pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      }
    },
    { signal },
  );
  scene.addEventListener(
    "pointermove",
    (e) => {
      const old = points.get(e.pointerId);
      if (!old) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        const [a, b] = [...points.values()],
          distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch > 0)
          zoom(
            (view.zoom * distance) / pinch,
            (a!.x + b!.x) / 2 - rect.left - rect.width / 2,
            (a!.y + b!.y) / 2 - rect.top - rect.height / 2,
          );
        pinch = distance;
      } else
        setView({
          x: view.x + e.clientX - old.x,
          y: view.y + e.clientY - old.y,
        });
    },
    { signal },
  );
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    scene.addEventListener(
      type,
      (e) => {
        points.delete((e as PointerEvent).pointerId);
        pinch = 0;
      },
      { signal },
    );
  const observer = new ResizeObserver(() => {
    rect = scene.getBoundingClientRect();
    schedule();
  });
  observer.observe(scene);
  rect = scene.getBoundingClientRect();
  schedule();
  return {
    setView,
    get view() {
      return { ...view };
    },
    get stats() {
      return {
        mounted: entries.size,
        active,
        cacheEntries: cache.size,
        cacheBytes,
        objectURLs: [...entries.values()].filter((e) => e.url).length,
      };
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      life.abort();
      observer.disconnect();
      win.cancelAnimationFrame(frame);
      for (const entry of entries.values()) release(entry);
      entries.clear();
      cache.clear();
      cacheBytes = 0;
      points.clear();
      section.remove();
    },
  };
}
