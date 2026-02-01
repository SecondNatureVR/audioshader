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

  test('page loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Capture console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto('/');

    // Wait for initialization to complete
    await page.waitForFunction(() => window.app !== undefined, { timeout: 5000 });

    // Filter out known acceptable warnings (e.g., localStorage not having curve settings)
    const criticalErrors = consoleErrors.filter((err) => {
      // Filter out expected errors that aren't bugs
      if (err.includes('Failed to load curve settings')) return false;
      return true;
    });

    // Report any unexpected errors
    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }
    if (consoleWarnings.length > 0) {
      console.log('Console warnings found:', consoleWarnings);
    }

    // Fail test if there are critical errors
    expect(criticalErrors).toHaveLength(0);
  });
});
