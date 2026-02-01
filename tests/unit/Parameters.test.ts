import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PARAMS,
  PARAM_RANGES,
  createDefaultParams,
  mergeParams,
  clampParam,
  randomizeParams,
  dilationSpeedToFactor,
  dilationFactorToSpeed,
} from '../../src/render/Parameters';

describe('Parameters', () => {
  describe('DEFAULT_PARAMS', () => {
    it('should have all required parameter keys', () => {
      const requiredKeys = [
        'spikiness',
        'spikeFrequency',
        'spikeSharpness',
        'scale',
        'rotation',
        'hue',
        'blendOpacity',
        'fillSize',
        'fillOpacity',
        'expansionFactor',
        'fadeAmount',
        'hueShiftAmount',
        'jiggleAmount',
      ];

      for (const key of requiredKeys) {
        expect(DEFAULT_PARAMS).toHaveProperty(key);
      }
    });

    it('should have all numeric values', () => {
      for (const value of Object.values(DEFAULT_PARAMS)) {
        expect(typeof value).toBe('number');
      }
    });
  });

  describe('PARAM_RANGES', () => {
    it('should have ranges for all default params', () => {
      for (const key of Object.keys(DEFAULT_PARAMS)) {
        expect(PARAM_RANGES).toHaveProperty(key);
      }
    });

    it('should have valid range definitions', () => {
      for (const range of Object.values(PARAM_RANGES)) {
        expect(range.min).toBeDefined();
        expect(range.max).toBeDefined();
        expect(range.step).toBeDefined();
        expect(range.default).toBeDefined();
        expect(range.min).toBeLessThanOrEqual(range.max);
      }
    });
  });

  describe('createDefaultParams', () => {
    it('should return a copy of DEFAULT_PARAMS', () => {
      const params = createDefaultParams();

      expect(params).toEqual(DEFAULT_PARAMS);
      expect(params).not.toBe(DEFAULT_PARAMS); // Should be a new object
    });

    it('should not affect original when modified', () => {
      const params = createDefaultParams();
      const originalSpikiness = DEFAULT_PARAMS.spikiness;

      params.spikiness = 999;

      expect(DEFAULT_PARAMS.spikiness).toBe(originalSpikiness);
    });
  });

  describe('mergeParams', () => {
    it('should merge partial params with defaults', () => {
      const partial = { spikiness: 0.8, hue: 270 };
      const result = mergeParams(partial);

      expect(result.spikiness).toBe(0.8);
      expect(result.hue).toBe(270);
      expect(result.scale).toBe(DEFAULT_PARAMS.scale);
    });

    it('should return defaults when given empty object', () => {
      const result = mergeParams({});

      expect(result).toEqual(DEFAULT_PARAMS);
    });
  });

  describe('clampParam', () => {
    it('should clamp values below minimum', () => {
      const result = clampParam('spikiness', -0.5);

      expect(result).toBe(0);
    });

    it('should clamp values above maximum', () => {
      const result = clampParam('spikiness', 1.5);

      expect(result).toBe(1);
    });

    it('should not modify values within range', () => {
      const result = clampParam('spikiness', 0.5);

      expect(result).toBe(0.5);
    });
  });

  describe('randomizeParams', () => {
    it('should return valid parameter values within ranges', () => {
      const params = randomizeParams();

      for (const [key, value] of Object.entries(params)) {
        const range = PARAM_RANGES[key as keyof typeof PARAM_RANGES];
        expect(value).toBeGreaterThanOrEqual(range.min);
        expect(value).toBeLessThanOrEqual(range.max);
      }
    });

    it('should produce different results on multiple calls', () => {
      const params1 = randomizeParams();
      const params2 = randomizeParams();

      // At least some values should differ
      const values1 = Object.values(params1);
      const values2 = Object.values(params2);

      const hasDifference = values1.some((v, i) => v !== values2[i]);
      expect(hasDifference).toBe(true);
    });
  });

  describe('dilationSpeedToFactor / dilationFactorToSpeed', () => {
    it('should convert speed 0 to factor 1.0', () => {
      expect(dilationSpeedToFactor(0)).toBe(1);
    });

    it('should convert speed 100 to factor 1.02', () => {
      expect(dilationSpeedToFactor(100)).toBeCloseTo(1.02);
    });

    it('should be reversible', () => {
      const speed = 50;
      const factor = dilationSpeedToFactor(speed);
      const backToSpeed = dilationFactorToSpeed(factor);

      expect(backToSpeed).toBeCloseTo(speed);
    });
  });
});
