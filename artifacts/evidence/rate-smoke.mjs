import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const BASE = process.env.BASE || "http://localhost:5173/";
const out = { speed: {}, date: {}, errors: [] };
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--no-sandbox", "--disable-gpu-sandbox",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (m) => { if (m.type() === "error") out.errors.push(m.text()); });
page.on("pageerror", (e) => out.errors.push(String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("canvas", { timeout: 10000 });
await page.waitForTimeout(1000);

const read = async () => ({
  speed: await page.textContent("#speed-value"),
  date: await page.textContent("#hud-date"),
  upDisabled: await page.isDisabled("#speed-up"),
  downDisabled: await page.isDisabled("#speed-down"),
});

out.initial = await read();
await page.waitForTimeout(2000);
out.after2s = await read(); // date should still advance (animation running)

// Step up a few rungs from default 0.1
await page.click("#speed-up");
out.afterUp1 = await read();
await page.click("#speed-up");
out.afterUp2 = await read();
// Step back down to the default floor
await page.click("#speed-down");
out.afterDown = await read();
// Reset returns to default
await page.click("#speed-reset");
out.afterReset = await read();

console.log(JSON.stringify({ ...out, checkpoints: {
  "default shows 0.1일/초": out.initial.speed === "0.1일/초",
  "date advances while running (not paused)": out.initial.date !== out.after2s.date,
  "stepping up moves 0.1→0.20(0.2)": out.afterUp1.speed === "0.2일/초" || out.afterUp1.speed === "0.2일/초",
  "reset returns to 0.1일/초": out.afterReset.speed === "0.1일/초",
  "down disabled at default floor": out.initial.downDisabled === true,
  "no console/page errors": out.errors.length === 0,
}}, null, 2));
await browser.close();
