import { test } from "node:test";
import assert from "node:assert/strict";
import { planTiles, validatePyramid } from "../dist/deep-zoom.js";
test("gigapixel planner is bounded at fit, zoom and edges without full image requests", () => {
  const p = { width: 100000, height: 80000, tileSize: 256 };
  for (const zoom of [1, 4, 32, 1000])
    for (const x of [-1e9, 0, 1e9]) {
      const plan = planTiles(p, 1200, 800, { zoom, x, y: x }, 2, 48);
      assert.ok(plan.tiles.length > 0 && plan.tiles.length <= 48);
      assert.equal(
        new Set(plan.tiles.map((t) => t.key)).size,
        plan.tiles.length,
      );
      for (const t of plan.tiles) {
        assert.ok(t.width > 0 && t.height > 0 && t.column >= 0 && t.row >= 0);
        assert.ok(t.level <= Math.ceil(Math.log2(100000)));
      }
      assert.ok(Number.isFinite(plan.view.x));
    }
});
test("tile resolution follows pixel density and rejects invalid metadata", () => {
  const p = { width: 8192, height: 4096, tileSize: 256 };
  const a = planTiles(p, 800, 600, { zoom: 1, x: 0, y: 0 }),
    b = planTiles(p, 800, 600, { zoom: 4, x: 0, y: 0 });
  assert.ok(b.level > a.level);
  assert.throws(() => validatePyramid({ ...p, width: Infinity }));
  assert.throws(() => validatePyramid({ ...p, tileSize: 0 }));
  assert.throws(() => planTiles(p, 0, 600, { zoom: 1, x: 0, y: 0 }));
  assert.throws(() => planTiles(p, 800, 600, { zoom: NaN, x: 0, y: 0 }));
});
