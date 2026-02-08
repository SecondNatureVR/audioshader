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
 * Calculate new range bounds when a value exceeds current limits
 * Returns null if no expansion is needed, otherwise returns { min, max }
 * Only adjusts the boundary (min or max) that the value is closer to
 */
export function calculateExpandedRange(
  value: number,
  currentMin: number,
  currentMax: number
): { min: number; max: number } | null {
  // If value is within range, no expansion needed
  if (value >= currentMin && value <= currentMax) {
    return null;
  }

  // Calculate distances to min and max
  const distanceToMin = Math.abs(value - currentMin);
  const distanceToMax = Math.abs(value - currentMax);

  // Determine which boundary is closer
  const adjustMin = distanceToMin <= distanceToMax;

  if (adjustMin) {
    // Value is closer to min, adjust min to match value
    return { min: value, max: currentMax };
  } else {
    // Value is closer to max, adjust max to match value
    return { min: currentMin, max: value };
  }
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
