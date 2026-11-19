// play-test.mjs — loads the title screen, presses Enter, holds W, checks the
// game reaches play, the player moves, and no JS errors appear.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell';
const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--window-size=1280,800', '--remote-debugging-port=9224',
  '--user-data-dir=/tmp/solmar-chrome-profile2', 'about:blank'], { stdio: 'ignore' });
async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
      const p = list.find((t) => t.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('no cdp');
}
let id = 0; const pending = new Map();
const ws = new WebSocket(await getWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:8080/index.html?seed=7' });
await sleep(3000);
console.log('title screen:', await ev('window.__game.state.screen'));
console.log('errors:', JSON.stringify(await ev('window.__errors')));
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 });
await sleep(500);
console.log('after Enter screen:', await ev('window.__game.state.screen'));
const before = await ev('[window.__game.player.x, window.__game.player.z]');
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
await sleep(2000);
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
const after = await ev('[window.__game.player.x, window.__game.player.z]');
console.log('player moved:', JSON.stringify(before), '->', JSON.stringify(after));
console.log('traffic:', await ev('window.__game.traffic.length'), 'peds:', await ev('window.__game.peds.length'));
console.log('errors:', JSON.stringify(await ev('window.__errors')));
console.log('shot of live play:');
const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
const { writeFileSync } = await import('node:fs');
writeFileSync('/tmp/live-play.jpg', Buffer.from(shot.result.data, 'base64'));
ws.close(); chrome.kill(); process.exit(0);
