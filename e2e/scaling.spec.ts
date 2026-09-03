import { expect, test, type Page } from '@playwright/test';

/**
 * Windows display scaling (100% / 125% / 150%) maps to deviceScaleFactor in
 * Chromium. The shell must keep its fixed chrome intact and never overflow the
 * viewport horizontally at any of them.
 */
const SCALES = [
  { label: '100%', deviceScaleFactor: 1 },
  { label: '125%', deviceScaleFactor: 1.25 },
  { label: '150%', deviceScaleFactor: 1.5 },
] as const;

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return { scroll: el.scrollWidth, client: el.clientWidth };
  });
  // Allow a single pixel for sub-pixel rounding at fractional scale factors.
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
}

for (const scale of SCALES) {
  test.describe(`display scaling ${scale.label}`, () => {
    test.use({ deviceScaleFactor: scale.deviceScaleFactor });

    test(`shell layout holds together at ${scale.label}`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('app-shell')).toBeVisible();

      // Every region still present and visible.
      for (const id of [
        'title-bar',
        'activity-rail',
        'sidebar',
        'chat-area',
        'status-bar',
        'composer',
      ]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }

      await assertNoHorizontalOverflow(page);
    });

    test(`fixed chrome keeps its CSS size at ${scale.label}`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('app-shell')).toBeVisible();

      // These are CSS-pixel sizes and must not drift with the scale factor.
      const titleBar = await page.getByTestId('title-bar').boundingBox();
      const rail = await page.getByTestId('activity-rail').boundingBox();
      const statusBar = await page.getByTestId('status-bar').boundingBox();

      expect(Math.round(titleBar?.height ?? 0)).toBe(36);
      expect(Math.round(rail?.width ?? 0)).toBe(48);
      expect(Math.round(statusBar?.height ?? 0)).toBe(24);
    });

    test(`panels stay inside the viewport at ${scale.label}`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('app-shell')).toBeVisible();
      await page.keyboard.press('Control+i');
      await expect(page.getByTestId('inspector')).toBeVisible();

      const viewport = page.viewportSize();
      const inspector = await page.getByTestId('inspector').boundingBox();
      expect(inspector).not.toBeNull();
      // The inspector must not be pushed off the right-hand edge.
      expect((inspector?.x ?? 0) + (inspector?.width ?? 0)).toBeLessThanOrEqual(
        (viewport?.width ?? 0) + 1,
      );

      await assertNoHorizontalOverflow(page);
    });

    test(`RTL layout holds together at ${scale.label}`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('app-shell')).toBeVisible();

      await page.getByTestId('titlebar-language').click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

      await expect(page.getByTestId('activity-rail')).toBeVisible();
      await expect(page.getByTestId('sidebar')).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  });
}

test.describe('small window', () => {
  test.use({ viewport: { width: 900, height: 600 } });

  test('shell survives the configured minimum window size', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByTestId('chat-area')).toBeVisible();
    await expect(page.getByTestId('composer')).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
