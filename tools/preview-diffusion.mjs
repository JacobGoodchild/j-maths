export default async (page) => {
  const pg = '.tab-page:not([hidden])';
  await page.locator(`${pg} label.toggle`, { hasText: 'Turn slowly' }).click();
  await page.locator(`${pg} .transport .btn.primary`).click();
  await page.mouse.move(5, 5); await page.waitForTimeout(9000);
};
