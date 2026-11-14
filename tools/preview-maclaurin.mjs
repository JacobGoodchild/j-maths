export default async (page) => {
  const pg = '.tab-page:not([hidden])';
  await page.locator(`${pg} .dropdown > button`).click();
  await page.locator(`${pg} .dropdown li`).nth(1).click();
  await page.locator(`${pg} input[type=range]:visible`).nth(0).fill('7');
  await page.locator(`${pg} label.toggle`, { hasText: 'Error' }).click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(200);
};
