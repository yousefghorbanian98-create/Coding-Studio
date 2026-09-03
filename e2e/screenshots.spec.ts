import { expect, test, type Page } from '@playwright/test';

/**
 * Captures the reference UI states for review. These are uploaded as a CI
 * artifact so the shell can be inspected without a local browser.
 *
 * Every shot uses a fixed viewport, a fixed scenario and disabled animation so
 * the images stay comparable between runs.
 */

const OUT = 'screenshots';

/** Kills transitions so a screenshot never catches a half-finished animation. */
async function freezeMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      caret-color: transparent !important;
    }`,
  });
}

async function boot(page: Page, scenario?: string): Promise<void> {
  await page.goto(scenario === undefined ? '/' : `/?scenario=${scenario}`);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await freezeMotion(page);
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.getByTestId('rail-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId('settings-nav-appearance').click();
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

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId('composer-input').fill(text);
  await page.getByTestId('send-button').click();
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// -- theme and language reference -------------------------------------------

for (const theme of ['dark', 'light'] as const) {
  for (const lang of ['en', 'fa'] as const) {
    test(`shell — ${theme} / ${lang}`, async ({ page }) => {
      await boot(page);
      await setTheme(page, theme);
      await setLanguage(page, lang);
      await shoot(page, `shell-${theme}-${lang}`);
    });
  }
}

// -- the twelve mandatory product states ------------------------------------

test('01 onboarding', async ({ page }) => {
  await boot(page, 'recent-projects');
  await shoot(page, '01-onboarding');
});

test('02 empty workspace', async ({ page }) => {
  await boot(page, 'empty-project');
  await page.getByTestId('sidebar-new-session').click();
  await shoot(page, '02-empty-workspace');
});

test('03 active streaming conversation', async ({ page }) => {
  await boot(page, 'long-streaming');
  await send(page, 'Walk me through the runtime bridge');
  await expect(page.getByTestId('stop-button')).toBeVisible();
  await shoot(page, '03-streaming');
});

test('04 plan awaiting approval', async ({ page }) => {
  await boot(page, 'plan-awaiting-approval');
  await send(page, 'Refactor the transport layer');
  await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 30_000 });
  await shoot(page, '04-plan-awaiting-approval');
});

test('05 tool activity timeline', async ({ page }) => {
  await boot(page, 'running-tests');
  await send(page, 'Run the test suite');
  await expect(page.getByTestId('tool-timeline')).toBeVisible({
    timeout: 30_000,
  });
  await shoot(page, '05-tool-timeline');
});

test('06 approval request', async ({ page }) => {
  await boot(page, 'shell-approval');
  await send(page, 'Run the tests for me');
  await expect(page.getByTestId('approval-card')).toBeVisible({
    timeout: 30_000,
  });
  await shoot(page, '06-approval');
});

test('07 multi-file diff', async ({ page }) => {
  await boot(page, 'multi-file-changes');
  await page.getByTestId('rail-changes').click();
  await expect(page.getByTestId('diff-viewer')).toBeVisible();
  await shoot(page, '07-multi-file-diff');
});

test('08 running tests in the panel', async ({ page }) => {
  await boot(page, 'running-tests');
  await page.keyboard.press('Control+`');
  await expect(page.getByTestId('bottom-panel')).toBeVisible();
  await shoot(page, '08-running-tests');
});

test('09 runtime error', async ({ page }) => {
  await boot(page, 'runtime-unavailable');
  await expect(page.getByTestId('runtime-banner')).toBeVisible({
    timeout: 30_000,
  });
  await shoot(page, '09-runtime-error');
});

test('10 settings and providers', async ({ page }) => {
  await boot(page);
  await page.getByTestId('rail-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId('settings-nav-providers').click();
  await expect(page.getByTestId('settings-panel-providers')).toBeVisible();
  await shoot(page, '10-settings-providers');
});

test('11 session history', async ({ page }) => {
  await boot(page);
  await page.getByTestId('rail-sessions').click();
  await expect(page.getByTestId('session-list')).toBeVisible();
  await shoot(page, '11-session-history');
});

test('12 multi-agent demonstration', async ({ page }) => {
  await boot(page, 'multi-agent');
  await send(page, 'Coordinate the refactor across agents');
  // This scenario emits agent.* events, not tool calls, so the roster is the
  // surface that proves it arrived.
  await expect(page.getByTestId('agent-roster')).toBeVisible({
    timeout: 30_000,
  });
  await shoot(page, '12-multi-agent');
});

// -- supporting reference shots ---------------------------------------------

test('command palette', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await shoot(page, 'command-palette');
});

test('explorer and search', async ({ page }) => {
  await boot(page);
  await page.getByTestId('rail-search').click();
  await page.getByTestId('search-input').fill('runtime');
  await expect(page.getByTestId('search-summary')).toBeVisible();
  await shoot(page, 'search-results');
});

test('settings — light / fa', async ({ page }) => {
  await boot(page);
  await setLanguage(page, 'fa');
  await page.getByTestId('rail-settings').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId('settings-theme-light').click();
  await shoot(page, 'settings-light-fa');
});

test.describe('scaling reference', () => {
  test.use({ deviceScaleFactor: 1.25 });

  test('shell at 125% scale', async ({ page }) => {
    await boot(page);
    await setTheme(page, 'dark');
    await shoot(page, 'shell-125-dark-en');
  });
});
