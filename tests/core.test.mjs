import { test } from "node:test";
import assert from "node:assert/strict";
import { GalleryController, safeURL } from "../dist/core.js";
import {
  bounds,
  focalZoom,
  windowRange,
  decay,
  justified,
} from "../dist/geometry.js";
const item = (id) => ({
  id,
  src: "/a.jpg",
  alt: "A",
  title: "A",
  category: "Land",
  width: 4,
  height: 3,
});
test("stable identity, updates, selection and RTL", () => {
  const c = new GalleryController(["a", "b", "c"].map(item));
  let calls = 0;
  const off = c.subscribe(() => calls++);
  c.open("a");
  c.navigate(1, true);
  assert.equal(c.snapshot.active, "c");
  c.select("c");
  c.remove("c");
  assert.equal(c.snapshot.active, null);
  assert.deepEqual(c.snapshot.selected, []);
  c.reorder(["b", "a"]);
  assert.equal(c.snapshot.items[0].id, "b");
  assert.throws(() => c.append([item("a")]));
  off();
  c.open("b");
  assert.equal(calls, 5);
  c.destroy();
});
test("URL boundary and immutable data", () => {
  assert.throws(() => safeURL("javascript:alert(1)"));
  assert.throws(() =>
    safeURL("https://private.test/a", ["https://allowed.test"]),
  );
  assert.equal(safeURL("/a"), "/a");
  assert.throws(() => new GalleryController([item("a"), item("a")]));
});
test("geometry focal invariance and bounds", () => {
  assert.deepEqual(focalZoom(0, 0, 1, 2, 10, 20), { x: -10, y: -20, scale: 2 });
  assert.deepEqual(bounds(500, -500, 100, 100, 2), { x: 50, y: -50 });
  assert.equal(decay(10, 0), 10);
  assert.ok(decay(10, 1000) < 1);
  assert.equal(justified([1, 1, 1], 300, 100, 0)[0].height, 100);
});
test("10k window remains bounded and includes viewport", () => {
  const r = windowRange(10000, 30000, 900, 240, 4);
  assert.ok(r.end - r.start < 40);
  assert.equal(r.total, 600000);
  assert.deepEqual(windowRange(0, 0, 900, 240, 4), {
    start: 0,
    end: 0,
    total: 0,
  });
});
test("arbitrary negative navigation, controlled selection, query, grouping and lifetime", () => {
  const c = new GalleryController([
    item("a"),
    { ...item("b"), category: "Other", tags: ["test"] },
  ]);
  c.open("a");
  c.navigate(-101);
  assert.equal(c.snapshot.active, "b");
  c.setSelection(["b", "missing"]);
  assert.deepEqual(c.snapshot.selected, ["b"]);
  assert.deepEqual(
    c.query((i) => i.category === "Other").map((i) => i.id),
    ["b"],
  );
  assert.equal(c.groups().size, 2);
  assert.throws(() => c.navigate(0.5));
  assert.throws(
    () => new GalleryController([{ ...item("bad"), width: Infinity }]),
  );
  c.destroy();
  assert.throws(() => c.open("a"));
  assert.throws(() => c.append([item("c")]));
});
test("empty data navigation and invalid reorders are safe", () => {
  const c = new GalleryController([]);
  c.navigate(-1);
  assert.equal(c.snapshot.active, null);
  assert.throws(() => c.reorder(["x"]));
  c.append([item("a"), item("b")]);
  assert.throws(() => c.reorder(["a", "a"]));
  assert.throws(() => c.reorder(["a", "x"]));
  assert.deepEqual(
    c.snapshot.items.map((i) => i.id),
    ["a", "b"],
  );
});
test("layout rows cover each image once with positive dimensions", () => {
  for (const width of [320, 768, 1440]) {
    const rows = justified([0.5, 2, 1, 1.5, 0.8, 3], width);
    assert.equal(rows[0].start, 0);
    assert.equal(rows.at(-1).end, 6);
    for (let i = 0; i < rows.length; i++) {
      assert.ok(rows[i].height > 0);
      if (i) assert.equal(rows[i].start, rows[i - 1].end);
    }
  }
});
test("responsive sources reject unsafe protocols and estimates preserve identity", async () => {
  const { safeSrcset, estimateImage } = await import("../dist/core.js");
  assert.equal(
    safeSrcset("/a.jpg 400w, /b.jpg 800w"),
    "/a.jpg 400w, /b.jpg 800w",
  );
  assert.throws(() => safeSrcset("data:image/svg+xml,hello"));
  assert.throws(() => safeSrcset("/a.jpg bogus"));
  assert.throws(() => safeURL("http://["));
  assert.equal(
    estimateImage({
      id: "estimate",
      src: "/a.jpg",
      alt: "a",
      title: "a",
      category: "a",
    }).width,
    1200,
  );
});
test("responsive layout options resolve container breakpoints and reject invalid geometry", async () => {
  const { resolveLayout } = await import("../dist/layouts.js");
  assert.equal(
    resolveLayout(
      {
        columns: 1,
        breakpoints: { 600: { columns: 2 }, 1000: { columns: 4, gap: 24 } },
      },
      800,
    ).columns,
    2,
  );
  assert.equal(
    resolveLayout({ columns: 1, breakpoints: { 1000: { columns: 4 } } }, 1200)
      .columns,
    4,
  );
  assert.throws(() => resolveLayout({ columns: 0 }, 800));
  assert.throws(() => resolveLayout({ gap: -1 }, 800));
  assert.throws(() => resolveLayout({ aspectRatio: Infinity }, 800));
});
test("origin restrictions reject dynamic changes atomically", () => {
  const c = new GalleryController([item("a")], {
    allowedOrigins: ["https://allowed.test"],
  });
  let emitted = 0;
  c.subscribe(() => emitted++);
  assert.throws(() => c.update("a", { src: "https://blocked.test/private" }));
  assert.throws(() =>
    c.append([
      { ...item("b"), sources: [{ srcset: "https://blocked.test/b 400w" }] },
    ]),
  );
  assert.equal(c.snapshot.items.length, 1);
  assert.equal(c.snapshot.items[0].src, "/a.jpg");
  assert.equal(emitted, 0);
  c.update("a", { src: "https://allowed.test/a" });
  assert.equal(emitted, 1);
});
