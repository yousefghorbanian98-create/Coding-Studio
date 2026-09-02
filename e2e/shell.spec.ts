import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test('renders the full application shell', async ({ page }) => {
  await expect(page.getByTestId('title-bar')).toBeVisible();
  await expect(page.getByTestId('activity-rail')).toBeVisible();
  await expect(page.getByTestId('sidebar')).toBeVisible();
  await expect(page.getByTestId('chat-area')).toBeVisible();
  await expect(page.getByTestId('status-bar')).toBeVisible();
  await expect(page.getByTestId('session-list').getByRole('listitem')).toHaveCount(4);
});

test('toggles the sidebar with the keyboard', async ({ page }) => {
  await expect(page.getByTestId('sidebar')).toBeVisible();
  await page.keyboard.press('Control+b');
  await expect(page.getByTestId('sidebar')).toBeHidden();
  await page.keyboard.press('Control+b');
  await expect(page.getByTestId('sidebar')).toBeVisible();
});

test('resizes the sidebar by dragging the separator', async ({ page }) => {
  const sidebar = page.getByTestId('sidebar');
  const before = (await sidebar.boundingBox())?.width ?? 0;

  const handle = page.getByTestId('sidebar-resize-handle');
  const box = await handle.boundingBox();
  if (!box) throw new Error('resize handle not found');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  const after = (await sidebar.boundingBox())?.width ?? 0;
  expect(after).toBeGreaterThan(before + 50);
});

test('opens and closes the optional inspector', async ({ page }) => {
  await expect(page.getByTestId('inspector')).toHaveCount(0);
  await page.keyboard.press('Control+i');
  await expect(page.getByTestId('inspector')).toBeVisible();
  await page.getByTestId('inspector-close').click();
  await expect(page.getByTestId('inspector')).toHaveCount(0);
});

test('switches theme and language and persists them across reloads', async ({ page }) => {
  const html = page.locator('html');

  await page.getByTestId('titlebar-theme').click();
  const themeAfterToggle = await html.getAttribute('data-theme');

  await page.getByTestId('titlebar-language').click();
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(html).toHaveAttribute('lang', 'fa');

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(html).toHaveAttribute('data-theme', themeAfterToggle ?? 'dark');

  await page.getByTestId('titlebar-language').click();
  await expect(html).toHaveAttribute('dir', 'ltr');
});

test('activity rail switches the sidebar view', async ({ page }) => {
  await page.getByTestId('rail-files').click();
  await expect(page.getByRole('heading', { name: 'Files' })).toBeVisible();
  await page.getByTestId('rail-chat').click();
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
});
