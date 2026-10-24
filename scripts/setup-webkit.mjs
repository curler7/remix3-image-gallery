import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { runtimeRoot } from "./webkit-runtime.mjs";
const os = await readFile("/etc/os-release", "utf8");
if (
  process.platform !== "linux" ||
  process.arch !== "x64" ||
  !/^ID=ubuntu$/m.test(os) ||
  !/^VERSION_ID="26\.04"$/m.test(os)
)
  throw Error(
    "This local runtime recipe targets Ubuntu 26.04 x64. On other hosts use Playwright install-deps for the host OS.",
  );
const packages = [
  "libavif16=1.3.0-1ubuntu4",
  "libgav1-2=0.20.0-2build1",
  "libyuv0=0.0.1922.20260106-1",
  "libmanette-0.2-0=0.2.13-1",
  "libhidapi-hidraw0=0.15.0-2",
];
const downloads = path.join(runtimeRoot, "downloads");
await mkdir(downloads, { recursive: true });
execFileSync("apt-get", ["download", ...packages], {
  cwd: downloads,
  stdio: "inherit",
});
const installed = [];
for (const file of (await readdir(downloads)).filter((file) =>
  file.endsWith(".deb"),
)) {
  const archive = path.join(downloads, file);
  const [name, version] = execFileSync(
    "dpkg-deb",
    ["--show", "--showformat=${Package}\n${Version}", archive],
    { encoding: "utf8" },
  ).split("\n");
  if (!packages.includes(`${name}=${version}`)) continue;
  execFileSync("dpkg-deb", ["--extract", archive, runtimeRoot]);
  installed.push({
    name,
    version,
    archive: file,
    sha256: createHash("sha256")
      .update(await readFile(archive))
      .digest("hex"),
  });
}
if (installed.length !== packages.length)
  throw Error("Incomplete WebKit runtime installation");
await writeFile(
  path.join(runtimeRoot, "manifest.json"),
  JSON.stringify(
    { source: "Ubuntu Resolute APT repositories", packages: installed },
    null,
    2,
  ),
);
console.log(
  `Installed ${installed.length} runtime packages locally in ${runtimeRoot}. No sudo or system modification required.`,
);
