/**
 * HUD visibility verification harness (Playwright).
 * Verifies the accessible Hide/Show Panels control on desktop + mobile.
 */
import pw from "/opt/homebrew/lib/node_modules/playwright/index.js";
import path from "node:path";
const { chromium } = pw;

const RESULTS = [];
function record(vp, name, ok, detail) {
  RESULTS.push({ vp, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${vp}] ${name} — ${detail}`);
}

async function checkInitial(page, vp) {
  const init = await page.evaluate(() => {
    const bar = document.getElementById("ctrl-panels");
    const root = document.getElementById("app");
    const hid = document.querySelector(".hud-header");
    const info = document.getElementById("info-panel");
    const cbar = document.querySelector(".control-bar");
    const show = document.getElementById("show-panels");
    const anyHidden =
      getComputedStyle(hid).display === "none" ||
      getComputedStyle(info).display === "none" ||
      getComputedStyle(cbar).display === "none";
    return {
      label: bar.textContent.trim(),
      pressed: bar.getAttribute("aria-pressed"),
      rootHidden: root.classList.contains("hud-hidden"),
      anyHidden,
      affordanceHidden: show.hidden,
      affordanceAria: show.getAttribute("aria-label"),
    };
  });
  record(vp, "initial: label/aria",
    init.label === "패널 숨기기" && init.pressed === "true", JSON.stringify(init));
  record(vp, "initial: HUD visible",
    init.rootHidden === false && init.anyHidden === false, JSON.stringify(init));
  record(vp, "initial: affordance hidden",
    init.affordanceHidden === true && init.affordanceAria === "패널 숨기기", JSON.stringify(init));
}

async function checkHidden(page, vp) {
  const hidden = await page.evaluate(() => {
    const root = document.getElementById("app");
    const els = [".hud-header", ".info-panel", ".control-bar", ".kb-hint"]
      .map((s) => document.querySelector(s))
      .map((e) => getComputedStyle(e).display === "none");
    const show = document.getElementById("show-panels");
    return {
      rootHidden: root.classList.contains("hud-hidden"),
      allHidden: els.every(Boolean),
      affordanceShown: show.hidden === false,
      focused: document.activeElement && document.activeElement.id === "show-panels",
      focusAria: document.activeElement?.getAttribute("aria-label"),
      labelsPressed: document.getElementById("ctrl-labels").getAttribute("aria-pressed"),
    };
  });
  record(vp, "hide: root class + entire HUD hidden",
    hidden.rootHidden === true && hidden.allHidden === true, JSON.stringify(hidden));
  record(vp, "hide: persistent affordance present + focused",
    hidden.affordanceShown === true && hidden.focused === true, JSON.stringify(hidden));
  record(vp, "hide: label button reports labels off",
    hidden.labelsPressed === "false", `aria-pressed=${hidden.labelsPressed}`);
  record(vp, "hide: affordance keyboard-reachable",
    hidden.focusAria === "패널 표시", `focused label=${hidden.focusAria}`);
}

async function checkShown(page, vp) {
  const shown = await page.evaluate(() => {
    const root = document.getElementById("app");
    const show = document.getElementById("show-panels");
    const hid = document.querySelector(".hud-header");
    return {
      rootHidden: root.classList.contains("hud-hidden"),
      affordanceHidden: show.hidden,
      headerVisible: getComputedStyle(hid).display !== "none",
      pressed: document.getElementById("ctrl-panels").getAttribute("aria-pressed"),
    };
  });
  record(vp, "show: HUD restored",
    shown.rootHidden === false && shown.affordanceHidden === true && shown.headerVisible === true && shown.pressed === "true", JSON.stringify(shown));
}

async function runViewport(vp, tag, outPrefix) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    hasTouch: vp.touch,
    isMobile: vp.touch,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto("http://localhost:5173/");
  await page.waitForTimeout(1200);

  await checkInitial(page, tag);
  await page.click("#ctrl-panels");
  await page.waitForTimeout(120);
  await checkHidden(page, tag);
  await page.screenshot({ path: path.resolve("artifacts/evidence/hud", `${outPrefix}-hidden.png`) });

  // keyboard restore via Enter on the focused affordance
  await page.keyboard.press("Enter");
  await page.waitForTimeout(120);
  await checkShown(page, tag);
  await page.screenshot({ path: path.resolve("artifacts/evidence/hud", `${outPrefix}-shown.png`) });

  record(tag, "runtime pageerrors == 0", errs.length === 0, `pageerror count=${errs.length}`);
  await ctx.close();
}

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

await runViewport({ w: 1280, h: 800, touch: false }, "desktop-1280x800", "desktop");
await runViewport({ w: 390, h: 844, touch: true }, "mobile-390x844", "mobile");

const fails = RESULTS.filter((r) => !r.ok);
console.log(`\nTOTAL: ${RESULTS.length} checks, ${fails.length} failures`);
if (fails.length) {
  console.log("FAILED:");
  for (const f of fails) console.log(`  [${f.vp}] ${f.name} — ${f.detail}`);
  process.exit(1);
}
process.exit(0);
