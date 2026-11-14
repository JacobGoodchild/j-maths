export default async (page) => {
  for (const t of ['Cosine', 'Whole curve', 'Triangle', 'Projections']) await page.locator('label.toggle', { hasText: t }).click();
  const box = await page.locator('.plot canvas').first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, s = box.width / 3.2;
  await page.mouse.move(cx + s * Math.cos(1.0), cy - s * Math.sin(1.0)); await page.mouse.down();
  await page.mouse.move(cx + s * Math.cos(2.35), cy - s * Math.sin(2.35), { steps: 6 }); await page.mouse.up();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(200);
};
