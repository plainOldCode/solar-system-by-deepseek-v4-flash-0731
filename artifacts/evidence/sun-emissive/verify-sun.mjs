// Verify the Sun renders as the visibly-brightest emissive object at desktop
// and mobile viewports, and gather console/page-error evidence.
// Usage: node verify-sun.mjs <output-dir>
import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE || "http://localhost:4173/";
const OUT = process.argv[2] || ".";
mkdirSync(OUT, { recursive: true });

async function runViewport(browser, label, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(2500); // let the rAF loop render a few frames

  await page.screenshot({ path: join(OUT, `${label}-home.png`) });

  // Focus the canvas and press ArrowDown: SELECTION_ORDER starts at "sun", so
  // an ArrowDown from an empty selection selects the Sun AND zooms the camera
  // to a comfortable focus distance on it.
  const canvasSel = "canvas";
  await page.focus(canvasSel);
  // Click on empty space first to guarantee a cleared selection (null index).
  await page.click(canvasSel, { position: { x: viewport.width - 40, y: 40 } });
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(1200);
  const infoTitle = await page.textContent("#info-title-ko").catch(() => null);
  await page.screenshot({ path: join(OUT, `${label}-sun-focused.png`) });

  const canvas = await page.$eval("canvas", (c) =>
    JSON.stringify({ w: c.width, h: c.height, dpr: window.devicePixelRatio }),
  );
  await page.close();
  return { viewport, infoTitle, canvas, errors };
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--no-sandbox", "--disable-gpu-sandbox",
  ],
});

const results = {};
results.desktop = await runViewport(browser, "desktop", { width: 1280, height: 800 });
results.mobile = await runViewport(browser, "mobile", { width: 390, height: 844 });

await browser.close();
console.log(JSON.stringify(results, null, 2));
