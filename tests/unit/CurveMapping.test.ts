import { describe, it, expect } from 'vitest';
import {
  getDefaultCurveSettings,
  getParamDefaultSettings,
  mapNormalizedValue,
  mapSliderToValue,
  reverseMapToNormalized,
  reverseMapValueToSlider,
  CurveMapper,
  DilationMapping,
  FadeMapping,
  EffectAmountMapping,
  EffectRateMapping,
  RotationSpeedMapping,
} from '../../src/mapping/CurveMapping';

describe('CurveMapping', () => {
  describe('getDefaultCurveSettings', () => {
    it('should return linear 0-1 range by default', () => {
      const settings = getDefaultCurveSettings();

      expect(settings.min).toBe(0);
      expect(settings.max).toBe(1);
      expect(settings.power).toBe(1.0);
      expect(settings.type).toBe('power');
    });
  });

  describe('getParamDefaultSettings', () => {
    it('should return settings for known parameters', () => {
      const spikiness = getParamDefaultSettings('spikiness');

      expect(spikiness).not.toBeNull();
      expect(spikiness?.min).toBe(0);
      expect(spikiness?.max).toBe(1);
    });

    it('should return settings with exponential curve for noise', () => {
      const noiseAmount = getParamDefaultSettings('noiseAmount');

      expect(noiseAmount).not.toBeNull();
      expect(noiseAmount?.power).toBe(0.25); // 1/4 power for fine control
    });

    it('should return null for unknown parameters', () => {
      const unknown = getParamDefaultSettings('unknownParam');

      expect(unknown).toBeNull();
    });
  });

  describe('mapNormalizedValue', () => {
    it('should map linearly when power is 1', () => {
      const settings = { min: 0, max: 100, power: 1.0, type: 'power' as const };

      expect(mapNormalizedValue(0, settings)).toBe(0);
      expect(mapNormalizedValue(0.5, settings)).toBe(50);
      expect(mapNormalizedValue(1, settings)).toBe(100);
    });

    it('should apply power curve', () => {
      const settings = { min: 0, max: 1, power: 2.0, type: 'power' as const };

      // power of 2: 0.5^2 = 0.25
      expect(mapNormalizedValue(0.5, settings)).toBeCloseTo(0.25);
    });

    it('should clamp input to 0-1', () => {
      const settings = { min: 0, max: 100, power: 1.0, type: 'power' as const };

      expect(mapNormalizedValue(-0.5, settings)).toBe(0);
      expect(mapNormalizedValue(1.5, settings)).toBe(100);
    });
  });

  describe('mapSliderToValue', () => {
    it('should convert slider 0-100 to output range', () => {
      const settings = { min: 0, max: 360, power: 1.0, type: 'power' as const };

      expect(mapSliderToValue(0, settings)).toBe(0);
      expect(mapSliderToValue(50, settings)).toBe(180);
      expect(mapSliderToValue(100, settings)).toBe(360);
    });
  });

  describe('reverseMapToNormalized', () => {
    it('should reverse linear mapping', () => {
      const settings = { min: 0, max: 100, power: 1.0, type: 'power' as const };

      expect(reverseMapToNormalized(0, settings)).toBe(0);
      expect(reverseMapToNormalized(50, settings)).toBe(0.5);
      expect(reverseMapToNormalized(100, settings)).toBe(1);
    });

    it('should reverse power curve', () => {
      const settings = { min: 0, max: 1, power: 2.0, type: 'power' as const };

      // If power 2 gives 0.25 for input 0.5, reverse should give 0.5 for 0.25
      expect(reverseMapToNormalized(0.25, settings)).toBeCloseTo(0.5);
    });
  });

  describe('reverseMapValueToSlider', () => {
    it('should be the inverse of mapSliderToValue', () => {
      const settings = { min: 0, max: 360, power: 1.5, type: 'power' as const };

      // Round trip test
      const originalSlider = 75;
      const value = mapSliderToValue(originalSlider, settings);
      const backToSlider = reverseMapValueToSlider(value, settings);

      expect(backToSlider).toBeCloseTo(originalSlider);
    });
  });

  describe('DilationMapping', () => {
    it('should convert factor 1.0 to speed 0', () => {
      expect(DilationMapping.factorToSpeed(1.0)).toBe(0);
    });

    it('should convert factor 1.02 to speed 100', () => {
      expect(DilationMapping.factorToSpeed(1.02)).toBeCloseTo(100);
    });

    it('should round-trip factor to speed and back', () => {
      const factor = 1.01;
      const speed = DilationMapping.factorToSpeed(factor);
      const backToFactor = DilationMapping.speedToFactor(speed);

      expect(backToFactor).toBeCloseTo(factor);
    });
  });

  describe('FadeMapping', () => {
    it('should map 0 to slider 0', () => {
      expect(FadeMapping.amountToSlider(0)).toBe(0);
    });

    it('should map max to slider 100', () => {
      expect(FadeMapping.amountToSlider(5)).toBe(100);
    });

    it('should round-trip amount to slider and back', () => {
      const amount = 2.5;
      const slider = FadeMapping.amountToSlider(amount);
      const backToAmount = FadeMapping.sliderToAmount(slider);

      expect(backToAmount).toBeCloseTo(amount, 1);
    });
  });

  describe('EffectAmountMapping', () => {
    it('should map 0 to slider 0', () => {
      expect(EffectAmountMapping.amountToSlider(0)).toBe(0);
    });

    it('should map 1 to slider 100', () => {
      expect(EffectAmountMapping.amountToSlider(1)).toBe(100);
    });

    it('should have exponential response (concave up curve for fine control at low values)', () => {
      // With power 0.25 (< 1), the curve is concave up
      // This means small slider movements at the low end produce larger changes
      // slider 50 (0.5 normalized) with power 0.25 gives 0.5^0.25 ≈ 0.84
      const value = EffectAmountMapping.sliderToAmount(50);

      expect(value).not.toBe(0.5);
      expect(value).toBeGreaterThan(0.5); // Concave up curve gives higher value at midpoint
      expect(value).toBeCloseTo(0.84, 1);
    });
  });

  describe('EffectRateMapping', () => {
    it('should map 0 to slider 0', () => {
      expect(EffectRateMapping.rateToSlider(0)).toBe(0);
    });

    it('should map max rate to slider 100', () => {
      expect(EffectRateMapping.rateToSlider(10)).toBe(100);
    });

    it('should round-trip rate to slider and back', () => {
      const rate = 5;
      const slider = EffectRateMapping.rateToSlider(rate);
      const backToRate = EffectRateMapping.sliderToRate(slider);

      expect(backToRate).toBeCloseTo(rate, 1);
    });
  });

  describe('RotationSpeedMapping', () => {
    it('should map min speed to slider 0', () => {
      expect(RotationSpeedMapping.speedToSlider(-180, -180, 180)).toBe(0);
    });

    it('should map center speed to slider 50', () => {
      expect(RotationSpeedMapping.speedToSlider(0, -180, 180)).toBe(50);
    });

    it('should map max speed to slider 100', () => {
      expect(RotationSpeedMapping.speedToSlider(180, -180, 180)).toBe(100);
    });

    it('should round-trip speed to slider and back', () => {
      const speed = 45;
      const slider = RotationSpeedMapping.speedToSlider(speed);
      const backToSpeed = RotationSpeedMapping.sliderToSpeed(slider);

      expect(backToSpeed).toBeCloseTo(speed);
    });
  });

  describe('CurveMapper class', () => {
    it('should return default settings for unknown params', () => {
      const mapper = new CurveMapper();
      const settings = mapper.getSettings('unknownParam');

      expect(settings.power).toBe(1.0);
    });

    it('should return param-specific settings', () => {
      const mapper = new CurveMapper();
      const settings = mapper.getSettings('noiseAmount');

      expect(settings.power).toBe(0.25);
    });

    it('should map slider values', () => {
      const mapper = new CurveMapper();
      const value = mapper.mapSlider('hue', 50);

      expect(value).toBe(180); // 50% of 0-360
    });

    it('should reverse map to slider', () => {
      const mapper = new CurveMapper();
      const slider = mapper.mapToSlider('hue', 180);

      expect(slider).toBeCloseTo(50);
    });
  });
});
