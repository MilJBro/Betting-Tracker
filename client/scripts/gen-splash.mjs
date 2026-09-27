// Generates iOS PWA launch ("startup") images: solid brand-navy PNGs at each
// iPhone's exact device resolution. iOS ignores the manifest background_color
// for the launch screen and shows white unless an apple-touch-startup-image
// matches the device exactly — these remove that white flash so the native
// launch screen is the same #0b1120 as the in-app boot splash.
//
// Solid colour compresses to a couple of KB regardless of pixel dimensions.
// Run: node scripts/gen-splash.mjs   (writes to public/splash/)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BG = [0x0b, 0x11, 0x20]; // #0b1120
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'splash');

// device px [w, h] for portrait iPhones, current through iPhone 16 Pro Max.
const SIZES = [
  [640, 1136], [750, 1334], [828, 1792], [1125, 2436], [1170, 2532],
  [1179, 2556], [1206, 2622], [1242, 2208], [1242, 2688], [1284, 2778],
  [1290, 2796], [1320, 2868],
];

// --- minimal PNG encoder (CRC32 + IHDR/IDAT/IEND) ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function solidPng(w, h, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour RGB
  // raw scanlines: each row = filter byte (0) + w*3 colour bytes
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(outDir, { recursive: true });
for (const [w, h] of SIZES) {
  const png = solidPng(w, h, BG);
  writeFileSync(join(outDir, `splash-${w}x${h}.png`), png);
  console.log(`splash-${w}x${h}.png  ${(png.length / 1024).toFixed(1)} KB`);
}
console.log('done');
