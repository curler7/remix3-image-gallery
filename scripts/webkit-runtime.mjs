import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const runtimeRoot = fileURLToPath(
  new URL("../.runtime/webkit/", import.meta.url),
);
export const runtimeLibraries = [
  "libyuv.so.0",
  "libgav1.so.2",
  "libavif.so.16",
  "libhidapi-hidraw.so.0",
  "libmanette-0.2.so.0",
];
export function webkitLaunchOptions() {
  if (process.platform !== "linux" || process.arch !== "x64")
    return { headless: true };
  const files = runtimeLibraries.map((name) =>
    path.join(runtimeRoot, "usr/lib/x86_64-linux-gnu", name),
  );
  if (!files.every(existsSync)) return { headless: true };
  return {
    headless: true,
    env: {
      ...process.env,
      LD_PRELOAD: [...files, process.env.LD_PRELOAD].filter(Boolean).join(":"),
    },
  };
}
