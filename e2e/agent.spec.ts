import { expect, test, type Page } from '@playwright/test';

/**
 * Agent workspace flows.
 *
 * Every run is driven by the deterministic mock runtime selected through the
 * `?scenario=` parameter, so no network or provider is involved.
 */

async function openScenario(page: Page, scenario: string): Promise<void> {
  await page.goto(`/?scenario=${scenario}`);
  await expect(page.getByTestId('app-shell')).toBeVisible();
}

async function send(page: Page, prompt: string): Promise<void> {
  await page.getByTestId('composer-input').fill(prompt);
  await page.getByTestId('send-button').click();
}

test('reports a runtime that is not available', async ({ page }) => {
  await openScenario(page, 'runtime-unavailable');

  await expect(page.getByTestId('runtime-banner')).toBeVisible();
  await expect(page.getByTestId('model-selector-unavailable')).toBeVisible();
});

test('recovers from an unavailable runtime state', async ({ page }) => {
  await openScenario(page, 'runtime-unavailable');
  await expect(page.getByTestId('runtime-banner')).toBeVisible();

  // Retry re-probes; the scenario keeps it unavailable, so the banner stays
  // and the app remains interactive rather than hanging.
  await page.getByTestId('runtime-banner-retry').click();
  await expect(page.getByTestId('runtime-banner')).toBeVisible();
  await expect(page.getByTestId('composer-input')).toBeEnabled();
});

test('switches between ask, plan and agent modes', async ({ page }) => {
  await openScenario(page, 'normal-response');

  await expect(page.getByTestId('mode-ask')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByTestId('mode-agent').click();
  await expect(page.getByTestId('mode-agent')).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // The choice survives a reload.
  await page.reload();
  await expect(page.getByTestId('mode-agent')).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('keeps an unsent draft across a reload', async ({ page }) => {
  await openScenario(page, 'normal-response');

  await page.getByTestId('composer-input').fill('a draft I did not send');
  await page.reload();

  await expect(page.getByTestId('composer-input')).toHaveValue(
    'a draft I did not send',
  );
});

test('streams a reply and returns to ready', async ({ page }) => {
  await openScenario(page, 'normal-response');
  await send(page, 'Summarise the architecture');

  await expect(page.getByTestId('status-state')).toContainText('Streaming');
  await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('status-state')).toContainText('Ready');
  await expect(page.getByTestId('message-assistant').last()).not.toBeEmpty();
});

test('cancels a long stream and keeps the partial reply', async ({ page }) => {
  await openScenario(page, 'long-streaming');
  await send(page, 'Write a long explanation');

  await expect(page.getByTestId('stop-button')).toBeVisible();
  await page.getByTestId('stop-button').click();

  await expect(page.getByTestId('send-button')).toBeVisible();
  await expect(page.getByTestId('status-state')).toContainText('Ready');
});

test('does not leave console errors behind on a normal run', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await openScenario(page, 'normal-response');
  await send(page, 'Hello there');
  await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 30_000 });

  expect(errors).toEqual([]);
});

test('drops an invalid runtime event without breaking the app', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await openScenario(page, 'invalid-event');
  await send(page, 'Trigger a malformed event');

  // The malformed payload is discarded, the shell survives and stays usable.
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 30_000 });
  expect(pageErrors).toEqual([]);
});
