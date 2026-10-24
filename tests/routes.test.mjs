import { test } from "node:test";
import assert from "node:assert/strict";
import { router } from "../scripts/server.mjs";
test("actual Remix router serves gallery, category, image and not-found responses", async () => {
  for (const [path, status] of [
    ["/", 200],
    ["/category/travel", 200],
    ["/image/1", 200],
    ["/image/999", 404],
    ["/category/missing", 404],
    ["/unknown", 404],
    ["/media/1.svg", 200],
    ["/media/999.svg", 404],
  ]) {
    const response = await router.fetch("http://localhost" + path);
    assert.equal(response.status, status, path);
    if (status === 200 && !path.endsWith(".svg"))
      assert.match(await response.text(), /data-gallery/);
  }
});
