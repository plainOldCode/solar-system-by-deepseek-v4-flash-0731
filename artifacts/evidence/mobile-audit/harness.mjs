// Mobile-layout + planet-sizing audit harness (reusable before/after).
// Usage: node harness.mjs <out-dir> <mode-label>
// Runs each viewport with mobile/desktop emulation, captures screenshots +
// console + DOM/viewport/canvas metrics + UI layout measurements, and writes
// a JSON summary. Compatible with the project's Playwright Chromium +
// SwiftShader pattern (see ../VERIFICATION.md).
import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "artifacts/evidence/mobile-audit/before";
const LABEL = process.argv[3] || "before";
const BASE = process.env.BASE_URL || "http://localhost:5173/";
const ROOT = process.cwd();

fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "360x800",  w: 360,  h: 800,  mobile: true,  dpr: 3,  touch: true,  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  { name: "390x844",  w: 390,  h: 844,  mobile: true,  dpr: 3,  touch: true,  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  { name: "844x390",  w: 844,  h: 390,  mobile: true,  dpr: 2,  touch: true,  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  { name: "1280x800", w: 1280, h: 800,  mobile: false, dpr: 1,  touch: false, ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" },
];

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--no-sandbox", "--disable-gpu-sandbox", "--force-device-scale-factor=1",
  ],
});

const results = { label: LABEL, generated: new Date().toISOString(), viewports: {} };

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.touch,
    userAgent: vp.ua,
  });
  const page = await ctx.newPage();
  const record = { name: vp.name, pass: {}, fail: {}, warnings: [], measurements: {}, errors: [] };

  page.on("console", (m) => { if (m.type() === "error") record.errors.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => record.errors.push(`pageerror: ${String(e)}`));
  page.on("requestfailed", (r) => record.errors.push(`reqfail: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => { if (r.status() >= 400) record.errors.push(`http ${r.status()}: ${r.url()}`); });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1800); // let rAF + bodies settle

  // Core browser/scene measurements
  const m = await page.evaluate(() => {
    const cv = document.querySelector("canvas");
    const sels = "#hud-header, #info-panel, .control-bar, .kb-hint";
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
               right: Math.round(r.right), bottom: Math.round(r.bottom),
               top: r.top, left: r.left };
    };
    const g = (id) => document.getElementById(id);
    const res = {
      innerW: window.innerWidth, innerH: window.innerHeight,
      outerW: window.outerWidth, outerH: window.outerHeight,
      dpr: window.devicePixelRatio,
      visualViewport: { w: window.visualViewport?.width, h: window.visualViewport?.height,
                        offsetLeft: window.visualViewport?.offsetLeft, offsetTop: window.visualViewport?.offsetTop },
      vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight,
      // document scrolling state
      bodyScrollW: document.body.scrollWidth, bodyScrollH: document.body.scrollHeight,
      docScrollW: document.documentElement.scrollWidth, docScrollH: document.documentElement.scrollHeight,
      bodyScrollX: document.body.scrollLeft || window.scrollX, bodyScrollY: document.body.scrollTop || window.scrollY,
      overflowBody: getComputedStyle(document.body).overflow,
      overflowHtml: getComputedStyle(document.documentElement).overflow,
      // safe area insets
      safeArea: { top: getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-top)"),
                  right: getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-right)"),
                  bottom: getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-bottom)"),
                  left: getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-left)") },
      // canvas
      canvas: cv ? { bufferW: cv.width, bufferH: cv.height, clientW: cv.clientWidth, clientH: cv.clientHeight,
                     cssW: cv.style.width, cssH: cv.style.height,
                     effectiveDPR: cv.width / cv.clientWidth } : null,
      hud: rect(document.querySelector(".hud-header")),
      infoEmpty: rect(document.querySelector("#info-panel")),
      controlBar: rect(document.querySelector(".control-bar")),
      kbHint: rect(document.querySelector(".kb-hint")),
      controls: Array.from(document.querySelectorAll(".ctrl-btn, #body-select, .ctrl-group select")).map((b) => {
        const r = b.getBoundingClientRect();
        return { id: b.id || b.className, tag: b.tagName, w: Math.round(r.width), h: Math.round(r.height) };
      }),
      fonts: {
        hudTitle: getComputedStyle(document.querySelector(".hud-header h1")).fontSize,
        infoTitle: getComputedStyle(document.querySelector(".info-title")).fontSize,
        ctrlBtn: getComputedStyle(document.querySelector(".ctrl-btn")).fontSize,
      },
      touchAction: cv ? getComputedStyle(cv).touchAction : null,
    };
    // Contact/overlap checks vs viewport
    const inVp = (r, vw, vh) => r && r.left >= -2 && r.top >= -2 && r.right <= vw + 2 && r.bottom <= vh + 2;
    res.viewportW = res.innerW; res.viewportH = res.innerH;
    return res;
  });
  record.measurements = m;

  // Evaluated layout checks
  const checks = {
    "document not scrollable (overflow hidden)":
      m.overflowBody === "hidden" && m.overflowHtml === "hidden" && m.docScrollW <= m.innerW && m.docScrollH <= m.innerH,
    "canvas fills viewport (CSS 100%x100%)":
      !!m.canvas && Math.abs(m.canvas.clientW - m.innerW) <= 2 && Math.abs(m.canvas.clientH - m.innerH) <= 2,
    "renderer caps DPR at 2": !!m.canvas && m.canvas.effectiveDPR <= 2.001,
    "HUD header on-screen": m.hud && m.hud.left >= -2 && m.hud.top >= -2 && m.hud.right <= m.innerW + 2,
    "info panel on-screen": m.infoEmpty && m.infoEmpty.left >= -2 && m.infoEmpty.right <= m.innerW + 2,
    "control bar on-screen": m.controlBar && m.controlBar.left >= 0 && m.controlBar.right <= m.innerW,
    "info panel does not overlap control bar": m.infoEmpty && m.controlBar && m.infoEmpty.bottom <= m.controlBar.top + 2,
    "HUD header does not overlap info panel": !m.hud || !m.infoEmpty || m.hud.left >= m.infoEmpty.right - 10 || m.hud.top >= m.infoEmpty.bottom - 10,
    "info panel height within viewport": m.infoEmpty && m.infoEmpty.bottom <= m.innerH + 2,
  };
  for (const [k, v] of Object.entries(checks)) { if (v) record.pass[k] = true; else record.fail[k] = true; }
  if (!checks["document not scrollable (overflow hidden)"]) record.warnings.push("document scrolls — mobile bounce/scroll risk");
  if (m.infoEmpty && m.controlBar && m.infoEmpty.bottom > m.controlBar.top) record.warnings.push("info panel overlaps control bar");
  // Hit-target size guidance (44x44 Apple / 48x48 Android recommendation)
  const smallTargets = (m.controls || []).filter((c) => c.w < 44 || c.h < 44).map((c) => `${c.id}(${c.w}x${c.h})`);
  if (smallTargets.length) record.warnings.push(`small hit targets: ${smallTargets.join(", ")}`);

  // Screenshot: home (empty info) view — this is the layout-critical state
  await page.screenshot({ path: path.join(OUT, `${vp.name}-home.png`) });
  // Also focus a body to expose the populated info panel + control bar together
  try {
    await page.selectOption("#body-select", "earth");
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-focused-earth.png`) });
    const focused = await page.evaluate(() => {
      const info = document.querySelector("#info-panel");
      const cb = document.querySelector(".control-bar");
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { left:b.left, right:b.right, top:b.top, bottom:b.bottom }; };
      return { info: r(info), controlBar: r(cb), infoBottom: r(info)?.bottom, cbTop: r(cb)?.top };
    });
    record.focusedInfo = focused;
    const overlapFocused = focused.info && focused.controlBar && focused.info.bottom > focused.controlBar.top;
    record.checkFocusedOverlap = overlapFocused ? "OVERLAP" : "ok";
    if (overlapFocused) record.warnings.push("POPULATED info panel overlaps control bar");
  } catch (e) {
    record.errors.push(`selectOption earth failed: ${String(e)}`);
  }

  // Touch gesture probe: tap on canvas should not error; simulate a drag
  try {
    const cvBox = await page.locator("canvas").boundingBox();
    if (cvBox) {
      await page.touchscreen.tap(cvBox.x + cvBox.width / 2, cvBox.y + cvBox.height / 2);
      await page.waitForTimeout(300);
      await page.mouse.move(cvBox.x + cvBox.width / 2, cvBox.y + cvBox.height / 2 - 40);
      await page.mouse.down();
      await page.mouse.move(cvBox.x + cvBox.width / 2 + 30, cvBox.y + cvBox.height / 2 - 20, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      record.touchGesture = "ok";
    }
  } catch (e) { record.touchGesture = `error: ${String(e)}`; }

  record.errors_unique = [...new Set(record.errors)];
  record.hasErrors = record.errors_unique.length > 0;
  results.viewports[vp.name] = record;
  await ctx.close();
}

fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
