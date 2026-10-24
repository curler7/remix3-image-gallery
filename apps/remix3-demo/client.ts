import { createRoot, createElement as h } from "remix/component";
import { Gallery } from "../../src/remix3.js";
import { mountGallery, mountWindow } from "../../src/dom.js";
import type { GalleryImage } from "../../src/core.js";
const items: GalleryImage[] = JSON.parse(
  document.querySelector("#gallery-data")!.textContent!,
);
const root = document.querySelector<HTMLElement>("[data-gallery]")!;
const runtime = createRoot(
  document.querySelector<HTMLElement>("#gallery-island")!,
);
const view = await new Promise<ReturnType<typeof mountGallery>>((ready) => {
  runtime.render(
    h(Gallery, { items, enhance: true, ready, options: { reorderable: true } }),
  );
});
const detail = location.pathname.match(/^\/image\/(\d+)$/)?.[1];
if (detail) view.open(detail, false);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-layout]",
))
  button.addEventListener("click", () => {
    const old = new Map(
      [...root.children].map((el) => [el, el.getBoundingClientRect()]),
    );
    root.classList.toggle("grid", button.dataset.layout === "grid");
    document
      .querySelectorAll("[data-layout]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    if (!reduced)
      for (const [el, from] of old) {
        const to = el.getBoundingClientRect();
        el.animate(
          [
            {
              transform: `translate(${from.left - to.left}px,${from.top - to.top}px)`,
            },
            { transform: "translate(0,0)" },
          ],
          { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" },
        );
      }
  });
let stopWindow: (() => void) | undefined;
let largeView: ReturnType<typeof mountGallery> | undefined;
document.querySelector("#large")!.addEventListener("click", () => {
  const area = document.querySelector<HTMLElement>("#large-gallery")!;
  area.hidden = !area.hidden;
  stopWindow?.();
  largeView?.destroy();
  largeView = undefined;
  if (!area.hidden) {
    const many = Array.from({ length: 10000 }, (_, i) => ({
      ...items[i % items.length]!,
      id: `large-${i}`,
    }));
    stopWindow = mountWindow(area, many, (item) => {
      const link = document.createElement("a");
      link.dataset.id = item.id;
      link.href = item.src;
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt;
      img.loading = "lazy";
      link.append(img);
      return link;
    });
    largeView = mountGallery(area, many);
    area.focus();
  }
});
window.addEventListener(
  "pagehide",
  () => {
    runtime.dispose();
    stopWindow?.();
    largeView?.destroy();
    largeView = undefined;
  },
  { once: true },
);

const allItems: GalleryImage[] = JSON.parse(
  document.querySelector("#all-gallery-data")!.textContent!,
);
let category = location.pathname.match(/^\/category\/(\w+)$/)?.[1] ?? "all";
const sort = document.querySelector<HTMLSelectElement>("#sort")!;
function filterView() {
  let next = allItems.filter(
    (item) => category === "all" || item.category.toLowerCase() === category,
  );
  if (sort.value === "title")
    next.sort((a, b) => a.title.localeCompare(b.title));
  if (sort.value === "reverse") next.reverse();
  view.controller.replace(next);
  document.querySelector("#count")!.textContent =
    `${new Intl.NumberFormat(document.documentElement.lang).format(next.length)} perspectives`;
  document
    .querySelectorAll<HTMLElement>("[data-filter]")
    .forEach((a) =>
      a.classList.toggle(
        "active",
        a.dataset.filter!.toLowerCase() === category,
      ),
    );
}
for (const link of document.querySelectorAll<HTMLAnchorElement>(
  "[data-filter]",
))
  link.addEventListener("click", (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    category = link.dataset.filter!.toLowerCase();
    history.pushState({}, "", link.href);
    filterView();
  });
sort.addEventListener("change", filterView);
window.addEventListener("popstate", () => {
  if (location.pathname.startsWith("/image/")) return;
  category = location.pathname.match(/^\/category\/(\w+)$/)?.[1] ?? "all";
  filterView();
});

let stopDeep: (() => void) | undefined,
  deepGeneration = 0;
document.querySelector("#deep")!.addEventListener("click", async () => {
  const generation = ++deepGeneration,
    root = document.querySelector<HTMLElement>("#deep-demo")!;
  stopDeep?.();
  stopDeep = undefined;
  root.hidden = !root.hidden;
  if (root.hidden) return;
  const { mountDeepZoom } = await import("../../src/deep-zoom.js");
  if (generation !== deepGeneration || root.hidden) return;
  const mounted = mountDeepZoom(
    root,
    {
      width: 65536,
      height: 49152,
      tileSize: 256,
      alt: "A deep atlas of rivers and terrain",
      tile: async (level, column, row, signal) => {
        signal.throwIfAborted();
        const factor = 2 ** (16 - level),
          canvas = document.createElement("canvas");
        canvas.width = Math.min(256, Math.ceil(65536 / factor) - column * 256);
        canvas.height = Math.min(256, Math.ceil(49152 / factor) - row * 256);
        const ctx = canvas.getContext("2d")!,
          pixels = ctx.createImageData(canvas.width, canvas.height);
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++) {
            const wx = (column * 256 + x) * factor,
              wy = (row * 256 + y) * factor,
              height =
                Math.sin(wx / 4300) +
                Math.cos(wy / 3900) +
                0.3 * Math.sin((wx + wy) / 550),
              river = Math.abs(wy - 24576 - 9000 * Math.sin(wx / 15000));
            const index = (y * canvas.width + x) * 4;
            const water = river < 800;
            pixels.data[index] = water ? 80 : 145 + height * 20;
            pixels.data[index + 1] = water ? 130 : 160 + height * 18;
            pixels.data[index + 2] = water ? 150 : 115 + height * 16;
            pixels.data[index + 3] = 255;
          }
        ctx.putImageData(pixels, 0, 0);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) =>
              blob ? resolve(blob) : reject(Error("Tile unavailable")),
            "image/png",
          ),
        );
        signal.throwIfAborted();
        return blob;
      },
    },
    { maxTiles: 48, concurrency: 4 },
  );
  stopDeep = mounted.destroy;
  root.dataset.ready = "true";
  root.querySelector<HTMLElement>(".deep-scene")!.focus();
});
let stopExtensions: (() => void) | undefined,
  extensionGeneration = 0;
document.querySelector("#extensions")!.addEventListener("click", async () => {
  const generation = ++extensionGeneration;
  const root = document.querySelector<HTMLElement>("#extension-demo")!;
  stopExtensions?.();
  stopExtensions = undefined;
  root.hidden = !root.hidden;
  if (root.hidden) return;
  const { synchronizedCompare, annotations, slideshow } =
    await import("../../src/extensions.js");
  if (generation !== extensionGeneration || root.hidden) return;
  const stopCompare = synchronizedCompare(
    root,
    allItems[0]!.src,
    allItems[1]!.src,
    { beforeAfter: true, labels: [allItems[0]!.alt, allItems[1]!.alt] },
  );
  const note = document.createElement("p");
  note.setAttribute("role", "status");
  root.append(note);
  const stopNotes = annotations(
    root.querySelector<HTMLElement>(".compare-pictures")!,
    [
      {
        id: "detail",
        x: 45,
        y: 45,
        label: "Explore detail",
        description: "Look closely at the interplay of shapes and color.",
      },
    ],
    (spot) => (note.textContent = spot.description),
  );
  const play = document.createElement("button");
  play.textContent = "Start slideshow";
  root.append(play);
  const show = slideshow(view.controller, document.body);
  play.addEventListener("click", () => {
    view.open(allItems[0]!.id);
    show.play();
  });
  stopExtensions = () => {
    stopCompare();
    stopNotes();
    show.destroy();
    play.remove();
    note.remove();
  };
});
window.addEventListener(
  "pagehide",
  () => {
    deepGeneration++;
    extensionGeneration++;
    stopDeep?.();
    stopExtensions?.();
  },
  { once: true },
);
