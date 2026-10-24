import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

// Keep independent checks running so one browser failure cannot hide another.
const stages = [
  ["typecheck", ["run", "typecheck"]],
  ["lint", ["run", "lint"]],
  ["unit-and-build", ["test"]],
  ["chromium-gallery", ["exec", "--", "node", "tests/browser.mjs"]],
  ["chromium-features", ["exec", "--", "node", "tests/features.mjs"]],
  ["firefox", ["exec", "--", "node", "tests/firefox.mjs"]],
  ["webkit", ["exec", "--", "node", "tests/webkit.mjs"]],
  ["benchmarks", ["run", "bench"]],
  ["browser-benchmarks", ["run", "bench:browser"]],
  ["format", ["run", "format:check"]],
];
await mkdir("artifacts/ci", { recursive: true });
const results = [];
for (const [name, args] of stages) {
  console.log(`\n::group::${name}`);
  const started = Date.now();
  const log = createWriteStream(`artifacts/ci/${name}.log`);
  const code = await new Promise((resolve) => {
    const child = spawn("npm", args, {
      env: { ...process.env, UPDATE_VISUALS: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (chunk) => {
        process.stdout.write(chunk);
        log.write(chunk);
      });
    child.on("error", (error) => {
      log.write(`${error.stack}\n`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
  await new Promise((resolve) => log.end(resolve));
  results.push({ name, exitCode: code, durationMs: Date.now() - started });
  await writeFile(
    "artifacts/ci/results.json",
    JSON.stringify(
      { stages: results, failed: results.some((r) => r.exitCode) },
      null,
      2,
    ) + "\n",
  );
  console.log("::endgroup::");
}
process.exitCode = results.some((result) => result.exitCode !== 0) ? 1 : 0;
