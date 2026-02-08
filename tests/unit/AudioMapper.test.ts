/**
 * Unit tests for slot-based AudioMapper
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AudioMapper,
  createDefaultSlot,
  createDefaultModulation,
  migrateLegacyMapping,
  migrateLegacyMappings,
  ALL_MAPPABLE_PARAMS,
  DEFAULT_AUDIO_SOURCES,
} from '../../src/audio/AudioMapper';
import type {
  AudioMetrics,
  VisualParams,
  ModulationSlot,
  ParameterModulation,
  LegacyAudioMappingConfig,
  LegacyAudioMappings,
} from '../../src/types';
import { createDefaultParams, PARAM_RANGES } from '../../src/render/Parameters';

// ────────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<AudioMetrics> = {}): AudioMetrics {
  return {
    rms: 0,
    bass: 0,
    mid: 0,
    high: 0,
    presence: 0,
    harshness: 0,
    mud: 0,
    compression: 0,
    collision: 0,
    coherence: 0,
    stereoWidth: 0,
    phaseRisk: 0,
    lowImbalance: 0,
    emptiness: 0,
    panPosition: 0,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────
//  Factory helpers
// ────────────────────────────────────────────────────────────────────

describe('AudioMapper factory helpers', () => {
  it('createDefaultSlot should produce valid slot with defaults', () => {
    const slot = createDefaultSlot('bass');
    expect(slot.source).toBe('bass');
    expect(slot.amount).toBe(0.5);
    expect(slot.smoothing).toBe(0.5);
    expect(slot.invert).toBe(false);
    expect(slot.curve).toBe(1.0);
    expect(slot.rangeMin).toBe(0);
    expect(slot.rangeMax).toBe(1);
  });

  it('createDefaultSlot should use param range when param is provided', () => {
    const slot = createDefaultSlot('rms', 'hue');
    expect(slot.rangeMin).toBe(PARAM_RANGES.hue.min); // 0
    expect(slot.rangeMax).toBe(PARAM_RANGES.hue.max); // 360
  });

  it('createDefaultModulation should be disabled with one slot', () => {
    const mod = createDefaultModulation('mid', 'scale');
    expect(mod.enabled).toBe(false);
    expect(mod.slots).toHaveLength(1);
    expect(mod.slots[0]!.source).toBe('mid');
  });
});

// ────────────────────────────────────────────────────────────────────
//  Migration
// ────────────────────────────────────────────────────────────────────

describe('Legacy migration', () => {
  it('should migrate a single LegacyAudioMappingConfig', () => {
    const legacy: LegacyAudioMappingConfig = {
      enabled: true,
      source: 'bass',
      sensitivity: 0.8,
      smoothing: 0.6,
      multiplier: 1.5,
      offset: 0.1,
      invert: true,
      minValue: 0,
      maxValue: 1,
    };

    const mod = migrateLegacyMapping(legacy, 'spikiness');
    expect(mod.enabled).toBe(true);
    expect(mod.slots).toHaveLength(1);

    const slot = mod.slots[0]!;
    expect(slot.source).toBe('bass');
    expect(slot.amount).toBe(0.8);       // sensitivity → amount
    expect(slot.smoothing).toBe(0.6);
    expect(slot.invert).toBe(true);
    expect(slot.curve).toBe(1.0);        // default curve
    // Range comes from PARAM_RANGES.spikiness
    expect(slot.rangeMin).toBe(PARAM_RANGES.spikiness.min);
    expect(slot.rangeMax).toBe(PARAM_RANGES.spikiness.max);
  });

  it('should migrate an entire LegacyAudioMappings object', () => {
    const legacy: LegacyAudioMappings = {
      spikiness: {
        enabled: true,
        source: 'collision',
        sensitivity: 0.5,
        smoothing: 0.5,
        multiplier: 1,
        offset: 0,
        invert: false,
        minValue: 0,
        maxValue: 1,
      },
      scale: {
        enabled: false,
        source: 'rms',
        sensitivity: 1.0,
        smoothing: 0.3,
        multiplier: 1,
        offset: 0,
        invert: false,
        minValue: 0,
        maxValue: 1,
      },
    };

    const migrated = migrateLegacyMappings(legacy);
    expect(migrated.spikiness).toBeDefined();
    expect(migrated.spikiness!.enabled).toBe(true);
    expect(migrated.spikiness!.slots[0]!.source).toBe('collision');
    expect(migrated.scale).toBeDefined();
    expect(migrated.scale!.enabled).toBe(false);
    expect(migrated.scale!.slots[0]!.source).toBe('rms');
  });
});

// ────────────────────────────────────────────────────────────────────
//  AudioMapper class
// ────────────────────────────────────────────────────────────────────

describe('AudioMapper class', () => {
  let mapper: AudioMapper;

  beforeEach(() => {
    mapper = new AudioMapper();
  });

  describe('initialization', () => {
    it('should initialize with default modulations for all mappable params', () => {
      for (const param of ALL_MAPPABLE_PARAMS) {
        const mod = mapper.getModulation(param);
        expect(mod).toBeDefined();
        expect(mod!.slots).toHaveLength(1);
      }
    });

    it('should enable scale, spikiness, fillSize by default', () => {
      expect(mapper.getModulation('scale')!.enabled).toBe(true);
      expect(mapper.getModulation('spikiness')!.enabled).toBe(true);
      expect(mapper.getModulation('fillSize')!.enabled).toBe(true);
    });

    it('should have default audio sources matching DEFAULT_AUDIO_SOURCES', () => {
      for (const param of ALL_MAPPABLE_PARAMS) {
        const expectedSource = DEFAULT_AUDIO_SOURCES[param] ?? 'rms';
        const slot = mapper.getPrimarySlot(param);
        expect(slot.source).toBe(expectedSource);
      }
    });

    it('should be enabled by default', () => {
      expect(mapper.isEnabled()).toBe(true);
    });
  });

  describe('getModulation / setModulation', () => {
    it('should set and get a full modulation config', () => {
      const mod: ParameterModulation = {
        enabled: true,
        slots: [
          { source: 'high', amount: 0.9, smoothing: 0.3, invert: true, curve: 2.0, rangeMin: 0, rangeMax: 100 },
        ],
      };
      mapper.setModulation('hue', mod);
      const result = mapper.getModulation('hue');
      expect(result).toEqual(mod);
    });
  });

  describe('updateModulation', () => {
    it('should partially update modulation', () => {
      mapper.updateModulation('hue', { enabled: true });
      expect(mapper.getModulation('hue')!.enabled).toBe(true);
      // Slots should be preserved
      expect(mapper.getModulation('hue')!.slots).toHaveLength(1);
    });
  });

  describe('getPrimarySlot / updatePrimarySlot', () => {
    it('should return the first slot', () => {
      const slot = mapper.getPrimarySlot('spikiness');
      expect(slot.source).toBe('collision');
    });

    it('should update the first slot partially', () => {
      mapper.updatePrimarySlot('hue', { source: 'bass', amount: 0.7 });
      const slot = mapper.getPrimarySlot('hue');
      expect(slot.source).toBe('bass');
      expect(slot.amount).toBe(0.7);
      // Other fields should be unchanged
      expect(slot.curve).toBe(1.0);
    });
  });

  describe('setEnabled / isEnabled', () => {
    it('should toggle enabled state', () => {
      mapper.setEnabled(false);
      expect(mapper.isEnabled()).toBe(false);
      mapper.setEnabled(true);
      expect(mapper.isEnabled()).toBe(true);
    });
  });

  // ── applyMappings ───────────────────────────────────────────────

  describe('applyMappings', () => {
    it('should return empty when disabled', () => {
      mapper.setEnabled(false);
      const result = mapper.applyMappings(createDefaultParams(), makeMetrics({ rms: 1 }));
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return empty when metrics is null', () => {
      const result = mapper.applyMappings(createDefaultParams(), null);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return empty when no mappings are enabled', () => {
      // Disable all
      for (const param of ALL_MAPPABLE_PARAMS) {
        mapper.updateModulation(param, { enabled: false });
      }
      const result = mapper.applyMappings(createDefaultParams(), makeMetrics({ rms: 1 }));
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should modulate enabled parameters based on metrics', () => {
      // Enable only 'hue' with a simple linear mapping
      for (const param of ALL_MAPPABLE_PARAMS) {
        mapper.updateModulation(param, { enabled: false });
      }

      const hueRange = PARAM_RANGES.hue;
      mapper.setModulation('hue', {
        enabled: true,
        slots: [{
          source: 'mid',
          amount: 1.0,
          smoothing: 0,      // no smoothing
          invert: false,
          curve: 1.0,
          rangeMin: 0,
          rangeMax: 100,      // maps 0-1 metric to 0-100 offset
        }],
      });

      const baseParams = createDefaultParams();
      baseParams.hue = 0;

      // With mid=0.5, amount=1.0, curve=1.0, no smooth → raw = 0.5
      // Mapped to range [0, 100] → 50
      // Base + modulation = 0 + 50 = 50, clamped to [0, 360]
      const result = mapper.applyMappings(baseParams, makeMetrics({ mid: 0.5 }));
      expect(result.hue).toBeCloseTo(50, 1);
    });

    it('should apply power curve correctly', () => {
      for (const param of ALL_MAPPABLE_PARAMS) {
        mapper.updateModulation(param, { enabled: false });
      }

      mapper.setModulation('scale', {
        enabled: true,
        slots: [{
          source: 'bass',
          amount: 1.0,
          smoothing: 0,
          invert: false,
          curve: 2.0,         // square curve: 0.5^2 = 0.25
          rangeMin: 0,
          rangeMax: 1,
        }],
      });

      const baseParams = createDefaultParams();
      baseParams.scale = 0;

      const result = mapper.applyMappings(baseParams, makeMetrics({ bass: 0.5 }));
      // 0.5^2 = 0.25 → range [0,1] → 0.25 → base 0 + 0.25 = 0.25
      expect(result.scale).toBeCloseTo(0.25, 2);
    });

    it('should apply inversion correctly', () => {
      for (const param of ALL_MAPPABLE_PARAMS) {
        mapper.updateModulation(param, { enabled: false });
      }

      mapper.setModulation('scale', {
        enabled: true,
        slots: [{
          source: 'rms',
          amount: 1.0,
          smoothing: 0,
          invert: true,
          curve: 1.0,
          rangeMin: 0,
          rangeMax: 1,
        }],
      });

      const baseParams = createDefaultParams();
      baseParams.scale = 0;

      // With rms=0.8, invert → 1-0.8 = 0.2 → mapped [0,1] → 0.2
      const result = mapper.applyMappings(baseParams, makeMetrics({ rms: 0.8 }));
      expect(result.scale).toBeCloseTo(0.2, 2);
    });

    it('should sum multiple slots per parameter', () => {
      for (const param of ALL_MAPPABLE_PARAMS) {
        mapper.updateModulation(param, { enabled: false });
      }

      mapper.setModulation('hue', {
        enabled: true,
        slots: [
          {
            source: 'bass',
            amount: 1.0,
            smoothing: 0,
            invert: false,
            curve: 1.0,
            rangeMin: 0,
            rangeMax: 50,
          },
          {
            source: 'high',
            amount: 1.0,
            smoothing: 0,
            invert: false,
            curve: 1.0,
            rangeMin: 0,
            rangeMax: 50,
          },
        ],
      });

      const baseParams = createDefaultParams();
      baseParams.hue = 0;

      // bass=0.5 → 25, high=0.3 → 15, total = 40
      const result = mapper.applyMappings(baseParams, makeMetrics({ bass: 0.5, high: 0.3 }));
      expect(result.hue).toBeCloseTo(40, 1);
    });

    it('should clamp output to parameter range', () => {
      for (const param of ALL_MAPPABLE_PARAMS) {
        mapper.updateModulation(param, { enabled: false });
      }

      mapper.setModulation('scale', {
        enabled: true,
        slots: [{
          source: 'rms',
          amount: 1.0,
          smoothing: 0,
          invert: false,
          curve: 1.0,
          rangeMin: 0,
          rangeMax: 999,      // huge range to exceed param max
        }],
      });

      const baseParams = createDefaultParams();
      baseParams.scale = PARAM_RANGES.scale.max;  // already at max

      const result = mapper.applyMappings(baseParams, makeMetrics({ rms: 1 }));
      expect(result.scale).toBe(PARAM_RANGES.scale.max);
    });

    it('should handle emanationRate as a normal parameter', () => {
      for (const param of ALL_MAPPABLE_PARAMS) {
        mapper.updateModulation(param, { enabled: false });
      }

      mapper.setModulation('emanationRate', {
        enabled: true,
        slots: [{
          source: 'bass',
          amount: 1.0,
          smoothing: 0,
          invert: false,
          curve: 1.0,
          rangeMin: 0,
          rangeMax: 100,
        }],
      });

      const baseParams = createDefaultParams();
      baseParams.emanationRate = 10;

      const result = mapper.applyMappings(baseParams, makeMetrics({ bass: 0.5 }));
      // 0.5 * 100 = 50 + base 10 = 60, clamped to [2, 200]
      expect(result.emanationRate).toBeCloseTo(60, 1);
    });
  });

  // ── smoothing ────────────────────────────────────────────────────

  describe('smoothing', () => {
    it('should apply EMA smoothing — lagging behind sudden changes', () => {
      for (const param of ALL_MAPPABLE_PARAMS) {
        mapper.updateModulation(param, { enabled: false });
      }

      mapper.setModulation('scale', {
        enabled: true,
        slots: [{
          source: 'rms',
          amount: 1.0,
          smoothing: 0.9,    // heavy smoothing
          invert: false,
          curve: 1.0,
          rangeMin: 0,
          rangeMax: 1,
        }],
      });

      const baseParams = createDefaultParams();
      baseParams.scale = 0;

      // First call with rms=0 (initializes smoothed to 0)
      mapper.applyMappings(baseParams, makeMetrics({ rms: 0 }));

      // Now jump to rms=1. With heavy smoothing, result should be small.
      const result1 = mapper.applyMappings(baseParams, makeMetrics({ rms: 1 }));
      // Another call — smoothed value should have grown closer to 1
      const result2 = mapper.applyMappings(baseParams, makeMetrics({ rms: 1 }));

      expect(result1.scale!).toBeGreaterThan(0);
      expect(result1.scale!).toBeLessThan(1);
      expect(result2.scale!).toBeGreaterThan(result1.scale!);
    });

    it('resetSmoothing should clear all smoothed values', () => {
      for (const param of ALL_MAPPABLE_PARAMS) {
        mapper.updateModulation(param, { enabled: false });
      }

      mapper.setModulation('scale', {
        enabled: true,
        slots: [{
          source: 'rms',
          amount: 1.0,
          smoothing: 0.9,
          invert: false,
          curve: 1.0,
          rangeMin: 0,
          rangeMax: 1,
        }],
      });

      const baseParams = createDefaultParams();
      baseParams.scale = 0;

      // Initialize with 0, then jump to 1 and converge
      mapper.applyMappings(baseParams, makeMetrics({ rms: 0 }));
      mapper.applyMappings(baseParams, makeMetrics({ rms: 1 }));
      mapper.applyMappings(baseParams, makeMetrics({ rms: 1 }));
      const before = mapper.applyMappings(baseParams, makeMetrics({ rms: 1 }));

      // Reset and re-apply with jump from 0→1 — should restart the lag
      mapper.resetSmoothing();
      mapper.applyMappings(baseParams, makeMetrics({ rms: 0 }));
      const after = mapper.applyMappings(baseParams, makeMetrics({ rms: 1 }));

      // after should be less than before (smoothing was reset, so we are back at the beginning of convergence)
      expect(after.scale!).toBeLessThan(before.scale!);
    });
  });

  // ── export / import ──────────────────────────────────────────────

  describe('export / import', () => {
    it('should export and re-import new format correctly', () => {
      mapper.updatePrimarySlot('hue', { source: 'bass', amount: 0.77 });
      mapper.updateModulation('hue', { enabled: true });

      const json = mapper.exportMappings();
      const newMapper = new AudioMapper();
      expect(newMapper.importMappings(json)).toBe(true);

      const mod = newMapper.getModulation('hue');
      expect(mod!.enabled).toBe(true);
      expect(mod!.slots[0]!.source).toBe('bass');
      expect(mod!.slots[0]!.amount).toBe(0.77);
    });

    it('should detect and migrate legacy format on import', () => {
      const legacyJson = JSON.stringify({
        spikiness: {
          enabled: true,
          source: 'collision',
          sensitivity: 0.6,
          smoothing: 0.5,
          multiplier: 1,
          offset: 0,
          invert: false,
          minValue: 0,
          maxValue: 1,
        },
      });

      const newMapper = new AudioMapper();
      expect(newMapper.importMappings(legacyJson)).toBe(true);

      const mod = newMapper.getModulation('spikiness');
      expect(mod!.enabled).toBe(true);
      expect(mod!.slots[0]!.source).toBe('collision');
      expect(mod!.slots[0]!.amount).toBe(0.6);
    });

    it('should return false on invalid JSON', () => {
      expect(mapper.importMappings('not json')).toBe(false);
    });
  });

  // ── static methods ───────────────────────────────────────────────

  describe('static methods', () => {
    it('getAvailableMetrics should return all 15 metrics', () => {
      const metrics = AudioMapper.getAvailableMetrics();
      expect(metrics).toHaveLength(15);
      expect(metrics).toContain('lowImbalance');
      expect(metrics).toContain('emptiness');
      expect(metrics).toContain('panPosition');
    });

    it('getMetricLabel should return labels for all metrics', () => {
      const metrics = AudioMapper.getAvailableMetrics();
      for (const m of metrics) {
        const label = AudioMapper.getMetricLabel(m);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });

  // ── getMappings / setMappings ────────────────────────────────────

  describe('getMappings / setMappings', () => {
    it('should round-trip all mappings', () => {
      mapper.updatePrimarySlot('hue', { source: 'bass' });
      const allMappings = mapper.getMappings();
      const newMapper = new AudioMapper();
      newMapper.setMappings(allMappings);
      expect(newMapper.getPrimarySlot('hue').source).toBe('bass');
    });
  });
});
