/**
 * Audio-to-visual parameter mapping system (slot-based modulation routing)
 *
 * Each visual parameter can have one or more ModulationSlots, each routing
 * an audio metric through amount/curve/smoothing/range to produce a modulation value.
 * Multiple slots are summed (mod-matrix style). The current UI exposes one slot
 * per parameter; the data model supports arbitrary stacking.
 */

import type {
  AudioMetrics,
  AudioMappings,
  ModulationSlot,
  ParameterModulation,
  VisualParams,
  LegacyAudioMappingConfig,
  LegacyAudioMappings,
} from '../types';
import { PARAM_RANGES } from '../render/Parameters';

// ────────────────────────────────────────────────────────────────────
//  Factory helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Create a default ModulationSlot for a given audio source
 */
export function createDefaultSlot(
  source: keyof AudioMetrics = 'rms',
  param?: keyof VisualParams,
): ModulationSlot {
  const range = param !== undefined ? PARAM_RANGES[param] : undefined;
  return {
    source,
    amount: 0.5,
    smoothing: 0.5,
    invert: false,
    curve: 1.0,          // linear by default
    rangeMin: range?.min ?? 0,
    rangeMax: range?.max ?? 1,
  };
}

/**
 * Create a default ParameterModulation (disabled, one slot)
 */
export function createDefaultModulation(
  source: keyof AudioMetrics = 'rms',
  param?: keyof VisualParams,
): ParameterModulation {
  return {
    enabled: false,
    slots: [createDefaultSlot(source, param)],
  };
}

// ────────────────────────────────────────────────────────────────────
//  Default source assignments
// ────────────────────────────────────────────────────────────────────

/**
 * Default audio source for each visual parameter.
 * Based on lucas.html defaults with closest TypeScript equivalents:
 *
 * Lucas.html metric → TypeScript equivalent:
 * - audioAmp → rms (overall amplitude)
 * - bandEnergy[mid] → mid (mid frequency band)
 * - emptiness → emptiness (now exposed directly)
 * - lowImbalance → lowImbalance (now exposed directly)
 */
export const DEFAULT_AUDIO_SOURCES: Partial<Record<keyof VisualParams, keyof AudioMetrics>> = {
  spikiness: 'collision',
  spikeFrequency: 'rms',
  spikeSharpness: 'harshness',
  hue: 'mid',
  scale: 'compression',
  expansionFactor: 'bass',
  fadeAmount: 'mud',
  hueShiftAmount: 'phaseRisk',
  rotation: 'stereoWidth',
  fillSize: 'rms',
  fillOpacity: 'coherence',
  blendOpacity: 'mud',
  autoRotationSpeed: 'high',
  noiseAmount: 'harshness',
  noiseRate: 'presence',
  blurAmount: 'mud',
  blurRate: 'bass',
  jiggleAmount: 'rms',
  emanationRate: 'bass',
};

// ────────────────────────────────────────────────────────────────────
//  Migration
// ────────────────────────────────────────────────────────────────────

/**
 * Migrate a legacy flat AudioMappingConfig to the new ParameterModulation format.
 */
export function migrateLegacyMapping(
  legacy: LegacyAudioMappingConfig,
  param?: keyof VisualParams,
): ParameterModulation {
  const range = param !== undefined ? PARAM_RANGES[param] : undefined;
  return {
    enabled: legacy.enabled,
    slots: [
      {
        source: legacy.source,
        amount: legacy.sensitivity,
        smoothing: legacy.smoothing,
        invert: legacy.invert,
        curve: 1.0,
        rangeMin: range?.min ?? legacy.minValue,
        rangeMax: range?.max ?? legacy.maxValue,
      },
    ],
  };
}

/**
 * Migrate an entire legacy AudioMappings object to new format.
 */
export function migrateLegacyMappings(legacy: LegacyAudioMappings): AudioMappings {
  const result: AudioMappings = {};
  for (const [key, config] of Object.entries(legacy)) {
    if (config !== undefined) {
      const param = key as keyof VisualParams;
      result[param] = migrateLegacyMapping(config, param);
    }
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────
//  All mappable parameter names
// ────────────────────────────────────────────────────────────────────

/** All VisualParams keys that can be modulation targets */
export const ALL_MAPPABLE_PARAMS: ReadonlyArray<keyof VisualParams> = [
  'spikiness',
  'spikeFrequency',
  'spikeSharpness',
  'scale',
  'rotation',
  'autoRotationSpeed',
  'hue',
  'blendOpacity',
  'fillSize',
  'fillOpacity',
  'expansionFactor',
  'fadeAmount',
  'hueShiftAmount',
  'noiseAmount',
  'noiseRate',
  'blurAmount',
  'blurRate',
  'jiggleAmount',
  'emanationRate',
];

// ────────────────────────────────────────────────────────────────────
//  AudioMapper
// ────────────────────────────────────────────────────────────────────

/**
 * Audio mapper class for applying audio metrics to visual parameters
 * using the slot-based modulation routing model.
 */
export class AudioMapper {
  private mappings: AudioMappings = {};
  private smoothedValues: Map<string, number> = new Map();
  private enabled: boolean = true;

  constructor() {
    this.initializeDefaultMappings();
  }

  /**
   * Initialize default mappings for all visual parameters.
   * Some mappings are enabled by default for immediate audio reactivity.
   */
  private initializeDefaultMappings(): void {
    const enabledByDefault: ReadonlyArray<keyof VisualParams> = [
      'scale',
      'spikiness',
      'fillSize',
    ];

    for (const param of ALL_MAPPABLE_PARAMS) {
      const defaultSource = DEFAULT_AUDIO_SOURCES[param] ?? 'rms';
      const mod = createDefaultModulation(defaultSource, param);

      if (enabledByDefault.includes(param)) {
        mod.enabled = true;
        if (mod.slots[0] !== undefined) {
          mod.slots[0].amount = 0.5;
        }
      }

      this.mappings[param] = mod;
    }
  }

  // ── getters / setters ────────────────────────────────────────────

  /**
   * Get the full ParameterModulation config for a parameter.
   */
  getModulation(param: keyof VisualParams): ParameterModulation | undefined {
    return this.mappings[param];
  }

  /**
   * Set the full ParameterModulation config for a parameter.
   */
  setModulation(param: keyof VisualParams, mod: ParameterModulation): void {
    this.mappings[param] = mod;
  }

  /**
   * Partially update the modulation config for a parameter.
   * Merges top-level fields; does NOT deep-merge slots.
   */
  updateModulation(param: keyof VisualParams, partial: Partial<ParameterModulation>): void {
    const existing = this.mappings[param] ?? createDefaultModulation('rms', param);
    this.mappings[param] = { ...existing, ...partial };
  }

  /**
   * Get the first (primary) slot for a parameter, creating a default if needed.
   */
  getPrimarySlot(param: keyof VisualParams): ModulationSlot {
    const mod = this.mappings[param];
    const slot = mod?.slots[0];
    if (slot !== undefined) {
      return slot;
    }
    const defaultSource = DEFAULT_AUDIO_SOURCES[param] ?? 'rms';
    return createDefaultSlot(defaultSource, param);
  }

  /**
   * Update the primary slot for a parameter (slot index 0).
   */
  updatePrimarySlot(param: keyof VisualParams, partial: Partial<ModulationSlot>): void {
    const mod = this.mappings[param] ?? createDefaultModulation('rms', param);
    const existing = mod.slots[0] ?? createDefaultSlot('rms', param);
    const updated = { ...existing, ...partial };
    mod.slots = [updated, ...mod.slots.slice(1)];
    this.mappings[param] = mod;
  }

  /** Get all mappings */
  getMappings(): AudioMappings {
    return { ...this.mappings };
  }

  /** Set all mappings at once */
  setMappings(mappings: AudioMappings): void {
    this.mappings = { ...mappings };
  }

  /** Enable or disable the audio mapper globally */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Check if audio mapping is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ── apply mappings ───────────────────────────────────────────────

  /**
   * Apply audio metrics to visual parameters.
   * Returns partial VisualParams with modified values for enabled mappings.
   */
  applyMappings(
    baseParams: VisualParams,
    metrics: AudioMetrics | null,
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
      const range = PARAM_RANGES[param];
      const baseValue = baseParams[param];

      // Sum contributions from all slots
      let totalModulation = 0;
      for (let i = 0; i < mod.slots.length; i++) {
        const slot = mod.slots[i];
        if (slot !== undefined) {
          totalModulation += this.computeSlotValue(param, i, slot, metrics);
        }
      }

      // Add modulation to base and clamp
      const finalValue = Math.max(range.min, Math.min(range.max, baseValue + totalModulation));
      result[param] = finalValue;
    }

    return result;
  }

  /**
   * Compute a single slot's modulation output.
   *
   * Signal flow: metric → amount → curve → invert → smooth → range → output
   */
  private computeSlotValue(
    param: keyof VisualParams,
    slotIndex: number,
    slot: ModulationSlot,
    metrics: AudioMetrics,
  ): number {
    const smoothingKey = `${param}_${slotIndex}_smoothed`;
    const metricValue = metrics[slot.source] ?? 0;

    // 1. Apply amount (depth)
    let v = metricValue * slot.amount;

    // 2. Apply power curve (shape the response)
    //    Clamp to 0-1 first so pow() is well-behaved
    v = Math.max(0, Math.min(1, v));
    if (slot.curve !== 1.0) {
      v = Math.pow(v, slot.curve);
    }

    // 3. Apply inversion
    if (slot.invert) {
      v = 1 - v;
    }

    // 4. Apply EMA smoothing
    const prev = this.smoothedValues.get(smoothingKey) ?? v;
    const alpha = 1 - slot.smoothing;
    const smoothed = prev + alpha * (v - prev);
    this.smoothedValues.set(smoothingKey, smoothed);

    // 5. Map to parameter-space range
    const rangeSpan = slot.rangeMax - slot.rangeMin;
    return slot.rangeMin + smoothed * rangeSpan;
  }

  // ── utilities ────────────────────────────────────────────────────

  /** Reset all smoothing state (call when stopping audio) */
  resetSmoothing(): void {
    this.smoothedValues.clear();
  }

  /** Export mappings as JSON */
  exportMappings(): string {
    return JSON.stringify(this.mappings, null, 2);
  }

  /** Import mappings from JSON (handles both new and legacy formats) */
  importMappings(json: string): boolean {
    try {
      const data = JSON.parse(json) as Record<string, unknown>;
      // Detect legacy format: check if first entry has 'sensitivity' field
      const firstEntry = Object.values(data).find((v) => v !== undefined && v !== null);
      if (firstEntry !== null && typeof firstEntry === 'object' && 'sensitivity' in (firstEntry as Record<string, unknown>)) {
        // Legacy format — migrate
        const migrated = migrateLegacyMappings(data as unknown as LegacyAudioMappings);
        this.mappings = { ...this.mappings, ...migrated };
      } else {
        // New format
        this.mappings = { ...this.mappings, ...(data as AudioMappings) };
      }
      return true;
    } catch (error) {
      console.error('Failed to import audio mappings:', error);
      return false;
    }
  }

  /** Get list of all available audio metrics */
  static getAvailableMetrics(): Array<keyof AudioMetrics> {
    return [
      'rms',
      'bass',
      'mid',
      'high',
      'presence',
      'harshness',
      'mud',
      'compression',
      'collision',
      'coherence',
      'stereoWidth',
      'phaseRisk',
      'lowImbalance',
      'emptiness',
      'panPosition',
    ];
  }

  /** Get human-readable name for a metric */
  static getMetricLabel(metric: keyof AudioMetrics): string {
    const labels: Record<keyof AudioMetrics, string> = {
      rms: 'RMS Level',
      bass: 'Bass',
      mid: 'Mid',
      high: 'High',
      presence: 'Presence',
      harshness: 'Harshness',
      mud: 'Mud',
      compression: 'Compression',
      collision: 'Collision',
      coherence: 'Coherence',
      stereoWidth: 'Stereo Width',
      phaseRisk: 'Phase Risk',
      lowImbalance: 'Low Imbalance',
      emptiness: 'Emptiness',
      panPosition: 'Pan Position',
    };
    return labels[metric];
  }
}
