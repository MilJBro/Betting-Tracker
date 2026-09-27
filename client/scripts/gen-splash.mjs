// Generates iOS PWA launch ("startup") images: the Betbooks boot splash
// (brand-navy background, green book mark, wordmark, empty progress track)
// rendered at each iPhone's exact device resolution. iOS ignores the manifest
// background_color for the launch screen and shows white unless an
// apple-touch-startup-image matches the device exactly — these make the native
// launch screen show the same branded splash as the in-app boot screen.
//
// Rendered via the DevTools protocol with true mobile device metrics so the
// content is correctly centred at every size. (An earlier version used
// `chrome --headless --screenshot --force-device-scale-factor`, which laid the
// page out at the wrong viewport and pushed the splash off-centre.)
//
// Start Chrome with remote debugging first, then run this:
//   chrome --headless --no-sandbox --disable-gpu \
//     --remote-debugging-port=9222 --user-data-dir=/tmp/splashgen about:blank &
//   node scripts/gen-splash.mjs
// Override the port with CDP_PORT. Writes to public/splash-v2/.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = process.env.CDP_PORT || 9222;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'splash-v2');

// [deviceW, deviceH, cssW, cssH, ratio] — portrait iPhones, SE → 16 Pro Max.
const SIZES = [
  [640, 1136, 320, 568, 2], [750, 1334, 375, 667, 2], [828, 1792, 414, 896, 2],
  [1125, 2436, 375, 812, 3], [1170, 2532, 390, 844, 3], [1179, 2556, 393, 852, 3],
  [1206, 2622, 402, 874, 3], [1242, 2208, 414, 736, 3], [1242, 2688, 414, 896, 3],
  [1284, 2778, 428, 926, 3], [1290, 2796, 430, 932, 3], [1320, 2868, 440, 956, 3],
];

// Mirrors #boot in index.html; the progress bar is an empty track to match the
// first frame of the in-app splash animation.
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
const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(HTML);

const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let idc = 0; const pending = new Map();
const send = (m, p = {}, s) => new Promise((res, rej) => { const id = ++idc; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p, sessionId: s })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } };

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable');
mkdirSync(outDir, { recursive: true });

for (const [dw, dh, cw, ch, ratio] of SIZES) {
  await S('Emulation.setDeviceMetricsOverride', { width: cw, height: ch, deviceScaleFactor: ratio, mobile: true, screenWidth: cw, screenHeight: ch });
  await S('Page.navigate', { url: dataUrl });
  await new Promise((r) => setTimeout(r, 500));
  const { data } = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(outDir, `splash-${dw}x${dh}.png`), Buffer.from(data, 'base64'));
  console.log(`splash-${dw}x${dh}.png`);
}
console.log('done');
ws.close(); process.exit(0);
