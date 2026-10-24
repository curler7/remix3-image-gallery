import { browserEnvironment } from "../scripts/browser-environment.mjs";
import { captureFailure } from "./failure-artifacts.mjs";
import { viewportOptions } from "./browser-runtime.mjs";
import { webkit, firefox } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { serve } from "../scripts/server.mjs";
import { webkitLaunchOptions } from "../scripts/webkit-runtime.mjs";

export async function runIntegrationSuite(engineName = "webkit") {
  const server = serve(0);
  await new Promise((resolve) => server.once("listening", resolve));
  let browser;
  const results = [];
  await mkdir("artifacts", { recursive: true });
  try {
    browser =
      engineName === "firefox"
        ? await firefox.launch({ headless: true, env: browserEnvironment() })
        : await webkit.launch(webkitLaunchOptions());
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector("dialog", { state: "attached" });
    assert.equal(await page.locator(".tile").count(), 12);
    await page.locator(".tile").first().click();
    await page.waitForSelector("dialog[open]");
    await page.waitForFunction(
      () => document.querySelector(".stage img").style.opacity === "1",
    );
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.locator("dialog h2").textContent(),
      "Quiet architecture",
    );
    await page.keyboard.press("+");
    assert.match(
      await page.locator(".stage img").getAttribute("style"),
      /scale\(1.25\)/,
    );
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("0");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.waitForURL(base + "/");
    assert.equal(
      await page
        .locator(".tile")
        .first()
        .evaluate((element) => element === document.activeElement),
      true,
    );
    results.push(
      "SSR/hydration, modal navigation, keyboard zoom/pan, closing, history and focus restoration passed",
    );
    await page.locator("[data-filter=Travel]").click();
    assert.equal(await page.locator(".tile").count(), 4);
    await page.selectOption("#sort", "title");
    const titles = await page
      .locator(".tile figcaption span")
      .allTextContents();
    assert.deepEqual(
      titles,
      [...titles].sort((a, b) => a.localeCompare(b)),
    );
    await page.goBack();
    assert.equal(await page.locator(".tile").count(), 12);
    await page
      .getByRole("button", { name: "Grid layout", exact: true })
      .click();
    assert.match(
      await page.locator("[data-gallery]").getAttribute("class"),
      /grid/,
    );
    results.push("Category filter/sort/history and FLIP grid layout passed");
    await page.locator("#deep").click();
    await page.waitForSelector(".deep-scene[aria-busy=false]");
    assert.ok((await page.locator(".deep-scene img").count()) <= 48);
    await page
      .getByRole("button", { name: "Deep image actual pixels", exact: true })
      .click();
    await page.waitForSelector(".deep-scene[aria-busy=false]");
    await page.waitForFunction(
      () => Number(document.querySelector(".deep-scene").dataset.zoom) > 1,
    );
    await page.locator(".deep-scene").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("0");
    await page.waitForSelector(".deep-scene[aria-busy=false]");
    await page.locator(".deep-scene").screenshot({
      path: `artifacts/${engineName}-integration-deep-zoom.png`,
    });
    await page.locator("#deep").click();
    assert.equal(await page.locator(".deep-scene").count(), 0);
    results.push(
      "Lazy deep-zoom raster decoding, actual pixels, keyboard pan, tile budget and teardown passed",
    );
    await page.locator("#extensions").click();
    await page.waitForSelector(".compare-view");
    await page
      .locator(".compare-view")
      .getByRole("button", { name: "Zoom in", exact: true })
      .click();
    const transforms = await page
      .locator(".compare-pictures img")
      .evaluateAll((images) => images.map((image) => image.style.transform));
    assert.equal(transforms[0], transforms[1]);
    await page
      .getByRole("button", { name: "Explore detail", exact: true })
      .click();
    assert.match(
      await page.locator("#extension-demo>[role=status]").textContent(),
      /interplay/,
    );
    await page.locator("#extensions").click();
    results.push(
      "Lazy comparison, before/after and accessible annotations passed",
    );
    await build({
      entryPoints: ["tests/fixture.ts"],
      bundle: true,
      format: "iife",
      outfile: "artifacts/fixture.js",
    });
    await page.addScriptTag({ path: "artifacts/fixture.js" });
    const transitions = await page.evaluate(async () => {
      const items = JSON.parse(
        document.querySelector("#gallery-data").textContent,
      ).slice(0, 2);
      const root = document.createElement("div");
      root.style.cssText = "position:fixed;top:20px;left:20px;width:300px";
      for (const item of items) {
        const a = document.createElement("a");
        a.dataset.id = item.id;
        const image = document.createElement("img");
        image.src = item.src;
        image.style.cssText = "width:120px;height:80px";
        a.append(image);
        root.append(a);
      }
      document.body.append(root);
      const view = globalThis.galleryTest.mountGallery(root, items, {
        motion: { duration: 100 },
      });
      const dialog = [...document.querySelectorAll("dialog")].at(-1);
      const ready = async () => {
        for (let i = 0; i < 200; i++) {
          if (dialog.querySelector(".stage img").style.opacity === "1") return;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        throw Error("Image decode timeout");
      };
      view.open(items[0].id);
      await ready();
      for (const animation of dialog.getAnimations({ subtree: true }))
        animation.finish();
      const closing = view.close(true);
      if (dialog.dataset.transition !== "closing-thumbnail")
        throw Error("Reverse closing geometry missing");
      view.open(items[1].id, false);
      await closing;
      await ready();
      await new Promise((resolve) => setTimeout(resolve, 160));
      if (!dialog.open || view.controller.snapshot.active !== items[1].id)
        throw Error("Close/reopen race");
      await view.close(true);
      if (dialog.open || document.documentElement.style.overflow === "hidden")
        throw Error("Close leaked modality");
      view.open(items[0].id, false);
      await ready();
      const pending = view.close(true);
      view.destroy();
      await pending;
      if (dialog.isConnected) throw Error("Destroy leaked dialog");
      root.remove();
      return true;
    });
    assert.ok(transitions);
    results.push(
      "Measured reverse closing, reopen interruption, scroll locks and destruction during closing passed",
    );
    const tiles = await page.evaluate(async () => {
      const root = document.createElement("div");
      root.style.cssText = "position:fixed;inset:0;z-index:10";
      document.body.append(root);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      canvas.getContext("2d").fillRect(0, 0, 256, 256);
      const jpeg = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.8),
      );
      if (!jpeg) throw Error("JPEG encoding failed");
      let calls = 0;
      const viewer = globalThis.galleryTest.mountDeepZoom(
        root,
        {
          width: 8192,
          height: 8192,
          tileSize: 256,
          alt: "JPEG tile test",
          tile: async (_, __, ___, signal) => {
            signal.throwIfAborted();
            calls++;
            if (calls === 1) throw Error("Offline");
            return jpeg;
          },
        },
        { maxTiles: 16, concurrency: 2 },
      );
      for (let i = 0; i < 200 && !root.textContent.includes("Some tiles"); i++)
        await new Promise((resolve) => setTimeout(resolve, 10));
      if (!root.textContent.includes("Some tiles"))
        throw Error("Tile failure missing");
      root.querySelectorAll("button")[4].click();
      for (
        let i = 0;
        i < 200 && !root.textContent.includes("Image tiles ready");
        i++
      )
        await new Promise((resolve) => setTimeout(resolve, 10));
      if (!root.textContent.includes("Image tiles ready"))
        throw Error("JPEG tile retry/decode failed");
      viewer.setView({ zoom: 2 });
      if (
        root.querySelector(".deep-scene").getAttribute("aria-busy") !== "true"
      )
        throw Error("Pending render reported ready");
      for (
        let i = 0;
        i < 200 &&
        root.querySelector(".deep-scene").getAttribute("aria-busy") !== "false";
        i++
      )
        await new Promise((resolve) => setTimeout(resolve, 10));
      if (
        root.querySelector(".deep-scene").getAttribute("aria-busy") !== "false"
      )
        throw Error("View update never became ready");
      const stats = viewer.stats;
      if (stats.mounted > 16 || stats.active > 2)
        throw Error("Tile budget exceeded");
      viewer.destroy();
      if (viewer.stats.objectURLs || viewer.stats.cacheEntries)
        throw Error("Tile resources leaked");
      root.remove();
      return stats;
    });
    results.push(
      "JPEG tile codec, failure/retry, concurrency/DOM bounds and object URL cleanup passed",
    );
    await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
    const violations = await page.evaluate(
      async () =>
        (
          await axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
          })
        ).violations,
    );
    assert.deepEqual(
      violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      [],
    );
    results.push(`${engineName} automated accessibility audit passed`);
    const mobile = await browser.newPage(
      viewportOptions(engineName, {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      }),
    );
    await mobile.goto(base);
    await mobile.waitForSelector("dialog", { state: "attached" });
    await mobile.locator(".tile").first().tap();
    await mobile.waitForSelector("dialog[open]");
    await mobile.evaluate(() => (document.documentElement.dir = "rtl"));
    await mobile.keyboard.press("ArrowRight");
    assert.equal(
      await mobile.locator("dialog h2").textContent(),
      "A place to pause",
    );
    await mobile
      .getByRole("button", { name: "Close viewer", exact: true })
      .tap();
    await mobile.waitForFunction(() => !document.querySelector("dialog[open]"));
    await mobile.close();
    results.push("Mobile touch, RTL and reduced-motion closing passed");
    const nojs = await browser.newPage({ javaScriptEnabled: false });
    await nojs.goto(base);
    await nojs.locator(".tile").first().click();
    assert.match(nojs.url(), /image\/1$/);
    assert.equal(await nojs.locator(".detail img").count(), 1);
    await nojs.close();
    results.push("No-JS image route passed");
    assert.deepEqual(errors, []);
    await writeFile(
      `artifacts/${engineName}-integration-results.json`,
      JSON.stringify({ version: browser.version(), results, tiles }, null, 2),
    );
    console.log(`${engineName} ${browser.version()}\n${results.join("\n")}`);
  } catch (error) {
    await captureFailure(browser, `${engineName}-integration`, error);
    throw error;
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
