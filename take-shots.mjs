// take-shots.mjs — screenshot helper for Solmar Bay (Node 22, stdlib only).
// Drives the Playwright-cached headless_shell over CDP with Node's built-in
// WebSocket: navigates to each ?shot= scene, waits for window.__shotReady,
// captures a 1280x800 PNG/JPEG straight from the viewport (no browser chrome).
// Usage: node take-shots.mjs  (serves game/ on :8080 first, or set PORT)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell';
const PORT = process.env.PORT || 8080;
const SHOTS = [
  ['1-chase.jpg', '?shot=chase&seed=7'],
  ['2-city.jpg', '?shot=city&seed=7'],
  ['3-mission.jpg', '?shot=mission&seed=7'],
  ['4-shootout.jpg', '?shot=foot&seed=7'],
];
const OUT = new URL('./screenshots/', import.meta.url).pathname;

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-sandbox', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--window-size=1280,800',
  '--remote-debugging-port=9223', '--user-data-dir=/tmp/solmar-chrome-profile',
  'about:blank',
], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9223/json/list');
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('CDP did not come up');
}

let id = 0;
const pending = new Map();
const ws = new WebSocket(await getWsUrl());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
function send(method, params) {
  return new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result?.result?.value;
}
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

for (const [name, query] of SHOTS) {
  await send('Page.navigate', { url: `http://localhost:${PORT}/index.html${query}` });
  let ready = false, errors = [];
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    ready = await evalJs('!!window.__shotReady');
    if (ready) break;
  }
  errors = await evalJs(`(window.__errors||[]).slice(0,5)`) || [];
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  writeFileSync(OUT + name, Buffer.from(shot.result.data, 'base64'));
  console.log(name, 'ready=', ready, 'errors=', JSON.stringify(errors));
}
ws.close();
chrome.kill();
process.exit(0);
