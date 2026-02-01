import { test, expect, Page } from '@playwright/test';

test.describe('Direct Value Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await page.waitForSelector('#canvas');
    // Wait for the UI to be ready
    await page.waitForFunction(() => (window as unknown as { app?: unknown }).app !== undefined);
  });

  /**
   * Helper to set a parameter value via app.setParam with immediate flag
   */
  async function setParamValue(
    page: Page,
    paramName: string,
    value: number
  ): Promise<number> {
    return await page.evaluate(
      ({ pName, val }) => {
        const app = (window as unknown as {
          app?: {
            setParam: (n: string, v: number, immediate?: boolean) => void;
            getParam: (n: string) => number;
          };
        }).app;

        if (!app) return 0;

        // Use immediate=true to skip interpolation
        app.setParam(pName, val, true);
        return app.getParam(pName);
      },
      { pName: paramName, val: value }
    );
  }

  /**
   * Helper to get a parameter value
   */
  async function getParamValue(page: Page, paramName: string): Promise<number> {
    return await page.evaluate(
      ({ pName }) => {
        const app = (window as unknown as {
          app?: { getParam: (n: string) => number };
        }).app;
        return app?.getParam(pName) ?? 0;
      },
      { pName: paramName }
    );
  }

  test('app.setParam updates parameter values', async ({ page }) => {
    // Test that we can set and get parameter values
    const newValue = await setParamValue(page, 'hue', 270);
    expect(newValue).toBe(270);

    // Verify we can get the value back
    const gotValue = await getParamValue(page, 'hue');
    expect(gotValue).toBe(270);
  });

  test('slider input updates parameter value', async ({ page }) => {
    const hueSlider = page.locator('#hue-slider');

    // Get the initial value
    const initialValue = await getParamValue(page, 'hue');

    // Change slider value to something different
    const newSliderPos = initialValue === 180 ? 90 : 180;
    await hueSlider.fill(String(newSliderPos));
    await hueSlider.dispatchEvent('input');

    // Wait for the value to update (may be interpolated)
    await page.waitForTimeout(100);

    // Verify the app parameter changed (slider maps position to hue value)
    const newHueValue = await getParamValue(page, 'hue');
    expect(newHueValue).not.toBe(initialValue);
  });

  test('contenteditable value displays exist', async ({ page }) => {
    // Verify all expected value displays have contenteditable
    const editableIds = [
      '#hue-value',
      '#scale-value',
      '#rotation-value',
      '#spike-frequency-value',
      '#jiggle-amount-value',
    ];

    for (const id of editableIds) {
      const element = page.locator(id);
      await expect(element).toHaveAttribute('contenteditable', 'true');
    }
  });

  test('smoke test - all sliders are interactive', async ({ page }) => {
    // Get a list of all range inputs
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();

    // Verify we have sliders
    expect(count).toBeGreaterThan(10);

    // Test that at least one slider works
    const hueSlider = page.locator('#hue-slider');
    const originalValue = await hueSlider.inputValue();

    await hueSlider.fill('200');
    await hueSlider.dispatchEvent('input');

    const newSliderValue = await hueSlider.inputValue();
    expect(newSliderValue).toBe('200');
  });

  test('interpolation settings section expands', async ({ page }) => {
    // Click the interpolation settings header to expand
    const header = page.locator('#interpolation-settings-header');
    await header.click();
    await page.waitForTimeout(200);

    // Verify the duration slider is visible
    const durationSlider = page.locator('#interpolation-duration-slider');
    await expect(durationSlider).toBeVisible();
  });

  test('parameter values persist across slider changes', async ({ page }) => {
    // Set a value
    await setParamValue(page, 'scale', 0.75);

    // Change a different slider
    const hueSlider = page.locator('#hue-slider');
    await hueSlider.fill('100');
    await hueSlider.dispatchEvent('input');

    // Verify the scale value wasn't affected
    const scaleValue = await getParamValue(page, 'scale');
    expect(scaleValue).toBeCloseTo(0.75, 2);
  });
});
