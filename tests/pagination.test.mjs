import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../dist/pagination.js";
import { GalleryController } from "../dist/core.js";
test("serial pagination ignores stale results after reset", async () => {
  const c = new GalleryController([]);
  let resolve;
  const pages = paginate(c, () => new Promise((r) => (resolve = r)));
  const old = pages.next();
  assert.equal(pages.next(), old);
  pages.reset();
  resolve({
    items: [
      {
        id: "stale",
        src: "/a",
        alt: "a",
        title: "a",
        category: "a",
        width: 1,
        height: 1,
      },
    ],
    cursor: null,
  });
  await old;
  assert.equal(c.snapshot.items.length, 0);
  pages.destroy();
});
