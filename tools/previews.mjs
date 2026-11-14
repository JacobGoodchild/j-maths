// Usage: node tools/previews.mjs <sim-id> [tab] — writes assets/previews/<id>-light.png and -dark.png
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { r.statusCode = 404; r.end(); } else { r.setHeader('content-type', types[path.extname(p)] || 'application/octet-stream'); r.end(d); } }); }).listen(0);
const port = srv.address().port;
const [id, tab = ''] = process.argv.slice(2);
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1120, height: 700 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('jm-theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/sims/${id}/${tab ? '#' + tab : ''}`);
  await page.waitForTimeout(600); await page.evaluate(() => document.fonts.ready);
  if (process.env.SCRIPT) { const m = await import(path.resolve(process.env.SCRIPT)); await m.default(page, { theme }); }
  await page.locator(process.env.SEL || '.tab-page:not([hidden]) .stage').first().screenshot({ path: `${root}/assets/previews/${id}-${theme}.png` });
  await ctx.close();
}
await browser.close(); srv.close();
