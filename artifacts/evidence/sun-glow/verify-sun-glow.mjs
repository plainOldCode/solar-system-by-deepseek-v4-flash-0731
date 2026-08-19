// Verify the Sun glow + lighting in real Chromium/SwiftShader WebGL at desktop
// (1280x800) and mobile (390x844). Captures home + sun-focused screenshots and
// measures the warm Sun/glow region and planet illumination directly from the
// screenshot pixels (SwiftShader clears the drawing buffer, so readPixels on
// the live canvas is unreliable — PNG decode is the robust source of truth).
import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";
import zlib from "node:zlib";

const BASE = "http://localhost:5173/";
const OUT = process.argv[2] || "artifacts/evidence/sun-glow";
fs.mkdirSync(OUT, { recursive: true });
const results = { viewports: {}, errors: [] };

// ---- Minimal PNG decoder (RGBA8) using node's built-in zlib ----
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("bad PNG sig");
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (colorType !== 6 && colorType !== 2) throw new Error(`unsupported color type ${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const si = x * bpp, di = x * 4;
      out[(y * width + x) * 4] = cur[si];
      out[(y * width + x) * 4 + 1] = cur[si + 1];
      out[(y * width + x) * 4 + 2] = cur[si + 2];
      out[(y * width + x) * 4 + 3] = colorType === 6 ? cur[si + 3] : 255;
    }
    prev.set(cur);
  }
  return { width, height, data: out };
}

// Analyze decoded RGBA pixels. Sun projects near the viewport centre because
// the camera looks at the origin. Returns warm/glow/planet metrics.
function analyze(img, logName) {
  const { width: w, height: h, data } = img;
  const cx = w >> 1, cy = h >> 1;
  const at = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const coreR = Math.max(1, Math.round(w * 0.045));
  let warmBright = 0, core = 0, centerLum = 0, centerN = 0;
  for (let dy = -coreR; dy <= coreR; dy++) {
    for (let dx = -coreR; dx <= coreR; dx++) {
      if (dx * dx + dy * dy > coreR * coreR) continue;
      const [r, g, b] = at(cx + dx, cy + dy);
      core++; centerLum += lum(r, g, b);
      if (r > 210 && g > 150 && b < 220) warmBright++;
    }
  }
  centerLum /= Math.max(1, core);
  let glowLum = 0, glowN = 0;
  for (let dy = -coreR * 3; dy <= coreR * 3; dy++) {
    for (let dx = -coreR * 3; dx <= coreR * 3; dx++) {
      const d = Math.hypot(dx, dy) / coreR;
      if (d >= 1.6 && d <= 2.3) {
        const [r, g, b] = at(cx + dx, cy + dy);
        glowLum += lum(r, g, b); glowN++;
      }
    }
  }
  glowLum = glowN ? glowLum / glowN : 0;
  // edgeHalo: annulus just outside the solid disc (fits a soft glow hug). This is
  // the strongest discriminator between a hard-edged circle and a real halo.
  let edgeLum = 0, edgeN = 0;
  for (let dy = -coreR * 2; dy <= coreR * 2; dy++) {
    for (let dx = -coreR * 2; dx <= coreR * 2; dx++) {
      const d = Math.hypot(dx, dy) / coreR;
      if (d >= 1.15 && d <= 1.6) {
        const [r, g, b] = at(cx + dx, cy + dy);
        edgeLum += lum(r, g, b); edgeN++;
      }
    }
  }
  edgeLum = edgeN ? edgeLum / edgeN : 0;
  let nonBlack = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 8 || data[i + 1] > 8 || data[i + 2] > 8) nonBlack++;
  }
  const haloR = Math.round(w * 0.12);
  let planetsLit = 0, planetSample = 0;
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      if (Math.hypot(x - cx, y - cy) <= haloR) continue;
      planetSample++;
      const i = (y * w + x) * 4;
      if (lum(data[i], data[i + 1], data[i + 2]) > 30) planetsLit++;
    }
  }
  return {
    w, h,
    warmBrightPct: +(100 * warmBright / core).toFixed(1),
    centerLum: +centerLum.toFixed(1),
    glowRingLum: +glowLum.toFixed(1),
    edgeHaloLum: +edgeLum.toFixed(1),
    nonBlackPct: +(100 * nonBlack / (w * h)).toFixed(1),
    planetsLitPct: +(100 * planetsLit / planetSample).toFixed(3),
    _logName: logName,
  };
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--no-sandbox", "--disable-gpu-sandbox"],
});
const errors = [];

async function runViewport(name, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name} console: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${name} pageerror: ${String(e)}`));
  page.on("requestfailed", (r) => errors.push(`${name} reqfail: ${r.url()}`));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`${name} http ${r.status()}: ${r.url()}`); });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(1800);
  const homePng = `${OUT}/${name}-home.png`;
  await page.screenshot({ path: homePng });
  const home = analyze(decodePng(fs.readFileSync(homePng)), name + " home");
  try { await page.selectOption("#body-select", "sun"); } catch (e) {}
  await page.waitForTimeout(1500);
  const sunPng = `${OUT}/${name}-sun-focused.png`;
  await page.screenshot({ path: sunPng });
  const sunFocused = analyze(decodePng(fs.readFileSync(sunPng)), name + " sun-focused");
  const webgl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return "no";
    const d = gl.getExtension("WEBGL_debug_renderer_info");
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  results.viewports[name] = { home, sunFocused, webgl };
  await ctx.close();
}

await runViewport("desktop-1280x800", { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false });
await runViewport("mobile-390x844", {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

results.errors = [...new Set(errors)];
results.pass = results.errors.length === 0;
fs.writeFileSync(`${OUT}/metrics.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
