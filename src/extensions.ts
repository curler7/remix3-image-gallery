import { safeURL } from "./core.js";
import type { GalleryController } from "./core.js";
/** Autoplay is opt-in and pauses on visibility, reduced motion and interaction. */
export function slideshow(
  controller: GalleryController,
  element: HTMLElement,
  interval = 4000,
) {
  const life = new AbortController(),
    win = element.ownerDocument.defaultView!;
  let timer: ReturnType<typeof setInterval> | undefined;
  const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
  const pause = () => {
    clearInterval(timer);
    timer = undefined;
  };
  const play = () => {
    pause();
    if (
      !win.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !element.ownerDocument.hidden
    )
      timer = setInterval(
        () => controller.navigate(1),
        Math.max(1000, interval),
      );
  };
  element.addEventListener("pointerdown", pause, { signal: life.signal });
  element.addEventListener("keydown", pause, { signal: life.signal });
  element.ownerDocument.addEventListener("visibilitychange", pause, {
    signal: life.signal,
  });
  motion.addEventListener("change", pause, { signal: life.signal });
  return {
    play,
    pause,
    destroy() {
      pause();
      life.abort();
    },
  };
}
export function compareImages(root: HTMLElement, left: string, right: string) {
  const doc = root.ownerDocument;
  const box = doc.createElement("div");
  box.className = "comparison";
  for (const [src, alt] of [
    [left, "First comparison image"],
    [right, "Second comparison image"],
  ]) {
    const img = doc.createElement("img");
    img.src = safeURL(src!);
    img.alt = alt!;
    box.append(img);
  }
  root.append(box);
  return () => box.remove();
}

export interface CompareOptions {
  beforeAfter?: boolean;
  labels?: [string, string];
  uiLabels?: Partial<
    Record<"region" | "pan" | "in" | "out" | "reset" | "split", string>
  >;
}
/** Independently loaded synchronized comparison with keyboard-equivalent zoom controls. */
export function synchronizedCompare(
  root: HTMLElement,
  left: string,
  right: string,
  options: CompareOptions = {},
) {
  const doc = root.ownerDocument,
    life = new AbortController();
  const container = doc.createElement("section");
  container.className = "compare-view";
  container.setAttribute(
    "aria-label",
    options.uiLabels?.region ?? "Image comparison",
  );
  const pictures = doc.createElement("div");
  pictures.className = "compare-pictures";
  pictures.tabIndex = 0;
  pictures.setAttribute(
    "aria-label",
    options.uiLabels?.pan ??
      "Comparison pan area. Use arrow keys to pan when zoomed.",
  );
  const images = [left, right].map((src, index) => {
    const img = doc.createElement("img");
    img.src = safeURL(src);
    img.alt = options.labels?.[index] ?? `Comparison ${index + 1}`;
    img.draggable = false;
    pictures.append(img);
    return img;
  });
  let scale = 1,
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    last: { x: number; y: number } | undefined;
  const update = () => {
    const limitX = (width * (scale - 1)) / (options.beforeAfter ? 2 : 4),
      limitY = (height * (scale - 1)) / 2;
    x = Math.max(-limitX, Math.min(limitX, x));
    y = Math.max(-limitY, Math.min(limitY, y));
    for (const img of images)
      img.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
  };
  for (const [label, delta] of [
    [options.uiLabels?.in ?? "Zoom in", 0.25],
    [options.uiLabels?.out ?? "Zoom out", -0.25],
    [options.uiLabels?.reset ?? "Reset comparison", 0],
  ] as const) {
    const button = doc.createElement("button");
    button.textContent = label;
    button.addEventListener(
      "click",
      () => {
        scale = delta ? Math.max(1, Math.min(8, scale + delta)) : 1;
        if (scale === 1) {
          x = 0;
          y = 0;
        }
        update();
      },
      { signal: life.signal },
    );
    container.append(button);
  }
  pictures.addEventListener(
    "keydown",
    (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        if (scale > 1) {
          if (e.key === "ArrowLeft") x += 20;
          if (e.key === "ArrowRight") x -= 20;
          if (e.key === "ArrowUp") y += 20;
          if (e.key === "ArrowDown") y -= 20;
          update();
        }
      }
    },
    { signal: life.signal },
  );
  pictures.addEventListener(
    "pointerdown",
    (e) => {
      if (
        (e.target as Element).closest(
          "button,input,select,textarea,a[href],[contenteditable]",
        )
      )
        return;
      pictures.setPointerCapture(e.pointerId);
      last = { x: e.clientX, y: e.clientY };
    },
    { signal: life.signal },
  );
  pictures.addEventListener(
    "pointermove",
    (e) => {
      if (!last || scale === 1) return;
      x = Math.max(
        -300 * (scale - 1),
        Math.min(300 * (scale - 1), x + e.clientX - last.x),
      );
      y = Math.max(
        -300 * (scale - 1),
        Math.min(300 * (scale - 1), y + e.clientY - last.y),
      );
      last = { x: e.clientX, y: e.clientY };
      update();
    },
    { signal: life.signal },
  );
  for (const event of ["pointerup", "pointercancel"])
    pictures.addEventListener(
      event,
      () => {
        last = undefined;
      },
      { signal: life.signal },
    );
  container.append(pictures);
  if (options.beforeAfter) {
    pictures.classList.add("before-after");
    const range = doc.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.value = "50";
    range.setAttribute(
      "aria-label",
      options.uiLabels?.split ?? "Before and after split",
    );
    const split = () =>
      (images[1]!.style.clipPath = `inset(0 0 0 ${range.value}%)`);
    range.addEventListener("input", split, { signal: life.signal });
    container.append(range);
    split();
  }
  root.append(container);
  const measure = () => {
    width = pictures.clientWidth;
    height = pictures.clientHeight;
    update();
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(pictures);
  return () => {
    observer.disconnect();
    life.abort();
    container.remove();
  };
}
export interface Hotspot {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
}
export function annotations(
  root: HTMLElement,
  spots: readonly Hotspot[],
  activate: (spot: Hotspot) => void,
) {
  const life = new AbortController(),
    buttons: HTMLButtonElement[] = [];
  for (const spot of spots) {
    if (!Number.isFinite(spot.x) || !Number.isFinite(spot.y)) continue;
    const button = root.ownerDocument.createElement("button");
    button.className = "hotspot";
    button.textContent = spot.label;
    button.title = spot.description;
    button.style.left = `${Math.max(0, Math.min(100, spot.x))}%`;
    button.style.top = `${Math.max(0, Math.min(100, spot.y))}%`;
    button.addEventListener("click", () => activate(spot), {
      signal: life.signal,
    });
    root.append(button);
    buttons.push(button);
  }
  return () => {
    life.abort();
    buttons.forEach((b) => b.remove());
  };
}
