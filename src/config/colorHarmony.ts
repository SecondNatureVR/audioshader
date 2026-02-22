/**
 * Color harmony presets and hue computation
 * Complementary, analogous, triadic, etc. from a base hue
 */

import { hsvToRgb, rgbToHex } from './colorPalette';

export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'splitComplementary'
  | 'square'
  | 'tetradic';

export interface ColorHarmony {
  baseHue: number;
  type: HarmonyType;
  rotation: number;
  spread?: number;
  invert?: boolean;
  saturation: number;
  value: number;
}

export const DEFAULT_COLOR_HARMONY: ColorHarmony = {
  baseHue: 200,
  type: 'analogous',
  rotation: 0,
  spread: 1,
  invert: false,
  saturation: 1,
  value: 1,
};

/** Normalize hue to 0-360 */
function normalizeHue(h: number): number {
  let x = h % 360;
  if (x < 0) x += 360;
  return x;
}

/**
 * Compute hues for a harmony type from base hue.
 * Returns array of hues in degrees (0-360).
 */
export function computeHarmonyHues(harmony: ColorHarmony): number[] {
  const base = normalizeHue(harmony.baseHue);
  const rot = harmony.rotation ?? 0;
  const spread = Math.max(0.1, Math.min(1, harmony.spread ?? 1));
  const invert = harmony.invert ?? false;

  let hues: number[];

  switch (harmony.type) {
    case 'complementary':
      hues = [0, 180];
      break;
    case 'analogous': {
      const gap = 30 * spread;
      hues = [-gap, 0, gap];
      break;
    }
    case 'triadic':
      hues = [0, 120, 240];
      break;
    case 'splitComplementary':
      hues = [0, 150, 210];
      break;
    case 'square':
      hues = [0, 90, 180, 270];
      break;
    case 'tetradic':
      hues = [0, 90, 180, 270];
      break;
    default:
      hues = [0];
  }

  let result = hues.map((h) => normalizeHue(base + h + rot));

  if (invert) {
    result = result.map((h) => normalizeHue(h + 180));
  }

  return result;
}

/**
 * Convert harmony hues to hex dominant colors for ColorPalette.
 * Uses harmony's saturation and value.
 */
export function harmonyToDominantColors(harmony: ColorHarmony): string[] {
  const hues = computeHarmonyHues(harmony);
  const s = harmony.saturation;
  const v = harmony.value;
  return hues.map((h) => {
    const [r, g, b] = hsvToRgb(h, s, v);
    return rgbToHex(r, g, b);
  });
}
