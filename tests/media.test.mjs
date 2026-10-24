import { test } from "node:test";
import assert from "node:assert/strict";
import { MediaCache } from "../dist/media.js";
test("bounded cache and stale request cancellation", async () => {
  const c = new MediaCache(2);
  const a = new AbortController();
  await c.load("/a", a.signal);
  await c.load("/b", a.signal);
  await c.load("/c", a.signal);
  assert.equal(c.size, 2);
  a.abort();
  await assert.rejects(c.load("/a", a.signal));
  c.clear();
  assert.equal(c.size, 0);
});
test("one cancelled subscriber does not cancel another", async () => {
  let finish;
  const c = new MediaCache(2, {
    resolve: () => new Promise((r) => (finish = r)),
  });
  const a = new AbortController(),
    b = new AbortController();
  const first = c.load("/shared", a.signal),
    second = c.load("/shared", b.signal);
  await Promise.resolve();
  a.abort();
  await assert.rejects(first);
  finish("/shared");
  assert.equal(await second, "/shared");
});
