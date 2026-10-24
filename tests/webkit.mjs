import { runGallerySuite } from "./gallery-suite.mjs";
import { runFeatureSuite } from "./feature-suite.mjs";
import { runIntegrationSuite } from "./integration-suite.mjs";
import { readFile, writeFile } from "node:fs/promises";
await runGallerySuite("webkit");
await runFeatureSuite("webkit");
await runIntegrationSuite("webkit");
const read = async (name) =>
  JSON.parse(await readFile(`artifacts/webkit-${name}-results.json`, "utf8"));
const gallery = await read("browser"),
  features = await read("feature"),
  integration = await read("integration");
await writeFile(
  "artifacts/webkit-results.json",
  JSON.stringify(
    {
      version: integration.version,
      groups: {
        gallery: gallery.length,
        features: features.length,
        integration: integration.results.length,
      },
      results: [...gallery, ...features, ...integration.results],
      capabilities: {
        touchActivation: "Playwright touch input at responsive viewport",
        multiTouch:
          "Synthetic Pointer Events; native multi-touch injection unavailable through Playwright WebKit",
        mobileEmulation: "Mobile viewport and touch emulation with isMobile",
      },
      skipped: [],
    },
    null,
    2,
  ) + "\n",
);
