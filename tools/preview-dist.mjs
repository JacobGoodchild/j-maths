export default async (page) => {
  const pg = '.tab-page:not([hidden])';
  await page.locator(`${pg} label.toggle`, { hasText: 'Exact' }).click();
  await page.locator(`${pg} .slider:has(label:text("Speed")) input`).fill('6');
  await page.locator(`${pg} .transport .btn.primary`).click();
  await page.waitForTimeout(3500);
  await page.locator(`${pg} .transport .btn.primary`).click();
  await page.mouse.move(5, 5); await page.waitForTimeout(300);
};
