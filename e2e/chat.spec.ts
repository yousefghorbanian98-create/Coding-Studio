import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test('shows the mock transcript', async ({ page }) => {
  await expect(page.getByTestId('message-assistant').first()).toBeVisible();
  await expect(page.getByTestId('message-user').first()).toBeVisible();
});

test('sends a message and streams a mock reply to completion', async ({ page }) => {
  await page.getByTestId('sidebar-new-session').click();
  await page.getByTestId('composer-input').fill('Explain the shell layout');
  await page.getByTestId('send-button').click();

  await expect(page.getByTestId('message-user')).toContainText(
    'Explain the shell layout',
  );
  await expect(page.getByTestId('status-state')).toContainText('Streaming');
  await expect(page.getByTestId('stop-button')).toBeVisible();

  await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('status-state')).toContainText('Ready');
  await expect(page.getByTestId('message-assistant')).not.toBeEmpty();
});

test('stops a streaming response', async ({ page }) => {
  await page.getByTestId('sidebar-new-session').click();
  await page.getByTestId('composer-input').fill('Write a long refactor plan');
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('stop-button')).toBeVisible();
  await page.getByTestId('stop-button').click();
  await expect(page.getByTestId('send-button')).toBeVisible();
  await expect(page.getByTestId('status-state')).toContainText('Ready');
});

test('stops a streaming response with the Escape key', async ({ page }) => {
  await page.getByTestId('sidebar-new-session').click();
  await page.getByTestId('composer-input').fill('Another long answer');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('stop-button')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('send-button')).toBeVisible();
});

test('selects a different installed model', async ({ page }) => {
  await expect(page.getByTestId('model-selector')).toContainText('llama3.2:3b');
  await page.getByTestId('model-selector').click();
  await page.getByTestId('model-option-qwen2.5-coder:7b').click();
  await expect(page.getByTestId('model-selector')).toContainText('qwen2.5-coder:7b');
});

test('filters and switches sessions', async ({ page }) => {
  await page.getByTestId('sidebar-search').fill('RTL');
  const list = page.getByTestId('session-list');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await list.getByRole('listitem').first().getByRole('button').first().click();
  await expect(page.getByTestId('message-user').first()).toContainText('Persian');
});
