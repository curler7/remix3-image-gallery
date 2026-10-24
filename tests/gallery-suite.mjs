import { captureFailure } from "./failure-artifacts.mjs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { launchBrowser, viewportOptions, pinch } from "./browser-runtime.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { serve } from "../scripts/server.mjs";

export async function runGallerySuite(engineName = "chromium") {
  const server = serve(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser(engineName);
  const prefix = engineName === "chromium" ? "" : `${engineName}-`;
  const visualRoot =
    engineName === "chromium" ? "tests/visual" : `tests/visual/${engineName}`;
  await mkdir("artifacts", { recursive: true });
  await build({
    entryPoints: ["tests/fixture.ts"],
    bundle: true,
    format: "iife",
    outfile: "artifacts/fixture.js",
  });
  const results = [];
  await mkdir(visualRoot, { recursive: true });
  async function snapshot(page, name, fullPage = false) {
    if (fullPage)
      await page.evaluate(async () => {
        const position = { x: scrollX, y: scrollY };
        try {
          for (const image of document.querySelectorAll("[data-gallery] img")) {
            image.scrollIntoView({ block: "center", inline: "nearest" });
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
            if (!image.complete)
              await new Promise((resolve, reject) => {
                const cleanup = () => {
                  clearTimeout(timer);
                  image.removeEventListener("load", loaded);
                  image.removeEventListener("error", failed);
                };
                const loaded = () => {
                  cleanup();
                  resolve();
                };
                const failed = () => {
                  cleanup();
                  reject(Error("Gallery image failed during visual capture"));
                };
                const timer = setTimeout(failed, 5000);
                image.addEventListener("load", loaded, { once: true });
                image.addEventListener("error", failed, { once: true });
              });
            if (!image.naturalWidth)
              throw Error("Unloaded image in full-page visual capture");
            await image.decode();
          }
        } finally {
          scrollTo(position.x, position.y);
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        }
      });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const img of document.images)
        if (img.complete) await img.decode().catch(() => {});
    });
    const bytes = await page.screenshot({
      path: `artifacts/${prefix}${name}.png`,
      fullPage,
      animations: "disabled",
    });
    const file = `${visualRoot}/${name}.png`;
    if (process.env.UPDATE_VISUALS === "1") {
      await writeFile(file, bytes);
      return;
    }
    const actual = PNG.sync.read(bytes),
      expected = PNG.sync.read(await readFile(file));
    assert.equal(actual.width, expected.width);
    assert.equal(actual.height, expected.height);
    const diff = new PNG({ width: actual.width, height: actual.height });
    const pixels = pixelmatch(
      actual.data,
      expected.data,
      diff.data,
      actual.width,
      actual.height,
      { threshold: 0.15 },
    );
    if (pixels / actual.width / actual.height > 0.005) {
      await writeFile(
        `artifacts/${prefix}${name}-diff.png`,
        PNG.sync.write(diff),
      );
      throw Error(`Visual regression: ${name}, ${pixels} pixels`);
    }
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
    });
    await page.addInitScript(() => {
      const supported = PerformanceObserver.supportedEntryTypes ?? [];
      globalThis.galleryMetrics = {
        cls: supported.includes("layout-shift") ? 0 : null,
        lcp: supported.includes("largest-contentful-paint") ? 0 : null,
        longTasks: supported.includes("longtask") ? [] : null,
      };
      for (const type of [
        "layout-shift",
        "largest-contentful-paint",
        "longtask",
      ]) {
        try {
          if (!supported.includes(type)) continue;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              if (type === "layout-shift" && !e.hadRecentInput)
                globalThis.galleryMetrics.cls += e.value;
              if (type === "largest-contentful-paint")
                globalThis.galleryMetrics.lcp = e.startTime;
              if (type === "longtask")
                globalThis.galleryMetrics.longTasks.push(e.duration);
            }
          }).observe({ type, buffered: true });
        } catch {}
      }
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector("dialog", { state: "attached" });
    await snapshot(page, "desktop", true);
    assert.equal(await page.locator(".tile").count(), 12);
    await page.locator(".tile").first().click();
    await page.waitForSelector("dialog[open]");
    assert.equal(
      await page.locator("dialog h2").textContent(),
      "Alpine stillness",
    );
    assert.match(page.url(), /image\/1$/);
    await page.keyboard.press("ArrowRight");
    assert.match(await page.locator("dialog h2").textContent(), /Quiet/);
    await page.keyboard.press("+");
    assert.match(
      await page.locator(".stage img").getAttribute("style"),
      /scale\(1.25\)/,
    );
    const titleBeforePan = await page.locator("dialog h2").textContent();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("dialog h2").textContent(), titleBeforePan);
    assert.match(
      await page.locator(".stage img").getAttribute("style"),
      /translate\(/,
    );
    await snapshot(page, "zoom-pan");
    await page.keyboard.press("0");
    await page.waitForFunction(
      () => document.querySelector(".stage img").style.opacity === "1",
    );
    await snapshot(page, "lightbox");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.waitForFunction(() => !document.querySelector("dialog").open);
    await page.waitForURL(base + "/");
    assert.equal(
      await page
        .locator(".tile")
        .first()
        .evaluate((e) => e === document.activeElement),
      true,
    );
    results.push(
      "SSR hydration, modal, keyboard navigation/zoom, Escape, focus restoration and history passed",
    );
    await page
      .getByRole("button", { name: "Grid layout", exact: true })
      .click();
    assert.match(
      await page.locator("[data-gallery]").getAttribute("class"),
      /grid/,
    );
    await snapshot(page, "grid", true);
    await page.getByRole("button", { name: "Explore 10,000 studies" }).click();
    assert.ok((await page.locator("#large-gallery a").count()) < 120);
    await page
      .locator("#large-gallery")
      .evaluate((e) => (e.scrollTop = 100000));
    await page.waitForTimeout(100);
    assert.ok((await page.locator("#large-gallery a").count()) < 120);
    results.push("FLIP grid switch and 10,000-item bounded DOM passed");
    const metrics = await page.evaluate(async (engine) => {
      const frames = [],
        area = document.querySelector("#large-gallery");
      let last = performance.now();
      for (let i = 0; i < 60; i++)
        await new Promise((resolve) =>
          requestAnimationFrame((now) => {
            frames.push(now - last);
            last = now;
            area.scrollTop += 120;
            resolve();
          }),
        );
      frames.sort((a, b) => a - b);
      return {
        ...globalThis.galleryMetrics,
        frameP95: frames[56],
        frameP99: frames[58],
        mounted: area.querySelectorAll("a").length,
        coldNavigation: performance.getEntriesByType("navigation")[0].duration,
        jsHeap: performance.memory?.usedJSHeapSize ?? null,
        methodology: `${engine} headless, local SVG, 60 animation frames during 10k scroll; unthrottled. Unsupported paint/heap metrics are null. Real device/image pressure unverified.`,
      };
    }, engineName);
    await writeFile(
      `artifacts/${prefix}browser-performance.json`,
      JSON.stringify(metrics, null, 2),
    );

    await page.locator("#large-gallery a").first().click();
    await page.waitForSelector("dialog[open]");
    assert.ok((await page.locator("#large-gallery a").count()) < 120);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
    const audit = await page.evaluate(
      async () =>
        await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
        }),
    );
    assert.deepEqual(
      audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      [],
    );
    results.push("axe WCAG2 A/AA automated checks passed");
    await page.goto(base + "/category/travel");
    await page.waitForSelector("dialog", { state: "attached" });
    assert.equal(await page.locator(".tile").count(), 4);
    await page.goto(base + "/image/2");
    await page.waitForSelector("dialog[open]");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    results.push("Category and direct image routes passed");
    await page.goto(base);
    await page.waitForSelector("dialog", { state: "attached" });
    await page.locator("[data-filter=Travel]").click();
    assert.equal(await page.locator(".tile").count(), 4);
    assert.match(page.url(), /category\/travel/);
    await page.selectOption("#sort", "title");
    const sorted = await page
      .locator(".tile figcaption span")
      .allTextContents();
    assert.deepEqual(
      sorted,
      [...sorted].sort((a, b) => a.localeCompare(b)),
    );
    await page.goBack();
    assert.equal(await page.locator(".tile").count(), 12);
    results.push(
      "Animated category filtering, sorting and category history passed",
    );
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
    await snapshot(mobile, "mobile", true);
    await mobile.locator(".tile").first().tap();
    await mobile.waitForSelector("dialog[open]");
    await mobile.evaluate(() => (document.documentElement.dir = "rtl"));
    await mobile.keyboard.press("ArrowRight");
    assert.equal(
      await mobile.locator("dialog h2").textContent(),
      "A place to pause",
    );
    await mobile.keyboard.press("0");
    await pinch(mobile, engineName, ".stage");
    assert.ok(
      (await mobile
        .locator(".stage img")
        .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a)) > 1,
    );
    await mobile.keyboard.press("0");
    await mobile.keyboard.press("Escape");
    results.push(
      `Touch activation, reduced motion, RTL and ${engineName === "chromium" ? "native touch injection" : "synthetic multi-pointer recognition"} passed`,
    );
    await page.goto(base);
    await page.waitForSelector("dialog", { state: "attached" });
    await page.addScriptTag({ path: "artifacts/fixture.js" });
    const integration = await page.evaluate(async () => {
      const { mountGallery, applyLayout, synchronizedCompare, annotations } =
        globalThis.galleryTest;
      const items = JSON.parse(
        document.querySelector("#gallery-data").textContent,
      );
      const root = document.createElement("div");
      document.body.append(root);
      const first = mountGallery(root, items);
      first.controller.replace(items.slice(0, 3));
      if (root.querySelectorAll("a").length !== 3)
        throw Error("Dynamic rendering failed");
      first.controller.update(items[0].id, { title: "Updated title" });
      if (!root.textContent.includes("Updated title"))
        throw Error("Update failed");
      first.controller.open(items[0].id);
      if (!document.querySelectorAll("dialog[open]").length)
        throw Error("Controlled active failed");
      const nestedRoot = document.createElement("div");
      document.body.append(nestedRoot);
      const second = mountGallery(nestedRoot, items);
      second.open(items[1].id);
      await second.close(true);
      if (document.documentElement.style.overflow !== "hidden")
        throw Error("Nested scroll lock failed");
      second.destroy();
      await first.close(true);
      if (document.documentElement.style.overflow === "hidden")
        throw Error("Scroll lock leaked");
      for (const layout of [
        "masonry",
        "grid",
        "justified",
        "rows",
        "columns",
        "collage",
        "hero",
        "filmstrip",
      ])
        applyLayout(root, items.slice(0, 3), layout);
      const destroyCompare = synchronizedCompare(
        root,
        items[0].src,
        items[1].src,
        { beforeAfter: true },
      );
      root.querySelector(".compare-view button").click();
      const transforms = [
        ...root.querySelectorAll(".compare-pictures img"),
      ].map((i) => i.style.transform);
      if (transforms[0] !== transforms[1])
        throw Error("Comparison not synchronized");
      destroyCompare();
      let activated = false;
      const destroyAnnotations = annotations(
        root,
        [{ id: "a", x: 25, y: 50, label: "Detail", description: "A detail" }],
        () => (activated = true),
      );
      root.querySelector(".hotspot").click();
      if (!activated) throw Error("Annotation activation failed");
      destroyAnnotations();
      const before = document.querySelectorAll("dialog").length;
      first.destroy();
      if (document.querySelectorAll("dialog").length !== before - 1)
        throw Error("Dialog teardown failed");
      root.remove();
      nestedRoot.remove();
      return true;
    });
    assert.ok(integration);
    results.push(
      "Dynamic updates, controlled active state, independent and nested galleries, layout APIs, extensions and cleanup passed",
    );
    await page.evaluate(async () => {
      const root = document.createElement("div");
      document.body.append(root);
      const items = JSON.parse(
        document.querySelector("#gallery-data").textContent,
      );
      let attempt = 0;
      const view = globalThis.galleryTest.mountGallery(root, [items[0]], {
        provider: {
          resolve: async (src) => {
            if (attempt++ === 0) throw Error("Offline");
            return src;
          },
        },
      });
      view.open(items[0].id);
      const dialog = [...document.querySelectorAll("dialog")].at(-1);
      const wait = async (fn) => {
        for (let i = 0; i < 100; i++) {
          if (fn()) return;
          await new Promise((r) => setTimeout(r, 10));
        }
        throw Error("Timed out waiting for failure recovery");
      };
      await wait(() =>
        dialog
          .querySelector(".viewer-status")
          .textContent.includes("unavailable"),
      );
      dialog.querySelector("[data-action=retry]").click();
      await wait(
        () => dialog.querySelector(".stage img").style.opacity === "1",
      );
      view.destroy();
      root.remove();
    });
    results.push("Provider failure and retry recovery passed");

    await page.locator(".tile").first().click();
    await page.waitForSelector("dialog[open]");
    await page.waitForFunction(
      () => document.querySelector(".stage img").style.opacity === "1",
    );
    await page.locator(".stage").dblclick();
    assert.match(
      await page.locator(".stage img").getAttribute("style"),
      /scale\(2\)/,
    );
    const stageBox = await page.locator(".stage").boundingBox();
    await page.mouse.move(
      stageBox.x + stageBox.width / 2,
      stageBox.y + stageBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      stageBox.x + stageBox.width / 2 + 60,
      stageBox.y + stageBox.height / 2 + 20,
      { steps: 4 },
    );
    await page.mouse.up();
    await page.keyboard.press("0");
    await page.evaluate(
      () => (document.querySelector("dialog").requestFullscreen = undefined),
    );
    await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
    assert.match(
      await page.locator(".viewer-status").textContent(),
      /unavailable/,
    );
    await page.getByRole("button", { name: "Close viewer" }).focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator(".rail button")
        .first()
        .evaluate((e) => e === document.activeElement),
      true,
    );
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    results.push(
      "Mouse double-click/pan, focus traversal, rapid navigation and fullscreen fallback passed",
    );
    const nojs = await browser.newPage({ javaScriptEnabled: false });
    await nojs.goto(base);
    assert.equal(await nojs.locator("img").count(), 12);
    await nojs.locator(".tile").first().click();
    assert.match(nojs.url(), /image\/1$/);
    assert.equal(await nojs.locator(".detail img").count(), 1);
    results.push("No-JS SSR links and detail route passed");
    assert.deepEqual(errors, []);
    await writeFile(
      `artifacts/${prefix}browser-results.json`,
      JSON.stringify(results, null, 2),
    );
    console.log(results.join("\n"));
  } catch (error) {
    await captureFailure(browser, `${engineName}-gallery`, error);
    throw error;
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}
