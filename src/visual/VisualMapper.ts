/**
 * Visual-to-parameter mapping system (mirrors AudioMapper)
 *
 * Maps VisualMetrics (from pixel analysis) to visual parameter offsets.
 * Same slot structure: amount, curve, smoothing, range, mute/solo.
 */

import type { VisualParams } from '../types';
import type { VisualMetrics, VisualMetricKey } from './VisualMetrics';
import { PARAM_RANGES } from '../render/Parameters';

// ────────────────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────────────────

export interface VisualModulationSlot {
  source: VisualMetricKey;
  amount: number;
  offset: number;
  multiplier: number;
  smoothing: number;
  invert: boolean;
  curve: number;
  rangeMin: number;
  rangeMax: number;
  locked?: boolean;
  muted?: boolean;
  solo?: boolean;
}

export interface VisualParameterModulation {
  enabled: boolean;
  slots: VisualModulationSlot[];
}

export type VisualMappings = Partial<Record<keyof VisualParams, VisualParameterModulation>>;

// ────────────────────────────────────────────────────────────────────
//  Factory helpers
// ────────────────────────────────────────────────────────────────────

export function createDefaultVisualSlot(
  source: VisualMetricKey = 'temporalFlux',
  param?: keyof VisualParams,
): VisualModulationSlot {
  const range = param !== undefined ? PARAM_RANGES[param] : undefined;
  return {
    source,
    amount: 0.5,
    offset: 0,
    multiplier: 1,
    smoothing: 0.5,
    invert: false,
    curve: 1.0,
    rangeMin: range?.min ?? 0,
    rangeMax: range?.max ?? 1,
    locked: false,
    muted: false,
    solo: false,
  };
}

export function createDefaultVisualModulation(
  source: VisualMetricKey = 'temporalFlux',
  param?: keyof VisualParams,
): VisualParameterModulation {
  return {
    enabled: false,
    slots: [createDefaultVisualSlot(source, param)],
  };
}

// ────────────────────────────────────────────────────────────────────
//  All mappable params (same as AudioMapper)
// ────────────────────────────────────────────────────────────────────

const ALL_MAPPABLE_PARAMS: ReadonlyArray<keyof VisualParams> = [
  'spikiness', 'spikeFrequency', 'spikeSharpness', 'scale', 'rotation', 'autoRotationSpeed',
  'hue', 'blendOpacity', 'fillSize', 'fillOpacity', 'strokeWeight', 'strokeOpacity', 'strokeGlow',
  'expansionFactor', 'fadeAmount', 'hueShiftAmount', 'noiseAmount', 'noiseRate', 'blurAmount', 'blurRate',
  'jiggleAmount', 'fishbowlShape', 'fishbowlDilation', 'radialPowerShape', 'radialPowerDilation',
  'kaleidoscopeSections', 'tunnelStrength', 'emanationRate',
];

// ────────────────────────────────────────────────────────────────────
//  VisualMapper
// ────────────────────────────────────────────────────────────────────

export class VisualMapper {
  private mappings: VisualMappings = {};
  private smoothedValues: Map<string, number> = new Map();
  private enabled: boolean = false;

  constructor() {
    this.initializeDefaultMappings();
  }

  private initializeDefaultMappings(): void {
    for (const param of ALL_MAPPABLE_PARAMS) {
      const mod = createDefaultVisualModulation('temporalFlux', param);
      this.mappings[param] = mod;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getMappings(): VisualMappings {
    return { ...this.mappings };
  }

  setMappings(mappings: VisualMappings): void {
    this.mappings = { ...mappings };
  }

  getModulation(param: keyof VisualParams): VisualParameterModulation | undefined {
    return this.mappings[param];
  }

  setModulation(param: keyof VisualParams, mod: VisualParameterModulation): void {
    this.mappings[param] = mod;
  }

  updateModulation(param: keyof VisualParams, partial: Partial<VisualParameterModulation>): void {
    const existing = this.mappings[param];
    if (existing !== undefined) {
      this.mappings[param] = { ...existing, ...partial };
    }
  }

  getSlot(param: keyof VisualParams, slotIndex: number): VisualModulationSlot | undefined {
    return this.mappings[param]?.slots[slotIndex];
  }

  updateSlot(param: keyof VisualParams, slotIndex: number, partial: Partial<VisualModulationSlot>): void {
    const mod = this.mappings[param];
    if (mod === undefined) return;
    const slot = mod.slots[slotIndex];
    if (slot === undefined) return;
    mod.slots[slotIndex] = { ...slot, ...partial };
  }

  addSlot(param: keyof VisualParams, slot: VisualModulationSlot): void {
    let mod = this.mappings[param];
    if (mod === undefined) {
      mod = createDefaultVisualModulation(slot.source, param);
      this.mappings[param] = mod;
    }
    mod.slots.push(slot);
  }

  removeSlot(param: keyof VisualParams, slotIndex: number): void {
    const mod = this.mappings[param];
    if (mod === undefined) return;
    mod.slots.splice(slotIndex, 1);
    if (mod.slots.length === 0) {
      mod.enabled = false;
    }
  }

  /**
   * Apply visual metrics to visual parameters.
   * Returns partial VisualParams with modified values for enabled mappings.
   */
  applyMappings(
    baseParams: VisualParams,
    metrics: VisualMetrics | null,
  ): Partial<VisualParams> {
    const result: Partial<VisualParams> = {};

    if (!this.enabled || metrics === null) {
      return result;
    }

    for (const [paramName, mod] of Object.entries(this.mappings)) {
      if (mod === undefined || !mod.enabled || mod.slots.length === 0) {
        continue;
      }

      const param = paramName as keyof VisualParams;
      const baseValue = baseParams[param];

      const anySolo = mod.slots.some((s) => s?.solo === true);
      const includeSlot = (slot: VisualModulationSlot | undefined): boolean => {
        if (slot === undefined) return false;
        if (anySolo) return slot.solo === true;
        return slot.muted !== true;
      };

      let totalOffset = 0;
      for (let i = 0; i < mod.slots.length; i++) {
        const slot = mod.slots[i];
        if (slot !== undefined && includeSlot(slot)) {
          totalOffset += this.computeSlotValue(param, i, slot, metrics);
        }
      }

      result[param] = baseValue + totalOffset;
    }

    return result;
  }

  private computeSlotValue(
    param: keyof VisualParams,
    slotIndex: number,
    slot: VisualModulationSlot,
    metrics: VisualMetrics,
  ): number {
    const smoothingKey = `v_${param}_${slotIndex}_smoothed`;
    const metricValue = metrics[slot.source] ?? 0;

    let v = metricValue * slot.amount;
    v = Math.max(0, Math.min(1, v));
    if (slot.curve !== 1.0) {
      v = Math.pow(v, slot.curve);
    }
    if (slot.invert) {
      v = 1 - v;
    }

    const prev = this.smoothedValues.get(smoothingKey) ?? v;
    const alpha = 1 - slot.smoothing;
    const smoothed = prev + alpha * (v - prev);
    this.smoothedValues.set(smoothingKey, smoothed);

    const rangeSpan = slot.rangeMax - slot.rangeMin;
    const base = slot.rangeMin + smoothed * rangeSpan;
    return base * (slot.multiplier ?? 1) + (slot.offset ?? 0);
  }

  getSlotOutput(
    param: keyof VisualParams,
    slotIndex: number,
    metrics: VisualMetrics,
  ): number {
    const slot = this.getSlot(param, slotIndex);
    if (slot === undefined) return PARAM_RANGES[param].min;
    return this.computeSlotValue(param, slotIndex, slot, metrics);
  }

  getActiveRoutes(): Array<{ param: keyof VisualParams; slotIndex: number }> {
    const routes: Array<{ param: keyof VisualParams; slotIndex: number }> = [];
    for (const [paramName, mod] of Object.entries(this.mappings)) {
      if (mod === undefined || !mod.enabled) continue;
      for (let i = 0; i < mod.slots.length; i++) {
        const slot = mod.slots[i];
        if (slot !== undefined && slot.muted !== true) {
          routes.push({ param: paramName as keyof VisualParams, slotIndex: i });
        }
      }
    }
    return routes;
  }

  resetSmoothing(): void {
    this.smoothedValues.clear();
  }

  static getAvailableMetrics(): VisualMetricKey[] {
    return [
      'luminanceVariance', 'colorEntropy', 'edgeDensity', 'saturationMean',
      'centerMass', 'radialSymmetry', 'fillRatio', 'temporalFlux',
      'fluxVariance', 'novelty', 'fitness',
    ];
  }

  static getMetricLabel(metric: VisualMetricKey): string {
    const labels: Record<VisualMetricKey, string> = {
      luminanceVariance: 'Luminance Var',
      colorEntropy: 'Color Entropy',
      edgeDensity: 'Edge Density',
      saturationMean: 'Saturation',
      centerMass: 'Center Mass',
      radialSymmetry: 'Radial Symmetry',
      fillRatio: 'Fill Ratio',
      temporalFlux: 'Temporal Flux',
      fluxVariance: 'Flux Variance',
      novelty: 'Novelty',
      fitness: 'Fitness',
    };
    return labels[metric];
  }
}
