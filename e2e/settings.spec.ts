import { expect, test, type Page } from '@playwright/test';

async function openSettings(page: Page, section?: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.getByTestId('rail-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  if (section !== undefined) {
    await page.getByTestId(`settings-nav-${section}`).click();
  }
}

test('navigates between the settings sections', async ({ page }) => {
  await openSettings(page);
  await expect(page.getByTestId('settings-panel-appearance')).toBeVisible();

  await page.getByTestId('settings-nav-runtime').click();
  await expect(page.getByTestId('settings-panel-runtime')).toBeVisible();

  await page.getByTestId('settings-nav-about').click();
  await expect(page.getByTestId('settings-panel-about')).toBeVisible();
});

test('reports the mock runtime and its versions', async ({ page }) => {
  await openSettings(page, 'runtime');
  await expect(page.getByTestId('runtime-kind')).toHaveText('mock');
  await expect(page.getByTestId('runtime-schema')).toHaveText('1.0.0');
  await expect(page.getByTestId('runtime-jcode')).toContainText(/not installed/i);
});

test('re-checks the runtime on demand', async ({ page }) => {
  await openSettings(page, 'runtime');
  await page.getByTestId('runtime-recheck').click();
  await expect(page.getByTestId('runtime-version')).toHaveText('mock-1.0.0');
});

test('shows unbuilt providers as disabled with a reason', async ({ page }) => {
  await openSettings(page, 'providers');
  await expect(page.getByTestId('provider-demo')).toBeEnabled();

  for (const id of ['anthropic', 'openai', 'google', 'copilot', 'custom']) {
    await expect(page.getByTestId(`provider-${id}`)).toBeDisabled();
  }
  await expect(page.getByTestId('provider-anthropic')).toContainText(
    /managed runtime/i,
  );
  await expect(page.getByTestId('providers-no-credentials')).toBeVisible();
});

test('permissions default to Ask and warn when relaxed', async ({ page }) => {
  await openSettings(page, 'permissions');
  await expect(page.getByTestId('permission-shell-command-ask')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByTestId('permissions-relaxed')).toBeHidden();

  await page.getByTestId('permission-shell-command-allow').click();
  await expect(
    page.getByTestId('permission-warning-shell-command'),
  ).toBeVisible();
  await expect(page.getByTestId('permissions-relaxed')).toBeVisible();

  await page.getByTestId('permissions-reset').click();
  await expect(page.getByTestId('permission-shell-command-ask')).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('permission choices survive a reload', async ({ page }) => {
  await openSettings(page, 'permissions');
  await page.getByTestId('permission-delete-never').click();

  await page.reload();
  await openSettings(page, 'permissions');
  await expect(page.getByTestId('permission-delete-never')).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('states plainly that agent behaviour is mocked', async ({ page }) => {
  await openSettings(page, 'about');
  await expect(page.getByTestId('about-honesty')).toContainText(
    /not integrated yet/i,
  );
  await expect(page.getByTestId('about-future-sections')).toContainText('MCP');
});

test('never mentions the removed provider in any section', async ({ page }) => {
  await openSettings(page);
  for (const id of [
    'appearance',
    'runtime',
    'providers',
    'permissions',
    'privacy',
    'about',
  ]) {
    await page.getByTestId(`settings-nav-${id}`).click();
    const text = (await page.getByTestId('settings-dialog').innerText())
      .toLowerCase();
    expect(text).not.toContain('ollama');
    expect(text).not.toContain('11434');
  }
});

test('browses every settings section without console errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await openSettings(page);
  for (const id of ['runtime', 'providers', 'permissions', 'privacy', 'about']) {
    await page.getByTestId(`settings-nav-${id}`).click();
  }
  expect(errors).toEqual([]);
});
