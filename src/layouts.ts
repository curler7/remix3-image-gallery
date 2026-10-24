import type { GalleryImage } from "./core.js";
import { justified } from "./geometry.js";
export type Layout =
  | "masonry"
  | "grid"
  | "rows"
  | "columns"
  | "collage"
  | "hero"
  | "justified"
  | "filmstrip";
export interface LayoutOptions {
  gap?: number;
  columns?: number;
  rowHeight?: number;
  aspectRatio?: number;
  align?: "start" | "center" | "end" | "stretch";
  spans?: Readonly<Record<string, { columns?: number; rows?: number }>>;
  breakpoints?: Readonly<Record<number, Omit<LayoutOptions, "breakpoints">>>;
}
export function resolveLayout(options: LayoutOptions, width: number) {
  let resolved = { ...options };
  for (const [min, patch] of Object.entries(options.breakpoints ?? {}).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  ))
    if (width >= Number(min)) resolved = { ...resolved, ...patch };
  if (
    (resolved.gap !== undefined &&
      (!Number.isFinite(resolved.gap) || resolved.gap < 0)) ||
    (resolved.columns !== undefined &&
      (!Number.isInteger(resolved.columns) ||
        resolved.columns < 1 ||
        resolved.columns > 48)) ||
    (resolved.rowHeight !== undefined &&
      (!(resolved.rowHeight > 0) || !Number.isFinite(resolved.rowHeight))) ||
    (resolved.aspectRatio !== undefined &&
      (!(resolved.aspectRatio > 0) || !Number.isFinite(resolved.aspectRatio)))
  )
    throw Error("Invalid layout configuration");
  return resolved;
}
/** Batched measurement followed by writes. The caller may FLIP surrounding changes. */
export function applyLayout(
  root: HTMLElement,
  items: readonly GalleryImage[],
  layout: Layout,
  options: LayoutOptions = {},
) {
  const width = root.clientWidth;
  options = resolveLayout(options, width);
  const gap = options.gap ?? 20,
    columns = options.columns ?? Math.max(1, Math.floor(width / 280));
  for (const img of root.querySelectorAll<HTMLElement>("img")) {
    img.style.height = "";
    img.style.aspectRatio = options.aspectRatio
      ? String(options.aspectRatio)
      : "";
  }
  root.dataset.layout = layout;
  root.style.cssText = "";
  for (const el of root.children) (el as HTMLElement).style.cssText = "";
  root.style.gap = `${gap}px`;
  root.style.containerType = "inline-size";
  root.style.alignItems = options.align ?? "start";
  root.style.justifyContent = options.align ?? "start";
  root.classList.toggle("grid", layout === "grid");
  if (layout === "masonry" || layout === "columns") {
    root.style.columns = String(columns);
    root.style.columnGap = `${gap}px`;
    return;
  }
  if (layout === "filmstrip") {
    root.style.display = "flex";
    root.style.overflowX = "auto";
    for (const el of root.children) {
      const tile = el as HTMLElement;
      tile.style.flex = "0 0 280px";
      tile.style.scrollSnapAlign = "start";
    }
    root.style.scrollSnapType = "x mandatory";
    return;
  }
  root.style.display = "grid";
  root.style.gridTemplateColumns = `repeat(${columns},minmax(0,1fr))`;
  for (const el of root.children) {
    const tile = el as HTMLElement,
      span = options.spans?.[tile.dataset.id ?? ""];
    if (span) {
      if (span.columns)
        tile.style.gridColumn = `span ${Math.max(1, Math.min(columns, Math.floor(span.columns)))}`;
      if (span.rows)
        tile.style.gridRow = `span ${Math.max(1, Math.min(12, Math.floor(span.rows)))}`;
    }
  }
  if (layout === "rows") {
    root.style.gridAutoRows = `${options.rowHeight ?? 240}px`;
    for (const el of root.querySelectorAll<HTMLElement>("img"))
      el.style.height = "190px";
  }
  if (layout === "hero" || layout === "collage") {
    const first = root.firstElementChild as HTMLElement | null;
    if (first && columns > 1) {
      first.style.gridColumn = "span 2";
      if (layout === "collage") first.style.gridRow = "span 2";
    }
  }
  if (layout === "justified") {
    root.style.display = "flex";
    root.style.flexWrap = "wrap";
    const rows = justified(
      items.map((i) => i.width / i.height),
      width,
      options.rowHeight ?? 220,
      gap,
    );
    for (const row of rows)
      for (let i = row.start; i < row.end; i++) {
        const tile = root.children[i] as HTMLElement | undefined;
        if (tile)
          tile.style.width = `${(row.height * items[i]!.width) / items[i]!.height}px`;
      }
  }
}

export function mountResponsiveLayout(
  root: HTMLElement,
  items: readonly GalleryImage[],
  layout: Layout,
  options: LayoutOptions = {},
) {
  const observer = new ResizeObserver(() =>
    applyLayout(root, items, layout, options),
  );
  observer.observe(root);
  applyLayout(root, items, layout, options);
  return () => observer.disconnect();
}
