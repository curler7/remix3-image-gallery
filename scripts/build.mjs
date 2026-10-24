import { rm } from "node:fs/promises";
import { build } from "esbuild";
await rm("public/chunks", { recursive: true, force: true });
await build({
  entryPoints: ["apps/remix3-demo/client.ts"],
  bundle: true,
  format: "esm",
  minify: true,
  outdir: "public",
  entryNames: "client",
  chunkNames: "chunks/[name]-[hash]",
  splitting: true,
});
