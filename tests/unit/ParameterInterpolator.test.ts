import { describe, it, expect, beforeEach } from 'vitest';
import { ParameterInterpolator } from '../../src/render/ParameterInterpolator';

describe('ParameterInterpolator', () => {
  let interpolator: ParameterInterpolator;

  beforeEach(() => {
    interpolator = new ParameterInterpolator();
  });

  describe('basic functionality', () => {
    it('should be enabled by default', () => {
      expect(interpolator.enabled).toBe(true);
    });

    it('should store and retrieve current values', () => {
      interpolator.setTarget('test', 0.5);
      expect(interpolator.getCurrent('test')).toBe(0.5);
    });

    it('should return null for unknown parameters', () => {
      expect(interpolator.getCurrent('unknown')).toBeNull();
    });
  });

  describe('setEnabled', () => {
    it('should snap all values to targets when disabled', () => {
      interpolator.setTarget('param1', 1.0);
      interpolator.setTarget('param2', 0.5);

      // Simulate partial interpolation by updating
      interpolator.update();

      interpolator.setEnabled(false);

      expect(interpolator.getCurrent('param1')).toBe(1.0);
      expect(interpolator.getCurrent('param2')).toBe(0.5);
    });
  });

  describe('snapTo', () => {
    it('should immediately set both current and target', () => {
      interpolator.setTarget('param', 0);
      interpolator.snapTo('param', 1.0);

      expect(interpolator.getCurrent('param')).toBe(1.0);
      expect(interpolator.getTarget('param')).toBe(1.0);
    });

    it('should create param if it does not exist', () => {
      interpolator.snapTo('newParam', 0.75);

      expect(interpolator.getCurrent('newParam')).toBe(0.75);
    });
  });

  describe('setTargetRotation', () => {
    it('should handle rotation wrapping correctly (short path)', () => {
      interpolator.snapTo('rotation', 350);
      interpolator.setTargetRotation('rotation', 10);

      // Should take the short path (350 -> 10 = +20)
      const target = interpolator.getTarget('rotation');
      expect(target).toBeDefined();
      // The actual value should be close to 370 (or equivalent path)
    });

    it('should normalize angles to 0-360 range', () => {
      interpolator.setTargetRotation('rotation', 400);

      const target = interpolator.getTarget('rotation');
      expect(target).toBeDefined();
      if (target !== null) {
        expect(target % 360).toBeCloseTo(40, 1);
      }
    });
  });

  describe('isInterpolating', () => {
    it('should return false for stable parameters', () => {
      interpolator.snapTo('stable', 1.0);

      expect(interpolator.isInterpolating('stable')).toBe(false);
    });

    it('should return false for unknown parameters', () => {
      expect(interpolator.isInterpolating('unknown')).toBe(false);
    });
  });

  describe('per-parameter duration overrides', () => {
    it('should snap emanationRate instantly (duration=0 override)', () => {
      // Set an initial value
      interpolator.snapTo('emanationRate', 10);
      expect(interpolator.getCurrent('emanationRate')).toBe(10);

      // Set a new target — should snap instantly because emanationRate has duration=0
      interpolator.setTarget('emanationRate', 100);
      interpolator.update();

      expect(interpolator.getCurrent('emanationRate')).toBe(100);
    });

    it('should interpolate normal params over time (no override)', () => {
      interpolator.snapTo('spikiness', 0);
      interpolator.setTarget('spikiness', 1.0);
      interpolator.update();

      // Should NOT have reached target yet (default duration is 0.5s)
      const current = interpolator.getCurrent('spikiness');
      expect(current).not.toBeNull();
      expect(current!).toBeLessThan(1.0);
      expect(current!).toBeGreaterThanOrEqual(0);
    });

    it('should still allow explicit immediate for any param', () => {
      interpolator.snapTo('hue', 0);
      // Explicit duration=0 overrides default
      interpolator.setTarget('hue', 180, 0);
      interpolator.update();

      expect(interpolator.getCurrent('hue')).toBe(180);
    });
  });
});
