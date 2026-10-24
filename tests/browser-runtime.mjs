import { browserEnvironment } from "../scripts/browser-environment.mjs";
import { chromium, firefox, webkit } from "playwright";
import { webkitLaunchOptions } from "../scripts/webkit-runtime.mjs";
export async function launchBrowser(engine) {
  if (engine === "chromium")
    return chromium.launch({ headless: true, args: ["--no-sandbox"] });
  if (engine === "firefox")
    return firefox.launch({ headless: true, env: browserEnvironment() });
  if (engine === "webkit") return webkit.launch(webkitLaunchOptions());
  throw Error(`Unsupported shared-suite engine: ${engine}`);
}
export function viewportOptions(engine, options) {
  if (engine !== "firefox") return options;
  const { isMobile, ...supported } = options;
  return supported;
}
/** Firefox and WebKit have no Playwright multi-touch injector; test the recognizer explicitly. */
export async function pinch(page, engine, selector, start = 40, end = 70) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw Error("Pinch target is not visible");
  const x = Math.round(box.x + box.width / 2),
    y = Math.round(box.y + box.height / 2);
  if (engine === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: x - start, y, id: 1 },
          { x: x + start, y, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x - end, y, id: 1 },
          { x: x + end, y, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } finally {
      await cdp.detach();
    }
    return;
  }
  await page.locator(selector).evaluate(
    (element, { x, y, start, end }) => {
      const own = Object.hasOwn(element, "setPointerCapture"),
        capture = element.setPointerCapture;
      element.setPointerCapture = () => {};
      const dispatch = (type, id, clientX) =>
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: id,
            pointerType: "touch",
            clientX,
            clientY: y,
            buttons: type === "pointerup" ? 0 : 1,
            isPrimary: id === 801,
          }),
        );
      try {
        dispatch("pointerdown", 801, x - start);
        dispatch("pointerdown", 802, x + start);
        dispatch("pointermove", 801, x - end);
        dispatch("pointermove", 802, x + end);
        dispatch("pointerup", 801, x - end);
        dispatch("pointerup", 802, x + end);
      } finally {
        if (own) element.setPointerCapture = capture;
        else delete element.setPointerCapture;
      }
    },
    { x, y, start, end },
  );
}
