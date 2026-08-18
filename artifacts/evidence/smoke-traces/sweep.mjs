import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const ev = [];
const pageErrs = [];
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox","--window-size=1280,800"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => pageErrs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") ev.push(m.text()); });
page.on("requestfailed", (r) => ev.push(`REQFAIL ${r.url()}`));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector("canvas");
await page.waitForTimeout(1500);

const ids = await page.evaluate(() => Array.from(document.querySelector("#body-select").options).map(o => o.value));
const results = [];
for (const id of ids) {
  await page.selectOption("#body-select", id);
  await page.waitForTimeout(250);
  const t = await page.textContent("#info-title-ko").catch(() => null);
  const isNew = await page.evaluate(() => document.querySelector("#info-panel").classList.contains("new") ||
     !document.querySelector("#info-panel").classList.contains("empty"));
  results.push({ id, infoTitle: t, panelActive: !(await page.evaluate(() => document.querySelector("#info-panel").classList.contains("empty"))) });
}
console.log(JSON.stringify({ count: results.length, results, pageErrs, consoleErrs: ev }, null, 2));
await browser.close();
