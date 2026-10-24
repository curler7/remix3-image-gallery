import { safeURL } from "./core.js";
export interface ImageProvider {
  resolve(src: string, signal: AbortSignal): Promise<string>;
}
/** Each cache entry owns its request; cancelling one caller cannot poison another. */
export class MediaCache {
  #cache = new Map<
    string,
    {
      job: Promise<string>;
      abort: AbortController;
      users: number;
      settled: boolean;
    }
  >();
  constructor(
    private limit = 8,
    private provider: ImageProvider = { resolve: async (src) => safeURL(src) },
  ) {
    if (limit < 1) throw Error("Cache limit must be positive");
  }
  async load(src: string, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    let entry = this.#cache.get(src);
    if (!entry) {
      const abort = new AbortController();
      entry = { job: Promise.resolve(""), abort, users: 0, settled: false };
      const current = entry;
      entry.job = Promise.resolve()
        .then(() => this.provider.resolve(safeURL(src), abort.signal))
        .then(
          (url) => {
            safeURL(url);
            current.settled = true;
            return url;
          },
          (error) => {
            current.settled = true;
            if (this.#cache.get(src) === current) this.#cache.delete(src);
            throw error;
          },
        );
      this.#cache.set(src, entry);
      while (this.#cache.size > this.limit) {
        const key = this.#cache.keys().next().value!;
        const oldest = this.#cache.get(key)!;
        if (oldest.users === 0) oldest.abort.abort();
        this.#cache.delete(key);
      }
    }
    entry.users++;
    const current = entry;
    return new Promise<string>((resolve, reject) => {
      let finished = false;
      const cleanup = () => {
        if (finished) return;
        finished = true;
        signal.removeEventListener("abort", cancel);
        current.users--;
        if (!current.users && !current.settled) {
          current.abort.abort();
          if (this.#cache.get(src) === current) this.#cache.delete(src);
        }
      };
      const cancel = () => {
        cleanup();
        reject(signal.reason);
      };
      signal.addEventListener("abort", cancel, { once: true });
      current.job.then(
        (url) => {
          if (!finished) {
            cleanup();
            resolve(url);
          }
        },
        (error) => {
          if (!finished) {
            cleanup();
            reject(error);
          }
        },
      );
    });
  }
  get size() {
    return this.#cache.size;
  }
  clear() {
    for (const entry of this.#cache.values()) entry.abort.abort();
    this.#cache.clear();
  }
}
