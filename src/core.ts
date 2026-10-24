export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  category: string;
  srcset?: string;
  sizes?: string;
  color?: string;
  preview?: string;
  tags?: readonly string[];
  sources?: readonly { srcset: string; media?: string; type?: string }[];
}
export interface Snapshot {
  readonly items: readonly GalleryImage[];
  readonly active: string | null;
  readonly selected: readonly string[];
}
export function safeURL(value: string, origins?: readonly string[]): string {
  let u: URL;
  try {
    u = new URL(value, "https://gallery.invalid");
  } catch {
    throw Error("Unsupported image URL");
  }
  if (
    !["https:", "http:"].includes(u.protocol) ||
    (origins &&
      u.origin !== "https://gallery.invalid" &&
      !origins.includes(u.origin))
  )
    throw Error("Unsupported image URL");
  return value;
}
export class GalleryController {
  #items: GalleryImage[];
  #active: string | null = null;
  #selected = new Set<string>();
  #listeners = new Set<(state: Snapshot) => void>();
  #dead = false;
  constructor(
    items: readonly GalleryImage[],
    private options: { allowedOrigins?: readonly string[] } = {},
  ) {
    this.#items = this.validate(items);
  }
  private assertAlive() {
    if (this.#dead) throw Error("Destroyed gallery");
  }
  private validate(items: readonly GalleryImage[]) {
    this.assertAlive();
    const ids = new Set<string>();
    return items.map((i) => {
      if (!i.id || ids.has(i.id)) throw Error("Duplicate or empty image ID");
      ids.add(i.id);
      safeURL(i.src, this.options.allowedOrigins);
      if (i.preview) safeURL(i.preview, this.options.allowedOrigins);
      if (i.srcset) safeSrcset(i.srcset, this.options.allowedOrigins);
      for (const source of i.sources ?? [])
        safeSrcset(source.srcset, this.options.allowedOrigins);
      if (!(
        Number.isFinite(i.width) &&
        Number.isFinite(i.height) &&
        i.width > 0 &&
        i.height > 0
      ))
        throw Error("Invalid dimensions");
      return Object.freeze({
        ...i,
        tags: i.tags ? Object.freeze([...i.tags]) : undefined,
        sources: i.sources
          ? Object.freeze(
              i.sources.map((source) => Object.freeze({ ...source })),
            )
          : undefined,
      });
    });
  }
  get snapshot(): Snapshot {
    return Object.freeze({
      items: Object.freeze([...this.#items]),
      active: this.#active,
      selected: Object.freeze([...this.#selected]),
    });
  }
  subscribe(fn: (state: Snapshot) => void) {
    this.assertAlive();
    this.#listeners.add(fn);
    return () => {
      this.#listeners.delete(fn);
    };
  }
  private emit() {
    if (this.#dead) throw Error("Destroyed gallery");
    for (const fn of this.#listeners) fn(this.snapshot);
  }
  open(id: string | null) {
    this.assertAlive();
    if (id !== null && !this.#items.some((i) => i.id === id)) return;
    this.#active = id;
    this.emit();
  }
  navigate(delta: number, rtl = false) {
    this.assertAlive();
    if (!Number.isInteger(delta))
      throw Error("Navigation requires integer steps");
    const i = this.#items.findIndex((i) => i.id === this.#active);
    if (!this.#items.length) return;
    this.open(
      this.#items[
        (((Math.max(0, i) + delta * (rtl ? -1 : 1)) % this.#items.length) +
          this.#items.length) %
          this.#items.length
      ]!.id,
    );
  }
  select(id: string) {
    this.assertAlive();
    if (!this.#items.some((i) => i.id === id)) return;
    this.#selected.has(id) ? this.#selected.delete(id) : this.#selected.add(id);
    this.emit();
  }
  replace(items: readonly GalleryImage[]) {
    this.#items = this.validate(items);
    if (!this.#items.some((i) => i.id === this.#active)) this.#active = null;
    this.#selected = new Set(
      [...this.#selected].filter((id) => this.#items.some((i) => i.id === id)),
    );
    this.emit();
  }
  append(items: readonly GalleryImage[]) {
    this.replace([...this.#items, ...items]);
  }
  update(id: string, patch: Partial<GalleryImage>) {
    this.replace(
      this.#items.map((i) => (i.id === id ? { ...i, ...patch, id } : i)),
    );
  }
  remove(id: string) {
    this.replace(this.#items.filter((i) => i.id !== id));
  }
  reorder(ids: readonly string[]) {
    if (ids.length !== this.#items.length || new Set(ids).size !== ids.length)
      throw Error("Invalid order");
    const map = new Map(this.#items.map((i) => [i.id, i]));
    this.replace(
      ids.map((id) => {
        const item = map.get(id);
        if (!item) throw Error("Unknown ID");
        return item;
      }),
    );
  }
  setSelection(ids: readonly string[]) {
    this.assertAlive();
    const known = new Set(this.#items.map((i) => i.id));
    this.#selected = new Set(ids.filter((id) => known.has(id)));
    this.emit();
  }
  query(
    filter: (item: GalleryImage) => boolean = () => true,
    sort?: (a: GalleryImage, b: GalleryImage) => number,
  ) {
    const items = this.#items.filter(filter);
    return sort ? items.sort(sort) : items;
  }
  groups() {
    const groups = new Map<string, GalleryImage[]>();
    for (const i of this.#items) {
      const group = groups.get(i.category) ?? [];
      group.push(i);
      groups.set(i.category, group);
    }
    return groups;
  }
  destroy() {
    this.#listeners.clear();
    this.#dead = true;
  }
}

/** HTTP(S)/relative srcset candidates only; data URLs and malformed descriptors are rejected. */
export function safeSrcset(value: string, origins?: readonly string[]) {
  for (const candidate of value.split(",")) {
    const parts = candidate.trim().split(/\s+/);
    if (!parts[0] || parts.length > 2) throw Error("Invalid srcset");
    safeURL(parts[0], origins);
    if (parts[1] && !/^(?:[1-9]\d*w|(?:\d*\.)?\d+x)$/.test(parts[1]))
      throw Error("Invalid srcset descriptor");
  }
  return value;
}
/** Supply estimated dimensions when metadata has not arrived yet. */
export function estimateImage(
  input: Omit<GalleryImage, "width" | "height"> &
    Partial<Pick<GalleryImage, "width" | "height">>,
): GalleryImage {
  return { ...input, width: input.width ?? 1200, height: input.height ?? 900 };
}
