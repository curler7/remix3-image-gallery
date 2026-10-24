import assert from "node:assert/strict";
import test from "node:test";

test("intentional failure for main branch protection verification", () => {
  assert.fail(
    "Expected temporary failure: verify full-suite blocks administrator merges",
  );
});
