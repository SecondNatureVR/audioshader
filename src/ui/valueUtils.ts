/**
 * Utility functions for value parsing and range management
 * These pure functions are extracted for testability
 */

/**
 * Parse a numeric value from text that may contain units or formatting
 * Examples: "180°" -> 180, "0.50" -> 0.5, "30%" -> 30, "-45.5" -> -45.5
 */
export function parseNumericValue(text: string): number | null {
  const cleaned = text.trim().replace(/[^0-9.-]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Adjust range bounds so the entered value becomes the closest boundary.
 * Always returns adjusted bounds — works for both expansion (value outside range)
 * and contraction (value inside range).
 * The boundary (min or max) closest to the value is moved to match it.
 * Returns null only if adjustment would create an invalid range (min >= max).
 */
export function calculateAdjustedRange(
  value: number,
  currentMin: number,
  currentMax: number
): { min: number; max: number } | null {
  // Calculate distances to min and max
  const distanceToMin = Math.abs(value - currentMin);
  const distanceToMax = Math.abs(value - currentMax);

  // Determine which boundary is closer (tie-break: adjust min)
  const adjustMin = distanceToMin <= distanceToMax;

  let newMin = currentMin;
  let newMax = currentMax;

  if (adjustMin) {
    newMin = value;
  } else {
    newMax = value;
  }

  // Guard rail: prevent invalid range (min >= max)
  if (newMin >= newMax) {
    return null;
  }

  return { min: newMin, max: newMax };
}

/**
 * Format a numeric value for display
 * Common formatters for different value types
 */
export const ValueFormatters = {
  /** Format with 2 decimal places */
  decimal2: (v: number): string => v.toFixed(2),

  /** Format with 3 decimal places */
  decimal3: (v: number): string => v.toFixed(3),

  /** Format with 1 decimal place */
  decimal1: (v: number): string => v.toFixed(1),

  /** Format as integer */
  integer: (v: number): string => Math.round(v).toString(),

  /** Format as degrees (e.g., "180°") */
  degrees: (v: number): string => `${Math.round(v)}°`,

  /** Format as percentage (e.g., "30%") */
  percentage: (v: number): string => `${Math.round(v)}%`,

  /** Format as degrees with 1 decimal (e.g., "15.0°") */
  degreesDecimal: (v: number): string => `${v.toFixed(1)}°`,
};
