import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const BASE = "http://localhost:5173/";
const EV = "artifacts/evidence";
const fs = await import("node:fs");

const out = {
  environment: {},
  bodies: { dropdownCount: 0, ids: [] },
  checkpoints: {},
  interactions: {},
  consoleErrors: [],
  pageErrors: [],
  networkFailures: [],
};

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--window-size=1280,800",
    "--force-device-scale-factor=2",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

page.on("console", (m) => {
  if (m.type() === "error") out.consoleErrors.push(m.text());
});
page.on("pageerror", (e) => out.pageErrors.push(String(e)));
page.on("requestfailed", (r) => out.networkFailures.push(`${r.url()} :: ${r.failure()?.errorText}`));
page.on("response", (r) => {
  if (r.status() >= 400) out.networkFailures.push(`HTTP ${r.status()} :: ${r.url()}`);
});

out.environment = {
  userAgent: page.evaluate(() => navigator.userAgent).catch(() => "n/a"),
  webgl: page.evaluate(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return "no";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unknown";
  }).catch(() => "n/a"),
};

await page.goto(BASE, { waitUntil: "networkidle" });

// Mounted nonzero canvas
await page.waitForSelector("canvas", { timeout: 10000 });
await page.waitForTimeout(1500);
const canvasHealth = await page.evaluate(() => {
  const cv = document.querySelector("canvas");
  if (!cv) return { mounted: false };
  return {
    mounted: true,
    bufferW: cv.width,
    bufferH: cv.height,
    clientW: cv.clientWidth,
    clientH: cv.clientHeight,
    bodyChildren: document.querySelector("#app") ? document.querySelectorAll("#app > canvas").length : 0,
  };
});
out.canvas = canvasHealth;
out.checkpoints["canvas mounted & nonzero"] = canvasHealth.bufferW > 0 && canvasHealth.bufferH > 0;

// Dropdown: 35 bodies
const dropdown = await page.evaluate(() => {
  const sel = document.querySelector("#body-select");
  return {
    count: sel ? sel.options.length : 0,
    ids: sel ? Array.from(sel.options).map((o) => o.value) : [],
  };
});
out.bodies = dropdown;
out.checkpoints["dropdown has 35 bodies (sun+8 planets+pluto+25 moons)"] = dropdown.count === 35;
// Verify all 9 planets including Pluto present by id
const required = ["sun","mercury","venus","earth","mars","jupiter","saturn","uranus","neptune","pluto"];
out.checkpoints["sun + 9 named bodies (incl Pluto) selectable"] =
  required.every((id) => dropdown.ids.includes(id));
// Verify moons
const moons = ["moon","phobos","deimos","io","europa","ganymede","callisto","mimas","enceladus","tethys","dione","rhea","titan","iapetus","miranda","ariel","umbriel","titania","oberon","triton","charon","styx","nix"];
out.checkpoints["all major moons in dropdown"] = moons.every((id) => dropdown.ids.includes(id));

// Full-system home screenshot
await page.screenshot({ path: `${EV}/home-full.png` });
const hud1 = await page.textContent("#hud-date");

// Motion evidence
await page.waitForTimeout(2000);
await page.screenshot({ path: `${EV}/motion2.png` });
const hud2 = await page.textContent("#hud-date");

// Labels toggle
await page.click("#ctrl-labels");
const labelsState = await page.getAttribute("#ctrl-labels", "aria-pressed");
const btnText = await page.textContent("#ctrl-labels");
await page.click("#ctrl-labels"); // back on

// Play/pause
const playPressed0 = await page.getAttribute("#ctrl-play", "aria-pressed");
await page.click("#ctrl-play");
const playPressed1 = await page.getAttribute("#ctrl-play", "aria-pressed");
await page.click("#ctrl-play");

// Speed ladder real clicks: reach high speed
const speedStart = await page.textContent("#speed-value");
for (let i = 0; i < 6; i++) await page.click("#speed-up");
const speedHigh = await page.textContent("#speed-value");
await page.click("#speed-down");
const speedAfterDown = await page.textContent("#speed-value");
await page.click("#speed-reset");
const speedAfterReset = await page.textContent("#speed-value");

// Focus a body via dropdown: saturn (rings!)
await page.selectOption("#body-select", "saturn");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${EV}/saturn-focused.png` });
const saturnInfo = await page.textContent("#info-title-ko");

// Focus a moon: titan (saturn's moon)
await page.selectOption("#body-select", "titan");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${EV}/titan-focused.png` });
const titanInfo = await page.textContent("#info-title-ko");

// Prev/next navigation (should stay in dropdown set)
await page.click("#focus-next");
const nextTitle = await page.textContent("#info-title-ko");

// Home reset
await page.click("#ctrl-home");
await page.waitForTimeout(800);
await page.screenshot({ path: `${EV}/home-after-reset.png` });
const homeTitle = await page.textContent("#info-empty") ? "empty" : "has";

// Resize viewport
await page.setViewportSize({ width: 900, height: 600 });
await page.waitForTimeout(1000);
const resized = await page.evaluate(() => {
  const cv = document.querySelector("canvas");
  return { bufferW: cv.width, bufferH: cv.height, clientW: cv.clientWidth, clientH: cv.clientHeight };
});
await page.screenshot({ path: `${EV}/resized-900.png` });

out.interactions = {
  labelsState, btnText,
  playPressed0, playPressed1,
  speedStart, speedHigh, speedAfterDown, speedAfterReset,
  saturnInfo, titanInfo, nextTitle, homeTitle,
  hud1, hud2,
  resized,
};

// canvas rendering helper via WebGL readPixels for higher-confidence non-black check
const webglProbe = await page.evaluate(() => {
  const cv = document.querySelector("canvas");
  const gl = cv.getContext("webgl2") || cv.getContext("webgl");
  if (!gl) return { error: "no webgl2/webgl context on existing canvas", mounted: !!cv };
  try {
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let nonBlack = 0, total = w * h;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 8 || px[i + 1] > 8 || px[i + 2] > 8) nonBlack++;
    }
    return { w, h, nonBlackPercent: +(100 * nonBlack / total).toFixed(1) };
  } catch (e) {
    return { error: String(e), mounted: !!cv };
  }
});
out.webglProbe = webglProbe;

out.checkpoints["no console errors"] = out.consoleErrors.length === 0;
out.checkpoints["no page errors"] = out.pageErrors.length === 0;
out.checkpoints["no network failures"] = out.networkFailures.length === 0;
out.checkpoints["hud-date advances (animation running)"] = hud1 !== hud2;

console.log(JSON.stringify(out, null, 2));
await browser.close();
