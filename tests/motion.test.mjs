import { test } from "node:test";
import assert from "node:assert/strict";
import {
  motionProfile,
  rubberBand,
  nextZoom,
  zoomLevels,
  springFrames,
} from "../dist/motion.js";
test("motion profiles honor reduced motion and validate configuration", () => {
  assert.equal(motionProfile("none").duration, 0);
  assert.equal(motionProfile("snappy").duration, 150);
  assert.equal(motionProfile({ duration: 800 }, true).duration, 0);
  assert.throws(() => motionProfile({ duration: NaN }));
  assert.throws(() => motionProfile({ decay: -1 }));
});
test("rubber band is continuous, symmetric and bounded", () => {
  assert.equal(rubberBand(0), 0);
  assert.ok(rubberBand(100) < 64);
  assert.ok(rubberBand(100) > rubberBand(10));
  assert.equal(rubberBand(-100), -rubberBand(100));
  assert.equal(rubberBand(999, 0), 0);
});
test("custom zoom levels and spring converge", () => {
  assert.deepEqual(zoomLevels([3, 1, 2, 3]), [1, 2, 3]);
  assert.equal(nextZoom(2, [1, 2, 4], 1), 4);
  assert.equal(nextZoom(2, [1, 2, 4], -1), 1);
  assert.throws(() => zoomLevels([Infinity]));
  const frames = springFrames(40);
  assert.equal(frames.at(-1), 0);
  assert.ok(frames.every(Number.isFinite));
});
