// Static comparison of before vs after screenshots: quantifies the soft glow
// hugging the Sun's disc (annulus just outside the solid disc) in each PNG.
import fs from "node:fs";
import zlib from "node:zlib";

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("bad PNG sig");
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data.readUInt8(8); colorType = data.readUInt8(9); }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error("unsupported");
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < width; x++) { const si = x * bpp, di = x * 4; out[(y * width + x) * 4] = cur[si]; out[(y * width + x) * 4 + 1] = cur[si + 1]; out[(y * width + x) * 4 + 2] = cur[si + 2]; out[(y * width + x) * 4 + 3] = colorType === 6 ? cur[si + 3] : 255; }
    prev.set(cur);
  }
  return { width, height, data: out };
}

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function edgeHalo(path) {
  const img = decodePng(fs.readFileSync(path));
  const { width: w, height: h, data } = img;
  const cx = w >> 1, cy = h >> 1;
  const coreR = Math.round(w * 0.045);
  let sum = 0, n = 0;
  for (let dy = -coreR * 2; dy <= coreR * 2; dy++) {
    for (let dx = -coreR * 2; dx <= coreR * 2; dx++) {
      const d = Math.hypot(dx, dy) / coreR;
      if (d < 1.15 || d > 1.6) continue;
      const i = ((cy + dy) * w + (cx + dx)) * 4;
      sum += lum(data[i], data[i + 1], data[i + 2]); n++;
    }
  }
  return +(sum / n).toFixed(1);
}

for (const vp of ["desktop-1280x800", "mobile-390x844"]) {
  const before = edgeHalo(`artifacts/evidence/sun-glow/before/${vp}-home.png`);
  const after = edgeHalo(`artifacts/evidence/sun-glow/after/${vp}-home.png`);
  console.log(`${vp}: before edgeHaloLum=${before}  after edgeHaloLum=${after}  delta=${(after - before).toFixed(1)}`);
}
