import { describe, it, expect } from 'vitest';
import {
  parseNumericValue,
  calculateExpandedRange,
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

  describe('calculateExpandedRange', () => {
    it('should return null when value is within range', () => {
      expect(calculateExpandedRange(50, 0, 100)).toBeNull();
      expect(calculateExpandedRange(0, 0, 100)).toBeNull();
      expect(calculateExpandedRange(100, 0, 100)).toBeNull();
    });

    it('should expand min when value is below current min', () => {
      const result = calculateExpandedRange(-10, 0, 100);
      expect(result).not.toBeNull();
      expect(result!.min).toBeLessThan(-10);
      expect(result!.max).toBe(100); // max unchanged
    });

    it('should expand max when value is above current max', () => {
      const result = calculateExpandedRange(150, 0, 100);
      expect(result).not.toBeNull();
      expect(result!.min).toBe(0); // min unchanged
      expect(result!.max).toBeGreaterThan(150);
    });

    it('should add 10% headroom below for negative expansion', () => {
      // value = -10, 10% of |-10| = 1, so new min should be -11
      const result = calculateExpandedRange(-10, 0, 100);
      expect(result!.min).toBeCloseTo(-11);
    });

    it('should add 10% headroom above for positive expansion', () => {
      // value = 200, 10% of 200 = 20, so new max should be 220
      const result = calculateExpandedRange(200, 0, 100);
      expect(result!.max).toBeCloseTo(220);
    });

    it('should handle zero value correctly', () => {
      // value = 0 below min of 10
      const result = calculateExpandedRange(0, 10, 100);
      expect(result).not.toBeNull();
      expect(result!.min).toBe(0); // 0 - 0*0.1 = 0
    });

    it('should handle negative ranges', () => {
      const result = calculateExpandedRange(-200, -100, 0);
      expect(result).not.toBeNull();
      expect(result!.min).toBeLessThan(-200);
      expect(result!.max).toBe(0);
    });

    it('should expand both min and max if value is way outside range', () => {
      // This shouldn't happen in practice, but testing edge case
      // value 500 is above max 100
      const result = calculateExpandedRange(500, 0, 100);
      expect(result).not.toBeNull();
      expect(result!.min).toBe(0);
      expect(result!.max).toBeCloseTo(550);
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
