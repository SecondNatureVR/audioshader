/**
 * Audio-to-visual parameter mapping system (slot-based modulation routing)
 *
 * Each visual parameter can have one or more ModulationSlots, each routing
 * an audio metric through amount/curve/smoothing/range to produce a modulation value.
 * Multiple slots are summed (mod-matrix style).
 *
 * Signal flow per slot:
 *   metric * amount -> clamp(0,1) -> pow(curve) -> invert -> EMA smooth
 *     -> * multiplier + offset -> clamp(0,1) -> rangeMin + v * rangeSpan
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
    offset: 0,
    multiplier: 1,
    smoothing: 0.5,
    invert: false,
    curve: 1.0,          // linear by default
    rangeMin: range?.min ?? 0,
    rangeMax: range?.max ?? 1,
    locked: false,
    muted: false,
    solo: false,
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

/**
 * Normalize a slot loaded from storage that may be missing newer fields.
 * Ensures offset and multiplier are present with correct defaults.
 */
export function normalizeSlot(slot: Partial<ModulationSlot> & Pick<ModulationSlot, 'source'>): ModulationSlot {
  return {
    source: slot.source,
    amount: slot.amount ?? 0.5,
    offset: slot.offset ?? 0,
    multiplier: slot.multiplier ?? 1,
    smoothing: slot.smoothing ?? 0.5,
    invert: slot.invert ?? false,
    curve: slot.curve ?? 1.0,
    rangeMin: slot.rangeMin ?? 0,
    rangeMax: slot.rangeMax ?? 1,
    locked: slot.locked ?? false,
    muted: slot.muted ?? false,
    solo: slot.solo ?? false,
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
        offset: legacy.offset ?? 0,
        multiplier: legacy.multiplier ?? 1,
        smoothing: legacy.smoothing,
        invert: legacy.invert,
        curve: 1.0,
        rangeMin: range?.min ?? legacy.minValue,
        rangeMax: range?.max ?? legacy.maxValue,
        locked: false,
        muted: false,
        solo: false,
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

  // ── slot management ──────────────────────────────────────────────

  /**
   * Add a new modulation slot to a parameter.
   * Creates the ParameterModulation entry if it doesn't exist.
   */
  addSlot(param: keyof VisualParams, slot?: ModulationSlot): ModulationSlot {
    const mod = this.mappings[param] ?? createDefaultModulation('rms', param);
    const newSlot = slot ?? createDefaultSlot('rms', param);
    mod.slots.push(newSlot);
    this.mappings[param] = mod;
    return newSlot;
  }

  /**
   * Remove a modulation slot at the given index.
   * If the last slot is removed, modulation is disabled for that parameter.
   */
  removeSlot(param: keyof VisualParams, slotIndex: number): void {
    const mod = this.mappings[param];
    if (mod === undefined) return;
    if (slotIndex < 0 || slotIndex >= mod.slots.length) return;

    // Clear smoothing state for the removed slot and re-index higher slots
    this.smoothedValues.delete(`${param}_${slotIndex}_smoothed`);
    for (let i = slotIndex + 1; i < mod.slots.length; i++) {
      const key = `${param}_${i}_smoothed`;
      const val = this.smoothedValues.get(key);
      if (val !== undefined) {
        this.smoothedValues.set(`${param}_${i - 1}_smoothed`, val);
        this.smoothedValues.delete(key);
      }
    }

    mod.slots.splice(slotIndex, 1);

    // Auto-disable when all slots removed
    if (mod.slots.length === 0) {
      mod.enabled = false;
    }

    this.mappings[param] = mod;
  }

  /**
   * Update a slot at a specific index.
   */
  updateSlot(param: keyof VisualParams, slotIndex: number, partial: Partial<ModulationSlot>): void {
    const mod = this.mappings[param];
    if (mod === undefined) return;
    const existing = mod.slots[slotIndex];
    if (existing === undefined) return;
    mod.slots[slotIndex] = { ...existing, ...partial };
    this.mappings[param] = mod;
  }

  /**
   * Get the number of modulation slots for a parameter.
   */
  getSlotCount(param: keyof VisualParams): number {
    return this.mappings[param]?.slots.length ?? 0;
  }

  /**
   * Get a specific slot by index.
   */
  getSlot(param: keyof VisualParams, slotIndex: number): ModulationSlot | undefined {
    return this.mappings[param]?.slots[slotIndex];
  }

  /**
   * Get all active routes as a flat list of { param, slotIndex, slot } entries.
   * Only includes enabled parameters with at least one slot.
   */
  getActiveRoutes(): Array<{ param: keyof VisualParams; slotIndex: number; slot: ModulationSlot }> {
    const routes: Array<{ param: keyof VisualParams; slotIndex: number; slot: ModulationSlot }> = [];
    for (const [paramName, mod] of Object.entries(this.mappings)) {
      if (mod === undefined || !mod.enabled) continue;
      const param = paramName as keyof VisualParams;
      for (let i = 0; i < mod.slots.length; i++) {
        const slot = mod.slots[i];
        if (slot !== undefined) {
          routes.push({ param, slotIndex: i, slot });
        }
      }
    }
    return routes;
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

      // Mute/solo: if any slot has solo, only soloed slots contribute; else all non-muted slots
      const anySolo = mod.slots.some((s) => s?.solo === true);
      const includeSlot = (slot: ModulationSlot | undefined, i: number): boolean => {
        if (slot === undefined) return false;
        if (anySolo) return slot.solo === true;
        return slot.muted !== true;
      };

      // Sum contributions from included slots
      let totalModulation = 0;
      for (let i = 0; i < mod.slots.length; i++) {
        const slot = mod.slots[i];
        if (slot !== undefined && includeSlot(slot, i)) {
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
   * Signal flow: metric → amount → curve → invert → smooth → *multiplier+offset → range → output
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

    // 5. Apply multiplier and offset (linear transform)
    const mult = slot.multiplier ?? 1;
    const off = slot.offset ?? 0;
    const transformed = Math.max(0, Math.min(1, smoothed * mult + off));

    // 6. Map to parameter-space range
    const rangeSpan = slot.rangeMax - slot.rangeMin;
    return slot.rangeMin + transformed * rangeSpan;
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
        // New format — normalize slots to ensure offset/multiplier are present
        const imported = data as AudioMappings;
        for (const mod of Object.values(imported)) {
          if (mod !== undefined && mod.slots !== undefined) {
            mod.slots = mod.slots.map((s) => normalizeSlot(s));
          }
        }
        this.mappings = { ...this.mappings, ...imported };
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
