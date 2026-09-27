// Generates iOS PWA launch ("startup") images: the Betbooks boot splash
// (brand-navy background, green book mark, wordmark, empty progress track)
// rendered at each iPhone's exact device resolution. iOS ignores the manifest
// background_color for the launch screen and shows white unless an
// apple-touch-startup-image matches the device exactly — these make the native
// launch screen show the same branded splash as the in-app boot screen, so the
// app opens straight into the splash with no white (or blank navy) flash.
//
// The layout mirrors #boot in index.html exactly (same markup, sizes and gap)
// so the static launch image and the live boot splash line up pixel-for-pixel;
// the progress bar is drawn as an empty track to match the first animation
// frame (the fill slides in from off-screen left once the web view mounts).
//
// Rendered with headless Chrome (no native image deps). Point CHROME_BIN at a
// Chrome/Chromium binary, or rely on the common paths below.
// Run: node scripts/gen-splash.mjs   (writes to public/splash/)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'splash');

// [deviceW, deviceH, cssW, cssH, ratio] — portrait iPhones, SE → 16 Pro Max.
const SIZES = [
  [640, 1136, 320, 568, 2], [750, 1334, 375, 667, 2], [828, 1792, 414, 896, 2],
  [1125, 2436, 375, 812, 3], [1170, 2532, 390, 844, 3], [1179, 2556, 393, 852, 3],
  [1206, 2622, 402, 874, 3], [1242, 2208, 414, 736, 3], [1242, 2688, 414, 896, 3],
  [1284, 2778, 428, 926, 3], [1290, 2796, 430, 932, 3], [1320, 2868, 440, 956, 3],
];

// Mirrors #boot in index.html. No web font is loaded (a launch image is a fixed
// raster); the bold system fallback matches the wordmark closely enough.
const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#0b1120}
.wrap{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.bmark{color:#22c55e;display:flex}
.bword{font-weight:800;font-size:27px;letter-spacing:-0.02em;color:#f8fafc}
.bword b{color:#22c55e;font-weight:800}
.bbar{width:116px;height:3px;border-radius:3px;background:rgba(255,255,255,0.14)}
</style></head><body><div class="wrap">
<span class="bmark"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.4C10.3 5 7.7 4.5 3.8 5.1v12.7c3.9-0.6 6.5-0.1 8.2 1.3 1.7-1.4 4.3-1.9 8.2-1.3V5.1C16.3 4.5 13.7 5 12 6.4z"/><path d="M12 6.4v12.7"/></svg></span>
<span class="bword">Bet<b>books</b></span>
<span class="bbar"></span>
</div></body></html>`;

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('No Chrome/Chromium found. Set CHROME_BIN to a Chrome binary.');
}

const chrome = findChrome();
mkdirSync(outDir, { recursive: true });
const htmlPath = join(tmpdir(), 'bt-splash.html');
writeFileSync(htmlPath, HTML);

for (const [dw, dh, cw, ch, ratio] of SIZES) {
  const out = join(outDir, `splash-${dw}x${dh}.png`);
  const profile = join(tmpdir(), `bt-splash-profile-${dw}x${dh}`);
  execFileSync(chrome, [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    `--force-device-scale-factor=${ratio}`, `--window-size=${cw},${ch}`,
    '--virtual-time-budget=600', `--user-data-dir=${profile}`,
    `--screenshot=${out}`, `file://${htmlPath}`,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  rmSync(profile, { recursive: true, force: true });
  console.log(`splash-${dw}x${dh}.png`);
}
rmSync(htmlPath, { force: true });
console.log('done');
