import { describe, it, expect } from 'vitest';
import { VisualMapper, createDefaultVisualSlot, createDefaultVisualModulation } from '../../src/visual/VisualMapper';
import { createDefaultParams } from '../../src/render/Parameters';

function makeMetrics(overrides: Partial<Record<string, number>> = {}): import('../../src/visual/VisualMetrics').VisualMetrics {
  return {
    luminanceVariance: 0.3,
    colorEntropy: 0.5,
    edgeDensity: 0.2,
    saturationMean: 0.4,
    centerMass: 0.1,
    radialSymmetry: 0.6,
    fillRatio: 0.7,
    temporalFlux: 0.5,
    fluxVariance: 0.2,
    novelty: 0.3,
    fitness: 0.5,
    ...overrides,
  };
}

describe('VisualMapper', () => {
  it('createDefaultVisualSlot produces valid slot', () => {
    const slot = createDefaultVisualSlot('temporalFlux', 'emanationRate');
    expect(slot.source).toBe('temporalFlux');
    expect(slot.amount).toBe(0.5);
    expect(slot.rangeMin).toBeDefined();
    expect(slot.rangeMax).toBeDefined();
  });

  it('createDefaultVisualModulation is disabled with one slot', () => {
    const mod = createDefaultVisualModulation('fitness');
    expect(mod.enabled).toBe(false);
    expect(mod.slots).toHaveLength(1);
    expect(mod.slots[0]?.source).toBe('fitness');
  });

  it('returns empty when disabled', () => {
    const mapper = new VisualMapper();
    const base = createDefaultParams();
    const result = mapper.applyMappings(base, makeMetrics());
    expect(result).toEqual({});
  });

  it('returns empty when metrics is null', () => {
    const mapper = new VisualMapper();
    mapper.setEnabled(true);
    const base = createDefaultParams();
    const result = mapper.applyMappings(base, null);
    expect(result).toEqual({});
  });

  it('modulates enabled parameters based on metrics', () => {
    const mapper = new VisualMapper();
    mapper.setEnabled(true);
    mapper.setModulation('emanationRate', {
      enabled: true,
      slots: [createDefaultVisualSlot('temporalFlux', 'emanationRate')],
    });
    const base = createDefaultParams();
    const result = mapper.applyMappings(base, makeMetrics({ temporalFlux: 1 }));
    expect(result.emanationRate).toBeDefined();
    expect(result.emanationRate).not.toBe(base.emanationRate);
  });

  it('getAvailableMetrics returns all visual metrics', () => {
    const metrics = VisualMapper.getAvailableMetrics();
    expect(metrics).toContain('temporalFlux');
    expect(metrics).toContain('fitness');
    expect(metrics.length).toBeGreaterThanOrEqual(10);
  });

  it('getMetricLabel returns labels for all metrics', () => {
    const metrics = VisualMapper.getAvailableMetrics();
    for (const m of metrics) {
      expect(VisualMapper.getMetricLabel(m)).toBeTruthy();
    }
  });
});
