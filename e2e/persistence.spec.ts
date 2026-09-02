import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test('a sent conversation survives a reload', async ({ page }) => {
  await page.getByTestId('sidebar-new-session').click();
  await page.getByTestId('composer-input').fill('Persist this conversation');
  await page.getByTestId('send-button').click();

  // Wait for the stream to finish so the reply is final.
  await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 30_000 });
  // Compare the rendered body only: the header carries a clock that can tick
  // over between the two reads.
  const replyBefore = await page
    .getByTestId('message-content')
    .last()
    .innerText();

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();

  await expect(page.getByTestId('message-user').last()).toContainText(
    'Persist this conversation',
  );
  await expect(page.getByTestId('message-content').last()).toHaveText(
    replyBefore,
  );
});

test('a new session and its title survive a reload', async ({ page }) => {
  await page.getByTestId('sidebar-new-session').click();
  await page.getByTestId('composer-input').fill('Title from first message');
  await page.getByTestId('send-button').click();
  await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 30_000 });

  const items = page.getByTestId('session-list').getByRole('listitem');
  const countBefore = await items.count();

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();

  await expect(items).toHaveCount(countBefore);
  await expect(
    page.getByTestId('session-list').getByText('Title from first message'),
  ).toBeVisible();
});

test('deleting a session persists across a reload', async ({ page }) => {
  const items = page.getByTestId('session-list').getByRole('listitem');
  const before = await items.count();

  await items.first().hover();
  await items.first().getByRole('button', { name: /delete/i }).click();
  await expect(items).toHaveCount(before - 1);

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(items).toHaveCount(before - 1);
});

test('the selected session is restored after a reload', async ({ page }) => {
  const items = page.getByTestId('session-list').getByRole('listitem');
  await items.nth(1).getByRole('button').first().click();
  const activeTitle = await items.nth(1).innerText();

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();

  const restored = page.getByTestId('session-list').getByRole('listitem');
  const active = restored.filter({ has: page.locator('[aria-current="true"]') });
  await expect(active).toHaveCount(1);
  expect(activeTitle).toContain((await active.innerText()).split('\n')[0] ?? '');
});

test('a stopped reply is kept, not lost, after a reload', async ({ page }) => {
  await page.getByTestId('sidebar-new-session').click();
  await page.getByTestId('composer-input').fill('Stop me midway');
  await page.getByTestId('send-button').click();

  await expect(page.getByTestId('stop-button')).toBeVisible();
  // Let a few tokens arrive before stopping.
  await page.waitForTimeout(500);
  await page.getByTestId('stop-button').click();
  await expect(page.getByTestId('send-button')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('message-user').last()).toContainText(
    'Stop me midway',
  );
  // Nothing should still be rendering a streaming caret after a reload.
  await expect(page.getByTestId('stream-caret')).toHaveCount(0);
});
