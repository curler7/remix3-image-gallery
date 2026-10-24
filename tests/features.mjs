import { runFeatureSuite } from "./feature-suite.mjs";
import { runIntegrationSuite } from "./integration-suite.mjs";
await runFeatureSuite();
await runIntegrationSuite("chromium");
