import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('page loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check that the page has loaded
    await expect(page).toHaveTitle(/Lucas|AudioShader/i);
  });

  test('canvas element exists', async ({ page }) => {
    await page.goto('/');

    // Check that the canvas element exists
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();
  });
});
