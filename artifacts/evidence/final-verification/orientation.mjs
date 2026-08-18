// Supplemental final-verification: orientation/resize handling, camera aspect,
// motion, and canvas tracking across a portrait->landscape orientation change
// plus a plain desktop resize. Writes metrics + screenshots for the artifact.
import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "artifacts/evidence/final-verification/orientation";
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5173/";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--no-sandbox", "--disable-gpu-sandbox", "--force-device-scale-factor=1"],
});
const errors = [];
const results = { orientation: {}, resize: {}, motion: null };

const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const measure = () => ({ vp: [window.innerWidth, window.innerHeight], cw: (document.querySelector("canvas")||{}).clientWidth, ch: (document.querySelector("canvas")||{}).clientHeight, bw: (document.querySelector("canvas")||{}).width, bh: (document.querySelector("canvas")||{}).height, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, infoBottom: (()=>{const r=document.querySelector("#info-panel")?.getBoundingClientRect();return r?r.bottom:null})(), cbTop:(()=>{const r=document.querySelector(".control-bar")?.getBoundingClientRect();return r?r.top:null})() });

// ---------- Orientation change: portrait 360x800 -> landscape 844x390 ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: MOBILE_UA,
  });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type()==="error") errors.push(`console: ${m.text()}`); });
  page.on("pageerror", e => errors.push(`pageerror: ${String(e)}`));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1500);
  const portrait = await page.evaluate(measure);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1200);
  const landscape = await page.evaluate(measure);
  await page.screenshot({ path: path.join(OUT, "orientation-landscape.png") });
  results.orientation = { portrait, landscape };
  // capture info/control overlap after orientation
  const ov = await page.evaluate(() => {
    const i = document.querySelector("#info-panel")?.getBoundingClientRect();
    const c = document.querySelector(".control-bar")?.getBoundingClientRect();
    return { infoBottom: i?.bottom, cbTop: c?.top, overlap: i ? i.bottom > c.top : null };
  });
  results.orientation.overlap = ov;
  await ctx.close();
}

// ---------- Plain desktop resize 1280x800 -> 900x600 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type()==="error") errors.push(`console: ${m.text()}`); });
  page.on("pageerror", e => errors.push(`pageerror: ${String(e)}`));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1200);
  const before = await page.evaluate(measure);
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(measure);
  await page.screenshot({ path: path.join(OUT, "resize-1280x800-to-900x600.png") });
  results.resize = { before, after };
  results.resize.aspectBefore = before.cw / before.ch;
  results.resize.aspectAfter = after.cw / after.ch;
  await ctx.close();
}

// ---------- Motion check (HUD clock advances; scene animates) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type()==="error") errors.push(`console: ${m.text()}`); });
  page.on("pageerror", e => errors.push(`pageerror: ${String(e)}`));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1200);
  const hud1 = await page.evaluate(() => document.querySelector(".hud-header")?.innerText);
  await page.waitForTimeout(2200);
  const hud2 = await page.evaluate(() => document.querySelector(".hud-header")?.innerText);
  await page.screenshot({ path: path.join(OUT, "motion-t0.png") });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "motion-t1.png") });
  results.motion = { hud1, hud2, clockAdvanced: hud1 !== hud2 };
  await ctx.close();
}

results.errors = [...new Set(errors)];
fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
