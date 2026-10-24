import assert from "node:assert/strict";

/** Adversarial checks shared by every browser, independent of screenshot baselines. */
export async function auditInteractions(page) {
  const base = new URL(page.url()).origin;
  await page.goto(base);
  await page.waitForSelector("dialog", { state: "attached" });
  await page.addScriptTag({ path: "artifacts/fixture.js" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".tile").first().click();
  await page.waitForFunction(
    () => document.querySelector(".stage img").style.opacity === "1",
  );
  await page.goBack();
  await page.waitForFunction(
    () => !document.querySelector("dialog[open]"),
    null,
    { timeout: 5000 },
  );
  await page.goForward();
  await page.waitForSelector("dialog[open]");
  await page.locator("dialog[open] [data-action=close]").click();
  await page.waitForURL(`${base}/`, { timeout: 5000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    const items = JSON.parse(
      document.querySelector("#all-gallery-data").textContent,
    );
    const root = document.createElement("div");
    document.body.append(root);
    const isolated = galleryTest.mountGallery(root, items.slice(0, 2), {
      motion: "none",
    });
    history.pushState({}, "", `/image/${items[0].id}`);
    dispatchEvent(new PopStateEvent("popstate"));
    if (isolated.controller.snapshot.active !== null)
      throw Error("History-disabled gallery followed route");
    isolated.destroy();
    history.replaceState({}, "", "/");
    dispatchEvent(new PopStateEvent("popstate"));
    const view = galleryTest.mountGallery(root, items.slice(0, 3), {
      motion: "none",
      history: true,
      renderMetadata(container) {
        const input = document.createElement("input");
        input.setAttribute("aria-label", "Audit note");
        const link = document.createElement("a");
        link.href = "#audit";
        link.textContent = "Audit link";
        container.append(input, link);
      },
    });
    view.open(items[0].id);
    globalThis.auditHarness = { root, view, items };
  });
  const dialog = page.locator("dialog[open]");
  await page.keyboard.press("End");
  assert.equal(
    await page.evaluate(() => location.pathname),
    await page.evaluate(() => `/image/${auditHarness.items[2].id}`),
  );
  await page.keyboard.press("Home");
  const cancelledTapScale = await dialog.locator(".stage").evaluate((stage) => {
    const capture = stage.setPointerCapture;
    stage.setPointerCapture = () => {};
    try {
      for (let n = 1; n <= 2; n++)
        for (const type of ["pointerdown", "pointercancel"])
          stage.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              pointerId: n,
              pointerType: "touch",
              clientX: 100,
              clientY: 100,
            }),
          );
      return new DOMMatrix(stage.querySelector("img").style.transform).a;
    } finally {
      delete stage.setPointerCapture;
      if (stage.setPointerCapture !== capture)
        stage.setPointerCapture = capture;
    }
  });
  assert.equal(cancelledTapScale, 1);
  const input = dialog.getByRole("textbox", { name: "Audit note" });
  await input.fill("A note");
  await input.press("End");
  await input.press("ArrowRight");
  assert.equal(
    await page.evaluate(() => auditHarness.view.controller.snapshot.active),
    await page.evaluate(() => auditHarness.items[0].id),
  );
  const link = dialog.getByRole("link", { name: "Audit link" });
  await link.focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.id),
    await page.evaluate(() => auditHarness.items[0].id),
  );
  const first = dialog.locator("button").first();
  await first.focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.id),
    await page.evaluate(() => auditHarness.items[2].id),
  );
  await page.evaluate(() => {
    const { view, root } = auditHarness;
    view.destroy();
    root.remove();
    history.replaceState({}, "", "/");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(async () => {
    const { items } = auditHarness;
    const root = document.createElement("div");
    root.style.cssText =
      "display:grid;grid-template-columns:repeat(2,1fr);width:600px";
    document.body.append(root);
    const view = galleryTest.mountGallery(root, items.slice(0, 3));
    view.controller.replace(items.slice(0, 3));
    for (const animation of root.getAnimations({ subtree: true }))
      animation.finish();
    view.controller.reorder(
      items
        .slice(0, 3)
        .map((i) => i.id)
        .reverse(),
    );
    if (
      !root.getAnimations({ subtree: true }).some((a) => {
        const matrix = new DOMMatrix(a.effect.getKeyframes()[0].transform);
        return Math.abs(matrix.e) + Math.abs(matrix.f) > 0;
      })
    )
      throw Error("Reorder did not animate repositioning");
    view.controller.update(items[0].id, { title: "Changed" });
    if (root.getAnimations({ subtree: true }).length > 3)
      throw Error("Reflow animations accumulated");
    view.destroy();
    if (root.getAnimations({ subtree: true }).length)
      throw Error("Reflow teardown leaked");
    root.remove();
    const directRoot = document.createElement("div");
    document.body.append(directRoot);
    const direct = galleryTest.mountGallery(directRoot, items.slice(0, 3), {
      history: true,
      motion: "none",
    });
    const back = history.back;
    let backCalls = 0;
    history.back = () => backCalls++;
    try {
      direct.open(items[0].id, false);
      direct.open(items[1].id);
      await direct.close();
      if (backCalls)
        throw Error("Direct deep link acquired an owned history entry");
    } finally {
      history.back = back;
      direct.destroy();
      directRoot.remove();
      history.replaceState({}, "", "/");
    }
    const firstRoot = document.createElement("div"),
      secondRoot = document.createElement("div");
    document.body.append(firstRoot, secondRoot);
    const firstView = galleryTest.mountGallery(firstRoot, items.slice(0, 3), {
      history: true,
      motion: "none",
    });
    const secondView = galleryTest.mountGallery(secondRoot, items.slice(0, 3), {
      history: true,
      motion: "none",
    });
    history.replaceState({ scrollPosition: 123 }, "", "/");
    firstView.open(items[0].id);
    secondView.open(items[1].id);
    dispatchEvent(new PopStateEvent("popstate"));
    if (
      firstView.controller.snapshot.active !== null ||
      secondView.controller.snapshot.active !== items[1].id
    )
      throw Error("History event opened another gallery instance");
    if (history.state.scrollPosition !== 123)
      throw Error("Gallery discarded host history state");
    firstView.destroy();
    secondView.destroy();
    firstRoot.remove();
    secondRoot.remove();
    history.replaceState({}, "", "/");
  });
  // Teardown must cancel a close even when an invalid open is requested mid-animation.
  await page.evaluate(async () => {
    const { items } = auditHarness;
    const root = document.createElement("div");
    document.body.append(root);
    const view = galleryTest.mountGallery(root, items.slice(0, 1));
    view.open(items[0].id);
    const closed = view.close();
    view.open("missing-id");
    await closed;
    if (view.controller.snapshot.active !== null)
      throw Error("Invalid open interrupted closing");
    view.destroy();
    root.remove();
  });
  await page.evaluate(() => {
    const root = document.createElement("div");
    document.body.append(root);
    const stop = galleryTest.synchronizedCompare(
      root,
      auditHarness.items[0].src,
      auditHarness.items[1].src,
    );
    globalThis.auditCompare = { root, stop };
  });
  await page
    .locator(".compare-view")
    .getByRole("button", { name: "Zoom in", exact: true })
    .click();
  await page.locator(".compare-pictures").focus();
  for (let n = 0; n < 50; n++) await page.keyboard.press("ArrowRight");
  const bounds = await page.locator(".compare-pictures").evaluate((area) => {
    const image = area.querySelector("img"),
      matrix = new DOMMatrix(image.style.transform);
    return { x: matrix.e, max: (area.clientWidth * (matrix.a - 1)) / 4 };
  });
  assert.ok(Math.abs(bounds.x) <= bounds.max + 0.01);
  await page.evaluate(() => {
    auditCompare.stop();
    auditCompare.root.remove();
  });
  await page.evaluate(() => {
    const toggle = document.querySelector("#extensions");
    toggle.click();
    toggle.click();
    toggle.click();
  });
  await page.waitForSelector("#extension-demo .compare-view");
  assert.equal(await page.locator("#extension-demo .compare-view").count(), 1);
  await page.locator("#extensions").click();
}
