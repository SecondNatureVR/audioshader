import { describe, it, expect } from 'vitest';
import { VisualAnalyzer } from '../../src/visual/VisualAnalyzer';

/** Create RGBA pixel buffer, row-major, 0-255 */
function makePixels(
  width: number,
  height: number,
  fn: (x: number, y: number) => { r: number; g: number; b: number; a?: number }
): Uint8Array {
  const buf = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { r, g, b, a = 255 } = fn(x, y);
      const i = (y * width + x) * 4;
      buf[i + 0] = Math.max(0, Math.min(255, Math.round(r * 255)));
      buf[i + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
      buf[i + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
      buf[i + 3] = Math.max(0, Math.min(255, Math.round((a ?? 1) * 255)));
    }
  }
  return buf;
}

describe('VisualAnalyzer', () => {
  it('returns metrics for solid black', () => {
    const analyzer = new VisualAnalyzer();
    const pixels = makePixels(64, 64, () => ({ r: 0, g: 0, b: 0 }));
    const m = analyzer.analyze(pixels, 64, 64);
    expect(m.luminanceVariance).toBe(0);
    expect(m.colorEntropy).toBe(0);
    expect(m.fillRatio).toBe(0);
    expect(m.saturationMean).toBe(0);
  });

  it('returns metrics for solid white', () => {
    const analyzer = new VisualAnalyzer();
    const pixels = makePixels(64, 64, () => ({ r: 1, g: 1, b: 1 }));
    const m = analyzer.analyze(pixels, 64, 64);
    expect(m.luminanceVariance).toBe(0);
    expect(m.fillRatio).toBe(1);
    expect(m.saturationMean).toBe(0);
  });

  it('returns higher colorEntropy for diverse colors', () => {
    const analyzer = new VisualAnalyzer();
    const uniform = makePixels(64, 64, () => ({ r: 0.5, g: 0.5, b: 0.5 }));
    const diverse = makePixels(64, 64, (x, y) => ({
      r: (x % 4) / 4,
      g: (y % 4) / 4,
      b: ((x + y) % 4) / 4,
    }));
    const m1 = analyzer.analyze(uniform, 64, 64);
    const m2 = analyzer.analyze(diverse, 64, 64);
    expect(m2.colorEntropy).toBeGreaterThan(m1.colorEntropy);
  });

  it('returns higher luminanceVariance for varying brightness', () => {
    const analyzer = new VisualAnalyzer();
    const flat = makePixels(64, 64, () => ({ r: 0.5, g: 0.5, b: 0.5 }));
    const varied = makePixels(64, 64, (x, y) => {
      const v = (x + y) / 128;
      return { r: v, g: v, b: v };
    });
    const m1 = analyzer.analyze(flat, 64, 64);
    const m2 = analyzer.analyze(varied, 64, 64);
    expect(m2.luminanceVariance).toBeGreaterThan(m1.luminanceVariance);
  });

  it('returns higher edgeDensity for high-contrast edges', () => {
    const analyzer = new VisualAnalyzer();
    const flat = makePixels(64, 64, () => ({ r: 0.5, g: 0.5, b: 0.5 }));
    const edges = makePixels(64, 64, (x) =>
      x < 32 ? { r: 0, g: 0, b: 0 } : { r: 1, g: 1, b: 1 }
    );
    const m1 = analyzer.analyze(flat, 64, 64);
    const m2 = analyzer.analyze(edges, 64, 64);
    expect(m2.edgeDensity).toBeGreaterThan(m1.edgeDensity);
  });

  it('computes temporalFlux when given two different frames', () => {
    const analyzer = new VisualAnalyzer();
    const frame1 = makePixels(64, 64, () => ({ r: 0.2, g: 0.2, b: 0.2 }));
    const frame2 = makePixels(64, 64, () => ({ r: 0.8, g: 0.8, b: 0.8 }));
    analyzer.analyze(frame1, 64, 64);
    const m = analyzer.analyze(frame2, 64, 64);
    expect(m.temporalFlux).toBeGreaterThan(0);
  });

  it('returns zero temporalFlux for identical frames', () => {
    const analyzer = new VisualAnalyzer();
    const frame = makePixels(64, 64, () => ({ r: 0.5, g: 0.5, b: 0.5 }));
    analyzer.analyze(frame, 64, 64);
    const m = analyzer.analyze(frame, 64, 64);
    expect(m.temporalFlux).toBe(0);
  });

  it('computes fitness in 0-1 range', () => {
    const analyzer = new VisualAnalyzer();
    const pixels = makePixels(64, 64, (x, y) => ({
      r: 0.3 + (x / 64) * 0.4,
      g: 0.2 + (y / 64) * 0.5,
      b: 0.4,
    }));
    const m = analyzer.analyze(pixels, 64, 64);
    expect(m.fitness).toBeGreaterThanOrEqual(0);
    expect(m.fitness).toBeLessThanOrEqual(1);
  });

  it('reset clears temporal state', () => {
    const analyzer = new VisualAnalyzer();
    const frame1 = makePixels(64, 64, () => ({ r: 0.5, g: 0.5, b: 0.5 }));
    analyzer.analyze(frame1, 64, 64);
    analyzer.reset();
    const frame2 = makePixels(64, 64, () => ({ r: 0.9, g: 0.9, b: 0.9 }));
    const m = analyzer.analyze(frame2, 64, 64);
    expect(m.temporalFlux).toBe(0);
  });

  it('shouldAnalyze returns true on throttle boundary', () => {
    const analyzer = new VisualAnalyzer({ throttleFrames: 3 });
    expect(analyzer.shouldAnalyze(0)).toBe(true);
    expect(analyzer.shouldAnalyze(1)).toBe(false);
    expect(analyzer.shouldAnalyze(4)).toBe(true);
  });

  it('handles first frame without throwing', () => {
    const analyzer = new VisualAnalyzer();
    const pixels = makePixels(32, 32, () => ({ r: 0.5, g: 0.5, b: 0.5 }));
    expect(() => analyzer.analyze(pixels, 32, 32)).not.toThrow();
  });
});
