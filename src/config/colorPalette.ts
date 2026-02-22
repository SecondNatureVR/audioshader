/**
 * Default color palette and utilities
 */

import type { ColorPalette } from '../types';

export const DEFAULT_PALETTE: ColorPalette = {
  hueMin: 0,
  hueMax: 360,
  saturation: 1,
  value: 1,
  dominantColors: [],
};

/** Parse hex #rrggbb to [r,g,b] 0-1 */
export function hexToRgb(hex: string): [number, number, number] {
  if (!hex || hex.length < 7) return [1, 1, 1];
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) return [1, 1, 1];
  return [
    parseInt(m[1], 16) / 255,
    parseInt(m[2], 16) / 255,
    parseInt(m[3], 16) / 255,
  ];
}

/** RGB 0-1 to hex */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (x: number) => {
    const n = Math.round(Math.max(0, Math.min(1, x)) * 255);
    return n.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** HSV to RGB (h 0-360, s 0-1, v 0-1) */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [r + m, g + m, b + m];
}

/** Merge partial palette with defaults */
export function mergePalette(partial: Partial<ColorPalette>): ColorPalette {
  return {
    ...DEFAULT_PALETTE,
    ...partial,
    dominantColors: partial.dominantColors ?? DEFAULT_PALETTE.dominantColors,
  };
}
