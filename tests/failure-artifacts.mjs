import { mkdir, writeFile } from "node:fs/promises";

// Best-effort diagnostics must never replace the original assertion failure.
export async function captureFailure(browser, name, error) {
  try {
    await mkdir("artifacts/failures", { recursive: true });
    const pages =
      browser?.contexts().flatMap((context) => context.pages()) ?? [];
    const report = { error: String(error.stack ?? error), pages: [] };
    for (const [index, page] of pages.entries()) {
      const file = `artifacts/failures/${name}-${index}.png`;
      const entry = { url: page.url(), screenshot: file };
      try {
        await page.screenshot({ path: file, timeout: 5000 });
      } catch (captureError) {
        entry.captureError = String(captureError);
      }
      report.pages.push(entry);
    }
    await writeFile(
      `artifacts/failures/${name}.json`,
      JSON.stringify(report, null, 2) + "\n",
    );
  } catch (captureError) {
    console.error("Failure diagnostics unavailable:", captureError);
  }
}
