import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "remix/component";
import { renderToString } from "remix/component/server";
import { Gallery } from "../dist/remix3.js";
test("Remix server render escapes text, keeps real links and intrinsic dimensions", async () => {
  const html = await renderToString(
    h(Gallery, {
      items: [
        {
          id: "a/b",
          src: "/image.jpg",
          alt: "<script>alert(1)</script>",
          title: "<img onerror=alert(1)>",
          category: "Travel",
          width: 1200,
          height: 900,
        },
      ],
    }),
  );
  assert.match(html, /href="\/image\/a%2Fb"/);
  assert.match(html, /width="1200"/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img onerror/);
});
test("SSR never selects a full-resolution gigapixel asset as a thumbnail", async () => {
  const html = await renderToString(
    h(Gallery, {
      items: [
        {
          id: "giant",
          src: "/must-not-load.jpg",
          srcset: "/must-not-load.jpg 100000w",
          alt: "Giant atlas",
          title: "Atlas",
          category: "Maps",
          width: 100000,
          height: 80000,
        },
      ],
    }),
  );
  assert.doesNotMatch(html, /must-not-load/);
  assert.match(html, /Giant atlas/);
});
test("SSR enforces origin and custom decode budgets before emitting image requests", async () => {
  const item = {
    id: "a",
    src: "/a.jpg",
    alt: "A",
    title: "A",
    category: "A",
    width: 2000,
    height: 1000,
    preview: "/preview.jpg",
  };
  const html = await renderToString(
    h(Gallery, { items: [item], options: { maxDecodedPixels: 1000000 } }),
  );
  assert.match(html, /preview.jpg/);
  assert.doesNotMatch(html, /src="\/a.jpg"/);
  for (const patch of [
    { src: "https://blocked.test/a.jpg" },
    { preview: "https://blocked.test/a.jpg" },
    { srcset: "https://blocked.test/a.jpg 2000w" },
    { sources: [{ srcset: "https://blocked.test/a.jpg 2000w" }] },
  ])
    await assert.rejects(
      async () =>
        renderToString(
          h(Gallery, {
            items: [{ ...item, ...patch }],
            options: { allowedOrigins: ["https://allowed.test"] },
          }),
        ),
      /Unsupported image URL/,
    );
});
