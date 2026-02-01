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
 * Expansion adds 10% headroom beyond the value
 */
export function calculateExpandedRange(
  value: number,
  currentMin: number,
  currentMax: number
): { min: number; max: number } | null {
  let needsExpansion = false;
  let newMin = currentMin;
  let newMax = currentMax;

  if (value < currentMin) {
    // Expand min with 10% headroom below the value
    newMin = value - Math.abs(value) * 0.1;
    needsExpansion = true;
  }

  if (value > currentMax) {
    // Expand max with 10% headroom above the value
    newMax = value + Math.abs(value) * 0.1;
    needsExpansion = true;
  }

  return needsExpansion ? { min: newMin, max: newMax } : null;
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
