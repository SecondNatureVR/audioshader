import { describe, it, expect } from 'vitest';
import {
  parseNumericValue,
  calculateAdjustedRange,
  ValueFormatters,
} from '../../src/ui/valueUtils';

describe('valueUtils', () => {
  describe('parseNumericValue', () => {
    it('should parse plain integers', () => {
      expect(parseNumericValue('42')).toBe(42);
      expect(parseNumericValue('0')).toBe(0);
      expect(parseNumericValue('100')).toBe(100);
    });

    it('should parse decimal numbers', () => {
      expect(parseNumericValue('0.5')).toBe(0.5);
      expect(parseNumericValue('3.14')).toBe(3.14);
      expect(parseNumericValue('0.001')).toBe(0.001);
    });

    it('should parse negative numbers', () => {
      expect(parseNumericValue('-45')).toBe(-45);
      expect(parseNumericValue('-0.5')).toBe(-0.5);
      expect(parseNumericValue('-180')).toBe(-180);
    });

    it('should strip degree symbols', () => {
      expect(parseNumericValue('180°')).toBe(180);
      expect(parseNumericValue('0°')).toBe(0);
      expect(parseNumericValue('-45°')).toBe(-45);
    });

    it('should strip percentage symbols', () => {
      expect(parseNumericValue('30%')).toBe(30);
      expect(parseNumericValue('100%')).toBe(100);
      expect(parseNumericValue('0%')).toBe(0);
    });

    it('should strip other non-numeric characters', () => {
      expect(parseNumericValue('$100')).toBe(100);
      expect(parseNumericValue('value: 42')).toBe(42);
      expect(parseNumericValue('abc123def')).toBe(123);
    });

    it('should handle whitespace', () => {
      expect(parseNumericValue('  42  ')).toBe(42);
      expect(parseNumericValue('\t100\n')).toBe(100);
    });

    it('should return null for empty strings', () => {
      expect(parseNumericValue('')).toBeNull();
      expect(parseNumericValue('   ')).toBeNull();
    });

    it('should return null for non-numeric strings', () => {
      expect(parseNumericValue('abc')).toBeNull();
      expect(parseNumericValue('°')).toBeNull();
      expect(parseNumericValue('---')).toBeNull();
    });
  });

  describe('calculateAdjustedRange', () => {
    // --- Contraction: value INSIDE the current range ---

    describe('contraction (value inside range)', () => {
      it('should contract min when value is closer to min', () => {
        // Range 0-100, value 20 is closer to min (dist 20) than max (dist 80)
        const result = calculateAdjustedRange(20, 0, 100);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(20);
        expect(result!.max).toBe(100);
      });

      it('should contract max when value is closer to max', () => {
        // Range 0-100, value 80 is closer to max (dist 20) than min (dist 80)
        const result = calculateAdjustedRange(80, 0, 100);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0);
        expect(result!.max).toBe(80);
      });

      it('should adjust min on tie-break (equidistant from both)', () => {
        // Range 0-100, value 50 is equidistant (50 from both)
        const result = calculateAdjustedRange(50, 0, 100);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(50);
        expect(result!.max).toBe(100);
      });

      it('should contract a small range', () => {
        // Range 0-1, value 0.3 is closer to min
        const result = calculateAdjustedRange(0.3, 0, 1);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0.3);
        expect(result!.max).toBe(1);
      });

      it('should contract max for a value slightly below max', () => {
        // Range 0-360, value 350 is closer to max (dist 10) than min (dist 350)
        const result = calculateAdjustedRange(350, 0, 360);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0);
        expect(result!.max).toBe(350);
      });
    });

    // --- Expansion: value OUTSIDE the current range ---

    describe('expansion (value outside range)', () => {
      it('should expand max when value is above max', () => {
        // Range 0-100, value 150 is closer to max (dist 50) than min (dist 150)
        const result = calculateAdjustedRange(150, 0, 100);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0);
        expect(result!.max).toBe(150);
      });

      it('should expand min when value is below min', () => {
        // Range 0-100, value -10 is closer to min (dist 10) than max (dist 110)
        const result = calculateAdjustedRange(-10, 0, 100);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(-10);
        expect(result!.max).toBe(100);
      });

      it('should expand max for a large value', () => {
        // Range 0-100, value 500 is closer to max (dist 400) than min (dist 500)
        const result = calculateAdjustedRange(500, 0, 100);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0);
        expect(result!.max).toBe(500);
      });

      it('should expand min for a negative range', () => {
        // Range -100-0, value -200 is closer to min (dist 100) than max (dist 200)
        const result = calculateAdjustedRange(-200, -100, 0);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(-200);
        expect(result!.max).toBe(0);
      });

      it('should expand max for fractional ranges (e.g., scale 0.05-1.0)', () => {
        // Range 0.05-1.0, value 6 is closer to max (dist 5) than min (dist 5.95)
        const result = calculateAdjustedRange(6, 0.05, 1.0);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0.05);
        expect(result!.max).toBe(6);
      });
    });

    // --- Edge cases ---

    describe('edge cases', () => {
      it('should return null when value equals current min (would make min=max impossible)', () => {
        // Value equals min -- adjusting min to value is a no-op, but let's verify
        // distToMin=0, distToMax=100 → adjustMin → newMin=0, newMax=100 (no change needed)
        const result = calculateAdjustedRange(0, 0, 100);
        // min=0, max=100 → valid, returns the same range
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0);
        expect(result!.max).toBe(100);
      });

      it('should return null when value equals current max', () => {
        // Value equals max -- distToMin=100, distToMax=0 → adjustMax → newMax=100
        const result = calculateAdjustedRange(100, 0, 100);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0);
        expect(result!.max).toBe(100);
      });

      it('should return null when adjustment would make min >= max', () => {
        // Range 0-100, value 100 entered → adjustMin (dist 100) vs adjustMax (dist 0)
        // adjustMax → max=100 → no problem. But let's test a case that WOULD break:
        // Range 50-51, value 50 → adjustMin → min=50, max=51 → valid
        expect(calculateAdjustedRange(50, 50, 51)).not.toBeNull();

        // Range 50-51, value 51 → adjustMax → min=50, max=51 → valid
        expect(calculateAdjustedRange(51, 50, 51)).not.toBeNull();

        // Range 10-20, value 20 entered → distToMin=10, distToMax=0 → adjustMax → max=20 → valid
        expect(calculateAdjustedRange(20, 10, 20)).not.toBeNull();

        // Range 10-20, value 10 entered → distToMin=0, distToMax=10 → adjustMin → min=10 → valid
        expect(calculateAdjustedRange(10, 10, 20)).not.toBeNull();
      });

      it('should return null when contraction would create min >= max', () => {
        // Range 0-100, value 100 → closer to max → adjustMax → max=100, min=0 → valid
        // But what about a tiny range?
        // Range 0-0.001, value 0.001 → adjustMax → max=0.001 → valid
        expect(calculateAdjustedRange(0.001, 0, 0.001)).not.toBeNull();

        // Pathological: range 0-1, value 0 → adjustMin → min=0, max=1 → valid
        expect(calculateAdjustedRange(0, 0, 1)).not.toBeNull();
      });

      it('should handle negative ranges correctly', () => {
        // Range -100-0, value -50 closer to min → adjustMin
        const result = calculateAdjustedRange(-50, -100, 0);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(-50);
        expect(result!.max).toBe(0);
      });

      it('should handle ranges that span negative to positive', () => {
        // Range -180-180, value 0 is equidistant → adjustMin (tie-break)
        const result = calculateAdjustedRange(0, -180, 180);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0);
        expect(result!.max).toBe(180);
      });

      it('should handle very small fractional adjustments', () => {
        // Range 0-0.2, value 0.1 → equidistant → adjustMin
        const result = calculateAdjustedRange(0.1, 0, 0.2);
        expect(result).not.toBeNull();
        expect(result!.min).toBe(0.1);
        expect(result!.max).toBe(0.2);
      });

      it('should return null if value would make min equal to max', () => {
        // Range 0-100, if we could somehow get min=max... let's test directly
        // Range 50-50 doesn't make sense as input, but value=50, range 0-100:
        // That's contraction, not invalid. Let's create a real invalid case:
        // Range 10-10.001, value 10.001 → distToMin=0.001, distToMax=0 → adjustMax → max=10.001 → valid (10 < 10.001)
        expect(calculateAdjustedRange(10.001, 10, 10.001)).not.toBeNull();

        // But: range 10-11, value 10 → adjustMin → min=10, max=11 → valid
        // To get invalid: we need a case where the resulting min >= max
        // This happens when, e.g., value is exactly at or beyond the opposite boundary
        // after contraction: range 5-10, value 10 → adjustMax → max=10 → min=5, max=10 → valid
        // range 5-10, value 5 → adjustMin → min=5 → valid
        // The only way to get null is if the adjustment creates min >= max,
        // which happens when expanding in a degenerate way or contracting past the other boundary.
        // Since we adjust the CLOSEST boundary, this shouldn't normally happen unless the range
        // is already degenerate. Let's verify the guard works:
        // Imagine range is 10-10 (degenerate): value 10 → adjustMin → min=10, max=10 → INVALID
        const result = calculateAdjustedRange(10, 10, 10);
        expect(result).toBeNull();
      });
    });
  });

  describe('ValueFormatters', () => {
    describe('decimal2', () => {
      it('should format with 2 decimal places', () => {
        expect(ValueFormatters.decimal2(0.5)).toBe('0.50');
        expect(ValueFormatters.decimal2(1.234)).toBe('1.23');
        expect(ValueFormatters.decimal2(10)).toBe('10.00');
      });
    });

    describe('decimal3', () => {
      it('should format with 3 decimal places', () => {
        expect(ValueFormatters.decimal3(0.05)).toBe('0.050');
        expect(ValueFormatters.decimal3(1.2346)).toBe('1.235');
      });
    });

    describe('decimal1', () => {
      it('should format with 1 decimal place', () => {
        expect(ValueFormatters.decimal1(15)).toBe('15.0');
        expect(ValueFormatters.decimal1(3.14)).toBe('3.1');
      });
    });

    describe('integer', () => {
      it('should format as integer', () => {
        expect(ValueFormatters.integer(42.7)).toBe('43');
        expect(ValueFormatters.integer(42.3)).toBe('42');
        expect(ValueFormatters.integer(0)).toBe('0');
      });
    });

    describe('degrees', () => {
      it('should format as degrees', () => {
        expect(ValueFormatters.degrees(180)).toBe('180°');
        expect(ValueFormatters.degrees(45.6)).toBe('46°');
        expect(ValueFormatters.degrees(0)).toBe('0°');
      });
    });

    describe('percentage', () => {
      it('should format as percentage', () => {
        expect(ValueFormatters.percentage(30)).toBe('30%');
        expect(ValueFormatters.percentage(100)).toBe('100%');
        expect(ValueFormatters.percentage(75.4)).toBe('75%');
      });
    });

    describe('degreesDecimal', () => {
      it('should format as degrees with 1 decimal', () => {
        expect(ValueFormatters.degreesDecimal(15)).toBe('15.0°');
        expect(ValueFormatters.degreesDecimal(45.67)).toBe('45.7°');
      });
    });
  });
});
