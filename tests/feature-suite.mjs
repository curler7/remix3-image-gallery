import { captureFailure } from "./failure-artifacts.mjs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { launchBrowser, viewportOptions, pinch } from "./browser-runtime.mjs";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { serve } from "../scripts/server.mjs";
import { auditInteractions } from "./requirement-audit.mjs";

export async function runFeatureSuite(engineName = "chromium") {
  const server = serve(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`,
    browser = await launchBrowser(engineName);
  const prefix = engineName === "chromium" ? "" : `${engineName}-`;
  const visualRoot =
    engineName === "chromium" ? "tests/visual" : `tests/visual/${engineName}`;
  await mkdir(visualRoot, { recursive: true });
  await mkdir("artifacts", { recursive: true });
  await build({
    entryPoints: ["tests/fixture.ts"],
    bundle: true,
    format: "iife",
    outfile: "artifacts/fixture.js",
  });
  const results = [];
  async function visual(page, name) {
    const bytes = await page.screenshot({
      path: `artifacts/${prefix}${name}.png`,
      animations: name === "reverse-close" ? "allow" : "disabled",
    });
    const path = `${visualRoot}/${name}.png`;
    if (process.env.UPDATE_VISUALS === "1") {
      await writeFile(path, bytes);
      return;
    }
    const a = PNG.sync.read(bytes),
      b = PNG.sync.read(await readFile(path));
    assert.equal(a.width, b.width);
    assert.equal(a.height, b.height);
    assert.ok(
      pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.15 }) /
        (a.width * a.height) <
        0.005,
      `Visual regression: ${name}`,
    );
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(base);
    await page.waitForSelector("dialog", { state: "attached" });
    assert.ok(!requests.some((url) => url.includes("deep-zoom-")));
    await page.locator("#deep").click();
    await page.waitForSelector(".deep-scene[aria-busy=false]");
    assert.ok(requests.some((url) => url.includes("deep-zoom-")));
    assert.ok((await page.locator(".deep-scene img").count()) <= 48);
    await page
      .getByRole("button", { name: "Deep image actual pixels", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector(".deep-scene").getAttribute("aria-busy") ===
        "false",
    );
    assert.ok((await page.locator(".deep-scene img").count()) <= 48);
    await page.locator(".deep-scene").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("0");
    await page.waitForFunction(
      () =>
        document.querySelector(".deep-scene").getAttribute("aria-busy") ===
        "false",
    );
    await page.locator(".deep-scene").screenshot({
      path: `artifacts/${prefix}deep-zoom.png`,
      animations: "disabled",
    });
    await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
    const violations = await page.evaluate(
      async () =>
        (
          await axe.run(document.querySelector("#deep-demo"), {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
          })
        ).violations,
    );
    assert.deepEqual(
      violations.map((v) => v.id),
      [],
    );
    await page.locator("#deep").click();
    assert.equal(await page.locator(".deep-scene").count(), 0);
    results.push(
      "Lazy deep-zoom chunk, atlas raster tiles, actual-pixel zoom, keyboard pan, bounded DOM, axe and teardown passed",
    );
    await page.locator(".tile").first().click();
    await page.waitForFunction(
      () => document.querySelector(".stage img").style.opacity === "1",
    );
    await page.evaluate(() => {
      for (const animation of document
        .querySelector("dialog[open]")
        .getAnimations({ subtree: true }))
        animation.finish();
      document.querySelector("dialog[open] [data-action=close]").click();
      for (const animation of document
        .querySelector("dialog[open]")
        .getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime =
          Number(animation.effect.getTiming().duration) / 2;
      }
    });
    assert.equal(await page.locator(".closing-image").count(), 1);
    await page.locator(".closing-image").evaluate((image) => image.decode());
    await visual(page, "reverse-close");
    await page.evaluate(() => {
      for (const animation of document
        .querySelector("dialog[open]")
        .getAnimations({ subtree: true }))
        animation.finish();
    });
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.locator("#extensions").click();
    await page.waitForSelector(".compare-view");
    await page
      .getByRole("button", { name: "Explore detail", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector("#extension-demo>[role=status]")
        .textContent.includes("interplay"),
    );
    await page.locator("#extensions").click();
    results.push(
      "Real pointer clicks on comparison annotations remain independent of pan capture",
    );
    await page.addScriptTag({ path: "artifacts/fixture.js" });
    await page.evaluate(() => {
      const root = document.createElement("div");
      document.body.append(root);
      const items = JSON.parse(
        document.querySelector("#gallery-data").textContent,
      );
      let resolve;
      const view = globalThis.galleryTest.mountGallery(root, [items[0]], {
        provider: { resolve: () => new Promise((r) => (resolve = r)) },
      });
      view.open(items[0].id);
      globalThis.loadingHarness = {
        view,
        root,
        resolve: () => resolve(items[0].src),
      };
    });
    await visual(page, "loading");
    await page.evaluate(() => {
      globalThis.loadingHarness.resolve();
    });
    await page.waitForFunction(
      () =>
        document.querySelector("dialog[open] .stage img").style.opacity === "1",
    );
    await page.evaluate(() => {
      globalThis.loadingHarness.view.destroy();
      globalThis.loadingHarness.root.remove();
      delete globalThis.loadingHarness;
    });
    const transition = await page.evaluate(async () => {
      const { mountGallery } = globalThis.galleryTest;
      const items = JSON.parse(
        document.querySelector("#gallery-data").textContent,
      ).slice(0, 2);
      const root = document.createElement("div");
      root.style.cssText =
        "position:fixed;left:20px;top:20px;width:300px;z-index:3";
      for (const item of items) {
        const a = document.createElement("a");
        a.href = item.src;
        a.dataset.id = item.id;
        const img = document.createElement("img");
        img.src = item.src;
        img.alt = item.alt;
        img.style.cssText = "width:120px;height:80px;object-fit:cover";
        a.append(img);
        root.append(a);
      }
      document.body.append(root);
      const view = mountGallery(root, items, {
        motion: { duration: 120, zoomDuration: 80 },
        reorderable: true,
      });
      const dialog = [...document.querySelectorAll("dialog")].at(-1);
      const wait = async (fn) => {
        for (let i = 0; i < 200; i++) {
          if (fn()) return;
          await new Promise((r) => setTimeout(r, 10));
        }
        throw Error("Transition timeout");
      };
      view.open(items[0].id);
      await wait(
        () => dialog.querySelector(".stage img").style.opacity === "1",
      );
      for (const animation of dialog.getAnimations({ subtree: true }))
        animation.finish();
      const first = view.close(true);
      const phase = dialog.dataset.transition;
      if (
        phase !== "closing-thumbnail" ||
        !dialog.querySelector(".closing-image")
      )
        throw Error("Missing measured reverse close");
      if (document.documentElement.style.overflow !== "hidden")
        throw Error("Premature scroll unlock");
      view.open(items[1].id, false);
      await first;
      await new Promise((r) => setTimeout(r, 160));
      if (!dialog.open || view.controller.snapshot.active !== items[1].id)
        throw Error("Stale close callback closed reopened viewer");
      await wait(
        () => dialog.querySelector(".stage img").style.opacity === "1",
      );
      dialog.querySelector("[data-action=earlier]").click();
      if (view.controller.snapshot.items[0].id !== items[1].id)
        throw Error("Accessible ordering failed");
      await view.close(true);
      if (dialog.open || dialog.querySelector(".closing-image"))
        throw Error("Close cleanup failed");
      view.open(items[0].id, false);
      await wait(
        () => dialog.querySelector(".stage img").style.opacity === "1",
      );
      root.style.display = "none";
      const fading = view.close(true);
      if (dialog.dataset.transition !== "closing-fade")
        throw Error("Missing fade fallback");
      await fading;
      root.style.display = "";
      view.open(items[0].id, false);
      await wait(
        () => dialog.querySelector(".stage img").style.opacity === "1",
      );
      const interrupted = view.close(true);
      view.destroy();
      await interrupted;
      if (
        dialog.isConnected ||
        document.documentElement.style.overflow === "hidden"
      )
        throw Error("Destroy during close leaked");
      root.remove();
      return phase;
    });
    assert.equal(transition, "closing-thumbnail");
    results.push(
      "Reverse thumbnail geometry, fade fallback, close/reopen interruption, keyboard ordering, lock lifetime and destruction during close passed",
    );
    const tiles = await page.evaluate(async () => {
      const { mountDeepZoom } = globalThis.galleryTest;
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;inset:0;z-index:10";
      document.body.append(host);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#68754c";
      ctx.fillRect(0, 0, 256, 256);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      const live = new Set(),
        create = URL.createObjectURL.bind(URL),
        revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (b) => {
        const url = create(b);
        live.add(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        live.delete(url);
        revoke(url);
      };
      let inflight = 0,
        peak = 0,
        aborted = 0,
        fail = true;
      const p = {
        width: 100000,
        height: 80000,
        tileSize: 256,
        alt: "Gigapixel test atlas",
        tile: (level, column, row, signal) =>
          new Promise((resolve, reject) => {
            inflight++;
            peak = Math.max(peak, inflight);
            const timer = setTimeout(() => {
              inflight--;
              signal.removeEventListener("abort", cancel);
              if (fail) reject(Error("Offline"));
              else resolve(blob);
            }, 30);
            const cancel = () => {
              clearTimeout(timer);
              inflight--;
              aborted++;
              reject(signal.reason);
            };
            signal.addEventListener("abort", cancel, { once: true });
          }),
      };
      const view = mountDeepZoom(host, p, {
        maxTiles: 24,
        concurrency: 2,
        cacheEntries: 8,
        cacheBytes: 1024 * 1024,
      });
      const wait = async (fn) => {
        for (let i = 0; i < 300; i++) {
          if (fn()) return;
          await new Promise((r) => setTimeout(r, 10));
        }
        throw Error("Tile test timeout");
      };
      await wait(() => host.textContent.includes("Some tiles"));
      fail = false;
      host.querySelectorAll("button")[4].click();
      await wait(() => host.textContent.includes("Image tiles ready"));
      view.setView({ zoom: 30 });
      await new Promise((r) => requestAnimationFrame(r));
      view.setView({ zoom: 100, x: 10000, y: -10000 });
      await wait(() => host.textContent.includes("Image tiles ready"));
      const stats = view.stats;
      if (
        stats.mounted > 24 ||
        stats.cacheEntries > 8 ||
        stats.cacheBytes > 1024 * 1024 ||
        peak > 2
      )
        throw Error("Tile budget exceeded");
      view.setView({ zoom: 3 });
      await new Promise((r) => requestAnimationFrame(r));
      view.destroy();
      await new Promise((r) => setTimeout(r, 80));
      if (
        live.size ||
        view.stats.mounted ||
        view.stats.cacheEntries ||
        view.stats.active
      )
        throw Error("Tile cleanup leaked");
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
      host.remove();
      if (!aborted) throw Error("No obsolete tile requests cancelled");
      return { ...stats, peak, aborted, liveURLsAfterDestroy: live.size };
    });
    await writeFile(
      `artifacts/${prefix}deep-zoom-results.json`,
      JSON.stringify(tiles, null, 2),
    );
    results.push(
      "Deep-zoom concurrency/cache/DOM budgets, tile failure/retry, obsolete cancellation and object URL cleanup passed",
    );
    const media = await page.evaluate(async () => {
      const items = JSON.parse(
        document.querySelector("#gallery-data").textContent,
      ).slice(0, 3);
      let calls = [];
      const host = document.createElement("div");
      document.body.append(host);
      const view = globalThis.galleryTest.mountGallery(host, items, {
        reducedData: true,
        provider: {
          resolve: async (src) => {
            calls.push(src);
            return src;
          },
        },
      });
      view.open(items[1].id);
      const d = [...document.querySelectorAll("dialog")].at(-1);
      for (
        let i = 0;
        i < 100 && d.querySelector(".stage img").style.opacity !== "1";
        i++
      )
        await new Promise((r) => setTimeout(r, 10));
      await new Promise((r) => setTimeout(r, 80));
      if (calls.length !== 1) throw Error("Reduced-data preloading ignored");
      view.destroy();
      let rejected = false;
      try {
        globalThis.galleryTest.mountGallery(
          host,
          [{ ...items[0], preview: "https://blocked.example/preview.jpg" }],
          { allowedOrigins: [] },
        );
      } catch {
        rejected = true;
      }
      if (!rejected) throw Error("Preview bypassed origin restrictions");
      const huge = {
        ...items[0],
        src: "/must-not-load-gigapixel.jpg",
        width: 100000,
        height: 80000,
      };
      calls = [];
      const giant = globalThis.galleryTest.mountGallery(host, [huge], {
        provider: {
          resolve: async (src) => {
            calls.push(src);
            return src;
          },
        },
      });
      giant.open(huge.id);
      await new Promise((r) => setTimeout(r, 30));
      const gd = [...document.querySelectorAll("dialog")].at(-1);
      if (calls.length || !gd.textContent.includes("tiled deep zoom"))
        throw Error("Gigapixel was decoded by ordinary viewer");
      giant.destroy();
      const many = Array.from({ length: 1000 }, (_, i) => ({
        ...items[0],
        id: String(i),
      }));
      const rail = globalThis.galleryTest.mountGallery(host, many, {
        motion: "none",
        rail: "vertical",
      });
      rail.open("999");
      const rd = [...document.querySelectorAll("dialog")].at(-1);
      if (
        !rd.querySelector('.rail [data-id="999"]') ||
        rd.querySelectorAll(".rail button").length > 100
      )
        throw Error("Full-access thumbnail window failed");
      rail.destroy();
      host.remove();
      return true;
    });
    assert.ok(media);
    assert.ok(!requests.some((url) => url.includes("must-not-load-gigapixel")));
    results.push(
      "Reduced-data budget, giant-image guard and all-image vertical thumbnail access passed",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(async () => {
      const host = document.createElement("div");
      document.body.append(host);
      const items = JSON.parse(
        document.querySelector("#gallery-data").textContent,
      );
      const view = globalThis.galleryTest.mountGallery(host, items);
      view.open(items[0].id);
      const d = [...document.querySelectorAll("dialog")].at(-1);
      const closing = view.close(true);
      if (d.open) throw Error("Reduced-motion close was delayed");
      await closing;
      view.destroy();
      host.remove();
    });
    results.push("Reduced-motion synchronous closing passed");
    const tablet = await browser.newPage(
      viewportOptions(engineName, {
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
        reducedMotion: "reduce",
        forcedColors: "active",
      }),
    );
    await tablet.goto(base);
    await tablet.waitForSelector("dialog", { state: "attached" });
    await tablet.locator(".tile").first().click();
    await tablet.waitForSelector("dialog[open]");
    await tablet.setViewportSize({ width: 1024, height: 768 });
    await tablet
      .getByRole("button", { name: "Fullscreen", exact: true })
      .click();
    const fullscreen = await tablet.evaluate(() =>
      Boolean(document.fullscreenElement),
    );
    if (!fullscreen)
      assert.match(
        await tablet.locator(".viewer-status").textContent(),
        /unavailable/,
      );
    await tablet
      .getByRole("button", { name: "Close viewer", exact: true })
      .click();
    await tablet.waitForFunction(() => !document.querySelector("dialog[open]"));
    assert.equal(
      await tablet.evaluate(() => Boolean(document.fullscreenElement)),
      false,
    );
    await tablet.close();
    results.push(
      `Tablet rotation/forced colors and ${fullscreen ? "native fullscreen entry/exit" : "fullscreen fallback"} passed`,
    );
    const touch = await browser.newPage(
      viewportOptions(engineName, {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
    );
    await touch.goto(base);
    await touch.waitForSelector("dialog", { state: "attached" });
    await touch.locator("#deep").click();
    await touch.waitForSelector(".deep-scene[aria-busy=false]");
    await touch.locator(".deep-scene").scrollIntoViewIfNeeded();
    await pinch(touch, engineName, ".deep-scene", 30, 60);
    await touch.waitForFunction(
      () => Number(document.querySelector(".deep-scene").dataset.zoom) > 1,
    );
    assert.ok((await touch.locator(".deep-scene img").count()) <= 48);
    await touch.close();
    results.push(
      `${engineName === "chromium" ? "Native touch injection" : "Synthetic multi-pointer"} deep-zoom pinch and bounded rendering passed`,
    );
    await auditInteractions(page);
    results.push(
      "Requirement audit: isolated history, Home/End routes, editable metadata, full focus order, invalid reopen and bounded comparison passed",
    );
    assert.deepEqual(errors, []);
    await writeFile(
      `artifacts/${prefix}feature-results.json`,
      JSON.stringify(results, null, 2),
    );
    console.log(results.join("\n"));
  } catch (error) {
    await captureFailure(browser, `${engineName}-feature`, error);
    throw error;
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}
