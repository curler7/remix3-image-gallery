import { runGallerySuite } from "./gallery-suite.mjs";
import { runFeatureSuite } from "./feature-suite.mjs";
import { runIntegrationSuite } from "./integration-suite.mjs";
import { readFile, writeFile } from "node:fs/promises";
await runGallerySuite("firefox");
await runFeatureSuite("firefox");
await runIntegrationSuite("firefox");
const read = async (name) =>
  JSON.parse(await readFile(`artifacts/firefox-${name}-results.json`, "utf8"));
const gallery = await read("browser"),
  features = await read("feature"),
  integration = await read("integration");
await writeFile(
  "artifacts/firefox-results.json",
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
          "Synthetic Pointer Events; native multi-touch injection unavailable through Playwright Firefox",
        mobileEmulation:
          "Responsive/touch viewport; Firefox does not support isMobile",
      },
      skipped: [],
    },
    null,
    2,
  ) + "\n",
);
