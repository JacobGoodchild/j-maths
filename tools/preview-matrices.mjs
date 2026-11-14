export default async (page) => {
  const pg = '.tab-page:not([hidden])';
  await page.locator(`${pg} .dropdown > button`).first().click();
  await page.locator(`${pg} .dropdown li`, { hasText: 'Shear' }).first().click();
  for (const t of ['Determinant', 'Letter F']) await page.locator(`${pg} label.toggle`, { hasText: t }).click();
  await page.mouse.move(5, 5); await page.waitForTimeout(250);
};
