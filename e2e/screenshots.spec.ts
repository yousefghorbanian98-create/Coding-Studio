import { expect, test, type Page } from '@playwright/test';

/**
 * Captures the reference UI states for review. These are uploaded as a CI
 * artifact so the shell can be inspected without a local browser.
 */

const OUT = 'screenshots';

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.getByTestId('rail-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId(`settings-theme-${theme}`).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-dialog')).toHaveCount(0);
}

async function setLanguage(page: Page, lang: 'en' | 'fa'): Promise<void> {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  if ((await page.locator('html').getAttribute('dir')) !== dir) {
    await page.getByTestId('titlebar-language').click();
  }
  await expect(page.locator('html')).toHaveAttribute('dir', dir);
}

for (const theme of ['dark', 'light'] as const) {
  for (const lang of ['en', 'fa'] as const) {
    test(`shell — ${theme} / ${lang}`, async ({ page }) => {
      await boot(page);
      await setTheme(page, theme);
      await setLanguage(page, lang);
      // Let the rail indicator and panel transitions settle.
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/shell-${theme}-${lang}.png` });
    });
  }
}

test('inspector open — dark / en', async ({ page }) => {
  await boot(page);
  await setTheme(page, 'dark');
  await page.getByTestId('message-assistant').first().click();
  await page.keyboard.press('Control+i');
  await expect(page.getByTestId('inspector')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/inspector-dark-en.png` });
});

test('command palette — dark / en', async ({ page }) => {
  await boot(page);
  await setTheme(page, 'dark');
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/command-palette-dark-en.png` });
});

test('model selector open — dark / en', async ({ page }) => {
  await boot(page);
  await setTheme(page, 'dark');
  await page.getByTestId('model-selector').click();
  await expect(page.getByTestId('model-selector-popup')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/model-selector-dark-en.png` });
});

test('streaming response — dark / en', async ({ page }) => {
  await boot(page);
  await setTheme(page, 'dark');
  await page.getByTestId('sidebar-new-session').click();
  await page.getByTestId('composer-input').fill('Explain the shell layout');
  await page.getByTestId('send-button').click();
  await expect(page.getByTestId('stop-button')).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/streaming-dark-en.png` });
});

test('settings dialog — light / fa', async ({ page }) => {
  await boot(page);
  await setLanguage(page, 'fa');
  await page.getByTestId('rail-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId('settings-theme-light').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/settings-light-fa.png` });
});

test.describe('scaling reference', () => {
  test.use({ deviceScaleFactor: 1.25 });

  test('shell at 125% scale — dark / en', async ({ page }) => {
    await boot(page);
    await setTheme(page, 'dark');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/shell-125-dark-en.png` });
  });
});
