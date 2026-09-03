import { expect, test, type Page } from '@playwright/test';

async function openRail(page: Page, id: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.getByTestId(`rail-${id}`).click();
}

test.describe('explorer, search and changes', () => {
  test('browses the file tree and expands a folder', async ({ page }) => {
    await openRail(page, 'files');
    const explorer = page.getByTestId('explorer');
    await expect(explorer).toBeVisible();

    await expect(page.getByTestId('tree-docs/README.md')).toBeHidden();
    await page.getByTestId('tree-docs').click();
    await expect(page.getByTestId('tree-docs/README.md')).toBeVisible();
  });

  test('collapses every folder from the toolbar', async ({ page }) => {
    await openRail(page, 'files');
    await page.getByTestId('explorer-collapse').click();
    await expect(page.getByTestId('tree-src/components')).toBeHidden();
    await expect(page.getByTestId('tree-src')).toBeVisible();
  });

  test('searches the workspace and reports matches', async ({ page }) => {
    await openRail(page, 'search');
    await page.getByTestId('search-input').fill('runtime');
    await expect(page.getByTestId('search-summary')).toBeVisible();
    await expect(page.locator('mark').first()).toBeVisible();
  });

  test('shows an empty state for a query with no matches', async ({ page }) => {
    await openRail(page, 'search');
    await page.getByTestId('search-input').fill('zzz-no-such-token');
    await expect(page.getByTestId('search-empty')).toBeVisible();
  });

  test('reviews a diff and handles binary files', async ({ page }) => {
    await openRail(page, 'changes');
    await expect(page.getByTestId('diff-table')).toBeVisible();

    await page.getByTestId('change-assets/logo.png').click();
    await expect(page.getByTestId('diff-binary')).toBeVisible();
    await expect(page.getByTestId('diff-table')).toBeHidden();
  });
});

test.describe('bottom panel', () => {
  test('opens with the keyboard and switches tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByTestId('bottom-panel')).toBeHidden();

    await page.keyboard.press('Control+`');
    await expect(page.getByTestId('bottom-panel')).toBeVisible();
    await expect(page.getByTestId('panel-terminal')).toBeVisible();

    await page.getByTestId('panel-tab-problems').click();
    await expect(page.getByTestId('problem-prob-1')).toBeVisible();

    await page.getByTestId('panel-tab-output').click();
    await page.getByTestId('output-channel').selectOption('Build');
    await expect(page.getByTestId('output-o3')).toBeVisible();

    await page.getByTestId('panel-close').click();
    await expect(page.getByTestId('bottom-panel')).toBeHidden();
  });

  test('runs a demo command in the terminal', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+`');
    await page.getByTestId('terminal-input').fill('echo playwright');
    await page.getByTestId('terminal-input').press('Enter');
    await expect(page.getByTestId('panel-terminal')).toContainText('playwright');
  });

  test('renders the workspace views without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await openRail(page, 'files');
    await page.getByTestId('rail-search').click();
    await page.getByTestId('search-input').fill('bridge');
    await page.getByTestId('rail-changes').click();
    await page.keyboard.press('Control+`');
    await expect(page.getByTestId('bottom-panel')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
