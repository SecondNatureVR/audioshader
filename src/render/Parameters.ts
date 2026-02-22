/**
 * Visual parameter management
 * Default values, ranges, and utilities for visual parameters
 */

import type { VisualParams } from '../types';

/**
 * Default visual parameter values
 */
export const DEFAULT_PARAMS: VisualParams = {
  // Shape parameters
  spikiness: 0.5,
  spikeFrequency: 6,
  spikeSharpness: 0.5,
  scale: 0.5,
  rotation: 0,
  autoRotationSpeed: 0,
  hue: 180,
  blendOpacity: 1.0,
  fillSize: 0,
  fillOpacity: 0,
  strokeWeight: 0.012,
  strokeOpacity: 1.0,
  strokeGlow: 0,

  // Dilation/emanation effect parameters
  expansionFactor: 1.003,
  fadeAmount: 2.0,
  hueShiftAmount: 0.1,
  noiseAmount: 0,
  noiseRate: 0,
  blurAmount: 0,
  blurRate: 0,

  // Jiggle effect
  jiggleAmount: 0,

  // Post-processing effects
  fishbowlShape: 0,
  fishbowlDilation: 0,
  radialPowerShape: 1.0,
  radialPowerDilation: 1.0,
  kaleidoscopeSections: 0,
  tunnelStrength: 0,

  // Timing
  emanationRate: 2.0,  // Match lucas.html default
};

/**
 * Parameter range definitions for UI sliders
 */
export interface ParamRange {
  min: number;
  max: number;
  step: number;
  default: number;
}

export const PARAM_RANGES: Record<keyof VisualParams, ParamRange> = {
  spikiness: { min: 0, max: 1, step: 0.01, default: 0.5 },
  spikeFrequency: { min: 2, max: 20, step: 0.1, default: 6 },
  spikeSharpness: { min: 0, max: 1, step: 0.01, default: 0.5 },
  scale: { min: 0.1, max: 2, step: 0.01, default: 0.5 },
  rotation: { min: 0, max: 360, step: 1, default: 0 },
  autoRotationSpeed: { min: -360, max: 360, step: 1, default: 0 },
  hue: { min: 0, max: 360, step: 1, default: 180 },
  blendOpacity: { min: 0, max: 1, step: 0.01, default: 1.0 },
  fillSize: { min: 0, max: 1, step: 0.01, default: 0 },
  fillOpacity: { min: 0, max: 1, step: 0.01, default: 0 },
  strokeWeight: { min: 0.002, max: 0.05, step: 0.001, default: 0.012 },
  strokeOpacity: { min: 0, max: 1, step: 0.01, default: 1.0 },
  strokeGlow: { min: 0, max: 0.05, step: 0.001, default: 0 },
  expansionFactor: { min: 1.001, max: 1.02, step: 0.001, default: 1.003 },
  fadeAmount: { min: 0, max: 5, step: 0.1, default: 2.0 },
  hueShiftAmount: { min: 0, max: 0.5, step: 0.01, default: 0.1 },
  noiseAmount: { min: 0, max: 1, step: 0.01, default: 0 },
  noiseRate: { min: 0, max: 10000, step: 0.1, default: 0 },
  blurAmount: { min: 0, max: 1, step: 0.01, default: 0 },
  blurRate: { min: 0, max: 10000, step: 0.1, default: 0 },
  jiggleAmount: { min: 0, max: 1, step: 0.01, default: 0 },
  fishbowlShape: { min: -0.5, max: 0.5, step: 0.01, default: 0 },
  fishbowlDilation: { min: -0.2, max: 0.2, step: 0.005, default: 0 },
  radialPowerShape: { min: 0.3, max: 3, step: 0.01, default: 1.0 },
  radialPowerDilation: { min: 0.8, max: 1.2, step: 0.005, default: 1.0 },
  kaleidoscopeSections: { min: 0, max: 16, step: 1, default: 0 },
  tunnelStrength: { min: 0, max: 0.9, step: 0.01, default: 0 },
  emanationRate: { min: 2, max: 200, step: 1, default: 2.0 },
};

/**
 * Clamp a value to a parameter's valid range
 */
export function clampParam(param: keyof VisualParams, value: number): number {
  const range = PARAM_RANGES[param];
  return Math.max(range.min, Math.min(range.max, value));
}

/**
 * Preset-aware ranges for Smart Jiggle / ResponsivityOptimizer.
 * Wider than PARAM_RANGES to accommodate artistic preset values (e.g. expansionFactor 0.5–1.5,
 * scale 2.13, jiggleAmount 2, fillSize 8.7). Uses PARAM_CURVE_DEFAULTS where wider.
 */
export const OPTIMIZER_PARAM_RANGES: Partial<Record<keyof VisualParams, { min: number; max: number }>> = {
  expansionFactor: { min: 0.5, max: 1.5 },
  scale: { min: 0.05, max: 2.5 },
  spikiness: { min: 0, max: 15 },
  spikeFrequency: { min: 2, max: 2500 },
  fillSize: { min: 0, max: 10 },
  jiggleAmount: { min: 0, max: 2 },
  hueShiftAmount: { min: 0, max: 8 },
  blurAmount: { min: 0, max: 30 },
  autoRotationSpeed: { min: -360, max: 800 },
};

/**
 * Get range for optimizer: use preset-aware range when available, else PARAM_RANGES.
 */
export function getOptimizerParamRange(param: keyof VisualParams): { min: number; max: number } {
  const override = OPTIMIZER_PARAM_RANGES[param];
  if (override !== undefined) return override;
  const r = PARAM_RANGES[param];
  return { min: r.min, max: r.max };
}

/**
 * Clamp value for optimizer — respects preset-aware ranges.
 */
export function clampParamForOptimizer(param: keyof VisualParams, value: number): number {
  const range = getOptimizerParamRange(param);
  return Math.max(range.min, Math.min(range.max, value));
}

/**
 * Create a new VisualParams object with default values
 */
export function createDefaultParams(): VisualParams {
  return { ...DEFAULT_PARAMS };
}

/**
 * Merge partial params with defaults
 */
export function mergeParams(partial: Partial<VisualParams>): VisualParams {
  return { ...DEFAULT_PARAMS, ...partial };
}

/**
 * Generate random parameter values within valid ranges
 */
export function randomizeParams(): VisualParams {
  const params = createDefaultParams();

  // Randomize shape parameters
  params.spikiness = Math.random();
  params.spikeFrequency = 2 + Math.random() * 18;
  params.spikeSharpness = Math.random();
  params.scale = 0.2 + Math.random() * 1.3;
  params.hue = Math.random() * 360;
  params.fillSize = Math.random();
  params.fillOpacity = Math.random();
  params.strokeWeight = 0.005 + Math.random() * 0.03;
  params.strokeOpacity = 0.5 + Math.random() * 0.5;
  params.strokeGlow = Math.random() * 0.03;
  params.rotation = Math.random() * 360;

  // Randomize effect parameters
  params.hueShiftAmount = Math.random() * 0.5;
  params.fadeAmount = Math.random() * 5;
  params.autoRotationSpeed = (Math.random() - 0.5) * 360;
  // Dilation (expansionFactor): use curve-mapping range 0.5–1.5 for presets
  params.expansionFactor = 0.8 + Math.random() * 0.4;

  // Randomize post-processing
  params.fishbowlShape = (Math.random() - 0.5) * 0.4;
  params.fishbowlDilation = (Math.random() - 0.5) * 0.2; // ±0.1 around 0
  params.radialPowerShape = 0.4 + Math.random() * 1.4;
  params.radialPowerDilation = 0.9 + Math.random() * 0.2; // 0.9–1.1, similar to dilation
  const sections = [0, 3, 4, 5, 6, 8];
  params.kaleidoscopeSections = sections[Math.floor(Math.random() * sections.length)] ?? 0;
  params.tunnelStrength = Math.random() * 0.5;

  // Randomize timing
  params.emanationRate = 2 + Math.random() * 198;

  return params;
}

/**
 * Calculate the dilation factor from speed parameter
 * Speed 0-100 maps to expansion factor 1.0 to 1.02
 */
export function dilationSpeedToFactor(speed: number): number {
  return 1 + (speed / 100) * 0.02;
}

/**
 * Calculate speed parameter from dilation factor
 */
export function dilationFactorToSpeed(factor: number): number {
  return ((factor - 1) / 0.02) * 100;
}

/**
 * Apply jiggle effect to a parameter value
 */
export function applyJiggle(
  baseValue: number,
  time: number,
  amount: number,
  paramName: string,
  range: ParamRange
): number {
  if (amount <= 0) return baseValue;

  // Use different frequencies for different parameters to create varied motion
  const paramHash = paramName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const frequency = 0.5 + (paramHash % 10) * 0.1;

  // Combine multiple sine waves for more organic motion
  const jiggle =
    Math.sin(time * frequency) * 0.4 +
    Math.sin(time * frequency * 1.7 + paramHash) * 0.35 +
    Math.sin(time * frequency * 2.3 + paramHash * 0.7) * 0.25;

  const paramRange = range.max - range.min;
  const jiggleValue = baseValue + jiggle * amount * paramRange * 0.1;

  return Math.max(range.min, Math.min(range.max, jiggleValue));
}
