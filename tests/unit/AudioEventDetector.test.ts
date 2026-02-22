import { describe, it, expect } from 'vitest';
import { AudioEventDetector } from '../../src/audio/AudioEventDetector';

function makeMetrics(overrides: Partial<Record<string, number>> = {}): import('../../src/types').AudioMetrics {
  return {
    rms: 0.5,
    bass: 0.5,
    mid: 0.5,
    high: 0.5,
    presence: 0.5,
    harshness: 0,
    mud: 0,
    compression: 0,
    collision: 0,
    coherence: 1,
    stereoWidth: 0.5,
    phaseRisk: 0,
    lowImbalance: 0,
    emptiness: 0,
    panPosition: 0.5,
    rmsRate: 0.5,
    bassRate: 0.5,
    beatOnset: 0,
    beatConfidence: 0,
    tempoBpm: 120,
    tempoBpmNorm: 0.5,
    ...overrides,
  };
}

describe('AudioEventDetector', () => {
  it('fires drop when short RMS exceeds long RMS by threshold', () => {
    const detector = new AudioEventDetector({ dropRatio: 1.2, dropDebounceMs: 500 });
    for (let i = 0; i < 60; i++) {
      detector.update(makeMetrics({ rms: 0.1 }), i / 60);
    }
    let found = false;
    for (let i = 60; i < 70; i++) {
      const events = detector.update(makeMetrics({ rms: 0.9 }), i / 60);
      if (events.some((e) => e.type === 'drop')) found = true;
    }
    expect(found).toBe(true);
  });

  it('does NOT fire drop when RMS is steady', () => {
    const detector = new AudioEventDetector({ warmupFrames: 100 });
    for (let i = 0; i < 60; i++) {
      const events = detector.update(makeMetrics({ rms: 0.5 }), i / 60);
      expect(events.some((e) => e.type === 'drop')).toBe(false);
    }
  });

  it('fires breakdown when short RMS drops below long RMS', () => {
    const detector = new AudioEventDetector({ breakdownRatio: 0.5, breakdownDebounceMs: 500, warmupFrames: 0 });
    // Build long RMS (~1.5s at 60fps = 90 frames)
    for (let i = 0; i < 120; i++) {
      detector.update(makeMetrics({ rms: 0.8 }), i / 60);
    }
    let found = false;
    for (let i = 120; i < 200; i++) {
      const events = detector.update(makeMetrics({ rms: 0.1 }), i / 60);
      if (events.some((e) => e.type === 'breakdown')) found = true;
    }
    expect(found).toBe(true);
  });

  it('fires silence after sustained quiet', () => {
    const detector = new AudioEventDetector({ silenceDuration: 2 });
    let found = false;
    for (let i = 0; i < 150; i++) {
      const events = detector.update(
        makeMetrics({ rms: 0.02, emptiness: 0.95 }),
        i / 60
      );
      if (events.some((e) => e.type === 'silence')) found = true;
    }
    expect(found).toBe(true);
  });

  it('handles first frame without throwing', () => {
    const detector = new AudioEventDetector();
    const events = detector.update(makeMetrics({ rms: 0.9 }), 0);
    expect(events).toEqual([]);
  });

  it('handles all-zero metrics', () => {
    const detector = new AudioEventDetector();
    expect(() =>
      detector.update(makeMetrics({ rms: 0, bass: 0, emptiness: 0 }), 1)
    ).not.toThrow();
  });

});
