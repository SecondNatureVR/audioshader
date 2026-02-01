/**
 * Audio-to-visual parameter mapping system
 * Maps audio metrics to visual parameters with configurable sensitivity and smoothing
 */

import type { AudioMetrics, AudioMappingConfig, AudioMappings, VisualParams } from '../types';
import { PARAM_RANGES } from '../render/Parameters';

/**
 * Default mapping configuration for a parameter
 */
export function createDefaultMappingConfig(source: keyof AudioMetrics = 'rms'): AudioMappingConfig {
  return {
    enabled: false,
    source,
    sensitivity: 1.0,
    smoothing: 0.5,
    multiplier: 1.0,
    offset: 0,
    invert: false,
    minValue: 0,
    maxValue: 1,
  };
}

/**
 * Default audio source for each visual parameter
 * Based on lucas.html defaults with closest TypeScript equivalents:
 *
 * Lucas.html metric → TypeScript equivalent:
 * - audioAmp → rms (overall amplitude)
 * - bandEnergy[mid] → mid (mid frequency band)
 * - emptiness → bass (low frequency content, inverted conceptually)
 * - lowImbalance → stereoWidth (stereo characteristics)
 */
export const DEFAULT_AUDIO_SOURCES: Partial<Record<keyof VisualParams, keyof AudioMetrics>> = {
  spikiness: 'collision',        // lucas.html: collision ✓
  spikeFrequency: 'rms',         // lucas.html: audioAmp → rms
  spikeSharpness: 'harshness',   // lucas.html: harshness ✓
  hue: 'mid',                    // lucas.html: bandEnergy[mid] → mid
  scale: 'compression',          // lucas.html: compression ✓
  expansionFactor: 'bass',       // lucas.html: emptiness → bass
  fadeAmount: 'mud',             // lucas.html: mud ✓
  hueShiftAmount: 'phaseRisk',   // lucas.html: phaseRisk ✓
  rotation: 'stereoWidth',       // lucas.html: lowImbalance → stereoWidth
  fillSize: 'rms',               // lucas.html: audioAmp → rms
  fillOpacity: 'coherence',      // lucas.html: coherence ✓
  blendOpacity: 'mud',           // lucas.html: mud ✓
  autoRotationSpeed: 'high',     // High frequencies for rotation speed variation
  noiseAmount: 'harshness',      // Harshness adds visual noise
  noiseRate: 'presence',         // Presence affects noise rate
  blurAmount: 'mud',             // Mud adds blur
  blurRate: 'bass',              // Bass affects blur pulsing
  jiggleAmount: 'rms',           // Overall amplitude for jiggle
};

/**
 * Audio mapper class for applying audio metrics to visual parameters
 */
export class AudioMapper {
  private mappings: AudioMappings = {};
  private smoothedValues: Map<string, number> = new Map();
  private enabled: boolean = true;

  constructor() {
    this.initializeDefaultMappings();
  }

  /**
   * Initialize default mappings for all visual parameters
   * Some mappings are enabled by default for immediate audio reactivity
   */
  private initializeDefaultMappings(): void {
    const paramNames: Array<keyof VisualParams> = [
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
    ];

    // Parameters to enable by default for immediate audio reactivity
    const enabledByDefault: Array<keyof VisualParams> = [
      'scale',      // React to bass
      'spikiness',  // React to RMS
      'fillSize',   // React to bass
    ];

    for (const param of paramNames) {
      const defaultSource = DEFAULT_AUDIO_SOURCES[param] ?? 'rms';
      const config = createDefaultMappingConfig(defaultSource);

      // Enable some mappings by default
      if (enabledByDefault.includes(param)) {
        config.enabled = true;
        config.sensitivity = 0.5;  // Start with moderate sensitivity
      }

      this.mappings[param] = config;
    }
  }

  /**
   * Set the mapping configuration for a parameter
   */
  setMapping(param: keyof VisualParams, config: Partial<AudioMappingConfig>): void {
    const existing = this.mappings[param] ?? createDefaultMappingConfig();
    this.mappings[param] = { ...existing, ...config };
  }

  /**
   * Get the mapping configuration for a parameter
   */
  getMapping(param: keyof VisualParams): AudioMappingConfig | undefined {
    return this.mappings[param];
  }

  /**
   * Get all mappings
   */
  getMappings(): AudioMappings {
    return { ...this.mappings };
  }

  /**
   * Set all mappings at once
   */
  setMappings(mappings: AudioMappings): void {
    this.mappings = { ...mappings };
  }

  /**
   * Enable or disable the audio mapper
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if audio mapping is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Apply audio metrics to visual parameters
   * Returns the modified values for parameters that have enabled mappings
   */
  applyMappings(
    baseParams: VisualParams,
    metrics: AudioMetrics | null
  ): Partial<VisualParams> {
    const result: Partial<VisualParams> = {};

    if (!this.enabled || metrics === null) {
      return result;
    }

    for (const [paramName, config] of Object.entries(this.mappings)) {
      if (!config?.enabled) {
        continue;
      }

      const param = paramName as keyof VisualParams;
      const metricValue = metrics[config.source];

      // Apply the mapping
      const mappedValue = this.computeMappedValue(
        param,
        metricValue,
        baseParams[param],
        config
      );

      result[param] = mappedValue;
    }

    return result;
  }

  /**
   * Compute the mapped value for a parameter
   */
  private computeMappedValue(
    param: keyof VisualParams,
    metricValue: number,
    baseValue: number,
    config: AudioMappingConfig
  ): number {
    const range = PARAM_RANGES[param];
    const smoothingKey = `${param}_smoothed`;

    // Apply sensitivity (controls how much of the metric range is used)
    let normalizedMetric = metricValue * config.sensitivity;

    // Apply inversion
    if (config.invert) {
      normalizedMetric = 1 - normalizedMetric;
    }

    // Clamp to 0-1
    normalizedMetric = Math.max(0, Math.min(1, normalizedMetric));

    // Apply smoothing (EMA)
    const prevSmoothed = this.smoothedValues.get(smoothingKey) ?? normalizedMetric;
    const alpha = 1 - config.smoothing;
    const smoothed = prevSmoothed + alpha * (normalizedMetric - prevSmoothed);
    this.smoothedValues.set(smoothingKey, smoothed);

    // Map to parameter range with multiplier and offset
    const mappedRange = config.maxValue - config.minValue;
    const mappedValue = config.minValue + smoothed * mappedRange * config.multiplier + config.offset;

    // Add to base value and clamp to parameter range
    const finalValue = baseValue + mappedValue;
    return Math.max(range.min, Math.min(range.max, finalValue));
  }

  /**
   * Reset smoothing values (call when stopping audio)
   */
  resetSmoothing(): void {
    this.smoothedValues.clear();
  }

  /**
   * Export mappings as JSON
   */
  exportMappings(): string {
    return JSON.stringify(this.mappings, null, 2);
  }

  /**
   * Import mappings from JSON
   */
  importMappings(json: string): boolean {
    try {
      const data = JSON.parse(json) as AudioMappings;
      this.mappings = { ...this.mappings, ...data };
      return true;
    } catch (error) {
      console.error('Failed to import audio mappings:', error);
      return false;
    }
  }

  /**
   * Get list of available audio metrics
   */
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
    ];
  }

  /**
   * Get human-readable name for a metric
   */
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
    };
    return labels[metric];
  }
}
