import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test('opens the command palette with Ctrl+K and runs a command', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();

  await page.getByTestId('palette-input').fill('inspector');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('command-palette')).toHaveCount(0);
  await expect(page.getByTestId('inspector')).toBeVisible();
});

test('closes the palette with Escape', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('command-palette')).toHaveCount(0);
});

test('creates a new session from the palette', async ({ page }) => {
  const items = page.getByTestId('session-list').getByRole('listitem');
  const before = await items.count();

  await page.keyboard.press('Control+k');
  await page.getByTestId('palette-input').fill('new session');
  await page.getByTestId('palette-item-new-session').click();

  await expect(items).toHaveCount(before + 1);
});

test('changes appearance settings and persists them', async ({ page }) => {
  await page.getByTestId('rail-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();

  await page.getByTestId('settings-theme-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByTestId('settings-density-compact').click();
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
});

test('shows the keyboard shortcuts dialog with ?', async ({ page }) => {
  await page.keyboard.press('?');
  await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
  await expect(page.getByTestId('shortcuts-dialog')).toContainText('Ctrl');
});
