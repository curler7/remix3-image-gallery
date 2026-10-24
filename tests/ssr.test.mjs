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
