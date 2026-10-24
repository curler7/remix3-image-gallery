import type { GalleryImage, GalleryController } from "./core.js";
export interface Page {
  items: readonly GalleryImage[];
  cursor: string | null;
}
export type PageLoader = (
  cursor: string | null,
  signal: AbortSignal,
) => Promise<Page>;
/** Serial pagination with cancellation and generation guards. */
export function paginate(controller: GalleryController, loader: PageLoader) {
  let cursor: string | null = null,
    done = false,
    generation = 0,
    request: AbortController | undefined,
    pending: Promise<void> | undefined;
  return {
    next() {
      if (pending) return pending;
      if (done) return Promise.resolve();
      const mine = ++generation;
      request = new AbortController();
      const signal = request.signal;
      pending = loader(cursor, signal)
        .then((page) => {
          if (signal.aborted || mine !== generation) return;
          controller.append(page.items);
          cursor = page.cursor;
          done = cursor === null;
        })
        .finally(() => {
          if (mine === generation) pending = undefined;
        });
      return pending;
    },
    reset() {
      generation++;
      request?.abort();
      pending = undefined;
      cursor = null;
      done = false;
    },
    destroy() {
      generation++;
      request?.abort();
      pending = undefined;
      done = true;
    },
  };
}
