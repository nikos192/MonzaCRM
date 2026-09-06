import { test, expect } from '@playwright/test';
test('private pages and APIs never expose demo data without authentication', async ({
  page,
  request,
}) => {
  const direct = await request.get('/leads', { maxRedirects: 0 });
  expect(direct.status()).toBe(307);
  expect(direct.headers().location).toBe('/login');
  await page.goto('/leads');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /driver’s seat/ })).toBeVisible();
  const result = await request.get('/api/crm');
  expect(result.ok()).toBe(false);
  expect(await result.text()).not.toContain('Bennett');
  const mutation = await request.post('/api/crm', {
    data: { action: 'archive', table: 'leads', id: '00000000-0000-4000-8000-000000000400' },
  });
  expect(mutation.status()).toBe(403);
  const file = await request.get('/api/files?id=00000000-0000-4000-8000-000000000400');
  expect(file.ok()).toBe(false);
  const intake = await request.post('/api/leads/intake', { data: { first_name: 'Anonymous' } });
  expect([401, 503]).toContain(intake.status());
  const aiImport = await request.post('/api/ai/leads', {
    headers: { Origin: 'http://localhost:3000' },
    data: { action: 'parse', text: 'Example lead with enough text' },
  });
  expect(aiImport.status()).toBe(401);
});
test('complete enquiry, quote, follow-up, deposit, payment and shipping workflow persists', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await page.getByRole('button', { name: 'New lead', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'A new connection.' });
  await dialog.getByLabel('First name').fill('Taylor');
  await dialog.getByLabel('Last name').fill('Demo');
  await dialog.getByLabel('Email', { exact: true }).fill('taylor.demo@example.com');
  await dialog.getByLabel('Phone', { exact: true }).fill('0400000099');
  await dialog.getByLabel('Vehicle make').fill('BMW');
  await dialog.getByLabel('Vehicle model').fill('M4');
  await dialog.getByLabel('Generation / chassis').fill('G82');
  await dialog.getByLabel('Year', { exact: true }).fill('2024');
  await dialog.getByLabel('Enquiry / notes').fill('Browser workflow test');
  await dialog.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /^Leads/ })
    .click();
  await page.getByLabel('Search leads').fill('Taylor');
  await page
    .getByRole('button', { name: /Taylor Demo/ })
    .first()
    .click();
  dialog = page.getByRole('dialog', { name: 'Taylor Demo', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Change pipeline stage').selectOption({ label: 'Contacted' });
  await expect(dialog.getByLabel('Change pipeline stage')).toHaveValue(
    '00000000-0000-4000-8000-000000000101',
  );
  await dialog.getByRole('button', { name: 'Edit customer', exact: true }).click();
  let form = page.getByRole('dialog', { name: 'Customer details', exact: true });
  await form.getByLabel('Location').fill('Brisbane, QLD');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).not.toBeVisible();
  await expect(dialog.getByText('Brisbane, QLD', { exact: true })).toBeVisible();
  await dialog.getByRole('tab', { name: 'Wheel Specs' }).click();
  await dialog.getByRole('button', { name: 'Add specifications', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Dial in the details.' });
  await form.getByLabel('Wheel design', { exact: true }).fill('MZ-01');
  await form.getByLabel('Diameter (inches)').fill('20');
  await form.getByLabel('Front width').fill('9.5');
  await form.getByLabel('Rear width').fill('10.5');
  await form.getByLabel('Wheel finish', { exact: true }).fill('Brushed titanium');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).not.toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'MZ-01' })).toBeVisible();
  await dialog.getByRole('tab', { name: 'Quote', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create quote', exact: true }).first().click();
  form = page.getByRole('dialog', { name: 'Create a quote' });
  await form.getByLabel('Base price (AUD)').fill('6000');
  await form.getByLabel('Deposit required (AUD)').fill('3000');
  await form.getByLabel('Status', { exact: true }).selectOption('Sent');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).not.toBeVisible();
  await dialog.getByRole('button', { name: 'Revise quote' }).click();
  form = page.getByRole('dialog', { name: 'Revise quote', exact: true });
  await form.getByLabel('Base price (AUD)').fill('6400');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).not.toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Revision history' })).toBeVisible();
  await expect(dialog.locator('.revision-list')).toContainText('$6,000');
  await expect(dialog.locator('.revision-list')).toContainText('$6,400');
  await dialog.getByRole('tab', { name: 'Follow-Ups', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add follow-up' }).click();
  form = page.getByRole('dialog', { name: 'Keep the conversation moving.' });
  await form.getByLabel('Notes / reason').fill('Confirm quote approval');
  await form.getByRole('button', { name: 'Create follow-up', exact: true }).click();
  await expect(form).not.toBeVisible();
  await dialog.getByRole('button', { name: 'Complete follow-up', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Reopen follow-up' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Record deposit', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Make it a Monza order.' });
  await form.getByLabel('Deposit received (AUD)').fill('3200');
  await form.getByLabel('Payment reference').fill('BROWSER-DEP');
  await form.getByRole('button', { name: 'Record deposit & create order' }).click();
  await expect(form).not.toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Order workspace' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Record payment', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Record a payment' });
  await form.getByLabel('External payment reference').fill('BROWSER-BAL');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).not.toBeVisible();
  await expect(dialog.locator('.order-finances')).toContainText('$0');
  await dialog.getByRole('button', { name: 'Manage order' }).click();
  form = page.getByRole('dialog', { name: 'Manage order', exact: true });
  await form.getByLabel('Order stage').selectOption('Shipped');
  await form.getByLabel('Shipping provider').fill('DHL');
  await form.getByLabel('Tracking number').fill('BROWSER123');
  await form.getByLabel('Shipping date', { exact: true }).fill('2026-09-06');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).not.toBeVisible();
  await expect(dialog.getByText('BROWSER123', { exact: true })).toBeVisible();
  await page.reload();
  dialog = page.getByRole('dialog', { name: 'Taylor Demo', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('tab', { name: 'Order', exact: true }).click();
  await expect(dialog.getByText('BROWSER123', { exact: true })).toBeVisible();
  await expect(dialog.locator('.order-finances')).toContainText('$0');
  expect(errors).toEqual([]);
});
test('pipeline drag persists a stage change and global search opens the record', async ({
  page,
}) => {
  await page.goto('/demo?view=pipeline');
  await expect(page.getByRole('heading', { name: 'Sales pipeline.' })).toBeVisible();
  const card = page
    .locator('.kanban-card')
    .filter({ has: page.getByRole('button', { name: 'James Mitchell', exact: true }) });
  const handle = card.getByRole('button', { name: /Drag James/ });
  const source = await handle.boundingBox();
  const target = await page.getByRole('region', { name: 'Contacted', exact: true }).boundingBox();
  expect(source).toBeTruthy();
  expect(target).toBeTruthy();
  await page.mouse.move(source!.x + 5, source!.y + 5);
  await page.mouse.down();
  await page.mouse.move(source!.x + 18, source!.y + 5, { steps: 5 });
  await page.mouse.move(target!.x + 100, target!.y + 180, { steps: 20 });
  await page.mouse.up();
  await expect(
    page
      .getByRole('region', { name: 'Contacted', exact: true })
      .getByRole('button', { name: 'James Mitchell', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Contacted', exact: true })
      .getByRole('button', { name: 'James Mitchell', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Search anything/ }).click();
  await page.getByLabel('Global search').fill('DEMO900010');
  await page
    .getByRole('dialog', { name: 'Find anything.' })
    .getByRole('button', { name: /Jack Wilson/ })
    .click();
  await expect(page.getByRole('dialog', { name: 'Jack Wilson', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order workspace' })).toBeVisible();
});
test('all navigation screens render and mobile layout stays within viewport', async ({ page }) => {
  await page.goto('/demo');
  for (const name of ['Follow-ups', 'Orders', 'Customers']) {
    await page
      .locator('.main-nav')
      .getByRole('link', { name: new RegExp('^' + name) })
      .click();
    await expect(page.getByRole('heading', { name: new RegExp('^' + name + '\\.') })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings.' })).toBeVisible();
  await page.getByRole('button', { name: 'Pipeline stages', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add stage' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'output/playwright/mobile-dashboard.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .locator('.main-nav')
    .getByRole('link', { name: /^Leads/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Leads.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
