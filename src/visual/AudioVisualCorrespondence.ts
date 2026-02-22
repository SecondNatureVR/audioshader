/**
 * Audio-Visual Correspondence Evaluator
 *
 * Measures how well audio metrics and visual metrics align — i.e. how responsive
 * the visuals are to the audio given the current audio mappings.
 *
 * Use cases:
 * - Real-time fitness meter (how well do audio-driven params produce corresponding visuals?)
 * - Automated exploration: try different mappings, optimize for max fitness
 * - Responsivity feedback: help users tune their mappings
 *
 * Approach: For each active audio mapping (audioSource → param), we compute
 * correlation(audioSource, expectedVisualMetrics). Params affect specific visual
 * metrics (e.g. scale → fillRatio). High correlation = good correspondence.
 */

import type { AudioMetrics } from '../types';
import type { VisualParams } from '../types';
import type { VisualMetrics, VisualMetricKey } from './VisualMetrics';
import type { AudioMappings } from '../types';

/** Which visual metrics are most affected by each param (heuristic). Exported for effectiveness tracking. */
export const PARAM_TO_VISUAL_METRICS: Partial<Record<keyof VisualParams, VisualMetricKey[]>> = {
  scale: ['fillRatio', 'luminanceVariance'],
  fillSize: ['fillRatio', 'luminanceVariance'],
  fillOpacity: ['fillRatio', 'luminanceVariance'],
  strokeWeight: ['edgeDensity', 'radialSymmetry'],
  strokeOpacity: ['edgeDensity'],
  strokeGlow: ['luminanceVariance'],
  spikiness: ['edgeDensity', 'radialSymmetry'],
  spikeFrequency: ['temporalFlux', 'edgeDensity'],
  spikeSharpness: ['edgeDensity'],
  expansionFactor: ['fillRatio', 'temporalFlux'],
  fadeAmount: ['temporalFlux', 'fillRatio'],
  hue: ['colorEntropy', 'saturationMean'],
  hueShiftAmount: ['colorEntropy', 'saturationMean'],
  emanationRate: ['temporalFlux', 'fillRatio'],
  noiseAmount: ['edgeDensity'],
  blurAmount: ['edgeDensity'],
  blendOpacity: ['luminanceVariance', 'fillRatio'],
  autoRotationSpeed: ['temporalFlux', 'radialSymmetry'],
  jiggleAmount: ['temporalFlux'],
};

export interface CorrespondenceResult {
  /** Overall fitness 0-1: how well audio and visuals correspond */
  fitness: number;
  /** Per-route scores: (param, audioSource) → correlation */
  routeScores: Array<{ param: string; source: string; correlation: number }>;
  /** Sample count used (need enough for meaningful correlation) */
  sampleCount: number;
  /** Boredom 0-1: high when visuals are repetitive (rotation, static colors). Penalizes fitness. */
  boredom: number;
  /** Novelty 0-1: deviation from recent history (from VisualMetrics) */
  novelty: number;
  /** Interest 0-1: composite score = α·fitness + β·(1-boredom) + γ·novelty */
  interest: number;
}

export interface AudioVisualCorrespondenceOptions {
  /** Rolling window size (frames). Need ~30+ for stable correlation. */
  windowSize?: number;
  /** Min samples before returning non-zero fitness */
  minSamples?: number;
  /** Max boredom penalty (fitness *= 1 - boredom * this). 0.6 = 60% max penalty */
  boredomPenaltyStrength?: number;
  /** Change score below this = repetitive, boredom increases */
  boredomChangeThreshold?: number;
  /** Weights for interest = α·fitness + β·(1-boredom) + γ·novelty */
  interestWeights?: { fitness: number; boredomInverse: number; novelty: number };
}

const DEFAULT_INTEREST_WEIGHTS = { fitness: 0.5, boredomInverse: 0.2, novelty: 0.3 };

const DEFAULT_OPTIONS: Required<Omit<AudioVisualCorrespondenceOptions, 'interestWeights'>> & {
  interestWeights: { fitness: number; boredomInverse: number; novelty: number };
} = {
  windowSize: 90,
  minSamples: 30,
  boredomPenaltyStrength: 0.6,
  boredomChangeThreshold: 0.02,
  interestWeights: DEFAULT_INTEREST_WEIGHTS,
};

/** Indices into visual vector for change detection (flux, luminance, color, fill) */
const CHANGE_METRIC_INDICES = [7, 0, 1, 6]; // temporalFlux, luminanceVariance, colorEntropy, fillRatio

export class AudioVisualCorrespondence {
  private options: Required<AudioVisualCorrespondenceOptions>;
  private audioBuffer: number[][] = [];
  private visualBuffer: number[][] = [];
  /** Decaying boredom: increases when novelty is low (repetitive), decreases when novelty is high */
  private boredom: number = 0;

  constructor(options: AudioVisualCorrespondenceOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      interestWeights: { ...DEFAULT_INTEREST_WEIGHTS, ...options.interestWeights },
    };
  }

  /**
   * Record a (audio, visual) pair. Call each frame when both are available.
   */
  record(audio: AudioMetrics, visual: VisualMetrics): void {
    const audioVec = this.audioMetricsToVector(audio);
    const visualVec = this.visualMetricsToVector(visual);
    this.audioBuffer.push(audioVec);
    this.visualBuffer.push(visualVec);
    if (this.audioBuffer.length > this.options.windowSize) {
      this.audioBuffer.shift();
      this.visualBuffer.shift();
    }

    const changeScore = this.computeVisualChangeScore();
    const threshold = this.options.boredomChangeThreshold;
    if (changeScore < threshold) {
      this.boredom = Math.min(0.9, this.boredom + 0.003);
    } else {
      this.boredom = Math.max(0, this.boredom - 0.05);
    }
  }

  /**
   * Compute how much the visual metrics are changing (0–1).
   * Uses variance of key metrics over the window + novelty.
   * Low = repetitive (rotation, static), high = significant change.
   */
  private computeVisualChangeScore(): number {
    const n = this.visualBuffer.length;
    if (n < 5) return 0;

    let sumVar = 0;
    for (const idx of CHANGE_METRIC_INDICES) {
      const series = this.visualBuffer.map((row) => row[idx] ?? 0);
      const mean = series.reduce((a, v) => a + v, 0) / n;
      const variance = series.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
      sumVar += Math.sqrt(variance);
    }
    const avgVar = sumVar / CHANGE_METRIC_INDICES.length;
    const novelty = this.visualBuffer[n - 1]?.[9] ?? 0;
    return Math.min(1, avgVar * 3 + novelty * 2);
  }

  private audioMetricsToVector(m: AudioMetrics): number[] {
    return [
      m.rms, m.bass, m.mid, m.high, m.presence, m.harshness, m.mud,
      m.compression, m.collision, m.coherence, m.stereoWidth, m.phaseRisk,
      m.lowImbalance, m.emptiness, m.panPosition, m.rmsRate, m.bassRate,
      m.beatOnset, m.beatConfidence, m.tempoBpmNorm,
    ];
  }

  private visualMetricsToVector(m: VisualMetrics): number[] {
    return [
      m.luminanceVariance, m.colorEntropy, m.edgeDensity, m.saturationMean,
      m.centerMass, m.radialSymmetry, m.fillRatio, m.temporalFlux,
      m.fluxVariance, m.novelty, m.fitness,
    ];
  }

  /**
   * Evaluate correspondence given current audio mappings.
   * Returns fitness 0-1 and per-route scores.
   */
  evaluate(mappings: AudioMappings): CorrespondenceResult {
    const routeScores: Array<{ param: string; source: string; correlation: number }> = [];
    const n = this.audioBuffer.length;

    if (n < this.options.minSamples) {
      const novelty = this.visualBuffer[n - 1]?.[9] ?? 0;
      const interest = 0;
      return { fitness: 0, routeScores, sampleCount: n, boredom: this.boredom, novelty, interest };
    }

    const audioKeys: (keyof AudioMetrics)[] = [
      'rms', 'bass', 'mid', 'high', 'presence', 'harshness', 'mud',
      'compression', 'collision', 'coherence', 'stereoWidth', 'phaseRisk',
      'lowImbalance', 'emptiness', 'panPosition', 'rmsRate', 'bassRate',
      'beatOnset', 'beatConfidence', 'tempoBpm',
    ];
    const visualKeys: VisualMetricKey[] = [
      'luminanceVariance', 'colorEntropy', 'edgeDensity', 'saturationMean',
      'centerMass', 'radialSymmetry', 'fillRatio', 'temporalFlux',
      'fluxVariance', 'novelty', 'fitness',
    ];

    let totalCorr = 0;
    let routeCount = 0;

    for (const [paramName, mod] of Object.entries(mappings)) {
      if (mod === undefined || !mod.enabled) continue;

      const param = paramName as keyof VisualParams;
      const expectedVisual = PARAM_TO_VISUAL_METRICS[param];
      if (expectedVisual === undefined || expectedVisual.length === 0) continue;

      for (const slot of mod.slots) {
        if (slot === undefined || slot.muted === true) continue;

        const audioIdx = audioKeys.indexOf(slot.source);
        if (audioIdx < 0) continue;

        const audioSeries = this.audioBuffer.map((row) => row[audioIdx] ?? 0);
        const visualSeries = this.visualBuffer.map((_, i) => {
          const row = this.visualBuffer[i];
          if (row === undefined) return 0;
          const avg = expectedVisual.reduce((s, k) => {
            const vi = visualKeys.indexOf(k);
            return s + (vi >= 0 ? (row[vi] ?? 0) : 0);
          }, 0);
          return avg / expectedVisual.length;
        });

        const corr = this.pearson(audioSeries, visualSeries);
        routeScores.push({ param, source: slot.source, correlation: corr });
        totalCorr += corr;
        routeCount += 1;
      }
    }

    // If no mapping-aware routes, fall back to global responsiveness:
    // correlation of "audio activity" (rms) with "visual activity" (temporalFlux)
    if (routeCount === 0) {
      const rmsIdx = audioKeys.indexOf('rms');
      const fluxIdx = visualKeys.indexOf('temporalFlux');
      if (rmsIdx >= 0 && fluxIdx >= 0) {
        const audioSeries = this.audioBuffer.map((row) => row[rmsIdx] ?? 0);
        const visualSeries = this.visualBuffer.map((row) => row[fluxIdx] ?? 0);
        const corr = this.pearson(audioSeries, visualSeries);
        routeScores.push({ param: '(global)', source: 'rms', correlation: corr });
        totalCorr = corr;
        routeCount = 1;
      }
    }

    const correlationFitness = routeCount > 0
      ? Math.max(0, Math.min(1, (totalCorr / routeCount + 1) / 2))
      : 0;

    // Degeneracy penalty: when image is flat (all one color), penalize regardless of correlation
    const visualInterest = this.computeVisualInterest();
    const degeneracyFactor = Math.min(1, visualInterest / 0.15);
    let fitness = correlationFitness * Math.max(0.05, degeneracyFactor);

    // Boredom penalty: repetitive visuals (rotation, static colors) gradually reduce fitness
    const strength = this.options.boredomPenaltyStrength;
    fitness *= Math.max(0.2, 1 - this.boredom * strength);

    const novelty = this.visualBuffer[n - 1]?.[9] ?? 0;
    const w = this.options.interestWeights;
    const interest = Math.max(0, Math.min(1,
      w.fitness * fitness +
      w.boredomInverse * (1 - this.boredom) +
      w.novelty * novelty
    ));

    return { fitness, routeScores, sampleCount: n, boredom: this.boredom, novelty, interest };
  }

  /**
   * Visual interest 0-1: low when image is flat (all one color).
   * Uses luminanceVariance, colorEntropy, edgeDensity, temporalFlux.
   */
  private computeVisualInterest(): number {
    const n = this.visualBuffer.length;
    if (n < 2) return 0;

    const idx = { lum: 0, color: 1, edge: 2, flux: 7 };
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const row = this.visualBuffer[i];
      if (row === undefined) continue;
      sum += (row[idx.lum] ?? 0) + (row[idx.color] ?? 0) + (row[idx.edge] ?? 0) + (row[idx.flux] ?? 0);
    }
    const mean = sum / (n * 4);
    return mean;
  }

  /** Pearson correlation, returns -1..1 */
  private pearson(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;

    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
    for (let i = 0; i < n; i++) {
      const x = a[i] ?? 0;
      const y = b[i] ?? 0;
      sumA += x;
      sumB += y;
      sumAB += x * y;
      sumA2 += x * x;
      sumB2 += y * y;
    }
    const num = n * sumAB - sumA * sumB;
    const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
    if (den <= 0) return 0;
    return num / den;
  }

  /** Reset buffers (e.g. when starting optimization) */
  reset(): void {
    this.audioBuffer = [];
    this.visualBuffer = [];
    this.boredom = 0;
  }

  /** Reset boredom only (e.g. when Smart Jiggle commits — fresh baseline) */
  resetBoredom(): void {
    this.boredom = 0;
  }
}
