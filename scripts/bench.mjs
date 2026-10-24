import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { build } from "esbuild";
import { GalleryController } from "../dist/core.js";
import { justified, windowRange } from "../dist/geometry.js";
await mkdir("artifacts", { recursive: true });
const results = {
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  methodology:
    "100 runs per count, in-process Node wall time; no device FPS claims. Local synthetic SVG dataset, not photographic decode/memory profiling.",
  entries: {},
  cases: [],
};
for (const name of [
  "core",
  "dom",
  "remix3",
  "extensions",
  "deep-zoom",
  "motion",
]) {
  const output = await build({
    entryPoints: [`src/${name}.ts`],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    platform: "browser",
  });
  const bytes = output.outputFiles[0].contents;
  results.entries[name] = { bytes: bytes.length, gzip: gzipSync(bytes).length };
}
const demo = await readFile("public/client.js");
results.entries.demo = { bytes: demo.length, gzip: gzipSync(demo).length };
for (const file of await readdir("public/chunks")) {
  const bytes = await readFile(`public/chunks/${file}`);
  results.entries[`chunk:${file}`] = {
    bytes: bytes.length,
    gzip: gzipSync(bytes).length,
  };
}
for (const count of [100, 1000, 10000]) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: String(i),
    src: "/media/1.svg",
    alt: "Study",
    title: "Study",
    category: "Landscape",
    width: 1500,
    height: 1000,
  }));
  const samples = [];
  for (let n = 0; n < 100; n++) {
    const start = performance.now();
    const engine = new GalleryController(items);
    justified(
      items.map((i) => i.width / i.height),
      1200,
    );
    engine.open("0");
    engine.navigate(1);
    engine.destroy();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const range = windowRange(count, 0, 900, 240, 4);
  results.cases.push({
    count,
    p95ms: samples[94],
    p99ms: samples[98],
    mountedAtTop: range.end - range.start,
  });
}
await writeFile("artifacts/benchmarks.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
