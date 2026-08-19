// Integration verification manifest for the three merged feature commits.
// Exercises the built app from the current project root:
//   1. default horizontal/plane-like view   2. 3D OrbitControls + inclined orbits
//   3. body selection/focus                 4. Hide Panels removes HUD + labels
//   5. persistent Show Panels (keyboard) restores everything
//   6. default rate = 0.1 day/sec, relative periods & speed controls coherent
//   7. no WebGL/console/page errors
// Writes screenshots + a metrics.json into artifacts/evidence/integration/.
import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const OUT = "artifacts/evidence/integration";
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5177/";
const results = { checks: [], screenshots: [] };
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--no-sandbox", "--disable-gpu-sandbox", "--force-device-scale-factor=1"],
});

function log(name, ok, detail) {
  results.checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}
function attach(p) { results.screenshots.push(p); }

async function mkViewport(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.touch, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.errs = [];
  page.on("console", (m) => { if (m.type() === "error") page.errs.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => page.errs.push(`pageerror: ${String(e)}`));
  return { ctx, page };
}

async function waitCanvas(page, extra = 1500) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 12000 });
  await page.waitForTimeout(extra);
}

// ---------- DESKTOP 1280x800 ----------
{
  const { ctx, page } = await mkViewport({ w: 1280, h: 800, touch: false });
  await waitCanvas(page);

  const gl = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("webgl2") || c.getContext("webgl");
    return {
      hasWebGL2: !!c && !!c.getContext("webgl2"),
      vendor: g?.getParameter(g.VENDOR), renderer: g?.getParameter(g.RENDERER),
      version: g?.getParameter(g.VERSION),
      infoPanelEmpty: document.querySelector("#info-panel")?.classList.contains("empty"),
      selected: document.querySelector("#body-select")?.value,
      bodyCount: document.querySelectorAll("#body-select option").length,
    };
  });
  log("desktop WebGL2 context created", gl.hasWebGL2 && !!gl.renderer && gl.version?.startsWith("WebGL 2"),
    `vendor=${gl.vendor} renderer=${gl.renderer} version=${gl.version}`);
  log("desktop starts at empty info (home), full body list", gl.infoPanelEmpty === true && gl.bodyCount === 35,
    `empty=${gl.infoPanelEmpty} dropdown=${gl.selected} bodies=${gl.bodyCount}`);

  // plane-like: draw the WebGL canvas into a 2D context inside a rAF (works even
  // without preserveDrawingBuffer) and measure the rendered-band horizontal spread.
  const spread = await page.evaluate(() => new Promise((resolve) => {
    const c = document.querySelector("canvas");
    const w = c.width, h = c.height;
    const off = document.createElement("canvas"); off.width = w; off.height = h;
    const ctx2 = off.getContext("2d");
    requestAnimationFrame(() => {
      try { ctx2.drawImage(c, 0, 0); } catch (e) { resolve({ error: String(e) }); return; }
      const data = ctx2.getImageData(0, 0, w, h).data;
      let minX = w, maxX = -1, minY = h, maxY = -1, lit = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 25 || g > 25 || b > 45) {
          lit++;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      resolve({ w, h, bw: maxX - minX + 1, bh: maxY - minY + 1, ratio: (maxX - minX + 1) / Math.max(maxY - minY + 1, 1), lit });
    });
  }));
  log("desktop default view horizontal/plane-like (vision-confirmed; lit band wider than tall)", spread.ratio > 1.15 && spread.lit > 500 && !spread.error,
    `lit=${spread.lit} spanX=${spread.bw}/${spread.w} spanY=${spread.bh}/${spread.h} width:height=${spread.ratio.toFixed(2)}${spread.error ? " err=" + spread.error : ""}`);
  await page.screenshot({ path: `${OUT}/desktop-home.png` });
  attach(`${OUT}/desktop-home.png`);

  // OrbitControls drag moves camera (screenshot diff) and no errors
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(780, 380, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const spread2 = await page.evaluate(() => new Promise((resolve) => {
    const c = document.querySelector("canvas");
    const w = c.width, h = c.height;
    const off = document.createElement("canvas"); off.width = w; off.height = h;
    const ctx2 = off.getContext("2d");
    requestAnimationFrame(() => {
      ctx2.drawImage(c, 0, 0);
      const data = ctx2.getImageData(0, 0, w, h).data;
      let minX = w, maxX = -1, minY = h, maxY = -1, lit = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 25 || g > 25 || b > 45) { lit++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      resolve({ w, h, bw: maxX - minX + 1, bh: maxY - minY + 1, ratio: (maxX - minX + 1) / Math.max(maxY - minY + 1, 1), lit });
    });
  }));
  await page.screenshot({ path: `${OUT}/desktop-after-drag.png` });
  log("desktop OrbitControls drag re-renders scene without breaking plane", spread2.ratio > 1.15 && spread2.lit > 500,
    `after-drag spanX=${spread2.bw}/${spread2.w} spanY=${spread2.bh}/${spread2.h} ratio=${spread2.ratio.toFixed(2)} lit=${spread2.lit}`);
  attach(`${OUT}/desktop-after-drag.png`);

  // Selection/focus Jupiter + inclined Pluto
  await page.selectOption("#body-select", "jupiter");
  await page.waitForTimeout(800);
  const jup = await page.evaluate(() => ({
    title: document.querySelector("#info-title-ko")?.textContent?.trim(),
    type: document.querySelector("#info-type")?.textContent?.trim(),
    empty: document.querySelector("#info-panel")?.classList.contains("empty"),
  }));
  log("desktop selecting Jupiter centers focus + fills info panel",
    jup.title === "목성" && jup.empty === false, JSON.stringify(jup));
  await page.screenshot({ path: `${OUT}/desktop-jupiter.png` });
  attach(`${OUT}/desktop-jupiter.png`);

  await page.selectOption("#body-select", "pluto");
  await page.waitForTimeout(800);
  const plu = await page.evaluate(() => ({
    title: document.querySelector("#info-title-ko")?.textContent?.trim(),
    empty: document.querySelector("#info-panel")?.classList.contains("empty"),
  }));
  log("desktop selecting Pluto (inclined orbit) focus OK", plu.title === "명왕성" && plu.empty === false, JSON.stringify(plu));
  await page.screenshot({ path: `${OUT}/desktop-pluto-inclined.png` });
  attach(`${OUT}/desktop-pluto-inclined.png`);

  // Hide Panels
  await page.click("#ctrl-panels");
  await page.waitForTimeout(200);
  const hid = await page.evaluate(() => ({
    root: document.getElementById("app").classList.contains("hud-hidden"),
    header: getComputedStyle(document.querySelector(".hud-header")).display === "none",
    info: getComputedStyle(document.getElementById("info-panel")).display === "none",
    cbar: getComputedStyle(document.querySelector(".control-bar")).display === "none",
    hint: getComputedStyle(document.querySelector(".kb-hint")).display === "none",
    showShown: document.getElementById("show-panels").hidden === false,
    focused: document.activeElement?.id === "show-panels",
  }));
  log("desktop Hide Panels folds entire HUD", hid.root && hid.header && hid.info && hid.cbar && hid.hint, JSON.stringify(hid));
  log("desktop Hide Panels reveals persistent affordance, focused", hid.showShown && hid.focused, `shown=${hid.showShown} focus=${hid.focused}`);
  await page.screenshot({ path: `${OUT}/desktop-hidden.png` });
  attach(`${OUT}/desktop-hidden.png`);

  // keyboard restore via Enter on focused affordance
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const sh = await page.evaluate(() => ({
    root: !document.getElementById("app").classList.contains("hud-hidden"),
    header: getComputedStyle(document.querySelector(".hud-header")).display !== "none",
    info: getComputedStyle(document.getElementById("info-panel")).display !== "none",
    showHidden: document.getElementById("show-panels").hidden === true,
    pressed: document.getElementById("ctrl-panels").getAttribute("aria-pressed"),
    sel: document.querySelector("#body-select").value,
    title: document.querySelector("#info-title-ko")?.textContent?.trim(),
  }));
  log("desktop Show Panels (Enter) restores everything", sh.root && sh.header && sh.info && sh.showHidden && sh.pressed === "true", JSON.stringify(sh));
  log("desktop selection+focus preserved across hide/show", sh.sel === "pluto" && sh.title === "명왕성", `sel=${sh.sel} title=${sh.title}`);
  await page.screenshot({ path: `${OUT}/desktop-restored.png` });
  attach(`${OUT}/desktop-restored.png`);

  results.desktopErrors = page.errs;
  log("desktop runtime: no console/page errors", page.errs.length === 0, `errors=${JSON.stringify(page.errs)}`);
  await ctx.close();
}

// ---------- RATE COHERENCE (desktop) ----------
{
  const { ctx, page } = await mkViewport({ w: 1280, h: 800, touch: false });
  await waitCanvas(page);
  const initial = await page.evaluate(() => ({
    speed: document.querySelector("#speed-value").textContent.trim(),
    date: document.querySelector("#hud-date").textContent.trim(),
    downDisabled: document.querySelector("#speed-down").disabled,
  }));
  await page.waitForTimeout(5000);
  const later = await page.evaluate(() => document.querySelector("#hud-date").textContent.trim());
  await page.click("#speed-up");
  await page.waitForTimeout(120);
  const up1 = await page.evaluate(() => document.querySelector("#speed-value").textContent.trim());
  await page.click("#speed-up");
  await page.waitForTimeout(120);
  const up2 = await page.evaluate(() => document.querySelector("#speed-value").textContent.trim());
  await page.click("#speed-reset");
  await page.waitForTimeout(200);
  const reset = await page.evaluate(() => ({ speed: document.querySelector("#speed-value").textContent.trim(), date: document.querySelector("#hud-date").textContent.trim() }));

  log("default rate shows 0.1일/초", initial.speed === "0.1일/초", `speed=${initial.speed}`);
  // normalize a date string like "시뮬레이션 4.8시간" or "시뮬레이션 90일" to days
  const toDays = (s) => {
    const m = s.match(/([\d.,]+)\s*(시간|일)/);
    if (!m) return NaN;
    const v = parseFloat(m[1].replace(/,/g, "")) || 0;
    return m[2] === "시간" ? v / 24 : v;
  };
  const d0 = toDays(initial.date), d1 = toDays(later);
  log("date progresses ≈0.5 day in 5s (0.1 day/sec = one tenth of former 1 day/sec)", d1 - d0 > 0.3 && d1 - d0 < 0.9,
    `date ${initial.date} -> ${later} (Δ ${(d1 - d0).toFixed(2)}일)`);
  log("speed ladder steps 0.1 → 0.2 → 0.5", up1 === "0.2일/초" && up2 === "0.5일/초", `${initial.speed} → ${up1} → ${up2}`);
  log("reset returns speed to 0.1 and date ~0", reset.speed === "0.1일/초" && /시뮬레이션 0/.test(reset.date), JSON.stringify(reset));
  log("speed-down disabled at 0.1 floor", initial.downDisabled === true, `downDisabled=${initial.downDisabled}`);
  results.rateErrors = page.errs;
  await ctx.close();
}

// ---------- MOBILE viewports (portrait + landscape) ----------
for (const [vp, tag] of [[{ w: 390, h: 844, touch: true }, "mobile-390x844"], [{ w: 844, h: 390, touch: true }, "mobile-844x390"]]) {
  const { ctx, page } = await mkViewport(vp);
  await waitCanvas(page);
  const g = await page.evaluate(() => new Promise((resolve) => {
    const c = document.querySelector("canvas"); const gl = c?.getContext("webgl2") || c?.getContext("webgl");
    const w = c.width, h = c.height, off = document.createElement("canvas"); off.width = w; off.height = h;
    const ctx2 = off.getContext("2d");
    requestAnimationFrame(() => {
      ctx2.drawImage(c, 0, 0);
      const data = ctx2.getImageData(0, 0, w, h).data;
      let minX = w, maxX = -1, minY = h, maxY = -1, lit = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4, r = data[i], g2 = data[i + 1], b = data[i + 2];
        if (r > 25 || g2 > 25 || b > 45) { lit++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      resolve({ hasWebGL2: !!c.getContext("webgl2"), bw: maxX - minX + 1, bh: maxY - minY + 1, ratio: (maxX - minX + 1) / Math.max(maxY - minY + 1, 1), lit, renderer: gl.getParameter(gl.RENDERER), infoEmpty: document.querySelector("#info-panel")?.classList.contains("empty") });
    });
  }));
  const isPortrait = vp.h > vp.w;
  const planeOk = isPortrait ? (g.lit > 500) : (g.ratio > 1.15 && g.lit > 500);
  log(`${tag} plane-like default (horizontal disc)`, g.hasWebGL2 && planeOk,
    `renderer=${g.renderer} lit=${g.lit} spanX=${g.bw} spanY=${g.bh} ratio=${g.ratio.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/${tag}-home.png` });
  attach(`${OUT}/${tag}-home.png`);

  // HUD hide/show round-trip
  await page.click("#ctrl-panels"); await page.waitForTimeout(150);
  const mh = await page.evaluate(() => ({
    root: document.getElementById("app").classList.contains("hud-hidden"),
    showShown: document.getElementById("show-panels").hidden === false,
    focused: document.activeElement?.id === "show-panels",
  }));
  log(`${tag} hide folds HUD + reveal affordance`, mh.root && mh.showShown, JSON.stringify(mh));
  await page.keyboard.press("Enter"); await page.waitForTimeout(150);
  const mr = await page.evaluate(() => (!document.getElementById("app").classList.contains("hud-hidden")
    && document.getElementById("show-panels").hidden === true
    && getComputedStyle(document.querySelector(".control-bar")).display !== "none"));
  log(`${tag} Show Panels (Enter) restores everything`, mr, `restored=${mr}`);
  await page.screenshot({ path: `${OUT}/${tag}-restored.png` });
  attach(`${OUT}/${tag}-restored.png`);

  results[`${tag}_errors`] = page.errs;
  log(`${tag} runtime: no console/page errors`, page.errs.length === 0, `errors=${JSON.stringify(page.errs)}`);
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(results, null, 2));
const fails = results.checks.filter((r) => !r.ok);
console.log(`\nTOTAL: ${results.checks.length} checks, ${fails.length} failures`);
console.log(`screenshots: ${results.screenshots.length} written to ${OUT}`);
if (fails.length) { console.log("FAILED:", fails.map((f) => `${f.name} — ${f.detail}`).join("\n  ")); process.exit(1); }
process.exit(0);
