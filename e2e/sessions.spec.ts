import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test('creates a session and keeps it after a reload', async ({ page }) => {
  await page.getByTestId('sidebar-new-session').click();
  await page.getByTestId('composer-input').fill('Persisted prompt');
  await page.getByTestId('send-button').click();
  await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('message-scroll')).toContainText(
    'Persisted prompt',
  );
});

test('renames a session from the row menu', async ({ page }) => {
  const first = page.getByTestId('session-list').getByRole('listitem').first();
  const actions = first.locator('[data-testid^="session-actions-"]');
  await actions.click();
  await first.locator('[data-testid^="session-action-rename-"]').click();

  const input = first.locator('[data-testid^="session-rename-input-"]');
  await input.fill('Renamed by Playwright');
  await input.press('Enter');

  await expect(page.getByTestId('session-list')).toContainText(
    'Renamed by Playwright',
  );
});

test('pins a session so it sorts to the top', async ({ page }) => {
  const list = page.getByTestId('session-list');
  const second = list.getByRole('listitem').nth(1);
  const title = await second.locator('.truncate').innerText();

  await second.locator('[data-testid^="session-actions-"]').click();
  await second.locator('[data-testid^="session-action-pin-"]').click();

  await expect(list.getByRole('listitem').first()).toContainText(title);
});

test('archives and restores a session', async ({ page }) => {
  const list = page.getByTestId('session-list');
  const target = list.getByRole('listitem').nth(1);
  const title = await target.locator('.truncate').innerText();

  await target.locator('[data-testid^="session-actions-"]').click();
  await target.locator('[data-testid^="session-action-archive-"]').click();
  await expect(list).not.toContainText(title);

  await page.getByTestId('sidebar-toggle-archived').click();
  await expect(page.getByTestId('session-list')).toContainText(title);

  const archived = page.getByTestId('session-list').getByRole('listitem').first();
  await archived.locator('[data-testid^="session-actions-"]').click();
  await archived.locator('[data-testid^="session-action-archive-"]').click();

  await page.getByTestId('sidebar-toggle-archived').click();
  await expect(page.getByTestId('session-list')).toContainText(title);
});

test('asks for confirmation before deleting and can be cancelled', async ({
  page,
}) => {
  const list = page.getByTestId('session-list');
  const before = await list.getByRole('listitem').count();
  const target = list.getByRole('listitem').nth(1);

  await target.locator('[data-testid^="session-actions-"]').click();
  await target.locator('[data-testid^="session-action-delete-"]').click();
  await expect(page.getByRole('alertdialog')).toBeVisible();

  await target.locator('[data-testid^="session-confirm-cancel-"]').click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  expect(await list.getByRole('listitem').count()).toBe(before);

  await target.locator('[data-testid^="session-actions-"]').click();
  await target.locator('[data-testid^="session-action-delete-"]').click();
  await target.locator('[data-testid^="session-confirm-delete-"]').click();
  await expect(list.getByRole('listitem')).toHaveCount(before - 1);
});

test('duplicates a session without touching the original', async ({ page }) => {
  const list = page.getByTestId('session-list');
  const before = await list.getByRole('listitem').count();
  const first = list.getByRole('listitem').first();

  await first.locator('[data-testid^="session-actions-"]').click();
  await first.locator('[data-testid^="session-action-duplicate-"]').click();

  await expect(list.getByRole('listitem')).toHaveCount(before + 1);
  await expect(list).toContainText('(copy)');
});

test('manages sessions without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.getByTestId('sidebar-new-session').click();
  const first = page.getByTestId('session-list').getByRole('listitem').first();
  await first.locator('[data-testid^="session-actions-"]').click();
  await first.locator('[data-testid^="session-action-duplicate-"]').click();
  await page.getByTestId('sidebar-toggle-archived').click();
  await page.getByTestId('sidebar-toggle-archived').click();

  expect(errors).toEqual([]);
});
