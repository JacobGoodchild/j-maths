export default async (page) => {
  const pg = '.tab-page:not([hidden])';
  for (const t of ['Stationary', 'Whole']) await page.locator(`${pg} label.toggle`, { hasText: t }).click();
  await page.locator(`${pg} .transport .btn.primary`).click();
  await page.waitForTimeout(2400);
  await page.locator(`${pg} .transport .btn.primary`).click();
  await page.mouse.move(5, 5); await page.waitForTimeout(250);
};
