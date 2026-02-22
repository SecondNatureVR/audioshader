/**
 * Audio event detection — drop, breakdown, silence, onset
 * Consumes AudioMetrics (injectable for unit testing)
 */

import type { AudioMetrics } from '../types';

export type AudioEventType = 'drop' | 'breakdown' | 'silence' | 'songStart' | 'onset';

export interface AudioEvent {
  type: AudioEventType;
  strength: number;
  timestamp: number;
}

export interface AudioEventDetectorOptions {
  dropRatio?: number;
  breakdownRatio?: number;
  silenceDuration?: number;
  silenceRmsThreshold?: number;
  silenceEmptinessThreshold?: number;
  dropDebounceMs?: number;
  breakdownDebounceMs?: number;
  onsetCollisionThreshold?: number;
  onsetDebounceMs?: number;
  warmupFrames?: number;
}

const DEFAULT_OPTIONS: Required<AudioEventDetectorOptions> = {
  warmupFrames: 30,
  dropRatio: 1.4,
  breakdownRatio: 0.5,
  silenceDuration: 2,
  silenceRmsThreshold: 0.05,
  silenceEmptinessThreshold: 0.9,
  dropDebounceMs: 2000,
  breakdownDebounceMs: 2000,
  onsetCollisionThreshold: 0.6,
  onsetDebounceMs: 80,
};

export class AudioEventDetector {
  private options: Required<AudioEventDetectorOptions>;
  private shortRms: number = 0;
  private longRms: number = 0;
  private lastDropTime: number = -1e9;
  private lastBreakdownTime: number = -1e9;
  private lastOnsetTime: number = -1e9;
  private silenceStartTime: number = -1e9;
  private wasSilent: boolean = false;
  private prevCollision: number = 0;
  private frameCount: number = 0;
  private alphaShort: number;
  private alphaLong: number;

  constructor(options: AudioEventDetectorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.alphaShort = 1 - Math.exp(-1 / (6)); // ~100ms at 60fps
    this.alphaLong = 1 - Math.exp(-1 / (90)); // ~1.5s at 60fps
  }

  /**
   * Update with new metrics. Returns any events that fired.
   */
  update(metrics: AudioMetrics, timestamp: number): AudioEvent[] {
    const events: AudioEvent[] = [];

    this.shortRms = this.shortRms + this.alphaShort * (metrics.rms - this.shortRms);
    this.longRms = this.longRms + this.alphaLong * (metrics.rms - this.longRms);

    const dropDebounceSec = this.options.dropDebounceMs / 1000;
    const breakdownDebounceSec = this.options.breakdownDebounceMs / 1000;
    const onsetDebounceSec = this.options.onsetDebounceMs / 1000;

    const warmupFrames = this.options.warmupFrames ?? 30;
    const minLongRms = 0.02;
    if (this.frameCount > warmupFrames && this.longRms > minLongRms) {
      if (
        this.shortRms > this.longRms * this.options.dropRatio &&
        timestamp - this.lastDropTime > dropDebounceSec
      ) {
        events.push({ type: 'drop', strength: 1, timestamp });
        this.lastDropTime = timestamp;
      }
      if (
        this.shortRms < this.longRms * this.options.breakdownRatio &&
        timestamp - this.lastBreakdownTime > breakdownDebounceSec
      ) {
        events.push({ type: 'breakdown', strength: 1, timestamp });
        this.lastBreakdownTime = timestamp;
      }
    }

    if (
      metrics.rms < this.options.silenceRmsThreshold &&
      metrics.emptiness > this.options.silenceEmptinessThreshold
    ) {
      if (this.silenceStartTime < 0) {
        this.silenceStartTime = timestamp;
      }
      if (timestamp - this.silenceStartTime >= this.options.silenceDuration) {
        if (!this.wasSilent) {
          events.push({ type: 'silence', strength: 1, timestamp });
          this.wasSilent = true;
        }
      }
    } else {
      this.silenceStartTime = -1;
      if (this.wasSilent && metrics.rms > 0.3) {
        events.push({ type: 'songStart', strength: 1, timestamp });
        this.wasSilent = false;
      } else {
        this.wasSilent = false;
      }
    }

    if (
      metrics.collision > this.options.onsetCollisionThreshold &&
      metrics.collision > this.prevCollision &&
      timestamp - this.lastOnsetTime > onsetDebounceSec
    ) {
      events.push({ type: 'onset', strength: metrics.collision, timestamp });
      this.lastOnsetTime = timestamp;
    }
    this.prevCollision = metrics.collision;
    this.frameCount += 1;

    return events;
  }

  reset(): void {
    this.shortRms = 0;
    this.longRms = 0;
    this.frameCount = 0;
    this.lastDropTime = -1e9;
    this.lastBreakdownTime = -1e9;
    this.lastOnsetTime = -1e9;
    this.silenceStartTime = -1e9;
    this.wasSilent = false;
    this.prevCollision = 0;
  }
}
