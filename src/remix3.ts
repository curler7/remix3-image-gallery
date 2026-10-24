import { createElement as h, ref, type Handle } from "remix/component";
import type { GalleryImage } from "./core.js";
import { safeURL, safeSrcset } from "./core.js";
import type { mountGallery, DOMOptions } from "./dom.js";
type View = ReturnType<typeof mountGallery>;
interface Props {
  items: readonly GalleryImage[];
  enhance?: boolean;
  options?: DOMOptions;
  ready?: (view: View) => void;
}
export function Gallery(handle: Handle<Props>) {
  const { items, enhance, ready, options } = handle.props;
  const maxPixels = options?.maxDecodedPixels ?? 40_000_000;
  if (!Number.isFinite(maxPixels) || maxPixels < 1)
    throw Error("Invalid image decode budget");
  const url = (value: string) => safeURL(value, options?.allowedOrigins);
  const srcset = (value: string) => safeSrcset(value, options?.allowedOrigins);
  for (const item of items) {
    url(item.src);
    if (item.preview) url(item.preview);
    if (item.srcset) srcset(item.srcset);
    for (const source of item.sources ?? []) srcset(source.srcset);
  }
  return () =>
    h(
      "div",
      {
        "data-gallery": "",
        class: "gallery",
        mix: enhance ? galleryRef(items, ready, options) : undefined,
      },
      ...items.map((i, index) =>
        h(
          "a",
          {
            href: `/image/${encodeURIComponent(i.id)}`,
            "data-id": i.id,
            class: "tile",
            style: `--ratio:${i.width / i.height};--color:${/^#[a-f0-9]{3,8}$/i.test(i.color ?? "") ? i.color : "#dde2df"}`,
          },
          h(
            "figure",
            {},
            h(
              "picture",
              {},
              ...(i.width * i.height > maxPixels ? [] : (i.sources ?? [])).map(
                (source) =>
                  h("source", {
                    srcset: srcset(source.srcset),
                    media: source.media,
                    type: source.type,
                  }),
              ),
              h("img", {
                src:
                  i.width * i.height > maxPixels
                    ? i.preview
                      ? url(i.preview)
                      : undefined
                    : url(i.src),
                alt: i.alt,
                width: i.width,
                height: i.height,
                loading: index < 3 ? "eager" : "lazy",
                decoding: "async",
                fetchpriority: index === 0 ? "high" : "auto",
                srcset:
                  i.srcset && i.width * i.height <= maxPixels
                    ? srcset(i.srcset)
                    : undefined,
                sizes: i.sizes ?? "(max-width: 600px) 100vw, 33vw",
              }),
            ),
            h(
              "figcaption",
              {},
              h("span", {}, i.title),
              h("small", {}, i.category),
            ),
          ),
        ),
      ),
    );
}
/** Apply only to an island whose descendants Remix does not reconcile. */
export function galleryRef(
  items: readonly GalleryImage[],
  ready?: (view: View) => void,
  options: DOMOptions = {},
) {
  return ref(async (element, signal) => {
    const { mountGallery } = await import("./dom.js");
    if (signal.aborted) return;
    const view = mountGallery(element as HTMLElement, items, {
      history: true,
      ...options,
    });
    ready?.(view);
    signal.addEventListener("abort", view.destroy, { once: true });
  });
}
