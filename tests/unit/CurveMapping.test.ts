import { describe, it, expect } from 'vitest';
import {
  getDefaultCurveSettings,
  getParamDefaultSettings,
  mapNormalizedValue,
  mapSliderToValue,
  reverseMapToNormalized,
  reverseMapValueToSlider,
  resolveSliderToParamValue,
  resolveParamToSliderValue,
  formatParamValue,
  CurveMapper,
  DilationMapping,
  FadeMapping,
  EffectAmountMapping,
  EffectRateMapping,
  RotationSpeedMapping,
  type CurveSettings,
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
    // DilationMapping uses slider range 0-200
    // MIN: 0.5, MAX: 1.5, POWER: 1.0 (linear)
    // slider=0 → 0.5 (contracts)
    // slider=100 → 1.0 (neutral, centered)
    // slider=200 → 1.5 (expands)
    // Range widened to accommodate artistic preset values

    it('should convert factor MIN (0.5) to slider 0', () => {
      expect(DilationMapping.factorToSlider(0.5)).toBe(0);
    });

    it('should convert factor MAX (1.5) to slider 200', () => {
      expect(DilationMapping.factorToSlider(1.5)).toBe(200);
    });

    it('should convert factor 1.0 (neutral) to slider 100 (center)', () => {
      expect(DilationMapping.factorToSlider(1.0)).toBe(100);
    });

    it('should convert slider 0 to factor MIN (0.5)', () => {
      expect(DilationMapping.sliderToFactor(0)).toBeCloseTo(0.5);
    });

    it('should convert slider 200 to factor MAX (1.5)', () => {
      expect(DilationMapping.sliderToFactor(200)).toBeCloseTo(1.5);
    });

    it('should convert slider 100 (center) to factor 1.0 (neutral)', () => {
      expect(DilationMapping.sliderToFactor(100)).toBeCloseTo(1.0);
    });

    it('should round-trip factor to slider and back', () => {
      const factor = 1.05;
      const slider = DilationMapping.factorToSlider(factor);
      const backToFactor = DilationMapping.sliderToFactor(slider);

      expect(backToFactor).toBeCloseTo(factor, 2);
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

    it('should update settings via setSettings', () => {
      const mapper = new CurveMapper();

      // Get defaults first
      const original = mapper.getSettings('spikiness');
      expect(original.min).toBe(0);
      expect(original.max).toBe(1);

      // Update min/max (simulating range adjustment)
      mapper.setSettings('spikiness', { min: 0.2, max: 0.8 });

      const updated = mapper.getSettings('spikiness');
      expect(updated.min).toBe(0.2);
      expect(updated.max).toBe(0.8);
      // Power should be preserved
      expect(updated.power).toBe(original.power);
    });

    it('should preserve power when updating min/max only', () => {
      const mapper = new CurveMapper();

      const original = mapper.getSettings('noiseAmount');
      expect(original.power).toBe(0.25);

      mapper.setSettings('noiseAmount', { min: 0, max: 5 });

      const updated = mapper.getSettings('noiseAmount');
      expect(updated.power).toBe(0.25); // power preserved
      expect(updated.max).toBe(5);
    });

    it('should produce correct mapping after range expansion', () => {
      const mapper = new CurveMapper();

      // Default spikiness: 0-1, power 1.0
      // Expand max to 5
      mapper.setSettings('spikiness', { max: 5 });

      // Slider 0 should map to 0, slider 100 should map to 5
      expect(mapper.mapSlider('spikiness', 0)).toBeCloseTo(0);
      expect(mapper.mapSlider('spikiness', 100)).toBeCloseTo(5);
      expect(mapper.mapSlider('spikiness', 50)).toBeCloseTo(2.5);
    });

    it('should produce correct mapping after range contraction', () => {
      const mapper = new CurveMapper();

      // Default hue: 0-360, power 1.0
      // Contract max to 180
      mapper.setSettings('hue', { max: 180 });

      // Slider 0 should map to 0, slider 100 should map to 180
      expect(mapper.mapSlider('hue', 0)).toBeCloseTo(0);
      expect(mapper.mapSlider('hue', 100)).toBeCloseTo(180);
      expect(mapper.mapSlider('hue', 50)).toBeCloseTo(90);
    });

    it('should produce correct reverse mapping after range adjustment', () => {
      const mapper = new CurveMapper();

      // Default scale: 0.05-1.0, expand to 0.05-6
      mapper.setSettings('scale', { max: 6 });

      // Value 6 should map to slider 100, value 0.05 to slider 0
      expect(mapper.mapToSlider('scale', 6)).toBeCloseTo(100);
      expect(mapper.mapToSlider('scale', 0.05)).toBeCloseTo(0);
    });

    it('should round-trip all default parameter types', () => {
      const mapper = new CurveMapper();

      const paramSliderPairs: Array<{ name: string; sliderVal: number }> = [
        { name: 'spikiness', sliderVal: 30 },
        { name: 'spikeFrequency', sliderVal: 60 },
        { name: 'hue', sliderVal: 75 },
        { name: 'scale', sliderVal: 50 },
        { name: 'fillSize', sliderVal: 40 },
        { name: 'fillOpacity', sliderVal: 80 },
        { name: 'blendOpacity', sliderVal: 90 },
        { name: 'noiseAmount', sliderVal: 25 },
        { name: 'noiseRate', sliderVal: 55 },
        { name: 'blurAmount', sliderVal: 35 },
        { name: 'blurRate', sliderVal: 45 },
        { name: 'fadeAmount', sliderVal: 70 },
        { name: 'autoRotationSpeed', sliderVal: 65 },
        { name: 'hueShiftAmount', sliderVal: 20 },
        { name: 'jiggleAmount', sliderVal: 50 },
        { name: 'emanationRate', sliderVal: 50 },
      ];

      for (const { name, sliderVal } of paramSliderPairs) {
        const value = mapper.mapSlider(name, sliderVal);
        const backToSlider = mapper.mapToSlider(name, value);
        expect(backToSlider).toBeCloseTo(sliderVal, 1);
      }
    });

    it('should round-trip after range adjustment', () => {
      const mapper = new CurveMapper();

      // Adjust spikiness range to 0.2-0.8 (contraction)
      mapper.setSettings('spikiness', { min: 0.2, max: 0.8 });

      // Round trip at various positions
      for (const sliderVal of [0, 25, 50, 75, 100]) {
        const value = mapper.mapSlider('spikiness', sliderVal);
        const backToSlider = mapper.mapToSlider('spikiness', value);
        expect(backToSlider).toBeCloseTo(sliderVal, 1);
      }
    });

    it('should resetSettings to param defaults', () => {
      const mapper = new CurveMapper();

      // Modify settings
      mapper.setSettings('hue', { min: 100, max: 200, power: 2.0 });
      const modified = mapper.getSettings('hue');
      expect(modified.min).toBe(100);
      expect(modified.max).toBe(200);
      expect(modified.power).toBe(2.0);

      // Reset
      mapper.resetSettings('hue');
      const reset = mapper.getSettings('hue');
      expect(reset.min).toBe(0);
      expect(reset.max).toBe(360);
      expect(reset.power).toBe(1.0);
    });

    it('should resetSettings for exponential params to correct defaults', () => {
      const mapper = new CurveMapper();

      // Modify noiseAmount
      mapper.setSettings('noiseAmount', { min: -1, max: 10, power: 1.0 });

      // Reset
      mapper.resetSettings('noiseAmount');
      const reset = mapper.getSettings('noiseAmount');
      expect(reset.min).toBe(0);
      expect(reset.max).toBe(1);
      expect(reset.power).toBe(0.25);
    });
  });

  describe('resolveSliderToParamValue', () => {
    describe('generic parameters (no special mapping)', () => {
      it('should map slider to value using curve settings for spikiness', () => {
        const settings: CurveSettings = { min: 0, max: 1, power: 1.0, type: 'power' };
        expect(resolveSliderToParamValue('spikiness', 0, settings)).toBe(0);
        expect(resolveSliderToParamValue('spikiness', 50, settings)).toBeCloseTo(0.5);
        expect(resolveSliderToParamValue('spikiness', 100, settings)).toBe(1);
      });

      it('should map slider to value using curve settings for hue', () => {
        const settings: CurveSettings = { min: 0, max: 360, power: 1.0, type: 'power' };
        expect(resolveSliderToParamValue('hue', 50, settings)).toBe(180);
      });

      it('should apply power curve for non-linear parameters', () => {
        const settings: CurveSettings = { min: 0, max: 1, power: 2.0, type: 'power' };
        // 0.5^2 = 0.25
        expect(resolveSliderToParamValue('unknownParam', 50, settings)).toBeCloseTo(0.25);
      });
    });

    describe('special mappings at default settings', () => {
      it('should use DilationMapping for expansionFactor at defaults', () => {
        const settings: CurveSettings = { min: 0.5, max: 1.5, power: 1.0, type: 'power' };
        // DilationMapping.sliderToFactor(100) = 1.0 (center)
        expect(resolveSliderToParamValue('expansionFactor', 100, settings)).toBeCloseTo(1.0);
        // DilationMapping.sliderToFactor(0) = 0.5
        expect(resolveSliderToParamValue('expansionFactor', 0, settings)).toBeCloseTo(0.5);
        // DilationMapping.sliderToFactor(200) = 1.5
        expect(resolveSliderToParamValue('expansionFactor', 200, settings)).toBeCloseTo(1.5);
      });

      it('should use FadeMapping for fadeAmount at defaults', () => {
        const settings: CurveSettings = { min: 0, max: 5, power: 0.333, type: 'power' };
        expect(resolveSliderToParamValue('fadeAmount', 0, settings)).toBe(0);
        expect(resolveSliderToParamValue('fadeAmount', 100, settings)).toBeCloseTo(5, 1);
      });

      it('should use EffectAmountMapping for noiseAmount at defaults', () => {
        const settings: CurveSettings = { min: 0, max: 1, power: 0.25, type: 'power' };
        expect(resolveSliderToParamValue('noiseAmount', 0, settings)).toBe(0);
        expect(resolveSliderToParamValue('noiseAmount', 100, settings)).toBeCloseTo(1);
      });

      it('should use EffectAmountMapping for blurAmount at defaults', () => {
        const settings: CurveSettings = { min: 0, max: 1, power: 0.25, type: 'power' };
        expect(resolveSliderToParamValue('blurAmount', 50, settings)).toBeCloseTo(
          EffectAmountMapping.sliderToAmount(50)
        );
      });

      it('should use EffectRateMapping for noiseRate at defaults', () => {
        const settings: CurveSettings = { min: 0, max: 10, power: 0.333, type: 'power' };
        expect(resolveSliderToParamValue('noiseRate', 50, settings)).toBeCloseTo(
          EffectRateMapping.sliderToRate(50)
        );
      });

      it('should use EffectRateMapping for blurRate at defaults', () => {
        const settings: CurveSettings = { min: 0, max: 10, power: 0.333, type: 'power' };
        expect(resolveSliderToParamValue('blurRate', 50, settings)).toBeCloseTo(
          EffectRateMapping.sliderToRate(50)
        );
      });

      it('should use RotationSpeedMapping for autoRotationSpeed at defaults', () => {
        const settings: CurveSettings = { min: -360, max: 360, power: 1.0, type: 'power' };
        // slider 50 = speed 0 (center)
        expect(resolveSliderToParamValue('autoRotationSpeed', 50, settings)).toBeCloseTo(0);
        // slider 0 = speed -360
        expect(resolveSliderToParamValue('autoRotationSpeed', 0, settings)).toBeCloseTo(-360);
      });
    });

    describe('special mappings with adjusted range (falls back to generic)', () => {
      it('should use generic mapping for expansionFactor with expanded range', () => {
        const settings: CurveSettings = { min: 0, max: 3, power: 1.0, type: 'power' };
        // Generic: slider 50 → 0 + 0.5 * 3 = 1.5
        expect(resolveSliderToParamValue('expansionFactor', 50, settings)).toBeCloseTo(1.5);
        expect(resolveSliderToParamValue('expansionFactor', 100, settings)).toBeCloseTo(3);
      });

      it('should use generic mapping for fadeAmount with expanded range', () => {
        const settings: CurveSettings = { min: 0, max: 20, power: 0.333, type: 'power' };
        // Not using FadeMapping since max != 5
        expect(resolveSliderToParamValue('fadeAmount', 100, settings)).toBeCloseTo(20);
      });

      it('should use generic mapping for noiseAmount with expanded range', () => {
        const settings: CurveSettings = { min: 0, max: 5, power: 0.25, type: 'power' };
        // max changed from 1 → 5
        expect(resolveSliderToParamValue('noiseAmount', 100, settings)).toBeCloseTo(5);
      });

      it('should use generic mapping for autoRotationSpeed with adjusted power', () => {
        const settings: CurveSettings = { min: -360, max: 360, power: 2.0, type: 'power' };
        // Power changed from 1.0 → 2.0
        expect(resolveSliderToParamValue('autoRotationSpeed', 50, settings)).toBeCloseTo(
          mapSliderToValue(50, settings)
        );
      });
    });
  });

  describe('resolveParamToSliderValue', () => {
    describe('generic parameters', () => {
      it('should reverse map for spikiness', () => {
        const settings: CurveSettings = { min: 0, max: 1, power: 1.0, type: 'power' };
        expect(resolveParamToSliderValue('spikiness', 0.5, settings)).toBeCloseTo(50);
      });

      it('should reverse map for hue', () => {
        const settings: CurveSettings = { min: 0, max: 360, power: 1.0, type: 'power' };
        expect(resolveParamToSliderValue('hue', 180, settings)).toBeCloseTo(50);
      });
    });

    describe('special mappings at default settings', () => {
      it('should use DilationMapping for expansionFactor at defaults', () => {
        const settings: CurveSettings = { min: 0.5, max: 1.5, power: 1.0, type: 'power' };
        expect(resolveParamToSliderValue('expansionFactor', 1.0, settings)).toBeCloseTo(100);
        expect(resolveParamToSliderValue('expansionFactor', 0.5, settings)).toBe(0);
        expect(resolveParamToSliderValue('expansionFactor', 1.5, settings)).toBe(200);
      });

      it('should use FadeMapping for fadeAmount at defaults', () => {
        const settings: CurveSettings = { min: 0, max: 5, power: 0.333, type: 'power' };
        expect(resolveParamToSliderValue('fadeAmount', 0, settings)).toBe(0);
        expect(resolveParamToSliderValue('fadeAmount', 5, settings)).toBeCloseTo(100);
      });

      it('should use EffectAmountMapping for blurAmount at defaults', () => {
        const settings: CurveSettings = { min: 0, max: 1, power: 0.25, type: 'power' };
        const val = 0.5;
        expect(resolveParamToSliderValue('blurAmount', val, settings)).toBeCloseTo(
          EffectAmountMapping.amountToSlider(val)
        );
      });

      it('should use EffectRateMapping for noiseRate at defaults', () => {
        const settings: CurveSettings = { min: 0, max: 10, power: 0.333, type: 'power' };
        const val = 5;
        expect(resolveParamToSliderValue('noiseRate', val, settings)).toBeCloseTo(
          EffectRateMapping.rateToSlider(val)
        );
      });
    });

    describe('special mappings with adjusted range (falls back to generic)', () => {
      it('should use generic mapping for expansionFactor with expanded range', () => {
        const settings: CurveSettings = { min: 0, max: 3, power: 1.0, type: 'power' };
        expect(resolveParamToSliderValue('expansionFactor', 1.5, settings)).toBeCloseTo(50);
        expect(resolveParamToSliderValue('expansionFactor', 3, settings)).toBeCloseTo(100);
      });

      it('should use generic mapping for fadeAmount with expanded range', () => {
        const settings: CurveSettings = { min: 0, max: 20, power: 0.333, type: 'power' };
        expect(resolveParamToSliderValue('fadeAmount', 20, settings)).toBeCloseTo(100);
      });
    });

    describe('round-trip consistency', () => {
      const testParams: Array<{ name: string; settings: CurveSettings; sliderValues: number[] }> = [
        {
          name: 'spikiness',
          settings: { min: 0, max: 1, power: 1.0, type: 'power' },
          sliderValues: [0, 25, 50, 75, 100],
        },
        {
          name: 'hue',
          settings: { min: 0, max: 360, power: 1.0, type: 'power' },
          sliderValues: [0, 25, 50, 75, 100],
        },
        {
          name: 'noiseAmount',
          settings: { min: 0, max: 1, power: 0.25, type: 'power' },
          sliderValues: [0, 25, 50, 75, 100],
        },
        {
          name: 'fadeAmount',
          settings: { min: 0, max: 5, power: 0.333, type: 'power' },
          sliderValues: [0, 25, 50, 75, 100],
        },
        {
          name: 'autoRotationSpeed',
          settings: { min: -360, max: 360, power: 1.0, type: 'power' },
          sliderValues: [0, 25, 50, 75, 100],
        },
      ];

      for (const { name, settings, sliderValues } of testParams) {
        it(`should round-trip slider→value→slider for ${name} at default settings`, () => {
          for (const sv of sliderValues) {
            const value = resolveSliderToParamValue(name, sv, settings);
            const back = resolveParamToSliderValue(name, value, settings);
            expect(back).toBeCloseTo(sv, 0);
          }
        });
      }

      it('should round-trip for expansionFactor (0-200 slider) at default settings', () => {
        const settings: CurveSettings = { min: 0.5, max: 1.5, power: 1.0, type: 'power' };
        for (const sv of [0, 50, 100, 150, 200]) {
          const value = resolveSliderToParamValue('expansionFactor', sv, settings);
          const back = resolveParamToSliderValue('expansionFactor', value, settings);
          expect(back).toBeCloseTo(sv, 0);
        }
      });

      it('should round-trip after range adjustment', () => {
        // noiseAmount with expanded max: 0 to 5
        const settings: CurveSettings = { min: 0, max: 5, power: 0.25, type: 'power' };
        for (const sv of [0, 25, 50, 75, 100]) {
          const value = resolveSliderToParamValue('noiseAmount', sv, settings);
          const back = resolveParamToSliderValue('noiseAmount', value, settings);
          expect(back).toBeCloseTo(sv, 0);
        }
      });
    });
  });

  describe('formatParamValue', () => {
    it('should format hue as degrees (integer)', () => {
      expect(formatParamValue('hue', 180)).toBe('180°');
      expect(formatParamValue('hue', 45.6)).toBe('46°');
    });

    it('should format rotation as degrees (integer)', () => {
      expect(formatParamValue('rotation', 90)).toBe('90°');
    });

    it('should format autoRotationSpeed as degrees (1 decimal)', () => {
      expect(formatParamValue('autoRotationSpeed', 15)).toBe('15.0°');
      expect(formatParamValue('autoRotationSpeed', 15.67)).toBe('15.7°');
    });

    it('should format expansionFactor with 4 decimals', () => {
      expect(formatParamValue('expansionFactor', 1)).toBe('1.0000');
      expect(formatParamValue('expansionFactor', 1.05)).toBe('1.0500');
    });

    it('should format fadeAmount with 3 decimals', () => {
      expect(formatParamValue('fadeAmount', 0.5)).toBe('0.500');
    });

    it('should format hueShiftAmount with 3 decimals', () => {
      expect(formatParamValue('hueShiftAmount', 0.1)).toBe('0.100');
    });

    it('should format spikeFrequency with 1 decimal', () => {
      expect(formatParamValue('spikeFrequency', 6)).toBe('6.0');
      expect(formatParamValue('spikeFrequency', 12.34)).toBe('12.3');
    });

    it('should format unknown params with 2 decimals (default)', () => {
      expect(formatParamValue('spikiness', 0.5)).toBe('0.50');
      expect(formatParamValue('scale', 0.75)).toBe('0.75');
      expect(formatParamValue('fillSize', 0.123)).toBe('0.12');
    });
  });
});
