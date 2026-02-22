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

  /**
   * Helper to get curve settings for a parameter via the exposed window.ui
   */
  async function getCurveSettings(
    page: Page,
    paramName: string
  ): Promise<{ min: number; max: number; power: number }> {
    return await page.evaluate(
      ({ pName }) => {
        const ui = (window as unknown as {
          ui?: { curveMapper?: { getSettings: (n: string) => { min: number; max: number; power: number } } };
        }).ui;
        // Access private curveMapper via bracket notation for testing
        const mapper = (ui as Record<string, unknown>)?.['curveMapper'] as
          | { getSettings: (n: string) => { min: number; max: number; power: number } }
          | undefined;
        if (!mapper) return { min: 0, max: 1, power: 1 };
        return mapper.getSettings(pName);
      },
      { pName: paramName }
    );
  }

  /**
   * Helper to enter a direct value into a contenteditable span
   */
  async function enterDirectValue(
    page: Page,
    selector: string,
    value: string
  ): Promise<void> {
    const element = page.locator(selector);
    await element.click();
    // Triple-click to select all text
    await element.click({ clickCount: 3 });
    await page.keyboard.type(value);
    await page.keyboard.press('Enter');
    // Wait for blur and processing
    await page.waitForTimeout(100);
  }

  test('direct input expansion: value above max expands max boundary', async ({ page }) => {
    // Get initial curve settings for hue (default: 0-360)
    const before = await getCurveSettings(page, 'hue');
    expect(before.min).toBe(0);
    expect(before.max).toBe(360);

    // Enter a value above the current max
    await enterDirectValue(page, '#hue-value', '500');

    // Verify the max boundary expanded to 500
    const after = await getCurveSettings(page, 'hue');
    expect(after.max).toBe(500);
    expect(after.min).toBe(0); // min unchanged
  });

  test('direct input expansion: value below min expands min boundary', async ({ page }) => {
    // Get initial curve settings for hue (default: 0-360)
    const before = await getCurveSettings(page, 'hue');
    expect(before.min).toBe(0);

    // Enter a negative value below the current min
    await enterDirectValue(page, '#hue-value', '-50');

    // Verify the min boundary expanded to -50
    const after = await getCurveSettings(page, 'hue');
    expect(after.min).toBe(-50);
    expect(after.max).toBe(360); // max unchanged
  });

  test('direct input contraction: value inside range contracts closest boundary', async ({ page }) => {
    // Default hue range: 0-360
    // Enter value 300, which is closer to max (dist 60) than min (dist 300)
    // So max should contract to 300
    await enterDirectValue(page, '#hue-value', '300');

    const after = await getCurveSettings(page, 'hue');
    expect(after.min).toBe(0);
    expect(after.max).toBe(300);
  });

  test('direct input contraction: min contracts when value is closer to min', async ({ page }) => {
    // Default hue range: 0-360
    // Enter value 30, which is closer to min (dist 30) than max (dist 330)
    // So min should contract to 30
    await enterDirectValue(page, '#hue-value', '30');

    const after = await getCurveSettings(page, 'hue');
    expect(after.min).toBe(30);
    expect(after.max).toBe(360); // max unchanged
  });

  test('slider reflects new range after direct input adjustment', async ({ page }) => {
    // Default spikeFrequency: 2-20
    // Set max to 100 via direct input
    await enterDirectValue(page, '#spike-frequency-value', '100');

    // Verify the curve settings expanded
    const settings = await getCurveSettings(page, 'spikeFrequency');
    expect(settings.max).toBe(100);

    // Now slide the slider all the way to the right
    const slider = page.locator('#spike-frequency-slider');
    await slider.fill(await slider.evaluate((el: HTMLInputElement) => el.max));
    await slider.dispatchEvent('input');
    await page.waitForTimeout(100);

    // The parameter value should now be close to the new max (100)
    const value = await getParamValue(page, 'spikeFrequency');
    expect(value).toBeGreaterThan(50); // Should be near 100, not near 20
  });

  test('curve editor reflects range after direct input', async ({ page }) => {
    // Enter a value to trigger range adjustment for spikeFrequency
    await enterDirectValue(page, '#spike-frequency-value', '50');

    // Open the curve editor for spikeFrequency
    const curveBtn = page.locator('.curve-btn[data-param="spikeFrequency"]');
    // Hover to reveal the button
    await page.locator('#spike-frequency-slider').hover();
    await curveBtn.click();
    await page.waitForTimeout(200);

    // Read the max input in the curve editor
    const maxInput = page.locator('#curve-max');
    const maxValue = await maxInput.inputValue();
    expect(parseFloat(maxValue)).toBe(50);
  });
});
