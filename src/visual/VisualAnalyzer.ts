/**
 * VisualAnalyzer — pixel analysis for fitness/optimization
 * Analyzes rendered output to produce VisualMetrics.
 * Works with raw pixel buffers (testable) or via readPixels from Renderer.
 */

import type { VisualMetrics, VisualMetricKey } from './VisualMetrics';
import { DEFAULT_FITNESS_WEIGHTS } from './VisualMetrics';

export interface VisualAnalyzerOptions {
  sampleWidth?: number;
  sampleHeight?: number;
  throttleFrames?: number;
  fitnessWeights?: Partial<Record<VisualMetricKey, number>>;
  luminanceThreshold?: number;  // for fillRatio
  entropyBins?: number;         // for colorEntropy quantization
}

const DEFAULT_OPTIONS: Required<Omit<VisualAnalyzerOptions, 'fitnessWeights'>> & {
  fitnessWeights: Partial<Record<VisualMetricKey, number>>;
} = {
  sampleWidth: 64,
  sampleHeight: 64,
  throttleFrames: 3,
  fitnessWeights: DEFAULT_FITNESS_WEIGHTS,
  luminanceThreshold: 0.02,
  entropyBins: 16,
};

/** Luminance from RGB (Rec. 709) */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Saturation: (max - min) / max when max > 0 */
function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  if (max <= 0) return 0;
  const min = Math.min(r, g, b);
  return (max - min) / max;
}

export class VisualAnalyzer {
  private options: VisualAnalyzerOptions & { fitnessWeights: Partial<Record<VisualMetricKey, number>> };
  private prevPixels: Uint8Array | null = null;
  private fluxHistory: number[] = [];
  private noveltyEma: number = 0;

  constructor(options: VisualAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if (options.fitnessWeights !== undefined) {
      this.options.fitnessWeights = { ...DEFAULT_FITNESS_WEIGHTS, ...options.fitnessWeights };
    }
  }

  /**
   * Analyze pixel buffer. RGBA, row-major, 0-255.
   * Call with pixels from Renderer.readPixels or synthetic buffer for tests.
   */
  analyze(pixels: Uint8Array, width: number, height: number): VisualMetrics {
    const w = width;
    const h = height;
    const n = w * h;

    // Luminance and saturation arrays
    const L: number[] = [];
    const S: number[] = [];
    const R: number[] = [];
    const G: number[] = [];
    const B: number[] = [];

    for (let i = 0; i < n; i++) {
      const r = pixels[i * 4 + 0]! / 255;
      const g = pixels[i * 4 + 1]! / 255;
      const b = pixels[i * 4 + 2]! / 255;
      L.push(luminance(r, g, b));
      S.push(saturation(r, g, b));
      R.push(r);
      G.push(g);
      B.push(b);
    }

    const luminanceVariance = this.computeVariance(L);
    const colorEntropy = this.computeColorEntropy(R, G, B);
    const edgeDensity = this.computeEdgeDensity(pixels, w, h);
    const saturationMean = L.reduce((a, _, i) => a + S[i]!, 0) / n;
    const centerMass = this.computeCenterMass(L, w, h);
    const radialSymmetry = this.computeRadialSymmetry(L, w, h);
    const lumThresh = this.options.luminanceThreshold ?? 0.02;
    const fillRatio = L.filter((l) => l > lumThresh).length / n;

    // Temporal metrics
    let temporalFlux = 0;
    let fluxVariance = 0;
    let novelty = 0;

    if (this.prevPixels !== null && this.prevPixels.length === pixels.length) {
      const fluxValues: number[] = [];
      for (let i = 0; i < n; i++) {
        const d =
          Math.abs(pixels[i * 4 + 0]! - this.prevPixels[i * 4 + 0]!) +
          Math.abs(pixels[i * 4 + 1]! - this.prevPixels[i * 4 + 1]!) +
          Math.abs(pixels[i * 4 + 2]! - this.prevPixels[i * 4 + 2]!);
        fluxValues.push(d / (255 * 3));
      }
      temporalFlux = fluxValues.reduce((a, v) => a + v, 0) / n;
      fluxVariance = this.computeVariance(fluxValues);

      const alpha = 0.1;
      novelty = Math.abs(temporalFlux - this.noveltyEma);
      this.noveltyEma = this.noveltyEma + alpha * (temporalFlux - this.noveltyEma);

      this.fluxHistory.push(temporalFlux);
      if (this.fluxHistory.length > 30) this.fluxHistory.shift();
    }
    this.prevPixels = new Uint8Array(pixels);

    const fitness = this.computeFitness({
      luminanceVariance,
      colorEntropy,
      edgeDensity,
      saturationMean,
      centerMass,
      radialSymmetry,
      fillRatio,
      temporalFlux,
      fluxVariance,
      novelty,
    });

    return {
      luminanceVariance,
      colorEntropy,
      edgeDensity,
      saturationMean,
      centerMass,
      radialSymmetry,
      fillRatio,
      temporalFlux,
      fluxVariance,
      novelty,
      fitness,
    };
  }

  private computeVariance(arr: number[]): number {
    const n = arr.length;
    if (n === 0) return 0;
    const mean = arr.reduce((a, v) => a + v, 0) / n;
    const sq = arr.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    return Math.sqrt(sq);
  }

  private computeColorEntropy(R: number[], G: number[], B: number[]): number {
    const bins = this.options.entropyBins ?? 16;
    const counts: number[] = new Array(bins * bins * bins).fill(0);
    const n = R.length;

    for (let i = 0; i < n; i++) {
      const ri = Math.min(bins - 1, Math.floor((R[i] ?? 0) * bins));
      const gi = Math.min(bins - 1, Math.floor((G[i] ?? 0) * bins));
      const bi = Math.min(bins - 1, Math.floor((B[i] ?? 0) * bins));
      const idx = ri * bins * bins + gi * bins + bi;
      counts[idx] = (counts[idx] ?? 0) + 1;
    }

    let entropy = 0;
    for (let i = 0; i < counts.length; i++) {
      const p = counts[i]! / n;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(bins * bins * bins);
    return maxEntropy > 0 ? Math.min(1, entropy / maxEntropy) : 0;
  }

  private computeEdgeDensity(pixels: Uint8Array, w: number, h: number): number {
    let sum = 0;
    let count = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const l = (pixels[((y - 1) * w + x) * 4]! + pixels[((y - 1) * w + x) * 4 + 1]! + pixels[((y - 1) * w + x) * 4 + 2]!) / 3;
        const r = (pixels[((y + 1) * w + x) * 4]! + pixels[((y + 1) * w + x) * 4 + 1]! + pixels[((y + 1) * w + x) * 4 + 2]!) / 3;
        const u = (pixels[(y * w + (x - 1)) * 4]! + pixels[(y * w + (x - 1)) * 4 + 1]! + pixels[(y * w + (x - 1)) * 4 + 2]!) / 3;
        const d = (pixels[(y * w + (x + 1)) * 4]! + pixels[(y * w + (x + 1)) * 4 + 1]! + pixels[(y * w + (x + 1)) * 4 + 2]!) / 3;
        const gx = r - l;
        const gy = d - u;
        sum += Math.sqrt(gx * gx + gy * gy) / 255;
        count += 1;
      }
    }
    return count > 0 ? Math.min(1, sum / count) : 0;
  }

  private computeCenterMass(L: number[], w: number, h: number): number {
    let sumL = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = L[y * w + x]!;
        sumL += l;
        sumX += x * l;
        sumY += y * l;
      }
    }
    if (sumL <= 0) return 0;
    const cx = sumX / sumL;
    const cy = sumY / sumL;
    const centerX = (w - 1) / 2;
    const centerY = (h - 1) / 2;
    const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
    const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
    return maxDist > 0 ? Math.min(1, dist / maxDist) : 0;
  }

  private computeRadialSymmetry(L: number[], w: number, h: number): number {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    let sum = 0;
    let count = 0;
    const steps = 36;
    for (let a = 0; a < steps; a++) {
      const angle = (a / steps) * Math.PI * 2;
      const oppAngle = angle + Math.PI;
      const maxR = Math.min(cx, cy) * 0.9;
      for (let r = 1; r < maxR; r += 2) {
        const x1 = Math.round(cx + r * Math.cos(angle));
        const y1 = Math.round(cy + r * Math.sin(angle));
        const x2 = Math.round(cx + r * Math.cos(oppAngle));
        const y2 = Math.round(cy + r * Math.sin(oppAngle));
        if (x1 >= 0 && x1 < w && y1 >= 0 && y1 < h && x2 >= 0 && x2 < w && y2 >= 0 && y2 < h) {
          const v1 = L[y1 * w + x1]!;
          const v2 = L[y2 * w + x2]!;
          sum += 1 - Math.abs(v1 - v2);
          count += 1;
        }
      }
    }
    return count > 0 ? Math.max(0, sum / count) : 0;
  }

  private computeFitness(m: Partial<VisualMetrics>): number {
    const weights = this.options.fitnessWeights ?? DEFAULT_FITNESS_WEIGHTS;
    let f = 0;
    let totalW = 0;

    const add = (key: VisualMetricKey, val: number, sweetSpot?: number) => {
      const w = weights[key] ?? 0;
      if (w <= 0) return;
      totalW += w;
      if (sweetSpot !== undefined) {
        f += w * (1 - Math.abs(val - sweetSpot));
      } else {
        f += w * Math.max(0, Math.min(1, val));
      }
    };

    add('luminanceVariance', m.luminanceVariance ?? 0, 0.4);
    add('colorEntropy', m.colorEntropy ?? 0);
    add('edgeDensity', m.edgeDensity ?? 0);
    add('saturationMean', m.saturationMean ?? 0);
    add('centerMass', m.centerMass ?? 0);
    add('radialSymmetry', m.radialSymmetry ?? 0);
    add('fillRatio', m.fillRatio ?? 0);
    add('temporalFlux', m.temporalFlux ?? 0);
    add('novelty', m.novelty ?? 0);

    // Penalize empty/overfilled
    const fr = m.fillRatio ?? 0;
    if (fr < 0.05 || fr > 0.95) f -= 0.2;

    return totalW > 0 ? Math.max(0, Math.min(1, f / totalW)) : 0;
  }

  /** Reset temporal state (e.g. when starting optimization) */
  reset(): void {
    this.prevPixels = null;
    this.fluxHistory = [];
    this.noveltyEma = 0;
  }

  /** Whether we should run analysis this frame (throttle). Caller passes frame number. */
  shouldAnalyze(frameNumber: number): boolean {
    const throttle = this.options.throttleFrames ?? 3;
    return frameNumber % (throttle + 1) === 0;
  }
}
