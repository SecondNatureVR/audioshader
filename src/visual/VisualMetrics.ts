/**
 * Visual metrics computed from rendered pixel data.
 * Used as fitness function components or as modulation sources.
 */

export interface VisualMetrics {
  /** Brightness spread (std dev of luminance) — avoid flat or blown */
  luminanceVariance: number;
  /** Color diversity (Shannon entropy of quantized RGB) */
  colorEntropy: number;
  /** Structural complexity (edge magnitude, normalized) */
  edgeDensity: number;
  /** Color intensity (mean saturation) */
  saturationMean: number;
  /** Composition balance — distance of luminance centroid from center */
  centerMass: number;
  /** Radial structure — correlation of opposite radial samples */
  radialSymmetry: number;
  /** Non-empty pixels — % above luminance threshold */
  fillRatio: number;
  /** Frame-to-frame change (mean absolute diff) */
  temporalFlux: number;
  /** Consistency of per-pixel flux */
  fluxVariance: number;
  /** Deviation from recent history (EMA distance) */
  novelty: number;
  /** Composite fitness score (weighted sum of above) */
  fitness: number;
}

export type VisualMetricKey = keyof VisualMetrics;

/** Default weights for composite fitness (tune for desired aesthetic) */
export const DEFAULT_FITNESS_WEIGHTS: Partial<Record<VisualMetricKey, number>> = {
  luminanceVariance: 0.15,
  colorEntropy: 0.15,
  edgeDensity: 0.15,
  saturationMean: 0.1,
  fillRatio: 0.1,
  temporalFlux: 0.2,
  novelty: 0.15,
};
