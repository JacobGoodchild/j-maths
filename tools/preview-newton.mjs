export default async (page) => {
  const pg = '.tab-page:not([hidden])';
  await page.locator(`${pg} .dropdown > button`).first().click();
  await page.locator(`${pg} .dropdown li`).nth(5).click();
  const st = page.locator(`${pg} .transport .btn`).nth(1);
  for (let i = 0; i < 3; i++) { await st.click(); await page.waitForTimeout(60); }
  await page.mouse.move(5, 5); await page.waitForTimeout(250);
};
