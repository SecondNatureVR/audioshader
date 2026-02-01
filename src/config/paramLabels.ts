/**
 * Central mapping of parameter names to display labels
 *
 * This ensures consistent naming across:
 * - Slider labels
 * - Curve editor titles
 * - Audio mapping panel
 * - Any other UI that displays parameter names
 */

import type { VisualParams } from '../types';

/**
 * Display labels for all parameters
 * Keys are internal param names, values are human-readable labels
 */
export const PARAM_LABELS: Record<keyof VisualParams | 'emanationRate', string> = {
  // Shape parameters
  spikiness: 'Spikiness',
  spikeFrequency: 'Spike Frequency',
  spikeSharpness: 'Spike Sharpness',

  // Appearance parameters
  hue: 'Hue',
  scale: 'Scale',
  fillSize: 'Fill Size',
  fillOpacity: 'Fill Opacity',
  blendOpacity: 'Blend Opacity',
  rotation: 'Rotation',
  autoRotationSpeed: 'Auto Rotation Speed',

  // Dilation/Emanation parameters
  expansionFactor: 'Dilation Speed',
  fadeAmount: 'Fade Amount',
  emanationRate: 'Emanation Rate',

  // Filter parameters
  noiseAmount: 'Noise Amount',
  noiseRate: 'Noise Rate',
  blurAmount: 'Blur Amount',
  blurRate: 'Blur Rate',

  // Hue shift parameters
  hueShiftAmount: 'Hue Shift Amount',

  // Jiggle parameters
  jiggleAmount: 'Jiggle Amount',
};

/**
 * Get display label for a parameter
 * Falls back to the param name with spaces added before capitals
 */
export function getParamLabel(paramName: string): string {
  const label = PARAM_LABELS[paramName as keyof typeof PARAM_LABELS];
  if (label !== undefined) {
    return label;
  }

  // Fallback: convert camelCase to Title Case with spaces
  return paramName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
