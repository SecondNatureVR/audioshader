/**
 * Curve mapping utilities for parameter value transformations
 * Handles power curves, min/max scaling, and bidirectional mapping
 */

import type { VisualParams } from '../types';

export interface CurveSettings {
  min: number;
  max: number;
  power: number;
  type: 'power' | 'bezier';
}

/**
 * Default curve settings (linear 0-1)
 */
export function getDefaultCurveSettings(): CurveSettings {
  return {
    min: 0,
    max: 1,
    power: 1.0,
    type: 'power',
  };
}

/**
 * Parameter-specific default curve settings
 * These define the natural ranges and response curves for each parameter
 */
export const PARAM_CURVE_DEFAULTS: Partial<Record<keyof VisualParams | 'dilationSpeed' | 'emanationRate', Omit<CurveSettings, 'type'>>> = {
  // Shape parameters (0-1 range, linear)
  spikiness: { min: 0, max: 1, power: 1.0 },
  spikeSharpness: { min: 0, max: 1, power: 1.0 },
  fillSize: { min: 0, max: 1, power: 1.0 },
  fillOpacity: { min: 0, max: 1, power: 1.0 },
  blendOpacity: { min: 0, max: 1, power: 1.0 },
  jiggleAmount: { min: 0, max: 1, power: 1.0 },

  // Frequency parameters
  spikeFrequency: { min: 2, max: 20, power: 1.0 },

  // Angle parameters
  hue: { min: 0, max: 360, power: 1.0 },
  rotation: { min: 0, max: 360, power: 1.0 },

  // Scale parameters
  scale: { min: 0.05, max: 1.0, power: 1.0 },

  // Rate parameters (with exponential curves for finer low-end control)
  emanationRate: { min: 2, max: 200, power: 1.0 },
  noiseRate: { min: 0, max: 10, power: 0.333 },
  blurRate: { min: 0, max: 10, power: 0.333 },
  autoRotationSpeed: { min: -360, max: 360, power: 1.0 },

  // Amount parameters (exponential for subtle control at low values)
  noiseAmount: { min: 0, max: 1, power: 0.25 },
  blurAmount: { min: 0, max: 1, power: 0.25 },
  fadeAmount: { min: 0, max: 5, power: 0.333 },
  hueShiftAmount: { min: 0, max: 0.2, power: 1.0 },

  // Dilation speed (very slow exponential for precise control)
  dilationSpeed: { min: 0.88, max: 1.22, power: 0.125 },
};

/**
 * Get default settings for a specific parameter
 */
export function getParamDefaultSettings(paramName: string): CurveSettings | null {
  const defaults = PARAM_CURVE_DEFAULTS[paramName as keyof typeof PARAM_CURVE_DEFAULTS];
  if (defaults === undefined) {
    return null;
  }
  return { ...defaults, type: 'power' };
}

/**
 * Map a normalized value (0-1) to output using power curve
 */
export function mapNormalizedValue(normalized: number, settings: CurveSettings): number {
  const clamped = Math.max(0, Math.min(1, normalized));
  const curved = Math.pow(clamped, settings.power);
  return settings.min + curved * (settings.max - settings.min);
}

/**
 * Map slider value (0-100) to output using curve settings
 */
export function mapSliderToValue(sliderValue: number, settings: CurveSettings): number {
  const normalized = sliderValue / 100.0;
  return mapNormalizedValue(normalized, settings);
}

/**
 * Reverse map: output value to normalized (0-1)
 */
export function reverseMapToNormalized(outputValue: number, settings: CurveSettings): number {
  const range = settings.max - settings.min;
  if (range === 0) return 0;

  const normalized = (outputValue - settings.min) / range;
  if (normalized <= 0) return 0;
  if (normalized >= 1) return 1;

  // Inverse power function
  return Math.pow(normalized, 1.0 / settings.power);
}

/**
 * Reverse map: output value to slider (0-100)
 */
export function reverseMapValueToSlider(outputValue: number, settings: CurveSettings): number {
  return reverseMapToNormalized(outputValue, settings) * 100;
}

/**
 * CurveMapper class for managing curve settings per parameter
 */
export class CurveMapper {
  private settings: Map<string, CurveSettings> = new Map();
  private readonly storagePrefix: string = 'curve_';

  /**
   * Get curve settings for a parameter, loading from storage if available
   */
  getSettings(paramName: string): CurveSettings {
    let settings = this.settings.get(paramName);

    if (settings === undefined) {
      // Start with parameter-specific defaults
      const paramDefaults = getParamDefaultSettings(paramName);
      settings = paramDefaults ?? getDefaultCurveSettings();

      // Load from localStorage if available
      this.loadFromStorage(paramName, settings);
      this.settings.set(paramName, settings);
    }

    return settings;
  }

  /**
   * Update curve settings for a parameter
   */
  setSettings(paramName: string, settings: Partial<CurveSettings>): void {
    const existing = this.getSettings(paramName);
    const updated = { ...existing, ...settings };
    this.settings.set(paramName, updated);
    this.saveToStorage(paramName, updated);
  }

  /**
   * Map slider value to parameter value
   */
  mapSlider(paramName: string, sliderValue: number): number {
    return mapSliderToValue(sliderValue, this.getSettings(paramName));
  }

  /**
   * Map parameter value to slider value
   */
  mapToSlider(paramName: string, value: number): number {
    return reverseMapValueToSlider(value, this.getSettings(paramName));
  }

  /**
   * Reset settings for a parameter to defaults
   */
  resetSettings(paramName: string): void {
    const paramDefaults = getParamDefaultSettings(paramName);
    const settings = paramDefaults ?? getDefaultCurveSettings();
    this.settings.set(paramName, settings);
    this.removeFromStorage(paramName);
  }

  private loadFromStorage(paramName: string, settings: CurveSettings): void {
    try {
      const saved = localStorage.getItem(this.storagePrefix + paramName);
      if (saved !== null) {
        const parsed = JSON.parse(saved) as Partial<CurveSettings>;
        Object.assign(settings, parsed);
      }
    } catch {
      console.warn('Failed to load curve settings for', paramName);
    }
  }

  private saveToStorage(paramName: string, settings: CurveSettings): void {
    try {
      localStorage.setItem(this.storagePrefix + paramName, JSON.stringify(settings));
    } catch {
      console.warn('Failed to save curve settings for', paramName);
    }
  }

  private removeFromStorage(paramName: string): void {
    try {
      localStorage.removeItem(this.storagePrefix + paramName);
    } catch {
      // Ignore
    }
  }
}

/**
 * Special mapping functions for dilation speed
 * This parameter uses a power curve mapping with 1/8 power for fine control
 * NOTE: The dilation slider uses 0-200 range (not 0-100)
 *
 * Uses lucas.html CurveEditor defaults:
 * - min: 0.88, max: 1.22, power: 0.125 (1/8)
 * - slider=0 → 0.88 (contracts)
 * - slider=200 → 1.22 (expands)
 */
export const DilationMapping = {
  // Curve settings matching lucas.html defaults
  MIN: 0.88,
  MAX: 1.22,
  POWER: 0.125,

  /**
   * Convert expansion factor to slider value (0-200)
   */
  factorToSlider(factor: number): number {
    const range = DilationMapping.MAX - DilationMapping.MIN;
    const normalized = (factor - DilationMapping.MIN) / range;
    if (normalized <= 0) return 0;
    if (normalized >= 1) return 200;

    // Inverse of power curve: normalized = curved^(1/power)
    const curved = Math.pow(normalized, 1.0 / DilationMapping.POWER);
    return curved * 200;
  },

  /**
   * Convert slider value (0-200) to expansion factor
   * Uses simple power curve formula matching lucas.html CurveEditor
   */
  sliderToFactor(sliderValue: number): number {
    const normalized = sliderValue / 200;
    const curved = Math.pow(normalized, DilationMapping.POWER);
    return DilationMapping.MIN + curved * (DilationMapping.MAX - DilationMapping.MIN);
  },
};

/**
 * Fade amount mapping (exponential for fine control at low values)
 */
export const FadeMapping = {
  /**
   * Convert fade amount (0-5) to slider (0-100)
   */
  amountToSlider(amount: number): number {
    const power = 0.333; // 1/3 power
    const max = 5;

    const normalized = amount / max;
    if (normalized <= 0) return 0;
    if (normalized >= 1) return 100;

    return Math.pow(normalized, 1.0 / power) * 100;
  },

  /**
   * Convert slider (0-100) to fade amount
   */
  sliderToAmount(sliderValue: number): number {
    const power = 0.333;
    const max = 5;

    const normalized = sliderValue / 100;
    const curved = Math.pow(normalized, power);
    return curved * max;
  },
};

/**
 * Noise/blur amount mapping (exponential for very fine control)
 */
export const EffectAmountMapping = {
  /**
   * Convert effect amount (0-1) to slider (0-100)
   */
  amountToSlider(amount: number): number {
    const power = 0.25; // 1/4 power for very fine control at low values

    if (amount <= 0) return 0;
    if (amount >= 1) return 100;

    return Math.pow(amount, 1.0 / power) * 100;
  },

  /**
   * Convert slider (0-100) to effect amount
   */
  sliderToAmount(sliderValue: number): number {
    const power = 0.25;
    const normalized = sliderValue / 100;
    return Math.pow(normalized, power);
  },
};

/**
 * Noise/blur rate mapping
 */
export const EffectRateMapping = {
  /**
   * Convert rate (0-10) to slider (0-100)
   */
  rateToSlider(rate: number): number {
    const power = 0.333;
    const max = 10;

    const normalized = rate / max;
    if (normalized <= 0) return 0;
    if (normalized >= 1) return 100;

    return Math.pow(normalized, 1.0 / power) * 100;
  },

  /**
   * Convert slider (0-100) to rate
   */
  sliderToRate(sliderValue: number): number {
    const power = 0.333;
    const max = 10;

    const normalized = sliderValue / 100;
    const curved = Math.pow(normalized, power);
    return curved * max;
  },
};

/**
 * Auto-rotation speed mapping
 */
export const RotationSpeedMapping = {
  /**
   * Convert speed (-180 to 180 or similar) to slider (0-100)
   */
  speedToSlider(speed: number, minSpeed: number = -180, maxSpeed: number = 180): number {
    const range = maxSpeed - minSpeed;
    if (range === 0) return 50;

    const normalized = (speed - minSpeed) / range;
    return Math.max(0, Math.min(100, normalized * 100));
  },

  /**
   * Convert slider (0-100) to speed
   */
  sliderToSpeed(sliderValue: number, minSpeed: number = -180, maxSpeed: number = 180): number {
    const range = maxSpeed - minSpeed;
    const normalized = sliderValue / 100;
    return minSpeed + normalized * range;
  },
};
