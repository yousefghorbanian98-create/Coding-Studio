import { expect, test, type Page } from '@playwright/test';

async function openPalette(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();
}

test('opens and closes the palette from the keyboard', async ({ page }) => {
  await openPalette(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('command-palette')).toBeHidden();
});

test('finds a command from an abbreviation', async ({ page }) => {
  await openPalette(page);
  await page.getByTestId('palette-input').fill('tsb');
  await expect(page.getByTestId('palette-item-toggle-sidebar')).toBeVisible();
});

test('ranks the literal match first and runs it with Enter', async ({
  page,
}) => {
  await openPalette(page);
  await page.getByTestId('palette-input').fill('bottom panel');
  await expect(page.getByRole('option').first()).toHaveAttribute(
    'data-testid',
    'palette-item-toggle-panel',
  );

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('command-palette')).toBeHidden();
  await expect(page.getByTestId('bottom-panel')).toBeVisible();
});

test('explains a disabled command instead of failing on click', async ({
  page,
}) => {
  await openPalette(page);
  const cancel = page.getByTestId('palette-item-stop-streaming');
  await expect(cancel).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('palette-disabled-stop-streaming')).toBeVisible();

  await cancel.click();
  await expect(page.getByTestId('command-palette')).toBeVisible();
});

test('never highlights a command that cannot be run', async ({ page }) => {
  await openPalette(page);
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('ArrowDown');
    const selected = page.locator('[role="option"][aria-selected="true"]');
    await expect(selected).toHaveAttribute('aria-disabled', 'false');
  }
});

test('switches agent mode from the palette', async ({ page }) => {
  await openPalette(page);
  await page.getByTestId('palette-input').fill('plan mode');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('mode-plan')).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('restores focus to the composer after the palette closes', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.getByTestId('composer-input').click();

  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('composer-input')).toBeFocused();
});

test('opens a searchable shortcut reference', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.keyboard.press('?');
  await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();

  await page.getByTestId('shortcuts-search').fill('sidebar');
  await expect(page.getByTestId('shortcut-toggleSidebar')).toBeVisible();
  await expect(page.getByTestId('shortcut-palette')).toBeHidden();

  await page.getByTestId('shortcuts-search').fill('zzzqqq');
  await expect(page.getByTestId('shortcuts-empty')).toBeVisible();
});

test('drives the workspace by keyboard without console errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();

  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+`');
  await page.keyboard.press('Control+`');
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});
