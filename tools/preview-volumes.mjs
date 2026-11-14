export default async (page) => {
  const pg = '.tab-page:not([hidden])';
  await page.locator(`${pg} .slider:has(label:text("Sweep")) input`).fill('4.4');
  await page.locator(`${pg} .slider:has(label:text("Discs")) input`).fill('14');
  await page.mouse.move(5, 5); await page.waitForTimeout(600);
};
