import { test, expect } from '@playwright/test';

test.describe('Direct Value Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await page.waitForSelector('#canvas');
    // Wait a bit for the UI to be ready
    await page.waitForTimeout(500);
  });

  test('hue value display is editable', async ({ page }) => {
    const hueValue = page.locator('#hue-value');

    // Verify contenteditable is set
    await expect(hueValue).toHaveAttribute('contenteditable', 'true');

    // Click to focus
    await hueValue.click();

    // Clear and type new value
    await hueValue.fill('');
    await page.keyboard.type('270');

    // Blur to apply
    await page.keyboard.press('Tab');

    // Verify the value was updated (may have degree symbol)
    const text = await hueValue.textContent();
    expect(text).toMatch(/270/);
  });

  test('pressing Enter applies the value', async ({ page }) => {
    const scaleValue = page.locator('#scale-value');

    await scaleValue.click();
    await scaleValue.fill('');
    await page.keyboard.type('0.75');
    await page.keyboard.press('Enter');

    const text = await scaleValue.textContent();
    expect(text).toMatch(/0\.75/);
  });

  test('slider syncs with typed value', async ({ page }) => {
    const hueSlider = page.locator('#hue-slider');
    const hueValue = page.locator('#hue-value');

    // Type a value
    await hueValue.click();
    await hueValue.fill('');
    await page.keyboard.type('90');
    await page.keyboard.press('Enter');

    // Verify slider updated
    const sliderValue = await hueSlider.inputValue();
    expect(parseFloat(sliderValue)).toBeCloseTo(90, 0);
  });

  test('invalid input is ignored', async ({ page }) => {
    const spikinessValue = page.locator('#spikiness-value');

    // Get original value
    const originalText = await spikinessValue.textContent();

    // Type invalid input
    await spikinessValue.click();
    await spikinessValue.fill('');
    await page.keyboard.type('abc');
    await page.keyboard.press('Enter');

    // Value should revert to original (or be formatted)
    await page.waitForTimeout(100);
    const newText = await spikinessValue.textContent();
    // Should contain some numeric value
    expect(newText).toMatch(/\d/);
  });

  test('value with degree symbol is parsed correctly', async ({ page }) => {
    const rotationValue = page.locator('#rotation-value');

    await rotationValue.click();
    await rotationValue.fill('');
    await page.keyboard.type('45°');
    await page.keyboard.press('Enter');

    const text = await rotationValue.textContent();
    expect(text).toMatch(/45/);
  });

  test('percentage value is parsed correctly', async ({ page }) => {
    const jiggleValue = page.locator('#jiggle-amount-value');

    await jiggleValue.click();
    await jiggleValue.fill('');
    await page.keyboard.type('50%');
    await page.keyboard.press('Enter');

    const text = await jiggleValue.textContent();
    expect(text).toMatch(/50/);
  });

  test('slider range expands for values beyond max', async ({ page }) => {
    const hueSlider = page.locator('#hue-slider');
    const hueValue = page.locator('#hue-value');

    // Get original max
    const originalMax = await hueSlider.getAttribute('max');
    expect(originalMax).toBe('360');

    // Type value beyond max
    await hueValue.click();
    await hueValue.fill('');
    await page.keyboard.type('400');
    await page.keyboard.press('Enter');

    // Verify slider max was expanded
    const newMax = await hueSlider.getAttribute('max');
    expect(parseFloat(newMax!)).toBeGreaterThan(400);
  });

  test('interpolation duration is editable', async ({ page }) => {
    // Expand interpolation settings section
    const header = page.locator('#interpolation-settings-header');
    await header.click();
    await page.waitForTimeout(200);

    const durationValue = page.locator('#interpolation-duration-value');
    await expect(durationValue).toHaveAttribute('contenteditable', 'true');

    await durationValue.click();
    await durationValue.fill('');
    await page.keyboard.type('1.5');
    await page.keyboard.press('Enter');

    const text = await durationValue.textContent();
    expect(text).toMatch(/1\.5/);
  });
});
