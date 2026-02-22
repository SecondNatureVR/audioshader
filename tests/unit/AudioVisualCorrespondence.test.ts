import { describe, it, expect } from 'vitest';
import { AudioVisualCorrespondence } from '../../src/visual/AudioVisualCorrespondence';
import type { AudioMetrics } from '../../src/types';
import type { VisualMetrics } from '../../src/visual/VisualMetrics';

function makeAudio(overrides: Partial<AudioMetrics> = {}): AudioMetrics {
  return {
    rms: 0.5, bass: 0.5, mid: 0.5, high: 0.5, presence: 0.5,
    harshness: 0, mud: 0, compression: 0, collision: 0, coherence: 1,
    stereoWidth: 0.5, phaseRisk: 0, lowImbalance: 0, emptiness: 0, panPosition: 0.5,
    rmsRate: 0.5, bassRate: 0.5,
    beatOnset: 0, beatConfidence: 0, tempoBpm: 120, tempoBpmNorm: 0.5,
    ...overrides,
  };
}

function makeVisual(overrides: Partial<VisualMetrics> = {}): VisualMetrics {
  return {
    luminanceVariance: 0.3, colorEntropy: 0.5, edgeDensity: 0.2, saturationMean: 0.4,
    centerMass: 0.1, radialSymmetry: 0.6, fillRatio: 0.5, temporalFlux: 0.3,
    fluxVariance: 0.2, novelty: 0.2, fitness: 0.4,
    ...overrides,
  };
}

describe('AudioVisualCorrespondence', () => {
  it('returns 0 fitness when buffer has too few samples', () => {
    const ev = new AudioVisualCorrespondence({ minSamples: 30 });
    for (let i = 0; i < 10; i++) {
      ev.record(makeAudio({ rms: i / 10 }), makeVisual({ fillRatio: i / 10 }));
    }
    const result = ev.evaluate({});
    expect(result.fitness).toBe(0);
    expect(result.sampleCount).toBe(10);
  });

  it('returns global rms↔temporalFlux correlation when no mappings', () => {
    const ev = new AudioVisualCorrespondence({ windowSize: 50, minSamples: 30 });
    for (let i = 0; i < 50; i++) {
      ev.record(
        makeAudio({ rms: i / 50 }),
        makeVisual({ temporalFlux: i / 50 })
      );
    }
    const result = ev.evaluate({});
    expect(result.fitness).toBeGreaterThan(0.9);
    expect(result.routeScores).toHaveLength(1);
    expect(result.routeScores[0]?.param).toBe('(global)');
    expect(result.routeScores[0]?.source).toBe('rms');
  });

  it('returns mapping-aware fitness when mappings exist', () => {
    const ev = new AudioVisualCorrespondence({ windowSize: 50, minSamples: 30 });
    for (let i = 0; i < 50; i++) {
      ev.record(
        makeAudio({ rms: i / 50 }),
        makeVisual({ fillRatio: i / 50, luminanceVariance: i / 50 })
      );
    }
    const result = ev.evaluate({
      scale: {
        enabled: true,
        slots: [{ source: 'rms', amount: 0.5, offset: 0, multiplier: 1, smoothing: 0.5, invert: false, curve: 1, rangeMin: 0, rangeMax: 1 }],
      },
    });
    expect(result.fitness).toBeGreaterThan(0);
    expect(result.routeScores.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears buffers', () => {
    const ev = new AudioVisualCorrespondence({ minSamples: 5 });
    for (let i = 0; i < 10; i++) {
      ev.record(makeAudio(), makeVisual());
    }
    ev.reset();
    const result = ev.evaluate({});
    expect(result.sampleCount).toBe(0);
    expect(result.fitness).toBe(0);
  });
});
