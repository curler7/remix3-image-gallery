import { chromium } from "playwright";
import { serve } from "./server.mjs";
import { writeFile } from "node:fs/promises";
const server = serve(0);
await new Promise((r) => server.once("listening", r));
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 750000,
    uploadThroughput: 250000,
  });
  await page.addInitScript(() => {
    globalThis.metrics = { cls: 0, lcp: 0, longTasks: [] };
    for (const type of ["layout-shift", "largest-contentful-paint", "longtask"])
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (type === "layout-shift" && !entry.hadRecentInput)
              globalThis.metrics.cls += entry.value;
            if (type === "largest-contentful-paint")
              globalThis.metrics.lcp = entry.startTime;
            if (type === "longtask")
              globalThis.metrics.longTasks.push(entry.duration);
          }
        }).observe({ type, buffered: true });
      } catch {}
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("dialog", { state: "attached" });
  await page.locator(".tile").first().click();
  await page.waitForFunction(
    () => document.querySelector(".stage img").style.opacity === "1",
  );
  await page.evaluate(() => {
    globalThis.interactionSamples = [];
    document
      .querySelector("[data-action=zoom]")
      .addEventListener("click", () => {
        const start = performance.now();
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            interactionSamples.push(performance.now() - start),
          ),
        );
      });
  });
  for (let i = 0; i < 20; i++) {
    await page.locator("[data-action=zoom]").click();
    await page.waitForFunction(
      (count) => interactionSamples.length === count,
      i + 1,
    );
  }
  const interaction = await page.evaluate(() => {
    const samples = [...interactionSamples].sort((a, b) => a - b);
    return {
      count: samples.length,
      p95ms: samples[18],
      p99ms: samples[19],
      samples,
      methodology:
        "Twenty Playwright mouse clicks on viewer zoom under the same CPU/network throttle; measured from click handler entry through two requestAnimationFrame callbacks. This approximates event-to-present opportunity, excludes automation transport and OS input delay, and is not a measured display presentation timestamp.",
    };
  });
  await page.locator("[data-action=close]").click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  const report = await page.evaluate(async () => {
    const timings = [],
      decoded = [],
      urls = [];
    const canvas = document.createElement("canvas");
    canvas.width = 1500;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let n = 0; n < 12; n++) {
      const pixels = ctx.createImageData(1500, 1000);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const tone = Math.floor(random() * 256);
        pixels.data[i] = tone;
        pixels.data[i + 1] = (tone + n * 20) % 256;
        pixels.data[i + 2] = Math.floor(random() * 256);
        pixels.data[i + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
      const blob = await new Promise((r) =>
        canvas.toBlob(r, "image/jpeg", 0.8),
      );
      const url = URL.createObjectURL(blob);
      urls.push(url);
      const image = new Image();
      const start = performance.now();
      image.src = url;
      await image.decode();
      timings.push(performance.now() - start);
      decoded.push(image);
    }
    timings.sort((a, b) => a - b);
    for (const url of urls) URL.revokeObjectURL(url);
    const navigation = performance.getEntriesByType("navigation")[0];
    return {
      ...globalThis.metrics,
      coldNavigationMs: navigation.duration,
      decode: {
        count: 12,
        width: 1500,
        height: 1000,
        p95ms: timings[11],
        medianMs: timings[6],
        estimatedUncompressedBytes: 12 * 1500 * 1000 * 4,
        allObjectURLsRevoked: true,
      },
      jsHeap: performance.memory?.usedJSHeapSize ?? null,
    };
  });
  report.methodology =
    "Chromium headless, 4x CPU, 150ms latency, 750kB/s download, empty network cache. LCP/CLS measured on local SVG demo. Decode stress uses twelve distinct seeded high-entropy 1500x1000 JPEGs retained simultaneously; estimated pixel memory is not measured native memory. Canvas generation and JPEG encoding also contribute long tasks. No real-device or photographic performance claim.";
  report.interaction = interaction;
  await writeFile(
    "artifacts/throttled-performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
