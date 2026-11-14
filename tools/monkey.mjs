// Poke every control in every tab of a sim and report console errors. Usage: node tools/monkey.mjs sims/riemann
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.statusCode = 404; r.end(); } else { r.setHeader('content-type', types[path.extname(p)] || 'application/octet-stream'); r.end(d); } }); }).listen(0);
const port = srv.address().port;
const sim = process.argv[2];
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1360, height: 820 } });
const errs = new Set();
pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/GL Driver|GPU stall/.test(m.text()))) errs.add(m.type() + ': ' + m.text()); });
pg.on('pageerror', (e) => errs.add('pageerror: ' + e.message));
pg.on('response', (r) => { if (r.status() >= 400) errs.add(r.status() + ' ' + r.url()); });
await pg.goto(`http://localhost:${port}/${sim}/`); await pg.waitForTimeout(500);
const tabs = await pg.locator('.tab-btn').count();
const V = '.tab-page:not([hidden])';
for (let t = 0; t < Math.max(1, tabs); t++) {
  if (tabs) await pg.locator('.tab-btn').nth(t).click();
  await pg.waitForTimeout(300);
  // dropdowns: try every option
  const dd = pg.locator(`${V} .dropdown`); const nd = await dd.count();
  for (let d = 0; d < nd; d++) {
    const n = await dd.nth(d).locator('li').count();
    for (let i = 0; i < n; i++) {
      await dd.nth(d).locator('> button').click(); await dd.nth(d).locator('li').nth(i).click();
      // each option: wiggle sliders and toggles
      const sl = pg.locator(`${V} input[type=range]:visible`); const ns = await sl.count();
      for (let s = 0; s < ns; s++) { for (const f of [0, 1, 0.5]) { const mn = +(await sl.nth(s).getAttribute('min')), mx = +(await sl.nth(s).getAttribute('max')); await sl.nth(s).fill(String(mn + (mx - mn) * f)).catch(() => {}); } }
      await pg.waitForTimeout(60);
    }
  }
  const tg = pg.locator(`${V} label.toggle`); const nt = await tg.count();
  for (let i = 0; i < nt; i++) await tg.nth(i).click().catch(() => {});
  await pg.waitForTimeout(100);
  const seg = pg.locator(`${V} .seg button`); const nsg = await seg.count();
  for (let i = 0; i < nsg; i++) await seg.nth(i).click({ timeout: 800 }).catch(() => {});
  // transport
  const play = pg.locator(`${V} .transport .btn.primary`); if (await play.count()) { await play.first().click(); await pg.waitForTimeout(700); await play.first().click(); }
  const stepB = pg.locator(`${V} .transport .btn`).nth(1); if (await stepB.count()) for (let i = 0; i < 4; i++) await stepB.click().catch(() => {});
  // random drags + wheel on canvases
  const cv = pg.locator(`${V} canvas`); const nc = await cv.count();
  for (let c = 0; c < nc; c++) {
    const bb = await cv.nth(c).boundingBox(); if (!bb) continue;
    for (let k = 0; k < 6; k++) {
      const x0 = bb.x + Math.random() * bb.width, y0 = bb.y + Math.random() * bb.height;
      await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move(bb.x + Math.random() * bb.width, bb.y + Math.random() * bb.height, { steps: 4 }); await pg.mouse.up();
    }
    await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.mouse.wheel(0, -400); await pg.mouse.wheel(0, 900); await pg.waitForTimeout(50);
    await pg.mouse.dblclick(bb.x + bb.width / 3, bb.y + bb.height / 3);
  }
  await pg.waitForTimeout(200);
}
console.log(sim, errs.size ? [...errs].join('\n') : 'no errors');
await b.close(); srv.close();
