// Usage: node tools/shot.mjs <sim> [tab1,tab2,...] [out-prefix]  — screenshots light+dark, prints console errors.
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  let p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { r.statusCode = 404; r.end('nf'); } else { r.setHeader('content-type', types[path.extname(p)] || 'application/octet-stream'); r.end(d); } });
}).listen(0);
const port = srv.address().port;
const [sim, tabsArg, prefix = '/tmp/claude-0/shots/'] = process.argv.slice(2);
fs.mkdirSync(path.dirname(prefix + 'x'), { recursive: true });
const tabs = tabsArg && tabsArg !== '-' ? tabsArg.split(',') : [''];
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('jm-theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  for (const tab of tabs) {
    await page.goto(`http://localhost:${port}/${sim}/${tab ? '#' + tab : ''}`);
    await page.waitForTimeout(500); await page.evaluate(() => document.fonts.ready);
    if (process.env.SCRIPT) { const m = await import(path.resolve(process.env.SCRIPT)); await m.default(page, { tab, theme }); }
    await page.screenshot({ path: `${prefix}${sim.replace(/\W+/g, '_')}-${tab || 'main'}-${theme}.png` });
  }
  console.log(theme, errs.length ? errs.join('\n') : 'no console errors');
  await ctx.close();
}
await browser.close(); srv.close();
