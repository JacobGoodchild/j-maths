export default async (page) => {
  const pg = '.tab-page:not([hidden])';
  await page.locator(`${pg} label.toggle`, { hasText: 'Family' }).click();
  await page.mouse.move(5, 5); await page.waitForTimeout(250);
};
