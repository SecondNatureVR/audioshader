/**
 * Audio Radar Chart
 * Canvas-based radar/polygon of the 5 most salient audio metrics (by rolling average).
 * Values are normalized relative to each other; color reflects dominant frequency band.
 */

import type { AudioMetrics } from '../types';
import { AudioMapper } from '../audio/AudioMapper';

const ALL_METRICS: Array<keyof AudioMetrics> = [
  'rms', 'bass', 'mid', 'high', 'presence', 'harshness',
  'mud', 'compression', 'collision', 'coherence', 'stereoWidth', 'phaseRisk',
  'lowImbalance', 'emptiness', 'panPosition',
];

const TOP_N = 5;
const ROLLING_ALPHA = 0.03;
const SMOOTH_TOP_ALPHA = 0.08; // when top-5 set changes, ease the new axes in

/** Frequency band for color: warm = bass, mid = green, high = blue, dynamics = purple */
type Band = 'bass' | 'mid' | 'high' | 'dynamics';
const METRIC_BAND: Record<keyof AudioMetrics, Band> = {
  rms: 'dynamics',
  bass: 'bass',
  mid: 'mid',
  high: 'high',
  presence: 'high',
  harshness: 'high',
  mud: 'mid',
  compression: 'dynamics',
  collision: 'dynamics',
  coherence: 'mid',
  stereoWidth: 'high',
  phaseRisk: 'dynamics',
  lowImbalance: 'mid',
  emptiness: 'dynamics',
  panPosition: 'mid',
};

const BAND_COLORS: Record<Band, { fill: string; stroke: string }> = {
  bass: { fill: 'rgba(255, 120, 60, 0.2)', stroke: 'rgba(255, 140, 80, 0.85)' },
  mid: { fill: 'rgba(120, 255, 100, 0.2)', stroke: 'rgba(140, 255, 120, 0.85)' },
  high: { fill: 'rgba(80, 180, 255, 0.2)', stroke: 'rgba(100, 200, 255, 0.85)' },
  dynamics: { fill: 'rgba(180, 80, 255, 0.2)', stroke: 'rgba(200, 100, 255, 0.85)' },
};

export class AudioRadarChart {
  private ctx: CanvasRenderingContext2D;
  private size: number;
  private center: number;
  private radius: number;
  /** Rolling average per metric (all 15) */
  private rollingAvg: number[] = new Array(ALL_METRICS.length).fill(0);
  /** Current top-5 metric indices (into ALL_METRICS) */
  private topIndices: number[] = [];
  /** Smoothed values for the 5 displayed axes (for stable polygon when set changes) */
  private displayValues: number[] = new Array(TOP_N).fill(0);
  /** Last top-5 indices to detect set changes */
  private prevTopIndices: number[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('Could not get 2d context for radar chart');
    this.ctx = ctx;
    this.size = canvas.width;
    this.center = this.size / 2;
    this.radius = this.size * 0.38;
  }

  update(metrics: AudioMetrics | null): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);

    const n = TOP_N;
    const angleStep = (Math.PI * 2) / n;
    this.drawGrid(n, angleStep);

    if (metrics === null) {
      this.drawLabels(n, angleStep, []);
      return;
    }

    // Update rolling average for all metrics
    for (let i = 0; i < ALL_METRICS.length; i++) {
      const v = Math.max(0, Math.min(1, metrics[ALL_METRICS[i]!] ?? 0));
      this.rollingAvg[i] = this.rollingAvg[i]! + ROLLING_ALPHA * (v - this.rollingAvg[i]!);
    }

    // Top 5 by rolling average (descending)
    const indices = ALL_METRICS.map((_, i) => i)
      .sort((a, b) => (this.rollingAvg[b] ?? 0) - (this.rollingAvg[a] ?? 0))
      .slice(0, TOP_N);

    this.topIndices = indices;

    // Values for the 5 selected metrics (current raw, then normalize relative)
    const rawFive = indices.map((i) => this.rollingAvg[i] ?? 0);
    const maxRaw = Math.max(...rawFive, 0.001);
    const normalized = rawFive.map((v) => v / maxRaw);

    // Smooth display values when top-5 set changes
    const setChanged =
      this.prevTopIndices.length !== indices.length ||
      this.prevTopIndices.some((v, i) => v !== indices[i]);
    if (setChanged) {
      this.prevTopIndices = [...indices];
    }
    for (let i = 0; i < TOP_N; i++) {
      const target = normalized[i] ?? 0;
      const alpha = setChanged ? SMOOTH_TOP_ALPHA : 0.2;
      this.displayValues[i] = this.displayValues[i]! + alpha * (target - this.displayValues[i]!);
    }

    // Dominant band for color (weight by displayed values)
    const bandWeights: Record<Band, number> = {
      bass: 0,
      mid: 0,
      high: 0,
      dynamics: 0,
    };
    for (let i = 0; i < TOP_N; i++) {
      const idx = indices[i];
      if (idx === undefined) continue;
      const band = METRIC_BAND[ALL_METRICS[idx]!];
      bandWeights[band] = (bandWeights[band] ?? 0) + (this.displayValues[i] ?? 0);
    }
    const dominantBand = (Object.entries(bandWeights) as [Band, number][]).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? 'dynamics';
    const colors = BAND_COLORS[dominantBand]!;

    this.drawPolygon(this.displayValues, colors.fill, colors.stroke, 1.5);
    this.drawLabels(n, angleStep, indices);
  }

  private drawGrid(n: number, angleStep: number): void {
    const ctx = this.ctx;
    const rings = 4;
    for (let r = 1; r <= rings; r++) {
      const ringRadius = (this.radius * r) / rings;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = this.center + Math.cos(angle) * ringRadius;
        const y = this.center + Math.sin(angle) * ringRadius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const angle = i * angleStep - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(this.center, this.center);
      ctx.lineTo(
        this.center + Math.cos(angle) * this.radius,
        this.center + Math.sin(angle) * this.radius
      );
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  private drawLabels(
    n: number,
    angleStep: number,
    metricIndices: number[],
  ): void {
    const ctx = this.ctx;
    ctx.font = '7px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelRadius = this.radius + 12;
    for (let i = 0; i < n; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = this.center + Math.cos(angle) * labelRadius;
      const y = this.center + Math.sin(angle) * labelRadius;
      const metricKey = metricIndices[i] !== undefined ? ALL_METRICS[metricIndices[i]!] : null;
      const label = metricKey
        ? (AudioMapper.getMetricLabel(metricKey).length > 6
            ? AudioMapper.getMetricLabel(metricKey).slice(0, 5) + '.'
            : AudioMapper.getMetricLabel(metricKey))
        : '';
      ctx.fillText(label, x, y);
    }
  }

  private drawPolygon(
    values: number[],
    fillColor: string,
    strokeColor: string,
    lineWidth: number,
  ): void {
    const ctx = this.ctx;
    const n = values.length;
    const angleStep = (Math.PI * 2) / n;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const angle = idx * angleStep - Math.PI / 2;
      const r = this.radius * (values[idx] ?? 0);
      const x = this.center + Math.cos(angle) * r;
      const y = this.center + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}
